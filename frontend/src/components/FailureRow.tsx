import { useState } from 'react';
import type { FailureRecord } from '../types';
import Button, { CopyButton } from './Button';
import { ChevronDownIcon, ChevronRightIcon, DownloadIcon } from './Icons';
import { SeverityBadge, severityTone } from './StatusBadge';
import { errMsg, useAsync } from '../lib/hooks';
import { fetchEvidence, fetchScript } from '../lib/client';
import { formatDateTime, formatTime, shortId } from '../lib/format';

function guessExt(script: string): string {
  if (/\bdef \w+|sync_playwright|async_playwright|^from \w+ import/m.test(script)) return 'py';
  if (/require\(|\bconst \w+|page\.goto\(|^import .* from /m.test(script)) return 'js';
  return 'txt';
}

function FailureDetails({ failure }: { failure: FailureRecord }) {
  const evidence = useAsync(() => fetchEvidence(failure.id), [failure.id]);
  const [script, setScript] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      setScript(await fetchScript(failure.id));
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  function download() {
    if (script === null) return;
    const blob = new Blob([script], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `repro-${shortId(failure.id)}.${guessExt(script)}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="ct-failure-body">
      <div className="ct-section-label">Stack trace</div>
      {failure.stack_trace ? (
        <pre className="ct-pre">{failure.stack_trace}</pre>
      ) : (
        <div className="ct-faint ct-small">No stack trace recorded.</div>
      )}

      <div className="ct-section-label">Details</div>
      <div className="ct-kv">
        <span className="ct-faint">Failure ID</span>
        <span className="ct-mono ct-wrap">{failure.id}</span>
        <span className="ct-faint">Occurred</span>
        <span>{formatDateTime(failure.created_at)}</span>
      </div>

      <div className="ct-section-label">Evidence</div>
      {evidence.loading && !evidence.data ? (
        <div className="ct-skel" style={{ width: 180 }} />
      ) : evidence.error ? (
        <div className="ct-field-error">
          Could not load evidence: {evidence.error}{' '}
          <button type="button" className="ct-linkbtn" onClick={() => evidence.reload()}>
            Retry
          </button>
        </div>
      ) : evidence.data && evidence.data.length > 0 ? (
        <ul className="ct-evidence">
          {evidence.data.map((ev) => (
            <li key={ev.id}>
              <span className="ct-faint">{ev.evidence_type}</span>
              <span className="ct-mono ct-wrap">{ev.file_path}</span>
              <CopyButton text={ev.file_path} label="Copy path" />
            </li>
          ))}
        </ul>
      ) : (
        <div className="ct-faint ct-small">No evidence attached to this failure.</div>
      )}

      <div className="ct-actions-row">
        <Button variant="primary" onClick={generate} loading={busy}>
          Generate reproduction script
        </Button>
        {script !== null ? (
          <>
            <Button onClick={download} icon={<DownloadIcon />}>
              Download
            </Button>
            <CopyButton text={script} label="Copy script" />
          </>
        ) : null}
      </div>
      {error ? <div className="ct-field-error">{error}</div> : null}
      {script !== null ? (
        <div style={{ marginTop: 12 }}>
          <pre className="ct-pre">{script}</pre>
        </div>
      ) : null}
    </div>
  );
}

export default function FailureRow({ failure, pageUrl }: { failure: FailureRecord; pageUrl?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ct-failure" data-tone={severityTone(failure.severity)}>
      <button
        type="button"
        className="ct-failure-head"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <SeverityBadge severity={failure.severity} />
        <div style={{ minWidth: 0 }}>
          <div className="ct-mono ct-faint ct-wrap">{failure.failure_type}</div>
          <div className={`ct-failure-msg${open ? '' : ' ct-clamp'}`}>{failure.message}</div>
          <div className="ct-failure-meta">
            {pageUrl ? <span className="ct-mono ct-wrap">{pageUrl}</span> : null}
            <span title={formatDateTime(failure.created_at)}>{formatTime(failure.created_at)}</span>
          </div>
        </div>
        {open ? <ChevronDownIcon /> : <ChevronRightIcon />}
      </button>
      {open ? <FailureDetails failure={failure} /> : null}
    </div>
  );
}