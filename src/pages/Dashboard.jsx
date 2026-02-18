// Dashboard.js con integración de modal de edición
import React, { useState, useEffect, useCallback } from "react";
import { Card, Row, Col, Button, Table, Badge, Alert, Form, Dropdown, Accordion } from "react-bootstrap";
import { Link } from "react-router-dom";
import {
  FaUsers, FaProjectDiagram, FaCalendarAlt, FaExclamationTriangle,
  FaPlus, FaList, FaChartLine, FaFileInvoiceDollar, FaEdit, FaEye,
  FaBirthdayCake, FaMoneyBillWave, FaCheckSquare, FaCog
} from "react-icons/fa";
import "../styles/Dashboard.css";
import apiRequest from "../services/api";
import EditClienteModal from "../components/EditClienteModal"; // Importamos el modal de edición
// Importar el componente modal de visualización
import DetalleClienteModal from "../components/DetalleClienteModal";
import CalendarioTareas from "../components/Tareas/CalendarioTareas";
import { Helmet } from "react-helmet-async";



const Dashboard = () => {
  const currentUser = JSON.parse(localStorage.getItem("user"));
  

  const [clientesRecientes, setClientesRecientes] = useState([]);
  const [polizasCanceladas, setPolizasCanceladas] = useState([]);
  const [documentosProximosVencer, setDocumentosProximosVencer] = useState([]);
  const [tareas, setTareas] = useState([]);
  const [loadingTareas, setLoadingTareas] = useState(true);
  
  const [polizasProximasVencer, setPolizasProximasVencer] = useState([]);
  const [estadisticas, setEstadisticas] = useState({
    totalClientes: 0,
    totalGruposFamiliares: 0,
    polizasActivas: 0,
    polizasVencidas: 0
  });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  
  // Estados para el modal de edición
  const [showEditModal, setShowEditModal] = useState(false);
  const [clienteToEdit, setClienteToEdit] = useState(null);
  const [clienteDataToEdit, setClienteDataToEdit] = useState(null);
  // Agregar estados para el modal de visualización
  const [showViewModal, setShowViewModal] = useState(false);
  const [clienteToView, setClienteToView] = useState(null);
  const [filtroDias, setFiltroDias] = useState(15);

  // Estados para nuevos KPIs de alertas
  const [cumpleanosMes, setCumpleanosMes] = useState([]);
  const [pagosPendientes, setPagosPendientes] = useState([]);
  const [mesPagosSeleccionado, setMesPagosSeleccionado] = useState(() => {
    const hoy = new Date();
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
  });
  const [loadingCumpleanos, setLoadingCumpleanos] = useState(false);
  const [loadingPagos, setLoadingPagos] = useState(false);
  const [showConfigAccordion, setShowConfigAccordion] = useState(false);

  // Preferencias de visualización del usuario
  // Se cargan desde el backend al iniciar, con fallback a localStorage
  const [preferenciasVisualizacion, setPreferenciasVisualizacion] = useState({
    mostrarCumpleanos: true,
    mostrarPagosPendientes: true,
    mostrarDocumentosSolicitados: true,
    mostrarCalendario: true,
    mostrarClientesRecientes: true,
    mostrarPolizasCanceladas: true
  });
  const [cargandoPreferencias, setCargandoPreferencias] = useState(true);

  // Función para parsear fecha de nacimiento correctamente
  const parsearFechaNacimiento = useCallback((fechaStr) => {
    if (!fechaStr) return null;
    
    try {
      // Si viene en formato YYYY-MM-DD, parsear manualmente para evitar problemas de zona horaria
      if (typeof fechaStr === 'string' && fechaStr.includes('-')) {
        const partes = fechaStr.split('-');
        if (partes.length === 3) {
          const año = parseInt(partes[0], 10);
          const mes = parseInt(partes[1], 10) - 1; // Mes es 0-indexado
          const dia = parseInt(partes[2], 10);
          
          if (!isNaN(año) && !isNaN(mes) && !isNaN(dia)) {
            return new Date(año, mes, dia, 12, 0, 0); // Mediodía para evitar problemas de zona horaria
          }
        }
      }
      
      // Fallback: intentar parsear directamente
      const fecha = new Date(fechaStr);
      if (!isNaN(fecha.getTime())) {
        return fecha;
      }
    } catch (error) {
      console.warn("Error al parsear fecha:", fechaStr, error);
    }
    
    return null;
  }, []);

  // Función para cargar cumpleaños del día de hoy
  const cargarCumpleanos = useCallback(async () => {
    if (!preferenciasVisualizacion || !preferenciasVisualizacion.mostrarCumpleanos) {
      setCumpleanosMes([]);
      return;
    }
    
    setLoadingCumpleanos(true);
    try {
      const hoy = new Date();
      const diaHoy = hoy.getDate();
      const mesHoy = hoy.getMonth() + 1;
      const año = hoy.getFullYear();
      
      let clientes = [];
      
      // Intentar endpoint específico para cumpleaños del mes (compatible con backend existente)
      try {
        const res = await apiRequest(`cliente/cumpleanos?mes=${mesHoy}&año=${año}`, "GET");
        clientes = Array.isArray(res) ? res : (res?.data || []);
      } catch (error) {
        // Si falla el endpoint de cumpleaños, obtener todos los clientes y filtrar manualmente
        console.warn("Endpoint de cumpleaños no disponible, filtrando manualmente:", error);
        try {
          const res = await apiRequest("cliente?per_page=1000", "GET");
          clientes = Array.isArray(res) ? res : (res?.data || []);
        } catch (err) {
          console.error("Error al obtener clientes:", err);
          setCumpleanosMes([]);
          return;
        }
      }
      
      // Filtrar solo los que cumplen años HOY (día y mes)
      const cumpleanosHoy = clientes.filter(cliente => {
        if (!cliente.fecha_nacimiento) return false;
        
        const fechaNac = parsearFechaNacimiento(cliente.fecha_nacimiento);
        if (!fechaNac) return false;
        
        const diaNac = fechaNac.getDate();
        const mesNac = fechaNac.getMonth() + 1;
        
        return diaNac === diaHoy && mesNac === mesHoy;
      });
      
      setCumpleanosMes(cumpleanosHoy);
    } catch (error) {
      console.error("Error al cargar cumpleaños:", error);
      setCumpleanosMes([]);
    } finally {
      setLoadingCumpleanos(false);
    }
  }, [preferenciasVisualizacion?.mostrarCumpleanos, parsearFechaNacimiento]);

  // Función para cargar pagos pendientes del mes seleccionado
  const cargarPagosPendientes = useCallback(async () => {
    if (!preferenciasVisualizacion || !preferenciasVisualizacion.mostrarPagosPendientes) {
      setPagosPendientes([]);
      return;
    }
    
    setLoadingPagos(true);
    try {
      const [año, mes] = mesPagosSeleccionado.split('-');
      const res = await apiRequest("cobertura/pagos/listado", "GET");
      const todosLosPagos = Array.isArray(res) ? res : (res?.data || []);
      
      // Filtrar pagos pendientes del mes seleccionado
      const pagosFiltrados = todosLosPagos.filter(pago => {
        if (pago.estado !== 'pendiente') return false;
        if (!pago.fecha_pago) return false;
        
        const fechaPago = new Date(pago.fecha_pago);
        return fechaPago.getFullYear() === parseInt(año) && 
               fechaPago.getMonth() + 1 === parseInt(mes);
      });
      
      setPagosPendientes(pagosFiltrados);
    } catch (error) {
      console.error("Error al cargar pagos pendientes:", error);
      setPagosPendientes([]);
    } finally {
      setLoadingPagos(false);
    }
  }, [mesPagosSeleccionado, preferenciasVisualizacion?.mostrarPagosPendientes]);

  // Función para cambiar preferencia de visualización
  const togglePreferencia = (key) => {
    setPreferenciasVisualizacion(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Función para cargar preferencias desde el backend
  const cargarPreferencias = useCallback(async () => {
    const userId = currentUser?.id;
    if (!userId) {
      // Si no hay usuario, usar valores por defecto
      setCargandoPreferencias(false);
      return;
    }

    setCargandoPreferencias(true);
    try {
      // Intentar cargar desde el backend
      const res = await apiRequest(`users/${userId}/preferences`, 'GET');
      
      // El backend debería retornar: { dashboard_preferences: { mostrarCumpleanos: true, ... } }
      if (res?.dashboard_preferences) {
        setPreferenciasVisualizacion({
          mostrarCumpleanos: res.dashboard_preferences.mostrarCumpleanos ?? true,
          mostrarPagosPendientes: res.dashboard_preferences.mostrarPagosPendientes ?? true,
          mostrarDocumentosSolicitados: res.dashboard_preferences.mostrarDocumentosSolicitados ?? true,
          mostrarCalendario: res.dashboard_preferences.mostrarCalendario ?? true,
          mostrarClientesRecientes: res.dashboard_preferences.mostrarClientesRecientes ?? true,
          mostrarPolizasCanceladas: res.dashboard_preferences.mostrarPolizasCanceladas ?? true
        });
      } else {
        // Si no hay preferencias en el backend, intentar cargar desde localStorage
        const storageKey = `dashboard_preferencias_${userId}`;
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          // Asegurar que todos los campos existan (para compatibilidad con versiones anteriores)
          setPreferenciasVisualizacion({
            mostrarCumpleanos: parsed.mostrarCumpleanos ?? true,
            mostrarPagosPendientes: parsed.mostrarPagosPendientes ?? true,
            mostrarDocumentosSolicitados: parsed.mostrarDocumentosSolicitados ?? true,
            mostrarCalendario: parsed.mostrarCalendario ?? true,
            mostrarClientesRecientes: parsed.mostrarClientesRecientes ?? true,
            mostrarPolizasCanceladas: parsed.mostrarPolizasCanceladas ?? true
          });
        }
      }
    } catch (error) {
      // Si falla el backend, usar localStorage como fallback
      console.warn('No se pudieron cargar preferencias del backend, usando localStorage:', error);
      const storageKey = `dashboard_preferencias_${userId}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setPreferenciasVisualizacion(JSON.parse(saved));
      }
    } finally {
      setCargandoPreferencias(false);
    }
  }, [currentUser?.id]);

  // Cargar preferencias al montar el componente
  useEffect(() => {
    cargarPreferencias();
  }, [cargarPreferencias]);

  // Cargar datos iniciales del dashboard (después de cargar preferencias)
  useEffect(() => {
    if (!cargandoPreferencias) {
      cargarDatos();
    }
  }, [cargandoPreferencias, preferenciasVisualizacion?.mostrarCalendario, preferenciasVisualizacion?.mostrarClientesRecientes, preferenciasVisualizacion?.mostrarPolizasCanceladas, preferenciasVisualizacion?.mostrarDocumentosSolicitados]);

  // Cargar cumpleaños cuando cambie la preferencia o al montar si está activo
  useEffect(() => {
    if (!cargandoPreferencias && preferenciasVisualizacion && preferenciasVisualizacion.mostrarCumpleanos) {
      cargarCumpleanos();
    } else if (!cargandoPreferencias) {
      setCumpleanosMes([]);
    }
  }, [preferenciasVisualizacion?.mostrarCumpleanos, cargarCumpleanos, cargandoPreferencias]);

  // Cargar pagos cuando cambie el mes o la preferencia o al montar si está activo
  useEffect(() => {
    if (!cargandoPreferencias && preferenciasVisualizacion && preferenciasVisualizacion.mostrarPagosPendientes) {
      cargarPagosPendientes();
    } else if (!cargandoPreferencias) {
      setPagosPendientes([]);
    }
  }, [mesPagosSeleccionado, preferenciasVisualizacion?.mostrarPagosPendientes, cargarPagosPendientes, cargandoPreferencias]);

  // Guardar preferencias cuando cambien (tanto en backend como localStorage)
  useEffect(() => {
    // No guardar si aún estamos cargando las preferencias iniciales
    if (cargandoPreferencias) return;

    const userId = currentUser?.id;
    if (!userId) return;

    const guardarPreferencias = async () => {
      // Guardar en localStorage como respaldo inmediato
      const storageKey = `dashboard_preferencias_${userId}`;
      localStorage.setItem(storageKey, JSON.stringify(preferenciasVisualizacion));
      
      // Guardar en el backend para persistir entre dispositivos
      try {
        await apiRequest(`users/${userId}/preferences`, 'PUT', {
          dashboard_preferences: preferenciasVisualizacion
        });
        console.log('✅ Preferencias guardadas en el backend');
      } catch (error) {
        console.warn('⚠️ No se pudo guardar preferencias en el backend:', error);
        // Si falla el backend, al menos tenemos localStorage como respaldo
      }
    };

    guardarPreferencias();
  }, [preferenciasVisualizacion, currentUser?.id, cargandoPreferencias]);
  
  const cargarDatos = async () => {
    // Solo cargar tareas si el calendario está activo
    if (preferenciasVisualizacion?.mostrarCalendario) {
      const resTareas = await apiRequest("tareas_operativas?per_page=100", "GET");
      setTareas(resTareas.data || []);
    } else {
      setTareas([]);
    }
    setLoadingTareas(false);

    setCargando(true);
    setError(null);
    try {
      // Solo cargar documentos si está activado en preferencias
      if (preferenciasVisualizacion?.mostrarDocumentosSolicitados) {
        const resDocumentos = await apiRequest(`documentos/proximos-vencer?dias=${filtroDias}`, "GET");
        setDocumentosProximosVencer(resDocumentos);
      } else {
        setDocumentosProximosVencer([]);
      }

      // Solo cargar clientes recientes si está activado
      if (preferenciasVisualizacion?.mostrarClientesRecientes) {
        const resClientes = await apiRequest("cliente/recientes", "GET");
        setClientesRecientes(resClientes.slice(0, 15));
      } else {
        setClientesRecientes([]);
      }

      // Solo cargar pólizas canceladas si está activado
      if (preferenciasVisualizacion?.mostrarPolizasCanceladas) {
        const resCanceladas = await apiRequest("cobertura/canceladas", "GET");
        setPolizasCanceladas(resCanceladas.slice(0, 15)); // Mostrar solo 15
      } else {
        setPolizasCanceladas([]);
      }


      const resPolizas = await apiRequest("cobertura/proximas-vencer", "GET");
      setPolizasProximasVencer(resPolizas.slice(0, 5));

      const resEstadisticas = await apiRequest("cliente/general", "GET");
      setEstadisticas(resEstadisticas);
    } catch (err) {
      console.error("Error al cargar datos del dashboard:", err);
      setError("Hubo un problema al cargar los datos. Por favor, intente nuevamente.");
    } finally {
      setCargando(false);
    }
  };

  const handleChangeFiltroDias = async (e) => {
    const dias = parseInt(e.target.value);
    setFiltroDias(dias);
    if (!preferenciasVisualizacion?.mostrarDocumentosSolicitados) return;
    
    try {
      const res = await apiRequest(`documentos/proximos-vencer?dias=${dias}`, "GET");
      setDocumentosProximosVencer(res);
    } catch (error) {
      console.error("Error filtrando documentos:", error);
    }
  };

  // Efecto para cargar documentos cuando se active la preferencia
  useEffect(() => {
    if (preferenciasVisualizacion?.mostrarDocumentosSolicitados) {
      const cargarDocumentos = async () => {
        try {
          const res = await apiRequest(`documentos/proximos-vencer?dias=${filtroDias}`, "GET");
          setDocumentosProximosVencer(res);
        } catch (error) {
          console.error("Error cargando documentos:", error);
        }
      };
      cargarDocumentos();
    } else {
      setDocumentosProximosVencer([]);
    }
  }, [preferenciasVisualizacion?.mostrarDocumentosSolicitados, filtroDias]);

  // Función para abrir el modal de visualización
const handleOpenViewModal = (cliente) => {
  setClienteToView(cliente);
  setShowViewModal(true);
};
  
  // Función para abrir el modal de edición
  const handleOpenEditModal = (cliente) => {
    setClienteToEdit(cliente.id);
    setClienteDataToEdit(cliente);
    setShowEditModal(true);
  };
  
  // Función para manejar la actualización del cliente
  const handleClienteUpdated = (updatedCliente) => {
    // Actualizar el cliente en la lista de clientes recientes
    setClientesRecientes(prevClientes => 
      prevClientes.map(cliente => 
        cliente.id === updatedCliente.id ? updatedCliente : cliente
      )
    );
    
  };

  // Función para renderizar el mensaje cuando no hay datos
  const renderEmptyMessage = (mensaje) => (
    <tr>
      <td colSpan="12" className="text-center py-12">
        <div className="empty-state">
          <FaList className="empty-icon" />
          <p>{mensaje}</p>
        </div>
      </td>
    </tr>
  );

  // Función para renderizar el estado de carga
  const renderLoading = () => (
    <tr>
      <td colSpan="4" className="text-center py-4">
        <div className="loading-state">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
          <p className="mt-2">Cargando datos...</p>
        </div>
      </td>
    </tr>
  );

  return (
    <div className="dashboard-wrapper">
 <Helmet>
      <title>Vantun/Panel Principal</title>
    </Helmet>
      {error && (
        <Row className="mb-4">
          <Col>
            <Alert variant="danger" className="d-flex align-items-center">
              <FaExclamationTriangle className="me-2" />
              <span>{error}</span>
            </Alert>
          </Col>
        </Row>
      )}

      <div className="section-container">
        <Row className="stats-cards g-3">
          <Col xl={3} md={6}>
            <Card className="dashboard-card h-100">
              <Card.Body>
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h6 className="stats-title">Total Clientes</h6>
                    <h3 className="stats-value">{estadisticas.totalClientes}</h3>
                  </div>
                  <div className="stats-icon"><FaUsers /></div>
                </div>
                <Link to="/clientes/lista" className="stretched-link"></Link>
              </Card.Body>
            </Card>
          </Col>
          <Col xl={3} md={6}>
            <Card className="dashboard-card h-100">
              <Card.Body>
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h6 className="stats-title">Grupos Familiares</h6>
                    <h3 className="stats-value">{estadisticas.totalGruposFamiliares}</h3>
                  </div>
                  <div className="stats-icon"><FaProjectDiagram /></div>
                </div>
                <Link to="/Grupofamiliar/lista" className="stretched-link"></Link>
              </Card.Body>
            </Card>
          </Col>
          <Col xl={3} md={6}>
            <Card className="dashboard-card h-100">
              <Card.Body>
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h6 className="stats-title">Pólizas Activas</h6>
                    <h3 className="stats-value">{estadisticas.polizasActivas}</h3>
                  </div>
                  <div className="stats-icon"><FaFileInvoiceDollar /></div>
                </div>
              </Card.Body>
            </Card>
          </Col>
          <Col xl={3} md={6}>
            <Card className="dashboard-card alert-card h-100">
              <Card.Body>
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h6 className="stats-title">Pólizas Canceladas</h6>
                    <h3 className="stats-value">{estadisticas.polizasCanceladas}</h3>
                  </div>
                  <div className="stats-icon"><FaCalendarAlt /></div>
                </div>
                
              </Card.Body>
            </Card>
          </Col>
          
        </Row>
      </div>


      {/* Nuevos KPIs de Alertas */}
      {(preferenciasVisualizacion.mostrarCumpleanos || preferenciasVisualizacion.mostrarPagosPendientes) && (
        <div className="section-container mt-4">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="section-title mb-0">Alertas y Recordatorios</h5>
          </div>
          
          <Row className="g-3">
            {/* KPI Cumpleaños */}
            {preferenciasVisualizacion.mostrarCumpleanos && (
              <Col xl={6} md={12}>
                <Card className="dashboard-card h-100">
                  <Card.Body>
                    <div className="d-flex justify-content-between align-items-start mb-3">
                      <div className="d-flex align-items-center gap-2">
                        <div className="stats-icon" style={{ background: "rgba(255, 193, 7, 0.1)", color: "#ffc107" }}>
                          <FaBirthdayCake />
                        </div>
                        <div>
                          <h6 className="stats-title mb-0">Cumpleaños de Hoy</h6>
                          <h3 className="stats-value" style={{ color: "#ffc107" }}>
                            {loadingCumpleanos ? "..." : cumpleanosMes.length}
                          </h3>
                        </div>
                      </div>
                    </div>
                    {loadingCumpleanos ? (
                      <div className="text-center py-3">
                        <div className="spinner-border spinner-border-sm text-warning" role="status">
                          <span className="visually-hidden">Cargando...</span>
                        </div>
                      </div>
                    ) : cumpleanosMes.length > 0 ? (
                      <div className="table-responsive" style={{ maxHeight: "200px", overflowY: "auto" }}>
                        <Table hover size="sm" className="mb-0">
                          <thead>
                            <tr>
                              <th>Cliente</th>
                              <th>Fecha de Nacimiento</th>
                              <th>Edad</th>
                              <th>Contacto</th>
                            </tr>
                          </thead>
                          <tbody>
                            {cumpleanosMes.slice(0, 10).map((cliente) => {
                              // Parsear fecha de nacimiento correctamente para evitar problemas de zona horaria
                              let fechaNac;
                              if (cliente.fecha_nacimiento) {
                                // Si viene en formato YYYY-MM-DD, parsear manualmente
                                if (typeof cliente.fecha_nacimiento === 'string' && cliente.fecha_nacimiento.includes('-')) {
                                  const partes = cliente.fecha_nacimiento.split('-');
                                  if (partes.length === 3) {
                                    // Crear fecha en hora local (mediodía) para evitar problemas de zona horaria
                                    fechaNac = new Date(parseInt(partes[0]), parseInt(partes[1]) - 1, parseInt(partes[2]), 12, 0, 0);
                                  } else {
                                    fechaNac = new Date(cliente.fecha_nacimiento);
                                  }
                                } else {
                                  fechaNac = new Date(cliente.fecha_nacimiento);
                                }
                              } else {
                                fechaNac = new Date();
                              }
                              
                              const dia = fechaNac.getDate();
                              const mes = fechaNac.getMonth() + 1;
                              const año = fechaNac.getFullYear();
                              
                              // Calcular edad
                              const hoy = new Date();
                              let edad = hoy.getFullYear() - año;
                              const mesActual = hoy.getMonth() + 1;
                              const diaActual = hoy.getDate();
                              
                              // Ajustar edad si aún no ha cumplido años este año
                              if (mesActual < mes || (mesActual === mes && diaActual < dia)) {
                                edad--;
                              }
                              
                              return (
                                <tr key={cliente.id}>
                                  <td className="fw-medium">
                                    <Link
                                      to={`/clientes/${cliente.id}/ficha`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-decoration-none"
                                      title="Abrir ficha del cliente"
                                    >
                                      {cliente.nombre_completo}
                                    </Link>
                                  </td>
                                  <td>{String(dia).padStart(2, '0')}/{String(mes).padStart(2, '0')}/{año}</td>
                                  <td className="fw-medium">{edad} años</td>
                                  <td className="small text-muted">
                                    {cliente.telefono || cliente.email || "—"}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </Table>
                        {cumpleanosMes.length > 10 && (
                          <div className="text-center mt-2">
                            <small className="text-muted">+{cumpleanosMes.length - 10} más</small>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-3 text-muted small">
                        No hay cumpleaños hoy
                      </div>
                    )}
                  </Card.Body>
                </Card>
              </Col>
            )}

            {/* KPI Pagos Pendientes */}
            {preferenciasVisualizacion.mostrarPagosPendientes && (
              <Col xl={6} md={12}>
                <Card className="dashboard-card alert-card h-100">
                  <Card.Body>
                    <div className="d-flex justify-content-between align-items-start mb-3">
                      <div className="d-flex align-items-center gap-2">
                        <div className="stats-icon" style={{ background: "rgba(220, 53, 69, 0.1)", color: "#dc3545" }}>
                          <FaMoneyBillWave />
                        </div>
                        <div>
                          <h6 className="stats-title mb-0">Pagos Pendientes</h6>
                          <h3 className="stats-value" style={{ color: "#dc3545" }}>
                            {loadingPagos ? "..." : pagosPendientes.length}
                          </h3>
                        </div>
                      </div>
                      <div>
                        <Form.Select
                          size="sm"
                          value={mesPagosSeleccionado}
                          onChange={(e) => setMesPagosSeleccionado(e.target.value)}
                          style={{ minWidth: "150px" }}
                        >
                          {(() => {
                            const meses = [];
                            const hoy = new Date();
                            for (let i = 0; i < 12; i++) {
                              const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
                              const año = fecha.getFullYear();
                              const mes = String(fecha.getMonth() + 1).padStart(2, '0');
                              const mesNombre = fecha.toLocaleString('es-ES', { month: 'long' });
                              meses.push(
                                <option key={`${año}-${mes}`} value={`${año}-${mes}`}>
                                  {mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1)} {año}
                                </option>
                              );
                            }
                            return meses;
                          })()}
                        </Form.Select>
                      </div>
                    </div>
                    {loadingPagos ? (
                      <div className="text-center py-3">
                        <div className="spinner-border spinner-border-sm text-danger" role="status">
                          <span className="visually-hidden">Cargando...</span>
                        </div>
                      </div>
                    ) : pagosPendientes.length > 0 ? (
                      <div className="table-responsive" style={{ maxHeight: "200px", overflowY: "auto" }}>
                        <Table hover size="sm" className="mb-0">
                          <thead>
                            <tr>
                              <th>Cliente</th>
                              <th>Monto</th>
                              <th>Fecha</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pagosPendientes.slice(0, 10).map((pago) => {
                              const fechaPago = pago.fecha_pago ? new Date(pago.fecha_pago) : null;
                              return (
                                <tr key={pago.id}>
                                  <td className="fw-medium">
                                    {pago.cliente?.nombre_completo || pago.cobertura?.cliente?.nombre_completo || "Sin cliente"}
                                  </td>
                                  <td>
                                    <Badge bg="warning" text="dark">
                                      ${Number(pago.monto || 0).toFixed(2)}
                                    </Badge>
                                  </td>
                                  <td className="small text-muted">
                                    {fechaPago ? `${fechaPago.getDate()}/${fechaPago.getMonth() + 1}` : "—"}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </Table>
                        {pagosPendientes.length > 10 && (
                          <div className="text-center mt-2">
                            <small className="text-muted">+{pagosPendientes.length - 10} más</small>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-3 text-muted small">
                        No hay pagos pendientes para este mes
                      </div>
                    )}
                  </Card.Body>
                </Card>
              </Col>
            )}
          </Row>
        </div>
      )}
      {/* Sección Documentos Solicitados */}
      {preferenciasVisualizacion.mostrarDocumentosSolicitados && (
        <div className="section-container table-section">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div className="d-flex align-items-center gap-3">
              <h5 className="section-title mb-0">Documentos solicitados</h5>
              <Form.Check
                type="switch"
                id="toggle-documentos"
                label="Mostrar"
                checked={preferenciasVisualizacion.mostrarDocumentosSolicitados}
                onChange={() => togglePreferencia('mostrarDocumentosSolicitados')}
                className="small"
              />
            </div>
            <div>
              <label className="me-2">Filtrar por:</label>
              <select className="form-select form-select-sm w-auto d-inline" value={filtroDias} onChange={handleChangeFiltroDias}>
                <option value="15">15 días</option>
                <option value="30">30 días</option>
                <option value="60">60 días</option>
                <option value="90">90 días</option>
              </select>
            </div>
          </div>

  <div className="table-responsive">
    <Table hover className="mb-0 table-borderless">
      <thead>
        <tr>
          <th>Cliente</th>
          <th>Codigo poliza</th>
          <th>Parentesco</th>
          <th>Documento</th>
          <th>Estado</th>
          <th>Vence el</th>
          <th>Días restantes</th>
        </tr>
      </thead>
      <tbody>
        {cargando ? (
          renderLoading()
        ) : documentosProximosVencer.length > 0 ? (
          documentosProximosVencer.map(doc => {
            const fechaVenc = new Date(doc.fecha_vencimiento);
            const hoy = new Date();
            const diasRestantes = Math.ceil((fechaVenc - hoy) / (1000 * 60 * 60 * 24));
            return (
              <tr key={doc.id}>
                <td className="fw-medium">{doc.cobertura?.cliente?.nombre_completo || 'Cliente desconocido'}</td>
                <td>{doc.cobertura?.codigo_poliza || 'N/D'}</td>
                <td>{doc.cobertura?.parentesco || 'N/D'}</td>
                <td>{doc.documento_requerido}</td>
                <td>
                  <Badge bg="primary">{doc.estado}</Badge>
                </td>
                <td>{(() => {
                  const month = String(fechaVenc.getMonth() + 1).padStart(2, "0");
                  const day = String(fechaVenc.getDate()).padStart(2, "0");
                  const year = fechaVenc.getFullYear();
                  return `${month}/${day}/${year}`;
                })()}</td>
                <td>
                  {diasRestantes <= 5 ? (
                    <Badge bg="danger">{diasRestantes} día(s)</Badge>
                  ) : diasRestantes <= 15 ? (
                    <Badge bg="warning" text="dark">{diasRestantes} días</Badge>
                  ) : (
                    <Badge bg="success">{diasRestantes} días</Badge>
                  )}
                </td>
              </tr>
            );
          })
        ) : (
          renderEmptyMessage("No hay documentos próximos a vencer.")
        )}
      </tbody>
    </Table>
  </div>
</div>
      )}


      <div className="section-container">
        <h5 className="section-title">Acciones Rápidas</h5>
        <Row className="g-3">
          <Col lg={3} md={6}>
            <Button as={Link} to="/clientes/crear" variant="primary" className="quick-action-btn">
              <FaPlus /> Nuevo Cliente
            </Button>
          </Col>
          <Col lg={3} md={6}>
            <Button as={Link} to="/grupofamiliar/prospecto" variant="primary" className="quick-action-btn">
              <FaPlus /> Nuevo Grupo Familiar
            </Button>
          </Col>
          <Col lg={3} md={6}>
            <Button disabled variant="outline-secondary" className="quick-action-btn">
              <FaChartLine /> Ver Informes
            </Button>
          </Col>
          <Col lg={3} md={6}>
            <Button disabled variant="outline-secondary" className="quick-action-btn">
              <FaCalendarAlt /> Ver Cancelaciones
            </Button>
          </Col>
        </Row>
      </div>

      {/* Sección Clientes Recientes y Pólizas Canceladas */}
      {(preferenciasVisualizacion.mostrarClientesRecientes || preferenciasVisualizacion.mostrarPolizasCanceladas) && (
      <Row className="mb-4 g-4 align-items-stretch">
      {preferenciasVisualizacion.mostrarClientesRecientes && (
      <Col lg={6} className="h-100">
      <div className="section-container table-section h-100">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div className="d-flex align-items-center gap-2">
                <h5 className="section-title mb-0">Clientes Recientes</h5>
                <Form.Check
                  type="switch"
                  id="toggle-clientes-recientes-inline"
                  checked={preferenciasVisualizacion.mostrarClientesRecientes}
                  onChange={() => togglePreferencia('mostrarClientesRecientes')}
                  className="small"
                />
              </div>
              <Link to="/clientes/lista" className="btn btn-sm btn-link text-decoration-none">
              
                Ver todos <FaList className="ms-1" />
              </Link>
            </div>
            <div className="table-responsive">
              <Table hover className="mb-0 table-borderless">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Fecha</th>
                    <th>Contacto</th>
                    <th className="text-end">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {cargando ? (
                    renderLoading()
                  ) : clientesRecientes.length > 0 ? (
                    clientesRecientes.map(cliente => (
                      <tr key={cliente.id}>
                            <td className="fw-medium">{cliente.nombre_completo}</td>
                            <td>{(() => {
                              const d = new Date(cliente.created_at);
                              const month = String(d.getMonth() + 1).padStart(2, "0");
                              const day = String(d.getDate()).padStart(2, "0");
                              const year = d.getFullYear();
                              return `${month}/${day}/${year}`;
                            })()}</td>
                            <td>{cliente.telefono || cliente.email}</td>
                            <td className="text-end">
                              <Button 
                                variant="outline-primary" 
                                size="sm"
                                className="me-1"
                                onClick={() => handleOpenViewModal(cliente)}
                                title="Ver detalles"
                              >
                                <FaEye />
                              </Button>
                              <Button 
                                variant="outline-success" 
                                size="sm"
                                onClick={() => handleOpenEditModal(cliente)}
                                title="Editar cliente"
                              >
                                <FaEdit />
                              </Button>
                            </td>
                          </tr>
                    ))
                  ) : (
                    renderEmptyMessage("No hay clientes recientes")
                  )}
                </tbody>
              </Table>
            </div>
          </div>
        </Col>
      )}

      {preferenciasVisualizacion.mostrarPolizasCanceladas && (
        <Col lg={6} className="h-100">
        <div className="section-container table-section h-100">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div className="d-flex align-items-center gap-2">
                <h5 className="section-title mb-0">Pólizas Canceladas</h5>
                <Form.Check
                  type="switch"
                  id="toggle-polizas-canceladas-inline"
                  checked={preferenciasVisualizacion.mostrarPolizasCanceladas}
                  onChange={() => togglePreferencia('mostrarPolizasCanceladas')}
                  className="small"
                />
              </div>
              <Link to="/grupofamiliar/vencimientos" className="btn btn-sm btn-link text-decoration-none">
                Ver todas <FaList className="ms-1" />
              </Link>
            </div>
            <div className="table-responsive">
              <Table hover className="mb-0 table-borderless">
                <thead>
                  <tr>
                    <th>GF</th>
                    <th>Cliente</th>
                    <th>Vencimiento</th>
                    <th className="text-end">Estado</th>
                  </tr>
                </thead>
                <tbody>
                      {cargando ? (
                        renderLoading()
                      ) : polizasCanceladas.length > 0 ? (
                        polizasCanceladas.map(poliza => (
                          <tr key={poliza.id}>
                            <td className="fw-medium">{poliza.grupo_familiar?.id || 'Sin grupo'}</td>
                            <td>{poliza.cliente.nombre_completo || 'Sin tipo'}</td>
                            <td>{poliza.fecha_cancelacion ? (() => {
                              const d = new Date(poliza.fecha_cancelacion);
                              const month = String(d.getMonth() + 1).padStart(2, "0");
                              const day = String(d.getDate()).padStart(2, "0");
                              const year = d.getFullYear();
                              return `${month}/${day}/${year}`;
                            })() : 'Sin fecha'}</td>
                            <td className="text-end">
                              <Badge bg="danger" pill>Cancelada</Badge>
                            </td>
                          </tr>
                        ))
                      ) : (
                        renderEmptyMessage("No hay pólizas canceladas")
                      )}
                    </tbody>

              </Table>
            </div>
          </div>
        </Col>
      )}
      </Row>
      )}
      
      {/* Sección Calendario de Tareas */}
      {preferenciasVisualizacion.mostrarCalendario && (
      <div className="section-container mt-4">
  <Card>
    <Card.Header className="bg-primary text-white d-flex justify-content-between align-items-center">
      <span><FaCalendarAlt className="me-2" /> Calendario de Tareas</span>
      <Form.Check
        type="switch"
        id="toggle-calendario-inline"
        checked={preferenciasVisualizacion.mostrarCalendario}
        onChange={() => togglePreferencia('mostrarCalendario')}
        className="small text-white"
        style={{ filter: 'brightness(1.2)' }}
      />
    </Card.Header>
    <Card.Body>
      {loadingTareas ? (
        <div className="d-flex justify-content-center py-4">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
        </div>
      ) : (
        <CalendarioTareas tareas={tareas} currentUser={currentUser} />

      )}
    </Card.Body>
  </Card>
      </div>
      )}

      {/* Configuración de Preferencias - Al final, ancho completo */}
      <div className="section-container mt-4">
        <Card>
          <Card.Header 
            className="bg-light d-flex justify-content-between align-items-center"
            style={{ cursor: 'pointer' }}
            onClick={() => setShowConfigAccordion(!showConfigAccordion)}
          >
            <div className="d-flex align-items-center">
              <FaCog className="me-2" />
              <span className="fw-medium">Configuración de Visualización</span>
            </div>
            <span>{showConfigAccordion ? '▼' : '▶'}</span>
          </Card.Header>
          {showConfigAccordion && (
            <Card.Body>
              <Row className="g-4">
                <Col md={6}>
                  <h6 className="text-muted mb-3 fw-bold">Alertas y Recordatorios</h6>
                  <div className="d-flex flex-column gap-3">
                    <Form.Check
                      type="switch"
                      id="toggle-cumpleanos-config"
                      label={
                        <span>
                          <FaBirthdayCake className="me-2" />
                          Cumpleaños de Hoy
                        </span>
                      }
                      checked={preferenciasVisualizacion.mostrarCumpleanos}
                      onChange={() => togglePreferencia('mostrarCumpleanos')}
                    />
                    <Form.Check
                      type="switch"
                      id="toggle-pagos-config"
                      label={
                        <span>
                          <FaMoneyBillWave className="me-2" />
                          Pagos Pendientes
                        </span>
                      }
                      checked={preferenciasVisualizacion.mostrarPagosPendientes}
                      onChange={() => togglePreferencia('mostrarPagosPendientes')}
                    />
                    <Form.Check
                      type="switch"
                      id="toggle-documentos-config"
                      label={
                        <span>
                          <FaCheckSquare className="me-2" />
                          Documentos Solicitados
                        </span>
                      }
                      checked={preferenciasVisualizacion.mostrarDocumentosSolicitados}
                      onChange={() => togglePreferencia('mostrarDocumentosSolicitados')}
                    />
                  </div>
                </Col>
                <Col md={6}>
                  <h6 className="text-muted mb-3 fw-bold">Secciones del Dashboard</h6>
                  <div className="d-flex flex-column gap-3">
                    <Form.Check
                      type="switch"
                      id="toggle-calendario-config"
                      label={
                        <span>
                          <FaCalendarAlt className="me-2" />
                          Calendario de Tareas
                        </span>
                      }
                      checked={preferenciasVisualizacion.mostrarCalendario}
                      onChange={() => togglePreferencia('mostrarCalendario')}
                    />
                    <Form.Check
                      type="switch"
                      id="toggle-clientes-recientes-config"
                      label={
                        <span>
                          <FaUsers className="me-2" />
                          Clientes Recientes
                        </span>
                      }
                      checked={preferenciasVisualizacion.mostrarClientesRecientes}
                      onChange={() => togglePreferencia('mostrarClientesRecientes')}
                    />
                    <Form.Check
                      type="switch"
                      id="toggle-polizas-canceladas-config"
                      label={
                        <span>
                          <FaFileInvoiceDollar className="me-2" />
                          Pólizas Canceladas
                        </span>
                      }
                      checked={preferenciasVisualizacion.mostrarPolizasCanceladas}
                      onChange={() => togglePreferencia('mostrarPolizasCanceladas')}
                    />
                  </div>
                </Col>
              </Row>
            </Card.Body>
          )}
        </Card>
      </div>

      
      {/* Modal de Edición */}
      <EditClienteModal
        show={showEditModal}
        onHide={() => setShowEditModal(false)}
        clienteId={clienteToEdit}
        clienteData={clienteDataToEdit}
        onClienteUpdated={handleClienteUpdated}
      />
            {/* Modal de Visualización */}
      <DetalleClienteModal
        show={showViewModal}
        onHide={() => setShowViewModal(false)}
        clienteData={clienteToView}
      />
    </div>
  );
};

export default Dashboard;