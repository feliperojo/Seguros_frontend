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
import { useMentionableQuill } from "../../hooks/useMentionableQuill";
import { extractMentionedUserIds } from "../../utils/mentions";

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

  // ✅ Estados para menciones
  const [usuarios, setUsuarios] = useState([]); // Lista de usuarios para menciones
  const [mentionedUserIds, setMentionedUserIds] = useState([]); // IDs de usuarios mencionados

  // ✅ Hook para manejo de menciones en Quill
  const {
    quillRef: mentionQuillRef,
    showMentionList,
    mentionList,
    selectedMentionIndex,
    insertMention,
    handleQuillChange,
    handleQuillKeyDown,
    updateSelectedIndex,
  } = useMentionableQuill(usuarios, (ids) => {
    setMentionedUserIds(ids);
  });

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

  // ✅ Cargar usuarios para menciones
  useEffect(() => {
    if (!show) return;
    
    let mounted = true;
    const cargarUsuarios = async () => {
      try {
        // Intentar varios endpoints comunes
        let response = null;
        try {
          response = await apiRequest("users?per_page=1000", "GET");
        } catch (e) {
          try {
            response = await apiRequest("/v1/users?per_page=1000", "GET");
          } catch (e2) {
            console.error("Error al cargar usuarios:", e2);
          }
        }
        
        if (!response) {
          if (mounted) {
            setUsuarios([]);
          }
          return;
        }
        
        // El endpoint puede retornar diferentes estructuras
        let usuariosData = [];
        
        if (response?.success && Array.isArray(response.data)) {
          usuariosData = response.data;
        } else if (Array.isArray(response)) {
          // Fallback: si viene como array directo
          usuariosData = response;
        } else if (response?.data && Array.isArray(response.data)) {
          // Fallback: si viene con data pero sin success
          usuariosData = response.data;
        } else if (response?.data?.data && Array.isArray(response.data.data)) {
          // Estructura anidada: { data: { data: [...] } }
          usuariosData = response.data.data;
        } else if (response?.users && Array.isArray(response.users)) {
          usuariosData = response.users;
        }
        
        // Normalizar estructura de usuarios
        const usuariosNormalizados = usuariosData.map(u => ({
          id: u.id,
          name: u.name || u.nombre || u.username || '',
          nombre: u.nombre || u.name || u.username || '',
          email: u.email || '',
        })).filter(u => u.id && u.name); // Solo usuarios válidos
        
        if (mounted) {
          setUsuarios(usuariosNormalizados);
          console.log(`✅ ${usuariosNormalizados.length} usuarios cargados para menciones y asignación`);
        }
      } catch (err) {
        console.error("❌ Error al cargar usuarios:", err);
        if (mounted) {
          setUsuarios([]);
        }
      }
    };
    
    cargarUsuarios();
    return () => { mounted = false; };
  }, [show]);

  // ✅ Verificar disponibilidad del reconocimiento de voz
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
          if (quillEditorRef.current) {
            const quill = quillEditorRef.current.getEditor();
            const length = quill.getLength();
            quill.insertText(length - 1, (quill.getText(length - 2, 1) !== '' ? ' ' : '') + textoTranscrito + ' ');
            quill.setSelection(length + textoTranscrito.length);
            setResponseNote(quill.root.innerHTML);
          } else {
            setResponseNote((prev) => prev + (prev && !prev.endsWith(' ') ? ' ' : '') + textoTranscrito + ' ');
          }
        }
      };

      recognition.onerror = (event) => {
        console.error('Error en reconocimiento de voz:', event.error);
        if (event.error === 'no-speech') {
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

  // ✅ Detener grabación cuando se cierra el modal
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

  // ✅ Funciones para el dictado
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

      // ✅ Extraer IDs de usuarios mencionados del contenido
      const mentionedIds = extractMentionedUserIds(responseNote, usuarios);
      
      // 📝 Log de depuración: Menciones detectadas (agregar comentario)
      if (import.meta.env.DEV) {
        console.log("🔔 [NOTIFICACIONES] Agregando comentario con menciones:", {
          tarea_id: tarea.id,
          nota_preview: responseNote?.substring(0, 100) || "",
          mentioned_user_ids: mentionedIds,
          usuarios_mencionados: usuarios.filter(u => mentionedIds.includes(u.id)).map(u => ({ id: u.id, name: u.name })),
          endpoint: `tareas_operativas/${tarea.id}/comentarios`
        });
      }
      
      const data = await apiRequest(
        `tareas_operativas/${tarea.id}/comentarios`,
        "POST",
        { 
          comment: responseNote || " ",
          mentioned_user_ids: mentionedIds.length > 0 ? mentionedIds : undefined
        }
      );

      console.log("✅ Respuesta del comentario:", data);
      
      // 📝 Log de depuración: Confirmación de creación de comentario
      if (import.meta.env.DEV) {
        const comentarioId = data?.comment?.id || data?.id || data?.data?.id;
        console.log("✅ [NOTIFICACIONES] Comentario creado exitosamente:", {
          comentario_id: comentarioId,
          mentioned_user_ids_enviados: mentionedIds,
          respuesta_backend: {
            comment_id: data?.comment?.id,
            id: data?.id,
            data_id: data?.data?.id
          }
        });
      }

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

        // ✅ Extraer IDs de usuarios mencionados del contenido
        const mentionedIds = extractMentionedUserIds(responseNote, usuarios);
        
        // 📝 Log de depuración: Menciones detectadas (completar tarea)
        if (import.meta.env.DEV) {
          console.log("🔔 [NOTIFICACIONES] Completando tarea con comentario y menciones:", {
            tarea_id: tarea.id,
            nota_preview: responseNote?.substring(0, 100) || "",
            mentioned_user_ids: mentionedIds,
            usuarios_mencionados: usuarios.filter(u => mentionedIds.includes(u.id)).map(u => ({ id: u.id, name: u.name })),
            endpoint: `tareas_operativas/${tarea.id}/comentarios`
          });
        }

        const data = await apiRequest(
          `tareas_operativas/${tarea.id}/comentarios`,
          "POST",
          { 
            comment: responseNote || " ",
            mentioned_user_ids: mentionedIds.length > 0 ? mentionedIds : undefined
          }
        );

        console.log("✅ Respuesta del comentario:", data);
        
        // 📝 Log de depuración: Confirmación de creación de comentario al completar
        if (import.meta.env.DEV) {
          const comentarioId = data?.comment?.id || data?.id || data?.data?.id;
          console.log("✅ [NOTIFICACIONES] Comentario creado al completar tarea:", {
            comentario_id: comentarioId,
            tarea_id: tarea.id,
            mentioned_user_ids_enviados: mentionedIds,
            respuesta_backend: {
              comment_id: data?.comment?.id,
              id: data?.id,
              data_id: data?.data?.id
            }
          });
        }

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
          font-size: 14px;
          line-height: 1.5;
          padding: 0;
          color: #212529;
          word-wrap: break-word;
          overflow-wrap: break-word;
        }
        .ql-editor p {
          margin: 0 0 0.25em 0;
          white-space: normal;
        }
        .ql-editor p:last-child {
          margin-bottom: 0;
        }
        .ql-editor p:empty {
          height: 0;
          margin: 0;
          display: none;
        }
        .ql-editor p:empty:only-child {
          display: block;
          height: 0.25em;
        }
        .ql-editor br {
          display: block;
          content: "";
          margin-bottom: 0.25em;
          line-height: 0.25em;
        }
        .ql-editor br:last-child {
          margin-bottom: 0;
        }
        .ql-editor p + br {
          margin-top: -0.25em;
        }
        .ql-editor strong {
          font-weight: 600;
          color: #212529;
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
          color: #0d6efd;
          text-decoration: underline;
        }
        .ql-editor a:hover {
          color: #0a58ca;
        }
        .ql-editor ul, .ql-editor ol {
          padding-left: 1.5em;
          margin: 0.5em 0;
        }
        .ql-editor blockquote {
          border-left: 4px solid #dee2e6;
          padding-left: 1em;
          margin: 0.5em 0;
          color: #6c757d;
        }
        .ql-editor code {
          background-color: #f8f9fa;
          padding: 0.2em 0.4em;
          border-radius: 0.25em;
          font-family: 'Courier New', monospace;
          font-size: 0.9em;
          border: 1px solid #dee2e6;
        }
        .ql-editor pre {
          background-color: #f8f9fa;
          padding: 0.75em;
          border-radius: 0.25em;
          overflow-x: auto;
          margin: 0.5em 0;
          border: 1px solid #dee2e6;
        }
        .ql-editor .ql-size-small {
          font-size: 0.75em;
        }
        .ql-editor .ql-size-large {
          font-size: 1.25em;
        }
        .ql-editor .ql-size-huge {
          font-size: 1.5em;
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
      <Modal.Header 
        closeButton 
        className="border-bottom bg-light"
        style={{ padding: "1.25rem 1.5rem" }}
      >
        <div className="d-flex align-items-center w-100">
          <div 
            className="d-flex align-items-center justify-content-center rounded-circle me-3"
            style={{ 
              width: "40px", 
              height: "40px", 
              background: esCerrada ? "#6c757d" : "#0d6efd",
              color: "white"
            }}
          >
            <i className={`fas ${esCerrada ? "fa-check-circle" : "fa-tasks"}`}></i>
          </div>
          <div className="flex-grow-1">
            <Modal.Title className="text-dark fw-bold mb-0" style={{ fontSize: "1.15rem" }}>
              {esCerrada ? "Detalle de Tarea" : "Responder Tarea"}
            </Modal.Title>
            <small className="text-muted">
              {esCerrada ? "Tarea completada" : "Agrega tu respuesta o completa la tarea"}
            </small>
          </div>
        </div>
      </Modal.Header>
      <Modal.Body style={{ padding: "1.5rem", maxHeight: "calc(100vh - 200px)", overflowY: "auto" }}>
        <Row>
          {/* Columna completa: Tarea */}
          <Col md={12}>
            {/* Card de información de la tarea - Diseño moderno */}
            <div
              className="mb-4 rounded shadow-sm"
              style={{ 
                background: "linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)",
                border: "1px solid #e9ecef",
                overflow: "hidden"
              }}
            >
              {/* Header del card */}
              <div 
                className="px-4 py-3"
                style={{ 
                  background: "#f8f9fa",
                  borderBottom: "2px solid #e9ecef"
                }}
              >
                <div className="d-flex align-items-center">
                  <div 
                    className="d-flex align-items-center justify-content-center rounded me-3"
                    style={{ 
                      width: "36px", 
                      height: "36px", 
                      background: "#0d6efd",
                      color: "white"
                    }}
                  >
                    <i className="fas fa-clipboard-list"></i>
                  </div>
                  <div>
                    <h6 className="mb-0 text-dark fw-bold">Información de la Tarea</h6>
                    <small className="text-muted">Detalles y contexto</small>
                  </div>
                </div>
              </div>
              
              {/* Contenido del card */}
              <div className="px-4 py-3">
                <div className="mb-3">
                  <label className="text-muted small fw-semibold text-uppercase mb-1 d-block" style={{ fontSize: "0.7rem", letterSpacing: "0.5px" }}>
                    Concepto
                  </label>
                  <h6 className="mb-0 text-dark fw-semibold" style={{ fontSize: "1rem" }}>
                    {conceptoTarea}
                  </h6>
                </div>
                
                {notaTarea && (
                  <div className="mb-0 pt-3 border-top">
                    <label className="text-muted small fw-semibold text-uppercase mb-2 d-block" style={{ fontSize: "0.7rem", letterSpacing: "0.5px" }}>
                      Nota
                    </label>
                    <div 
                      className="ql-editor"
                      style={{ 
                        fontSize: '14px',
                        lineHeight: '1.6',
                        wordBreak: 'break-word',
                        overflowWrap: 'break-word',
                        color: '#495057',
                        background: "#fff",
                        padding: "0.75rem",
                        borderRadius: "0.375rem",
                        border: "1px solid #e9ecef"
                      }}
                      dangerouslySetInnerHTML={{ __html: notaTarea || 'Sin nota' }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Detalles de la Tarea - Diseño moderno */}
            <div
              className="mb-4 rounded shadow-sm"
              style={{ 
                background: "#fff", 
                border: "1px solid #e9ecef"
              }}
            >
              <div 
                className="px-4 py-3"
                style={{ 
                  background: "#f8f9fa",
                  borderBottom: "1px solid #e9ecef"
                }}
              >
                <h6 className="mb-0 text-dark fw-bold" style={{ fontSize: "0.95rem" }}>
                  <i className="fas fa-info-circle text-primary me-2"></i>
                  Detalles y Fechas
                </h6>
              </div>
              <div className="px-4 py-3">
                {!esCerrada ? (
                  <>
                    <Row className="g-3 mb-3">
                      <Col md={6}>
                        <Form.Group>
                          <Form.Label className="text-muted small fw-semibold mb-2 d-block">
                            <i className="fas fa-calendar-alt text-primary me-2"></i>
                            Fecha Programada
                          </Form.Label>
                          <Form.Control
                            type="date"
                            value={scheduledDate}
                            onChange={(e) => setScheduledDate(e.target.value)}
                            className="border-secondary"
                            style={{ borderRadius: "0.5rem" }}
                          />
                        </Form.Group>
                      </Col>
                      <Col md={6}>
                        <Form.Group>
                          <Form.Label className="text-muted small fw-semibold mb-2 d-block">
                            <i className="fas fa-clock text-warning me-2"></i>
                            Fecha de Vencimiento
                          </Form.Label>
                          <Form.Control
                            type="date"
                            value={dueDate}
                            onChange={(e) => setDueDate(e.target.value)}
                            className="border-secondary"
                            style={{ borderRadius: "0.5rem" }}
                          />
                        </Form.Group>
                      </Col>
                    </Row>
                    <div className="pt-3 border-top">
                      <div className="d-flex align-items-center">
                        <div 
                          className="d-flex align-items-center justify-content-center rounded-circle me-3"
                          style={{ 
                            width: "32px", 
                            height: "32px", 
                            background: "#e7f3ff",
                            color: "#0d6efd"
                          }}
                        >
                          <i className="fas fa-user"></i>
                        </div>
                        <div>
                          <small className="text-muted d-block" style={{ fontSize: "0.75rem" }}>Asignada por</small>
                          <span className="text-dark fw-semibold">{asignadoPor}</span>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mb-3">
                      <label className="text-muted small fw-semibold mb-2 d-block">
                        <i className="fas fa-calendar-alt text-primary me-2"></i>
                        Fecha Programada
                      </label>
                      <Badge bg="secondary" className="px-3 py-2" style={{ fontSize: "0.875rem" }}>
                        {formatFecha(tarea?.scheduled_date)}
                      </Badge>
                    </div>
                    <div className="mb-3">
                      <label className="text-muted small fw-semibold mb-2 d-block">
                        <i className="fas fa-clock text-warning me-2"></i>
                        Fecha de Vencimiento
                      </label>
                      <Badge bg={getBadgeColor(tarea?.due_date)} className="px-3 py-2" style={{ fontSize: "0.875rem" }}>
                        {formatFecha(tarea?.due_date)}
                      </Badge>
                    </div>
                    <div className="pt-3 border-top">
                      <div className="d-flex align-items-center">
                        <div 
                          className="d-flex align-items-center justify-content-center rounded-circle me-3"
                          style={{ 
                            width: "32px", 
                            height: "32px", 
                            background: "#e7f3ff",
                            color: "#0d6efd"
                          }}
                        >
                          <i className="fas fa-user"></i>
                        </div>
                        <div>
                          <small className="text-muted d-block" style={{ fontSize: "0.75rem" }}>Asignada por</small>
                          <span className="text-dark fw-semibold">{asignadoPor}</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Comentarios de esta tarea - Diseño moderno */}
            <div className="mb-4">
              <div 
                className="d-flex align-items-center justify-content-between mb-3 px-2"
              >
                <div className="d-flex align-items-center">
                  <div 
                    className="d-flex align-items-center justify-content-center rounded-circle me-3"
                    style={{ 
                      width: "36px", 
                      height: "36px", 
                      background: "#e7f3ff",
                      color: "#0d6efd"
                    }}
                  >
                    <i className="fas fa-comments"></i>
                  </div>
                  <div>
                    <h6 className="mb-0 text-dark fw-bold" style={{ fontSize: "0.95rem" }}>
                      Comentarios
                    </h6>
                    <small className="text-muted">
                      {comentariosDeEstaTarea.length} {comentariosDeEstaTarea.length === 1 ? 'comentario' : 'comentarios'}
                    </small>
                  </div>
                </div>
              </div>
              {comentariosDeEstaTarea.length === 0 ? (
                <div 
                  className="text-center py-5 rounded"
                  style={{ 
                    background: "#f8f9fa",
                    border: "2px dashed #dee2e6"
                  }}
                >
                  <i className="fas fa-comment-slash text-muted mb-2" style={{ fontSize: "2rem" }}></i>
                  <p className="text-muted mb-0 small">No hay comentarios previos</p>
                </div>
              ) : (
                <div className="d-flex flex-column gap-3">
                  {comentariosDeEstaTarea.map((c) => {
                    const estaEnEdicion = comentariosEnEdicion.hasOwnProperty(c.id);
                    const fueActualizado = comentariosActualizados[c.id];

                    return (
                      <div
                        key={c.id}
                        className="rounded shadow-sm"
                        style={{ 
                          background: "#fff", 
                          border: fueActualizado ? "2px solid #198754" : "1px solid #e9ecef",
                          borderLeft: fueActualizado ? "4px solid #198754" : "4px solid #0d6efd",
                          overflow: "hidden",
                          transition: "all 0.2s ease"
                        }}
                      >
                        <div 
                          className="px-3 py-2"
                          style={{ 
                            background: fueActualizado ? "#d1e7dd" : "#f8f9fa",
                            borderBottom: "1px solid #e9ecef"
                          }}
                        >
                          <div className="d-flex align-items-center justify-content-between">
                            <div className="d-flex align-items-center">
                              <div 
                                className="d-flex align-items-center justify-content-center rounded-circle me-2"
                                style={{ 
                                  width: "28px", 
                                  height: "28px", 
                                  background: "#0d6efd",
                                  color: "white",
                                  fontSize: "0.75rem"
                                }}
                              >
                                <i className="fas fa-user"></i>
                              </div>
                              <strong className="text-dark" style={{ fontSize: "0.875rem" }}>
                                {c.user || "Usuario"}
                              </strong>
                            </div>
                            {fueActualizado && (
                              <Badge bg="success" className="small">
                                <i className="fas fa-check me-1"></i>
                                Actualizado
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="px-3 py-3">

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
                                rows={3}
                                className="mb-3"
                                style={{ borderRadius: "0.5rem", border: "1px solid #ced4da" }}
                              />
                              <div className="d-flex gap-2">
                                <Button
                                  size="sm"
                                  variant="success"
                                  onClick={() => handleGuardarComentarioTarea(c.id)}
                                  disabled={!comentariosEnEdicion[c.id]?.trim()}
                                  style={{ borderRadius: "0.5rem" }}
                                >
                                  <i className="fas fa-check me-1"></i>
                                  Guardar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline-secondary"
                                  onClick={() => {
                                    setComentariosEnEdicion((prev) => {
                                      const nuevo = { ...prev };
                                      delete nuevo[c.id];
                                      return nuevo;
                                    });
                                  }}
                                  style={{ borderRadius: "0.5rem" }}
                                >
                                  Cancelar
                                </Button>
                              </div>
                            </>
                          ) : (
                            <>
                              <div 
                                className="ql-editor mb-3"
                                style={{ 
                                  fontSize: '14px',
                                  lineHeight: '1.6',
                                  wordBreak: 'break-word',
                                  overflowWrap: 'break-word',
                                  color: '#495057',
                                  minHeight: "20px"
                                }}
                                dangerouslySetInnerHTML={{ __html: c.comment || 'Sin contenido' }}
                              />
                              <div 
                                className="d-flex align-items-center justify-content-between pt-2 border-top"
                                style={{ borderColor: "#e9ecef" }}
                              >
                                <small className="text-muted d-flex align-items-center">
                                  <i className="fas fa-clock me-1"></i>
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
                                {!esCerrada && (
                                  <Button
                                    size="sm"
                                    variant="outline-secondary"
                                    onClick={() => {
                                      setComentariosEnEdicion((prev) => ({
                                        ...prev,
                                        [c.id]: c.comment,
                                      }));
                                    }}
                                    style={{ 
                                      fontSize: "0.75rem", 
                                      padding: "0.25rem 0.75rem",
                                      borderRadius: "0.5rem"
                                    }}
                                  >
                                    <i className="fas fa-edit me-1"></i>
                                    Editar
                                  </Button>
                                )}
                              </div>
                              {/* ✅ Mostrar adjuntos del comentario */}
                              {(() => {
                                if (!adjuntosComentarios[c.id] && !loadingAdjuntos[c.id]) {
                                  setTimeout(() => cargarAdjuntosComentario(c.id, c), 100);
                                }
                                return <MostrarAdjuntosComentario comentarioId={c.id} />;
                              })()}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Campo para nuevo comentario - Diseño moderno */}
            {!esCerrada && (
              <div 
                className="rounded shadow-sm"
                style={{ 
                  background: "#fff",
                  border: "1px solid #e9ecef"
                }}
              >
                <div 
                  className="px-4 py-3"
                  style={{ 
                    background: "linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%)",
                    borderBottom: "2px solid #0d6efd"
                  }}
                >
                  <div className="d-flex align-items-center">
                    <div 
                      className="d-flex align-items-center justify-content-center rounded-circle me-3"
                      style={{ 
                        width: "36px", 
                        height: "36px", 
                        background: "#0d6efd",
                        color: "white"
                      }}
                    >
                      <i className="fas fa-edit"></i>
                    </div>
                    <div>
                      <h6 className="mb-0 text-dark fw-bold" style={{ fontSize: "0.95rem" }}>
                        Mi Respuesta
                      </h6>
                      <small className="text-muted">Escribe tu comentario o completa la tarea</small>
                    </div>
                  </div>
                </div>
                <div className="px-4 py-3">
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
                <div style={{ position: 'relative' }}>
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
                    ref={mentionQuillRef}
                    theme="snow"
                    value={responseNote || ""}
                    onChange={(value, delta, source, editor) => {
                      setResponseNote(value);
                      if (editor && !quillEditorRef.current) {
                        quillEditorRef.current = editor;
                      }
                      handleQuillChange(value, delta, source, editor);
                    }}
                    onKeyDown={handleQuillKeyDown}
                    modules={quillModules}
                    formats={quillFormats}
                    placeholder="Escribe tu respuesta o usa el botón 'Dictar' para transcribir por voz. Escribe @ para mencionar usuarios. Use la barra de herramientas para formatear el texto..."
                    style={{
                      backgroundColor: '#fff',
                      border: '1px solid #dee2e6',
                      borderRadius: '0.375rem'
                    }}
                  />
                  
                  {/* ✅ Dropdown de menciones */}
                  {showMentionList && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        backgroundColor: 'white',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                        zIndex: 1000,
                        maxHeight: '250px',
                        overflowY: 'auto',
                        marginTop: '4px',
                      }}
                    >
                      {usuarios.length === 0 ? (
                        <div style={{ padding: '12px', textAlign: 'center', color: '#666' }}>
                          <Spinner size="sm" animation="border" className="me-2" />
                          Cargando usuarios...
                        </div>
                      ) : mentionList.length === 0 ? (
                        <div style={{ padding: '12px', textAlign: 'center', color: '#666' }}>
                          No se encontraron usuarios
                        </div>
                      ) : (
                        <>
                          <div style={{ 
                            padding: '6px 12px', 
                            fontSize: '0.75rem', 
                            color: '#666', 
                            backgroundColor: '#f8f9fa',
                            borderBottom: '1px solid #e0e0e0',
                            fontWeight: 500
                          }}>
                            {mentionList.length} {mentionList.length === 1 ? 'usuario' : 'usuarios'} encontrado{mentionList.length > 1 ? 's' : ''}
                          </div>
                          {mentionList.map((user, index) => (
                            <div
                              key={user.id}
                              onClick={() => insertMention(user)}
                              onMouseEnter={() => {
                                if (updateSelectedIndex) {
                                  updateSelectedIndex(index);
                                }
                              }}
                              style={{
                                padding: '10px 12px',
                                cursor: 'pointer',
                                backgroundColor: index === selectedMentionIndex ? '#e3f2fd' : 'transparent',
                                borderBottom: index < mentionList.length - 1 ? '1px solid #f0f0f0' : 'none',
                                transition: 'background-color 0.15s ease',
                              }}
                            >
                              <div style={{ 
                                fontWeight: 500, 
                                color: '#1976d2',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                              }}>
                                <i className="fas fa-user-circle" style={{ fontSize: '1.1rem' }}></i>
                                {user.name || user.nombre || 'Usuario'}
                              </div>
                              {user.email && (
                                <div style={{ 
                                  fontSize: '0.85rem', 
                                  color: '#666',
                                  marginTop: '2px',
                                  marginLeft: '24px'
                                }}>
                                  {user.email}
                                </div>
                              )}
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* ✅ Área de carga de archivos */}
                <Form.Group className="mt-4">
                  <Form.Label className="fw-semibold mb-2">
                    <i className="fas fa-paperclip me-2 text-primary"></i>
                    Archivos Adjuntos
                    <small className="text-muted ms-2">(opcional)</small>
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
              </div>
            )}
          </Col>
        </Row>
      </Modal.Body>
      
      <Modal.Footer 
        className="border-top bg-light"
        style={{ padding: "1rem 1.5rem" }}
      >
        <Button 
          variant="outline-secondary" 
          onClick={() => onHide(false)}
          style={{ borderRadius: "0.5rem", minWidth: "100px" }}
        >
          <i className="fas fa-times me-1"></i>
          Cerrar
        </Button>
        {!esCerrada && (
          <>
            <Button 
              variant="outline-primary" 
              onClick={handleActualizarFechas}
              disabled={loading}
              style={{ borderRadius: "0.5rem", minWidth: "140px" }}
            >
              <i className="fas fa-calendar-alt me-1"></i>
              Actualizar Fechas
            </Button>
            <Button 
              variant="primary" 
              onClick={handleAgregarComentario}
              disabled={loading}
              style={{ borderRadius: "0.5rem", minWidth: "160px" }}
            >
              <i className="fas fa-comment me-1"></i>
              Agregar Comentario
            </Button>
            <Button 
              variant="success" 
              onClick={handleCompletar}
              disabled={loading}
              style={{ borderRadius: "0.5rem", minWidth: "160px", fontWeight: "600" }}
            >
              <i className="fas fa-check-circle me-1"></i>
              Completar Tarea
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