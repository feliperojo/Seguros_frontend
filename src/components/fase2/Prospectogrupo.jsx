// src/components/Prospectogrupo.jsx
import React, { useState, useEffect } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import { formatMoneyDisplay } from "../../services/ingresos";
import NuevaTareaModal from "../Tareas/NuevaTareaModal";

import RequerimientosModal from "../RequerimientosModal";
import DriveUrlModal from "../GrupoFamiliar/DriveUrlModal";
import HistorialRenovacionesModal from "../GrupoFamiliar/HistorialRenovacionesModal";
import RenovacionCoberturasModal from "../GrupoFamiliar/RenovacionCoberturasModal";
import HistorialCambiosModal from "../Reports/HistorialCambiosModal";
import ContactosGrupoModal from "../Contacto/ContactosGrupoModal";


const Prospectogrupo = ({
  formData = {},
  onChange,
  readOnly,
  grupoFamiliarId,
}) => {
  const [showGestion, setShowGestion] = useState(false);


  const [showDocumentosModal, setShowDocumentosModal] = useState(false);
  const [showDriveModal, setShowDriveModal] = useState(false);
  const [showHistorialRenovaciones, setShowHistorialRenovaciones] = useState(false);
  const [showRenovacionModal, setShowRenovacionModal] = useState(false);
  const [showHistorialCambios, setShowHistorialCambios] = useState(false);
  const [showContactosModal, setShowContactosModal] = useState(false);


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

  return (
    <>
      {/* Información del Prospecto (captación) */}
      <div className="card mb-4">
        <div className="card-header text-white">
          <h5 className="mb-0">Información del Prospecto</h5>
        </div>
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-4">
              <label className="form-label">Captado por:</label>
              <select
                className="form-select"
                name="captadoPor"
                value={formData.captadoPor || ""}
                onChange={onChange}
                disabled={readOnly}
              >
                <option value="Google">Google</option>
                <option value="Facebook">Facebook</option>
                <option value="Referido">Referido</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label">Cuál</label>
              <input
                type="text"
                className="form-control"
                name="cual"
                value={formData.cual || ""}
                onChange={onChange}
                disabled={readOnly}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label">Asesor</label>
              <input
                type="text"
                className="form-control"
                name="asesor"
                value={formData.asesor || ""}
                onChange={onChange}
                disabled={readOnly}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bloque económico */}
      <div className="card mb-4">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-3">
              <label className="form-label">ZIP Code</label>
              <input
                type="text"
                className="form-control"
                name="zipCode"
                value={formData.zipCode || ""}
                onChange={onChange}
                disabled={readOnly}
              />
            </div>
            <div className="col-md-3">
              <label className="form-label">Ingreso Familiar</label>
              <input
                type="text"
                className="form-control"
                name="ingresoFamiliar"
                value={formatMoneyDisplay(formData.ingresoFamiliar ?? 0)}
                onChange={onChange}
                readOnly
              />
              <div className="form-text">
                Sumatoria de los ingresos de cada miembro.
              </div>
            </div>
            <div className="col-md-3">
              <label className="form-label">Personas en Cobertura</label>
              <input
                type="number"
                className="form-control"
                name="personasCobertura"
                value={formData.personasCobertura ?? 0}
                readOnly
              />
              <div className="form-text">
                Se calcula con miembros en “Sí” y sin retiro.
              </div>
            </div>
            <div className="col-md-3">
              <label className="form-label">Personas en Taxes</label>
              <input
                type="number"
                className="form-control"
                name="personasTaxes"
                value={formData.personasTaxes ?? 0}
                readOnly
              />
              <div className="form-text">
                Se calcula con el número de miembros (cards).
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Utilidades */}
      <div className="card mb-4">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h6 className="mb-0">Utilidades</h6>
          <div className="d-flex gap-2 flex-wrap">
            {/* Contactos relacionados */}
<button
  className="btn btn-outline-info btn-sm d-flex align-items-center"
  onClick={() => setShowContactosModal(true)}
  disabled={!resolvedGrupoId}
  title={
    !resolvedGrupoId
      ? "Guarda primero el grupo familiar para ver los contactos relacionados"
      : "Ver contactos relacionados a este grupo familiar"
  }
>
  <i className="bi bi-people me-2"></i>
  Contactos
</button>


            {/* Historial de Cambios */}
            <button
              className="btn btn-outline-dark btn-sm d-flex align-items-center"
              onClick={() => setShowHistorialCambios(true)}
              disabled={!resolvedGrupoId}
              title={
                !resolvedGrupoId
                  ? "Guarda primero el grupo familiar para ver el historial de cambios"
                  : "Ver historial de modificaciones del grupo"
              }
            >
              <i className="bi bi-clock-history me-2"></i>
              Historial cambios
            </button>

            {/* Requerimientos */}
            <button
              className="btn btn-outline-success btn-sm d-flex align-items-center"
              onClick={() => setShowDocumentosModal(true)}
              disabled={!resolvedGrupoId}
              title={
                !resolvedGrupoId
                  ? "Primero debe existir el Grupo Familiar"
                  : "Abrir requerimientos"
              }
            >
              <i className="bi bi-folder2-open me-2"></i> Requerimientos
            </button>

            {/* Agregar/Editar URL de Drive */}
            <button
              className="btn btn-outline-primary btn-sm d-flex align-items-center"
              onClick={() => setShowDriveModal(true)}
              disabled={!resolvedGrupoId}
              title={
                !resolvedGrupoId
                  ? "Primero debe existir el Grupo Familiar"
                  : "Agregar/editar URL de Drive"
              }
            >
              <i className="bi bi-pencil-square me-2"></i>
              {driveUrl ? "Editar URL de Drive" : "Agregar URL de Drive"}
            </button>

            {/* Abrir Drive si ya hay URL */}
            {driveUrl && (
              <button
                className="btn btn-outline-success btn-sm d-flex align-items-center"
                onClick={() => window.open(driveUrl, "_blank")}
                title="Abrir carpeta/archivo en Drive"
              >
                <i className="bi bi-folder2-open me-2"></i> Abrir Drive
              </button>
            )}

            {/* Renovar coberturas (flujo principal) */}
            <button
              className="btn btn-outline-warning btn-sm d-flex align-items-center"
              onClick={() => setShowRenovacionModal(true)}
              disabled={!resolvedGrupoId}
              title={
                !resolvedGrupoId
                  ? "Guarda primero el grupo familiar para renovar coberturas"
                  : "Iniciar proceso de renovación de coberturas"
              }
            >
              <i className="bi bi-arrow-repeat me-2"></i>
              Renovar coberturas
            </button>

            {/* Historial de renovaciones (lista de años / snapshots) */}
            <button
              className="btn btn-outline-secondary btn-sm d-flex align-items-center"
              onClick={() => setShowHistorialRenovaciones(true)}
              disabled={!resolvedGrupoId}
              title={
                !resolvedGrupoId
                  ? "Guarda primero el grupo familiar para ver el historial"
                  : "Ver historial de renovaciones y versiones por año"
              }
            >
              <i className="bi bi-clock-history me-2"></i>
              Historial renovaciones
            </button>

            {/* Nueva Gestión (ya existente) */}
            <button
              className="btn btn-outline-primary btn-sm"
              onClick={() => setShowGestion(true)}
            >
              <i className="fas fa-tasks me-1"></i> Nueva Gestión
            </button>
          </div>
        </div>
      </div>

      {/* Modales existentes */}
      <NuevaTareaModal
        show={showGestion}
        onHide={() => setShowGestion(false)}
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

      {/* Modal: proceso de renovación (borrador + confirmación) */}
      <RenovacionCoberturasModal
        show={showRenovacionModal}
        onHide={() => setShowRenovacionModal(false)}
        grupoFamiliarId={resolvedGrupoId}
      />

      {/* Modal: historial de renovaciones / versiones por año */}
      <HistorialRenovacionesModal
        show={showHistorialRenovaciones}
        onHide={() => setShowHistorialRenovaciones(false)}
        grupoFamiliarId={resolvedGrupoId}
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


    </>
  );
};

export default Prospectogrupo;
