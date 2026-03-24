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

function isTemporaryNodeId(id: string): boolean {
  return id.startsWith('node-');
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
  const steps = nodes.map((node) => {
    const actionType = (node.data?.actionType || node.type) as StepActionType;
    const step: SerializedWorkflowStep = {
      id: isTemporaryNodeId(node.id) ? undefined : node.id,
      isFirstStep: Boolean(node.data?.isFirstStep),
      actionType,
      config: cleanConfig((node.data as Record<string, unknown>) || {}),
      nextStepId: undefined,
    };

    if (actionType === StepActionType.SEND_SMS || actionType === StepActionType.SYSTEM_ACTION) {
      const outgoingEdge = edges.find((edge) => edge.source === node.id);
      if (outgoingEdge) {
        step.nextStepId = outgoingEdge.target;
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

  const visitState = new Map<string, 0 | 1 | 2>();
  const pathStack = new Set<string>();

  const hasCycleFrom = (nodeId: string): boolean => {
    visitState.set(nodeId, 1);
    pathStack.add(nodeId);

    const neighbors = adjacency.get(nodeId) || [];
    for (const neighbor of neighbors) {
      const state = visitState.get(neighbor) || 0;
      if (state === 0) {
        if (hasCycleFrom(neighbor)) return true;
      } else if (pathStack.has(neighbor)) {
        return true;
      }
    }

    pathStack.delete(nodeId);
    visitState.set(nodeId, 2);
    return false;
  };

  for (const node of nodes) {
    if ((visitState.get(node.id) || 0) === 0 && hasCycleFrom(node.id)) {
      return 'Workflow contains a cycle. Remove circular routing before saving.';
    }
  }

  return null;
};
