import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Project } from '../types';
import { getProjects, createProject } from '../services/api';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('http://localhost:5000');

  const loadProjects = async () => {
    const data = await getProjects();
    setProjects(data);
  };

  useEffect(() => { loadProjects(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createProject({ name, url });
    setName('');
    loadProjects();
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Projects</h1>
      
      <form onSubmit={handleCreate} className="bg-white p-4 rounded shadow mb-6 space-y-4">
        <h2 className="text-xl font-semibold">New Project</h2>
        <div>
          <label className="block text-sm font-medium">Name</label>
          <input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full border p-2 rounded" />
        </div>
        <div>
          <label className="block text-sm font-medium">Target URL</label>
          <input type="url" required value={url} onChange={e => setUrl(e.target.value)} className="w-full border p-2 rounded" />
        </div>
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Create Project</button>
      </form>

      <div className="grid gap-4">
        {projects.map(p => (
          <Link key={p.id} to={`/projects/${p.id}`} className="bg-white p-4 rounded shadow hover:shadow-md transition">
            <h3 className="font-bold text-lg">{p.name}</h3>
            <p className="text-gray-600 text-sm">{p.url}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}