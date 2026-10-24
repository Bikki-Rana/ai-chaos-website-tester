const KEY = 'ct.settings';

export interface AppSettings {
  maxPages: number;
  maxDepth: number;
  reduceEffects: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = { maxPages: 10, maxDepth: 2, reduceEffects: false };

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? Math.round(value) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const o = JSON.parse(raw) as Record<string, unknown>;
    return {
      maxPages: clamp(o.maxPages, 1, 50, DEFAULT_SETTINGS.maxPages),
      maxDepth: clamp(o.maxDepth, 1, 10, DEFAULT_SETTINGS.maxDepth),
      reduceEffects: o.reduceEffects === true,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* storage unavailable */
  }
}