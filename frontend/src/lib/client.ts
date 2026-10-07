import * as api from '../services/api';
import type {
  ActionRecord,
  EvidenceRecord,
  FailureRecord,
  PageInfo,
  Project,
  RunStartOptions,
  StateRecord,
  TestRun,
} from '../types';

export interface ProjectInput {
  name: string;
  url: string;
  description?: string;
  testing_objective?: string;
}

type AnyFn = (...args: unknown[]) => unknown;

// Accepts both plain results and axios-style { data } responses.
function unwrap(res: unknown): unknown {
  if (res && typeof res === 'object' && !Array.isArray(res) && 'data' in res && !('id' in res)) {
    return (res as { data: unknown }).data;
  }
  return res;
}

async function call<T>(fn: unknown, ...args: unknown[]): Promise<T> {
  return unwrap(await (fn as AnyFn)(...args)) as T;
}

async function callList<T>(fn: unknown, ...args: unknown[]): Promise<T[]> {
  const res = await call<unknown>(fn, ...args);
  return Array.isArray(res) ? (res as T[]) : [];
}

export const listProjects = () => callList<Project>(api.getProjects);
export const createProject = (input: ProjectInput) => call<Project>(api.createProject, input);
export const fetchProject = (id: string) => call<Project>(api.getProject, id);
export const fetchProjectRuns = (projectId: string) => callList<TestRun>(api.getProjectRuns, projectId);

export const createRun = (projectId: string) => call<TestRun>(api.createRun, projectId);
export const startRun = (runId: string, options: RunStartOptions) =>
  call<unknown>(api.startRun, runId, options);

export const fetchRun = (runId: string) => call<TestRun>(api.getRun, runId);
export const fetchPages = (runId: string) => callList<PageInfo>(api.getRunPages, runId);
export const fetchStates = (runId: string) => callList<StateRecord>(api.getRunStates, runId);
export const fetchActions = (runId: string) => callList<ActionRecord>(api.getRunActions, runId);
export const fetchFailures = (runId: string) => callList<FailureRecord>(api.getRunFailures, runId);
export const fetchEvidence = (failureId: string) =>
  callList<EvidenceRecord>(api.getFailureEvidence, failureId);

async function toText(res: unknown): Promise<string | null> {
  if (typeof res === 'string') return res;
  if (typeof Blob !== 'undefined' && res instanceof Blob) return res.text();
  if (res && typeof res === 'object') {
    const o = res as Record<string, unknown>;
    for (const key of ['script', 'content', 'code', 'data']) {
      if (key in o) {
        const t = await toText(o[key]);
        if (t !== null) return t;
      }
    }
  }
  return null;
}

export async function fetchScript(failureId: string): Promise<string> {
  const res = await (api.getFailureScript as unknown as AnyFn)(failureId);
  const text = await toText(res);
  if (text === null) throw new Error('The server returned an unexpected script format.');
  return text;
}