import React, { useMemo } from "react";
import { FaExternalLinkAlt, FaEdit } from "react-icons/fa";

/**
 * items: [{
 *   id, titulo, responsable, estado,
 *   fechaLimite,   // ISO o Date
 *   fechaCreacion, // ISO o Date
 * }]
 */
export default function TareasPendientesPanel({
  className = "",
  items = [],
  onCreate = () => {},
  onOpen = () => {},
  onEdit = () => {},
}) {
  const formatDate = (v) => {
    if (!v) return "mm/dd/aaaa";
    const d = v instanceof Date ? v : new Date(v);
    return isNaN(d) ? "mm/dd/aaaa" : d.toLocaleDateString();
  };

  const data = useMemo(() => items, [items]);

  return (
    <div className={`card ${className}`}>
      <div className="card-header d-flex justify-content-between align-items-center py-2">
        <strong className="text-primary">Tareas Pendientes</strong>
        <button className="btn btn-sm btn-outline-primary" onClick={onCreate}>
          + Crear Tarea
        </button>
      </div>

      <div className="card-body">
        {(!data || data.length === 0) && (
          <div className="text-muted small">No hay tareas pendientes.</div>
        )}

        {data?.map((t) => (
          <div key={t.id} className="card mb-3 shadow-sm border-0">
            <div className="card-body py-3">
              <div className="d-flex justify-content-between">
                <div className="fw-semibold">{t.titulo}</div>
                <div className="small text-muted text-end">
                  <div>Fecha Límite: {formatDate(t.fechaLimite)}</div>
                  <div>Creada: {formatDate(t.fechaCreacion)}</div>
                </div>
              </div>

              <div className="small mt-2">
                <div><strong>Responsable:</strong> {t.responsable ?? "—"}</div>
                <div><strong>Estado:</strong> {t.estado ?? "Pendiente"}</div>
              </div>

              <div className="mt-2 d-flex gap-2">
                <button className="btn btn-sm btn-primary" onClick={() => onOpen(t)}>
                  Abrir <FaExternalLinkAlt className="ms-1" />
                </button>
                <button className="btn btn-sm btn-outline-primary" onClick={() => onEdit(t)}>
                  Editar <FaEdit className="ms-1" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
