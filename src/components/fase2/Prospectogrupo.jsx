// src/components/fase2/Prospectogrupo.jsx
import React, { useState, useEffect } from "react";
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
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6 overflow-hidden">
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
          <h5 className="text-gray-800 font-semibold text-lg mb-0 flex items-center gap-2">
            <i className="fas fa-info-circle text-gray-600"></i>
            Información del Grupo Familiar
          </h5>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Captado por:
              </label>
              <select
                className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-30 focus:border-blue-500 transition-all duration-200 disabled:bg-gray-50 disabled:cursor-not-allowed bg-white shadow-sm"
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cuál
              </label>
              <input
                type="text"
                className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-30 focus:border-blue-500 transition-all duration-200 disabled:bg-gray-50 disabled:cursor-not-allowed shadow-sm"
                name="cual"
                value={formData.cual || ""}
                onChange={onChange}
                disabled={readOnly}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Asesor
              </label>
              <input
                type="text"
                className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-30 focus:border-blue-500 transition-all duration-200 disabled:bg-gray-50 disabled:cursor-not-allowed shadow-sm"
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
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6 overflow-hidden">
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ZIP Code
              </label>
              <input
                type="text"
                className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-30 focus:border-blue-500 transition-all duration-200 disabled:bg-gray-50 disabled:cursor-not-allowed shadow-sm"
                name="zipCode"
                value={formData.zipCode || ""}
                onChange={onChange}
                disabled={readOnly}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <i className="fas fa-dollar-sign text-green-600"></i>
                Ingreso Familiar
              </label>
              <input
                type="text"
                className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg bg-gray-50 cursor-not-allowed font-semibold text-gray-700"
                name="ingresoFamiliar"
                value={formatMoneyDisplay(formData.ingresoFamiliar ?? 0)}
                onChange={onChange}
                readOnly
              />
              <div className="text-xs text-gray-500 mt-1.5 flex items-center gap-1">
                <i className="fas fa-info-circle"></i>
                Sumatoria de los ingresos de cada miembro.
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <i className="fas fa-shield-alt text-blue-600"></i>
                Personas en Cobertura
              </label>
              <input
                type="number"
                className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg bg-gray-50 cursor-not-allowed font-semibold text-gray-700"
                name="personasCobertura"
                value={formData.personasCobertura ?? 0}
                readOnly
              />
              <div className="text-xs text-gray-500 mt-1.5 flex items-center gap-1">
                <i className="fas fa-info-circle"></i>
                Se calcula con miembros en “Sí” y sin retiro.
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <i className="fas fa-users text-purple-600"></i>
                Personas en Taxes
              </label>
              <input
                type="number"
                className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg bg-gray-50 cursor-not-allowed font-semibold text-gray-700"
                name="personasTaxes"
                value={formData.personasTaxes ?? 0}
                readOnly
              />
              <div className="text-xs text-gray-500 mt-1.5 flex items-center gap-1">
                <i className="fas fa-info-circle"></i>
                Se calcula con el número de miembros (cards).
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Utilidades */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6 overflow-hidden">
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
          <h6 className="text-gray-800 font-semibold text-base mb-0 flex items-center gap-2">
            <i className="fas fa-tools text-gray-600"></i>
            Utilidades
          </h6>
        </div>
        <div className="p-6">
          <div className="flex flex-wrap gap-3">
            {/* Contactos relacionados */}
            <button
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border border-cyan-300 text-cyan-700 bg-cyan-50 hover:bg-cyan-100 hover:border-cyan-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-cyan-50"
              onClick={() => setShowContactosModal(true)}
              disabled={!resolvedGrupoId}
              title={
                !resolvedGrupoId
                  ? "Guarda primero el grupo familiar para ver los contactos relacionados"
                  : "Ver contactos relacionados a este grupo familiar"
              }
            >
              <i className="bi bi-people"></i>
              Contactos
            </button>

            {/* Historial de Cambios */}
            <button
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 bg-gray-50 hover:bg-gray-100 hover:border-gray-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-50"
              onClick={() => setShowHistorialCambios(true)}
              disabled={!resolvedGrupoId}
              title={
                !resolvedGrupoId
                  ? "Guarda primero el grupo familiar para ver el historial de cambios"
                  : "Ver historial de modificaciones del grupo"
              }
            >
              <i className="bi bi-clock-history"></i>
              Historial cambios
            </button>

            {/* Requerimientos */}
            <button
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 hover:border-green-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-green-50"
              onClick={() => setShowDocumentosModal(true)}
              disabled={!resolvedGrupoId}
              title={
                !resolvedGrupoId
                  ? "Primero debe existir el Grupo Familiar"
                  : "Abrir requerimientos"
              }
            >
              <i className="bi bi-folder2-open"></i>
              Requerimientos
            </button>

            {/* Agregar/Editar URL de Drive */}
            <button
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 hover:border-blue-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-50"
              onClick={() => setShowDriveModal(true)}
              disabled={!resolvedGrupoId}
              title={
                !resolvedGrupoId
                  ? "Primero debe existir el Grupo Familiar"
                  : "Agregar/editar URL de Drive"
              }
            >
              <i className="bi bi-pencil-square"></i>
              {driveUrl ? "Editar URL de Drive" : "Agregar URL de Drive"}
            </button>

            {/* Abrir Drive si ya hay URL */}
            {driveUrl && (
              <button
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 hover:border-green-400 transition-all duration-200"
                onClick={() => window.open(driveUrl, "_blank")}
                title="Abrir carpeta/archivo en Drive"
              >
                <i className="bi bi-folder2-open"></i>
                Abrir Drive
              </button>
            )}

            {/* Renovar coberturas (flujo principal) */}
            <button
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 hover:border-amber-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-amber-50"
              onClick={() => setShowRenovacionModal(true)}
              disabled={!resolvedGrupoId}
              title={
                !resolvedGrupoId
                  ? "Guarda primero el grupo familiar para renovar coberturas"
                  : "Iniciar proceso de renovación de coberturas"
              }
            >
              <i className="bi bi-arrow-repeat"></i>
              Renovar coberturas
            </button>

            {/* Historial de renovaciones (lista de años / snapshots) */}
            <button
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border border-gray-400 text-gray-700 bg-gray-50 hover:bg-gray-100 hover:border-gray-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-50"
              onClick={() => setShowHistorialRenovaciones(true)}
              disabled={!resolvedGrupoId}
              title={
                !resolvedGrupoId
                  ? "Guarda primero el grupo familiar para ver el historial"
                  : "Ver historial de renovaciones y versiones por año"
              }
            >
              <i className="bi bi-clock-history"></i>
              Historial renovaciones
            </button>

            {/* Nueva Gestión (ya existente) */}
            <button
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 hover:border-blue-400 transition-all duration-200"
              onClick={() => setShowGestion(true)}
            >
              <i className="fas fa-tasks"></i>
              Nueva Gestión
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
