import React, { useState, useEffect, useMemo, useRef } from "react";
import { Badge } from "react-bootstrap";
import { FaProjectDiagram, FaFileInvoiceDollar, FaCheckCircle, FaClock, FaUserCheck, FaClipboardList } from "react-icons/fa";
import apiRequest from "../services/api";

// Mapeo de estados a iconos y colores (fuera del componente para evitar recrearlo)
const estadoConfig = {
    cotizacion: {
      icon: FaFileInvoiceDollar,
      color: "#1a73e8",
      label: "En Cotización"
    },
    prospecto: {
      icon: FaUserCheck,
      color: "#34a853",
      label: "Prospecto"
    },
    seguimiento: {
      icon: FaClock,
      color: "#fbbc04",
      label: "En Seguimiento"
    },
    toma_datos: {
      icon: FaClipboardList,
      color: "#ea4335",
      label: "Toma de Datos"
    },
    inscripcion_ini: {
      icon: FaCheckCircle,
      color: "#4285f4",
      label: "Inscripción Inicial"
    },
    grupo_familiar: {
      icon: FaProjectDiagram,
      color: "#9334e6",
      label: "Grupo Familiar"
    },
    descartado: {
      icon: FaProjectDiagram,
      color: "#6c757d",
      label: "Descartado"
    }
};

// Función para obtener la configuración de un estado (fuera del componente)
const getEstadoConfig = (estado) => {
  const estadoLower = (estado || "").toLowerCase();
  return estadoConfig[estadoLower] || {
    icon: FaProjectDiagram,
    color: "#6c757d",
    label: estado || "Sin estado"
  };
};

const ResumenGruposEstados = ({ onEstadoClick, estadoSeleccionado }) => {
  const [resumenEstados, setResumenEstados] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const cargandoRef = useRef(false); // Para evitar múltiples llamadas simultáneas

  useEffect(() => {
    // Evitar múltiples llamadas simultáneas
    if (cargandoRef.current) {
      return;
    }

    const cargarResumen = async () => {
      cargandoRef.current = true;
      setCargando(true);
      setError(null);
      try {
        const res = await apiRequest("estados/resumen-grupos", "GET");
        // El endpoint devuelve un array de objetos
        const datos = res?.data || res || [];
        
        // Validar que sea un array
        if (!Array.isArray(datos)) {
          console.warn("El endpoint no devolvió un array:", datos);
          setResumenEstados([]);
          return;
        }
        
        setResumenEstados(datos);
      } catch (err) {
        console.error("Error al cargar resumen de grupos por estado:", err);
        setError("Error al cargar el resumen de grupos");
        setResumenEstados([]);
      } finally {
        setCargando(false);
        cargandoRef.current = false;
      }
    };

    cargarResumen();
  }, []); // Solo se ejecuta una vez al montar

  // Ordenar estados según un orden lógico
  const ordenEstados = ["prospecto", "cotizacion", "seguimiento", "toma_datos", "inscripcion_ini", "grupo_familiar", "descartado"];

  // Procesar el array de estados usando useMemo para evitar recálculos innecesarios
  const estadosConDatos = useMemo(() => {
    // Procesar el array de estados que viene del API
    // resumenEstados es un array de objetos: [{estado_id, codigo, nombre, total_grupos, grupo_ids}, ...]
    const estadosProcesados = Array.isArray(resumenEstados) 
      ? resumenEstados.map(item => ({
          codigo: (item.codigo || "").toLowerCase(),
          nombre: item.nombre || "",
          total_grupos: item.total_grupos ?? 0,
          estado_id: item.estado_id
        }))
      : [];

    // Crear un mapa para ordenar según ordenEstados
    const estadosMap = new Map();
    estadosProcesados.forEach(estado => {
      estadosMap.set(estado.codigo, estado);
    });

    // Ordenar: primero los que están en ordenEstados, luego los demás
    const estadosOrdenados = [
      ...ordenEstados
        .filter(codigo => estadosMap.has(codigo))
        .map(codigo => estadosMap.get(codigo)),
      ...estadosProcesados.filter(estado => !ordenEstados.includes(estado.codigo))
    ];

    // Mapear a objetos con la información necesaria para renderizar
    return estadosOrdenados
      .filter(estado => estado.total_grupos !== undefined && estado.total_grupos !== null)
      .map(estado => {
        const codigoLower = estado.codigo.toLowerCase();
        const config = getEstadoConfig(codigoLower);
        
        return {
          key: codigoLower,
          valor: estado.total_grupos,
          nombre: estado.nombre,
          config: {
            ...config,
            label: estado.nombre || config.label
          }
        };
      });
  }, [resumenEstados]);

  // Si no hay datos, mostrar mensaje
  if (cargando) {
    return (
      <div className="resumen-estados-navbar">
        <div className="d-flex justify-content-center align-items-center py-3">
          <div className="spinner-border spinner-border-sm text-primary" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="resumen-estados-navbar">
        <div className="text-center py-3 text-muted">
          <small>{error}</small>
        </div>
      </div>
    );
  }

  if (estadosConDatos.length === 0) {
    return null;
  }

  // Verificar si un estado está seleccionado
  const isEstadoSeleccionado = (codigoEstado, nombreEstado) => {
    if (!estadoSeleccionado || estadoSeleccionado === "Todos los estados") return false;
    const estadoLower = estadoSeleccionado.toLowerCase();
    const codigoLower = codigoEstado.toLowerCase();
    const nombreLower = (nombreEstado || "").toLowerCase();
    
    // Comparar con código y nombre
    if (estadoLower === codigoLower || estadoLower === nombreLower) return true;
    
    // Mapeo adicional para nombres alternativos
    const nombreMap = {
      "cotización": "cotizacion",
      "en cotización": "cotizacion",
      "toma de datos": "toma_datos",
      "inscripción inicial": "inscripcion_ini",
      "grupo familiar": "grupo_familiar"
    };
    
    const nombreMapeado = nombreMap[nombreLower];
    return nombreMapeado === estadoLower || estadoLower === nombreMapeado;
  };

  // Función para manejar el clic en un estado
  const handleEstadoClick = (codigoEstado, nombreEstado) => {
    if (onEstadoClick) {
      // Si el estado ya está seleccionado, deseleccionar (volver a "Todos los estados")
      const estaSeleccionado = isEstadoSeleccionado(codigoEstado, nombreEstado);
      if (estaSeleccionado) {
        onEstadoClick("Todos los estados");
      } else {
        // Pasar el código del estado directamente (ya está en minúsculas)
        // El código es lo que el endpoint espera
        onEstadoClick(codigoEstado);
      }
    }
  };

  return (
    <div className="resumen-estados-navbar">
      <div className="d-flex flex-wrap align-items-center justify-content-center gap-3 py-3 px-4 estados-container">
        {estadosConDatos.map(({ key, valor, config, nombre }) => {
          const IconComponent = config.icon;
          const estaSeleccionado = isEstadoSeleccionado(key, nombre);
          
          return (
            <div 
              key={key} 
              className="d-flex align-items-center gap-2 estado-item"
              onClick={() => handleEstadoClick(key, nombre)}
              style={{ 
                borderLeft: `4px solid ${config.color}`,
                paddingLeft: '14px',
                paddingRight: '14px',
                paddingTop: '8px',
                paddingBottom: '8px',
                cursor: onEstadoClick ? 'pointer' : 'default',
                backgroundColor: estaSeleccionado ? `${config.color}20` : 'transparent',
                boxShadow: estaSeleccionado ? `0 2px 4px ${config.color}40` : 'none'
              }}
            >
              <IconComponent 
                style={{ 
                  color: config.color,
                  fontSize: '18px'
                }} 
              />
              <span className="estado-label" style={{ color: '#495057', fontSize: '15px', fontWeight: '500' }}>
                {config.label}:
              </span>
              <Badge 
                bg="light" 
                text="dark"
                style={{ 
                  fontSize: '15px',
                  fontWeight: '700',
                  padding: '6px 12px',
                  border: `1px solid ${config.color}30`,
                  backgroundColor: estaSeleccionado ? `${config.color}25` : `${config.color}15`,
                  minWidth: '40px',
                  textAlign: 'center'
                }}
              >
                {valor}
              </Badge>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ResumenGruposEstados;
