import { useEffect, useMemo, useState } from "react";
import { Alert, Badge, Card, Spinner, Table } from "react-bootstrap";
import { FaUsers } from "react-icons/fa";
import { Link } from "react-router-dom";
import apiRequest from "../../services/api";
import { SUGGESTED_TAGS } from "../../utils/tagsCatalog";
import { formatDateMMDDYYYY } from "../../utils/formatters";
import { esGrupoPlanPrivado } from "../../constants/estadosGrupoFamiliar";
import { clasificarGrupoFamiliar } from "../../utils/grupoFamiliarClasificacion";

const CATEGORIAS_ORDEN = [
  "activos_con_cobertura",
  "cotizacion",
  "cancelados",
  "retirados",
  "sin_cobertura",
  "otros_estados",
];

const formatCurrency = (value) => {
  if (value === null || value === undefined || value === "") return "-";
  const num = Number(value);
  if (!Number.isFinite(num)) return String(value);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(num);
};

const formatDate = (value) => formatDateMMDDYYYY(value) || "-";

const getTextColor = (bgColor) => {
  if (!bgColor) return "#FFFFFF";
  const hex = String(bgColor).replace("#", "");
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex;
  if (!/^[A-Fa-f0-9]{6}$/.test(full)) return "#FFFFFF";
  const r = parseInt(full.substring(0, 2), 16);
  const g = parseInt(full.substring(2, 4), 16);
  const b = parseInt(full.substring(4, 6), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 128 ? "#000000" : "#FFFFFF";
};

const normalizeLabelForSearch = (label = "") =>
  String(label)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

const resolveTags = (grupo) => {
  try {
    const tagsRaw = grupo.tags || grupo.etiquetas;
    if (!tagsRaw) return [];

    let tagsArray = [];
    if (Array.isArray(tagsRaw)) {
      tagsArray = tagsRaw;
    } else if (typeof tagsRaw === "string" && tagsRaw.trim()) {
      try {
        const parsed = JSON.parse(tagsRaw);
        if (Array.isArray(parsed)) tagsArray = parsed;
      } catch {
        return [];
      }
    }

    return tagsArray
      .filter((tag) => tag && typeof tag === "object" && (tag.key || tag.label))
      .map((tag) => {
        const tagKey = tag.key || normalizeLabelForSearch(tag.label);
        let finalColor = tag.color || null;
        if (!finalColor) {
          const fromCatalog = SUGGESTED_TAGS.find(
            (t) =>
              t.key === tagKey ||
              normalizeLabelForSearch(t.label) ===
                normalizeLabelForSearch(tag.label || "")
          );
          finalColor = fromCatalog?.color || "#6c757d";
        } else {
          const colorStr = String(finalColor).trim();
          if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(colorStr)) {
            finalColor = colorStr;
          } else if (/^([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(colorStr)) {
            finalColor = `#${colorStr}`;
          } else {
            finalColor = "#6c757d";
          }
        }
        return {
          key: tagKey,
          label: tag.label || tagKey,
          color: finalColor,
        };
      });
  } catch {
    return [];
  }
};

function CategoriaMiembros({ categoria, miembros }) {
  if (!miembros?.length) return null;

  const estadoInfo = miembros[0]?.estadoClasificado;
  const Icon = estadoInfo?.icon || FaUsers;
  const borderLeftColor =
    estadoInfo?.variant === "success"
      ? "#198754"
      : estadoInfo?.variant === "danger"
        ? "#dc3545"
        : estadoInfo?.variant === "warning"
          ? "#ffc107"
          : estadoInfo?.variant === "secondary"
            ? "#6c757d"
            : "#0dcaf0";

  return (
    <Card
      className="mb-3 border-start border-4"
      style={{ borderLeftColor }}
    >
      <Card.Header className="d-flex align-items-center justify-content-between bg-light">
        <div className="d-flex align-items-center gap-2">
          <Icon className={`text-${estadoInfo?.variant || "info"}`} />
          <strong>{estadoInfo?.label || categoria}</strong>
          <Badge bg={estadoInfo?.variant || "info"} className="ms-2">
            {miembros.length}
          </Badge>
        </div>
      </Card.Header>
      <Card.Body className="p-0">
        <Table responsive hover size="sm" className="mb-0 align-middle">
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
                  {miembro.cliente_id || miembro.cliente?.id ? (
                    <Link
                      to={`/clientes/${miembro.cliente_id || miembro.cliente?.id}/ficha`}
                      className="text-decoration-none"
                    >
                      {miembro.cliente?.nombre_completo || "Sin nombre"}
                    </Link>
                  ) : (
                    miembro.cliente?.nombre_completo || "Sin nombre"
                  )}
                  {miembro.parentesco?.toUpperCase() === "TOMADOR" && (
                    <Badge bg="warning" text="dark" className="ms-2">
                      TOMADOR
                    </Badge>
                  )}
                </td>
                <td>{miembro.parentesco || "-"}</td>
                <td>
                  <Badge bg={miembro.estadoClasificado?.variant || "info"}>
                    {miembro.estado_cobertura || "Sin definir"}
                  </Badge>
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
                      <strong>Can:</strong>{" "}
                      {formatDate(miembro.fecha_cancelacion)}
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
}

/**
 * Detalle tipo reporte clasificado (badges, etiquetas, miembros por categoría).
 * Puede recibir `grupo` ya cargado o `grupoId` para fetch lazy.
 */
export default function GrupoFamiliarClasificadoDetalle({
  grupoId,
  grupo: grupoProp = null,
  anio = null,
  detallePath = null,
}) {
  const [grupoLoaded, setGrupoLoaded] = useState(grupoProp);
  const [loading, setLoading] = useState(!grupoProp && !!grupoId);
  const [error, setError] = useState("");

  useEffect(() => {
    if (grupoProp) {
      setGrupoLoaded(grupoProp);
      setLoading(false);
      setError("");
      return;
    }
    if (!grupoId) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const qs = anio ? `?anio=${encodeURIComponent(anio)}` : "";
        const response = await apiRequest(
          `grupo_familiar/grupos-familiares-full/${grupoId}${qs}`,
          "GET"
        );
        const data = response?.data ?? response;
        if (cancelled) return;
        if (!data || typeof data !== "object") {
          setError("No se pudo cargar el detalle del grupo.");
          setGrupoLoaded(null);
          return;
        }
        setGrupoLoaded(data);
      } catch (err) {
        if (cancelled) return;
        console.error("Error al cargar detalle clasificado:", err);
        setError(
          err?.message || "Error al cargar el detalle del grupo familiar."
        );
        setGrupoLoaded(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [grupoId, grupoProp, anio]);

  const clasificado = useMemo(
    () => (grupoLoaded ? clasificarGrupoFamiliar(grupoLoaded) : null),
    [grupoLoaded]
  );

  if (loading) {
    return (
      <div className="text-center py-4">
        <Spinner animation="border" size="sm" className="me-2" />
        Cargando detalle del grupo…
      </div>
    );
  }

  if (error) {
    return <Alert variant="warning" className="mb-0">{error}</Alert>;
  }

  if (!clasificado) {
    return (
      <Alert variant="light" className="mb-0 border">
        Sin información del grupo.
      </Alert>
    );
  }

  const tags = resolveTags(clasificado);
  const linkTo =
    detallePath ||
    (clasificado.id ? `/grupo_familiar/${clasificado.id}` : null);

  return (
    <div className="grupo-familiar-clasificado-detalle">
      <div className="d-flex align-items-center gap-2 flex-wrap mb-3">
        {linkTo ? (
          <Link to={linkTo} className="text-decoration-none fw-bold">
            Grupo ID: {clasificado.id}
          </Link>
        ) : (
          <strong>Grupo ID: {clasificado.id}</strong>
        )}
        <Badge bg="primary">{clasificado.tomadorNombre}</Badge>
        {clasificado.coberturaTipos.length > 0 ? (
          clasificado.coberturaTipos.map((tipo) => (
            <Badge key={tipo} bg="dark">
              {tipo}
            </Badge>
          ))
        ) : (
          <Badge bg="dark">Sin producto</Badge>
        )}
        <Badge bg="info">
          {clasificado.personas_cobertura || 0} en cobertura
        </Badge>
        <Badge bg="secondary">
          {esGrupoPlanPrivado(clasificado)
            ? "— en taxes"
            : `${clasificado.personas_taxes || 0} en taxes`}
        </Badge>
      </div>

      <div className="d-flex align-items-center gap-2 flex-wrap mb-3">
        <strong className="me-1">Etiquetas:</strong>
        {tags.length > 0 ? (
          tags.map((tag, index) => (
            <Badge
              key={tag.key || index}
              style={{
                backgroundColor: tag.color,
                color: getTextColor(tag.color),
                padding: "0.35em 0.65em",
                border: "none",
              }}
            >
              {tag.label}
            </Badge>
          ))
        ) : (
          <span className="text-muted small">Sin etiquetas</span>
        )}
      </div>

      {CATEGORIAS_ORDEN.map((key) => (
        <CategoriaMiembros
          key={key}
          categoria={key}
          miembros={clasificado.porCategoria[key]}
        />
      ))}

      {clasificado.estadisticas.total === 0 && (
        <p className="text-muted mb-0">Este grupo no tiene coberturas.</p>
      )}
    </div>
  );
}
