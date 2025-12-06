import React, { useEffect, useState, useMemo } from "react";
import { useFichaCliente } from "../../context/fichaClienteContext";
import apiRequest from "../../services/api";
import { Spinner, Card, Badge } from "react-bootstrap";
import NuevaTareaModal from "../../components/Tareas/NuevaTareaModal";

const toValidId = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export default function FichaClienteComentarios() {
  const { cliente, coberturaPrincipal, id: clienteId } = useFichaCliente();
  const [comentarios, setComentarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);

  // Obtener grupo familiar del contexto
  const grupoFamiliarId = useMemo(() => {
    if (!cliente) return null;
    return (
      toValidId(cliente.grupo_familiar_id) ??
      toValidId(coberturaPrincipal?.grupo_familiar_id) ??
      toValidId(coberturaPrincipal?.grupo_familiar?.id) ??
      null
    );
  }, [cliente, coberturaPrincipal]);

  // Cargar comentarios del grupo familiar
  useEffect(() => {
    if (!grupoFamiliarId) {
      setComentarios([]);
      setError("No hay grupo familiar asociado");
      return;
    }

    const cargarComentarios = async () => {
      setLoading(true);
      setError("");
      try {
        // Obtener bitacora operativa filtrando por grupo familiar y tipo comment
        const response = await apiRequest(
          `bitacora_operativa?grupo_familiar_id=${grupoFamiliarId}&per_page=100`,
          "GET"
        );

        // Extraer los datos
        const data = response?.data || response || [];
        const lista = Array.isArray(data) ? data : [];

        // Filtrar solo comentarios
        // Los comentarios se identifican por:
        // 1. status === "comment" 
        // 2. tipo === "comentario"
        // 3. No tienen asignación ni fechas (solo nota)
        const comentariosFiltrados = lista.filter((item) => {
          const status = String(item?.status || item?.estado || item?.task?.status || "").toLowerCase();
          const tipo = String(item?.tipo || "").toLowerCase();
          
          // Verificar si es un comentario
          const esComentario = 
            status === "comment" ||
            tipo === "comentario" ||
            // Si no tiene asignación ni fechas pero sí tiene nota, es un comentario
            (!item.assign_to_user_id && !item.scheduled_date && !item.due_date && item.note);
          
          // También verificar que pertenezca al grupo familiar correcto
          const itemGrupoId = item.grupo_familiar_id || item.grupo_familiar?.id;
          const perteneceAlGrupo = !itemGrupoId || Number(itemGrupoId) === Number(grupoFamiliarId);
          
          return esComentario && perteneceAlGrupo;
        });

        // Ordenar por fecha de creación (más reciente primero)
        const comentariosOrdenados = comentariosFiltrados.sort((a, b) => {
          const fechaA = new Date(a.created_at || a.createdAt || a.fecha || 0);
          const fechaB = new Date(b.created_at || b.createdAt || b.fecha || 0);
          return fechaB - fechaA; // Descendente (más reciente primero)
        });

        setComentarios(comentariosOrdenados);
      } catch (err) {
        console.error("Error al cargar comentarios:", err);
        setError("No se pudieron cargar los comentarios");
        setComentarios([]);
      } finally {
        setLoading(false);
      }
    };

    cargarComentarios();
  }, [grupoFamiliarId]);

  // Formatear fecha
  const formatFecha = (fecha) => {
    if (!fecha) return "Sin fecha";
    try {
      const d = new Date(fecha);
      if (isNaN(d)) return fecha;
      return d.toLocaleString("es-ES", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return fecha;
    }
  };

  // Obtener nombre del concepto
  const getConceptoNombre = (item) => {
    return (
      item?.concept?.name ||
      item?.concepto?.name ||
      item?.concept_name ||
      item?.concepto ||
      "Sin concepto"
    );
  };

  // Obtener nombre del usuario
  const getUsuarioNombre = (item) => {
    return (
      item?.user?.name ||
      item?.usuario?.name ||
      item?.user_name ||
      item?.usuario ||
      item?.created_by?.name ||
      "Usuario desconocido"
    );
  };

  // Obtener nombre del cliente
  const getClienteNombre = (item) => {
    return (
      item?.cliente?.nombre_completo ||
      item?.cliente_name ||
      item?.cliente ||
      "Cliente"
    );
  };

  const handleComentarioCreado = () => {
    // Recargar comentarios después de crear uno nuevo
    if (grupoFamiliarId) {
      setLoading(true);
      apiRequest(
        `bitacora_operativa?grupo_familiar_id=${grupoFamiliarId}&per_page=100`,
        "GET"
      )
        .then((response) => {
          const data = response?.data || response || [];
          const lista = Array.isArray(data) ? data : [];
          const comentariosFiltrados = lista.filter((item) => {
            const status = String(item?.status || item?.estado || item?.task?.status || "").toLowerCase();
            const tipo = String(item?.tipo || "").toLowerCase();
            
            const esComentario = 
              status === "comment" ||
              tipo === "comentario" ||
              (!item.assign_to_user_id && !item.scheduled_date && !item.due_date && item.note);
            
            const itemGrupoId = item.grupo_familiar_id || item.grupo_familiar?.id;
            const perteneceAlGrupo = !itemGrupoId || Number(itemGrupoId) === Number(grupoFamiliarId);
            
            return esComentario && perteneceAlGrupo;
          });
          const comentariosOrdenados = comentariosFiltrados.sort((a, b) => {
            const fechaA = new Date(a.created_at || a.createdAt || a.fecha || 0);
            const fechaB = new Date(b.created_at || b.createdAt || b.fecha || 0);
            return fechaB - fechaA;
          });
          setComentarios(comentariosOrdenados);
        })
        .catch((err) => {
          console.error("Error al recargar comentarios:", err);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  };

  if (!cliente) {
    return (
      <div className="alert alert-info">
        No se encontró información del cliente.
      </div>
    );
  }

  return (
    <>
      <div className="card mb-3">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h6 className="mb-0">
            <i className="fas fa-comments me-2 text-primary"></i>
            Comentarios del Grupo Familiar
          </h6>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setShowModal(true)}
          >
            <i className="fas fa-plus me-1"></i>
            Agregar Comentario
          </button>
        </div>
        <div className="card-body">
          {!grupoFamiliarId ? (
            <div className="alert alert-warning">
              <i className="fas fa-exclamation-triangle me-2"></i>
              No hay grupo familiar asociado a este cliente.
            </div>
          ) : (
            <>
              <div className="mb-3">
                <small className="text-muted">
                  <i className="fas fa-info-circle me-1"></i>
                  Grupo Familiar: <strong>GF #{grupoFamiliarId}</strong>
                </small>
              </div>

              {loading ? (
                <div className="text-center py-4">
                  <Spinner animation="border" variant="primary" />
                  <p className="text-muted mt-2">Cargando comentarios...</p>
                </div>
              ) : error ? (
                <div className="alert alert-danger">
                  <i className="fas fa-exclamation-circle me-2"></i>
                  {error}
                </div>
              ) : comentarios.length === 0 ? (
                <div className="text-center py-5">
                  <i className="fas fa-comments fa-3x text-muted mb-3 opacity-50"></i>
                  <p className="text-muted">
                    No hay comentarios registrados para este grupo familiar.
                  </p>
                  <button
                    className="btn btn-outline-primary btn-sm"
                    onClick={() => setShowModal(true)}
                  >
                    <i className="fas fa-plus me-1"></i>
                    Agregar primer comentario
                  </button>
                </div>
              ) : (
                <div className="d-flex flex-column gap-3">
                  {comentarios.map((comentario, index) => {
                    const fecha = comentario.created_at || comentario.createdAt || comentario.fecha;
                    const concepto = getConceptoNombre(comentario);
                    const usuario = getUsuarioNombre(comentario);
                    const clienteNombre = getClienteNombre(comentario);
                    const nota = comentario.note || comentario.nota || comentario.comment || "Sin contenido";

                    return (
                      <Card key={comentario.id || index} className="shadow-sm border-start border-primary border-3">
                        <Card.Body>
                          <div className="d-flex justify-content-between align-items-start mb-2">
                            <div className="flex-grow-1">
                              <div className="d-flex align-items-center gap-2 mb-2">
                                <Badge bg="info" className="me-2">
                                  <i className="fas fa-comment-dots me-1"></i>
                                  {concepto}
                                </Badge>
                                <small className="text-muted">
                                  <i className="fas fa-user me-1"></i>
                                  {usuario}
                                </small>
                              </div>
                              {clienteNombre && clienteNombre !== "Cliente" && (
                                <small className="text-muted d-block mb-2">
                                  <i className="fas fa-user-circle me-1"></i>
                                  Cliente: {clienteNombre}
                                </small>
                              )}
                            </div>
                            <small className="text-muted text-nowrap">
                              <i className="fas fa-clock me-1"></i>
                              {formatFecha(fecha)}
                            </small>
                          </div>
                          
                          <div className="mt-2">
                            <p className="mb-0" style={{ whiteSpace: "pre-wrap" }}>
                              {nota}
                            </p>
                          </div>
                        </Card.Body>
                      </Card>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal para agregar comentario */}
      <NuevaTareaModal
        show={showModal}
        onHide={() => setShowModal(false)}
        onCreated={handleComentarioCreado}
        grupoFamiliarId={grupoFamiliarId}
        clienteId={toValidId(clienteId)}
      />
    </>
  );
}
