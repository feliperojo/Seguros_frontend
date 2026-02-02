import React, { useEffect, useState } from "react";
import { Modal, Button, Form, Spinner } from "react-bootstrap";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import apiRequest from "../../services/api";
import { createTaskFromRun, addComment } from "../../services/auditoriasTasksService";
import { useMentionableQuill } from "../../hooks/useMentionableQuill";
import { extractMentionedUserIds } from "../../utils/mentions";
import useToast from "../../hooks/useToast";

// Configuración de módulos para ReactQuill
const quillModules = {
  toolbar: [
    [{ 'header': [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'color': [] }, { 'background': [] }],
    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
    ['link'],
    ['clean']
  ],
};

const quillFormats = [
  'header',
  'bold', 'italic', 'underline', 'strike',
  'color', 'background',
  'list', 'bullet',
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

/**
 * Función helper para convertir fecha a formato YYYY-MM-DD
 */
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

const NuevaTareaAuditoriaModal = ({ 
  show, 
  onHide, 
  onCreated, 
  itemId, // DEPRECATED - mantener por compatibilidad
  itemInfo = null, // Información del item para mostrar contexto (debe incluir runId, cobertura_id o cliente_id)
  runId = null // ID del run de auditoría (nuevo método)
}) => {
  const toast = useToast();
  
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
      const scheduled = new Date(formData.scheduled_date);
      const due = new Date(formData.due_date);
      if (due < scheduled) {
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
    
    console.log("✅ Creando tarea con runId:", currentRunId, "cobertura_id:", coberturaId, "cliente_id:", clienteId, "grupo_familiar_id:", grupoFamiliarId);
    
    setLoading(true);
    
    try {
      const payload = {
        assigned_user_id: parseInt(formData.assigned_user_id),
        scheduled_date: formData.scheduled_date,
        due_date: formData.due_date,
      };
      
      // Agregar cobertura_id o cliente_id (no ambos)
      if (coberturaId) {
        payload.cobertura_id = coberturaId;
      } else if (clienteId) {
        payload.cliente_id = clienteId;
      }
      
      // Agregar grupo_familiar_id si está disponible
      if (grupoFamiliarId) {
        payload.grupo_familiar_id = parseInt(grupoFamiliarId);
      }
      
      // Incluir nota si no está vacía
      if (!isNoteEmpty(formData.response_note)) {
        payload.response_note = formData.response_note;
      }
      
      // Incluir menciones si hay
      if (mentionedUserIds.length > 0) {
        payload.mentioned_user_ids = mentionedUserIds;
      }
      
      // Crear la tarea usando el nuevo endpoint
      const response = await createTaskFromRun(currentRunId, payload);
      const taskId = response?.id || response?.data?.id || response?.task?.id;
      
      // Si hay archivos y se creó la tarea, subirlos como comentario inicial
      if (taskId && archivos.length > 0) {
        try {
          setSubiendoArchivos(true);
          
          // Crear un comentario inicial con los archivos
          const formDataComentario = new FormData();
          const comentarioTexto = formData.response_note && !isNoteEmpty(formData.response_note) 
            ? formData.response_note 
            : "Archivos adjuntos";
          formDataComentario.append('comment', comentarioTexto);
          
          if (mentionedUserIds.length > 0) {
            formDataComentario.append('mentioned_user_ids', JSON.stringify(mentionedUserIds));
          }
          
          // Agregar archivos
          archivos.forEach((archivo) => {
            formDataComentario.append('archivos[]', archivo.file);
          });
          
          // Subir archivos como comentario inicial
          await addComment(taskId, formDataComentario);
          
        } catch (err) {
          console.error("Error al subir archivos:", err);
          toast.showWarning("Tarea creada pero hubo un error al subir algunos archivos");
        } finally {
          setSubiendoArchivos(false);
        }
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
      <Modal show={show} onHide={onHide} size="lg" backdrop="static">
        <Modal.Header closeButton>
          <Modal.Title>Crear Tarea de Auditoría</Modal.Title>
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
                <option value="">Selecciona un usuario</option>
                {usuarios.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name || user.nombre || `Usuario ${user.id}`}
                  </option>
                ))}
              </Form.Select>
              {errors.assigned_user_id && (
                <Form.Text className="text-danger">{errors.assigned_user_id}</Form.Text>
              )}
            </Form.Group>
            
            <div className="row">
              <Form.Group className="mb-3 col-md-6">
                <Form.Label>
                  Fecha Programada <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  type="date"
                  value={formData.scheduled_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, scheduled_date: e.target.value }))}
                  isInvalid={!!errors.scheduled_date}
                />
                {errors.scheduled_date && (
                  <Form.Text className="text-danger">{errors.scheduled_date}</Form.Text>
                )}
              </Form.Group>
              
              <Form.Group className="mb-3 col-md-6">
                <Form.Label>
                  Fecha Límite <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
                  isInvalid={!!errors.due_date}
                />
                {errors.due_date && (
                  <Form.Text className="text-danger">{errors.due_date}</Form.Text>
                )}
              </Form.Group>
            </div>
            
            <Form.Group className="mb-3">
              <Form.Label>Nota de Respuesta (Opcional)</Form.Label>
              <div style={{ position: "relative" }}>
                <ReactQuill
                  ref={mentionQuillRef}
                  theme="snow"
                  value={formData.response_note}
                  onChange={(content, delta, source, editor) => {
                    setFormData(prev => ({ ...prev, response_note: content }));
                    handleQuillChange(content, delta, source, editor);
                  }}
                  onKeyDown={handleQuillKeyDown}
                  modules={quillModules}
                  formats={quillFormats}
                  placeholder="Escribe una nota inicial para la tarea. Escribe @ para mencionar usuarios..."
                  style={{ minHeight: "150px" }}
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
            </Form.Group>
            
            {/* Sección de archivos adjuntos */}
            <Form.Group className="mb-3">
              <Form.Label>Archivos Adjuntos (Opcional)</Form.Label>
              <div
                className={`border rounded p-3 text-center ${isDragging ? 'border-primary bg-light' : ''}`}
                style={{
                  borderStyle: "dashed",
                  cursor: "pointer",
                  backgroundColor: isDragging ? "#e3f2fd" : "#f8f9fa",
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
                  <i className="fas fa-cloud-upload-alt fa-2x text-primary mb-2"></i>
                  <p className="mb-1">
                    {isDragging ? "Suelta los archivos aquí" : "Haz clic para seleccionar archivos o arrastra y suelta"}
                  </p>
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
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={onHide} disabled={loading}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" />
                  Creando...
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

