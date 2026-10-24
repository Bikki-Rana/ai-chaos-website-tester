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
import { notifyProjectsChanged } from './events';

export interface ProjectInput {
  name: string;
  url: string;
  description?: string;
  testing_objective?: string;
}

type AnyFn = (...args: unknown[]) => unknown;

function unwrap(res: unknown): unknown {
  if (
    res &&
    typeof res === 'object' &&
    !Array.isArray(res) &&
    'data' in res &&
    !('id' in res)
  ) {
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

export type ProjectMeta = Project & {
  pinned?: boolean;
  sort_order?: number;
};

export const listProjects = () =>
  callList<ProjectMeta>(api.getProjects);

export const createProject = async (
  input: ProjectInput,
): Promise<Project> => {
  const project = await call<Project>(api.createProject, input);
  notifyProjectsChanged();
  return project;
};

export const fetchProject = (id: string) =>
  call<Project>(api.getProject, id);

export const fetchProjectRuns = (projectId: string) =>
  callList<TestRun>(api.getProjectRuns, projectId);

export const createRun = (projectId: string) =>
  call<TestRun>(api.createRun, projectId);

export const startRun = (runId: string, options: RunStartOptions) =>
  call<unknown>(api.startRun, runId, options);

export const fetchRun = (runId: string) =>
  call<TestRun>(api.getRun, runId);

export const fetchPages = (runId: string) =>
  callList<PageInfo>(api.getRunPages, runId);

export const fetchStates = (runId: string) =>
  callList<StateRecord>(api.getRunStates, runId);

export const fetchActions = (runId: string) =>
  callList<ActionRecord>(api.getRunActions, runId);

export const fetchFailures = (runId: string) =>
  callList<FailureRecord>(api.getRunFailures, runId);

export const fetchEvidence = (failureId: string) =>
  callList<EvidenceRecord>(api.getFailureEvidence, failureId);

async function toText(res: unknown): Promise<string | null> {
  if (typeof res === 'string') return res;

  if (typeof Blob !== 'undefined' && res instanceof Blob) {
    return res.text();
  }

  if (res && typeof res === 'object') {
    const o = res as Record<string, unknown>;

    for (const key of ['script', 'content', 'code', 'data']) {
      if (key in o) {
        const text = await toText(o[key]);
        if (text !== null) return text;
      }
    }
  }

  return null;
}

export async function fetchScript(failureId: string): Promise<string> {
  const res = await (
    api.getFailureScript as unknown as AnyFn
  )(failureId);

  const text = await toText(res);

  if (text === null) {
    throw new Error(
      'The server returned an unexpected script format.',
    );
  }

  return text;
}

export const fetchScreenshot = (
  failureId: string,
  evidenceId: string,
): Promise<Blob> =>
  call<Blob>(api.getFailureScreenshot, failureId, evidenceId);

export const removeProject = async (id: string): Promise<void> => {
  await api.deleteProject(id);
  notifyProjectsChanged();
};

export const renameProject = async (
  id: string,
  name: string,
): Promise<Project> => {
  const project = await call<Project>(
    api.updateProject,
    id,
    { name },
  );

  notifyProjectsChanged();
  return project;
};

export const setProjectPinned = async (
  id: string,
  pinned: boolean,
): Promise<void> => {
  await call<Project>(api.updateProject, id, { pinned });
  notifyProjectsChanged();
};

export const moveProject = async (
  order: Array<{ id: string; pinned: boolean }>,
  projectId: string,
  direction: 'up' | 'down',
): Promise<void> => {
  const currentIndex = order.findIndex(
    (item) => item.id === projectId,
  );

  if (currentIndex < 0) {
    throw new Error('Project not found in the current list.');
  }

  const targetIndex =
    currentIndex + (direction === 'up' ? -1 : 1);

  if (targetIndex < 0 || targetIndex >= order.length) {
    return;
  }

  const current = order[currentIndex];
  const target = order[targetIndex];

  if (!current || !target || current.pinned !== target.pinned) {
    throw new Error(
      'Projects can only move within the same pinned group.',
    );
  }

  const updatedOrder = [...order];

  [
    updatedOrder[currentIndex],
    updatedOrder[targetIndex],
  ] = [
    updatedOrder[targetIndex]!,
    updatedOrder[currentIndex]!,
  ];

  await api.reorderProjects(
    updatedOrder.map((item) => item.id),
  );

  notifyProjectsChanged();
};
