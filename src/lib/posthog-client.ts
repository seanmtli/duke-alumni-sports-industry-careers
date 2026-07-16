import posthog from 'posthog-js';

/** Headers that let server routes attribute events to the same person/session. */
export function posthogIdentityHeaders(): Record<string, string> {
  if (typeof window === 'undefined' || !posthog?.get_distinct_id) return {};

  const headers: Record<string, string> = {
    'X-POSTHOG-DISTINCT-ID': posthog.get_distinct_id(),
  };
  const sessionId = posthog.get_session_id?.();
  if (sessionId) headers['X-POSTHOG-SESSION-ID'] = sessionId;
  return headers;
}

export function captureClientEvent(
  event: string,
  properties?: Record<string, string | number | boolean | null | undefined>,
) {
  if (typeof window === 'undefined') return;
  try {
    posthog.capture(event, properties);
  } catch {
    // Analytics must never break the product UI.
  }
}
