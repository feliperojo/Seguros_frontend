import React, { useState, useEffect, useMemo, useRef } from "react";
import apiRequest from "../services/api";
import { getEstadoGrupoConfig, ordenarResumenGrupos } from "../constants/estadosGrupoFamiliar";

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
  const estadosConDatos = useMemo(
    () => ordenarResumenGrupos(resumenEstados),
    [resumenEstados]
  );

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
      "inscripción / confirmación": "inscripcion_ini",
      "inscripcion / confirmacion": "inscripcion_ini",
      "grupo familiar": "grupo_familiar",
      "grupo familiar (activos)": "grupo_familiar_activo",
      "grupo familiar (inactivos)": "grupo_familiar_inactivo",
      "gf activos": "grupo_familiar_activo",
      "gf inactivos": "grupo_familiar_inactivo",
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
      <div className="estados-container">
        {estadosConDatos.map(({ key, valor, config, nombre }) => {
          const IconComponent = config.icon;
          const estaSeleccionado = isEstadoSeleccionado(key, nombre);

          return (
            <button
              key={key}
              type="button"
              className={`estado-item${estaSeleccionado ? " is-selected" : ""}`}
              onClick={() => handleEstadoClick(key, nombre)}
              disabled={!onEstadoClick}
              title={
                estaSeleccionado
                  ? "Quitar filtro de este estado"
                  : `Filtrar por ${config.label}`
              }
            >
              <span className="estado-item__icon" aria-hidden="true">
                <IconComponent />
              </span>
              <span className="estado-item__text">
                <span className="estado-item__label">{config.label}</span>
                <span className="estado-item__count">{valor}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ResumenGruposEstados;
