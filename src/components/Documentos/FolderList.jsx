import React, { useState, useMemo, useRef, useEffect } from "react";
import { Button, ListGroup, Spinner, Form, InputGroup } from "react-bootstrap";

/**
 * Componente para listar y gestionar carpetas con soporte para subcarpetas
 */
const FolderList = ({
  carpetas = [],
  carpetaSeleccionada,
  loading,
  onSelectCarpeta,
  onCrearCarpeta,
  onRenombrarCarpeta,
  onEliminarCarpeta,
  grupoFamiliarId,
  modoTransicionAnios = false,
  anioActual = new Date().getFullYear(),
}) => {
  const [mostrarFormCrear, setMostrarFormCrear] = useState(false);
  const [nombreNuevaCarpeta, setNombreNuevaCarpeta] = useState("");
  const [carpetaEditando, setCarpetaEditando] = useState(null);
  const [nombreEditando, setNombreEditando] = useState("");
  const [parentIdParaNuevaCarpeta, setParentIdParaNuevaCarpeta] = useState(null);
  const [carpetasExpandidas, setCarpetasExpandidas] = useState({});
  const [menuAbierto, setMenuAbierto] = useState(null); // ID de la carpeta cuyo menú está abierto
  const menuRefs = useRef({});

  /**
   * Organiza las carpetas en una estructura jerárquica
   */
  const carpetasOrganizadas = useMemo(() => {
    const carpetasMap = {};
    const raiz = [];

    // Primero, crear un mapa de todas las carpetas
    carpetas.forEach((carpeta) => {
      carpetasMap[carpeta.id] = { ...carpeta, hijos: [] };
    });

    // Luego, organizar en jerarquía
    carpetas.forEach((carpeta) => {
      const parentId = carpeta.parent_id || carpeta.parentId;
      if (parentId && carpetasMap[parentId]) {
        carpetasMap[parentId].hijos.push(carpetasMap[carpeta.id]);
      } else {
        raiz.push(carpetasMap[carpeta.id]);
      }
    });

    return raiz;
  }, [carpetas]);

  /**
   * Maneja la creación de una nueva carpeta
   */
  const handleSubmitCrear = (e) => {
    e.preventDefault();
    if (nombreNuevaCarpeta.trim()) {
      onCrearCarpeta(nombreNuevaCarpeta.trim(), "general", parentIdParaNuevaCarpeta);
      setNombreNuevaCarpeta("");
      setParentIdParaNuevaCarpeta(null);
      setMostrarFormCrear(false);
    }
  };

  /**
   * Inicia la creación de una subcarpeta
   */
  const iniciarCrearSubcarpeta = (parentId) => {
    setParentIdParaNuevaCarpeta(parentId);
    setMostrarFormCrear(true);
  };

  /**
   * Inicia la edición de una carpeta
   */
  const iniciarEdicion = (carpeta) => {
    setCarpetaEditando(carpeta.id);
    setNombreEditando(carpeta.nombre || "");
  };

  /**
   * Cancela la edición
   */
  const cancelarEdicion = () => {
    setCarpetaEditando(null);
    setNombreEditando("");
  };

  /**
   * Guarda el nuevo nombre de la carpeta
   */
  const guardarEdicion = () => {
    if (nombreEditando.trim() && carpetaEditando) {
      onRenombrarCarpeta(carpetaEditando, nombreEditando.trim());
      cancelarEdicion();
    }
  };

  /**
   * Alterna la expansión de una carpeta
   */
  const toggleExpandir = (carpetaId) => {
    setCarpetasExpandidas((prev) => ({
      ...prev,
      [carpetaId]: !prev[carpetaId],
    }));
  };

  /**
   * Formatea la fecha para mostrar
   */
  const formatearFecha = (fecha) => {
    if (!fecha) return "";
    try {
      const d = new Date(fecha);
      return d.toLocaleDateString("es-ES", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return fecha;
    }
  };

  /**
   * Abre o cierra el menú de opciones de una carpeta
   */
  const toggleMenu = (carpetaId, e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setMenuAbierto(menuAbierto === carpetaId ? null : carpetaId);
  };

  /**
   * Cierra el menú si se hace clic fuera
   */
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuAbierto) {
        const menuElement = menuRefs.current[menuAbierto];
        if (menuElement && !menuElement.contains(event.target)) {
          setMenuAbierto(null);
        }
      }
    };

    if (menuAbierto) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [menuAbierto]);

  /**
   * Renderiza una carpeta y sus hijos recursivamente
   */
  const renderizarCarpeta = (carpeta, nivel = 0) => {
    const tieneHijos = carpeta.hijos && carpeta.hijos.length > 0;
    const estaExpandida = carpetasExpandidas[carpeta.id];
    const estaSeleccionada = carpetaSeleccionada?.id === carpeta.id;
    const indentacion = nivel * 20;

    return (
      <React.Fragment key={carpeta.id}>
        <ListGroup.Item
          action
          active={estaSeleccionada}
          onClick={() => onSelectCarpeta(carpeta)}
          className="d-flex justify-content-between align-items-start"
          style={{ 
            cursor: "pointer",
            paddingLeft: `${12 + indentacion}px`
          }}
        >
          <div className="flex-grow-1 d-flex align-items-center">
            {tieneHijos && (
              <Button
                variant="link"
                size="sm"
                className="p-0 me-2 text-muted"
                style={{ width: "20px", minWidth: "20px" }}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpandir(carpeta.id);
                }}
              >
                <i className={`fas fa-chevron-${estaExpandida ? "down" : "right"}`}></i>
              </Button>
            )}
            {!tieneHijos && <span style={{ width: "20px", display: "inline-block" }}></span>}
            
            <div className="flex-grow-1">
              {carpetaEditando === carpeta.id ? (
                <InputGroup size="sm">
                  <Form.Control
                    type="text"
                    value={nombreEditando}
                    onChange={(e) => setNombreEditando(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") guardarEdicion();
                      if (e.key === "Escape") cancelarEdicion();
                    }}
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                  <Button
                    variant="success"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      guardarEdicion();
                    }}
                  >
                    <i className="fas fa-check"></i>
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      cancelarEdicion();
                    }}
                  >
                    <i className="fas fa-times"></i>
                  </Button>
                </InputGroup>
              ) : (
                <>
                  <div className="fw-semibold">
                    <i className="fas fa-folder me-2"></i>
                    {carpeta.nombre || "Sin nombre"}
                  </div>
                  <small className="text-muted">
                    {formatearFecha(carpeta.created_at || carpeta.createdAt)}
                  </small>
                </>
              )}
            </div>
          </div>
          
          {carpetaEditando !== carpeta.id && (
            <div className="d-flex gap-1 position-relative">
              <Button
                variant="link"
                size="sm"
                className="text-muted p-0"
                onClick={(e) => toggleMenu(carpeta.id, e)}
                style={{ 
                  textDecoration: "none", 
                  border: "none",
                  outline: "none",
                  boxShadow: "none",
                  zIndex: 10
                }}
                title="Opciones de carpeta"
              >
                <i className="fas fa-ellipsis-v"></i>
              </Button>
              
              {/* Menú personalizado */}
              {menuAbierto === carpeta.id && (
                <div
                  ref={(el) => (menuRefs.current[carpeta.id] = el)}
                  className="position-absolute"
                  style={{
                    top: "100%",
                    right: 0,
                    backgroundColor: "white",
                    border: "1px solid #dee2e6",
                    borderRadius: "0.375rem",
                    boxShadow: "0 0.5rem 1rem rgba(0, 0, 0, 0.15)",
                    zIndex: 1000,
                    minWidth: "180px",
                    marginTop: "4px"
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    style={{
                      padding: "0.25rem 0",
                    }}
                  >
                    <button
                      className="w-100 text-start border-0 bg-transparent px-3 py-2"
                      style={{
                        cursor: "pointer",
                        fontSize: "0.875rem",
                        color: "#212529"
                      }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = "#f8f9fa"}
                      onMouseLeave={(e) => e.target.style.backgroundColor = "transparent"}
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuAbierto(null);
                        iniciarCrearSubcarpeta(carpeta.id);
                      }}
                    >
                      <i className="fas fa-folder-plus me-2"></i>
                      Nueva subcarpeta
                    </button>
                    <button
                      className="w-100 text-start border-0 bg-transparent px-3 py-2"
                      style={{
                        cursor: "pointer",
                        fontSize: "0.875rem",
                        color: "#212529"
                      }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = "#f8f9fa"}
                      onMouseLeave={(e) => e.target.style.backgroundColor = "transparent"}
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuAbierto(null);
                        iniciarEdicion(carpeta);
                      }}
                    >
                      <i className="fas fa-edit me-2"></i>
                      Renombrar
                    </button>
                    <button
                      className="w-100 text-start border-0 bg-transparent px-3 py-2"
                      style={{
                        cursor: onEliminarCarpeta ? "pointer" : "not-allowed",
                        fontSize: "0.875rem",
                        color: onEliminarCarpeta ? "#dc3545" : "#adb5bd",
                      }}
                      disabled={!onEliminarCarpeta}
                      onMouseEnter={(e) => {
                        if (onEliminarCarpeta) e.target.style.backgroundColor = "#f8f9fa";
                      }}
                      onMouseLeave={(e) => {
                        if (onEliminarCarpeta) e.target.style.backgroundColor = "transparent";
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuAbierto(null);
                        if (onEliminarCarpeta) onEliminarCarpeta(carpeta);
                      }}
                    >
                      <i className="fas fa-trash me-2"></i>
                      Eliminar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </ListGroup.Item>
        
        {/* Renderizar hijos si la carpeta está expandida */}
        {tieneHijos && estaExpandida && (
          <>
            {carpeta.hijos.map((hijo) => renderizarCarpeta(hijo, nivel + 1))}
          </>
        )}
      </React.Fragment>
    );
  };

  return (
    <div className="h-100">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h6 className="mb-0">
          <i className="fas fa-folder me-2"></i>
          Carpetas
        </h6>
        <Button
          variant="outline-primary"
          size="sm"
          onClick={() => {
            setParentIdParaNuevaCarpeta(null);
            setMostrarFormCrear(!mostrarFormCrear);
          }}
          disabled={!grupoFamiliarId}
        >
          <i className="fas fa-plus me-1"></i>
          Nueva
        </Button>
      </div>

      {/* Formulario para crear carpeta */}
      {mostrarFormCrear && (
        <div className="mb-3 p-3 border rounded bg-light">
          <Form onSubmit={handleSubmitCrear}>
            {parentIdParaNuevaCarpeta ? (
              <div className="mb-2">
                <small className="text-muted">
                  <i className="fas fa-info-circle me-1"></i>
                  Creando subcarpeta dentro de "{carpetas.find(c => c.id === parentIdParaNuevaCarpeta)?.nombre || "carpeta"}"
                </small>
              </div>
            ) : (
              <div className="mb-2">
                <small className="text-muted">
                  <i className="fas fa-folder me-1"></i>
                  Puede crear carpetas con nombre libre (ej: soportes) o por año (ej: {anioActual}).
                  {!modoTransicionAnios && (
                    <> Los años anteriores al actual requieren clave del super administrador.</>
                  )}
                </small>
              </div>
            )}
            <InputGroup>
              <Form.Control
                type="text"
                maxLength={255}
                placeholder={
                  parentIdParaNuevaCarpeta
                    ? "Nombre de la subcarpeta"
                    : `Nombre (ej: soportes o ${anioActual})`
                }
                value={nombreNuevaCarpeta}
                onChange={(e) => setNombreNuevaCarpeta(e.target.value)}
                autoFocus
              />
              <Button variant="success" type="submit" size="sm">
                <i className="fas fa-check"></i>
              </Button>
              <Button
                variant="secondary"
                type="button"
                size="sm"
                onClick={() => {
                  setMostrarFormCrear(false);
                  setNombreNuevaCarpeta("");
                  setParentIdParaNuevaCarpeta(null);
                }}
              >
                <i className="fas fa-times"></i>
              </Button>
            </InputGroup>
          </Form>
        </div>
      )}

      {/* Lista de carpetas */}
      {loading ? (
        <div className="text-center py-4">
          <Spinner animation="border" size="sm" />
          <p className="text-muted small mt-2">Cargando carpetas...</p>
        </div>
      ) : carpetasOrganizadas.length === 0 ? (
        <div className="text-center py-4 text-muted">
          <i className="fas fa-folder-open fa-2x mb-2 opacity-50"></i>
          <p className="small mb-0">No hay carpetas</p>
          <p className="small">Crea la primera carpeta</p>
        </div>
      ) : (
        <ListGroup variant="flush">
          {carpetasOrganizadas.map((carpeta) => renderizarCarpeta(carpeta, 0))}
        </ListGroup>
      )}
    </div>
  );
};

export default FolderList;
