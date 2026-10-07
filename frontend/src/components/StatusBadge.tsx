import { statusLabel } from '../lib/format';

export type Tone = 'ok' | 'bad' | 'warn' | 'info' | 'neutral';

export function toneOf(status: string): Tone {
  switch (status.toUpperCase()) {
    case 'RUNNING':
      return 'info';
    case 'COMPLETED':
    case 'SUCCESS':
    case 'SUCCEEDED':
    case 'OK':
    case 'PASSED':
    case 'DONE':
      return 'ok';
    case 'FAILED':
    case 'FAILURE':
    case 'ERROR':
      return 'bad';
    case 'STOPPED':
    case 'SKIPPED':
    case 'WARNING':
      return 'warn';
    default:
      return 'neutral';
  }
}

export function severityTone(severity: string): Tone {
  const s = severity.toLowerCase();
  if (['critical', 'fatal', 'high', 'error'].includes(s)) return 'bad';
  if (['medium', 'warning', 'warn'].includes(s)) return 'warn';
  return 'neutral';
}

export default function StatusBadge({ status }: { status: string }) {
  const live = status.toUpperCase() === 'RUNNING';
  return (
    <span className={`ct-badge ct-tone-${toneOf(status)}`}>
      <span className={`ct-dot${live ? ' ct-dot-live' : ''}`} />
      {statusLabel(status)}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: string }) {
  return <span className={`ct-sev ct-tone-${severityTone(severity)}`}>{severity}</span>;
}