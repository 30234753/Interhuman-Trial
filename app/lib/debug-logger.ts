/**
 * Debug Logger Utility
 * Conditionally sends debug logs to a local server if enabled
 * Set ENABLE_DEBUG_LOGGING=true in your environment to enable
 */

const DEBUG_ENABLED = typeof window !== 'undefined' && 
  (window.localStorage?.getItem('ENABLE_DEBUG_LOGGING') === 'true' ||
   process.env.NEXT_PUBLIC_ENABLE_DEBUG_LOGGING === 'true');

const DEBUG_SERVER_URL = 'http://127.0.0.1:7242/ingest/994d5ac0-53a3-4149-9884-4dd3278366f7';

/**
 * Sends a debug log to the local server if debug logging is enabled
 * Silently fails if the server is not available
 */
export function debugLog(data: {
  location: string;
  message: string;
  data?: any;
  timestamp?: number;
  sessionId?: string;
  runId?: string;
  hypothesisId?: string;
}): void {
  // Only send if debug logging is explicitly enabled
  if (!DEBUG_ENABLED) {
    return;
  }

  // Use AbortController with a short timeout to prevent hanging
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 100);

  fetch(DEBUG_SERVER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...data,
      timestamp: data.timestamp || Date.now(),
    }),
    signal: controller.signal,
  })
    .catch(() => {
      // Silently ignore errors - server may not be running
    })
    .finally(() => {
      clearTimeout(timeoutId);
    });
}

