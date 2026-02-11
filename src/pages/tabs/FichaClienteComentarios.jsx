import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useFichaCliente } from "../../context/fichaClienteContext";
import apiRequest from "../../services/api";
import { Spinner, Modal, Button } from "react-bootstrap";
import NuevoComentarioModal from "../../components/Tareas/NuevoComentarioModal";
import NuevaTareaModal from "../../components/Tareas/NuevaTareaModal";
import { formatDateForDisplay } from "../../utils/formatters";

const toValidId = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export default function FichaClienteComentarios() {
  const { cliente, coberturaPrincipal, id: clienteId, selectedGrupoId } = useFichaCliente();
  const [comentarios, setComentarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showTareaModal, setShowTareaModal] = useState(false);
  const [comentariosTareas, setComentariosTareas] = useState({}); // { taskId: [comentarios] }
  const [loadingComentariosTareas, setLoadingComentariosTareas] = useState({}); // { taskId: true/false }
  const [tareasExpandidas, setTareasExpandidas] = useState({}); // { taskId: true/false }
  const [adjuntos, setAdjuntos] = useState({}); // { logId: [adjuntos] }
  const [loadingAdjuntos, setLoadingAdjuntos] = useState({}); // { logId: true/false }
  const [archivosExpandidos, setArchivosExpandidos] = useState({}); // { logId: true/false }
  const [archivoPreview, setArchivoPreview] = useState(null); // { adjunto, tipo }
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [errorCargaArchivo, setErrorCargaArchivo] = useState(false);

  // ✅ Estados para filtros
  const [filtroConceptoPadre, setFiltroConceptoPadre] = useState("");
  const [filtroSubconcepto, setFiltroSubconcepto] = useState("");
  const [filtroPalabraClave, setFiltroPalabraClave] = useState("");
  const [filtroTipoTarea, setFiltroTipoTarea] = useState(true); // true = mostrar tareas
  const [filtroTipoComentario, setFiltroTipoComentario] = useState(true); // true = mostrar comentarios
  const [conceptosPadres, setConceptosPadres] = useState([]);
  const [subconceptos, setSubconceptos] = useState([]);
  const [loadingConceptos, setLoadingConceptos] = useState(false);

  // Obtener grupo familiar seleccionado del contexto (compartido con el tab General)
  const grupoFamiliarId = useMemo(() => {
    // Prioridad: grupo seleccionado del contexto > cobertura principal > cliente
    if (selectedGrupoId) {
      return toValidId(selectedGrupoId);
    }
    if (!cliente) return null;
    return (
      toValidId(coberturaPrincipal?.grupo_familiar_id) ??
      toValidId(coberturaPrincipal?.grupo_familiar?.id) ??
      toValidId(cliente.grupo_familiar_id) ??
      null
    );
  }, [cliente, coberturaPrincipal, selectedGrupoId]);

  // Determinar si un item es comentario o tarea
  const getTipoItem = (item) => {
    const status = String(item?.status || item?.estado || item?.task?.status || "").toLowerCase();
    const tipo = String(item?.tipo || item?.action_type || "").toLowerCase();
    
    // Verificar si es una tarea (prioridad a tarea)
    const esTarea = 
      tipo === "tarea" ||
      status === "pending" ||
      status === "completed" ||
      status === "in_progress" ||
      (item.assign_to_user_id && (item.scheduled_date || item.due_date));
    
    // Verificar si es un comentario
    const esComentario = 
      tipo === "comentario" ||
      status === "comment" ||
      (!item.assign_to_user_id && !item.scheduled_date && !item.due_date && item.note);
    
    // Prioridad: si tiene tipo explícito, usarlo; si no, verificar por características
    if (tipo === "tarea" || tipo === "comentario") {
      return tipo;
    }
    
    if (esTarea) return "tarea";
    if (esComentario) return "comentario";
    return "comentario"; // Por defecto
  };

  // ✅ Cargar conceptos padres y subconceptos para filtros
  useEffect(() => {
    const cargarConceptos = async () => {
      setLoadingConceptos(true);
      try {
        const response = await apiRequest("operational_concepts?only_parents=true", "GET");
        setConceptosPadres(Array.isArray(response) ? response : response?.data || []);
      } catch (err) {
        console.error("Error al cargar conceptos:", err);
        setConceptosPadres([]);
      } finally {
        setLoadingConceptos(false);
      }
    };
    cargarConceptos();
  }, []);

  // ✅ Cargar subconceptos cuando se selecciona un concepto padre
  useEffect(() => {
    const cargarSubconceptos = async () => {
      if (!filtroConceptoPadre) {
        setSubconceptos([]);
        setFiltroSubconcepto("");
        return;
      }
      try {
        const response = await apiRequest(`operational_concepts/${filtroConceptoPadre}/subconcepts`, "GET");
        setSubconceptos(Array.isArray(response) ? response : response?.data || []);
        setFiltroSubconcepto(""); // Reset subconcepto al cambiar concepto padre
      } catch (err) {
        console.error("Error al cargar subconceptos:", err);
        setSubconceptos([]);
      }
    };
    cargarSubconceptos();
  }, [filtroConceptoPadre]);

  // Cargar comentarios del grupo familiar
  useEffect(() => {
    if (!grupoFamiliarId) {
      setComentarios([]);
      setError("No hay grupo familiar asociado");
      return;
    }

    const cargarComentarios = async () => {
      setLoading(true);
      setError("");
      try {
        // Obtener bitacora operativa filtrando por grupo familiar y tipo comment
        const response = await apiRequest(
          `bitacora_operativa?grupo_familiar_id=${grupoFamiliarId}&per_page=100`,
          "GET"
        );

        // Extraer los datos
        const data = response?.data || response || [];
        const lista = Array.isArray(data) ? data : [];

        // 🔍 DEBUG: Ver respuesta completa del backend
        console.log("=== RESPUESTA COMPLETA DEL BACKEND ===");
        console.log("Response completa:", response);
        console.log("Data extraída:", data);
        console.log("Lista procesada:", lista);

        // Filtrar comentarios y tareas
        // Se identifican usando la función getTipoItem
        const itemsFiltrados = lista.filter((item) => {
          const tipoItem = getTipoItem(item);
          const esComentarioOTarea = tipoItem === "comentario" || tipoItem === "tarea";
          
          // También verificar que pertenezca al grupo familiar correcto
          const itemGrupoId = item.grupo_familiar_id || item.grupo_familiar?.id;
          const perteneceAlGrupo = !itemGrupoId || Number(itemGrupoId) === Number(grupoFamiliarId);
          
          return esComentarioOTarea && perteneceAlGrupo;
        });

        // 🔍 DEBUG: Ver items filtrados, especialmente tareas
        console.log("=== ITEMS FILTRADOS ===");
        console.log("Total items filtrados:", itemsFiltrados.length);
        itemsFiltrados.forEach((item, index) => {
          const tipoItem = getTipoItem(item);
          if (tipoItem === "tarea") {
            console.log(`--- TAREA ${index + 1} ---`);
            console.log("Item completo:", item);
            console.log("Campos disponibles:", Object.keys(item));
            console.log("status:", item.status);
            console.log("estado:", item.estado);
            console.log("task?.status:", item.task?.status);
            console.log("task:", item.task);
            console.log("tipo:", item.tipo);
            console.log("action_type:", item.action_type);
          }
        });

        // Ordenar por fecha de creación (más reciente primero)
        const itemsOrdenados = itemsFiltrados.sort((a, b) => {
          const fechaA = new Date(a.created_at || a.createdAt || a.fecha || 0);
          const fechaB = new Date(b.created_at || b.createdAt || b.fecha || 0);
          return fechaB - fechaA; // Descendente (más reciente primero)
        });

        // 🔍 DEBUG: Ver items ordenados finales
        console.log("=== ITEMS ORDENADOS FINALES ===");
        console.log("Total items ordenados:", itemsOrdenados.length);
        itemsOrdenados.forEach((item, index) => {
          const tipoItem = getTipoItem(item);
          if (tipoItem === "tarea") {
            console.log(`TAREA FINAL ${index + 1}:`, {
              id: item.id,
              status: item.status,
              estado: item.estado,
              task_status: item.task?.status,
              tipo: item.tipo,
              action_type: item.action_type,
              item_completo: item
            });
          }
        });

        setComentarios(itemsOrdenados);

        // Cargar adjuntos de cada item
        itemsOrdenados.forEach((item) => {
          const logId = item.id || item.log?.id;
          if (logId) {
            cargarAdjuntos(logId);
          }
        });
      } catch (err) {
        console.error("Error al cargar comentarios y tareas:", err);
        setError("No se pudieron cargar los comentarios y tareas");
        setComentarios([]);
      } finally {
        setLoading(false);
      }
    };

    cargarComentarios();
  }, [grupoFamiliarId]);

  // Formatear fecha - formato más compacto y moderno
  const formatFecha = (fecha) => {
    if (!fecha) return "Sin fecha";
    try {
      const d = new Date(fecha);
      if (isNaN(d)) return fecha;
      
      const ahora = new Date();
      const diffMs = ahora - d;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
      
      // Formato relativo para fechas recientes
      if (diffMins < 1) return "Hace un momento";
      if (diffMins < 60) return `Hace ${diffMins} min`;
      if (diffHours < 24) return `Hace ${diffHours} h`;
      if (diffDays === 1) return "Ayer";
      if (diffDays < 7) return `Hace ${diffDays} días`;
      
      // Formato completo para fechas más antiguas en formato mm/dd/yyyy hh:mm AM/PM
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const year = d.getFullYear();
      let hours = d.getHours();
      const minutes = String(d.getMinutes()).padStart(2, "0");
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12;
      hours = hours ? hours : 12;
      const hoursStr = String(hours).padStart(2, "0");
      
      return `${month}/${day}/${year} ${hoursStr}:${minutes} ${ampm}`;
    } catch {
      return fecha;
    }
  };

  // Obtener nombre del concepto
  const getConceptoNombre = (item) => {
    return (
      item?.concept?.name ||
      item?.concepto?.name ||
      item?.concept_name ||
      item?.concepto ||
      "Sin concepto"
    );
  };

  // Obtener nombre del usuario
  const getUsuarioNombre = (item) => {
    return (
      item?.user?.name ||
      item?.usuario?.name ||
      item?.user_name ||
      item?.usuario ||
      item?.created_by?.name ||
      "Usuario desconocido"
    );
  };

  // Obtener nombre del cliente
  const getClienteNombre = (item) => {
    return (
      item?.cliente?.nombre_completo ||
      item?.cliente_name ||
      item?.cliente ||
      "Cliente"
    );
  };

  // Obtener nombre del usuario asignado a la tarea
  const getUsuarioAsignadoNombre = (item) => {
    // El usuario asignado está en task.assigned_user.name
    return (
      item?.task?.assigned_user?.name ||
      item?.task?.assign_to_user?.name ||
      item?.task?.assigned_to_user?.name ||
      item?.assign_to_user?.name ||
      item?.assigned_to_user?.name ||
      item?.task?.assign_to_user_name ||
      item?.assign_to_user_name ||
      item?.assigned_to_name ||
      null
    );
  };

  // Obtener ID de la tarea desde el item
  const getTareaId = (item) => {
    return item?.task?.id || item?.task_id || item?.id || null;
  };

  // Obtener ID del log/bitácora desde el item
  const getLogId = (item) => {
    return item?.id || item?.log?.id || item?.log_id || null;
  };

  // Funciones helper para determinar tipo de archivo
  const esImagen = (adj) => {
    return adj.tipo_mime?.startsWith("image/") || 
           /\.(jpg|jpeg|png|gif|webp)$/i.test(adj.nombre_original || "");
  };

  const esPDF = (adj) => {
    return adj.tipo_mime === "application/pdf" || 
           /\.pdf$/i.test(adj.nombre_original || "");
  };

  const esWord = (adj) => {
    return adj.tipo_mime?.includes("word") || 
           /\.(doc|docx)$/i.test(adj.nombre_original || "");
  };

  // Función para abrir previsualización
  const abrirPreview = (adjunto) => {
    const esImg = esImagen(adjunto);
    const esPdf = esPDF(adjunto);
    const esDoc = esWord(adjunto);
    
    setArchivoPreview({
      adjunto,
      tipo: esImg ? "imagen" : esPdf ? "pdf" : esDoc ? "word" : "otro"
    });
    setErrorCargaArchivo(false);
    setShowPreviewModal(true);
  };

  // Función para descargar archivo
  const descargarArchivo = async (adjunto) => {
    try {
      // Intentar usar el endpoint de descarga si existe
      if (adjunto.id) {
        try {
          const res = await apiRequest(`adjuntos/bitacora/${adjunto.id}/descargar`, "GET");
          if (res?.url) {
            const link = document.createElement("a");
            link.href = res.url;
            link.download = adjunto.nombre_original || "archivo";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            return;
          }
        } catch (err) {
          console.log("Endpoint de descarga no disponible, usando URL directa");
        }
      }
      
      // Fallback: usar la URL directa con fetch para forzar descarga
      const response = await fetch(adjunto.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = adjunto.nombre_original || "archivo";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error al descargar archivo:", error);
      // Fallback final: abrir en nueva pestaña
      window.open(adjunto.url, "_blank");
    }
  };

  // Cargar comentarios de una tarea
  const cargarComentariosTarea = async (tareaId) => {
    if (!tareaId || comentariosTareas[tareaId]) {
      // Ya están cargados o no hay ID
      return;
    }

    setLoadingComentariosTareas((prev) => ({ ...prev, [tareaId]: true }));
    try {
      const data = await apiRequest(`tareas_operativas/${tareaId}/comentarios`, "GET");
      setComentariosTareas((prev) => ({
        ...prev,
        [tareaId]: Array.isArray(data) ? data : data?.data || [],
      }));
    } catch (err) {
      console.error(`Error al cargar comentarios de la tarea ${tareaId}:`, err);
      setComentariosTareas((prev) => ({
        ...prev,
        [tareaId]: [],
      }));
    } finally {
      setLoadingComentariosTareas((prev) => ({ ...prev, [tareaId]: false }));
    }
  };

  // Toggle para expandir/colapsar comentarios de una tarea
  const toggleComentariosTarea = (tareaId) => {
    if (!tareasExpandidas[tareaId]) {
      // Si se está expandiendo, cargar comentarios si no están cargados
      cargarComentariosTarea(tareaId);
    }
    setTareasExpandidas((prev) => ({
      ...prev,
      [tareaId]: !prev[tareaId],
    }));
  };

  // Cargar adjuntos (imágenes) de un log
  const cargarAdjuntos = useCallback(async (logId) => {
    if (!logId) return;

    // Verificar si ya están cargados o se están cargando usando una función
    setAdjuntos((prev) => {
      if (prev[logId]) return prev; // Ya están cargados
      
      // Iniciar carga
      setLoadingAdjuntos((prevLoading) => {
        if (prevLoading[logId]) return prevLoading; // Ya se está cargando
        return { ...prevLoading, [logId]: true };
      });

      // Cargar adjuntos usando el endpoint específico de bitácora
      apiRequest(`adjuntos/bitacora/${logId}`, "GET")
        .then((data) => {
          setAdjuntos((prevAdj) => {
            if (prevAdj[logId]) return prevAdj; // Evitar sobrescribir si ya se cargó
            return {
              ...prevAdj,
              [logId]: Array.isArray(data) ? data : data?.data || [],
            };
          });
        })
        .catch((err) => {
          console.error(`Error al cargar adjuntos del log ${logId}:`, err);
          setAdjuntos((prevAdj) => ({
            ...prevAdj,
            [logId]: [],
          }));
        })
        .finally(() => {
          setLoadingAdjuntos((prevLoading) => ({ ...prevLoading, [logId]: false }));
        });

      return prev;
    });
  }, []);

  // Función para recargar comentarios y tareas
  const recargarComentarios = useCallback(() => {
    if (!grupoFamiliarId) return;

    setLoading(true);
    // Limpiar cache de comentarios de tareas y adjuntos para forzar recarga
    setComentariosTareas({});
    setAdjuntos({});
    setArchivosExpandidos({});
    
    apiRequest(
      `bitacora_operativa?grupo_familiar_id=${grupoFamiliarId}&per_page=100`,
      "GET"
    )
      .then((response) => {
        const data = response?.data || response || [];
        const lista = Array.isArray(data) ? data : [];
        const itemsFiltrados = lista.filter((item) => {
          const tipoItem = getTipoItem(item);
          const esComentarioOTarea = tipoItem === "comentario" || tipoItem === "tarea";
          
          const itemGrupoId = item.grupo_familiar_id || item.grupo_familiar?.id;
          const perteneceAlGrupo = !itemGrupoId || Number(itemGrupoId) === Number(grupoFamiliarId);
          
          return esComentarioOTarea && perteneceAlGrupo;
        });
        const itemsOrdenados = itemsFiltrados.sort((a, b) => {
          const fechaA = new Date(a.created_at || a.createdAt || a.fecha || 0);
          const fechaB = new Date(b.created_at || b.createdAt || b.fecha || 0);
          return fechaB - fechaA;
        });
        setComentarios(itemsOrdenados);

        // Cargar adjuntos de cada item
        itemsOrdenados.forEach((item) => {
          const logId = item.id || item.log?.id;
          if (logId) {
            cargarAdjuntos(logId);
          }
        });
      })
      .catch((err) => {
        console.error("Error al recargar comentarios:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [grupoFamiliarId, cargarAdjuntos]);

  const handleComentarioCreado = () => {
    recargarComentarios();
  };

  const handleTareaCreada = () => {
    recargarComentarios();
  };

  // ✅ Función para filtrar comentarios según los filtros aplicados
  const comentariosFiltrados = useMemo(() => {
    return comentarios.filter((comentario) => {
      const concepto = getConceptoNombre(comentario);
      const nota = comentario.note || comentario.nota || comentario.comment || "";
      const tipoItem = getTipoItem(comentario);
      const esTarea = tipoItem === "tarea";
      const esComentario = tipoItem === "comentario";

      // Filtro por tipo (tarea/comentario)
      if (esTarea && !filtroTipoTarea) return false;
      if (esComentario && !filtroTipoComentario) return false;

      // Filtro por concepto padre
      if (filtroConceptoPadre) {
        const conceptoComentario = comentario?.concept?.name || comentario?.concepto?.name || comentario?.concept_name || comentario?.concepto || "";
        // Si hay subconceptos cargados, verificar si el concepto del comentario es uno de ellos
        if (subconceptos.length > 0) {
          const subconceptosNombres = subconceptos.map(s => s.name);
          const perteneceAlConceptoPadre = subconceptosNombres.includes(conceptoComentario);
          if (!perteneceAlConceptoPadre) return false;
        }
        // Si no hay subconceptos cargados aún, esperar a que se carguen (no filtrar por ahora)
        // Esto evita que se oculten resultados mientras se cargan los subconceptos
      }

      // Filtro por subconcepto
      if (filtroSubconcepto) {
        const subconceptoNombre = subconceptos.find(s => s.id === Number(filtroSubconcepto))?.name;
        if (subconceptoNombre) {
          const conceptoComentario = comentario?.concept?.name || comentario?.concepto?.name || comentario?.concept_name || comentario?.concepto || "";
          if (conceptoComentario !== subconceptoNombre) return false;
        }
      }

      // Filtro por palabra clave en el contenido de la nota
      if (filtroPalabraClave) {
        const palabraClaveLower = filtroPalabraClave.toLowerCase();
        const notaLower = nota.toLowerCase();
        // Extraer texto plano del HTML si es necesario
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = nota;
        const textoPlano = tempDiv.textContent || tempDiv.innerText || "";
        const textoPlanoLower = textoPlano.toLowerCase();
        
        // Buscar en el concepto también
        const conceptoLower = concepto.toLowerCase();
        
        if (!notaLower.includes(palabraClaveLower) && 
            !textoPlanoLower.includes(palabraClaveLower) && 
            !conceptoLower.includes(palabraClaveLower)) {
          return false;
        }
      }

      return true;
    });
  }, [comentarios, filtroConceptoPadre, filtroSubconcepto, filtroPalabraClave, filtroTipoTarea, filtroTipoComentario, conceptosPadres, subconceptos]);

  if (!cliente) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-blue-800">
        <div className="flex items-center gap-2">
          <i className="fas fa-info-circle"></i>
          <span>No se encontró información del cliente.</span>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Estilos para renderizar contenido HTML de Quill */}
      <style>{`
        .ql-editor {
          font-size: 16px;
          line-height: 1.6;
          padding: 0;
        }
        .ql-editor p {
          margin: 0 0 0.5em 0;
        }
        .ql-editor p:last-child {
          margin-bottom: 0;
        }
        .ql-editor strong {
          font-weight: 600;
        }
        .ql-editor em {
          font-style: italic;
        }
        .ql-editor u {
          text-decoration: underline;
        }
        .ql-editor s {
          text-decoration: line-through;
        }
        .ql-editor a {
          color: #2563eb;
          text-decoration: underline;
        }
        .ql-editor a:hover {
          color: #1d4ed8;
        }
        .ql-editor ul, .ql-editor ol {
          padding-left: 1.5em;
          margin: 0.5em 0;
        }
        .ql-editor blockquote {
          border-left: 4px solid #e5e7eb;
          padding-left: 1em;
          margin: 0.5em 0;
          color: #6b7280;
        }
        .ql-editor code {
          background-color: #f3f4f6;
          padding: 0.2em 0.4em;
          border-radius: 0.25em;
          font-family: monospace;
          font-size: 0.9em;
        }
        .ql-editor pre {
          background-color: #f3f4f6;
          padding: 0.75em;
          border-radius: 0.25em;
          overflow-x: auto;
          margin: 0.5em 0;
        }
        .ql-editor .ql-size-small {
          font-size: 0.75em;
        }
        .ql-editor .ql-size-large {
          font-size: 1.5em;
        }
        .ql-editor .ql-size-huge {
          font-size: 2.5em;
        }
        .ql-editor .ql-align-center {
          text-align: center;
        }
        .ql-editor .ql-align-right {
          text-align: right;
        }
        .ql-editor .ql-align-justify {
          text-align: justify;
        }
      `}</style>
      
      {/* Header principal con diseño moderno */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
        {/* Header con gradiente sutil */}
        <div className="bg-gradient-to-r from-slate-50 to-gray-50 px-6 py-5 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center shadow-sm">
                <i className="fas fa-comments text-white text-sm"></i>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-800 m-0">Tareas y Notas</h2>
                <p className="text-sm text-gray-500 m-0 mt-0.5">Historial de comentarios y tareas del grupo familiar</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowModal(true)}
                className="px-4 py-2 bg-slate-700 text-white rounded-lg font-medium text-sm shadow-sm hover:bg-slate-800 transition-all duration-200 flex items-center gap-2 hover:shadow-md"
              >
                <i className="fas fa-comment text-xs"></i>
                <span>Nuevo Comentario</span>
              </button>
              <button
                onClick={() => setShowTareaModal(true)}
                className="px-4 py-2 bg-gradient-to-r from-slate-600 to-slate-700 text-white rounded-lg font-medium text-sm shadow-sm hover:from-slate-700 hover:to-slate-800 transition-all duration-200 flex items-center gap-2 hover:shadow-md"
              >
                <i className="fas fa-tasks text-xs"></i>
                <span>Nueva Tarea</span>
              </button>
            </div>
          </div>
        </div>

        {/* Contenido */}
        <div className="p-6">
          {!grupoFamiliarId ? (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                  <i className="fas fa-exclamation-triangle text-gray-500 text-sm"></i>
                </div>
                <div>
                  <p className="text-gray-700 font-medium m-0">No hay grupo familiar asociado</p>
                  <p className="text-gray-600 text-sm m-0 mt-1">Este cliente no tiene un grupo familiar asociado.</p>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Badge de grupo familiar */}
              <div className="mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full">
                  <i className="fas fa-users text-gray-500 text-xs"></i>
                  <span className="text-sm text-gray-600">
                    Grupo Familiar: <span className="font-semibold text-gray-800">GF #{grupoFamiliarId}</span>
                  </span>
                </div>
              </div>

              {/* ✅ Sección de Filtros */}
              <div className="mb-6 bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                    <i className="fas fa-filter text-slate-600 text-sm"></i>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800 m-0">Filtros</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Filtro por Concepto Padre */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <i className="fas fa-tag text-xs mr-1"></i>
                      Concepto
                    </label>
                    <select
                      value={filtroConceptoPadre}
                      onChange={(e) => setFiltroConceptoPadre(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                    >
                      <option value="">Todos los conceptos</option>
                      {loadingConceptos ? (
                        <option disabled>Cargando...</option>
                      ) : (
                        conceptosPadres.map((concepto) => (
                          <option key={concepto.id} value={concepto.id}>
                            {concepto.name}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  {/* Filtro por Subconcepto */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <i className="fas fa-tags text-xs mr-1"></i>
                      Subconcepto
                    </label>
                    <select
                      value={filtroSubconcepto}
                      onChange={(e) => setFiltroSubconcepto(e.target.value)}
                      disabled={!filtroConceptoPadre}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                      <option value="">Todos los subconceptos</option>
                      {subconceptos.map((subconcepto) => (
                        <option key={subconcepto.id} value={subconcepto.id}>
                          {subconcepto.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Filtro por Palabra Clave */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <i className="fas fa-search text-xs mr-1"></i>
                      Buscar palabra clave
                    </label>
                    <input
                      type="text"
                      value={filtroPalabraClave}
                      onChange={(e) => setFiltroPalabraClave(e.target.value)}
                      placeholder="Buscar en notas..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                    />
                  </div>

                  {/* Filtro por Tipo (Tarea/Comentario) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <i className="fas fa-list text-xs mr-1"></i>
                      Tipo
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={filtroTipoTarea}
                          onChange={(e) => setFiltroTipoTarea(e.target.checked)}
                          className="w-4 h-4 text-slate-600 border-gray-300 rounded focus:ring-slate-500"
                        />
                        <span className="text-sm text-gray-700">
                          <i className="fas fa-tasks text-xs mr-1"></i>
                          Tareas
                        </span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={filtroTipoComentario}
                          onChange={(e) => setFiltroTipoComentario(e.target.checked)}
                          className="w-4 h-4 text-slate-600 border-gray-300 rounded focus:ring-slate-500"
                        />
                        <span className="text-sm text-gray-700">
                          <i className="fas fa-comment text-xs mr-1"></i>
                          Comentarios
                        </span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Botón para limpiar filtros */}
                {(filtroConceptoPadre || filtroSubconcepto || filtroPalabraClave || !filtroTipoTarea || !filtroTipoComentario) && (
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={() => {
                        setFiltroConceptoPadre("");
                        setFiltroSubconcepto("");
                        setFiltroPalabraClave("");
                        setFiltroTipoTarea(true);
                        setFiltroTipoComentario(true);
                      }}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200 flex items-center gap-2"
                    >
                      <i className="fas fa-times text-xs"></i>
                      Limpiar filtros
                    </button>
                  </div>
                )}

                {/* Contador de resultados */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <p className="text-sm text-gray-600 m-0">
                    Mostrando <span className="font-semibold text-gray-800">{comentariosFiltrados.length}</span> de{" "}
                    <span className="font-semibold text-gray-800">{comentarios.length}</span> resultados
                  </p>
                </div>
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Spinner animation="border" variant="primary" className="mb-4" />
                  <p className="text-gray-500 text-sm font-medium">Cargando comentarios y tareas...</p>
                </div>
              ) : error ? (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                      <i className="fas fa-exclamation-circle text-gray-600 text-sm"></i>
                    </div>
                    <p className="text-gray-700 font-medium m-0">{error}</p>
                  </div>
                </div>
              ) : comentariosFiltrados.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                    <i className="fas fa-comments text-gray-400 text-2xl"></i>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">No hay comentarios ni tareas aún</h3>
                  <p className="text-gray-500 text-sm mb-6 text-center max-w-sm">
                    Comienza a agregar comentarios o tareas para este grupo familiar y mantén un registro de las interacciones.
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setShowModal(true)}
                      className="px-5 py-2.5 bg-slate-700 text-white rounded-lg font-medium text-sm shadow-sm hover:bg-slate-800 transition-all duration-200 flex items-center gap-2 hover:shadow-md"
                    >
                      <i className="fas fa-comment text-xs"></i>
                      <span>Agregar Comentario</span>
                    </button>
                    <button
                      onClick={() => setShowTareaModal(true)}
                      className="px-5 py-2.5 bg-slate-600 text-white rounded-lg font-medium text-sm shadow-sm hover:bg-slate-700 transition-all duration-200 flex items-center gap-2 hover:shadow-md"
                    >
                      <i className="fas fa-tasks text-xs"></i>
                      <span>Agregar Tarea</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {comentariosFiltrados.map((comentario, index) => {
                    const fecha = comentario.created_at || comentario.createdAt || comentario.fecha;
                    const concepto = getConceptoNombre(comentario);
                    const usuarioCreador = getUsuarioNombre(comentario); // Usuario que creó el comentario/tarea
                    const clienteNombre = getClienteNombre(comentario);
                    const usuarioAsignado = getUsuarioAsignadoNombre(comentario); // Usuario asignado a la tarea
                    const nota = comentario.note || comentario.nota || comentario.comment || "Sin contenido";
                    const tipoItem = getTipoItem(comentario);
                    const esTarea = tipoItem === "tarea";
                    const esComentario = tipoItem === "comentario";
                    // Estado de la tarea: usar task.status (dentro del objeto task)
                    const estadoTarea = comentario.task?.status || comentario.status || null;
                    const logId = getLogId(comentario);
                    const tareaId = getTareaId(comentario);

                    // 🔍 DEBUG: Ver campos del comentario al renderizar
                    if (esTarea) {
                      console.log(`=== RENDERIZANDO TAREA ${index + 1} ===`);
                      console.log("Comentario completo:", comentario);
                      console.log("Campos del comentario:", Object.keys(comentario));
                      console.log("comentario.status:", comentario.status);
                      console.log("comentario.estado:", comentario.estado);
                      console.log("comentario.task:", comentario.task);
                      console.log("comentario.task?.status:", comentario.task?.status);
                      console.log("estadoTarea (usado):", estadoTarea);
                      console.log("comentario.tipo:", comentario.tipo);
                      console.log("comentario.action_type:", comentario.action_type);
                      console.log("--- USUARIOS ---");
                      console.log("usuarioCreador:", usuarioCreador);
                      console.log("usuarioAsignado:", usuarioAsignado);
                      console.log("comentario.task?.assign_to_user:", comentario.task?.assign_to_user);
                      console.log("comentario.assign_to_user_id:", comentario.assign_to_user_id);
                      console.log("Campos de task:", comentario.task ? Object.keys(comentario.task) : "No hay task");
                    }

                    return (
                      <div
                        key={comentario.id || index}
                        className="group relative bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-all duration-200 hover:border-gray-300"
                      >
                        {/* Línea vertical decorativa - Color según tipo */}
                        <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${
                          esTarea 
                            ? "bg-slate-600" 
                            : "bg-slate-500"
                        }`}></div>
                        
                        {/* Header del comentario */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            {/* Badges: Tipo, Concepto y Estado (si es tarea) */}
                            <div className="flex items-center gap-2 mb-3 flex-wrap">
                              {/* Etiqueta de tipo (Comentario/Tarea) */}
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                                esTarea
                                  ? "bg-slate-50 text-slate-700 border-slate-200"
                                  : "bg-slate-50 text-slate-700 border-slate-200"
                              }`}>
                                <i className={`fas ${esTarea ? "fa-tasks" : "fa-comment"} text-[10px]`}></i>
                                {esTarea ? "Tarea" : "Comentario"}
                              </span>
                              {/* Badge de estado (solo para tareas) */}
                              {esTarea && estadoTarea && (
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                                  estadoTarea === "completed" 
                                    ? "bg-gray-100 text-gray-700 border-gray-300"
                                    : estadoTarea === "pending"
                                    ? "bg-gray-50 text-gray-600 border-gray-200"
                                    : estadoTarea === "in_progress"
                                    ? "bg-slate-50 text-slate-700 border-slate-200"
                                    : "bg-gray-100 text-gray-700 border-gray-200"
                                }`}>
                                  <i className={`fas ${
                                    estadoTarea === "completed" ? "fa-check-circle" :
                                    estadoTarea === "pending" ? "fa-clock" :
                                    estadoTarea === "in_progress" ? "fa-spinner" :
                                    "fa-info-circle"
                                  } text-[10px]`}></i>
                                  {estadoTarea === "completed" ? "Completada" : 
                                   estadoTarea === "pending" ? "Pendiente" : 
                                   estadoTarea === "in_progress" ? "En progreso" : estadoTarea}
                                </span>
                              )}
                              {/* Badge de concepto */}
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-50 text-gray-700 rounded-full text-xs font-medium border border-gray-200">
                                <i className="fas fa-tag text-[10px]"></i>
                                {concepto}
                              </span>
                              {/* IDs: Log/Bitácora y Tarea (si aplica) */}
                              {logId && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-mono border border-gray-200" title="ID Bitácora">
                                  <i className="fas fa-hashtag text-[10px]"></i>
                                  Log #{logId}
                                </span>
                              )}
                              {esTarea && tareaId && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-mono border border-slate-200" title="ID Tarea">
                                  <i className="fas fa-tasks text-[10px]"></i>
                                  Tarea #{tareaId}
                                </span>
                              )}
                            </div>
                            
                            {/* Información de usuarios y cliente */}
                            <div className="space-y-2">
                              {/* Usuario creador */}
                              <div className="flex items-center gap-2 text-sm text-gray-700">
                                <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
                                  <i className="fas fa-user-plus text-gray-500 text-xs"></i>
                                </div>
                                <span className="text-gray-500 font-medium">Creado por:</span>
                                <span className="font-semibold text-gray-800">{usuarioCreador}</span>
                              </div>
                              
                              {/* Cliente */}
                              {clienteNombre && clienteNombre !== "Cliente" && (
                                <div className="flex items-center gap-2 text-sm text-gray-700">
                                  <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
                                    <i className="fas fa-user-circle text-gray-500 text-xs"></i>
                                  </div>
                                  <span className="text-gray-500 font-medium">Cliente:</span>
                                  <span className="font-semibold text-gray-800">{clienteNombre}</span>
                                </div>
                              )}
                              
                              {/* Usuario asignado (solo para tareas) */}
                              {esTarea && usuarioAsignado && (
                                <div className="flex items-center gap-2 text-sm text-gray-700">
                                  <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
                                    <i className="fas fa-user-check text-gray-500 text-xs"></i>
                                  </div>
                                  <span className="text-gray-500 font-medium">Asignado a:</span>
                                  <span className="font-semibold text-gray-800">{usuarioAsignado}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Fecha */}
                          <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 px-3 py-1.5 rounded-full">
                            <i className="fas fa-clock text-[10px]"></i>
                            <span className="font-medium">{formatFecha(fecha)}</span>
                          </div>
                        </div>
                        
                        {/* Contenido del comentario/tarea */}
                        <div className="pl-2">
                          <div 
                            className="text-gray-700 leading-relaxed"
                            style={{
                              fontSize: '16px',
                              lineHeight: '1.6',
                              wordBreak: 'break-word'
                            }}
                            dangerouslySetInnerHTML={{ __html: nota || 'Sin contenido' }}
                          />
                        </div>

                        {/* Archivos adjuntos - Expandible */}
                        {(() => {
                          const logId = comentario.id || comentario.log?.id;
                          if (!logId) return null;

                          const adjuntosLog = adjuntos[logId] || [];
                          const estaCargandoAdjuntos = loadingAdjuntos[logId];
                          const estaExpandido = archivosExpandidos[logId];

                          // Si está cargando, mostrar spinner
                          if (estaCargandoAdjuntos) {
                            return (
                              <div className="mt-3 pl-2">
                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                  <Spinner animation="border" variant="primary" style={{ width: "0.75rem", height: "0.75rem" }} />
                                  <span>Cargando archivos...</span>
                                </div>
                              </div>
                            );
                          }

                          // Si no hay adjuntos, no mostrar nada
                          if (adjuntosLog.length === 0) return null;

                          // Contar tipos de archivos
                          const imagenesCount = adjuntosLog.filter(esImagen).length;
                          const pdfsCount = adjuntosLog.filter(esPDF).length;
                          const wordsCount = adjuntosLog.filter(esWord).length;
                          const otrosCount = adjuntosLog.length - imagenesCount - pdfsCount - wordsCount;

                          return (
                            <div className="mt-4 pl-2">
                              {/* Botón para expandir/colapsar archivos */}
                              <button
                                type="button"
                                onClick={() => {
                                  setArchivosExpandidos((prev) => ({
                                    ...prev,
                                    [logId]: !prev[logId],
                                  }));
                                }}
                                className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors duration-200 border border-gray-200 mb-3"
                              >
                                <div className="flex items-center gap-2">
                                  <i className="fas fa-paperclip text-gray-500"></i>
                                  <span className="font-semibold text-gray-700">
                                    Archivos adjuntos
                                  </span>
                                  <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                                    {adjuntosLog.length} {adjuntosLog.length === 1 ? "archivo" : "archivos"}
                                  </span>
                                  {/* Mostrar resumen de tipos de archivos */}
                                  <div className="flex items-center gap-2 ml-2">
                                    {imagenesCount > 0 && (
                                      <span className="text-xs text-gray-500">
                                        <i className="fas fa-image text-gray-500"></i> {imagenesCount}
                                      </span>
                                    )}
                                    {pdfsCount > 0 && (
                                      <span className="text-xs text-gray-500">
                                        <i className="fas fa-file-pdf text-gray-500"></i> {pdfsCount}
                                      </span>
                                    )}
                                    {wordsCount > 0 && (
                                      <span className="text-xs text-gray-500">
                                        <i className="fas fa-file-word text-gray-500"></i> {wordsCount}
                                      </span>
                                    )}
                                    {otrosCount > 0 && (
                                      <span className="text-xs text-gray-500">
                                        <i className="fas fa-file text-gray-500"></i> {otrosCount}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <i className={`fas ${estaExpandido ? "fa-chevron-up" : "fa-chevron-down"} text-gray-400`}></i>
                              </button>

                              {/* Mostrar archivos cuando está expandido */}
                              {estaExpandido && (
                                <div className="flex flex-wrap gap-3">
                                  {adjuntosLog.map((adjunto) => {
                                    const esImg = esImagen(adjunto);
                                    const esPdf = esPDF(adjunto);
                                    const esDoc = esWord(adjunto);

                                    return (
                                      <div
                                        key={adjunto.id}
                                        className="relative group border border-gray-200 rounded-lg overflow-hidden bg-white hover:border-slate-400 transition-all"
                                        style={{ width: "150px", height: "150px" }}
                                      >
                                        {/* Contenido del archivo - Click para previsualizar */}
                                        <div
                                          className="w-full h-full cursor-pointer"
                                          onClick={() => abrirPreview(adjunto)}
                                          title="Haz clic para previsualizar"
                                        >
                                          {esImg ? (
                                            <>
                                              <img
                                                src={adjunto.url}
                                                alt={adjunto.nombre_original || "Imagen adjunta"}
                                                className="w-full h-full object-cover"
                                              />
                                              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center">
                                                <i className="fas fa-eye text-white opacity-0 group-hover:opacity-100 transition-opacity"></i>
                                              </div>
                                            </>
                                          ) : esPdf ? (
                                            <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50">
                                              <i className="fas fa-file-pdf text-5xl text-gray-600 mb-2"></i>
                                              <span className="text-xs text-gray-600 text-center px-2 truncate w-full">
                                                {adjunto.nombre_original || "Documento PDF"}
                                              </span>
                                            </div>
                                          ) : esDoc ? (
                                            <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50">
                                              <i className="fas fa-file-word text-5xl text-gray-600 mb-2"></i>
                                              <span className="text-xs text-gray-600 text-center px-2 truncate w-full">
                                                {adjunto.nombre_original || "Documento Word"}
                                              </span>
                                            </div>
                                          ) : (
                                            <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50">
                                              <i className="fas fa-file text-5xl text-gray-600 mb-2"></i>
                                              <span className="text-xs text-gray-600 text-center px-2 truncate w-full">
                                                {adjunto.nombre_original || "Archivo"}
                                              </span>
                                            </div>
                                          )}
                                          {adjunto.nombre_original && (esImg || esPdf || esDoc) && (
                                            <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-75 text-white text-xs p-1 truncate">
                                              {adjunto.nombre_original}
                                            </div>
                                          )}
                                        </div>

                                        {/* Botón de descarga - Solo visible en hover */}
                                        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              descargarArchivo(adjunto);
                                            }}
                                            className="bg-slate-600 hover:bg-slate-700 text-white rounded-full p-1.5 shadow-lg"
                                            title="Descargar archivo"
                                          >
                                            <i className="fas fa-download text-xs"></i>
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* Información adicional para tareas */}
                        {esTarea && (
                          <>
                            <div className="mt-4 pt-4 border-t border-gray-200">
                              <div className="flex flex-wrap gap-4 text-sm">
                                {comentario.scheduled_date && (
                                  <div className="flex items-center gap-2 text-gray-600">
                                    <i className="fas fa-calendar-check text-gray-400"></i>
                                    <span className="font-medium">Programada:</span>
                                    <span>{formatDateForDisplay(comentario.scheduled_date)}</span>
                                  </div>
                                )}
                                {comentario.due_date && (
                                  <div className="flex items-center gap-2 text-gray-600">
                                    <i className={`fas fa-calendar-times ${new Date(comentario.due_date) < new Date() && comentario.task?.status !== "completed" ? "text-red-600" : "text-gray-400"}`}></i>
                                    <span className="font-medium">Vence:</span>
                                    <span className={new Date(comentario.due_date) < new Date() && comentario.task?.status !== "completed" ? "text-red-600 font-semibold" : ""}>
                                      {formatDateForDisplay(comentario.due_date)}
                                    </span>
                                  </div>
                                )}
                                {esTarea && usuarioAsignado && (
                                  <div className="flex items-center gap-2 text-gray-600">
                                    <i className="fas fa-user-check text-gray-400"></i>
                                    <span className="font-medium">Asignada a:</span>
                                    <span>{usuarioAsignado}</span>
                                  </div>
                                )}
                                {estadoTarea && (
                                  <div className="flex items-center gap-2">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                      estadoTarea === "completed" 
                                        ? "bg-gray-100 text-gray-700"
                                        : estadoTarea === "pending"
                                        ? "bg-gray-50 text-gray-600"
                                        : estadoTarea === "in_progress"
                                        ? "bg-slate-50 text-slate-700"
                                        : "bg-gray-100 text-gray-700"
                                    }`}>
                                      {estadoTarea === "completed" ? "Completada" : 
                                       estadoTarea === "pending" ? "Pendiente" : 
                                       estadoTarea === "in_progress" ? "En progreso" : estadoTarea}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Sección de comentarios de la tarea */}
                            {(() => {
                              const tareaId = getTareaId(comentario);
                              if (!tareaId) return null;

                              const comentariosTarea = comentariosTareas[tareaId] || [];
                              const estaExpandida = tareasExpandidas[tareaId];
                              const estaCargando = loadingComentariosTareas[tareaId];

                              return (
                                <div className="mt-4 pt-4 border-t border-gray-200">
                                  <button
                                    type="button"
                                    onClick={() => toggleComentariosTarea(tareaId)}
                                    className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors duration-200 border border-gray-200"
                                  >
                                    <div className="flex items-center gap-2">
                                      <i className="fas fa-comments text-gray-500"></i>
                                      <span className="font-semibold text-gray-700">
                                        Comentarios de la tarea
                                      </span>
                                      {comentariosTarea.length > 0 && (
                                        <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                                          {comentariosTarea.length}
                                        </span>
                                      )}
                                    </div>
                                    <i className={`fas ${estaExpandida ? "fa-chevron-up" : "fa-chevron-down"} text-gray-400`}></i>
                                    {estaCargando && (
                                      <Spinner animation="border" variant="primary" style={{ width: "1rem", height: "1rem" }} />
                                    )}
                                  </button>

                                  {estaExpandida && (
                                    <div className="mt-3 space-y-3">
                                      {estaCargando ? (
                                        <div className="flex items-center justify-center py-4">
                                          <Spinner animation="border" variant="primary" style={{ width: "1rem", height: "1rem" }} />
                                          <span className="ml-2 text-sm text-gray-500">Cargando comentarios...</span>
                                        </div>
                                      ) : comentariosTarea.length > 0 ? (
                                        comentariosTarea.map((comentarioTarea) => (
                                          <div
                                            key={comentarioTarea.id}
                                            className="bg-gray-50 border-l-4 border-slate-400 rounded-r-lg p-4 shadow-sm"
                                          >
                                            <div className="flex items-start justify-between mb-2">
                                              <div className="flex items-center gap-2 flex-wrap">
                                                <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                                                  <i className="fas fa-user text-gray-500 text-xs"></i>
                                                </div>
                                                <span className="font-medium text-gray-700 text-sm">
                                                  {comentarioTarea.user?.name || comentarioTarea.user || "Usuario"}
                                                </span>
                                                {comentarioTarea.id && (
                                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-200 text-gray-600 rounded text-xs font-mono" title="ID Comentario">
                                                    <i className="fas fa-hashtag text-[10px]"></i>
                                                    #{comentarioTarea.id}
                                                  </span>
                                                )}
                                              </div>
                                              <span className="text-xs text-gray-500">
                                                {formatFecha(comentarioTarea.created_at || comentarioTarea.fecha)}
                                              </span>
                                            </div>
                                            <div 
                                              className="text-gray-700 text-sm mt-2 m-0"
                                              style={{
                                                fontSize: '14px',
                                                lineHeight: '1.5',
                                                wordBreak: 'break-word'
                                              }}
                                              dangerouslySetInnerHTML={{ 
                                                __html: comentarioTarea.comment || comentarioTarea.response_note || comentarioTarea.note || "Sin contenido" 
                                              }}
                                            />
                                          </div>
                                        ))
                                      ) : (
                                        <div className="text-center py-4 text-gray-500 text-sm">
                                          <i className="fas fa-comment-slash text-gray-400 mb-2"></i>
                                          <p className="m-0">No hay comentarios para esta tarea aún.</p>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal para agregar comentario */}
      <NuevoComentarioModal
        show={showModal}
        onHide={() => setShowModal(false)}
        onCreated={handleComentarioCreado}
        grupoFamiliarId={grupoFamiliarId}
        clienteId={toValidId(clienteId)}
      />

      {/* Modal para agregar tarea */}
      <NuevaTareaModal
        show={showTareaModal}
        onHide={() => setShowTareaModal(false)}
        onCreated={handleTareaCreada}
        grupoFamiliarId={grupoFamiliarId}
        clienteId={toValidId(clienteId)}
      />

      {/* Modal de previsualización de archivos */}
      <Modal
        show={showPreviewModal}
        onHide={() => setShowPreviewModal(false)}
        size="xl"
        centered
        fullscreen="lg-down"
      >
        <Modal.Header closeButton>
          <Modal.Title className="d-flex align-items-center gap-2">
            <i className={`fas ${
              archivoPreview?.tipo === "imagen" ? "fa-image" :
              archivoPreview?.tipo === "pdf" ? "fa-file-pdf" :
              archivoPreview?.tipo === "word" ? "fa-file-word" :
              "fa-file"
            }`}></i>
            <span>{archivoPreview?.adjunto?.nombre_original || "Vista previa"}</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-0" style={{ minHeight: "400px", maxHeight: "80vh" }}>
          {archivoPreview?.tipo === "imagen" && (
            <div className="d-flex align-items-center justify-content-center bg-dark" style={{ minHeight: "400px", position: "relative" }}>
              {errorCargaArchivo ? (
                <div className="text-center text-white p-5">
                  <i className="fas fa-exclamation-triangle mb-3" style={{ fontSize: "3rem" }}></i>
                  <h5>No se pudo cargar la imagen</h5>
                  <p className="text-white-50">La imagen puede requerir autenticación o no estar disponible.</p>
                  <Button
                    variant="light"
                    className="mt-3"
                    onClick={() => {
                      const link = document.createElement("a");
                      link.href = archivoPreview.adjunto.url;
                      link.target = "_blank";
                      link.rel = "noopener noreferrer";
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                  >
                    <i className="fas fa-external-link-alt me-2"></i>
                    Abrir en nueva pestaña
                  </Button>
                </div>
              ) : (
                <img
                  src={archivoPreview.adjunto.url}
                  alt={archivoPreview.adjunto.nombre_original || "Imagen"}
                  className="img-fluid"
                  style={{ maxHeight: "80vh", maxWidth: "100%", objectFit: "contain" }}
                  onError={() => {
                    console.error("Error al cargar imagen");
                    setErrorCargaArchivo(true);
                  }}
                />
              )}
            </div>
          )}
          {archivoPreview?.tipo === "pdf" && (
            <div style={{ height: "80vh", width: "100%" }}>
              {errorCargaArchivo ? (
                <div className="d-flex flex-column align-items-center justify-content-center p-5" style={{ minHeight: "400px" }}>
                  <i className="fas fa-file-pdf text-danger" style={{ fontSize: "5rem" }}></i>
                  <h5 className="mt-3 mb-2">No se puede previsualizar el PDF</h5>
                  <p className="text-muted">El PDF puede requerir autenticación o no estar disponible para previsualización.</p>
                  <p className="text-muted small">Por favor, descárgalo o ábrelo en una nueva pestaña para verlo.</p>
                </div>
              ) : (
                <iframe
                  src={`${archivoPreview.adjunto.url}#toolbar=0`}
                  title={archivoPreview.adjunto.nombre_original || "PDF"}
                  style={{
                    width: "100%",
                    height: "100%",
                    border: "none"
                  }}
                  onError={() => {
                    console.error("Error al cargar PDF en iframe");
                    setErrorCargaArchivo(true);
                  }}
                />
              )}
            </div>
          )}
          {(archivoPreview?.tipo === "word" || archivoPreview?.tipo === "otro") && (
            <div className="d-flex flex-column align-items-center justify-content-center p-5" style={{ minHeight: "400px" }}>
              <div className="text-center mb-4">
                {archivoPreview?.tipo === "word" ? (
                  <i className="fas fa-file-word text-primary" style={{ fontSize: "5rem" }}></i>
                ) : (
                  <i className="fas fa-file text-secondary" style={{ fontSize: "5rem" }}></i>
                )}
                <h5 className="mt-3 mb-2">
                  {archivoPreview?.adjunto?.nombre_original || "Archivo"}
                </h5>
                <p className="text-muted">
                  {archivoPreview?.tipo === "word" 
                    ? "Los archivos Word no se pueden previsualizar directamente en el navegador."
                    : "Este tipo de archivo no se puede previsualizar directamente."}
                </p>
                <p className="text-muted small">
                  Puedes descargarlo para ver su contenido.
                </p>
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowPreviewModal(false)}>
            Cerrar
          </Button>
          {archivoPreview?.adjunto && (
            <Button
              variant="primary"
              onClick={() => {
                descargarArchivo(archivoPreview.adjunto);
              }}
            >
              <i className="fas fa-download me-2"></i>
              Descargar
            </Button>
          )}
          {archivoPreview?.adjunto && (
            <Button
              variant="outline-primary"
              onClick={() => {
                // Abrir sin forzar descarga - usar window.open directamente
                // Si el servidor envía headers de descarga, el navegador los respetará
                // pero al menos intentará abrirlo primero
                window.open(archivoPreview.adjunto.url, "_blank", "noopener,noreferrer");
              }}
            >
              <i className="fas fa-external-link-alt me-2"></i>
              Abrir en nueva pestaña
            </Button>
          )}
        </Modal.Footer>
      </Modal>
    </>
  );
}
