import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  Table,
  Form,
  Button,
  Spinner,
  Alert,
} from "react-bootstrap";
import { FaClock, FaFilter } from "react-icons/fa";
import { toast } from "react-toastify";
import { useHasPermission } from "../../hooks/useHasPermission";
import { usersService, userSessionsService } from "../../services/adminApi";
import MdyDashDateInput from "../../components/common/MdyDashDateInput";

const toYmd = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const defaultDateFrom = () => {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return toYmd(d);
};

const defaultDateTo = () => toYmd(new Date());

function normalizeUsersList(response) {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (response.data?.data && Array.isArray(response.data.data)) return response.data.data;
  if (Array.isArray(response.data)) return response.data;
  if (response.users && Array.isArray(response.users)) return response.users;
  const arr = Object.values(response).find(Array.isArray);
  return Array.isArray(arr) ? arr : [];
}

function normalizeSummaryRows(response) {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (response.data?.data && Array.isArray(response.data.data)) return response.data.data;
  if (Array.isArray(response.data)) return response.data;
  const arr = Object.values(response).find(Array.isArray);
  return Array.isArray(arr) ? arr : [];
}

const UserSessionsReport = () => {
  const canView = useHasPermission("audit.read");

  const [rows, setRows] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    user_id: "",
    date_from: defaultDateFrom(),
    date_to: defaultDateTo(),
  });

  const loadUsers = useCallback(async () => {
    try {
      setLoadingUsers(true);
      const response = await usersService.list({ per_page: 500 });
      setUsers(normalizeUsersList(response));
    } catch {
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  const loadSummary = useCallback(async () => {
    if (!canView) return;

    try {
      setLoading(true);
      setError(null);

      const params = {
        ...(filters.user_id && { user_id: filters.user_id }),
        ...(filters.date_from && { date_from: filters.date_from }),
        ...(filters.date_to && { date_to: filters.date_to }),
      };

      const response = await userSessionsService.summary(params);
      setRows(normalizeSummaryRows(response));
    } catch (err) {
      const errorMessage =
        err.response?.status === 403
          ? "No tienes permisos para ver horas conectadas. Contacta al administrador."
          : err.message || "Error al cargar el resumen de horas conectadas";
      setError(errorMessage);
      toast.error(errorMessage);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [canView, filters]);

  useEffect(() => {
    if (canView) {
      loadUsers();
    }
  }, [canView, loadUsers]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const handleSearch = (e) => {
    e.preventDefault();
    loadSummary();
  };

  const formatHours = (hours) => {
    const n = Number(hours);
    if (Number.isNaN(n)) return "—";
    return n.toFixed(2);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "—";
    const date = new Date(`${dateString}T00:00:00`);
    return Number.isNaN(date.getTime())
      ? dateString
      : date.toLocaleDateString("es-ES");
  };

  if (!canView) {
    return (
      <div className="container-fluid py-4">
        <Alert variant="danger">
          No tienes permisos para ver el reporte de Horas Conectadas.
        </Alert>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4">
      <Card>
        <Card.Header>
          <h4 className="mb-0">
            <FaClock className="me-2" />
            Horas Conectadas
          </h4>
        </Card.Header>
        <Card.Body>
          <Form onSubmit={handleSearch} className="mb-4">
            <div className="row g-3">
              <div className="col-md-4">
                <Form.Label className="small text-muted mb-1">Usuario</Form.Label>
                <Form.Select
                  value={filters.user_id}
                  onChange={(e) => handleFilterChange("user_id", e.target.value)}
                  disabled={loadingUsers}
                >
                  <option value="">Todos los usuarios</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name || u.email || `Usuario #${u.id}`}
                    </option>
                  ))}
                </Form.Select>
              </div>
              <div className="col-md-3">
                <Form.Label className="small text-muted mb-1">Desde</Form.Label>
                <MdyDashDateInput
                  valueIso={filters.date_from}
                  onChangeIso={(iso) => handleFilterChange("date_from", iso)}
                />
              </div>
              <div className="col-md-3">
                <Form.Label className="small text-muted mb-1">Hasta</Form.Label>
                <MdyDashDateInput
                  valueIso={filters.date_to}
                  onChangeIso={(iso) => handleFilterChange("date_to", iso)}
                />
              </div>
              <div className="col-md-2 d-flex align-items-end">
                <Button type="submit" variant="outline-primary" className="w-100">
                  <FaFilter className="me-1" />
                  Filtrar
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
          ) : rows.length === 0 ? (
            <Alert variant="info" className="mb-0">
              No hay sesiones registradas para los filtros seleccionados.
            </Alert>
          ) : (
            <div className="table-responsive">
              <Table hover striped bordered size="sm" className="mb-0 align-middle">
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Fecha</th>
                    <th className="text-end">Horas conectado</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={`${row.user_id}-${row.date}`}>
                      <td>{row.user_name || `Usuario #${row.user_id}`}</td>
                      <td>{formatDate(row.date)}</td>
                      <td className="text-end">{formatHours(row.hours)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>
    </div>
  );
};

export default UserSessionsReport;
