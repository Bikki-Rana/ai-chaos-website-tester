import type { TestRun } from '../types';

const HAS_TZ = /(Z|[+-]\d{2}:?\d{2})$/i;

/** Parses an API timestamp. Timestamps without a timezone are treated as UTC. */
export function parseTs(iso?: string): number {
  if (!iso) return NaN;
  const s = HAS_TZ.test(iso) || !iso.includes('T') ? iso : `${iso}Z`;
  return Date.parse(s);
}

export function formatDateTime(iso?: string): string {
  const t = parseTs(iso);
  if (Number.isNaN(t)) return '\u2014';
  return new Date(t).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(iso?: string): string {
  const t = parseTs(iso);
  if (Number.isNaN(t)) return '\u2014';
  return new Date(t).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatTime(iso?: string): string {
  const t = parseTs(iso);
  if (Number.isNaN(t)) return '\u2014';
  return new Date(t).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function formatRelative(iso?: string, now: number = Date.now()): string {
  const t = parseTs(iso);
  if (Number.isNaN(t)) return '\u2014';
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return formatDate(iso);
}

export function formatDuration(ms?: number): string {
  if (ms === undefined || ms === null || Number.isNaN(ms)) return '\u2014';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)} s`;
  const totalSec = Math.floor(s);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const sec = totalSec % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}m ${String(sec).padStart(2, '0')}s`;
}

export function runDurationMs(run: TestRun, now: number = Date.now()): number | undefined {
  const start = parseTs(run.started_at);
  if (run.status === 'RUNNING' && !Number.isNaN(start)) return Math.max(0, now - start);
  if (typeof run.duration_ms === 'number') return run.duration_ms;
  if (Number.isNaN(start) || !run.finished_at) return undefined;
  const end = parseTs(run.finished_at);
  return Number.isNaN(end) ? undefined : Math.max(0, end - start);
}

export function shortId(id: string): string {
  return id.slice(0, 8);
}

export function statusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

export function newestFirst(runs: TestRun[]): TestRun[] {
  return [...runs].sort((a, b) => parseTs(b.created_at) - parseTs(a.created_at));
}

export function resultText(run: TestRun): string {
  switch (run.status) {
    case 'FAILED':
      return run.error_message ?? 'Run failed';
    case 'RUNNING':
      return 'In progress';
    case 'PENDING':
      return 'Queued';
    case 'STOPPED':
      return run.finished_at ? `Stopped ${formatRelative(run.finished_at)}` : 'Stopped';
    case 'COMPLETED':
      return run.finished_at ? `Finished ${formatRelative(run.finished_at)}` : 'Finished';
    default:
      return '\u2014';
  }
}

export function pathOf(url: string): string {
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}` || '/';
  } catch {
    return url;
  }
}