import React, { useState, useEffect } from "react";
import {
  Card,
  Table,
  Form,
  InputGroup,
  Button,
  Badge,
  Spinner,
  Pagination,
  Alert,
} from "react-bootstrap";
import {
  FaSearch,
  FaEye,
  FaFilter,
  FaCalendarAlt,
} from "react-icons/fa";
import { toast } from "react-toastify";
import userActivityService from "../../services/userActivityService";
import AuditLogDetailModal from "../../components/admin/AuditLogDetailModal";
import MdyDashDateInput from "../../components/common/MdyDashDateInput";

const ACTION_VARIANTS = {
  create: "success",
  update: "warning",
  delete: "danger",
  login: "primary",
  logout: "secondary",
  disable: "danger",
  enable: "success",
};

const AuditLogsList = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterOptions, setFilterOptions] = useState({ actions: [], entities: [] });
  const [filters, setFilters] = useState({
    search: "",
    user_id: "",
    action: "",
    entity: "",
    start_date: "",
    end_date: "",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage] = useState(20);
  const [total, setTotal] = useState(0);
  const [showDetail, setShowDetail] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    loadLogs();
  }, [currentPage, filters]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        page: currentPage,
        per_page: perPage,
        ...(filters.search && { search: filters.search }),
        ...(filters.user_id && { user_id: filters.user_id }),
        ...(filters.action && { action: filters.action }),
        ...(filters.entity && { entity: filters.entity }),
        ...(filters.start_date && { start_date: filters.start_date }),
        ...(filters.end_date && { end_date: filters.end_date }),
      };

      const response = await userActivityService.list(params);
      setLogs(response.data);
      setTotal(response.meta?.total ?? 0);
      if (response.filters) {
        setFilterOptions(response.filters);
      }
    } catch (err) {
      setError(err.message || "Error al cargar la actividad de usuarios");
      toast.error("Error al cargar la actividad de usuarios");
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
    setCurrentPage(1);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    loadLogs();
  };

  const handleViewDetail = async (log) => {
    try {
      const detail = await userActivityService.get(log.id);
      setSelectedLog(detail);
      setShowDetail(true);
    } catch {
      toast.error("Error al cargar detalles del registro");
    }
  };

  const getActionVariant = (actionKey) =>
    ACTION_VARIANTS[actionKey?.toLowerCase()] ?? "secondary";

  const formatDate = (dateString) => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    return Number.isNaN(date.getTime()) ? dateString : date.toLocaleString("es-ES");
  };

  const totalPages = Math.ceil(total / perPage) || 1;

  return (
    <div className="container-fluid py-4">
      <Card>
        <Card.Header>
          <h4 className="mb-0">
            <FaCalendarAlt className="me-2" />
            Actividad de Usuarios
          </h4>
        </Card.Header>
        <Card.Body>
          <Form onSubmit={handleSearch} className="mb-4">
            <div className="row g-3">
              <div className="col-md-3">
                <InputGroup>
                  <InputGroup.Text>
                    <FaSearch />
                  </InputGroup.Text>
                  <Form.Control
                    type="text"
                    placeholder="Buscar..."
                    value={filters.search}
                    onChange={(e) => handleFilterChange("search", e.target.value)}
                  />
                </InputGroup>
              </div>
              <div className="col-md-2">
                <Form.Select
                  value={filters.action}
                  onChange={(e) => handleFilterChange("action", e.target.value)}
                >
                  <option value="">Todas las acciones</option>
                  {filterOptions.actions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Form.Select>
              </div>
              <div className="col-md-2">
                <Form.Select
                  value={filters.entity}
                  onChange={(e) => handleFilterChange("entity", e.target.value)}
                >
                  <option value="">Todas las entidades</option>
                  {filterOptions.entities.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Form.Select>
              </div>
              <div className="col-md-2">
                <MdyDashDateInput
                  valueIso={filters.start_date}
                  onChangeIso={(iso) => handleFilterChange("start_date", iso)}
                />
              </div>
              <div className="col-md-2">
                <MdyDashDateInput
                  valueIso={filters.end_date}
                  onChangeIso={(iso) => handleFilterChange("end_date", iso)}
                />
              </div>
              <div className="col-md-1">
                <Button type="submit" variant="outline-primary" className="w-100">
                  <FaFilter />
                </Button>
              </div>
            </div>
          </Form>

          {error && (
            <Alert variant="danger" dismissible onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {loading ? (
            <div className="text-center py-5">
              <Spinner animation="border" role="status">
                <span className="visually-hidden">Cargando...</span>
              </Spinner>
            </div>
          ) : logs.length === 0 ? (
            <Alert variant="info" className="text-center">
              No se encontró actividad registrada
            </Alert>
          ) : (
            <>
              <div className="table-responsive">
                <Table striped bordered hover>
                  <thead>
                    <tr>
                      <th>Usuario</th>
                      <th>Acción</th>
                      <th>Descripción</th>
                      <th>Entidad</th>
                      <th>Fecha</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id}>
                        <td>
                          {log.user ? (
                            <>
                              <strong>{log.user.name}</strong>
                              {log.user.email && (
                                <>
                                  <br />
                                  <small className="text-muted">{log.user.email}</small>
                                </>
                              )}
                            </>
                          ) : (
                            <span className="text-muted">Sistema</span>
                          )}
                        </td>
                        <td>
                          <Badge bg={getActionVariant(log.action?.key)}>
                            {log.action?.label ?? log.action}
                          </Badge>
                        </td>
                        <td>{log.description || "—"}</td>
                        <td>
                          <Badge bg="info">{log.entity?.label ?? log.model ?? "—"}</Badge>
                          {log.entity?.id ? (
                            <small className="text-muted ms-1">#{log.entity.id}</small>
                          ) : null}
                        </td>
                        <td>
                          {log.occurred_at_formatted || formatDate(log.occurred_at || log.created_at)}
                        </td>
                        <td>
                          <Button
                            variant="info"
                            size="sm"
                            onClick={() => handleViewDetail(log)}
                            title="Ver detalles"
                          >
                            <FaEye />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="d-flex justify-content-center mt-4">
                  <Pagination>
                    <Pagination.First
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                    />
                    <Pagination.Prev
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                    />
                    {[...Array(totalPages)].map((_, i) => {
                      const page = i + 1;
                      if (
                        page === 1 ||
                        page === totalPages ||
                        (page >= currentPage - 2 && page <= currentPage + 2)
                      ) {
                        return (
                          <Pagination.Item
                            key={page}
                            active={page === currentPage}
                            onClick={() => setCurrentPage(page)}
                          >
                            {page}
                          </Pagination.Item>
                        );
                      }
                      return null;
                    })}
                    <Pagination.Next
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    />
                    <Pagination.Last
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                    />
                  </Pagination>
                </div>
              )}
            </>
          )}
        </Card.Body>
      </Card>

      {showDetail && selectedLog && (
        <AuditLogDetailModal
          show={showDetail}
          onHide={() => {
            setShowDetail(false);
            setSelectedLog(null);
          }}
          log={selectedLog}
        />
      )}
    </div>
  );
};

export default AuditLogsList;
