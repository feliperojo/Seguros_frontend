import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Form,
  Row,
  Spinner,
  Table,
} from "react-bootstrap";
import { Helmet } from "react-helmet-async";
import { FaCreditCard, FaSearch, FaSync } from "react-icons/fa";
import { Link } from "react-router-dom";
import Pagination from "../components/Pagination";
import useAppSettings from "../hooks/useAppSettings";
import { getReporteMediosPago } from "../services/reportesService";

const DEFAULT_FILTERS = {
  page: 1,
  per_page: 25,
  search: "",
  tipo_medio: "todos",
  sort_by: "nombre_completo",
  sort_dir: "asc",
};

function ClienteMediosBlock({ cliente, showPaymentMethodsData }) {
  const tarjetas = cliente?.medios_pago?.tarjetas ?? [];
  const cuentas = cliente?.medios_pago?.cuentas_bancarias ?? [];

  if (tarjetas.length === 0 && cuentas.length === 0) {
    return (
      <p className="text-muted small mb-0 ms-3">Sin medios de pago registrados.</p>
    );
  }

  return (
    <div className="ms-3 mt-2">
      {tarjetas.length > 0 && (
        <div className="mb-3">
          <div className="small fw-semibold text-muted mb-2">Tarjetas de crédito/débito</div>
          <div className="table-responsive">
            <Table bordered size="sm" className="mb-0 bg-white">
              <thead className="table-light">
                <tr>
                  <th>Principal</th>
                  <th>Tipo pago</th>
                  <th>Marca</th>
                  <th>Quién paga</th>
                  <th>Titular</th>
                  <th>Número</th>
                  <th>Vencimiento</th>
                  <th>CVV</th>
                </tr>
              </thead>
              <tbody>
                {tarjetas.map((t) => (
                  <tr key={`tarjeta-${t.id}`}>
                    <td>
                      {t.es_principal ? (
                        <Badge bg="primary">Principal</Badge>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{t.tipo_tarjeta || "—"}</td>
                    <td>{t.forma_pago || "—"}</td>
                    <td>{t.quien_paga || "—"}</td>
                    <td>{t.titular || "—"}</td>
                    <td className="font-monospace">{t.numero_tarjeta || "—"}</td>
                    <td>{t.fecha_expiracion || "—"}</td>
                    <td className="font-monospace">{t.cvv || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </div>
      )}

      {cuentas.length > 0 && (
        <div>
          <div className="small fw-semibold text-muted mb-2">Cuentas bancarias</div>
          <div className="table-responsive">
            <Table bordered size="sm" className="mb-0 bg-white">
              <thead className="table-light">
                <tr>
                  <th>Principal</th>
                  <th>Banco</th>
                  <th>Quién paga</th>
                  <th>Titular</th>
                  <th>Ruta</th>
                  <th>Cuenta</th>
                </tr>
              </thead>
              <tbody>
                {cuentas.map((c) => (
                  <tr key={`cuenta-${c.id}`}>
                    <td>
                      {c.es_principal ? (
                        <Badge bg="primary">Principal</Badge>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{c.banco || "—"}</td>
                    <td>{c.quien_paga || "—"}</td>
                    <td>{c.titular || "—"}</td>
                    <td className="font-monospace">{c.ruta || "—"}</td>
                    <td className="font-monospace">{c.cuenta_numero || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </div>
      )}

      {!showPaymentMethodsData && (
        <p className="text-muted small mt-2 mb-0">
          Los datos sensibles aparecen enmascarados. Active la opción en el Configurador o
          desbloquee desde la ficha del cliente.
        </p>
      )}
    </div>
  );
}

export default function ReporteMediosPagoPage() {
  const { showPaymentMethodsData } = useAppSettings();
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
  const [data, setData] = useState([]);
  const [meta, setMeta] = useState({ page: 1, per_page: 25, total: 0, last_page: 1 });
  const [resumen, setResumen] = useState({ total_clientes: 0, total_medios_pago: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef(null);

  const fetchReport = useCallback(async (params) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError("");
    try {
      const response = await getReporteMediosPago(params, controller.signal);
      if (controller.signal.aborted || abortRef.current !== controller) return;

      setData(Array.isArray(response?.data) ? response.data : []);
      setMeta(response?.meta ?? { page: 1, per_page: 25, total: 0, last_page: 1 });
      setResumen(response?.resumen ?? { total_clientes: 0, total_medios_pago: 0 });
    } catch (err) {
      if (err?.name === "AbortError" || err?.message === "Petición cancelada") return;
      if (abortRef.current !== controller) return;

      setError(err?.message || "Error al cargar el informe");
      setData([]);
    } finally {
      if (!controller.signal.aborted && abortRef.current === controller) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchReport(appliedFilters);
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [appliedFilters, fetchReport]);

  const handleSearch = (e) => {
    e.preventDefault();
    setAppliedFilters({ ...filters, page: 1 });
  };

  const handlePageChange = (page) => {
    setAppliedFilters((prev) => ({ ...prev, page }));
    setFilters((prev) => ({ ...prev, page }));
  };

  return (
    <>
      <Helmet>
        <title>Clientes y medios de pago | Informes</title>
      </Helmet>

      <div className="container-fluid py-4">
        <div className="d-flex align-items-center gap-2 mb-3">
          <FaCreditCard size={22} className="text-primary" />
          <h1 className="h4 mb-0">Clientes y medios de pago</h1>
        </div>
        <p className="text-muted">
          Listado de clientes con sus medios de pago agrupados debajo de cada nombre.
        </p>

        {showPaymentMethodsData && (
          <Alert variant="info" className="py-2">
            La configuración global permite ver datos sensibles sin enmascarar.
          </Alert>
        )}

        <Card className="mb-4">
          <Card.Body>
            <Form onSubmit={handleSearch}>
              <Row className="g-3 align-items-end">
                <Col md={4}>
                  <Form.Label>Buscar cliente</Form.Label>
                  <Form.Control
                    type="search"
                    placeholder="Nombre del cliente"
                    value={filters.search}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, search: e.target.value }))
                    }
                  />
                </Col>
                <Col md={3}>
                  <Form.Label>Tipo de medio</Form.Label>
                  <Form.Select
                    value={filters.tipo_medio}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, tipo_medio: e.target.value }))
                    }
                  >
                    <option value="todos">Todos</option>
                    <option value="tarjeta">Tarjetas</option>
                    <option value="cuenta_bancaria">Cuentas bancarias</option>
                  </Form.Select>
                </Col>
                <Col md={2}>
                  <Form.Label>Por página</Form.Label>
                  <Form.Select
                    value={filters.per_page}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        per_page: Number(e.target.value),
                      }))
                    }
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </Form.Select>
                </Col>
                <Col md={3} className="d-flex gap-2">
                  <Button type="submit" variant="primary" disabled={loading}>
                    <FaSearch className="me-2" />
                    Buscar
                  </Button>
                  <Button
                    type="button"
                    variant="outline-secondary"
                    disabled={loading}
                    onClick={() => fetchReport(appliedFilters)}
                  >
                    <FaSync className="me-2" />
                    Actualizar
                  </Button>
                </Col>
              </Row>
            </Form>
          </Card.Body>
        </Card>

        <div className="d-flex flex-wrap gap-3 mb-3">
          <Badge bg="secondary">Clientes: {resumen.total_clientes ?? meta.total ?? 0}</Badge>
          <Badge bg="secondary">
            Medios de pago en página: {resumen.total_medios_pago ?? 0}
          </Badge>
        </div>

        {error && <Alert variant="danger">{error}</Alert>}

        {loading ? (
          <div className="text-center py-5">
            <Spinner animation="border" variant="primary" />
            <p className="mt-2 text-muted mb-0">Cargando informe…</p>
          </div>
        ) : data.length === 0 ? (
          <Alert variant="warning">No se encontraron clientes con los filtros aplicados.</Alert>
        ) : (
          <div className="d-flex flex-column gap-3">
            {data.map((cliente) => (
              <Card key={cliente.cliente_id}>
                <Card.Body>
                  <div className="d-flex flex-wrap justify-content-between align-items-start gap-2">
                    <div>
                      <h5 className="mb-1">
                        <Link
                          to={`/clientes/${cliente.cliente_id}/ficha/medios-pago`}
                          className="text-decoration-none"
                        >
                          {cliente.nombre_completo || `Cliente #${cliente.cliente_id}`}
                        </Link>
                      </h5>
                      <div className="text-muted small">
                        {cliente.telefono && <span className="me-3">Tel: {cliente.telefono}</span>}
                        {cliente.email && <span>Email: {cliente.email}</span>}
                      </div>
                    </div>
                    <Badge bg="light" text="dark">
                      {cliente.total_medios_pago} medio(s)
                    </Badge>
                  </div>
                  <ClienteMediosBlock
                    cliente={cliente}
                    showPaymentMethodsData={showPaymentMethodsData}
                  />
                </Card.Body>
              </Card>
            ))}
          </div>
        )}

        <div className="mt-4 d-flex justify-content-center">
          <Pagination
            currentPage={meta.page || 1}
            totalPages={meta.last_page || 1}
            onPageChange={handlePageChange}
            disabled={loading}
          />
        </div>
      </div>
    </>
  );
}
