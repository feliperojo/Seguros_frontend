import React, { useState, useEffect, useMemo } from "react";
import {
  Container,
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
  FaExclamationTriangle,
  FaChartBar,
} from "react-icons/fa";
import apiRequest from "../../services/api";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { SUGGESTED_TAGS } from "../../utils/tagsCatalog";
import { esGrupoEnFlujoCotizacion } from "../../constants/estadosGrupoFamiliar";
import "../../styles/ReporteGruposFamiliaresClasificados.css";

/**
 * Utilidad para verificar si una fecha está vacía o no válida
 */
const fechaVacia = (fecha) => {
  if (!fecha) return true;
  if (typeof fecha === "string" && fecha.trim() === "") return true;
  return false;
};

const esEstadoCoberturaSi = (estadoCobertura) => {
  const upper = String(estadoCobertura || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return upper === "SI" || upper === "YES";
};

const esVigenteTrue = (cobertura) => {
  if (cobertura.vigente === undefined || cobertura.vigente === null) {
    return true; // compatibilidad si el API aún no envía vigente
  }
  return (
    cobertura.vigente === true ||
    cobertura.vigente === 1 ||
    cobertura.vigente === "1" ||
    cobertura.vigente === "true"
  );
};

const esActivoTrue = (cobertura) => {
  if (cobertura.activo === undefined || cobertura.activo === null) {
    return true;
  }
  return (
    cobertura.activo === true ||
    cobertura.activo === 1 ||
    cobertura.activo === "1" ||
    cobertura.activo === "true"
  );
};

/**
 * Clasifica un miembro alineado al panel:
 * - Activos reales: Sí + activo + vigente, fuera de cotización y sin fechas de baja.
 * - Cotización: misma cobertura “Sí” pero el GF aún está en estados 1–4.
 */
const clasificarEstadoMiembro = (cobertura, grupo = {}) => {
  const estadoCobertura = cobertura.estado_cobertura || "";
  const estadoCoberturaUpper = estadoCobertura.toUpperCase();
  const fechaCancelacion = cobertura.fecha_cancelacion;
  const fechaRetiro = cobertura.fecha_retiro;
  const enCotizacion = esGrupoEnFlujoCotizacion(
    grupo.estado_codigo ?? grupo.estado_id ?? grupo.estado
  );

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

  const sinFechasInvalidas = fechaVacia(fechaCancelacion) && fechaVacia(fechaRetiro);
  const pareceActiva =
    esEstadoCoberturaSi(estadoCobertura) &&
    esActivoTrue(cobertura) &&
    esVigenteTrue(cobertura) &&
    sinFechasInvalidas;

  if (pareceActiva && enCotizacion) {
    return {
      categoria: "cotizacion",
      label: "Cotización",
      variant: "warning",
      icon: FaExclamationTriangle
    };
  }

  if (pareceActiva) {
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
 * Obtener tipo(s) de producto únicos de un grupo (cobertura_tipo)
 */
const getCoberturaTiposGrupo = (grupo) => {
  const tipos = [
    ...new Set(
      (grupo.coberturas || [])
        .map((c) => (c.cobertura_tipo || "").trim())
        .filter(Boolean)
    ),
  ];
  return tipos;
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
  const [filtroCoberturaTipo, setFiltroCoberturaTipo] = useState("todos");

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
        const estado = clasificarEstadoMiembro(cobertura, grupo);
        return {
          ...cobertura,
          estadoClasificado: estado
        };
      });

      // Agrupar por categoría
      const porCategoria = {
        activos_con_cobertura: miembrosClasificados.filter(m => m.estadoClasificado.categoria === "activos_con_cobertura"),
        cotizacion: miembrosClasificados.filter(m => m.estadoClasificado.categoria === "cotizacion"),
        cancelados: miembrosClasificados.filter(m => m.estadoClasificado.categoria === "cancelados"),
        retirados: miembrosClasificados.filter(m => m.estadoClasificado.categoria === "retirados"),
        sin_cobertura: miembrosClasificados.filter(m => m.estadoClasificado.categoria === "sin_cobertura"),
        otros_estados: miembrosClasificados.filter(m => m.estadoClasificado.categoria === "otros_estados")
      };

      // Estadísticas
      const estadisticas = {
        total: miembrosClasificados.length,
        activos_con_cobertura: porCategoria.activos_con_cobertura.length,
        cotizacion: porCategoria.cotizacion.length,
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
   * Tipos de producto disponibles para el filtro (derivados de los datos cargados)
   */
  const tiposCoberturaDisponibles = useMemo(() => {
    const tipos = new Set();
    let haySinProducto = false;

    gruposClasificados.forEach((grupo) => {
      const grupoTipos = getCoberturaTiposGrupo(grupo);
      if (grupoTipos.length === 0) {
        haySinProducto = true;
      }
      grupoTipos.forEach((tipo) => tipos.add(tipo));
    });

    return {
      tipos: [...tipos].sort((a, b) => a.localeCompare(b, "es")),
      haySinProducto,
    };
  }, [gruposClasificados]);

  /**
   * Filtrar grupos según búsqueda, estado y tipo de producto
   */
  const gruposFiltrados = useMemo(() => {
    let filtrados = gruposClasificados;

    // Filtro por término de búsqueda (ID, contacto, tomador o cualquier miembro)
    if (searchTerm) {
      const termino = searchTerm
        .toLowerCase()
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

      const textoCoincide = (valor) => {
        const t = String(valor || "")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");
        return t.includes(termino);
      };

      filtrados = filtrados.filter((grupo) => {
        const id = grupo.id?.toString() || "";
        if (id.includes(termino)) return true;
        if (textoCoincide(grupo.persona_contacto)) return true;
        if (textoCoincide(grupo.responsable)) return true;

        const coberturas = grupo.coberturas || grupo.miembrosClasificados || [];
        return coberturas.some((c) => {
          const cliente = c.cliente || {};
          return (
            textoCoincide(cliente.nombre_completo) ||
            textoCoincide(
              [cliente.primer_nombre, cliente.segundo_nombre, cliente.apellidos]
                .filter(Boolean)
                .join(" ")
            )
          );
        });
      });
    }

    // Filtro por estado
    if (filtroEstado !== "todos") {
      filtrados = filtrados.filter((grupo) => {
        return grupo.estadisticas[filtroEstado] > 0;
      });
    }

    // Filtro por tipo de producto (cobertura_tipo)
    if (filtroCoberturaTipo !== "todos") {
      if (filtroCoberturaTipo === "__sin_producto__") {
        filtrados = filtrados.filter(
          (grupo) => getCoberturaTiposGrupo(grupo).length === 0
        );
      } else {
        filtrados = filtrados.filter((grupo) =>
          getCoberturaTiposGrupo(grupo).includes(filtroCoberturaTipo)
        );
      }
    }

    return filtrados;
  }, [gruposClasificados, searchTerm, filtroEstado, filtroCoberturaTipo]);

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
      <div key={categoria} className={`rgfc__categoria rgfc__categoria--${categoria}`}>
        <div className="rgfc__categoria-header">
          <Icon aria-hidden="true" />
          <strong>{estadoInfo?.label || categoria}</strong>
          <span className="rgfc__badge rgfc__badge--count">{miembros.length}</span>
        </div>
        <div className="table-responsive">
          <Table responsive hover size="sm" className="rgfc__categoria-table align-middle">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Parentesco</th>
                <th>Estado Cobertura</th>
                <th>Tipo Producto</th>
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
                      <span className="rgfc__badge rgfc__badge--tomador ms-2">TOMADOR</span>
                    )}
                  </td>
                  <td>{miembro.parentesco || "-"}</td>
                  <td>
                    <span className="rgfc__badge rgfc__badge--estado">
                      {miembro.estado_cobertura || "Sin definir"}
                    </span>
                  </td>
                  <td>{miembro.cobertura_tipo || "-"}</td>
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
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <Container fluid className="rgfc-container py-3">
        <Helmet>
          <title>Vantun/Reporte Grupos Familiares Clasificados</title>
        </Helmet>
        <div className="rgfc">
          <div className="rgfc__header">
            <div className="rgfc__header-main">
              <div className="rgfc__header-icon" aria-hidden="true">
                <FaUsers />
              </div>
              <div>
                <h1 className="rgfc__title">Reporte de Grupos Familiares Clasificados</h1>
                <p className="rgfc__subtitle">
                  Vista detallada de grupos familiares y sus miembros clasificados por estado de cobertura
                </p>
              </div>
            </div>
          </div>
          <div className="rgfc__body">
            <div className="rgfc__loading">
              <Spinner animation="border" />
              <p className="mt-3 mb-0">Cargando grupos familiares...</p>
            </div>
          </div>
        </div>
      </Container>
    );
  }

  if (error) {
    return (
      <Container fluid className="rgfc-container py-3">
        <Alert variant="danger">{error}</Alert>
      </Container>
    );
  }

  const totalMiembros = gruposFiltrados.reduce((sum, g) => sum + g.estadisticas.total, 0);
  const totalActivos = gruposFiltrados.reduce((sum, g) => sum + g.estadisticas.activos_con_cobertura, 0);
  const totalCotizacion = gruposFiltrados.reduce((sum, g) => sum + g.estadisticas.cotizacion, 0);
  const totalCancelados = gruposFiltrados.reduce((sum, g) => sum + g.estadisticas.cancelados, 0);
  const totalRetirados = gruposFiltrados.reduce((sum, g) => sum + g.estadisticas.retirados, 0);

  return (
    <Container fluid className="rgfc-container py-3">
      <Helmet>
        <title>Vantun/Reporte Grupos Familiares Clasificados</title>
      </Helmet>

      <div className="rgfc">
        <div className="rgfc__header">
          <div className="rgfc__header-main">
            <div className="rgfc__header-icon" aria-hidden="true">
              <FaUsers />
            </div>
            <div>
              <h1 className="rgfc__title">Reporte de Grupos Familiares Clasificados</h1>
              <p className="rgfc__subtitle">
                Vista detallada de grupos familiares y sus miembros clasificados por estado de cobertura
              </p>
            </div>
          </div>
          <Button className="rgfc__btn-export d-flex align-items-center gap-2">
            <FaFileExport />
            Exportar
          </Button>
        </div>

        <div className="rgfc__body">
          <div className="rgfc__section">
            <div className="rgfc__section-title">
              <FaSearch />
              Filtros
            </div>
            <Row className="g-3">
              <Col md={12} lg={5}>
                <InputGroup>
                  <InputGroup.Text>
                    <FaSearch />
                  </InputGroup.Text>
                  <Form.Control
                    placeholder="Buscar por ID, tomador, miembro o persona de contacto..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </InputGroup>
              </Col>
              <Col md={6} lg={3}>
                <Form.Select
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value)}
                  aria-label="Filtrar por estado de cobertura"
                >
                  <option value="todos">Todos los estados</option>
                  <option value="activos_con_cobertura">Activos con Cobertura</option>
                  <option value="cotizacion">Cotización</option>
                  <option value="cancelados">Cancelados</option>
                  <option value="retirados">Retirados</option>
                  <option value="sin_cobertura">Sin Cobertura</option>
                  <option value="otros_estados">Otros Estados</option>
                </Form.Select>
              </Col>
              <Col md={6} lg={4}>
                <Form.Select
                  value={filtroCoberturaTipo}
                  onChange={(e) => setFiltroCoberturaTipo(e.target.value)}
                  aria-label="Filtrar por tipo de producto"
                >
                  <option value="todos">Todos los productos</option>
                  {tiposCoberturaDisponibles.tipos.map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {tipo}
                    </option>
                  ))}
                  {tiposCoberturaDisponibles.haySinProducto && (
                    <option value="__sin_producto__">Sin producto</option>
                  )}
                </Form.Select>
              </Col>
            </Row>
          </div>

          <div className="rgfc__section">
            <div className="rgfc__section-title">
              <FaChartBar />
              Resumen
            </div>
            <div className="rgfc__kpis">
              <div className="rgfc__kpi">
                <span className="rgfc__kpi-label">Total Grupos</span>
                <span className="rgfc__kpi-value">{gruposFiltrados.length}</span>
              </div>
              <div className="rgfc__kpi">
                <span className="rgfc__kpi-label">Total Miembros</span>
                <span className="rgfc__kpi-value">{totalMiembros}</span>
              </div>
              <div className="rgfc__kpi">
                <span className="rgfc__kpi-label">Activos con Cobertura</span>
                <span className="rgfc__kpi-value">{totalActivos}</span>
              </div>
              <div className="rgfc__kpi">
                <span className="rgfc__kpi-label">Cotización</span>
                <span className="rgfc__kpi-value">{totalCotizacion}</span>
              </div>
              <div className="rgfc__kpi">
                <span className="rgfc__kpi-label">Cancelados</span>
                <span className="rgfc__kpi-value">{totalCancelados}</span>
              </div>
              <div className="rgfc__kpi">
                <span className="rgfc__kpi-label">Retirados</span>
                <span className="rgfc__kpi-value">{totalRetirados}</span>
              </div>
            </div>
          </div>

          <div className="rgfc__section" style={{ marginBottom: 0 }}>
            <div className="rgfc__section-title">
              <FaUsers />
              Grupos familiares
            </div>

            {gruposFiltrados.length === 0 ? (
              <div className="rgfc__empty">No se encontraron grupos familiares</div>
            ) : (
              <div className="rgfc__grupos">
                {gruposFiltrados.map((grupo) => {
                  const estaExpandido = gruposExpandidos.has(grupo.id);
                  const coberturaTipos = getCoberturaTiposGrupo(grupo);
                  return (
                    <div
                      key={grupo.id}
                      className={`rgfc__grupo${estaExpandido ? " is-open" : ""}`}
                    >
                      <div
                        className="rgfc__grupo-header"
                        onClick={() => toggleGrupo(grupo.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            toggleGrupo(grupo.id);
                          }
                        }}
                      >
                        <div className="rgfc__grupo-main">
                          <Link
                            to={`/grupo_familiar/${grupo.id}`}
                            className="rgfc__grupo-id"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Grupo ID: {grupo.id}
                          </Link>
                          <span className="rgfc__badge rgfc__badge--tomador">
                            {getTomadorNombre(grupo)}
                          </span>
                          {coberturaTipos.length > 0 ? (
                            coberturaTipos.map((tipo) => (
                              <span key={tipo} className="rgfc__badge rgfc__badge--producto">
                                {tipo}
                              </span>
                            ))
                          ) : (
                            <span className="rgfc__badge rgfc__badge--producto">Sin producto</span>
                          )}
                          <span className="rgfc__badge rgfc__badge--meta">
                            {grupo.personas_cobertura || 0} en cobertura
                          </span>
                          <span className="rgfc__badge rgfc__badge--meta">
                            {grupo.personas_taxes || 0} en taxes
                          </span>
                        </div>
                        <div className="rgfc__grupo-end">
                          <span className="rgfc__badge rgfc__badge--responsable">
                            {grupo.responsable || "Sin responsable"}
                          </span>
                          <span className="rgfc__grupo-chevron" aria-hidden="true">
                            {estaExpandido ? <FaChevronUp /> : <FaChevronDown />}
                          </span>
                        </div>
                      </div>

                      {estaExpandido && (
                        <div className="rgfc__grupo-body">
                          <div className="rgfc__grupo-stats">
                            <div className="rgfc__grupo-stat">
                              <span>Total Miembros</span>
                              <strong>{grupo.estadisticas.total}</strong>
                            </div>
                            <div className="rgfc__grupo-stat">
                              <span>Activos</span>
                              <strong>{grupo.estadisticas.activos_con_cobertura}</strong>
                            </div>
                            <div className="rgfc__grupo-stat">
                              <span>Cotización</span>
                              <strong>{grupo.estadisticas.cotizacion}</strong>
                            </div>
                            <div className="rgfc__grupo-stat">
                              <span>Cancelados</span>
                              <strong>{grupo.estadisticas.cancelados}</strong>
                            </div>
                            <div className="rgfc__grupo-stat">
                              <span>Retirados</span>
                              <strong>{grupo.estadisticas.retirados}</strong>
                            </div>
                            <div className="rgfc__grupo-stat">
                              <span>Sin Cobertura</span>
                              <strong>{grupo.estadisticas.sin_cobertura}</strong>
                            </div>
                            <div className="rgfc__grupo-stat">
                              <span>Otros</span>
                              <strong>{grupo.estadisticas.otros_estados}</strong>
                            </div>
                          </div>

                          <div className="rgfc__meta-row">
                            <p className="mb-0">
                              <strong>Estado:</strong>
                              <span className="rgfc__badge rgfc__badge--estado">
                                {grupo.estado_actual_catalogo?.estado_nombre ||
                                  grupo.estado ||
                                  "Sin estado"}
                              </span>
                            </p>
                          </div>

                          <div className="rgfc__tags">
                            <strong>Etiquetas:</strong>
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
                                        border: "none",
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

                          <div>
                            {renderCategoriaMiembros(
                              "activos_con_cobertura",
                              grupo.porCategoria.activos_con_cobertura,
                              grupo.id
                            )}
                            {renderCategoriaMiembros(
                              "cotizacion",
                              grupo.porCategoria.cotizacion,
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
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </Container>
  );
};

export default ReporteGruposFamiliaresClasificados;

