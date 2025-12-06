import React, { useEffect, useState, useMemo } from "react";
import { useFichaCliente } from "../../context/fichaClienteContext";
import apiRequest from "../../services/api";
import { Spinner } from "react-bootstrap";
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

  // Formatear fecha - formato más compacto y moderno
  const formatFecha = (fecha) => {
    if (!fecha) return "Sin fecha";
    try {
      const d = new Date(fecha);
      if (isNaN(d)) return fecha;
      
      const ahora = new Date();
      const diffMs = ahora - d;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
      
      // Formato relativo para fechas recientes
      if (diffMins < 1) return "Hace un momento";
      if (diffMins < 60) return `Hace ${diffMins} min`;
      if (diffHours < 24) return `Hace ${diffHours} h`;
      if (diffDays === 1) return "Ayer";
      if (diffDays < 7) return `Hace ${diffDays} días`;
      
      // Formato completo para fechas más antiguas
      return d.toLocaleString("es-ES", {
        year: "numeric",
        month: "short",
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
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-blue-800">
        <div className="flex items-center gap-2">
          <i className="fas fa-info-circle"></i>
          <span>No se encontró información del cliente.</span>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Header principal con diseño moderno */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
        {/* Header con gradiente sutil */}
        <div className="bg-gradient-to-r from-slate-50 to-gray-50 px-6 py-5 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
                <i className="fas fa-comments text-white text-sm"></i>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-800 m-0">Comentarios</h2>
                <p className="text-sm text-gray-500 m-0 mt-0.5">Historial de comentarios del grupo familiar</p>
              </div>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-medium text-sm shadow-sm hover:from-blue-700 hover:to-blue-800 transition-all duration-200 flex items-center gap-2 hover:shadow-md"
            >
              <i className="fas fa-plus text-xs"></i>
              <span>Nuevo Comentario</span>
            </button>
          </div>
        </div>

        {/* Contenido */}
        <div className="p-6">
          {!grupoFamiliarId ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                  <i className="fas fa-exclamation-triangle text-amber-600 text-sm"></i>
                </div>
                <div>
                  <p className="text-amber-800 font-medium m-0">No hay grupo familiar asociado</p>
                  <p className="text-amber-700 text-sm m-0 mt-1">Este cliente no tiene un grupo familiar asociado.</p>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Badge de grupo familiar */}
              <div className="mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full">
                  <i className="fas fa-users text-gray-500 text-xs"></i>
                  <span className="text-sm text-gray-600">
                    Grupo Familiar: <span className="font-semibold text-gray-800">GF #{grupoFamiliarId}</span>
                  </span>
                </div>
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Spinner animation="border" variant="primary" className="mb-4" />
                  <p className="text-gray-500 text-sm font-medium">Cargando comentarios...</p>
                </div>
              ) : error ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                      <i className="fas fa-exclamation-circle text-red-600 text-sm"></i>
                    </div>
                    <p className="text-red-800 font-medium m-0">{error}</p>
                  </div>
                </div>
              ) : comentarios.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                    <i className="fas fa-comments text-gray-400 text-2xl"></i>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">No hay comentarios aún</h3>
                  <p className="text-gray-500 text-sm mb-6 text-center max-w-sm">
                    Comienza a agregar comentarios para este grupo familiar y mantén un registro de las interacciones.
                  </p>
                  <button
                    onClick={() => setShowModal(true)}
                    className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm shadow-sm hover:bg-blue-700 transition-all duration-200 flex items-center gap-2 hover:shadow-md"
                  >
                    <i className="fas fa-plus text-xs"></i>
                    <span>Agregar primer comentario</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {comentarios.map((comentario, index) => {
                    const fecha = comentario.created_at || comentario.createdAt || comentario.fecha;
                    const concepto = getConceptoNombre(comentario);
                    const usuario = getUsuarioNombre(comentario);
                    const clienteNombre = getClienteNombre(comentario);
                    const nota = comentario.note || comentario.nota || comentario.comment || "Sin contenido";

                    return (
                      <div
                        key={comentario.id || index}
                        className="group relative bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-all duration-200 hover:border-gray-300"
                      >
                        {/* Línea vertical decorativa */}
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 to-blue-400 rounded-l-xl"></div>
                        
                        {/* Header del comentario */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            {/* Badge de concepto */}
                            <div className="flex items-center gap-2 mb-3">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium border border-blue-100">
                                <i className="fas fa-tag text-[10px]"></i>
                                {concepto}
                              </span>
                            </div>
                            
                            {/* Información del usuario */}
                            <div className="flex items-center gap-4 text-sm">
                              <div className="flex items-center gap-2 text-gray-600">
                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                                  <i className="fas fa-user text-gray-500 text-xs"></i>
                                </div>
                                <span className="font-medium">{usuario}</span>
                              </div>
                              {clienteNombre && clienteNombre !== "Cliente" && (
                                <div className="flex items-center gap-2 text-gray-500">
                                  <i className="fas fa-user-circle text-xs"></i>
                                  <span className="text-xs">{clienteNombre}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Fecha */}
                          <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 px-3 py-1.5 rounded-full">
                            <i className="fas fa-clock text-[10px]"></i>
                            <span className="font-medium">{formatFecha(fecha)}</span>
                          </div>
                        </div>
                        
                        {/* Contenido del comentario */}
                        <div className="pl-2">
                          <div className="prose prose-sm max-w-none">
                            <p className="text-gray-700 leading-relaxed m-0 whitespace-pre-wrap">
                              {nota}
                            </p>
                          </div>
                        </div>
                      </div>
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
