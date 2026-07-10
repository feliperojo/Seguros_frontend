import apiRequest from './api';

const CACHE_KEY = 'rc_validate_realtime_cache_v1';

function nowMs() {
  return Date.now();
}

function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch (_) {
    return null;
  }
}

function writeCache(value) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(value));
  } catch (_) {}
}

export function summarizeRealtimeChecks(checks = []) {
  const arr = Array.isArray(checks) ? checks : [];
  const hasError = arr.some((c) => (c?.level || '').toLowerCase() === 'error');
  const hasWarn = arr.some((c) => (c?.level || '').toLowerCase() === 'warn');
  const messages = arr
    .filter((c) => ['warn', 'error'].includes((c?.level || '').toLowerCase()))
    .map((c) => String(c?.message || '').trim())
    .filter(Boolean);

  return { hasError, hasWarn, messages };
}

export async function fetchValidateRealtime({ minutes = 60, cacheTtlMs = 30_000, force = false } = {}) {
  const cache = readCache();
  if (!force && cache && cache.minutes === minutes && (nowMs() - cache.atMs) < cacheTtlMs) {
    return cache.value;
  }

  const value = await apiRequest(`integrations/ringcentral/validate-realtime?minutes=${encodeURIComponent(minutes)}`, 'GET');
  writeCache({ atMs: nowMs(), minutes, value });
  return value;
}

