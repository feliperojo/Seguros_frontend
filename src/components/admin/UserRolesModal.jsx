import React, { useState, useEffect } from "react";
import { Modal, Form, Button, Spinner, Alert } from "react-bootstrap";
import { toast } from "react-toastify";
import { usersService, rolesService } from "../../services/adminApi";

const UserRolesModal = ({ show, onHide, user }) => {
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
      const response = await usersService.get(user.id);
      setSelectedRoles(
        response.roles ? response.roles.map((r) => r.id) : []
      );
    } catch (err) {
      setError("Error al cargar roles del usuario");
      console.error(err);
    }
  };

  const handleToggleRole = (roleId) => {
    setSelectedRoles((prev) =>
      prev.includes(roleId)
        ? prev.filter((id) => id !== roleId)
        : [...prev, roleId]
    );
  };

  const handleSelectAll = () => {
    if (selectedRoles.length === roles.length) {
      setSelectedRoles([]);
    } else {
      setSelectedRoles(roles.map((r) => r.id));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      await usersService.assignRoles(user.id, selectedRoles);
      toast.success("Roles asignados correctamente");
      onHide();
    } catch (err) {
      setError(err.message || "Error al asignar roles");
      toast.error("Error al asignar roles");
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
            Cancelar
          </Button>
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
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default UserRolesModal;

