/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useState } from "react";
import apiRequest from "../../services/api";
import PreRenovacionItemCard from "./PreRenovacionItemCard";

const nombreMiembro = (item) =>
  item?.cobertura?.cliente?.nombre_completo ||
  `Cobertura #${item?.cobertura_id || "?"}`;

const getErrorMessage = (error) =>
  error?.response?.data?.message ||
  error?.message ||
  "Ocurrió un error al procesar la pre-renovación.";

const PreRenovacionModal = ({
  show,
  onHide,
  grupoFamiliarId,
  anioDestino,
  onAfterConsolidar,
}) => {
  const [lote, setLote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [consolidando, setConsolidando] = useState(false);
  const [error, setError] = useState("");
  const [attemptedConsolidar, setAttemptedConsolidar] = useState(false);
  const [showConfirmacionFinal, setShowConfirmacionFinal] = useState(false);
  const [confirmoRevision, setConfirmoRevision] = useState(false);
  const [itemsConGuardadoPendiente, setItemsConGuardadoPendiente] = useState(
    () => new Set()
  );

  useEffect(() => {
    if (!show || !grupoFamiliarId || !anioDestino) return undefined;

    let active = true;
    setLoading(true);
    setError("");
    setLote(null);
    setAttemptedConsolidar(false);
    setShowConfirmacionFinal(false);
    setConfirmoRevision(false);
    setItemsConGuardadoPendiente(new Set());

    (async () => {
      try {
        const response = await apiRequest(
          `/grupo_familiar/${grupoFamiliarId}/pre-renovacion`,
          "POST",
          { anio_destino: anioDestino }
        );
        if (active) setLote(response?.data ?? response);
      } catch (requestError) {
        console.error("Error al abrir la pre-renovación", requestError);
        if (active) setError(getErrorMessage(requestError));
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [show, grupoFamiliarId, anioDestino]);

  const handleItemUpdated = useCallback((itemActualizado) => {
    setLote((prev) =>
      prev
        ? {
            ...prev,
            items: (prev.items || []).map((item) =>
              Number(item.id) === Number(itemActualizado.id)
                ? { ...item, ...itemActualizado }
                : item
            ),
          }
        : prev
    );
  }, []);

  const handleSaveStateChange = useCallback((itemId, tienePendiente) => {
    setItemsConGuardadoPendiente((prev) => {
      const next = new Set(prev);
      if (tienePendiente) next.add(itemId);
      else next.delete(itemId);
      return next;
    });
  }, []);

  const items = useMemo(() => lote?.items || [], [lote?.items]);

  const miembrosARenovar = useMemo(
    () => items.filter((item) => Boolean(item?.renovar)),
    [items]
  );

  const miembrosAOmitir = useMemo(
    () => items.filter((item) => !item?.renovar),
    [items]
  );

  const miembrosSinCodigo = useMemo(
    () =>
      items
        .filter(
          (item) =>
            Boolean(item?.renovar) &&
            !String(item?.datos_borrador?.codigo_poliza ?? "").trim()
        )
        .map(nombreMiembro),
    [items]
  );

  const miembrosSinRetiro = useMemo(
    () =>
      items
        .filter((item) => {
          const requiereRetiro =
            !item?.renovar && Boolean(item?.cobertura?.activo);
          if (!requiereRetiro) return false;
          return (
            !String(item?.datos_borrador?.fecha_retiro ?? "").trim() ||
            !String(item?.datos_borrador?.motivo_retiro ?? "").trim()
          );
        })
        .map(nombreMiembro),
    [items]
  );

  const miembrosInactivosMarcadosRenovar = useMemo(
    () =>
      items
        .filter(
          (item) =>
            Boolean(item?.renovar) &&
            item?.cobertura != null &&
            !item.cobertura.activo
        )
        .map(nombreMiembro),
    [items]
  );

  const hayGuardadosPendientes = itemsConGuardadoPendiente.size > 0;
  const puedeConsolidar =
    items.length > 0 &&
    miembrosSinCodigo.length === 0 &&
    miembrosSinRetiro.length === 0 &&
    miembrosInactivosMarcadosRenovar.length === 0 &&
    !hayGuardadosPendientes &&
    !loading &&
    !consolidando;

  const handleClose = () => {
    if (consolidando) return;
    setShowConfirmacionFinal(false);
    setConfirmoRevision(false);
    onHide?.();
  };

  const handleConsolidar = () => {
    setAttemptedConsolidar(true);
    setError("");
    if (puedeConsolidar) {
      setConfirmoRevision(false);
      setShowConfirmacionFinal(true);
    }
  };

  const ejecutarConsolidacion = async () => {
    if (!puedeConsolidar || !lote?.id || !confirmoRevision) return;

    setConsolidando(true);
    setError("");
    try {
      const response = await apiRequest(
        `/grupo_familiar/${grupoFamiliarId}/pre-renovacion/${lote.id}/consolidar`,
        "POST"
      );
      await onAfterConsolidar?.(response);
      setShowConfirmacionFinal(false);
      setConfirmoRevision(false);
      onHide?.();
    } catch (requestError) {
      console.error("Error al consolidar la pre-renovación", requestError);
      setError(getErrorMessage(requestError));
    } finally {
      setConsolidando(false);
    }
  };

  if (!show) return null;

  return (
    <>
      <div
        className="modal fade show d-block"
        tabIndex="-1"
        role="dialog"
        style={{ zIndex: 1065 }}
      >
        <div
          className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable"
          role="document"
        >
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">
                {showConfirmacionFinal
                  ? `Confirmar consolidación ${anioDestino}`
                  : `Pre-renovación ${anioDestino} — borrador`}
              </h5>
              <button
                type="button"
                className="btn-close"
                onClick={handleClose}
                disabled={consolidando}
                aria-label="Cerrar"
              />
            </div>

            {showConfirmacionFinal ? (
              <>
                <div className="modal-body">
                  <div className="alert alert-warning">
                    <strong>Esta acción ejecutará la renovación real</strong>{" "}
                    para este grupo y no se puede deshacer. Revisa el resumen
                    antes de continuar.
                  </div>

                  {error && (
                    <div className="alert alert-danger py-2">{error}</div>
                  )}

                  <ul className="list-unstyled mb-3">
                    <li className="mb-2">
                      <i
                        className="fas fa-check-circle text-success me-2"
                        aria-hidden="true"
                      />
                      Se renovarán{" "}
                      <strong>{miembrosARenovar.length}</strong>{" "}
                      {miembrosARenovar.length === 1 ? "miembro" : "miembros"}
                      {miembrosARenovar.length > 0 && (
                        <span className="text-muted">
                          {" "}
                          ({miembrosARenovar.map(nombreMiembro).join(", ")})
                        </span>
                      )}
                    </li>
                    <li>
                      <i
                        className="fas fa-ban text-secondary me-2"
                        aria-hidden="true"
                      />
                      Se omitirán{" "}
                      <strong>{miembrosAOmitir.length}</strong>{" "}
                      {miembrosAOmitir.length === 1 ? "miembro" : "miembros"} — no
                      se renovarán
                      {miembrosAOmitir.length > 0 && (
                        <span className="text-muted">
                          {" "}
                          ({miembrosAOmitir.map(nombreMiembro).join(", ")})
                        </span>
                      )}
                    </li>
                  </ul>

                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="confirmo-revision-consolidar"
                      checked={confirmoRevision}
                      onChange={(e) => setConfirmoRevision(e.target.checked)}
                      disabled={consolidando}
                    />
                    <label
                      className="form-check-label"
                      htmlFor="confirmo-revision-consolidar"
                    >
                      Confirmo que revisé la información de todos los miembros y
                      quiero ejecutar la renovación real para este grupo.
                    </label>
                  </div>
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setShowConfirmacionFinal(false);
                      setConfirmoRevision(false);
                    }}
                    disabled={consolidando}
                  >
                    Volver
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={ejecutarConsolidacion}
                    disabled={!confirmoRevision || consolidando}
                  >
                    {consolidando ? (
                      <>
                        <span
                          className="spinner-border spinner-border-sm me-2"
                          role="status"
                          aria-hidden="true"
                        />
                        Consolidando…
                      </>
                    ) : (
                      "Sí, consolidar ahora"
                    )}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="modal-body">
                  <div className="alert alert-info">
                    <strong>Esto es un borrador.</strong> Puedes cerrar esta
                    ventana y volver más tarde — cada cambio se guarda
                    automáticamente. Nada se aplica a las pólizas reales hasta
                    que uses “Consolidar”.
                  </div>

                  {error && (
                    <div className="alert alert-danger py-2">{error}</div>
                  )}

                  {loading && (
                    <div className="text-center py-5">
                      <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Cargando…</span>
                      </div>
                      <div className="text-muted mt-2">
                        Abriendo pre-renovación…
                      </div>
                    </div>
                  )}

                  {!loading && !error && items.length === 0 && (
                    <div className="alert alert-warning mb-0">
                      No hay coberturas activas candidatas para pre-renovar.
                    </div>
                  )}

                  {attemptedConsolidar && miembrosSinCodigo.length > 0 && (
                    <div className="alert alert-warning">
                      Completa el <strong>código de póliza</strong> de:{" "}
                      {miembrosSinCodigo.join(", ")}.
                    </div>
                  )}

                  {attemptedConsolidar && miembrosSinRetiro.length > 0 && (
                    <div className="alert alert-warning">
                      Completa la{" "}
                      <strong>fecha y el motivo de retiro</strong> de:{" "}
                      {miembrosSinRetiro.join(", ")}.
                    </div>
                  )}

                  {attemptedConsolidar &&
                    miembrosInactivosMarcadosRenovar.length > 0 && (
                      <div className="alert alert-warning">
                        Desmarca <strong>Renovar</strong> (cobertura ya
                        inactiva) para:{" "}
                        {miembrosInactivosMarcadosRenovar.join(", ")}.
                      </div>
                    )}

                  {hayGuardadosPendientes && (
                    <div className="alert alert-light border py-2 small">
                      Esperando a que terminen los cambios pendientes de
                      guardado…
                    </div>
                  )}

                  <div className="d-flex flex-column gap-3">
                    {items.map((item) => (
                      <PreRenovacionItemCard
                        key={item.id}
                        item={item}
                        anioDestino={anioDestino}
                        onItemUpdated={handleItemUpdated}
                        attemptedConsolidar={attemptedConsolidar}
                        onSaveStateChange={handleSaveStateChange}
                      />
                    ))}
                  </div>
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleClose}
                    disabled={consolidando}
                  >
                    Cerrar
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleConsolidar}
                    disabled={!puedeConsolidar}
                    title={
                      miembrosSinCodigo.length > 0
                        ? `Falta código de póliza: ${miembrosSinCodigo.join(", ")}`
                        : miembrosSinRetiro.length > 0
                          ? `Falta fecha/motivo de retiro: ${miembrosSinRetiro.join(", ")}`
                          : miembrosInactivosMarcadosRenovar.length > 0
                            ? `Cobertura inactiva marcada para renovar: ${miembrosInactivosMarcadosRenovar.join(", ")}`
                            : hayGuardadosPendientes
                              ? "Espera a que termine el autoguardado"
                              : undefined
                    }
                  >
                    Consolidar ahora
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div
        className="modal-backdrop fade show"
        style={{ zIndex: 1060 }}
        onClick={handleClose}
      />
    </>
  );
};

export default PreRenovacionModal;
