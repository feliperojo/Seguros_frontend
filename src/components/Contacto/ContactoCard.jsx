// src/components/Contacto/ContactoCard.jsx
import React from "react";
import { joinNameParts } from "../../utils/names";

export default function ContactoCard({
  contacto = {},
  link = {},
  onEdit,
  onDelete,
  readOnly = false,
}) {
  const nombre =
    contacto?.nombre_completo ||
    joinNameParts(contacto?.nombres || "", contacto?.apellidos || "");
  const idioma = contacto?.idioma || "—";
  const telefonos = Array.isArray(contacto?.telefonos) ? contacto.telefonos : [];
  const relacion = link?.relacion || "—";
  const pertenece = link?.pertenece_al_grupo ? "Sí" : "No";
  const nota = link?.nota || "—";

  const telsOrdenados = [...telefonos].sort(
    (a, b) => (b?.principal ? 1 : 0) - (a?.principal ? 1 : 0)
  );
  const fmt = (t) => {
    const cc = t?.indicativo ? `+${t.indicativo} ` : "";
    return `${cc}${t?.numero || ""}`.trim();
  };

  return (
    <div className="card mb-2">
      <div className="card-body">
        {/* Encabezado con acciones */}
        <div className="d-flex align-items-start justify-content-between gap-2 flex-wrap">
          <div className="d-flex align-items-center gap-2">
            <h6 className="fw-semibold mb-0">{nombre}</h6>
            {relacion && relacion !== "—" && (
              <span className="badge bg-light text-dark">{relacion}</span>
            )}
          </div>

          {!readOnly && (onEdit || onDelete) && (
            <div className="btn-group btn-group-sm">
              {onEdit && (
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={onEdit}
                  title="Editar relación"
                >
                  Editar
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  className="btn btn-outline-danger"
                  onClick={onDelete}
                  title="Quitar relación"
                >
                  Quitar
                </button>
              )}
            </div>
          )}
        </div>

        {/* Contenido */}
        <div className="mt-2 small">
          <div className="mb-1">
            <strong>Idioma:</strong> {idioma}
          </div>

          <div className="mb-1">
            <strong>Teléfonos:</strong>
            {telsOrdenados.length === 0 ? (
              <span className="ms-1">—</span>
            ) : (
              <ul className="list-unstyled ms-2 mb-0 mt-1">
                {telsOrdenados.map((t, idx) => (
                  <li key={t.id ?? idx} className="d-flex align-items-center gap-2 mb-1">
                    <span>{fmt(t)}</span>
                    {t?.tipo && (
                      <span className="badge bg-secondary-subtle text-secondary-emphasis">
                        {t.tipo}
                      </span>
                    )}
                    {t?.principal && (
                      <span className="badge bg-success-subtle text-success-emphasis">
                        Principal
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mb-1">
            <strong>Pertenece GF:</strong> {pertenece}
          </div>
          <hr className="my-2" />
          <div>
            <strong>Nota:</strong> {nota}
          </div>
        </div>
      </div>
    </div>
  );
}
