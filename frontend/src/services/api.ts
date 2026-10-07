import { Project, TestRun, PageInfo, RunStartOptions, StateRecord, ActionRecord } from '../types';

const API_BASE = `${import.meta.env.VITE_API_BASE_URL}/api/v1`;

export const getProjects = async (): Promise<Project[]> => {
  const res = await fetch(`${API_BASE}/projects/`);
  return res.json();
};

export const createProject = async (data: {name: string, url: string}): Promise<Project> => {
  const res = await fetch(`${API_BASE}/projects/`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(data)
  });
  return res.json();
};

export const getProject = async (id: string): Promise<Project> => {
  const res = await fetch(`${API_BASE}/projects/${id}`);
  return res.json();
};

export const getProjectRuns = async (projectId: string): Promise<TestRun[]> => {
  const res = await fetch(`${API_BASE}/projects/${projectId}/runs`);
  return res.json();
};

export const createRun = async (projectId: string): Promise<TestRun> => {
  const res = await fetch(`${API_BASE}/projects/${projectId}/runs`, { method: 'POST' });
  return res.json();
};

export const startRun = async (runId: string, options: RunStartOptions): Promise<TestRun> => {
  const res = await fetch(`${API_BASE}/runs/${runId}/start`, { 
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(options)
  });
  return res.json();
};

export const getRun = async (runId: string): Promise<TestRun> => {
  const res = await fetch(`${API_BASE}/runs/${runId}`);
  return res.json();
};

export const getRunPages = async (runId: string): Promise<PageInfo[]> => {
  const res = await fetch(`${API_BASE}/runs/${runId}/pages`);
  return res.json();
};
export const getRunStates = async (runId: string): Promise<StateRecord[]> => {
  const res = await fetch(`${API_BASE}/runs/${runId}/states`);
  return res.json();
};
export const getRunActions = async (runId: string): Promise<ActionRecord[]> => {
  const res = await fetch(`${API_BASE}/runs/${runId}/actions`);
  return res.json();
};
export const getNextAction = async (runId: string): Promise<ActionRecord | null> => {
  const res = await fetch(`${API_BASE}/runs/${runId}/actions/next`);
  if (res.status === 204 || res.headers.get("content-length") === "0") return null;
  const data = await res.json();
  return data || null;
};export const getRunFailures = async (runId: string) => {
  const res = await fetch(`${API_BASE}/runs/${runId}/failures`);
  return res.json();
};
export const getFailureEvidence = async (failureId: string) => {
  const res = await fetch(`${API_BASE}/failures/${failureId}/evidence`);
  return res.json();
};
export const getFailureScript = async (failureId: string): Promise<string> => {
  const res = await fetch(`${API_BASE}/failures/${failureId}/reproduction-script`);
  if (!res.ok) throw new Error('Could not generate script');
  return res.text();
};
