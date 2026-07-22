/* eslint-disable react/prop-types */
import { useEffect, useState } from "react";
import apiRequest from "../../services/api";

const getErrorMessage = (error) =>
  error?.response?.data?.message ||
  error?.message ||
  "Ocurrió un error al consolidar las pre-renovaciones.";

const ConsolidarTodosModal = ({
  show,
  onHide,
  anioDestino,
  onAfterConsolidar,
}) => {
  const [pendientes, setPendientes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [consolidando, setConsolidando] = useState(false);
  const [error, setError] = useState("");
  const [confirmo, setConfirmo] = useState(false);
  const [resumen, setResumen] = useState(null);

  useEffect(() => {
    if (!show || !anioDestino) return undefined;

    let active = true;
    setLoading(true);
    setError("");
    setConfirmo(false);
    setResumen(null);
    setPendientes([]);

    (async () => {
      try {
        const response = await apiRequest(
          `/pre-renovacion/pendientes-consolidar?anio_destino=${anioDestino}`,
          "GET"
        );
        if (active) {
          setPendientes(Array.isArray(response?.data) ? response.data : []);
        }
      } catch (requestError) {
        console.error("Error al cargar pendientes de consolidar", requestError);
        if (active) setError(getErrorMessage(requestError));
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [show, anioDestino]);

  const handleConsolidar = async () => {
    if (!confirmo || consolidando) return;

    setConsolidando(true);
    setError("");
    try {
      const response = await apiRequest(
        "/pre-renovacion/consolidar-todos",
        "POST",
        { anio_destino: anioDestino }
      );
      setResumen(Array.isArray(response?.data) ? response.data : []);
    } catch (requestError) {
      console.error("Error al consolidar todas las pre-renovaciones", requestError);
      setError(getErrorMessage(requestError));
    } finally {
      setConsolidando(false);
    }
  };

  const handleCerrar = async () => {
    if (resumen) {
      await onAfterConsolidar?.();
    } else {
      onHide?.();
    }
  };

  if (!show) return null;

  const total = pendientes.length;

  return (
    <>
      <div
        className="modal fade show d-block"
        tabIndex="-1"
        role="dialog"
        style={{ zIndex: 1065 }}
      >
        <div
          className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable"
          role="document"
        >
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">
                {resumen
                  ? `Resumen consolidación ${anioDestino}`
                  : `Consolidar pre-renovaciones ${anioDestino}`}
              </h5>
              <button
                type="button"
                className="btn-close"
                onClick={handleCerrar}
                disabled={consolidando}
                aria-label="Cerrar"
              />
            </div>

            <div className="modal-body">
              {error && (
                <div className="alert alert-danger py-2">{error}</div>
              )}

              {loading ? (
                <div className="text-center py-4">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Cargando...</span>
                  </div>
                  <p className="mt-2 mb-0 text-muted">
                    Cargando pre-renovaciones pendientes...
                  </p>
                </div>
              ) : resumen ? (
                <div className="table-responsive">
                  <table className="table table-sm table-hover align-middle mb-0">
                    <thead>
                      <tr>
                        <th>lote_id</th>
                        <th>grupo</th>
                        <th>resultado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resumen.map((fila) => (
                        <tr key={fila.lote_id}>
                          <td>{fila.lote_id}</td>
                          <td>{fila.grupo_familiar_id}</td>
                          <td>
                            {fila.resultado === "OK" ? (
                              <span className="text-success fw-semibold">
                                OK
                              </span>
                            ) : (
                              <span className="text-danger">
                                {fila.resultado}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : total === 0 ? (
                <p className="text-muted mb-0">
                  No hay pre-renovaciones pendientes de consolidar para el año{" "}
                  {anioDestino}.
                </p>
              ) : (
                <>
                  <div className="alert alert-warning">
                    Se consolidarán <strong>{total}</strong> grupo
                    {total !== 1 ? "s" : ""} en pre-renovación para el año{" "}
                    <strong>{anioDestino}</strong>. Esta acción ejecuta la
                    renovación real.
                  </div>

                  <div className="table-responsive mb-3">
                    <table className="table table-sm table-hover align-middle mb-0">
                      <thead>
                        <tr>
                          <th>Grupo</th>
                          <th>Ítems a renovar</th>
                          <th>Ítems retirados</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendientes.map((fila) => (
                          <tr key={fila.lote_id}>
                            <td>
                              <div className="fw-semibold">
                                #{fila.grupo_familiar_id}
                              </div>
                              <div className="text-muted small">
                                {fila.persona_contacto || "Sin contacto"}
                              </div>
                            </td>
                            <td>{fila.items_renovar ?? 0}</td>
                            <td>{fila.items_omitir ?? 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="confirmo-consolidar-todos"
                      checked={confirmo}
                      onChange={(e) => setConfirmo(e.target.checked)}
                      disabled={consolidando}
                    />
                    <label
                      className="form-check-label"
                      htmlFor="confirmo-consolidar-todos"
                    >
                      Confirmo que revisé la lista y quiero consolidar estos{" "}
                      {total} grupos ahora. Esta acción es irreversible.
                    </label>
                  </div>
                </>
              )}
            </div>

            <div className="modal-footer">
              {resumen || total === 0 ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleCerrar}
                  disabled={consolidando}
                >
                  Cerrar
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={onHide}
                    disabled={consolidando}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={handleConsolidar}
                    disabled={!confirmo || consolidando}
                  >
                    {consolidando
                      ? "Consolidando..."
                      : "Sí, consolidar todos"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" style={{ zIndex: 1060 }} />
    </>
  );
};

export default ConsolidarTodosModal;
