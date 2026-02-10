export type ClientStats = {
  sessionId: string;
  startedAt: string;
  yesClicks: number;
  noClicks: number;
  giftSelections: number;
  shares: number;
  completions: number;
};

export type StatKey = Exclude<keyof ClientStats, 'sessionId' | 'startedAt'>;

const STATS_KEY = 'valentineClientStats';

function getBrowserStorage() {
  if (typeof window === 'undefined') return null;
  return window.localStorage ?? null;
}

function createSessionId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `session_${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}

function createStats(): ClientStats {
  return {
    sessionId: createSessionId(),
    startedAt: new Date().toISOString(),
    yesClicks: 0,
    noClicks: 0,
    giftSelections: 0,
    shares: 0,
    completions: 0
  };
}

function sanitizeNumber(value: unknown) {
  const num = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return Math.max(0, Math.min(num, 999));
}

function normalizeStats(candidate: Partial<ClientStats>): ClientStats {
  return {
    sessionId: typeof candidate.sessionId === 'string' ? candidate.sessionId : createSessionId(),
    startedAt: typeof candidate.startedAt === 'string' ? candidate.startedAt : new Date().toISOString(),
    yesClicks: sanitizeNumber(candidate.yesClicks),
    noClicks: sanitizeNumber(candidate.noClicks),
    giftSelections: sanitizeNumber(candidate.giftSelections),
    shares: sanitizeNumber(candidate.shares),
    completions: sanitizeNumber(candidate.completions)
  };
}

export function readClientStats(): ClientStats {
  const storage = getBrowserStorage();
  if (!storage) return createStats();
  try {
    const raw = storage.getItem(STATS_KEY);
    if (!raw) return createStats();
    const parsed = JSON.parse(raw) as Partial<ClientStats>;
    return normalizeStats(parsed);
  } catch (error) {
    return createStats();
  }
}

export function writeClientStats(stats: ClientStats) {
  const storage = getBrowserStorage();
  if (!storage) return;
  try {
    storage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch (error) {
    // Ignore storage errors.
  }
}

export function incrementStat(key: StatKey, amount = 1) {
  const stats = readClientStats();
  stats[key] = sanitizeNumber(stats[key] + amount);
  writeClientStats(stats);
  return stats;
}
