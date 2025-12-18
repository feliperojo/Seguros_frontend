// src/components/fase2/Prospectogrupo.jsx
import React, { useState, useEffect } from "react";
import { formatMoneyDisplay } from "../../services/ingresos";
import NuevaTareaModal from "../Tareas/NuevaTareaModal";
import RequerimientosModal from "../RequerimientosModal";
import DriveUrlModal from "../GrupoFamiliar/DriveUrlModal";
import HistorialCambiosModal from "../Reports/HistorialCambiosModal";
import ContactosGrupoModal from "../Contacto/ContactosGrupoModal";
import CambioVidaCancelacionModal from "../coberturas/CambioVidaCancelacionModal";
import HistorialCoberturasCanceladasModal from "../coberturas/HistorialCoberturasCanceladasModal";
import GestorDocumentosGrupoFamiliar from "../Documentos/GestorDocumentosGrupoFamiliar";


const Prospectogrupo = ({
  formData = {},
  onChange,
  readOnly,
  grupoFamiliarId,
  onRefresh, // Función opcional para refrescar datos del grupo familiar
  estadoActual, // Estado actual del grupo familiar para validar visibilidad de botones
}) => {
  const [showGestion, setShowGestion] = useState(false);


  const [showDocumentosModal, setShowDocumentosModal] = useState(false);
  const [showDriveModal, setShowDriveModal] = useState(false);
  const [showHistorialCambios, setShowHistorialCambios] = useState(false);
  const [showContactosModal, setShowContactosModal] = useState(false);
  const [showCambioVidaModal, setShowCambioVidaModal] = useState(false);
  const [showHistorialCanceladasModal, setShowHistorialCanceladasModal] = useState(false);
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

            {/* Nueva Gestión (ya existente) */}
            <button
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 hover:border-blue-400 transition-all duration-200"
              onClick={() => setShowGestion(true)}
            >
              <i className="fas fa-tasks"></i>
              Nueva Gestión
            </button>

            {/* Renovaciones / Cancelar coberturas - Solo visible en estados permitidos */}
            {puedeRenovar && (
              <button
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border border-orange-300 text-orange-700 bg-orange-50 hover:bg-orange-100 hover:border-orange-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-orange-50"
                onClick={() => setShowCambioVidaModal(true)}
                disabled={!resolvedGrupoId}
                title={
                  !resolvedGrupoId
                    ? "Guarda primero el grupo familiar para cancelar coberturas"
                    : "Cancelar coberturas por cambio de vida"
                }
              >
                <i className="fas fa-exclamation-triangle"></i>
                Renovaciones
              </button>
            )}

            {/* Historial de coberturas canceladas */}
            <button
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border border-purple-300 text-purple-700 bg-purple-50 hover:bg-purple-100 hover:border-purple-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-purple-50"
              onClick={() => setShowHistorialCanceladasModal(true)}
              disabled={!resolvedGrupoId}
              title={
                !resolvedGrupoId
                  ? "Guarda primero el grupo familiar para ver el historial"
                  : "Consultar historial de coberturas canceladas"
              }
            >
              <i className="fas fa-history"></i>
              Historial renovaciones
            </button>

            {/* Gestor de Documentos */}
            <button
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border border-indigo-300 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 hover:border-indigo-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-indigo-50"
              onClick={() => setShowGestorDocumentosModal(true)}
              disabled={!resolvedGrupoId}
              title={
                !resolvedGrupoId
                  ? "Guarda primero el grupo familiar para gestionar documentos"
                  : "Gestionar documentos y carpetas del grupo familiar"
              }
            >
              <i className="fas fa-folder-open"></i>
              Gestor de documentos
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

<GestorDocumentosGrupoFamiliar
  show={showGestorDocumentosModal}
  onHide={() => setShowGestorDocumentosModal(false)}
  grupoFamiliarId={resolvedGrupoId}
/>


    </>
  );
};

export default Prospectogrupo;
