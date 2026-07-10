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
  Modal,
} from "react-bootstrap";
import { FaSearch, FaFilter, FaPlus } from "react-icons/fa";
import { toast } from "react-toastify";
import { permissionsService } from "../../services/adminApi";
import { useHasPermission } from "../../hooks/useHasPermission";

const INITIAL_FORM = {
  name: "",
  slug: "",
  module: "",
  description: "",
};

const PermissionsList = () => {
  const canCreate = useHasPermission("permissions.create");
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage] = useState(20);
  const [total, setTotal] = useState(0);
  const [modules, setModules] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState(INITIAL_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

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

  const openCreateModal = () => {
    setCreateForm(INITIAL_FORM);
    setCreateError(null);
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setCreateForm(INITIAL_FORM);
    setCreateError(null);
  };

  const handleCreateChange = (field, value) => {
    setCreateForm((prev) => ({ ...prev, [field]: value }));
    setCreateError(null);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    const name = (createForm.name || "").trim();
    if (!name) {
      setCreateError("El nombre es obligatorio (formato: modulo.accion, ej: clientes.read).");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const body = {
        name,
        ...(createForm.slug?.trim() && { slug: createForm.slug.trim() }),
        ...(createForm.module?.trim() && { module: createForm.module.trim() }),
        ...(createForm.description?.trim() && { description: createForm.description.trim() }),
      };
      await permissionsService.create(body);
      toast.success("Permiso creado correctamente");
      closeCreateModal();
      loadPermissions();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Error al crear el permiso";
      setCreateError(msg);
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="container-fluid py-4">
      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <h4 className="mb-0">Administración de Permisos</h4>
          {canCreate && (
            <Button
              variant="primary"
              onClick={openCreateModal}
              title="Crear permiso nuevo"
            >
              <FaPlus className="me-2" />
              Crear permiso
            </Button>
          )}
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

      <Modal show={showCreateModal} onHide={closeCreateModal} centered>
        <Modal.Header closeButton>
          <Modal.Title>Crear permiso nuevo</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleCreateSubmit}>
          <Modal.Body>
            {createError && (
              <Alert variant="danger" dismissible onClose={() => setCreateError(null)}>
                {createError}
              </Alert>
            )}
            <Form.Group className="mb-3">
              <Form.Label>Nombre <span className="text-danger">*</span></Form.Label>
              <Form.Control
                type="text"
                placeholder="modulo.accion (ej: clientes.read, polizas.create)"
                value={createForm.name}
                onChange={(e) => handleCreateChange("name", e.target.value)}
                required
              />
              <Form.Text className="text-muted">
                Formato único: modulo.accion
              </Form.Text>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Slug (opcional)</Form.Label>
              <Form.Control
                type="text"
                placeholder="Si se deja vacío se usará el nombre"
                value={createForm.slug}
                onChange={(e) => handleCreateChange("slug", e.target.value)}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Módulo (opcional)</Form.Label>
              <Form.Control
                type="text"
                placeholder="ej: clientes, polizas"
                value={createForm.module}
                onChange={(e) => handleCreateChange("module", e.target.value)}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Descripción (opcional)</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                placeholder="Descripción visible en la UI"
                value={createForm.description}
                onChange={(e) => handleCreateChange("description", e.target.value)}
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={closeCreateModal} disabled={creating}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={creating}>
              {creating ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" />
                  Creando...
                </>
              ) : (
                "Crear permiso"
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default PermissionsList;
