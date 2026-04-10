import React, { useEffect, useState, useCallback, useRef } from "react";
import { Modal, Button, Form, Spinner } from "react-bootstrap";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import apiRequest from "../../services/api";
import MdyDashDateInput from "../common/MdyDashDateInput";
import { useMentionableQuill } from "../../hooks/useMentionableQuill";
import { getQuillInstance } from "../../utils/quillEditorUtils";
import { extractMentionedUserIds } from "../../utils/mentions";

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

const NuevaTareaModal = ({ show, onHide, onCreated, categoria = "tarea_manual", grupoFamiliarId, clienteId }) => {
  const toInt = (v) => (v === undefined || v === null || v === '' ? null : parseInt(v, 10));

  const getHoy = () => new Date().toISOString().split("T")[0];

  // Función para limpiar HTML y verificar si está vacío
  const isNoteEmpty = (html) => {
    if (!html) return true;
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    const text = tempDiv.textContent || tempDiv.innerText || '';
    return text.trim().length === 0;
  };

  const [formData, setFormData] = useState({
    concept_id: "",
    note: "",
    cliente_id: "",
    grupo_familiar_id: "",
    assign_to_user_id: "",
    scheduled_date: getHoy(),
    due_date: getHoy(),
  });

  const [conceptos, setConceptos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [conceptosPadres, setConceptosPadres] = useState([]);
  const [conceptoPadreId, setConceptoPadreId] = useState("");
  const [clienteQuery, setClienteQuery] = useState("");
  const [clienteFicha, setClienteFicha] = useState(null);
  const [loadingCliente, setLoadingCliente] = useState(false);
  const [archivos, setArchivos] = useState([]);
  const [subiendoArchivos, setSubiendoArchivos] = useState(false);
  const [grabando, setGrabando] = useState(false);
  const [reconocimientoDisponible, setReconocimientoDisponible] = useState(false);
  const [reconocimientoVoz, setReconocimientoVoz] = useState(null);
  const grabandoRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const dropAreaRef = useRef(null);
  const quillEditorRef = useRef(null);
  const lastSelectionRef = useRef(null);
  const quillSelectionBoundToRef = useRef(null);
  const [mentionedUserIds, setMentionedUserIds] = useState([]);

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

  const handleClienteSeleccion = useCallback((cli, grupoElegido) => {
    setFormData((prev) => {
      const ctxId = toInt(grupoFamiliarId ?? prev.grupo_familiar_id);
      const pickId = toInt(grupoElegido?.grupo_familiar_id);
      const cliId = toInt(cli?.cliente_id ?? cli?.id);
      const tieneGrupoContexto = toInt(grupoFamiliarId) !== null;
      const gruposDelCliente = Array.isArray(cli?.grupos) ? cli.grupos : [];

      // Si no hay grupo elegido y no hay contexto de grupo familiar
      if (!grupoElegido && !tieneGrupoContexto) {
        // Si el cliente tiene grupos pero no se seleccionó uno específico
        if (gruposDelCliente.length > 0) {
          // Si solo tiene un grupo, seleccionarlo automáticamente
          if (gruposDelCliente.length === 1) {
            grupoElegido = gruposDelCliente[0];
          } else {
            // Si tiene múltiples grupos, el usuario debe seleccionar uno
            alert("Este cliente pertenece a múltiples grupos familiares. Por favor seleccione un grupo específico.");
            return prev;
          }
        } else {
          // El cliente no tiene grupos familiares
          alert(
            `El cliente "${cli.nombre_completo || cli.nombre || 'seleccionado'}" no se encuentra vinculado a un grupo familiar.\n\n` +
            `Debe vincularlo primero a un grupo familiar para poder continuar con la creación de la tarea.`
          );
          return prev;
        }
      }

      // Recalcular el pickId después de la lógica anterior
      const grupoFinalId = toInt(grupoElegido?.grupo_familiar_id) || ctxId;

      if (tieneGrupoContexto && ctxId && grupoFinalId && ctxId !== grupoFinalId) {
        alert("El cliente pertenece a otro grupo familiar. Por favor seleccione un miembro del grupo actual.");
        return prev;
      }

      if (cliId !== toInt(clienteId)) {
        setClienteFicha({
          id: cliId,
          nombre_completo: cli.nombre_completo || cli.nombre || "Cliente seleccionado",
          email: cli.email || null,
          telefono: cli.telefono || null,
        });
      }

      const nombreDisplay = cli.nombre_completo || cli.nombre || "Cliente seleccionado";
      const infoExtra = [];
      if (cliId) infoExtra.push(`ID: ${cliId}`);
      if (grupoFinalId) infoExtra.push(`GF #${grupoFinalId}`);
      
      setClienteQuery(nombreDisplay + (infoExtra.length > 0 ? ` (${infoExtra.join(", ")})` : ""));
      setClientes([]);

      return {
        ...prev,
        cliente_id: cliId || "",
        grupo_familiar_id: grupoFinalId || "",
      };
    });
  }, [grupoFamiliarId, clienteId]);

  // Sincronizar ref con estado
  useEffect(() => {
    grabandoRef.current = grabando;
  }, [grabando]);

  useEffect(() => {
    if (show) {
      quillEditorRef.current = null;
      lastSelectionRef.current = null;
      quillSelectionBoundToRef.current = null;
    }
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
            try { quill.focus(); } catch (e) {}
            const length = quill.getLength();
            const range = quill.getSelection(true) || lastSelectionRef.current;
            const insertPosition = range ? range.index : Math.max(length - 1, 0);
            const prevChar =
              insertPosition > 0 ? quill.getText(insertPosition - 1, 1) : "";
            const prefix = prevChar && !prevChar.endsWith(" ") ? " " : "";
            quill.insertText(
              insertPosition,
              `${prefix}${textoTranscrito} `,
              "user"
            );
            quill.setSelection(
              insertPosition + prefix.length + textoTranscrito.length + 1
            );
          } else {
            // Fallback: actualizar estado directamente agregando texto como HTML
            setFormData((prev) => {
              const currentHtml = prev.note || '';
              // Extraer texto plano para verificar si necesita espacio
              const tempDiv = document.createElement('div');
              tempDiv.innerHTML = currentHtml;
              const currentText = tempDiv.textContent || tempDiv.innerText || '';
              const prefix = currentText && !currentText.endsWith(' ') ? ' ' : '';
              return {
                ...prev,
                note: currentHtml + prefix + textoTranscrito + ' ',
              };
            });
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

  // Cargar datos iniciales y resetear formulario cuando se abre el modal
  useEffect(() => {
    if (!show) {
      // Limpiar archivos cuando se cierra el modal
      setArchivos((prevArchivos) => {
        prevArchivos.forEach((arch) => {
          if (arch.preview) URL.revokeObjectURL(arch.preview);
        });
        return [];
      });
      setIsDragging(false);
      return;
    }

    // Resetear todo el estado cuando se abre el modal
    const hoy = getHoy();
    const clienteIdValido = clienteId ? String(clienteId) : "";
    const grupoIdValido = grupoFamiliarId ? String(grupoFamiliarId) : "";

    setFormData({
      concept_id: "",
      note: "",
      cliente_id: clienteIdValido,
      grupo_familiar_id: grupoIdValido,
      assign_to_user_id: "",
      scheduled_date: hoy,
      due_date: hoy,
    });
    setErrors({});
    setConceptoPadreId("");
    setConceptos([]);
    setClientes([]);
    setClienteQuery("");

    // Cargar datos de la API
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
        
        // Normalizar estructura de usuarios
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

    // Cargar conceptos
    apiRequest(`operational_concepts?only_parents=true`, "GET")
      .then((conceptos) => {
        if (isMounted && show) {
          setConceptosPadres(Array.isArray(conceptos) ? conceptos : []);
        }
      })
      .catch((err) => {
        console.error("Error al cargar conceptos:", err);
        if (isMounted && show) {
          setConceptosPadres([]);
        }
      });

    // Cargar usuarios
    cargarUsuarios();

    // Cargar información del cliente de la ficha si hay clienteId
    let clienteMounted = true;
    
    if (clienteId) {
      setLoadingCliente(true);
      
      apiRequest(`cliente/${clienteId}`, "GET")
        .then((cliente) => {
          if (clienteMounted && show && cliente) {
            setClienteFicha({
              id: cliente.id || clienteId,
              nombre_completo: cliente.nombre_completo || cliente.nombre || "Cliente",
              email: cliente.email || null,
              telefono: cliente.telefono || null,
            });
            setClienteQuery(cliente.nombre_completo || cliente.nombre || "Cliente de la ficha");
          }
        })
        .catch((err) => {
          console.error("Error al cargar cliente:", err);
          if (clienteMounted && show) {
            setClienteFicha({
              id: clienteId,
              nombre_completo: "Cliente de la ficha",
            });
            setClienteQuery("Cliente de la ficha");
          }
        })
        .finally(() => {
          if (clienteMounted) {
            setLoadingCliente(false);
          }
        });
    } else {
      setClienteFicha(null);
      setClienteQuery("");
    }

    // Cleanup function
    return () => {
      isMounted = false;
      clienteMounted = false;
    };
  }, [show, grupoFamiliarId, clienteId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePadreChange = async (e) => {
    const selectedId = e.target.value;
    setConceptoPadreId(selectedId);
    setFormData((prev) => ({ ...prev, concept_id: "" }));

    if (selectedId) {
      try {
        const hijos = await apiRequest(`operational_concepts/${selectedId}/subconcepts`, "GET");
        setConceptos(hijos || []);
      } catch (err) {
        console.error("Error al cargar subconceptos:", err);
        setConceptos([]);
      }
    } else {
      setConceptos([]);
    }
  };

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

  const agregarArchivos = useCallback((files) => {
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
  }, []);

  const eliminarArchivo = (id) => {
    setArchivos((prev) => {
      const archivo = prev.find((arch) => arch.id === id);
      if (archivo && archivo.preview) {
        URL.revokeObjectURL(archivo.preview);
      }
      return prev.filter((arch) => arch.id !== id);
    });
  };

  const subirArchivos = async (bitacoraId) => {
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

        const response = await fetch(`${API_BASE_URL}/adjuntos/bitacora/${bitacoraId}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMessage = errorData.message || "Error al subir archivo";
          throw new Error(errorMessage);
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

  // Handlers para drag and drop
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Solo cambiar el estado si realmente salimos del área de drop
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

  // Handler para pegar desde el portapapeles (Ctrl+V / Cmd+V)
  useEffect(() => {
    if (!show) return;

    const handlePaste = (e) => {
      // Verificar si el modal está abierto y el foco está en el modal
      const items = e.clipboardData?.items;
      if (!items) return;

      const imageFiles = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            // Crear un nombre para el archivo pegado
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

    // Agregar el listener cuando el modal está abierto
    document.addEventListener('paste', handlePaste);

    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [show, agregarArchivos]);

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

  const validarCampos = () => {
    const nuevosErrores = {};
    
    if (!formData.concept_id || formData.concept_id === "") {
      nuevosErrores.concept_id = "El concepto es obligatorio";
    }
    
    if (isNoteEmpty(formData.note)) {
      nuevosErrores.note = "La nota es obligatoria";
    }
    
    if (!formData.cliente_id || formData.cliente_id === "") {
      nuevosErrores.cliente_id = "El cliente es obligatorio";
    }
    
    // Validar que el cliente tenga un grupo familiar asociado
    const grupoFamiliarIdFinal = toInt(formData.grupo_familiar_id) || toInt(grupoFamiliarId);
    if (!grupoFamiliarIdFinal) {
      nuevosErrores.grupo_familiar_id = "El cliente debe estar vinculado a un grupo familiar";
    }
    
    if (!formData.assign_to_user_id || formData.assign_to_user_id === "") {
      nuevosErrores.assign_to_user_id = "Debes asignar la tarea a un usuario";
    }
    
    if (!formData.scheduled_date || formData.scheduled_date === "") {
      nuevosErrores.scheduled_date = "La fecha programada es obligatoria";
    }
    
    if (!formData.due_date || formData.due_date === "") {
      nuevosErrores.due_date = "La fecha de vencimiento es obligatoria";
    }
    
    setErrors(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };

  const handleSubmit = async () => {
    if (!validarCampos()) {
      return;
    }
    
    setLoading(true);
    
    try {
      // ✅ Extraer menciones antes de enviar
      const mentionedIds = extractMentionedUserIds(formData.note || "", usuarios);
      
      // 📝 Log de depuración: Menciones detectadas (nueva tarea)
      if (import.meta.env.DEV) {
        console.log("🔔 [NOTIFICACIONES] Creando nueva tarea con menciones:", {
          nota_preview: formData.note?.substring(0, 100) || "",
          mentioned_user_ids: mentionedIds,
          usuarios_mencionados: usuarios.filter(u => mentionedIds.includes(u.id)).map(u => ({ id: u.id, name: u.name })),
          cliente_id: formData.cliente_id,
          assign_to_user_id: formData.assign_to_user_id,
          scheduled_date: formData.scheduled_date,
          due_date: formData.due_date,
          endpoint: "bitacora_operativa/create"
        });
      }
      
      const payload = {
        ...formData,
        action_type: "tarea",
        tipo: "tarea",
        mentioned_user_ids: mentionedIds, // Enviar IDs de usuarios mencionados
      };

      const response = await apiRequest("bitacora_operativa/create", "POST", payload);
      
      // 📝 Log de depuración: Confirmación de creación de tarea
      if (import.meta.env.DEV) {
        const taskId = response?.id || response?.log?.id || response?.data?.id || response?.bitacora?.id;
        console.log("✅ [NOTIFICACIONES] Nueva tarea creada exitosamente:", {
          tarea_id: taskId,
          mentioned_user_ids_enviados: mentionedIds,
          respuesta_backend: {
            id: response?.id,
            log_id: response?.log?.id,
            data_id: response?.data?.id
          }
        });
      }
      
      let logId = response?.id || response?.log?.id || response?.data?.id || response?.bitacora?.id;
      
      if (!logId && payload.grupo_familiar_id) {
        try {
          await new Promise(resolve => setTimeout(resolve, 500));
          
          const buscarResponse = await apiRequest(
            `bitacora_operativa?grupo_familiar_id=${payload.grupo_familiar_id}&per_page=10`,
            "GET"
          );
          
          const lista = buscarResponse?.data || buscarResponse || [];
          const registros = Array.isArray(lista) ? lista : [];
          
          const registroReciente = registros.find(reg => {
            const conceptMatch = String(reg.concept_id) === String(payload.concept_id);
            const noteMatch = reg.note === payload.note || reg.note?.trim() === payload.note?.trim();
            const clienteMatch = String(reg.cliente_id) === String(payload.cliente_id);
            const tipoMatch = (reg.tipo === payload.tipo) || (reg.action_type === payload.action_type);
            
            return conceptMatch && noteMatch && clienteMatch && tipoMatch;
          });
          
          if (registroReciente) {
            logId = registroReciente.id || registroReciente.log?.id;
          }
        } catch (err) {
          console.error("Error al buscar el registro:", err);
        }
      }
      
      if (logId && archivos.length > 0) {
        try {
          await subirArchivos(logId);
        } catch (err) {
          console.error("Error al subir archivos:", err);
          alert(`Se creó la tarea pero hubo un error al subir algunos archivos:\n${err.message || "Error desconocido"}`);
        }
      } else if (archivos.length > 0 && !logId) {
        alert("Se creó la tarea pero no se pudieron subir los archivos porque no se pudo obtener el ID del registro.");
      }

      const conceptoSeleccionado = conceptos.find((c) => c.id === parseInt(formData.concept_id));

      let nombreCliente = "Cliente";
      if (clienteFicha && String(formData.cliente_id) === String(clienteFicha.id)) {
        nombreCliente = clienteFicha.nombre_completo;
      } else {
        const clienteEncontrado = clientes.find((c) => 
          String(c.cliente_id ?? c.id) === String(formData.cliente_id)
        );
        if (clienteEncontrado) {
          nombreCliente = clienteEncontrado.nombre_completo;
        }
      }

      const nuevaTarea = {
        id: response?.task?.id || Date.now(),
        tipo: "tarea",
        scheduled_date: formData.scheduled_date,
        due_date: formData.due_date,
        status: "pending",
        log: {
          concept: { name: conceptoSeleccionado?.name || "Concepto" },
          note: formData.note,
          cliente: {
            nombre_completo: nombreCliente,
          },
        },
      };

      if (onCreated) {
        onCreated(nuevaTarea);
      }
      
      onHide();
    } catch (error) {
      console.error("Error al guardar tarea:", error);
      alert(`Error al guardar la tarea: ${error.message || "Error desconocido"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton className="border-bottom">
        <Modal.Title className="fw-normal">Nueva Tarea</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {(toInt(formData.grupo_familiar_id) || toInt(grupoFamiliarId)) && (
          <div className="mb-3">
            <span className="badge bg-secondary">
              Grupo #{toInt(formData.grupo_familiar_id) || toInt(grupoFamiliarId)}
            </span>
          </div>
        )}

        <Form.Group className="mb-3">
          <Form.Label>Concepto Principal</Form.Label>
          <Form.Select 
            value={conceptoPadreId} 
            onChange={handlePadreChange}
          >
            <option value="">Seleccionar</option>
            {conceptosPadres.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Form.Select>
        </Form.Group>

        {conceptos.length > 0 && (
          <Form.Group className="mb-3">
            <Form.Label>Subconcepto</Form.Label>
            <Form.Select
              name="concept_id"
              value={formData.concept_id}
              onChange={handleChange}
              isInvalid={!!errors.concept_id}
            >
              <option value="">Seleccionar</option>
              {conceptos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Form.Select>
            <Form.Control.Feedback type="invalid">
              {errors.concept_id}
            </Form.Control.Feedback>
          </Form.Group>
        )}

        <Form.Group className="mb-3">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <Form.Label className="mb-0">Descripción de la Tarea</Form.Label>
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
                <strong>Escuchando...</strong> Habla ahora. El texto se agregará automáticamente a la descripción.
              </small>
            </div>
          )}
          <div className={errors.note ? "border border-danger rounded" : ""}>
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
              <ReactQuill
                ref={mentionQuillRef}
                theme="snow"
                value={formData.note || ""}
                onChange={(value, delta, source, editor) => {
                  setFormData((prev) => ({ ...prev, note: value }));
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
                  // Limpiar error cuando el usuario empiece a escribir
                  if (errors.note && !isNoteEmpty(value)) {
                    setErrors((prev) => ({ ...prev, note: null }));
                  }
                  // ✅ Manejar menciones
                  handleQuillChange(value, delta, source, editor);
                }}
                onKeyDown={handleQuillKeyDown}
                modules={quillModules}
                formats={quillFormats}
                placeholder="Describa los detalles y objetivos de esta tarea. Use la barra de herramientas para formatear el texto, el botón 'Dictar' para transcribir por voz, o escriba @ para mencionar usuarios..."
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
          </div>
          {errors.note && (
            <div className="text-danger mt-1" style={{ fontSize: '0.875rem' }}>
              {errors.note}
            </div>
          )}
          {!reconocimientoDisponible && (
            <Form.Text className="text-muted mt-2 d-block">
              <small>
                <i className="fas fa-info-circle me-1"></i>
                El dictado por voz no está disponible en tu navegador. Usa Chrome, Edge o Safari para esta función.
              </small>
            </Form.Text>
          )}
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Asignar a</Form.Label>
          <Form.Select
            name="assign_to_user_id"
            value={formData.assign_to_user_id}
            onChange={handleChange}
            isInvalid={!!errors.assign_to_user_id}
          >
            <option value="">
              {usuarios.length === 0 ? "Cargando usuarios..." : "Seleccionar usuario"}
            </option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name || u.nombre || u.email || `Usuario ${u.id}`}
              </option>
            ))}
          </Form.Select>
          {usuarios.length === 0 && (
            <Form.Text className="text-muted d-flex align-items-center">
              <Spinner size="sm" animation="border" className="me-2" />
              Cargando lista de usuarios...
            </Form.Text>
          )}
          {usuarios.length > 0 && (
            <Form.Text className="text-muted">
              {usuarios.length} {usuarios.length === 1 ? "usuario disponible" : "usuarios disponibles"}
            </Form.Text>
          )}
          <Form.Control.Feedback type="invalid">
            {errors.assign_to_user_id}
          </Form.Control.Feedback>
        </Form.Group>

        <div className="row mb-3">
          <Form.Group className="col-md-6">
            <Form.Label>Fecha Programada</Form.Label>
            <MdyDashDateInput
              valueIso={formData.scheduled_date}
              onChangeIso={(iso) => handleChange({ target: { name: "scheduled_date", value: iso } })}
              disabled={false}
              required={false}
            />
            <Form.Control.Feedback type="invalid">
              {errors.scheduled_date}
            </Form.Control.Feedback>
          </Form.Group>

          <Form.Group className="col-md-6">
            <Form.Label>Fecha de Vencimiento</Form.Label>
            <MdyDashDateInput
              valueIso={formData.due_date}
              onChangeIso={(iso) => handleChange({ target: { name: "due_date", value: iso } })}
              disabled={false}
              required={false}
              minIso={formData.scheduled_date}
            />
            <Form.Control.Feedback type="invalid">
              {errors.due_date}
            </Form.Control.Feedback>
          </Form.Group>
        </div>

        <Form.Group className="mb-3">
          <Form.Label>Archivos adjuntos (opcional)</Form.Label>
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
            onClick={() => document.getElementById("file-input-tarea").click()}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              id="file-input-tarea"
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx"
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
                Formatos: JPG, PNG, GIF, WEBP, PDF, DOC, DOCX (máx. 10MB cada uno)
                {!isDragging && <span className="d-block mt-1">También puede usar Ctrl+V (Cmd+V en Mac) para pegar imágenes</span>}
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

        <Form.Group className="mb-3">
          <Form.Label>Cliente</Form.Label>
          
          {formData.cliente_id && (
            <div className="border rounded p-2 mb-2" style={{ backgroundColor: "#f8f9fa" }}>
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <strong>{clienteQuery || clienteFicha?.nombre_completo || "Cliente seleccionado"}</strong>
                  {clienteFicha && String(formData.cliente_id) === String(clienteFicha.id) && (
                    <small className="text-muted d-block">Cliente de la ficha actual</small>
                  )}
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => {
                    setFormData(prev => ({ ...prev, cliente_id: "", grupo_familiar_id: "" }));
                    if (clienteId) {
                      setClienteQuery(clienteFicha?.nombre_completo || "");
                      setFormData(prev => ({ ...prev, cliente_id: String(clienteId) }));
                    } else {
                      setClienteQuery("");
                    }
                    setClientes([]);
                  }}
                >
                  Cambiar
                </button>
              </div>
            </div>
          )}

          <div className="position-relative">
            {loadingCliente && (
              <div className="position-absolute top-50 start-50 translate-middle" style={{ zIndex: 10 }}>
                <Spinner size="sm" animation="border" variant="secondary" />
              </div>
            )}
            <Form.Control
              type="text"
              placeholder={
                formData.cliente_id 
                  ? "Buscar otro cliente..." 
                  : clienteId 
                    ? "Buscar otro cliente (actualmente: cliente de la ficha)..." 
                    : "Buscar cliente por nombre..."
              }
              value={clienteQuery}
              disabled={loadingCliente}
              onChange={async (e) => {
                const value = e.target.value;
                setClienteQuery(value);

                if (!value.trim() && clienteId && !formData.cliente_id) {
                  setClienteQuery(clienteFicha?.nombre_completo || "");
                  setClientes([]);
                  return;
                }

                if (value.length >= 3) {
                  try {
                    const result = await apiRequest(
                      `cliente/buscar-con-grupos?q=${encodeURIComponent(value)}`,
                      "GET"
                    );

                    const list = Array.isArray(result?.data)
                      ? result.data
                      : Array.isArray(result)
                      ? result
                      : [];

                    const normalized = list.map((c) => ({
                      cliente_id: c.cliente_id ?? c.id ?? null,
                      id: c.id ?? c.cliente_id ?? null,
                      nombre_completo: c.nombre_completo ?? c.nombre ?? "",
                      email: c.email ?? null,
                      telefono: c.telefono ?? null,
                      grupos: Array.isArray(c.grupos) ? c.grupos : [],
                    }));

                    setClientes(normalized);
                  } catch (err) {
                    console.error("Error al buscar clientes:", err);
                    setClientes([]);
                  }
                } else {
                  setClientes([]);
                }
              }}
            />
          </div>

          {clientes.length > 0 && (
            <div 
              className="border rounded mt-2"
              style={{
                maxHeight: "250px",
                overflowY: "auto",
                backgroundColor: "#fff"
              }}
            >
              {clientes.map((cli, idx) => {
                const cliId = cli.cliente_id ?? cli.id;
                const nombreCompleto = cli.nombre_completo || "Sin nombre";
                
                return (
                  <div
                    key={`${cliId}-${idx}`}
                    className="border-bottom p-3"
                    style={{ cursor: "pointer" }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#f8f9fa";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "#fff";
                    }}
                  >
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <div className="flex-grow-1">
                        <h6 className="mb-1">{nombreCompleto}</h6>
                        <div className="d-flex gap-3 flex-wrap">
                          {cliId && (
                            <small className="text-muted">ID: {cliId}</small>
                          )}
                          {cli.email && (
                            <small className="text-muted">{cli.email}</small>
                          )}
                          {cli.telefono && (
                            <small className="text-muted">{cli.telefono}</small>
                          )}
                        </div>
                      </div>
                    </div>

                    {(cli.grupos ?? []).length > 0 ? (
                      <div className="mt-2">
                        <small className="text-muted d-block mb-2">Grupos familiares:</small>
                        <div className="d-flex flex-wrap gap-2">
                          {(cli.grupos ?? []).map((g, i) => (
                            <button
                              key={`${cliId}-${g.grupo_familiar_id}-${i}`}
                              type="button"
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() => handleClienteSeleccion(cli, g)}
                            >
                              Grupo #{g.grupo_familiar_id}
                              {g.parentesco && (
                                <span className="badge bg-secondary ms-2">{g.parentesco}</span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2">
                        <div className="alert alert-warning mb-2 py-2" role="alert">
                          <small className="d-flex align-items-center">
                            <i className="fas fa-exclamation-triangle me-2"></i>
                            <span>Este cliente no está vinculado a un grupo familiar. Debe vincularlo primero para continuar.</span>
                          </small>
                        </div>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => handleClienteSeleccion(cli, null)}
                          disabled
                          title="No se puede seleccionar un cliente sin grupo familiar"
                        >
                          <i className="fas fa-lock me-1"></i>
                          Seleccionar cliente
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {clienteQuery.length >= 3 && clientes.length === 0 && (
            <small className="text-muted">Sin resultados para "{clienteQuery}".</small>
          )}

          <Form.Control.Feedback type="invalid">
            {errors.cliente_id}
          </Form.Control.Feedback>
        </Form.Group>
      </Modal.Body>

      <Modal.Footer className="border-top">
        <Button type="button" variant="outline-secondary" onClick={onHide} disabled={loading}>
          Cancelar
        </Button>
        <Button 
          type="button"
          variant="primary" 
          onClick={handleSubmit} 
          disabled={loading}
        >
          {loading ? (
            <>
              <Spinner size="sm" animation="border" className="me-2" />
              Guardando...
            </>
          ) : (
            "Crear Tarea"
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default NuevaTareaModal;
