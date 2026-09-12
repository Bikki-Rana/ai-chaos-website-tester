import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Project, TestRun } from '../types';
import { getProject, getProjectRuns, createRun, startRun } from '../services/api';

export default function ProjectDetailPage() {
  const { id } = useParams<{id: string}>();
  const [project, setProject] = useState<Project | null>(null);
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [maxPages, setMaxPages] = useState<number>(10);
  const [maxDepth, setMaxDepth] = useState<number>(2);

  const loadData = async () => {
    if (!id) return;
    setProject(await getProject(id));
    setRuns(await getProjectRuns(id));
  };

  useEffect(() => { loadData(); }, [id]);

  const handleStartRun = async () => {
    if (!id) return;
    const run = await createRun(id);
    await startRun(run.id, { max_pages: maxPages, max_depth: maxDepth });
    loadData();
  };

  if (!project) return <div>Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="mb-4">
        <Link to="/" className="text-blue-600 hover:underline">← Back to Projects</Link>
      </div>
      
      <div className="bg-white p-6 rounded shadow mb-6">
        <h1 className="text-2xl font-bold mb-2">{project.name}</h1>
        <p className="text-gray-700 mb-6">URL: <a href={project.url} className="text-blue-500 hover:underline" target="_blank" rel="noreferrer">{project.url}</a></p>
        
        <div className="bg-gray-50 p-4 rounded border">
            <h3 className="font-semibold mb-2">New Test Run Configuration</h3>
            <div className="flex gap-4 mb-4">
                <div>
                    <label className="block text-sm text-gray-600">Max Pages</label>
                    <input type="number" min="1" max="100" value={maxPages} onChange={e => setMaxPages(parseInt(e.target.value))} className="border rounded px-2 py-1 w-24" />
                </div>
                <div>
                    <label className="block text-sm text-gray-600">Max Depth</label>
                    <input type="number" min="0" max="10" value={maxDepth} onChange={e => setMaxDepth(parseInt(e.target.value))} className="border rounded px-2 py-1 w-24" />
                </div>
            </div>
            <button onClick={handleStartRun} className="bg-green-600 text-white px-4 py-2 rounded font-semibold hover:bg-green-700">
            Start New Test Run
            </button>
        </div>
      </div>

      <h2 className="text-xl font-bold mb-4">Test Runs</h2>
      <div className="bg-white rounded shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Started</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {runs.map(run => (
              <tr key={run.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                    ${run.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 
                      run.status === 'FAILED' ? 'bg-red-100 text-red-800' : 
                      run.status === 'RUNNING' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                    {run.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {run.started_at ? new Date(run.started_at).toLocaleString() : 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {run.duration_ms ? `${(run.duration_ms / 1000).toFixed(1)}s` : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <Link to={`/runs/${run.id}`} className="text-indigo-600 hover:text-indigo-900">View Details</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}