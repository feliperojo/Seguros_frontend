// pages/AuditoriasPage.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Button, Form, Alert, Spinner, Table, Badge, Modal } from "react-bootstrap";
import { FaEdit } from "react-icons/fa";
import { Helmet } from "react-helmet-async";
import { listRuns, createRun, closeRun, listAuditTypes } from "../services/auditoriasService";
import useToast from "../hooks/useToast";
import TiposAuditoriaModal from "../components/TiposAuditoriaModal";
import apiRequest from "../services/api";

/**
 * Formatea una fecha para mostrar
 */
const formatDate = (dateString) => {
  if (!dateString) return "-";
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("es-ES", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateString;
  }
};

/**
 * Obtiene el periodo actual en formato YYYY-MM
 */
const getCurrentPeriod = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const AuditoriasPage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  
  // Estado de selección
  const [targetType, setTargetType] = useState("coberturas");
  const [auditTypeId, setAuditTypeId] = useState("");
  const [auditTypeLegacy, setAuditTypeLegacy] = useState("SHERPA"); // Para compatibilidad
  const [periodo, setPeriodo] = useState(getCurrentPeriod());
  
  // Estado de tipos de auditoría
  const [auditTypes, setAuditTypes] = useState([]);
  const [loadingTypes, setLoadingTypes] = useState(false);
  const [showTypesModal, setShowTypesModal] = useState(false);
  
  // Estado de datos
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [includePagos, setIncludePagos] = useState(false);
  const [validatingPagos, setValidatingPagos] = useState(false);
  const [showPagosModal, setShowPagosModal] = useState(false);
  const [pagosModalMessage, setPagosModalMessage] = useState("");
  const [pendingCreatePayload, setPendingCreatePayload] = useState(null);
  const [closingRunId, setClosingRunId] = useState(null);
  const [error, setError] = useState(null);
  const [infoMessage, setInfoMessage] = useState(null);
  
  // AbortController para cancelar peticiones
  const abortControllerRef = useRef(null);
  
  // Función para cargar tipos (reutilizable)
  const loadTypes = useCallback(async (preserveSelection = false) => {
    setLoadingTypes(true);
    try {
      const types = await listAuditTypes({ 
        target_type: targetType, 
        is_active: true 
      });
      const typesArray = Array.isArray(types) ? types : [];
      setAuditTypes(typesArray);
      
      // Si hay tipos disponibles
      if (typesArray.length > 0) {
        // Si no hay selección o la selección actual no existe en la nueva lista, seleccionar el primero
        const currentIdExists = typesArray.some(t => t.id.toString() === auditTypeId);
        if (!preserveSelection || !auditTypeId || !currentIdExists) {
          setAuditTypeId(typesArray[0].id.toString());
        }
      } else {
        // Si no hay tipos, limpiar selección y usar legacy
        setAuditTypeId("");
      }
    } catch (err) {
      console.error("Error al cargar tipos de auditoría:", err);
      setAuditTypes([]);
      setAuditTypeId("");
    } finally {
      setLoadingTypes(false);
    }
  }, [targetType]);
  
  // Cargar tipos de auditoría al cambiar target_type
  useEffect(() => {
    loadTypes(false); // No preservar selección al cambiar target_type
  }, [targetType, loadTypes]);
  
  // Callback cuando se actualizan los tipos en el modal
  const handleTypesUpdated = useCallback(() => {
    loadTypes(true); // Preservar selección si es posible
  }, [loadTypes]);
  
  // Función para cargar runs (reutilizable)
  const loadRunsData = useCallback(async (abortController) => {
    try {
      const params = {
        target_type: targetType,
        periodo: periodo,
      };
      
      // Usar audit_type_id si está disponible, sino usar audit_type legacy
      if (auditTypeId) {
        params.audit_type_id = auditTypeId;
      } else {
        params.audit_type = auditTypeLegacy;
      }
      
      const data = await listRuns(params, abortController?.signal);
      // Asegurar que siempre devolvemos un array
      const result = Array.isArray(data) ? data : (data?.data || []);
      return result;
    } catch (err) {
      if (err.message === "Petición cancelada" || err.name === "AbortError") {
        return [];
      }
      // Re-lanzar el error para que se maneje en el componente
      throw err;
    }
  }, [targetType, auditTypeId, auditTypeLegacy, periodo]);
  
  // Cargar runs al montar y cuando cambian los filtros
  useEffect(() => {
    let isMounted = true;
    let currentAbortController = null;
    
    // Cancelar petición anterior si existe
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Crear nuevo AbortController
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    currentAbortController = abortController;
    
    setLoading(true);
    setError(null);
    
    const loadRuns = async () => {
      try {
        const data = await loadRunsData(abortController);
        
        if (!abortController.signal.aborted && isMounted && currentAbortController === abortControllerRef.current) {
          setRuns(data);
          setError(null);
        }
      } catch (err) {
        if (err.message === "Petición cancelada" || err.name === "AbortError") {
          return;
        }
        
        if (isMounted && currentAbortController === abortControllerRef.current) {
          const errorMessage = err.response?.data?.message || err.message || "Error al cargar las auditorías";
          setError(errorMessage);
          console.error("Error al cargar runs:", err);
          setRuns([]);
        }
      } finally {
        if (isMounted && !abortController.signal.aborted && currentAbortController === abortControllerRef.current) {
          setLoading(false);
        }
      }
    };
    
    loadRuns();
    
    return () => {
      isMounted = false;
      if (currentAbortController) {
        currentAbortController.abort();
      }
    };
  }, [targetType, auditTypeId, auditTypeLegacy, periodo, loadRunsData]);
  
  // Refrescar datos cuando la ventana recupera el foco (usuario regresa de otra página)
  useEffect(() => {
    const handleFocus = () => {
      // Solo refrescar si no está cargando y hay datos
      if (!loading && runs.length > 0) {
        const abortController = new AbortController();
        abortControllerRef.current = abortController;
        
        loadRunsData(abortController)
          .then((data) => {
            if (!abortController.signal.aborted) {
              setRuns(data);
            }
          })
          .catch((err) => {
            if (err.message !== "Petición cancelada" && err.name !== "AbortError") {
              console.error("Error al refrescar runs:", err);
            }
          });
      }
    };
    
    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [loading, runs.length, loadRunsData]);
  
  const periodoToLabel = (yyyyMm) => {
    if (!yyyyMm || typeof yyyyMm !== "string") return String(yyyyMm ?? "");
    const [y, m] = yyyyMm.split("-").slice(0, 2);
    if (!y || !m) return yyyyMm;
    return `${y}-${m}`;
  };

  const validarPagosGeneradosDelPeriodo = async (yyyyMm) => {
    // Endpoint actual usado por PagosActualizar / PagosInforme
    const pagos = await apiRequest("cobertura/pagos/listado", "GET");
    const list = Array.isArray(pagos) ? pagos : (pagos?.data || []);
    const prefix = `${yyyyMm}-`;
    const existe = list.some((p) => typeof p?.fecha_pago === "string" && p.fecha_pago.startsWith(prefix));
    return existe;
  };

  /**
   * Crea el run y refresca la lista. Si ya existe (409), muestra aviso y refresca sin tratarlo como error rojo.
   * @returns {{ ok: true, response }} | {{ ok: false, duplicate: true }} | throws
   */
  const createRunAndRefresh = async (payload) => {
    try {
      const response = await createRun(payload);
      const tipoNombre = auditTypes.find((t) => t.id.toString() === auditTypeId)?.nombre || auditTypeLegacy;
      toast.showSuccess(`Auditoría ${tipoNombre} del periodo ${periodo} creada exitosamente`);

      const data = await loadRunsData();
      setRuns(Array.isArray(data) ? data : []);
      return { ok: true, response };
    } catch (err) {
      if (err.response?.status === 409) {
        const tipoNombre = auditTypes.find((t) => t.id.toString() === auditTypeId)?.nombre || auditTypeLegacy;
        const targetTypeLabel = targetType === "coberturas" ? "Coberturas" : "Clientes";
        const mensaje = `Ya existe una auditoría de tipo "${tipoNombre}" para ${targetTypeLabel} en el periodo ${periodo}. Solo se permite una auditoría por tipo, objeto y periodo. Puedes abrir la auditoría existente desde la lista.`;
        setInfoMessage(mensaje);
        toast.showWarning("No se puede crear: ya existe una auditoría con estos parámetros");

        try {
          const data = await loadRunsData();
          setRuns(Array.isArray(data) ? data : []);
        } catch (reloadErr) {
          console.error("Error al recargar runs tras 409:", reloadErr);
        }
        return { ok: false, duplicate: true };
      }
      throw err;
    }
  };

  const closePagosModal = () => {
    setShowPagosModal(false);
    setPagosModalMessage("");
    setPendingCreatePayload(null);
  };

  // Manejar creación de run
  const handleCreateRun = async () => {
    if (!periodo) {
      toast.showWarning("Por favor selecciona el periodo");
      return;
    }
    
    if (!auditTypeId && !auditTypeLegacy) {
      toast.showWarning("Por favor selecciona la fuente de auditoría");
      return;
    }
    
    setCreating(true);
    setError(null);
    setInfoMessage(null);
    
    try {
      const payload = {
        target_type: targetType,
        periodo: periodo,
      };
      
      // Usar audit_type_id si está disponible (nuevo sistema)
      if (auditTypeId) {
        payload.audit_type_id = parseInt(auditTypeId);
      } else {
        // Compatibilidad con sistema legacy
        payload.audit_type = auditTypeLegacy;
      }

      // Opcional: incluir pagos del mes. Primero validamos si existen pagos generados para ese periodo.
      if (includePagos) {
        setValidatingPagos(true);
        let existenPagos = false;
        try {
          existenPagos = await validarPagosGeneradosDelPeriodo(periodo);
        } finally {
          setValidatingPagos(false);
        }

        if (!existenPagos) {
          const periodoLabel = periodoToLabel(periodo);
          setPagosModalMessage(
            `No se ha generado pagos para el mes ${periodoLabel}, por lo tanto no puedes relacionar pagos a esta auditoría.\n\n` +
              `¿Deseas continuar sin pagos (solo la auditoría)? Se recomienda generar los pagos y volver a crear la auditoría con la opción de incluir pagos.`
          );
          setPendingCreatePayload(payload);
          setShowPagosModal(true);
          return;
        }

        // Si existen pagos, intentamos enviar una marca al backend para incluirlos (si el backend lo soporta).
        payload.include_pagos = true;
      }

      await createRunAndRefresh(payload);
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || "Error al crear la auditoría";
      setError(errorMessage);
      toast.showError(errorMessage);
      console.error("Error al crear run:", err);
    } finally {
      setCreating(false);
    }
  };
  
  // Manejar cierre de run
  const handleCloseRun = async (runId, e) => {
    e.stopPropagation(); // Evitar navegación al hacer clic
    
    if (!window.confirm("¿Estás seguro de que deseas cerrar esta auditoría? Esta acción no se puede deshacer.")) {
      return;
    }
    
    setClosingRunId(runId);
    
    try {
      await closeRun(runId);
      toast.showSuccess("Auditoría cerrada exitosamente");
      
      // Recargar la lista
      const data = await loadRunsData();
      setRuns(Array.isArray(data) ? data : []);
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || "Error al cerrar la auditoría";
      toast.showError(errorMessage);
      console.error("Error al cerrar run:", err);
    } finally {
      setClosingRunId(null);
    }
  };
  
  // Navegar al detalle del run
  const handleOpenRun = (runId) => {
    navigate(`/auditorias/${runId}`);
  };
  
  return (
    <div className="container-fluid py-4">
      <Helmet>
        <title>Auditorías</title>
      </Helmet>
      
      <h2 className="mb-4">Auditorías Mensuales</h2>
      
      {/* Selector de auditoría y periodo */}
      <Card className="mb-4">
        <Card.Header>
          <h5 className="mb-0">Crear Nueva Auditoría</h5>
        </Card.Header>
        <Card.Body>
          <div className="row g-3 align-items-end">
            <div className="col-md-3">
              <Form.Label>Tipo de Objeto a Auditar</Form.Label>
              <Form.Select
                value={targetType}
                onChange={(e) => {
                  setTargetType(e.target.value);
                  setAuditTypeId(""); // Resetear selección al cambiar target_type
                }}
              >
                <option value="coberturas">Coberturas</option>
                <option value="clientes">Clientes</option>
              </Form.Select>
            </div>
            
            <div className="col-md-3">
              <div className="d-flex justify-content-between align-items-center mb-1">
                <Form.Label className="mb-0">Tipo de Auditoría</Form.Label>
                <Button
                  variant="link"
                  size="sm"
                  className="p-0 text-decoration-none"
                  onClick={() => setShowTypesModal(true)}
                  title="Gestionar fuentes de auditoría"
                >
                  <FaEdit className="me-1" />
                  Gestionar
                </Button>
              </div>
              {loadingTypes ? (
                <Form.Select disabled>
                  <option>Cargando tipos...</option>
                </Form.Select>
              ) : auditTypes.length > 0 ? (
                <>
                  <Form.Select
                    value={auditTypeId}
                    onChange={(e) => setAuditTypeId(e.target.value)}
                  >
                    <option value="">Selecciona una fuente</option>
                    {auditTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.nombre}
                      </option>
                    ))}
                  </Form.Select>
                  <Form.Text className="text-muted">
                    {auditTypes.length} fuente{auditTypes.length !== 1 ? "s" : ""} disponible{auditTypes.length !== 1 ? "s" : ""}
                  </Form.Text>
                </>
              ) : (
                <>
                  <Form.Select
                    value={auditTypeLegacy}
                    onChange={(e) => setAuditTypeLegacy(e.target.value)}
                  >
                    <option value="SHERPA">SHERPA</option>
                    <option value="DOCUMENTACION">DOCUMENTACIÓN</option>
                  </Form.Select>
                  <Form.Text className="text-muted">
                    No hay fuentes personalizadas. Usando fuentes legacy. Crea fuentes personalizadas para más opciones.
                  </Form.Text>
                </>
              )}
            </div>
            
            <div className="col-md-3">
              <Form.Label>Periodo (YYYY-MM)</Form.Label>
              <Form.Control
                type="month"
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value)}
              />
            </div>

            <div className="col-md-3">
              <Form.Label className="d-block">Opciones</Form.Label>
              <Form.Check
                type="switch"
                id="include-pagos-switch"
                label="Incluir pagos del mes de la auditoría"
                checked={includePagos}
                onChange={(e) => setIncludePagos(e.target.checked)}
                disabled={creating || validatingPagos}
              />
              <Form.Text className="text-muted">
                Si lo activas, se validará que existan pagos generados para el periodo seleccionado.
              </Form.Text>
            </div>
            
            <div className="col-md-3">
              <Button
                variant="primary"
                onClick={handleCreateRun}
                disabled={creating || validatingPagos || (!auditTypeId && !auditTypeLegacy) || !periodo}
                className="w-100"
              >
                {creating || validatingPagos ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-2" />
                    {validatingPagos ? "Validando pagos..." : "Creando..."}
                  </>
                ) : (
                  "Crear Auditoría del Periodo"
                )}
              </Button>
            </div>
          </div>
        </Card.Body>
      </Card>

      <Modal show={showPagosModal} onHide={closePagosModal} centered>
        <Modal.Header closeButton>
          <Modal.Title>Pagos del periodo</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ whiteSpace: "pre-line" }}>{pagosModalMessage}</Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closePagosModal}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={async () => {
              if (!pendingCreatePayload) {
                closePagosModal();
                return;
              }
              try {
                setCreating(true);
                // Continuar sin pagos
                await createRunAndRefresh(pendingCreatePayload);
              } catch (err) {
                const errorMessage =
                  err.response?.data?.message || err.message || "Error al crear la auditoría";
                setError(errorMessage);
                toast.showError(errorMessage);
                console.error("Error al crear run (sin pagos):", err);
              } finally {
                setCreating(false);
                closePagosModal();
              }
            }}
          >
            Continuar sin pagos
          </Button>
        </Modal.Footer>
      </Modal>
      
      {/* Mensaje informativo */}
      {infoMessage && (
        <Alert variant="info" className="mb-4" dismissible onClose={() => setInfoMessage(null)}>
          <Alert.Heading>Atención</Alert.Heading>
          <p>{infoMessage}</p>
        </Alert>
      )}
      
      {/* Mensaje de error */}
      {error && (
        <Alert variant="danger" className="mb-4" dismissible onClose={() => setError(null)}>
          <Alert.Heading>Error</Alert.Heading>
          <p>{error}</p>
        </Alert>
      )}
      
      {/* Lista de runs */}
      <Card>
        <Card.Header>
          <h5 className="mb-0">
            Auditorías de {targetType === "coberturas" ? "Coberturas" : "Clientes"} - Periodo {periodo}
          </h5>
        </Card.Header>
        <Card.Body>
          {loading ? (
            <div className="text-center py-5">
              <Spinner animation="border" role="status">
                <span className="visually-hidden">Cargando...</span>
              </Spinner>
              <p className="mt-2 text-muted">Cargando auditorías...</p>
            </div>
          ) : runs.length === 0 ? (
            <Alert variant="info">
              No se encontraron auditorías para la fuente y periodo seleccionados.
            </Alert>
          ) : (
            <div className="table-responsive">
              <Table striped bordered hover>
                <thead>
                  <tr>
                    <th title="Identificador único de la auditoría">ID</th>
                    <th title="Fuente de auditoría: SHERPA (auditoría de procesos) o DOCUMENTACIÓN (revisión de documentos)">Tipo</th>
                    <th title="Periodo de la auditoría en formato Año-Mes (YYYY-MM)">Periodo</th>
                    <th title="Fecha y hora en que se creó la auditoría">Fecha Creación</th>
                    <th title="Estado actual: Abierto (en proceso) o Cerrado (finalizada)">Estado</th>
                    <th title="Número total de coberturas incluidas en esta auditoría">Total Items</th>
                    <th title="Coberturas que ya fueron revisadas y tienen un estado asignado (OK, PERDIDA, NOVEDAD, etc.)">Completados</th>
                    <th title="Coberturas que aún no han sido revisadas (estado PENDIENTE)">Pendientes</th>
                    <th title="Coberturas marcadas como PERDIDA (no cumplen con los requisitos)">Perdida</th>
                    <th title="Coberturas con estado NOVEDAD (requieren atención especial)">Novedades</th>
                    <th title="Coberturas con estado SOLUCIONADO (problemas resueltos)">Solucionado</th>
                    <th title="Acciones disponibles: Abrir (ver detalle) y Cerrar (finalizar auditoría)">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => (
                    <tr key={run.id}>
                      <td title={`ID de auditoría: ${run.id}`}>{run.id}</td>
                      <td>
                        {run.audit_type ? (
                          typeof run.audit_type === "object" ? (
                            <Badge 
                              bg="primary"
                              title={run.audit_type.descripcion || run.audit_type.nombre}
                            >
                              {run.audit_type.nombre || run.audit_type.codigo}
                            </Badge>
                          ) : (
                            <Badge 
                              bg={run.audit_type === "SHERPA" ? "primary" : "info"}
                              title={run.audit_type === "SHERPA" 
                                ? "SHERPA: Auditoría de procesos y cumplimiento operativo" 
                                : "DOCUMENTACIÓN: Auditoría de documentos y requerimientos"}
                            >
                              {run.audit_type}
                            </Badge>
                          )
                        ) : (
                          <Badge bg="secondary">Sin tipo</Badge>
                        )}
                        {run.target_type && (
                          <Badge bg="light" text="dark" className="ms-1">
                            {run.target_type}
                          </Badge>
                        )}
                      </td>
                      <td title={`Periodo auditado: ${run.periodo}`}>{run.periodo}</td>
                      <td title={`Creada el ${formatDate(run.created_at)}`}>{formatDate(run.created_at)}</td>
                      <td>
                        {run.is_closed ? (
                          <Badge bg="secondary" title="Auditoría cerrada: No se pueden realizar más cambios">Cerrado</Badge>
                        ) : (
                          <Badge bg="success" title="Auditoría abierta: Puedes revisar y actualizar coberturas">Abierto</Badge>
                        )}
                      </td>
                      {(() => {
                        // Extraer métricas del objeto metrics o usar valores directos (compatibilidad)
                        const metrics = run.metrics || {};
                        const totalItems = metrics.total_items || run.total_items || run.items_count || 0;
                        const completedCount = metrics.completed_count || run.completed_count || 0;
                        const pendingCount = metrics.pending_count || run.pending_count || 0;
                        const perdidaCount = metrics.perdida_count || run.perdida_count || metrics.no_ok_count || run.no_ok_count || 0;
                        const novedadCount = metrics.novedad_count || run.novedad_count || 0;
                        const solucionadoCount = metrics.solucionado_count || run.solucionado_count || metrics.error_count || run.error_count || 0;
                        
                        return (
                          <>
                            <td title={`Total de ${totalItems} coberturas en esta auditoría`}>{totalItems}</td>
                            <td>
                              <Badge 
                                bg="success"
                                title={`${completedCount} coberturas ya revisadas (tienen estado asignado)`}
                              >
                                {completedCount}
                              </Badge>
                            </td>
                            <td>
                              <Badge 
                                bg="warning"
                                title={`${pendingCount} coberturas pendientes de revisar (estado PENDIENTE)`}
                              >
                                {pendingCount}
                              </Badge>
                            </td>
                            <td>
                              {perdidaCount > 0 ? (
                                <Badge 
                                  bg="danger"
                                  title={`${perdidaCount} coberturas marcadas como PERDIDA (no cumplen requisitos)`}
                                >
                                  {perdidaCount}
                                </Badge>
                              ) : (
                                <span title="0 coberturas con estado PERDIDA">{perdidaCount}</span>
                              )}
                            </td>
                            <td>
                              {novedadCount > 0 ? (
                                <Badge 
                                  bg="warning"
                                  title={`${novedadCount} coberturas con novedades (requieren atención especial)`}
                                >
                                  {novedadCount}
                                </Badge>
                              ) : (
                                <span title="0 coberturas con novedades">{novedadCount}</span>
                              )}
                            </td>
                            <td>
                              {solucionadoCount > 0 ? (
                                <Badge 
                                  bg="info"
                                  title={`${solucionadoCount} coberturas con estado SOLUCIONADO (problemas resueltos)`}
                                >
                                  {solucionadoCount}
                                </Badge>
                              ) : (
                                <span title="0 coberturas con estado SOLUCIONADO">{solucionadoCount}</span>
                              )}
                            </td>
                          </>
                        );
                      })()}
                      <td>
                        <div className="d-flex gap-1">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleOpenRun(run.id)}
                            title="Abrir detalle de la auditoría para revisar y actualizar coberturas"
                          >
                            Abrir
                          </Button>
                          {!run.is_closed && (
                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={(e) => handleCloseRun(run.id, e)}
                              disabled={closingRunId === run.id}
                              title="Cerrar esta auditoría (no se podrán realizar más cambios)"
                            >
                              {closingRunId === run.id ? (
                                <Spinner animation="border" size="sm" />
                              ) : (
                                "Cerrar"
                              )}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>
      
      {/* Modal de Gestión de Fuentes de Auditoría */}
      <TiposAuditoriaModal
        show={showTypesModal}
        onClose={() => setShowTypesModal(false)}
        targetType={targetType}
        onTypesUpdated={handleTypesUpdated}
      />
    </div>
  );
};

export default AuditoriasPage;

