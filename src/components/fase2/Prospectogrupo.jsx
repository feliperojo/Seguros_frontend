// src/components/fase2/Prospectogrupo.jsx
import React, { useState, useEffect, useMemo } from "react";
import { formatMoneyDisplay } from "../../services/ingresos";
import DateInputWithCalendar from "../common/DateInputWithCalendar";
import { FaFilePdf } from "react-icons/fa";
import { generarPDFConfirmacion } from "../../services/generarPDFConfirmacion";
import { generarPDFAutorizacion } from "../../services/formatoAutorizacion";
import Swal from "sweetalert2";
import DocumentoGeneradoModal from "../DocumentoGeneradoModal";
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
import GrupoNotaEditor from "../GrupoFamiliar/GrupoNotaEditor";
import systemConfigService from "../../services/SystemConfigService";
import "../../styles/GrupoFamiliarDetail.css";

const resolveEnabledGroupHeaderFields = (configByTipo, tipo) => {
  const entry = configByTipo?.[tipo];
  if (!entry || !Array.isArray(entry.enabledFields)) {
    return null; // sin config → mostrar todos
  }
  return entry.enabledFields;
};

const shouldShowGroupHeaderField = (enabledFields, fieldKey) => {
  if (enabledFields === null) return true;
  return enabledFields.includes(fieldKey);
};

const Prospectogrupo = ({
  formData = {},
  onChange,
  readOnly,
  modoHistorico = false,
  grupoFamiliarId,
  onRefresh, // Función opcional para refrescar datos del grupo familiar
  estadoActual, // Estado actual del grupo familiar para validar visibilidad de botones
  grupo, // Grupo completo opcional para generar PDF de confirmación
  anioConsultado = null, // Año que se está consultando (para filtrar hist. renov. en modo histórico)
  coberturaTipo = null, // Tipo de producto para ocultar campos del encabezado (solo visual)
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
  const [showPDFModal, setShowPDFModal] = useState(false);
  const [pdfData, setPdfData] = useState(null);
  const [confirmacionLanguage, setConfirmacionLanguage] = useState("es");
  const [showPDFAutorizacionModal, setShowPDFAutorizacionModal] = useState(false);
  const [pdfAutorizacionData, setPdfAutorizacionData] = useState(null);
  const [autorizacionLanguage, setAutorizacionLanguage] = useState("es");
  const [notasAutorizacionOpen, setNotasAutorizacionOpen] = useState(false);
  const [groupHeaderFieldConfig, setGroupHeaderFieldConfig] = useState(null);

  const [driveUrl, setDriveUrl] = useState(formData?.drive_url || "");

  // Si el padre actualiza formData.drive_url, sincronizamos
  useEffect(() => {
    if (formData?.drive_url !== undefined) {
      setDriveUrl(formData.drive_url || "");
    }
  }, [formData?.drive_url]);

  // Config visual del encabezado económico por tipo de producto
  useEffect(() => {
    let cancelled = false;
    const loadConfig = async () => {
      try {
        const value = await systemConfigService
          .get("group_header_fields_by_tipo")
          .catch(() => null);
        if (cancelled || !value || typeof value !== "object") return;
        const byTipo = value.value !== undefined ? value.value : value;
        setGroupHeaderFieldConfig(
          typeof byTipo === "object" && byTipo !== null ? byTipo : value
        );
      } catch (err) {
        if (import.meta.env.DEV) {
          console.error(
            "Error cargando configuración de encabezado del grupo familiar",
            err
          );
        }
        if (!cancelled) setGroupHeaderFieldConfig(null);
      }
    };
    loadConfig();
    return () => {
      cancelled = true;
    };
  }, []);

  const resolvedCoberturaTipo =
    coberturaTipo ||
    formData?.cobertura_tipo ||
    formData?.productoCotizacion?.label ||
    null;

  const visibleGroupHeaderFields = useMemo(
    () =>
      resolveEnabledGroupHeaderFields(
        groupHeaderFieldConfig,
        resolvedCoberturaTipo
      ),
    [groupHeaderFieldConfig, resolvedCoberturaTipo]
  );

  const showHeaderField = (fieldKey) =>
    shouldShowGroupHeaderField(visibleGroupHeaderFields, fieldKey);

  const showZipCode = showHeaderField("zip_code");
  const showIngresoFamiliar = showHeaderField("ingreso_familiar");
  const showPersonasCobertura = showHeaderField("personas_cobertura");
  const showPersonasTaxes = showHeaderField("personas_taxes");
  const showAnyEconomicField =
    showZipCode ||
    showIngresoFamiliar ||
    showPersonasCobertura ||
    showPersonasTaxes;

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
  
  // Estados permitidos para mostrar el botón de Confirmación de Datos
  // Desde TOMA_DATOS en adelante (TOMA_DATOS, INSCRIPCION_INI, GRUPO_FAMILIAR)
  const estadosPermitidosConfirmacion = ["TOMA_DATOS", "INSCRIPCION_INI", "GRUPO_FAMILIAR"];
  
  // Normalizar estado actual a mayúsculas para comparación
  const estadoNormalizado = estadoActual 
    ? (typeof estadoActual === 'string' 
        ? estadoActual.toUpperCase() 
        : (estadoActual.codigo || estadoActual.code || estadoActual.nombre || "").toUpperCase())
    : "";

  // Verificar si el estado actual permite renovaciones
  const puedeRenovar = estadosPermitidosRenovaciones.includes(estadoNormalizado);

  // Verificar si el estado permite mostrar el botón de Confirmación de Datos (desde TOMA_DATOS en adelante)
  const puedeMostrarConfirmacion = estadosPermitidosConfirmacion.includes(estadoNormalizado);
  
  // Verificar si el grupo tiene coberturas para generar el PDF
  const puedeGenerarPDF = puedeMostrarConfirmacion && grupo && grupo.coberturas && Array.isArray(grupo.coberturas) && grupo.coberturas.length > 0;

  // Obtener el ID del cliente tomador para generar la carta de autorización
  const obtenerClienteTomadorId = () => {
    if (!grupo || !grupo.coberturas || !Array.isArray(grupo.coberturas)) return null;
    const tomador = grupo.coberturas.find(c => c.parentesco?.toUpperCase() === "TOMADOR");
    return tomador?.cliente?.id || tomador?.cliente_id || null;
  };

  const clienteTomadorId = obtenerClienteTomadorId();
  const puedeGenerarAutorizacion = puedeMostrarConfirmacion && clienteTomadorId !== null;

  const seleccionarIdiomaAutorizacion = async () => {
    const { value: language } = await Swal.fire({
      title: "Idioma del documento",
      text: "¿En qué idioma deseas enviar la autorización?",
      icon: "question",
      input: "select",
      inputOptions: {
        es: "Español",
        en: "Inglés",
      },
      inputPlaceholder: "Selecciona un idioma",
      showCancelButton: true,
      confirmButtonText: "Aceptar",
      cancelButtonText: "Cancelar",
    });

    return language || null;
  };

  const seleccionarIdiomaConfirmacion = async () => {
    const { value: language } = await Swal.fire({
      title: "Idioma del documento",
      text: "¿En qué idioma deseas generar la confirmación de datos?",
      icon: "question",
      input: "select",
      inputOptions: {
        es: "Español",
        en: "Inglés",
      },
      inputPlaceholder: "Selecciona un idioma",
      showCancelButton: true,
      confirmButtonText: "Aceptar",
      cancelButtonText: "Cancelar",
    });

    return language || null;
  };

  return (
    <div className="gf-detalle-grupo">
      {/* Utilidades - Barra superior */}
      <div className="gf-detalle__section gf-detalle__utils">
        <div className="gf-detalle__section-body">
          <div className="gf-detalle__utils-row">
            {/* Título y Etiquetas */}
            <div className="gf-detalle__utils-left">
              <h6 className="gf-detalle__utils-title">
                <i className="fas fa-tools me-2" aria-hidden="true"></i>
                Utilidades
              </h6>
              <div className="gf-detalle__utils-divider d-none d-md-block" aria-hidden="true"></div>
              <div className="gf-detalle__utils-tags">
                <label className="gf-detalle__label">Etiquetas</label>
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
            <div className="gf-detalle__utils-actions">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary gf-detalle__utils-btn"
                onClick={() => setShowContactosModal(true)}
                disabled={!resolvedGrupoId}
                title="Contactos relacionados"
              >
                <i className="bi bi-people me-1"></i>
                <span className="d-none d-lg-inline">Contactos</span>
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary gf-detalle__utils-btn"
                onClick={() => setShowHistorialCambios(true)}
                disabled={!resolvedGrupoId}
                title="Historial de cambios"
              >
                <i className="bi bi-clock-history me-1"></i>
                <span className="d-none d-lg-inline">Historial</span>
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary gf-detalle__utils-btn"
                onClick={() => setShowDocumentosModal(true)}
                disabled={!resolvedGrupoId}
                title="Requerimientos"
              >
                <i className="bi bi-folder2-open me-1"></i>
                <span className="d-none d-lg-inline">Requerimientos</span>
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary gf-detalle__utils-btn"
                onClick={() => setShowDriveModal(true)}
                disabled={!resolvedGrupoId}
                title={driveUrl ? "Editar URL Drive" : "Agregar URL Drive"}
              >
                <i className="bi bi-pencil-square me-1"></i>
                <span className="d-none d-lg-inline">Drive</span>
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-primary gf-detalle__utils-btn"
                onClick={() => setShowGestion(true)}
                disabled={!resolvedGrupoId}
                title="Nueva Tarea"
              >
                <i className="fas fa-tasks me-1"></i>
                <span className="d-none d-lg-inline">Nueva Tarea</span>
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary gf-detalle__utils-btn"
                onClick={() => setShowComentarioModal(true)}
                disabled={!resolvedGrupoId}
                title="Nuevo Comentario"
              >
                <i className="fas fa-comment me-1"></i>
                <span className="d-none d-lg-inline">Comentario</span>
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary gf-detalle__utils-btn"
                onClick={() => setShowGestorDocumentosModal(true)}
                disabled={!resolvedGrupoId}
                title="Gestor de documentos"
              >
                <i className="fas fa-folder-open me-1"></i>
                <span className="d-none d-lg-inline">Documentos</span>
              </button>
              {puedeGenerarPDF && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger gf-detalle__utils-btn"
                  onClick={async () => {
                    try {
                      const language = await seleccionarIdiomaConfirmacion();
                      if (!language) return;
                      setConfirmacionLanguage(language);

                      const result = await generarPDFConfirmacion(grupo, false, language);
                      if (result) {
                        setPdfData(result);
                        setShowPDFModal(true);
                      }
                    } catch (error) {
                      console.error("Error al generar PDF:", error);
                      await generarPDFConfirmacion(grupo, true, language || "es");
                    }
                  }}
                  disabled={!resolvedGrupoId}
                  title="Confirmación de Datos"
                >
                  <FaFilePdf className="me-1" />
                  <span className="d-none d-lg-inline">Confirmación</span>
                </button>
              )}
              {puedeGenerarAutorizacion && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger gf-detalle__utils-btn"
                  onClick={async () => {
                    try {
                    const language = await seleccionarIdiomaAutorizacion();
                    if (!language) return;
                    setAutorizacionLanguage(language);

                    const result = await generarPDFAutorizacion(
                      clienteTomadorId,
                      false,
                      language
                    );
                      if (result) {
                        setPdfAutorizacionData(result);
                        setShowPDFAutorizacionModal(true);
                      }
                    } catch (error) {
                      console.error("Error al generar PDF:", error);
                    await generarPDFAutorizacion(clienteTomadorId, true, autorizacionLanguage);
                    }
                  }}
                  disabled={!resolvedGrupoId || !clienteTomadorId}
                  title="Carta de Autorización"
                >
                  <FaFilePdf className="me-1" />
                  <span className="d-none d-lg-inline">Autorización</span>
                </button>
              )}
              {puedeRenovar && !modoHistorico && (
                <>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-warning gf-detalle__utils-btn"
                    onClick={() => setShowCambioVidaModal(true)}
                    disabled={!resolvedGrupoId || readOnly}
                    title="Retiro/cancelacion"
                  >
                    <i className="fas fa-exclamation-triangle me-1"></i>
                    <span className="d-none d-lg-inline">Retiro/cancelacion</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-success gf-detalle__utils-btn"
                    onClick={() => setShowReactivacionModal(true)}
                    disabled={!resolvedGrupoId || readOnly}
                    title="Reactivar coberturas retiradas"
                  >
                    <i className="fas fa-redo me-1"></i>
                    <span className="d-none d-lg-inline">Reactivar</span>
                  </button>
                </>
              )}
              {(modoHistorico || puedeRenovar) && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary gf-detalle__utils-btn"
                  onClick={() => setShowHistorialCanceladasModal(true)}
                  disabled={!resolvedGrupoId}
                  title={
                    modoHistorico && anioConsultado
                      ? `Historial de retiros y cancelaciones del año ${anioConsultado}`
                      : "Historial de retiros y cancelaciones"
                  }
                >
                  <i className="fas fa-history me-1"></i>
                  <span className="d-none d-lg-inline">
                    {modoHistorico && anioConsultado
                      ? `Hist. retiros y cancel. ${anioConsultado}`
                      : "Hist. retiros y cancelaciones"}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Información del Prospecto (captación) */}
      <div className="gf-detalle__section">
        <div className="gf-detalle__section-header">
          <h5 className="gf-detalle__section-title">
            <i className="fas fa-info-circle me-2" aria-hidden="true"></i>
            Información del Grupo Familiar
          </h5>
        </div>
        <div className="gf-detalle__section-body">
          <div className="row g-3">
            <div className="col-md-4">
              <label className="gf-detalle__label">
                Captado por:
              </label>
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
              <label className="gf-detalle__label">
                Cuál
              </label>
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
              <label className="gf-detalle__label">
                Asesor
              </label>
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
      <div className="gf-detalle__section">
        <div className="gf-detalle__section-body">
          <div className="row g-3">
            {showZipCode && (
            <div className="col-md-6 col-lg-3">
              <label className="gf-detalle__label">
                ZIP Code
              </label>
              <input
                type="text"
                className="form-control"
                name="zipCode"
                value={formData.zipCode || ""}
                onChange={onChange}
                disabled={readOnly}
              />
            </div>
            )}
            {showIngresoFamiliar && (
            <div className="col-md-6 col-lg-3">
              <label className="gf-detalle__label gf-detalle__label--with-icon">
                <i className="fas fa-dollar-sign me-2" aria-hidden="true"></i>
                Ingreso Familiar
              </label>
              <input
                type="text"
                className="form-control bg-light"
                name="ingresoFamiliar"
                value={formatMoneyDisplay(formData.ingresoFamiliar ?? 0)}
                onChange={onChange}
                readOnly
              />
              <small className="gf-detalle__hint">
                <i className="fas fa-info-circle" aria-hidden="true"></i>
                Sumatoria de los ingresos de cada miembro sin fecha de retiro.
              </small>
            </div>
            )}
            {showPersonasCobertura && (
            <div className="col-md-6 col-lg-3">
              <label className="gf-detalle__label gf-detalle__label--with-icon">
                <i className="fas fa-shield-alt me-2" aria-hidden="true"></i>
                Personas en Cobertura
              </label>
              <input
                type="number"
                className="form-control bg-light"
                name="personasCobertura"
                value={formData.personasCobertura ?? 0}
                readOnly
              />
              <small className="gf-detalle__hint">
                <i className="fas fa-info-circle" aria-hidden="true"></i>
                Se calcula con miembros en "Sí" y sin retiro.
              </small>
            </div>
            )}
            {showPersonasTaxes && (
            <div className="col-md-6 col-lg-3">
              <label className="gf-detalle__label gf-detalle__label--with-icon">
                <i className="fas fa-users me-2" aria-hidden="true"></i>
                Personas en Taxes
              </label>
              <input
                type="number"
                className="form-control bg-light"
                name="personasTaxes"
                value={formData.personasTaxes ?? 0}
                readOnly
              />
              <small className="gf-detalle__hint">
                <i className="fas fa-info-circle" aria-hidden="true"></i>
                Se calcula con el número de miembros (cards).
              </small>
            </div>
            )}
            <div className="col-12">
              <div className={`accordion gf-detalle__notes ${showAnyEconomicField ? "mt-1" : ""}`} id="accordionNotasAutorizacion">
                <div className="accordion-item">
                  <h2 className="accordion-header" id="headingNotasAutorizacion">
                    <button
                      type="button"
                      className={`accordion-button ${notasAutorizacionOpen ? "" : "collapsed"}`}
                      onClick={() => setNotasAutorizacionOpen((prev) => !prev)}
                      aria-expanded={notasAutorizacionOpen}
                      aria-controls="collapseNotasAutorizacion"
                    >
                      <i className="fas fa-sticky-note me-2" aria-hidden="true"></i>
                      Notas y autorización
                    </button>
                  </h2>
                  {notasAutorizacionOpen && (
                    <div
                      id="collapseNotasAutorizacion"
                      className="accordion-collapse collapse show contacto-accordion-open"
                      aria-labelledby="headingNotasAutorizacion"
                    >
                      <div className="accordion-body">
                        <div className="row g-3 mb-3">
                          <div className="col-md-6">
                            <label className="gf-detalle__label">
                              Fecha autorización
                            </label>
                            <DateInputWithCalendar
                              inputName="fechaAutorizacion"
                              valueIso={formData?.fechaAutorizacion}
                              disabled={readOnly}
                              onChangeIso={(iso) =>
                                onChange?.({
                                  target: {
                                    name: "fechaAutorizacion",
                                    value: iso,
                                    type: "text",
                                  },
                                })
                              }
                            />
                          </div>
                          <div className="col-md-6">
                            <label className="gf-detalle__label">
                              Nombre autorizado
                            </label>
                            <input
                              type="text"
                              className="form-control"
                              name="nombreAutorizado"
                              value={formData.nombreAutorizado || ""}
                              onChange={onChange}
                              disabled={readOnly}
                              placeholder="Persona autorizada"
                            />
                          </div>
                        </div>
                        <label className="gf-detalle__label">
                          Nota
                        </label>
                        <GrupoNotaEditor
                          value={formData.nota || ""}
                          onChange={onChange}
                          disabled={readOnly}
                          placeholder="Notas del grupo familiar..."
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
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
  anioInicial={modoHistorico ? anioConsultado : null}
  soloAnioInicial={Boolean(modoHistorico && anioConsultado)}
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

{/* Modal para PDF de Confirmación - mismo flujo que Autorización: enviar al back y ruta de firma */}
{pdfData && grupo && (() => {
  const tomador = grupo.coberturas?.find(c => c.parentesco?.toUpperCase() === "TOMADOR");
  return (
    <DocumentoGeneradoModal
      show={showPDFModal}
      onHide={() => {
        setShowPDFModal(false);
        setPdfData(null);
      }}
      pdfBlob={pdfData.blob}
      filename={pdfData.filename}
      documentType="CONFIRMACION"
      documentLanguage={confirmacionLanguage}
      defaultSigner={{
        email: tomador?.cliente?.email || "",
        name: tomador?.cliente?.nombre_completo || "",
      }}
      metadata={{
        cliente_id: tomador?.cliente?.id || tomador?.cliente_id || null,
        grupo_familiar_id: resolvedGrupoId || null,
      }}
    />
  );
})()}

{/* Modal para PDF de Autorización */}
{pdfAutorizacionData && grupo && (() => {
  const tomador = grupo.coberturas?.find(c => c.parentesco?.toUpperCase() === "TOMADOR");
  return (
    <DocumentoGeneradoModal
      show={showPDFAutorizacionModal}
      onHide={() => {
        setShowPDFAutorizacionModal(false);
        setPdfAutorizacionData(null);
      }}
      pdfBlob={pdfAutorizacionData.blob}
      filename={pdfAutorizacionData.filename}
      documentType="AUTORIZACION"
      documentLanguage={autorizacionLanguage}
      defaultSigner={{
        email: tomador?.cliente?.email || "",
        name: tomador?.cliente?.nombre_completo || "",
      }}
      metadata={{
        cliente_id: clienteTomadorId || tomador?.cliente?.id || tomador?.cliente_id || null,
        grupo_familiar_id: resolvedGrupoId || null,
      }}
    />
  );
})()}

    </div>
  );
};

export default Prospectogrupo;
