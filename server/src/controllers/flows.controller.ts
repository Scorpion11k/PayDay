import { Request, Response } from 'express';
import { z } from 'zod';
import flowDefinitionService from '../services/flow-definition.service';
import flowExecutorService from '../services/flow-executor.service';
import flowRuntimeService from '../services/flow-runtime.service';
import flowPromptService from '../services/flow-prompt.service';
import prisma from '../config/database';
import { ValidationError } from '../types';
import activityService from '../services/activity.service';

const stateSchema = z.object({
  stateKey: z.string().min(1),
  stateName: z.string().min(1),
  actionName: z.string().min(1),
  actionType: z.enum(['none', 'assigned_channel', 'send_email', 'send_sms', 'send_whatsapp', 'voice_call']),
  tone: z.enum(['calm', 'medium', 'heavy']).optional().nullable(),
  explicitChannel: z.enum(['sms', 'email', 'whatsapp', 'call_task']).optional().nullable(),
  isStart: z.boolean().optional(),
  isEnd: z.boolean().optional(),
  positionX: z.number().optional().nullable(),
  positionY: z.number().optional().nullable(),
});

const transitionSchema = z.object({
  fromStateKey: z.string().min(1),
  toStateKey: z.string().min(1),
  conditionType: z.enum(['time_elapsed']).optional(),
  waitSeconds: z.number().int().min(0).optional(),
  label: z.string().optional().nullable(),
  priority: z.number().int().min(1).optional(),
});

const createFlowSchema = z.object({
  flowKey: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  createdBy: z.string().optional(),
  states: z.array(stateSchema).min(1),
  transitions: z.array(transitionSchema),
});

const updateFlowSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  updatedBy: z.string().optional(),
  states: z.array(stateSchema).min(1),
  transitions: z.array(transitionSchema),
});

const actorSchema = z.object({
  updatedBy: z.string().optional(),
  createdBy: z.string().optional(),
});

const runExecutorSchema = z.object({
  limit: z.number().int().positive().max(1000).optional(),
});

const parsedExecutorInterval = Number.parseInt(process.env.FLOW_EXECUTOR_INTERVAL_MS || '5000', 10);
const FLOW_EXECUTOR_INTERVAL_MS = Number.isFinite(parsedExecutorInterval) && parsedExecutorInterval > 0
  ? parsedExecutorInterval
  : 5000;

const assignFlowSchema = z.object({
  flowId: z.string().uuid(),
  source: z.enum(['default_assigned', 'manual_override']).optional(),
});

const generateFromPromptSchema = z.object({
  prompt: z.string().min(3),
  locale: z.enum(['en', 'he']).optional().default('en'),
  flowId: z.string().uuid().optional(),
  createdBy: z.string().optional(),
});

function assertFlowFeatureReady() {
  const prismaClient = prisma as unknown as Record<string, unknown>;
  const requiredDelegates = [
    'collectionFlow',
    'collectionFlowState',
    'collectionFlowTransition',
    'collectionFlowAssignment',
    'collectionFlowInstance',
    'collectionFlowStateInstance',
  ];

  const missing = requiredDelegates.filter((delegate) => !prismaClient[delegate]);
  if (missing.length > 0) {
    throw new ValidationError(
      'Collection Flow feature is not ready. Run `npx prisma generate` and restart the server.'
    );
  }
}

class FlowsController {
  async list(req: Request, res: Response) {
    assertFlowFeatureReady();
    const flows = await flowDefinitionService.list();
    res.json({
      success: true,
      data: flows,
    });
  }

  async create(req: Request, res: Response) {
    assertFlowFeatureReady();
    const parsed = createFlowSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0].message);
    }

    try {
      const flow = await flowDefinitionService.create(parsed.data);

      activityService.logCollectionFlowCreated({
        flowId: flow.id,
        flowName: flow.name,
        status: 'success',
        createdBy: parsed.data.createdBy || 'system',
      }).catch((err) => console.error('Failed to log activity:', err));

      res.status(201).json({
        success: true,
        data: flow,
        message: 'Flow created successfully',
      });
    } catch (error) {
      activityService.logCollectionFlowCreated({
        flowId: '',
        flowName: parsed.data.name,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        createdBy: parsed.data.createdBy || 'system',
      }).catch((err) => console.error('Failed to log activity:', err));

      throw error;
    }
  }

  async generateFromPrompt(req: Request, res: Response) {
    assertFlowFeatureReady();
    const parsed = generateFromPromptSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0].message);
    }

    const result = await flowPromptService.generateDraftFromPrompt(parsed.data);
    res.status(result.created ? 201 : 200).json({
      success: true,
      data: result,
      message: result.created ? 'Draft flow created from prompt' : 'Draft flow updated from prompt',
    });
  }

  async getById(req: Request, res: Response) {
    assertFlowFeatureReady();
    const flow = await flowDefinitionService.getById(req.params.id);
    res.json({
      success: true,
      data: flow,
    });
  }

  async update(req: Request, res: Response) {
    assertFlowFeatureReady();
    const parsed = updateFlowSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0].message);
    }

    const flow = await flowDefinitionService.update(req.params.id, parsed.data);
    res.json({
      success: true,
      data: flow,
      message: 'Flow updated successfully',
    });
  }

  async publish(req: Request, res: Response) {
    assertFlowFeatureReady();
    const parsed = actorSchema.safeParse(req.body || {});
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0].message);
    }

    const published = await flowDefinitionService.publish(req.params.id, parsed.data.updatedBy);
    res.json({
      success: true,
      data: published,
      message: 'Flow published successfully',
    });
  }

  async setDefault(req: Request, res: Response) {
    assertFlowFeatureReady();
    const parsed = actorSchema.safeParse(req.body || {});
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0].message);
    }

    const result = await flowDefinitionService.setDefault(req.params.id, parsed.data.updatedBy);
    res.json({
      success: true,
      data: result,
      message: 'Default flow updated and customer assignments backfilled',
    });
  }

  async createNewVersion(req: Request, res: Response) {
    assertFlowFeatureReady();
    const parsed = actorSchema.safeParse(req.body || {});
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0].message);
    }

    const flow = await flowDefinitionService.createNewVersion(req.params.id, parsed.data.createdBy);
    res.status(201).json({
      success: true,
      data: flow,
      message: 'Draft version created successfully',
    });
  }

  async runExecutorOnce(req: Request, res: Response) {
    assertFlowFeatureReady();
    const parsed = runExecutorSchema.safeParse(req.body || {});
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0].message);
    }
    flowExecutorService.startPoller(FLOW_EXECUTOR_INTERVAL_MS);
    const result = await flowExecutorService.runOnce(parsed.data.limit || 50);
    res.json({
      success: true,
      data: result,
      message: 'Flow executor cycle completed (executor poller started)',
    });
  }

  async getCustomerCollectionFlow(req: Request, res: Response) {
    assertFlowFeatureReady();
    const data = await flowRuntimeService.getCustomerCollectionFlow(req.params.id);
    res.json({
      success: true,
      data,
    });
  }

  async assignCustomerFlow(req: Request, res: Response) {
    assertFlowFeatureReady();
    const parsed = assignFlowSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0].message);
    }

    const result = await flowRuntimeService.assignFlowToCustomer(
      req.params.id,
      parsed.data.flowId,
      parsed.data.source || 'manual_override'
    );
    res.json({
      success: true,
      data: result,
      message: 'Customer flow assignment updated',
    });
  }
}

export default new FlowsController();
