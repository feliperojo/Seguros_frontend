import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  Form,
  Button,
  Spinner,
  Alert,
  ListGroup,
  Badge,
} from "react-bootstrap";
import { FaCogs, FaPhone, FaUser, FaSave } from "react-icons/fa";
import { toast } from "react-toastify";
import { useHasPermission } from "../../hooks/useHasPermission";
import { usersService } from "../../services/adminApi";
import { getExtensions } from "../../services/ringCentralIntegrationApi";
import systemConfigService from "../../services/SystemConfigService";
import SystemConfigSection, { configFromApiResponse } from "../../components/SystemConfigSection";

/**
 * Normaliza la lista de usuarios desde la respuesta del backend (varias estructuras posibles).
 */
function normalizeUsersList(response) {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (response.data?.data && Array.isArray(response.data.data)) return response.data.data;
  if (Array.isArray(response.data)) return response.data;
  const arr = Object.values(response).find(Array.isArray);
  return Array.isArray(arr) ? arr : [];
}

/**
 * Normaliza la lista de extensiones desde la respuesta del backend.
 */
function normalizeExtensionsList(response) {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (response.data && Array.isArray(response.data)) return response.data;
  if (response.extensions && Array.isArray(response.extensions)) return response.extensions;
  const arr = Object.values(response).find(Array.isArray);
  return Array.isArray(arr) ? arr : [];
}

const Configurador = () => {
  const [users, setUsers] = useState([]);
  const [extensions, setExtensions] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedExtensionIds, setSelectedExtensionIds] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingExtensions, setLoadingExtensions] = useState(false);
  const [loadingUserDetail, setLoadingUserDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [systemConfig, setSystemConfig] = useState(configFromApiResponse([]));
  const [loadingConfig, setLoadingConfig] = useState(true);

  const canEdit = useHasPermission("users.edit");
  const canView = useHasPermission("users.view");

  const loadUsers = useCallback(async () => {
    try {
      setLoadingUsers(true);
      setError(null);
      const response = await usersService.list({ per_page: 500 });
      const list = normalizeUsersList(response);
      setUsers(list);
      if (list.length > 0 && !selectedUserId) {
        setSelectedUserId(String(list[0].id));
      }
    } catch (err) {
      setError(err.message || "Error al cargar usuarios");
      toast.error(err.message);
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  }, [selectedUserId]);

  const loadExtensions = useCallback(async () => {
    try {
      setLoadingExtensions(true);
      const response = await getExtensions({ type: "User", per_page: 250 });
      const list = normalizeExtensionsList(response);
      setExtensions(list);
    } catch (err) {
      toast.error(err.message || "Error al cargar extensiones RingCentral");
      setExtensions([]);
    } finally {
      setLoadingExtensions(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    loadExtensions();
  }, [loadExtensions]);

  const loadSystemConfig = useCallback(async () => {
    try {
      setLoadingConfig(true);
      const items = await systemConfigService.getAll();
      setSystemConfig(configFromApiResponse(items));
    } catch (err) {
      toast.error(err?.message || "Error al cargar configuración del sistema");
      setSystemConfig(configFromApiResponse([]));
    } finally {
      setLoadingConfig(false);
    }
  }, []);

  useEffect(() => {
    loadSystemConfig();
  }, [loadSystemConfig]);

  // Cuando se selecciona un usuario, cargar su detalle (incluye ringcentral_extension_ids)
  useEffect(() => {
    if (!selectedUserId) {
      setSelectedUser(null);
      setSelectedExtensionIds([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingUserDetail(true);
      try {
        const user = await usersService.get(selectedUserId);
        if (!cancelled) {
          setSelectedUser(user);
          const ids = user?.ringcentral_extension_ids;
          setSelectedExtensionIds(Array.isArray(ids) ? [...ids] : []);
        }
      } catch (err) {
        if (!cancelled) {
          toast.error(err.message || "Error al cargar usuario");
          setSelectedUser(null);
          setSelectedExtensionIds([]);
        }
      } finally {
        if (!cancelled) setLoadingUserDetail(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedUserId]);

  const toggleExtension = (extId) => {
    const id = String(extId);
    setSelectedExtensionIds((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    if (!selectedUserId || !canEdit) return;
    setSaving(true);
    try {
      await usersService.updateRingCentralExtensions(selectedUserId, selectedExtensionIds);
      setSelectedUser((u) => (u ? { ...u, ringcentral_extension_ids: selectedExtensionIds } : null));
      toast.success("Extensiones RingCentral actualizadas correctamente");
    } catch (err) {
      toast.error(err.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const currentExtensionIds = Array.isArray(selectedUser?.ringcentral_extension_ids)
    ? selectedUser.ringcentral_extension_ids
    : [];
  const hasChanges =
    selectedUser &&
    (currentExtensionIds.length !== selectedExtensionIds.length ||
      currentExtensionIds.some((id) => !selectedExtensionIds.includes(id)) ||
      selectedExtensionIds.some((id) => !currentExtensionIds.includes(id)));

  if (!canView && !canEdit) {
    return (
      <div className="container py-4">
        <Alert variant="danger">No tienes permisos para acceder al Configurador.</Alert>
      </div>
    );
  }

  return (
    <div className="container py-4">
      <div className="d-flex align-items-center gap-2 mb-4">
        <FaCogs size={24} />
        <h1 className="mb-0">Configurador</h1>
      </div>
      <p className="text-muted">
        Configuración central de la aplicación. Solo visible para administradores.
      </p>

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Card className="mb-4">
        <Card.Header className="d-flex align-items-center gap-2">
          <FaUser />
          <span>Usuario: asociar extensiones RingCentral</span>
        </Card.Header>
        <Card.Body>
          <p className="text-muted small mb-3">
            Cada usuario puede tener varias extensiones RingCentral. El frontend se suscribirá a los
            canales de llamada de esas extensiones para mostrar el popup de llamada.
          </p>

          <Form.Group className="mb-3">
            <Form.Label>Usuario</Form.Label>
            <Form.Select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              disabled={loadingUsers}
            >
              <option value="">Seleccionar usuario...</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name || u.email || `Usuario #${u.id}`}
                </option>
              ))}
            </Form.Select>
          </Form.Group>

          {loadingUserDetail && (
            <div className="d-flex align-items-center gap-2 mb-3">
              <Spinner animation="border" size="sm" />
              <span>Cargando datos del usuario...</span>
            </div>
          )}

          {selectedUser && !loadingUserDetail && (
            <>
              {/* Resumen: extensiones asignadas al usuario (solo lectura) */}
              {selectedExtensionIds.length > 0 && extensions.length > 0 && (
                <div className="mb-3 p-2 rounded bg-light border">
                  <span className="small fw-semibold text-muted">Extensiones asignadas a {selectedUser.name || selectedUser.email || "este usuario"}: </span>
                  <span className="small">
                    {selectedExtensionIds
                      .map((extId) => {
                        const ext = extensions.find(
                          (e) => String(e.id ?? e.extensionId ?? e.extension_id ?? "") === String(extId)
                        );
                        const num = ext
                          ? ext.extensionNumber ?? ext.extension_number ?? ext.number ?? extId
                          : extId;
                        const name = ext ? ext.name ?? ext.displayName ?? "" : "";
                        return name ? `${name} (${num})` : String(num);
                      })
                      .join(", ")}
                  </span>
                </div>
              )}
              {selectedExtensionIds.length === 0 && (
                <div className="mb-3 p-2 rounded bg-light border">
                  <span className="small text-muted">Ninguna extensión asignada. Selecciona extensiones abajo y guarda.</span>
                </div>
              )}

              <Form.Group className="mb-3">
                <Form.Label className="d-flex align-items-center gap-2">
                  <FaPhone />
                  Extensiones RingCentral asociadas
                </Form.Label>
                {loadingExtensions ? (
                  <div className="d-flex align-items-center gap-2">
                    <Spinner animation="border" size="sm" />
                    <span>Cargando extensiones...</span>
                  </div>
                ) : extensions.length === 0 ? (
                  <Alert variant="warning" className="mb-0">
                    No hay extensiones disponibles. Verifica la integración RingCentral.
                  </Alert>
                ) : (
                  <ListGroup style={{ maxHeight: 280, overflowY: "auto" }}>
                    {[...extensions]
                      .sort((a, b) => {
                        const idA = String(a.id ?? a.extensionId ?? a.extension_id ?? "");
                        const idB = String(b.id ?? b.extensionId ?? b.extension_id ?? "");
                        const aAssigned = selectedExtensionIds.includes(idA);
                        const bAssigned = selectedExtensionIds.includes(idB);
                        if (aAssigned && !bAssigned) return -1;
                        if (!aAssigned && bAssigned) return 1;
                        return 0;
                      })
                      .map((ext) => {
                      const id = String(ext.id ?? ext.extensionId ?? ext.extension_id ?? "");
                      const label =
                        ext.extensionNumber ?? ext.extension_number ?? ext.number ?? id;
                      const name = ext.name ?? ext.displayName ?? "";
                      const checked = selectedExtensionIds.includes(id);
                      return (
                        <ListGroup.Item
                          key={id}
                          as="label"
                          className="d-flex align-items-center gap-2 cursor-pointer"
                          style={{ cursor: "pointer" }}
                        >
                          <Form.Check
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleExtension(id)}
                            disabled={!canEdit}
                          />
                          <span className="flex-grow-1">
                            {name ? `${name} (` : ""}
                            <Badge bg="secondary">{label}</Badge>
                            {name ? ")" : ""}
                          </span>
                        </ListGroup.Item>
                      );
                    })}
                  </ListGroup>
                )}
              </Form.Group>

              {canEdit && (
                <Button
                  variant="primary"
                  onClick={handleSave}
                  disabled={saving || !hasChanges || loadingExtensions}
                >
                  {saving ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-2" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <FaSave className="me-2" />
                      Guardar extensiones
                    </>
                  )}
                </Button>
              )}
            </>
          )}
        </Card.Body>
      </Card>

      <SystemConfigSection
        config={systemConfig}
        setConfig={setSystemConfig}
        users={users}
        loadingUsers={loadingUsers}
        loadingConfig={loadingConfig}
      />
    </div>
  );
};

export default Configurador;
