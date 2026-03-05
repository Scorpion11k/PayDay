import prisma from '../config/database';
import notificationDispatchService from './notification-dispatch.service';
import flowRuntimeService from './flow-runtime.service';

interface ExecutorRunStats {
  scanned: number;
  claimed: number;
  completedPaid: number;
  completedEnd: number;
  advanced: number;
  failed: number;
  retried: number;
  skipped: number;
}

const RETRY_INTERVAL_SECONDS = 60;
const MAX_ATTEMPTS_PER_STATE = 3;

class FlowExecutorService {
  private poller: NodeJS.Timeout | null = null;

  private async bootstrapMissingRunningInstances(limit: number) {
    const assignments = await prisma.collectionFlowAssignment.findMany({
      where: {
        customer: {
          debts: {
            some: {
              status: { in: ['open', 'in_collection'] },
            },
          },
          flowInstances: {
            none: {
              status: 'running',
            },
          },
        },
      },
      select: {
        customerId: true,
        flowId: true,
      },
      take: limit,
    });

    for (const assignment of assignments) {
      await flowRuntimeService.ensureRunningInstance(assignment.customerId, prisma, assignment.flowId);
    }
  }

  private async claimDueInstanceIds(limit: number): Promise<string[]> {
    const now = new Date();
    const candidates = await prisma.collectionFlowInstance.findMany({
      where: {
        status: 'running',
        OR: [{ nextEvaluationAt: null }, { nextEvaluationAt: { lte: now } }],
      },
      select: { id: true },
      orderBy: [{ nextEvaluationAt: 'asc' }, { startedAt: 'asc' }],
      take: limit,
    });

    const claimed: string[] = [];
    for (const candidate of candidates) {
      const lockUntil = new Date(Date.now() + RETRY_INTERVAL_SECONDS * 1000);
      const lock = await prisma.collectionFlowInstance.updateMany({
        where: {
          id: candidate.id,
          status: 'running',
          OR: [{ nextEvaluationAt: null }, { nextEvaluationAt: { lte: now } }],
        },
        data: {
          nextEvaluationAt: lockUntil,
        },
      });
      if (lock.count > 0) {
        claimed.push(candidate.id);
      }
    }

    return claimed;
  }

  private async processInstance(instanceId: string, stats: ExecutorRunStats) {
    const now = new Date();
    const instance = await prisma.collectionFlowInstance.findUnique({
      where: { id: instanceId },
      include: {
        flow: {
          include: {
            states: true,
            transitions: {
              orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
            },
          },
        },
        currentState: true,
        stateStatuses: {
          include: {
            state: true,
          },
        },
      },
    });

    if (!instance || instance.status !== 'running') {
      stats.skipped++;
      return;
    }

    const openDebtCount = await prisma.debt.count({
      where: {
        customerId: instance.customerId,
        status: { in: ['open', 'in_collection'] },
      },
    });

    if (openDebtCount === 0) {
      await prisma.collectionFlowInstance.update({
        where: { id: instance.id },
        data: {
          status: 'completed_paid',
          finishedAt: now,
          currentStateId: null,
          nextEvaluationAt: null,
          lastEvaluatedAt: now,
          lastError: null,
        },
      });
      stats.completedPaid++;
      return;
    }

    if (!instance.currentStateId || !instance.currentState) {
      await prisma.collectionFlowInstance.update({
        where: { id: instance.id },
        data: {
          status: 'failed',
          finishedAt: now,
          nextEvaluationAt: null,
          lastEvaluatedAt: now,
          lastError: 'Missing current state',
        },
      });
      stats.failed++;
      return;
    }

    const currentStatus = instance.stateStatuses.find(
      (stateStatus) => stateStatus.stateId === instance.currentStateId
    );

    if (!currentStatus) {
      await prisma.collectionFlowInstance.update({
        where: { id: instance.id },
        data: {
          status: 'failed',
          finishedAt: now,
          nextEvaluationAt: null,
          lastEvaluatedAt: now,
          lastError: 'Missing current state status row',
        },
      });
      stats.failed++;
      return;
    }

    if (currentStatus.status === 'failed') {
      await prisma.collectionFlowInstance.update({
        where: { id: instance.id },
        data: {
          status: 'failed',
          finishedAt: now,
          nextEvaluationAt: null,
          lastEvaluatedAt: now,
          lastError: currentStatus.errorMessage || 'Current state failed',
        },
      });
      stats.failed++;
      return;
    }

    if (currentStatus.status === 'upcoming' || currentStatus.status === 'waiting') {
      const dueAt = currentStatus.dueAt || now;
      if (currentStatus.status === 'upcoming' && dueAt <= now) {
        await prisma.collectionFlowStateInstance.update({
          where: { id: currentStatus.id },
          data: { status: 'waiting' },
        });
        currentStatus.status = 'waiting';
      }
      if (dueAt > now) {
        await prisma.collectionFlowInstance.update({
          where: { id: instance.id },
          data: {
            nextEvaluationAt: dueAt,
            lastEvaluatedAt: now,
            lastError: null,
          },
        });
        stats.skipped++;
        return;
      }
    }

    if (currentStatus.status !== 'waiting') {
      await prisma.collectionFlowInstance.update({
        where: { id: instance.id },
        data: {
          status: 'failed',
          finishedAt: now,
          nextEvaluationAt: null,
          lastEvaluatedAt: now,
          lastError: `Invalid state status: ${currentStatus.status}`,
        },
      });
      stats.failed++;
      return;
    }

    let dispatch: {
      success: boolean;
      notificationId?: string;
      error?: string;
    } = { success: true };

    if (instance.currentState.actionType !== 'none') {
      dispatch = await notificationDispatchService.send({
        customerId: instance.customerId,
        actionType: instance.currentState.actionType,
        explicitChannel: instance.currentState.explicitChannel,
        tone: instance.currentState.tone || undefined,
        createdBy: 'flow_executor',
        templateKey: 'debt_reminder',
      });
    }

    if (!dispatch.success) {
      const attempts = currentStatus.attemptNo + 1;
      if (attempts >= MAX_ATTEMPTS_PER_STATE) {
        await prisma.$transaction([
          prisma.collectionFlowStateInstance.update({
            where: { id: currentStatus.id },
            data: {
              status: 'failed',
              failedAt: now,
              errorMessage: dispatch.error || 'Unknown state execution error',
              attemptNo: attempts,
            },
          }),
          prisma.collectionFlowInstance.update({
            where: { id: instance.id },
            data: {
              status: 'failed',
              finishedAt: now,
              nextEvaluationAt: null,
              lastEvaluatedAt: now,
              lastError: dispatch.error || 'State execution failed',
            },
          }),
        ]);
        stats.failed++;
      } else {
        const nextRetry = new Date(Date.now() + RETRY_INTERVAL_SECONDS * 1000);
        await prisma.$transaction([
          prisma.collectionFlowStateInstance.update({
            where: { id: currentStatus.id },
            data: {
              status: 'waiting',
              dueAt: nextRetry,
              errorMessage: dispatch.error || 'Dispatch failed',
              attemptNo: attempts,
            },
          }),
          prisma.collectionFlowInstance.update({
            where: { id: instance.id },
            data: {
              nextEvaluationAt: nextRetry,
              lastEvaluatedAt: now,
              lastError: dispatch.error || 'Dispatch failed',
            },
          }),
        ]);
        stats.retried++;
      }
      return;
    }

    const transitions = instance.flow.transitions
      .filter((transition) => transition.fromStateId === instance.currentStateId)
      .sort((a, b) => a.priority - b.priority);

    if (transitions.length === 0) {
      if (instance.currentState.isEnd) {
        await prisma.$transaction([
          prisma.collectionFlowStateInstance.update({
            where: { id: currentStatus.id },
            data: {
              status: 'completed',
              executedAt: now,
              completedAt: now,
              notificationId: dispatch.notificationId || null,
              errorMessage: null,
            },
          }),
          prisma.collectionFlowInstance.update({
            where: { id: instance.id },
            data: {
              status: 'completed_end',
              finishedAt: now,
              currentStateId: null,
              nextEvaluationAt: null,
              lastEvaluatedAt: now,
              lastError: null,
            },
          }),
        ]);
        stats.completedEnd++;
      } else {
        await prisma.$transaction([
          prisma.collectionFlowStateInstance.update({
            where: { id: currentStatus.id },
            data: {
              status: 'failed',
              failedAt: now,
              errorMessage: 'No outgoing transition from non-end state',
              attemptNo: currentStatus.attemptNo + 1,
            },
          }),
          prisma.collectionFlowInstance.update({
            where: { id: instance.id },
            data: {
              status: 'failed',
              finishedAt: now,
              nextEvaluationAt: null,
              lastEvaluatedAt: now,
              lastError: 'No outgoing transition from non-end state',
            },
          }),
        ]);
        stats.failed++;
      }
      return;
    }

    const selectedTransition = transitions[0];
    const targetStateStatus = instance.stateStatuses.find(
      (stateStatus) => stateStatus.stateId === selectedTransition.toStateId
    );
    if (!targetStateStatus) {
      await prisma.collectionFlowInstance.update({
        where: { id: instance.id },
        data: {
          status: 'failed',
          finishedAt: now,
          nextEvaluationAt: null,
          lastEvaluatedAt: now,
          lastError: 'Missing target state status row',
        },
      });
      stats.failed++;
      return;
    }

    const scheduleBase = currentStatus.dueAt || now;
    const nextDueAt = new Date(scheduleBase.getTime() + selectedTransition.waitSeconds * 1000);
    const nextStatus = nextDueAt <= now ? 'waiting' : 'upcoming';

    await prisma.$transaction([
      prisma.collectionFlowStateInstance.update({
        where: { id: currentStatus.id },
        data: {
          status: 'completed',
          executedAt: now,
          completedAt: now,
          notificationId: dispatch.notificationId || null,
          takenTransitionId: selectedTransition.id,
          errorMessage: null,
        },
      }),
      prisma.collectionFlowStateInstance.update({
        where: { id: targetStateStatus.id },
        data: {
          status: nextStatus,
          dueAt: nextDueAt,
          enteredAt: now,
          attemptNo: 0,
          sequenceNo: currentStatus.sequenceNo + 1,
          errorMessage: null,
        },
      }),
      prisma.collectionFlowInstance.update({
        where: { id: instance.id },
        data: {
          currentStateId: selectedTransition.toStateId,
          nextEvaluationAt: nextDueAt,
          lastEvaluatedAt: now,
          lastError: null,
        },
      }),
    ]);

    stats.advanced++;
  }

  async runOnce(limit = 50): Promise<ExecutorRunStats> {
    const stats: ExecutorRunStats = {
      scanned: 0,
      claimed: 0,
      completedPaid: 0,
      completedEnd: 0,
      advanced: 0,
      failed: 0,
      retried: 0,
      skipped: 0,
    };

    await this.bootstrapMissingRunningInstances(limit);
    const claimedIds = await this.claimDueInstanceIds(limit);
    stats.scanned = claimedIds.length;
    stats.claimed = claimedIds.length;

    for (const instanceId of claimedIds) {
      await this.processInstance(instanceId, stats);
    }

    return stats;
  }

  startPoller(intervalMs = 5000) {
    if (this.poller) {
      return;
    }
    this.poller = setInterval(() => {
      this.runOnce().catch((error) => {
        console.error('Flow executor poller run failed:', error);
      });
    }, intervalMs);
  }

  stopPoller() {
    if (!this.poller) {
      return;
    }
    clearInterval(this.poller);
    this.poller = null;
  }
}

export default new FlowExecutorService();
