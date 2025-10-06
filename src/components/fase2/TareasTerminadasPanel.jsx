import React, { useMemo, useState } from "react";
import { FaExternalLinkAlt, FaEdit } from "react-icons/fa";

/**
 * items: [{
 *   id, titulo, responsable, estado,     // estado típico: "Completada"
 *   fechaCreacion,  // ISO o Date
 *   fechaTermino,   // ISO o Date  <-- usada para agrupar por día
 * }]
 */
export default function TareasTerminadasPanel({
  className = "",
  items = [],
  onOpen = () => {},
  onEdit = () => {},
}) {
  const [term, setTerm] = useState("");

  const formatDate = (v) => {
    if (!v) return "mm/dd/aaaa";
    const d = v instanceof Date ? v : new Date(v);
    return isNaN(d) ? "mm/dd/aaaa" : d.toLocaleDateString();
  };

  const dayLabel = (v) => {
    const d = v instanceof Date ? v : new Date(v);
    if (isNaN(d)) return "";
    const mes = new Intl.DateTimeFormat("es-ES", { month: "long" }).format(d);
    const dia = d.getDate();
    // Capitalizar primera letra del mes
    const cap = mes.charAt(0).toUpperCase() + mes.slice(1);
    return `${cap} ${dia}`;
  };

  const filtered = useMemo(() => {
    if (!term) return items;
    const q = term.toLowerCase();
    return items.filter(
      (it) =>
        it.titulo?.toLowerCase().includes(q) ||
        it.responsable?.toLowerCase().includes(q) ||
        it.estado?.toLowerCase().includes(q)
    );
  }, [items, term]);

  const groups = useMemo(() => {
    // Agrupar por día de finalización
    const map = new Map();
    for (const t of filtered) {
      const key = dayLabel(t.fechaTermino) || "—";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(t);
    }
    return Array.from(map.entries()); // [ [label, tasks[]], ... ]
  }, [filtered]);

  return (
    <div className={`card ${className}`}>
      <div className="card-header py-2">
        <div className="text-primary text-center fw-semibold">Tareas Terminadas</div>
      </div>

      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <div className="input-group input-group-sm" style={{ maxWidth: 220 }}>
            <span className="input-group-text">Filtrar y Buscar</span>
            <input
              className="form-control"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Escribe aquí…"
            />
            {!!term && (
              <button className="btn btn-outline-secondary" onClick={() => setTerm("")}>
                ×
              </button>
            )}
          </div>
        </div>

        {groups.length === 0 && (
          <div className="text-muted small">No hay tareas terminadas.</div>
        )}

        {groups.map(([label, arr]) => (
          <div key={label} className="mb-3">
            <div className="text-center small text-muted mb-2">{label}</div>

            {arr.map((t) => (
              <div key={t.id} className="card mb-3 shadow-sm border-0">
                <div className="card-body py-3">
                  <div className="d-flex justify-content-between">
                    <div className="fw-semibold">{t.titulo}</div>
                    <div className="small text-muted text-end">
                      <div>Creada: {formatDate(t.fechaCreacion)}</div>
                      <div>Terminada: {formatDate(t.fechaTermino)}</div>
                    </div>
                  </div>

                  <div className="small mt-2">
                    <div><strong>Responsable:</strong> {t.responsable ?? "—"}</div>
                    <div><strong>Estado:</strong> {t.estado ?? "Completada"}</div>
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
        ))}
      </div>
    </div>
  );
}
