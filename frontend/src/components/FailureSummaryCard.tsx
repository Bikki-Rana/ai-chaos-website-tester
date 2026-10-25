import type { FailureCategory, FailureSummary } from '../types';
import { SeverityBadge } from './StatusBadge';
import { formatDateTime } from '../lib/format';

const CATEGORY_LABELS: Record<FailureCategory | string, string> = {
  UNCAUGHT_JS_EXCEPTION: 'Uncaught JS Exception',
  SERVER_5XX:            'Server Error (5xx)',
  DEAD_ASSET_OR_LINK:    'Dead Asset / Broken Link',
  AUTH_OR_SECURITY:      'Auth / Security Error',
  NAVIGATION_TIMEOUT:    'Navigation Timeout',
  RESOURCE_FAILURE:      'Resource Load Failure',
  UNKNOWN:               'Unknown',
};

const CATEGORY_COLORS: Record<FailureCategory | string, string> = {
  UNCAUGHT_JS_EXCEPTION: '#f59e0b',
  SERVER_5XX:            '#ef4444',
  DEAD_ASSET_OR_LINK:    '#8b5cf6',
  AUTH_OR_SECURITY:      '#ec4899',
  NAVIGATION_TIMEOUT:    '#6366f1',
  RESOURCE_FAILURE:      '#14b8a6',
  UNKNOWN:               '#6b7280',
};

export default function FailureSummaryCard({ failure }: { failure: FailureSummary }) {
  const color = CATEGORY_COLORS[failure.category] ?? '#6b7280';
  const label = CATEGORY_LABELS[failure.category] ?? failure.category;

  return (
    <div
      className="ct-failure"
      style={{ borderLeftColor: color, borderLeftWidth: 4, borderLeftStyle: 'solid' }}
    >
      {/* Header row */}
      <div className="ct-failure-head" style={{ cursor: 'default' }}>
        <SeverityBadge severity={failure.severity} />
        <div style={{ minWidth: 0, flex: 1 }}>
          {/* Category pill + type */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <span
              className="ct-mono"
              style={{
                fontSize: 10,
                padding: '2px 8px',
                borderRadius: 999,
                background: `${color}22`,
                color,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              {label}
            </span>
            <span className="ct-mono ct-faint" style={{ fontSize: 12 }}>
              {failure.failure_type}
            </span>
          </div>

          {/* Message */}
          <div className="ct-failure-msg ct-clamp">{failure.message}</div>

          {/* Root cause hint */}
          {failure.root_cause_hint && (
            <div
              style={{
                marginTop: 6,
                fontSize: 12,
                color: 'var(--muted, #888)',
                lineHeight: 1.5,
              }}
            >
              💡 {failure.root_cause_hint}
            </div>
          )}

          {/* Meta row */}
          <div className="ct-failure-meta" style={{ marginTop: 6 }}>
            <span
              style={{
                background: 'var(--surface2, #f3f4f6)',
                borderRadius: 4,
                padding: '2px 8px',
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              ×{failure.occurrence_count} occurrence{failure.occurrence_count !== 1 ? 's' : ''}
            </span>
            <span className="ct-faint" style={{ fontSize: 11 }}>
              First: {formatDateTime(failure.first_seen)}
            </span>
            {failure.first_seen !== failure.last_seen && (
              <span className="ct-faint" style={{ fontSize: 11 }}>
                Last: {formatDateTime(failure.last_seen)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}