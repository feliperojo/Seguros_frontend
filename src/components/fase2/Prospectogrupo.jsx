// src/components/fase2/Prospectogrupo.jsx
import React, { useState, useEffect } from "react";
import { formatMoneyDisplay } from "../../services/ingresos";
import NuevaTareaModal from "../Tareas/NuevaTareaModal";
import NuevoComentarioModal from "../Tareas/NuevoComentarioModal";
import RequerimientosModal from "../RequerimientosModal";
import DriveUrlModal from "../GrupoFamiliar/DriveUrlModal";
import HistorialCambiosModal from "../Reports/HistorialCambiosModal";
import ContactosGrupoModal from "../Contacto/ContactosGrupoModal";
import CambioVidaCancelacionModal from "../coberturas/CambioVidaCancelacionModal";
import HistorialCoberturasCanceladasModal from "../coberturas/HistorialCoberturasCanceladasModal";
import ReactivacionCoberturasModal from "../coberturas/ReactivacionCoberturasModal";
import GestorDocumentosGrupoFamiliar from "../Documentos/GestorDocumentosGrupoFamiliar";
import GroupTags from "../GroupTags";


const Prospectogrupo = ({
  formData = {},
  onChange,
  readOnly,
  grupoFamiliarId,
  onRefresh, // Función opcional para refrescar datos del grupo familiar
  estadoActual, // Estado actual del grupo familiar para validar visibilidad de botones
}) => {
  const [showGestion, setShowGestion] = useState(false);
  const [showComentarioModal, setShowComentarioModal] = useState(false);

  const [showDocumentosModal, setShowDocumentosModal] = useState(false);
  const [showDriveModal, setShowDriveModal] = useState(false);
  const [showHistorialCambios, setShowHistorialCambios] = useState(false);
  const [showContactosModal, setShowContactosModal] = useState(false);
  const [showCambioVidaModal, setShowCambioVidaModal] = useState(false);
  const [showHistorialCanceladasModal, setShowHistorialCanceladasModal] = useState(false);
  const [showReactivacionModal, setShowReactivacionModal] = useState(false);
  const [showGestorDocumentosModal, setShowGestorDocumentosModal] = useState(false);


  const [driveUrl, setDriveUrl] = useState(formData?.drive_url || "");

  // Si el padre actualiza formData.drive_url, sincronizamos
  useEffect(() => {
    if (formData?.drive_url !== undefined) {
      setDriveUrl(formData.drive_url || "");
    }
  }, [formData?.drive_url]);

  // ---- helpers teléfono (se mantienen) ----
  const formatPhone = (raw) => {
    const digits = String(raw || "").replace(/\D+/g, "");
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  };

  const handlePhoneChange = (name) => (e) => {
    const formatted = formatPhone(e.target.value);
    onChange?.({ target: { name, value: formatted, type: "text" } });
  };

  // Resolver id de grupo desde distintas fuentes
  const resolvedGrupoId =
    grupoFamiliarId ??
    formData?.grupo_familiar_id ??
    formData?.grupoFamiliarId ??
    formData?.grupo?.id ??
    formData?.grupo_id ??
    null;

  // Estados permitidos para mostrar el botón de Renovaciones
  // TOMA_DATOS, GRUPO_FAMILIAR (terminado), INSCRIPCION_INI
  const estadosPermitidosRenovaciones = ["TOMA_DATOS", "GRUPO_FAMILIAR", "INSCRIPCION_INI"];
  
  // Normalizar estado actual a mayúsculas para comparación
  const estadoNormalizado = estadoActual 
    ? (typeof estadoActual === 'string' 
        ? estadoActual.toUpperCase() 
        : (estadoActual.codigo || estadoActual.code || estadoActual.nombre || "").toUpperCase())
    : "";

  // Verificar si el estado actual permite renovaciones
  const puedeRenovar = estadosPermitidosRenovaciones.includes(estadoNormalizado);

  return (
    <div style={{ fontFamily: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"` }}>
      {/* Utilidades - Barra superior */}
      <div className="card mb-4 shadow-sm">
        <div className="card-body p-3">
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
            {/* Título y Etiquetas */}
            <div className="d-flex align-items-center gap-3 flex-grow-1" style={{ minWidth: '200px' }}>
              <div className="d-flex align-items-center">
                <i className="fas fa-tools text-primary me-2"></i>
                <h6 className="mb-0 fw-semibold" style={{ letterSpacing: '0.01em' }}>Utilidades</h6>
              </div>
              <div className="vr d-none d-md-block"></div>
              <div className="flex-grow-1" style={{ minWidth: '250px' }}>
                <label className="form-label mb-1 small text-muted" style={{ fontSize: '0.875rem', fontWeight: '500' }}>Etiquetas</label>
                <GroupTags
                  value={Array.isArray(formData?.etiquetas) ? formData.etiquetas : []}
                  onChange={(tags) => {
                    onChange?.({
                      target: {
                        name: "etiquetas",
                        value: tags,
                        type: "json"
                      }
                    });
                  }}
                  readOnly={readOnly}
                  className="w-100"
                />
              </div>
            </div>

            {/* Barra de navegación horizontal */}
            <div className="d-flex align-items-center gap-2" style={{ flexWrap: 'nowrap', overflowX: 'auto' }}>
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setShowContactosModal(true)}
                disabled={!resolvedGrupoId}
                title="Contactos relacionados"
                style={{ whiteSpace: 'nowrap', flexShrink: 0, fontSize: '0.875rem', fontWeight: '500' }}
              >
                <i className="bi bi-people me-1"></i>
                <span className="d-none d-lg-inline">Contactos</span>
              </button>
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setShowHistorialCambios(true)}
                disabled={!resolvedGrupoId}
                title="Historial de cambios"
                style={{ whiteSpace: 'nowrap', flexShrink: 0, fontSize: '0.875rem', fontWeight: '500' }}
              >
                <i className="bi bi-clock-history me-1"></i>
                <span className="d-none d-lg-inline">Historial</span>
              </button>
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setShowDocumentosModal(true)}
                disabled={!resolvedGrupoId}
                title="Requerimientos"
                style={{ whiteSpace: 'nowrap', flexShrink: 0, fontSize: '0.875rem', fontWeight: '500' }}
              >
                <i className="bi bi-folder2-open me-1"></i>
                <span className="d-none d-lg-inline">Requerimientos</span>
              </button>
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setShowDriveModal(true)}
                disabled={!resolvedGrupoId}
                title={driveUrl ? "Editar URL Drive" : "Agregar URL Drive"}
                style={{ whiteSpace: 'nowrap', flexShrink: 0, fontSize: '0.875rem', fontWeight: '500' }}
              >
                <i className="bi bi-pencil-square me-1"></i>
                <span className="d-none d-lg-inline">Drive</span>
              </button>
              <button
                className="btn btn-sm btn-outline-primary"
                onClick={() => setShowGestion(true)}
                disabled={!resolvedGrupoId}
                title="Nueva Tarea"
                style={{ whiteSpace: 'nowrap', flexShrink: 0, fontSize: '0.875rem', fontWeight: '500' }}
              >
                <i className="fas fa-tasks me-1"></i>
                <span className="d-none d-lg-inline">Nueva Tarea</span>
              </button>
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setShowComentarioModal(true)}
                disabled={!resolvedGrupoId}
                title="Nuevo Comentario"
                style={{ whiteSpace: 'nowrap', flexShrink: 0, fontSize: '0.875rem', fontWeight: '500' }}
              >
                <i className="fas fa-comment me-1"></i>
                <span className="d-none d-lg-inline">Comentario</span>
              </button>
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setShowGestorDocumentosModal(true)}
                disabled={!resolvedGrupoId}
                title="Gestor de documentos"
                style={{ whiteSpace: 'nowrap', flexShrink: 0, fontSize: '0.875rem', fontWeight: '500' }}
              >
                <i className="fas fa-folder-open me-1"></i>
                <span className="d-none d-lg-inline">Documentos</span>
              </button>
              {puedeRenovar && (
                <>
                  <button
                    className="btn btn-sm btn-outline-warning"
                    onClick={() => setShowCambioVidaModal(true)}
                    disabled={!resolvedGrupoId || readOnly}
                    title="Renovaciones"
                    style={{ whiteSpace: 'nowrap', flexShrink: 0, fontSize: '0.875rem', fontWeight: '500' }}
                  >
                    <i className="fas fa-exclamation-triangle me-1"></i>
                    <span className="d-none d-lg-inline">Renovaciones</span>
                  </button>
                  <button
                    className="btn btn-sm btn-outline-success"
                    onClick={() => setShowReactivacionModal(true)}
                    disabled={!resolvedGrupoId || readOnly}
                    title="Reactivar coberturas retiradas"
                    style={{ whiteSpace: 'nowrap', flexShrink: 0, fontSize: '0.875rem', fontWeight: '500' }}
                  >
                    <i className="fas fa-redo me-1"></i>
                    <span className="d-none d-lg-inline">Reactivar</span>
                  </button>
                  <button
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => setShowHistorialCanceladasModal(true)}
                    disabled={!resolvedGrupoId}
                    title="Historial de renovaciones"
                    style={{ whiteSpace: 'nowrap', flexShrink: 0, fontSize: '0.875rem', fontWeight: '500' }}
                  >
                    <i className="fas fa-history me-1"></i>
                    <span className="d-none d-lg-inline">Hist. Renov.</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Información del Prospecto (captación) */}
      <div className="card mb-4 shadow-sm">
        <div className="card-header bg-light">
          <h5 className="mb-0 fw-semibold" style={{ letterSpacing: '0.01em', fontSize: '1.1rem' }}>
            <i className="fas fa-info-circle text-primary me-2"></i>
            Información del Grupo Familiar
          </h5>
        </div>
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-4">
              <label className="form-label fw-medium" style={{ fontSize: '0.9rem', fontWeight: '500' }}>
                Captado por:
              </label>
              <select
                className="form-select"
                name="captadoPor"
                value={formData.captadoPor || ""}
                onChange={onChange}
                disabled={readOnly}
                style={{ fontSize: '0.9rem' }}
              >
                <option value="Google">Google</option>
                <option value="Facebook">Facebook</option>
                <option value="Referido">Referido</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label fw-medium" style={{ fontSize: '0.9rem', fontWeight: '500' }}>
                Cuál
              </label>
              <input
                type="text"
                className="form-control"
                name="cual"
                value={formData.cual || ""}
                onChange={onChange}
                disabled={readOnly}
                style={{ fontSize: '0.9rem' }}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label fw-medium" style={{ fontSize: '0.9rem', fontWeight: '500' }}>
                Asesor
              </label>
              <input
                type="text"
                className="form-control"
                name="asesor"
                value={formData.asesor || ""}
                onChange={onChange}
                disabled={readOnly}
                style={{ fontSize: '0.9rem' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bloque económico */}
      <div className="card mb-4 shadow-sm">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-6 col-lg-3">
              <label className="form-label fw-medium" style={{ fontSize: '0.9rem', fontWeight: '500' }}>
                ZIP Code
              </label>
              <input
                type="text"
                className="form-control"
                name="zipCode"
                value={formData.zipCode || ""}
                onChange={onChange}
                disabled={readOnly}
                style={{ fontSize: '0.9rem' }}
              />
            </div>
            <div className="col-md-6 col-lg-3">
              <label className="form-label fw-medium d-flex align-items-center" style={{ fontSize: '0.9rem', fontWeight: '500' }}>
                <i className="fas fa-dollar-sign text-success me-2"></i>
                Ingreso Familiar
              </label>
              <input
                type="text"
                className="form-control bg-light"
                name="ingresoFamiliar"
                value={formatMoneyDisplay(formData.ingresoFamiliar ?? 0)}
                onChange={onChange}
                readOnly
                style={{ fontSize: '0.9rem', fontWeight: '500' }}
              />
              <small className="text-muted d-flex align-items-center mt-1" style={{ fontSize: '0.8rem' }}>
                <i className="fas fa-info-circle me-1"></i>
                Sumatoria de los ingresos de cada miembro.
              </small>
            </div>
            <div className="col-md-6 col-lg-3">
              <label className="form-label fw-medium d-flex align-items-center" style={{ fontSize: '0.9rem', fontWeight: '500' }}>
                <i className="fas fa-shield-alt text-primary me-2"></i>
                Personas en Cobertura
              </label>
              <input
                type="number"
                className="form-control bg-light"
                name="personasCobertura"
                value={formData.personasCobertura ?? 0}
                readOnly
                style={{ fontSize: '0.9rem', fontWeight: '500' }}
              />
              <small className="text-muted d-flex align-items-center mt-1" style={{ fontSize: '0.8rem' }}>
                <i className="fas fa-info-circle me-1"></i>
                Se calcula con miembros en "Sí" y sin retiro.
              </small>
            </div>
            <div className="col-md-6 col-lg-3">
              <label className="form-label fw-medium d-flex align-items-center" style={{ fontSize: '0.9rem', fontWeight: '500' }}>
                <i className="fas fa-users text-info me-2"></i>
                Personas en Taxes
              </label>
              <input
                type="number"
                className="form-control bg-light"
                name="personasTaxes"
                value={formData.personasTaxes ?? 0}
                readOnly
                style={{ fontSize: '0.9rem', fontWeight: '500' }}
              />
              <small className="text-muted d-flex align-items-center mt-1" style={{ fontSize: '0.8rem' }}>
                <i className="fas fa-info-circle me-1"></i>
                Se calcula con el número de miembros (cards).
              </small>
            </div>
          </div>
        </div>
      </div>

      {/* Modales existentes */}
      <NuevaTareaModal
        show={showGestion}
        onHide={() => setShowGestion(false)}
        grupoFamiliarId={resolvedGrupoId}
      />

      <NuevoComentarioModal
        show={showComentarioModal}
        onHide={() => setShowComentarioModal(false)}
        grupoFamiliarId={resolvedGrupoId}
      />

      <RequerimientosModal
        show={showDocumentosModal}
        onHide={() => setShowDocumentosModal(false)}
        grupoFamiliarId={resolvedGrupoId}
      />

      <DriveUrlModal
        show={showDriveModal}
        onHide={() => setShowDriveModal(false)}
        grupoId={resolvedGrupoId}
        initialUrl={driveUrl}
        onSave={(newUrl) => {
          setDriveUrl(newUrl);
          onChange?.({
            target: { name: "drive_url", value: newUrl, type: "text" },
          });
        }}
      />

      <HistorialCambiosModal
  show={showHistorialCambios}
  onClose={() => setShowHistorialCambios(false)}
  modelo="GrupoFamiliar"
  modeloId={resolvedGrupoId}
/>
<ContactosGrupoModal
  show={showContactosModal}
  onHide={() => setShowContactosModal(false)}
  grupoFamiliarId={resolvedGrupoId}
  readOnly={true}
/>

<CambioVidaCancelacionModal
  show={showCambioVidaModal}
  onClose={() => setShowCambioVidaModal(false)}
  grupoFamiliarId={resolvedGrupoId}
  onSuccess={() => {
    // Si hay una función de refresh del padre, usarla; si no, recargar la página
    if (onRefresh && typeof onRefresh === "function") {
      onRefresh();
    } else {
      window.location.reload();
    }
  }}
/>

<HistorialCoberturasCanceladasModal
  show={showHistorialCanceladasModal}
  onClose={() => setShowHistorialCanceladasModal(false)}
  grupoFamiliarId={resolvedGrupoId}
/>

<ReactivacionCoberturasModal
  show={showReactivacionModal}
  onClose={() => setShowReactivacionModal(false)}
  grupoFamiliarId={resolvedGrupoId}
  onSuccess={() => {
    // Si hay una función de refresh del padre, usarla; si no, recargar la página
    if (onRefresh && typeof onRefresh === "function") {
      onRefresh();
    } else {
      window.location.reload();
    }
  }}
/>

<GestorDocumentosGrupoFamiliar
  show={showGestorDocumentosModal}
  onHide={() => setShowGestorDocumentosModal(false)}
  grupoFamiliarId={resolvedGrupoId}
/>


    </div>
  );
};

export default Prospectogrupo;
