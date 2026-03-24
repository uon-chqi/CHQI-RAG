import type { ReactNode } from 'react';
import { AlertCircle, Clock, MessageSquare, Settings } from 'lucide-react';
import { Handle, Position, type NodeProps } from 'reactflow';

type NodeWrapperProps = {
  children: ReactNode;
  isSelected: boolean;
  borderColor: string;
};

function NodeWrapper({ children, isSelected, borderColor }: NodeWrapperProps) {
  return (
    <div
      className={`rounded-md border-2 bg-white shadow-sm min-w-[210px] ${
        isSelected ? 'ring-2 ring-offset-2 ring-blue-500' : ''
      } ${borderColor}`}
    >
      {children}
    </div>
  );
}

export function SendSmsNode({ data, selected }: NodeProps) {
  const typedData = data as { templateName?: string };

  return (
    <NodeWrapper isSelected={selected} borderColor="border-blue-400">
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-blue-400" />
      <div className="flex items-center gap-2 bg-blue-50 p-2 border-b border-blue-100 rounded-t-sm">
        <MessageSquare size={16} className="text-blue-600" />
        <span className="text-sm font-semibold text-blue-900">Send SMS</span>
      </div>
      <div className="p-3 text-xs text-gray-600">
        {typedData.templateName ? (
          <span className="font-medium truncate block">Template: {typedData.templateName}</span>
        ) : (
          <span className="text-red-500 flex items-center gap-1">
            <AlertCircle size={12} /> Config Required
          </span>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-blue-400" />
    </NodeWrapper>
  );
}

export function WaitNode({ data, selected }: NodeProps) {
  const typedData = data as { timeoutHours?: number; branches?: Record<string, unknown> };
  const branchesCount = typedData.branches ? Object.keys(typedData.branches).length : 0;

  return (
    <NodeWrapper isSelected={selected} borderColor="border-orange-400">
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-orange-400" />
      <div className="flex items-center gap-2 bg-orange-50 p-2 border-b border-orange-100 rounded-t-sm">
        <Clock size={16} className="text-orange-600" />
        <span className="text-sm font-semibold text-orange-900">Wait for Reply</span>
      </div>
      <div className="p-3 text-xs text-gray-600 space-y-1">
        <div>
          Timeout: <span className="font-medium">{typedData.timeoutHours || 24}h</span>
        </div>
        <div>
          Branches: <span className="font-medium">{branchesCount} configured</span>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-orange-400" />
    </NodeWrapper>
  );
}

export function SystemActionNode({ data, selected }: NodeProps) {
  const typedData = data as { module?: string; action?: string };

  return (
    <NodeWrapper isSelected={selected} borderColor="border-green-400">
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-green-400" />
      <div className="flex items-center gap-2 bg-green-50 p-2 border-b border-green-100 rounded-t-sm">
        <Settings size={16} className="text-green-600" />
        <span className="text-sm font-semibold text-green-900">System Action</span>
      </div>
      <div className="p-3 text-xs text-gray-600">
        {typedData.module ? (
          <div>
            <span className="font-medium">{typedData.module}</span>
            <br />
            <span className="text-gray-400">{typedData.action || 'Action not set'}</span>
          </div>
        ) : (
          <span className="text-red-500 flex items-center gap-1">
            <AlertCircle size={12} /> Config Required
          </span>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-green-400" />
    </NodeWrapper>
  );
}

export const customNodeTypes = {
  SEND_SMS: SendSmsNode,
  WAIT_FOR_REPLY: WaitNode,
  SYSTEM_ACTION: SystemActionNode,
};
