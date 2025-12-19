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
  FaEdit,
  FaEye,
  FaTrashAlt,
  FaUserPlus,
  FaFilter,
  FaKey,
  FaToggleOn,
  FaToggleOff,
} from "react-icons/fa";
import { toast } from "react-toastify";
import { useHasPermission } from "../../hooks/useHasPermission";
import { usersService, rolesService } from "../../services/adminApi";
import UserForm from "../../components/admin/UserForm";
import UserRolesModal from "../../components/admin/UserRolesModal";

const UsersList = () => {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage] = useState(15);
  const [total, setTotal] = useState(0);
  const [showUserForm, setShowUserForm] = useState(false);
  const [showRolesModal, setShowRolesModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  const canCreate = useHasPermission("users.create");
  const canEdit = useHasPermission("users.edit");
  const canDelete = useHasPermission("users.delete");
  const canView = useHasPermission("users.view");
  const canAssignRoles = useHasPermission("users.assign_roles");
  const canToggleStatus = useHasPermission("users.disable");

  useEffect(() => {
    loadUsers();
    loadRoles();
  }, [currentPage, searchTerm, statusFilter, roleFilter]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {
        page: currentPage,
        per_page: perPage,
        ...(searchTerm && { search: searchTerm }),
        ...(statusFilter && { status: statusFilter }),
        ...(roleFilter && { role_id: roleFilter }),
      };

      const response = await usersService.list(params);
      
      // Manejar diferentes estructuras de respuesta del backend
      let usersData = [];
      let totalCount = 0;
      
      // Log para debugging
      if (import.meta.env.DEV) {
        console.log("📥 Respuesta del backend:", {
          response,
          type: typeof response,
          isArray: Array.isArray(response),
          keys: response && typeof response === 'object' ? Object.keys(response) : null,
        });
      }
      
      // Estructura: { data: { data: [...], pagination: {...} }, message: "...", success: true }
      if (response && response.data) {
        // Verificar si response.data tiene una propiedad 'data' (estructura anidada)
        if (response.data.data && Array.isArray(response.data.data)) {
          // Estructura anidada: { data: { data: [...], pagination: {...} } }
          usersData = response.data.data;
          totalCount = response.data.pagination?.total || response.data.pagination?.total_count || usersData.length;
        } else if (Array.isArray(response.data)) {
          // Estructura simple: { data: [...] }
          usersData = response.data;
          totalCount = response.meta?.total || response.meta?.total_count || response.pagination?.total || usersData.length;
        } else {
          // Intentar encontrar un array en response.data
          const possibleArrays = Object.values(response.data).filter(Array.isArray);
          if (possibleArrays.length > 0) {
            usersData = possibleArrays[0];
            totalCount = response.data.pagination?.total || response.data.meta?.total || usersData.length;
          }
        }
      } else if (Array.isArray(response)) {
        // Si la respuesta es directamente un array
        usersData = response;
        totalCount = response.length;
      } else if (response && response.users) {
        // Si la respuesta tiene estructura { users: [...] }
        usersData = Array.isArray(response.users) ? response.users : [];
        totalCount = response.meta?.total || response.pagination?.total || response.total || usersData.length;
      } else if (response && typeof response === 'object') {
        // Intentar encontrar un array en cualquier propiedad
        const possibleArrays = Object.values(response).filter(Array.isArray);
        if (possibleArrays.length > 0) {
          usersData = possibleArrays[0];
          totalCount = response.meta?.total || response.pagination?.total || response.total || usersData.length;
        } else {
          console.warn("⚠️ No se encontró un array en la respuesta:", response);
          usersData = [];
        }
      } else {
        // Fallback: intentar usar la respuesta directamente si es un array
        usersData = Array.isArray(response) ? response : [];
        totalCount = usersData.length;
      }
      
      // Asegurar que siempre sea un array
      if (!Array.isArray(usersData)) {
        console.warn("⚠️ La respuesta de usuarios no es un array:", response);
        usersData = [];
      }
      
      // Normalizar los datos: convertir is_active (booleano) a status (string)
      const normalizedUsers = usersData.map(user => ({
        ...user,
        // Si tiene is_active pero no status, convertir is_active a status
        status: user.status || (user.is_active ? "active" : "inactive"),
        // Mantener is_active para compatibilidad
        is_active: user.is_active !== undefined ? user.is_active : (user.status === "active")
      }));
      
      setUsers(normalizedUsers);
      setTotal(totalCount || normalizedUsers.length);
      
      // Log para debugging
      if (import.meta.env.DEV) {
        console.log("✅ Usuarios cargados:", {
          count: normalizedUsers.length,
          total: totalCount,
          structure: response,
          normalizedUsers: normalizedUsers.slice(0, 2), // Primeros 2 para no saturar la consola
        });
      }
    } catch (err) {
      const errorMessage = err.response?.status === 403 
        ? "No tienes permisos para ver usuarios. Contacta al administrador."
        : err.message || "Error al cargar usuarios";
      
      setError(errorMessage);
      toast.error(errorMessage);
      
      // Log para debugging
      if (import.meta.env.DEV) {
        console.error("❌ Error cargando usuarios:", {
          error: err,
          status: err.response?.status,
          url: err.response?.url,
          message: err.message,
          response: err.response,
        });
      }
      
      // Si hay error, asegurar que users sea un array vacío
      setUsers([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const loadRoles = async () => {
    try {
      const response = await rolesService.list({ per_page: 100 });
      setRoles(response.data || []);
    } catch (err) {
      console.error("Error al cargar roles:", err);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    loadUsers();
  };

  const handleToggleStatus = async (user) => {
    if (!canToggleStatus) {
      toast.error("No tienes permiso para realizar esta acción");
      return;
    }

    if (
      !window.confirm(
        `¿Estás seguro de ${user.status === "active" ? "desactivar" : "activar"} a ${user.name}?`
      )
    ) {
      return;
    }

    try {
      setActionLoading(user.id);
      await usersService.toggleStatus(user.id);
      toast.success(
        `Usuario ${user.status === "active" ? "desactivado" : "activado"} correctamente`
      );
      loadUsers();
    } catch (err) {
      toast.error(err.message || "Error al cambiar el estado del usuario");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (user) => {
    if (!canDelete) {
      toast.error("No tienes permiso para realizar esta acción");
      return;
    }

    if (
      !window.confirm(
        `¿Estás seguro de eliminar a ${user.name}? Esta acción no se puede deshacer.`
      )
    ) {
      return;
    }

    try {
      setActionLoading(user.id);
      await usersService.delete(user.id);
      toast.success("Usuario eliminado correctamente");
      loadUsers();
    } catch (err) {
      toast.error(err.message || "Error al eliminar usuario");
    } finally {
      setActionLoading(null);
    }
  };

  const handleResetPassword = async (user) => {
    if (
      !window.confirm(
        `¿Estás seguro de resetear la contraseña de ${user.name}? Se enviará una nueva contraseña por email.`
      )
    ) {
      return;
    }

    try {
      setActionLoading(`reset-${user.id}`);
      await usersService.resetPassword(user.id);
      toast.success("Contraseña reseteada. Se envió un email al usuario.");
    } catch (err) {
      toast.error(err.message || "Error al resetear contraseña");
    } finally {
      setActionLoading(null);
    }
  };

  const handleEdit = (user) => {
    setSelectedUser(user);
    setShowUserForm(true);
  };

  const handleView = (user) => {
    setSelectedUser(user);
    setShowUserForm(true);
  };

  const handleAssignRoles = (user) => {
    setSelectedUser(user);
    setShowRolesModal(true);
  };

  const handleFormClose = () => {
    setShowUserForm(false);
    setSelectedUser(null);
    loadUsers();
  };

  const handleRolesModalClose = () => {
    setShowRolesModal(false);
    setSelectedUser(null);
    loadUsers();
  };

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="container-fluid py-4">
      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center">
          <h4 className="mb-0">
            <FaUserPlus className="me-2" />
            Administración de Usuarios
          </h4>
          <Button
            variant="primary"
            onClick={() => {
              setSelectedUser(null);
              setShowUserForm(true);
            }}
            disabled={!canCreate}
            title={canCreate ? "Crear Usuario" : "No tienes permisos para crear usuarios"}
          >
            <FaUserPlus className="me-2" />
            Crear Usuario
          </Button>
        </Card.Header>
        <Card.Body>
          <Form onSubmit={handleSearch} className="mb-4">
            <div className="row g-3">
              <div className="col-md-4">
                <InputGroup>
                  <InputGroup.Text>
                    <FaSearch />
                  </InputGroup.Text>
                  <Form.Control
                    type="text"
                    placeholder="Buscar por nombre o email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </InputGroup>
              </div>
              <div className="col-md-3">
                <Form.Select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                >
                  <option value="">Todos los estados</option>
                  <option value="active">Activos</option>
                  <option value="inactive">Inactivos</option>
                </Form.Select>
              </div>
              <div className="col-md-3">
                <Form.Select
                  value={roleFilter}
                  onChange={(e) => {
                    setRoleFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                >
                  <option value="">Todos los roles</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </Form.Select>
              </div>
              <div className="col-md-2">
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
          ) : !Array.isArray(users) || users.length === 0 ? (
            <Alert variant="info" className="text-center">
              No se encontraron usuarios
            </Alert>
          ) : (
            <>
              <div className="table-responsive">
                <Table striped bordered hover>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Nombre</th>
                      <th>Email</th>
                      <th>Roles</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.isArray(users) && users.length > 0 ? (
                      users.map((user) => (
                        <tr key={user.id}>
                          <td>{user.id}</td>
                          <td>{user.name}</td>
                          <td>{user.email}</td>
                          <td>
                            {user.roles && user.roles.length > 0 ? (
                              <div className="d-flex flex-wrap gap-1">
                                {user.roles.map((role) => (
                                  <Badge key={role.id} bg="secondary">
                                    {role.name}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted">Sin roles</span>
                            )}
                          </td>
                          <td>
                            <Badge bg={user.status === "active" ? "success" : "secondary"}>
                              {user.status === "active" ? "Activo" : "Inactivo"}
                            </Badge>
                          </td>
                          <td>
                            <div className="d-flex gap-2">
                              <Button
                                variant="info"
                                size="sm"
                                onClick={() => handleView(user)}
                                title="Ver detalles"
                              >
                                <FaEye />
                              </Button>
                              <Button
                                variant="warning"
                                size="sm"
                                onClick={() => handleEdit(user)}
                                title={canEdit ? "Editar" : "Ver detalles (sin permisos para editar)"}
                                disabled={actionLoading === user.id || !canEdit}
                              >
                                <FaEdit />
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleAssignRoles(user)}
                                title={canAssignRoles ? "Asignar roles" : "Ver roles (sin permisos para modificar)"}
                                disabled={actionLoading === user.id || !canAssignRoles}
                              >
                                <FaKey />
                              </Button>
                              <Button
                                variant={user.status === "active" ? "danger" : "success"}
                                size="sm"
                                onClick={() => handleToggleStatus(user)}
                                title={
                                  canToggleStatus 
                                    ? (user.status === "active" ? "Desactivar" : "Activar")
                                    : "Ver estado (sin permisos para modificar)"
                                }
                                disabled={actionLoading === user.id || !canToggleStatus}
                              >
                                {actionLoading === user.id ? (
                                  <Spinner size="sm" />
                                ) : user.status === "active" ? (
                                  <FaToggleOff />
                                ) : (
                                  <FaToggleOn />
                                )}
                              </Button>
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => handleDelete(user)}
                                title={canDelete ? "Eliminar" : "Eliminar (sin permisos)"}
                                disabled={actionLoading === user.id || !canDelete}
                              >
                                {actionLoading === user.id ? (
                                  <Spinner size="sm" />
                                ) : (
                                  <FaTrashAlt />
                                )}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="text-center text-muted">
                          No hay usuarios para mostrar
                        </td>
                      </tr>
                    )}
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

      {showUserForm && (
        <UserForm
          show={showUserForm}
          onHide={handleFormClose}
          user={selectedUser}
          isViewOnly={selectedUser ? !canEdit : !canCreate}
        />
      )}

      {showRolesModal && selectedUser && (
        <UserRolesModal
          show={showRolesModal}
          onHide={handleRolesModalClose}
          user={selectedUser}
        />
      )}
    </div>
  );
};

export default UsersList;

