import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Container,
  Table,
  Button,
  Form,
  InputGroup,
  Row,
  Col,
} from "react-bootstrap";
import {
  FaSearch, FaTags, FaSyncAlt, FaFilter, FaTable,
} from "react-icons/fa";
import "../styles/GruposFamiliaresListado.css";
import "../styles/GruposFamiliaresConTags.css";
import { Link } from "react-router-dom";
import apiRequest from "../services/api";
import { Helmet } from "react-helmet-async";
import Pagination from "../components/Pagination";
import GroupTags from "../components/GroupTags";
import { SUGGESTED_TAGS } from "../utils/tagsCatalog";
import { ordenarEtiquetasProductoListado } from "../constants/coberturaTipos";

const ITEMS_PER_PAGE = 50;
const SEARCH_DEBOUNCE_MS = 400;
const TAGS_SAVE_DEBOUNCE_MS = 450;

const GruposFamiliaresConTags = () => {
  const [grupos, setGrupos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [savingIds, setSavingIds] = useState(() => new Set());
  const [paginationMeta, setPaginationMeta] = useState({
    total: 0,
    last_page: 1,
    per_page: ITEMS_PER_PAGE,
    page: 1,
  });

  const saveTimersRef = useRef({});
  const lastSavedTagsRef = useRef({});

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      setCurrentPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    let cancelled = false;

    const fetchGrupos = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("page", String(currentPage));
        params.set("per_page", String(ITEMS_PER_PAGE));
        if (debouncedSearch) {
          params.set("search", debouncedSearch);
        }

        const response = await apiRequest(
          `grupo_familiar/grupos-familiares-listado?${params.toString()}`,
          "GET"
        );

        if (cancelled) return;

        if (response && response.status === "success" && Array.isArray(response.data)) {
          setGrupos(response.data);
          response.data.forEach((grupo) => {
            if (grupo?.id != null) {
              lastSavedTagsRef.current[grupo.id] = JSON.stringify(grupo.tags || []);
            }
          });
          setPaginationMeta({
            total: response.data.length,
            last_page: 1,
            per_page: ITEMS_PER_PAGE,
            page: currentPage,
            ...(response.meta || {}),
          });
        } else {
          console.error("❌ [GruposFamiliaresConTags] Respuesta inesperada:", response);
          setGrupos([]);
          setPaginationMeta({
            total: 0,
            last_page: 1,
            per_page: ITEMS_PER_PAGE,
            page: 1,
          });
        }
      } catch (error) {
        if (cancelled || error?.response?.status === 401) return;
        console.error("❌ [GruposFamiliaresConTags] Error al cargar grupos familiares:", error);
        setGrupos([]);
        setPaginationMeta({
          total: 0,
          last_page: 1,
          per_page: ITEMS_PER_PAGE,
          page: 1,
        });
        alert("Error al cargar los grupos familiares. Por favor, intente nuevamente.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchGrupos();

    return () => {
      cancelled = true;
    };
  }, [currentPage, debouncedSearch, reloadKey]);

  useEffect(() => {
    const timers = saveTimersRef.current;
    return () => {
      Object.values(timers).forEach((timer) => clearTimeout(timer));
    };
  }, []);

  const persistTags = useCallback(async (grupoId, tags) => {
    const snapshot = JSON.stringify(tags);
    if (lastSavedTagsRef.current[grupoId] === snapshot) return;

    setSavingIds((prev) => {
      const next = new Set(prev);
      next.add(grupoId);
      return next;
    });

    try {
      await apiRequest(`grupo_familiar/${grupoId}`, "PUT", { tags });
      lastSavedTagsRef.current[grupoId] = snapshot;
    } catch (error) {
      console.error("❌ [GruposFamiliaresConTags] Error al guardar etiquetas:", error);
      alert("No se pudieron guardar las etiquetas del grupo. Intente nuevamente.");
      setReloadKey((k) => k + 1);
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(grupoId);
        return next;
      });
    }
  }, []);

  const handleTagsChange = useCallback((grupoId, nextTags) => {
    const sanitized = Array.isArray(nextTags) ? nextTags : [];

    setGrupos((prev) =>
      prev.map((grupo) =>
        grupo.id === grupoId ? { ...grupo, tags: sanitized } : grupo
      )
    );

    if (saveTimersRef.current[grupoId]) {
      clearTimeout(saveTimersRef.current[grupoId]);
    }

    saveTimersRef.current[grupoId] = setTimeout(() => {
      persistTags(grupoId, sanitized);
    }, TAGS_SAVE_DEBOUNCE_MS);
  }, [persistTags]);

  const getTomadorNombre = (grupo) => {
    if (grupo.tomador_nombre && String(grupo.tomador_nombre).trim()) {
      return grupo.tomador_nombre;
    }

    if (!grupo.coberturas || grupo.coberturas.length === 0) {
      return "Sin asignar";
    }

    const tomadorCobertura = grupo.coberturas.find(
      cobertura => cobertura.parentesco &&
        cobertura.parentesco.toUpperCase() === "TOMADOR" &&
        cobertura.cliente
    );

    if (tomadorCobertura && tomadorCobertura.cliente) {
      return tomadorCobertura.cliente.nombre_completo ||
        (tomadorCobertura.cliente.primer_nombre + " " + tomadorCobertura.cliente.apellidos) ||
        "Sin asignar";
    }

    return "Sin asignar";
  };

  const getGrupoEstado = (grupo) => {
    const estado = grupo.estado || "Sin estado";

    const estadoLower = estado.toLowerCase();
    let variant = "secondary";

    if (estadoLower.includes("cotización") || estadoLower.includes("cotizacion")) {
      variant = "warning";
    } else if (estadoLower.includes("activo")) {
      variant = "success";
    } else if (estadoLower.includes("inactivo") || estadoLower.includes("descartado")) {
      variant = "danger";
    } else if (estadoLower.includes("prospecto")) {
      variant = "info";
    } else if (estadoLower.includes("seguimiento")) {
      variant = "primary";
    } else if (estadoLower.includes("toma") || estadoLower.includes("inscripcion")) {
      variant = "info";
    }

    return { estado, variant };
  };

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

  const getTagColor = (tag) => {
    if (tag.key) {
      const catalogTagByKey = SUGGESTED_TAGS.find(st => st.key === tag.key);
      if (catalogTagByKey && catalogTagByKey.color) {
        return catalogTagByKey.color;
      }
    }

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

    if (tag.color && /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(tag.color)) {
      return tag.color;
    }

    return "#2196F3";
  };

  const getProductoNombre = (grupo) =>
    ordenarEtiquetasProductoListado(grupo.producto || "-");

  const getProductoItems = (grupo) => {
    const producto = getProductoNombre(grupo);
    if (!producto || producto === "-") return [];
    return producto
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  };

  const getTags = (grupo) => {
    try {
      const tagsRaw = grupo.tags || grupo.etiquetas;

      if (!tagsRaw) return [];

      let tagsArray = [];

      if (Array.isArray(tagsRaw)) {
        tagsArray = tagsRaw;
      } else if (typeof tagsRaw === "string" && tagsRaw.trim()) {
        const parsed = JSON.parse(tagsRaw);
        if (Array.isArray(parsed)) {
          tagsArray = parsed;
        }
      }

      return tagsArray
        .filter(tag => {
          return (
            tag &&
            typeof tag === "object" &&
            tag.key &&
            tag.label &&
            typeof tag.key === "string" &&
            typeof tag.label === "string"
          );
        })
        .map(tag => ({
          ...tag,
          color: getTagColor(tag),
        }));
    } catch (error) {
      console.error("❌ Error al procesar tags:", error);
      return [];
    }
  };

  const totalPages = Math.max(1, paginationMeta.last_page ?? 1);
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const totalFiltered = paginationMeta.total ?? 0;
  const rangeStart = totalFiltered === 0 ? 0 : (safeCurrentPage - 1) * ITEMS_PER_PAGE + 1;
  const rangeEnd = Math.min(safeCurrentPage * ITEMS_PER_PAGE, totalFiltered);

  const fetchGrupos = () => setReloadKey((k) => k + 1);

  return (
    <Container fluid className="gf-listado-container py-3 gf-tags">
      <Helmet>
        <title>Vantun / Listado de Grupos y Etiquetas</title>
      </Helmet>

      <div className="gf-listado">
        <div className="gf-listado__header gf-listado__header--split">
          <div className="gf-listado__header-main">
            <div className="gf-listado__header-icon" aria-hidden="true">
              <FaTags />
            </div>
            <div>
              <h1 className="gf-listado__title">Listado de Grupos y Etiquetas</h1>
              <p className="gf-listado__subtitle">
                Consulta el estado y las etiquetas asignadas a cada grupo familiar.
              </p>
            </div>
          </div>
          <div className="gf-listado__header-actions">
            <span className="gf-listado__chip">
              {loading
                ? "Cargando…"
                : `${totalFiltered} grupo${totalFiltered !== 1 ? "s" : ""}`}
            </span>
            <Button
              size="sm"
              className="gf-listado__btn-ghost"
              onClick={fetchGrupos}
              disabled={loading}
            >
              <FaSyncAlt className={loading ? "fa-spin me-1" : "me-1"} />
              Actualizar
            </Button>
          </div>
        </div>

        <div className="gf-listado__body">
          <div className="gf-listado__section">
            <div className="gf-listado__section-title">
              <FaFilter aria-hidden="true" />
              Búsqueda
            </div>

            <Row className="g-3 align-items-end">
              <Col xs={12} lg={8}>
                <div className="gf-listado__label">Buscar</div>
                <InputGroup>
                  <Form.Control
                    placeholder="Buscar por ID, tomador, estado o etiqueta..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <Button
                    variant="outline-secondary"
                    className="gf-listado__btn-icon"
                    aria-label="Buscar"
                    type="button"
                  >
                    <FaSearch />
                  </Button>
                </InputGroup>
              </Col>
            </Row>
          </div>

          <div className="gf-listado__section gf-listado__section--table">
            <div className="gf-listado__section-title">
              <FaTable aria-hidden="true" />
              Grupos familiares
            </div>

            {!loading && totalFiltered > 0 && (
              <div className="gf-listado__summary">
                Mostrando <strong>{rangeStart}</strong>–<strong>{rangeEnd}</strong> de{" "}
                <strong>{totalFiltered}</strong> grupos
                {debouncedSearch ? " (filtrados)" : ""}
              </div>
            )}

            {loading ? (
              <div className="gf-tags__loading">
                <div className="spinner-border" role="status">
                  <span className="visually-hidden">Cargando...</span>
                </div>
                <div>Cargando grupos familiares…</div>
              </div>
            ) : grupos.length === 0 ? (
              <div className="gf-listado__empty">
                {debouncedSearch
                  ? "No se encontraron grupos que coincidan con la búsqueda."
                  : "No se encontraron grupos familiares."}
              </div>
            ) : (
              <>
                <div className="gf-listado__table-wrap">
                  <Table hover className="gf-listado__table mb-0 align-middle">
                    <thead>
                      <tr>
                        <th>ID GF</th>
                        <th>Tomador</th>
                        <th>Estado</th>
                        <th>Producto</th>
                        <th>Etiquetas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grupos.map((grupo) => {
                        const tags = getTags(grupo);
                        const estadoInfo = getGrupoEstado(grupo);
                        const productos = getProductoItems(grupo);
                        const isSaving = savingIds.has(grupo.id);

                        return (
                          <tr key={grupo.id}>
                            <td>
                              {grupo.id ? (
                                <Link
                                  to={`/grupo_familiar/${grupo.id}`}
                                  title="Ver detalle del grupo"
                                >
                                  {grupo.id}
                                </Link>
                              ) : (
                                "Sin asignar"
                              )}
                            </td>
                            <td className="gf-tags__tomador">{getTomadorNombre(grupo)}</td>
                            <td>
                              <span
                                className={`gf-tags__estado gf-tags__estado--${estadoInfo.variant}`}
                              >
                                {estadoInfo.estado}
                              </span>
                            </td>
                            <td>
                              {productos.length > 0 ? (
                                <div className="gf-tags__productos-wrap" title={getProductoNombre(grupo)}>
                                  {productos.map((producto) => (
                                    <span key={producto} className="gf-tags__producto-chip">
                                      {producto}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="gf-tags__sin-producto">Sin producto</span>
                              )}
                            </td>
                            <td>
                              <div className={`gf-tags__editor-wrap${isSaving ? " is-saving" : ""}`}>
                                <GroupTags
                                  value={tags}
                                  onChange={(nextTags) => handleTagsChange(grupo.id, nextTags)}
                                  hideLabel
                                  lazyCatalog
                                  className="gf-tags__editor"
                                />
                                {isSaving && (
                                  <span className="gf-tags__saving-hint">Guardando…</span>
                                )}
                              </div>
                            </td>
                          </tr>
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
          </div>
        </div>
      </div>
    </Container>
  );
};

export default GruposFamiliaresConTags;
