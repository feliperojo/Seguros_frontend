import React, { useState, useEffect } from "react";
import {
  Container,
  Table,
  Form,
  InputGroup,
  Button,
  Spinner,
  Pagination,
  Alert,
  Row,
  Col,
} from "react-bootstrap";
import { Helmet } from "react-helmet-async";
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
  FaUsers,
  FaSyncAlt,
  FaTable,
} from "react-icons/fa";
import { toast } from "react-toastify";
import { useHasPermission } from "../../hooks/useHasPermission";
import { useAuth } from "../../context/AuthContext";
import { usersService, rolesService } from "../../services/adminApi";
import UserForm from "../../components/admin/UserForm";
import UserRolesModal from "../../components/admin/UserRolesModal";
import "../styles/GruposFamiliaresListado.css";
import "../styles/UsersList.css";

const getUserOnline = (user, isPresenceLive, onlineUserIds) => (
  isPresenceLive
    ? Boolean(onlineUserIds?.has(Number(user.id)))
    : Boolean(user.is_online)
);

/** last_login_at solo cambia al iniciar sesión; last_seen_at refleja actividad reciente (heartbeat). */
const getConnectionSubtext = (user, isOnline) => {
  if (isOnline) {
    return user.last_seen_at
      ? `Activa ahora · ${user.last_seen_at}`
      : "Activa ahora";
  }
  if (user.last_seen_at) {
    return `Últ. actividad: ${user.last_seen_at}`;
  }
  if (user.last_login_at) {
    return `Últ. inicio de sesión: ${user.last_login_at}`;
  }
  return null;
};

const UsersList = () => {
  const { onlineUserIds, isPresenceLive } = useAuth();
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

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (!document.hidden) {
        loadUsers();
      }
    }, 20000);
    return () => clearInterval(intervalId);
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

      let usersData = [];
      let totalCount = 0;

      if (import.meta.env.DEV) {
        console.log("📥 Respuesta del backend:", {
          response,
          type: typeof response,
          isArray: Array.isArray(response),
          keys: response && typeof response === "object" ? Object.keys(response) : null,
        });
      }

      if (response && response.data) {
        if (response.data.data && Array.isArray(response.data.data)) {
          usersData = response.data.data;
          totalCount = response.data.pagination?.total || response.data.pagination?.total_count || usersData.length;
        } else if (Array.isArray(response.data)) {
          usersData = response.data;
          totalCount = response.meta?.total || response.meta?.total_count || response.pagination?.total || usersData.length;
        } else {
          const possibleArrays = Object.values(response.data).filter(Array.isArray);
          if (possibleArrays.length > 0) {
            usersData = possibleArrays[0];
            totalCount = response.data.pagination?.total || response.data.meta?.total || usersData.length;
          }
        }
      } else if (Array.isArray(response)) {
        usersData = response;
        totalCount = response.length;
      } else if (response && response.users) {
        usersData = Array.isArray(response.users) ? response.users : [];
        totalCount = response.meta?.total || response.pagination?.total || response.total || usersData.length;
      } else if (response && typeof response === "object") {
        const possibleArrays = Object.values(response).filter(Array.isArray);
        if (possibleArrays.length > 0) {
          usersData = possibleArrays[0];
          totalCount = response.meta?.total || response.pagination?.total || response.total || usersData.length;
        } else {
          console.warn("⚠️ No se encontró un array en la respuesta:", response);
          usersData = [];
        }
      } else {
        usersData = Array.isArray(response) ? response : [];
        totalCount = usersData.length;
      }

      if (!Array.isArray(usersData)) {
        console.warn("⚠️ La respuesta de usuarios no es un array:", response);
        usersData = [];
      }

      const normalizedUsers = usersData.map((user) => ({
        ...user,
        status: user.status || (user.is_active ? "active" : "inactive"),
        is_active: user.is_active !== undefined ? user.is_active : (user.status === "active"),
      }));

      setUsers(normalizedUsers);
      setTotal(totalCount || normalizedUsers.length);

      if (import.meta.env.DEV) {
        console.log("✅ Usuarios cargados:", {
          count: normalizedUsers.length,
          total: totalCount,
        });
      }
    } catch (err) {
      const errorMessage = err.response?.status === 403
        ? "No tienes permisos para ver usuarios. Contacta al administrador."
        : err.message || "Error al cargar usuarios";

      setError(errorMessage);
      toast.error(errorMessage);

      if (import.meta.env.DEV) {
        console.error("❌ Error cargando usuarios:", err);
      }

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
      const newIsActive = user.status !== "active";
      await usersService.toggleStatus(user.id, newIsActive);
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
    <Container fluid className="gf-listado-container py-3 users-admin">
      <Helmet>
        <title>Vantun / Administración de usuarios</title>
      </Helmet>

      <div className="gf-listado">
        <div className="gf-listado__header gf-listado__header--split">
          <div className="gf-listado__header-main">
            <div className="gf-listado__header-icon" aria-hidden="true">
              <FaUsers />
            </div>
            <div>
              <h1 className="gf-listado__title">Administración de Usuarios</h1>
              <p className="gf-listado__subtitle">
                Gestiona cuentas, roles y estado de conexión del equipo.
              </p>
            </div>
          </div>
          <div className="gf-listado__header-actions">
            <span className="gf-listado__chip">
              {loading ? "Cargando…" : `${total} usuario${total !== 1 ? "s" : ""}`}
            </span>
            <Button
              size="sm"
              className="gf-listado__btn-ghost"
              onClick={loadUsers}
              disabled={loading}
            >
              <FaSyncAlt className={loading ? "fa-spin me-1" : "me-1"} />
              Actualizar
            </Button>
            <Button
              size="sm"
              className="users-admin__btn-create"
              onClick={() => {
                setSelectedUser(null);
                setShowUserForm(true);
              }}
              disabled={!canCreate}
              title={canCreate ? "Crear usuario" : "No tienes permisos para crear usuarios"}
            >
              <FaUserPlus className="me-1" />
              Crear usuario
            </Button>
          </div>
        </div>

        <div className="gf-listado__body">
          <div className="gf-listado__section">
            <div className="gf-listado__section-title">
              <FaFilter aria-hidden="true" />
              Filtros
            </div>

            <Form onSubmit={handleSearch}>
              <Row className="g-3 align-items-end">
                <Col xs={12} md={6} lg={4}>
                  <div className="gf-listado__label">Buscar</div>
                  <InputGroup>
                    <Form.Control
                      type="text"
                      placeholder="Buscar por nombre o email..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <Button
                      type="submit"
                      variant="outline-secondary"
                      className="gf-listado__btn-icon"
                      aria-label="Filtrar"
                    >
                      <FaSearch />
                    </Button>
                  </InputGroup>
                </Col>
                <Col xs={12} sm={6} lg={3}>
                  <div className="gf-listado__label">Estado</div>
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
                </Col>
                <Col xs={12} sm={6} lg={3}>
                  <div className="gf-listado__label">Rol</div>
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
                </Col>
                <Col xs={12} sm={6} lg={2}>
                  <Button type="submit" variant="outline-secondary" className="gf-listado__btn-icon w-100">
                    <FaFilter className="me-1" />
                    Filtrar
                  </Button>
                </Col>
              </Row>
            </Form>
          </div>

          {error && (
            <Alert variant="danger" className="users-admin__alert" dismissible onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <div className="gf-listado__section gf-listado__section--table">
            <div className="gf-listado__section-title">
              <FaTable aria-hidden="true" />
              Usuarios
            </div>

            {!loading && users.length > 0 && (
              <div className="gf-listado__summary">
                Página <strong>{currentPage}</strong> de <strong>{Math.max(totalPages, 1)}</strong>
                {" · "}
                <strong>{users.length}</strong> en esta página
              </div>
            )}

            {loading ? (
              <div className="users-admin__loading">
                <Spinner animation="border" role="status" />
                <div className="mt-2">Cargando usuarios…</div>
              </div>
            ) : !Array.isArray(users) || users.length === 0 ? (
              <div className="gf-listado__empty">No se encontraron usuarios</div>
            ) : (
              <>
                <div className="gf-listado__table-wrap">
                  <Table hover className="gf-listado__table mb-0 align-middle">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Nombre</th>
                        <th>Email</th>
                        <th>Roles</th>
                        <th>Estado</th>
                        <th>Conexión</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => {
                        const isOnline = getUserOnline(user, isPresenceLive, onlineUserIds);
                        const connectionSubtext = getConnectionSubtext(user, isOnline);

                        return (
                          <tr key={user.id}>
                            <td>{user.id}</td>
                            <td className="gf-listado__producto">{user.name}</td>
                            <td>{user.email}</td>
                            <td>
                              {user.roles && user.roles.length > 0 ? (
                                <div className="d-flex flex-wrap gap-1">
                                  {user.roles.map((role) => (
                                    <span key={role.id} className="users-admin__rol">
                                      {role.name}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-muted small">Sin roles</span>
                              )}
                            </td>
                            <td>
                              <span
                                className={`users-admin__estado ${
                                  user.status === "active"
                                    ? "users-admin__estado--activo"
                                    : "users-admin__estado--inactivo"
                                }`}
                              >
                                {user.status === "active" ? "Activo" : "Inactivo"}
                              </span>
                            </td>
                            <td>
                              <span
                                className={`users-admin__conexion ${
                                  isOnline
                                    ? "users-admin__conexion--online"
                                    : "users-admin__conexion--offline"
                                }`}
                              >
                                {isOnline ? "En línea" : "Desconectado"}
                              </span>
                              {connectionSubtext && (
                                <div className="users-admin__conexion-meta">
                                  {connectionSubtext}
                                </div>
                              )}
                            </td>
                            <td>
                              <div className="users-admin__acciones">
                                <button
                                  type="button"
                                  className="users-admin__btn-accion"
                                  onClick={() => handleView(user)}
                                  title="Ver detalles"
                                  aria-label="Ver detalles"
                                  disabled={!canView}
                                >
                                  <FaEye />
                                </button>
                                <button
                                  type="button"
                                  className="users-admin__btn-accion users-admin__btn-accion--edit"
                                  onClick={() => handleEdit(user)}
                                  title={canEdit ? "Editar" : "Sin permisos para editar"}
                                  aria-label="Editar"
                                  disabled={actionLoading === user.id || !canEdit}
                                >
                                  {actionLoading === user.id ? <Spinner size="sm" /> : <FaEdit />}
                                </button>
                                <button
                                  type="button"
                                  className="users-admin__btn-accion"
                                  onClick={() => handleAssignRoles(user)}
                                  title={canAssignRoles ? "Asignar roles" : "Sin permisos"}
                                  aria-label="Asignar roles"
                                  disabled={actionLoading === user.id || !canAssignRoles}
                                >
                                  <FaKey />
                                </button>
                                <button
                                  type="button"
                                  className={`users-admin__btn-accion ${
                                    user.status === "active"
                                      ? "users-admin__btn-accion--toggle-off"
                                      : "users-admin__btn-accion--toggle-on"
                                  }`}
                                  onClick={() => handleToggleStatus(user)}
                                  title={
                                    canToggleStatus
                                      ? (user.status === "active" ? "Desactivar" : "Activar")
                                      : "Sin permisos"
                                  }
                                  aria-label="Cambiar estado"
                                  disabled={actionLoading === user.id || !canToggleStatus}
                                >
                                  {actionLoading === user.id ? (
                                    <Spinner size="sm" />
                                  ) : user.status === "active" ? (
                                    <FaToggleOff />
                                  ) : (
                                    <FaToggleOn />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  className="users-admin__btn-accion users-admin__btn-accion--delete"
                                  onClick={() => handleDelete(user)}
                                  title={canDelete ? "Eliminar" : "Sin permisos"}
                                  aria-label="Eliminar"
                                  disabled={actionLoading === user.id || !canDelete}
                                >
                                  {actionLoading === user.id ? (
                                    <Spinner size="sm" />
                                  ) : (
                                    <FaTrashAlt />
                                  )}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                </div>

                {totalPages > 1 && (
                  <div className="users-admin__pagination">
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
          </div>
        </div>
      </div>

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
    </Container>
  );
};

export default UsersList;
