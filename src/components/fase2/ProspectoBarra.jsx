// components/fase2/ProspectoBarra.jsx
import React, { useEffect, useState } from "react";
import "../../styles/ProspectoBarra.css";
import DescartarGrupoModal from "../GrupoFamiliar/DescartarGrupoModal";
import DetalleDescarteModal from "../GrupoFamiliar/DetalleDescarteModal";
import GrupoFamiliarService from "../../services/GrupoFamiliarService";

const STEPS = [
  { code: "PROSPECTO",       label: "PROSPECTO" },
  { code: "COTIZACION",      label: "COTIZACIÓN" },
  { code: "SEGUIMIENTO",     label: "SEGUIMIENTO" },
  { code: "TOMA_DATOS",      label: "TOMA DE DATOS" },
  { code: "INSCRIPCION_INI", label: "INSCRIPCIÓN / CONFIRMACIÓN" },
  { code: "GRUPO_FAMILIAR",       label: "TERMINADO" },
  { code: "DESCARTADO",      label: "DESCARTADO" },
];

const esCodigoDescartado = (codigo) =>
  String(codigo || "").toUpperCase() === "DESCARTADO";

const ProspectoBarra = ({
  currentCode,
  grupoId,
  onDescartar,
  onReactivarSeguimiento,
  productoLabel = null,
}) => {
  const [showDescartarModal, setShowDescartarModal] = useState(false);
  const [descartando, setDescartando] = useState(false);
  const [showDetalleDescarte, setShowDetalleDescarte] = useState(false);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [detalleDescarte, setDetalleDescarte] = useState(null);
  const [errorDetalle, setErrorDetalle] = useState(null);
  /** Hay al menos un descarte en historial (aunque el GF ya esté reactivado). */
  const [tuvoDescarte, setTuvoDescarte] = useState(false);

  const safeCode = (currentCode || "PROSPECTO").toUpperCase();
  const currentIndex = Math.max(0, STEPS.findIndex((s) => s.code === safeCode));
  const estaDescartado = safeCode === "DESCARTADO";

  // Determinar si se puede cambiar a DESCARTADO (hasta INSCRIPCION_INI inclusive)
  const inscripcionIniIndex = STEPS.findIndex((s) => s.code === "INSCRIPCION_INI");
  const puedeDescartar =
    !estaDescartado &&
    currentIndex <= inscripcionIniIndex &&
    grupoId &&
    onDescartar;
  const puedeReactivarSeguimiento = estaDescartado && grupoId && onReactivarSeguimiento;
  // Paso 7 solo si está descartado o ya tuvo un descarte (p. ej. reactivado)
  const puedeVerDetalleDescarte = !!grupoId && (estaDescartado || tuvoDescarte);
  const mostrarPasoDescartado = estaDescartado || tuvoDescarte;
  const enInscripcionConfirmacion = safeCode === "INSCRIPCION_INI";
  const nombreProducto = (productoLabel || "").toString().trim();

  useEffect(() => {
    if (!grupoId) {
      setTuvoDescarte(false);
      return undefined;
    }

    let cancelled = false;

    (async () => {
      try {
        const rows = await GrupoFamiliarService.getHistorialEstado(grupoId);
        const list = Array.isArray(rows)
          ? rows
          : Array.isArray(rows?.data)
            ? rows.data
            : [];
        const hayDescarte = list.some((r) => esCodigoDescartado(r?.codigo));
        if (!cancelled) setTuvoDescarte(hayDescarte);
      } catch (e) {
        console.error("Error al consultar historial de descarte:", e);
        if (!cancelled) setTuvoDescarte(estaDescartado);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [grupoId, safeCode, estaDescartado]);

  const handleConfirmDescartar = async ({ motivo, metadata }) => {
    if (!onDescartar) return;
    setDescartando(true);
    try {
      await onDescartar({ motivo, metadata });
      setTuvoDescarte(true);
      setShowDescartarModal(false);
    } catch (error) {
      console.error("Error al cambiar estado a DESCARTADO:", error);
      alert(error?.message || "Error al cambiar el estado a DESCARTADO");
    } finally {
      setDescartando(false);
    }
  };

  const handleReactivarSeguimiento = async () => {
    if (!window.confirm("¿Desea reactivar este grupo familiar y volverlo a SEGUIMIENTO?")) {
      return;
    }

    if (onReactivarSeguimiento) {
      try {
        await onReactivarSeguimiento();
        setTuvoDescarte(true);
      } catch (error) {
        console.error("Error al cambiar estado a SEGUIMIENTO:", error);
        alert("Error al cambiar el estado a SEGUIMIENTO");
      }
    }
  };

  const handleClickDescartado = async () => {
    if (!puedeVerDetalleDescarte) return;

    setShowDetalleDescarte(true);
    setLoadingDetalle(true);
    setErrorDetalle(null);
    setDetalleDescarte(null);

    try {
      const rows = await GrupoFamiliarService.getHistorialEstado(grupoId);
      const list = Array.isArray(rows) ? rows : Array.isArray(rows?.data) ? rows.data : [];
      const descartes = list.filter((r) => esCodigoDescartado(r?.codigo));
      const ultimo = descartes.length ? descartes[descartes.length - 1] : null;
      setDetalleDescarte(ultimo);
      if (ultimo) setTuvoDescarte(true);
    } catch (e) {
      console.error("Error al cargar detalle de descarte:", e);
      setErrorDetalle(e?.message || "No se pudo cargar el motivo del descarte.");
    } finally {
      setLoadingDetalle(false);
    }
  };

  return (
    <div className="mb-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="flex-grow-1">
          <ul className="progressbar d-flex justify-content-between list-unstyled mb-0">
            {STEPS.map((s, idx) => {
              if (s.code === "DESCARTADO" && !mostrarPasoDescartado) {
                return null;
              }

              const isActive = idx === currentIndex;
              const isDone = idx < currentIndex;
              const esPasoDescartado = s.code === "DESCARTADO";
              const esDescartadoClickable =
                esPasoDescartado && puedeVerDetalleDescarte;
              const estiloDescartado = esPasoDescartado
                ? estaDescartado
                  ? "discarded"
                  : tuvoDescarte
                    ? "discarded-history"
                    : ""
                : "";

              return (
                <li
                  key={s.code}
                  className={`step ${isActive ? "active" : ""} ${isDone ? "done" : ""} ${estiloDescartado} ${esDescartadoClickable ? "step-clickable" : ""}`}
                  title={
                    esDescartadoClickable
                      ? estaDescartado
                        ? "Clic para ver motivo y nota del descarte"
                        : "Clic para ver el descarte anterior (grupo reactivado)"
                      : s.code
                  }
                  role={esDescartadoClickable ? "button" : undefined}
                  tabIndex={esDescartadoClickable ? 0 : undefined}
                  onClick={esDescartadoClickable ? handleClickDescartado : undefined}
                  onKeyDown={
                    esDescartadoClickable
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleClickDescartado();
                          }
                        }
                      : undefined
                  }
                >
                  <span>{s.label}</span>
                </li>
              );
            })}
          </ul>
        </div>
        {puedeDescartar && (
          <button
            type="button"
            className="btn btn-outline-danger ms-3"
            onClick={() => setShowDescartarModal(true)}
            title="Marcar como descartado"
          >
            <i className="fas fa-times-circle me-2"></i>
            Marcar como Descartado
          </button>
        )}
        {puedeReactivarSeguimiento && (
          <button
            type="button"
            className="btn btn-outline-primary ms-3"
            onClick={handleReactivarSeguimiento}
            title="Volver a seguimiento"
          >
            <i className="fas fa-undo me-2"></i>
            Reactivar en Seguimiento
          </button>
        )}
      </div>

      {enInscripcionConfirmacion && (
        <div className="prospecto-etapa-aviso" role="status">
          <div className="prospecto-etapa-aviso__titulo">
            Etapa actual: Inscripción / Confirmación
          </div>
          <p className="prospecto-etapa-aviso__texto mb-0">
            {nombreProducto ? (
              <>
                El producto <strong>{nombreProducto}</strong> queda a la espera de
                inscripción, verificación de aceptación del pago y activación por
                la aseguradora.
              </>
            ) : (
              <>
                El producto queda a la espera de inscripción, verificación de
                aceptación del pago y activación por la aseguradora.
              </>
            )}
          </p>
        </div>
      )}

      <DescartarGrupoModal
        show={showDescartarModal}
        loading={descartando}
        onHide={() => {
          if (!descartando) setShowDescartarModal(false);
        }}
        onConfirm={handleConfirmDescartar}
      />

      <DetalleDescarteModal
        show={showDetalleDescarte}
        onHide={() => setShowDetalleDescarte(false)}
        loading={loadingDetalle}
        registro={detalleDescarte}
        error={errorDetalle}
      />
    </div>
  );
};

export default ProspectoBarra;
