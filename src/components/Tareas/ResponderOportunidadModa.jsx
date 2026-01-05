import React, { useState, useEffect, useRef } from "react";
import {
  Modal,
  Button,
  Form,
  Spinner,
  ListGroup,
  Row,
  Col,
  Badge,
} from "react-bootstrap";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import apiRequest from "../../services/api";

// Constantes para subir archivos
const RAW = import.meta.env.VITE_API_BASE_URL || "";
const API_BASE_URL = RAW.replace(/\/+$/, "") || "/api";
const getAuthToken = () => localStorage.getItem("auth_token");

// Configuración de módulos para ReactQuill
const quillModules = {
  toolbar: [
    [{ 'header': [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'color': [] }, { 'background': [] }],
    [{ 'font': [] }],
    [{ 'size': ['small', false, 'large', 'huge'] }],
    [{ 'script': 'sub'}, { 'script': 'super' }],
    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
    [{ 'align': [] }],
    ['blockquote', 'code-block'],
    ['link'],
    ['clean']
  ],
};

const quillFormats = [
  'header', 'font', 'size',
  'bold', 'italic', 'underline', 'strike',
  'color', 'background',
  'script',
  'list', 'bullet',
  'align',
  'blockquote', 'code-block',
  'link'
];

// Función para limpiar HTML y verificar si está vacío
const isNoteEmpty = (html) => {
  if (!html) return true;
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  const text = tempDiv.textContent || tempDiv.innerText || '';
  return text.trim().length === 0;
};

const ResponderOportunidadModal = ({ show, onHide, tarea, onUpdated }) => {
  const [responseNote, setResponseNote] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Estados para edición de comentarios
  const [comentariosEnEdicion, setComentariosEnEdicion] = useState({});
  const [comentariosHistorialEnEdicion, setComentariosHistorialEnEdicion] = useState({});
  const [comentariosActualizados, setComentariosActualizados] = useState({});
  const [comentariosHistorialActualizados, setComentariosHistorialActualizados] = useState({});

  // Historial del cliente
  const [historial, setHistorial] = useState([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);

  // Fechas de seguimiento
  const [scheduledDate, setScheduledDate] = useState(tarea?.scheduled_date || "");
  const [dueDate, setDueDate] = useState(tarea?.due_date || "");

  // ✅ Nuevos estados para manejo de archivos
  const [archivos, setArchivos] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [subiendoArchivos, setSubiendoArchivos] = useState(false);
  const quillEditorRef = useRef(null);

  // Estados para reconocimiento de voz
  const [grabando, setGrabando] = useState(false);
  const [reconocimientoDisponible, setReconocimientoDisponible] = useState(false);
  const [reconocimientoVoz, setReconocimientoVoz] = useState(null);
  const grabandoRef = useRef(false);

  // Sincronizar ref con estado
  useEffect(() => {
    grabandoRef.current = grabando;
  }, [grabando]);
  
  // ✅ Estados para adjuntos de comentarios
  const [adjuntosComentarios, setAdjuntosComentarios] = useState({}); // { comentarioId: [adjuntos] }
  const [loadingAdjuntos, setLoadingAdjuntos] = useState({}); // { comentarioId: boolean }
  const [archivoPreview, setArchivoPreview] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [errorCargaArchivo, setErrorCargaArchivo] = useState(false);

  // Comentarios de esta tarea desde el historial
  const comentariosDeEstaTarea = historial
    .filter(h => h.tipo === 'tarea' && h.id === tarea?.id)
    .flatMap(h => h.comentarios || []);

  // ✅ Funciones helper para archivos
  const validarArchivo = (file) => {
    const tiposPermitidos = [
      "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ];
    const extensionesPermitidas = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf", ".doc", ".docx"];
    const maxSize = 10 * 1024 * 1024; // 10MB

    const tieneTipoValido = tiposPermitidos.includes(file.type);
    const tieneExtensionValida = extensionesPermitidas.some(ext => 
      file.name.toLowerCase().endsWith(ext)
    );

    if (!tieneTipoValido && !tieneExtensionValida) {
      alert("⚠️ Solo se permiten archivos de imagen (JPG, PNG, GIF, WEBP), PDF y Word (DOC, DOCX)");
      return false;
    }

    if (file.size > maxSize) {
      alert("⚠️ El archivo es demasiado grande. El tamaño máximo es 10MB");
      return false;
    }

    return true;
  };

  const esImagen = (file) => {
    return file.type?.startsWith("image/") || 
           /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name);
  };

  const agregarArchivos = (files) => {
    const archivosArray = Array.from(files);
    const archivosValidos = archivosArray.filter(validarArchivo);
    
    if (archivosValidos.length !== archivosArray.length) {
      return;
    }

    const nuevosArchivos = archivosValidos.map((file) => {
      const esImg = esImagen(file);
      return {
        file,
        id: Date.now() + Math.random(),
        preview: esImg ? URL.createObjectURL(file) : null,
        nombre: file.name,
        tipo: esImg ? "imagen" : file.type?.includes("pdf") ? "pdf" : "word",
      };
    });

    setArchivos((prev) => [...prev, ...nuevosArchivos]);
  };

  const eliminarArchivo = (id) => {
    setArchivos((prev) => {
      const archivo = prev.find((arch) => arch.id === id);
      if (archivo && archivo.preview) {
        URL.revokeObjectURL(archivo.preview);
      }
      return prev.filter((arch) => arch.id !== id);
    });
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      agregarArchivos(e.target.files);
    }
    e.target.value = ""; // Reset input
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      agregarArchivos(e.dataTransfer.files);
    }
  };

  // ✅ Función para subir archivos a bitácora
  const subirArchivosBitacora = async (bitacoraId) => {
    if (archivos.length === 0) {
      console.warn("⚠️ No hay archivos para subir");
      return;
    }

    if (!bitacoraId) {
      console.error("❌ No se proporcionó bitacoraId para subir archivos");
      throw new Error("No se pudo obtener el ID de la bitácora para subir los archivos");
    }

    const token = getAuthToken();
    if (!token) {
      alert("Token no encontrado. Por favor inicia sesión.");
      throw new Error("Token no encontrado");
    }

    console.log(`📤 Subiendo ${archivos.length} archivo(s) a bitácora ID: ${bitacoraId}`);
    
    // Construir URL correctamente
    const endpoint = `/adjuntos/bitacora/${bitacoraId}`;
    const url = `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
    console.log(`📡 URL completa: ${url}`);
    console.log(`📡 API_BASE_URL: ${API_BASE_URL}`);

    setSubiendoArchivos(true);
    try {
      const uploadPromises = archivos.map(async (archivo, index) => {
        console.log(`📎 Subiendo archivo ${index + 1}/${archivos.length}: ${archivo.nombre}`);
        
        const formData = new FormData();
        // Usar "archivo" como nombre del campo (según el patrón del proyecto)
        formData.append("archivo", archivo.file);

        console.log(`📦 FormData creado, tamaño: ${archivo.file.size} bytes, tipo: ${archivo.file.type}`);

        const response = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            // NO incluir Content-Type, el navegador lo establece automáticamente con el boundary
          },
          body: formData,
        });

        console.log(`📥 Respuesta recibida para ${archivo.nombre}:`, {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMessage = errorData.message || errorData.error || `Error ${response.status}: ${response.statusText}`;
          console.error(`❌ Error al subir ${archivo.nombre}:`, errorMessage, errorData);
          throw new Error(`Error al subir ${archivo.nombre}: ${errorMessage}`);
        }

        const result = await response.json();
        console.log(`✅ Archivo ${archivo.nombre} subido exitosamente:`, result);
        return result;
      });

      const results = await Promise.all(uploadPromises);
      console.log("✅ Todos los archivos subidos exitosamente a bitácora:", results);
      return results;
    } catch (err) {
      console.error("❌ Error al subir archivos a bitácora:", err);
      throw err;
    } finally {
      setSubiendoArchivos(false);
    }
  };

  // ✅ Función para cargar adjuntos de un comentario
  // Ahora usa el comentarioId directamente si el comentario tiene adjuntos en su estructura
  const cargarAdjuntosComentario = async (comentarioId, comentarioData = null) => {
    if (!comentarioId || adjuntosComentarios[comentarioId]) return;

    // Evitar cargar si ya se está cargando
    if (loadingAdjuntos[comentarioId]) return;

    setLoadingAdjuntos((prev) => ({ ...prev, [comentarioId]: true }));

    try {
      let data = [];
      
      // Primero verificar si el comentario ya tiene adjuntos en su estructura
      if (comentarioData?.adjuntos && Array.isArray(comentarioData.adjuntos)) {
        data = comentarioData.adjuntos;
        console.log(`✅ Adjuntos encontrados en estructura del comentario ${comentarioId}:`, data.length);
      } else {
        // Si no, intentar cargar desde endpoint específico del comentario
        try {
          const response = await apiRequest(`tareas_operativas/comentarios/${comentarioId}/adjuntos`, "GET");
          data = Array.isArray(response) ? response : response?.data || response?.adjuntos || [];
          console.log(`✅ Adjuntos cargados desde endpoint para comentario ${comentarioId}:`, data.length);
        } catch (endpointErr) {
          // Si no existe el endpoint, dejar vacío (no mostrar adjuntos de otros comentarios)
          console.log(`ℹ️ No se encontraron adjuntos específicos para el comentario ${comentarioId}`);
          data = [];
        }
      }

      setAdjuntosComentarios((prev) => ({
        ...prev,
        [comentarioId]: data,
      }));
    } catch (err) {
      // No mostrar error si es "Too Many Attempts" - solo loguear
      if (err.message?.includes("Too Many Attempts")) {
        console.warn(`⚠️ Rate limit alcanzado al cargar adjuntos del comentario ${comentarioId}`);
      } else {
        console.error(`Error al cargar adjuntos del comentario ${comentarioId}:`, err);
      }
      setAdjuntosComentarios((prev) => ({
        ...prev,
        [comentarioId]: [],
      }));
    } finally {
      setLoadingAdjuntos((prev) => ({ ...prev, [comentarioId]: false }));
    }
  };

  // ✅ Funciones helper para adjuntos
  const esImagenAdjunto = (adj) => {
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

  const abrirPreview = (adjunto) => {
    const esImg = esImagenAdjunto(adjunto);
    const esPdf = esPDF(adjunto);
    const esDoc = esWord(adjunto);
    
    setArchivoPreview({
      adjunto,
      tipo: esImg ? "imagen" : esPdf ? "pdf" : esDoc ? "word" : "otro"
    });
    setErrorCargaArchivo(false);
    setShowPreviewModal(true);
  };

  useEffect(() => {
    if (show && tarea?.id) {
      // Log para depuración
      console.log('🔍 Tarea completa recibida:', tarea);
      console.log('📋 Estructura completa de la tarea (JSON):', JSON.stringify(tarea, null, 2));
      console.log('📋 Concepto:', tarea?.log?.titulo || tarea?.concepto);
      console.log('📝 Nota:', tarea?.log?.nota || tarea?.nota);
      console.log('👤 Asignado por (responsable):', tarea?.log?.responsable);
      console.log('👤 Asignado por (creado_por):', tarea?.creado_por);
      console.log('👤 Asignado a (asignado_a):', tarea?.asignado_a);
      console.log('📅 Fecha programada:', tarea?.scheduled_date);
      console.log('⏰ Fecha vencimiento:', tarea?.due_date);
      console.log('🔑 Posibles logIds:', {
        'tarea?.id': tarea?.id,
        'tarea?.log?.id': tarea?.log?.id,
        'tarea?.log_id': tarea?.log_id,
        'tarea?.bitacora_id': tarea?.bitacora_id,
        'tarea?.log?.bitacora_id': tarea?.log?.bitacora_id
      });

      // Cargar historial del cliente
      if (tarea.log?.cliente?.id) {
        setLoadingHistorial(true);
        apiRequest(`cliente/${tarea.log.cliente.id}/historial`, "GET")
          .then((data) => {
            const historialData = Array.isArray(data.data) ? data.data : [];
            
            // Deduplicar historial y sus comentarios, asegurar IDs
            const historialUnico = historialData.map(h => {
              if (h.comentarios && h.comentarios.length > 0) {
                const comentariosUnicos = h.comentarios.filter((comentario, index, arr) => {
                  if (!comentario.id) {
                    console.warn("⚠️ Comentario de historial sin ID:", comentario);
                    return false;
                  }
                  return arr.findIndex(c => c.id === comentario.id) === index;
                });
                return { ...h, comentarios: comentariosUnicos };
              }
              return h;
            });
            
            console.log('📜 Historial procesado:', historialUnico.length);
            setHistorial(historialUnico);

            // ✅ Cargar adjuntos de cada comentario usando los datos del comentario directamente
            historialUnico.forEach((h, index) => {
              setTimeout(() => {
                if (h.comentarios && h.comentarios.length > 0) {
                  h.comentarios.forEach((c) => {
                    if (c.id) {
                      // Pasar el objeto del comentario completo para verificar si tiene adjuntos
                      cargarAdjuntosComentario(c.id, c);
                    }
                  });
                }
              }, index * 200); // Espaciar las peticiones 200ms entre cada una para evitar rate limiting
            });
          })
          .catch(error => {
            // Manejar específicamente el error "Too Many Attempts"
            if (error.message?.includes("Too Many Attempts")) {
              console.warn("⚠️ Rate limit alcanzado al cargar historial. Intente más tarde.");
              // No mostrar error al usuario, solo mantener el historial vacío
            } else {
              console.error("❌ Error al cargar historial:", error);
            }
            setHistorial([]);
          })
          .finally(() => setLoadingHistorial(false));
      }
    }

    // Resetear fechas cuando cambia la tarea
    if (tarea) {
      setScheduledDate(tarea?.scheduled_date || "");
      setDueDate(tarea?.due_date || "");
    }

    // Limpiar estados de edición al cambiar de tarea
    setComentariosEnEdicion({});
    setComentariosHistorialEnEdicion({});
    setResponseNote("");

    // ✅ Limpiar archivos al cerrar o cambiar tarea
    if (!show) {
      archivos.forEach((arch) => {
        if (arch.preview) {
          URL.revokeObjectURL(arch.preview);
        }
      });
      setArchivos([]);
    }
  }, [show, tarea]);

  const handleAgregarComentario = async () => {
    if (isNoteEmpty(responseNote) && archivos.length === 0) {
      alert("Por favor, escribe un comentario o adjunta al menos un archivo.");
      return;
    }
    
    setLoading(true);
    try {
      console.log("📤 Creando comentario...", {
        tareaId: tarea.id,
        comment: responseNote || " ",
        archivosCount: archivos.length
      });

      const data = await apiRequest(
        `tareas_operativas/${tarea.id}/comentarios`,
        "POST",
        { comment: responseNote || " " }
      );

      console.log("✅ Respuesta del comentario:", data);

      // ✅ Si el comentario tiene adjuntos en la respuesta, guardarlos directamente
      if (data?.comment?.id && data?.comment?.adjuntos) {
        setAdjuntosComentarios((prev) => ({
          ...prev,
          [data.comment.id]: Array.isArray(data.comment.adjuntos) ? data.comment.adjuntos : [],
        }));
        console.log(`✅ Adjuntos guardados para comentario ${data.comment.id}:`, data.comment.adjuntos);
      }

      // ✅ Obtener el log_id para subir archivos
      // El log_id puede venir en diferentes lugares de la respuesta
      let logId = data?.log_id || 
                  data?.log?.id || 
                  data?.bitacora_id ||
                  data?.data?.log_id ||
                  data?.data?.log?.id;

      // Si no viene en la respuesta, intentar obtenerlo de la tarea
      if (!logId) {
        // Intentar desde diferentes ubicaciones en el objeto tarea
        logId = tarea?.log?.id || 
                tarea?.log_id ||
                tarea?.id || // A veces el id de la tarea es el log_id
                tarea?.bitacora_id;
        
        console.log("🔍 Intentando obtener logId de la tarea:", {
          "tarea?.log?.id": tarea?.log?.id,
          "tarea?.log_id": tarea?.log_id,
          "tarea?.id": tarea?.id,
          "tarea?.bitacora_id": tarea?.bitacora_id
        });
      }

      // Si aún no tenemos logId, buscar en el historial YA CARGADO (evitar petición extra)
      if (!logId && historial.length > 0) {
        console.log("🔍 Buscando logId en el historial ya cargado...");
        // Buscar la entrada del historial que corresponde a esta tarea
        const entradaTarea = historial.find(h => 
          h.tipo === 'tarea' && (h.id === tarea.id || h.tarea_id === tarea.id)
        );
        
        if (entradaTarea) {
          logId = entradaTarea.id || entradaTarea.log_id;
          console.log("✅ logId obtenido del historial cargado:", logId);
        }
      }

      console.log("🔍 logId final obtenido:", logId, {
        "data?.log_id": data?.log_id,
        "data?.log?.id": data?.log?.id,
        "data?.bitacora_id": data?.bitacora_id,
        "tarea?.log?.id": tarea?.log?.id,
        "tarea?.id": tarea?.id
      });

      // ✅ Subir archivos si hay alguno
      if (archivos.length > 0) {
        if (!logId) {
          console.error("❌ No se pudo obtener el log_id para subir archivos");
          console.error("📋 Datos completos de la respuesta:", JSON.stringify(data, null, 2));
          console.error("📋 Tarea completa:", JSON.stringify(tarea, null, 2));
          alert("⚠️ Se creó el comentario pero no se pudo obtener el ID necesario para subir los archivos.\n\nPor favor, verifique la consola para más detalles o contacte al administrador.");
        } else {
          try {
            // Esperar un momento para que el backend procese el comentario
            await new Promise(resolve => setTimeout(resolve, 500));
            
            console.log(`📤 Intentando subir ${archivos.length} archivo(s) con logId: ${logId}`);
            await subirArchivosBitacora(logId);
            console.log("✅ Archivos subidos exitosamente");
          } catch (err) {
            console.error("❌ Error al subir archivos:", err);
            alert(`⚠️ Se creó el comentario pero hubo un error al subir algunos archivos:\n${err.message || err}`);
          }
        }
      }

      const tareaActualizada = {
        ...tarea,
        status: tarea.status === "pending" ? "in_progress" : tarea.status,
      };

      if (onUpdated) onUpdated(tareaActualizada);

      // ✅ Recargar historial solo si es necesario (después de un delay para evitar rate limiting)
      // Esperar un momento antes de recargar para que el backend procese todo
      setTimeout(async () => {
        try {
          const historialResponse = await apiRequest(`cliente/${tarea.log.cliente.id}/historial`, "GET");
          const historialData = Array.isArray(historialResponse.data) ? historialResponse.data : [];
          setHistorial(historialData);
          
          // ✅ Recargar adjuntos de comentarios
          historialData.forEach((h) => {
            if (h.comentarios && h.comentarios.length > 0) {
              h.comentarios.forEach((c) => {
                if (c.id) {
                  // Pasar el objeto del comentario completo para verificar si tiene adjuntos
                  cargarAdjuntosComentario(c.id, c);
                }
              });
            }
          });
        } catch (err) {
          console.error("❌ Error al recargar historial:", err);
          // No mostrar error al usuario, solo loguear
        }
      }, 1000); // Esperar 1 segundo antes de recargar
    
      // ✅ Limpiar formulario
      archivos.forEach((arch) => {
        if (arch.preview) {
          URL.revokeObjectURL(arch.preview);
        }
      });
      setArchivos([]);
      setResponseNote("");
      onHide(true);
    } catch (error) {
      console.error("❌ Error al agregar el comentario:", error);
      
      // Manejar específicamente el error "Too Many Attempts"
      if (error.message?.includes("Too Many Attempts")) {
        alert("⚠️ Demasiados intentos. Por favor, espere un momento antes de intentar nuevamente.");
      } else {
        alert(`Error al agregar el comentario: ${error.message || "Error desconocido"}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCompletar = async () => {
    setLoading(true);
    try {
      if (
        (!isNoteEmpty(responseNote) || archivos.length > 0) &&
        (comentariosDeEstaTarea.length === 0 ||
          comentariosDeEstaTarea[comentariosDeEstaTarea.length - 1]?.comment !== responseNote)
      ) {
        console.log("📤 Creando comentario antes de completar...", {
          tareaId: tarea.id,
          comment: responseNote || " ",
          archivosCount: archivos.length
        });

        const data = await apiRequest(
          `tareas_operativas/${tarea.id}/comentarios`,
          "POST",
          { comment: responseNote || " " }
        );

        console.log("✅ Respuesta del comentario:", data);

        // ✅ Obtener el log_id para subir archivos
        let logId = data?.log_id || 
                    data?.log?.id || 
                    data?.bitacora_id ||
                    data?.data?.log_id ||
                    data?.data?.log?.id;

        // Si no viene en la respuesta, intentar obtenerlo de la tarea
        if (!logId) {
          logId = tarea?.log?.id || 
                  tarea?.log_id ||
                  tarea?.id ||
                  tarea?.bitacora_id;
        }

        // Si aún no tenemos logId, buscar en el historial YA CARGADO (evitar petición extra)
        if (!logId && historial.length > 0) {
          console.log("🔍 Buscando logId en el historial ya cargado...");
          const entradaTarea = historial.find(h => 
            h.tipo === 'tarea' && (h.id === tarea.id || h.tarea_id === tarea.id)
          );
          if (entradaTarea) {
            logId = entradaTarea.id || entradaTarea.log_id;
            console.log("✅ logId obtenido del historial cargado:", logId);
          }
        }

        console.log("🔍 logId final obtenido:", logId);

        if (archivos.length > 0) {
          if (!logId) {
            console.error("❌ No se pudo obtener el log_id para subir archivos");
            console.error("📋 Datos completos de la respuesta:", JSON.stringify(data, null, 2));
            console.error("📋 Tarea completa:", JSON.stringify(tarea, null, 2));
            alert("⚠️ Se creó el comentario pero no se pudo obtener el ID necesario para subir los archivos.\n\nPor favor, verifique la consola para más detalles.");
          } else {
            try {
              // Esperar un momento para que el backend procese el comentario
              await new Promise(resolve => setTimeout(resolve, 500));
              
              console.log(`📤 Intentando subir ${archivos.length} archivo(s) con logId: ${logId}`);
              await subirArchivosBitacora(logId);
              console.log("✅ Archivos subidos exitosamente");
            } catch (err) {
              console.error("❌ Error al subir archivos:", err);
              alert(`⚠️ Se creó el comentario pero hubo un error al subir algunos archivos:\n${err.message || err}`);
            }
          }
        }
      }

      await apiRequest(`tareas_operativas/${tarea.id}/completar`, "PUT");

      const tareaActualizada = { ...tarea, status: "completed" };
      if (onUpdated) onUpdated(tareaActualizada);
      
      // ✅ Limpiar archivos
      archivos.forEach((arch) => {
        if (arch.preview) URL.revokeObjectURL(arch.preview);
      });
      setArchivos([]);
      setResponseNote("");
      
      onHide(true);
    } catch (error) {
      console.error("❌ Error al completar:", error);
      alert("❌ Error al completar la tarea");
    } finally {
      setLoading(false);
    }
  };

  const handleGuardarComentarioTarea = async (comentarioId) => {
    if (!comentarioId) {
      console.error("❌ ID de comentario requerido");
      return;
    }

    const nuevoTexto = comentariosEnEdicion[comentarioId];
    if (!nuevoTexto?.trim()) {
      console.warn("⚠️ Texto vacío");
      return;
    }

    console.log("🔄 Actualizando comentario:", { comentarioId, nuevoTexto });

    try {
      await apiRequest(
        `tareas_operativas/comentarios/${comentarioId}`,
        "PUT",
        { comment: nuevoTexto }
      );

      // Actualizar estado local - comentarios de tarea
      setHistorial((prev) =>
        prev.map((h) => ({
          ...h,
          comentarios: h.comentarios?.map((c) =>
            c.id === comentarioId ? { ...c, comment: nuevoTexto } : c
          ) || []
        }))
      );

      // Limpiar edición
      setComentariosEnEdicion((prev) => {
        const nuevo = { ...prev };
        delete nuevo[comentarioId];
        return nuevo;
      });

      // Mostrar feedback
      setComentariosActualizados((prev) => ({
        ...prev,
        [comentarioId]: true,
      }));

      setTimeout(() => {
        setComentariosActualizados((prev) => {
          const nuevo = { ...prev };
          delete nuevo[comentarioId];
          return nuevo;
        });
      }, 3000);

      console.log("✅ Comentario actualizado exitosamente");

    } catch (error) {
      console.error("❌ Error al actualizar:", error);
      alert("Error al actualizar el comentario. Por favor, intenta de nuevo.");
    }
  };

  const handleGuardarComentarioHistorial = async (comentarioId) => {
    if (!comentarioId) {
      console.error("❌ ID de comentario requerido");
      return;
    }

    const nuevoTexto = comentariosHistorialEnEdicion[comentarioId];
    if (!nuevoTexto?.trim()) {
      console.warn("⚠️ Texto vacío");
      return;
    }

    console.log("🔄 Actualizando comentario historial:", { comentarioId, nuevoTexto });

    try {
      await apiRequest(
        `tareas_operativas/comentarios/${comentarioId}`,
        "PUT",
        { comment: nuevoTexto }
      );

      // Actualizar historial
      setHistorial((prev) =>
        prev.map((h) => ({
          ...h,
          comentarios: h.comentarios?.map((c) =>
            c.id === comentarioId ? { ...c, comment: nuevoTexto } : c
          ) || []
        }))
      );

      // Limpiar edición
      setComentariosHistorialEnEdicion((prev) => {
        const nuevo = { ...prev };
        delete nuevo[comentarioId];
        return nuevo;
      });

      // Mostrar feedback
      setComentariosHistorialActualizados((prev) => ({
        ...prev,
        [comentarioId]: true,
      }));

      setTimeout(() => {
        setComentariosHistorialActualizados((prev) => {
          const nuevo = { ...prev };
          delete nuevo[comentarioId];
          return nuevo;
        });
      }, 3000);

      console.log("✅ Comentario historial actualizado exitosamente");

    } catch (error) {
      console.error("❌ Error al actualizar:", error);
      alert("Error al actualizar el comentario. Por favor, intenta de nuevo.");
    }
  };

  const handleActualizarFechas = async () => {
    if (!scheduledDate || !dueDate) {
      alert("Las fechas no pueden estar vacías.");
      return;
    }
    setLoading(true);
    try {
      await apiRequest(`tareas_operativas/${tarea.id}/reprogramar`, "PUT", {
        scheduled_date: scheduledDate,
        due_date: dueDate,
      });

      const tareaActualizada = {
        ...tarea,
        scheduled_date: scheduledDate,
        due_date: dueDate,
      };

      if (onUpdated) onUpdated(tareaActualizada);
      alert("✅ Fechas actualizadas");
    } catch (error) {
      console.error(error);
      alert("❌ Error al actualizar las fechas");
    } finally {
      setLoading(false);
    }
  };

  const formatFecha = (fecha) => {
    if (!fecha) return "N/A";
    try {
      const date = new Date(fecha);
      if (isNaN(date.getTime())) return "N/A";
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const year = date.getFullYear();
      return `${month}/${day}/${year}`;
    } catch {
      return "N/A";
    }
  };

  const getBadgeColor = (fecha) => {
    if (!fecha) return "secondary";
    const hoy = new Date();
    const date = new Date(fecha);
    const diffDias = Math.ceil((date - hoy) / (1000 * 60 * 60 * 24));
    if (diffDias < 0) return "danger";
    if (diffDias <= 3) return "warning";
    return "success";
  };

  const esCerrada = tarea?.status === "completed";

  // Extraer datos de manera más robusta
  const conceptoTarea = tarea?.log?.titulo || tarea?.log?.concept?.name || tarea?.concepto || tarea?.titulo || "Sin concepto";
  const notaTarea = tarea?.log?.nota || tarea?.log?.note || tarea?.nota || tarea?.note || "Sin nota";
  const asignadoPor = tarea?.log?.responsable || tarea?.responsable || tarea?.log?.user?.name || tarea?.creado_por || tarea?.asignado_a || "N/A";

  // ✅ Componente para mostrar adjuntos de un comentario
  const MostrarAdjuntosComentario = ({ comentarioId }) => {
    const adjuntos = adjuntosComentarios[comentarioId] || [];
    const cargando = loadingAdjuntos[comentarioId];

    if (cargando) {
      return (
        <div className="d-flex justify-content-center p-2">
          <Spinner size="sm" />
        </div>
      );
    }

    if (adjuntos.length === 0) return null;

    return (
      <div className="d-flex flex-wrap gap-2 mt-2">
        {adjuntos.map((adjunto) => {
          const esImg = esImagenAdjunto(adjunto);
          const esPdf = esPDF(adjunto);
          const esDoc = esWord(adjunto);

          return (
            <div
              key={adjunto.id}
              className="position-relative border rounded"
              style={{
                width: "100px",
                height: "100px",
                cursor: "pointer",
                overflow: "hidden",
                backgroundColor: "#f8f9fa"
              }}
              onClick={() => abrirPreview(adjunto)}
              title="Haz clic para previsualizar"
            >
              {esImg ? (
                <img
                  src={adjunto.url}
                  alt={adjunto.nombre_original || "Imagen"}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover"
                  }}
                  onError={(e) => {
                    e.target.style.display = "none";
                    e.target.parentElement.innerHTML = '<i class="fas fa-image text-muted" style="font-size: 2rem; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);"></i>';
                  }}
                />
              ) : esPdf ? (
                <div className="d-flex flex-column align-items-center justify-content-center h-100">
                  <i className="fas fa-file-pdf text-danger" style={{ fontSize: "2rem" }}></i>
                  <small className="text-muted text-center px-1" style={{ fontSize: "0.7rem" }}>
                    {adjunto.nombre_original || "PDF"}
                  </small>
                </div>
              ) : esDoc ? (
                <div className="d-flex flex-column align-items-center justify-content-center h-100">
                  <i className="fas fa-file-word text-primary" style={{ fontSize: "2rem" }}></i>
                  <small className="text-muted text-center px-1" style={{ fontSize: "0.7rem" }}>
                    {adjunto.nombre_original || "Word"}
                  </small>
                </div>
              ) : (
                <div className="d-flex flex-column align-items-center justify-content-center h-100">
                  <i className="fas fa-file text-secondary" style={{ fontSize: "2rem" }}></i>
                  <small className="text-muted text-center px-1" style={{ fontSize: "0.7rem" }}>
                    {adjunto.nombre_original || "Archivo"}
                  </small>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

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
    <Modal show={show} onHide={() => onHide(false)} size="xl" centered>
      <Modal.Header closeButton>
        <Modal.Title>
          {esCerrada ? "Detalle de Tarea" : "Responder Tarea"}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Row>
          {/* Columna completa: Tarea */}
          <Col md={12}>
            {/* Banner destacado de la tarea actual */}
            <div
              className="mb-3 p-3 rounded shadow"
              style={{ 
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                border: "2px solid #5568d3"
              }}
            >
              <div className="d-flex align-items-center mb-2">
                <span style={{ fontSize: "1.5rem", marginRight: "10px" }}>📌</span>
                <div>
                  <h5 className="mb-0 text-white">Tarea Actual</h5>
                  <small className="text-white" style={{ opacity: 0.9 }}>
                    Respondiendo esta tarea
                  </small>
                </div>
              </div>
              <div className="p-2 rounded" style={{ background: "rgba(255,255,255,0.95)" }}>
                <h6 className="mb-2" style={{ color: "#667eea", fontWeight: "bold" }}>
                  {conceptoTarea}
                </h6>
                <div className="small">
                  <strong>Nota:</strong> {notaTarea}
                </div>
              </div>
            </div>

            <h6 className="mb-3 text-muted">Detalles de la Tarea</h6>
            
            {/* Detalles de la Tarea */}
            <div
              className="mb-3 p-3 rounded shadow-sm"
              style={{ background: "#fff", border: "1px solid #dee2e6" }}
            >
              {!esCerrada ? (
                <>
                  <Row className="mb-2">
                    <Col>
                      <Form.Group>
                        <Form.Label>📅 Programada:</Form.Label>
                        <Form.Control
                          type="date"
                          value={scheduledDate}
                          onChange={(e) => setScheduledDate(e.target.value)}
                        />
                      </Form.Group>
                    </Col>
                    <Col>
                      <Form.Group>
                        <Form.Label>⏳ Vencimiento:</Form.Label>
                        <Form.Control
                          type="date"
                          value={dueDate}
                          onChange={(e) => setDueDate(e.target.value)}
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                  <p><strong>Asignada por:</strong> {asignadoPor}</p>
                </>
              ) : (
                <>
                  <Badge bg="info" className="me-2">{formatFecha(tarea?.scheduled_date)}</Badge>
                  <Badge bg={getBadgeColor(tarea?.due_date)}>
                    {formatFecha(tarea?.due_date)}
                  </Badge>
                  <p className="mt-3"><strong>Asignada por:</strong> {asignadoPor}</p>
                </>
              )}
            </div>

            <hr />
            
            {/* Comentarios de esta tarea */}
            <div className="mb-3">
              <div className="d-flex align-items-center mb-2">
                <span style={{ fontSize: "1.2rem", marginRight: "8px" }}>💬</span>
                <h6 className="mb-0">Comentarios de esta tarea</h6>
              </div>
              {comentariosDeEstaTarea.length === 0 ? (
                <p className="text-muted small">No hay comentarios previos.</p>
              ) : (
                <ListGroup className="mb-3">
                  {comentariosDeEstaTarea.map((c) => {
                    const estaEnEdicion = comentariosEnEdicion.hasOwnProperty(c.id);
                    const fueActualizado = comentariosActualizados[c.id];

                    return (
                      <ListGroup.Item 
                        key={c.id} 
                        className={fueActualizado ? 'border-success' : ''}
                        style={{ background: "#f8f9fa" }}
                      >
                        <strong>{c.user || "Usuario"}:</strong>
                        {fueActualizado && (
                          <Badge bg="success" className="ms-2">Actualizado ✓</Badge>
                        )}

                        {estaEnEdicion ? (
                          <>
                            <Form.Control
                              as="textarea"
                              value={comentariosEnEdicion[c.id]}
                              onChange={(e) =>
                                setComentariosEnEdicion((prev) => ({
                                  ...prev,
                                  [c.id]: e.target.value,
                                }))
                              }
                              rows={2}
                              className="mb-2 mt-2"
                            />
                            <div className="d-flex gap-2">
                              <Button
                                size="sm"
                                variant="success"
                                onClick={() => handleGuardarComentarioTarea(c.id)}
                                disabled={!comentariosEnEdicion[c.id]?.trim()}
                              >
                                Guardar
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                  setComentariosEnEdicion((prev) => {
                                    const nuevo = { ...prev };
                                    delete nuevo[c.id];
                                    return nuevo;
                                  });
                                }}
                              >
                                Cancelar
                              </Button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div 
                              style={{ 
                                marginTop: 4,
                                fontSize: '14px',
                                lineHeight: '1.5',
                                wordBreak: 'break-word'
                              }}
                              dangerouslySetInnerHTML={{ __html: c.comment || 'Sin contenido' }}
                            />
                            <small className="text-muted">
                              {(() => {
                                try {
                                  const d = new Date(c.fecha);
                                  if (isNaN(d.getTime())) return "Fecha inválida";
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
                                  return "Fecha inválida";
                                }
                              })()}
                            </small>
                            {/* ✅ Mostrar adjuntos del comentario */}
                            {/* Cargar adjuntos si no se han cargado aún */}
                            {(() => {
                              if (!adjuntosComentarios[c.id] && !loadingAdjuntos[c.id]) {
                                // Cargar adjuntos usando los datos del comentario
                                setTimeout(() => cargarAdjuntosComentario(c.id, c), 100);
                              }
                              return <MostrarAdjuntosComentario comentarioId={c.id} />;
                            })()}
                            {!esCerrada && (
                              <div className="mt-1">
                                <Button
                                  size="sm"
                                  variant="outline-secondary"
                                  onClick={() => {
                                    setComentariosEnEdicion((prev) => ({
                                      ...prev,
                                      [c.id]: c.comment,
                                    }));
                                  }}
                                >
                                  ✏️ Editar
                                </Button>
                              </div>
                            )}
                          </>
                        )}
                      </ListGroup.Item>
                    );
                  })}
                </ListGroup>
              )}
            </div>

            <hr />

            {/* Campo para nuevo comentario */}
            {!esCerrada && (
              <div className="mt-3">
                <div className="d-flex align-items-center mb-2">
                  <span style={{ fontSize: "1.2rem", marginRight: "8px" }}>✍️</span>
                  <Form.Label className="mb-0 fw-bold">Mi respuesta:</Form.Label>
                </div>
                <div className="mb-2">
                  {reconocimientoDisponible && (
                    <>
                      <style>{`
                        @keyframes microphone-pulse {
                          0%, 100% {
                            transform: scale(1);
                            opacity: 1;
                          }
                          50% {
                            transform: scale(1.15);
                            opacity: 0.85;
                          }
                        }
                        .microphone-recording {
                          animation: microphone-pulse 1s ease-in-out infinite;
                          display: inline-block;
                        }
                        .recording-waves {
                          display: inline-flex;
                          align-items: center;
                          gap: 2px;
                          margin-left: 4px;
                        }
                        .recording-waves span {
                          width: 3px;
                          height: 12px;
                          background-color: currentColor;
                          border-radius: 2px;
                          animation: wave 1.2s ease-in-out infinite;
                        }
                        .recording-waves span:nth-child(1) {
                          animation-delay: 0s;
                        }
                        .recording-waves span:nth-child(2) {
                          animation-delay: 0.2s;
                        }
                        .recording-waves span:nth-child(3) {
                          animation-delay: 0.4s;
                        }
                        @keyframes wave {
                          0%, 100% {
                            transform: scaleY(0.5);
                            opacity: 0.7;
                          }
                          50% {
                            transform: scaleY(1);
                            opacity: 1;
                          }
                        }
                      `}</style>
                      <Button
                        type="button"
                        variant={grabando ? "danger" : "outline-primary"}
                        size="sm"
                        onClick={toggleDictado}
                        className="d-flex align-items-center gap-2"
                      >
                        {grabando ? (
                          <>
                            <span className="d-flex align-items-center">
                              <i className={`fas fa-microphone microphone-recording`}></i>
                              <span className="recording-waves">
                                <span></span>
                                <span></span>
                                <span></span>
                              </span>
                            </span>
                            <span>Detener dictado</span>
                          </>
                        ) : (
                          <>
                            <i className="fas fa-microphone"></i>
                            <span>Dictar</span>
                          </>
                        )}
                      </Button>
                    </>
                  )}
                </div>
                {grabando && (
                  <div className="alert alert-info d-flex align-items-center gap-2 mb-2 py-2" role="alert">
                    <span className="spinner-border spinner-border-sm text-primary" role="status" aria-hidden="true"></span>
                    <small className="mb-0">
                      <strong>Escuchando...</strong> Habla ahora. El texto se agregará automáticamente a tu respuesta.
                    </small>
                  </div>
                )}
                <style>{`
                  .ql-editor {
                    min-height: 280px;
                    font-size: 16px;
                    line-height: 1.6;
                  }
                  .ql-container {
                    font-size: 16px;
                    font-family: inherit;
                  }
                  .ql-editor.ql-blank::before {
                    font-size: 16px;
                    font-style: normal;
                    color: #6c757d;
                  }
                `}</style>
                <ReactQuill
                  theme="snow"
                  value={responseNote || ""}
                  onChange={(value, delta, source, editor) => {
                    setResponseNote(value);
                    if (editor && !quillEditorRef.current) {
                      quillEditorRef.current = editor;
                    }
                  }}
                  modules={quillModules}
                  formats={quillFormats}
                  placeholder="Escribe tu respuesta o usa el botón 'Dictar' para transcribir por voz. Use la barra de herramientas para formatear el texto..."
                  style={{
                    backgroundColor: '#fff',
                    border: '2px solid #667eea',
                    borderRadius: '0.375rem'
                  }}
                />

                {/* ✅ Área de carga de archivos */}
                <Form.Group className="mt-3">
                  <Form.Label>
                    <i className="fas fa-paperclip me-2 text-info"></i>
                    Archivos adjuntos (opcional)
                  </Form.Label>
                  <div
                    className={`border rounded p-3 text-center ${
                      isDragging ? "border-primary bg-light" : "border-secondary"
                    }`}
                    style={{
                      borderStyle: "dashed",
                      cursor: "pointer",
                      transition: "all 0.3s ease",
                      backgroundColor: isDragging ? "#e7f3ff" : "transparent",
                    }}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => document.getElementById("file-input-comentario").click()}
                  >
                    <input
                      id="file-input-comentario"
                      type="file"
                      multiple
                      accept="image/*,.pdf,.doc,.docx"
                      onChange={handleFileInput}
                      style={{ display: "none" }}
                    />
                    <div>
                      <i className="fas fa-cloud-upload-alt fa-2x text-muted mb-2"></i>
                      <p className="mb-1">
                        {isDragging ? (
                          <strong className="text-primary">Suelta los archivos aquí</strong>
                        ) : (
                          <>
                            <strong>Arrastra archivos aquí</strong> o haz clic para seleccionar
                          </>
                        )}
                      </p>
                      <small className="text-muted">
                        Formatos: JPG, PNG, GIF, WEBP, PDF, DOC, DOCX (máx. 10MB cada uno)
                      </small>
                    </div>
                  </div>

                  {/* ✅ Vista previa de archivos */}
                  {archivos.length > 0 && (
                    <div className="mt-3">
                      <div className="d-flex flex-wrap gap-2">
                        {archivos.map((archivo) => (
                          <div
                            key={archivo.id}
                            className="position-relative border rounded p-2"
                            style={{ 
                              width: "120px", 
                              height: "120px",
                              backgroundColor: "#f8f9fa"
                            }}
                          >
                            {archivo.tipo === "imagen" && archivo.preview ? (
                              <>
                                <img
                                  src={archivo.preview}
                                  alt={archivo.nombre}
                                  className="rounded"
                                  style={{
                                    width: "100%",
                                    height: "80px",
                                    objectFit: "cover",
                                  }}
                                />
                                <small className="d-block text-truncate mt-1" style={{ fontSize: "0.7rem" }}>
                                  {archivo.nombre}
                                </small>
                              </>
                            ) : (
                              <div className="d-flex flex-column align-items-center justify-content-center h-100">
                                {archivo.tipo === "pdf" ? (
                                  <i className="fas fa-file-pdf fa-3x text-danger mb-2"></i>
                                ) : (
                                  <i className="fas fa-file-word fa-3x text-primary mb-2"></i>
                                )}
                                <small className="text-center text-truncate" style={{ fontSize: "0.7rem", width: "100%" }}>
                                  {archivo.nombre}
                                </small>
                              </div>
                            )}
                            <button
                              type="button"
                              className="position-absolute top-0 end-0 btn btn-sm btn-danger p-1"
                              style={{ width: "24px", height: "24px", fontSize: "0.7rem" }}
                              onClick={() => eliminarArchivo(archivo.id)}
                              title="Eliminar archivo"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                      {subiendoArchivos && (
                        <div className="mt-2">
                          <Spinner size="sm" className="me-2" />
                          <small>Subiendo archivos...</small>
                        </div>
                      )}
                    </div>
                  )}
                </Form.Group>
              </div>
            )}
          </Col>
        </Row>
      </Modal.Body>
      
      <Modal.Footer>
        <Button variant="secondary" onClick={() => onHide(false)}>
          Cerrar
        </Button>
        {!esCerrada && (
          <>
            <Button 
              variant="primary" 
              onClick={handleActualizarFechas}
              disabled={loading}
            >
              Actualizar Fechas
            </Button>
            <Button 
              variant="info" 
              onClick={handleAgregarComentario}
              disabled={loading}
            >
              Agregar Comentario
            </Button>
            <Button 
              variant="success" 
              onClick={handleCompletar}
              disabled={loading}
            >
              Marcar completada
            </Button>
          </>
        )}
      </Modal.Footer>
    </Modal>

    {/* ✅ Modal de previsualización de archivos */}
    {showPreviewModal && archivoPreview && (
      <Modal 
        show={showPreviewModal} 
        onHide={() => {
          setShowPreviewModal(false);
          setArchivoPreview(null);
          setErrorCargaArchivo(false);
        }} 
        size="lg" 
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>
            {archivoPreview.tipo === "imagen" ? (
              <i className="fas fa-image me-2"></i>
            ) : archivoPreview.tipo === "pdf" ? (
              <i className="fas fa-file-pdf me-2 text-danger"></i>
            ) : (
              <i className="fas fa-file-word me-2 text-primary"></i>
            )}
            {archivoPreview.adjunto.nombre_original || "Vista previa"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {archivoPreview.tipo === "imagen" && (
            <div className="text-center">
              {errorCargaArchivo ? (
                <div className="p-5">
                  <i className="fas fa-exclamation-triangle text-warning" style={{ fontSize: "3rem" }}></i>
                  <h5 className="mt-3">No se pudo cargar la imagen</h5>
                  <p className="text-muted">La imagen puede requerir autenticación o no estar disponible.</p>
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
          {archivoPreview.tipo === "pdf" && (
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
          {(archivoPreview.tipo === "word" || archivoPreview.tipo === "otro") && (
            <div className="d-flex flex-column align-items-center justify-content-center p-5" style={{ minHeight: "400px" }}>
              <i className={`fas ${archivoPreview.tipo === "word" ? "fa-file-word text-primary" : "fa-file text-secondary"}`} style={{ fontSize: "5rem" }}></i>
              <h5 className="mt-3 mb-2">
                {archivoPreview.tipo === "word" ? "Documento Word" : "Archivo"}
              </h5>
              <p className="text-muted">Este tipo de archivo no se puede previsualizar en el navegador.</p>
              <Button
                variant="primary"
                onClick={() => window.open(archivoPreview.adjunto.url, "_blank")}
              >
                <i className="fas fa-download me-2"></i>
                Descargar archivo
              </Button>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => {
            setShowPreviewModal(false);
            setArchivoPreview(null);
            setErrorCargaArchivo(false);
          }}>
            Cerrar
          </Button>
          <Button 
            variant="primary" 
            onClick={() => window.open(archivoPreview.adjunto.url, "_blank")}
          >
            <i className="fas fa-external-link-alt me-2"></i>
            Abrir en nueva pestaña
          </Button>
        </Modal.Footer>
      </Modal>
    )}
    </>
  );
};

export default ResponderOportunidadModal;