import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { TestRun, PageInfo, StateRecord, ActionRecord } from '../types';
import { getRun, getRunPages, getRunStates, getRunActions } from '../services/api';

export default function RunDetailPage() {
  const { id } = useParams<{id: string}>();
  const [run, setRun] = useState<TestRun | null>(null);
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [states, setStates] = useState<StateRecord[]>([]);
  const [actions, setActions] = useState<ActionRecord[]>([]);

  const loadData = async () => {
    if (!id) return;
    const r = await getRun(id);
    setRun(r);
    
    if (r.status === 'COMPLETED' || r.status === 'FAILED') {
      setPages(await getRunPages(id));
      setStates(await getRunStates(id));
      setActions(await getRunActions(id));
    } else if (r.status === 'RUNNING') {
      setTimeout(loadData, 3000); // poll
    }
  };

  useEffect(() => { loadData(); }, [id]);

  if (!run) return <div>Loading...</div>;

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="mb-4">
        <Link to={`/projects/${run.project_id}`} className="text-blue-600 hover:underline">← Back to Project</Link>
      </div>

      <div className="bg-white p-6 rounded shadow mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold mb-2">Test Run Details</h1>
          <p className="text-gray-700">Run ID: {run.id}</p>
          <p className="text-gray-700">Started: {run.started_at ? new Date(run.started_at).toLocaleString() : 'N/A'}</p>
        </div>
        <div className="text-right">
          <span className={`px-4 py-2 inline-flex text-lg leading-5 font-bold rounded-full 
            ${run.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 
              run.status === 'FAILED' ? 'bg-red-100 text-red-800' : 
              run.status === 'RUNNING' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
            {run.status}
          </span>
          <p className="mt-2 text-gray-600">{run.duration_ms ? `${(run.duration_ms / 1000).toFixed(1)}s elapsed` : ''}</p>
        </div>
      </div>

      {run.error_message && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
          <h3 className="text-red-800 font-bold">Error</h3>
          <p className="text-red-700 whitespace-pre-wrap">{run.error_message}</p>
        </div>
      )}

      {pages.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4">Discovered Pages ({pages.length})</h2>
          <div className="bg-white rounded shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">URL</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Depth</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Load Time</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {pages.map(page => (
                  <tr key={page.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600"><a href={page.url} target="_blank" rel="noreferrer">{page.url}</a></td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{page.depth}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{page.title}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{page.load_time_ms ? `${page.load_time_ms.toFixed(0)}ms` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {states.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4">Unique States Discovered ({new Set(states.map(s => s.dom_hash)).size})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {states.map(state => (
              <div key={state.id} className="bg-white p-4 rounded shadow border">
                <h3 className="font-semibold mb-2">State Hash: <span className="font-mono text-xs text-gray-500">{state.dom_hash.substring(0, 12)}...</span></h3>
                <p className="text-sm text-gray-700"><strong>Title Hint:</strong> {state.state_data.title_hint}</p>
                <p className="text-sm text-gray-700"><strong>Elements:</strong> {state.state_data.element_count}</p>
                <details className="mt-2 text-sm text-gray-500 cursor-pointer">
                  <summary>View Selectors</summary>
                  <ul className="mt-1 pl-4 list-disc max-h-32 overflow-y-auto">
                    {state.state_data.selectors.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </details>
              </div>
            ))}
          </div>
        </div>
      )}

      {actions.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4">Generated Actions ({actions.length})</h2>
          <div className="bg-white rounded shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {actions.slice(0, 100).map(action => (
                  <tr key={action.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{action.action_type}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 truncate max-w-xs" title={action.target_selector}>{action.target_selector}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 truncate max-w-xs" title={action.value}>{action.value || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                        ${action.status === 'success' ? 'bg-green-100 text-green-800' : 
                          action.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>
                        {action.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {actions.length > 100 && (
              <div className="p-4 text-center text-sm text-gray-500 bg-gray-50 border-t">
                Showing 100 of {actions.length} generated actions.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}