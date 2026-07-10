// src/components/Tareas/ResponderTareaAuditoriaModal.jsx
import React, { useState, useEffect, useRef, useMemo } from "react";
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
import MdyDashDateInput from "../common/MdyDashDateInput";
import {
  formatDateTimeForDisplay,
  formatDateForDisplay,
  formatTaskTimeDhm,
  durationFromStartToEnd,
  formatDhmString,
  normalizeDateForInput,
  parseApiDateToLocalDate,
} from "../../utils/formatters";
import { isTaskOverdue } from "../../utils/taskDueDate";
import { useMentionableQuill } from "../../hooks/useMentionableQuill";
import { extractMentionedUserIds, highlightMentions } from "../../utils/mentions";
import { 
  getTask,
  getTaskComments, 
  addComment, 
  updateComment,
  updateTask,
  completeTask, 
  rescheduleTask, 
  assignTask,
  unwrapAuditoriaCommentResponse,
} from "../../services/auditoriasTasksService";
import useToast from "../../hooks/useToast";
import { useAuth } from "../../context/AuthContext";
import { getQuillInstance } from "../../utils/quillEditorUtils";
import systemConfigService from "../../services/SystemConfigService";
import {
  getAdjuntoDisplayUrl,
  isAdjuntoAuditoriaDisponible,
  descargarAdjuntoAuditoria,
  abrirAdjuntoAuditoriaEnNuevaPestana,
  esImagenAdjunto as esImagenAdjuntoUtil,
  esPDFAdjunto,
  esWordAdjunto,
} from "../../utils/attachmentUtils";

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

const toPositiveUserId = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const getTareaAsignadoUserId = (t) => {
  if (!t) return null;
  return (
    toPositiveUserId(t.assign_to_user_id) ??
    toPositiveUserId(t.assigned_user_id) ??
    toPositiveUserId(t.assign_to_user?.id) ??
    toPositiveUserId(t.assigned_user?.id) ??
    toPositiveUserId(t.assigned_to_user_id) ??
    toPositiveUserId(t.assigned_to_user?.id) ??
    null
  );
};

const getAuthUserId = (u) => {
  if (!u) return null;
  return toPositiveUserId(u.id ?? u.user_id ?? u.userId);
};

const normalizeNombre = (s) =>
  String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const getAuthNombreVisible = (u) => {
  if (!u) return "";
  return u.name ?? u.nombre ?? u.full_name ?? u.username ?? "";
};

const getTareaAsignadoNombres = (t) => {
  if (!t) return [];
  const candidates = [
    t.asignado_a,
    t.asignadoA,
    t.assign_to_user_name,
    t.assigned_to_name,
    t.assign_to_user?.name,
    t.assigned_user?.name,
    t.assigned_to_user?.name,
  ];
  return candidates
    .map((x) => (typeof x === "string" ? normalizeNombre(x) : ""))
    .filter(Boolean);
};

const coincideAsignacionPorNombre = (u, t) => {
  const mine = normalizeNombre(getAuthNombreVisible(u));
  if (!mine) return false;
  const nombres = getTareaAsignadoNombres(t);
  return nombres.some((n) => n && n === mine);
};

const unwrapAuditoriaTaskResponse = (raw) => {
  if (!raw || typeof raw !== "object") return null;
  if (raw.data != null && typeof raw.data === "object" && !Array.isArray(raw.data)) {
    return raw.data;
  }
  return raw;
};

const getComentarioAdjuntos = (comentario) => {
  const list = comentario?.adjuntos ?? comentario?.attachments ?? [];
  return Array.isArray(list) ? list : [];
};

const getTareaAdjuntosList = (t) => {
  const list = t?.adjuntos ?? t?.attachments ?? [];
  return Array.isArray(list) ? list : [];
};

const getCreadorNombre = (t) => {
  if (!t) return "";
  return (
    t.created_by_user?.name ||
    t.created_by_user?.nombre ||
    (typeof t.creado_por === "string" ? t.creado_por : t.creado_por?.name) ||
    t.created_by?.name ||
    t.createdBy?.name ||
    t.log?.user?.name ||
    t.user?.name ||
    ""
  );
};

const ResponderTareaAuditoriaModal = ({
  show,
  onHide,
  tarea,
  onUpdated,
  notificationContext = null,
}) => {
  const toast = useToast();
  const { user } = useAuth();

  const [responseNote, setResponseNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [tareaDetalle, setTareaDetalle] = useState(null);
  const [comentarios, setComentarios] = useState([]);
  const [cargandoComentarios, setCargandoComentarios] = useState(false);
  
  // Estados para edición de comentarios
  const [comentariosEnEdicion, setComentariosEnEdicion] = useState({});
  const [comentariosActualizados, setComentariosActualizados] = useState({});
  
  // Adjuntos: GET /api/auditorias/tasks/{id} → data.adjuntos[] y comments[].adjuntos[]
  const [adjuntosTarea, setAdjuntosTarea] = useState([]);
  const [adjuntosComentarios, setAdjuntosComentarios] = useState({});
  const [loadingAdjuntos, setLoadingAdjuntos] = useState({});
  const reemplazoInputRef = useRef(null);
  const [reemplazoContext, setReemplazoContext] = useState(null);
  const [archivoPreview, setArchivoPreview] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [errorCargaArchivo, setErrorCargaArchivo] = useState(false);
  
  // Estados para confirmación
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showConfirmCompletarModal, setShowConfirmCompletarModal] = useState(false);
  // ✅ Congelar el comentario resaltado al abrir el modal (no debe desaparecer hasta cerrar)
  const [frozenHighlightedCommentId, setFrozenHighlightedCommentId] = useState(null);
  const highlightedCommentId = useMemo(() => {
    return frozenHighlightedCommentId != null && frozenHighlightedCommentId !== ""
      ? String(frozenHighlightedCommentId)
      : null;
  }, [frozenHighlightedCommentId]);
  const hasScrolledToHighlightedCommentRef = useRef(false);
  
  const [scheduledDate, setScheduledDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  // Fecha límite: bloqueada para todos; editable solo tras clave del super admin (igual que tarea operativa)
  const [dueDateUnlocked, setDueDateUnlocked] = useState(false);
  const [showDueDatePasswordModal, setShowDueDatePasswordModal] = useState(false);
  const [adminPasswordForDueDate, setAdminPasswordForDueDate] = useState("");
  const [adminPasswordInput, setAdminPasswordInput] = useState("");
  const [verifyingDueDatePassword, setVerifyingDueDatePassword] = useState(false);
  const [dueDatePasswordError, setDueDatePasswordError] = useState("");
  const isDueDateLocked = tarea?.id && !dueDateUnlocked;
  const fechasInvalidas = scheduledDate && dueDate && scheduledDate > dueDate;

  const [selectedAssignUserId, setSelectedAssignUserId] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignPreview, setAssignPreview] = useState(null);
  const [showReassign, setShowReassign] = useState(false);

  const tareaParaUI = useMemo(() => {
    if (!tarea) return null;
    return { ...tarea, ...(tareaDetalle || {}) };
  }, [tarea, tareaDetalle]);

  const tareaEfectiva = useMemo(() => {
    const base = tareaParaUI || tarea;
    if (!assignPreview || !base?.id) return base;
    if (String(assignPreview.id) !== String(base.id)) return base;
    return { ...base, ...assignPreview };
  }, [tarea, tareaParaUI, assignPreview]);

  const puedeMarcarCompletada = useMemo(() => {
    const uid = getAuthUserId(user);
    const aid = getTareaAsignadoUserId(tareaEfectiva);
    if (uid && aid && uid === aid) return true;
    return coincideAsignacionPorNombre(user, tareaEfectiva);
  }, [user, tareaEfectiva]);

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
  const lastSelectionRef = useRef(null);
  const quillSelectionBoundToRef = useRef(null);
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

  useEffect(() => {
    if (show) {
      quillEditorRef.current = null;
      lastSelectionRef.current = null;
      quillSelectionBoundToRef.current = null;
      hasScrolledToHighlightedCommentRef.current = false;
      const rawId = notificationContext?.commentId;
      setFrozenHighlightedCommentId(
        rawId == null || rawId === "" ? null : String(rawId)
      );
    } else {
      setFrozenHighlightedCommentId(null);
    }
  }, [show, tarea?.id, notificationContext?.commentId]);

  useEffect(() => {
    if (!show || !highlightedCommentId) return;
    if (hasScrolledToHighlightedCommentRef.current) return;

    const frame = window.requestAnimationFrame(() => {
      const target = document.querySelector(
        `[data-highlight-comment-id="${highlightedCommentId}"]`
      );
      if (!target) return;

      target.scrollIntoView({ behavior: "smooth", block: "center" });
      hasScrolledToHighlightedCommentRef.current = true;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [show, comentarios, highlightedCommentId]);
  
  const aplicarAdjuntosDesdeComentarios = (lista) => {
    if (!Array.isArray(lista)) return;
    const next = {};
    lista.forEach((comentario) => {
      if (!comentario?.id) return;
      const adj = getComentarioAdjuntos(comentario);
      if (adj.length > 0) next[comentario.id] = adj;
    });
    if (Object.keys(next).length > 0) {
      setAdjuntosComentarios((prev) => ({ ...prev, ...next }));
    }
  };

  const aplicarAdjuntosDesdeTarea = (detalle) => {
    setAdjuntosTarea(getTareaAdjuntosList(detalle));
  };

  const recargarDetalleCompleto = async () => {
    const taskId = tarea?.id;
    if (!taskId) return null;
    const raw = await getTask(taskId);
    const detalle = unwrapAuditoriaTaskResponse(raw) || raw;
    if (detalle) {
      setTareaDetalle(detalle);
      aplicarAdjuntosDesdeTarea(detalle);
      if (Array.isArray(detalle.comments)) {
        setComentarios(detalle.comments);
        aplicarAdjuntosDesdeComentarios(detalle.comments);
      }
      if (onUpdated) onUpdated(detalle);
    }
    return detalle;
  };

  const cargarDetalleTarea = async () => {
    if (!tarea?.id) return null;
    try {
      const raw = await getTask(tarea.id);
      const detalle = unwrapAuditoriaTaskResponse(raw);
      if (detalle) {
        setTareaDetalle(detalle);
        aplicarAdjuntosDesdeTarea(detalle);
        return detalle;
      }
    } catch (err) {
      console.warn("Error al cargar detalle de tarea de auditoría:", err);
    }
    return null;
  };

  // Cargar datos de la tarea cuando se abre el modal
  useEffect(() => {
    if (show && tarea?.id) {
      setScheduledDate(normalizeDateForInput(tarea.scheduled_date) || "");
      setDueDate(normalizeDateForInput(tarea.due_date) || "");
      setSelectedAssignUserId(
        tarea.assigned_user_id
          ? String(tarea.assigned_user_id)
          : tarea.assigned_user?.id
            ? String(tarea.assigned_user.id)
            : ""
      );
      setShowReassign(false);
      setAssignPreview(null);
      setTareaDetalle(null);
      setAdjuntosComentarios({});
      setAdjuntosTarea([]);
      setDueDateUnlocked(false);
      setShowDueDatePasswordModal(false);
      setAdminPasswordForDueDate("");
      setAdminPasswordInput("");
      setDueDatePasswordError("");
      setVerifyingDueDatePassword(false);

      let cancelled = false;
      const init = async () => {
        const detalle = await cargarDetalleTarea();
        if (cancelled) return;
        const commentsFromDetail = Array.isArray(detalle?.comments) ? detalle.comments : null;
        await cargarComentarios(commentsFromDetail);
      };
      init();

      return () => {
        cancelled = true;
      };
    } else {
      setResponseNote("");
      setComentarios([]);
      setTareaDetalle(null);
      setAdjuntosComentarios({});
      setAdjuntosTarea([]);
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
        
        if (textoTranscrito) {
          const quill =
            getQuillInstance(mentionQuillRef.current) ||
            getQuillInstance(quillEditorRef.current);
          if (quill) {
            const length = quill.getLength();
            try { quill.focus(); } catch (e) {}
            const range = quill.getSelection(true) || lastSelectionRef.current;
            const insertPosition = range ? range.index : Math.max(length - 1, 0);
            const prevChar = insertPosition > 0 ? quill.getText(insertPosition - 1, 1) : "";
            const prefix = prevChar && !prevChar.endsWith(" ") ? " " : "";
            quill.insertText(insertPosition, `${prefix}${textoTranscrito} `, "user");
            quill.setSelection(insertPosition + prefix.length + textoTranscrito.length + 1);
            setResponseNote(quill.root.innerHTML);
          }
        }
      };
      
      recognition.onerror = (event) => {
        if (event.error === "no-speech" || event.error === "aborted") return;
        grabandoRef.current = false;
        setGrabando(false);
      };
      
      recognition.onend = () => {
        if (!grabandoRef.current) return;
        setTimeout(() => {
          if (!grabandoRef.current) return;
          try {
            recognition.start();
          } catch {
            grabandoRef.current = false;
            setGrabando(false);
          }
        }, 150);
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
      const q =
        getQuillInstance(mentionQuillRef.current) ||
        getQuillInstance(quillEditorRef.current);
      if (q) {
        try { q.focus(); } catch (e) {}
        try {
          const r = q.getSelection(true) || lastSelectionRef.current;
          if (r) q.setSelection(r.index, r.length || 0);
        } catch (e) {}
      }
      // Evita que onend reinicie por un estado stale
      grabandoRef.current = true;
      reconocimientoVoz.start();
      setGrabando(true);
    } catch (err) {
      console.error('Error al iniciar reconocimiento:', err);
      grabandoRef.current = false;
      setGrabando(false);
    }
  };
  
  const detenerDictado = () => {
    // Marcar inmediatamente como detenido para que onend no reinicie
    grabandoRef.current = false;
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
  
  // Cargar comentarios de la tarea (opcionalmente desde GET /auditorias/tasks/{id})
  const cargarComentarios = async (comentariosPrecargados = null) => {
    if (!tarea?.id) return;

    setCargandoComentarios(true);
    try {
      let lista = comentariosPrecargados;
      if (!Array.isArray(lista)) {
        const comentariosData = await getTaskComments(tarea.id);
        lista = Array.isArray(comentariosData)
          ? comentariosData
          : comentariosData?.data || [];
      }
      setComentarios(lista);
      aplicarAdjuntosDesdeComentarios(lista);
    } catch (err) {
      console.error("Error al cargar comentarios:", err);
      toast.showError("Error al cargar comentarios");
    } finally {
      setCargandoComentarios(false);
    }
  };

  const sincronizarAdjuntosComentario = (comentarioId, comentarioData) => {
    if (!comentarioId || adjuntosComentarios[comentarioId]) return;
    const data = getComentarioAdjuntos(comentarioData || {});
    if (data.length > 0) {
      setAdjuntosComentarios((prev) => ({ ...prev, [comentarioId]: data }));
    }
  };

  const iniciarReemplazoAdjunto = (adjunto, commentId = null) => {
    if (!adjunto?.id) return;
    setReemplazoContext({
      adjuntoId: adjunto.id,
      commentId: commentId ?? null,
      scope: commentId != null ? "comment" : "task",
    });
    reemplazoInputRef.current?.click();
  };

  const handleReemplazoArchivo = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !reemplazoContext || !tarea?.id) return;
    if (!validarArchivo(file)) return;

    const fd = new FormData();
    fd.append("archivos[]", file);
    fd.append("eliminar_adjuntos[]", String(reemplazoContext.adjuntoId));

    setLoading(true);
    try {
      if (reemplazoContext.scope === "comment" && reemplazoContext.commentId) {
        await updateComment(tarea.id, reemplazoContext.commentId, fd);
      } else if (puedeMarcarCompletada) {
        await updateTask(tarea.id, fd);
      } else {
        toast.showWarning("Solo el usuario asignado puede reemplazar archivos de la tarea.");
        return;
      }
      await recargarDetalleCompleto();
      toast.showSuccess("Archivo reemplazado correctamente");
    } catch (err) {
      console.error("Error al reemplazar adjunto:", err);
      toast.showError(err.response?.data?.message || err.message || "Error al reemplazar archivo");
    } finally {
      setLoading(false);
      setReemplazoContext(null);
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
    if (!show || tarea?.status === "completed") return;
    
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
  }, [show, tarea?.status]);
  
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
      if (!isNoteEmpty(responseNote) || archivos.length === 0) {
        formData.append("comment", responseNote || " ");
      }
      
      if (mentionedIds.length > 0) {
        formData.append("mentioned_user_ids", JSON.stringify(mentionedIds));
      }
      
      archivos.forEach((archivo) => {
        formData.append("archivos[]", archivo.file);
      });
      
      const commentResponse = await addComment(taskId, formData);
      const nuevoComentario = unwrapAuditoriaCommentResponse(commentResponse);
      if (nuevoComentario?.id && Array.isArray(nuevoComentario.adjuntos)) {
        setAdjuntosComentarios((prev) => ({
          ...prev,
          [nuevoComentario.id]: nuevoComentario.adjuntos,
        }));
      }
      
      // Limpiar formulario
      setResponseNote("");
      archivos.forEach((arch) => {
        if (arch.preview) URL.revokeObjectURL(arch.preview);
      });
      setArchivos([]);
      setMentionedUserIds([]);
      
      try {
        const tareaCompleta = await recargarDetalleCompleto();
        if (tareaCompleta && tarea.response_note && !tareaCompleta.response_note) {
          tareaCompleta.response_note = tarea.response_note;
        }
      } catch (err) {
        console.error("Error al recargar tarea después de agregar comentario:", err);
        if (tarea.status === "pending" && onUpdated) {
          onUpdated({ ...tareaParaUI, status: "in_progress" });
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
      if (!puedeMarcarCompletada) {
        toast.showWarning("Solo el usuario asignado a la tarea puede marcarla como completada.");
        setLoading(false);
        return;
      }

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
        if (!isNoteEmpty(responseNote) || archivos.length === 0) {
          formData.append("comment", responseNote || " ");
        }
        if (mentionedIds.length > 0) {
          formData.append("mentioned_user_ids", JSON.stringify(mentionedIds));
        }
        archivos.forEach((archivo) => {
          formData.append("archivos[]", archivo.file);
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
      // ✅ No cerrar automáticamente: el usuario puede revisar el resultado.
    } catch (error) {
      console.error("Error al completar tarea:", error);
      toast.showError(error.response?.data?.message || error.message || "Error al completar tarea");
    } finally {
      setLoading(false);
    }
  };
  
  const handleVerificarPasswordDueDate = async () => {
    const pwd = (adminPasswordInput || "").trim();
    if (!pwd) {
      toast.showWarning("Ingrese la clave del super administrador");
      return;
    }
    setDueDatePasswordError("");
    setVerifyingDueDatePassword(true);
    try {
      await systemConfigService.verifySuperAdminPassword(pwd);
      setAdminPasswordForDueDate(pwd);
      setDueDateUnlocked(true);
      setAdminPasswordInput("");
      setDueDatePasswordError("");
      setShowDueDatePasswordModal(false);
      toast.showSuccess("Fecha de vencimiento desbloqueada. Puede modificarla y guardar.");
    } catch (err) {
      const msg = err?.message || err?.response?.data?.message || "Contraseña incorrecta.";
      setDueDatePasswordError(msg);
      toast.showError("La clave del super administrador no es correcta.");
    } finally {
      setVerifyingDueDatePassword(false);
    }
  };

  const handleActualizarFechas = async () => {
    const schedYmd = normalizeDateForInput(scheduledDate);
    const dueYmd = normalizeDateForInput(dueDate);
    if (!schedYmd || !dueYmd || !/^\d{4}-\d{2}-\d{2}$/.test(schedYmd) || !/^\d{4}-\d{2}-\d{2}$/.test(dueYmd)) {
      toast.showWarning("Ingrese fechas completas y válidas.");
      return;
    }
    if (schedYmd > dueYmd) {
      toast.showError("La fecha de programación no puede ser mayor que la fecha de vencimiento.");
      return;
    }

    const taskId = tarea?.id;
    if (!taskId) {
      toast.showError("No se pudo identificar la tarea");
      return;
    }

    const dueDateOriginal = normalizeDateForInput(tarea.due_date) || "";
    const dueDateCambiada = dueYmd !== dueDateOriginal;
    const requierePassword = dueDateCambiada;
    if (requierePassword && !adminPasswordForDueDate) {
      toast.showWarning("Para cambiar la fecha de vencimiento debe ingresar la clave del super administrador.");
      setShowDueDatePasswordModal(true);
      return;
    }

    setLoading(true);
    try {
      const payload = {
        scheduled_date: schedYmd,
        due_date: dueYmd,
      };
      if (dueDateCambiada && adminPasswordForDueDate) {
        payload.admin_password = adminPasswordForDueDate;
      }
      await rescheduleTask(taskId, payload);

      const tareaActualizada = {
        ...tarea,
        scheduled_date: schedYmd,
        due_date: dueYmd,
      };

      if (onUpdated) {
        onUpdated(tareaActualizada);
      }

      setScheduledDate(schedYmd);
      setDueDate(dueYmd);
      setDueDateUnlocked(false);
      setAdminPasswordForDueDate("");
      toast.showSuccess("Fechas actualizadas exitosamente");
    } catch (error) {
      console.error("Error al actualizar fechas:", error);
      const msg = error.response?.data?.message || error.message || "Error al actualizar fechas";
      if (error.response?.status === 403 || (msg && (msg.toLowerCase().includes("contraseña") || msg.toLowerCase().includes("password") || msg.toLowerCase().includes("autoriz")))) {
        setAdminPasswordForDueDate("");
        setDueDateUnlocked(false);
        toast.showError("Clave del super administrador incorrecta o sin permisos.");
      } else {
        toast.showError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReasignar = async () => {
    const nuevaAsignacionId = parseInt(selectedAssignUserId, 10);
    if (!nuevaAsignacionId) {
      toast.showWarning("Debes seleccionar un usuario");
      return;
    }

    const taskId = tarea?.id;
    if (!taskId) {
      toast.showError("No se pudo identificar la tarea");
      return;
    }

    setAssignLoading(true);
    try {
      await assignTask(taskId, nuevaAsignacionId);

      let tareaCompleta = null;
      try {
        const raw = await getTask(taskId);
        tareaCompleta =
          raw?.data && typeof raw.data === "object" && !Array.isArray(raw.data)
            ? raw.data
            : raw;
      } catch {
        tareaCompleta = null;
      }

      const userObj =
        usuarios.find((u) => String(u.id) === String(nuevaAsignacionId)) ||
        tareaCompleta?.assigned_user ||
        null;

      const tareaActualizada = {
        ...tarea,
        ...(tareaCompleta && typeof tareaCompleta === "object" ? tareaCompleta : {}),
        assigned_user_id: nuevaAsignacionId,
        assigned_user: tareaCompleta?.assigned_user || userObj,
      };

      setAssignPreview(tareaActualizada);
      setShowReassign(false);
      if (onUpdated) {
        onUpdated(tareaActualizada);
      }

      toast.showSuccess("Asignación actualizada exitosamente");
    } catch (error) {
      console.error("Error al reasignar tarea:", error);
      toast.showError(error.response?.data?.message || error.message || "Error al reasignar tarea");
    } finally {
      setAssignLoading(false);
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
  
  const esImagenAdjunto = esImagenAdjuntoUtil;
  const esPDF = esPDFAdjunto;

  const esWord = esWordAdjunto;

  const abrirPreview = (adjunto) => {
    if (!isAdjuntoAuditoriaDisponible(adjunto)) {
      toast.showWarning("Este archivo no está disponible. Puede volver a subirlo.");
      return;
    }
    const esImg = esImagenAdjunto(adjunto);
    const esPdf = esPDF(adjunto);
    const esDoc = esWord(adjunto);

    setArchivoPreview({
      adjunto,
      tipo: esImg ? "imagen" : esPdf ? "pdf" : esDoc ? "word" : "otro",
    });
    setErrorCargaArchivo(false);
    setShowPreviewModal(true);
  };

  const descargarArchivo = async (adjunto) => {
    await descargarAdjuntoAuditoria(adjunto);
  };

  const renderTarjetaAdjunto = (adjunto, commentId = null) => {
    const esImg = esImagenAdjunto(adjunto);
    const esPdf = esPDF(adjunto);
    const esDoc = esWord(adjunto);
    const disponible = isAdjuntoAuditoriaDisponible(adjunto);
    const imgSrc = disponible ? getAdjuntoDisplayUrl(adjunto) : null;

    return (
      <div
        key={adjunto.id || adjunto.url}
        className="position-relative border rounded"
        style={{
          width: "120px",
          height: "120px",
          cursor: disponible ? "pointer" : "default",
          overflow: "hidden",
          backgroundColor: disponible ? "#f8f9fa" : "#fff3cd",
        }}
        onClick={() => disponible && abrirPreview(adjunto)}
        title={
          disponible
            ? "Haz clic para previsualizar"
            : "Archivo no disponible (ruta antigua en S3)"
        }
      >
        {esImg ? (
          disponible && imgSrc ? (
            <>
              <img
                src={imgSrc}
                alt={adjunto.nombre_original || adjunto.filename || "Imagen"}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                onError={(e) => {
                  e.target.style.display = "none";
                }}
              />
              <div className="position-absolute top-0 start-0 end-0 bottom-0 bg-black bg-opacity-0 hover:bg-opacity-30 transition-all d-flex align-items-center justify-content-center">
                <i className="fas fa-eye text-white opacity-0 hover:opacity-100"></i>
              </div>
            </>
          ) : (
            <div className="d-flex flex-column align-items-center justify-content-center h-100 p-1 text-center">
              <i className="fas fa-image text-warning" style={{ fontSize: "1.5rem" }}></i>
              <small className="text-muted mt-1" style={{ fontSize: "0.65rem" }}>
                No disponible
              </small>
              <Button
                variant="link"
                size="sm"
                className="p-0 mt-1"
                style={{ fontSize: "0.65rem" }}
                onClick={(e) => {
                  e.stopPropagation();
                  iniciarReemplazoAdjunto(adjunto, commentId);
                }}
              >
                Volver a subir
              </Button>
            </div>
          )
        ) : esPdf ? (
          <div className="d-flex flex-column align-items-center justify-content-center h-100 bg-danger bg-opacity-10">
            <i className="fas fa-file-pdf text-danger" style={{ fontSize: "2rem" }}></i>
            <small className="text-muted text-center px-1" style={{ fontSize: "0.7rem" }}>
              {adjunto.nombre_original || adjunto.filename || "PDF"}
            </small>
            {!disponible && (
              <Button
                variant="link"
                size="sm"
                className="p-0"
                style={{ fontSize: "0.65rem" }}
                onClick={(e) => {
                  e.stopPropagation();
                  iniciarReemplazoAdjunto(adjunto, commentId);
                }}
              >
                Volver a subir
              </Button>
            )}
          </div>
        ) : esDoc ? (
          <div className="d-flex flex-column align-items-center justify-content-center h-100 bg-primary bg-opacity-10">
            <i className="fas fa-file-word text-primary" style={{ fontSize: "2rem" }}></i>
            <small className="text-muted text-center px-1" style={{ fontSize: "0.7rem" }}>
              {adjunto.nombre_original || adjunto.filename || "Word"}
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
        {disponible && (
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
        )}
      </div>
    );
  };

  // Componente para mostrar adjuntos (mismo patrón que ResponderTareaModal)
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
          {adjuntos.map((adjunto) => renderTarjetaAdjunto(adjunto, comentarioId))}
        </div>
      </div>
    );
  };

  const formatFecha = (fecha) => {
    if (!fecha) return "N/A";
    const d = formatDateForDisplay(fecha);
    return d === "-" ? "N/A" : d;
  };
  
  const getBadgeColor = (fecha) => {
    if (!fecha) return "secondary";
    const target = parseApiDateToLocalDate(fecha);
    if (!target) return "secondary";
    const hoy = new Date();
    const todayStart = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const diffMs = target.getTime() - todayStart.getTime();
    const diffDias = Math.round(diffMs / (1000 * 60 * 60 * 24));
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
            padding: 1.25rem 1.5rem 1.75rem;
            background: #f1f5f9;
          }
          .responder-tarea-auditoria-modal .info-card {
            background: #fff;
            border: 1px solid #e9ecef;
            border-radius: 10px;
            padding: 1.5rem;
            margin-bottom: 1.5rem;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
          }
          .responder-tarea-auditoria-modal .audit-panel-card,
          .responder-tarea-auditoria-modal .audit-side-card,
          .responder-tarea-auditoria-modal .audit-thread-card,
          .responder-tarea-auditoria-modal .audit-compose-card {
            background: #fff;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 1.25rem 1.5rem;
            box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06);
          }
          .responder-tarea-auditoria-modal .audit-field-label {
            font-size: 0.6875rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            color: #64748b;
            margin-bottom: 0.35rem;
          }
          .responder-tarea-auditoria-modal .audit-note-readonly {
            border-left: 4px solid #0d6efd !important;
            background: #f8fafc !important;
          }
          @keyframes highlighted-comment-pulse {
            0%, 100% {
              box-shadow: 0 0 0 0 rgba(220, 53, 69, 0.24);
            }
            50% {
              box-shadow: 0 0 0 6px rgba(220, 53, 69, 0.08);
            }
          }
          .responder-tarea-auditoria-modal .highlighted-comment-card {
            border: 1px solid rgba(220, 53, 69, 0.35) !important;
            background: #fff5f5;
            animation: highlighted-comment-pulse 1.4s ease-in-out infinite;
          }
        `}</style>

        <input
          ref={reemplazoInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,application/pdf"
          className="d-none"
          onChange={handleReemplazoArchivo}
        />
        
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
          <Row className="g-4 align-items-stretch">
            <Col lg={7}>
              <div className="audit-panel-card h-100">
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3 pb-2 border-bottom border-light">
                  <h6 className="mb-0 fw-semibold text-body">Detalles de la tarea</h6>
                </div>
              {highlightedCommentId && (
                <div className="alert alert-danger py-2 px-3 d-flex align-items-center gap-2 mb-3">
                  <i className="fas fa-comment-dots"></i>
                  <span className="small mb-0">
                    Se resalt&oacute; el comentario nuevo relacionado con esta notificaci&oacute;n.
                  </span>
                </div>
              )}

                <div className="mb-4">
                  <div className="audit-field-label">Estado</div>
                  <div className="mt-1">{getStatusBadge(tarea.status)}</div>
                </div>

                <Row className="mb-4 g-3">
                  <Col xs={12} sm={6}>
                    <div className="audit-field-label">Creado por</div>
                    <div className="fw-medium text-body">
                        {getCreadorNombre(tareaParaUI) || "N/A"}
                    </div>
                  </Col>
                  <Col xs={12} sm={6}>
                    <div className="audit-field-label">Asignado a</div>
                    <div className="fw-medium text-body">
                      {assignPreview?.assigned_user?.name ||
                        assignPreview?.assigned_user?.nombre ||
                        tarea?.assigned_user?.name ||
                        tarea?.assigned_user?.nombre ||
                        tarea?.assign_to_user?.name ||
                        tarea?.assigned_to_user?.name ||
                        tarea?.asignado_a ||
                        "N/A"}
                    </div>
                  </Col>
                </Row>
                
                {tarea.status !== "completed" ? (
                  <>
                    <Row className="mb-3 g-3">
                      <Col>
                        <Form.Group>
                          <Form.Label className="audit-field-label d-block text-uppercase">
                            Fecha programada
                          </Form.Label>
                          <MdyDashDateInput
                            valueIso={scheduledDate}
                            onChangeIso={(iso) => setScheduledDate(iso)}
                          />
                        </Form.Group>
                      </Col>
                      <Col>
                        <Form.Group>
                          <Form.Label className="audit-field-label d-block text-uppercase">
                            Fecha límite
                            {isDueDateLocked && (
                              <span className="text-muted fw-normal text-lowercase small ms-1">
                                (requiere clave del super admin)
                              </span>
                            )}
                          </Form.Label>
                          <div className="d-flex gap-2 align-items-start">
                            <div className="flex-grow-1" style={{ minWidth: 0 }}>
                              <MdyDashDateInput
                                valueIso={dueDate}
                                onChangeIso={(iso) => setDueDate(iso)}
                                disabled={isDueDateLocked}
                              />
                            </div>
                            {isDueDateLocked && (
                              <Button
                                type="button"
                                variant={dueDateUnlocked ? "outline-success" : "outline-warning"}
                                size="sm"
                                onClick={() =>
                                  dueDateUnlocked
                                    ? (setDueDateUnlocked(false), setAdminPasswordForDueDate(""))
                                    : setShowDueDatePasswordModal(true)
                                }
                                style={{ whiteSpace: "nowrap" }}
                                title={
                                  dueDateUnlocked
                                    ? "Bloquear de nuevo"
                                    : "Desbloquear para editar (requiere clave del super admin)"
                                }
                              >
                                {dueDateUnlocked ? "Bloquear" : "Desbloquear"}
                              </Button>
                            )}
                          </div>
                        </Form.Group>
                      </Col>
                    </Row>

                    {fechasInvalidas && (
                      <div className="alert alert-danger py-2 small mb-3">
                        La fecha de programación no puede ser mayor que la fecha de vencimiento.
                      </div>
                    )}

                    <div className="mb-3">
                      <div className="audit-field-label">Reasignar</div>
                      {(() => {
                        const currentId =
                          assignPreview?.assigned_user_id ??
                          tarea?.assigned_user_id ??
                          tarea?.assigned_user?.id ??
                          null;
                        const currentIdStr = currentId != null ? String(currentId) : "";
                        const currentName =
                          assignPreview?.assigned_user?.name ||
                          assignPreview?.assigned_user?.nombre ||
                          tarea?.assigned_user?.name ||
                          tarea?.assigned_user?.nombre ||
                          null;

                        return (
                          <>
                            {!showReassign ? (
                              <Button
                                type="button"
                                variant="outline-primary"
                                size="sm"
                                onClick={() => {
                                  setSelectedAssignUserId(currentIdStr);
                                  setShowReassign(true);
                                }}
                                disabled={assignLoading}
                              >
                                Reasignar
                              </Button>
                            ) : (
                              <div className="mt-1">
                                <Form.Select
                                  value={selectedAssignUserId || ""}
                                  onChange={(e) => setSelectedAssignUserId(e.target.value)}
                                  disabled={assignLoading}
                                >
                                  <option value="">Selecciona un usuario</option>
                                  {(() => {
                                    if (!currentIdStr) return null;
                                    const existsInList = (usuarios || []).some(
                                      (u) => String(u.id) === currentIdStr
                                    );
                                    if (existsInList) return null;
                                    return (
                                      <option key={`current-assignee-${currentIdStr}`} value={currentIdStr}>
                                        {currentName || `Usuario #${currentIdStr}`}
                                      </option>
                                    );
                                  })()}
                                  {(usuarios || []).map((u) => (
                                    <option key={u.id} value={u.id}>
                                      {u.name || u.nombre || u.email || `Usuario #${u.id}`}
                                    </option>
                                  ))}
                                </Form.Select>
                                <div className="d-flex gap-2 mt-2">
                                  <Button
                                    variant="outline-secondary"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedAssignUserId(currentIdStr);
                                      setShowReassign(false);
                                    }}
                                    disabled={assignLoading}
                                  >
                                    Cancelar
                                  </Button>
                                  {selectedAssignUserId &&
                                    selectedAssignUserId !== currentIdStr && (
                                      <Button
                                        variant="primary"
                                        size="sm"
                                        onClick={handleReasignar}
                                        disabled={assignLoading}
                                      >
                                        {assignLoading ? "Actualizando..." : "Guardar"}
                                      </Button>
                                    )}
                                </div>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mb-3">
                      <div className="audit-field-label">Programada / límite</div>
                      <div className="d-flex flex-wrap align-items-center gap-2">
                        <Badge bg="info">{formatFecha(tarea.scheduled_date)}</Badge>
                        <Badge bg={getBadgeColor(tarea.due_date)}>
                          {formatFecha(tarea.due_date)}
                        </Badge>
                      </div>
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
                  <div className="audit-note-readonly rounded-3 p-3 mt-2">
                    <div className="audit-field-label mb-2">Nota inicial / instrucción</div>
                    <div
                      className="text-content small"
                      style={{
                        wordBreak: "break-word",
                      }}
                      dangerouslySetInnerHTML={{ __html: tarea.response_note || "Sin nota" }}
                    />
                  </div>
                )}
                {adjuntosTarea.length > 0 && (
                  <div className="mt-3">
                    <div className="audit-field-label mb-2">Archivos de la tarea</div>
                    <div className="d-flex flex-wrap gap-2">
                      {adjuntosTarea.map((adj) => renderTarjetaAdjunto(adj, null))}
                    </div>
                  </div>
                )}
              </div>
            </Col>

            <Col lg={5}>
              <div className="audit-side-card h-100 d-flex flex-column">
                <h6
                  className="text-uppercase text-muted small fw-bold mb-3 pb-2 border-bottom"
                  style={{ letterSpacing: "0.05em" }}
                >
                  Contexto de auditoría
                </h6>
                {tarea.cliente && (
                  <div className="mb-3 pb-3 border-bottom border-light">
                    <div className="audit-field-label">Cliente</div>
                    <div className="fw-medium mb-0">
                      {tarea.cliente.nombre_completo || tarea.cliente.name || "N/A"}
                    </div>
                  </div>
                )}
                {tarea.cobertura && (
                  <div className="mb-3 pb-3 border-bottom border-light">
                    <div className="audit-field-label">Cobertura</div>
                    <div className="fw-medium mb-0">
                      {tarea.cobertura.codigo_poliza || tarea.cobertura.poliza || "N/A"}
                    </div>
                    {(tarea.cobertura.policy_number || tarea.cobertura.numero_poliza) && (
                      <div className="text-muted small mt-1">
                        N.º póliza: {tarea.cobertura.policy_number || tarea.cobertura.numero_poliza}
                      </div>
                    )}
                  </div>
                )}
                {tarea.auditoria && (
                  <div className="mb-3 pb-3 border-bottom border-light">
                    <div className="audit-field-label">Auditoría</div>
                    <div className="fw-medium">
                      {tarea.auditoria.run_nombre ||
                        (tarea.auditoria.run_id != null ? `Run #${tarea.auditoria.run_id}` : "—")}
                    </div>
                    {tarea.auditoria.run_periodo && (
                      <div className="text-muted small mt-1">
                        Periodo: {tarea.auditoria.run_periodo}
                      </div>
                    )}
                    {tarea.auditoria.tipo_auditoria && (
                      <div className="text-muted small mt-1">
                        Tipo:{" "}
                        {typeof tarea.auditoria.tipo_auditoria === "object"
                          ? tarea.auditoria.tipo_auditoria.nombre ||
                            tarea.auditoria.tipo_auditoria.codigo ||
                            ""
                          : String(tarea.auditoria.tipo_auditoria)}
                      </div>
                    )}
                  </div>
                )}
                {tarea.created_at && (
                  <div className="mb-3 pb-3 border-bottom border-light">
                    <div className="audit-field-label">Creada</div>
                    <div className="small text-body mb-0">
                      {formatDateTimeForDisplay(tarea.created_at)}
                    </div>
                  </div>
                )}
                {tarea.updated_at && (
                  <div className="mb-0 mt-auto">
                    <div className="audit-field-label">Última actualización</div>
                    <div className="small text-body mb-0">
                      {formatDateTimeForDisplay(tarea.updated_at)}
                    </div>
                  </div>
                )}
              </div>
            </Col>
          </Row>

          <Row className="g-4 mt-1">
            <Col xs={12}>
              <div className="audit-thread-card">
                <h6 className="fw-semibold mb-3 pb-2 border-bottom d-flex align-items-center gap-2">
                  <i className="fas fa-comments text-secondary"></i>
                  Historial de comentarios
                </h6>
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
                    const isHighlightedComment = highlightedCommentId && String(c.id) === highlightedCommentId;
                    
                    return (
                      <ListGroup.Item 
                        key={c.id} 
                        data-highlight-comment-id={isHighlightedComment ? String(c.id) : undefined}
                        className={`${fueActualizado ? 'border-success' : ''} ${isHighlightedComment ? 'highlighted-comment-card' : ''}`.trim()}
                      >
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <div>
                            <strong>{c.user?.name || c.user?.nombre || c.created_by?.name || "Usuario"}:</strong>
                            {fueActualizado && (
                              <Badge bg="success" className="ms-2">Actualizado ✓</Badge>
                            )}
                            {isHighlightedComment && (
                              <Badge bg="danger" className="ms-2">Nuevo comentario</Badge>
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
                            {(() => {
                              if (!adjuntosComentarios[c.id]) {
                                setTimeout(() => sincronizarAdjuntosComentario(c.id, c), 0);
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
              </div>

              {tarea.status !== "completed" && (
                <div className="audit-compose-card mt-3">
                <>
                  <Form.Group className="mt-0">
                    <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                      <h6 className="mb-0 fw-semibold d-flex align-items-center gap-2">
                        <i className="fas fa-edit text-secondary"></i>
                        Tu respuesta
                      </h6>
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
                          const q =
                            getQuillInstance(editor) ??
                            getQuillInstance(mentionQuillRef.current);
                          if (q) {
                            quillEditorRef.current = q;
                            if (quillSelectionBoundToRef.current !== q) {
                              quillSelectionBoundToRef.current = q;
                              try {
                                q.on("selection-change", (range) => {
                                  if (range) lastSelectionRef.current = range;
                                });
                              } catch (e) {}
                            }
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
                  
                  <Form.Group className="mb-0">
                    <Form.Label className="audit-field-label d-block text-uppercase">
                      Archivos adjuntos (opcional)
                    </Form.Label>
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
                          <span className="d-block mt-1">
                            También puede usar Ctrl+V (Cmd+V en Mac) para pegar imágenes
                          </span>
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
              <Button
                variant="primary"
                onClick={handleActualizarFechas}
                disabled={loading || fechasInvalidas}
              >
                Actualizar Fechas
              </Button>
              <Button variant="info" onClick={handleAgregarComentario} disabled={loading}>
                Agregar Comentario
              </Button>
              {puedeMarcarCompletada && (
                <Button
                  variant="success"
                  onClick={handleCompletar}
                  disabled={loading || esTareaVencida}
                >
                  Marcar completada
                </Button>
              )}
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
          setDueDatePasswordError("");
        }}
        centered
        size="sm"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="fas fa-lock text-warning me-2"></i>
            Clave del super administrador
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-muted small mb-3">
            Para modificar la fecha de vencimiento debe ingresar la clave del super administrador.
          </p>
          <Form.Group>
            <Form.Label>Contraseña</Form.Label>
            <Form.Control
              type="password"
              value={adminPasswordInput}
              onChange={(e) => {
                setAdminPasswordInput(e.target.value);
                setDueDatePasswordError("");
              }}
              placeholder="Ingrese la clave"
              onKeyDown={(e) => e.key === "Enter" && handleVerificarPasswordDueDate()}
              autoComplete="off"
            />
            {dueDatePasswordError ? (
              <div className="text-danger small mt-2">{dueDatePasswordError}</div>
            ) : null}
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => {
              setShowDueDatePasswordModal(false);
              setDueDatePasswordError("");
            }}
            disabled={verifyingDueDatePassword}
          >
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleVerificarPasswordDueDate}
            disabled={verifyingDueDatePassword}
          >
            {verifyingDueDatePassword ? "Verificando..." : "Verificar"}
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
                    src={getAdjuntoDisplayUrl(archivoPreview.adjunto)}
                    alt={archivoPreview.adjunto.nombre_original || "Imagen"}
                    className="img-fluid"
                    style={{ maxHeight: "80vh", maxWidth: "100%", objectFit: "contain" }}
                    onError={() => setErrorCargaArchivo(true)}
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
                    src={`${getAdjuntoDisplayUrl(archivoPreview.adjunto)}#toolbar=0`}
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
              <>
                <Button
                  variant="primary"
                  onClick={() => {
                    descargarArchivo(archivoPreview.adjunto);
                  }}
                >
                  <i className="fas fa-download me-2"></i>
                  Descargar
                </Button>
                <Button
                  variant="outline-primary"
                  onClick={() => abrirAdjuntoAuditoriaEnNuevaPestana(archivoPreview.adjunto)}
                >
                  <i className="fas fa-external-link-alt me-2"></i>
                  Abrir en nueva pestaña
                </Button>
              </>
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
            disabled={loading || esTareaVencida || !puedeMarcarCompletada}
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

