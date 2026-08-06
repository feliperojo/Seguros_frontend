// components/fase2/ProspectoBarra.jsx
import React, { useState } from "react";
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

const ProspectoBarra = ({ currentCode, grupoId, onDescartar, onReactivarSeguimiento }) => {
  const [showDescartarModal, setShowDescartarModal] = useState(false);
  const [descartando, setDescartando] = useState(false);
  const [showDetalleDescarte, setShowDetalleDescarte] = useState(false);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [detalleDescarte, setDetalleDescarte] = useState(null);
  const [errorDetalle, setErrorDetalle] = useState(null);

  const safeCode = (currentCode || "PROSPECTO").toUpperCase();
  const currentIndex = Math.max(0, STEPS.findIndex((s) => s.code === safeCode));
  
  // Determinar si se puede cambiar a DESCARTADO (hasta INSCRIPCION_INI inclusive)
  const inscripcionIniIndex = STEPS.findIndex((s) => s.code === "INSCRIPCION_INI");
  const puedeDescartar =
    safeCode !== "DESCARTADO" &&
    currentIndex <= inscripcionIniIndex &&
    grupoId &&
    onDescartar;
  const puedeReactivarSeguimiento = safeCode === "DESCARTADO" && grupoId && onReactivarSeguimiento;
  const puedeVerDetalleDescarte = safeCode === "DESCARTADO" && !!grupoId;

  const handleConfirmDescartar = async ({ motivo, metadata }) => {
    if (!onDescartar) return;
    setDescartando(true);
    try {
      await onDescartar({ motivo, metadata });
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
      const descartes = list.filter(
        (r) => String(r?.codigo || "").toUpperCase() === "DESCARTADO"
      );
      const ultimo = descartes.length ? descartes[descartes.length - 1] : null;
      setDetalleDescarte(ultimo);
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
              // Mostrar DESCARTADO solo si se puede descartar desde aquí
              // o cuando el grupo ya está efectivamente en estado DESCARTADO.
              if (s.code === "DESCARTADO" && !puedeDescartar && safeCode !== "DESCARTADO") {
                return null;
              }
              
              const isActive = idx === currentIndex;
              const isDone = idx < currentIndex;
              const esDescartadoClickable =
                s.code === "DESCARTADO" && puedeVerDetalleDescarte;

              return (
                <li
                  key={s.code}
                  className={`step ${isActive ? "active" : ""} ${isDone ? "done" : ""} ${s.code === "DESCARTADO" && safeCode === "DESCARTADO" ? "discarded" : ""} ${esDescartadoClickable ? "step-clickable" : ""}`}
                  title={
                    esDescartadoClickable
                      ? "Clic para ver motivo y nota del descarte"
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
