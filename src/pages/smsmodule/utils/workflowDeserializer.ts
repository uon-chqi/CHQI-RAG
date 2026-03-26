import type { Edge, Node } from 'reactflow';
import { StepActionType, type Workflow, type WorkflowStep } from '../../../types/sms';

function stepNodeId(step: WorkflowStep, index: number): string {
  return step.id || `node-${index + 1}`;
}

function stepPosition(step: WorkflowStep, index: number): { x: number; y: number } {
  const config = (step.config || {}) as Record<string, unknown>;
  const layout = (config.layout as { x?: number; y?: number } | undefined) || {};
  const uiPosition = (config.uiPosition as { x?: number; y?: number } | undefined) || {};

  const x =
    typeof layout.x === 'number'
      ? layout.x
      : typeof uiPosition.x === 'number'
      ? uiPosition.x
      : 250;
  const y =
    typeof layout.y === 'number'
      ? layout.y
      : typeof uiPosition.y === 'number'
      ? uiPosition.y
      : 100 + index * 150;

  return { x, y };
}

export const deserializeWorkflowGraph = (workflow: Workflow): { nodes: Node[]; edges: Edge[] } => {
  const nodes: Node[] = [];
  const edgesById = new Map<string, Edge>();

  const steps = workflow.steps || [];

  steps.forEach((step, index) => {
    const nodeId = stepNodeId(step, index);
    const nodeData = {
      isFirstStep: Boolean(step.isFirstStep),
      actionType: step.actionType,
      ...(step.config || {}),
    };

    nodes.push({
      id: nodeId,
      type: step.actionType,
      position: stepPosition(step, index),
      data: nodeData,
    });
  });

  const validIds = new Set(nodes.map((node) => node.id));

  steps.forEach((step, index) => {
    const sourceId = stepNodeId(step, index);

    if (
      (step.actionType === StepActionType.SEND_SMS || step.actionType === StepActionType.SYSTEM_ACTION) &&
      step.nextStepId &&
      validIds.has(step.nextStepId)
    ) {
      const edgeId = `e-${sourceId}-${step.nextStepId}`;
      edgesById.set(edgeId, {
        id: edgeId,
        source: sourceId,
        target: step.nextStepId,
      });
    }

    if (step.actionType === StepActionType.WAIT_FOR_REPLY) {
      const config = (step.config || {}) as Record<string, unknown>;
      const branches = (config.branches as Record<string, string | null> | undefined) || {};
      Object.entries(branches).forEach(([branchKey, targetId]) => {
        if (!targetId || !validIds.has(targetId)) return;

        const edgeId = `e-${sourceId}-${targetId}-${branchKey}`;
        if (!edgesById.has(edgeId)) {
          edgesById.set(edgeId, {
            id: edgeId,
            source: sourceId,
            target: targetId,
            sourceHandle: `branch-${branchKey}`,
            label: branchKey,
          });
        }
      });

      const timeout = (config.timeout as { nextStepId?: string } | undefined) || {};
      if (timeout.nextStepId && validIds.has(timeout.nextStepId)) {
        const edgeId = `e-${sourceId}-${timeout.nextStepId}-timeout`;
        if (!edgesById.has(edgeId)) {
          edgesById.set(edgeId, {
            id: edgeId,
            source: sourceId,
            target: timeout.nextStepId,
            label: 'Timeout',
            style: { stroke: '#dc2626', strokeDasharray: '5,5' },
          });
        }
      }
    }
  });

  return { nodes, edges: Array.from(edgesById.values()) };
};
