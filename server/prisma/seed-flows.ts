import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedDefaultCollectionFlow() {
  const existing = await prisma.collectionFlow.findFirst({
    where: {
      flowKey: 'standard_collection',
      version: 1,
    },
    select: { id: true },
  });

  if (existing) {
    console.log('Default collection flow already exists, skipping seed');
    return;
  }

  const flow = await prisma.collectionFlow.create({
    data: {
      flowKey: 'standard_collection',
      version: 1,
      name: 'Standard Collection Flow',
      description: 'Default debt collection reminder flow',
      status: 'published',
      isDefault: true,
      createdBy: 'seed',
      updatedBy: 'seed',
      publishedAt: new Date(),
    },
  });

  const state1 = await prisma.collectionFlowState.create({
    data: {
      flowId: flow.id,
      stateKey: 'first_reminder',
      stateName: 'First Reminder',
      actionName: 'First reminder',
      actionType: 'assigned_channel',
      tone: 'calm',
      isStart: true,
      isEnd: false,
      positionX: 80,
      positionY: 120,
    },
  });

  const state2 = await prisma.collectionFlowState.create({
    data: {
      flowId: flow.id,
      stateKey: 'second_reminder',
      stateName: 'Second Reminder',
      actionName: 'Second reminder',
      actionType: 'assigned_channel',
      tone: 'medium',
      isStart: false,
      isEnd: false,
      positionX: 360,
      positionY: 120,
    },
  });

  const state3 = await prisma.collectionFlowState.create({
    data: {
      flowId: flow.id,
      stateKey: 'third_reminder',
      stateName: 'Third Reminder',
      actionName: 'Third reminder',
      actionType: 'assigned_channel',
      tone: 'heavy',
      isStart: false,
      isEnd: false,
      positionX: 640,
      positionY: 120,
    },
  });

  const state4 = await prisma.collectionFlowState.create({
    data: {
      flowId: flow.id,
      stateKey: 'fourth_reminder_call',
      stateName: 'Fourth Reminder Phone Call',
      actionName: 'Fourth reminder, phone call',
      actionType: 'voice_call',
      tone: 'heavy',
      isStart: false,
      isEnd: true,
      positionX: 920,
      positionY: 120,
    },
  });

  await prisma.collectionFlowTransition.createMany({
    data: [
      {
        flowId: flow.id,
        fromStateId: state1.id,
        toStateId: state2.id,
        conditionType: 'time_elapsed',
        waitSeconds: 3 * 24 * 60 * 60,
        label: 'Wait 3 days',
        priority: 1,
      },
      {
        flowId: flow.id,
        fromStateId: state2.id,
        toStateId: state3.id,
        conditionType: 'time_elapsed',
        waitSeconds: 2 * 24 * 60 * 60,
        label: 'Wait 2 days',
        priority: 1,
      },
      {
        flowId: flow.id,
        fromStateId: state3.id,
        toStateId: state4.id,
        conditionType: 'time_elapsed',
        waitSeconds: 2 * 24 * 60 * 60,
        label: 'Wait 2 days',
        priority: 1,
      },
    ],
  });

  await prisma.collectionFlow.updateMany({
    where: {
      id: { not: flow.id },
      isDefault: true,
    },
    data: {
      isDefault: false,
    },
  });

  await prisma.collectionFlowAssignment.updateMany({
    where: { source: 'default_assigned' },
    data: { flowId: flow.id, assignedAt: new Date() },
  });

  const customersWithoutAssignment = await prisma.customer.findMany({
    where: { flowAssignment: null },
    select: { id: true },
  });

  if (customersWithoutAssignment.length > 0) {
    await prisma.collectionFlowAssignment.createMany({
      data: customersWithoutAssignment.map((customer) => ({
        customerId: customer.id,
        flowId: flow.id,
        source: 'default_assigned',
      })),
      skipDuplicates: true,
    });
  }

  console.log('Default collection flow seeded successfully');
}

async function main() {
  try {
    await seedDefaultCollectionFlow();
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Flow seed failed:', error);
  process.exit(1);
});
