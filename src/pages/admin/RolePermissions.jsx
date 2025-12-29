import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Card,
  Form,
  Button,
  Spinner,
  Alert,
  Badge,
  Accordion,
} from "react-bootstrap";
import { FaSave, FaCheckSquare, FaSquare, FaArrowLeft } from "react-icons/fa";
import { toast } from "react-toastify";
import { useHasPermission } from "../../hooks/useHasPermission";
import { rolesService, permissionsService } from "../../services/adminApi";

const RolePermissions = () => {
  const canManagePermissions = useHasPermission("roles.assign_permissions");
  const { id } = useParams();
  const navigate = useNavigate();
  const [role, setRole] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [activeKeys, setActiveKeys] = useState([]);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [roleResponse, permissionsResponse] = await Promise.all([
        rolesService.get(id),
        permissionsService.listGrouped(),
      ]);

      setRole(roleResponse);
      setSelectedPermissions(
        roleResponse.permissions
          ? roleResponse.permissions.map((p) => p.id)
          : []
      );

      const permissionsData = permissionsResponse.data || {};
      setPermissions(permissionsData);
      
      // Inicializar todos los módulos como abiertos
      const allModules = Object.keys(permissionsData);
      setActiveKeys(allModules);
    } catch (err) {
      setError(err.message || "Error al cargar datos");
      toast.error("Error al cargar datos");
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePermission = (permissionId) => {
    if (!canManagePermissions) {
      toast.error("No tienes permisos para modificar permisos");
      return;
    }
    setSelectedPermissions((prev) =>
      prev.includes(permissionId)
        ? prev.filter((id) => id !== permissionId)
        : [...prev, permissionId]
    );
  };

  const handleSelectAllInModule = (modulePermissions) => {
    if (!canManagePermissions) {
      toast.error("No tienes permisos para modificar permisos");
      return;
    }
    const moduleIds = modulePermissions.map((p) => p.id);
    const allSelected = moduleIds.every((id) =>
      selectedPermissions.includes(id)
    );

    if (allSelected) {
      setSelectedPermissions((prev) =>
        prev.filter((id) => !moduleIds.includes(id))
      );
    } else {
      setSelectedPermissions((prev) => [
        ...prev.filter((id) => !moduleIds.includes(id)),
        ...moduleIds,
      ]);
    }
  };

  const handleSelectAll = () => {
    if (!canManagePermissions) {
      toast.error("No tienes permisos para modificar permisos");
      return;
    }
    const allIds = Object.values(permissions)
      .flat()
      .map((p) => p.id);
    const allSelected = allIds.every((id) =>
      selectedPermissions.includes(id)
    );

    if (allSelected) {
      setSelectedPermissions([]);
    } else {
      setSelectedPermissions(allIds);
    }
  };

  const handleSave = async () => {
    if (!canManagePermissions) {
      toast.error("No tienes permisos para guardar permisos");
      return;
    }
    try {
      setSaving(true);
      setError(null);
      await rolesService.assignPermissions(id, selectedPermissions);
      toast.success("Permisos guardados correctamente");
      navigate("/admin/roles");
    } catch (err) {
      let errorMessage = "Error al guardar permisos";
      
      // Manejo específico de errores de validación (422)
      if (err.response?.status === 422) {
        // El backend ahora retorna mensajes claros sobre permisos inválidos
        errorMessage = err.response?.data?.message || err.message || "Uno o más permisos seleccionados no son válidos";
        
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
        errorMessage = err.response?.data?.message || err.message || "Error al guardar permisos";
      }
      
      setError(errorMessage);
      toast.error(errorMessage);
      
      if (import.meta.env.DEV) {
        console.error("Error al guardar permisos:", {
          error: err,
          status: err.response?.status,
          data: err.response?.data,
        });
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container-fluid py-4">
        <div className="text-center py-5">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Cargando...</span>
          </Spinner>
        </div>
      </div>
    );
  }

  const modules = Object.keys(permissions);
  const allIds = Object.values(permissions)
    .flat()
    .map((p) => p.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedPermissions.includes(id));

  return (
    <div className="container-fluid py-4">
      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center">
          <div>
            <Button
              variant="link"
              className="p-0 mb-2"
              onClick={() => navigate("/admin/roles")}
            >
              <FaArrowLeft className="me-2" />
              Volver a Roles
            </Button>
            <h4 className="mb-0">
              Permisos del Rol: <strong>{role?.name}</strong>
            </h4>
          </div>
          <div className="d-flex gap-2">
            <Button
              variant="outline-secondary"
              onClick={handleSelectAll}
              disabled={saving || !canManagePermissions}
              title={canManagePermissions ? "" : "No tienes permisos para modificar"}
            >
              {allSelected ? (
                <>
                  <FaSquare className="me-2" />
                  Limpiar Todo
                </>
              ) : (
                <>
                  <FaCheckSquare className="me-2" />
                  Seleccionar Todo
                </>
              )}
            </Button>
            {canManagePermissions && (
              <Button variant="primary" onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Spinner size="sm" className="me-2" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <FaSave className="me-2" />
                    Guardar
                  </>
                )}
              </Button>
            )}
          </div>
        </Card.Header>
        <Card.Body>
          {error && (
            <Alert variant="danger" dismissible onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <Alert variant="info" className="mb-4">
            <strong>{selectedPermissions.length}</strong> permiso(s) seleccionado(s) de{" "}
            <strong>{allIds.length}</strong> disponibles
          </Alert>

          {modules.length === 0 ? (
            <Alert variant="warning" className="text-center">
              No hay permisos disponibles
            </Alert>
          ) : (
            <Accordion 
              activeKey={activeKeys.length > 0 ? activeKeys : modules} 
              alwaysOpen
              onSelect={(selectedKeys) => {
                // Cuando alwaysOpen está activo, selectedKeys puede ser un array o string
                const newKeys = Array.isArray(selectedKeys) 
                  ? selectedKeys 
                  : (selectedKeys ? [selectedKeys] : []);
                setActiveKeys(newKeys.length > 0 ? newKeys : modules);
              }}
            >
              {modules.map((module) => {
                const modulePermissions = permissions[module];
                const moduleIds = modulePermissions.map((p) => p.id);
                const moduleAllSelected =
                  moduleIds.length > 0 &&
                  moduleIds.every((id) => selectedPermissions.includes(id));
                const moduleSomeSelected = moduleIds.some((id) =>
                  selectedPermissions.includes(id)
                );

                return (
                  <Accordion.Item key={module} eventKey={module}>
                    <Accordion.Header>
                      <div className="d-flex justify-content-between align-items-center w-100 me-3">
                        <span>
                          <strong>{module}</strong>
                          <Badge bg="secondary" className="ms-2">
                            {modulePermissions.length}
                          </Badge>
                        </span>
                        <Button
                          variant="link"
                          size="sm"
                          className="text-decoration-none"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectAllInModule(modulePermissions);
                          }}
                          disabled={!canManagePermissions}
                          title={canManagePermissions ? "" : "No tienes permisos para modificar"}
                        >
                          {moduleAllSelected ? (
                            <>
                              <FaSquare className="me-1" />
                              Limpiar Módulo
                            </>
                          ) : (
                            <>
                              <FaCheckSquare className="me-1" />
                              Seleccionar Módulo
                            </>
                          )}
                        </Button>
                      </div>
                    </Accordion.Header>
                    <Accordion.Body>
                      <div className="row">
                        {modulePermissions.map((permission) => (
                          <div key={permission.id} className="col-md-6 mb-2">
                            <Form.Check
                              type="checkbox"
                              id={`perm-${permission.id}`}
                              label={
                                <div>
                                  <strong>{permission.name}</strong>
                                  {permission.description && (
                                    <div className="text-muted small">
                                      {permission.description}
                                    </div>
                                  )}
                                  <Badge bg="secondary" className="ms-2">
                                    {permission.slug}
                                  </Badge>
                                </div>
                              }
                              checked={selectedPermissions.includes(
                                permission.id
                              )}
                              onChange={() =>
                                handleTogglePermission(permission.id)
                              }
                              disabled={!canManagePermissions}
                            />
                          </div>
                        ))}
                      </div>
                    </Accordion.Body>
                  </Accordion.Item>
                );
              })}
            </Accordion>
          )}
        </Card.Body>
      </Card>
    </div>
  );
};

export default RolePermissions;

