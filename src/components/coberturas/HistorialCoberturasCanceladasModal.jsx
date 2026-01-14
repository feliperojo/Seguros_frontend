// src/components/coberturas/HistorialCoberturasCanceladasModal.jsx
import React, { useState, useEffect } from "react";
import { Modal, Button, Table, Alert, Spinner, Badge, Form, Row, Col, Accordion, Card } from "react-bootstrap";
import { FaChevronDown, FaChevronRight } from "react-icons/fa";
import apiRequest from "../../services/api";
import GrupoFamiliarService from "../../services/GrupoFamiliarService";

/**
 * HistorialCoberturasCanceladasModal
 * 
 * Modal para consultar el historial de coberturas canceladas de un grupo familiar.
 * 
 * Props:
 * - show (boolean): Controla la visibilidad del modal
 * - onClose (func): Se llama para cerrar el modal
 * - grupoFamiliarId (number|string): ID del grupo familiar
 * 
 * El componente:
 * - Carga el historial de coberturas canceladas desde el endpoint GET /api/coberturas/historial-renovaciones
 * - Muestra una tabla con las coberturas canceladas
 * - Incluye información como fechas, motivos, notas, etc.
 */
const HistorialCoberturasCanceladasModal = ({
  show,
  onClose,
  grupoFamiliarId,
}) => {
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [grupoFamiliarInfo, setGrupoFamiliarInfo] = useState(null);
  const [filasExpandidas, setFilasExpandidas] = useState(new Set());

  // Filtros
  const [filtroClienteId, setFiltroClienteId] = useState("");
  const [filtroAnio, setFiltroAnio] = useState("");
  const [filtroCompaniaId, setFiltroCompaniaId] = useState("");

  // Opciones para los filtros
  const [clientes, setClientes] = useState([]);
  const [companias, setCompanias] = useState([]);
  const [anios, setAnios] = useState([]);
  const [loadingOpciones, setLoadingOpciones] = useState(false);

  // Cargar opciones de filtro cuando se abre el modal
  useEffect(() => {
    if (show && grupoFamiliarId) {
      cargarOpcionesFiltro();
      // Cargar historial inicial sin filtros
      cargarHistorial();
    } else {
      // Limpiar datos al cerrar
      setHistorial([]);
      setError("");
      setFiltroClienteId("");
      setFiltroAnio("");
      setFiltroCompaniaId("");
      setClientes([]);
      setCompanias([]);
      setAnios([]);
    }
  }, [show, grupoFamiliarId]);

  // Cargar historial cuando cambian los filtros (solo si el modal está abierto)
  useEffect(() => {
    if (show && grupoFamiliarId) {
      // Usar un pequeño delay para evitar múltiples llamadas rápidas
      const timeoutId = setTimeout(() => {
        cargarHistorial();
      }, 300);
      
      return () => clearTimeout(timeoutId);
    }
  }, [filtroClienteId, filtroAnio, filtroCompaniaId, show, grupoFamiliarId]);

  const cargarOpcionesFiltro = async () => {
    if (!grupoFamiliarId) return;

    setLoadingOpciones(true);
    try {
      // Obtener el grupo familiar completo para extraer clientes y compañías
      const grupoData = await GrupoFamiliarService.getFullById(grupoFamiliarId);

      // Extraer clientes únicos del grupo
      const clientesUnicos = new Map();
      (grupoData?.coberturas || []).forEach((cob) => {
        const cliente = cob?.cliente;
        if (cliente?.id) {
          if (!clientesUnicos.has(cliente.id)) {
            clientesUnicos.set(cliente.id, {
              id: cliente.id,
              nombre: cliente.nombre_completo || 
                     `${cliente.primer_nombre || ""} ${cliente.apellidos || ""}`.trim() ||
                     `Cliente ${cliente.id}`,
            });
          }
        }
      });
      setClientes(Array.from(clientesUnicos.values()));

      // Extraer compañías únicas
      const companiasUnicas = new Map();
      (grupoData?.coberturas || []).forEach((cob) => {
        const compania = cob?.compania;
        if (compania?.id) {
          if (!companiasUnicas.has(compania.id)) {
            companiasUnicas.set(compania.id, {
              id: compania.id,
              nombre: compania.nombre || `Compañía ${compania.id}`,
            });
          }
        }
      });
      setCompanias(Array.from(companiasUnicas.values()));

      // Generar lista de años (últimos 10 años hasta el próximo)
      const anioActual = new Date().getFullYear();
      const listaAnios = [];
      for (let i = anioActual + 1; i >= anioActual - 10; i--) {
        listaAnios.push(i);
      }
      setAnios(listaAnios);
    } catch (err) {
      console.error("Error al cargar opciones de filtro:", err);
    } finally {
      setLoadingOpciones(false);
    }
  };

  const cargarHistorial = async () => {
    if (!grupoFamiliarId) return;

    setLoading(true);
    setError("");

    try {
      // Construir query params
      const params = new URLSearchParams();
      params.append("grupo_familiar_id", grupoFamiliarId);
      
      if (filtroClienteId) {
        params.append("cliente_id", filtroClienteId);
      }
      if (filtroAnio) {
        params.append("anio", filtroAnio);
      }
      if (filtroCompaniaId) {
        params.append("compania_id", filtroCompaniaId);
      }

      // Llamar al endpoint de historial de renovaciones con filtros
      const response = await apiRequest(
        `coberturas/historial-renovaciones?${params.toString()}`,
        "GET"
      );

      // Manejar diferentes formatos de respuesta (incluyendo paginación de Laravel)
      let datos = [];
      if (Array.isArray(response)) {
        datos = response;
      } else if (Array.isArray(response?.data)) {
        // Respuesta paginada de Laravel: { data: [...], current_page: 1, ... }
        datos = response.data;
      } else if (response?.data?.data && Array.isArray(response.data.data)) {
        datos = response.data.data;
      } else if (response?.coberturas_canceladas && Array.isArray(response.coberturas_canceladas)) {
        datos = response.coberturas_canceladas;
      }

      // Extraer grupo_familiar_info del primer elemento (es el mismo para todos)
      if (datos.length > 0) {
        const primerItem = datos[0];
        const grupoInfo = primerItem?.grupo_familiar_info || 
                         primerItem?.grupo_familiarInfo ||
                         primerItem?.grupo_familiar;
        
        if (grupoInfo) {
          // Intentar parsear si es string JSON
          try {
            const parsed = typeof grupoInfo === 'string' ? JSON.parse(grupoInfo) : grupoInfo;
            setGrupoFamiliarInfo(parsed);
          } catch {
            setGrupoFamiliarInfo(grupoInfo);
          }
        }
      }

      setHistorial(datos);
    } catch (err) {
      console.error("Error al cargar historial de coberturas canceladas:", err);
      setError(
        err?.message || "No se pudo cargar el historial de coberturas canceladas."
      );
      setHistorial([]);
    } finally {
      setLoading(false);
    }
  };

  // Formatear fecha sin alterar el día (evita problemas de zona horaria)
  const formatearFecha = (fecha) => {
    if (!fecha) return "-";
    try {
      // Si ya es un string en formato YYYY-MM-DD, extraer componentes directamente
      if (typeof fecha === 'string') {
        // Formato YYYY-MM-DD
        const matchDateOnly = fecha.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (matchDateOnly) {
          const [, year, month, day] = matchDateOnly;
          return `${day}/${month}/${year}`;
        }
        
        // Formato ISO con hora: YYYY-MM-DDTHH:mm:ss o YYYY-MM-DD HH:mm:ss
        const matchDateTime = fecha.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2}):(\d{2})/);
        if (matchDateTime) {
          const [, year, month, day] = matchDateTime;
          return `${day}/${month}/${year}`;
        }
      }
      
      // Si es un objeto Date, usar métodos locales para evitar desfase
      const d = fecha instanceof Date ? fecha : new Date(fecha);
      if (isNaN(d.getTime())) return fecha;
      
      // Usar métodos locales (getFullYear, getMonth, getDate) que respetan la zona horaria local
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${day}/${month}/${year}`;
    } catch {
      return fecha;
    }
  };

  // Formatear fecha y hora completa sin alterar el día
  const formatearFechaHora = (fecha) => {
    if (!fecha) return "-";
    try {
      // Si es un string ISO, extraer componentes directamente
      if (typeof fecha === 'string') {
        // Formato ISO: YYYY-MM-DDTHH:mm:ss o YYYY-MM-DD HH:mm:ss
        const matchDateTime = fecha.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2}):(\d{2})/);
        if (matchDateTime) {
          const [, year, month, day, hour, minute, second] = matchDateTime;
          return `${day}/${month}/${year} ${hour}:${minute}:${second}`;
        }
        
        // Formato YYYY-MM-DD (solo fecha)
        const matchDateOnly = fecha.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (matchDateOnly) {
          const [, year, month, day] = matchDateOnly;
          return `${day}/${month}/${year} 00:00:00`;
        }
      }
      
      // Si es un objeto Date, usar métodos locales
      const d = fecha instanceof Date ? fecha : new Date(fecha);
      if (isNaN(d.getTime())) return fecha;
      
      // Usar métodos locales para evitar desfase
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const hour = String(d.getHours()).padStart(2, "0");
      const minute = String(d.getMinutes()).padStart(2, "0");
      const second = String(d.getSeconds()).padStart(2, "0");
      return `${day}/${month}/${year} ${hour}:${minute}:${second}`;
    } catch {
      return fecha;
    }
  };

  // Obtener información de auditoría del historial
  const obtenerInfoAuditoria = () => {
    if (historial.length === 0) return null;

    // Intentar obtener del primer elemento
    const primerItem = historial[0];
    
    // Según la estructura del JSON: ejecutado_por.name y created_at están en el nivel raíz
    const fechaCreacion = primerItem?.created_at;
    
    // Usuario desde ejecutado_por.name
    const usuario = primerItem?.ejecutado_por?.name || 
                   primerItem?.ejecutado_por?.nombre ||
                   primerItem?.usuario || 
                   primerItem?.created_by || 
                   "Sistema";

    // Verificar si hay múltiples usuarios o fechas diferentes
    const usuariosUnicos = new Set();
    const fechasUnicas = new Set();
    
    historial.forEach(item => {
      const fechaItem = item?.created_at;
      const usuarioItem = item?.ejecutado_por?.name || 
                         item?.ejecutado_por?.nombre ||
                         item?.usuario || 
                         item?.created_by;
      
      if (fechaItem) fechasUnicas.add(fechaItem);
      if (usuarioItem) usuariosUnicos.add(usuarioItem);
    });

    // Si hay múltiples fechas o usuarios, mostrar información agregada
    const tieneMultiplesFechas = fechasUnicas.size > 1;
    const tieneMultiplesUsuarios = usuariosUnicos.size > 1;

    return {
      fecha: fechaCreacion,
      usuario: tieneMultiplesUsuarios ? `${usuariosUnicos.size} usuarios diferentes` : usuario,
      cantidad: historial.length,
      tieneInfo: !!(fechaCreacion || usuario !== "Sistema"),
      tieneMultiplesFechas,
      tieneMultiplesUsuarios,
    };
  };

  // Formatear dinero
  const formatearDinero = (valor) => {
    if (valor === null || valor === undefined || valor === "") return "-";
    const num = Number(valor);
    if (isNaN(num)) return valor;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(num);
  };

  // Limpiar filtros
  const limpiarFiltros = () => {
    setFiltroClienteId("");
    setFiltroAnio("");
    setFiltroCompaniaId("");
  };

  // Verificar si hay filtros activos
  const hayFiltrosActivos = filtroClienteId || filtroAnio || filtroCompaniaId;

  // Toggle para expandir/contraer filas
  const toggleFila = (coberturaId) => {
    setFilasExpandidas((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(coberturaId)) {
        nuevo.delete(coberturaId);
      } else {
        nuevo.add(coberturaId);
      }
      return nuevo;
    });
  };

  // Parsear cliente_info
  const parsearClienteInfo = (clienteInfo) => {
    if (!clienteInfo) return null;
    try {
      return typeof clienteInfo === 'string' ? JSON.parse(clienteInfo) : clienteInfo;
    } catch {
      return clienteInfo;
    }
  };

  // Renderizar información del cliente en formato de tarjeta
  const renderClienteInfo = (clienteInfo) => {
    // cliente_info ya viene como objeto según la estructura del JSON
    const info = typeof clienteInfo === 'object' ? clienteInfo : parsearClienteInfo(clienteInfo);
    if (!info || typeof info !== 'object') return null;

    const campos = [
      { key: 'nombre_completo', label: 'Nombre Completo' },
      { key: 'primer_nombre', label: 'Primer Nombre' },
      { key: 'segundo_nombre', label: 'Segundo Nombre' },
      { key: 'apellidos', label: 'Apellidos' },
      { key: 'fecha_nacimiento', label: 'Fecha de Nacimiento', formatter: (v) => formatearFecha(v) },
      { key: 'edad', label: 'Edad' },
      { key: 'genero', label: 'Género' },
      { key: 'idioma', label: 'Idioma' },
      { key: 'telefono', label: 'Teléfono' },
      { key: 'email', label: 'Email' },
      { key: 'calle', label: 'Calle' },
      { key: 'apto', label: 'Apartamento' },
      { key: 'ciudad', label: 'Ciudad' },
      { key: 'estado', label: 'Estado' },
      { key: 'codigo_postal', label: 'Código Postal' },
      { key: 'condado', label: 'Condado' },
      { key: 'dir_correspondencia', label: 'Dirección de Correspondencia' },
      { key: 'ingreso_anual', label: 'Ingreso Anual', formatter: formatearDinero },
      { key: 'ingreso_por_periodo', label: 'Ingreso por Período', formatter: formatearDinero },
      { key: 'periodo_ingreso', label: 'Período de Ingreso' },
      { key: 'tipo_ingreso', label: 'Tipo de Ingreso' },
      { key: 'empleador', label: 'Empleador' },
      { key: 'telefono_empleador', label: 'Teléfono Empleador' },
      { key: 'status', label: 'Status' },
      { key: 'social', label: 'Social Security' },
      { key: 'auscis', label: 'AUSCIS' },
      { key: 'tarjeta_numero', label: 'Número de Tarjeta' },
      { key: 'categoria', label: 'Categoría' },
      { key: 'fecha_emision', label: 'Fecha de Emisión' },
      { key: 'fecha_expiracion', label: 'Fecha de Expiración' },
      { key: 'nota', label: 'Nota' },
      { key: 'estado_cliente', label: 'Estado del Cliente' },
    ];
    
    // Agregar información de teléfonos si existe
    const telefonos = info.telefonos || [];

    return (
      <div className="row g-3 mt-2">
        {campos.map((campo) => {
          const valor = info[campo.key];
          if (valor === null || valor === undefined || valor === '') return null;
          
          return (
            <div key={campo.key} className="col-md-6">
              <small className="text-muted d-block">{campo.label}:</small>
              <div className="fw-semibold">
                {campo.formatter ? campo.formatter(valor) : String(valor)}
              </div>
            </div>
          );
        })}
        
        {/* Mostrar teléfonos si existen */}
        {telefonos.length > 0 && (
          <div className="col-md-12">
            <small className="text-muted d-block">Teléfonos:</small>
            <div className="fw-semibold">
              {telefonos.map((tel, idx) => (
                <div key={idx} className="mb-1">
                  {tel.numero && (
                    <span>
                      {tel.indicativo ? `+${tel.indicativo} ` : ''}
                      {tel.numero}
                      {tel.tipo && ` (${tel.tipo})`}
                      {tel.principal && <Badge bg="primary" className="ms-1">Principal</Badge>}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Renderizar información completa de la cobertura
  const renderCoberturaCompleta = (item) => {
    return (
      <div className="row g-3">
        {/* Información de la Cobertura */}
        <Col md={6}>
          <Card className="h-100 border-primary">
            <Card.Header className="bg-primary text-white">
              <h6 className="mb-0">
                <i className="fas fa-shield-alt me-2"></i>
                Información de la Cobertura
              </h6>
            </Card.Header>
            <Card.Body>
              <div className="row g-2">
                <div className="col-12">
                  <small className="text-muted">Código Póliza:</small>
                  <div className="fw-semibold">{item?.codigo_poliza || "-"}</div>
                </div>
                <div className="col-12">
                  <small className="text-muted">Tipo de Cobertura:</small>
                  <div className="fw-semibold">{item?.cobertura_tipo || "-"}</div>
                </div>
                <div className="col-6">
                  <small className="text-muted">Plan:</small>
                  <div className="fw-semibold">{item?.plan || "-"}</div>
                </div>
                <div className="col-6">
                  <small className="text-muted">Metal:</small>
                  <div className="fw-semibold">{item?.metal || "-"}</div>
                </div>
                <div className="col-6">
                  <small className="text-muted">Red:</small>
                  <div className="fw-semibold">{item?.red || "-"}</div>
                </div>
                <div className="col-6">
                  <small className="text-muted">Grupo:</small>
                  <div className="fw-semibold">{item?.grupo || "-"}</div>
                </div>
                <div className="col-6">
                  <small className="text-muted">Año de Cobertura:</small>
                  <div className="fw-semibold">{item?.ano_cobertura || "-"}</div>
                </div>
                <div className="col-6">
                  <small className="text-muted">Elegibilidad:</small>
                  <div className="fw-semibold">{item?.elegibilidad || "-"}</div>
                </div>
                <div className="col-6">
                  <small className="text-muted">Estado de Cobertura:</small>
                  <div className="fw-semibold">{item?.estado_cobertura || "-"}</div>
                </div>
                <div className="col-6">
                  <small className="text-muted">Precio:</small>
                  <div className="fw-semibold text-success">
                    {formatearDinero(item?.precio)}
                  </div>
                </div>
                <div className="col-6">
                  <small className="text-muted">Compañía:</small>
                  <div className="fw-semibold">
                    {item?.compania?.nombre || "-"}
                  </div>
                </div>
                <div className="col-6">
                  <small className="text-muted">ID Cobertura Original:</small>
                  <div className="fw-semibold">{item?.cobertura_id_original || "-"}</div>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Información de Fechas y Pagos */}
        <Col md={6}>
          <Card className="h-100 border-info">
            <Card.Header className="bg-info text-white">
              <h6 className="mb-0">
                <i className="fas fa-calendar-alt me-2"></i>
                Fechas y Pagos
              </h6>
            </Card.Header>
            <Card.Body>
              <div className="row g-2">
                <div className="col-6">
                  <small className="text-muted">Fecha de Activación:</small>
                  <div className="fw-semibold">
                    {formatearFecha(item?.fecha_activacion)}
                  </div>
                </div>
                <div className="col-6">
                  <small className="text-muted">Fecha de Cancelación:</small>
                  <div className="fw-semibold text-danger">
                    {formatearFecha(item?.fecha_cancelacion)}
                  </div>
                </div>
                <div className="col-6">
                  <small className="text-muted">Fecha de Retiro:</small>
                  <div className="fw-semibold">
                    {formatearFecha(item?.fecha_retiro)}
                  </div>
                </div>
                <div className="col-6">
                  <small className="text-muted">Tipo de Pago:</small>
                  <div className="fw-semibold">{item?.tipo_pago || "-"}</div>
                </div>
                <div className="col-6">
                  <small className="text-muted">Día de Pago:</small>
                  <div className="fw-semibold">{item?.dia_pago || "-"}</div>
                </div>
                <div className="col-12">
                  <small className="text-muted">Parentesco:</small>
                  <div className="fw-semibold">
                    {item?.parentesco || "-"}
                    {item?.parentesco?.toUpperCase() === "TOMADOR" && (
                      <Badge bg="warning" text="dark" className="ms-2">TOMADOR</Badge>
                    )}
                  </div>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Información de Cancelación */}
        <Col md={12}>
          <Card className="border-warning">
            <Card.Header className="bg-warning text-dark">
              <h6 className="mb-0">
                <i className="fas fa-exclamation-triangle me-2"></i>
                Información de Cancelación
              </h6>
            </Card.Header>
            <Card.Body>
              <div className="row g-2">
                <div className="col-md-4">
                  <small className="text-muted">Motivo de Cancelación:</small>
                  <div className="fw-semibold">
                    {item?.motivo_cancelacion || "-"}
                  </div>
                </div>
                <div className="col-md-4">
                  <small className="text-muted">Acción Origen:</small>
                  <div className="fw-semibold">
                    <Badge bg="secondary">
                      {item?.accion_origen || "N/A"}
                    </Badge>
                  </div>
                </div>
                <div className="col-md-12">
                  <small className="text-muted">Nota de Cancelación:</small>
                  <div className="fw-semibold">
                    {item?.nota_cancel || "-"}
                  </div>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </div>
    );
  };

  return (
    <>
      <style>{`
        .modal-historial-canceladas .modal-dialog {
          max-width: 95vw;
          width: 1400px;
        }
        .modal-historial-canceladas .modal-content {
          max-height: 90vh;
        }
        .modal-historial-canceladas .modal-body {
          max-height: calc(90vh - 120px);
          overflow-y: auto;
        }
      `}</style>
      <Modal 
        show={show} 
        onHide={onClose} 
        size="xl" 
        centered
        dialogClassName="modal-historial-canceladas"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="fas fa-history text-primary me-2"></i>
            Historial de Coberturas Canceladas
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
        {/* Información del Grupo Familiar (Encabezado) */}
        {grupoFamiliarInfo && (
          <Card className="mb-4 border-primary">
            <Card.Header className="bg-primary text-white">
              <h6 className="mb-0">
                <i className="fas fa-users me-2"></i>
                Información del Grupo Familiar
              </h6>
            </Card.Header>
            <Card.Body>
              <Row>
                {grupoFamiliarInfo.responsable && (
                  <Col md={4} className="mb-2">
                    <small className="text-muted">Responsable:</small>
                    <div className="fw-semibold">{grupoFamiliarInfo.responsable}</div>
                  </Col>
                )}
                {grupoFamiliarInfo.persona_contacto && (
                  <Col md={4} className="mb-2">
                    <small className="text-muted">Persona de Contacto:</small>
                    <div className="fw-semibold">{grupoFamiliarInfo.persona_contacto}</div>
                  </Col>
                )}
                {grupoFamiliarInfo.ingreso_familiar_anual && (
                  <Col md={4} className="mb-2">
                    <small className="text-muted">Ingreso Familiar Anual:</small>
                    <div className="fw-semibold">{formatearDinero(grupoFamiliarInfo.ingreso_familiar_anual)}</div>
                  </Col>
                )}
                {grupoFamiliarInfo.personas_cobertura && (
                  <Col md={4} className="mb-2">
                    <small className="text-muted">Personas en Cobertura:</small>
                    <div className="fw-semibold">{grupoFamiliarInfo.personas_cobertura}</div>
                  </Col>
                )}
                {grupoFamiliarInfo.personas_taxes && (
                  <Col md={4} className="mb-2">
                    <small className="text-muted">Personas en Taxes:</small>
                    <div className="fw-semibold">{grupoFamiliarInfo.personas_taxes}</div>
                  </Col>
                )}
                {grupoFamiliarInfo.zip_code && (
                  <Col md={4} className="mb-2">
                    <small className="text-muted">ZIP Code:</small>
                    <div className="fw-semibold">{grupoFamiliarInfo.zip_code}</div>
                  </Col>
                )}
                {grupoFamiliarInfo.nota && (
                  <Col md={12} className="mb-2">
                    <small className="text-muted">Nota:</small>
                    <div className="fw-semibold">{grupoFamiliarInfo.nota}</div>
                  </Col>
                )}
              </Row>
            </Card.Body>
          </Card>
        )}

        {/* Filtros */}
        <div className="mb-4 p-3 bg-light rounded border">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h6 className="mb-0">
              <i className="fas fa-filter text-primary me-2"></i>
              Filtros de búsqueda
            </h6>
            {hayFiltrosActivos && (
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={limpiarFiltros}
              >
                <i className="fas fa-times me-1"></i>
                Limpiar filtros
              </Button>
            )}
          </div>

          <Row>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>
                  <small className="text-muted">Cliente</small>
                </Form.Label>
                <Form.Select
                  value={filtroClienteId}
                  onChange={(e) => setFiltroClienteId(e.target.value)}
                  size="sm"
                >
                  <option value="">Todos los clientes</option>
                  {clientes.map((cliente) => (
                    <option key={cliente.id} value={cliente.id}>
                      {cliente.nombre}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>

            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>
                  <small className="text-muted">Año</small>
                </Form.Label>
                <Form.Select
                  value={filtroAnio}
                  onChange={(e) => setFiltroAnio(e.target.value)}
                  size="sm"
                >
                  <option value="">Todos los años</option>
                  {anios.map((anio) => (
                    <option key={anio} value={anio}>
                      {anio}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>

            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>
                  <small className="text-muted">Compañía</small>
                </Form.Label>
                <Form.Select
                  value={filtroCompaniaId}
                  onChange={(e) => setFiltroCompaniaId(e.target.value)}
                  size="sm"
                >
                  <option value="">Todas las compañías</option>
                  {companias.map((compania) => (
                    <option key={compania.id} value={compania.id}>
                      {compania.nombre}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>

          {hayFiltrosActivos && (
            <div className="mt-2">
              <small className="text-muted">
                <i className="fas fa-info-circle me-1"></i>
                Filtros activos:{" "}
                {filtroClienteId && (
                  <Badge bg="primary" className="me-1">
                    Cliente: {clientes.find((c) => c.id === Number(filtroClienteId))?.nombre || filtroClienteId}
                  </Badge>
                )}
                {filtroAnio && (
                  <Badge bg="info" className="me-1">
                    Año: {filtroAnio}
                  </Badge>
                )}
                {filtroCompaniaId && (
                  <Badge bg="success" className="me-1">
                    Compañía: {companias.find((c) => c.id === Number(filtroCompaniaId))?.nombre || filtroCompaniaId}
                  </Badge>
                )}
              </small>
            </div>
          )}
        </div>

        {loadingOpciones ? (
          <div className="text-center py-2">
            <Spinner animation="border" size="sm" variant="secondary" />
            <small className="text-muted ms-2">Cargando opciones...</small>
          </div>
        ) : null}

        {loading ? (
          <div className="text-center py-4">
            <Spinner animation="border" variant="primary" />
            <p className="mt-2 text-muted">Cargando historial...</p>
          </div>
        ) : error ? (
          <Alert variant="danger">
            <i className="fas fa-exclamation-circle me-2"></i>
            {error}
          </Alert>
        ) : historial.length === 0 ? (
          <Alert variant="info">
            <i className="fas fa-info-circle me-2"></i>
            {hayFiltrosActivos
              ? "No se encontraron coberturas canceladas con los filtros seleccionados."
              : "No hay coberturas canceladas registradas en el historial."}
          </Alert>
        ) : (
          <div className="table-responsive">
            <Table bordered hover size="sm">
              <thead className="table-light sticky-top">
                <tr>
                  <th width="40"></th>
                  <th>Código Póliza</th>
                  <th>Cliente</th>
                  <th>Parentesco</th>
                  <th>Plan</th>
                  <th>Fecha Cancelación</th>
                  <th>Fecha Retiro</th>
                  <th>Motivo</th>
                  <th>Nota</th>
                  <th>Acción Origen</th>
                </tr>
              </thead>
              <tbody>
                {historial.map((item, index) => {
                  // Según la estructura del JSON, los datos están directamente en item
                  const coberturaId = item?.id || `cobertura-${index}`;
                  const isExpanded = filasExpandidas.has(coberturaId);
                  const clienteInfo = item?.cliente_info;
                  
                  // Extraer nombre del cliente desde cliente_info (ya viene como objeto)
                  let nombreCliente = "-";
                  if (clienteInfo && typeof clienteInfo === 'object') {
                    nombreCliente = clienteInfo.nombre_completo || 
                                   `${clienteInfo.primer_nombre || ""} ${clienteInfo.apellidos || ""}`.trim() ||
                                   "-";
                  }
                  
                  return (
                    <React.Fragment key={coberturaId}>
                      <tr 
                        style={{ cursor: 'pointer' }}
                        onClick={() => toggleFila(coberturaId)}
                      >
                        <td 
                          style={{ textAlign: 'center', cursor: 'pointer' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFila(coberturaId);
                          }}
                        >
                          {isExpanded ? (
                            <FaChevronDown className="text-primary" />
                          ) : (
                            <FaChevronRight className="text-muted" />
                          )}
                        </td>
                        <td>
                          <strong>{item?.codigo_poliza || "-"}</strong>
                        </td>
                        <td>
                          {nombreCliente}
                          {item?.parentesco?.toUpperCase() === "TOMADOR" && (
                            <Badge bg="warning" text="dark" className="ms-2">
                              TOMADOR
                            </Badge>
                          )}
                        </td>
                        <td>{item?.parentesco || "-"}</td>
                        <td>{item?.plan || "-"}</td>
                        <td>
                          {formatearFecha(item?.fecha_cancelacion)}
                        </td>
                        <td>
                          {formatearFecha(item?.fecha_retiro)}
                        </td>
                        <td>
                          {item?.motivo_cancelacion || "-"}
                        </td>
                        <td>
                          <small className="text-muted">
                            {item?.nota_cancel || "-"}
                          </small>
                        </td>
                        <td>
                          <Badge bg="secondary">
                            {item?.accion_origen || "N/A"}
                          </Badge>
                        </td>
                      </tr>
                      {/* Fila expandible con información completa */}
                      {isExpanded && (
                        <tr>
                          <td colSpan="10" style={{ padding: 0, border: 'none' }}>
                            <div className="bg-light p-4 border-top">
                              {/* Información de la Cobertura */}
                              {renderCoberturaCompleta(item, item)}
                              
                              {/* Información del Cliente */}
                              {clienteInfo && (
                                <div className="mt-4">
                                  <Card className="border-success">
                                    <Card.Header className="bg-success text-white">
                                      <h6 className="mb-0">
                                        <i className="fas fa-user me-2"></i>
                                        Información del Cliente
                                      </h6>
                                    </Card.Header>
                                    <Card.Body>
                                      {renderClienteInfo(clienteInfo)}
                                    </Card.Body>
                                  </Card>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </Table>
          </div>
        )}

        {historial.length > 0 && (
          <div className="mt-3">
            <Badge bg="info">
              Total: {historial.length} cobertura(s) cancelada(s)
            </Badge>
          </div>
        )}
      </Modal.Body>
      <Modal.Footer className="d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div className="text-muted small">
          {(() => {
            const infoAuditoria = obtenerInfoAuditoria();
            if (!infoAuditoria || !infoAuditoria.tieneInfo) {
              return (
                <div className="d-flex align-items-center gap-2">
                  <i className="fas fa-info-circle"></i>
                  <span>Información de auditoría no disponible</span>
                </div>
              );
            }
            
            return (
              <div className="d-flex align-items-center flex-wrap gap-3">
                {infoAuditoria.usuario && infoAuditoria.usuario !== "Sistema" && (
                  <div className="d-flex align-items-center">
                    <i className="fas fa-user text-primary me-1"></i>
                    <span><strong>Procesado por:</strong> {infoAuditoria.usuario}</span>
                  </div>
                )}
                {infoAuditoria.fecha && (
                  <div className="d-flex align-items-center">
                    <i className="fas fa-clock text-info me-1"></i>
                    <span><strong>Fecha y hora:</strong> {formatearFechaHora(infoAuditoria.fecha)}</span>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
        <Button variant="secondary" onClick={onClose}>
          Cerrar
        </Button>
      </Modal.Footer>
    </Modal>
    </>
  );
};

export default HistorialCoberturasCanceladasModal;

