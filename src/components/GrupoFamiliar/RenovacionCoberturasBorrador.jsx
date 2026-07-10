// src/components/GrupoFamiliar/RenovacionCoberturasBorrador.jsx
import React, { useEffect, useState } from "react";

/**
 * Paso 2 del flujo (simplificado):
 * - NO edita plan/precio/compañía.
 * - Solo muestra un resumen informativo.
 * - Al confirmar, envía la lista de coberturas a renovar.
 */
const RenovacionCoberturasBorrador = ({
  borrador,
  loadingConfirm,
  onBack,
  onClose,
  onConfirm,
  error,
  // allowChangeCompany ya no se usa, pero lo dejamos en la firma
}) => {
  const [items, setItems] = useState([]);

  // Inicializamos el estado local a partir del borrador
  useEffect(() => {
    if (borrador?.items) {
      const mapped = borrador.items.map((item) => ({
        renovar: item?.borrador?.renovar ?? true,
        cobertura_id: item?.actual?.cobertura_id,
        borrador: { ...(item.borrador || {}) },
        actual: item.actual || {},
      }));
      setItems(mapped);
    } else {
      setItems([]);
    }
  }, [borrador]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!onConfirm) return;
    onConfirm(items);
  };

  if (!borrador) {
    return (
      <div className="modal-body">
        <div className="alert alert-warning mb-0">
          No se encontró información de borrador de renovación.
        </div>
        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  const { anio_origen, anio_destino } = borrador;
  const totalCoberturas = items.length;

  return (
    <form onSubmit={handleSubmit}>
      <div className="modal-body">
        <div className="mb-2">
          <strong>
            Renovación de coberturas del año {anio_origen} al año {anio_destino}
          </strong>
          <div className="text-muted small mt-1">
            Se encontraron <strong>{totalCoberturas}</strong>{" "}
            coberturas activas para este grupo familiar.
          </div>
        </div>

        {error && (
          <div className="alert alert-danger py-2">
            {error}
          </div>
        )}

        <div className="alert alert-info">
          <p className="mb-1 fw-semibold">¿Qué hará este proceso?</p>
          <ul className="mb-0">
            <li>
              Archivará una copia del grupo familiar y sus coberturas del año{" "}
              <strong>{anio_origen}</strong>, para consulta histórica.
            </li>
            <li>
              Creará automáticamente las coberturas del año{" "}
              <strong>{anio_destino}</strong> con la misma información actual.
            </li>
            <li>
              Después de confirmar, podrás entrar a las cards del grupo y
              actualizar manualmente los datos del nuevo año (plan, compañía,
              precio, etc.).
            </li>
          </ul>
        </div>

        <div className="alert alert-warning mt-3 small mb-0">
          <i className="bi bi-exclamation-triangle me-2" />
          Revisa que sea el año correcto. Este proceso no elimina información,
          pero generará nuevas coberturas para todos los miembros activos.
        </div>
      </div>

      <div className="modal-footer">
        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={onBack}
          disabled={loadingConfirm}
        >
          Volver
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onClose}
          disabled={loadingConfirm}
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={loadingConfirm || items.length === 0}
        >
          {loadingConfirm ? "Procesando..." : "Confirmar renovación"}
        </button>
      </div>
    </form>
  );
};

export default RenovacionCoberturasBorrador;
