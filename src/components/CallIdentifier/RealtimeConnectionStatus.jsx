import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Spinner } from 'react-bootstrap';
import useRingCentralRealtimeDiagnostics from '../../hooks/useRingCentralRealtimeDiagnostics';
import { onRealtimeStatus } from '../../utils/realtimeStatusBus';

function levelToVariant(level) {
  if (level === 'error') return 'danger';
  if (level === 'warn') return 'warning';
  return 'success';
}

function levelToLabel(level) {
  if (level === 'error') return 'Error';
  if (level === 'warn') return 'Advertencias';
  return 'OK';
}

export default function RealtimeConnectionStatus({
  minutes = 60,
  showTitle = true,
  disconnectedWarningAfterSeconds = 15,
}) {
  const { data, ui, loading, error, lastUpdatedAt, refresh } = useRingCentralRealtimeDiagnostics({ minutes, enabled: true });

  const [wsState, setWsState] = useState('unknown'); // unknown | connecting | connected | disconnected
  const [wsDisconnectedSinceMs, setWsDisconnectedSinceMs] = useState(null);

  useEffect(() => {
    return onRealtimeStatus((detail) => {
      if (!detail || detail.source !== 'echo') return;
      if (detail.state) setWsState(detail.state);
      if (detail.state === 'connected') {
        setWsDisconnectedSinceMs(null);
      }
      if (detail.state === 'disconnected') {
        setWsDisconnectedSinceMs((prev) => prev ?? Date.now());
      }
      if (detail.state === 'connecting') {
        // mantenemos el "since" por si venimos de disconnected; no hace falta tocarlo
      }
    });
  }, []);

  const disconnectedTooLong = useMemo(() => {
    if (wsState !== 'disconnected') return false;
    if (!wsDisconnectedSinceMs) return false;
    const seconds = (Date.now() - wsDisconnectedSinceMs) / 1000;
    return seconds >= disconnectedWarningAfterSeconds;
  }, [wsState, wsDisconnectedSinceMs, disconnectedWarningAfterSeconds]);

  const wsBadge = useMemo(() => {
    if (wsState === 'connected') return { variant: 'success', text: 'WebSocket conectado' };
    if (wsState === 'connecting') return { variant: 'warning', text: 'WebSocket conectando…' };
    if (wsState === 'disconnected') return { variant: 'secondary', text: 'WebSocket desconectado' };
    return { variant: 'secondary', text: 'WebSocket sin estado' };
  }, [wsState]);

  const diagVariant = levelToVariant(ui.level);

  return (
    <Card>
      {showTitle && (
        <Card.Header className="d-flex justify-content-between align-items-center">
          <strong>Estado de conexión (tiempo real)</strong>
          <div className="d-flex align-items-center gap-2">
            <Badge bg={wsBadge.variant}>{wsBadge.text}</Badge>
            <Button
              size="sm"
              variant="outline-primary"
              onClick={() => refresh({ force: true })}
              disabled={loading}
              title="Volver a validar"
            >
              {loading ? <Spinner size="sm" /> : <i className="bi bi-arrow-clockwise" />}
            </Button>
          </div>
        </Card.Header>
      )}

      <Card.Body>
        {error ? (
          <Alert variant="danger" className="mb-3">
            {error}
          </Alert>
        ) : (
          <Alert variant={diagVariant} className="mb-3">
            <div className="d-flex align-items-center justify-content-between">
              <div className="d-flex align-items-center gap-2">
                <strong>{levelToLabel(ui.level)}</strong>
                <span className="text-muted" style={{ fontSize: 12 }}>
                  {data?.status ? `status=${data.status}` : 'status desconocido'}
                </span>
              </div>
              {lastUpdatedAt && (
                <span className="text-muted" style={{ fontSize: 12 }}>
                  {lastUpdatedAt.toLocaleString()}
                </span>
              )}
            </div>

            {ui.messages?.length > 0 && (
              <ul className="mb-0 mt-2">
                {ui.messages.map((m, idx) => (
                  <li key={idx}>{m}</li>
                ))}
              </ul>
            )}
          </Alert>
        )}

        {disconnectedTooLong && (
          <Alert variant="warning" className="mb-0">
            Tiempo real no disponible (WebSocket desconectado).
          </Alert>
        )}
      </Card.Body>
    </Card>
  );
}

