import { CollectionFlowActionType, CollectionFlowConditionType, NotificationChannel, Prisma, TemplateTone } from '@prisma/client';
import prisma from '../config/database';
import { NotFoundError, ValidationError } from '../types';

export interface FlowStateInput {
  stateKey: string;
  stateName: string;
  actionName: string;
  actionType: CollectionFlowActionType;
  tone?: TemplateTone | null;
  explicitChannel?: NotificationChannel | null;
  isStart?: boolean;
  isEnd?: boolean;
  positionX?: number | null;
  positionY?: number | null;
}

export interface FlowTransitionInput {
  fromStateKey: string;
  toStateKey: string;
  conditionType?: CollectionFlowConditionType;
  waitSeconds?: number;
  label?: string | null;
  priority?: number;
}

export interface CreateFlowInput {
  flowKey?: string;
  name: string;
  description?: string | null;
  createdBy?: string;
  states: FlowStateInput[];
  transitions: FlowTransitionInput[];
}

export interface UpdateFlowInput {
  name?: string;
  description?: string | null;
  updatedBy?: string;
  states: FlowStateInput[];
  transitions: FlowTransitionInput[];
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '_');
}

function generateFlowKey(name: string): string {
  const base = normalizeKey(name).replace(/[^a-z0-9_]/g, '').slice(0, 40) || 'collection_flow';
  return `${base}_${Date.now()}`;
}

function validateDefinition(states: FlowStateInput[], transitions: FlowTransitionInput[]) {
  if (!states.length) {
    throw new ValidationError('Flow must contain at least one state');
  }

  const stateKeySet = new Set<string>();
  let startCount = 0;
  let endCount = 0;
  for (const state of states) {
    if (!state.stateKey?.trim()) {
      throw new ValidationError('Each state must include stateKey');
    }
    if (!state.stateName?.trim()) {
      throw new ValidationError('Each state must include stateName');
    }
    if (!state.actionName?.trim()) {
      throw new ValidationError('Each state must include actionName');
    }
    const normalized = normalizeKey(state.stateKey);
    if (stateKeySet.has(normalized)) {
      throw new ValidationError(`Duplicate state key: ${state.stateKey}`);
    }
    stateKeySet.add(normalized);
    if (state.isStart) startCount++;
    if (state.isEnd) endCount++;
  }

  if (startCount !== 1) {
    throw new ValidationError('Flow must include exactly one start state');
  }
  if (endCount !== 1) {
    throw new ValidationError('Flow must include exactly one end state');
  }

  const outgoingByState = new Map<string, FlowTransitionInput[]>();
  for (const transition of transitions) {
    const fromKey = normalizeKey(transition.fromStateKey);
    const toKey = normalizeKey(transition.toStateKey);
    if (!stateKeySet.has(fromKey)) {
      throw new ValidationError(`Transition source state does not exist: ${transition.fromStateKey}`);
    }
    if (!stateKeySet.has(toKey)) {
      throw new ValidationError(`Transition target state does not exist: ${transition.toStateKey}`);
    }
    const list = outgoingByState.get(fromKey) || [];
    list.push(transition);
    outgoingByState.set(fromKey, list);
  }

  for (const [key, list] of outgoingByState) {
    const priorities = new Set<number>();
    for (const transition of list) {
      const priority = transition.priority || 1;
      if (priorities.has(priority)) {
        throw new ValidationError(`Duplicate transition priority ${priority} for state ${key}`);
      }
      priorities.add(priority);
    }
  }

  const startState = states.find((state) => state.isStart)!;
  const startKey = normalizeKey(startState.stateKey);
  const visited = new Set<string>();
  const queue: string[] = [startKey];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    const next = outgoingByState.get(current) || [];
    for (const transition of next) {
      const toKey = normalizeKey(transition.toStateKey);
      if (!visited.has(toKey)) {
        queue.push(toKey);
      }
    }
  }

  for (const state of states) {
    const key = normalizeKey(state.stateKey);
    if (!visited.has(key)) {
      throw new ValidationError(`State is unreachable from start: ${state.stateKey}`);
    }
    if (!state.isEnd && (outgoingByState.get(key) || []).length === 0) {
      throw new ValidationError(`Non-end state must have at least one transition: ${state.stateKey}`);
    }
  }
}

function toCreateStateData(flowId: string, states: FlowStateInput[]): Prisma.CollectionFlowStateCreateManyInput[] {
  return states.map((state) => ({
    flowId,
    stateKey: normalizeKey(state.stateKey),
    stateName: state.stateName.trim(),
    actionName: state.actionName.trim(),
    actionType: state.actionType,
    tone: state.tone || null,
    explicitChannel: state.explicitChannel || null,
    isStart: Boolean(state.isStart),
    isEnd: Boolean(state.isEnd),
    positionX: state.positionX ?? null,
    positionY: state.positionY ?? null,
  }));
}

class FlowDefinitionService {
  async list() {
    return prisma.collectionFlow.findMany({
      orderBy: [{ updatedAt: 'desc' }],
      include: {
        _count: {
          select: {
            states: true,
            transitions: true,
            assignments: true,
            instances: true,
          },
        },
      },
    });
  }

  async getById(id: string) {
    const flow = await prisma.collectionFlow.findUnique({
      where: { id },
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
    });

    if (!flow) {
      throw new NotFoundError('Flow');
    }

    return flow;
  }

  async create(input: CreateFlowInput) {
    validateDefinition(input.states, input.transitions);

    const flowKey = input.flowKey?.trim() ? normalizeKey(input.flowKey) : generateFlowKey(input.name);
    const existing = await prisma.collectionFlow.findFirst({
      where: { flowKey },
      select: { id: true },
    });
    if (existing) {
      throw new ValidationError(`Flow key already exists: ${flowKey}`);
    }

    return prisma.$transaction(async (tx) => {
      const flow = await tx.collectionFlow.create({
        data: {
          flowKey,
          version: 1,
          name: input.name.trim(),
          description: input.description || null,
          status: 'draft',
          createdBy: input.createdBy || 'system',
          updatedBy: input.createdBy || 'system',
        },
      });

      await tx.collectionFlowState.createMany({
        data: toCreateStateData(flow.id, input.states),
      });

      const createdStates = await tx.collectionFlowState.findMany({
        where: { flowId: flow.id },
        select: { id: true, stateKey: true },
      });
      const stateByKey = new Map(createdStates.map((state) => [state.stateKey, state.id]));

      await tx.collectionFlowTransition.createMany({
        data: input.transitions.map((transition) => ({
          flowId: flow.id,
          fromStateId: stateByKey.get(normalizeKey(transition.fromStateKey))!,
          toStateId: stateByKey.get(normalizeKey(transition.toStateKey))!,
          conditionType: transition.conditionType || 'time_elapsed',
          waitSeconds: Math.max(0, transition.waitSeconds || 0),
          label: transition.label || null,
          priority: transition.priority || 1,
        })),
      });

      return tx.collectionFlow.findUniqueOrThrow({
        where: { id: flow.id },
        include: {
          states: true,
          transitions: {
            include: {
              fromState: { select: { id: true, stateKey: true, stateName: true } },
              toState: { select: { id: true, stateKey: true, stateName: true } },
            },
            orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
          },
        },
      });
    });
  }

  async update(id: string, input: UpdateFlowInput) {
    const existing = await prisma.collectionFlow.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!existing) {
      throw new NotFoundError('Flow');
    }
    if (existing.status !== 'draft') {
      throw new ValidationError('Only draft flows can be edited');
    }

    validateDefinition(input.states, input.transitions);

    return prisma.$transaction(async (tx) => {
      await tx.collectionFlow.update({
        where: { id },
        data: {
          name: input.name?.trim(),
          description: input.description ?? null,
          updatedBy: input.updatedBy || 'system',
        },
      });

      await tx.collectionFlowTransition.deleteMany({ where: { flowId: id } });
      await tx.collectionFlowState.deleteMany({ where: { flowId: id } });

      await tx.collectionFlowState.createMany({
        data: toCreateStateData(id, input.states),
      });

      const createdStates = await tx.collectionFlowState.findMany({
        where: { flowId: id },
        select: { id: true, stateKey: true },
      });
      const stateByKey = new Map(createdStates.map((state) => [state.stateKey, state.id]));

      await tx.collectionFlowTransition.createMany({
        data: input.transitions.map((transition) => ({
          flowId: id,
          fromStateId: stateByKey.get(normalizeKey(transition.fromStateKey))!,
          toStateId: stateByKey.get(normalizeKey(transition.toStateKey))!,
          conditionType: transition.conditionType || 'time_elapsed',
          waitSeconds: Math.max(0, transition.waitSeconds || 0),
          label: transition.label || null,
          priority: transition.priority || 1,
        })),
      });

      return tx.collectionFlow.findUniqueOrThrow({
        where: { id },
        include: {
          states: true,
          transitions: {
            include: {
              fromState: { select: { id: true, stateKey: true, stateName: true } },
              toState: { select: { id: true, stateKey: true, stateName: true } },
            },
            orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
          },
        },
      });
    });
  }

  async publish(id: string, updatedBy?: string) {
    const flow = await prisma.collectionFlow.findUnique({
      where: { id },
      include: {
        states: true,
        transitions: {
          include: {
            fromState: { select: { stateKey: true } },
            toState: { select: { stateKey: true } },
          },
        },
      },
    });
    if (!flow) {
      throw new NotFoundError('Flow');
    }
    if (flow.status !== 'draft') {
      throw new ValidationError('Only draft flows can be published');
    }

    validateDefinition(
      flow.states.map((state) => ({
        stateKey: state.stateKey,
        stateName: state.stateName,
        actionName: state.actionName,
        actionType: state.actionType,
        tone: state.tone,
        explicitChannel: state.explicitChannel,
        isStart: state.isStart,
        isEnd: state.isEnd,
      })),
      flow.transitions.map((transition) => ({
        fromStateKey: transition.fromState.stateKey,
        toStateKey: transition.toState.stateKey,
        conditionType: transition.conditionType,
        waitSeconds: transition.waitSeconds,
        label: transition.label,
        priority: transition.priority,
      }))
    );

    return prisma.collectionFlow.update({
      where: { id },
      data: {
        status: 'published',
        publishedAt: new Date(),
        updatedBy: updatedBy || 'system',
      },
    });
  }

  async setDefault(id: string, updatedBy?: string) {
    const flow = await prisma.collectionFlow.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!flow) {
      throw new NotFoundError('Flow');
    }
    if (flow.status !== 'published') {
      throw new ValidationError('Only published flows can be set as default');
    }

    return prisma.$transaction(async (tx) => {
      await tx.collectionFlow.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });

      const defaultFlow = await tx.collectionFlow.update({
        where: { id },
        data: {
          isDefault: true,
          updatedBy: updatedBy || 'system',
        },
      });

      const switched = await tx.collectionFlowAssignment.updateMany({
        where: { source: 'default_assigned' },
        data: {
          flowId: id,
          assignedAt: new Date(),
        },
      });

      const customersWithoutAssignment = await tx.customer.findMany({
        where: { flowAssignment: null },
        select: { id: true },
      });

      if (customersWithoutAssignment.length > 0) {
        await tx.collectionFlowAssignment.createMany({
          data: customersWithoutAssignment.map((customer) => ({
            customerId: customer.id,
            flowId: id,
            source: 'default_assigned',
          })),
          skipDuplicates: true,
        });
      }

      return {
        flow: defaultFlow,
        reassignedDefaultCustomers: switched.count,
        newlyAssignedCustomers: customersWithoutAssignment.length,
      };
    });
  }

  async createNewVersion(id: string, createdBy?: string) {
    const baseFlow = await prisma.collectionFlow.findUnique({
      where: { id },
      include: {
        states: true,
        transitions: {
          include: {
            fromState: { select: { stateKey: true } },
            toState: { select: { stateKey: true } },
          },
        },
      },
    });
    if (!baseFlow) {
      throw new NotFoundError('Flow');
    }
    if (baseFlow.status !== 'published') {
      throw new ValidationError('New version can be created only from a published flow');
    }

    const latest = await prisma.collectionFlow.findFirst({
      where: { flowKey: baseFlow.flowKey },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const nextVersion = (latest?.version || baseFlow.version) + 1;

    return prisma.$transaction(async (tx) => {
      const cloned = await tx.collectionFlow.create({
        data: {
          flowKey: baseFlow.flowKey,
          version: nextVersion,
          name: baseFlow.name,
          description: baseFlow.description,
          status: 'draft',
          isDefault: false,
          createdBy: createdBy || 'system',
          updatedBy: createdBy || 'system',
        },
      });

      await tx.collectionFlowState.createMany({
        data: baseFlow.states.map((state) => ({
          flowId: cloned.id,
          stateKey: state.stateKey,
          stateName: state.stateName,
          actionName: state.actionName,
          actionType: state.actionType,
          tone: state.tone,
          explicitChannel: state.explicitChannel,
          isStart: state.isStart,
          isEnd: state.isEnd,
          positionX: state.positionX,
          positionY: state.positionY,
        })),
      });

      const clonedStates = await tx.collectionFlowState.findMany({
        where: { flowId: cloned.id },
        select: { id: true, stateKey: true },
      });
      const stateByKey = new Map(clonedStates.map((state) => [state.stateKey, state.id]));

      await tx.collectionFlowTransition.createMany({
        data: baseFlow.transitions.map((transition) => ({
          flowId: cloned.id,
          fromStateId: stateByKey.get(transition.fromState.stateKey)!,
          toStateId: stateByKey.get(transition.toState.stateKey)!,
          conditionType: transition.conditionType,
          waitSeconds: transition.waitSeconds,
          label: transition.label,
          priority: transition.priority,
        })),
      });

      return tx.collectionFlow.findUniqueOrThrow({
        where: { id: cloned.id },
        include: {
          states: true,
          transitions: {
            include: {
              fromState: { select: { id: true, stateKey: true, stateName: true } },
              toState: { select: { id: true, stateKey: true, stateName: true } },
            },
            orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
          },
        },
      });
    });
  }

  async getDefaultPublishedFlow() {
    return prisma.collectionFlow.findFirst({
      where: { isDefault: true, status: 'published' },
      include: {
        states: true,
        transitions: true,
      },
    });
  }
}

export default new FlowDefinitionService();
