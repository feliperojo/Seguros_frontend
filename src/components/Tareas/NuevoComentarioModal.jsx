import React, { useEffect, useState, useCallback, useRef } from "react";
import { Modal, Button, Form, Spinner } from "react-bootstrap";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import apiRequest from "../../services/api";

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

const NuevoComentarioModal = ({ show, onHide, onCreated, grupoFamiliarId, clienteId }) => {
  const toInt = (v) => (v === undefined || v === null || v === '' ? null : parseInt(v, 10));

  const [formData, setFormData] = useState({
    concept_id: "",
    note: "",
    cliente_id: "",
    grupo_familiar_id: "",
  });

  const tieneGrupoContexto = toInt(grupoFamiliarId) !== null;

  // Conceptos fijos para comentarios
  const CONCEPTO_PADRE_ID = 42;
  const CONCEPTO_HIJO_ID = 43;

  const [clientes, setClientes] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
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

  // Función para limpiar HTML y verificar si está vacío
  const isNoteEmpty = (html) => {
    if (!html) return true;
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    const text = tempDiv.textContent || tempDiv.innerText || '';
    return text.trim().length === 0;
  };

  const handleClienteSeleccion = useCallback((cli, grupoElegido) => {
    const ctxId = toInt(grupoFamiliarId ?? formData.grupo_familiar_id);
    const pickId = toInt(grupoElegido?.grupo_familiar_id);
    const cliId = toInt(cli?.cliente_id ?? cli?.id);

    if (tieneGrupoContexto && ctxId && pickId && ctxId !== pickId) {
      alert("El cliente pertenece a otro grupo familiar. Por favor seleccione un miembro del grupo actual.");
      return;
    }

    setFormData((prev) => ({
      ...prev,
      cliente_id: cliId || "",
      grupo_familiar_id: pickId || ctxId || "",
    }));

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
    if (grupoElegido?.grupo_familiar_id) infoExtra.push(`GF #${grupoElegido.grupo_familiar_id}`);
    
    setClienteQuery(nombreDisplay + (infoExtra.length > 0 ? ` (${infoExtra.join(", ")})` : ""));
    setClientes([]);
  }, [grupoFamiliarId, clienteId, tieneGrupoContexto]);

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
          // Insertar texto transcrito en el editor Quill
          const quill = quillEditorRef.current;
          if (quill) {
            const range = quill.getSelection(true);
            const length = quill.getLength();
            const insertPosition = range ? range.index : length - 1;
            const prefix = insertPosition > 1 && !quill.getText(insertPosition - 1, 1).endsWith(' ') ? ' ' : '';
            quill.insertText(insertPosition, prefix + textoTranscrito + ' ', 'user');
            quill.setSelection(insertPosition + prefix.length + textoTranscrito.length + 1);
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

  // Cargar datos iniciales
  useEffect(() => {
    if (!show) return;

    // Solo cargar grupos familiares, los conceptos son fijos
    apiRequest("grupo_familiar", "GET")
      .then((grupos) => {
        setClientes([]);
        setGrupos(grupos || []);
      })
      .catch((err) => {
        console.error("Error al cargar datos:", err);
      });

    // Cargar información del cliente de la ficha si hay clienteId
    if (clienteId) {
      setLoadingCliente(true);
      apiRequest(`cliente/${clienteId}`, "GET")
        .then((cliente) => {
          if (cliente) {
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
          setClienteFicha({
            id: clienteId,
            nombre_completo: "Cliente de la ficha",
          });
          setClienteQuery("Cliente de la ficha");
        })
        .finally(() => {
          setLoadingCliente(false);
        });
    } else {
      setClienteFicha(null);
      setClienteQuery("");
    }

    // Reset formData con conceptos fijos
    const clienteIdValido = clienteId ? String(clienteId) : "";
    setFormData({
      concept_id: String(CONCEPTO_HIJO_ID), // Siempre usar el concepto hijo fijo (43)
      note: "",
      cliente_id: clienteIdValido,
      grupo_familiar_id: grupoFamiliarId ? String(grupoFamiliarId) : "",
    });
    setErrors({});
    
    // Limpiar archivos
    archivos.forEach((arch) => {
      if (arch.preview) URL.revokeObjectURL(arch.preview);
    });
    setArchivos([]);
    setIsDragging(false);
  }, [show, grupoFamiliarId, clienteId]);

  // Establecer valores por defecto cuando cambian las props
  useEffect(() => {
    if (!show) return;
    
    setFormData((prev) => {
      const updates = {};
      // Siempre asegurar que concept_id sea el fijo
      if (String(prev.concept_id) !== String(CONCEPTO_HIJO_ID)) {
        updates.concept_id = String(CONCEPTO_HIJO_ID);
      }
      if (grupoFamiliarId && !prev.grupo_familiar_id) {
        updates.grupo_familiar_id = String(grupoFamiliarId);
      }
      if (clienteId && !prev.cliente_id) {
        updates.cliente_id = String(clienteId);
      }
      return Object.keys(updates).length > 0 ? { ...prev, ...updates } : prev;
    });
  }, [show, grupoFamiliarId, clienteId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    // Prevenir cambios al concept_id ya que es fijo
    if (name === "concept_id") {
      return;
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
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

  const validarCampos = () => {
    const nuevosErrores = {};
    
    // concept_id siempre debe ser el fijo, no necesita validación
    // pero verificamos que esté presente
    if (String(formData.concept_id) !== String(CONCEPTO_HIJO_ID)) {
      // Si por alguna razón no es el correcto, lo corregimos
      setFormData((prev) => ({ ...prev, concept_id: String(CONCEPTO_HIJO_ID) }));
    }
    
    if (isNoteEmpty(formData.note)) {
      nuevosErrores.note = "La nota es obligatoria";
    }
    
    if (!formData.cliente_id || formData.cliente_id === "") {
      nuevosErrores.cliente_id = "El cliente es obligatorio";
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
      const payload = {
        ...formData,
        concept_id: String(CONCEPTO_HIJO_ID), // Asegurar que siempre sea el concepto fijo (43)
        action_type: "comentario",
        tipo: "comentario",
      };

      const response = await apiRequest("bitacora_operativa/create", "POST", payload);
      
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
          alert(`Se creó el comentario pero hubo un error al subir algunos archivos:\n${err.message || "Error desconocido"}`);
        }
      } else if (archivos.length > 0 && !logId) {
        alert("Se creó el comentario pero no se pudieron subir los archivos porque no se pudo obtener el ID del registro.");
      }

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

      const nuevoComentario = {
        id: response?.log?.id || Date.now(),
        tipo: "comentario",
        status: "comment",
        log: {
          concept: { name: "Comentario" },
          note: formData.note,
          cliente: {
            nombre_completo: nombreCliente,
          },
        },
      };

      if (onCreated) {
        onCreated(nuevoComentario);
      }
      
      onHide();
    } catch (error) {
      console.error("Error al guardar comentario:", error);
      alert(`Error al guardar el comentario: ${error.message || "Error desconocido"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton className="border-bottom">
        <Modal.Title className="fw-normal">Nuevo Comentario</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {(toInt(formData.grupo_familiar_id) || toInt(grupoFamiliarId)) && (
          <div className="mb-3">
            <span className="badge bg-secondary">
              Grupo #{toInt(formData.grupo_familiar_id) || toInt(grupoFamiliarId)}
            </span>
          </div>
        )}

        {!formData.grupo_familiar_id && (
          <Form.Group className="mb-3">
            <Form.Label>Grupo Familiar</Form.Label>
            <Form.Select
              name="grupo_familiar_id"
              value={formData.grupo_familiar_id}
              onChange={handleChange}
              isInvalid={!!errors.grupo_familiar_id}
            >
              <option value="">Seleccionar grupo</option>
              {grupos.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nombre || `Grupo #${g.id}`}
                </option>
              ))}
            </Form.Select>
            <Form.Control.Feedback type="invalid">
              {errors.grupo_familiar_id}
            </Form.Control.Feedback>
          </Form.Group>
        )}

        <Form.Group className="mb-3">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <Form.Label className="mb-0">Comentario</Form.Label>
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
                <strong>Escuchando...</strong> Habla ahora. El texto se agregará automáticamente al comentario.
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
            <ReactQuill
              theme="snow"
              value={formData.note || ""}
              onChange={(value, delta, source, editor) => {
                setFormData((prev) => ({ ...prev, note: value }));
                // Guardar referencia al editor
                if (editor && !quillEditorRef.current) {
                  quillEditorRef.current = editor;
                }
                // Limpiar error cuando el usuario empiece a escribir
                if (errors.note && !isNoteEmpty(value)) {
                  setErrors((prev) => ({ ...prev, note: null }));
                }
              }}
              modules={quillModules}
              formats={quillFormats}
              placeholder="Escriba su comentario. Use la barra de herramientas para formatear el texto o el botón 'Dictar' para transcribir por voz..."
              style={{
                backgroundColor: '#fff',
              }}
            />
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
            onClick={() => document.getElementById("file-input-comentario").click()}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
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
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          onClick={() => handleClienteSeleccion(cli, null)}
                        >
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
            "Guardar Comentario"
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default NuevoComentarioModal;


