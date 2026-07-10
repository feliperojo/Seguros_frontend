import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchValidateRealtime, summarizeRealtimeChecks } from '../services/ringCentralRealtimeDiagnostics';

function getUiLevel({ status, checks }) {
  const s = (status || '').toLowerCase();
  const summary = summarizeRealtimeChecks(checks);
  if (summary.hasError || s === 'error') return 'error';
  if (summary.hasWarn) return 'warn';
  return 'ok';
}

export default function useRingCentralRealtimeDiagnostics({ minutes = 60, enabled = true, autoRefreshMs = 0 } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  const refresh = useCallback(async ({ force = false } = {}) => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchValidateRealtime({ minutes, force });
      setData(res);
      setLastUpdatedAt(new Date());
    } catch (e) {
      setError(e?.message || 'No se pudo validar el estado de tiempo real');
    } finally {
      setLoading(false);
    }
  }, [enabled, minutes]);

  useEffect(() => {
    refresh({ force: false });
  }, [refresh]);

  useEffect(() => {
    if (!enabled || !autoRefreshMs || autoRefreshMs <= 0) return;
    const id = setInterval(() => refresh({ force: true }), autoRefreshMs);
    return () => clearInterval(id);
  }, [enabled, autoRefreshMs, refresh]);

  const ui = useMemo(() => {
    const status = data?.status;
    const checks = data?.checks || [];
    const level = getUiLevel({ status, checks });
    const summary = summarizeRealtimeChecks(checks);
    return {
      level, // ok | warn | error
      hasError: summary.hasError,
      hasWarn: summary.hasWarn,
      messages: summary.messages,
    };
  }, [data]);

  return { data, ui, loading, error, lastUpdatedAt, refresh };
}

