// @ts-nocheck — evita diagnósticos en cascada del language service sobre este .jsx
import { useState, useEffect, useRef, useMemo } from "react";
import {
  Modal,
  Button,
  Form,
  Spinner,
  ListGroup,
  Row,
  Col,
  Badge,
  Alert,
  Toast,
  ToastContainer,
} from "react-bootstrap";
import ReactQuill from "react-quill";
import MdyDashDateInput from "../common/MdyDashDateInput";
import "react-quill/dist/quill.snow.css";
import apiRequest from "../../services/api";
import systemConfigService from "../../services/SystemConfigService";
import {
  formatDateForDisplay,
  formatDateTimeForDisplay,
  formatTaskTimeDhm,
  durationFromStartToEnd,
  formatDhmString,
  normalizeDateForInput,
  parseApiDateToLocalDate,
} from "../../utils/formatters";
import { isTaskOverdue } from "../../utils/taskDueDate";
import { useMentionableQuill } from "../../hooks/useMentionableQuill";
import { extractMentionedUserIds, highlightMentions } from "../../utils/mentions";
import { useAuth } from "../../context/AuthContext";
import { getQuillInstance } from "../../utils/quillEditorUtils";
import TramosAsignacionBar from "./TramosAsignacionBar";

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

/** Timestamp para ordenar comentarios del historial (más reciente primero) */
const getComentarioHistorialOrdenMs = (c) => {
  const raw =
    c?.fecha ||
    c?.created_at ||
    c?.updated_at ||
    c?.fecha_creacion ||
    c?.fecha_actualizacion;
  if (raw) {
    const t = new Date(raw).getTime();
    if (!Number.isNaN(t)) return t;
  }
  const nid = Number(c?.id);
  return Number.isFinite(nid) ? nid : 0;
};

const toPositiveUserId = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Usuario asignado a la tarea (quien puede completarla según backend). */
const getTareaAsignadoUserId = (t) => {
  if (!t) return null;
  return (
    toPositiveUserId(t.assign_to_user_id) ??
    toPositiveUserId(t.assigned_user_id) ??
    toPositiveUserId(t.assign_to_user?.id) ??
    toPositiveUserId(t.assigned_user?.id) ??
    toPositiveUserId(t.assigned_to_user_id) ??
    toPositiveUserId(t.assigned_to_user?.id) ??
    toPositiveUserId(t.log?.assigned_user?.id) ??
    toPositiveUserId(t.log?.assigned_user_id) ??
    toPositiveUserId(t.log?.assign_to_user?.id) ??
    toPositiveUserId(t.log?.assign_to_user_id) ??
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

/** Nombre visible del usuario en sesión (para coincidir con `asignado_a` cuando no hay ID). */
const getAuthNombreVisible = (u) => {
  if (!u) return "";
  return (
    u.name ??
    u.nombre ??
    u.full_name ??
    u.username ??
    ""
  );
};

/**
 * Textos posibles de "asignado a" en el payload (incl. `asignado_a` como string).
 */
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
    t.task?.asignado_a,
    t.task?.assign_to_user?.name,
    t.log?.asignado_a,
    t.log?.assign_to_user?.name,
    t.log?.assigned_user?.name,
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

const pickNombreFrom = (v) => {
  if (!v) return "";
  if (typeof v === "string") return String(v).trim();
  if (typeof v === "object") {
    return String(v.name ?? v.nombre ?? v.full_name ?? v.username ?? v.email ?? "").trim();
  }
  return "";
};

/** "Asignada por" (creador/autor) según variantes del backend. */
const getTareaAsignadaPorNombre = (t) => {
  if (!t) return "";
  const candidates = [
    t.creado_por,
    t.creadoPor,
    t.created_by,
    t.createdBy,
    t.user,
    t.assigned_by,
    t.assignedBy,
    t.log?.creado_por,
    t.log?.creadoPor,
    t.log?.created_by,
    t.log?.user,
    t.log?.createdBy,
    t.created_by_name,
    t.creado_por_name,
    t.log?.created_by_name,
  ];
  for (const c of candidates) {
    const name = pickNombreFrom(c);
    if (name) return name;
  }
  return "";
};

const ResponderTareaModal = ({
  show,
  onHide,
  tarea,
  onUpdated,
  fromNotification = false,
  notificationContext = null,
}) => {
  const { hasPermission, hasRole, user } = useAuth();

  const puedeMarcarCompletada = useMemo(() => {
    const uid = getAuthUserId(user);
    const aid = getTareaAsignadoUserId(tarea);
    if (uid && aid && uid === aid) return true;
    return coincideAsignacionPorNombre(user, tarea);
  }, [user, tarea]);
  // ✅ Log de depuración para verificar la estructura de la tarea (solo una vez por tarea)
  const tareaLogRef = useRef(null);
  useEffect(() => {
    if (show && tarea && import.meta.env.DEV) {
      const tareaId = tarea?.id || tarea?.task_id || tarea?.tarea_id;
      // Solo loguear si es una tarea diferente
      if (tareaId && tareaLogRef.current !== tareaId) {
        tareaLogRef.current = tareaId;
        console.log("🔍 [DEBUG] Estructura de la tarea recibida:", {
          id: tarea.id,
          task_id: tarea.task_id,
          tarea_id: tarea.tarea_id,
          tiene_id: !!(tarea.id || tarea.task_id || tarea.tarea_id),
          // ✅ Información del usuario asignado
          assigned_user: tarea?.assigned_user,
          assign_to_user: tarea?.assign_to_user,
          assigned_to_user: tarea?.assigned_to_user,
          assignedUser: tarea?.assignedUser,
          log_user: tarea?.log?.user,
          log_assigned_user: tarea?.log?.assigned_user,
          user: tarea?.user,
          assign_to_user_name: tarea?.assign_to_user_name,
          assigned_to_name: tarea?.assigned_to_name
        });
      }
    }
    // Resetear cuando se cierra el modal
    if (!show) {
      tareaLogRef.current = null;
    }
  }, [show, tarea?.id]);

  const numericTareaIdForTramos = useMemo(() => {
    const raw = tarea?.id || tarea?.task_id || tarea?.tarea_id;
    const n = typeof raw === "string" ? parseInt(raw, 10) : Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [tarea?.id, tarea?.task_id, tarea?.tarea_id]);

  useEffect(() => {
    if (show && numericTareaIdForTramos) {
      setTramosRefreshKey((k) => k + 1);
    }
  }, [show, numericTareaIdForTramos]);
 
  // ✅ Inicializar siempre vacío - no cargar response_note de la tarea
  const [responseNote, setResponseNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [comentarios, setComentarios] = useState([]);
  const [cargandoComentarios, setCargandoComentarios] = useState(false);

  // ✅ Estados simplificados para edición - usando solo el ID del comentario como clave
  const [comentariosEnEdicion, setComentariosEnEdicion] = useState({}); 
  const [comentariosHistorialEnEdicion, setComentariosHistorialEnEdicion] = useState({});

  const [comentariosActualizados, setComentariosActualizados] = useState({});
  const [comentariosHistorialActualizados, setComentariosHistorialActualizados] = useState({});
  /** Comentarios del historial (columna derecha): un solo panel desplegable por ítem de historial (clave = id del log/tarea) */
  const [historialComentariosExpandidos, setHistorialComentariosExpandidos] = useState({});

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

  // ✅ Estados para confirmación y toast
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showConfirmCompletarModal, setShowConfirmCompletarModal] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastVariant, setToastVariant] = useState("success");
  // ✅ Congelar el comentario resaltado al abrir el modal (no debe desaparecer hasta cerrar)
  const [frozenHighlightedCommentId, setFrozenHighlightedCommentId] = useState(null);
  const highlightedCommentId = useMemo(() => {
    return frozenHighlightedCommentId != null && frozenHighlightedCommentId !== ""
      ? String(frozenHighlightedCommentId)
      : null;
  }, [frozenHighlightedCommentId]);
  const hasScrolledToHighlightedCommentRef = useRef(false);

  // ✅ Historial del cliente
  const [historial, setHistorial] = useState([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [scheduledDate, setScheduledDate] = useState(normalizeDateForInput(tarea?.scheduled_date) || "");
  const [dueDate, setDueDate] = useState(normalizeDateForInput(tarea?.due_date) || "");
  // Fecha de vencimiento: bloqueada para todos; editable solo tras ingresar la clave del super admin
  const [dueDateUnlocked, setDueDateUnlocked] = useState(false);
  const [showDueDatePasswordModal, setShowDueDatePasswordModal] = useState(false);
  const [adminPasswordForDueDate, setAdminPasswordForDueDate] = useState("");
  const [adminPasswordInput, setAdminPasswordInput] = useState("");
  const [verifyingDueDatePassword, setVerifyingDueDatePassword] = useState(false);
  const [dueDatePasswordError, setDueDatePasswordError] = useState("");
  // ✅ Reasignación del usuario asignado (operativa)
  const [selectedAssignUserId, setSelectedAssignUserId] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignPreview, setAssignPreview] = useState(null); // para render inmediato sin depender del padre
  const [showReassign, setShowReassign] = useState(false);
  const [tramosRefreshKey, setTramosRefreshKey] = useState(0);

  // ✅ Estados para menciones
  const [usuarios, setUsuarios] = useState([]); // Lista de usuarios para menciones
  const [mentionedUserIds, setMentionedUserIds] = useState([]); // IDs de usuarios mencionados en el comentario actual

  // Estados para archivos adjuntos de la respuesta
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
  const usuariosCargadosRef = useRef(false);
  const tareaIdRef = useRef(null);

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

  const isDueDateLocked = tarea?.id && !dueDateUnlocked;

  const fechasInvalidas = scheduledDate && dueDate && scheduledDate > dueDate;
  const esTareaVencida =
    tarea?.due_date &&
    isTaskOverdue(tarea.due_date) &&
    tarea?.status !== "completed";

  // Orden del historial:
  // - Primero por "última actividad" (tarea modificada / comentario más reciente)
  // - Luego por estado (Pendiente -> En progreso -> Completada)
  // - Luego por fecha base (creación/inicio)
  const getEstadoPrioridad = (estado) => {
    const estadoNormalizado = String(estado || "").toLowerCase().trim();
    if (["pending", "pendiente"].includes(estadoNormalizado)) return 0;
    if (["in_progress", "in progress", "en_progreso", "en progreso"].includes(estadoNormalizado)) return 1;
    if (["completed", "completada", "terminada", "finalizada"].includes(estadoNormalizado)) return 2;
    return 3;
  };

  const getFechaOrdenHistorial = (item) => {
    const fechaRaw =
      item?.created_at ||
      item?.fecha_creacion ||
      item?.start_date ||
      item?.fecha_inicio ||
      item?.fecha;
    const timestamp = fechaRaw ? new Date(fechaRaw).getTime() : 0;
    return Number.isNaN(timestamp) ? 0 : timestamp;
  };

  const getUltimaActividadHistorial = (item) => {
    const fechas = [];

    // Campos típicos de actualización en tareas/logs
    [
      item?.updated_at,
      item?.fecha_actualizacion,
      item?.last_activity_at,
      item?.last_updated_at,
      item?.completed_at,
      item?.end_date,
      item?.fecha_fin,
    ].forEach((f) => {
      const t = f ? new Date(f).getTime() : 0;
      if (t && !Number.isNaN(t)) fechas.push(t);
    });

    // Comentarios del historial: usar el comentario más reciente si existe
    if (Array.isArray(item?.comentarios) && item.comentarios.length > 0) {
      item.comentarios.forEach((c) => {
        const raw =
          c?.fecha ||
          c?.created_at ||
          c?.updated_at ||
          c?.fecha_creacion ||
          c?.fecha_actualizacion;
        const t = raw ? new Date(raw).getTime() : 0;
        if (t && !Number.isNaN(t)) fechas.push(t);
      });
    }

    // Fallback a la fecha base del item
    fechas.push(getFechaOrdenHistorial(item));
    return Math.max(...fechas);
  };

  const historialOrdenado = [...historial].sort((a, b) => {
    const actA = getUltimaActividadHistorial(a);
    const actB = getUltimaActividadHistorial(b);
    if (actA !== actB) return actB - actA;

    const prioridadA = getEstadoPrioridad(a?.estado);
    const prioridadB = getEstadoPrioridad(b?.estado);
    if (prioridadA !== prioridadB) return prioridadA - prioridadB;

    return getFechaOrdenHistorial(b) - getFechaOrdenHistorial(a);
  });

  // ✅ Usar comentarios directamente de la tarea si están disponibles (nuevo endpoint)
  // Si no, usar del historial como antes (estructura antigua)
  const comentariosDeEstaTarea = tarea?.comments && Array.isArray(tarea.comments) 
    ? tarea.comments 
    : historial
        .filter(h => h.tipo === 'tarea' && h.id === tarea?.id)
        .flatMap(h => h.comentarios || []);

  
  const comentariosTareaActual = historial
    .filter(h => h.tipo === 'tarea' && h.concepto === tarea?.log?.concept?.name)
    .flatMap(h => h.comentarios || []);

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
      // Capturar el commentId al abrir; mantenerlo aunque el padre consuma la notificación
      const rawId = notificationContext?.commentId;
      setFrozenHighlightedCommentId(
        rawId == null || rawId === "" ? null : String(rawId)
      );
    } else {
      // Al cerrar el modal, limpiar
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
  }, [show, highlightedCommentId, historial, tarea?.comments]);

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
          } else {
            // Fallback al método anterior si Quill no está disponible
            setResponseNote((prev) => prev + (prev && !prev.endsWith(' ') ? ' ' : '') + textoTranscrito + ' ');
          }
        }
      };

      recognition.onerror = (event) => {
        console.error('Error en reconocimiento de voz:', event.error);
        if (event.error === 'no-speech') {
          // No hacer nada, es normal cuando no hay habla
          return;
        } else if (event.error === 'audio-capture') {
          alert('No se pudo acceder al micrófono. Por favor, verifica los permisos.');
          grabandoRef.current = false;
          setGrabando(false);
        } else if (event.error === 'not-allowed') {
          alert('Permiso de micrófono denegado. Por favor, permite el acceso al micrófono.');
          grabandoRef.current = false;
          setGrabando(false);
        } else if (event.error !== 'aborted') {
          grabandoRef.current = false;
          setGrabando(false);
        }
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
      alert('Error al iniciar el reconocimiento de voz. Por favor, intenta nuevamente.');
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

  // Pegar imágenes desde el portapapeles (Ctrl+V / Cmd+V) mientras el modal está abierto y la tarea admite respuesta
  useEffect(() => {
    if (!show || tarea?.status === "completed") return;

    const handlePaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const imageFiles = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            const timestamp = Date.now();
            const extension = file.type.split("/")[1] || "png";
            const blob = new Blob([file], { type: file.type });
            const namedFile = new File([blob], `imagen-pegada-${timestamp}.${extension}`, {
              type: file.type,
              lastModified: Date.now(),
            });
            imageFiles.push(namedFile);
          }
        }
      }

      if (imageFiles.length > 0) {
        agregarArchivos(imageFiles);
      }
    };

    document.addEventListener("paste", handlePaste);
    return () => {
      document.removeEventListener("paste", handlePaste);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- agregarArchivos es estable en la práctica (usa setState funcional)
  }, [show, tarea?.status]);

  // ✅ Cargar usuarios para menciones (precargar inmediatamente)
  useEffect(() => {
    if (!show) {
      // No limpiar usuarios al cerrar para mantener cache
      return;
    }
    
    // Si ya tenemos usuarios cargados, no volver a cargar
    if (usuariosCargadosRef.current || (usuarios && usuarios.length > 0)) {
      return;
    }
    
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
          console.warn('⚠️ No se recibió respuesta al cargar usuarios');
          if (mounted) {
            setUsuarios([]);
          }
          return;
        }
        
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
        
        // Normalizar estructura de usuarios
        const usuariosNormalizados = usuariosData.map(u => ({
          id: u.id,
          name: u.name || u.nombre || u.username || '',
          nombre: u.nombre || u.name || u.username || '',
          email: u.email || '',
        })).filter(u => u.id && u.name); // Solo usuarios válidos
        
        if (mounted) {
          setUsuarios(usuariosNormalizados);
          usuariosCargadosRef.current = true;
        }
      } catch (err) {
        console.error("❌ Error al cargar usuarios para menciones:", err);
        if (mounted) {
          setUsuarios([]);
        }
      }
    };
    
    // Cargar inmediatamente
    cargarUsuarios();
    
    return () => {
      mounted = false;
    };
  }, [show]); // Solo cuando se abre el modal

  // ✅ Sincronizar el usuario seleccionado cuando cambia la tarea o se abre el modal
  useEffect(() => {
    if (!show) return;

    const currentAssignedUserId =
      tarea?.assign_to_user_id ||
      tarea?.assigned_user_id ||
      tarea?.assign_to_user?.id ||
      tarea?.assigned_user?.id ||
      tarea?.log?.assigned_user?.id ||
      tarea?.log?.assigned_user_id ||
      tarea?.log?.assign_to_user?.id ||
      tarea?.log?.assign_to_user_id;

    setAssignPreview(null);
    setSelectedAssignUserId(currentAssignedUserId ? String(currentAssignedUserId) : "");
    setShowReassign(false);
  }, [show, tarea?.id]);

  // ✅ Usar useRef para rastrear la tarea actual y evitar loops infinitos
  useEffect(() => {
    const currentTareaId = tarea?.id;
    
    // ✅ Solo ejecutar si realmente cambió la tarea (por ID) o el modal se abrió/cerró
    if (!show) {
      // Limpiar cuando se cierra el modal
      if (tareaIdRef.current !== null) {
        archivos.forEach((arch) => {
          if (arch.preview) URL.revokeObjectURL(arch.preview);
        });
        setArchivos([]);
        setComentariosEnEdicion({});
        setComentariosHistorialEnEdicion({});
        setHistorialComentariosExpandidos({});
        // ✅ Limpiar responseNote al cerrar el modal
        setResponseNote("");
        tareaIdRef.current = null;
      }
      return;
    }
    
    // ✅ Limpiar responseNote siempre que se abre el modal (nuevo o reabierto)
    // Esto asegura que el campo esté vacío para nuevos comentarios
    setResponseNote("");

    // ✅ Solo procesar si es una nueva tarea (ID diferente)
    if (!currentTareaId || tareaIdRef.current === currentTareaId) {
      return;
    }

    // ✅ Marcar que estamos procesando esta tarea
    tareaIdRef.current = currentTareaId;

    // ✅ Resetear fechas cuando cambia la tarea
    const schedInit = normalizeDateForInput(tarea?.scheduled_date) || "";
    const dueInit = normalizeDateForInput(tarea?.due_date) || "";
    setScheduledDate(schedInit);
    setDueDate(dueInit);
    setDueDateUnlocked(false);
    setShowDueDatePasswordModal(false);
    setAdminPasswordForDueDate("");
    setAdminPasswordInput("");

    // ✅ Limpiar estados de edición al cambiar de tarea
    setComentariosEnEdicion({});
    setComentariosHistorialEnEdicion({});
    setComentariosActualizados({});
    setComentariosHistorialActualizados({});
    setHistorialComentariosExpandidos({});
    // ✅ Siempre inicializar responseNote vacío al abrir el modal
    setResponseNote("");

    // ✅ Cargar historial del cliente (solo si hay cliente válido)
    const clienteId = tarea?.log?.cliente?.id;
    if (clienteId) {
      setLoadingHistorial(true);
      apiRequest(`cliente/${clienteId}/historial`, "GET")
        .then((data) => {
          // ✅ Verificar que seguimos en la misma tarea
          if (tareaIdRef.current !== currentTareaId) return;
          
          const historialData = Array.isArray(data.data) ? data.data : [];
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
              
              // ✅ Acumular adjuntos en un objeto antes de hacer setState una sola vez
              const adjuntosAcumulados = {};
              comentariosUnicos.forEach((c) => {
                if (c.id && c.adjuntos && Array.isArray(c.adjuntos) && c.adjuntos.length > 0) {
                  adjuntosAcumulados[c.id] = c.adjuntos;
                }
              });
              
              // ✅ Actualizar estado una sola vez
              if (Object.keys(adjuntosAcumulados).length > 0) {
                setAdjuntosComentarios((prev) => ({
                  ...prev,
                  ...adjuntosAcumulados,
                }));
              }
              
              return { ...h, comentarios: comentariosUnicos };
            }
            return h;
          });
          
          // ✅ Verificar nuevamente antes de actualizar historial
          if (tareaIdRef.current === currentTareaId) {
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
                // ✅ Verificar nuevamente antes de cargar adjuntos
                if (tareaIdRef.current !== currentTareaId) return;
                
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
          }
        })
        .catch(error => {
          console.error("❌ Error al cargar historial:", error);
          if (tareaIdRef.current === currentTareaId) {
            setHistorial([]);
          }
        })
        .finally(() => {
          if (tareaIdRef.current === currentTareaId) {
            setLoadingHistorial(false);
          }
        });
    }
  }, [show, tarea?.id]); // ✅ Solo dependencias primitivas - removido tarea?.log?.cliente?.id para evitar loops

  // ✅ Función para mostrar confirmación antes de agregar comentario
  const handleAgregarComentario = () => {
    if (isNoteEmpty(responseNote) && archivos.length === 0) {
      alert("Por favor, escribe un comentario o adjunta al menos un archivo.");
      return;
    }
    setShowConfirmModal(true);
  };

  // ✅ Función que realmente envía el comentario después de la confirmación
  const confirmarYEnviarComentario = async () => {
    setShowConfirmModal(false);
    setLoading(true);
    try {
      // ✅ Validar que tenemos un ID de tarea válido
      const tareaId = tarea?.id || tarea?.task_id || tarea?.tarea_id;
      if (!tareaId) {
        const errorMsg = "No se pudo identificar la tarea. Por favor, cierre el modal y vuelva a intentar.";
        setToastMessage(`❌ ${errorMsg}`);
        setToastVariant("danger");
        setShowToast(true);
        setLoading(false);
        console.error("❌ Error: No hay ID de tarea disponible", tarea);
        return;
      }
      
      // ✅ Extraer menciones antes de enviar
      let mentionedIds = extractMentionedUserIds(responseNote || "", usuarios);

      // ✅ NUEVO: Notificar siempre al asignado cuando otro usuario comenta,
      // aun si no lo mencionan explícitamente con @.
      // Esto permite que el dueño vea la novedad en su calendario (sin websocket).
      try {
        const assignedId = getTareaAsignadoUserId(tarea);
        const myId = getAuthUserId(user);
        if (assignedId && myId && assignedId !== myId) {
          const unique = new Set(Array.isArray(mentionedIds) ? mentionedIds : []);
          unique.add(assignedId);
          mentionedIds = [...unique];
        }
      } catch {
        // no-op
      }
      
      // 📝 Log de depuración: Menciones detectadas
      if (import.meta.env.DEV) {
        console.log("🔔 [NOTIFICACIONES] Creando comentario con menciones:", {
          tarea_id: tareaId,
          comentario_preview: responseNote?.substring(0, 100) || "",
          mentioned_user_ids: mentionedIds,
          usuarios_mencionados: usuarios.filter(u => mentionedIds.includes(u.id)).map(u => ({ id: u.id, name: u.name })),
          endpoint: `tareas_operativas/${tareaId}/comentarios`
        });
      }
      
      const payload = { 
        comment: responseNote || " ",
        mentioned_user_ids: mentionedIds // Enviar IDs de usuarios mencionados al backend
      };
      
      // ✅ Log de depuración: URL y payload antes de enviar
      if (import.meta.env.DEV) {
        console.log("📤 [API] Enviando comentario:", {
          endpoint: `tareas_operativas/${tareaId}/comentarios`,
          method: "POST",
          tareaId: tareaId,
          tipo_tareaId: typeof tareaId,
          payload: payload,
          url_completa: `${API_BASE_URL}/tareas_operativas/${tareaId}/comentarios`
        });
      }
      
      // ✅ Validar que tareaId sea un número válido
      const numericTareaId = typeof tareaId === 'string' ? parseInt(tareaId, 10) : tareaId;
      if (isNaN(numericTareaId) || numericTareaId <= 0) {
        throw new Error(`ID de tarea inválido: ${tareaId}`);
      }
      
      // ✅ Log del ID que se está usando
      if (import.meta.env.DEV) {
        console.log("🔍 [DEBUG] ID de tarea a usar:", {
          original: tareaId,
          tipo_original: typeof tareaId,
          numeric: numericTareaId,
          tipo_numeric: typeof numericTareaId,
          tarea_completa: tarea
        });
      }
      
      // ✅ Intentar agregar el comentario directamente - el backend validará si la tarea existe
      const data = await apiRequest(
        `tareas_operativas/${numericTareaId}/comentarios`,
        "POST",
        payload
      );
      
      // 📝 Log de depuración: Confirmación de envío
      if (import.meta.env.DEV) {
        console.log("✅ [NOTIFICACIONES] Comentario creado exitosamente:", {
          comentario_id: data?.comment?.id,
          tarea_id: tareaId,
          mentioned_user_ids_enviados: mentionedIds,
          respuesta_backend: data
        });
      }

      let comentarioId = data?.comment?.id;

      // ✅ Si el comentario tiene adjuntos en la respuesta, guardarlos directamente
      if (comentarioId && data?.comment?.adjuntos) {
        setAdjuntosComentarios((prev) => ({
          ...prev,
          [comentarioId]: Array.isArray(data.comment.adjuntos) ? data.comment.adjuntos : [],
        }));
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

      // ✅ Actualizar estado de la tarea: si estaba "pending", cambiar a "in_progress"
      const nuevoStatus = tarea.status === "pending" ? "in_progress" : tarea.status;
      
      const tareaActualizada = {
        ...tarea,
        response_note: responseNote,
        status: nuevoStatus,
      };

      // ✅ Log de depuración del cambio de estado
      if (import.meta.env.DEV) {
        console.log("🔄 [ESTADO] Actualizando estado de la tarea:", {
          id: tareaActualizada.id,
          estado_anterior: tarea.status,
          estado_nuevo: nuevoStatus,
          tarea_actualizada: tareaActualizada
        });
      }

      // ✅ Notificar actualización ANTES de cerrar el modal para que el cambio se vea inmediatamente
      if (onUpdated) {
        onUpdated(tareaActualizada);
      }

      // ✅ Cargar historial si es necesario (en paralelo, no bloquea)
      if (tarea.log?.cliente?.id) {
        apiRequest(`cliente/${tarea.log.cliente.id}/historial`, "GET")
          .then((data) => {
            const historialData = Array.isArray(data.data) ? data.data : [];
            setHistorial(historialData);
          })
          .catch(err => {
            // No bloquear si falla cargar el historial
            if (import.meta.env.DEV) {
              console.warn("⚠️ Error al cargar historial después de agregar comentario:", err);
            }
          });
      }
    
      setResponseNote("");
      // Limpiar archivos después de subirlos
      archivos.forEach((arch) => {
        if (arch.preview) URL.revokeObjectURL(arch.preview);
      });
      setArchivos([]);
      
      // ✅ Mostrar toast de éxito
      setToastMessage("✅ Comentario agregado exitosamente a la tarea");
      setToastVariant("success");
      setShowToast(true);
      // ✅ No cerrar automáticamente: el usuario puede seguir revisando el modal.
    } catch (error) {
      console.error("❌ Error al agregar el comentario:", error);
      
      // ✅ Mensaje de error más descriptivo y específico
      let errorMessage = "Error desconocido";
      const tareaId = tarea?.id || tarea?.task_id || tarea?.tarea_id;
      
      if (error.message) {
        errorMessage = error.message;
      } else if (error.response?.status === 404) {
        // ✅ Mensaje más claro para 404
        errorMessage = `No se pudo agregar el comentario. La tarea con ID ${tareaId} no fue encontrada o no tiene permisos para acceder a ella. Por favor, cierre el modal y vuelva a abrir la tarea desde la lista.`;
      } else if (error.response?.status === 422) {
        errorMessage = "Error de validación. Por favor, verifique los datos ingresados.";
      } else if (error.response?.status === 401) {
        errorMessage = "No autorizado. Por favor, inicie sesión nuevamente.";
      } else if (error.response?.status === 403) {
        errorMessage = "No tiene permisos para agregar comentarios a esta tarea.";
      } else if (error.response?.status >= 500) {
        errorMessage = "Error del servidor. Por favor, intente más tarde.";
      }
      
      // ✅ Log adicional en desarrollo para debugging
      if (import.meta.env.DEV) {
        console.error("❌ Detalles del error al agregar comentario:", {
          error: error,
          error_message: error.message,
          tareaId: tareaId,
          tarea_completa: tarea,
          response_status: error.response?.status,
          response_data: error.response?.data,
          response_url: error.response?.url
        });
      }
      
      // ✅ Mostrar toast de error
      setToastMessage(`❌ ${errorMessage}`);
      setToastVariant("danger");
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Función para mostrar confirmación antes de completar tarea
  const handleCompletar = () => {
    setShowConfirmCompletarModal(true);
  };

  // ✅ Función que realmente completa la tarea después de la confirmación
  const confirmarYCompletarTarea = async () => {
    setShowConfirmCompletarModal(false);
    setLoading(true);
    try {
      if (!puedeMarcarCompletada) {
        setToastMessage("Solo el usuario asignado a la tarea puede marcarla como completada.");
        setToastVariant("warning");
        setShowToast(true);
        setLoading(false);
        return;
      }

      // ✅ Validar que tenemos un ID de tarea válido
      const tareaId = tarea?.id || tarea?.task_id || tarea?.tarea_id;
      if (!tareaId) {
        const errorMsg = "No se pudo identificar la tarea. Por favor, cierre el modal y vuelva a intentar.";
        setToastMessage(`❌ ${errorMsg}`);
        setToastVariant("danger");
        setShowToast(true);
        setLoading(false);
        console.error("❌ Error: No hay ID de tarea disponible", tarea);
        return;
      }
      
      let comentarioId = null;
      
      if (
        (!isNoteEmpty(responseNote) || archivos.length > 0) &&
        (comentarios.length === 0 ||
          comentarios[comentarios.length - 1].comment !== responseNote)
      ) {
        // ✅ Extraer menciones antes de enviar
        let mentionedIds = extractMentionedUserIds(responseNote || "", usuarios);

        // ✅ NUEVO: Notificar siempre al asignado cuando otro usuario completa con comentario
        try {
          const assignedId = getTareaAsignadoUserId(tarea);
          const myId = getAuthUserId(user);
          if (assignedId && myId && assignedId !== myId) {
            const unique = new Set(Array.isArray(mentionedIds) ? mentionedIds : []);
            unique.add(assignedId);
            mentionedIds = [...unique];
          }
        } catch {
          // no-op
        }
        
        // 📝 Log de depuración: Menciones detectadas (al completar tarea)
        if (import.meta.env.DEV) {
          console.log("🔔 [NOTIFICACIONES] Creando comentario al completar tarea:", {
            tarea_id: tareaId,
            comentario_preview: responseNote?.substring(0, 100) || "",
            mentioned_user_ids: mentionedIds,
            usuarios_mencionados: usuarios.filter(u => mentionedIds.includes(u.id)).map(u => ({ id: u.id, name: u.name })),
            endpoint: `tareas_operativas/${tareaId}/comentarios`
          });
        }
        
        const payload = {
          comment: responseNote || " ",
          mentioned_user_ids: mentionedIds
        };
        
        // ✅ Validar que tareaId sea un número válido
        const numericTareaId = typeof tareaId === 'string' ? parseInt(tareaId, 10) : tareaId;
        if (isNaN(numericTareaId) || numericTareaId <= 0) {
          throw new Error(`ID de tarea inválido: ${tareaId}`);
        }
        
        const data = await apiRequest(
          `tareas_operativas/${numericTareaId}/comentarios`,
          "POST",
          payload
        );
        
        comentarioId = data?.comment?.id;
        
        // 📝 Log de depuración: Confirmación de envío (al completar tarea)
        if (import.meta.env.DEV) {
          console.log("✅ [NOTIFICACIONES] Comentario creado al completar tarea:", {
            comentario_id: comentarioId,
            tarea_id: tareaId,
            mentioned_user_ids_enviados: mentionedIds,
            tarea_status: "completed"
          });
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
      }

      // ✅ Validar que tareaId sea un número válido (usar el mismo que se usó para el comentario si existe)
      const numericTareaIdFinal = typeof tareaId === 'string' ? parseInt(tareaId, 10) : tareaId;
      if (isNaN(numericTareaIdFinal) || numericTareaIdFinal <= 0) {
        throw new Error(`ID de tarea inválido: ${tareaId}`);
      }
      
      // Tiempo dedicado: desde inicio de la tarea hasta ahora (liquidación calculada por el front)
      const fechaInicio = tarea?.created_at || tarea?.scheduled_date || tarea?.fecha_inicio;
      const { dias, horas, minutos } = durationFromStartToEnd(fechaInicio || new Date(), new Date());
      const completarEndpoint = `tareas_operativas/${numericTareaIdFinal}/completar`;
      try {
        await apiRequest(completarEndpoint, "PUT", { dias, horas, minutos });
      } catch (err) {
        const status = err?.response?.status;
        // Algunos backends exponen este endpoint como POST (no PUT). Si PUT da 404, reintentar con POST.
        if (status === 404) {
          await apiRequest(completarEndpoint, "POST", { dias, horas, minutos });
        } else {
          throw err;
        }
      }

      // ✅ IMPORTANTE: después de completar, refrescar el detalle para obtener completed_at/closed_at/log actualizado
      // (si solo cambiamos status localmente, algunos listados se quedan sin "fecha terminada")
      let freshTask = null;
      try {
        const freshRes = await apiRequest(`tareas_operativas/${numericTareaIdFinal}`, "GET");
        freshTask = freshRes?.data ?? freshRes?.task ?? freshRes ?? null;
      } catch (e) {
        // No bloquear si el refresh falla: seguimos con el fallback local
        if (import.meta.env.DEV) console.warn("⚠️ No se pudo refrescar tarea completada:", e?.message || e);
      }

      const tareaActualizada = {
        ...tarea,
        ...(freshTask && typeof freshTask === "object" ? freshTask : {}),
        status: "completed",
        estado: "completed",
        completed_at:
          (freshTask && (freshTask.completed_at || freshTask.closed_at || freshTask.finished_at)) ||
          tarea?.completed_at ||
          new Date().toISOString(),
      };
      if (onUpdated) onUpdated(tareaActualizada);
      setTramosRefreshKey((k) => k + 1);
      
      // Limpiar archivos después de subirlos
      archivos.forEach((arch) => {
        if (arch.preview) URL.revokeObjectURL(arch.preview);
      });
      setArchivos([]);

      // ✅ No cerrar automáticamente: el usuario puede revisar que todo quede bien.
      setToastMessage("✅ Tarea completada exitosamente");
      setToastVariant("success");
      setShowToast(true);
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
    if (isNoteEmpty(nuevoTexto)) {
      console.warn("⚠️ Texto de comentario vacío");
      return;
    }


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
    if (isNoteEmpty(nuevoTexto)) {
      console.warn("⚠️ Texto de comentario vacío");
      return;
    }


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


    } catch (error) {
      console.error("❌ Error al actualizar el comentario del historial:", error);
      alert("Error al actualizar el comentario. Por favor, intenta de nuevo.");
    }
  };
  
  // Verificar contraseña del super admin con el backend antes de desbloquear
  const handleVerificarPasswordDueDate = async () => {
    const pwd = (adminPasswordInput || "").trim();
    setDueDatePasswordError("");
    if (!pwd) {
      setToastVariant("warning");
      setToastMessage("Ingrese la contraseña del super administrador");
      setShowToast(true);
      return;
    }
    setVerifyingDueDatePassword(true);
    try {
      await systemConfigService.verifySuperAdminPassword(pwd);
      setAdminPasswordForDueDate(pwd);
      setDueDateUnlocked(true);
      setAdminPasswordInput("");
      setDueDatePasswordError("");
      setShowDueDatePasswordModal(false);
      setToastVariant("success");
      setToastMessage("Fecha de vencimiento desbloqueada. Puede modificarla y guardar.");
      setShowToast(true);
    } catch (err) {
      const msg = err?.message || err?.response?.data?.message || "Contraseña incorrecta.";
      setDueDatePasswordError(msg);
      setToastVariant("danger");
      setToastMessage("La contraseña del super administrador no es correcta.");
      setShowToast(true);
    } finally {
      setVerifyingDueDatePassword(false);
    }
  };

  const handleActualizarFechas = async () => {
    const schedYmd = normalizeDateForInput(scheduledDate);
    const dueYmd = normalizeDateForInput(dueDate);
    if (!schedYmd || !dueYmd || !/^\d{4}-\d{2}-\d{2}$/.test(schedYmd) || !/^\d{4}-\d{2}-\d{2}$/.test(dueYmd)) {
      alert("Ingrese fechas completas y válidas (MM-DD-YYYY).");
      return;
    }
    if (schedYmd > dueYmd) {
      setToastVariant("danger");
      setToastMessage("La fecha de inicio no puede ser mayor que la fecha de vencimiento.");
      setShowToast(true);
      return;
    }

    // ✅ Validar que tenemos un ID de tarea válido
    const tareaId = tarea?.id || tarea?.task_id || tarea?.tarea_id;
    if (!tareaId) {
      alert("No se pudo identificar la tarea. Por favor, cierre el modal y vuelva a intentar.");
      return;
    }

    const dueDateOriginal = normalizeDateForInput(tarea?.due_date) || "";
    const dueDateCambiada = dueYmd !== dueDateOriginal;
    const requierePassword = dueDateCambiada;
    if (requierePassword && !adminPasswordForDueDate) {
      setToastVariant("warning");
      setToastMessage("Para cambiar la fecha de vencimiento debe ingresar la clave del super administrador.");
      setShowToast(true);
      setShowDueDatePasswordModal(true);
      return;
    }
    
    setLoading(true);
    try {
      // ✅ Validar que tareaId sea un número válido
      const numericTareaId = typeof tareaId === 'string' ? parseInt(tareaId, 10) : tareaId;
      if (isNaN(numericTareaId) || numericTareaId <= 0) {
        throw new Error(`ID de tarea inválido: ${tareaId}`);
      }
      
      const payload = {
        scheduled_date: schedYmd,
        due_date: dueYmd,
      };
      if (dueDateCambiada) {
        payload.admin_password = adminPasswordForDueDate;
      }
      await apiRequest(`tareas_operativas/${numericTareaId}/reprogramar`, "PUT", payload);

      const tareaActualizada = {
        ...tarea,
        scheduled_date: schedYmd,
        due_date: dueYmd,
      };

      if (onUpdated) onUpdated(tareaActualizada);
      setScheduledDate(schedYmd);
      setDueDate(dueYmd);
      setTramosRefreshKey((k) => k + 1);
      setDueDateUnlocked(false);
      setAdminPasswordForDueDate("");
      setToastVariant("success");
      setToastMessage("Fechas actualizadas exitosamente");
      setShowToast(true);
    } catch (error) {
      console.error(error);
      const msg = error.response?.data?.message || error.message || "Error al actualizar fechas";
      if (error.response?.status === 403 || (msg && (msg.toLowerCase().includes("contraseña") || msg.toLowerCase().includes("password") || msg.toLowerCase().includes("autoriz")))) {
        setAdminPasswordForDueDate("");
        setDueDateUnlocked(false);
        setToastVariant("danger");
        setToastMessage("Clave del super administrador incorrecta o sin permisos.");
      } else {
        setToastVariant("danger");
        setToastMessage(msg);
      }
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Función para reasignar tarea (operativa)
  const handleReasignar = async () => {
    const nuevaAsignacionId = parseInt(selectedAssignUserId, 10);
    if (!nuevaAsignacionId) {
      setToastVariant("warning");
      setToastMessage("Debes seleccionar un usuario");
      setShowToast(true);
      return;
    }

    const tareaId = tarea?.id || tarea?.task_id || tarea?.tarea_id;
    if (!tareaId) {
      setToastVariant("danger");
      setToastMessage("No se pudo identificar la tarea");
      setShowToast(true);
      return;
    }

    const numericTareaId = typeof tareaId === "string" ? parseInt(tareaId, 10) : tareaId;
    if (isNaN(numericTareaId) || numericTareaId <= 0) {
      setToastVariant("danger");
      setToastMessage("ID de tarea inválido");
      setShowToast(true);
      return;
    }

    setAssignLoading(true);
    try {
      // PUT /asignar: cierra tramo actual (reasigned) y crea tramo nuevo en operational_task_assignments
      const payload = {
        assigned_user_id: nuevaAsignacionId,
      };

      const res = await apiRequest(
        `tareas_operativas/${numericTareaId}/asignar`,
        "PUT",
        payload
      );
      let updatedTask = res?.data || res || null;

      // Recargar para traer la estructura completa (cliente/historial/usuarios) si el backend lo retorna diferente
      try {
        const freshRes = await apiRequest(`tareas_operativas/${numericTareaId}`, "GET");
        const freshTask = freshRes?.data || freshRes || null;
        if (freshTask && typeof freshTask === "object") updatedTask = freshTask;
      } catch {
        // No bloqueamos si falla el refresh
      }

      const userObj =
        usuarios?.find((u) => String(u.id) === String(nuevaAsignacionId)) ||
        updatedTask?.assigned_user ||
        updatedTask?.assign_to_user ||
        null;

      const tareaActualizada = {
        ...tarea,
        ...(updatedTask && typeof updatedTask === "object" ? updatedTask : {}),
        assigned_user_id: nuevaAsignacionId,
        assign_to_user_id: nuevaAsignacionId,
        assigned_user: updatedTask?.assigned_user || userObj,
        assign_to_user: updatedTask?.assign_to_user || userObj,
      };

      setAssignPreview(tareaActualizada);
      if (onUpdated) onUpdated(tareaActualizada);
      setTramosRefreshKey((k) => k + 1);
      setShowReassign(false);

      const totalTramos = res?.tramos?.total_tramos;
      setToastVariant("success");
      setToastMessage(
        totalTramos != null
          ? `Asignación actualizada. ${totalTramos} tramo(s) registrado(s).`
          : "Asignación actualizada exitosamente"
      );
      setShowToast(true);
    } catch (error) {
      console.error("Error al reasignar tarea:", error);
      const msg = error.response?.data?.message || error.message || "Error al reasignar la tarea";
      setToastVariant("danger");
      setToastMessage(msg);
      setShowToast(true);
    } finally {
      setAssignLoading(false);
    }
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
      } else {
        // Si no, intentar cargar desde endpoint específico del comentario
        try {
          const response = await apiRequest(`tareas_operativas/comentarios/${comentarioId}/adjuntos`, "GET");
          data = Array.isArray(response) ? response : response?.data || response?.adjuntos || [];
        } catch (endpointErr) {
          // Si no existe el endpoint, dejar vacío
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
    <Modal 
      show={show} 
      onHide={() => onHide(false)} 
      size="xl" 
      centered
      style={{ zIndex: 1050 }}
      className="responder-tarea-modal"
    >
      <style>{`
        .responder-tarea-modal .modal-dialog {
          max-width: 95vw;
          width: 1400px;
          height: 95vh;
          margin-top: 2.5vh;
          margin-bottom: 2.5vh;
        }
        .responder-tarea-modal .modal-content {
          border-radius: 12px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        .responder-tarea-modal .modal-header {
          background: #fff;
          border-bottom: none;
          padding: 0;
          border-radius: 12px 12px 0 0;
          flex-direction: column;
          align-items: stretch;
        }
        .responder-tarea-modal .modal-header-corporate {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          padding: 0.65rem 1.25rem;
          background: linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%);
          border-radius: 12px 12px 0 0;
        }
        .responder-tarea-modal .modal-header-corporate .modal-title {
          font-size: 1.05rem;
          font-weight: 600;
          color: #fff;
          margin: 0;
          letter-spacing: 0.01em;
        }
        .responder-tarea-modal .modal-header-corporate .modal-title i {
          color: rgba(255, 255, 255, 0.9);
          font-size: 1rem;
        }
        .responder-tarea-modal .modal-header-corporate .badge {
          background: rgba(255, 255, 255, 0.2) !important;
          color: #fff !important;
          border: 1px solid rgba(255, 255, 255, 0.25);
          font-weight: 500;
        }
        .responder-tarea-modal .modal-header-corporate .btn-close {
          flex-shrink: 0;
          margin: 0;
          padding: 0.5rem;
          opacity: 0.85;
          filter: invert(1) grayscale(1) brightness(2);
          border-radius: 6px;
          background-color: rgba(255, 255, 255, 0.08);
        }
        .responder-tarea-modal .modal-header-corporate .btn-close:hover {
          opacity: 1;
          background-color: rgba(255, 255, 255, 0.18);
        }
        .responder-tarea-modal .modal-title {
          font-size: 1.35rem;
          font-weight: 600;
          color: #212529;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .responder-tarea-modal .modal-body {
          padding: 2rem;
          background: #f8f9fa;
          flex: 1 1 auto;
          overflow: hidden;
        }
        .responder-tarea-modal .modal-footer {
          flex: 0 0 auto;
        }
        .responder-tarea-modal .section-title {
          font-size: 1.1rem;
          font-weight: 600;
          color: #495057;
          margin-bottom: 1.5rem;
          padding-bottom: 0.75rem;
          border-bottom: 2px solid #e9ecef;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .responder-tarea-modal .info-card {
          background: #fff;
          border: 1px solid #e9ecef;
          border-radius: 10px;
          padding: 1.5rem;
          margin-bottom: 1.5rem;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
          transition: box-shadow 0.2s ease;
        }
        .responder-tarea-modal .info-card:hover {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }
        .responder-tarea-modal .form-label {
          font-weight: 600;
          color: #495057;
          margin-bottom: 0.5rem;
          font-size: 0.95rem;
        }
        .responder-tarea-modal .text-content {
          line-height: 1.7;
          color: #495057;
          font-size: 0.95rem;
        }
        @keyframes highlighted-comment-pulse {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(220, 53, 69, 0.24);
          }
          50% {
            box-shadow: 0 0 0 6px rgba(220, 53, 69, 0.08);
          }
        }
        .responder-tarea-modal .highlighted-comment-card {
          border: 1px solid rgba(220, 53, 69, 0.35) !important;
          background: #fff5f5;
          animation: highlighted-comment-pulse 1.4s ease-in-out infinite;
        }
        .responder-tarea-modal .modal-header-tramos {
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
          padding: 0.4rem 1.25rem 0.5rem;
        }
      `}</style>
      <Modal.Header closeButton={false} className="pb-0">
        <div className="modal-header-corporate w-100">
          <Modal.Title className="d-flex align-items-center gap-2 flex-wrap">
            <i className="fas fa-tasks" aria-hidden />
            <span>{tarea.status === "completed" ? "Detalle de Tarea" : "Responder Tarea"}</span>
            {tarea?.id && (
              <Badge className="ms-1" style={{ fontSize: "0.7rem" }}>
                ID {tarea.id || tarea.task_id || tarea.tarea_id}
              </Badge>
            )}
          </Modal.Title>
          <button
            type="button"
            className="btn-close"
            aria-label="Cerrar"
            onClick={() => onHide(false)}
          />
        </div>
        <div className="modal-header-tramos w-100">
          <TramosAsignacionBar
            tareaId={numericTareaIdForTramos}
            refreshKey={tramosRefreshKey}
          />
        </div>
      </Modal.Header>
        <Modal.Body>
          <Row className="g-4" style={{ height: "100%" }}>
            {/* ✅ Columna izquierda: Tarea */}
            <Col md={6} style={{ borderRight: "2px solid #e9ecef", paddingRight: "2rem", height: "100%", overflowY: "auto" }}>
              <div className="section-title">
                <i className="fas fa-info-circle text-primary"></i>
                Detalles de la Tarea
              </div>
            {highlightedCommentId && (
              <Alert variant="danger" className="py-2 px-3 d-flex align-items-center gap-2">
                <i className="fas fa-comment-dots"></i>
                <span className="small mb-0">
                  Se resalt&oacute; el comentario nuevo relacionado con esta notificaci&oacute;n.
                </span>
              </Alert>
            )}
            <div className="info-card">
              {/* ✅ Cabecera con estado y nombre */}
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div className="flex-grow-1">
                  <div className="d-flex align-items-center gap-2 mb-2">
                    {tarea.log?.cliente?.estado_cliente === "prospecto" && (
                      <Badge bg="warning" text="dark" className="px-3 py-2" style={{ fontSize: "0.85rem" }}>
                        <i className="fas fa-user-clock me-1"></i>Prospecto
                      </Badge>
                    )}
                    {tarea.log?.cliente?.estado_cliente === "cliente" && (
                      <Badge bg="primary" className="px-3 py-2" style={{ fontSize: "0.85rem" }}>
                        <i className="fas fa-user-check me-1"></i>Cliente
                      </Badge>
                    )}
                    {tarea.log?.cliente?.estado_cliente === "descartado" && (
                      <Badge bg="secondary" className="px-3 py-2" style={{ fontSize: "0.85rem" }}>
                        <i className="fas fa-user-times me-1"></i>Descartado
                      </Badge>
                    )}
                  </div>
                  <h5 className="mb-1" style={{ fontWeight: 600, color: "#212529", fontSize: "1.15rem" }}>
                    {tarea.log?.cliente?.nombre_completo || "Cliente no disponible"}
                  </h5>
                  {tarea.log?.cliente?.telefono && (
                    <div className="text-muted" style={{ fontSize: "0.9rem" }}>
                      <i className="fas fa-phone me-1"></i>{tarea.log?.cliente?.telefono}
                    </div>
                  )}
                </div>
              </div>

              {/* ✅ Botones de acción */}
              {tarea.log?.cliente?.id && (
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
              )}

              {/* ✅ Info Primer Contacto SOLO si es prospecto */}
              {tarea.log?.cliente?.estado_cliente?.toLowerCase() === "prospecto" &&
                tarea.log?.cliente?.primer_contacto_info && (
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
                            `/grupofamiliar/crear?cliente_id=${tarea.log?.cliente?.id}`,
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
                      {tarea.log?.cliente?.primer_contacto_info
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

            <div className="info-card">
              <div className="mb-3">
                <div className="d-flex align-items-center gap-2 mb-2">
                  <i className="fas fa-tag text-primary"></i>
                  <strong style={{ fontSize: "0.95rem", color: "#495057" }}>Concepto:</strong>
                </div>
                <p className="text-content mb-0">{tarea?.log?.concept?.name || "N/A"}</p>
              </div>
              {tarea.status !== "completed" ? (
                <>
                  <Row className="mb-3 g-3">
                    <Col>
                      <Form.Group>
                        <Form.Label>
                          <i className="fas fa-calendar-alt text-primary me-1"></i>
                          Programada
                        </Form.Label>
                        <MdyDashDateInput
                          allowManualEntry
                          size="sm"
                          className="rounded"
                          valueIso={scheduledDate}
                          minIso="1900-01-01"
                          maxIso={normalizeDateForInput(dueDate) || "2099-12-31"}
                          onChangeIso={setScheduledDate}
                          title={
                            dueDate
                              ? "No puede ser posterior a la fecha de vencimiento"
                              : undefined
                          }
                        />
                      </Form.Group>
                    </Col>
                    <Col>
                      <Form.Group>
                        <Form.Label>
                          <i className="fas fa-clock text-warning me-1"></i>
                          Vencimiento
                          {isDueDateLocked && (
                            <small className="text-muted ms-2">(requiere clave del super admin)</small>
                          )}
                        </Form.Label>
                        <div className="d-flex gap-2 align-items-start">
                          <div className="flex-grow-1" style={{ minWidth: 0 }}>
                            <MdyDashDateInput
                              allowManualEntry
                              size="sm"
                              className="rounded"
                              valueIso={dueDate}
                              minIso={normalizeDateForInput(scheduledDate) || "1900-01-01"}
                              maxIso="2099-12-31"
                              disabled={isDueDateLocked}
                              onChangeIso={setDueDate}
                              title={
                                isDueDateLocked
                                  ? "Desbloquee con la clave del super administrador para editar"
                                  : scheduledDate
                                    ? "No puede ser anterior a la fecha programada"
                                    : undefined
                              }
                            />
                          </div>
                          {isDueDateLocked && (
                            <Button
                              type="button"
                              variant={dueDateUnlocked ? "outline-success" : "outline-warning"}
                              size="sm"
                              onClick={() => (dueDateUnlocked ? (setDueDateUnlocked(false), setAdminPasswordForDueDate("")) : setShowDueDatePasswordModal(true))}
                              style={{ whiteSpace: "nowrap" }}
                              title={dueDateUnlocked ? "Bloquear de nuevo" : "Desbloquear para editar (requiere clave del super admin)"}
                            >
                              {dueDateUnlocked ? "Bloquear" : "Desbloquear"}
                            </Button>
                          )}
                        </div>
                      </Form.Group>
                    </Col>
                  </Row>
                  {fechasInvalidas && (
                    <Alert variant="danger" className="mb-3 py-2 small">
                      La fecha de inicio no puede ser mayor que la fecha de vencimiento.
                    </Alert>
                  )}
                  <Row className="mb-3 g-3">
                    <Col xs={12} md={6}>
                      <div className="h-100">
                        <div className="d-flex align-items-center gap-2 mb-2">
                          <i className="fas fa-user text-info"></i>
                          <strong style={{ fontSize: "0.95rem", color: "#495057" }}>Creado por:</strong>
                        </div>
                        <p className="text-content mb-0">
                          {getTareaAsignadaPorNombre(tarea) || "N/A"}
                        </p>
                      </div>
                    </Col>

                    <Col xs={12} md={6}>
                      <div className="h-100">
                        <div className="d-flex align-items-center gap-2 mb-2">
                          <i className="fas fa-user-check text-success"></i>
                          <strong style={{ fontSize: "0.95rem", color: "#495057" }}>Asignado a:</strong>
                        </div>
                        {(() => {
                      const currentId =
                        assignPreview?.assigned_user_id ||
                        assignPreview?.assign_to_user_id ||
                        assignPreview?.assigned_user?.id ||
                        assignPreview?.assign_to_user?.id ||
                        tarea?.assigned_user_id ||
                        tarea?.assign_to_user_id ||
                        tarea?.assigned_user?.id ||
                        tarea?.assign_to_user?.id ||
                        tarea?.log?.assigned_user_id ||
                        tarea?.log?.assign_to_user_id ||
                        tarea?.log?.assigned_user?.id ||
                        tarea?.log?.assign_to_user?.id ||
                        null;

                      const currentIdStr = currentId ? String(currentId) : "";
                      const userFromList =
                        currentIdStr ? (usuarios || []).find((u) => String(u.id) === currentIdStr) : null;

                      const currentName =
                        assignPreview?.assigned_user?.name ||
                        assignPreview?.assign_to_user?.name ||
                        tarea?.assigned_user?.name ||
                        tarea?.assign_to_user?.name ||
                        tarea?.assigned_to_user?.name ||
                        tarea?.assignedUser?.name ||
                        tarea?.log?.assigned_user?.name ||
                        tarea?.asignado_a ||
                        tarea?.asignadoA ||
                        tarea?.log?.asignado_a ||
                        tarea?.responsable ||
                        tarea?.log?.responsable ||
                        tarea?.assign_to_user_name ||
                        tarea?.assigned_to_name ||
                        userFromList?.name ||
                        userFromList?.nombre ||
                        userFromList?.email ||
                        null;

                      return (
                        <>
                          <p className="text-content mb-2">
                            {currentName || (currentIdStr ? `Usuario #${currentIdStr}` : "N/A")}
                          </p>

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
                            <div className="mt-2">
                              <Form.Select
                                value={selectedAssignUserId || ""}
                                onChange={(e) => setSelectedAssignUserId(e.target.value)}
                                disabled={assignLoading}
                              >
                                <option value="">Selecciona un usuario</option>
                                {(() => {
                                  if (!currentIdStr) return null;
                                  const existsInList = (usuarios || []).some((u) => String(u.id) === currentIdStr);
                                  if (existsInList) return null;
                                  return (
                                    <option key={`current-assignee-${currentIdStr}`} value={currentIdStr}>
                                      {currentName || `Usuario #${currentIdStr}`}
                                    </option>
                                  );
                                })()}
                                {(usuarios || []).map((user) => (
                                  <option key={user.id} value={user.id}>
                                    {user.name || user.nombre || user.email || `Usuario #${user.id}`}
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
                    </Col>
                  </Row>

                  <div className="mt-3">
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <i className="fas fa-sticky-note text-success"></i>
                      <strong style={{ fontSize: "0.95rem", color: "#495057" }}>Nota:</strong>
                    </div>
                    <div 
                      className="text-content"
                      style={{ 
                        marginTop: 4,
                        wordBreak: 'break-word'
                      }}
                      dangerouslySetInnerHTML={{ __html: tarea?.log?.note || 'Sin nota' }}
                    />
                  </div>

                </>
              ) : (
                <>
                  <Badge bg="info" className="me-2">{formatFecha(tarea?.scheduled_date)}</Badge>
                  <Badge bg={getBadgeColor(tarea?.due_date)}>
                    {formatFecha(tarea?.due_date)}
                  </Badge>
                  {formatTaskTimeDhm(tarea) !== "—" && (
                    <div className="mt-2">
                      <span className="text-muted small">Tiempo dedicado: </span>
                      <strong>{formatTaskTimeDhm(tarea)}</strong>
                    </div>
                  )}
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
            {(!comentariosDeEstaTarea || comentariosDeEstaTarea.length === 0) ? (
  <p>No hay comentarios previos.</p>
) : (
  comentariosDeEstaTarea.map((c) => {
    const estaEnEdicion = comentariosEnEdicion.hasOwnProperty(c.id);
    const fueActualizado = comentariosActualizados[c.id];

    const isHighlightedComment = highlightedCommentId && String(c.id) === highlightedCommentId;

    return (
      <ListGroup.Item
        key={c.id}
        data-highlight-comment-id={isHighlightedComment ? String(c.id) : undefined}
        className={`${fueActualizado ? 'border-success' : ''} ${isHighlightedComment ? 'highlighted-comment-card' : ''}`.trim()}
      >
        <strong>{c.user || "Usuario"}:</strong>
        {fueActualizado && (
          <Badge bg="success" className="ms-2">Actualizado ✓</Badge>
        )}
        {isHighlightedComment && (
          <Badge bg="danger" className="ms-2">Nuevo comentario</Badge>
        )}

        {estaEnEdicion ? (
          <>
            <div className="mb-2 mt-2 edit-comment-quill">
              <ReactQuill
                theme="snow"
                value={comentariosEnEdicion[c.id] || ''}
                onChange={(content) =>
                  setComentariosEnEdicion((prev) => ({
                    ...prev,
                    [c.id]: content,
                  }))
                }
                modules={quillModules}
                formats={quillFormats}
              />
            </div>
            <div className="d-flex gap-2">
              <Button
                size="sm"
                variant="success"
                onClick={() => handleGuardarComentarioTarea(c.id)}
                disabled={isNoteEmpty(comentariosEnEdicion[c.id])}
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
              <Form.Group className="mt-4">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <Form.Label className="mb-0 d-flex align-items-center gap-2">
                    <i className="fas fa-comment-dots text-primary"></i>
                    <strong>Mi respuesta:</strong>
                  </Form.Label>
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
                <div style={{ position: 'relative' }}>
                  {/* ✅ ReactQuill con key única para forzar remount limpio cuando cambia la tarea */}
                  <ReactQuill
                    key={`quill-${tarea?.id || 'new'}-${show}`}
                    ref={mentionQuillRef}
                    theme="snow"
                    value={responseNote || ""}
                    onChange={(value, delta, source, editor) => {
                      setResponseNote(value);
                      
                      // ✅ Manejar menciones ANTES de actualizar otros estados
                      // Esto asegura que la detección funcione correctamente
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
                    placeholder="Escribe tu respuesta o usa el botón 'Dictar' para transcribir por voz. Escribe @ para mencionar usuarios..."
                    style={{
                      backgroundColor: '#fff',
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
                        zIndex: 9999, // Aumentado para estar por encima de modales
                        maxHeight: '250px',
                        overflowY: 'auto',
                        marginTop: '4px',
                      }}
                      onClick={(e) => e.stopPropagation()} // Prevenir cierre del modal
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
                {!reconocimientoDisponible && (
                  <Form.Text className="text-muted mt-2">
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
          <Col md={6} style={{ overflowY: "auto", height: "100%" }}>
            <div className="section-title">
              <i className="fas fa-history text-info"></i>
              Historial del Cliente
            </div>
            {loadingHistorial ? (
              <div className="d-flex align-items-center gap-2">
                <Spinner animation="border" size="sm" />
                <span className="text-muted">Cargando historial...</span>
              </div>
            ) : !tarea.log?.cliente?.id ? (
              <div className="p-3 text-center text-muted">
                <i className="fas fa-info-circle mb-2" style={{ fontSize: "2rem", opacity: 0.5 }}></i>
                <p className="mb-0">No se puede cargar el historial del cliente</p>
                <small>La tarea no tiene información del cliente asociado</small>
              </div>
            ) : historial.length === 0 ? (
              <p className="text-muted">No hay historial disponible para este cliente.</p>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px"
                }}
              >
                {historialOrdenado.map((h, idx) => (
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
                    <div 
                      className="mb-1"
                      style={{ 
                        fontSize: '14px',
                        lineHeight: '1.5',
                        wordBreak: 'break-word'
                      }}
                      dangerouslySetInnerHTML={{ __html: h.nota || 'Sin detalles' }}
                    />

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

                    {/* ✅ Comentarios: un solo desplegable por ítem del historial */}
                    {h.comentarios && h.comentarios.length > 0 && (() => {
                      const historialComentariosKey = String(
                        h.id ?? h.log_id ?? h.log?.id ?? `hist-${idx}`
                      );
                      const comentariosList = h.comentarios
                        .filter((c) => {
                          if (!c.id) {
                            console.warn("⚠️ Comentario historial sin ID, saltando:", c);
                            return false;
                          }
                          return true;
                        })
                        .slice()
                        .sort((a, b) => {
                          const tb = getComentarioHistorialOrdenMs(b);
                          const ta = getComentarioHistorialOrdenMs(a);
                          if (tb !== ta) return tb - ta;
                          const idb = Number(b.id);
                          const ida = Number(a.id);
                          if (Number.isFinite(idb) && Number.isFinite(ida) && idb !== ida) {
                            return idb - ida;
                          }
                          return String(b.id).localeCompare(String(a.id), undefined, { numeric: true });
                        });
                      if (comentariosList.length === 0) return null;

                      const algunoEnEdicion = comentariosList.some((c) =>
                        comentariosHistorialEnEdicion.hasOwnProperty(c.id)
                      );
                      const contieneComentarioResaltado = highlightedCommentId
                        ? comentariosList.some((c) => String(c.id) === highlightedCommentId)
                        : false;
                      const panelExpandido =
                        !!historialComentariosExpandidos[historialComentariosKey] ||
                        algunoEnEdicion ||
                        contieneComentarioResaltado;

                      return (
                        <div
                          className="mt-2 p-2 rounded"
                          style={{
                            background: "#f8f9fa",
                            border: "1px solid #dee2e6",
                            fontSize: "0.85rem",
                          }}
                        >
                          <button
                            type="button"
                            className="w-100 d-flex align-items-center justify-content-between p-2 bg-white rounded border-0 gap-2"
                            style={{ cursor: algunoEnEdicion ? "default" : "pointer", border: "1px solid #dee2e6" }}
                            onClick={() => {
                              if (algunoEnEdicion) return;
                              setHistorialComentariosExpandidos((prev) => ({
                                ...prev,
                                [historialComentariosKey]: !prev[historialComentariosKey],
                              }));
                            }}
                            aria-expanded={panelExpandido}
                          >
                            <div className="d-flex align-items-center gap-2 flex-wrap text-start">
                              <span className="fw-semibold">💬 Comentarios</span>
                              <Badge bg="secondary">{comentariosList.length}</Badge>
                              <small className="text-muted">
                                {panelExpandido ? "Ocultar lista" : "Ver comentarios"}
                              </small>
                            </div>
                            <i
                              className={`fas ${panelExpandido ? "fa-chevron-up" : "fa-chevron-down"} text-muted flex-shrink-0`}
                              aria-hidden
                            />
                          </button>

                          {panelExpandido && (
                            <div
                              className="mt-2 pt-2"
                              style={{ borderTop: "1px solid #dee2e6" }}
                            >
                              {comentariosList.map((c) => {
                                const estaEnEdicion = comentariosHistorialEnEdicion.hasOwnProperty(c.id);
                                const fueActualizado = comentariosHistorialActualizados[c.id];
                                const isHighlightedComment = highlightedCommentId && String(c.id) === highlightedCommentId;

                                return (
                                  <div
                                    key={c.id}
                                    data-highlight-comment-id={isHighlightedComment ? String(c.id) : undefined}
                                    className={isHighlightedComment ? "highlighted-comment-card rounded px-2" : ""}
                                    style={{
                                      borderBottom: "1px solid #e9ecef",
                                      padding: "8px 0",
                                      backgroundColor: fueActualizado ? "#d4edda" : undefined,
                                    }}
                                  >
                                    {fueActualizado && (
                                      <Badge bg="success" size="sm" className="mb-1">
                                        Actualizado ✓
                                      </Badge>
                                    )}
                                    {isHighlightedComment && (
                                      <Badge bg="danger" size="sm" className="mb-1 ms-2">
                                        Nuevo comentario
                                      </Badge>
                                    )}

                                    {estaEnEdicion ? (
                                      <>
                                        <div className="mb-2 edit-comment-quill">
                                          <ReactQuill
                                            theme="snow"
                                            value={comentariosHistorialEnEdicion[c.id] || ""}
                                            onChange={(content) =>
                                              setComentariosHistorialEnEdicion((prev) => ({
                                                ...prev,
                                                [c.id]: content,
                                              }))
                                            }
                                            modules={quillModules}
                                            formats={quillFormats}
                                          />
                                        </div>
                                        <div className="d-flex gap-2">
                                          <Button
                                            size="sm"
                                            variant="success"
                                            onClick={() => handleGuardarComentarioHistorial(c.id)}
                                            disabled={isNoteEmpty(comentariosHistorialEnEdicion[c.id])}
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
                                        <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap">
                                          <div style={{ minWidth: 0 }}>
                                            <strong>{c.user}</strong>
                                            <small className="text-muted d-block mt-1">
                                              {c.fecha
                                                ? formatDateTimeForDisplay(c.fecha)
                                                : "Fecha inválida"}
                                            </small>
                                          </div>
                                          <Button
                                            size="sm"
                                            variant="outline-secondary"
                                            className="flex-shrink-0"
                                            onClick={() => {
                                              setHistorialComentariosExpandidos((prev) => ({
                                                ...prev,
                                                [historialComentariosKey]: true,
                                              }));
                                              setComentariosHistorialEnEdicion((prev) => ({
                                                ...prev,
                                                [c.id]: c.comment,
                                              }));
                                            }}
                                          >
                                            ✏️ Editar
                                          </Button>
                                        </div>
                                        <div
                                          className="mt-2"
                                          style={{
                                            fontSize: "14px",
                                            lineHeight: "1.5",
                                            wordBreak: "break-word",
                                          }}
                                          dangerouslySetInnerHTML={{
                                            __html: highlightMentions(c.comment || "Sin contenido"),
                                          }}
                                        />
                                        {(() => {
                                          if (!adjuntosComentarios[c.id] && !loadingAdjuntos[c.id]) {
                                            setTimeout(() => cargarAdjuntosComentario(c.id, c), 100);
                                          }
                                          return <MostrarAdjuntosComentario comentarioId={c.id} />;
                                        })()}
                                      </>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })()}
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
            {/* Si viene de notificación, solo mostrar botón de Agregar Comentario */}
            {fromNotification ? (
              <Button variant="info" onClick={handleAgregarComentario} disabled={loading}>
                Agregar Comentario
              </Button>
            ) : (
              <>
                <Button variant="primary" onClick={handleActualizarFechas} disabled={loading || fechasInvalidas}>
                  Actualizar Fechas
                </Button>
                <Button variant="info" onClick={handleAgregarComentario} disabled={loading}>
                  Agregar Comentario
                </Button>
                {puedeMarcarCompletada && (
                  <Button variant="success" onClick={handleCompletar} disabled={loading || esTareaVencida}>
                    Marcar completada
                  </Button>
                )}
              </>
            )}
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

    {/* ✅ Modal de confirmación antes de completar tarea */}
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
          <div className="d-flex align-items-center gap-2 mt-2">
            <i className="fas fa-hashtag text-primary"></i>
            <span className="small">
              <strong>ID de la tarea:</strong>{" "}
              <Badge bg="primary" className="ms-1">
                {tarea?.id || tarea?.task_id || tarea?.tarea_id || "N/A"}
              </Badge>
            </span>
          </div>
        </div>
        <div className="mb-3">
          <p className="mb-2">
            <strong>Esta acción:</strong>
          </p>
          <ul className="mb-0" style={{ paddingLeft: "1.5rem" }}>
            <li>Marcará la tarea como <Badge bg="success">Completada</Badge></li>
            <li>Cambiará el estado de la tarea permanentemente</li>
            {(!isNoteEmpty(responseNote) || archivos.length > 0) && (
              <li>Agregará un comentario final antes de completar</li>
            )}
          </ul>
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
                  <i className="fas fa-file me-2"></i>
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
            {archivos.length > 0 && (
              <div className="mt-2">
                <label className="fw-semibold mb-2 d-block small">
                  <i className="fas fa-paperclip me-2 text-primary"></i>
                  Archivos adjuntos ({archivos.length}):
                </label>
                <div className="d-flex flex-wrap gap-2">
                  {archivos.map((archivo) => (
                    <Badge key={archivo.id} bg="info" className="p-2 d-flex align-items-center">
                      <i className={`fas ${archivo.tipo === "imagen" ? "fa-image" : archivo.tipo === "pdf" ? "fa-file-pdf text-danger" : "fa-file-word text-primary"} me-1`}></i>
                      <span style={{ maxWidth: "150px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {archivo.nombre}
                      </span>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {(() => {
          const fechaInicio = tarea?.created_at || tarea?.scheduled_date || tarea?.fecha_inicio;
          const tiempo = durationFromStartToEnd(fechaInicio || new Date());
          const textoFecha = fechaInicio ? new Date(fechaInicio).toLocaleString("es", { dateStyle: "short", timeStyle: "short" }) : "inicio";
          return (
            <div className="mb-3 p-3 bg-light rounded">
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
        <div className="alert alert-info mb-0">
          <small>
            <i className="fas fa-info-circle me-1"></i>
            <strong>Nota:</strong> Una vez completada, la tarea cambiará su estado y no podrá ser modificada fácilmente.
          </small>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button 
          variant="secondary" 
          onClick={() => setShowConfirmCompletarModal(false)}
          disabled={loading}
        >
          <i className="fas fa-times me-1"></i>
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

    {/* ✅ Modal de confirmación antes de agregar comentario */}
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
          <div className="d-flex align-items-center gap-2">
            <i className="fas fa-hashtag text-primary"></i>
            <span className="small">
              <strong>ID de la tarea:</strong>{" "}
              <Badge bg="primary" className="ms-1">
                {tarea?.id || tarea?.task_id || tarea?.tarea_id || "N/A"}
              </Badge>
            </span>
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
                <i className="fas fa-file me-2"></i>
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
                  <i className={`fas ${archivo.tipo === "imagen" ? "fa-image" : archivo.tipo === "pdf" ? "fa-file-pdf text-danger" : "fa-file-word text-primary"} me-1`}></i>
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

    {/* ✅ Toast de notificación */}
    <ToastContainer className="p-3" position="top-end" style={{ zIndex: 9999 }}>
      {/* Modal clave del super admin para desbloquear fecha de vencimiento */}
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
            Para modificar la fecha de vencimiento debe ingresar la contraseña del super administrador configurado en el sistema.
          </p>
          <Form.Group>
            <Form.Label>Contraseña del super administrador</Form.Label>
            <Form.Control
              type="password"
              value={adminPasswordInput}
              onChange={(e) => { setAdminPasswordInput(e.target.value); setDueDatePasswordError(""); }}
              placeholder="Ingrese la contraseña"
              onKeyDown={(e) => e.key === "Enter" && handleVerificarPasswordDueDate()}
              autoComplete="off"
              isInvalid={!!dueDatePasswordError}
            />
            {dueDatePasswordError && (
              <Form.Control.Feedback type="invalid">{dueDatePasswordError}</Form.Control.Feedback>
            )}
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => { setShowDueDatePasswordModal(false); setDueDatePasswordError(""); }} disabled={verifyingDueDatePassword}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleVerificarPasswordDueDate} disabled={verifyingDueDatePassword}>
            {verifyingDueDatePassword ? "Verificando..." : "Verificar"}
          </Button>
        </Modal.Footer>
      </Modal>

      <Toast
        show={showToast} 
        onClose={() => setShowToast(false)} 
        delay={4000} 
        autohide 
        bg={toastVariant}
      >
        <Toast.Header closeButton={true}>
          <strong className="me-auto">
            {toastVariant === "success" ? "✅ Éxito" : toastVariant === "warning" ? "⚠️ Aviso" : "❌ Error"}
          </strong>
        </Toast.Header>
        <Toast.Body className={toastVariant === "success" ? "text-white" : "text-white"}>
          {toastMessage}
        </Toast.Body>
      </Toast>
    </ToastContainer>
    </>
  );
};

export default ResponderTareaModal;