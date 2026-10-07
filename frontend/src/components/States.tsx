import type { ReactNode } from 'react';
import Button from './Button';
import { AlertIcon } from './Icons';

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="ct-empty">
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {action}
    </div>
  );
}

export function ErrorState({
  what,
  message,
  onRetry,
}: {
  what: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="ct-banner ct-banner-bad" role="alert">
      <AlertIcon />
      <div className="ct-banner-body">
        <strong>Could not load {what}</strong>
        <div className="ct-mono ct-wrap ct-muted">{message}</div>
      </div>
      {onRetry ? (
        <Button size="sm" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}

export function Banner({
  tone,
  icon,
  children,
}: {
  tone: 'bad' | 'warn' | 'info';
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={`ct-banner ct-banner-${tone}`} role={tone === 'bad' ? 'alert' : 'status'}>
      {icon ?? <AlertIcon />}
      <div className="ct-banner-body">{children}</div>
    </div>
  );
}

export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div className="ct-skel-row" key={i}>
          <span className="ct-skel" style={{ width: '22%' }} />
          <span className="ct-skel" style={{ width: '36%' }} />
          <span className="ct-skel" style={{ width: '12%' }} />
        </div>
      ))}
    </div>
  );
}

export function ShowMore({
  shown,
  total,
  onMore,
}: {
  shown: number;
  total: number;
  onMore: () => void;
}) {
  if (shown >= total) return null;
  return (
    <div className="ct-showmore">
      <span>
        Showing {shown} of {total}
      </span>
      <Button size="sm" onClick={onMore}>
        Show all
      </Button>
    </div>
  );
}