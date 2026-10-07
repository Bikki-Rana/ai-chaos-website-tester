import type { ReactNode } from 'react';

interface MetricProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  bad?: boolean;
}

export default function Metric({ label, value, hint, bad = false }: MetricProps) {
  return (
    <div className="ct-metric">
      <div className="ct-metric-label">{label}</div>
      <div className={`ct-metric-value${bad ? ' is-bad' : ''}`}>{value}</div>
      {hint ? <div className="ct-metric-hint">{hint}</div> : null}
    </div>
  );
}