import { useCallback, useEffect, useState } from 'react';
import type { Project } from '../types';
import { listProjects } from './client';
import { onProjectsChanged } from './events';

type Status = 'idle' | 'loading' | 'ready' | 'error';

/** Loads the signed-in user's projects. Does nothing (no API calls) while `enabled` is false. */
export function useProjectList(enabled: boolean): { projects: Project[]; status: Status } {
  const [projects, setProjects] = useState<Project[]>([]);
  const [status, setStatus] = useState<Status>('idle');

  const load = useCallback(() => {
    listProjects().then(
      (list) => {
        setProjects(list);
        setStatus('ready');
      },
      () => setStatus('error'),
    );
  }, []);

  useEffect(() => {
    if (!enabled) {
      setProjects([]);
      setStatus('idle');
      return;
    }
    setStatus('loading');
    load();
    const timer = window.setInterval(load, 60000);
    const off = onProjectsChanged(load);
    return () => {
      window.clearInterval(timer);
      off();
    };
  }, [enabled, load]);

  return { projects, status };
}