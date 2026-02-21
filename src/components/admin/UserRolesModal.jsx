import React, { useState, useEffect } from "react";
import { Modal, Form, Button, Spinner, Alert } from "react-bootstrap";
import { toast } from "react-toastify";
import { useHasPermission } from "../../hooks/useHasPermission";
import { usersService, rolesService } from "../../services/adminApi";

const UserRolesModal = ({ show, onHide, user }) => {
  const canAssignRoles = useHasPermission("users.assign_roles");
  const [loading, setLoading] = useState(false);
  const [roles, setRoles] = useState([]);
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (show && user) {
      loadRoles();
      loadUserRoles();
    }
  }, [show, user]);

  const loadRoles = async () => {
    try {
      setError(null);
      const response = await rolesService.list({ per_page: 100 });
      setRoles(response.data || []);
    } catch (err) {
      let errorMessage = "Error al cargar roles";
      
      if (err.response?.status === 500) {
        errorMessage = "Error del servidor. Por favor, contacta al administrador.";
      } else if (err.response?.status === 403) {
        errorMessage = "No tienes permisos para ver roles.";
      } else {
        errorMessage = err.message || "Error al cargar roles";
      }
      
      setError(errorMessage);
      toast.error(errorMessage);
      
      if (import.meta.env.DEV) {
        console.error("Error cargando roles en modal:", err);
      }
    }
  };

  const loadUserRoles = async () => {
    try {
      const userData = await usersService.get(user.id);
      setSelectedRoles(
        userData?.roles ? userData.roles.map((r) => r.id) : []
      );
    } catch (err) {
      setError("Error al cargar roles del usuario");
      console.error(err);
    }
  };

  const handleToggleRole = (roleId) => {
    if (!canAssignRoles) {
      toast.error("No tienes permisos para modificar roles");
      return;
    }
    setSelectedRoles((prev) =>
      prev.includes(roleId)
        ? prev.filter((id) => id !== roleId)
        : [...prev, roleId]
    );
  };

  const handleSelectAll = () => {
    if (!canAssignRoles) {
      toast.error("No tienes permisos para modificar roles");
      return;
    }
    if (selectedRoles.length === roles.length) {
      setSelectedRoles([]);
    } else {
      setSelectedRoles(roles.map((r) => r.id));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canAssignRoles) {
      toast.error("No tienes permisos para asignar roles");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      await usersService.assignRoles(user.id, selectedRoles);
      toast.success("Roles asignados correctamente");
      onHide();
    } catch (err) {
      let errorMessage = "Error al asignar roles";
      
      // Manejo específico de errores de validación (422)
      if (err.response?.status === 422) {
        // El backend ahora retorna mensajes claros sobre roles inválidos
        errorMessage = err.response?.data?.message || err.message || "Uno o más roles seleccionados no son válidos";
        
        // Si hay errores específicos en el objeto errors, mostrarlos también
        if (err.response?.data?.errors) {
          const errorDetails = Object.values(err.response.data.errors).flat();
          if (errorDetails.length > 0) {
            errorMessage += ": " + errorDetails.join(", ");
          }
        }
      } else if (err.response?.status === 500) {
        errorMessage = err.response?.data?.message || "Error del servidor. Por favor, contacta al administrador.";
      } else {
        errorMessage = err.response?.data?.message || err.message || "Error al asignar roles";
      }
      
      setError(errorMessage);
      toast.error(errorMessage);
      
      if (import.meta.env.DEV) {
        console.error("Error al asignar roles:", {
          error: err,
          status: err.response?.status,
          data: err.response?.data,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>Asignar Roles a {user?.name}</Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          {error && (
            <Alert variant="danger" dismissible onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <div className="d-flex justify-content-between align-items-center mb-3">
            <h6 className="mb-0">Seleccionar Roles</h6>
            <Button
              type="button"
              variant="outline-primary"
              size="sm"
              onClick={handleSelectAll}
              disabled={!canAssignRoles}
              title={canAssignRoles ? "" : "No tienes permisos para modificar roles"}
            >
              {selectedRoles.length === roles.length
                ? "Limpiar Todo"
                : "Seleccionar Todos"}
            </Button>
          </div>

          <div className="border rounded p-3" style={{ maxHeight: "400px", overflowY: "auto" }}>
            {roles.length === 0 ? (
              <p className="text-muted text-center">No hay roles disponibles</p>
            ) : (
              roles.map((role) => (
                <Form.Check
                  key={role.id}
                  type="checkbox"
                  id={`role-${role.id}`}
                  label={role.name}
                  checked={selectedRoles.includes(role.id)}
                  onChange={() => handleToggleRole(role.id)}
                  disabled={!canAssignRoles}
                  className="mb-2"
                />
              ))
            )}
          </div>

          {selectedRoles.length > 0 && (
            <Alert variant="info" className="mt-3 mb-0">
              <strong>{selectedRoles.length}</strong> rol(es) seleccionado(s)
            </Alert>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide} disabled={loading}>
            {canAssignRoles ? "Cancelar" : "Cerrar"}
          </Button>
          {canAssignRoles && (
            <Button variant="primary" type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Spinner size="sm" className="me-2" />
                  Guardando...
                </>
              ) : (
                "Guardar"
              )}
            </Button>
          )}
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default UserRolesModal;

