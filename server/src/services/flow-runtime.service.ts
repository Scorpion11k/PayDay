import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import flowDefinitionService from './flow-definition.service';
import { NotFoundError, ValidationError } from '../types';

type DbClient = Prisma.TransactionClient | typeof prisma;

class FlowRuntimeService {
  async assignDefaultToCustomer(customerId: string, db: DbClient = prisma) {
    const defaultFlow = await db.collectionFlow.findFirst({
      where: { isDefault: true, status: 'published' },
      select: { id: true },
    });

    if (!defaultFlow) {
      return null;
    }

    return db.collectionFlowAssignment.upsert({
      where: { customerId },
      update: {},
      create: {
        customerId,
        flowId: defaultFlow.id,
        source: 'default_assigned',
      },
    });
  }

  async assignFlowToCustomer(customerId: string, flowId: string, source: 'default_assigned' | 'manual_override' = 'manual_override') {
    const flow = await prisma.collectionFlow.findUnique({
      where: { id: flowId },
      select: { id: true, status: true },
    });
    if (!flow) {
      throw new NotFoundError('Flow');
    }
    if (flow.status !== 'published') {
      throw new ValidationError('Only published flows can be assigned');
    }

    return prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({
        where: { id: customerId },
        select: { id: true },
      });
      if (!customer) {
        throw new NotFoundError('Customer');
      }

      await tx.collectionFlowAssignment.upsert({
        where: { customerId },
        update: {
          flowId,
          source,
          assignedAt: new Date(),
        },
        create: {
          customerId,
          flowId,
          source,
        },
      });

      await tx.collectionFlowInstance.updateMany({
        where: {
          customerId,
          status: 'running',
        },
        data: {
          status: 'completed_end',
          finishedAt: new Date(),
          nextEvaluationAt: null,
          lastError: 'Flow reassigned',
        },
      });

      const newInstance = await this.ensureRunningInstance(customerId, tx, flowId, true);
      return {
        customerId,
        flowId,
        instanceId: newInstance?.id || null,
      };
    });
  }

  async completeRunningIfPaid(customerId: string, db: DbClient = prisma) {
    const openDebtCount = await db.debt.count({
      where: {
        customerId,
        status: { in: ['open', 'in_collection'] },
      },
    });

    if (openDebtCount > 0) {
      return false;
    }

    const updated = await db.collectionFlowInstance.updateMany({
      where: {
        customerId,
        status: 'running',
      },
      data: {
        status: 'completed_paid',
        finishedAt: new Date(),
        nextEvaluationAt: null,
        currentStateId: null,
      },
    });

    return updated.count > 0;
  }

  private async createInstance(customerId: string, flowId: string, db: DbClient = prisma) {
    const flow = await db.collectionFlow.findUnique({
      where: { id: flowId },
      include: {
        states: {
          orderBy: [{ isStart: 'desc' }, { stateName: 'asc' }],
        },
      },
    });

    if (!flow) {
      throw new NotFoundError('Flow');
    }

    const startState = flow.states.find((state) => state.isStart);
    if (!startState) {
      throw new ValidationError('Flow has no start state');
    }

    const now = new Date();
    const instance = await db.collectionFlowInstance.create({
      data: {
        customerId,
        flowId: flow.id,
        currentStateId: startState.id,
        status: 'running',
        startedAt: now,
        nextEvaluationAt: now,
      },
    });

    await db.collectionFlowStateInstance.createMany({
      data: flow.states.map((state, index) => ({
        flowInstanceId: instance.id,
        stateId: state.id,
        status: state.id === startState.id ? 'waiting' : 'upcoming',
        dueAt: state.id === startState.id ? now : null,
        enteredAt: state.id === startState.id ? now : null,
        sequenceNo: state.id === startState.id ? 0 : index + 1,
      })),
    });

    return instance;
  }

  async ensureRunningInstance(
    customerId: string,
    db: DbClient = prisma,
    forcedFlowId?: string,
    allowRestart = false
  ) {
    const existing = await db.collectionFlowInstance.findFirst({
      where: {
        customerId,
        status: 'running',
      },
      orderBy: { startedAt: 'desc' },
    });
    if (existing) {
      return existing;
    }

    const openDebtCount = await db.debt.count({
      where: {
        customerId,
        status: { in: ['open', 'in_collection'] },
      },
    });
    if (openDebtCount === 0) {
      return null;
    }

    let flowId = forcedFlowId || null;
    if (!flowId) {
      const assignment = await db.collectionFlowAssignment.findUnique({
        where: { customerId },
        select: { flowId: true },
      });
      if (!assignment) {
        await this.assignDefaultToCustomer(customerId, db);
      }

      const updatedAssignment = await db.collectionFlowAssignment.findUnique({
        where: { customerId },
        select: { flowId: true },
      });
      flowId = updatedAssignment?.flowId || null;
    }

    if (!flowId) {
      const defaultFlow = await flowDefinitionService.getDefaultPublishedFlow();
      flowId = defaultFlow?.id || null;
    }

    if (!flowId) {
      return null;
    }

    if (!allowRestart) {
      const priorTerminalForSameFlow = await db.collectionFlowInstance.findFirst({
        where: {
          customerId,
          flowId,
          status: { in: ['completed_end', 'failed'] },
        },
        select: { id: true },
      });

      if (priorTerminalForSameFlow) {
        return null;
      }
    }

    return this.createInstance(customerId, flowId, db);
  }

  async getCustomerCollectionFlow(customerId: string) {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        fullName: true,
        preferredChannel: true,
        preferredLanguage: true,
        preferredTone: true,
        status: true,
      },
    });
    if (!customer) {
      throw new NotFoundError('Customer');
    }

    await this.assignDefaultToCustomer(customerId);
    await this.completeRunningIfPaid(customerId);
    await this.ensureRunningInstance(customerId);

    const assignment = await prisma.collectionFlowAssignment.findUnique({
      where: { customerId },
      include: {
        flow: {
          include: {
            states: {
              orderBy: [{ isStart: 'desc' }, { stateName: 'asc' }],
            },
            transitions: {
              include: {
                fromState: { select: { id: true, stateKey: true, stateName: true } },
                toState: { select: { id: true, stateKey: true, stateName: true } },
              },
              orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
            },
          },
        },
      },
    });

    const instance = await prisma.collectionFlowInstance.findFirst({
      where: {
        customerId,
        status: 'running',
      },
      include: {
        flow: {
          select: {
            id: true,
            name: true,
            flowKey: true,
            version: true,
            status: true,
          },
        },
        currentState: {
          select: { id: true, stateKey: true, stateName: true },
        },
        stateStatuses: {
          include: {
            state: {
              select: {
                id: true,
                stateKey: true,
                stateName: true,
                actionName: true,
                actionType: true,
                tone: true,
                explicitChannel: true,
                isStart: true,
                isEnd: true,
              },
            },
            takenTransition: {
              select: {
                id: true,
                label: true,
                waitSeconds: true,
                priority: true,
              },
            },
          },
          orderBy: [{ sequenceNo: 'asc' }, { createdAt: 'asc' }],
        },
      },
      orderBy: { startedAt: 'desc' },
    });

    const lastFinishedInstance = !instance
      ? await prisma.collectionFlowInstance.findFirst({
          where: { customerId },
          include: {
            flow: {
              select: { id: true, name: true, flowKey: true, version: true, status: true },
            },
            currentState: {
              select: { id: true, stateKey: true, stateName: true },
            },
            stateStatuses: {
              include: {
                state: {
                  select: {
                    id: true,
                    stateKey: true,
                    stateName: true,
                    actionName: true,
                    actionType: true,
                    tone: true,
                    explicitChannel: true,
                    isStart: true,
                    isEnd: true,
                  },
                },
                takenTransition: {
                  select: {
                    id: true,
                    label: true,
                    waitSeconds: true,
                    priority: true,
                  },
                },
              },
              orderBy: [{ sequenceNo: 'asc' }, { createdAt: 'asc' }],
            },
          },
          orderBy: { updatedAt: 'desc' },
        })
      : null;

    return {
      customer,
      assignment,
      instance: instance || lastFinishedInstance,
    };
  }
}

export default new FlowRuntimeService();
