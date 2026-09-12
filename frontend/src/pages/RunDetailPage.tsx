import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { TestRun, PageInfo } from '../types';
import { getRun, getRunPages } from '../services/api';

export default function RunDetailPage() {
  const { id } = useParams<{id: string}>();
  const [run, setRun] = useState<TestRun | null>(null);
  const [pages, setPages] = useState<PageInfo[]>([]);

  const loadData = async () => {
    if (!id) return;
    const r = await getRun(id);
    setRun(r);
    if (r.status === 'COMPLETED' || r.status === 'FAILED') {
      setPages(await getRunPages(id));
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      if (run?.status === 'RUNNING' || run?.status === 'PENDING') {
        loadData();
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [id, run?.status]);

  if (!run) return <div>Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="mb-4">
        <Link to={`/projects/${run.project_id}`} className="text-blue-600 hover:underline">← Back to Project</Link>
      </div>

      <div className="bg-white p-6 rounded shadow mb-6">
        <h1 className="text-2xl font-bold mb-4">Run Details</h1>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="font-semibold text-gray-600">Status:</span> 
            <span className={`ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
              ${run.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 
                run.status === 'FAILED' ? 'bg-red-100 text-red-800' : 
                run.status === 'RUNNING' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
              {run.status}
            </span>
          </div>
          <div><span className="font-semibold text-gray-600">Duration:</span> {run.duration_ms ? `${(run.duration_ms/1000).toFixed(1)}s` : '-'}</div>
        </div>
        {run.error_message && (
          <div className="mt-4 p-4 bg-red-50 text-red-700 rounded border border-red-200">
            <strong>Error:</strong> <pre className="mt-2 text-xs overflow-auto">{run.error_message}</pre>
          </div>
        )}
      </div>

      {(run.status === 'COMPLETED' || run.status === 'FAILED') && (
        <>
          <h2 className="text-xl font-bold mb-4">Discovered Pages</h2>
          <div className="bg-white rounded shadow overflow-hidden">
            <ul className="divide-y divide-gray-200">
              {pages.length === 0 ? (
                <li className="px-6 py-4 text-gray-500 text-sm">No pages discovered.</li>
              ) : pages.map(p => (
                <li key={p.id} className="px-6 py-4 hover:bg-gray-50">
                  <div className="font-medium text-blue-600 break-all">{p.url}</div>
                  <div className="text-sm text-gray-500 mt-1">{p.title} • {p.load_time_ms ? `${p.load_time_ms}ms` : ''}</div>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}