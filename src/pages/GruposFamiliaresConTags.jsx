import React, { useState, useEffect } from "react";
import {
  Container, Card, Table, Badge, Button,
  Form, InputGroup
} from "react-bootstrap";
import {
  FaSearch, FaTags
} from "react-icons/fa";
import "../styles/GruposFamiliaresListado.css"
import { Link } from "react-router-dom";
import apiRequest from "../services/api";
import { Helmet } from "react-helmet-async";
import { SUGGESTED_TAGS } from "../utils/tagsCatalog";

const GruposFamiliaresConTags = () => {
  // Estados
  const [grupos, setGrupos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Función para cargar grupos
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

  // Cargar grupos al montar el componente
  useEffect(() => {
    fetchGrupos();
  }, []);

  // Función para obtener el tomador (persona con parentesco TOMADOR)
  const getTomadorNombre = (grupo) => {
    if (!grupo.coberturas || grupo.coberturas.length === 0) {
      return "Sin asignar";
    }

    // Buscar la cobertura donde el parentesco sea "TOMADOR"
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

  // Función para obtener el estado del grupo
  const getGrupoEstado = (grupo) => {
    // Extraer el estado y estado_codigo de la respuesta
    const estado = grupo.estado || "Sin estado";
    
    // Mapear el color del badge según el estado
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

  // Función para calcular el color del texto basado en el brillo del fondo
  const getTextColor = (bgColor) => {
    if (!bgColor) return "#FFFFFF";
    
    // Convertir hex a RGB
    const hex = bgColor.replace('#', '');
    const r = parseInt(hex.length === 3 ? hex[0] + hex[0] : hex.substring(0, 2), 16);
    const g = parseInt(hex.length === 3 ? hex[1] + hex[1] : hex.substring(2, 4), 16);
    const b = parseInt(hex.length === 3 ? hex[2] + hex[2] : hex.substring(4, 6), 16);
    
    // Calcular brillo (luminancia relativa)
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    
    // Si el fondo es claro, usar texto oscuro; si es oscuro, usar texto claro
    return brightness > 128 ? "#000000" : "#FFFFFF";
  };

  // Función para normalizar un label para búsqueda (similar a generateTagKey)
  const normalizeLabelForSearch = (label) => {
    if (!label) return "";
    return label
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Eliminar acentos
      .replace(/[^a-z0-9]/g, "_") // Reemplazar caracteres especiales con guión bajo
      .replace(/_+/g, "_") // Reemplazar múltiples guiones bajos con uno solo
      .replace(/^_|_$/g, ""); // Eliminar guiones bajos al inicio y final
  };

  // Función para obtener el color de una etiqueta desde el catálogo
  const getTagColor = (tag) => {
    // PRIORIDAD 1: Buscar en el catálogo por key (siempre usar el color del catálogo si existe)
    if (tag.key) {
      const catalogTagByKey = SUGGESTED_TAGS.find(st => st.key === tag.key);
      if (catalogTagByKey && catalogTagByKey.color) {
        return catalogTagByKey.color;
      }
    }
    
    // PRIORIDAD 2: Buscar por label normalizado
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
    
    // PRIORIDAD 3: Si la etiqueta tiene color válido, usarlo
    if (tag.color && /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(tag.color)) {
      return tag.color;
    }
    
    // Color por defecto si no se encuentra
    return "#2196F3"; // Azul por defecto
  };

  // Función para obtener las tags de un grupo
  const getTags = (grupo) => {
    try {
      const tagsRaw = grupo.tags || grupo.etiquetas;
      
      if (!tagsRaw) return [];

      let tagsArray = [];
      
      // Si viene como array directamente
      if (Array.isArray(tagsRaw)) {
        tagsArray = tagsRaw;
      } 
      // Si viene como string JSON (compatibilidad)
      else if (typeof tagsRaw === "string" && tagsRaw.trim()) {
        const parsed = JSON.parse(tagsRaw);
        if (Array.isArray(parsed)) {
          tagsArray = parsed;
        }
      }
      
      // Validar y enriquecer cada tag con su color
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
          // Asegurar que cada tag tenga su color del catálogo (prioridad sobre el color original)
          const finalColor = getTagColor(tag);
          return {
            ...tag,
            color: finalColor // Siempre usar el color del catálogo
          };
        });
      
      return tagsValidas;
    } catch (error) {
      console.error("❌ Error al procesar tags:", error);
      return [];
    }
  };

  // Filtrar grupos según la búsqueda
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
    <Container fluid className="py-4">
      <Helmet>
        <title>Vantun/Listado de Grupos y Etiquetas</title>
      </Helmet>

      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="mb-0">
          <FaTags className="me-2" />
          Listado de Grupos y Etiquetas
        </h4>
      </div>

      <Card className="shadow-sm mb-4">
        <Card.Body>
          <div className="d-flex flex-column flex-md-row gap-3 mb-4">
            <div className="flex-grow-1">
              <InputGroup>
                <Form.Control
                  placeholder="Buscar por ID, tomador, estado o etiqueta..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <Button variant="outline-secondary">
                  <FaSearch />
                </Button>
              </InputGroup>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Cargando...</span>
              </div>
              <p className="mt-3">Cargando grupos familiares...</p>
            </div>
          ) : (
            <>
              {filteredGrupos.length === 0 ? (
                <div className="text-center py-5">
                  <p className="text-muted mb-0">No se encontraron grupos familiares</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <Table hover className="align-middle">
                    <thead>
                      <tr>
                        <th>ID GF</th>
                        <th>TOMADOR</th>
                        <th>ESTADO</th>
                        <th>ETIQUETAS</th>
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
                                  className="text-decoration-none fw-bold"
                                  title="Ver detalle del grupo"
                                >
                                  {grupo.id}
                                </Link>
                              ) : (
                                "Sin asignar"
                              )}
                            </td>
                            <td>{getTomadorNombre(grupo)}</td>
                            <td>
                              <Badge
                                bg={estadoInfo.variant}
                                pill
                                className="text-decoration-none"
                              >
                                {estadoInfo.estado}
                              </Badge>
                            </td>
                            <td>
                              {tags.length > 0 ? (
                                <div className="d-flex flex-wrap gap-1">
                                  {tags.map((tag, index) => {
                                    // Obtener el color del catálogo (prioridad sobre el color de la etiqueta)
                                    const bgColor = getTagColor(tag);
                                    const textColor = getTextColor(bgColor);
                                    
                                    return (
                                      <span
                                        key={tag.key || index}
                                        style={{
                                          backgroundColor: bgColor,
                                          color: textColor,
                                          fontSize: "0.75rem",
                                          padding: "0.35em 0.65em",
                                          borderRadius: "0.375rem",
                                          border: `1px solid ${bgColor}80`,
                                          fontWeight: "500",
                                          display: "inline-block",
                                          whiteSpace: "nowrap"
                                        }}
                                        className="badge"
                                      >
                                        {tag.label}
                                      </span>
                                    );
                                  })}
                                </div>
                              ) : (
                                <span className="text-muted">Sin etiquetas</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                </div>
              )}
            </>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
};

export default GruposFamiliaresConTags;

