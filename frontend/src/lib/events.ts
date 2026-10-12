const EVENT = 'ct:projects-changed';

export function notifyProjectsChanged(): void {
  window.dispatchEvent(new Event(EVENT));
}

export function onProjectsChanged(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}