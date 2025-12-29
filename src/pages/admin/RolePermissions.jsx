import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Card,
  Form,
  Button,
  Spinner,
  Alert,
  Badge,
  ProgressBar,
} from "react-bootstrap";
import { 
  FaSave, 
  FaCheckSquare, 
  FaSquare, 
  FaArrowLeft,
  FaCheckCircle,
  FaCircle,
  FaLock,
  FaUnlock,
  FaShieldAlt
} from "react-icons/fa";
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

  // Calcular estadísticas por módulo
  const getModuleStats = (module) => {
    const modulePermissions = permissions[module];
    const moduleIds = modulePermissions.map((p) => p.id);
    const selectedCount = moduleIds.filter((id) => selectedPermissions.includes(id)).length;
    const totalCount = moduleIds.length;
    const percentage = totalCount > 0 ? Math.round((selectedCount / totalCount) * 100) : 0;
    return { selectedCount, totalCount, percentage };
  };

  const overallPercentage = allIds.length > 0 
    ? Math.round((selectedPermissions.length / allIds.length) * 100) 
    : 0;

  return (
    <div className="container-fluid py-4">
      <Card className="shadow-sm">
        <Card.Header className="bg-primary text-white">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <Button
                variant="link"
                className="p-0 mb-2 text-white text-decoration-none"
                onClick={() => navigate("/admin/roles")}
              >
                <FaArrowLeft className="me-2" />
                Volver a Roles
              </Button>
              <h4 className="mb-0 text-white">
                <FaShieldAlt className="me-2" />
                Permisos del Rol: <strong>{role?.name}</strong>
              </h4>
            </div>
            <div className="d-flex gap-2">
              <Button
                variant="light"
                onClick={handleSelectAll}
                disabled={saving || !canManagePermissions}
                title={canManagePermissions ? "" : "No tienes permisos para modificar"}
                className="d-flex align-items-center"
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
                <Button variant="light" onClick={handleSave} disabled={saving} className="d-flex align-items-center">
                  {saving ? (
                    <>
                      <Spinner size="sm" className="me-2" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <FaSave className="me-2" />
                      Guardar Cambios
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </Card.Header>
        <Card.Body className="p-4">
          {error && (
            <Alert variant="danger" dismissible onClose={() => setError(null)} className="mb-4">
              <strong>Error:</strong> {error}
            </Alert>
          )}

          {/* Panel de estadísticas mejorado */}
          <Card className="mb-4 border-0 bg-light">
            <Card.Body>
              <div className="row align-items-center">
                <div className="col-md-8">
                  <div className="d-flex align-items-center mb-2">
                    <FaShieldAlt className="text-primary me-2" size="1.5em" />
                    <h5 className="mb-0 me-3">Resumen de Permisos</h5>
                  </div>
                  <div className="d-flex align-items-center gap-4 flex-wrap">
                    <div>
                      <span className="text-muted">Seleccionados:</span>
                      <Badge bg="success" className="ms-2 fs-6 px-3 py-2">
                        {selectedPermissions.length}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-muted">Disponibles:</span>
                      <Badge bg="secondary" className="ms-2 fs-6 px-3 py-2">
                        {allIds.length}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-muted">Progreso:</span>
                      <Badge bg="info" className="ms-2 fs-6 px-3 py-2">
                        {overallPercentage}%
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="col-md-4 mt-3 mt-md-0">
                  <ProgressBar 
                    now={overallPercentage} 
                    variant={overallPercentage === 100 ? "success" : overallPercentage > 50 ? "info" : "warning"}
                    className="h-3"
                    label={`${overallPercentage}%`}
                  />
                </div>
              </div>
            </Card.Body>
          </Card>

          {modules.length === 0 ? (
            <Alert variant="warning" className="text-center">
              <FaShieldAlt className="me-2" />
              No hay permisos disponibles
            </Alert>
          ) : (
            <div className="modules-container">
              {modules.map((module) => {
                const modulePermissions = permissions[module];
                const moduleIds = modulePermissions.map((p) => p.id);
                const moduleAllSelected =
                  moduleIds.length > 0 &&
                  moduleIds.every((id) => selectedPermissions.includes(id));
                const moduleSomeSelected = moduleIds.some((id) =>
                  selectedPermissions.includes(id)
                );
                const stats = getModuleStats(module);

                return (
                  <Card key={module} className="mb-4 shadow-sm border">
                    <Card.Header className={`${moduleAllSelected ? 'bg-success bg-opacity-10' : moduleSomeSelected ? 'bg-warning bg-opacity-10' : 'bg-light'} border-bottom`}>
                      <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
                        <div className="d-flex align-items-center gap-3 flex-grow-1">
                          <div className={`p-2 rounded ${moduleAllSelected ? 'bg-success bg-opacity-20' : moduleSomeSelected ? 'bg-warning bg-opacity-20' : 'bg-light'}`}>
                            {moduleAllSelected ? (
                              <FaCheckCircle className="text-success" size="1.5em" />
                            ) : moduleSomeSelected ? (
                              <FaCircle className="text-warning" size="1.5em" />
                            ) : (
                              <FaCircle className="text-muted" size="1.5em" />
                            )}
                          </div>
                          <div className="flex-grow-1">
                            <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
                              <strong className="fs-5">{module}</strong>
                              <Badge bg={moduleAllSelected ? "success" : moduleSomeSelected ? "warning" : "secondary"} className="px-3 py-2 fs-6">
                                {stats.selectedCount}/{stats.totalCount}
                              </Badge>
                              <Badge bg="info" className="px-3 py-2 fs-6">
                                {stats.percentage}%
                              </Badge>
                            </div>
                            <ProgressBar 
                              now={stats.percentage} 
                              variant={moduleAllSelected ? "success" : moduleSomeSelected ? "warning" : "secondary"}
                              className="h-3"
                              style={{ maxWidth: "300px" }}
                              label={`${stats.percentage}%`}
                            />
                          </div>
                        </div>
                        <Button
                          variant={moduleAllSelected ? "outline-danger" : "outline-primary"}
                          size="sm"
                          onClick={() => handleSelectAllInModule(modulePermissions)}
                          disabled={!canManagePermissions}
                          title={canManagePermissions ? (moduleAllSelected ? "Limpiar todos los permisos de este módulo" : "Seleccionar todos los permisos de este módulo") : "No tienes permisos para modificar"}
                          className="d-flex align-items-center"
                        >
                          {moduleAllSelected ? (
                            <>
                              <FaUnlock className="me-2" />
                              Limpiar Módulo
                            </>
                          ) : (
                            <>
                              <FaLock className="me-2" />
                              Seleccionar Módulo
                            </>
                          )}
                        </Button>
                      </div>
                    </Card.Header>
                    <Card.Body className="p-4">
                      <div className="row g-3">
                        {modulePermissions.map((permission) => {
                          const isSelected = selectedPermissions.includes(permission.id);
                          return (
                            <div key={permission.id} className="col-md-6 col-lg-4 col-xl-3">
                              <Card className={`h-100 border shadow-sm transition-all ${isSelected ? 'border-success bg-success bg-opacity-10' : 'border-secondary bg-white'}`}>
                                <Card.Body className="p-3">
                                  <Form.Check
                                    type="checkbox"
                                    id={`perm-${permission.id}`}
                                    className="mb-0"
                                    label={
                                      <div className="ms-2">
                                        <div className="d-flex align-items-center gap-2 mb-2">
                                          {isSelected ? (
                                            <FaCheckCircle className="text-success" size="1.1em" />
                                          ) : (
                                            <FaCircle className="text-muted" size="1.1em" />
                                          )}
                                          <strong className="text-dark">{permission.name}</strong>
                                        </div>
                                        {permission.description && (
                                          <div className="text-muted small mb-2" style={{ fontSize: "0.85rem", lineHeight: "1.4" }}>
                                            {permission.description}
                                          </div>
                                        )}
                                        <Badge bg="secondary" className="text-wrap d-inline-block" style={{ fontSize: "0.75rem", maxWidth: "100%" }}>
                                          {permission.slug}
                                        </Badge>
                                      </div>
                                    }
                                    checked={isSelected}
                                    onChange={() => handleTogglePermission(permission.id)}
                                    disabled={!canManagePermissions}
                                  />
                                </Card.Body>
                              </Card>
                            </div>
                          );
                        })}
                      </div>
                    </Card.Body>
                  </Card>
                );
              })}
            </div>
          )}
        </Card.Body>
      </Card>
    </div>
  );
};

export default RolePermissions;

