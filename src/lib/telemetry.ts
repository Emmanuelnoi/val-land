type ClientTelemetryEvent =
  | 'challenge_failed_client'
  | 'challenge_fetch_failed_client'
  | 'image_load_error_client'
  | 'csp_violation_client';

type TelemetryPayload = {
  page?: string;
  endpoint?: string;
  status?: number;
  directive?: string;
  blockedHost?: string;
  sourceHost?: string;
  reason?: string;
};

const eventCounts = new Map<ClientTelemetryEvent, number>();
const MAX_EVENTS_PER_TYPE = 20;
let listenersInstalled = false;

function toHost(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  if (value === 'inline' || value === 'eval') return value;
  try {
    const parsed = new URL(value, window.location.origin);
    return parsed.host;
  } catch (error) {
    return undefined;
  }
}

function canEmit(event: ClientTelemetryEvent): boolean {
  const current = eventCounts.get(event) ?? 0;
  if (current >= MAX_EVENTS_PER_TYPE) return false;
  eventCounts.set(event, current + 1);
  return true;
}

export function trackClientEvent(event: ClientTelemetryEvent, payload: TelemetryPayload = {}) {
  if (typeof window === 'undefined') return;
  if (!canEmit(event)) return;

  const body = JSON.stringify({
    event,
    page: payload.page ?? window.location.pathname,
    endpoint: payload.endpoint,
    status: payload.status,
    directive: payload.directive,
    blockedHost: payload.blockedHost,
    sourceHost: payload.sourceHost,
    reason: payload.reason
  });

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon('/api/telemetry', blob);
      return;
    }
  } catch (error) {
    // Fall through to fetch.
  }

  fetch('/api/telemetry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true
  }).catch(() => undefined);
}

export function installClientDiagnostics() {
  if (typeof window === 'undefined' || listenersInstalled) return;
  listenersInstalled = true;

  window.addEventListener('securitypolicyviolation', (event) => {
    trackClientEvent('csp_violation_client', {
      directive: event.effectiveDirective || event.violatedDirective || undefined,
      blockedHost: toHost(event.blockedURI),
      sourceHost: toHost(event.sourceFile)
    });
  });

  window.addEventListener(
    'error',
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLImageElement)) return;
      trackClientEvent('image_load_error_client', {
        blockedHost: toHost(target.currentSrc || target.src),
        reason: 'resource_error'
      });
    },
    true
  );
}
