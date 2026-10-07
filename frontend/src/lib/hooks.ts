import { useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';

export function errMsg(e: unknown): string {
  if (typeof e === 'string') return e;
  if (typeof e === 'object' && e !== null) {
    const resp = (e as { response?: { data?: { detail?: unknown; message?: unknown } } }).response;
    const d = resp?.data?.detail ?? resp?.data?.message;
    if (typeof d === 'string') return d;
    if (Array.isArray(d)) {
      return d
        .map((x: unknown) =>
          typeof x === 'object' && x !== null && 'msg' in x ? String((x as { msg: unknown }).msg) : String(x),
        )
        .join('; ');
    }
    if (e instanceof Error && e.message) return e.message;
  }
  return 'Request failed';
}

export interface AsyncState<T> {
  data: T | undefined;
  error: string | null;
  loading: boolean;
  /** silent = refresh in the background without loading/error state changes */
  reload: (silent?: boolean) => void;
}

export function useAsync<T>(fn: () => Promise<T>, deps: readonly unknown[]): AsyncState<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const seq = useRef(0);

  const reload = useCallback((silent = false) => {
    const id = ++seq.current;
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    fnRef.current().then(
      (d) => {
        if (id !== seq.current) return;
        setData(d);
        setError(null);
        setLoading(false);
      },
      (e: unknown) => {
        if (id !== seq.current) return;
        if (!silent) setError(errMsg(e));
        setLoading(false);
      },
    );
  }, []);

  useEffect(() => {
    setData(undefined);
    reload();
    return () => {
      seq.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload, ...deps]);

  return { data, error, loading, reload };
}

export function useNow(active: boolean, intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(t);
  }, [active, intervalMs]);
  return now;
}

/** Row click handler that ignores clicks on inner links/buttons and text selection. */
export function useRowClick() {
  const navigate = useNavigate();
  return useCallback(
    (e: MouseEvent<HTMLElement>, to: string) => {
      if ((e.target as HTMLElement).closest('a,button')) return;
      if (window.getSelection()?.toString()) return;
      navigate(to);
    },
    [navigate],
  );
}