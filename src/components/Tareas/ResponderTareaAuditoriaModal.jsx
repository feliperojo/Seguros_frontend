// src/components/Tareas/ResponderTareaAuditoriaModal.jsx
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
import { formatDateTimeForDisplay, formatTaskTimeDhm, durationFromStartToEnd, formatDhmString } from "../../utils/formatters";
import { isTaskOverdue } from "../../utils/taskDueDate";
import { useMentionableQuill } from "../../hooks/useMentionableQuill";
import { extractMentionedUserIds, highlightMentions } from "../../utils/mentions";
import { 
  getTask,
  getTaskComments, 
  addComment, 
  updateComment,
  completeTask, 
  rescheduleTask, 
  assignTask,
  updateTask 
} from "../../services/auditoriasTasksService";
import useToast from "../../hooks/useToast";
import { useAuth } from "../../context/AuthContext";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
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

// Convierte HTML a texto plano (para mostrar en el textarea de edición sin etiquetas)
const htmlToPlainText = (html) => {
  if (!html || typeof html !== 'string') return '';
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  return (tempDiv.textContent || tempDiv.innerText || '').trim();
};

// Función helper para convertir fecha a formato YYYY-MM-DD
const fechaToInputDate = (fecha) => {
  if (!fecha) return "";
  try {
    if (typeof fecha === "string") {
      const fechaPart = fecha.split("T")[0];
      if (fechaPart.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return fechaPart;
      }
    }
    const date = new Date(fecha);
    if (isNaN(date.getTime())) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  } catch {
    return "";
  }
};

const ResponderTareaAuditoriaModal = ({ show, onHide, tarea, onUpdated }) => {
  const toast = useToast();
  const { hasPermission, hasRole } = useAuth();
  
  const [responseNote, setResponseNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [comentarios, setComentarios] = useState([]);
  const [cargandoComentarios, setCargandoComentarios] = useState(false);
  
  // Estados para edición de comentarios
  const [comentariosEnEdicion, setComentariosEnEdicion] = useState({});
  const [comentariosActualizados, setComentariosActualizados] = useState({});
  
  // Estados para adjuntos de comentarios
  const [adjuntosComentarios, setAdjuntosComentarios] = useState({});
  const [loadingAdjuntos, setLoadingAdjuntos] = useState({});
  const [archivosExpandidos, setArchivosExpandidos] = useState({});
  const [archivoPreview, setArchivoPreview] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [errorCargaArchivo, setErrorCargaArchivo] = useState(false);
  
  // Estados para confirmación
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showConfirmCompletarModal, setShowConfirmCompletarModal] = useState(false);
  
  const [scheduledDate, setScheduledDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  // Fecha límite: solo editable por admin o con contraseña de administrador
  const [dueDateUnlocked, setDueDateUnlocked] = useState(false);
  const [showDueDatePasswordModal, setShowDueDatePasswordModal] = useState(false);
  const [adminPasswordForDueDate, setAdminPasswordForDueDate] = useState("");
  const [adminPasswordInput, setAdminPasswordInput] = useState("");
  const canEditDueDateWithoutPassword = hasPermission("users.view") || hasRole("admin") || false;
  const isDueDateLocked = tarea?.id && !canEditDueDateWithoutPassword && !dueDateUnlocked;
  const [selectedUserId, setSelectedUserId] = useState("");
  const [usuarios, setUsuarios] = useState([]);
  const [mentionedUserIds, setMentionedUserIds] = useState([]);
  
  // Estados para archivos adjuntos
  const [archivos, setArchivos] = useState([]);
  const [subiendoArchivos, setSubiendoArchivos] = useState(false);

  // Estados para reconocimiento de voz
  const [grabando, setGrabando] = useState(false);
  const [reconocimientoDisponible, setReconocimientoDisponible] = useState(false);
  const [reconocimientoVoz, setReconocimientoVoz] = useState(null);
  const grabandoRef = useRef(false);
  const quillEditorRef = useRef(null);
  const esTareaVencida =
    tarea?.due_date &&
    isTaskOverdue(tarea.due_date) &&
    tarea?.status !== "completed";
  
  // Hook para manejo de menciones en Quill
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
  
  // Cargar datos de la tarea cuando se abre el modal
  useEffect(() => {
    if (show && tarea?.id) {
      setScheduledDate(fechaToInputDate(tarea.scheduled_date) || "");
      setDueDate(fechaToInputDate(tarea.due_date) || "");
      setSelectedUserId(tarea.assigned_user_id || "");
      setDueDateUnlocked(false);
      setShowDueDatePasswordModal(false);
      setAdminPasswordForDueDate("");
      setAdminPasswordInput("");
      cargarComentarios();
    } else {
      setResponseNote("");
      setComentarios([]);
      setArchivos([]);
      setMentionedUserIds([]);
    }
  }, [show, tarea?.id]);
  
  // Cargar usuarios para menciones y asignación
  useEffect(() => {
    if (!show) return;
    
    let mounted = true;
    const cargarUsuarios = async () => {
      try {
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
        
        if (!response || !mounted) return;
        
        let usuariosData = [];
        if (response?.success && Array.isArray(response.data)) {
          usuariosData = response.data;
        } else if (Array.isArray(response)) {
          usuariosData = response;
        } else if (response?.data && Array.isArray(response.data)) {
          usuariosData = response.data;
        } else if (response?.data?.data && Array.isArray(response.data.data)) {
          usuariosData = response.data.data;
        } else if (response?.users && Array.isArray(response.users)) {
          usuariosData = response.users;
        }
        
        const usuariosNormalizados = usuariosData.map(u => ({
          id: u.id,
          name: u.name || u.nombre || u.username || '',
          nombre: u.nombre || u.name || u.username || '',
          email: u.email || '',
        })).filter(u => u.id && u.name);
        
        if (mounted) {
          setUsuarios(usuariosNormalizados);
        }
      } catch (err) {
        console.error("Error al cargar usuarios:", err);
      }
    };
    
    cargarUsuarios();
    return () => { mounted = false; };
  }, [show]);
  
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
        
        if (textoTranscrito && quillEditorRef.current) {
          const quill = quillEditorRef.current.getEditor 
            ? quillEditorRef.current.getEditor() 
            : quillEditorRef.current;
          if (quill) {
            const length = quill.getLength();
            quill.insertText(length - 1, (quill.getText(length - 2, 1) !== '' ? ' ' : '') + textoTranscrito + ' ');
            quill.setSelection(length + textoTranscrito.length);
            setResponseNote(quill.root.innerHTML);
          }
        }
      };
      
      recognition.onerror = (event) => {
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
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
        } catch (err) {}
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
      } catch (err) {}
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
  
  // Cargar comentarios de la tarea
  const cargarComentarios = async () => {
    if (!tarea?.id) return;
    
    setCargandoComentarios(true);
    try {
      const comentariosData = await getTaskComments(tarea.id);
      setComentarios(Array.isArray(comentariosData) ? comentariosData : []);
      
      // Cargar adjuntos de cada comentario
      comentariosData.forEach((comentario) => {
        if (comentario.id && comentario.attachments && Array.isArray(comentario.attachments)) {
          setAdjuntosComentarios((prev) => ({
            ...prev,
            [comentario.id]: comentario.attachments,
          }));
        }
      });
    } catch (err) {
      console.error("Error al cargar comentarios:", err);
      toast.showError("Error al cargar comentarios");
    } finally {
      setCargandoComentarios(false);
    }
  };
  
  // Funciones para manejo de archivos
  const validarArchivo = (file) => {
    const tiposPermitidos = [
      "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp",
      "application/pdf",
    ];
    const extensionesPermitidas = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf"];
    const maxSize = 5 * 1024 * 1024; // 5MB
    
    const tieneTipoValido = tiposPermitidos.includes(file.type);
    const tieneExtensionValida = extensionesPermitidas.some(ext => 
      file.name.toLowerCase().endsWith(ext)
    );
    
    if (!tieneTipoValido && !tieneExtensionValida) {
      toast.showWarning("Solo se permiten archivos de imagen (JPG, PNG, GIF, WEBP) y PDF");
      return false;
    }
    
    if (file.size > maxSize) {
      toast.showWarning("El archivo es demasiado grande. El tamaño máximo es 5MB");
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
        tipo: esImg ? "imagen" : "pdf",
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
    const files = e.target.files;
    if (files.length > 0) {
      agregarArchivos(files);
    }
    e.target.value = "";
  };
  
  // Handlers para drag and drop
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };
  
  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };
  
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };
  
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      agregarArchivos(files);
    }
  };
  
  // Handler para pegar desde el portapapeles
  useEffect(() => {
    if (!show) return;
    
    const handlePaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      
      const imageFiles = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            const timestamp = Date.now();
            const extension = file.type.split('/')[1] || 'png';
            const blob = new Blob([file], { type: file.type });
            const namedFile = new File([blob], `imagen-pegada-${timestamp}.${extension}`, {
              type: file.type,
              lastModified: Date.now()
            });
            imageFiles.push(namedFile);
          }
        }
      }
      
      if (imageFiles.length > 0) {
        agregarArchivos(imageFiles);
      }
    };
    
    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);
  
  // Función para mostrar confirmación antes de agregar comentario
  const handleAgregarComentario = () => {
    if (isNoteEmpty(responseNote) && archivos.length === 0) {
      toast.showWarning("Por favor, escribe un comentario o adjunta al menos un archivo.");
      return;
    }
    setShowConfirmModal(true);
  };
  
  // Función que realmente envía el comentario
  const confirmarYEnviarComentario = async () => {
    setShowConfirmModal(false);
    setLoading(true);
    try {
      const taskId = tarea?.id;
      if (!taskId) {
        toast.showError("No se pudo identificar la tarea");
        setLoading(false);
        return;
      }
      
      // Extraer menciones
      const mentionedIds = extractMentionedUserIds(responseNote || "", usuarios);
      
      // Crear FormData para enviar comentario con archivos
      const formData = new FormData();
      formData.append('comment', responseNote || " ");
      
      if (mentionedIds.length > 0) {
        formData.append('mentioned_user_ids', JSON.stringify(mentionedIds));
      }
      
      // Agregar archivos
      archivos.forEach((archivo) => {
        formData.append('archivos[]', archivo.file);
      });
      
      await addComment(taskId, formData);
      
      // Limpiar formulario
      setResponseNote("");
      archivos.forEach((arch) => {
        if (arch.preview) URL.revokeObjectURL(arch.preview);
      });
      setArchivos([]);
      setMentionedUserIds([]);
      
      // Recargar comentarios
      await cargarComentarios();
      
      // ✅ IMPORTANTE: Recargar la tarea completa desde el backend para preservar todos los datos
      // Esto evita que se pierda el response_note original u otros campos
      try {
        const tareaCompleta = await getTask(taskId);
        
        // Preservar el response_note original si el backend lo está modificando incorrectamente
        // Si el backend está reemplazando response_note con el comentario, esto lo previene
        if (tareaCompleta && tarea.response_note && !tareaCompleta.response_note) {
          // Si el backend perdió el response_note, restaurarlo desde la tarea original
          tareaCompleta.response_note = tarea.response_note;
        }
        
        if (onUpdated) {
          onUpdated(tareaCompleta);
        }
      } catch (err) {
        console.error("Error al recargar tarea después de agregar comentario:", err);
        // Fallback: solo actualizar el status si estaba pendiente
        if (tarea.status === "pending") {
          const tareaActualizada = { ...tarea, status: "in_progress" };
          if (onUpdated) {
            onUpdated(tareaActualizada);
          }
        }
      }
      
      toast.showSuccess("Comentario agregado exitosamente");
    } catch (error) {
      console.error("Error al agregar comentario:", error);
      toast.showError(error.response?.data?.message || error.message || "Error al agregar comentario");
    } finally {
      setLoading(false);
    }
  };
  
  // Función para completar tarea
  const handleCompletar = () => {
    setShowConfirmCompletarModal(true);
  };
  
  const confirmarYCompletarTarea = async () => {
    setShowConfirmCompletarModal(false);
    setLoading(true);
    try {
      const taskId = tarea?.id;
      if (!taskId) {
        toast.showError("No se pudo identificar la tarea");
        setLoading(false);
        return;
      }
      
      // Si hay comentario o archivos, agregarlos primero
      if (!isNoteEmpty(responseNote) || archivos.length > 0) {
        const mentionedIds = extractMentionedUserIds(responseNote || "", usuarios);
        const formData = new FormData();
        formData.append('comment', responseNote || " ");
        
        if (mentionedIds.length > 0) {
          formData.append('mentioned_user_ids', JSON.stringify(mentionedIds));
        }
        
        archivos.forEach((archivo) => {
          formData.append('archivos[]', archivo.file);
        });
        
        await addComment(taskId, formData);
      }
      
      // Tiempo dedicado: desde inicio de la tarea hasta ahora (liquidación calculada por el front)
      const fechaInicio = tarea?.created_at || tarea?.scheduled_date || tarea?.fecha_inicio;
      const { dias, horas, minutos } = durationFromStartToEnd(fechaInicio || new Date(), new Date());
      await completeTask(taskId, {
        response_note: responseNote || undefined,
        dias,
        horas,
        minutos,
      });
      
      // ✅ IMPORTANTE: Recargar la tarea completa desde el backend
      try {
        const tareaCompleta = await getTask(taskId);
        
        // Preservar el response_note original si existe
        if (tareaCompleta && tarea.response_note && !tareaCompleta.response_note) {
          tareaCompleta.response_note = tarea.response_note;
        }
        
        if (onUpdated) {
          onUpdated(tareaCompleta);
        }
      } catch (err) {
        console.error("Error al recargar tarea después de completar:", err);
        // Fallback
        const tareaActualizada = { ...tarea, status: "completed" };
        if (onUpdated) {
          onUpdated(tareaActualizada);
        }
      }
      
      // Limpiar formulario
      setResponseNote("");
      archivos.forEach((arch) => {
        if (arch.preview) URL.revokeObjectURL(arch.preview);
      });
      setArchivos([]);
      setMentionedUserIds([]);
      
      // Recargar comentarios
      await cargarComentarios();
      
      toast.showSuccess("Tarea completada exitosamente");
      setTimeout(() => {
        onHide();
      }, 1500);
    } catch (error) {
      console.error("Error al completar tarea:", error);
      toast.showError(error.response?.data?.message || error.message || "Error al completar tarea");
    } finally {
      setLoading(false);
    }
  };
  
  // Confirmar contraseña de administrador para desbloquear fecha límite
  const handleVerificarPasswordDueDate = () => {
    const pwd = (adminPasswordInput || "").trim();
    if (!pwd) {
      toast.showWarning("Ingrese la contraseña del administrador");
      return;
    }
    setAdminPasswordForDueDate(pwd);
    setDueDateUnlocked(true);
    setAdminPasswordInput("");
    setShowDueDatePasswordModal(false);
    toast.showSuccess("Fecha límite desbloqueada. Puede modificarla y guardar.");
  };

  // Función para actualizar fechas
  const handleActualizarFechas = async () => {
    if (!scheduledDate || !dueDate) {
      toast.showWarning("Las fechas no pueden estar vacías");
      return;
    }
    
    const taskId = tarea?.id;
    if (!taskId) {
      toast.showError("No se pudo identificar la tarea");
      return;
    }

    const dueDateOriginal = fechaToInputDate(tarea.due_date) || "";
    const dueDateCambiada = dueDate !== dueDateOriginal;
    const requierePassword = dueDateCambiada && !canEditDueDateWithoutPassword;
    if (requierePassword && !adminPasswordForDueDate) {
      toast.showWarning("Para cambiar la fecha límite debe desbloquearla con la contraseña del administrador.");
      setShowDueDatePasswordModal(true);
      return;
    }

    setLoading(true);
    try {
      const payload = {
        scheduled_date: scheduledDate,
        due_date: dueDate,
      };
      if (dueDateCambiada && adminPasswordForDueDate) {
        payload.admin_password = adminPasswordForDueDate;
      }
      await rescheduleTask(taskId, payload);
      
      const tareaActualizada = {
        ...tarea,
        scheduled_date: scheduledDate,
        due_date: dueDate,
      };
      
      if (onUpdated) {
        onUpdated(tareaActualizada);
      }
      
      setDueDateUnlocked(false);
      setAdminPasswordForDueDate("");
      toast.showSuccess("Fechas actualizadas exitosamente");
    } catch (error) {
      console.error("Error al actualizar fechas:", error);
      const msg = error.response?.data?.message || error.message || "Error al actualizar fechas";
      if (error.response?.status === 403 || (msg && (msg.toLowerCase().includes("contraseña") || msg.toLowerCase().includes("password") || msg.toLowerCase().includes("autoriz")))) {
        setAdminPasswordForDueDate("");
        setDueDateUnlocked(false);
        toast.showError("Contraseña de administrador incorrecta o sin permisos.");
      } else {
        toast.showError(msg);
      }
    } finally {
      setLoading(false);
    }
  };
  
  // Función para reasignar tarea
  const handleReasignar = async () => {
    if (!selectedUserId) {
      toast.showWarning("Debes seleccionar un usuario");
      return;
    }
    
    setLoading(true);
    try {
      const taskId = tarea?.id;
      if (!taskId) {
        toast.showError("No se pudo identificar la tarea");
        setLoading(false);
        return;
      }
      
      await assignTask(taskId, parseInt(selectedUserId));
      
      const tareaActualizada = {
        ...tarea,
        assigned_user_id: parseInt(selectedUserId),
        assigned_user: usuarios.find(u => u.id === parseInt(selectedUserId)),
      };
      
      if (onUpdated) {
        onUpdated(tareaActualizada);
      }
      
      toast.showSuccess("Tarea reasignada exitosamente");
    } catch (error) {
      console.error("Error al reasignar tarea:", error);
      toast.showError(error.response?.data?.message || error.message || "Error al reasignar tarea");
    } finally {
      setLoading(false);
    }
  };
  
  // Función para editar comentario
  const handleGuardarComentario = async (comentarioId) => {
    if (!comentarioId) return;
    
    const nuevoTexto = comentariosEnEdicion[comentarioId];
    if (!nuevoTexto?.trim()) {
      toast.showWarning("El comentario no puede estar vacío");
      return;
    }
    
    try {
      await updateComment(tarea.id, comentarioId, { comment: nuevoTexto });
      
      setComentarios((prev) =>
        prev.map((c) =>
          c.id === comentarioId ? { ...c, comment: nuevoTexto } : c
        )
      );
      
      setComentariosEnEdicion((prev) => {
        const nuevo = { ...prev };
        delete nuevo[comentarioId];
        return nuevo;
      });
      
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
      
      toast.showSuccess("Comentario actualizado exitosamente");
    } catch (error) {
      console.error("Error al actualizar comentario:", error);
      toast.showError("Error al actualizar el comentario");
    }
  };
  
  // Funciones helper para adjuntos
  const esImagenAdjunto = (adj) => {
    return adj.tipo_mime?.startsWith("image/") || 
           adj.mime_type?.startsWith("image/") ||
           /\.(jpg|jpeg|png|gif|webp)$/i.test(adj.nombre_original || adj.filename || "");
  };
  
  const esPDF = (adj) => {
    return adj.tipo_mime === "application/pdf" || 
           adj.mime_type === "application/pdf" ||
           /\.pdf$/i.test(adj.nombre_original || adj.filename || "");
  };
  
  // Función para abrir preview
  const abrirPreview = (adjunto) => {
    const esImg = esImagenAdjunto(adjunto);
    const esPdf = esPDF(adjunto);
    
    setArchivoPreview({
      adjunto,
      tipo: esImg ? "imagen" : esPdf ? "pdf" : "otro"
    });
    setErrorCargaArchivo(false);
    setShowPreviewModal(true);
  };
  
  // Función para descargar archivo
  const descargarArchivo = async (adjunto) => {
    try {
      if (adjunto.url) {
        const response = await fetch(adjunto.url);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = adjunto.nombre_original || adjunto.filename || "archivo";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else {
        window.open(adjunto.url, "_blank");
      }
    } catch (error) {
      console.error("Error al descargar archivo:", error);
      window.open(adjunto.url, "_blank");
    }
  };
  
  // Componente para mostrar adjuntos de un comentario
  const MostrarAdjuntosComentario = ({ comentarioId }) => {
    const adjuntos = adjuntosComentarios[comentarioId] || [];
    const cargando = loadingAdjuntos[comentarioId];
    const estaExpandido = archivosExpandidos[comentarioId];
    
    if (cargando) {
      return (
        <div className="d-flex align-items-center gap-2 mt-2">
          <Spinner animation="border" size="sm" />
          <small className="text-muted">Cargando archivos...</small>
        </div>
      );
    }
    
    if (adjuntos.length === 0) return null;
    
    return (
      <div className="mt-2">
        <button
          type="button"
          onClick={() => {
            setArchivosExpandidos((prev) => ({
              ...prev,
              [comentarioId]: !prev[comentarioId],
            }));
          }}
          className="w-100 d-flex align-items-center justify-content-between p-2 bg-light rounded border mb-2"
          style={{ cursor: "pointer" }}
        >
          <div className="d-flex align-items-center gap-2">
            <i className="fas fa-paperclip text-primary"></i>
            <span className="fw-semibold">Archivos adjuntos</span>
            <Badge bg="primary">{adjuntos.length}</Badge>
          </div>
          <i className={`fas ${estaExpandido ? "fa-chevron-up" : "fa-chevron-down"} text-muted`}></i>
        </button>
        
        {estaExpandido && (
          <div className="d-flex flex-wrap gap-2">
            {adjuntos.map((adjunto) => {
              const esImg = esImagenAdjunto(adjunto);
              const esPdf = esPDF(adjunto);
              
              return (
                <div
                  key={adjunto.id || adjunto.url}
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
                    <img
                      src={adjunto.url}
                      alt={adjunto.nombre_original || adjunto.filename || "Imagen"}
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
                    <div className="d-flex flex-column align-items-center justify-content-center h-100 bg-danger bg-opacity-10">
                      <i className="fas fa-file-pdf text-danger" style={{ fontSize: "2rem" }}></i>
                      <small className="text-muted text-center px-1" style={{ fontSize: "0.7rem" }}>
                        {adjunto.nombre_original || adjunto.filename || "PDF"}
                      </small>
                    </div>
                  ) : (
                    <div className="d-flex flex-column align-items-center justify-content-center h-100">
                      <i className="fas fa-file text-secondary" style={{ fontSize: "2rem" }}></i>
                      <small className="text-muted text-center px-1" style={{ fontSize: "0.7rem" }}>
                        {adjunto.nombre_original || adjunto.filename || "Archivo"}
                      </small>
                    </div>
                  )}
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
  };
  
  const formatFecha = (fecha) => {
    if (!fecha) return "N/A";
    try {
      if (typeof fecha === "string" && fecha.match(/^\d{4}-\d{2}-\d{2}/)) {
        const [year, month, day] = fecha.split("T")[0].split("-");
        return `${month}/${day}/${year}`;
      }
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
  
  const getStatusBadge = (status) => {
    switch (status) {
      case "completed":
        return <Badge bg="success">Completada</Badge>;
      case "in_progress":
        return <Badge bg="warning">En Progreso</Badge>;
      case "pending":
      default:
        return <Badge bg="secondary">Pendiente</Badge>;
    }
  };
  
  if (!tarea) return null;
  
  return (
    <>
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
        .ql-editor a {
          color: #2563eb;
          text-decoration: underline;
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
      `}</style>
      
      <Modal 
        show={show} 
        onHide={() => onHide()} 
        size="xl" 
        centered
        style={{ zIndex: 1050 }}
        className="responder-tarea-auditoria-modal"
      >
        <style>{`
          .responder-tarea-auditoria-modal .modal-dialog {
            max-width: 95vw;
            width: 1400px;
          }
          .responder-tarea-auditoria-modal .modal-content {
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
          }
          .responder-tarea-auditoria-modal .modal-header {
            background: transparent;
            border-bottom: 1px solid #e9ecef;
            padding: 1rem 1.5rem;
          }
          .responder-tarea-auditoria-modal .modal-body {
            padding: 2rem;
            background: #f8f9fa;
          }
          .responder-tarea-auditoria-modal .info-card {
            background: #fff;
            border: 1px solid #e9ecef;
            border-radius: 10px;
            padding: 1.5rem;
            margin-bottom: 1.5rem;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
          }
        `}</style>
        
        <Modal.Header closeButton>
          <Modal.Title className="d-flex align-items-center gap-2">
            <i className="fas fa-tasks"></i>
            <span>{tarea.status === "completed" ? "Detalle de Tarea de Auditoría" : "Responder Tarea de Auditoría"}</span>
            {tarea?.id && (
              <Badge bg="secondary" className="ms-2" style={{ fontSize: "0.75rem" }}>
                ID: {tarea.id}
              </Badge>
            )}
          </Modal.Title>
        </Modal.Header>
        
        <Modal.Body>
          <Row className="g-4">
            {/* Columna izquierda: Detalles de la Tarea */}
            <Col md={6} style={{ borderRight: "2px solid #e9ecef", paddingRight: "2rem" }}>
              <div className="d-flex align-items-center gap-2 mb-3">
                <i className="fas fa-info-circle text-primary"></i>
                <h5 className="mb-0">Detalles de la Tarea</h5>
              </div>
              
              <div className="info-card">
                <div className="mb-3">
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <i className="fas fa-info-circle text-primary"></i>
                    <strong>Estado:</strong>
                  </div>
                  {getStatusBadge(tarea.status)}
                </div>
                
                <div className="mb-3">
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <i className="fas fa-user text-info"></i>
                    <strong>Asignada a:</strong>
                  </div>
                  <p className="mb-0">
                    {tarea.assigned_user?.name || tarea.assigned_user?.nombre || "N/A"}
                  </p>
                </div>
                
                {tarea.status !== "completed" ? (
                  <>
                    <Row className="mb-3 g-3">
                      <Col>
                        <Form.Group>
                          <Form.Label>
                            <i className="fas fa-calendar-alt text-primary me-1"></i>
                            Fecha Programada:
                          </Form.Label>
                          <Form.Control
                            type="date"
                            value={scheduledDate}
                            onChange={(e) => setScheduledDate(e.target.value)}
                            style={{ borderRadius: "6px" }}
                          />
                        </Form.Group>
                      </Col>
                      <Col>
                        <Form.Group>
                          <Form.Label>
                            <i className="fas fa-clock text-warning me-1"></i>
                            Fecha Límite:
                            {isDueDateLocked && (
                              <small className="text-muted ms-2">(solo administrador o con autorización)</small>
                            )}
                          </Form.Label>
                          <div className="d-flex gap-2 align-items-start">
                            <Form.Control
                              type="date"
                              value={dueDate}
                              onChange={(e) => setDueDate(e.target.value)}
                              disabled={isDueDateLocked}
                              readOnly={isDueDateLocked}
                              style={{ borderRadius: "6px", flex: 1 }}
                              title={isDueDateLocked ? "Desbloquee con la contraseña de administrador para editar" : ""}
                            />
                            {tarea?.id && !canEditDueDateWithoutPassword && (
                              <Button
                                type="button"
                                variant={dueDateUnlocked ? "outline-success" : "outline-warning"}
                                size="sm"
                                onClick={() => (dueDateUnlocked ? (setDueDateUnlocked(false), setAdminPasswordForDueDate("")) : setShowDueDatePasswordModal(true))}
                                style={{ whiteSpace: "nowrap" }}
                                title={dueDateUnlocked ? "Bloquear de nuevo" : "Desbloquear para editar (requiere contraseña de administrador)"}
                              >
                                {dueDateUnlocked ? "Bloquear" : "Desbloquear"}
                              </Button>
                            )}
                          </div>
                        </Form.Group>
                      </Col>
                    </Row>
                    
                    <Form.Group className="mb-3">
                      <Form.Label>
                        <i className="fas fa-user-check text-success me-1"></i>
                        Reasignar a:
                      </Form.Label>
                      <Form.Select
                        value={selectedUserId}
                        onChange={(e) => setSelectedUserId(e.target.value)}
                      >
                        <option value="">Selecciona un usuario</option>
                        {usuarios.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name || user.nombre}
                          </option>
                        ))}
                      </Form.Select>
                      {selectedUserId && selectedUserId !== String(tarea.assigned_user_id) && (
                        <Button
                          variant="outline-primary"
                          size="sm"
                          className="mt-2"
                          onClick={handleReasignar}
                          disabled={loading}
                        >
                          Guardar Asignación
                        </Button>
                      )}
                    </Form.Group>
                  </>
                ) : (
                  <>
                    <div className="mb-2">
                      <Badge bg="info" className="me-2">{formatFecha(tarea.scheduled_date)}</Badge>
                      <Badge bg={getBadgeColor(tarea.due_date)}>
                        {formatFecha(tarea.due_date)}
                      </Badge>
                    </div>
                    {formatTaskTimeDhm(tarea) !== "—" && (
                      <div className="mt-2">
                        <span className="text-muted small">Tiempo dedicado: </span>
                        <strong>{formatTaskTimeDhm(tarea)}</strong>
                      </div>
                    )}
                  </>
                )}
                
                {tarea.response_note && (
                  <div className="mt-3">
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <i className="fas fa-sticky-note text-success"></i>
                      <strong>Nota Inicial:</strong>
                    </div>
                    <div 
                      className="text-content"
                      style={{ 
                        marginTop: 4,
                        wordBreak: 'break-word'
                      }}
                      dangerouslySetInnerHTML={{ __html: tarea.response_note || 'Sin nota' }}
                    />
                  </div>
                )}
              </div>
              
              <hr />
              
              <h6 className="mb-3">Comentarios:</h6>
              {cargandoComentarios ? (
                <div className="text-center py-4">
                  <Spinner animation="border" variant="primary" />
                  <p className="mt-2 text-muted">Cargando comentarios...</p>
                </div>
              ) : comentarios.length === 0 ? (
                <p className="text-muted">No hay comentarios aún.</p>
              ) : (
                <ListGroup>
                  {comentarios.map((c) => {
                    const estaEnEdicion = comentariosEnEdicion.hasOwnProperty(c.id);
                    const fueActualizado = comentariosActualizados[c.id];
                    
                    return (
                      <ListGroup.Item 
                        key={c.id} 
                        className={fueActualizado ? 'border-success' : ''}
                      >
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <div>
                            <strong>{c.user?.name || c.user?.nombre || c.created_by?.name || "Usuario"}:</strong>
                            {fueActualizado && (
                              <Badge bg="success" className="ms-2">Actualizado ✓</Badge>
                            )}
                          </div>
                          <small className="text-muted">
                            {formatDateTimeForDisplay(c.created_at || c.fecha)}
                          </small>
                        </div>
                        
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
                              className="mb-2"
                            />
                            <div className="d-flex gap-2">
                              <Button
                                size="sm"
                                variant="success"
                                onClick={() => handleGuardarComentario(c.id)}
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
                              dangerouslySetInnerHTML={{ __html: highlightMentions(c.comment || 'Sin contenido') }}
                            />
                            {/* Mostrar adjuntos del comentario */}
                            {(() => {
                              if (c.attachments && Array.isArray(c.attachments) && c.attachments.length > 0) {
                                if (!adjuntosComentarios[c.id]) {
                                  setAdjuntosComentarios((prev) => ({
                                    ...prev,
                                    [c.id]: c.attachments,
                                  }));
                                }
                              }
                              return <MostrarAdjuntosComentario comentarioId={c.id} />;
                            })()}
                            {/* Botón editar solo si es el usuario actual */}
                            <div className="mt-2">
                              <Button
                                size="sm"
                                variant="outline-secondary"
                                onClick={() => {
                                  setComentariosEnEdicion((prev) => ({
                                    ...prev,
                                    [c.id]: htmlToPlainText(c.comment) || c.comment || '',
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
                  })}
                </ListGroup>
              )}
              
              <hr />
              
              {tarea.status !== "completed" && (
                <>
                  <Form.Group className="mt-4">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <Form.Label className="mb-0 d-flex align-items-center gap-2">
                        <i className="fas fa-comment-dots text-primary"></i>
                        <strong>Mi respuesta:</strong>
                      </Form.Label>
                      {reconocimientoDisponible && (
                        <Button
                          type="button"
                          variant={grabando ? "danger" : "outline-primary"}
                          size="sm"
                          onClick={toggleDictado}
                          className="d-flex align-items-center gap-2"
                        >
                          {grabando ? (
                            <>
                              <i className="fas fa-microphone"></i>
                              <span>Detener dictado</span>
                            </>
                          ) : (
                            <>
                              <i className="fas fa-microphone"></i>
                              <span>Dictar</span>
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                    {grabando && (
                      <div className="alert alert-info d-flex align-items-center gap-2 mb-2 py-2">
                        <Spinner animation="border" size="sm" />
                        <small className="mb-0">
                          <strong>Escuchando...</strong> Habla ahora.
                        </small>
                      </div>
                    )}
                    <div style={{ position: 'relative' }}>
                      <ReactQuill
                        key={`quill-${tarea?.id || 'new'}-${show}`}
                        ref={mentionQuillRef}
                        theme="snow"
                        value={responseNote || ""}
                        onChange={(value, delta, source, editor) => {
                          setResponseNote(value);
                          handleQuillChange(value, delta, source, editor);
                          if (editor) {
                            try {
                              if (typeof editor.getEditor === 'function') {
                                quillEditorRef.current = editor.getEditor();
                              } else if (editor.getSelection) {
                                quillEditorRef.current = editor;
                              }
                            } catch (e) {}
                          }
                        }}
                        onKeyDown={handleQuillKeyDown}
                        modules={quillModules}
                        formats={quillFormats}
                        placeholder="Escribe tu respuesta. Escribe @ para mencionar usuarios..."
                        style={{
                          backgroundColor: '#fff',
                          minHeight: '200px'
                        }}
                      />
                      
                      {/* Dropdown de menciones */}
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
                            zIndex: 9999,
                            maxHeight: '250px',
                            overflowY: 'auto',
                            marginTop: '4px',
                          }}
                          onClick={(e) => e.stopPropagation()}
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
                                </div>
                              ))}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </Form.Group>
                  
                  <Form.Group className="mb-3">
                    <Form.Label>Archivos adjuntos (opcional)</Form.Label>
                    <div
                      className="border rounded p-3 text-center"
                      style={{
                        borderStyle: "dashed",
                        cursor: "pointer",
                        backgroundColor: "#f8f9fa"
                      }}
                      onDragEnter={handleDragEnter}
                      onDragLeave={handleDragLeave}
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                      onClick={() => document.getElementById("file-input-auditoria-respuesta").click()}
                    >
                      <input
                        id="file-input-auditoria-respuesta"
                        type="file"
                        multiple
                        accept="image/*,.pdf"
                        onChange={handleFileInput}
                        style={{ display: "none" }}
                      />
                      <div>
                        <p className="mb-1">Haz clic para seleccionar archivos o arrastra y suelta</p>
                        <small className="text-muted">
                          Formatos: JPG, PNG, GIF, WEBP, PDF (máx. 5MB cada uno)
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
                                  <i className="fas fa-file-pdf fa-2x text-danger mb-2"></i>
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
                </>
              )}
            </Col>
            
            {/* Columna derecha: Información adicional */}
            <Col md={6} style={{ overflowY: "auto", maxHeight: "calc(100vh - 250px)" }}>
              <div className="d-flex align-items-center gap-2 mb-3">
                <i className="fas fa-info-circle text-info"></i>
                <h5 className="mb-0">Información Adicional</h5>
              </div>
              
              {tarea.cliente && (
                <div className="info-card">
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <i className="fas fa-user-circle text-primary"></i>
                    <strong>Cliente:</strong>
                  </div>
                  <p className="mb-0">
                    {tarea.cliente.nombre_completo || tarea.cliente.name || "N/A"}
                  </p>
                </div>
              )}
              
              {tarea.cobertura && (
                <div className="info-card">
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <i className="fas fa-file-contract text-success"></i>
                    <strong>Cobertura:</strong>
                  </div>
                  <p className="mb-0">
                    {tarea.cobertura.codigo_poliza || tarea.cobertura.poliza || "N/A"}
                  </p>
                </div>
              )}
              
              {tarea.created_at && (
                <div className="info-card">
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <i className="fas fa-calendar-plus text-info"></i>
                    <strong>Creada:</strong>
                  </div>
                  <p className="mb-0">
                    {formatDateTimeForDisplay(tarea.created_at)}
                  </p>
                </div>
              )}
              
              {tarea.updated_at && (
                <div className="info-card">
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <i className="fas fa-edit text-warning"></i>
                    <strong>Última actualización:</strong>
                  </div>
                  <p className="mb-0">
                    {formatDateTimeForDisplay(tarea.updated_at)}
                  </p>
                </div>
              )}
            </Col>
          </Row>
        </Modal.Body>
        
        <Modal.Footer>
          <Button variant="secondary" onClick={() => onHide()}>
            Cerrar
          </Button>
          {tarea.status !== "completed" && (
            <>
              <Button variant="primary" onClick={handleActualizarFechas} disabled={loading}>
                Actualizar Fechas
              </Button>
              <Button variant="info" onClick={handleAgregarComentario} disabled={loading}>
                Agregar Comentario
              </Button>
              <Button variant="success" onClick={handleCompletar} disabled={loading || esTareaVencida}>
                Marcar completada
              </Button>
            </>
          )}
        </Modal.Footer>
      </Modal>
      
      {/* Modal: contraseña de administrador para desbloquear fecha límite */}
      <Modal
        show={showDueDatePasswordModal}
        onHide={() => {
          setShowDueDatePasswordModal(false);
          setAdminPasswordInput("");
        }}
        centered
        size="sm"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="fas fa-lock text-warning me-2"></i>
            Autorización requerida
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-muted small mb-3">
            Para modificar la fecha límite después de creada la tarea debe ingresar la contraseña del usuario administrador.
          </p>
          <Form.Group>
            <Form.Label>Contraseña del administrador</Form.Label>
            <Form.Control
              type="password"
              value={adminPasswordInput}
              onChange={(e) => setAdminPasswordInput(e.target.value)}
              placeholder="Ingrese la contraseña"
              onKeyDown={(e) => e.key === "Enter" && handleVerificarPasswordDueDate()}
              autoComplete="off"
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDueDatePasswordModal(false)}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleVerificarPasswordDueDate}>
            Verificar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal de preview de archivos */}
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
                <i className="fas fa-file me-2"></i>
              )}
              {archivoPreview.adjunto.nombre_original || archivoPreview.adjunto.filename || "Vista previa"}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {archivoPreview.tipo === "imagen" && (
              <div className="text-center">
                {errorCargaArchivo ? (
                  <div className="p-5">
                    <i className="fas fa-exclamation-triangle text-warning" style={{ fontSize: "3rem" }}></i>
                    <h5 className="mt-3">No se pudo cargar la imagen</h5>
                  </div>
                ) : (
                  <img
                    src={archivoPreview.adjunto.url}
                    alt={archivoPreview.adjunto.nombre_original || "Imagen"}
                    className="img-fluid"
                    style={{ maxHeight: "80vh", maxWidth: "100%", objectFit: "contain" }}
                    onError={() => {
                      setErrorCargaArchivo(true);
                    }}
                  />
                )}
              </div>
            )}
            {archivoPreview.tipo === "pdf" && (
              <div style={{ height: "80vh", width: "100%" }}>
                {errorCargaArchivo ? (
                  <div className="d-flex flex-column align-items-center justify-content-center p-5">
                    <i className="fas fa-file-pdf text-danger" style={{ fontSize: "5rem" }}></i>
                    <h5 className="mt-3 mb-2">No se puede previsualizar el PDF</h5>
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
                      setErrorCargaArchivo(true);
                    }}
                  />
                )}
              </div>
            )}
            {(archivoPreview.tipo === "otro") && (
              <div className="d-flex flex-column align-items-center justify-content-center p-5">
                <i className="fas fa-file text-secondary" style={{ fontSize: "5rem" }}></i>
                <h5 className="mt-3 mb-2">Archivo</h5>
                <p className="text-muted">Este tipo de archivo no se puede previsualizar.</p>
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
          </Modal.Footer>
        </Modal>
      )}
      
      {/* Modal de confirmación antes de completar tarea */}
      <Modal 
        show={showConfirmCompletarModal} 
        onHide={() => !loading && setShowConfirmCompletarModal(false)} 
        centered 
        size="lg"
      >
        <Modal.Header closeButton={!loading}>
          <Modal.Title>
            <i className="fas fa-check-circle text-success me-2"></i>
            Confirmar Finalización de Tarea
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="alert alert-warning mb-3">
            <div className="d-flex align-items-center mb-2">
              <i className="fas fa-exclamation-triangle me-2"></i>
              <span><strong>¿Está seguro de que desea marcar esta tarea como completada?</strong></span>
            </div>
          </div>
          {(!isNoteEmpty(responseNote) || archivos.length > 0) && (
            <div className="mb-3">
              <label className="fw-semibold mb-2 d-block">
                <i className="fas fa-comment-dots me-2 text-primary"></i>
                Comentario final a agregar:
              </label>
              <div 
                className="border rounded p-3 bg-light"
                style={{ 
                  maxHeight: "200px", 
                  overflowY: "auto",
                  fontSize: "14px",
                  lineHeight: "1.6",
                  wordBreak: "break-word"
                }}
              >
                {isNoteEmpty(responseNote) ? (
                  <span className="text-muted fst-italic">
                    (Solo archivos adjuntos)
                  </span>
                ) : (
                  <div 
                    className="ql-editor"
                    dangerouslySetInnerHTML={{ __html: responseNote || "Sin contenido" }}
                    style={{ 
                      padding: 0,
                      fontSize: "14px",
                      lineHeight: "1.6"
                    }}
                  />
                )}
              </div>
            </div>
          )}
          {(() => {
            const fechaInicio = tarea?.created_at || tarea?.scheduled_date || tarea?.fecha_inicio;
            const tiempo = durationFromStartToEnd(fechaInicio || new Date());
            const textoFecha = fechaInicio ? new Date(fechaInicio).toLocaleString("es", { dateStyle: "short", timeStyle: "short" }) : "inicio";
            return (
              <div className="mb-0 p-3 bg-light rounded">
                <div className="d-flex align-items-center gap-2 mb-1">
                  <i className="fas fa-clock text-secondary"></i>
                  <strong className="small">Tiempo que se registrará (liquidación)</strong>
                </div>
                <p className="mb-0 small text-muted">
                  <span className="text-dark fw-semibold">{formatDhmString(tiempo)}</span>
                  {" "}(desde {textoFecha} hasta el momento de confirmar).
                </p>
              </div>
            );
          })()}
        </Modal.Body>
        <Modal.Footer>
          <Button 
            variant="secondary" 
            onClick={() => setShowConfirmCompletarModal(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button 
            variant="success" 
            onClick={confirmarYCompletarTarea}
            disabled={loading || esTareaVencida}
          >
            {loading ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Completando...
              </>
            ) : (
              <>
                <i className="fas fa-check me-1"></i>
                Sí, Completar Tarea
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
      
      {/* Modal de confirmación antes de agregar comentario */}
      <Modal show={showConfirmModal} onHide={() => !loading && setShowConfirmModal(false)} centered size="lg">
        <Modal.Header closeButton={!loading}>
          <Modal.Title>
            <i className="fas fa-question-circle text-primary me-2"></i>
            Confirmar Comentario
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="alert alert-info mb-3">
            <div className="d-flex align-items-center mb-2">
              <i className="fas fa-info-circle me-2"></i>
              <span><strong>¿Desea agregar el comentario a la tarea?</strong></span>
            </div>
          </div>
          <div className="mb-3">
            <label className="fw-semibold mb-2 d-block">
              <i className="fas fa-comment-dots me-2 text-primary"></i>
              Mensaje a enviar:
            </label>
            <div 
              className="border rounded p-3 bg-light"
              style={{ 
                maxHeight: "250px", 
                overflowY: "auto",
                fontSize: "14px",
                lineHeight: "1.6",
                wordBreak: "break-word"
              }}
            >
              {isNoteEmpty(responseNote) ? (
                <span className="text-muted fst-italic">
                  (Sin texto - solo archivos adjuntos)
                </span>
              ) : (
                <div 
                  className="ql-editor"
                  dangerouslySetInnerHTML={{ __html: responseNote || "Sin contenido" }}
                  style={{ 
                    padding: 0,
                    fontSize: "14px",
                    lineHeight: "1.6"
                  }}
                />
              )}
            </div>
          </div>
          {archivos.length > 0 && (
            <div className="mb-2">
              <label className="fw-semibold mb-2 d-block">
                <i className="fas fa-paperclip me-2 text-primary"></i>
                Archivos adjuntos ({archivos.length}):
              </label>
              <div className="d-flex flex-wrap gap-2">
                {archivos.map((archivo) => (
                  <Badge key={archivo.id} bg="info" className="p-2 d-flex align-items-center">
                    <i className={`fas ${archivo.tipo === "imagen" ? "fa-image" : "fa-file-pdf text-danger"} me-1`}></i>
                    <span style={{ maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {archivo.nombre}
                    </span>
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button 
            variant="secondary" 
            onClick={() => setShowConfirmModal(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button 
            variant="primary" 
            onClick={confirmarYEnviarComentario}
            disabled={loading}
          >
            {loading ? (
              <>
                <Spinner size="sm" animation="border" className="me-2" />
                Enviando...
              </>
            ) : (
              <>
                <i className="fas fa-check me-2"></i>
                Sí, Agregar Comentario
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
      
    </>
  );
};

export default ResponderTareaAuditoriaModal;

