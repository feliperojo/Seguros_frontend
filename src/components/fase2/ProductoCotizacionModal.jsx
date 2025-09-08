import React, { useState } from "react";

/**
 * Modal estático para elegir el tipo de producto a cotizar.
 *
 * Props:
 * - open: boolean               -> si true, el modal se muestra
 * - defaultValue: {key,label}?  -> valor inicial (opcional)
 * - onSelect: fn(producto)      -> se llama al pulsar "Continuar" con {key,label,descripcion,color,icon}
 * - onClose: fn()               -> si permites cerrar sin elegir (opcional)
 */
const PRODUCTOS = [
  { key: "SALUD",      label: "Plan de salud",     descripcion: "Cobertura médica",          icon: "fa-heart-pulse", color: "primary" },
  { key: "DENTAL",     label: "Plan Dental",       descripcion: "Odontología",               icon: "fa-tooth",       color: "info"    },
  { key: "VIDA",       label: "Plan de vida",      descripcion: "Protección de vida",        icon: "fa-heart",       color: "danger"  },
  { key: "DESCUENTOS", label: "Plan de Descuentos",descripcion: "Ahorros en servicios",      icon: "fa-tags",        color: "warning" },
];

export default function ProductoCotizacionModal({
  open,
  defaultValue = null,
  onSelect,
  onClose,
}) {
  const [selected, setSelected] = useState(defaultValue);

  if (!open) return null;

  return (
    <>
      {/* Usa FA6; si usas FA5, cambia a 'fas' */}
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
      />
      <div
        className="modal fade show d-block"
        style={{ backgroundColor: "rgba(0,0,0,.5)", zIndex: 1055 }}
      >
        <div className="modal-dialog modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Seleccionar tipo de producto</h5>
              {onClose && (
                <button
                  type="button"
                  className="btn-close"
                  onClick={onClose}
                  aria-label="Close"
                />
              )}
            </div>

            <div className="modal-body">
              <div className="text-center text-muted mb-3">
                ¿Qué producto deseas cotizar?
              </div>

              <div className="row g-3">
                {PRODUCTOS.map((p) => {
                  const active = selected?.key === p.key;
                  return (
                    <div className="col-md-6" key={p.key}>
                      <div
                        className={`card h-100 border-2 ${
                          active ? `border-${p.color}` : "border-light"
                        }`}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelected(p)}
                        onKeyDown={(e) => e.key === "Enter" && setSelected(p)}
                        style={{ cursor: "pointer" }}
                      >
                        <div className="card-body text-center py-4">
                          <div
                            className={`bg-${p.color} text-white rounded-circle d-inline-flex align-items-center justify-content-center mb-3`}
                            style={{ width: 60, height: 60 }}
                          >
                            <i className={`fa-solid ${p.icon} fa-lg`} />
                          </div>
                          <h6 className="mb-1">{p.label}</h6>
                          <small className="text-muted d-block">
                            {p.descripcion}
                          </small>
                          {active && (
                            <div className="mt-2">
                              <i
                                className={`fa-solid fa-check-circle text-${p.color}`}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={onClose || (() => {})}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                disabled={!selected}
                onClick={() => onSelect?.(selected)}
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
