import type { Edge, Node } from 'reactflow';
import { StepActionType, WorkflowTriggerEvent } from '../../../types/sms';

export interface WorkflowMetadata {
  id?: string;
  name: string;
  facilityId: string | null;
  triggerEvent: WorkflowTriggerEvent;
  triggerCondition?: Record<string, unknown>;
  isActive: boolean;
}

type SerializedWorkflowStep = {
  id?: string;
  isFirstStep: boolean;
  actionType: StepActionType;
  config: Record<string, unknown>;
  nextStepId?: string;
};

type SerializedWorkflowPayload = {
  name: string;
  facilityId: string | null;
  triggerEvent: WorkflowTriggerEvent;
  triggerCondition: Record<string, unknown>;
  isActive: boolean;
  steps: SerializedWorkflowStep[];
};

type SerializedUpdatePayload = {
  name: string;
  isActive: boolean;
  steps: SerializedWorkflowStep[];
};

const TEMP_NODE_UUID_CACHE = new Map<string, string>();

function isTemporaryNodeId(id: string): boolean {
  return id.startsWith('node-');
}

function isUuidLike(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // Fallback for environments without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function resolveStepId(nodeId: string): string {
  if (isUuidLike(nodeId)) return nodeId;

  if (TEMP_NODE_UUID_CACHE.has(nodeId)) {
    return TEMP_NODE_UUID_CACHE.get(nodeId) as string;
  }

  const generated = generateUuid();
  TEMP_NODE_UUID_CACHE.set(nodeId, generated);
  return generated;
}

function rewriteConfigStepReferences(
  config: Record<string, unknown>,
  idMap: Map<string, string>
): Record<string, unknown> {
  const nextConfig = { ...config };

  const branches = nextConfig.branches;
  if (branches && typeof branches === 'object' && !Array.isArray(branches)) {
    const updatedBranches: Record<string, string | null> = {};
    for (const [key, target] of Object.entries(branches as Record<string, unknown>)) {
      if (typeof target === 'string' && idMap.has(target)) {
        updatedBranches[key] = idMap.get(target) as string;
      } else {
        updatedBranches[key] = target as string | null;
      }
    }
    nextConfig.branches = updatedBranches;
  }

  const timeout = nextConfig.timeout;
  if (timeout && typeof timeout === 'object' && !Array.isArray(timeout)) {
    const timeoutObj = { ...(timeout as Record<string, unknown>) };
    for (const key of ['nextStepId', 'invalidReplyStepId', 'fallbackStepId']) {
      const value = timeoutObj[key];
      if (typeof value === 'string' && idMap.has(value)) {
        timeoutObj[key] = idMap.get(value) as string;
      }
    }
    nextConfig.timeout = timeoutObj;
  }

  for (const key of ['nextStepId', 'invalidReplyStepId', 'fallbackStepId']) {
    const value = nextConfig[key];
    if (typeof value === 'string' && idMap.has(value)) {
      nextConfig[key] = idMap.get(value) as string;
    }
  }

  return nextConfig;
}

function cleanConfig(config: Record<string, unknown>): Record<string, unknown> {
  const nextConfig = { ...config };
  delete nextConfig.actionType;
  delete nextConfig.isFirstStep;

  return Object.fromEntries(Object.entries(nextConfig).filter(([, value]) => value !== undefined));
}

export const serializeWorkflowPayload = (
  metadata: WorkflowMetadata,
  nodes: Node[],
  edges: Edge[]
): SerializedWorkflowPayload => {
  const idMap = new Map<string, string>();
  for (const node of nodes) {
    if (isTemporaryNodeId(node.id) || !isUuidLike(node.id)) {
      idMap.set(node.id, resolveStepId(node.id));
    } else {
      idMap.set(node.id, node.id);
    }
  }

  const steps = nodes.map((node) => {
    const actionType = (node.data?.actionType || node.type) as StepActionType;
    const stepId = idMap.get(node.id) as string;
    const step: SerializedWorkflowStep = {
      id: stepId,
      isFirstStep: Boolean(node.data?.isFirstStep),
      actionType,
      config: rewriteConfigStepReferences(cleanConfig((node.data as Record<string, unknown>) || {}), idMap),
      nextStepId: undefined,
    };

    if (actionType === StepActionType.SEND_SMS || actionType === StepActionType.SYSTEM_ACTION) {
      const outgoingEdge = edges.find((edge) => edge.source === node.id);
      if (outgoingEdge) {
        step.nextStepId = idMap.get(outgoingEdge.target);
      }
    }

    return step;
  });

  return {
    name: metadata.name,
    facilityId: metadata.facilityId,
    triggerEvent: metadata.triggerEvent,
    triggerCondition: metadata.triggerCondition || {},
    isActive: metadata.isActive,
    steps,
  };
};

export const serializeUpdatePayload = (
  metadata: WorkflowMetadata,
  nodes: Node[],
  edges: Edge[]
): SerializedUpdatePayload => {
  const full = serializeWorkflowPayload(metadata, nodes, edges);
  return {
    name: full.name,
    isActive: full.isActive,
    steps: full.steps,
  };
};

export const validateWorkflowGraph = (
  metadata: WorkflowMetadata,
  nodes: Node[],
  edges: Edge[]
): string | null => {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  if (!metadata.name.trim()) return 'Workflow name is required.';
  if (!metadata.triggerEvent) return 'A trigger event is required.';
  if (metadata.facilityId !== null && !metadata.facilityId.trim()) {
    return 'Facility ID is required when workflow scope is set to Facility.';
  }
  if (nodes.length === 0) return 'The workflow must have at least one step.';

  const firstSteps = nodes.filter((node) => Boolean(node.data?.isFirstStep));
  if (firstSteps.length === 0) return 'The workflow must have a starting step (isFirstStep = true).';
  if (firstSteps.length > 1) return 'The workflow cannot have more than one starting step.';

  const adjacency = new Map<string, string[]>();
  for (const node of nodes) {
    adjacency.set(node.id, []);
  }

  for (const node of nodes) {
    const actionType = (node.data?.actionType || node.type) as StepActionType;

    if (actionType === StepActionType.SEND_SMS || actionType === StepActionType.SYSTEM_ACTION) {
      const outgoing = edges.filter((edge) => edge.source === node.id);
      if (outgoing.length > 1) {
        return `Node ${node.id} has multiple outgoing edges. ${actionType} supports only one next step.`;
      }
      if (outgoing.length === 1) {
        const targetId = outgoing[0].target;
        if (!nodeById.has(targetId)) {
          return `Node ${node.id} points to a missing target node (${targetId}).`;
        }
        adjacency.get(node.id)?.push(targetId);
      }
    }

    if (actionType === StepActionType.WAIT_FOR_REPLY) {
      const data = (node.data || {}) as Record<string, unknown>;
      const branches = (data.branches as Record<string, string | null> | undefined) || {};
      const branchEntries = Object.entries(branches);

      if (branchEntries.length === 0) {
        return `Node ${node.id} must define at least one reply branch.`;
      }

      for (const [branchKey, branchTargetId] of branchEntries) {
        if (!branchTargetId) {
          return `Node ${node.id} branch "${branchKey}" is missing a target step.`;
        }
        if (branchTargetId === node.id) {
          return `Node ${node.id} branch "${branchKey}" cannot target itself.`;
        }
        if (!nodeById.has(branchTargetId)) {
          return `Node ${node.id} branch "${branchKey}" points to a missing node (${branchTargetId}).`;
        }
        adjacency.get(node.id)?.push(branchTargetId);
      }
    }
  }

  return null;
};
