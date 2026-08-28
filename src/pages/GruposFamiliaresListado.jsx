import React, { useState, useEffect, useMemo, Fragment } from "react";
import {
  Container, Table, Badge, Button,
  Form, InputGroup, Dropdown, Modal
} from "react-bootstrap";
import Pagination from "../components/Pagination";
import {
  FaSearch, FaEdit, FaEye, FaTrashAlt, FaCog,
  FaFilter, FaSortAmountDown, FaSortAmountUp, FaFile, FaFileExport,
  FaChevronDown, FaChevronUp, FaUsers, FaChartBar,
} from "react-icons/fa";
import "../styles/GruposFamiliaresListado.css"
import { Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import apiRequest from "../services/api";
import GrupoFamiliarDetalleModal from "../components/GrupoFamiliarDetalleModal";
import RequerimientosModal from "../components/RequerimientosModal"; // Importar el modal
import RetiroCancelacionModal from "../components/RetiroCancelacionModal";
import ResumenGruposEstados from "../components/ResumenGruposEstados";
import GrupoFamiliarClasificadoDetalle from "../components/GrupoFamiliar/GrupoFamiliarClasificadoDetalle";
import {
  labelEstadoGrupoParaDisplay,
  grupoFamiliarDeleteRequiereAdmin,
  personasSaludDentalParaListado,
  personasPrivadasParaListado,
  personasTaxesParaListado,
  FILTRO_PRODUCTO_LISTADO_OPCIONES,
  normalizarFiltroProductoListado,
} from "../constants/estadosGrupoFamiliar";
import { ordenarEtiquetasProductoListado } from "../constants/coberturaTipos";
import SuperAdminPasswordModal from "../components/Documentos/SuperAdminPasswordModal";
import { Helmet } from "react-helmet-async";




const ITEMS_PER_PAGE = 50;
const ANIO_ACTUAL = new Date().getFullYear();
const ANIOS_BASE = [ANIO_ACTUAL, ANIO_ACTUAL - 1, ANIO_ACTUAL - 2, ANIO_ACTUAL - 3];

const GruposFamiliaresListado = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();


  // Estados
  const [grupos, setGrupos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [paginationMeta, setPaginationMeta] = useState({
    total: 0,
    last_page: 1,
    per_page: ITEMS_PER_PAGE,
    page: 1,
  });
  const [selectedStatus, setSelectedStatus] = useState(() => {
    const fromUrl = (searchParams.get("estado") || "").toLowerCase();
    const validos = [
      "prospecto",
      "cotizacion",
      "seguimiento",
      "toma_datos",
      "inscripcion_ini",
      "grupo_familiar",
      "grupo_familiar_activo",
      "grupo_familiar_inactivo",
      "descartado",
    ];
    return validos.includes(fromUrl) ? fromUrl : "Todos los estados";
  });
  const [selectedProducto, setSelectedProducto] = useState(() =>
    normalizarFiltroProductoListado(searchParams.get("producto"))
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [showRetiroModal, setShowRetiroModal] = useState(false);
  const [grupoParaRetiro, setGrupoParaRetiro] = useState(null);
 const [showModal, setShowModal] = useState(false);
 const [showDocumentosModal, setShowDocumentosModal] = useState(false);
const [coberturaId, setCoberturaId] = useState(null);
const [grupoFamiliarId, setGrupoFamiliarId] = useState(null); // Agregar el estado


  // Estados para modales
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAdminPasswordModal, setShowAdminPasswordModal] = useState(false);
  const [adminPasswordForDelete, setAdminPasswordForDelete] = useState("");
  const [currentGrupo, setCurrentGrupo] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [mostrarInactivas, setMostrarInactivas] = useState(false);
  const [gruposExpandidos, setGruposExpandidos] = useState(() => new Set());
  const location = useLocation();

  // Año actual + 3 anteriores como base; se enriquecen con años ya creados en BD (incluye futuros).
  const [aniosDisponibles, setAniosDisponibles] = useState(ANIOS_BASE);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await apiRequest(
          "grupo_familiar/anios-disponibles-globales",
          "GET"
        );
        const fromApi = (Array.isArray(response?.data) ? response.data : [])
          .map((y) => Number(y))
          .filter((y) => Number.isFinite(y) && y > 1900 && y < 2100);
        if (cancelled) return;
        const merged = Array.from(new Set([...fromApi, ...ANIOS_BASE])).sort(
          (a, b) => b - a
        );
        setAniosDisponibles(merged);
      } catch (err) {
        console.error("Error al cargar años disponibles del listado:", err);
        // Mantiene ANIOS_BASE — no rompe el listado.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const anioSeleccionado = useMemo(() => {
    const raw = Number(searchParams.get("anio"));
    if (
      Number.isFinite(raw) &&
      (aniosDisponibles.includes(raw) ||
        ANIOS_BASE.includes(raw) ||
        raw > ANIO_ACTUAL)
    ) {
      return raw;
    }
    return ANIO_ACTUAL;
  }, [searchParams, aniosDisponibles]);

  const buildDetallePath = (grupoId) => {
    if (anioSeleccionado === ANIO_ACTUAL) {
      return `/grupo_familiar/${grupoId}`;
    }
    return `/grupo_familiar/${grupoId}?anio=${anioSeleccionado}`;
  };

  const handleAnioChange = (year) => {
    const next = Number(year);
    const params = new URLSearchParams(searchParams);
    if (next === ANIO_ACTUAL) {
      params.delete("anio");
    } else {
      params.set("anio", String(next));
    }
    setSearchParams(params, { replace: true });
    setCurrentPage(1);
  };

  const handleProductoChange = (value) => {
    const next = normalizarFiltroProductoListado(value);
    setSelectedProducto(next);
    const params = new URLSearchParams(searchParams);
    if (next === "todos") {
      params.delete("producto");
    } else {
      params.set("producto", next);
    }
    setSearchParams(params, { replace: true });
    setCurrentPage(1);
  };

  const etiquetaAnio = (year) => {
    if (year === ANIO_ACTUAL) return " (actual)";
    if (year > ANIO_ACTUAL) return " (futuro)";
    return "";
  };

  // Función para manejar el clic desde el componente de resumen
  const handleEstadoClickFromResumen = (codigoEstado) => {
    // Si se hace clic en "Todos los estados", resetear el filtro
    if (codigoEstado === "Todos los estados") {
      setSelectedStatus("Todos los estados");
    } else {
      // El código del estado ya viene en minúsculas (ej: "cotizacion", "toma_datos")
      // que es exactamente lo que el endpoint espera
      setSelectedStatus(codigoEstado);
    }
  };

  const handleOpenRetiroModal = (grupo) => {
    setGrupoParaRetiro(grupo);
    setShowRetiroModal(true);
  };

useEffect(() => {
  const params = new URLSearchParams(location.search);
  const searchParam = params.get("search");
  if (searchParam) {
    setSearchTerm(searchParam);
  }
}, [location.search]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Cargar grupos al cambiar filtros, búsqueda, página o año
  useEffect(() => {
    fetchGrupos();
    setGruposExpandidos(new Set());
  }, [selectedStatus, selectedProducto, debouncedSearch, currentPage, anioSeleccionado]);

  const toggleGrupoExpandido = (grupoId) => {
    setGruposExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(grupoId)) next.delete(grupoId);
      else next.add(grupoId);
      return next;
    });
  };

  // Volver a la primera página al cambiar búsqueda o filtro de estado
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedStatus, selectedProducto]);

  // Función para mapear el código del estado al formato que espera el endpoint
  const mapearEstadoParaEndpoint = (codigoEstado) => {
    // Mapeo de códigos en minúsculas a códigos en mayúsculas que espera el API
    const estadoMap = {
      "prospecto": "PROSPECTO",
      "cotizacion": "COTIZACION",
      "seguimiento": "SEGUIMIENTO",
      "toma_datos": "TOMA_DATOS",
      "inscripcion_ini": "INSCRIPCION_INI",
      "grupo_familiar": "GRUPO_FAMILIAR",
      "grupo_familiar_activo": "GRUPO_FAMILIAR_ACTIVO",
      "grupo_familiar_inactivo": "GRUPO_FAMILIAR_INACTIVO",
      "descartado": "DESCARTADO"
    };
    
    // Si el código ya está en mayúsculas, devolverlo tal cual
    if (codigoEstado === codigoEstado.toUpperCase()) {
      return codigoEstado;
    }
    
    // Convertir a mayúsculas y buscar en el mapa
    const codigoLower = codigoEstado.toLowerCase();
    return estadoMap[codigoLower] || codigoEstado.toUpperCase();
  };

  // Función para cargar grupos
  const fetchGrupos = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(currentPage));
      params.set("per_page", String(ITEMS_PER_PAGE));

      if (selectedStatus !== "Todos los estados") {
        params.set("estado", mapearEstadoParaEndpoint(selectedStatus));
      }

      if (debouncedSearch.trim()) {
        params.set("search", debouncedSearch.trim());
      }

      // Año actual = default del backend; histórico o futuro ya creado se filtra por ?anio=
      if (anioSeleccionado !== ANIO_ACTUAL) {
        params.set("anio", String(anioSeleccionado));
      }

      if (selectedProducto && selectedProducto !== "todos") {
        params.set("producto", selectedProducto);
      }

      const response = await apiRequest(
        `grupo_familiar/grupos-familiares-listado?${params.toString()}`,
        "GET"
      );

      if (response && response.status === "success" && Array.isArray(response.data)) {
        setGrupos(response.data);
        setPaginationMeta(response.meta || {
          total: response.data.length,
          last_page: 1,
          per_page: ITEMS_PER_PAGE,
          page: currentPage,
        });
      } else {
        setGrupos([]);
        setPaginationMeta({
          total: 0,
          last_page: 1,
          per_page: ITEMS_PER_PAGE,
          page: 1,
        });
      }
    } catch (error) {
      console.error("Error al cargar grupos familiares:", error);
      alert("Error al cargar los grupos familiares. Por favor, intente nuevamente.");
    } finally {
      setLoading(false);
    }
  };


  // Añade esta función después de getCompaniaNombre o getTomadorNombre
  // const getGrupoEstado = (grupo) => {
  //   if (!grupo.coberturas || grupo.coberturas.length === 0) {
  //     return { estado: "Sin póliza", variant: "secondary" };
  //   }

  //   // Verificar si todas las coberturas tienen fecha de cancelación
  //   const todasCanceladas = grupo.coberturas.every(cobertura => !!cobertura.fecha_cancelacion);

  //   if (todasCanceladas) {
  //     return { estado: "Cancelada", variant: "danger" };
  //   }

  //   // Si al menos una no está cancelada
  //   return { estado: "Activa", variant: "success" };
  // };
  const getGrupoEstado = (grupo) => {
    // Extract the estado (state) and estado_codigo from the response
    const estadoRaw = grupo.estado || "Sin estado";
    const estado = labelEstadoGrupoParaDisplay(estadoRaw);
  
    // Define the badge color based on the estado value
    const variant = estadoRaw === "Cotización" ? "warning" :
                    estadoRaw === "Activo" ? "success" :
                    estadoRaw === "Inactivo" ? "danger" : "secondary";
  
    return { estado, variant };
  };
  

  // Funciones para manejar acciones
  const handleOpenViewModal = async (grupo) => {
    try {
      const response = await apiRequest(`grupo_familiar/grupos-familiares-full/${grupo.id}`, "GET");
      if (response && response.status === "success") {
        setCurrentGrupo(response.data); // 🔹 Aquí llega el detalle completo
        setShowViewModal(true);
      } else {
        console.error("Error al cargar detalle:", response);
        alert("No se pudo cargar la información del grupo familiar.");
      }
    } catch (error) {
      console.error("Error al obtener detalle:", error);
      alert("Error al cargar detalle del grupo familiar.");
    }
  };
  
  

  const handleOpenEditModal = (grupo) => {
    const id = grupo.id;
    navigate(`/grupo-familiar/${id}/editar`);
  };

  const resetDeleteState = () => {
    setShowDeleteModal(false);
    setShowAdminPasswordModal(false);
    setAdminPasswordForDelete("");
    setCurrentGrupo(null);
  };

  const handleDelete = (grupo) => {
    setCurrentGrupo(grupo);
    setAdminPasswordForDelete("");
    if (grupoFamiliarDeleteRequiereAdmin(grupo)) {
      setShowAdminPasswordModal(true);
      return;
    }
    setShowDeleteModal(true);
  };

  const handleAdminPasswordSuccess = (password) => {
    setAdminPasswordForDelete(password);
    setShowAdminPasswordModal(false);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!currentGrupo) return;

    const requiereAdmin = grupoFamiliarDeleteRequiereAdmin(currentGrupo);
    if (requiereAdmin && !adminPasswordForDelete) {
      setShowDeleteModal(false);
      setShowAdminPasswordModal(true);
      return;
    }

    setDeleteLoading(true);
    try {
      const id = currentGrupo.id;
      const body = requiereAdmin
        ? { admin_password: adminPasswordForDelete }
        : null;
      await apiRequest(`grupo_familiar/${id}`, "DELETE", body);
      await fetchGrupos();
      resetDeleteState();
      alert("Grupo familiar eliminado correctamente");
    } catch (error) {
      console.error("Error al eliminar grupo familiar:", error);
      alert(
        error?.message ||
          "No se pudo eliminar el grupo familiar. Por favor, inténtelo de nuevo."
      );
    } finally {
      setDeleteLoading(false);
    }
  };


  const getProductoNombre = (grupo) =>
    ordenarEtiquetasProductoListado(grupo.producto || "-");

  const getCompaniaNombre = (grupo) => grupo.compania_nombre || "-";

  const renderPersonasCP = (grupo) => {
    const { privadas, label } = personasPrivadasParaListado(grupo);
    return (
      <span title={`Coberturas privadas: ${privadas}`} className="gf-listado__cp">
        {label}
      </span>
    );
  };

  const renderPersonasSD = (grupo) => {
    const { salud, dental, label } = personasSaludDentalParaListado(grupo);
    return (
      <span title={`Salud MS: ${salud} · Dental MS: ${dental}`} className="gf-listado__sd">
        {label}
      </span>
    );
  };

  const renderPersonasTaxes = (grupo) => {
    const { taxes, label } = personasTaxesParaListado(grupo);
    return (
      <span title={`Personas en taxes: ${taxes}`} className="gf-listado__taxes">
        {label}
      </span>
    );
  };

  const getTomadorNombre = (grupo) => grupo.tomador_nombre || "Sin asignar";

  const totalFiltered = paginationMeta.total ?? 0;
  const totalPages = Math.max(1, paginationMeta.last_page ?? 1);
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const rangeStart = totalFiltered === 0 ? 0 : (safeCurrentPage - 1) * ITEMS_PER_PAGE + 1;
  const rangeEnd = Math.min(safeCurrentPage * ITEMS_PER_PAGE, totalFiltered);

  // Función para obtener el color de la insignia según el estado
  const getBadgeVariant = (estado) => {
    if (!estado) return "secondary";

    switch (estado.toLowerCase()) {
      case "activo":
        return "success";
      case "inactivo":
        return "danger";
      case "pendiente":
        return "warning";
      default:
        return "secondary";
    }
  };

  // Función para verificar si una cobertura es de un tomador
  const isTomador = (parentesco) => {
    return parentesco && parentesco.toUpperCase() === "TOMADOR";
  };

  return (
    <Container fluid className="gf-listado-container py-3">
      <Helmet>
        <title>Vantun/List Grupo Familiar</title>
      </Helmet>

      <div className="gf-listado">
        <div className="gf-listado__header">
          <div className="gf-listado__header-icon" aria-hidden="true">
            <FaUsers />
          </div>
          <div>
            <h1 className="gf-listado__title">Grupos Familiares</h1>
            <p className="gf-listado__subtitle">
              Gestión y administración de grupos familiares asegurados en su cartera de seguros.
            </p>
          </div>
        </div>

        <div className="gf-listado__body">
          <div className="gf-listado__section">
            <div className="gf-listado__section-title">
              <FaChartBar />
              Resumen por estado
            </div>
            <ResumenGruposEstados
              onEstadoClick={handleEstadoClickFromResumen}
              estadoSeleccionado={selectedStatus}
            />
          </div>

          <div className="gf-listado__section gf-listado__section--table">
            <div className="gf-listado__section-title">
              <FaFilter />
              Búsqueda y resultados
            </div>

            <div className="d-flex flex-column flex-md-row gap-3 mb-3 align-items-md-end">
              <div className="flex-grow-1">
                <div className="gf-listado__label">Buscar</div>
                <InputGroup>
                  <Form.Control
                    placeholder="Buscar por ID, tomador o persona de contacto..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <Button variant="outline-secondary" className="gf-listado__btn-icon">
                    <FaSearch />
                  </Button>
                </InputGroup>
              </div>
              <div style={{ minWidth: "200px" }}>
                <div className="gf-listado__label">Estado</div>
                <Form.Select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                >
                  <option value="Todos los estados">Todos los estados</option>
                  <option value="prospecto">Prospecto</option>
                  <option value="cotizacion">Cotización</option>
                  <option value="seguimiento">Seguimiento</option>
                  <option value="toma_datos">Toma de Datos</option>
                  <option value="inscripcion_ini">Inscripción / Confirmación</option>
                  <option value="grupo_familiar_activo">Grupo Familiar (activos)</option>
                  <option value="grupo_familiar_inactivo">Grupo Familiar (inactivos)</option>
                  <option value="grupo_familiar">Grupo Familiar (todos)</option>
                  <option value="descartado">Descartado</option>
                </Form.Select>
              </div>
              <div style={{ minWidth: "140px" }}>
                <div className="gf-listado__label">Año del plan</div>
                <Form.Select
                  value={anioSeleccionado}
                  onChange={(e) => handleAnioChange(e.target.value)}
                  aria-label="Año del plan"
                >
                  {aniosDisponibles.map((year) => (
                    <option key={year} value={year}>
                      {year}
                      {etiquetaAnio(year)}
                    </option>
                  ))}
                </Form.Select>
              </div>
              <div style={{ minWidth: "200px" }}>
                <div className="gf-listado__label">Producto</div>
                <Form.Select
                  value={selectedProducto}
                  onChange={(e) => handleProductoChange(e.target.value)}
                  aria-label="Filtrar por producto"
                >
                  {FILTRO_PRODUCTO_LISTADO_OPCIONES.map((opcion) => (
                    <option key={opcion.value} value={opcion.value}>
                      {opcion.label}
                    </option>
                  ))}
                </Form.Select>
              </div>
              <div>
                <Button variant="outline-secondary" className="gf-listado__btn-icon">
                  <FaFilter className="me-2" />
                  Filtros
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-5">
                <div className="spinner-border" style={{ color: "#1a365d" }} role="status">
                  <span className="visually-hidden">Cargando...</span>
                </div>
                <p className="mt-3 text-muted small mb-0">Cargando grupos familiares...</p>
              </div>
            ) : (
              <>
                {grupos.length === 0 ? (
                  <div className="gf-listado__empty">
                    No se encontraron grupos familiares
                  </div>
                ) : (
                  <>
                    <div className="d-flex justify-content-between align-items-center gf-listado__summary">
                      <span>
                        Mostrando <strong>{rangeStart}</strong>–<strong>{rangeEnd}</strong> de{" "}
                        <strong>{totalFiltered}</strong> grupo
                        {totalFiltered !== 1 ? "s" : ""}
                      </span>
                      {totalPages > 1 && (
                        <span>
                          Página {safeCurrentPage} de {totalPages}
                        </span>
                      )}
                    </div>
                    <div className="gf-listado__table-wrap table-responsive">
                      <Table hover className="align-middle gf-listado__table">
                        <thead>
                          <tr>
                            <th style={{ width: "2.5rem" }} aria-label="Expandir" />
                            <th>ID GF</th>
                            <th>Tomador</th>
                            <th title="Coberturas privadas activas (Vision, Plan Dental, etc.)">C.Privado</th>
                            <th title="Miembros activos Salud MS / Dental MS">Salud/Dental Ms</th>
                            <th>P. Taxes</th>
                            <th>Aseguradora</th>
                            <th>Proceso</th>
                            <th>Producto</th>
                            <th>Responsable</th>
                            <th className="text-center">Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {grupos.map((grupo) => {
                            const estaExpandido = gruposExpandidos.has(grupo.id);
                            return (
                              <Fragment key={grupo.id}>
                                <tr
                                  className={estaExpandido ? "table-active" : undefined}
                                  style={{ cursor: "pointer" }}
                                  onClick={() => toggleGrupoExpandido(grupo.id)}
                                >
                                  <td className="text-muted">
                                    {estaExpandido ? <FaChevronUp /> : <FaChevronDown />}
                                  </td>
                                  <td>
                                    {grupo.id ? (
                                      <Link
                                        to={buildDetallePath(grupo.id)}
                                        className="text-decoration-none"
                                        title="Ver detalle del grupo"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {grupo.id}
                                      </Link>
                                    ) : (
                                      "Sin asignar"
                                    )}
                                  </td>
                                  <td>{getTomadorNombre(grupo)}</td>
                                  <td>{renderPersonasCP(grupo)}</td>
                                  <td>{renderPersonasSD(grupo)}</td>
                                  <td>{renderPersonasTaxes(grupo)}</td>
                                  <td>{getCompaniaNombre(grupo)}</td>
                                  <td>
                                    {grupo.id ? (
                                      <Link
                                        to={buildDetallePath(grupo.id)}
                                        className="text-decoration-none fw-bold"
                                        title="Ver detalle del grupo"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {getGrupoEstado(grupo).estado}
                                      </Link>
                                    ) : (
                                      <span className="fw-bold">
                                        {getGrupoEstado(grupo).estado}
                                      </span>
                                    )}
                                  </td>
                                  <td>
                                    <span className="gf-listado__producto">
                                      {getProductoNombre(grupo)}
                                    </span>
                                  </td>
                                  <td>
                                    <Badge pill className="gf-listado__badge-responsable">
                                      {grupo.responsable || "Sin responsable"}
                                    </Badge>
                                  </td>
                                  <td>
                                    <div className="d-flex justify-content-center gap-2 gf-listado__actions">
                                      {false && (
                                        <Button
                                          variant="outline-primary"
                                          size="sm"
                                          onClick={() => handleOpenViewModal(grupo)}
                                          title="Ver detalles"
                                        >
                                          <FaEye />
                                        </Button>
                                      )}
                                      {false && (
                                        <Button
                                          variant="outline-success"
                                          size="sm"
                                          onClick={() => handleOpenEditModal(grupo)}
                                          title="Editar grupo familiar"
                                        >
                                          <FaEdit />
                                        </Button>
                                      )}
                                      <Button
                                        variant="outline-danger"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDelete(grupo);
                                        }}
                                        title="Eliminar grupo familiar"
                                      >
                                        <FaTrashAlt />
                                      </Button>
                                      <Button
                                        variant="outline-secondary"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setGrupoFamiliarId(grupo.id);
                                          setShowDocumentosModal(true);
                                        }}
                                      >
                                        <FaFile />
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                                {estaExpandido && (
                                  <tr className="grupo-listado-acordeon-detalle">
                                    <td colSpan={11} className="bg-white border-bottom p-3">
                                      <GrupoFamiliarClasificadoDetalle
                                        grupoId={grupo.id}
                                        anio={
                                          anioSeleccionado !== ANIO_ACTUAL
                                            ? anioSeleccionado
                                            : null
                                        }
                                        detallePath={buildDetallePath(grupo.id)}
                                      />
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            );
                          })}
                        </tbody>
                      </Table>
                    </div>
                    <div className="d-flex justify-content-center mt-4">
                      <Pagination
                        currentPage={safeCurrentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                        disabled={loading}
                      />
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <SuperAdminPasswordModal
        show={showAdminPasswordModal}
        onHide={() => {
          setShowAdminPasswordModal(false);
          setAdminPasswordForDelete("");
          setCurrentGrupo(null);
        }}
        onSuccess={handleAdminPasswordSuccess}
        title="Clave requerida para eliminar"
        message={
          `El grupo familiar ${currentGrupo?.persona_contacto || `ID: ${currentGrupo?.id}`} ` +
          "está en estado Terminado o Descartado. Para eliminarlo debe ingresar la contraseña del super administrador."
        }
      />

      {/* Modal de Confirmación para Eliminar */}
      <Modal show={showDeleteModal} onHide={resetDeleteState} backdrop="static" centered>
        <Modal.Header closeButton>
          <Modal.Title>Confirmar eliminación</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>¿Está seguro que desea eliminar el grupo familiar {currentGrupo?.persona_contacto || `ID: ${currentGrupo?.id}`}?</p>
          <p className="text-danger mb-0">
            <strong>Advertencia:</strong> Esta acción eliminará también todas las coberturas y datos relacionados.
          </p>
          {grupoFamiliarDeleteRequiereAdmin(currentGrupo) && (
            <p className="text-warning mt-2 mb-0 small">
              Se verificó la clave del super administrador para este grupo en estado protegido.
            </p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={resetDeleteState} disabled={deleteLoading}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={confirmDelete} disabled={deleteLoading}>
            {deleteLoading ? "Eliminando..." : "Eliminar"}
          </Button>
        </Modal.Footer>
      </Modal>

      <GrupoFamiliarDetalleModal
        show={showViewModal}
        onHide={() => setShowViewModal(false)}
        grupo={currentGrupo}
        getTomadorNombre={getTomadorNombre}
      />

      <RetiroCancelacionModal
        show={showRetiroModal}
        onHide={() => setShowRetiroModal(false)}
        grupoFamiliar={grupoParaRetiro}
        onSave={() => {
          fetchGrupos();
          setShowRetiroModal(false);
        }}
      />
      <RequerimientosModal
        show={showDocumentosModal}
        onHide={() => setShowDocumentosModal(false)}
        grupoFamiliarId={grupoFamiliarId} // Pasar el ID del grupo familiar
      />
    </Container>
  );
};

// Agregamos estilos CSS personalizados para el modal más amplio
const styles = `
  .modal-90w {
    max-width: 90%;
    width: 90%;
  }
`;

// Agrega los estilos al documento
const styleSheet = document.createElement("style");
styleSheet.type = "text/css";
styleSheet.innerText = styles;
document.head.appendChild(styleSheet);
export default GruposFamiliaresListado;
