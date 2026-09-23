import { Project, TestRun, PageInfo, RunStartOptions, StateRecord, ActionRecord } from '../types';

const API_BASE = 'http://localhost:8000/api/v1';

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