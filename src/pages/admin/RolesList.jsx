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
  FaEdit,
  FaTrashAlt,
  FaPlus,
  FaKey,
  FaUsers,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useHasPermission } from "../../hooks/useHasPermission";
import { rolesService } from "../../services/adminApi";

const RolesList = () => {
  const navigate = useNavigate();
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage] = useState(15);
  const [total, setTotal] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [formData, setFormData] = useState({ name: "", slug: "", description: "" });
  const [formErrors, setFormErrors] = useState({});

  const canCreate = useHasPermission("roles.create");
  const canEdit = useHasPermission("roles.edit");
  const canDelete = useHasPermission("roles.delete");
  const canManagePermissions = useHasPermission("roles.assign_permissions");

  useEffect(() => {
    loadRoles();
  }, [currentPage, searchTerm]);

  const loadRoles = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {
        page: currentPage,
        per_page: perPage,
        ...(searchTerm && { search: searchTerm }),
      };

      const response = await rolesService.list(params);
      setRoles(response.data || []);
      setTotal(response.meta?.total || 0);
    } catch (err) {
      let errorMessage = "Error al cargar roles";
      
      if (err.response?.status === 500) {
        errorMessage = "Error del servidor al cargar roles. Por favor, contacta al administrador o revisa los logs del backend.";
      } else if (err.response?.status === 403) {
        errorMessage = "No tienes permisos para ver roles. Contacta al administrador.";
      } else if (err.response?.status === 401) {
        errorMessage = "Sesión expirada. Por favor, inicia sesión nuevamente.";
      } else {
        errorMessage = err.message || "Error al cargar roles";
      }
      
      setError(errorMessage);
      toast.error(errorMessage);
      
      // Log para debugging
      if (import.meta.env.DEV) {
        console.error("Error cargando roles:", {
          error: err,
          status: err.response?.status,
          url: err.response?.url,
          message: err.message,
          code: err.response?.data?.code,
          backendMessage: err.response?.data?.message,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    loadRoles();
  };

  const handleCreate = () => {
    if (!canCreate) {
      toast.error("No tienes permiso para crear roles");
      return;
    }
    setSelectedRole(null);
    setFormData({ name: "", slug: "", description: "" });
    setFormErrors({});
    setShowForm(true);
  };

  const handleEdit = (role) => {
    if (!canEdit) {
      toast.error("No tienes permiso para editar roles");
      return;
    }
    setSelectedRole(role);
    setFormData({
      name: role.name || "",
      slug: role.slug || "",
      description: role.description || "",
    });
    setFormErrors({});
    setShowForm(true);
  };

  const handleDelete = async (role) => {
    if (!canDelete) {
      toast.error("No tienes permiso para eliminar roles");
      return;
    }

    if (
      !window.confirm(
        `¿Estás seguro de eliminar el rol "${role.name}"? Esta acción no se puede deshacer.`
      )
    ) {
      return;
    }

    try {
      setActionLoading(role.id);
      await rolesService.delete(role.id);
      toast.success("Rol eliminado correctamente");
      loadRoles();
    } catch (err) {
      toast.error(err.message || "Error al eliminar rol");
    } finally {
      setActionLoading(null);
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormErrors({});

    try {
      if (selectedRole) {
        await rolesService.update(selectedRole.id, formData);
        toast.success("Rol actualizado correctamente");
      } else {
        await rolesService.create(formData);
        toast.success("Rol creado correctamente");
      }
      setShowForm(false);
      loadRoles();
    } catch (err) {
      console.error("Error al guardar rol:", err);
      
      if (err.response?.status === 422) {
        const backendErrors = err.response.errors || err.response.data?.errors;
        if (backendErrors) {
          setFormErrors(backendErrors);
          const firstError = Object.values(backendErrors).flat()[0];
          if (firstError) {
            toast.error(firstError);
          }
        } else {
          toast.error(err.response.data?.message || "Error de validación");
        }
      } else {
        toast.error(err.message || "Error al guardar rol");
      }
    }
  };

  const handleManagePermissions = (role) => {
    if (!canManagePermissions) {
      toast.error("No tienes permiso para gestionar permisos");
      return;
    }
    navigate(`/admin/roles/${role.id}/permissions`);
  };

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="container-fluid py-4">
      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center">
          <h4 className="mb-0">
            <FaKey className="me-2" />
            Administración de Roles
          </h4>
          {canCreate && (
            <Button variant="primary" onClick={handleCreate}>
              <FaPlus className="me-2" />
              Crear Rol
            </Button>
          )}
        </Card.Header>
        <Card.Body>
          <Form onSubmit={handleSearch} className="mb-4">
            <div className="row g-3">
              <div className="col-md-10">
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
              <div className="col-md-2">
                <Button type="submit" variant="outline-primary" className="w-100">
                  Buscar
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
          ) : roles.length === 0 ? (
            <Alert variant="info" className="text-center">
              No se encontraron roles
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
                      <th>Descripción</th>
                      <th>Usuarios</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roles.map((role) => (
                      <tr key={role.id}>
                        <td>{role.id}</td>
                        <td>{role.name}</td>
                        <td>
                          <Badge bg="secondary">{role.slug}</Badge>
                        </td>
                        <td>{role.description || "—"}</td>
                        <td>
                          <Badge bg="info">
                            <FaUsers className="me-1" />
                            {role.users_count || 0}
                          </Badge>
                        </td>
                        <td>
                          <div className="d-flex gap-2">
                            {canManagePermissions && (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleManagePermissions(role)}
                                title="Gestionar permisos"
                              >
                                <FaKey />
                              </Button>
                            )}
                            {canEdit && (
                              <Button
                                variant="warning"
                                size="sm"
                                onClick={() => handleEdit(role)}
                                title="Editar"
                              >
                                <FaEdit />
                              </Button>
                            )}
                            {canDelete && (
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => handleDelete(role)}
                                title="Eliminar"
                                disabled={actionLoading === role.id}
                              >
                                {actionLoading === role.id ? (
                                  <Spinner size="sm" />
                                ) : (
                                  <FaTrashAlt />
                                )}
                              </Button>
                            )}
                          </div>
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

      <Modal show={showForm} onHide={() => setShowForm(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            {selectedRole ? "Editar Rol" : "Crear Rol"}
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleFormSubmit}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>
                Nombre <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                isInvalid={!!formErrors.name}
                required
              />
              <Form.Control.Feedback type="invalid">
                {formErrors.name}
              </Form.Control.Feedback>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>
                Slug <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                type="text"
                value={formData.slug}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    slug: e.target.value.toLowerCase().replace(/\s+/g, "-"),
                  })
                }
                isInvalid={!!formErrors.slug}
                required
                placeholder="ej: admin, usuario, editor"
              />
              <Form.Control.Feedback type="invalid">
                {formErrors.slug}
              </Form.Control.Feedback>
              <Form.Text className="text-muted">
                Identificador único del rol (solo letras, números y guiones)
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Descripción</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                isInvalid={!!formErrors.description}
              />
              <Form.Control.Feedback type="invalid">
                {formErrors.description}
              </Form.Control.Feedback>
            </Form.Group>

            {Object.keys(formErrors).length > 0 && (
              <Alert variant="danger">
                <strong>Errores de validación:</strong>
                <ul className="mb-0">
                  {Object.entries(formErrors).map(([key, value]) => {
                    if (Array.isArray(value)) {
                      return value.map((msg, idx) => (
                        <li key={`${key}-${idx}`}>{msg}</li>
                      ));
                    }
                    return <li key={key}>{value}</li>;
                  })}
                </ul>
              </Alert>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="secondary"
              onClick={() => setShowForm(false)}
            >
              Cancelar
            </Button>
            <Button variant="primary" type="submit">
              {selectedRole ? "Actualizar" : "Crear"}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default RolesList;

