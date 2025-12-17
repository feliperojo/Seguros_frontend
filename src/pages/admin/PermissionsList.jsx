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
import { FaSearch, FaFilter } from "react-icons/fa";
import { toast } from "react-toastify";
import { permissionsService } from "../../services/adminApi";

const PermissionsList = () => {
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage] = useState(20);
  const [total, setTotal] = useState(0);
  const [modules, setModules] = useState([]);

  useEffect(() => {
    loadPermissions();
  }, [currentPage, searchTerm, moduleFilter]);

  const loadPermissions = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {
        page: currentPage,
        per_page: perPage,
        ...(searchTerm && { search: searchTerm }),
        ...(moduleFilter && { module: moduleFilter }),
      };

      const response = await permissionsService.list(params);
      setPermissions(response.data || []);
      setTotal(response.meta?.total || 0);

      if (response.data) {
        const uniqueModules = [
          ...new Set(response.data.map((p) => p.module || "Otros")),
        ];
        setModules(uniqueModules.sort());
      }
    } catch (err) {
      setError(err.message || "Error al cargar permisos");
      toast.error("Error al cargar permisos");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    loadPermissions();
  };

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="container-fluid py-4">
      <Card>
        <Card.Header>
          <h4 className="mb-0">Administración de Permisos</h4>
        </Card.Header>
        <Card.Body>
          <Form onSubmit={handleSearch} className="mb-4">
            <div className="row g-3">
              <div className="col-md-5">
                <InputGroup>
                  <InputGroup.Text>
                    <FaSearch />
                  </InputGroup.Text>
                  <Form.Control
                    type="text"
                    placeholder="Buscar por nombre o slug..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </InputGroup>
              </div>
              <div className="col-md-4">
                <Form.Select
                  value={moduleFilter}
                  onChange={(e) => {
                    setModuleFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                >
                  <option value="">Todos los módulos</option>
                  {modules.map((module) => (
                    <option key={module} value={module}>
                      {module}
                    </option>
                  ))}
                </Form.Select>
              </div>
              <div className="col-md-3">
                <Button type="submit" variant="outline-primary" className="w-100">
                  <FaFilter className="me-2" />
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
          ) : permissions.length === 0 ? (
            <Alert variant="info" className="text-center">
              No se encontraron permisos
            </Alert>
          ) : (
            <>
              <div className="table-responsive">
                <Table striped bordered hover>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Nombre</th>
                      <th>Slug</th>
                      <th>Módulo</th>
                      <th>Descripción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {permissions.map((permission) => (
                      <tr key={permission.id}>
                        <td>{permission.id}</td>
                        <td>
                          <strong>{permission.name}</strong>
                        </td>
                        <td>
                          <Badge bg="secondary">{permission.slug}</Badge>
                        </td>
                        <td>
                          <Badge bg="info">{permission.module || "Otros"}</Badge>
                        </td>
                        <td>{permission.description || "—"}</td>
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
    </div>
  );
};

export default PermissionsList;
