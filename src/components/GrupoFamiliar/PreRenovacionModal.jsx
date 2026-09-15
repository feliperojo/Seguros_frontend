/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import apiRequest from "../../services/api";
import ClienteExistenteModal from "../fase2/ClienteExistenteModal";
import CopiarDatosModal from "../fase2/CopiarDatosModal";
import MemberModal from "../fase2/MemberModal";
import AgregarDentalModal from "../fase2/AgregarDentalModal";
import PreRenovacionItemCard from "./PreRenovacionItemCard";
import "../../styles/PreRenovacionModal.css";
import { pickClienteParaBorrador } from "../../utils/clienteFieldGroups";
import {
  buildCopyPatchForItem,
  isTomadorItem,
  itemElegibleParaCopiarEnBorrador,
  itemToCopyMember,
} from "../../utils/preRenovacionCopy";
import {
  ESTADOS_GESTION_EDITABLES,
  esEstadoGestionCierreSinDestino,
  estadoGestionBadge,
  etiquetaEstadoGestion,
} from "../../utils/renovacionEstadoGestion";
import {
  buildPagadorOptionsFromItems,
  etiquetaProductoItem,
  findCascadasSaludNoRenovar,
  findConflictosDentalSinSalud,
  isItemAltaEnLote,
  isItemDental,
  itemsSaludElegiblesParaDental,
  itemSaludToDentalMember,
} from "../../utils/preRenovacionDental";
import {
  isProductoSaludMs,
  prioridadOrdenListadoProducto,
} from "../../constants/coberturaTipos";
import systemConfigService from "../../services/SystemConfigService";
import { parseSystemConfigByTipo } from "../../utils/coverageFieldConfig";

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

/** Agrupa ítems por producto para el resumen de consolidación. */
const agruparItemsPorProducto = (lista = [], nombreFn) => {
  const map = new Map();
  (lista || []).forEach((item) => {
    const producto = etiquetaProductoItem(item);
    if (!map.has(producto)) {
      map.set(producto, []);
    }
    map.get(producto).push(nombreFn(item));
  });

  return Array.from(map.entries())
    .map(([producto, nombres]) => ({
      producto,
      count: nombres.length,
      nombres,
    }))
    .sort((a, b) => {
      const pa = prioridadOrdenListadoProducto(a.producto);
      const pb = prioridadOrdenListadoProducto(b.producto);
      if (pa !== pb) return pa - pb;
      return a.producto.localeCompare(b.producto, "es", { sensitivity: "base" });
    });
};

/** Año YYYY de una fecha ISO/YYYY-MM-DD, o null si no se puede leer. */
const anioDeFecha = (value) => {
  if (value == null || value === "") return null;
  const match = String(value).trim().match(/^(\d{4})/);
  return match ? Number(match[1]) : null;
};

const nombreMiembro = (item) =>
  isItemAltaEnLote(item)
    ? item?.datos_borrador?.cliente?.nombre_completo ||
      item?.cliente_existente?.nombre_completo ||
      (item?.tipo_item === "producto_nuevo"
        ? `Dental MS #${item?.id || "?"}`
        : `Miembro nuevo #${item?.id || "?"}`)
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
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [agregandoMiembro, setAgregandoMiembro] = useState(false);
  const [showCopiarDatos, setShowCopiarDatos] = useState(false);
  const [showDentalModal, setShowDentalModal] = useState(false);
  const [copiandoDatos, setCopiandoDatos] = useState(false);
  const [coverageFieldConfig, setCoverageFieldConfig] = useState(null);
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
    setShowMemberModal(false);
    setShowCopiarDatos(false);
    setShowDentalModal(false);
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

    systemConfigService
      .get("coverage_fields_by_tipo")
      .then((raw) => {
        if (active) setCoverageFieldConfig(parseSystemConfigByTipo(raw));
      })
      .catch(() => {
        if (active) setCoverageFieldConfig(null);
      });

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

  const handleItemRemoved = useCallback((itemIds) => {
    const ids = (Array.isArray(itemIds) ? itemIds : [itemIds])
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id));
    const idSet = new Set(ids);
    setLote((prev) =>
      prev
        ? {
            ...prev,
            items: (prev.items || []).filter(
              (item) => !idSet.has(Number(item.id))
            ),
          }
        : prev
    );
    setItemsConGuardadoPendiente((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  }, []);

  const agregarMiembroAlLote = useCallback(
    async (body) => {
      if (!lote?.id || !grupoFamiliarId) return false;
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
        setShowMemberModal(false);
        return true;
      } catch (requestError) {
        console.error("Error al agregar miembro nuevo", requestError);
        const message = getErrorMessage(requestError);
        setError(message);
        toast.error(message);
        return false;
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

      const ok = await agregarMiembroAlLote({
        parentesco: payload.tipo,
        cobertura_tipo: payload.cobertura_tipo,
        cliente_id_existente: clienteFull.id,
        cliente,
      });
      if (!ok) {
        throw new Error("No se pudo agregar el miembro existente a la pre-renovación.");
      }
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
  const esCierreSinDestino = esEstadoGestionCierreSinDestino(
    lote?.estado_gestion
  );
  const anioOrigen = Number(lote?.anio_origen) || Number(anioDestino) - 1;
  // Terminado / No renovará: no se editan miembros; Consolidar ejecuta el cierre del año origen.
  const edicionBloqueada =
    loteCerrado ||
    lote?.estado_gestion === "anulado" ||
    lote?.estado_gestion === "consolidado" ||
    esCierreSinDestino;
  const estadoGestionTerminal =
    loteCerrado || lote?.estado_gestion === "consolidado";
  const pagoConfirmadoBloqueado =
    loteCerrado ||
    lote?.estado_gestion === "consolidado" ||
    esCierreSinDestino;

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
    async ({ sourceId, fieldKeys, copyAddress, targetIds, includeDentalMs }) => {
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
            includeDentalMs: !!includeDentalMs,
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

  const handleCreateMemberFromModal = useCallback(
    async (payload) => {
      const cliente = pickClienteParaBorrador({
        ...payload,
        nombre_completo:
          payload?.nombre_completo || payload?.nombreCompleto || "",
      });
      if (!cliente.nombre_completo) {
        const nombre = [
          payload?.primer_nombre,
          payload?.segundo_nombre,
          payload?.apellidos,
        ]
          .map((v) => String(v || "").trim())
          .filter(Boolean)
          .join(" ");
        if (nombre) cliente.nombre_completo = nombre;
      }
      if (!cliente.nombre_completo) {
        const message = "El nombre completo es obligatorio.";
        setError(message);
        toast.error(message);
        throw new Error(message);
      }

      const ok = await agregarMiembroAlLote({
        parentesco: payload?.parentesco || payload?.tipo || "Tomador",
        cobertura_tipo: payload?.cobertura_tipo || defaultCoberturaTipo,
        cliente,
      });
      if (!ok) {
        throw new Error("No se pudo agregar el miembro a la pre-renovación.");
      }
    },
    [agregarMiembroAlLote, defaultCoberturaTipo]
  );

  const miembrosElegiblesDental = useMemo(
    () =>
      itemsSaludElegiblesParaDental(items).map((item) =>
        itemSaludToDentalMember(item, anioDestino)
      ),
    [items, anioDestino]
  );

  const handleCreateDentalEnLote = useCallback(
    async ({ member, payload }) => {
      if (!lote?.id || !grupoFamiliarId) {
        throw new Error("No hay pre-renovación abierta.");
      }
      const response = await apiRequest(
        `/grupo_familiar/${grupoFamiliarId}/pre-renovacion/${lote.id}/productos`,
        "POST",
        {
          miembro_origen_item_id: member?.item_id ?? member?.id,
          cobertura_tipo: payload?.cobertura_tipo,
          parentesco: payload?.parentesco,
          codigo_poliza: payload?.codigo_poliza,
          policy_number: payload?.policy_number,
          compania_id: payload?.compania_id,
          plan: payload?.plan,
          elegibilidad: payload?.elegibilidad,
          precio: payload?.precio,
          fecha_activacion: payload?.fecha_activacion,
          estado_cobertura: payload?.estado_cobertura,
          tipo_pago: payload?.tipo_pago,
          dia_pago: payload?.dia_pago,
          agente: payload?.agente,
          pagador_id: payload?.pagador_id,
          cliente_id_existente: member?.cliente_id || null,
        }
      );
      const nuevoItem = response?.data ?? response;
      setLote((prev) =>
        prev
          ? { ...prev, items: [...(prev.items || []), nuevoItem] }
          : prev
      );
      return nuevoItem;
    },
    [lote?.id, grupoFamiliarId]
  );

  const miembrosARenovar = useMemo(
    () => items.filter((item) => Boolean(item?.renovar)),
    [items]
  );

  const miembrosAOmitir = useMemo(
    () => items.filter((item) => !item?.renovar),
    [items]
  );

  const resumenRenuevanPorProducto = useMemo(
    () => agruparItemsPorProducto(miembrosARenovar, nombreMiembro),
    [miembrosARenovar]
  );

  const resumenOmitenPorProducto = useMemo(
    () => agruparItemsPorProducto(miembrosAOmitir, nombreMiembro),
    [miembrosAOmitir]
  );

  const resumenCierrePorProducto = useMemo(
    () => agruparItemsPorProducto(items, nombreMiembro),
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

  const miembrosConFechaFueraDeAnio = useMemo(
    () =>
      items
        .filter((item) => {
          if (!item?.renovar && !isItemAltaEnLote(item)) {
            return false;
          }
          const fecha = item?.datos_borrador?.fecha_activacion;
          if (fecha == null || String(fecha).trim() === "") {
            return false;
          }
          const anio = anioDeFecha(fecha);
          return anio == null || anio !== Number(anioDestino);
        })
        .map(nombreMiembro),
    [items, anioDestino]
  );

  const miembrosSinRetiro = useMemo(
    () =>
      items
        .filter((item) => {
          const requiereRetiro =
            !item?.renovar && Boolean(item?.cobertura?.activo);
          if (!requiereRetiro) return false;
          return !String(item?.datos_borrador?.motivo_retiro ?? "").trim();
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
  const loteProcesable =
    !loteCerrado &&
    lote?.estado_gestion !== "anulado" &&
    lote?.estado_gestion !== "consolidado";
  const puedeConsolidar = esCierreSinDestino
    ? items.length > 0 &&
      !hayGuardadosPendientes &&
      !loading &&
      !consolidando &&
      loteProcesable
    : items.length > 0 &&
      miembrosSinCodigo.length === 0 &&
      miembrosSinRetiro.length === 0 &&
      miembrosInactivosMarcadosRenovar.length === 0 &&
      miembrosConFechaFueraDeAnio.length === 0 &&
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
          className="modal-dialog modal-dialog-centered pr-modal"
          role="document"
        >
          <div className="modal-content pr-modal__content">
            <div className="modal-header pr-modal__header">
              <div className="pr-modal__header-main">
                <div className="pr-modal__header-icon" aria-hidden="true">
                  <i className="fas fa-sync-alt" />
                </div>
                <div>
                  <h5 className="modal-title pr-modal__title">
                    {showConfirmacionFinal
                      ? esCierreSinDestino
                        ? `Cerrar año fiscal ${anioOrigen}`
                        : `Confirmar consolidación ${anioDestino}`
                      : `Pre-renovación ${anioDestino}`}
                  </h5>
                  <p className="pr-modal__subtitle">
                    {showConfirmacionFinal
                      ? "Revisa el resumen antes de confirmar. Esta acción no se puede deshacer."
                      : "Los cambios se guardan solos. Nada se aplica a las pólizas hasta consolidar."}
                  </p>
                </div>
              </div>
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
                <div className="modal-body pr-modal__body">
                  <div className="alert alert-warning">
                    {esCierreSinDestino ? (
                      <>
                        <strong>
                          Esta acción cerrará {anioOrigen} sin crear{" "}
                          {anioDestino}.
                        </strong>{" "}
                        El estado {etiquetaEstadoGestion(lote?.estado_gestion)}{" "}
                        no genera año destino. No se puede deshacer.
                      </>
                    ) : (
                      <>
                        <strong>Esta acción ejecutará la renovación real</strong>{" "}
                        para este grupo y no se puede deshacer. Revisa el
                        resumen antes de continuar.
                      </>
                    )}
                  </div>

                  {error && (
                    <div className="alert alert-danger py-2">{error}</div>
                  )}

                  {esCierreSinDestino ? (
                    <div className="pr-resumen-renovacion">
                      <div className="pr-resumen-renovacion__card pr-resumen-renovacion__card--omit">
                        <div className="pr-resumen-renovacion__head">
                          <i className="fas fa-ban" aria-hidden="true" />
                          <span>Cierran {anioOrigen}</span>
                          <strong>{items.length}</strong>
                        </div>
                        {resumenCierrePorProducto.length === 0 ? (
                          <p className="pr-resumen-renovacion__empty">Sin coberturas</p>
                        ) : (
                          <ul className="pr-resumen-renovacion__list">
                            {resumenCierrePorProducto.map((row) => (
                              <li key={`cierre-${row.producto}`}>
                                <div className="pr-resumen-renovacion__producto">
                                  <span>{row.producto}</span>
                                  <strong>{row.count}</strong>
                                </div>
                                <div className="pr-resumen-renovacion__nombres">
                                  {row.nombres.join(", ")}
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                        <p className="pr-resumen-renovacion__note">
                          No se creará {anioDestino}.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="pr-resumen-renovacion">
                      <div className="pr-resumen-renovacion__card pr-resumen-renovacion__card--ok">
                        <div className="pr-resumen-renovacion__head">
                          <i className="fas fa-check-circle" aria-hidden="true" />
                          <span>Se renuevan</span>
                          <strong>{miembrosARenovar.length}</strong>
                        </div>
                        {resumenRenuevanPorProducto.length === 0 ? (
                          <p className="pr-resumen-renovacion__empty">Ninguna</p>
                        ) : (
                          <ul className="pr-resumen-renovacion__list">
                            {resumenRenuevanPorProducto.map((row) => (
                              <li key={`renovar-${row.producto}`}>
                                <div className="pr-resumen-renovacion__producto">
                                  <span>{row.producto}</span>
                                  <strong>{row.count}</strong>
                                </div>
                                <div className="pr-resumen-renovacion__nombres">
                                  {row.nombres.join(", ")}
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div className="pr-resumen-renovacion__card pr-resumen-renovacion__card--omit">
                        <div className="pr-resumen-renovacion__head">
                          <i className="fas fa-ban" aria-hidden="true" />
                          <span>Se omiten</span>
                          <strong>{miembrosAOmitir.length}</strong>
                        </div>
                        {resumenOmitenPorProducto.length === 0 ? (
                          <p className="pr-resumen-renovacion__empty">Ninguna</p>
                        ) : (
                          <ul className="pr-resumen-renovacion__list">
                            {resumenOmitenPorProducto.map((row) => (
                              <li key={`omitir-${row.producto}`}>
                                <div className="pr-resumen-renovacion__producto">
                                  <span>{row.producto}</span>
                                  <strong>{row.count}</strong>
                                </div>
                                <div className="pr-resumen-renovacion__nombres">
                                  {row.nombres.join(", ")}
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  )}

                  {!esCierreSinDestino && cascadasSaludNoRenovar.length > 0 && (
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
                      {esCierreSinDestino
                        ? `Confirmo el cierre de ${anioOrigen} sin generar ${anioDestino} para este grupo.`
                        : "Confirmo que revisé la información de todos los miembros y quiero ejecutar la renovación real para este grupo."}
                    </label>
                  </div>
                </div>

                <div className="modal-footer pr-modal__footer">
                  <button
                    type="button"
                    className="btn btn-secondary pr-btn-cancel"
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
                        {esCierreSinDestino
                          ? "Cerrando…"
                          : "Consolidando…"}
                      </>
                    ) : esCierreSinDestino ? (
                      `Sí, cerrar ${anioOrigen}`
                    ) : (
                      "Sí, consolidar ahora"
                    )}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="modal-body pr-modal__body">
                  <div className="alert alert-info">
                    {esCierreSinDestino ? (
                      <>
                        <strong>
                          {etiquetaEstadoGestion(lote?.estado_gestion)}:
                        </strong>{" "}
                        no se editan miembros ni se crea {anioDestino}. Usa
                        “Cerrar año fiscal” para aplicar el retiro de{" "}
                        {anioOrigen}.
                      </>
                    ) : (
                      <>
                        <strong>Esto es una pre-renovación.</strong> Puedes
                        cerrar esta ventana y volver más tarde — cada cambio se
                        guarda automáticamente. Nada se aplica a las pólizas
                        reales hasta que uses “Consolidar”.
                      </>
                    )}
                  </div>

                  {!loading && lote?.id && (
                    <div className="pr-panel mb-3">
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

                  {attemptedConsolidar &&
                    !esCierreSinDestino &&
                    miembrosSinCodigo.length > 0 && (
                    <div className="alert alert-warning">
                      Completa el <strong>código de póliza</strong> de:{" "}
                      {miembrosSinCodigo.join(", ")}.
                    </div>
                  )}

                  {attemptedConsolidar &&
                    !esCierreSinDestino &&
                    miembrosConFechaFueraDeAnio.length > 0 && (
                      <div className="alert alert-warning">
                        La <strong>fecha de activación</strong> debe pertenecer
                        al año {anioDestino} en:{" "}
                        {miembrosConFechaFueraDeAnio.join(", ")}.
                      </div>
                    )}

                  {attemptedConsolidar &&
                    !esCierreSinDestino &&
                    miembrosSinRetiro.length > 0 && (
                    <div className="alert alert-warning">
                      Completa la{" "}
                      <strong>fecha y el motivo de retiro</strong> de:{" "}
                      {miembrosSinRetiro.join(", ")}.
                    </div>
                  )}

                  {!esCierreSinDestino &&
                    miembrosInactivosMarcadosRenovar.length > 0 && (
                    <div className="alert alert-warning">
                      Hay coberturas ya <strong>inactivas</strong> (anuladas,
                      retiradas o canceladas) marcadas para renovar:{" "}
                      {miembrosInactivosMarcadosRenovar.join(", ")}. Desmarca{" "}
                      <strong>Renovar esta cobertura</strong> o vuelve a abrir
                      la pre-renovación para sincronizarlas. Mientras estén
                      marcadas, no se puede consolidar.
                    </div>
                  )}

                  {attemptedConsolidar &&
                    !esCierreSinDestino &&
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
                      cascada. Puedes agregar Dental MS nuevo para {anioDestino}
                      y quitarlo del borrador si te arrepientes.
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
                    <div className="pr-toolbar">
                      <h6>
                        <i className="fas fa-users me-2" aria-hidden="true" />
                        Miembros
                      </h6>
                      <div className="btn-group">
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => {
                            setShowClienteExistente(false);
                            setShowMemberModal(true);
                          }}
                          disabled={
                            consolidando ||
                            edicionBloqueada ||
                            agregandoMiembro ||
                            copiandoDatos ||
                            !lote?.id
                          }
                        >
                          <i className="fas fa-plus me-1" aria-hidden="true" />
                          Añadir
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-primary btn-sm"
                          onClick={() => {
                            setShowMemberModal(false);
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
                        {isProductoSaludMs(defaultCoberturaTipo) && (
                          <button
                            type="button"
                            className="btn btn-outline-info btn-sm"
                            onClick={() => setShowDentalModal(true)}
                            disabled={
                              consolidando ||
                              edicionBloqueada ||
                              agregandoMiembro ||
                              copiandoDatos ||
                              !lote?.id
                            }
                            title={`Agregar Dental MS ${anioDestino} a miembros que renuevan Salud y aún no tienen dental`}
                          >
                            <i className="fas fa-tooth me-1" aria-hidden="true" />
                            Agregar Dental MS
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="d-flex flex-column gap-3">
                    {items.map((item) => (
                      <PreRenovacionItemCard
                        key={`${item.id}-${cardsRevision}`}
                        item={item}
                        anioDestino={anioDestino}
                        anioOrigen={anioOrigen}
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
                        coverageFieldConfig={coverageFieldConfig}
                      />
                    ))}
                  </div>
                </div>

                <div className="modal-footer pr-modal__footer">
                  <button
                    type="button"
                    className="btn btn-secondary pr-btn-cancel"
                    onClick={handleClose}
                    disabled={consolidando}
                  >
                    Cerrar
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary pr-btn-confirm"
                    onClick={handleConsolidar}
                    disabled={!puedeConsolidar}
                    title={
                      esCierreSinDestino
                        ? hayGuardadosPendientes
                          ? "Espera a que termine el autoguardado"
                          : `Cierra ${anioOrigen} sin crear ${anioDestino}`
                        : miembrosSinCodigo.length > 0
                          ? `Falta código de póliza: ${miembrosSinCodigo.join(", ")}`
                          : miembrosConFechaFueraDeAnio.length > 0
                            ? `Fecha de activación fuera de ${anioDestino}: ${miembrosConFechaFueraDeAnio.join(", ")}`
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
                    {esCierreSinDestino
                      ? `Cerrar año fiscal ${anioOrigen}`
                      : "Consolidar ahora"}
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
        onClick={() => {
          if (showMemberModal || showClienteExistente || showCopiarDatos || showDentalModal) return;
          handleClose();
        }}
      />

      <MemberModal
        open={showMemberModal}
        onClose={() => setShowMemberModal(false)}
        editingMember={null}
        defaultCoberturaTipo={defaultCoberturaTipo}
        readOnly={edicionBloqueada}
        isProspecto={false}
        onCreateRemote={handleCreateMemberFromModal}
        onRequestExistingClientModal={() => {
          setShowMemberModal(false);
          setShowClienteExistente(true);
        }}
        zIndex={1085}
      />

      <ClienteExistenteModal
        open={showClienteExistente}
        grupoFamiliarId={grupoFamiliarId}
        defaultCoberturaTipo={defaultCoberturaTipo}
        contexto="pre_renovacion"
        loteId={lote?.id ?? null}
        anioDestino={anioDestino}
        onCreateCoberturaDeClienteExistente={handleAgregarClienteExistente}
        onClose={() => setShowClienteExistente(false)}
      />

      <CopiarDatosModal
        open={showCopiarDatos}
        onClose={() => setShowCopiarDatos(false)}
        members={miembrosParaCopiar}
        defaultSourceId={tomadorSourceId}
        zIndex={1080}
        allowIncludeDentalMs={isProductoSaludMs(defaultCoberturaTipo)}
        onApply={applyCopySelection}
      />

      <AgregarDentalModal
        open={showDentalModal}
        onClose={() => setShowDentalModal(false)}
        members={miembrosElegiblesDental}
        grupoFamiliarId={grupoFamiliarId}
        anioDestino={anioDestino}
        zIndex={1095}
        subtitle={`Dental MS para la pre-renovación ${anioDestino}. Se guarda en el borrador; no se aplica hasta consolidar.`}
        emptyDescription="Solo aparecen miembros con Salud MS marcada para renovar (o miembros nuevos) que aún no tienen Dental MS en este lote."
        createDentalCoverage={handleCreateDentalEnLote}
        onDentalCreated={() => setShowDentalModal(false)}
      />
    </>
  );
};

export default PreRenovacionModal;
