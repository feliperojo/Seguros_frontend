import { useEffect, useState, useMemo } from "react";
import { Spinner } from "react-bootstrap";
import apiRequest from "../../services/api";

const SEGMENT_COLORS = [
  "#0d6efd",
  "#198754",
  "#fd7e14",
  "#6f42c1",
  "#dc3545",
  "#20c997",
];

const formatTramoDuration = (tramo) => {
  const seconds = Number(tramo?.duration_seconds);
  if (!Number.isFinite(seconds) || seconds < 0) {
    if (tramo?.activo) return "En curso";
    return "—";
  }
  if (seconds === 0) return tramo?.activo ? "En curso" : "—";

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);
  return parts.join(" ");
};

const extractTramosList = (payload) => {
  const raw = payload?.tramos;
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.data)) return raw.data;
  return [];
};

const normalizeHistorialPayload = (res) => {
  const root = res?.data ?? res;
  const payload = root?.tramos != null || root?.total_tramos != null ? root : root?.data;
  if (!payload) return null;
  return {
    ...payload,
    tramos: extractTramosList(payload),
  };
};

const TramoPin = ({ nombre, color, activo, sequence }) => (
  <div className="tramo-pin-cell" style={{ borderTopColor: color }}>
    <div className={activo ? "tramo-pin-marker is-active" : "tramo-pin-marker"}>
      <i className="fas fa-map-marker-alt" aria-hidden style={{ color }} />
    </div>
    <div className="tramo-pin-meta">
      <span className="tramo-pin-nombre" title={nombre}>
        {nombre}
      </span>
      {sequence ? (
        <span className="tramo-pin-seq text-muted">Tramo {sequence}</span>
      ) : null}
      {activo ? (
        <span className="tramo-pin-badge" style={{ background: `${color}18`, color }}>
          Activo
        </span>
      ) : null}
    </div>
  </div>
);

const TramosAsignacionBar = ({ tareaId, refreshKey = 0, className = "" }) => {
  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState(null);

  useEffect(() => {
    if (!tareaId) {
      setPayload(null);
      return undefined;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const res = await apiRequest(
          `tareas_operativas/${tareaId}/historial-asignaciones`,
          "GET"
        );
        if (!cancelled) setPayload(normalizeHistorialPayload(res));
      } catch {
        if (!cancelled) setPayload(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [tareaId, refreshKey]);

  const segments = useMemo(() => {
    const tramos = extractTramosList(payload);
    if (!tramos.length) return [];

    const totalSeconds = Math.max(
      1,
      Number(payload?.total_duration_seconds) ||
        tramos.reduce((sum, t) => sum + (Number(t?.duration_seconds) || 0), 0) ||
        1
    );

    return tramos.map((tramo, index) => {
      const seconds = Number(tramo?.duration_seconds) || 0;
      const activo = Boolean(tramo?.activo);
      const sharePctRaw = (seconds / totalSeconds) * 100;
      const sharePctRounded = Math.round(sharePctRaw);
      const sharePctLabel =
        sharePctRaw > 0 && sharePctRounded === 0 ? "<1" : String(sharePctRounded);
      const sharePct = sharePctRounded;
      const barFlex = Math.max(
        activo && seconds === 0 ? 6 : seconds > 0 ? 4 : 2,
        sharePctRounded || (activo ? 6 : 2)
      );

      return {
        ...tramo,
        color: SEGMENT_COLORS[index % SEGMENT_COLORS.length],
        sharePct,
        sharePctLabel,
        barFlex,
        label: formatTramoDuration(tramo),
        nombre: tramo?.usuario_nombre || `Usuario #${tramo?.usuario_id}`,
      };
    });
  }, [payload]);

  const totalLabel = useMemo(() => {
    const sec = Number(payload?.total_duration_seconds);
    if (!Number.isFinite(sec) || sec <= 0) return null;
    return formatTramoDuration({ duration_seconds: sec, activo: false });
  }, [payload]);

  const columnMinWidth = segments.length <= 3 ? 96 : 84;

  if (!tareaId) return null;

  if (loading) {
    return (
      <div className={`tramos-asignacion-timeline ${className}`.trim()}>
        <div className="d-flex align-items-center gap-2 text-muted" style={{ fontSize: "0.72rem" }}>
          <Spinner animation="border" size="sm" />
          <span>Cargando tramos…</span>
        </div>
      </div>
    );
  }

  if (segments.length === 0) return null;

  return (
    <div className={`tramos-asignacion-timeline ${className}`.trim()}>
      <style>{`
        .tramos-asignacion-timeline {
          width: 100%;
          padding: 0;
        }
        .tramos-asignacion-timeline .tramos-timeline-head {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 0.5rem;
          margin-bottom: 0.4rem;
        }
        .tramos-asignacion-timeline .tramos-timeline-label {
          font-size: 0.65rem;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin: 0;
        }
        .tramos-asignacion-timeline .tramos-total-time {
          font-size: 0.68rem;
          color: #94a3b8;
        }
        .tramos-asignacion-timeline .tramos-pins-scroll {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          margin-bottom: 0.45rem;
        }
        .tramos-asignacion-timeline .tramos-pins-grid {
          display: grid;
          gap: 0.35rem 0.45rem;
          min-width: min(100%, ${segments.length * columnMinWidth}px);
        }
        .tramos-asignacion-timeline .tramo-pin-cell {
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: 0.35rem;
          min-width: 0;
          padding: 0.25rem 0.4rem 0.3rem;
          background: #fff;
          border: 1px solid #e2e8f0;
          border-top: 3px solid;
          border-radius: 6px;
        }
        .tramos-asignacion-timeline .tramo-pin-marker i {
          font-size: 17px;
        }
        .tramos-asignacion-timeline .tramo-pin-nombre {
          display: block;
          font-size: 0.72rem;
          font-weight: 600;
          color: #1e293b;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .tramos-asignacion-timeline .tramo-pin-seq {
          font-size: 0.62rem;
        }
        .tramos-asignacion-timeline .tramo-pin-badge {
          font-size: 0.58rem;
          font-weight: 600;
          padding: 0 0.25rem;
          border-radius: 3px;
        }
        .tramos-asignacion-timeline .tramos-visual-bar-wrap {
          margin-top: 0.1rem;
        }
        .tramos-asignacion-timeline .tramos-visual-bar {
          display: flex;
          height: 12px;
          border-radius: 6px;
          overflow: hidden;
          background: #e2e8f0;
          box-shadow: inset 0 1px 2px rgba(0,0,0,0.06);
        }
        .tramos-asignacion-timeline .tramos-visual-chunk {
          min-width: 4px;
          transition: flex 0.3s ease;
          position: relative;
        }
        .tramos-asignacion-timeline .tramos-visual-chunk + .tramos-visual-chunk {
          box-shadow: -1px 0 0 rgba(255,255,255,0.5);
        }
        .tramos-asignacion-timeline .tramos-bar-legend {
          display: flex;
          width: 100%;
          margin-top: 0.35rem;
          gap: 0;
        }
        .tramos-asignacion-timeline .tramos-bar-legend-item {
          min-width: 0;
          padding: 0 0.15rem;
          text-align: center;
          border-right: 1px solid #f1f5f9;
        }
        .tramos-asignacion-timeline .tramos-bar-legend-item:last-child {
          border-right: none;
        }
        .tramos-asignacion-timeline .legend-pct {
          display: block;
          font-size: 0.72rem;
          font-weight: 700;
          line-height: 1.2;
        }
        .tramos-asignacion-timeline .legend-time {
          display: block;
          font-size: 0.65rem;
          color: #64748b;
          line-height: 1.2;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .tramos-asignacion-timeline .legend-name {
          display: block;
          font-size: 0.6rem;
          color: #94a3b8;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      `}</style>

      <div className="tramos-timeline-head">
        <p className="tramos-timeline-label mb-0">
          Participación · {segments.length} tramo{segments.length !== 1 ? "s" : ""}
          <span className="text-muted fw-normal ms-1" style={{ textTransform: "none", letterSpacing: 0 }}>
            (horario laboral)
          </span>
        </p>
        {totalLabel && totalLabel !== "—" ? (
          <span className="tramos-total-time">Total: {totalLabel}</span>
        ) : null}
      </div>

      {/* Tarjetas por usuario */}
      <div className="tramos-pins-scroll">
        <div
          className="tramos-pins-grid"
          role="list"
          style={{
            gridTemplateColumns: `repeat(${segments.length}, minmax(${columnMinWidth}px, 1fr))`,
          }}
        >
          {segments.map((seg) => (
            <div
              key={seg.id ?? `${seg.usuario_id}-${seg.sequence}`}
              role="listitem"
            >
              <TramoPin
                nombre={seg.nombre}
                color={seg.color}
                activo={seg.activo}
                sequence={seg.sequence}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Barra de progreso a ancho completo (apoyo visual de cantidades) */}
      <div className="tramos-visual-bar-wrap">
        <div
          className="tramos-visual-bar"
          role="progressbar"
          aria-valuenow={100}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Distribución gráfica del tiempo por responsable"
        >
          {segments.map((seg) => (
            <div
              key={`vbar-${seg.id ?? `${seg.usuario_id}-${seg.sequence}`}`}
              className="tramos-visual-chunk"
              style={{
                flex: `${seg.barFlex} 1 0`,
                background: seg.color,
              }}
              title={`${seg.nombre}: ${seg.label} (${seg.sharePct}%)`}
            />
          ))}
        </div>

        {/* Leyenda alineada a cada tramo de la barra */}
        <div className="tramos-bar-legend">
          {segments.map((seg) => (
            <div
              key={`leg-${seg.id ?? `${seg.usuario_id}-${seg.sequence}`}`}
              className="tramos-bar-legend-item"
              style={{ flex: `${seg.barFlex} 1 0` }}
              title={`${seg.nombre}: ${seg.label}`}
            >
              <span className="legend-pct" style={{ color: seg.color }}>
                {seg.sharePctLabel}%
              </span>
              <span className="legend-time">{seg.label}</span>
              <span className="legend-name">{seg.nombre}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TramosAsignacionBar;
