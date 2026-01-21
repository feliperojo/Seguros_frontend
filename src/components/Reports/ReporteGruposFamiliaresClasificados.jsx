import React, { useState, useEffect, useMemo } from "react";
import {
  Container,
  Card,
  Table,
  Badge,
  Button,
  Form,
  InputGroup,
  Row,
  Col,
  Spinner,
  Alert
} from "react-bootstrap";
import {
  FaSearch,
  FaFileExport,
  FaChevronDown,
  FaChevronUp,
  FaUsers,
  FaCheckCircle,
  FaTimesCircle,
  FaUserSlash,
  FaExclamationTriangle
} from "react-icons/fa";
import apiRequest from "../../services/api";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { SUGGESTED_TAGS } from "../../utils/tagsCatalog";

/**
 * Utilidad para verificar si una fecha está vacía o no válida
 */
const fechaVacia = (fecha) => {
  if (!fecha) return true;
  if (typeof fecha === "string" && fecha.trim() === "") return true;
  return false;
};

/**
 * Utilidad para clasificar el estado de un miembro
 */
const clasificarEstadoMiembro = (cobertura) => {
  const estadoCobertura = cobertura.estado_cobertura || "";
  const estadoCoberturaUpper = estadoCobertura.toUpperCase();
  const activo = cobertura.activo !== undefined ? cobertura.activo : true;
  const fechaCancelacion = cobertura.fecha_cancelacion;
  const fechaRetiro = cobertura.fecha_retiro;

  // Retirado (tiene fecha de retiro válida)
  if (!fechaVacia(fechaRetiro)) {
    return {
      categoria: "retirados",
      label: "Retirado",
      variant: "secondary",
      icon: FaUserSlash
    };
  }

  // Cancelado (tiene fecha de cancelación válida)
  if (!fechaVacia(fechaCancelacion)) {
    return {
      categoria: "cancelados",
      label: "Cancelado",
      variant: "danger",
      icon: FaTimesCircle
    };
  }

  // Activo con cobertura
  // Considera "Yes", "YES", "Sí", "SÍ" como estados activos
  const esActivo = estadoCoberturaUpper === "YES" || 
                   estadoCobertura === "Yes" || 
                   estadoCoberturaUpper === "SÍ" ||
                   estadoCobertura === "Sí";
  
  // Verificar que no tenga fechas de cancelación o retiro
  const sinFechasInvalidas = fechaVacia(fechaCancelacion) && fechaVacia(fechaRetiro);
  
  if (esActivo && activo && sinFechasInvalidas) {
    return {
      categoria: "activos_con_cobertura",
      label: "Activo con Cobertura",
      variant: "success",
      icon: FaCheckCircle
    };
  }

  // Sin cobertura
  if (estadoCoberturaUpper === "NO" || 
      estadoCobertura === "No" || 
      !estadoCobertura || 
      estadoCobertura.trim() === "") {
    return {
      categoria: "sin_cobertura",
      label: "Sin Cobertura",
      variant: "warning",
      icon: FaExclamationTriangle
    };
  }

  // Otros estados (MEDICARE, MEDICAID, etc.)
  return {
    categoria: "otros_estados",
    label: estadoCobertura || "Sin definir",
    variant: "info",
    icon: FaUsers
  };
};

/**
 * Componente principal del reporte
 */
const ReporteGruposFamiliaresClasificados = () => {
  const [grupos, setGrupos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [gruposExpandidos, setGruposExpandidos] = useState(new Set());
  const [filtroEstado, setFiltroEstado] = useState("todos");

  // Cargar grupos familiares
  useEffect(() => {
    const fetchGrupos = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await apiRequest("grupo_familiar/grupos-familiares-full", "GET");
        
        if (response?.status === "success" && Array.isArray(response.data)) {
          setGrupos(response.data);
        } else {
          setGrupos([]);
        }
      } catch (err) {
        console.error("Error al cargar grupos familiares:", err);
        setError("Error al cargar los grupos familiares. Por favor, intente nuevamente.");
        setGrupos([]);
      } finally {
        setLoading(false);
      }
    };

    fetchGrupos();
  }, []);

  /**
   * Procesa y clasifica los miembros de cada grupo
   */
  const gruposClasificados = useMemo(() => {
    return grupos.map((grupo) => {
      const coberturas = grupo.coberturas || [];
      
      // Clasificar cada cobertura/miembro
      const miembrosClasificados = coberturas.map((cobertura) => {
        // Debug: log para ver los valores reales
        if (cobertura.estado_cobertura === "Yes" || cobertura.estado_cobertura === "YES") {
          console.log("🔍 Cobertura activa encontrada:", {
            id: cobertura.id,
            estado_cobertura: cobertura.estado_cobertura,
            activo: cobertura.activo,
            fecha_cancelacion: cobertura.fecha_cancelacion,
            fecha_retiro: cobertura.fecha_retiro
          });
        }
        
        const estado = clasificarEstadoMiembro(cobertura);
        return {
          ...cobertura,
          estadoClasificado: estado
        };
      });

      // Agrupar por categoría
      const porCategoria = {
        activos_con_cobertura: miembrosClasificados.filter(m => m.estadoClasificado.categoria === "activos_con_cobertura"),
        cancelados: miembrosClasificados.filter(m => m.estadoClasificado.categoria === "cancelados"),
        retirados: miembrosClasificados.filter(m => m.estadoClasificado.categoria === "retirados"),
        sin_cobertura: miembrosClasificados.filter(m => m.estadoClasificado.categoria === "sin_cobertura"),
        otros_estados: miembrosClasificados.filter(m => m.estadoClasificado.categoria === "otros_estados")
      };

      // Estadísticas
      const estadisticas = {
        total: miembrosClasificados.length,
        activos_con_cobertura: porCategoria.activos_con_cobertura.length,
        cancelados: porCategoria.cancelados.length,
        retirados: porCategoria.retirados.length,
        sin_cobertura: porCategoria.sin_cobertura.length,
        otros_estados: porCategoria.otros_estados.length
      };

      return {
        ...grupo,
        miembrosClasificados,
        porCategoria,
        estadisticas
      };
    });
  }, [grupos]);

  /**
   * Filtrar grupos según búsqueda y filtro de estado
   */
  const gruposFiltrados = useMemo(() => {
    let filtrados = gruposClasificados;

    // Filtro por término de búsqueda
    if (searchTerm) {
      const termino = searchTerm.toLowerCase();
      filtrados = filtrados.filter((grupo) => {
        const id = grupo.id?.toString() || "";
        const personaContacto = (grupo.persona_contacto || "").toLowerCase();
        const tomador = grupo.coberturas
          ?.find(c => c.parentesco?.toUpperCase() === "TOMADOR")
          ?.cliente?.nombre_completo?.toLowerCase() || "";
        
        return (
          id.includes(termino) ||
          personaContacto.includes(termino) ||
          tomador.includes(termino)
        );
      });
    }

    // Filtro por estado
    if (filtroEstado !== "todos") {
      filtrados = filtrados.filter((grupo) => {
        return grupo.estadisticas[filtroEstado] > 0;
      });
    }

    return filtrados;
  }, [gruposClasificados, searchTerm, filtroEstado]);

  /**
   * Obtener nombre del tomador
   */
  const getTomadorNombre = (grupo) => {
    const tomador = grupo.coberturas?.find(
      c => c.parentesco?.toUpperCase() === "TOMADOR"
    );
    return tomador?.cliente?.nombre_completo || "Sin asignar";
  };

  /**
   * Formatear fecha
   */
  const formatDate = (dateString) => {
    if (!dateString) return "-";
    try {
      return new Date(dateString).toLocaleDateString("es-ES");
    } catch {
      return "-";
    }
  };

  /**
   * Formatear moneda
   */
  const formatCurrency = (amount) => {
    if (!amount) return "$0.00";
    return new Intl.NumberFormat("es-US", {
      style: "currency",
      currency: "USD"
    }).format(parseFloat(amount));
  };

  /**
   * Normalizar un label para búsqueda
   */
  const normalizeLabelForSearch = (label) => {
    if (!label) return "";
    return label
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");
  };

  /**
   * Obtener el color de una etiqueta desde el catálogo
   * Esta función solo se usa cuando la etiqueta NO tiene color guardado
   */
  const getTagColorFromCatalog = (tag) => {
    // PRIORIDAD 1: Buscar en el catálogo por key exacto
    if (tag.key) {
      const catalogTagByKey = SUGGESTED_TAGS.find(st => st.key === tag.key);
      if (catalogTagByKey && catalogTagByKey.color) {
        return catalogTagByKey.color;
      }
    }
    
    // PRIORIDAD 2: Buscar por label exacto (case insensitive, sin espacios extra)
    if (tag.label) {
      const tagLabelNormalized = tag.label.trim().toUpperCase();
      const catalogTagExact = SUGGESTED_TAGS.find(st => 
        st.label.trim().toUpperCase() === tagLabelNormalized
      );
      if (catalogTagExact && catalogTagExact.color) {
        return catalogTagExact.color;
      }
    }
    
    // PRIORIDAD 3: Buscar en el catálogo por label normalizado (sin acentos, sin espacios)
    if (tag.label) {
      const normalizedLabel = normalizeLabelForSearch(tag.label);
      const catalogTagByLabel = SUGGESTED_TAGS.find(st => {
        const normalizedCatalogLabel = normalizeLabelForSearch(st.label);
        return normalizedCatalogLabel === normalizedLabel;
      });
      if (catalogTagByLabel && catalogTagByLabel.color) {
        return catalogTagByLabel.color;
      }
    }
    
    // PRIORIDAD 4: Buscar por key generado desde el label
    if (tag.label) {
      const generatedKey = normalizeLabelForSearch(tag.label);
      const catalogTagByGeneratedKey = SUGGESTED_TAGS.find(st => st.key === generatedKey);
      if (catalogTagByGeneratedKey && catalogTagByGeneratedKey.color) {
        return catalogTagByGeneratedKey.color;
      }
    }
    
    // PRIORIDAD 5: Color por defecto
    return "#6c757d";
  };

  /**
   * Calcular el color del texto basado en el brillo del fondo
   */
  const getTextColor = (bgColor) => {
    if (!bgColor) return "#FFFFFF";
    
    const hex = bgColor.replace('#', '');
    const r = parseInt(hex.length === 3 ? hex[0] + hex[0] : hex.substring(0, 2), 16);
    const g = parseInt(hex.length === 3 ? hex[1] + hex[1] : hex.substring(2, 4), 16);
    const b = parseInt(hex.length === 3 ? hex[2] + hex[2] : hex.substring(4, 6), 16);
    
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 128 ? "#000000" : "#FFFFFF";
  };

  /**
   * Obtener las etiquetas de un grupo
   */
  const getTags = (grupo) => {
    try {
      const tagsRaw = grupo.tags || grupo.etiquetas;
      
      if (!tagsRaw) return [];
      
      let tagsArray = [];
      
      if (Array.isArray(tagsRaw)) {
        tagsArray = tagsRaw;
      } else if (typeof tagsRaw === "string" && tagsRaw.trim()) {
        try {
          const parsed = JSON.parse(tagsRaw);
          if (Array.isArray(parsed)) {
            tagsArray = parsed;
          }
        } catch (e) {
          console.warn("Error al parsear tags como JSON:", e);
        }
      }
      
      const tagsValidas = tagsArray
        .filter(tag => {
          return (
            tag &&
            typeof tag === "object" &&
            (tag.key || tag.label)
          );
        })
        .map(tag => {
          // Generar key si no existe
          const tagKey = tag.key || normalizeLabelForSearch(tag.label);
          
          // Debug: ver qué datos tiene el tag
          console.log("🏷️ [Reporte] Procesando tag:", {
            key: tag.key,
            label: tag.label,
            color: tag.color,
            tagCompleto: tag
          });
          
          // Obtener el color: primero del tag guardado, luego del catálogo
          let finalColor = null;
          
          // 1. PRIORIDAD MÁXIMA: Si tiene color guardado y es válido, usarlo
          if (tag.color) {
            const colorStr = String(tag.color).trim();
            // Verificar si es un color hex válido
            if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(colorStr)) {
              finalColor = colorStr;
              console.log("✅ [Reporte] Usando color guardado (con #):", tag.label, "->", finalColor);
            } else if (/^([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(colorStr)) {
              // Si no tiene #, agregarlo
              finalColor = `#${colorStr}`;
              console.log("✅ [Reporte] Usando color guardado (sin #, agregado):", tag.label, "->", finalColor);
            } else {
              console.log("⚠️ [Reporte] Color guardado no válido:", tag.label, "color:", tag.color);
            }
          }
          
          // 2. Si no tiene color guardado válido, buscar en el catálogo
          if (!finalColor) {
            finalColor = getTagColorFromCatalog(tag);
            console.log("🔍 [Reporte] Color del catálogo para tag:", tag.label, "key:", tagKey, "->", finalColor);
          }
          
          return {
            key: tagKey,
            label: tag.label || tag.key || tagKey,
            color: finalColor || "#6c757d" // Fallback final
          };
        });
      
      return tagsValidas;
    } catch (error) {
      console.error("❌ Error al procesar tags:", error);
      return [];
    }
  };

  /**
   * Toggle para expandir/colapsar grupo
   */
  const toggleGrupo = (grupoId) => {
    setGruposExpandidos(prev => {
      const nuevo = new Set(prev);
      if (nuevo.has(grupoId)) {
        nuevo.delete(grupoId);
      } else {
        nuevo.add(grupoId);
      }
      return nuevo;
    });
  };

  /**
   * Renderizar sección de miembros por categoría
   */
  const renderCategoriaMiembros = (categoria, miembros, grupoId) => {
    if (miembros.length === 0) return null;

    const estadoInfo = miembros[0]?.estadoClasificado;
    const Icon = estadoInfo?.icon || FaUsers;

    return (
      <Card key={categoria} className="mb-3 border-start border-4" style={{
        borderLeftColor: estadoInfo?.variant === "success" ? "#198754" :
                        estadoInfo?.variant === "danger" ? "#dc3545" :
                        estadoInfo?.variant === "warning" ? "#ffc107" :
                        estadoInfo?.variant === "secondary" ? "#6c757d" : "#0dcaf0"
      }}>
        <Card.Header className="d-flex align-items-center justify-content-between bg-light">
          <div className="d-flex align-items-center gap-2">
            <Icon className={`text-${estadoInfo?.variant || "info"}`} />
            <strong>{estadoInfo?.label || categoria}</strong>
            <Badge bg={estadoInfo?.variant || "info"} className="ms-2">
              {miembros.length}
            </Badge>
          </div>
        </Card.Header>
        <Card.Body>
          <Table responsive hover size="sm">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Parentesco</th>
                <th>Estado Cobertura</th>
                <th>Compañía</th>
                <th>Plan</th>
                <th>Precio</th>
                <th>Fechas</th>
              </tr>
            </thead>
            <tbody>
              {miembros.map((miembro, idx) => (
                <tr key={miembro.id || idx}>
                  <td>
                    <Link
                      to={`/clientes/${miembro.cliente_id}/ficha`}
                      className="text-decoration-none"
                    >
                      {miembro.cliente?.nombre_completo || "Sin nombre"}
                    </Link>
                    {miembro.parentesco?.toUpperCase() === "TOMADOR" && (
                      <Badge bg="warning" text="dark" className="ms-2">
                        TOMADOR
                      </Badge>
                    )}
                  </td>
                  <td>{miembro.parentesco || "-"}</td>
                  <td>
                    <Badge bg={miembro.estadoClasificado.variant}>
                      {miembro.estado_cobertura || "Sin definir"}
                    </Badge>
                  </td>
                  <td>{miembro.compania?.nombre || "-"}</td>
                  <td>{miembro.plan || "-"}</td>
                  <td>{formatCurrency(miembro.precio)}</td>
                  <td>
                    <small className="d-block">
                      <strong>Act:</strong> {formatDate(miembro.fecha_activacion)}
                    </small>
                    {miembro.fecha_cancelacion && (
                      <small className="d-block text-danger">
                        <strong>Can:</strong> {formatDate(miembro.fecha_cancelacion)}
                      </small>
                    )}
                    {miembro.fecha_retiro && (
                      <small className="d-block text-secondary">
                        <strong>Ret:</strong> {formatDate(miembro.fecha_retiro)}
                      </small>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card.Body>
      </Card>
    );
  };

  if (loading) {
    return (
      <Container fluid className="py-4">
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />
          <p className="mt-3">Cargando grupos familiares...</p>
        </div>
      </Container>
    );
  }

  if (error) {
    return (
      <Container fluid className="py-4">
        <Alert variant="danger">{error}</Alert>
      </Container>
    );
  }

  return (
    <Container fluid className="py-4">
      <Helmet>
        <title>Vantun/Reporte Grupos Familiares Clasificados</title>
      </Helmet>

      {/* Encabezado */}
      <div className="mb-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div>
            <h3 className="mb-2 fw-bold text-dark">Reporte de Grupos Familiares Clasificados</h3>
            <p className="text-muted mb-0">
              Vista detallada de grupos familiares y sus miembros clasificados por estado de cobertura
            </p>
          </div>
          <Button variant="outline-primary" className="d-flex align-items-center gap-2">
            <FaFileExport />
            Exportar
          </Button>
        </div>

        {/* Filtros */}
        <Card className="mb-4">
          <Card.Body>
            <Row>
              <Col md={6}>
                <InputGroup>
                  <InputGroup.Text>
                    <FaSearch />
                  </InputGroup.Text>
                  <Form.Control
                    placeholder="Buscar por ID, tomador o persona de contacto..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </InputGroup>
              </Col>
              <Col md={6}>
                <Form.Select
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value)}
                >
                  <option value="todos">Todos los estados</option>
                  <option value="activos_con_cobertura">Activos con Cobertura</option>
                  <option value="cancelados">Cancelados</option>
                  <option value="retirados">Retirados</option>
                  <option value="sin_cobertura">Sin Cobertura</option>
                  <option value="otros_estados">Otros Estados</option>
                </Form.Select>
              </Col>
            </Row>
          </Card.Body>
        </Card>
      </div>

      {/* Resumen general */}
      <Card className="mb-4 bg-light">
        <Card.Body>
          <Row className="text-center">
            <Col>
              <h5 className="text-muted mb-1">Total Grupos</h5>
              <h3 className="fw-bold">{gruposFiltrados.length}</h3>
            </Col>
            <Col>
              <h5 className="text-muted mb-1">Total Miembros</h5>
              <h3 className="fw-bold">
                {gruposFiltrados.reduce((sum, g) => sum + g.estadisticas.total, 0)}
              </h3>
            </Col>
            <Col>
              <h5 className="text-success mb-1">Activos con Cobertura</h5>
              <h3 className="fw-bold text-success">
                {gruposFiltrados.reduce((sum, g) => sum + g.estadisticas.activos_con_cobertura, 0)}
              </h3>
            </Col>
            <Col>
              <h5 className="text-danger mb-1">Cancelados</h5>
              <h3 className="fw-bold text-danger">
                {gruposFiltrados.reduce((sum, g) => sum + g.estadisticas.cancelados, 0)}
              </h3>
            </Col>
            <Col>
              <h5 className="text-secondary mb-1">Retirados</h5>
              <h3 className="fw-bold text-secondary">
                {gruposFiltrados.reduce((sum, g) => sum + g.estadisticas.retirados, 0)}
              </h3>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Lista de grupos */}
      {gruposFiltrados.length === 0 ? (
        <Card>
          <Card.Body className="text-center py-5">
            <p className="text-muted mb-0">No se encontraron grupos familiares</p>
          </Card.Body>
        </Card>
      ) : (
        gruposFiltrados.map((grupo) => {
          const estaExpandido = gruposExpandidos.has(grupo.id);
          return (
            <Card key={grupo.id} className="mb-3">
              <Card.Header
                onClick={() => toggleGrupo(grupo.id)}
                style={{ cursor: "pointer" }}
                className="d-flex justify-content-between align-items-center"
              >
                <div className="d-flex align-items-center gap-3">
                  <Link
                    to={`/grupo_familiar/${grupo.id}`}
                    className="text-decoration-none fw-bold"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Grupo ID: {grupo.id}
                  </Link>
                  <Badge bg="primary">{getTomadorNombre(grupo)}</Badge>
                  <Badge bg="info">
                    {grupo.personas_cobertura || 0} en cobertura
                  </Badge>
                  <Badge bg="secondary">
                    {grupo.personas_taxes || 0} en taxes
                  </Badge>
                </div>
                <div className="d-flex align-items-center gap-2">
                  {estaExpandido ? (
                    <FaChevronUp />
                  ) : (
                    <FaChevronDown />
                  )}
                </div>
              </Card.Header>
              {estaExpandido && (
                <Card.Body>
                {/* Estadísticas del grupo */}
                <Row className="mb-4">
                  <Col md={12}>
                    <Card className="bg-light">
                      <Card.Body>
                        <Row className="text-center">
                          <Col>
                            <small className="text-muted d-block">Total Miembros</small>
                            <strong>{grupo.estadisticas.total}</strong>
                          </Col>
                          <Col>
                            <small className="text-success d-block">Activos</small>
                            <strong className="text-success">{grupo.estadisticas.activos_con_cobertura}</strong>
                          </Col>
                          <Col>
                            <small className="text-danger d-block">Cancelados</small>
                            <strong className="text-danger">{grupo.estadisticas.cancelados}</strong>
                          </Col>
                          <Col>
                            <small className="text-secondary d-block">Retirados</small>
                            <strong className="text-secondary">{grupo.estadisticas.retirados}</strong>
                          </Col>
                          <Col>
                            <small className="text-warning d-block">Sin Cobertura</small>
                            <strong className="text-warning">{grupo.estadisticas.sin_cobertura}</strong>
                          </Col>
                          <Col>
                            <small className="text-info d-block">Otros</small>
                            <strong className="text-info">{grupo.estadisticas.otros_estados}</strong>
                          </Col>
                        </Row>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>

                {/* Información general del grupo */}
                <Row className="mb-4">
                  <Col md={12}>
                    <div className="d-flex align-items-center gap-3 flex-wrap mb-2">
                      <p className="mb-0">
                        <strong>Responsable:</strong> 
                        <Badge bg="primary" className="ms-2">
                          {grupo.responsable || "Sin asignar"}
                        </Badge>
                      </p>
                      <p className="mb-0">
                        <strong>Estado:</strong> 
                        <Badge bg="info" className="ms-2">
                          {grupo.estado_actual_catalogo?.estado_nombre || grupo.estado || "Sin estado"}
                        </Badge>
                      </p>
                    </div>
                    {/* Etiquetas */}
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                      <strong className="me-2">Etiquetas:</strong>
                      {(() => {
                        const tags = getTags(grupo);
                        return tags.length > 0 ? (
                          tags.map((tag, index) => {
                            const tagColor = tag.color || "#6c757d";
                            return (
                              <Badge
                                key={tag.key || index}
                                style={{
                                  backgroundColor: tagColor,
                                  color: getTextColor(tagColor),
                                  padding: "0.35em 0.65em",
                                  border: "none"
                                }}
                              >
                                {tag.label}
                              </Badge>
                            );
                          })
                        ) : (
                          <span className="text-muted small">Sin etiquetas</span>
                        );
                      })()}
                    </div>
                  </Col>
                </Row>

                {/* Miembros clasificados por categoría */}
                <div>
                  {renderCategoriaMiembros(
                    "activos_con_cobertura",
                    grupo.porCategoria.activos_con_cobertura,
                    grupo.id
                  )}
                  {renderCategoriaMiembros(
                    "cancelados",
                    grupo.porCategoria.cancelados,
                    grupo.id
                  )}
                  {renderCategoriaMiembros(
                    "retirados",
                    grupo.porCategoria.retirados,
                    grupo.id
                  )}
                  {renderCategoriaMiembros(
                    "sin_cobertura",
                    grupo.porCategoria.sin_cobertura,
                    grupo.id
                  )}
                  {renderCategoriaMiembros(
                    "otros_estados",
                    grupo.porCategoria.otros_estados,
                    grupo.id
                  )}
                </div>
                </Card.Body>
              )}
            </Card>
          );
        })
      )}
    </Container>
  );
};

export default ReporteGruposFamiliaresClasificados;

