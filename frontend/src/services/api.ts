import type { Project, TestRun, PageInfo, RunStartOptions, StateRecord, ActionRecord } from '../types';
import { UNAUTHORIZED_EVENT, clearToken, getToken } from './token';

const API_BASE = `${import.meta.env.VITE_API_BASE_URL}/api/v1`;

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthResult {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** Do not treat a 401 as "session expired" (used by login/signup). */
  skipAuthRedirect?: boolean;
}

async function errorMessage(res: Response): Promise<string> {
  try {
    const data: unknown = await res.json();
    if (data && typeof data === 'object' && 'detail' in data) {
      const detail = (data as { detail: unknown }).detail;
      if (typeof detail === 'string') return detail;
      if (Array.isArray(detail)) {
        return detail
          .map((d: unknown) =>
            typeof d === 'object' && d !== null && 'msg' in d
              ? String((d as { msg: unknown }).msg).replace(/^Value error, /, '')
              : String(d),
          )
          .join('; ');
      }
    }
  } catch {
    /* response was not JSON */
  }
  return `Request failed (${res.status})`;
}

async function send(path: string, opts: RequestOptions = {}): Promise<Response> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new Error('Cannot reach the API server. Is the backend running?');
  }

  if (!res.ok) {
    if (res.status === 401 && !opts.skipAuthRedirect) {
      clearToken();
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    throw new Error(await errorMessage(res));
  }
  return res;
}

async function json<T>(path: string, opts?: RequestOptions): Promise<T> {
  const res = await send(path, opts);
  return (await res.json()) as T;
}

// ------------------------------------------------------------------ auth
export const signup = (email: string, password: string): Promise<AuthResult> =>
  json<AuthResult>('/auth/signup', { method: 'POST', body: { email, password }, skipAuthRedirect: true });

export const login = (email: string, password: string): Promise<AuthResult> =>
  json<AuthResult>('/auth/login', { method: 'POST', body: { email, password }, skipAuthRedirect: true });

export const getMe = (): Promise<AuthUser> => json<AuthUser>('/auth/me');

// -------------------------------------------------------------- projects
export const getProjects = (): Promise<Project[]> => json<Project[]>('/projects/');

export const createProject = (data: {
  name: string;
  url: string;
  description?: string;
  testing_objective?: string;
}): Promise<Project> => json<Project>('/projects/', { method: 'POST', body: data });

export const getProject = (id: string): Promise<Project> => json<Project>(`/projects/${id}`);

export const getProjectRuns = (projectId: string): Promise<TestRun[]> =>
  json<TestRun[]>(`/projects/${projectId}/runs`);

export const createRun = (projectId: string): Promise<TestRun> =>
  json<TestRun>(`/projects/${projectId}/runs`, { method: 'POST' });

// ------------------------------------------------------------------ runs
export const startRun = (runId: string, options: RunStartOptions): Promise<TestRun> =>
  json<TestRun>(`/runs/${runId}/start`, { method: 'POST', body: options });

export const getRun = (runId: string): Promise<TestRun> => json<TestRun>(`/runs/${runId}`);

export const getRunPages = (runId: string): Promise<PageInfo[]> =>
  json<PageInfo[]>(`/runs/${runId}/pages`);

export const getRunStates = (runId: string): Promise<StateRecord[]> =>
  json<StateRecord[]>(`/runs/${runId}/states`);

export const getRunActions = (runId: string): Promise<ActionRecord[]> =>
  json<ActionRecord[]>(`/runs/${runId}/actions`);

export const getNextAction = async (runId: string): Promise<ActionRecord | null> => {
  const res = await send(`/runs/${runId}/actions/next`);
  if (res.status === 204 || res.headers.get('content-length') === '0') return null;
  const data = (await res.json()) as ActionRecord | null;
  return data || null;
};

export const getRunFailures = (runId: string): Promise<unknown> => json<unknown>(`/runs/${runId}/failures`);

export const getFailureEvidence = (failureId: string): Promise<unknown> =>
  json<unknown>(`/failures/${failureId}/evidence`);
export const getFailureScreenshot = async (
  failureId: string,
  evidenceId: string,
): Promise<Blob> => {
  const res = await send(
    `/failures/${failureId}/evidence/${evidenceId}/content`,
  );
  return res.blob();
};

export const getFailureScript = async (failureId: string): Promise<string> => {
  const res = await send(`/failures/${failureId}/reproduction-script`);
  return res.text();
};