import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import {
  addEdge,
  Background,
  Controls,
  MiniMap,
  type Connection,
  type Edge,
  type Node,
  ReactFlow,
  ReactFlowProvider,
  useOnSelectionChange,
  useEdgesState,
  useNodesState,
  type OnConnect,
  type ReactFlowInstance,
} from 'reactflow';
import { ArrowLeft, Clock, Loader2, MessageSquare, Save, Settings } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { smsServices } from '../../lib/api';
import { StepActionType, WorkflowTriggerEvent, type Workflow } from '../../types/sms';
import { customNodeTypes } from './components/WorkflowNodes';
import NodeConfigPanel from './components/NodeConfigPanel';
import {
  serializeWorkflowPayload,
  serializeUpdatePayload,
  validateWorkflowGraph,
  type WorkflowMetadata,
} from './utils/workflowSerializer';
import { deserializeWorkflowGraph } from './utils/workflowDeserializer';
import 'reactflow/dist/style.css';

const initialNodes: Node[] = [
  {
    id: 'node-1',
    type: StepActionType.SEND_SMS,
    position: { x: 280, y: 100 },
    data: {
      actionType: StepActionType.SEND_SMS,
      isFirstStep: true,
      templateName: 'Select a template',
    },
  },
];

const initialEdges: Edge[] = [];

let idCounter = 2;
const getId = () => `node-${idCounter++}`;

function syncIdCounter(nodes: Node[]) {
  const maxExisting = nodes.reduce((max, node) => {
    if (!node.id.startsWith('node-')) return max;
    const parsed = Number.parseInt(node.id.replace('node-', ''), 10);
    return Number.isNaN(parsed) ? max : Math.max(max, parsed);
  }, 1);
  idCounter = maxExisting + 1;
}

function normalizeWorkflowPayload(payload: unknown): Workflow | null {
  if (!payload) return null;
  const source = payload as Workflow | { data?: Workflow };
  if (source && 'id' in source && typeof source.id === 'string') {
    return source as Workflow;
  }
  if (source?.data && typeof source.data.id === 'string') {
    return source.data;
  }
  return null;
}

type BuilderCanvasProps = {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: ReturnType<typeof useNodesState>[2];
  onEdgesChange: ReturnType<typeof useEdgesState>[2];
  setNodes: ReturnType<typeof useNodesState>[1];
  setEdges: ReturnType<typeof useEdgesState>[1];
};

function BuilderCanvas({ nodes, edges, onNodesChange, onEdgesChange, setNodes, setEdges }: BuilderCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const selectedNode = selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) || null : null;

  useOnSelectionChange({
    onChange: ({ nodes: selectedNodes }) => {
      setSelectedNodeId(selectedNodes.length > 0 ? selectedNodes[0].id : null);
    },
  });

  const updateNodeData = useCallback(
    (nodeId: string, newData: Record<string, unknown>) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return { ...node, data: { ...node.data, ...newData } };
          }
          return node;
        })
      );
    },
    [setNodes]
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      setSelectedNodeId(null);
    },
    [setNodes, setEdges]
  );

  const onConnect: OnConnect = useCallback(
    (params: Edge | Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow') as StepActionType;
      if (!type) return;
      if (!reactFlowWrapper.current || !reactFlowInstance) return;

      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });

      const newNode: Node = {
        id: getId(),
        type,
        position,
        data: {
          actionType: type,
          isFirstStep: false,
          ...(type === StepActionType.WAIT_FOR_REPLY ? { retryLimit: 3, timeoutHours: 24 } : {}),
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes]
  );

  return (
    <div className="flex h-full" ref={reactFlowWrapper}>
      <div className="w-64 bg-white border-r p-4 flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Toolbox</h3>
        <p className="text-xs text-gray-500 mb-2">Drag nodes onto the canvas to build your workflow.</p>

        <div
          className="p-3 border rounded bg-blue-50 border-blue-200 text-blue-700 flex items-center gap-2 cursor-grab"
          draggable
          onDragStart={(e) => e.dataTransfer.setData('application/reactflow', StepActionType.SEND_SMS)}
        >
          <MessageSquare size={16} /> Send SMS
        </div>

        <div
          className="p-3 border rounded bg-orange-50 border-orange-200 text-orange-700 flex items-center gap-2 cursor-grab"
          draggable
          onDragStart={(e) => e.dataTransfer.setData('application/reactflow', StepActionType.WAIT_FOR_REPLY)}
        >
          <Clock size={16} /> Wait for Reply
        </div>

        <div
          className="p-3 border rounded bg-green-50 border-green-200 text-green-700 flex items-center gap-2 cursor-grab"
          draggable
          onDragStart={(e) => e.dataTransfer.setData('application/reactflow', StepActionType.SYSTEM_ACTION)}
        >
          <Settings size={16} /> System Action
        </div>
      </div>

      <div className="flex-1 h-full bg-gray-50 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={setReactFlowInstance}
          onDrop={onDrop}
          onDragOver={onDragOver}
          nodeTypes={customNodeTypes}
          deleteKeyCode={['Delete', 'Backspace']}
          fitView
        >
          <Background color="#d1d5db" gap={16} />
          <MiniMap pannable zoomable />
          <Controls />
        </ReactFlow>
      </div>

      <div className="w-80 bg-white border-l flex flex-col">
        <NodeConfigPanel
          selectedNode={selectedNode}
          availableNodes={nodes}
          onUpdateNodeData={updateNodeData}
          onDeleteNode={deleteNode}
        />
      </div>
    </div>
  );
}

export default function WorkflowBuilder() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingWorkflow, setIsLoadingWorkflow] = useState(false);

  const [workflowMetadata, setWorkflowMetadata] = useState<WorkflowMetadata>({
    name: 'New Workflow',
    facilityId: null,
    triggerEvent: WorkflowTriggerEvent.DAYS_BEFORE_APPOINTMENT,
    triggerCondition: { days: 1 },
    isActive: true,
  });

  useEffect(() => {
    const loadWorkflow = async () => {
      if (!id) {
        setWorkflowMetadata({
          name: 'New Workflow',
          facilityId: null,
          triggerEvent: WorkflowTriggerEvent.DAYS_BEFORE_APPOINTMENT,
          triggerCondition: { days: 1 },
          isActive: true,
        });
        setNodes(initialNodes);
        setEdges(initialEdges);
        syncIdCounter(initialNodes);
        return;
      }

      setIsLoadingWorkflow(true);
      try {
        const res = await smsServices.getWorkflowById(id);
        const workflow = normalizeWorkflowPayload(res);
        if (!workflow) {
          toast.error('Workflow data was not in the expected format.');
          return;
        }

        setWorkflowMetadata({
          id: workflow.id,
          name: workflow.name,
          facilityId: workflow.facilityId,
          triggerEvent: workflow.triggerEvent,
          triggerCondition: workflow.triggerCondition || {},
          isActive: workflow.isActive,
        });

        const graph = deserializeWorkflowGraph(workflow);
        setNodes(graph.nodes);
        setEdges(graph.edges);
        syncIdCounter(graph.nodes);
      } catch (err) {
        console.error('Failed to load workflow', err);
        toast.error('Failed to load workflow details.');
        navigate('/admin/workflows');
      } finally {
        setIsLoadingWorkflow(false);
      }
    };

    loadWorkflow();
  }, [id, navigate, setEdges, setNodes]);

  const handleSave = async (options?: { asDraft?: boolean }) => {
    const metadataToSave = options?.asDraft ? { ...workflowMetadata, isActive: false } : workflowMetadata;

    const validationError = validateWorkflowGraph(metadataToSave, nodes, edges);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setIsSaving(true);
    try {
      const payload = serializeWorkflowPayload(metadataToSave, nodes, edges);

      if (workflowMetadata.id) {
        const updatePayload = serializeUpdatePayload(metadataToSave, nodes, edges);
        await smsServices.updateWorkflow(workflowMetadata.id, updatePayload);
        toast.success(options?.asDraft ? 'Draft saved successfully.' : 'Workflow updated successfully.');
      } else {
        const res = await smsServices.createWorkflow(payload);
        const created = normalizeWorkflowPayload(res);
        if (created?.id) {
          setWorkflowMetadata((prev) => ({ ...prev, id: created.id, isActive: metadataToSave.isActive }));
          navigate(`/admin/workflows/builder/${created.id}`, { replace: true });
        }
        toast.success(options?.asDraft ? 'Draft saved successfully.' : 'Workflow created successfully.');
      }

      if (options?.asDraft) {
        setWorkflowMetadata((prev) => ({ ...prev, isActive: false }));
      }
    } catch (err) {
      console.error('Failed to save workflow', err);
      toast.error('Failed to save workflow.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoadingWorkflow) {
    return (
      <div className="flex h-[calc(100vh-64px)] items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin w-8 h-8 text-blue-500" />
      </div>
    );
  }

  const triggerConditionDays =
    typeof (workflowMetadata.triggerCondition as Record<string, unknown>)?.days === 'number'
      ? ((workflowMetadata.triggerCondition as Record<string, unknown>).days as number)
      : 1;

  const showDaysInput =
    workflowMetadata.triggerEvent === WorkflowTriggerEvent.DAYS_BEFORE_APPOINTMENT ||
    workflowMetadata.triggerEvent === WorkflowTriggerEvent.POST_DISCHARGE;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
      {/* Header */}
      <div className="border-b bg-white px-6 py-3 shrink-0 space-y-2">
        {/* Row 1: name + save */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin/workflows')} className="text-gray-500">
              <ArrowLeft size={16} className="mr-2" /> Back
            </Button>
            <div>
              <input
                className="text-lg font-bold text-gray-900 leading-tight outline-none border-b border-transparent focus:border-blue-500 bg-transparent"
                value={workflowMetadata.name}
                onChange={(e) => setWorkflowMetadata((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Workflow Name"
              />
              <p className="text-xs text-gray-500">{workflowMetadata.id ? 'Saved Workflow' : 'Draft Workflow'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={workflowMetadata.isActive}
                onChange={(e) => setWorkflowMetadata((prev) => ({ ...prev, isActive: e.target.checked }))}
              />
              Active
            </label>

            <Button
              variant="outline"
              className="flex items-center gap-2"
              onClick={() => handleSave({ asDraft: true })}
              disabled={isSaving || isLoadingWorkflow}
            >
              {isSaving ? 'Saving...' : 'Save Draft'}
            </Button>

            <Button className="flex items-center gap-2" onClick={handleSave} disabled={isSaving || isLoadingWorkflow}>
              {isSaving ? 'Saving...' : (<><Save size={16} /> Save Workflow</>)}
            </Button>
          </div>
        </div>

        {/* Row 2: workflow settings */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-1 border-t border-gray-100">
          {/* Trigger event */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500 whitespace-nowrap">Trigger Event</span>
            <select
              className="h-8 rounded-md border border-gray-300 bg-white px-2 text-sm text-gray-700"
              value={workflowMetadata.triggerEvent}
              onChange={(e) =>
                setWorkflowMetadata((prev) => ({
                  ...prev,
                  triggerEvent: e.target.value as WorkflowTriggerEvent,
                  triggerCondition: {},
                }))
              }
            >
              {Object.values(WorkflowTriggerEvent).map((eventValue) => (
                <option key={eventValue} value={eventValue}>
                  {eventValue.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          {/* Trigger condition — days input */}
          {showDaysInput && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500 whitespace-nowrap">
                {workflowMetadata.triggerEvent === WorkflowTriggerEvent.DAYS_BEFORE_APPOINTMENT
                  ? 'Days Before'
                  : 'Days After'}
              </span>
              <input
                type="number"
                min={1}
                className="h-8 w-20 rounded-md border border-gray-300 bg-white px-2 text-sm text-gray-700"
                value={triggerConditionDays}
                onChange={(e) => {
                  const days = Math.max(1, Number.parseInt(e.target.value, 10) || 1);
                  setWorkflowMetadata((prev) => ({
                    ...prev,
                    triggerCondition: { days },
                  }));
                }}
              />
              <span className="text-xs text-gray-400">day(s)</span>
            </div>
          )}

          {/* Scope */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500 whitespace-nowrap">Scope</span>
            <select
              className="h-8 rounded-md border border-gray-300 bg-white px-2 text-sm text-gray-700"
              value={workflowMetadata.facilityId === null ? 'UNIVERSAL' : 'FACILITY'}
              onChange={(e) =>
                setWorkflowMetadata((prev) => ({
                  ...prev,
                  facilityId: e.target.value === 'UNIVERSAL' ? null : prev.facilityId || '',
                }))
              }
            >
              <option value="UNIVERSAL">Universal</option>
              <option value="FACILITY">Facility-specific</option>
            </select>
          </div>

          {/* Facility ID — only when facility scope is selected */}
          {workflowMetadata.facilityId !== null && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500 whitespace-nowrap">Facility ID</span>
              <input
                className="h-8 rounded-md border border-gray-300 bg-white px-2 text-sm text-gray-700 w-64"
                placeholder="e.g. fac_abc123"
                value={workflowMetadata.facilityId}
                onChange={(e) => setWorkflowMetadata((prev) => ({ ...prev, facilityId: e.target.value }))}
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <ReactFlowProvider>
          <BuilderCanvas
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            setNodes={setNodes}
            setEdges={setEdges}
          />
        </ReactFlowProvider>
      </div>
    </div>
  );
}
