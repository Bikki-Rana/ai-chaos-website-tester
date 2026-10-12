import { useEffect, useState } from 'react';
import { createProject } from './client';
import type { ProjectInput } from './client';
import { notifyProjectsChanged, onProjectsChanged } from './events';

/** A project a guest created before signing in. Kept in this browser only. */
export interface Draft extends ProjectInput {
  id: string;
  created_at: string;
}

export interface PendingRun {
  draftId: string;
  max_pages: number;
  max_depth: number;
}

const DRAFTS_KEY = 'ct.drafts';
const PENDING_KEY = 'ct.pendingRun';
export const DRAFT_PREFIX = 'draft-';

export const isDraftId = (id: string): boolean => id.startsWith(DRAFT_PREFIX);

function isDraft(v: unknown): v is Draft {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.name === 'string' &&
    typeof o.url === 'string' &&
    typeof o.created_at === 'string'
  );
}

function read(): Draft[] {
  try {
    const raw = localStorage.getItem(DRAFTS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isDraft) : [];
  } catch {
    return [];
  }
}

function write(list: Draft[]): void {
  try {
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable */
  }
  notifyProjectsChanged();
}

const newestFirst = (list: Draft[]): Draft[] =>
  [...list].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));

export const listDrafts = (): Draft[] => newestFirst(read());

export function addDraft(input: ProjectInput): Draft {
  const draft: Draft = {
    ...input,
    id: `${DRAFT_PREFIX}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    created_at: new Date().toISOString(),
  };
  write([draft, ...read()]);
  return draft;
}

export function removeDraft(id: string): void {
  write(read().filter((d) => d.id !== id));
}

export function useDrafts(): Draft[] {
  const [list, setList] = useState<Draft[]>(() => newestFirst(read()));
  useEffect(() => {
    const refresh = () => setList(newestFirst(read()));
    const off = onProjectsChanged(refresh);
    window.addEventListener('storage', refresh);
    return () => {
      off();
      window.removeEventListener('storage', refresh);
    };
  }, []);
  return list;
}

// ------------------------------------------------ "run after login" intent
export function setPendingRun(p: PendingRun): void {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable */
  }
}

export function getPendingRun(): PendingRun | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const o: unknown = JSON.parse(raw);
    if (typeof o !== 'object' || o === null) return null;
    const r = o as Record<string, unknown>;
    if (typeof r.draftId === 'string' && typeof r.max_pages === 'number' && typeof r.max_depth === 'number') {
      return { draftId: r.draftId, max_pages: r.max_pages, max_depth: r.max_depth };
    }
    return null;
  } catch {
    return null;
  }
}

export function clearPendingRun(): void {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    /* storage unavailable */
  }
}

// ------------------------------------------- save drafts to the account
let claiming: Promise<Map<string, string>> | null = null;

/** Creates a real project for every draft. Returns draftId -> projectId. Safe to call twice. */
export function claimDrafts(): Promise<Map<string, string>> {
  if (claiming) return claiming;
  claiming = (async () => {
    const mapping = new Map<string, string>();
    for (const d of read()) {
      const project = await createProject({
        name: d.name,
        url: d.url,
        description: d.description,
        testing_objective: d.testing_objective,
      });
      mapping.set(d.id, project.id);
      removeDraft(d.id); // only after it was saved, so a failure loses nothing
    }
    return mapping;
  })().finally(() => {
    claiming = null;
  });
  return claiming;
}