import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

/** Campos disponibles para copiar (área de cobertura/raíz) */
const FIELD_DEFS = [
  { key: "elegibilidad",      label: "Elegibilidad" },
  { key: "compania_id",       label: "Compañía" },
  { key: "agente",            label: "Agente" },
  { key: "plan",              label: "Plan" },
  { key: "metal",             label: "Metal" },
  { key: "red",               label: "Red" },
  { key: "pagador_id",        label: "Pagador" },
  { key: "tipo_pago",         label: "Tipo de pago" },
  { key: "dia_pago",          label: "Día de pago" },
  { key: "estado_cobertura",  label: "Cobertura" },
  { key: "fecha_activacion",  label: "fecha de activacion" },
];

const ALL_KEYS = FIELD_DEFS.map(f => f.key);

/** Bloque de dirección (en objeto cliente) */
export const ADDRESS_FIELDS = [

  "direccion", "calle", "apto", "ciudad", "estado",
  "codigo_postal", "condado", "dir_correspondencia",
];

/** Nombre amigable para opciones */
const fullName = (m) =>
  m?.nombreCompleto ||
  [m?.primer_nombre, m?.segundo_nombre, m?.apellidos].filter(Boolean).join(" ") ||
  m?.cliente?.nombre_completo ||
  "Sin nombre";

export default function CopiarDatosModal({
  open,
  onClose,
  members = [],
  onApply, // ({ sourceId, fieldKeys, copyAddress, targetIds })
}) {
  const candidates = useMemo(() => members || [], [members]);

  // ✅ por defecto: todo marcado
  const [fieldKeys, setFieldKeys] = useState(() => new Set(ALL_KEYS));
  const [copyAddress, setCopyAddress] = useState(true);
  const [sourceId, setSourceId] = useState(null);

  const [targetMode, setTargetMode] = useState("all"); // 'all' | 'some'
  const [selectedTargets, setSelectedTargets] = useState(() => new Set());

  // Bloquear scroll y aplicar clase bootstrap mientras esté abierto
  useEffect(() => {
    if (!open) return;
    const body = document.body;
    const prevOverflow = body.style.overflow;
    body.classList.add("modal-open");
    body.style.overflow = "hidden";
    return () => {
      body.classList.remove("modal-open");
      body.style.overflow = prevOverflow;
    };
  }, [open]);

  // Al abrir, re-inicializa a todo marcado
  useEffect(() => {
    if (open) {
      setFieldKeys(new Set(ALL_KEYS));
      setCopyAddress(true);
      setTargetMode("all");
      setSelectedTargets(new Set());
      // Si prefieres limpiar siempre el origen, descomenta:
      // setSourceId(null);
    }
  }, [open]);

  // Si cambia el origen, limpiamos selección de destinos específicos
  useEffect(() => {
    setSelectedTargets(new Set());
  }, [sourceId]);

  const toggleField = (key) => {
    setFieldKeys((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleTarget = (id) => {
    setSelectedTargets((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleApply = () => {
    if (!sourceId) return;
    const ids =
      targetMode === "all"
        ? candidates.filter(m => (m.id ?? m.cliente_id) !== sourceId).map(m => m.id ?? m.cliente_id)
        : Array.from(selectedTargets);

    onApply?.({
      sourceId,
      fieldKeys: Array.from(fieldKeys),
      copyAddress: !!copyAddress,
      targetIds: ids,
    });
    onClose?.();
  };

  if (!open) return null;

  return createPortal(
    <>
      <div
        className="modal fade show"
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        style={{ display: "block", zIndex: 1060, pointerEvents: "auto" }}
      >
        <div className="modal-dialog modal-lg modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">
                <i className="fas fa-copy me-2" />
                Copiar datos entre miembros
              </h5>
              <button className="btn-close" onClick={onClose} />
            </div>

            <div className="modal-body">
              {/* Origen */}
              <div className="mb-3">
                <label className="form-label fw-semibold">Origen (de dónde copiar)</label>
                <select
                  className="form-select"
                  value={sourceId || ""}
                  onChange={(e) => setSourceId(Number(e.target.value))}

                >
                  <option value="">Seleccione…</option>
                  {candidates.map((m) => {
                    const id = m.id ?? m.cliente_id;
                    return (
                      <option key={id} value={id}>
                        {fullName(m)} {m?.tipo ? `— ${m.tipo}` : ""}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Campos */}
              <div className="mb-3">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <div className="fw-semibold">Campos a copiar</div>
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="toggle-all"
                      checked={fieldKeys.size === ALL_KEYS.length && copyAddress}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setFieldKeys(checked ? new Set(ALL_KEYS) : new Set());
                        setCopyAddress(checked);
                      }}
                    />
                    <label className="form-check-label small" htmlFor="toggle-all">
                      (De)seleccionar todo
                    </label>
                  </div>
                </div>

                <div className="row row-cols-1 row-cols-md-2 g-2">
                  {FIELD_DEFS.map((f) => (
                    <div className="col" key={f.key}>
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id={`fld-${f.key}`}
                          checked={fieldKeys.has(f.key)}
                          onChange={() => toggleField(f.key)}
                        />
                        <label className="form-check-label" htmlFor={`fld-${f.key}`}>
                          {f.label}
                        </label>
                      </div>
                    </div>
                  ))}
                </div>

                <hr className="my-3" />
                <div className="form-check">
                  <input
                    id="copy-address"
                    className="form-check-input"
                    type="checkbox"
                    checked={copyAddress}
                    onChange={(e) => setCopyAddress(e.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="copy-address">
                    Dirección (residencia, calle, APT, ciudad, estado, código postal, condado y correspondencia)
                  </label>
                </div>
              </div>

              {/* Destino */}
              <div className="mb-2">
                <div className="fw-semibold mb-2">Copiar a</div>

                <div className="form-check mb-2">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="tmode"
                    id="tmode-all"
                    checked={targetMode === "all"}
                    onChange={() => setTargetMode("all")}
                  />
                  <label className="form-check-label" htmlFor="tmode-all">
                    Todos los demás miembros
                  </label>
                </div>

                <div className="form-check mb-2">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="tmode"
                    id="tmode-some"
                    checked={targetMode === "some"}
                    onChange={() => setTargetMode("some")}
                  />
                  <label className="form-check-label" htmlFor="tmode-some">
                    Seleccionar miembros específicos
                  </label>
                </div>

                {targetMode === "some" && (
                  <div className="border rounded p-2">
                    {candidates.map((m) => {
                      const id = m.id ?? m.cliente_id;
                      if (id === sourceId) return null;
                      return (
                        <div className="form-check" key={id}>
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id={`tgt-${id}`}
                            checked={selectedTargets.has(id)}
                            onChange={() => toggleTarget(id)}
                          />
                          <label className="form-check-label" htmlFor={`tgt-${id}`}>
                            {fullName(m)} {m?.tipo ? `— ${m.tipo}` : ""}
                          </label>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={onClose}>
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                disabled={!sourceId || (fieldKeys.size === 0 && !copyAddress)}
                onClick={handleApply}
              >
                Copiar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Backdrop detrás del modal (clic para cerrar) */}
      <div
        className="modal-backdrop fade show"
        onClick={onClose}
        style={{ zIndex: 1050 }}
      />
    </>,
    document.body
  );
}
