import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Badge, Button, Card, Col, Form, Row, Spinner, Table } from "react-bootstrap";
import { Helmet } from "react-helmet-async";
import { FaExclamationTriangle, FaFileInvoiceDollar, FaSearch, FaSync } from "react-icons/fa";
import { Link, useSearchParams } from "react-router-dom";
import DateInputWithCalendar from "../components/common/DateInputWithCalendar";
import Pagination from "../components/Pagination";
import { getReporteCoberturasCanceladasRetiradas } from "../services/reportesService";
import { formatDateMMDDYYYY } from "../utils/formatters";

const DEFAULT_FILTERS = {
  page: 1,
  per_page: 25,
  tipo: "todos",
  search: "",
  date_from: "",
  date_to: "",
  sort_by: "fecha_cancelacion",
  sort_dir: "desc",
};

const CLIENTE_FICHA_PATH = (id) => `/clientes/${id}/ficha`;
const GRUPO_FICHA_PATH = (id) => `/grupo_familiar/${id}`;

const formatDate = (value) => {
  if (!value) return "—";
  const formatted = formatDateMMDDYYYY(value);
  return formatted || "—";
};

const renderGrupoLink = (grupoId) => {
  if (!grupoId) return "—";
  return (
    <Link
      to={GRUPO_FICHA_PATH(grupoId)}
      target="_blank"
      rel="noopener noreferrer"
      className="text-decoration-none fw-semibold"
      title={`Ver grupo familiar #${grupoId}`}
    >
      {grupoId}
    </Link>
  );
};

const renderClienteLink = (clienteId, label) => {
  if (!clienteId) return label || "—";
  return (
    <Link
      to={CLIENTE_FICHA_PATH(clienteId)}
      target="_blank"
      rel="noopener noreferrer"
      className="text-decoration-none fw-semibold"
      title="Abrir ficha del cliente en una nueva pestaña"
    >
      {label || clienteId}
    </Link>
  );
};

const ReporteCoberturasCanceladasRetiradasPage = () => {
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState(() => ({
    ...DEFAULT_FILTERS,
    tipo: searchParams.get("tipo") || DEFAULT_FILTERS.tipo,
  }));
  const [searchInput, setSearchInput] = useState("");
  const [data, setData] = useState([]);
  const [meta, setMeta] = useState({ page: 1, per_page: 25, total: 0, last_page: 1 });
  const [resumen, setResumen] = useState({ total: 0, cancelados: 0, retiros: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const queryParams = useMemo(() => {
    const params = { ...filters };
    if (!params.search) delete params.search;
    if (!params.date_from) delete params.date_from;
    if (!params.date_to) delete params.date_to;
    return params;
  }, [filters]);

  const loadReport = useCallback(async () => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const response = await getReporteCoberturasCanceladasRetiradas(queryParams, controller.signal);
      setData(Array.isArray(response?.data) ? response.data : []);
      setMeta(response?.meta || DEFAULT_FILTERS);
      setResumen(response?.resumen || { total: 0, cancelados: 0, retiros: 0 });
    } catch (err) {
      if (err?.name === "AbortError") return;
      setError(err?.message || "No se pudo cargar el informe.");
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [queryParams]);

  useEffect(() => {
    loadReport();
    return () => abortRef.current?.abort();
  }, [loadReport]);

  const handleSearch = (event) => {
    event.preventDefault();
    setFilters((prev) => ({ ...prev, page: 1, search: searchInput.trim() }));
  };

  const handleSort = (column) => {
    setFilters((prev) => {
      const sameColumn = prev.sort_by === column;
      return {
        ...prev,
        page: 1,
        sort_by: column,
        sort_dir: sameColumn && prev.sort_dir === "asc" ? "desc" : "asc",
      };
    });
  };

  const sortIcon = (column) => {
    if (filters.sort_by !== column) return null;
    return filters.sort_dir === "asc" ? " ↑" : " ↓";
  };

  return (
    <div className="container-fluid py-4">
      <Helmet>
        <title>Coberturas Canceladas y Retiradas</title>
      </Helmet>

      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <h2 className="mb-1 d-flex align-items-center gap-2">
            <FaFileInvoiceDollar className="text-primary" />
            Coberturas Canceladas y Retiradas
          </h2>
          <p className="text-muted mb-0">
            Historial completo de cancelaciones y retiros.{" "}
            <Link to="/">Volver al panel principal</Link>
          </p>
        </div>
        <Button variant="outline-primary" onClick={loadReport} disabled={loading}>
          <FaSync className={loading ? "spin" : ""} /> Actualizar
        </Button>
      </div>

      {error && (
        <Alert variant="danger" className="d-flex align-items-center">
          <FaExclamationTriangle className="me-2" />
          {error}
        </Alert>
      )}

      <Card className="mb-4">
        <Card.Body>
          <Row className="g-3 align-items-end">
            <Col md={3}>
              <Form.Label>Tipo</Form.Label>
              <Form.Select
                value={filters.tipo}
                onChange={(e) => setFilters((prev) => ({ ...prev, page: 1, tipo: e.target.value }))}
              >
                <option value="todos">Todos</option>
                <option value="cancelados">Cancelados</option>
                <option value="retiros">Retiros</option>
              </Form.Select>
            </Col>
            <Col md={3}>
              <Form.Label>Desde</Form.Label>
              <DateInputWithCalendar
                valueIso={filters.date_from}
                onChangeIso={(iso) =>
                  setFilters((prev) => ({ ...prev, page: 1, date_from: iso || "" }))
                }
              />
            </Col>
            <Col md={3}>
              <Form.Label>Hasta</Form.Label>
              <DateInputWithCalendar
                valueIso={filters.date_to}
                onChangeIso={(iso) =>
                  setFilters((prev) => ({ ...prev, page: 1, date_to: iso || "" }))
                }
                minIso={filters.date_from || undefined}
              />
            </Col>
            <Col md={3}>
              <Form onSubmit={handleSearch}>
                <Form.Label>Buscar por nombre</Form.Label>
                <div className="d-flex gap-2">
                  <Form.Control
                    placeholder="Nombre del cliente"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                  />
                  <Button type="submit" variant="primary">
                    <FaSearch />
                  </Button>
                </div>
              </Form>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <div className="mb-3 small text-muted">
        Total: <strong>{resumen.total}</strong> registros (
        <strong>{resumen.cancelados}</strong> cancelados,{" "}
        <strong>{resumen.retiros}</strong> retiros)
      </div>

      <Card>
        <Card.Body className="p-0">
          <div className="table-responsive">
            <Table hover className="mb-0 align-middle">
              <thead className="table-light">
                <tr>
                  <th role="button" onClick={() => handleSort("grupo_familiar_id")}>
                    GF{sortIcon("grupo_familiar_id")}
                  </th>
                  <th role="button" onClick={() => handleSort("nombre")}>
                    Nombre{sortIcon("nombre")}
                  </th>
                  <th role="button" onClick={() => handleSort("fecha_cancelacion")}>
                    Fecha de cancelación{sortIcon("fecha_cancelacion")}
                  </th>
                  <th role="button" onClick={() => handleSort("fecha_retiro")}>
                    Fecha de retiro{sortIcon("fecha_retiro")}
                  </th>
                  <th role="button" onClick={() => handleSort("concepto")}>
                    Concepto{sortIcon("concepto")}
                  </th>
                  <th role="button" onClick={() => handleSort("motivo")}>
                    Motivo{sortIcon("motivo")}
                  </th>
                  <th className="text-end" role="button" onClick={() => handleSort("tipo")}>
                    Estado{sortIcon("tipo")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-5">
                      <Spinner animation="border" size="sm" className="me-2" />
                      Cargando informe...
                    </td>
                  </tr>
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-muted py-5">
                      No hay coberturas para los filtros seleccionados
                    </td>
                  </tr>
                ) : (
                  data.map((row) => (
                    <tr key={`${row.id}-${row.fecha_cancelacion || ""}-${row.fecha_retiro || ""}-${row.tipo}`}>
                      <td>{renderGrupoLink(row.grupo_familiar_id)}</td>
                      <td>{renderClienteLink(row.cliente_id, row.nombre)}</td>
                      <td>{formatDate(row.fecha_cancelacion)}</td>
                      <td>{formatDate(row.fecha_retiro)}</td>
                      <td>{row.concepto || "—"}</td>
                      <td>{row.motivo || "—"}</td>
                      <td className="text-end">
                        {row.tipo === "cancelados" ? (
                          <Badge bg="danger" pill>
                            Cancelada
                          </Badge>
                        ) : (
                          <Badge bg="secondary" pill>
                            Retirada
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>

      {!loading && meta.total > 0 && (
        <div className="mt-3">
          <Pagination
            currentPage={meta.page}
            totalPages={meta.last_page}
            onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))}
            totalItems={meta.total}
            itemsPerPage={meta.per_page}
          />
        </div>
      )}
    </div>
  );
};

export default ReporteCoberturasCanceladasRetiradasPage;
