import { useParams } from 'react-router-dom';

// Phase 2 will replace this with the full drag-and-drop Workflow Builder UI
export default function WorkflowBuilder() {
  const { id } = useParams<{ id?: string }>();

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-2">
        {id ? `Edit Workflow` : 'New Workflow'}
      </h1>
      <p className="text-gray-400">Workflow builder — coming in Phase 2.</p>
      {id && <p className="text-gray-500 text-sm mt-1">Editing ID: {id}</p>}
    </div>
  );
}
