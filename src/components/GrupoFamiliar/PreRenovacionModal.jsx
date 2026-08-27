/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
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
import {
  ESTADOS_GESTION_EDITABLES,
  estadoGestionBadge,
  etiquetaEstadoGestion,
} from "../../utils/renovacionEstadoGestion";
import {
  buildPagadorOptionsFromItems,
  findCascadasSaludNoRenovar,
  findConflictosDentalSinSalud,
  isItemDental,
} from "../../utils/preRenovacionDental";

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

const formatHistorialFecha = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-CO", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const nombreMiembro = (item) =>
  item?.tipo_item === "miembro_nuevo"
    ? item?.datos_borrador?.cliente?.nombre_completo ||
      `Miembro nuevo #${item?.id || "?"}`
    : item?.cobertura?.cliente?.nombre_completo ||
      `Cobertura #${item?.cobertura_id || "?"}`;

const getErrorMessage = (error) => {
  const raw =
    error?.response?.data?.message ||
    error?.message ||
    "Ocurrió un error al procesar la pre-renovación.";
  const text = String(raw);
  // No mostrar SQL crudo al usuario (unique, SQLSTATE, etc.).
  if (
    /SQLSTATE|Unique violation|duplicate key|renovacion_lote_grupo_familiar_id_anio_destino_unique/i.test(
      text
    )
  ) {
    return "Este grupo ya tiene una renovación registrada para ese año. Revisa si ya fue consolidada o vuelve a abrir la pre-renovación.";
  }
  return text;
};

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
  const [estadoGestionDraft, setEstadoGestionDraft] = useState("");
  const [notaEstadoGestion, setNotaEstadoGestion] = useState("");
  const [guardandoEstadoGestion, setGuardandoEstadoGestion] = useState(false);
  const [guardandoPagoConfirmado, setGuardandoPagoConfirmado] = useState(false);

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
    setEstadoGestionDraft("");
    setNotaEstadoGestion("");
    setGuardandoEstadoGestion(false);
    setGuardandoPagoConfirmado(false);

    (async () => {
      try {
        const response = await apiRequest(
          `/grupo_familiar/${grupoFamiliarId}/pre-renovacion`,
          "POST",
          { anio_destino: anioDestino }
        );
        if (active) {
          const data = response?.data ?? response;
          setLote(data);
          setEstadoGestionDraft(data?.estado_gestion || "pre_renovacion");
        }
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

  useEffect(() => {
    if (lote?.estado_gestion) {
      setEstadoGestionDraft(lote.estado_gestion);
    }
  }, [lote?.estado_gestion]);

  const handleGuardarEstadoGestion = useCallback(async () => {
    if (!lote?.id || !estadoGestionDraft) return;
    if (estadoGestionDraft === lote.estado_gestion) return;
    if (!notaEstadoGestion.trim()) return;

    setGuardandoEstadoGestion(true);
    try {
      const body = {
        estado_gestion: estadoGestionDraft,
        nota: notaEstadoGestion.trim(),
      };
      const response = await apiRequest(
        `/renovacion_lote/${lote.id}/estado-gestion`,
        "PATCH",
        body
      );
      const updated = response?.data ?? response;
      setLote((prev) =>
        prev
          ? {
              ...prev,
              estado_gestion: updated?.estado_gestion ?? estadoGestionDraft,
              estado_historial:
                updated?.estado_historial ?? prev.estado_historial,
            }
          : prev
      );
      setNotaEstadoGestion("");
    } catch (requestError) {
      console.error("Error al actualizar estado de gestión", requestError);
      toast.error(getErrorMessage(requestError));
      setEstadoGestionDraft(lote.estado_gestion || "pre_renovacion");
    } finally {
      setGuardandoEstadoGestion(false);
    }
  }, [lote, estadoGestionDraft, notaEstadoGestion]);

  const handleTogglePagoConfirmado = useCallback(async () => {
    if (!lote?.id) return;

    const nuevoValor = !lote.pago_confirmado_externo;
    setGuardandoPagoConfirmado(true);
    try {
      const response = await apiRequest(
        `/renovacion_lote/${lote.id}/pago-confirmado`,
        "PATCH",
        { confirmado: nuevoValor }
      );
      const updated = response?.data ?? response;
      setLote((prev) =>
        prev
          ? {
              ...prev,
              pago_confirmado_externo:
                updated?.pago_confirmado_externo ?? nuevoValor,
              pago_confirmado_por: updated?.pago_confirmado_por ?? null,
              pago_confirmado_en: updated?.pago_confirmado_en ?? null,
            }
          : prev
      );
    } catch (requestError) {
      console.error("Error al actualizar confirmación de pago", requestError);
      toast.error(getErrorMessage(requestError));
    } finally {
      setGuardandoPagoConfirmado(false);
    }
  }, [lote]);

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

      const na = String(nombreMiembro(a)).toLowerCase();
      const nb = String(nombreMiembro(b)).toLowerCase();
      if (na !== nb) return na.localeCompare(nb, "es");

      const da = isItemDental(a) ? 1 : 0;
      const db = isItemDental(b) ? 1 : 0;
      if (da !== db) return da - db;

      return Number(a.id || 0) - Number(b.id || 0);
    });
    return list;
  }, [lote?.items]);

  const loteCerrado = ["consolidado", "confirmado"].includes(
    String(lote?.estado || "").toLowerCase()
  );
  // Igual que anulado: no_renovara no cierra el lote; el historial registra el cambio.
  const edicionBloqueada =
    loteCerrado ||
    ["anulado", "no_renovara", "consolidado"].includes(lote?.estado_gestion);
  const estadoGestionTerminal =
    loteCerrado || lote?.estado_gestion === "consolidado";
  const pagoConfirmadoBloqueado =
    loteCerrado || ["consolidado", "no_renovara"].includes(lote?.estado_gestion);

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
    !edicionBloqueada &&
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
    const saludItem = items.find(
      (item) =>
        !isItemDental(item) &&
        (item?.datos_borrador?.cobertura_tipo || item?.cobertura?.cobertura_tipo)
    );
    return (
      saludItem?.datos_borrador?.cobertura_tipo ||
      saludItem?.cobertura?.cobertura_tipo ||
      "Plan de salud"
    );
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

  const conflictosDentalSinSalud = useMemo(
    () => findConflictosDentalSinSalud(items, nombreMiembro),
    [items]
  );

  const cascadasSaludNoRenovar = useMemo(
    () => findCascadasSaludNoRenovar(items, nombreMiembro),
    [items]
  );

  const idsDentalConflicto = useMemo(
    () => new Set(conflictosDentalSinSalud.map((c) => Number(c.dental?.id))),
    [conflictosDentalSinSalud]
  );

  const idsSaludCascada = useMemo(
    () => new Set(cascadasSaludNoRenovar.map((c) => Number(c.salud?.id))),
    [cascadasSaludNoRenovar]
  );

  const pagadorOptions = useMemo(
    () => buildPagadorOptionsFromItems(items),
    [items]
  );

  const resumenProductos = useMemo(() => {
    let salud = 0;
    let dental = 0;
    items.forEach((item) => {
      if (isItemDental(item)) dental += 1;
      else salud += 1;
    });
    return { salud, dental };
  }, [items]);

  const hayGuardadosPendientes =
    itemsConGuardadoPendiente.size > 0 || copiandoDatos;
  const puedeConsolidar =
    items.length > 0 &&
    miembrosSinCodigo.length === 0 &&
    miembrosSinRetiro.length === 0 &&
    miembrosInactivosMarcadosRenovar.length === 0 &&
    conflictosDentalSinSalud.length === 0 &&
    !hayGuardadosPendientes &&
    !loading &&
    !consolidando &&
    !edicionBloqueada;

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
                      {miembrosARenovar.length === 1
                        ? "cobertura"
                        : "coberturas"}
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
                      {miembrosAOmitir.length === 1
                        ? "cobertura"
                        : "coberturas"}{" "}
                      — no se renovarán
                      {miembrosAOmitir.length > 0 && (
                        <span className="text-muted">
                          {" "}
                          ({miembrosAOmitir.map(nombreMiembro).join(", ")})
                        </span>
                      )}
                    </li>
                  </ul>

                  {cascadasSaludNoRenovar.length > 0 && (
                    <div className="alert alert-warning py-2">
                      <strong>Cascada dental:</strong> al no renovar Salud MS
                      de{" "}
                      {cascadasSaludNoRenovar.map((c) => c.nombre).join(", ")},
                      Dental MS del mismo miembro se retirará automáticamente.
                    </div>
                  )}

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

                  {!loading && lote?.id && (
                    <div className="border rounded p-3 mb-3 bg-light">
                      <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                        <span
                          className={`badge text-bg-${estadoGestionBadge(lote.estado_gestion).bg}`}
                        >
                          {estadoGestionBadge(lote.estado_gestion).label}
                        </span>
                        <select
                          className="form-select form-select-sm"
                          style={{ maxWidth: 220 }}
                          value={
                            estadoGestionTerminal
                              ? lote.estado_gestion
                              : estadoGestionDraft
                          }
                          disabled={
                            guardandoEstadoGestion ||
                            consolidando ||
                            estadoGestionTerminal
                          }
                          onChange={(e) =>
                            setEstadoGestionDraft(e.target.value)
                          }
                          aria-label="Estado de gestión"
                        >
                          {estadoGestionTerminal ? (
                            <option value={lote.estado_gestion}>
                              {estadoGestionBadge(lote.estado_gestion).label}
                            </option>
                          ) : (
                            ESTADOS_GESTION_EDITABLES.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))
                          )}
                        </select>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          style={{ maxWidth: 240 }}
                          placeholder="Nota (obligatoria): motivo del cambio"
                          required
                          value={notaEstadoGestion}
                          disabled={
                            guardandoEstadoGestion ||
                            consolidando ||
                            estadoGestionTerminal
                          }
                          onChange={(e) =>
                            setNotaEstadoGestion(e.target.value)
                          }
                        />
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          disabled={
                            guardandoEstadoGestion ||
                            consolidando ||
                            estadoGestionTerminal ||
                            !estadoGestionDraft ||
                            estadoGestionDraft === lote.estado_gestion ||
                            !notaEstadoGestion.trim()
                          }
                          onClick={handleGuardarEstadoGestion}
                        >
                          {guardandoEstadoGestion ? (
                            <>
                              <span
                                className="spinner-border spinner-border-sm me-1"
                                role="status"
                                aria-hidden="true"
                              />
                              Guardando…
                            </>
                          ) : (
                            "Guardar estado"
                          )}
                        </button>
                      </div>

                      {(lote.estado_historial || []).length > 0 && (
                        <ul
                          className="list-unstyled mb-0 small text-muted"
                          style={{
                            maxHeight: 140,
                            overflowY: "auto",
                          }}
                        >
                          {(lote.estado_historial || []).map((entry) => (
                            <li key={entry.id} className="mb-1">
                              <span>
                                {etiquetaEstadoGestion(entry.estado_anterior)}{" "}
                                → {etiquetaEstadoGestion(entry.estado_nuevo)}
                              </span>
                              {" · "}
                              <span>
                                {entry.creado_por?.name || "Sistema"}
                              </span>
                              {" · "}
                              <span>
                                {formatHistorialFecha(entry.created_at)}
                              </span>
                              {entry.nota ? (
                                <div className="fst-italic ms-1">
                                  {entry.nota}
                                </div>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      )}

                      <hr className="my-3" />
                      <div className="form-check">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          id="pagoConfirmadoExterno"
                          checked={!!lote.pago_confirmado_externo}
                          disabled={guardandoPagoConfirmado || pagoConfirmadoBloqueado}
                          onChange={handleTogglePagoConfirmado}
                        />
                        <label
                          className="form-check-label"
                          htmlFor="pagoConfirmadoExterno"
                        >
                          Pago confirmado externamente
                          {guardandoPagoConfirmado && (
                            <span
                              className="spinner-border spinner-border-sm ms-2"
                              role="status"
                              aria-hidden="true"
                            />
                          )}
                        </label>
                        <div className="form-text">
                          Marca esta opción únicamente si estás en el proceso de
                          cierre de renovaciones y confirmaste el pago revisando
                          la plataforma externa de la aseguradora. Al consolidar,
                          esto generará automáticamente los pagos reales de este
                          grupo como &quot;pagado&quot;. No la actives para el
                          flujo normal de pagos.
                        </div>
                        {lote.pago_confirmado_externo && (
                          <div className="small text-muted mt-1">
                            Confirmado por{" "}
                            {lote.pago_confirmado_por?.name || "—"}
                            {lote.pago_confirmado_en
                              ? ` el ${formatHistorialFecha(lote.pago_confirmado_en)}`
                              : ""}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

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

                  {attemptedConsolidar &&
                    conflictosDentalSinSalud.length > 0 && (
                      <div className="alert alert-danger">
                        <strong>Dental sin salud:</strong> no se puede renovar
                        Dental MS sin renovar Salud MS del mismo miembro. Corrige:{" "}
                        {conflictosDentalSinSalud
                          .map((c) => c.nombre)
                          .join(", ")}.
                      </div>
                    )}

                  {!loading && resumenProductos.dental > 0 && (
                    <div className="alert alert-info py-2 small">
                      <i className="fas fa-info-circle me-1" aria-hidden="true" />
                      Este lote incluye{" "}
                      <strong>{resumenProductos.salud}</strong> Salud MS y{" "}
                      <strong>{resumenProductos.dental}</strong> Dental MS.
                      Dental solo se renueva si Salud del mismo miembro también
                      se renueva. Si no renuevas Salud, Dental se retira en
                      cascada.
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
                            edicionBloqueada ||
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
                            edicionBloqueada ||
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
                        edicionBloqueada={edicionBloqueada}
                        pagadorOptions={pagadorOptions}
                        alertaDentalSinSalud={idsDentalConflicto.has(
                          Number(item.id)
                        )}
                        alertaCascadaSalud={idsSaludCascada.has(
                          Number(item.id)
                        )}
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
                            disabled={agregandoMiembro || edicionBloqueada}
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
                            : conflictosDentalSinSalud.length > 0
                              ? `Dental sin salud renovando: ${conflictosDentalSinSalud.map((c) => c.nombre).join(", ")}`
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
