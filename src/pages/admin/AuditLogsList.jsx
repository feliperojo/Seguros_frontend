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
  Modal,
  Alert,
} from "react-bootstrap";
import {
  FaSearch,
  FaEye,
  FaFilter,
  FaCalendarAlt,
} from "react-icons/fa";
import { toast } from "react-toastify";
import { auditLogsService } from "../../services/adminApi";
import AuditLogDetailModal from "../../components/admin/AuditLogDetailModal";

const AuditLogsList = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    search: "",
    user_id: "",
    action: "",
    model: "",
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
        ...(filters.model && { model: filters.model }),
        ...(filters.start_date && { start_date: filters.start_date }),
        ...(filters.end_date && { end_date: filters.end_date }),
      };

      const response = await auditLogsService.list(params);
      setLogs(response.data || []);
      setTotal(response.meta?.total || 0);
    } catch (err) {
      setError(err.message || "Error al cargar logs de auditoría");
      toast.error("Error al cargar logs de auditoría");
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
    setCurrentPage(1);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    loadLogs();
  };

  const handleViewDetail = async (log) => {
    try {
      const detail = await auditLogsService.get(log.id);
      setSelectedLog(detail);
      setShowDetail(true);
    } catch (err) {
      toast.error("Error al cargar detalles del log");
    }
  };

  const getActionVariant = (action) => {
    switch (action?.toLowerCase()) {
      case "create":
        return "success";
      case "update":
        return "warning";
      case "delete":
        return "danger";
      default:
        return "secondary";
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    return date.toLocaleString("es-ES");
  };

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="container-fluid py-4">
      <Card>
        <Card.Header>
          <h4 className="mb-0">
            <FaCalendarAlt className="me-2" />
            Logs de Auditoría
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
                    onChange={(e) =>
                      handleFilterChange("search", e.target.value)
                    }
                  />
                </InputGroup>
              </div>
              <div className="col-md-2">
                <Form.Select
                  value={filters.action}
                  onChange={(e) => handleFilterChange("action", e.target.value)}
                >
                  <option value="">Todas las acciones</option>
                  <option value="create">Crear</option>
                  <option value="update">Actualizar</option>
                  <option value="delete">Eliminar</option>
                </Form.Select>
              </div>
              <div className="col-md-2">
                <Form.Control
                  type="text"
                  placeholder="Modelo/Entidad"
                  value={filters.model}
                  onChange={(e) => handleFilterChange("model", e.target.value)}
                />
              </div>
              <div className="col-md-2">
                <Form.Control
                  type="date"
                  placeholder="Fecha inicio"
                  value={filters.start_date}
                  onChange={(e) =>
                    handleFilterChange("start_date", e.target.value)
                  }
                />
              </div>
              <div className="col-md-2">
                <Form.Control
                  type="date"
                  placeholder="Fecha fin"
                  value={filters.end_date}
                  onChange={(e) =>
                    handleFilterChange("end_date", e.target.value)
                  }
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
              No se encontraron logs de auditoría
            </Alert>
          ) : (
            <>
              <div className="table-responsive">
                <Table striped bordered hover>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Usuario</th>
                      <th>Acción</th>
                      <th>Modelo</th>
                      <th>ID Modelo</th>
                      <th>Fecha</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id}>
                        <td>{log.id}</td>
                        <td>
                          {log.user ? (
                            <>
                              <strong>{log.user.name}</strong>
                              <br />
                              <small className="text-muted">
                                {log.user.email}
                              </small>
                            </>
                          ) : (
                            <span className="text-muted">Sistema</span>
                          )}
                        </td>
                        <td>
                          <Badge bg={getActionVariant(log.action)}>
                            {log.action}
                          </Badge>
                        </td>
                        <td>
                          <Badge bg="info">{log.model}</Badge>
                        </td>
                        <td>{log.model_id || "—"}</td>
                        <td>{formatDate(log.created_at)}</td>
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
