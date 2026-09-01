import React, { useState, useEffect } from "react";
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
import { SUGGESTED_TAGS } from "../utils/tagsCatalog";

const GruposFamiliaresConTags = () => {
  const [grupos, setGrupos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchGrupos = async () => {
    setLoading(true);
    try {
      const endpoint = "grupo_familiar/grupos-familiares-full";
      const response = await apiRequest(endpoint, "GET");

      if (response && response.status === "success" && Array.isArray(response.data)) {
        setGrupos(response.data);
      } else {
        console.error("❌ [GruposFamiliaresConTags] Respuesta inesperada:", response);
        setGrupos([]);
      }
    } catch (error) {
      console.error("❌ [GruposFamiliaresConTags] Error al cargar grupos familiares:", error);
      alert("Error al cargar los grupos familiares. Por favor, intente nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGrupos();
  }, []);

  const getTomadorNombre = (grupo) => {
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

  const getTextColor = (bgColor) => {
    if (!bgColor) return "#FFFFFF";

    const hex = bgColor.replace('#', '');
    const r = parseInt(hex.length === 3 ? hex[0] + hex[0] : hex.substring(0, 2), 16);
    const g = parseInt(hex.length === 3 ? hex[1] + hex[1] : hex.substring(2, 4), 16);
    const b = parseInt(hex.length === 3 ? hex[2] + hex[2] : hex.substring(4, 6), 16);

    const brightness = (r * 299 + g * 587 + b * 114) / 1000;

    return brightness > 128 ? "#000000" : "#FFFFFF";
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

      const tagsValidas = tagsArray
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
        .map(tag => {
          const finalColor = getTagColor(tag);
          return {
            ...tag,
            color: finalColor,
          };
        });

      return tagsValidas;
    } catch (error) {
      console.error("❌ Error al procesar tags:", error);
      return [];
    }
  };

  const filteredGrupos = grupos.filter(grupo => {
    if (searchTerm === "") return true;

    const id = grupo.id ? grupo.id.toString() : "";
    const tomador = getTomadorNombre(grupo);
    const estado = getGrupoEstado(grupo).estado;
    const tags = getTags(grupo);
    const tagsText = tags.map(t => t.label).join(" ").toLowerCase();

    return id.includes(searchTerm) ||
      tomador.toLowerCase().includes(searchTerm.toLowerCase()) ||
      estado.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tagsText.includes(searchTerm.toLowerCase());
  });

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
                : `${filteredGrupos.length} grupo${filteredGrupos.length !== 1 ? "s" : ""}`}
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

            {!loading && filteredGrupos.length > 0 && (
              <div className="gf-listado__summary">
                Mostrando <strong>{filteredGrupos.length}</strong> de{" "}
                <strong>{grupos.length}</strong> grupos
                {searchTerm.trim() ? " (filtrados)" : ""}
              </div>
            )}

            {loading ? (
              <div className="gf-tags__loading">
                <div className="spinner-border" role="status">
                  <span className="visually-hidden">Cargando...</span>
                </div>
                <div>Cargando grupos familiares…</div>
              </div>
            ) : filteredGrupos.length === 0 ? (
              <div className="gf-listado__empty">
                {searchTerm.trim()
                  ? "No se encontraron grupos que coincidan con la búsqueda."
                  : "No se encontraron grupos familiares."}
              </div>
            ) : (
              <div className="gf-listado__table-wrap">
                <Table hover className="gf-listado__table mb-0 align-middle">
                  <thead>
                    <tr>
                      <th>ID GF</th>
                      <th>Tomador</th>
                      <th>Estado</th>
                      <th>Etiquetas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredGrupos.map((grupo) => {
                      const tags = getTags(grupo);
                      const estadoInfo = getGrupoEstado(grupo);

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
                            {tags.length > 0 ? (
                              <div className="gf-tags__tags-wrap">
                                {tags.map((tag, index) => {
                                  const bgColor = getTagColor(tag);
                                  const textColor = getTextColor(bgColor);

                                  return (
                                    <span
                                      key={tag.key || index}
                                      style={{
                                        backgroundColor: bgColor,
                                        color: textColor,
                                        border: `1px solid ${bgColor}80`,
                                      }}
                                      className="gf-tags__tag-chip"
                                    >
                                      {tag.label}
                                    </span>
                                  );
                                })}
                              </div>
                            ) : (
                              <span className="gf-tags__sin-etiquetas">Sin etiquetas</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </div>
    </Container>
  );
};

export default GruposFamiliaresConTags;
