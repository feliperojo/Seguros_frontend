import { useState, useEffect, useMemo } from "react";
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
  Alert,
  OverlayTrigger,
  Popover,
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
import {
  esGrupoEnFlujoCotizacion,
  esGrupoFamiliarTerminado,
} from "../../constants/estadosGrupoFamiliar";
import {
  isDentalCoberturaTipo,
  isDentalMsCoberturaTipo,
  isProductoSaludMs,
} from "../../constants/coberturaTipos";
import "../../styles/ReporteGruposFamiliaresClasificados.css";

const DESCRIPCIONES_METRICAS = {
  total_grupos:
    "Cantidad de grupos familiares que coinciden con los filtros actuales.",
  total_miembros:
    "Clientes que pertenecen a un grupo familiar. Cada cliente cuenta una sola vez, aunque tenga más de una cobertura.",
  estado_coberturas_ms:
    "Coberturas de Salud MS contabilizables más Dental MS activos o con servicio, sin canceladas ni retiradas. Es la misma fórmula del Panel Principal.",
  cotizacion:
    "Coberturas activas de grupos que aún están en flujo de cotización (estados 1 a 5).",
  otras_coberturas:
    "Coberturas activas y vigentes de Vision, Plan Dental privado y Plan de Descuentos cuyo grupo ya está en Grupo Familiar (estado 6).",
  cancelados:
    "Coberturas que quedaron en estado Cancelado, con fecha de cancelación registrada.",
  retirados:
    "Coberturas que quedaron en estado Retirado o Terminado, con fecha de retiro registrada.",
};

function DatoConDescripcion({ label, valor, descripcion, variant = "kpi" }) {
  const overlay = (
    <Popover className="rgfc__dato-popover">
      <Popover.Header as="h6">{label}</Popover.Header>
      <Popover.Body>{descripcion}</Popover.Body>
    </Popover>
  );

  return (
    <OverlayTrigger
      trigger={["hover", "focus", "click"]}
      placement="top"
      overlay={overlay}
      rootClose
    >
      <div
        className={variant === "stat" ? "rgfc__grupo-stat rgfc__dato-ayuda" : "rgfc__kpi rgfc__dato-ayuda"}
        role="button"
        tabIndex={0}
        aria-label={`${label}: ${valor}. ${descripcion}`}
      >
        {variant === "stat" ? (
          <>
            <span>{label}</span>
            <strong>{valor}</strong>
          </>
        ) : (
          <>
            <span className="rgfc__kpi-label">{label}</span>
            <span className="rgfc__kpi-value">{valor}</span>
          </>
        )}
      </div>
    </OverlayTrigger>
  );
}

const contarPersonasUnicas = (coberturas = []) => {
  const ids = new Set();
  coberturas.forEach((cobertura, idx) => {
    const id =
      cobertura.cliente_id ??
      cobertura.cliente?.id ??
      `cobertura-${cobertura.id ?? idx}`;
    ids.add(String(id));
  });
  return ids.size;
};

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

const esBooleanoFalse = (valor) =>
  valor === false || valor === 0 || valor === "0" || valor === "false";

const esBooleanoTrue = (valor) =>
  valor === true || valor === 1 || valor === "1" || valor === "true";

const normalizarTexto = (valor) =>
  String(valor || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

/**
 * Replica las métricas independientes usadas por el panel principal.
 * Dental MS entra en Coberturas MS si está activo o con servicio,
 * y no si está cancelado o retirado.
 */
const calcularMetricasPanel = (grupos) => {
  const metricas = {
    estado_coberturas_ms: 0,
    cotizacion: 0,
    otras_coberturas: 0,
    cancelados: 0,
    retirados: 0,
  };

  grupos.forEach((grupo) => {
    const estadoGrupo = grupo.estado_codigo ?? grupo.estado_id ?? grupo.estado;
    const enCotizacion = esGrupoEnFlujoCotizacion(estadoGrupo);
    const enGrupoFamiliar = esGrupoFamiliarTerminado(estadoGrupo);

    (grupo.coberturas || []).forEach((cobertura) => {
      const activo = esBooleanoTrue(cobertura.activo);
      const vigente = esBooleanoTrue(cobertura.vigente);
      const estado = normalizarTexto(cobertura.estado_cobertura);
      const tipo = cobertura.cobertura_tipo || "";
      const definida = normalizarTexto(cobertura.cobertura_definida);
      const anulada = !fechaVacia(cobertura.fecha_anulacion);

      if (activo && enCotizacion) {
        metricas.cotizacion += 1;
      }

      const saludMsContabilizable =
        isProductoSaludMs(tipo) &&
        activo &&
        !enCotizacion &&
        ((esEstadoCoberturaSi(estado) && vigente) ||
          (["no", "medicare", "medicaid"].includes(estado) &&
            esBooleanoFalse(cobertura.vigente)));

      const cancelada =
        !anulada &&
        esBooleanoFalse(cobertura.vigente) &&
        !fechaVacia(cobertura.fecha_cancelacion) &&
        (definida === "cancelado" || (!definida && activo));

      const retirada =
        !anulada &&
        esBooleanoFalse(cobertura.activo) &&
        esBooleanoFalse(cobertura.vigente) &&
        !fechaVacia(cobertura.fecha_retiro) &&
        (["retirado", "terminado"].includes(definida) || !definida);

      const retiradaDentalConActivo =
        isDentalMsCoberturaTipo(tipo) &&
        !anulada &&
        !vigente &&
        !fechaVacia(cobertura.fecha_retiro) &&
        ["retirado", "terminado"].includes(definida);

      const dentalMsActivoOConServicio =
        isDentalMsCoberturaTipo(tipo) &&
        (activo || vigente) &&
        !cancelada &&
        !retirada &&
        !retiradaDentalConActivo;

      if (saludMsContabilizable || dentalMsActivoOConServicio) {
        metricas.estado_coberturas_ms += 1;
      }

      const tipoNormalizado = normalizarTexto(tipo);
      const productoPrivado =
        tipoNormalizado.includes("vision") ||
        tipoNormalizado.includes("descuento") ||
        (isDentalCoberturaTipo(tipo) && !isDentalMsCoberturaTipo(tipo));
      const privadaActivaVigente =
        enGrupoFamiliar &&
        activo &&
        vigente &&
        esEstadoCoberturaSi(estado) &&
        fechaVacia(cobertura.fecha_cancelacion) &&
        fechaVacia(cobertura.fecha_retiro) &&
        fechaVacia(cobertura.fecha_anulacion);
      if (productoPrivado && privadaActivaVigente) {
        metricas.otras_coberturas += 1;
      }

      if (cancelada) metricas.cancelados += 1;
      if (retirada) metricas.retirados += 1;
    });
  });

  return metricas;
};

/**
 * Clasifica un miembro alineado al panel:
 * - Activos reales: Sí + activo + vigente, fuera de cotización y sin fechas de baja.
 * - Cotización: misma cobertura “Sí” pero el GF aún está en estados 1–5.
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
  const [resumenPanel, setResumenPanel] = useState(null);

  // Cargar grupos familiares
  useEffect(() => {
    const fetchGrupos = async () => {
      try {
        setLoading(true);
        setError(null);
        const [gruposResult, resumenResult] = await Promise.allSettled([
          apiRequest("grupo_familiar/grupos-familiares-full", "GET"),
          apiRequest("cliente/general", "GET"),
        ]);

        const response =
          gruposResult.status === "fulfilled" ? gruposResult.value : null;

        if (response?.status === "success" && Array.isArray(response.data)) {
          setGrupos(response.data);
        } else {
          throw gruposResult.status === "rejected"
            ? gruposResult.reason
            : new Error("Respuesta inválida del reporte");
        }

        setResumenPanel(
          resumenResult.status === "fulfilled" ? resumenResult.value : null
        );
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
      const metricasPanel = calcularMetricasPanel([{ ...grupo, coberturas }]);
      const estadisticas = {
        total: contarPersonasUnicas(coberturas),
        activos_con_cobertura: porCategoria.activos_con_cobertura.length,
        estado_coberturas_ms: metricasPanel.estado_coberturas_ms,
        cotizacion: metricasPanel.cotizacion,
        otras_coberturas: metricasPanel.otras_coberturas,
        cancelados: metricasPanel.cancelados,
        retirados: metricasPanel.retirados,
        sin_cobertura: porCategoria.sin_cobertura.length,
        otros_estados: porCategoria.otros_estados.length
      };

      return {
        ...grupo,
        miembrosClasificados,
        porCategoria,
        estadisticas,
        metricasPanel,
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
  const renderCategoriaMiembros = (categoria, miembros) => {
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
  const hayFiltrosActivos =
    Boolean(searchTerm.trim()) ||
    filtroEstado !== "todos" ||
    filtroCoberturaTipo !== "todos";
  const metricasFiltradas = calcularMetricasPanel(gruposFiltrados);
  const metricasResumen =
    !hayFiltrosActivos && resumenPanel
      ? {
          estado_coberturas_ms:
            (Number(resumenPanel.polizasActivas?.total) || 0) +
            (Number(resumenPanel.dentalMsActivo) || 0),
          cotizacion: Number(resumenPanel.polizasCotizacion) || 0,
          otras_coberturas: Number(resumenPanel.otrosProductos?.total) || 0,
          cancelados: Number(resumenPanel.polizasCanceladas) || 0,
          retirados: Number(resumenPanel.polizasRetiradas) || 0,
        }
      : metricasFiltradas;

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
                  <option value="estado_coberturas_ms">Estado de Coberturas MS</option>
                  <option value="cotizacion">Cotización</option>
                  <option value="otras_coberturas">Otras Coberturas</option>
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
              <DatoConDescripcion
                label="Total Grupos"
                valor={gruposFiltrados.length}
                descripcion={DESCRIPCIONES_METRICAS.total_grupos}
              />
              <DatoConDescripcion
                label="Total Miembros"
                valor={totalMiembros}
                descripcion={DESCRIPCIONES_METRICAS.total_miembros}
              />
              <DatoConDescripcion
                label="Estado de Coberturas MS"
                valor={metricasResumen.estado_coberturas_ms}
                descripcion={DESCRIPCIONES_METRICAS.estado_coberturas_ms}
              />
              <DatoConDescripcion
                label="Cotización"
                valor={metricasResumen.cotizacion}
                descripcion={DESCRIPCIONES_METRICAS.cotizacion}
              />
              <DatoConDescripcion
                label="Otras Coberturas"
                valor={metricasResumen.otras_coberturas}
                descripcion={DESCRIPCIONES_METRICAS.otras_coberturas}
              />
              <DatoConDescripcion
                label="Cancelados"
                valor={metricasResumen.cancelados}
                descripcion={DESCRIPCIONES_METRICAS.cancelados}
              />
              <DatoConDescripcion
                label="Retirados"
                valor={metricasResumen.retirados}
                descripcion={DESCRIPCIONES_METRICAS.retirados}
              />
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
                              grupo.porCategoria.activos_con_cobertura
                            )}
                            {renderCategoriaMiembros(
                              "cotizacion",
                              grupo.porCategoria.cotizacion
                            )}
                            {renderCategoriaMiembros(
                              "cancelados",
                              grupo.porCategoria.cancelados
                            )}
                            {renderCategoriaMiembros(
                              "retirados",
                              grupo.porCategoria.retirados
                            )}
                            {renderCategoriaMiembros(
                              "sin_cobertura",
                              grupo.porCategoria.sin_cobertura
                            )}
                            {renderCategoriaMiembros(
                              "otros_estados",
                              grupo.porCategoria.otros_estados
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

