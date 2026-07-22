/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useState } from "react";
import apiRequest from "../../services/api";
import ClienteExistenteModal from "../fase2/ClienteExistenteModal";
import CopiarDatosModal from "../fase2/CopiarDatosModal";
import PreRenovacionItemCard from "./PreRenovacionItemCard";
import { pickClienteParaBorrador } from "../../utils/clienteFieldGroups";
import {
  buildCopyPatchForItem,
  isTomadorItem,
  itemElegibleParaCopiarEnBorrador,
  itemToCopyMember,
} from "../../utils/preRenovacionCopy";

const TIPOS_PARENTESCO = [
  "Tomador",
  "Conyuge",
  "Hijo/a",
  "Hermano",
  "Padre",
  "Madre",
  "Nieto",
  "Abuelo/a",
  "Suegro/a",
  "Tio/a",
  "Sobrino/a",
];

const nombreMiembro = (item) =>
  item?.tipo_item === "miembro_nuevo"
    ? item?.datos_borrador?.cliente?.nombre_completo ||
      `Miembro nuevo #${item?.id || "?"}`
    : item?.cobertura?.cliente?.nombre_completo ||
      `Cobertura #${item?.cobertura_id || "?"}`;

const getErrorMessage = (error) =>
  error?.response?.data?.message ||
  error?.message ||
  "Ocurrió un error al procesar la pre-renovación.";

const buildFullName = (p = "", s = "", a = "") =>
  [p?.trim(), s?.trim(), a?.trim()].filter(Boolean).join(" ");

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
  const [showClienteExistente, setShowClienteExistente] = useState(false);
  const [showPersonaNueva, setShowPersonaNueva] = useState(false);
  const [personaNuevaParentesco, setPersonaNuevaParentesco] = useState("");
  const [personaNuevaPrimerNombre, setPersonaNuevaPrimerNombre] = useState("");
  const [personaNuevaSegundoNombre, setPersonaNuevaSegundoNombre] =
    useState("");
  const [personaNuevaApellidos, setPersonaNuevaApellidos] = useState("");
  const [agregandoMiembro, setAgregandoMiembro] = useState(false);
  const [showCopiarDatos, setShowCopiarDatos] = useState(false);
  const [copiandoDatos, setCopiandoDatos] = useState(false);
  const [cardsRevision, setCardsRevision] = useState(0);

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
    setShowClienteExistente(false);
    setShowPersonaNueva(false);
    setShowCopiarDatos(false);
    setPersonaNuevaParentesco("");
    setPersonaNuevaPrimerNombre("");
    setPersonaNuevaSegundoNombre("");
    setPersonaNuevaApellidos("");
    setCardsRevision(0);

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

  const handleItemRemoved = useCallback((itemId) => {
    setLote((prev) =>
      prev
        ? {
            ...prev,
            items: (prev.items || []).filter(
              (item) => Number(item.id) !== Number(itemId)
            ),
          }
        : prev
    );
    setItemsConGuardadoPendiente((prev) => {
      const next = new Set(prev);
      next.delete(itemId);
      return next;
    });
  }, []);

  const agregarMiembroAlLote = useCallback(
    async (body) => {
      if (!lote?.id || !grupoFamiliarId) return;
      setAgregandoMiembro(true);
      setError("");
      try {
        const response = await apiRequest(
          `/grupo_familiar/${grupoFamiliarId}/pre-renovacion/${lote.id}/miembros`,
          "POST",
          body
        );
        const nuevoItem = response?.data ?? response;
        setLote((prev) =>
          prev
            ? { ...prev, items: [...(prev.items || []), nuevoItem] }
            : prev
        );
        setShowClienteExistente(false);
        setShowPersonaNueva(false);
        setPersonaNuevaParentesco("");
        setPersonaNuevaPrimerNombre("");
        setPersonaNuevaSegundoNombre("");
        setPersonaNuevaApellidos("");
      } catch (requestError) {
        console.error("Error al agregar miembro nuevo", requestError);
        setError(getErrorMessage(requestError));
      } finally {
        setAgregandoMiembro(false);
      }
    },
    [lote?.id, grupoFamiliarId]
  );

  const handleAgregarClienteExistente = useCallback(
    async (payload, clienteFull) => {
      const cliente = pickClienteParaBorrador(clienteFull);
      // Garantiza al menos el nombre visible en la tarjeta si el pick no lo trajo.
      if (!cliente.nombre_completo && clienteFull?.nombre_completo) {
        cliente.nombre_completo = clienteFull.nombre_completo;
      }

      await agregarMiembroAlLote({
        parentesco: payload.tipo,
        cobertura_tipo: payload.cobertura_tipo,
        cliente_id_existente: clienteFull.id,
        cliente,
      });
    },
    [agregarMiembroAlLote]
  );

  const handleSaveStateChange = useCallback((itemId, tienePendiente) => {
    setItemsConGuardadoPendiente((prev) => {
      const next = new Set(prev);
      if (tienePendiente) next.add(itemId);
      else next.delete(itemId);
      return next;
    });
  }, []);

  const items = useMemo(() => {
    const list = [...(lote?.items || [])];
    list.sort((a, b) => {
      const aTomador = isTomadorItem(a) ? 0 : 1;
      const bTomador = isTomadorItem(b) ? 0 : 1;
      if (aTomador !== bTomador) return aTomador - bTomador;
      return Number(a.id || 0) - Number(b.id || 0);
    });
    return list;
  }, [lote?.items]);

  const miembrosParaCopiar = useMemo(
    () => items.filter(itemElegibleParaCopiarEnBorrador).map(itemToCopyMember),
    [items]
  );

  const tomadorSourceId = useMemo(() => {
    const tomador = items.find(
      (item) => itemElegibleParaCopiarEnBorrador(item) && isTomadorItem(item)
    );
    return tomador?.id ?? null;
  }, [items]);

  const puedeAbrirCopiar =
    !loading &&
    !consolidando &&
    !copiandoDatos &&
    !showConfirmacionFinal &&
    itemsConGuardadoPendiente.size === 0 &&
    miembrosParaCopiar.length >= 2;

  const applyCopySelection = useCallback(
    async ({ sourceId, fieldKeys, copyAddress, targetIds }) => {
      const sourceItem = items.find(
        (item) => Number(item.id) === Number(sourceId)
      );
      if (!sourceItem || !Array.isArray(targetIds) || targetIds.length === 0) {
        return;
      }

      setCopiandoDatos(true);
      setError("");
      try {
        const actualizados = [];
        for (const targetId of targetIds) {
          const targetItem = items.find(
            (item) => Number(item.id) === Number(targetId)
          );
          if (!targetItem || !itemElegibleParaCopiarEnBorrador(targetItem)) {
            continue;
          }

          const patch = buildCopyPatchForItem(sourceItem, targetItem, {
            fieldKeys,
            copyAddress,
          });
          if (Object.keys(patch).length === 0) continue;

          const response = await apiRequest(
            `/pre-renovacion/items/${targetItem.id}`,
            "PUT",
            { datos_borrador: patch }
          );
          actualizados.push(response?.data ?? response);
        }

        actualizados.forEach((itemActualizado) => {
          if (itemActualizado?.id != null) {
            handleItemUpdated(itemActualizado);
          }
        });
        if (actualizados.length > 0) {
          setCardsRevision((n) => n + 1);
        }
      } catch (requestError) {
        console.error("Error al copiar datos en la pre-renovación", requestError);
        setError(getErrorMessage(requestError));
      } finally {
        setCopiandoDatos(false);
      }
    },
    [items, handleItemUpdated]
  );

  const defaultCoberturaTipo = useMemo(() => {
    const desdeItem = items.find((item) => item?.datos_borrador?.cobertura_tipo)
      ?.datos_borrador?.cobertura_tipo;
    const desdeCobertura = items.find((item) => item?.cobertura?.cobertura_tipo)
      ?.cobertura?.cobertura_tipo;
    return desdeItem || desdeCobertura || "Plan de salud";
  }, [items]);

  const handleAgregarPersonaNueva = async (e) => {
    e.preventDefault();
    const nombreCompleto = buildFullName(
      personaNuevaPrimerNombre,
      personaNuevaSegundoNombre,
      personaNuevaApellidos
    );
    if (!personaNuevaParentesco.trim() || !nombreCompleto) return;
    await agregarMiembroAlLote({
      parentesco: personaNuevaParentesco,
      cobertura_tipo: defaultCoberturaTipo,
      cliente: {
        nombre_completo: nombreCompleto,
        primer_nombre: personaNuevaPrimerNombre.trim() || null,
        segundo_nombre: personaNuevaSegundoNombre.trim() || null,
        apellidos: personaNuevaApellidos.trim() || null,
      },
    });
  };

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

  const hayGuardadosPendientes =
    itemsConGuardadoPendiente.size > 0 || copiandoDatos;
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
                  : `Pre-renovación ${anioDestino}`}
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
                    <strong>Esto es una pre-renovación.</strong> Puedes cerrar esta
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
                    <div className="alert alert-warning mb-3">
                      No hay coberturas activas candidatas para pre-renovar.
                      Puedes agregar un miembro nuevo solo para {anioDestino}.
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

                  {copiandoDatos && (
                    <div className="alert alert-light border py-2 small">
                      Copiando datos entre miembros de la pre-renovación…
                    </div>
                  )}

                  {!loading && (
                    <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
                      <h6 className="mb-0">
                        <i className="fas fa-users me-2" aria-hidden="true" />
                        Miembros
                      </h6>
                      <div className="btn-group">
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => {
                            setShowClienteExistente(false);
                            setShowPersonaNueva(true);
                          }}
                          disabled={
                            consolidando ||
                            agregandoMiembro ||
                            copiandoDatos ||
                            !lote?.id
                          }
                        >
                          Añadir
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-primary btn-sm"
                          onClick={() => {
                            setShowPersonaNueva(false);
                            setShowClienteExistente(true);
                          }}
                          disabled={
                            consolidando ||
                            agregandoMiembro ||
                            copiandoDatos ||
                            !lote?.id
                          }
                        >
                          <i className="fas fa-users me-1" aria-hidden="true" />
                          Miembros existentes
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm"
                          onClick={() => setShowCopiarDatos(true)}
                          disabled={!puedeAbrirCopiar}
                          title={
                            miembrosParaCopiar.length < 2
                              ? "Se necesitan al menos 2 miembros a renovar para copiar"
                              : "Copiar datos entre miembros de la pre-renovación"
                          }
                        >
                          <i className="fas fa-copy me-1" aria-hidden="true" />
                          Copiar
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="d-flex flex-column gap-3">
                    {items.map((item) => (
                      <PreRenovacionItemCard
                        key={`${item.id}-${cardsRevision}`}
                        item={item}
                        anioDestino={anioDestino}
                        onItemUpdated={handleItemUpdated}
                        onItemRemoved={handleItemRemoved}
                        attemptedConsolidar={attemptedConsolidar}
                        onSaveStateChange={handleSaveStateChange}
                      />
                    ))}
                  </div>

                  {!loading && lote?.id && showPersonaNueva && (
                    <form
                      className="card card-body mt-3"
                      onSubmit={handleAgregarPersonaNueva}
                    >
                      <div className="fw-semibold mb-2">
                        Persona nueva para {anioDestino}
                      </div>
                      <div className="row g-2 align-items-end">
                        <div className="col-md-3">
                          <label className="form-label form-label-sm">
                            Parentesco <span className="text-danger">*</span>
                          </label>
                          <select
                            className="form-select form-select-sm"
                            value={personaNuevaParentesco}
                            onChange={(e) =>
                              setPersonaNuevaParentesco(e.target.value)
                            }
                            required
                            disabled={agregandoMiembro}
                          >
                            <option value="">Seleccione…</option>
                            {TIPOS_PARENTESCO.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-md-3">
                          <label className="form-label form-label-sm">
                            Primer nombre <span className="text-danger">*</span>
                          </label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            value={personaNuevaPrimerNombre}
                            onChange={(e) =>
                              setPersonaNuevaPrimerNombre(e.target.value)
                            }
                            required
                            disabled={agregandoMiembro}
                          />
                        </div>
                        <div className="col-md-3">
                          <label className="form-label form-label-sm">
                            Segundo nombre
                          </label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            value={personaNuevaSegundoNombre}
                            onChange={(e) =>
                              setPersonaNuevaSegundoNombre(e.target.value)
                            }
                            disabled={agregandoMiembro}
                          />
                        </div>
                        <div className="col-md-3">
                          <label className="form-label form-label-sm">
                            Apellidos <span className="text-danger">*</span>
                          </label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            value={personaNuevaApellidos}
                            onChange={(e) =>
                              setPersonaNuevaApellidos(e.target.value)
                            }
                            required
                            disabled={agregandoMiembro}
                          />
                        </div>
                      </div>
                      <div className="d-flex gap-2 mt-3">
                        <button
                          type="submit"
                          className="btn btn-primary btn-sm"
                          disabled={
                            agregandoMiembro ||
                            !personaNuevaParentesco.trim() ||
                            !personaNuevaPrimerNombre.trim() ||
                            !personaNuevaApellidos.trim()
                          }
                        >
                          {agregandoMiembro ? "Agregando…" : "Agregar"}
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm"
                          onClick={() => {
                            setShowPersonaNueva(false);
                            setPersonaNuevaParentesco("");
                            setPersonaNuevaPrimerNombre("");
                            setPersonaNuevaSegundoNombre("");
                            setPersonaNuevaApellidos("");
                          }}
                          disabled={agregandoMiembro}
                        >
                          Cancelar
                        </button>
                      </div>
                    </form>
                  )}
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

      <ClienteExistenteModal
        open={showClienteExistente}
        grupoFamiliarId={grupoFamiliarId}
        defaultCoberturaTipo={defaultCoberturaTipo}
        onCreateCoberturaDeClienteExistente={handleAgregarClienteExistente}
        onClose={() => setShowClienteExistente(false)}
      />

      <CopiarDatosModal
        open={showCopiarDatos}
        onClose={() => setShowCopiarDatos(false)}
        members={miembrosParaCopiar}
        defaultSourceId={tomadorSourceId}
        zIndex={1080}
        onApply={applyCopySelection}
      />
    </>
  );
};

export default PreRenovacionModal;
