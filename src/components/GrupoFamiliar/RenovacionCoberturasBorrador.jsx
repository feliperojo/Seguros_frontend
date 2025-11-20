// src/components/GrupoFamiliar/RenovacionCoberturasBorrador.jsx
import React, { useEffect, useState } from "react";

/**
 * Paso 2 del flujo:
 * - Recibe el borrador devuelto por el backend
 * - Permite editar campos del año destino
 * - Permite marcar/desmarcar qué coberturas se renuevan
 * - Al enviar, devuelve la estructura "items" lista para confirmar
 */
const RenovacionCoberturasBorrador = ({
  borrador,
  loadingConfirm,
  onBack,
  onClose,
  onConfirm,
  error,
}) => {
  const [items, setItems] = useState([]);

  // Inicializamos el estado local a partir del borrador
  useEffect(() => {
    if (borrador?.items) {
      const mapped = borrador.items.map((item) => ({
        renovar: item?.borrador?.renovar ?? true,
        cobertura_id: item?.actual?.cobertura_id,
        // clonamos el borrador para poder editarlo
        borrador: { ...(item.borrador || {}) },
        actual: item.actual || {},
      }));
      setItems(mapped);
    }
  }, [borrador]);

  const handleToggleRenovar = (index) => {
    setItems((prev) =>
      prev.map((it, i) =>
        i === index ? { ...it, renovar: !it.renovar } : it
      )
    );
  };

  const handleBorradorFieldChange = (index, field, value) => {
    setItems((prev) =>
      prev.map((it, i) =>
        i === index
          ? { ...it, borrador: { ...it.borrador, [field]: value } }
          : it
      )
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!onConfirm) return;

    onConfirm(items);
  };

  if (!borrador) {
    return (
      <div className="alert alert-warning mb-0">
        No se encontró información de borrador de renovación.
      </div>
    );
  }

  const { anio_origen, anio_destino } = borrador;

  return (
    <form onSubmit={handleSubmit}>
      <div className="modal-body">
        <div className="mb-2">
          <strong>
            Renovación de coberturas del año {anio_origen} al año {anio_destino}
          </strong>
          <div className="text-muted small">
            Marca qué coberturas quieres renovar y ajusta los datos del nuevo año.
          </div>
        </div>

        {error && (
          <div className="alert alert-danger py-2">
            {error}
          </div>
        )}

        <div className="table-responsive" style={{ maxHeight: "400px" }}>
          <table className="table table-sm align-middle">
            <thead className="table-light">
              <tr>
                <th>Renovar</th>
                <th>Cliente</th>
                <th>Año actual</th>
                <th>Plan actual</th>
                <th>Precio actual</th>
                <th>Año nuevo</th>
                <th>Plan nuevo</th>
                <th>Precio nuevo</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-muted">
                    No hay coberturas activas para renovar.
                  </td>
                </tr>
              )}

              {items.map((item, index) => {
                const actual = item.actual || {};
                const borr = item.borrador || {};

                return (
                  <tr key={item.cobertura_id || index}>
                    {/* Checkbox renovar */}
                    <td>
                      <div className="form-check">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={item.renovar}
                          onChange={() => handleToggleRenovar(index)}
                        />
                      </div>
                    </td>

                    {/* Cliente */}
                    <td>
                      <div className="fw-semibold">
                        {actual.cliente_nombre || "—"}
                      </div>
                      <div className="text-muted small">
                        Cobertura #{actual.cobertura_id ?? item.cobertura_id}
                      </div>
                    </td>

                    {/* Año actual */}
                    <td>{actual.anio ?? anio_origen}</td>

                    {/* Plan actual */}
                    <td>{actual.plan || "—"}</td>

                    {/* Precio actual */}
                    <td>
                      {actual.precio != null ? `$${actual.precio}` : "—"}
                    </td>

                    {/* Año nuevo (solo lectura) */}
                    <td>{borr.anio ?? anio_destino}</td>

                    {/* Plan nuevo (editable) */}
                    <td>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={borr.plan || ""}
                        onChange={(e) =>
                          handleBorradorFieldChange(
                            index,
                            "plan",
                            e.target.value
                          )
                        }
                        disabled={!item.renovar}
                      />
                    </td>

                    {/* Precio nuevo (editable) */}
                    <td style={{ maxWidth: 120 }}>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control form-control-sm"
                        value={
                          borr.precio !== undefined && borr.precio !== null
                            ? borr.precio
                            : ""
                        }
                        onChange={(e) =>
                          handleBorradorFieldChange(
                            index,
                            "precio",
                            e.target.value === ""
                              ? null
                              : Number(e.target.value)
                          )
                        }
                        disabled={!item.renovar}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="alert alert-info mt-2 mb-0 small">
          <ul className="mb-0">
            <li>Puedes desmarcar miembros que no deban renovarse.</li>
            <li>Plan y precio nuevos se aplicarán solo a las coberturas marcadas.</li>
          </ul>
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
  {loadingConfirm ? "Guardando..." : "Confirmar renovación"}
</button>

          
      </div>
    </form>
  );
};

export default RenovacionCoberturasBorrador;
