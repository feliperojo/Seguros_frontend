const EVENT_NAME = 'rc_realtime_status';

export function emitRealtimeStatus(detail) {
  try {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail }));
  } catch (_) {
    // no-op
  }
}

export function onRealtimeStatus(handler) {
  const wrapped = (e) => handler?.(e?.detail);
  window.addEventListener(EVENT_NAME, wrapped);
  return () => window.removeEventListener(EVENT_NAME, wrapped);
}

