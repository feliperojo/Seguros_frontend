import React, { useEffect, useRef, useState } from "react";
import { Modal, Button, Form, Spinner } from "react-bootstrap";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import apiRequest from "../../services/api";
import MdyDashDateInput from "../common/MdyDashDateInput";
import { createTaskFromRun } from "../../services/auditoriasTasksService";
import { useMentionableQuill } from "../../hooks/useMentionableQuill";
import useToast from "../../hooks/useToast";
import { parseApiDateToLocalDate } from "../../utils/formatters";
import { getQuillInstance } from "../../utils/quillEditorUtils";

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

/**
 * Función para limpiar HTML y verificar si está vacío
 */
const isNoteEmpty = (html) => {
  if (!html) return true;
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  const text = tempDiv.textContent || tempDiv.innerText || '';
  return text.trim().length === 0;
};

const NuevaTareaAuditoriaModal = ({ 
  show, 
  onHide, 
  onCreated, 
  itemId, // DEPRECATED - mantener por compatibilidad
  itemInfo = null, // Información del item para mostrar contexto (debe incluir runId, cobertura_id o cliente_id)
  runId = null // ID del run de auditoría (nuevo método)
}) => {
  const toast = useToast();
  const toastRef = useRef(toast);
  const dropAreaRef = useRef(null);
  const [grabando, setGrabando] = useState(false);
  const [reconocimientoDisponible, setReconocimientoDisponible] = useState(false);
  const reconocimientoVozRef = useRef(null);
  const grabandoRef = useRef(false);
  const quillEditorRef = useRef(null);
  const lastSelectionRef = useRef(null);
  const quillSelectionBoundToRef = useRef(null);
  
  const [formData, setFormData] = useState({
    assigned_user_id: "",
    scheduled_date: "",
    due_date: "",
    response_note: "",
  });
  
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [mentionedUserIds, setMentionedUserIds] = useState([]);
  
  // Estados para archivos adjuntos
  const [archivos, setArchivos] = useState([]);
  const [subiendoArchivos, setSubiendoArchivos] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

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
    toastRef.current = toast;
  }, [toast]);

  // Resetear referencias del editor al abrir/cerrar
  useEffect(() => {
    if (show) {
      quillEditorRef.current = null;
      lastSelectionRef.current = null;
      quillSelectionBoundToRef.current = null;
    }
  }, [show]);

  // Verificar disponibilidad del reconocimiento de voz (dictado)
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setReconocimientoDisponible(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = "es-ES";

      recognition.onresult = (event) => {
        let textoTranscrito = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            textoTranscrito += event.results[i][0].transcript;
          }
        }

        if (!textoTranscrito) return;

        const quill =
          getQuillInstance(mentionQuillRef.current) ||
          getQuillInstance(quillEditorRef.current);

        if (quill) {
          try { quill.focus(); } catch (e) {}
          const length = quill.getLength();
          const range = quill.getSelection(true) || lastSelectionRef.current;
          const insertPosition = range ? range.index : Math.max(length - 1, 0);
          const prevChar = insertPosition > 0 ? quill.getText(insertPosition - 1, 1) : "";
          const prefix = prevChar && !prevChar.endsWith(" ") ? " " : "";
          quill.insertText(insertPosition, `${prefix}${textoTranscrito} `, "user");
          quill.setSelection(insertPosition + prefix.length + textoTranscrito.length + 1);
        } else {
          // Fallback: concatenar en HTML
          setFormData((prev) => {
            const currentHtml = prev.response_note || "";
            const tempDiv = document.createElement("div");
            tempDiv.innerHTML = currentHtml;
            const currentText = tempDiv.textContent || tempDiv.innerText || "";
            const prefix = currentText && !currentText.endsWith(" ") ? " " : "";
            return { ...prev, response_note: currentHtml + prefix + textoTranscrito + " " };
          });
        }
      };

      recognition.onerror = (event) => {
        console.error("Error en reconocimiento de voz:", event.error);
        if (event.error === "no-speech") return;
        if (event.error === "audio-capture") {
          toastRef.current?.showWarning?.("No se pudo acceder al micrófono. Verifica los permisos.");
          grabandoRef.current = false;
          setGrabando(false);
        } else if (event.error === "not-allowed") {
          toastRef.current?.showWarning?.("Permiso de micrófono denegado. Permite el acceso al micrófono.");
          grabandoRef.current = false;
          setGrabando(false);
        } else if (event.error !== "aborted") {
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

      reconocimientoVozRef.current = recognition;

      return () => {
        try { recognition.stop(); } catch (err) {}
        setGrabando(false);
      };
    }

    setReconocimientoDisponible(false);
  }, []);

  // Detener dictado cuando se cierra el modal
  useEffect(() => {
    const recognition = reconocimientoVozRef.current;
    if (!show && recognition && grabando) {
      try {
        recognition.stop();
        setGrabando(false);
      } catch (err) {}
    }
  }, [show, grabando]);

  const iniciarDictado = () => {
    const recognition = reconocimientoVozRef.current;
    if (!recognition) {
      toastRef.current?.showWarning?.("El reconocimiento de voz no está disponible en tu navegador.");
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
      grabandoRef.current = true;
      recognition.start();
      setGrabando(true);
    } catch (err) {
      console.error("Error al iniciar reconocimiento:", err);
      toastRef.current?.showWarning?.("Error al iniciar el reconocimiento de voz. Intenta nuevamente.");
      grabandoRef.current = false;
      setGrabando(false);
    }
  };

  const detenerDictado = () => {
    grabandoRef.current = false;
    const recognition = reconocimientoVozRef.current;
    if (recognition) {
      try {
        recognition.stop();
      } catch (err) {
        console.error("Error al detener reconocimiento:", err);
      }
    }
    setGrabando(false);
  };

  const toggleDictado = () => {
    if (grabando) detenerDictado();
    else iniciarDictado();
  };

  // Cargar usuarios al abrir el modal (igual que en NuevaTareaModal)
  useEffect(() => {
    if (!show) return;
    
    let isMounted = true;
    
    // Cargar usuarios de forma separada para mejor manejo de errores
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
          if (isMounted && show) {
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
        
        // Normalizar estructura de usuarios (igual que en NuevaTareaModal)
        const usuariosNormalizados = usuariosData.map(u => ({
          id: u.id,
          name: u.name || u.nombre || u.username || '',
          nombre: u.nombre || u.name || u.username || '',
          email: u.email || '',
        })).filter(u => u.id && u.name); // Solo usuarios válidos
        
        if (isMounted && show) {
          setUsuarios(usuariosNormalizados);
          console.log(`✅ ${usuariosNormalizados.length} usuarios cargados para menciones y asignación`);
        }
      } catch (err) {
        console.error("❌ Error al cargar usuarios:", err);
        if (isMounted && show) {
          setUsuarios([]);
        }
      }
    };
    
    // Cargar usuarios
    cargarUsuarios();
    
    // Cleanup function
    return () => {
      isMounted = false;
    };
  }, [show]);

  // Resetear formulario cuando se abre el modal
  useEffect(() => {
    if (!show) {
      // Limpiar archivos cuando se cierra el modal
      archivos.forEach((arch) => {
        if (arch.preview) URL.revokeObjectURL(arch.preview);
      });
      setArchivos([]);
      setIsDragging(false);
      return;
    }
    
    const hoy = new Date().toISOString().split("T")[0];
    const enUnaSemana = new Date();
    enUnaSemana.setDate(enUnaSemana.getDate() + 7);
    const fechaLimite = enUnaSemana.toISOString().split("T")[0];
    
    setFormData({
      assigned_user_id: "",
      scheduled_date: hoy,
      due_date: fechaLimite,
      response_note: "",
    });
    setErrors({});
    setMentionedUserIds([]);
    setArchivos([]);
    setIsDragging(false);
  }, [show]);
  
  // Funciones para manejo de archivos
  const validarArchivo = (file) => {
    const tiposPermitidos = [
      "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp",
      "application/pdf"
    ];
    const extensionesPermitidas = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf"];
    const maxSize = 5 * 1024 * 1024; // 5MB según la documentación

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
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

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
  }, [show]);

  // Validar formulario
  const validate = () => {
    const newErrors = {};
    
    if (!formData.assigned_user_id) {
      newErrors.assigned_user_id = "Debes seleccionar un usuario";
    }
    
    if (!formData.scheduled_date) {
      newErrors.scheduled_date = "La fecha programada es requerida";
    }
    
    if (!formData.due_date) {
      newErrors.due_date = "La fecha límite es requerida";
    }
    
    if (formData.scheduled_date && formData.due_date) {
      const scheduled = parseApiDateToLocalDate(formData.scheduled_date);
      const due = parseApiDateToLocalDate(formData.due_date);
      if (scheduled && due && due.getTime() < scheduled.getTime()) {
        newErrors.due_date = "La fecha límite no puede ser anterior a la fecha programada";
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Manejar envío del formulario
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validate()) {
      toast.showWarning("Por favor corrige los errores en el formulario");
      return;
    }
    
    // Obtener runId (prioridad: prop runId > itemInfo.runId > itemInfo.run_id)
    const currentRunId = runId || 
                         itemInfo?.runId || 
                         itemInfo?.run_id;
    
    // Obtener cobertura_id o cliente_id
    const coberturaId = itemInfo?.cobertura_id || itemInfo?.cobertura?.id;
    const clienteId = itemInfo?.cliente_id || itemInfo?.cliente?.id;
    
    // Obtener grupo_familiar_id desde itemInfo (puede venir de diferentes lugares)
    const grupoFamiliarId = itemInfo?.grupo_familiar_id || 
                           itemInfo?.grupo_familiar?.id ||
                           itemInfo?.gf_id ||
                           itemInfo?.cobertura?.grupo_familiar_id ||
                           itemInfo?.cobertura?.grupo_familiar?.id;
    
    if (!currentRunId) {
      toast.showError("No se pudo identificar el run de auditoría. Por favor, intente nuevamente.");
      console.error("❌ runId no disponible al crear tarea:", { 
        runId, 
        itemInfo,
        itemInfoKeys: itemInfo ? Object.keys(itemInfo) : null
      });
      return;
    }
    
    if (!coberturaId && !clienteId) {
      toast.showError("No se pudo identificar la cobertura o cliente. Por favor, intente nuevamente.");
      console.error("❌ cobertura_id/cliente_id no disponible:", { 
        itemInfo,
        itemInfoKeys: itemInfo ? Object.keys(itemInfo) : null
      });
      return;
    }

    // Pausa opcional en DevTools: localStorage.setItem('DEBUG_AUDIT_TASK','1') y recargar
    if (import.meta.env.DEV && typeof window !== "undefined" && window.localStorage?.getItem("DEBUG_AUDIT_TASK") === "1") {
      // eslint-disable-next-line no-debugger
      debugger;
    }
    
    setLoading(true);
    
    try {
      let response;
      if (archivos.length > 0) {
        const fd = new FormData();
        fd.append("assigned_user_id", String(parseInt(formData.assigned_user_id, 10)));
        fd.append("scheduled_date", formData.scheduled_date);
        fd.append("due_date", formData.due_date);
        if (coberturaId) fd.append("cobertura_id", String(coberturaId));
        else if (clienteId) fd.append("cliente_id", String(clienteId));
        if (grupoFamiliarId) fd.append("grupo_familiar_id", String(parseInt(grupoFamiliarId, 10)));
        if (!isNoteEmpty(formData.response_note)) {
          fd.append("response_note", formData.response_note);
        }
        if (mentionedUserIds.length > 0) {
          fd.append("mentioned_user_ids", JSON.stringify(mentionedUserIds));
        }
        archivos.forEach((archivo) => {
          fd.append("archivos[]", archivo.file);
        });
        setSubiendoArchivos(true);
        response = await createTaskFromRun(currentRunId, fd);
        setSubiendoArchivos(false);
      } else {
        const payload = {
          assigned_user_id: parseInt(formData.assigned_user_id, 10),
          scheduled_date: formData.scheduled_date,
          due_date: formData.due_date,
        };
        if (coberturaId) payload.cobertura_id = coberturaId;
        else if (clienteId) payload.cliente_id = clienteId;
        if (grupoFamiliarId) payload.grupo_familiar_id = parseInt(grupoFamiliarId, 10);
        if (!isNoteEmpty(formData.response_note)) {
          payload.response_note = formData.response_note;
        }
        if (mentionedUserIds.length > 0) {
          payload.mentioned_user_ids = mentionedUserIds;
        }
        response = await createTaskFromRun(currentRunId, payload);
      }

      const taskId = response?.id || response?.data?.id || response?.task?.id;

      if (import.meta.env.DEV) {
        console.log("[Auditoría] Tarea creada", { taskId, raw: response, conArchivos: archivos.length > 0 });
      }
      
      toast.showSuccess("Tarea creada exitosamente");
      
      if (onCreated) {
        onCreated();
      }
      
      onHide();
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || "Error al crear la tarea";
      toast.showError(errorMessage);
      console.error("Error al crear tarea:", err);
    } finally {
      setLoading(false);
    }
  };

  // Obtener posición del dropdown de menciones (mejorado como en ResponderTareaModal)
  const getMentionPosition = () => {
    if (!showMentionList || !mentionQuillRef.current) {
      return { top: 0, left: 0 };
    }
    
    try {
      const quill = mentionQuillRef.current.getEditor 
        ? mentionQuillRef.current.getEditor() 
        : mentionQuillRef.current;
      
      if (!quill) return { top: 0, left: 0 };
      
      try { quill.focus(); } catch (e) {}
      const range = quill.getSelection(true);
      if (!range) return { top: 0, left: 0 };
      
      const bounds = quill.getBounds(range.index);
      const container = quill.container.getBoundingClientRect();
      
      // Calcular posición relativa al contenedor del editor
      const top = container.top + bounds.top + bounds.height + window.scrollY + 5;
      const left = container.left + bounds.left + window.scrollX;
      
      return { top, left };
    } catch {
      return { top: 0, left: 0 };
    }
  };

  return (
    <>
      <Modal show={show} onHide={onHide} size="lg" centered backdrop="static">
        <Modal.Header closeButton className="border-bottom">
          <Modal.Title className="fw-normal">Crear Tarea de Auditoría</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            {itemInfo && (
              <div className="alert alert-info mb-3">
                <strong>Item de Auditoría:</strong> {itemInfo.cliente?.nombre_completo || itemInfo.cliente || "Item"} 
                {itemInfo.codigo_poliza && ` - ${itemInfo.codigo_poliza}`}
              </div>
            )}
            
            <Form.Group className="mb-3">
              <Form.Label>
                Usuario Asignado <span className="text-danger">*</span>
              </Form.Label>
              <Form.Select
                value={formData.assigned_user_id}
                onChange={(e) => setFormData(prev => ({ ...prev, assigned_user_id: e.target.value }))}
                isInvalid={!!errors.assigned_user_id}
              >
                <option value="">
                  {usuarios.length === 0 ? "Cargando usuarios..." : "Selecciona un usuario"}
                </option>
                {usuarios.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name || user.nombre || `Usuario ${user.id}`}
                  </option>
                ))}
              </Form.Select>
              <Form.Control.Feedback type="invalid">
                {errors.assigned_user_id}
              </Form.Control.Feedback>
            </Form.Group>
            
            <div className="row">
              <Form.Group className="mb-3 col-md-6">
                <Form.Label>
                  Fecha Programada <span className="text-danger">*</span>
                </Form.Label>
                <MdyDashDateInput
                  valueIso={formData.scheduled_date}
                  onChangeIso={(iso) => setFormData((prev) => ({ ...prev, scheduled_date: iso }))}
                />
                <Form.Control.Feedback type="invalid">
                  {errors.scheduled_date}
                </Form.Control.Feedback>
              </Form.Group>
              
              <Form.Group className="mb-3 col-md-6">
                <Form.Label>
                  Fecha Límite <span className="text-danger">*</span>
                </Form.Label>
                <MdyDashDateInput
                  valueIso={formData.due_date}
                  onChangeIso={(iso) => setFormData((prev) => ({ ...prev, due_date: iso }))}
                  minIso={formData.scheduled_date}
                />
                <Form.Control.Feedback type="invalid">
                  {errors.due_date}
                </Form.Control.Feedback>
              </Form.Group>
            </div>
            
            <Form.Group className="mb-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <Form.Label className="mb-0">Nota de Respuesta (Opcional)</Form.Label>
                {reconocimientoDisponible && (
                  <>
                    <style>{`
                      @keyframes microphone-pulse {
                        0%, 100% { transform: scale(1); opacity: 1; }
                        50% { transform: scale(1.15); opacity: 0.85; }
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
                      .recording-waves span:nth-child(1) { animation-delay: 0s; }
                      .recording-waves span:nth-child(2) { animation-delay: 0.2s; }
                      .recording-waves span:nth-child(3) { animation-delay: 0.4s; }
                      @keyframes wave {
                        0%, 100% { transform: scaleY(0.5); opacity: 0.7; }
                        50% { transform: scaleY(1); opacity: 1; }
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
                            <i className="fas fa-microphone microphone-recording"></i>
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
                    <strong>Escuchando...</strong> Habla ahora. El texto se agregará automáticamente a la nota.
                  </small>
                </div>
              )}
              <div style={{ position: "relative" }}>
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
                  value={formData.response_note}
                  onChange={(content, delta, source, editor) => {
                    setFormData(prev => ({ ...prev, response_note: content }));
                    const quill =
                      getQuillInstance(editor) ??
                      getQuillInstance(mentionQuillRef.current);
                    if (quill) {
                      quillEditorRef.current = quill;
                      if (quillSelectionBoundToRef.current !== quill) {
                        quillSelectionBoundToRef.current = quill;
                        try {
                          quill.on("selection-change", (range) => {
                            if (range) lastSelectionRef.current = range;
                          });
                        } catch (e) {}
                      }
                    }
                    handleQuillChange(content, delta, source, editor);
                  }}
                  onKeyDown={handleQuillKeyDown}
                  modules={quillModules}
                  formats={quillFormats}
                  placeholder="Escribe una nota inicial para la tarea. Use la barra de herramientas para formatear el texto, o escriba @ para mencionar usuarios..."
                  style={{ backgroundColor: "#fff" }}
                />
                {/* Dropdown de menciones - mejorado como en ResponderTareaModal */}
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
                      minWidth: '250px',
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
              <Form.Text className="text-muted">
                Puedes mencionar usuarios escribiendo @ seguido del nombre
              </Form.Text>
              {!reconocimientoDisponible && (
                <Form.Text className="text-muted mt-2 d-block">
                  <small>
                    <i className="fas fa-info-circle me-1"></i>
                    El dictado por voz no está disponible en tu navegador. Usa Chrome, Edge o Safari para esta función.
                  </small>
                </Form.Text>
              )}
            </Form.Group>
            
            {/* Sección de archivos adjuntos */}
            <Form.Group className="mb-3">
              <Form.Label>Archivos Adjuntos (Opcional)</Form.Label>
              <div
                ref={dropAreaRef}
                className="border rounded p-3 text-center"
                style={{
                  borderStyle: "dashed",
                  cursor: "pointer",
                  backgroundColor: isDragging ? "#e3f2fd" : "#f8f9fa",
                  borderColor: isDragging ? "#2196f3" : undefined,
                  borderWidth: isDragging ? "2px" : undefined,
                  transition: "all 0.2s ease"
                }}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => document.getElementById("file-input-tarea-auditoria").click()}
              >
                <input
                  id="file-input-tarea-auditoria"
                  type="file"
                  multiple
                  accept="image/*,.pdf"
                  onChange={handleFileInput}
                  style={{ display: "none" }}
                />
                <div>
                  <p className="mb-1">
                    {isDragging ? (
                      <strong style={{ color: "#2196f3" }}>Suelte los archivos aquí</strong>
                    ) : (
                      "Haga clic para seleccionar archivos o arrastre y suelte aquí"
                    )}
                  </p>
                  <small className="text-muted">
                    Formatos: JPG, PNG, GIF, WEBP, PDF (máx. 5MB cada uno)
                    {!isDragging && (
                      <span className="d-block mt-1">
                        También puede usar Ctrl+V (Cmd+V en Mac) para pegar imágenes
                      </span>
                    )}
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
          </Modal.Body>
          <Modal.Footer className="border-top">
            <Button variant="outline-secondary" onClick={onHide} disabled={loading}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" />
                  Guardando...
                </>
              ) : (
                "Crear Tarea"
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </>
  );
};

export default NuevaTareaAuditoriaModal;

