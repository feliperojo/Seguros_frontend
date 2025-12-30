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
import apiRequest from "../../services/api";
import { formatDateTimeForDisplay } from "../../utils/formatters";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
const getAuthToken = () => localStorage.getItem("auth_token");

const ResponderTareaModal = ({ show, onHide, tarea, onUpdated }) => {
 
  const [responseNote, setResponseNote] = useState(tarea?.response_note || "");
  const [loading, setLoading] = useState(false);
  const [comentarios, setComentarios] = useState([]);
  const [cargandoComentarios, setCargandoComentarios] = useState(false);

  // ✅ Estados simplificados para edición - usando solo el ID del comentario como clave
  const [comentariosEnEdicion, setComentariosEnEdicion] = useState({}); 
  const [comentariosHistorialEnEdicion, setComentariosHistorialEnEdicion] = useState({});

  const [comentariosActualizados, setComentariosActualizados] = useState({});
  const [comentariosHistorialActualizados, setComentariosHistorialActualizados] = useState({});

  // ✅ Estados para adjuntos de comentarios
  const [adjuntosComentarios, setAdjuntosComentarios] = useState({}); // { comentarioId: [adjuntos] }
  const [loadingAdjuntos, setLoadingAdjuntos] = useState({}); // { comentarioId: boolean }
  // ✅ Estados para adjuntos del log (como en FichaClienteComentarios)
  const [adjuntosLog, setAdjuntosLog] = useState({}); // { logId: [adjuntos] }
  const [loadingAdjuntosLog, setLoadingAdjuntosLog] = useState({}); // { logId: boolean }
  const [archivosExpandidos, setArchivosExpandidos] = useState({}); // { logId: boolean }
  const [archivoPreview, setArchivoPreview] = useState(null); // { adjunto, tipo }
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [errorCargaArchivo, setErrorCargaArchivo] = useState(false);

  // ✅ Historial del cliente
  const [historial, setHistorial] = useState([]);
  const comentariosDeEstaTarea = historial
  .filter(h => h.tipo === 'tarea' && h.id === tarea.id)
  .flatMap(h => h.comentarios || []);

  
  const comentariosTareaActual = historial
  .filter(h => h.tipo === 'tarea' && h.concepto === tarea?.log?.concept?.name)
  .flatMap(h => h.comentarios || []);

  const [loadingHistorial, setLoadingHistorial] = useState(false);

  const [scheduledDate, setScheduledDate] = useState(tarea?.scheduled_date || "");
  const [dueDate, setDueDate] = useState(tarea?.due_date || "");

  // Estados para archivos adjuntos de la respuesta
  const [archivos, setArchivos] = useState([]);
  const [subiendoArchivos, setSubiendoArchivos] = useState(false);

  // Estados para reconocimiento de voz
  const [grabando, setGrabando] = useState(false);
  const [reconocimientoDisponible, setReconocimientoDisponible] = useState(false);
  const [reconocimientoVoz, setReconocimientoVoz] = useState(null);
  const grabandoRef = useRef(false);

  // Sincronizar ref con estado
  useEffect(() => {
    grabandoRef.current = grabando;
  }, [grabando]);

  // Verificar disponibilidad del reconocimiento de voz
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setReconocimientoDisponible(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'es-ES';

      recognition.onresult = (event) => {
        let textoTranscrito = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            textoTranscrito += event.results[i][0].transcript;
          }
        }
        
        if (textoTranscrito) {
          setResponseNote((prev) => prev + (prev && !prev.endsWith(' ') ? ' ' : '') + textoTranscrito + ' ');
        }
      };

      recognition.onerror = (event) => {
        console.error('Error en reconocimiento de voz:', event.error);
        if (event.error === 'no-speech') {
          // No hacer nada, es normal cuando no hay habla
          return;
        } else if (event.error === 'audio-capture') {
          alert('No se pudo acceder al micrófono. Por favor, verifica los permisos.');
          setGrabando(false);
        } else if (event.error === 'not-allowed') {
          alert('Permiso de micrófono denegado. Por favor, permite el acceso al micrófono.');
          setGrabando(false);
        } else if (event.error !== 'aborted') {
          setGrabando(false);
        }
      };

      recognition.onend = () => {
        // Solo reiniciar si aún debería estar grabando
        if (grabandoRef.current) {
          try {
            setTimeout(() => {
              if (grabandoRef.current) {
                recognition.start();
              }
            }, 100);
          } catch (err) {
            setGrabando(false);
          }
        }
      };

      setReconocimientoVoz(recognition);

      return () => {
        try {
          recognition.stop();
        } catch (err) {
          // Ignorar errores al detener
        }
        setGrabando(false);
      };
    } else {
      setReconocimientoDisponible(false);
    }
  }, []);

  // Detener grabación cuando se cierra el modal
  useEffect(() => {
    if (!show && reconocimientoVoz && grabando) {
      try {
        reconocimientoVoz.stop();
        setGrabando(false);
      } catch (err) {
        // Ignorar errores
      }
    }
  }, [show, reconocimientoVoz, grabando]);

  // Funciones para el dictado
  const iniciarDictado = () => {
    if (!reconocimientoVoz) {
      alert('El reconocimiento de voz no está disponible en tu navegador.');
      return;
    }

    try {
      reconocimientoVoz.start();
      setGrabando(true);
    } catch (err) {
      console.error('Error al iniciar reconocimiento:', err);
      alert('Error al iniciar el reconocimiento de voz. Por favor, intenta nuevamente.');
      setGrabando(false);
    }
  };

  const detenerDictado = () => {
    if (reconocimientoVoz) {
      try {
        reconocimientoVoz.stop();
      } catch (err) {
        console.error('Error al detener reconocimiento:', err);
      }
    }
    setGrabando(false);
  };

  const toggleDictado = () => {
    if (grabando) {
      detenerDictado();
    } else {
      iniciarDictado();
    }
  };

  // Funciones para manejo de archivos
  const validarArchivo = (file) => {
    const tiposPermitidos = [
      "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ];
    const extensionesPermitidas = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf", ".doc", ".docx"];
    const maxSize = 10 * 1024 * 1024;

    const tieneTipoValido = tiposPermitidos.includes(file.type);
    const tieneExtensionValida = extensionesPermitidas.some(ext => 
      file.name.toLowerCase().endsWith(ext)
    );

    if (!tieneTipoValido && !tieneExtensionValida) {
      alert("Solo se permiten archivos de imagen (JPG, PNG, GIF, WEBP), PDF y Word (DOC, DOCX)");
      return false;
    }

    if (file.size > maxSize) {
      alert("El archivo es demasiado grande. El tamaño máximo es 10MB");
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

  const subirArchivosComentario = async (comentarioId) => {
    if (archivos.length === 0) return;

    setSubiendoArchivos(true);
    const token = getAuthToken();

    if (!token) {
      alert("Token no encontrado. Por favor inicia sesión.");
      setSubiendoArchivos(false);
      return;
    }

    try {
      const uploadPromises = archivos.map(async (archivo) => {
        const formData = new FormData();
        formData.append("archivo", archivo.file);

        // Intentar subir al endpoint de comentarios
        const response = await fetch(`${API_BASE_URL}/tareas_operativas/comentarios/${comentarioId}/adjuntos`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        if (!response.ok) {
          // Si falla, intentar con el endpoint de bitacora como fallback
          const logId = tarea?.log?.id || tarea?.log_id;
          if (logId) {
            const fallbackResponse = await fetch(`${API_BASE_URL}/adjuntos/bitacora/${logId}`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
              },
              body: formData,
            });

            if (!fallbackResponse.ok) {
              const errorData = await fallbackResponse.json().catch(() => ({}));
              const errorMessage = errorData.message || "Error al subir archivo";
              throw new Error(errorMessage);
            }
            return fallbackResponse.json();
          } else {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.message || "Error al subir archivo";
            throw new Error(errorMessage);
          }
        }

        return response.json();
      });

      await Promise.all(uploadPromises);
    } catch (err) {
      console.error("Error al subir archivos:", err);
      throw err;
    } finally {
      setSubiendoArchivos(false);
    }
  };

  const handleFileInput = (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      agregarArchivos(files);
    }
    e.target.value = "";
  };

  useEffect(() => {
    if (show && tarea?.id) {
      // ✅ Cargar comentarios
      

      // ✅ Cargar historial del cliente
      if (tarea.log?.cliente?.id) {
        setLoadingHistorial(true);
        apiRequest(`cliente/${tarea.log.cliente.id}/historial`, "GET")
          .then((data) => {
            const historialData = Array.isArray(data.data) ? data.data : [];
            console.log('📜 Historial original:', historialData);
            // ✅ Deduplicar historial y sus comentarios, asegurar IDs
            const historialUnico = historialData.map(h => {
              if (h.comentarios && h.comentarios.length > 0) {
                const comentariosUnicos = h.comentarios.filter((comentario, index, arr) => {
                  if (!comentario.id) {
                    console.warn("⚠️ Comentario de historial sin ID:", comentario);
                    return false;
                  }
                  return arr.findIndex(c => c.id === comentario.id) === index;
                });
                
                // ✅ Si los comentarios ya tienen adjuntos en su estructura, guardarlos directamente
                comentariosUnicos.forEach((c) => {
                  if (c.id && c.adjuntos && Array.isArray(c.adjuntos) && c.adjuntos.length > 0) {
                    console.log(`✅ Adjuntos encontrados en comentario ${c.id} del historial:`, c.adjuntos.length);
                    setAdjuntosComentarios((prev) => ({
                      ...prev,
                      [c.id]: c.adjuntos,
                    }));
                  }
                });
                
                return { ...h, comentarios: comentariosUnicos };
              }
              return h;
            });
            
            console.log('📜 Historial original:', historialData.length);
            console.log('📜 Historial procesado:', historialUnico.length);
            
            setHistorial(historialUnico);
            
            // ✅ Cargar adjuntos del log de la tarea principal
            const logId = tarea?.log?.id || tarea?.log_id || tarea?.id;
            if (logId) {
              cargarAdjuntosLog(logId);
            }
            
            // ✅ Cargar adjuntos de cada item del historial
            historialUnico.forEach((item) => {
              const itemLogId = item.id || item.log_id || item.log?.id;
              if (itemLogId) {
                cargarAdjuntosLog(itemLogId);
              }
            });
            
            // ✅ Cargar adjuntos de cada comentario del historial
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
            console.error("❌ Error al cargar historial:", error);
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

    // ✅ Limpiar estados de edición al cambiar de tarea
    setComentariosEnEdicion({});
    setComentariosHistorialEnEdicion({});
    
    // Limpiar archivos cuando se cierra el modal
    if (!show) {
      archivos.forEach((arch) => {
        if (arch.preview) URL.revokeObjectURL(arch.preview);
      });
      setArchivos([]);
    }
  }, [show, tarea]);

  const handleAgregarComentario = async () => {
    if (!responseNote.trim() && archivos.length === 0) return;
    setLoading(true);
    try {
      const data = await apiRequest(
        `tareas_operativas/${tarea.id}/comentarios`,
        "POST",
        { comment: responseNote || " " }
      );

      let comentarioId = data?.comment?.id;

      // ✅ Si el comentario tiene adjuntos en la respuesta, guardarlos directamente
      if (comentarioId && data?.comment?.adjuntos) {
        setAdjuntosComentarios((prev) => ({
          ...prev,
          [comentarioId]: Array.isArray(data.comment.adjuntos) ? data.comment.adjuntos : [],
        }));
        console.log(`✅ Adjuntos guardados para comentario ${comentarioId}:`, data.comment.adjuntos);
      }

      // Subir archivos si hay alguno
      if (comentarioId && archivos.length > 0) {
        try {
          await subirArchivosComentario(comentarioId);
          // Recargar adjuntos del comentario después de subirlos
          if (comentarioId) {
            setTimeout(() => {
              cargarAdjuntosComentario(comentarioId);
            }, 500);
          }
        } catch (err) {
          console.error("Error al subir archivos:", err);
          alert(`Se creó el comentario pero hubo un error al subir algunos archivos:\n${err.message || "Error desconocido"}`);
        }
      }

      const tareaActualizada = {
        ...tarea,
        response_note: responseNote,
        status: tarea.status === "pending" ? "in_progress" : tarea.status,
      };

      if (onUpdated) onUpdated(tareaActualizada);

      await apiRequest(`cliente/${tarea.log.cliente.id}/historial`, "GET")
      .then((data) => {
        const historialData = Array.isArray(data.data) ? data.data : [];
        setHistorial(historialData);
      });
    
      setResponseNote("");
      // Limpiar archivos después de subirlos
      archivos.forEach((arch) => {
        if (arch.preview) URL.revokeObjectURL(arch.preview);
      });
      setArchivos([]);
      onHide(true);
    } catch (error) {
      console.error("❌ Error al agregar el comentario:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCompletar = async () => {
    setLoading(true);
    try {
      let comentarioId = null;
      
      if (
        (responseNote.trim() !== "" || archivos.length > 0) &&
        (comentarios.length === 0 ||
          comentarios[comentarios.length - 1].comment !== responseNote)
      ) {
        const data = await apiRequest(
          `tareas_operativas/${tarea.id}/comentarios`,
          "POST",
          { comment: responseNote || " " }
        );
        comentarioId = data?.comment?.id;
        
        // Subir archivos si hay alguno
        if (comentarioId && archivos.length > 0) {
          try {
            await subirArchivosComentario(comentarioId);
            // Recargar adjuntos del comentario después de subirlos
            if (comentarioId) {
              setTimeout(() => {
                cargarAdjuntosComentario(comentarioId);
              }, 500);
            }
          } catch (err) {
            console.error("Error al subir archivos:", err);
            alert(`Se creó el comentario pero hubo un error al subir algunos archivos:\n${err.message || "Error desconocido"}`);
          }
        }
      }

      await apiRequest(`tareas_operativas/${tarea.id}/completar`, "PUT");

      const tareaActualizada = { ...tarea, status: "completed" };
      if (onUpdated) onUpdated(tareaActualizada);
      
      // Limpiar archivos después de subirlos
      archivos.forEach((arch) => {
        if (arch.preview) URL.revokeObjectURL(arch.preview);
      });
      setArchivos([]);
      
      onHide(true);
    } catch (error) {
      console.error("❌ Error al completar la tarea:", error);
      alert("❌ Error al completar la tarea");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Función simplificada para guardar comentarios de la tarea
  const handleGuardarComentarioTarea = async (comentarioId) => {
    if (!comentarioId) {
      console.error("❌ ID de comentario requerido para actualizar");
      return;
    }

    const nuevoTexto = comentariosEnEdicion[comentarioId];
    if (!nuevoTexto?.trim()) {
      console.warn("⚠️ Texto de comentario vacío");
      return;
    }

    console.log("🔄 Actualizando comentario tarea:", { comentarioId, nuevoTexto });

    try {
      await apiRequest(
        `tareas_operativas/comentarios/${comentarioId}`,
        "PUT",
        { comment: nuevoTexto }
      );

      // ✅ Actualizar estado local - comentarios de tarea
      setComentarios((prev) =>
        prev.map((c) =>
          c.id === comentarioId ? { ...c, comment: nuevoTexto } : c
        )
      );

      // ✅ También actualizar en historial si existe
      setHistorial((prev) =>
        prev.map((h) => ({
          ...h,
          comentarios: h.comentarios?.map((c) =>
            c.id === comentarioId ? { ...c, comment: nuevoTexto } : c
          ) || []
        }))
      );

      // ✅ Limpiar edición
      setComentariosEnEdicion((prev) => {
        const nuevo = { ...prev };
        delete nuevo[comentarioId];
        return nuevo;
      });

      // ✅ Mostrar feedback visual
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
      console.error("❌ Error al actualizar el comentario:", error);
      alert("Error al actualizar el comentario. Por favor, intenta de nuevo.");
    }
  };

  // ✅ Función simplificada para guardar comentarios del historial
  const handleGuardarComentarioHistorial = async (comentarioId) => {
    if (!comentarioId) {
      console.error("❌ ID de comentario requerido para actualizar historial");
      return;
    }

    const nuevoTexto = comentariosHistorialEnEdicion[comentarioId];
    if (!nuevoTexto?.trim()) {
      console.warn("⚠️ Texto de comentario vacío");
      return;
    }

    console.log("🔄 Actualizando comentario historial:", { comentarioId, nuevoTexto });

    try {
      await apiRequest(
        `tareas_operativas/comentarios/${comentarioId}`,
        "PUT",
        { comment: nuevoTexto }
      );

      // ✅ Actualizar historial
      setHistorial((prev) =>
        prev.map((h) => ({
          ...h,
          comentarios: h.comentarios?.map((c) =>
            c.id === comentarioId ? { ...c, comment: nuevoTexto } : c
          ) || []
        }))
      );

      // ✅ También actualizar comentarios de tarea si existe
      setComentarios((prev) =>
        prev.map((c) =>
          c.id === comentarioId ? { ...c, comment: nuevoTexto } : c
        )
      );

      // ✅ Limpiar edición
      setComentariosHistorialEnEdicion((prev) => {
        const nuevo = { ...prev };
        delete nuevo[comentarioId];
        return nuevo;
      });

      // ✅ Mostrar feedback visual
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
      console.error("❌ Error al actualizar el comentario del historial:", error);
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
    } catch (error) {
      console.error(error);
      alert("❌ Error al actualizar fechas");
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

  // ✅ Función para cargar adjuntos de un comentario
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
          // Si no existe el endpoint, dejar vacío
          console.log(`ℹ️ No se encontraron adjuntos específicos para el comentario ${comentarioId}`);
          data = [];
        }
      }

      setAdjuntosComentarios((prev) => ({
        ...prev,
        [comentarioId]: data,
      }));
    } catch (err) {
      console.error(`Error al cargar adjuntos del comentario ${comentarioId}:`, err);
      setAdjuntosComentarios((prev) => ({
        ...prev,
        [comentarioId]: [],
      }));
    } finally {
      setLoadingAdjuntos((prev) => ({ ...prev, [comentarioId]: false }));
    }
  };

  // ✅ Función para cargar adjuntos del log (como en FichaClienteComentarios)
  const cargarAdjuntosLog = async (logId) => {
    if (!logId || adjuntosLog[logId]) return;

    // Evitar cargar si ya se está cargando
    if (loadingAdjuntosLog[logId]) return;

    setLoadingAdjuntosLog((prev) => ({ ...prev, [logId]: true }));

    try {
      const data = await apiRequest(`adjuntos/bitacora/${logId}`, "GET");
      setAdjuntosLog((prev) => ({
        ...prev,
        [logId]: Array.isArray(data) ? data : data?.data || [],
      }));
    } catch (err) {
      console.error(`Error al cargar adjuntos del log ${logId}:`, err);
      setAdjuntosLog((prev) => ({
        ...prev,
        [logId]: [],
      }));
    } finally {
      setLoadingAdjuntosLog((prev) => ({ ...prev, [logId]: false }));
    }
  };

  // ✅ Función para abrir preview
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

  // ✅ Función para descargar archivo (como en FichaClienteComentarios)
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

  // ✅ Componente para mostrar adjuntos de un comentario (mejorado como en FichaClienteComentarios)
  const MostrarAdjuntosComentario = ({ comentarioId }) => {
    const adjuntos = adjuntosComentarios[comentarioId] || [];
    const cargando = loadingAdjuntos[comentarioId];

    if (cargando) {
      return (
        <div className="d-flex align-items-center gap-2 mt-2">
          <Spinner animation="border" size="sm" />
          <small className="text-muted">Cargando archivos...</small>
        </div>
      );
    }

    if (adjuntos.length === 0) return null;

    // Contar tipos de archivos
    const imagenesCount = adjuntos.filter(esImagenAdjunto).length;
    const pdfsCount = adjuntos.filter(esPDF).length;
    const wordsCount = adjuntos.filter(esWord).length;
    const otrosCount = adjuntos.length - imagenesCount - pdfsCount - wordsCount;

    return (
      <div className="mt-2">
        <div className="d-flex align-items-center gap-2 mb-2">
          <i className="fas fa-paperclip text-primary"></i>
          <small className="fw-semibold">Archivos adjuntos:</small>
          <span className="badge bg-primary">
            {adjuntos.length} {adjuntos.length === 1 ? "archivo" : "archivos"}
          </span>
          {/* Mostrar resumen de tipos de archivos */}
          <div className="d-flex align-items-center gap-2 ms-2">
            {imagenesCount > 0 && (
              <small className="text-muted">
                <i className="fas fa-image text-primary"></i> {imagenesCount}
              </small>
            )}
            {pdfsCount > 0 && (
              <small className="text-muted">
                <i className="fas fa-file-pdf text-danger"></i> {pdfsCount}
              </small>
            )}
            {wordsCount > 0 && (
              <small className="text-muted">
                <i className="fas fa-file-word text-primary"></i> {wordsCount}
              </small>
            )}
            {otrosCount > 0 && (
              <small className="text-muted">
                <i className="fas fa-file text-secondary"></i> {otrosCount}
              </small>
            )}
          </div>
        </div>
        <div className="d-flex flex-wrap gap-2">
          {adjuntos.map((adjunto) => {
            const esImg = esImagenAdjunto(adjunto);
            const esPdf = esPDF(adjunto);
            const esDoc = esWord(adjunto);

            return (
              <div
                key={adjunto.id}
                className="position-relative border rounded"
                style={{
                  width: "120px",
                  height: "120px",
                  cursor: "pointer",
                  overflow: "hidden",
                  backgroundColor: "#f8f9fa"
                }}
                onClick={() => abrirPreview(adjunto)}
                title="Haz clic para previsualizar"
              >
                {esImg ? (
                  <>
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
                    <div className="position-absolute top-0 start-0 end-0 bottom-0 bg-black bg-opacity-0 hover:bg-opacity-30 transition-all d-flex align-items-center justify-content-center">
                      <i className="fas fa-eye text-white opacity-0 hover:opacity-100"></i>
                    </div>
                  </>
                ) : esPdf ? (
                  <div className="d-flex flex-column align-items-center justify-content-center h-100 bg-danger bg-opacity-10">
                    <i className="fas fa-file-pdf text-danger" style={{ fontSize: "2rem" }}></i>
                    <small className="text-muted text-center px-1" style={{ fontSize: "0.7rem" }}>
                      {adjunto.nombre_original || "PDF"}
                    </small>
                  </div>
                ) : esDoc ? (
                  <div className="d-flex flex-column align-items-center justify-content-center h-100 bg-primary bg-opacity-10">
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
                {/* Botón de descarga - Solo visible en hover */}
                <div className="position-absolute top-1 end-1 opacity-0 hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      descargarArchivo(adjunto);
                    }}
                    className="btn btn-sm btn-primary rounded-circle p-1 shadow"
                    title="Descargar archivo"
                  >
                    <i className="fas fa-download" style={{ fontSize: "0.7rem" }}></i>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <>
    <Modal show={show} onHide={() => onHide(false)} size="xl" centered>
      <Modal.Header closeButton>
        <Modal.Title>
          {tarea.status === "completed" ? "Detalle de Tarea" : "Responder Tarea"}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Row>
          {/* ✅ Columna izquierda: Tarea */}
          <h6 className="mb-3">Detalles de la Tarea</h6>
          <Col md={6} style={{ borderRight: "1px solid #e9ecef" }}>
            <div
              className="mb-3 p-3 rounded shadow-sm"
              style={{ background: "#fff", border: "1px solid #dee2e6" }}
            >
              {/* ✅ Cabecera con estado y nombre */}
              <div className="d-flex justify-content-between align-items-center mb-2">
                <div>
                  {tarea.log.cliente.estado_cliente === "prospecto" && (
                    <Badge bg="warning" text="dark" className="me-2">Prospecto</Badge>
                  )}
                  {tarea.log.cliente.estado_cliente === "cliente" && (
                    <Badge bg="primary" className="me-2">Cliente</Badge>
                  )}
                  {tarea.log.cliente.estado_cliente === "descartado" && (
                    <Badge bg="secondary" className="me-2">Descartado</Badge>
                  )}
                  <span style={{ fontWeight: "bold", fontSize: "1rem" }}>
                    {tarea.log.cliente.nombre_completo}
                  </span>
                </div>
                <div>
                  <small className="text-muted">
                    <i className="fa fa-phone me-1"></i>{tarea.log.cliente.telefono || "N/A"}
                  </small>
                </div>
              </div>

              {/* ✅ Botones de acción */}
              <div className="d-flex gap-2 mb-2">
                <Button
                  variant="outline-primary"
                  size="sm"
                  onClick={() =>
                    window.open(`/clientes/${tarea.log.cliente.id}/ficha`, "_blank")
                  }
                >
                  Ver Ficha del Cliente
                </Button>
              </div>

              {/* ✅ Info Primer Contacto SOLO si es prospecto */}
              {tarea.log.cliente.estado_cliente?.toLowerCase() === "prospecto" &&
                tarea.log.cliente.primer_contacto_info && (
                  <div
                    className="p-2 rounded"
                    style={{
                      background: "#f8f9fa",
                      border: "1px solid #dee2e6",
                      fontSize: "0.85rem",
                    }}
                  >
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <strong>📌 Info Primer Contacto</strong>
                      <Button
                        variant="outline-success"
                        size="sm"
                        onClick={() =>
                          window.open(
                            `/grupofamiliar/crear?cliente_id=${tarea.log.cliente.id}`,
                            "_blank"
                          )
                        }
                      >
                        Crear Grupo Familiar
                      </Button>
                    </div>

                    {/* ✅ Info organizada */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                        gap: "6px",
                      }}
                    >
                      {tarea.log.cliente.primer_contacto_info
                        .split("\n")
                        .filter((line) => line.trim() !== "")
                        .map((line, index) => (
                          <span
                            key={index}
                            style={{
                              background: "#fff",
                              padding: "4px 6px",
                              borderRadius: "4px",
                              border: "1px solid #e0e0e0",
                            }}
                          >
                            {line.trim()}
                          </span>
                        ))}
                    </div>
                  </div>
                )}
            </div>

            <div
              className="mb-3 p-3 rounded shadow-sm"
              style={{ background: "#fff", border: "1px solid #dee2e6" }}
            >
              <p><strong>Concepto:</strong> {tarea?.log?.concept?.name || "N/A"}</p>
              {tarea.status !== "completed" ? (
                <>
                  <Row className="mb-2">
                    <Col>
                      <Form.Group>
                        <Form.Label>📅 Programada: <small className="text-muted">(mm/dd/yyyy)</small></Form.Label>
                        <Form.Control
                          type="date"
                          value={scheduledDate}
                          onChange={(e) => setScheduledDate(e.target.value)}
                          title="Formato: mm/dd/yyyy"
                        />
                      </Form.Group>
                    </Col>
                    <Col>
                      <Form.Group>
                        <Form.Label>⏳ Vencimiento: <small className="text-muted">(mm/dd/yyyy)</small></Form.Label>
                        <Form.Control
                          type="date"
                          value={dueDate}
                          onChange={(e) => setDueDate(e.target.value)}
                          title="Formato: mm/dd/yyyy"
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                  <p><strong>Asignada por:</strong> {tarea?.log?.user?.name || "N/A"}</p>
                  <p className="mt-3"><strong>Nota:</strong> {tarea?.log?.note || "Sin nota"}</p>

                </>
              ) : (
                <>
                  <Badge bg="info" className="me-2">{formatFecha(tarea?.scheduled_date)}</Badge>
                  <Badge bg={getBadgeColor(tarea?.due_date)}>
                    {formatFecha(tarea?.due_date)}
                  </Badge>
                </>
              )}
            </div>

            {/* ✅ Archivos adjuntos del log de la tarea principal */}
            {(() => {
              const logId = tarea?.log?.id || tarea?.log_id || tarea?.id;
              if (!logId) return null;

              const adjuntosLogTarea = adjuntosLog[logId] || [];
              const estaCargandoAdjuntosLog = loadingAdjuntosLog[logId];
              const estaExpandido = archivosExpandidos[logId];

              // Si está cargando, mostrar spinner
              if (estaCargandoAdjuntosLog) {
                return (
                  <div className="mb-3">
                    <div className="d-flex align-items-center gap-2 text-muted">
                      <Spinner animation="border" size="sm" />
                      <small>Cargando archivos adjuntos...</small>
                    </div>
                  </div>
                );
              }

              // Si no hay adjuntos, no mostrar nada
              if (adjuntosLogTarea.length === 0) return null;

              // Contar tipos de archivos
              const imagenesCount = adjuntosLogTarea.filter(esImagenAdjunto).length;
              const pdfsCount = adjuntosLogTarea.filter(esPDF).length;
              const wordsCount = adjuntosLogTarea.filter(esWord).length;
              const otrosCount = adjuntosLogTarea.length - imagenesCount - pdfsCount - wordsCount;

              return (
                <div className="mb-3">
                  {/* Botón para expandir/colapsar archivos */}
                  <button
                    type="button"
                    onClick={() => {
                      if (!estaExpandido) {
                        cargarAdjuntosLog(logId);
                      }
                      setArchivosExpandidos((prev) => ({
                        ...prev,
                        [logId]: !prev[logId],
                      }));
                    }}
                    className="w-100 d-flex align-items-center justify-content-between p-2 bg-light rounded border mb-2"
                    style={{ cursor: "pointer" }}
                  >
                    <div className="d-flex align-items-center gap-2">
                      <i className="fas fa-paperclip text-primary"></i>
                      <span className="fw-semibold">Archivos adjuntos de la tarea</span>
                      <span className="badge bg-primary">
                        {adjuntosLogTarea.length} {adjuntosLogTarea.length === 1 ? "archivo" : "archivos"}
                      </span>
                      {/* Mostrar resumen de tipos de archivos */}
                      <div className="d-flex align-items-center gap-2 ms-2">
                        {imagenesCount > 0 && (
                          <small className="text-muted">
                            <i className="fas fa-image text-primary"></i> {imagenesCount}
                          </small>
                        )}
                        {pdfsCount > 0 && (
                          <small className="text-muted">
                            <i className="fas fa-file-pdf text-danger"></i> {pdfsCount}
                          </small>
                        )}
                        {wordsCount > 0 && (
                          <small className="text-muted">
                            <i className="fas fa-file-word text-primary"></i> {wordsCount}
                          </small>
                        )}
                        {otrosCount > 0 && (
                          <small className="text-muted">
                            <i className="fas fa-file text-secondary"></i> {otrosCount}
                          </small>
                        )}
                      </div>
                    </div>
                    <i className={`fas ${estaExpandido ? "fa-chevron-up" : "fa-chevron-down"} text-muted`}></i>
                  </button>

                  {/* Mostrar archivos cuando está expandido */}
                  {estaExpandido && (
                    <div className="d-flex flex-wrap gap-2">
                      {adjuntosLogTarea.map((adjunto) => {
                        const esImg = esImagenAdjunto(adjunto);
                        const esPdf = esPDF(adjunto);
                        const esDoc = esWord(adjunto);

                        return (
                          <div
                            key={adjunto.id}
                            className="position-relative border rounded"
                            style={{
                              width: "120px",
                              height: "120px",
                              cursor: "pointer",
                              overflow: "hidden",
                              backgroundColor: "#f8f9fa"
                            }}
                            onClick={() => abrirPreview(adjunto)}
                            title="Haz clic para previsualizar"
                          >
                            {esImg ? (
                              <>
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
                                <div className="position-absolute top-0 start-0 end-0 bottom-0 bg-black bg-opacity-0 hover:bg-opacity-30 transition-all d-flex align-items-center justify-content-center">
                                  <i className="fas fa-eye text-white opacity-0 hover:opacity-100"></i>
                                </div>
                              </>
                            ) : esPdf ? (
                              <div className="d-flex flex-column align-items-center justify-content-center h-100 bg-danger bg-opacity-10">
                                <i className="fas fa-file-pdf text-danger" style={{ fontSize: "2rem" }}></i>
                                <small className="text-muted text-center px-1" style={{ fontSize: "0.7rem" }}>
                                  {adjunto.nombre_original || "PDF"}
                                </small>
                              </div>
                            ) : esDoc ? (
                              <div className="d-flex flex-column align-items-center justify-content-center h-100 bg-primary bg-opacity-10">
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
                            {/* Botón de descarga - Solo visible en hover */}
                            <div className="position-absolute top-1 end-1 opacity-0 hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  descargarArchivo(adjunto);
                                }}
                                className="btn btn-sm btn-primary rounded-circle p-1 shadow"
                                title="Descargar archivo"
                              >
                                <i className="fas fa-download" style={{ fontSize: "0.7rem" }}></i>
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

            <hr />
            <h6>Comentarios de esta tarea:</h6>
            {comentariosDeEstaTarea.length === 0 ? (
  <p>No hay comentarios previos.</p>
) : (
  comentariosDeEstaTarea.map((c) => {
    const estaEnEdicion = comentariosEnEdicion.hasOwnProperty(c.id);
    const fueActualizado = comentariosActualizados[c.id];

    return (
      <ListGroup.Item key={c.id} className={fueActualizado ? 'border-success' : ''}>
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
            <div style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{c.comment}</div>
            <small className="text-muted">
              {formatDateTimeForDisplay(c.fecha)}
            </small>
            {/* ✅ Mostrar adjuntos del comentario */}
            {(() => {
              if (!adjuntosComentarios[c.id] && !loadingAdjuntos[c.id]) {
                // Cargar adjuntos usando los datos del comentario
                setTimeout(() => cargarAdjuntosComentario(c.id, c), 100);
              }
              return <MostrarAdjuntosComentario comentarioId={c.id} />;
            })()}
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
          </>
        )}
      </ListGroup.Item>
    );
  })
)}

           
            <hr />
            

            {tarea.status !== "completed" && (
              <Form.Group className="mt-3">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <Form.Label className="mb-0">Mi respuesta:</Form.Label>
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
                <Form.Control
                  as="textarea"
                  rows={3}
                  value={responseNote}
                  onChange={(e) => setResponseNote(e.target.value)}
                  placeholder="Escribe tu respuesta o usa el botón 'Dictar' para transcribir por voz..."
                />
                {!reconocimientoDisponible && (
                  <Form.Text className="text-muted">
                    <small>
                      <i className="fas fa-info-circle me-1"></i>
                      El dictado por voz no está disponible en tu navegador. Usa Chrome, Edge o Safari para esta función.
                    </small>
                  </Form.Text>
                )}
              </Form.Group>
            )}

            {tarea.status !== "completed" && (
              <Form.Group className="mb-3">
                <Form.Label>Archivos adjuntos (opcional)</Form.Label>
                <div
                  className="border rounded p-3 text-center"
                  style={{
                    borderStyle: "dashed",
                    cursor: "pointer",
                    backgroundColor: "#f8f9fa"
                  }}
                  onClick={() => document.getElementById("file-input-respuesta").click()}
                >
                  <input
                    id="file-input-respuesta"
                    type="file"
                    multiple
                    accept="image/*,.pdf,.doc,.docx"
                    onChange={handleFileInput}
                    style={{ display: "none" }}
                  />
                  <div>
                    <p className="mb-1">Haga clic para seleccionar archivos</p>
                    <small className="text-muted">
                      Formatos: JPG, PNG, GIF, WEBP, PDF, DOC, DOCX (máx. 10MB cada uno)
                    </small>
                  </div>
                </div>

                {archivos.length > 0 && (
                  <div className="mt-3">
                    <div className="d-flex flex-wrap gap-2">
                      {archivos.map((archivo) => (
                        <div
                          key={archivo.id}
                          className="position-relative border rounded p-2"
                          style={{ 
                            width: "100px", 
                            height: "100px",
                            backgroundColor: "#f8f9fa"
                          }}
                        >
                          {archivo.tipo === "imagen" && archivo.preview ? (
                            <img
                              src={archivo.preview}
                              alt={archivo.nombre}
                              className="rounded"
                              style={{
                                width: "100%",
                                height: "70px",
                                objectFit: "cover",
                              }}
                            />
                          ) : (
                            <div className="d-flex flex-column align-items-center justify-content-center h-100">
                              {archivo.tipo === "pdf" ? (
                                <i className="fas fa-file-pdf fa-2x text-danger mb-2"></i>
                              ) : (
                                <i className="fas fa-file-word fa-2x text-primary mb-2"></i>
                              )}
                            </div>
                          )}
                          <button
                            type="button"
                            className="btn btn-sm btn-danger position-absolute top-0 end-0"
                            style={{
                              borderRadius: "50%",
                              width: "20px",
                              height: "20px",
                              padding: 0,
                              fontSize: "10px",
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              eliminarArchivo(archivo.id);
                            }}
                            title="Eliminar archivo"
                          >
                            ×
                          </button>
                          <div
                            className="position-absolute bottom-0 start-0 end-0 bg-dark bg-opacity-75 text-white text-truncate p-1"
                            style={{ fontSize: "8px" }}
                            title={archivo.nombre}
                          >
                            {archivo.nombre.length > 15
                              ? `${archivo.nombre.substring(0, 15)}...`
                              : archivo.nombre}
                          </div>
                        </div>
                      ))}
                    </div>
                    {subiendoArchivos && (
                      <div className="mt-2 text-center">
                        <Spinner animation="border" size="sm" className="me-2" />
                        <small className="text-muted">Subiendo archivos...</small>
                      </div>
                    )}
                  </div>
                )}
              </Form.Group>
            )}
          </Col>

          {/* ✅ Columna derecha: Historial */}
          <Col md={6} style={{ overflowY: "auto", maxHeight: "calc(100vh - 250px)" }}>
            <h6 className="mb-3">📜 Historial del Cliente</h6>
            {loadingHistorial ? (
              <Spinner animation="border" />
            ) : historial.length === 0 ? (
              <p>No hay historial disponible.</p>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px"
                }}
              >
                {historial.map((h, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded"
                    style={{
                      background: "#fff",
                      border: "1px solid #dee2e6",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
                    }}
                  >
                    <div className="d-flex justify-content-between">
                      <strong>
                        {h.tipo === "bitacora" ? "📝 Acción" : "📌 Tarea"}:{" "}
                        <span style={{ color: h.tipo === "bitacora" ? "#0d6efd" : "#dc3545" }}>
                          {h.concepto}
                        </span>
                      </strong>
                      {h.estado && (
                        <Badge
                          bg={
                            h.estado === "completed"
                              ? "success"
                              : h.estado === "pending"
                                ? "warning"
                                : "info"
                          }
                        >
                          {h.estado === "completed" ? "Completada" : h.estado === "pending" ? "Pendiente" : "En progreso"}
                        </Badge>
                      )}
                    </div>
                    <p className="mb-1" style={{ whiteSpace: "pre-wrap" }}>
                          {h.nota || "Sin detalles"}
                        </p>

                    <small className="text-muted">
                      {formatDateTimeForDisplay(h.fecha)} | {h.usuario}
                      {h.asignado_a && ` | Asignado a: ${h.asignado_a}`}
                    </small>

                    {/* ✅ Archivos adjuntos del item del historial */}
                    {(() => {
                      const logId = h.id || h.log_id || h.log?.id;
                      if (!logId) return null;

                      const adjuntosLogItem = adjuntosLog[logId] || [];
                      const estaCargandoAdjuntosLog = loadingAdjuntosLog[logId];
                      const estaExpandido = archivosExpandidos[logId];

                      // Si está cargando, mostrar spinner
                      if (estaCargandoAdjuntosLog) {
                        return (
                          <div className="mt-2">
                            <div className="d-flex align-items-center gap-2 text-muted">
                              <Spinner animation="border" size="sm" style={{ width: "0.75rem", height: "0.75rem" }} />
                              <small>Cargando archivos...</small>
                            </div>
                          </div>
                        );
                      }

                      // Si no hay adjuntos, no mostrar nada
                      if (adjuntosLogItem.length === 0) return null;

                      // Contar tipos de archivos
                      const imagenesCount = adjuntosLogItem.filter(esImagenAdjunto).length;
                      const pdfsCount = adjuntosLogItem.filter(esPDF).length;
                      const wordsCount = adjuntosLogItem.filter(esWord).length;
                      const otrosCount = adjuntosLogItem.length - imagenesCount - pdfsCount - wordsCount;

                      return (
                        <div className="mt-3">
                          {/* Botón para expandir/colapsar archivos */}
                          <button
                            type="button"
                            onClick={() => {
                              if (!estaExpandido) {
                                cargarAdjuntosLog(logId);
                              }
                              setArchivosExpandidos((prev) => ({
                                ...prev,
                                [logId]: !prev[logId],
                              }));
                            }}
                            className="w-100 d-flex align-items-center justify-content-between p-2 bg-light rounded border mb-2"
                            style={{ cursor: "pointer", border: "1px solid #dee2e6" }}
                          >
                            <div className="d-flex align-items-center gap-2 flex-wrap">
                              <i className="fas fa-paperclip text-primary"></i>
                              <span className="fw-semibold" style={{ fontSize: "0.85rem" }}>
                                Archivos adjuntos
                              </span>
                              <span className="badge bg-primary">
                                {adjuntosLogItem.length} {adjuntosLogItem.length === 1 ? "archivo" : "archivos"}
                              </span>
                              {/* Mostrar resumen de tipos de archivos */}
                              <div className="d-flex align-items-center gap-2 ms-2">
                                {imagenesCount > 0 && (
                                  <small className="text-muted">
                                    <i className="fas fa-image text-primary"></i> {imagenesCount}
                                  </small>
                                )}
                                {pdfsCount > 0 && (
                                  <small className="text-muted">
                                    <i className="fas fa-file-pdf text-danger"></i> {pdfsCount}
                                  </small>
                                )}
                                {wordsCount > 0 && (
                                  <small className="text-muted">
                                    <i className="fas fa-file-word text-primary"></i> {wordsCount}
                                  </small>
                                )}
                                {otrosCount > 0 && (
                                  <small className="text-muted">
                                    <i className="fas fa-file text-secondary"></i> {otrosCount}
                                  </small>
                                )}
                              </div>
                            </div>
                            <i className={`fas ${estaExpandido ? "fa-chevron-up" : "fa-chevron-down"} text-muted`}></i>
                          </button>

                          {/* Mostrar archivos cuando está expandido */}
                          {estaExpandido && (
                            <div className="d-flex flex-wrap gap-2">
                              {adjuntosLogItem.map((adjunto) => {
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
                                      <>
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
                                            e.target.parentElement.innerHTML = '<i class="fas fa-image text-muted" style="font-size: 1.5rem; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);"></i>';
                                          }}
                                        />
                                        <div className="position-absolute top-0 start-0 end-0 bottom-0 bg-black bg-opacity-0 hover:bg-opacity-30 transition-all d-flex align-items-center justify-content-center">
                                          <i className="fas fa-eye text-white opacity-0 hover:opacity-100"></i>
                                        </div>
                                      </>
                                    ) : esPdf ? (
                                      <div className="d-flex flex-column align-items-center justify-content-center h-100 bg-danger bg-opacity-10">
                                        <i className="fas fa-file-pdf text-danger" style={{ fontSize: "1.5rem" }}></i>
                                        <small className="text-muted text-center px-1" style={{ fontSize: "0.65rem" }}>
                                          {adjunto.nombre_original || "PDF"}
                                        </small>
                                      </div>
                                    ) : esDoc ? (
                                      <div className="d-flex flex-column align-items-center justify-content-center h-100 bg-primary bg-opacity-10">
                                        <i className="fas fa-file-word text-primary" style={{ fontSize: "1.5rem" }}></i>
                                        <small className="text-muted text-center px-1" style={{ fontSize: "0.65rem" }}>
                                          {adjunto.nombre_original || "Word"}
                                        </small>
                                      </div>
                                    ) : (
                                      <div className="d-flex flex-column align-items-center justify-content-center h-100">
                                        <i className="fas fa-file text-secondary" style={{ fontSize: "1.5rem" }}></i>
                                        <small className="text-muted text-center px-1" style={{ fontSize: "0.65rem" }}>
                                          {adjunto.nombre_original || "Archivo"}
                                        </small>
                                      </div>
                                    )}
                                    {/* Botón de descarga - Solo visible en hover */}
                                    <div className="position-absolute top-1 end-1 opacity-0 hover:opacity-100 transition-opacity">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          descargarArchivo(adjunto);
                                        }}
                                        className="btn btn-sm btn-primary rounded-circle p-1 shadow"
                                        title="Descargar archivo"
                                        style={{ width: "24px", height: "24px", padding: "2px" }}
                                      >
                                        <i className="fas fa-download" style={{ fontSize: "0.6rem" }}></i>
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

                    {/* ✅ Mostrar comentarios si existen */}
                    {h.comentarios && h.comentarios.length > 0 && (
                      <div
                        className="mt-2 p-2 rounded"
                        style={{
                          background: "#f8f9fa",
                          border: "1px solid #dee2e6",
                          fontSize: "0.85rem"
                        }}
                      >
                        <strong>💬 Comentarios:</strong>
                        {h.comentarios.map((c) => {
                          if (!c.id) {
                            console.warn("⚠️ Comentario historial sin ID, saltando:", c);
                            return null;
                          }

                          const estaEnEdicion = comentariosHistorialEnEdicion.hasOwnProperty(c.id);
                          const fueActualizado = comentariosHistorialActualizados[c.id];

                          console.log('🔍 Renderizando comentario historial:', { 
                            id: c.id, 
                            comment: c.comment, 
                            estaEnEdicion,
                            fueActualizado
                          });

                          return (
                            <div 
                              key={c.id} 
                              style={{ 
                                borderBottom: "1px solid #e9ecef", 
                                padding: "4px 0",
                                backgroundColor: fueActualizado ? '#d4edda' : 'transparent'
                              }}
                            >
                              {fueActualizado && (
                                <Badge bg="success" size="sm" className="mb-1">Actualizado ✓</Badge>
                              )}
                              
                              {estaEnEdicion ? (
                                <>
                                  <Form.Control
                                    as="textarea"
                                    rows={2}
                                    value={comentariosHistorialEnEdicion[c.id]}
                                    onChange={(e) =>
                                      setComentariosHistorialEnEdicion((prev) => ({
                                        ...prev,
                                        [c.id]: e.target.value,
                                      }))
                                    }
                                    className="mb-2"
                                  />
                                  <div className="d-flex gap-2">
                                    <Button
                                      size="sm"
                                      variant="success"
                                      onClick={() => handleGuardarComentarioHistorial(c.id)}
                                      disabled={!comentariosHistorialEnEdicion[c.id]?.trim()}
                                    >
                                      Guardar
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      onClick={() =>
                                        setComentariosHistorialEnEdicion((prev) => {
                                          const nuevo = { ...prev };
                                          delete nuevo[c.id];
                                          return nuevo;
                                        })
                                      }
                                    >
                                      Cancelar
                                    </Button>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <span>
                                    <strong>{c.user}</strong>: {c.comment}
                                  </span>
                                  <br />
                                  <small className="text-muted">
                                    {c.fecha ? formatDateTimeForDisplay(c.fecha) : "Fecha inválida"}
                                  </small>
                                  {/* ✅ Mostrar adjuntos del comentario del historial */}
                                  {(() => {
                                    if (!adjuntosComentarios[c.id] && !loadingAdjuntos[c.id]) {
                                      // Cargar adjuntos usando los datos del comentario
                                      setTimeout(() => cargarAdjuntosComentario(c.id, c), 100);
                                    }
                                    return <MostrarAdjuntosComentario comentarioId={c.id} />;
                                  })()}
                                  <div className="mt-1">
                                    <Button
                                      size="sm"
                                      variant="outline-secondary"
                                      onClick={() =>
                                        setComentariosHistorialEnEdicion((prev) => ({
                                          ...prev,
                                          [c.id]: c.comment,
                                        }))
                                      }
                                    >
                                      ✏️ Editar
                                    </Button>
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

          </Col>
        </Row>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={() => onHide(false)}>
          Cerrar
        </Button>
        {tarea.status !== "completed" && (
          <>
            <Button variant="primary" onClick={handleActualizarFechas}>
              Actualizar Fechas
            </Button>
            <Button variant="info" onClick={handleAgregarComentario}>
              Agregar Comentario
            </Button>
            <Button variant="success" onClick={handleCompletar}>
              Marcar completada
            </Button>
          </>
        )}
      </Modal.Footer>
    </Modal>

    {/* ✅ Modal de preview de archivos */}
    {archivoPreview && (
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
                window.open(archivoPreview.adjunto.url, "_blank", "noopener,noreferrer");
              }}
            >
              <i className="fas fa-external-link-alt me-2"></i>
              Abrir en nueva pestaña
            </Button>
          )}
        </Modal.Footer>
      </Modal>
    )}
    </>
  );
};

export default ResponderTareaModal;