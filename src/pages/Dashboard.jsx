// Dashboard.js con integración de modal de edición
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
import VerTareaModal from "../components/Tareas/VerTareaModal";
import { Helmet } from "react-helmet-async";



const Dashboard = () => {
  const currentUser = JSON.parse(localStorage.getItem("user"));
  

  const [clientesRecientes, setClientesRecientes] = useState([]);
  const [polizasCanceladas, setPolizasCanceladas] = useState([]);
  const [documentosProximosVencer, setDocumentosProximosVencer] = useState([]);
  const [tareas, setTareas] = useState([]);
  const [loadingTareas, setLoadingTareas] = useState(true);
  const [tareasVencidas, setTareasVencidas] = useState([]);
  const [loadingTareasVencidas, setLoadingTareasVencidas] = useState(false);
  const [showVerTareaModal, setShowVerTareaModal] = useState(false);
  const [tareaIdVer, setTareaIdVer] = useState(null);
  
  const [polizasProximasVencer, setPolizasProximasVencer] = useState([]);
  const [estadisticas, setEstadisticas] = useState({
    totalClientes: 0,
    totalGruposFamiliares: 0,
    polizasActivas: 0,
    polizasCanceladas: 0,
    polizasRetiradas: 0
  });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  // Obtiene "total" desde diferentes estructuras de paginación del backend
  const getTotalFromPaginatedResponse = useCallback((res) => {
    if (!res) return null;
    if (typeof res?.total === "number") return res.total;
    if (typeof res?.data?.total === "number") return res.data.total;
    if (typeof res?.meta?.total === "number") return res.meta.total;
    if (typeof res?.data?.meta?.total === "number") return res.data.meta.total;
    if (typeof res?.pagination?.total === "number") return res.pagination.total;
    if (typeof res?.data?.pagination?.total === "number") return res.data.pagination.total;
    return null;
  }, []);
  
  // Estados para el modal de edición
  const [showEditModal, setShowEditModal] = useState(false);
  const [clienteToEdit, setClienteToEdit] = useState(null);
  const [clienteDataToEdit, setClienteDataToEdit] = useState(null);
  // Agregar estados para el modal de visualización
  const [showViewModal, setShowViewModal] = useState(false);
  const [clienteToView, setClienteToView] = useState(null);
  const [filtroDias, setFiltroDias] = useState(15);
  const [mesCoberturasSeleccionado, setMesCoberturasSeleccionado] = useState(() => {
    const hoy = new Date();
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
  });
  const [tipoCoberturaFiltro, setTipoCoberturaFiltro] = useState("todos");

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
    mostrarPolizasCanceladas: true,
    mostrarTareasVencidas: true
  });
  const [cargandoPreferencias, setCargandoPreferencias] = useState(true);

  // Evita PUT redundante al hidratar preferencias y agrupa guardados del usuario
  const skipInitialPrefsSaveRef = useRef(true);
  const lastSavedPrefsJsonRef = useRef("");

  // Función para parsear fecha de nacimiento correctamente
  const parsearFechaNacimiento = useCallback((fechaStr) => {
    if (!fechaStr) return null;

    try {
      // Si viene en formato YYYY-MM-DD o YYYY-MM-DDTHH:MM:SS, parsear manualmente
      if (typeof fechaStr === "string" && /^\d{4}-\d{2}-\d{2}/.test(fechaStr)) {
        const [year, month, day] = fechaStr.split("T")[0].split("-");
        const año = parseInt(year, 10);
        const mes = parseInt(month, 10) - 1; // Mes es 0-indexado
        const dia = parseInt(day, 10);

        if (!isNaN(año) && !isNaN(mes) && !isNaN(dia)) {
          // Mediodía local para evitar problemas de zona horaria
          return new Date(año, mes, dia, 12, 0, 0);
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

  // Función que verifica si una fecha de nacimiento corresponde a hoy (ignorando el año)
  const esCumpleanosHoy = useCallback(
    (fechaNacimiento) => {
      if (!fechaNacimiento) return false;

      const fechaNac = parsearFechaNacimiento(fechaNacimiento);
      if (!fechaNac) return false;

      // Normalizar a fecha UTC para evitar desfasajes por zona horaria
      const nacimientoUTC = new Date(
        Date.UTC(
          fechaNac.getFullYear(),
          fechaNac.getMonth(),
          fechaNac.getDate()
        )
      );

      const hoy = new Date();
      const hoyUTC = new Date(
        Date.UTC(
          hoy.getUTCFullYear(),
          hoy.getUTCMonth(),
          hoy.getUTCDate()
        )
      );

      return (
        nacimientoUTC.getUTCMonth() === hoyUTC.getUTCMonth() &&
        nacimientoUTC.getUTCDate() === hoyUTC.getUTCDate()
      );
    },
    [parsearFechaNacimiento]
  );

  // Función para cargar cumpleaños del día de hoy
  const cargarCumpleanos = useCallback(
    async () => {
      if (!preferenciasVisualizacion || !preferenciasVisualizacion.mostrarCumpleanos) {
        setCumpleanosMes([]);
        return;
      }

      setLoadingCumpleanos(true);
      try {
        let clientes = [];

        // 1) Intentar obtener todos los clientes con cobertura (endpoint usado en ReporteCumpleanosPage)
        try {
          const response = await apiRequest("cliente/with-cobertura", "GET");
          const raw = Array.isArray(response?.data) ? response.data : response;
          const clientesArray = Array.isArray(raw) ? raw : Object.values(raw || {});
          clientes = clientesArray.filter((c) => c && c.fecha_nacimiento);
        } catch (errorWithCobertura) {
          console.warn(
            "No se pudo obtener clientes con cobertura para cumpleaños, usando fallback:",
            errorWithCobertura
          );

          // 2) Fallback: obtener clientes generales y filtrar
          try {
            const res = await apiRequest("cliente?per_page=1000", "GET");
            const raw = Array.isArray(res?.data) ? res.data : res;
            const clientesArray = Array.isArray(raw) ? raw : Object.values(raw || {});
            clientes = clientesArray.filter((c) => c && c.fecha_nacimiento);
          } catch (errClientes) {
            console.error("Error al obtener clientes para cumpleaños:", errClientes);
            setCumpleanosMes([]);
            return;
          }
        }

        // Filtrar solo los que cumplen años HOY (día y mes)
        const cumpleanosHoy = clientes.filter((cliente) =>
          esCumpleanosHoy(cliente.fecha_nacimiento)
        );

        setCumpleanosMes(cumpleanosHoy);
      } catch (error) {
        console.error("Error al cargar cumpleaños:", error);
        setCumpleanosMes([]);
      } finally {
        setLoadingCumpleanos(false);
      }
    },
    [preferenciasVisualizacion?.mostrarCumpleanos, esCumpleanosHoy]
  );

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

  // Función para cargar tareas vencidas del usuario actual
  const cargarTareasVencidas = useCallback(async () => {
    if (
      !preferenciasVisualizacion ||
      !preferenciasVisualizacion.mostrarTareasVencidas ||
      !currentUser?.id
    ) {
      setTareasVencidas([]);
      return;
    }

    setLoadingTareasVencidas(true);
    try {
      const params = new URLSearchParams();
      params.append("assigned_user_id", currentUser.id);
      params.append("per_page", "200");

      const res = await apiRequest(`tareas_operativas?${params.toString()}`, "GET");

      let tareasData = [];
      if (res?.data) {
        tareasData = Array.isArray(res.data) ? res.data : (res.data.data || []);
      } else if (Array.isArray(res)) {
        tareasData = res;
      }

      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);

      const parseFecha = (valor) => {
        if (!valor) return null;
        if (valor instanceof Date) return isNaN(valor.getTime()) ? null : valor;
        const str = String(valor);
        const base = str.includes("T") ? str : `${str}T00:00:00`;
        const d = new Date(base);
        return isNaN(d.getTime()) ? null : d;
      };

      const calcularDiasAtraso = (fechaVenc) => {
        const fecha = parseFecha(fechaVenc);
        if (!fecha) return null;
        const diffMs = hoy.getTime() - fecha.getTime();
        if (diffMs <= 0) return null;
        return Math.floor(diffMs / (1000 * 60 * 60 * 24));
      };

      const pendientesVencidas = tareasData
        .map((t) => {
          const status = (t.status || t.estado || "").toLowerCase();
          if (["completed", "completada", "completado", "cancelled", "cancelada"].includes(status)) {
            return null;
          }

          const fechaVenc =
            t.due_date ||
            t.fecha_vencimiento ||
            t.fechaLimite ||
            t.fecha_limite ||
            t.deadline;

          const diasAtraso = calcularDiasAtraso(fechaVenc);
          if (diasAtraso == null || diasAtraso <= 0) return null;

          return {
            ...t,
            _dias_atraso: diasAtraso,
            _fecha_vencimiento_original: fechaVenc,
          };
        })
        .filter(Boolean)
        .sort((a, b) => b._dias_atraso - a._dias_atraso);

      setTareasVencidas(pendientesVencidas);
    } catch (error) {
      console.error("Error al cargar tareas vencidas:", error);
      setTareasVencidas([]);
    } finally {
      setLoadingTareasVencidas(false);
    }
  }, [preferenciasVisualizacion?.mostrarTareasVencidas, currentUser?.id]);

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
    skipInitialPrefsSaveRef.current = true;
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
          mostrarPolizasCanceladas: res.dashboard_preferences.mostrarPolizasCanceladas ?? true,
          mostrarTareasVencidas: res.dashboard_preferences.mostrarTareasVencidas ?? true
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
            mostrarPolizasCanceladas: parsed.mostrarPolizasCanceladas ?? true,
            mostrarTareasVencidas: parsed.mostrarTareasVencidas ?? true
          });
        }
      }
    } catch (error) {
      // Si falla el backend, usar localStorage como fallback
      console.warn('No se pudieron cargar preferencias del backend, usando localStorage:', error);
      const storageKey = `dashboard_preferencias_${userId}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        setPreferenciasVisualizacion({
          mostrarCumpleanos: parsed.mostrarCumpleanos ?? true,
          mostrarPagosPendientes: parsed.mostrarPagosPendientes ?? true,
          mostrarDocumentosSolicitados: parsed.mostrarDocumentosSolicitados ?? true,
          mostrarCalendario: parsed.mostrarCalendario ?? true,
          mostrarClientesRecientes: parsed.mostrarClientesRecientes ?? true,
          mostrarPolizasCanceladas: parsed.mostrarPolizasCanceladas ?? true,
          mostrarTareasVencidas: parsed.mostrarTareasVencidas ?? true
        });
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

  // Cargar tareas vencidas cuando cambie la preferencia o el usuario
  useEffect(() => {
    if (!cargandoPreferencias && preferenciasVisualizacion && preferenciasVisualizacion.mostrarTareasVencidas) {
      cargarTareasVencidas();
    } else if (!cargandoPreferencias) {
      setTareasVencidas([]);
    }
  }, [preferenciasVisualizacion?.mostrarTareasVencidas, cargarTareasVencidas, cargandoPreferencias]);

  // Guardar preferencias cuando el usuario las cambie (debounce + sin PUT en la hidratación)
  useEffect(() => {
    if (cargandoPreferencias) return;

    const userId = currentUser?.id;
    if (!userId) return;

    const storageKey = `dashboard_preferencias_${userId}`;
    const serialized = JSON.stringify(preferenciasVisualizacion);

    if (skipInitialPrefsSaveRef.current) {
      skipInitialPrefsSaveRef.current = false;
      lastSavedPrefsJsonRef.current = serialized;
      localStorage.setItem(storageKey, serialized);
      return;
    }

    if (serialized === lastSavedPrefsJsonRef.current) {
      return;
    }

    const timer = setTimeout(async () => {
      const latest = JSON.stringify(preferenciasVisualizacion);
      if (latest === lastSavedPrefsJsonRef.current) return;

      localStorage.setItem(storageKey, latest);

      try {
        await apiRequest(`users/${userId}/preferences`, 'PUT', {
          dashboard_preferences: preferenciasVisualizacion,
        });
        lastSavedPrefsJsonRef.current = latest;
      } catch (error) {
        console.warn('⚠️ No se pudo guardar preferencias en el backend:', error);
      }
    }, 450);

    return () => clearTimeout(timer);
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
      // Documentos próximos a vencer: un solo fetch vía useEffect (evita duplicar peticiones con cargarDatos)

      // Solo cargar clientes recientes si está activado
      if (preferenciasVisualizacion?.mostrarClientesRecientes) {
        const resClientes = await apiRequest("cliente/recientes", "GET");
        setClientesRecientes(resClientes.slice(0, 15));
      } else {
        setClientesRecientes([]);
      }

      // Solo cargar pólizas canceladas si está activado
      if (preferenciasVisualizacion?.mostrarPolizasCanceladas) {
        const [resCanceladas, resHistorial] = await Promise.allSettled([
          apiRequest("cobertura/canceladas", "GET"),
          apiRequest("coberturas/historial-renovaciones", "GET"),
        ]);

        const listaCanceladas = resCanceladas.status === "fulfilled"
          ? (Array.isArray(resCanceladas.value) ? resCanceladas.value : [])
          : [];

        const historialRaw = resHistorial.status === "fulfilled" ? resHistorial.value : [];
        const listaHistorial = Array.isArray(historialRaw)
          ? historialRaw
          : Array.isArray(historialRaw?.data)
          ? historialRaw.data
          : [];

        const normalizadas = [...listaCanceladas, ...listaHistorial]
          .map(normalizarCobertura)
          .filter((e) => e.tipo !== "otros");

        const unicas = Object.values(
          normalizadas.reduce((acc, e) => {
            const key = `${e.id}-${e.fecha_cancelacion || ""}-${e.fecha_retiro || ""}-${e.tipo}`;
            if (!acc[key]) acc[key] = e;
            return acc;
          }, {})
        );

        unicas.sort((a, b) => {
          const fa = new Date(a.fecha_cancelacion || a.fecha_retiro || 0).getTime();
          const fb = new Date(b.fecha_cancelacion || b.fecha_retiro || 0).getTime();
          return fb - fa;
        });

        setPolizasCanceladas(unicas);
      } else {
        setPolizasCanceladas([]);
      }


      const resPolizas = await apiRequest("cobertura/proximas-vencer", "GET");
      setPolizasProximasVencer(resPolizas.slice(0, 5));

      const resEstadisticas = await apiRequest("cliente/general", "GET");
      let totalClientesEstadoCliente = null;

      // KPI Total Clientes: contar solo estado_cliente = "cliente"
      try {
        const resClientesSoloCliente = await apiRequest("cliente?estado_cliente=cliente&per_page=1", "GET");
        const totalFromMeta = getTotalFromPaginatedResponse(resClientesSoloCliente);

        if (typeof totalFromMeta === "number") {
          totalClientesEstadoCliente = totalFromMeta;
        } else {
          const rawList = Array.isArray(resClientesSoloCliente?.data)
            ? resClientesSoloCliente.data
            : Array.isArray(resClientesSoloCliente)
              ? resClientesSoloCliente
              : Array.isArray(resClientesSoloCliente?.data?.data)
                ? resClientesSoloCliente.data.data
                : [];

          totalClientesEstadoCliente = rawList.filter((c) =>
            String(c?.estado_cliente || "").toLowerCase() === "cliente"
          ).length;
        }
      } catch (errClientesKpi) {
        console.warn("No se pudo calcular total de clientes por estado_cliente=cliente:", errClientesKpi);
      }

      setEstadisticas({
        ...(resEstadisticas || {}),
        totalClientes:
          typeof totalClientesEstadoCliente === "number"
            ? totalClientesEstadoCliente
            : (resEstadisticas?.totalClientes || 0),
      });
    } catch (err) {
      console.error("Error al cargar datos del dashboard:", err);
      setError("Hubo un problema al cargar los datos. Por favor, intente nuevamente.");
    } finally {
      setCargando(false);
    }
  };

  const handleChangeFiltroDias = (e) => {
    const dias = parseInt(e.target.value, 10);
    setFiltroDias(dias);
  };

  // Carga controlada de documentos: una petición por cambio de preferencia o días (después de hidratar preferencias)
  useEffect(() => {
    if (cargandoPreferencias) return;

    if (!preferenciasVisualizacion?.mostrarDocumentosSolicitados) {
      setDocumentosProximosVencer([]);
      return;
    }

    let cancelled = false;

    const cargarDocumentos = async () => {
      try {
        const res = await apiRequest(`documentos/proximos-vencer?dias=${filtroDias}`, "GET");
        if (!cancelled) setDocumentosProximosVencer(res);
      } catch (error) {
        if (!cancelled) console.error("Error cargando documentos:", error);
      }
    };

    cargarDocumentos();

    return () => {
      cancelled = true;
    };
  }, [cargandoPreferencias, preferenciasVisualizacion?.mostrarDocumentosSolicitados, filtroDias]);

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

  const formatearFecha = (valor) => {
    if (!valor) return "—";
    const d = new Date(typeof valor === "string" && !valor.includes("T") ? `${valor}T00:00:00` : valor);
    if (isNaN(d.getTime())) return "—";
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const year = d.getFullYear();
    return `${month}/${day}/${year}`;
  };

  const normalizarCobertura = (item) => {
    const isFechaValida = (v) => {
      if (v === null || v === undefined) return false;
      const s = String(v).trim();
      return s !== "" && s.toLowerCase() !== "null";
    };
    const esActivoFalse = (v) => v === false || v === "false" || v === 0 || v === "0";
    const esVigenteFalse = (v) => v === false || v === "false" || v === 0 || v === "0";

    const fechaCancelacion = item?.fecha_cancelacion || item?.fechaCancelacion || null;
    const fechaRetiro = item?.fecha_retiro || item?.fechaRetiro || null;
    const vigente = item?.vigente;
    const activo = item?.activo;

    // Mantener criterio consistente con ReactivacionCoberturasModal:
    // - Cancelada: vigente false + fecha_cancelacion + NO fecha_retiro
    // - Retirada: vigente false + (activo false o fecha_retiro)
    const esRetirada =
      esVigenteFalse(vigente) &&
      (esActivoFalse(activo) || isFechaValida(fechaRetiro));

    const esCancelada =
      esVigenteFalse(vigente) &&
      isFechaValida(fechaCancelacion) &&
      !isFechaValida(fechaRetiro);

    return {
      id: item?.id || item?.cobertura_id || `${item?.cliente_id || "x"}-${fechaCancelacion || fechaRetiro || Math.random()}`,
      clienteNombre:
        item?.cliente?.nombre_completo ||
        item?.cliente_nombre ||
        item?.nombre_completo ||
        "Sin cliente",
      fecha_cancelacion: fechaCancelacion,
      fecha_retiro: fechaRetiro,
      concepto:
        item?.concepto ||
        item?.concept_name ||
        item?.subconcepto ||
        (esCancelada ? "Cancelación" : esRetirada ? "Retiro" : "N/A"),
      motivo:
        item?.motivo_cancelacion ||
        item?.motivo_retiro ||
        item?.nota_cancel ||
        item?.nota_retiro ||
        "—",
      tipo: esCancelada ? "cancelados" : esRetirada ? "retiros" : "otros",
    };
  };

  const eventosCoberturaFiltrados = useMemo(() => {
    const [anioSel, mesSel] = mesCoberturasSeleccionado.split("-").map(Number);
    return (Array.isArray(polizasCanceladas) ? polizasCanceladas : []).filter((item) => {
      const tipoOk = tipoCoberturaFiltro === "todos" ? item.tipo !== "otros" : item.tipo === tipoCoberturaFiltro;
      if (!tipoOk) return false;

      const fechaBase = item.fecha_cancelacion || item.fecha_retiro;
      if (!fechaBase) return false;
      const d = new Date(typeof fechaBase === "string" && !fechaBase.includes("T") ? `${fechaBase}T00:00:00` : fechaBase);
      if (isNaN(d.getTime())) return false;
      return d.getFullYear() === anioSel && d.getMonth() + 1 === mesSel;
    });
  }, [polizasCanceladas, mesCoberturasSeleccionado, tipoCoberturaFiltro]);

  const resumenCoberturasMes = useMemo(() => {
    const cancelados = eventosCoberturaFiltrados.filter((e) => e.tipo === "cancelados").length;
    const retiros = eventosCoberturaFiltrados.filter((e) => e.tipo === "retiros").length;
    return { cancelados, retiros, total: cancelados + retiros };
  }, [eventosCoberturaFiltrados]);

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
        <Row className="stats-cards g-3 row-cols-1 row-cols-md-2 row-cols-xl-5">
          <Col>
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
          <Col>
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
          <Col>
            <Card className="dashboard-card h-100">
              <Card.Body>
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h6 className="stats-title">Coberturas Activas</h6>
                    <h3 className="stats-value">{estadisticas.polizasActivas}</h3>
                  </div>
                  <div className="stats-icon"><FaFileInvoiceDollar /></div>
                </div>
              </Card.Body>
            </Card>
          </Col>
          <Col>
            <Card className="dashboard-card alert-card h-100">
              <Card.Body>
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h6 className="stats-title">Coberturas Canceladas</h6>
                    <h3 className="stats-value">{estadisticas.polizasCanceladas}</h3>
                  </div>
                  <div className="stats-icon"><FaCalendarAlt /></div>
                </div>
                
              </Card.Body>
            </Card>
          </Col>

          <Col>
            <Card className="dashboard-card alert-card h-100">
              <Card.Body>
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h6 className="stats-title">Coberturas Retiradas</h6>
                    <h3 className="stats-value">{estadisticas.polizasRetiradas}</h3>
                  </div>
                  <div className="stats-icon"><FaExclamationTriangle /></div>
                </div>
              </Card.Body>
            </Card>
          </Col>
          
        </Row>
      </div>


      {/* Nuevos KPIs de Alertas */}
      {(preferenciasVisualizacion.mostrarCumpleanos || preferenciasVisualizacion.mostrarPagosPendientes || preferenciasVisualizacion.mostrarTareasVencidas) && (
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

            {/* KPI Tareas Vencidas */}
            {preferenciasVisualizacion.mostrarTareasVencidas && (
              <Col xl={12} md={12}>
                <Card className="dashboard-card alert-card h-100">
                  <Card.Body>
                    <div className="d-flex justify-content-between align-items-start mb-3">
                      <div className="d-flex align-items-center gap-2">
                        <div className="stats-icon" style={{ background: "rgba(220, 53, 69, 0.1)", color: "#dc3545" }}>
                          <FaExclamationTriangle />
                        </div>
                        <div>
                          <h6 className="stats-title mb-0">Tareas vencidas (mis tareas)</h6>
                          <h3 className="stats-value" style={{ color: "#dc3545" }}>
                            {loadingTareasVencidas ? "..." : tareasVencidas.length}
                          </h3>
                        </div>
                      </div>
                    </div>
                    {loadingTareasVencidas ? (
                      <div className="text-center py-3">
                        <div className="spinner-border spinner-border-sm text-danger" role="status">
                          <span className="visualmente-oculto">Cargando...</span>
                        </div>
                      </div>
                    ) : tareasVencidas.length > 0 ? (
                      <div className="table-responsive" style={{ maxHeight: "220px", overflowY: "auto" }}>
                        <Table hover size="sm" className="mb-0">
                          <thead>
                            <tr>
                              <th>ID</th>
                              <th>Concepto principal</th>
                              <th>Subconcepto</th>
                              <th>Cliente</th>
                              <th>Fecha de inicio</th>
                              <th>Fecha de vencimiento</th>
                              <th>Días de atraso</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tareasVencidas.slice(0, 15).map((tarea) => {
                              const toStr = (v) => {
                                if (v == null) return "";
                                if (typeof v === "string") return v;
                                if (typeof v === "object") {
                                  const n = v.name ?? v.nombre;
                                  return n != null ? String(n) : "";
                                }
                                return "";
                              };

                              const conceptObj = tarea?.log?.concept ?? tarea?.concept ?? {};
                              const conceptoPadre =
                                toStr(conceptObj?.parent) ||
                                conceptObj?.parent_name ||
                                toStr(tarea?.log?.concept_parent) ||
                                toStr(tarea?.concept_parent) ||
                                tarea?.concepto_padre ||
                                tarea?.log?.concepto_padre ||
                                tarea?.parent_concept_name ||
                                "";
                              const conceptoHijo =
                                toStr(tarea?.concepto) ||
                                toStr(tarea?.log?.concepto) ||
                                toStr(conceptObj) ||
                                tarea?.log?.concept_name ||
                                tarea?.concept_name ||
                                tarea?.concept_hijo ||
                                tarea?.subconcept_name ||
                                "";
                              const clienteNombre =
                                tarea?.log?.cliente?.nombre_completo ??
                                tarea?.log?.cliente?.nombre ??
                                tarea?.cliente_nombre ??
                                tarea?.cliente?.nombre_completo ??
                                tarea?.cliente?.nombre ??
                                "N/A";

                              const formatFecha = (valor) => {
                                if (!valor) return "—";
                                const d = new Date(typeof valor === "string" && !valor.includes("T") ? `${valor}T00:00:00` : valor);
                                return isNaN(d.getTime()) ? "—" : `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
                              };
                              const fechaInicio = tarea.scheduled_date ?? tarea.scheduled_at ?? tarea.fecha_programada ?? tarea.fecha_inicio ?? tarea.created_at;
                              const fechaVenc = tarea._fecha_vencimiento_original ?? tarea.due_date ?? tarea.fecha_vencimiento ?? tarea.fechaLimite;
                              const tareaId = tarea.id || tarea.task_id;

                              return (
                                <tr key={tareaId}>
                                  <td className="fw-medium">
                                    <Button
                                      variant="link"
                                      className="p-0 text-primary text-decoration-none fw-medium"
                                      onClick={() => {
                                        setTareaIdVer(tareaId);
                                        setShowVerTareaModal(true);
                                      }}
                                    >
                                      {tareaId}
                                    </Button>
                                  </td>
                                  <td>{conceptoPadre || "N/A"}</td>
                                  <td>{conceptoHijo || "N/A"}</td>
                                  <td>{clienteNombre}</td>
                                  <td className="text-nowrap">{formatFecha(fechaInicio)}</td>
                                  <td className="text-nowrap">{formatFecha(fechaVenc)}</td>
                                  <td>
                                    <Badge bg="danger">
                                      {tarea._dias_atraso} día{tarea._dias_atraso === 1 ? "" : "s"}
                                    </Badge>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </Table>
                        {tareasVencidas.length > 15 && (
                          <div className="text-center mt-2">
                            <small className="text-muted">+{tareasVencidas.length - 15} más</small>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-3 text-muted small">
                        No tienes tareas vencidas
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
          <th>Codigo de ID</th>
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

      {/* Sección Clientes Recientes y Coberturas Canceladas */}
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
                <h5 className="section-title mb-0">Coberturas Canceladas y Retiradas</h5>
                <Form.Check
                  type="switch"
                  id="toggle-polizas-canceladas-inline"
                  checked={preferenciasVisualizacion.mostrarPolizasCanceladas}
                  onChange={() => togglePreferencia('mostrarPolizasCanceladas')}
                  className="small"
                />
              </div>
              <div className="d-flex align-items-center gap-2">
                <Form.Select
                  size="sm"
                  value={mesCoberturasSeleccionado}
                  onChange={(e) => setMesCoberturasSeleccionado(e.target.value)}
                  style={{ minWidth: "150px" }}
                >
                  {(() => {
                    const meses = [];
                    const hoy = new Date();
                    for (let i = 0; i < 12; i++) {
                      const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
                      const anio = fecha.getFullYear();
                      const mes = String(fecha.getMonth() + 1).padStart(2, "0");
                      const mesNombre = fecha.toLocaleString("es-ES", { month: "long" });
                      meses.push(
                        <option key={`${anio}-${mes}`} value={`${anio}-${mes}`}>
                          {mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1)} {anio}
                        </option>
                      );
                    }
                    return meses;
                  })()}
                </Form.Select>
                <Form.Select
                  size="sm"
                  value={tipoCoberturaFiltro}
                  onChange={(e) => setTipoCoberturaFiltro(e.target.value)}
                  style={{ minWidth: "130px" }}
                >
                  <option value="todos">Todos</option>
                  <option value="cancelados">Cancelados</option>
                  <option value="retiros">Retiros</option>
                </Form.Select>
              </div>
            </div>
            <div className="mb-2 small text-muted">
              Mes seleccionado: <strong>{resumenCoberturasMes.total}</strong> registros
              {" "}(<strong>{resumenCoberturasMes.cancelados}</strong> cancelados,{" "}
              <strong>{resumenCoberturasMes.retiros}</strong> retiros)
            </div>
            <div className="table-responsive">
              <Table hover className="mb-0 table-borderless">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Fecha de cancelación</th>
                    <th>Fecha de retiro</th>
                    <th>Concepto</th>
                    <th>Motivo</th>
                    <th className="text-end">Estado</th>
                  </tr>
                </thead>
                <tbody>
                      {cargando ? (
                        renderLoading()
                      ) : eventosCoberturaFiltrados.length > 0 ? (
                        eventosCoberturaFiltrados.slice(0, 15).map(poliza => (
                          <tr key={`${poliza.id}-${poliza.fecha_cancelacion || ""}-${poliza.fecha_retiro || ""}`}>
                            <td className="fw-medium">{poliza.clienteNombre}</td>
                            <td>{formatearFecha(poliza.fecha_cancelacion)}</td>
                            <td>{formatearFecha(poliza.fecha_retiro)}</td>
                            <td>{poliza.concepto || "—"}</td>
                            <td>{poliza.motivo || "—"}</td>
                            <td className="text-end">
                              {poliza.tipo === "cancelados" ? (
                                <Badge bg="danger" pill>Cancelada</Badge>
                              ) : (
                                <Badge bg="secondary" pill>Retirada</Badge>
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        renderEmptyMessage("No hay coberturas para los filtros seleccionados")
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
                    <Form.Check
                      type="switch"
                      id="toggle-tareas-vencidas-config"
                      label={
                        <span>
                          <FaExclamationTriangle className="me-2" />
                          Tareas vencidas (mis tareas)
                        </span>
                      }
                      checked={preferenciasVisualizacion.mostrarTareasVencidas}
                      onChange={() => togglePreferencia('mostrarTareasVencidas')}
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
                          Coberturas Canceladas
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

      {/* Modal detalle de tarea (tareas vencidas) */}
      <VerTareaModal
        show={showVerTareaModal}
        onHide={() => {
          setShowVerTareaModal(false);
          setTareaIdVer(null);
        }}
        taskId={tareaIdVer}
      />
    </div>
  );
};

export default Dashboard;