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
import SystemConfigSection, {
  configFromApiResponse,
} from "../../components/SystemConfigSection";

// Tipos de producto (cobertura_tipo) soportados en el formulario de Grupo Familiar
const COVERAGE_PRODUCT_TYPES = [
  "Plan de salud",
  "Plan Dental",
  "Plan de vida",
  "Plan de Descuentos",
];

// Campos de la sección "Datos Cobertura" que se pueden mostrar/ocultar por tipo de producto
const COVERAGE_FIELD_DEFINITIONS = [
  { key: "codigo_poliza", label: "Código Póliza" },
  { key: "policy_number", label: "Número de póliza" },
  { key: "fecha_activacion", label: "Fecha de Activación" },
  { key: "ano_cobertura", label: "Año de Cobertura" },
  { key: "elegibilidad", label: "Elegibilidad" },
  { key: "compania_id", label: "Compañía" },
  { key: "agente", label: "Agente" },
  { key: "plan", label: "Plan" },
  { key: "metal", label: "Metal" },
  { key: "red", label: "Red" },
  { key: "estado_cobertura", label: "Cobertura" },
  { key: "pagador_id", label: "Pagador" },
  { key: "tipo_pago", label: "Tipo de Pago" },
  { key: "dia_pago", label: "Día de Pago" },
  { key: "precio", label: "Precio" },
  { key: "grupo", label: "Grupo" },
];

const ALL_COVERAGE_FIELD_KEYS = COVERAGE_FIELD_DEFINITIONS.map((f) => f.key);

// Campos extra del cliente (datos antropométricos) que se pueden mostrar/ocultar por tipo de producto
const CLIENT_FIELD_DEFINITIONS = [
  { key: "peso", label: "Peso (lb)" },
  { key: "altura", label: "Altura (pies)" },
  { key: "pulgadas", label: "Altura (pulgadas)" },
];

const ALL_CLIENT_FIELD_KEYS = CLIENT_FIELD_DEFINITIONS.map((f) => f.key);

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
  const [selectedCoverageTipo, setSelectedCoverageTipo] = useState(
    COVERAGE_PRODUCT_TYPES[0]
  );
  const [savingCoverageConfig, setSavingCoverageConfig] = useState(false);
  const [savingClientFieldsConfig, setSavingClientFieldsConfig] =
    useState(false);

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

  // === Configuración visual de campos de cobertura por tipo de producto ===
  const coverageFieldsConfig = systemConfig?.coverage_fields_by_tipo || {};

  const getEnabledCoverageFields = (tipo) => {
    const entry = coverageFieldsConfig[tipo];
    // Si nunca se ha configurado este tipo, mostrar todos los campos
    if (!entry || !Array.isArray(entry.enabledFields)) {
      return ALL_COVERAGE_FIELD_KEYS;
    }
    // Si existe configuración, incluso si es [], respetarla (permite ocultar todos)
    return entry.enabledFields;
  };

  const toggleCoverageField = (tipo, fieldKey) => {
    setSystemConfig((prev) => {
      const prevCfg = prev.coverage_fields_by_tipo || {};
      const entry = prevCfg[tipo] || {};

      // Campos actualmente activos para este tipo
      const currentArr = Array.isArray(entry.enabledFields)
        ? entry.enabledFields
        : ALL_COVERAGE_FIELD_KEYS;

      const nextArr = currentArr.includes(fieldKey)
        ? currentArr.filter((k) => k !== fieldKey)
        : [...currentArr, fieldKey];

      return {
        ...prev,
        coverage_fields_by_tipo: {
          ...prevCfg,
          [tipo]: {
            ...entry,
            enabledFields: nextArr,
          },
        },
      };
    });
  };

  const handleSaveCoverageFieldsConfig = async () => {
    const payload = systemConfig?.coverage_fields_by_tipo || {};
    setSavingCoverageConfig(true);
    try {
      await systemConfigService.put(
        "coverage_fields_by_tipo",
        payload,
        "json"
      );
      toast.success(
        "Configuración de campos de cobertura guardada correctamente."
      );
    } catch (err) {
      toast.error(
        err?.message ||
          "Error al guardar configuración de campos de cobertura"
      );
    } finally {
      setSavingCoverageConfig(false);
    }
  };

  // === Configuración visual de campos del cliente por tipo de producto ===
  const clientFieldsConfig = systemConfig?.client_fields_by_tipo || {};

  const getEnabledClientFields = (tipo) => {
    const entry = clientFieldsConfig[tipo];
    // Si nunca se ha configurado este tipo, mostrar todos los campos
    if (!entry || !Array.isArray(entry.enabledFields)) {
      return ALL_CLIENT_FIELD_KEYS;
    }
    // Si existe configuración, incluso si es [], respetarla (permite ocultar todos)
    return entry.enabledFields;
  };

  const toggleClientField = (tipo, fieldKey) => {
    setSystemConfig((prev) => {
      const prevCfg = prev.client_fields_by_tipo || {};
      const entry = prevCfg[tipo] || {};

      const currentArr = Array.isArray(entry.enabledFields)
        ? entry.enabledFields
        : ALL_CLIENT_FIELD_KEYS;

      const nextArr = currentArr.includes(fieldKey)
        ? currentArr.filter((k) => k !== fieldKey)
        : [...currentArr, fieldKey];

      return {
        ...prev,
        client_fields_by_tipo: {
          ...prevCfg,
          [tipo]: {
            ...entry,
            enabledFields: nextArr,
          },
        },
      };
    });
  };

  const handleSaveClientFieldsConfig = async () => {
    const payload = systemConfig?.client_fields_by_tipo || {};
    setSavingClientFieldsConfig(true);
    try {
      await systemConfigService.put("client_fields_by_tipo", payload, "json");
      toast.success(
        "Configuración de datos del cliente guardada correctamente."
      );
    } catch (err) {
      toast.error(
        err?.message ||
          "Error al guardar configuración de datos del cliente"
      );
    } finally {
      setSavingClientFieldsConfig(false);
    }
  };

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

      {/* Configuración de campos visibles en \"Datos Cobertura\" por tipo de producto */}
      <Card className="mb-4">
        <Card.Header className="d-flex align-items-center gap-2">
          <FaCogs />
          <span>Campos de cobertura por tipo de producto</span>
        </Card.Header>
        <Card.Body>
          <p className="text-muted small mb-3">
            Marca qué campos <strong>se deben ocultar</strong> en la sección{" "}
            <strong>Datos Cobertura</strong> del Grupo Familiar, según el tipo de
            producto (cobertura_tipo). Solo afecta a la visualización.
          </p>

          {/* Selector de tipo de producto (estilo tarjetas/botones) */}
          <div className="mb-3 d-flex flex-wrap gap-2">
            {COVERAGE_PRODUCT_TYPES.map((tipo) => {
              const isActive = selectedCoverageTipo === tipo;
              return (
                <Button
                  key={tipo}
                  type="button"
                  variant={isActive ? "primary" : "outline-secondary"}
                  size="sm"
                  className="d-flex flex-column align-items-start px-3 py-2"
                  onClick={() => setSelectedCoverageTipo(tipo)}
                >
                  <span className="fw-semibold small">{tipo}</span>
                </Button>
              );
            })}
          </div>

          {/* Checkboxes de campos visibles para el tipo seleccionado */}
          <Form.Group className="mb-3">
            <Form.Label className="small fw-semibold text-muted">
              Campos a ocultar para \"{selectedCoverageTipo}\"
            </Form.Label>
            <div className="row">
              {COVERAGE_FIELD_DEFINITIONS.map((field) => {
                const hidden = getEnabledCoverageFields(
                  selectedCoverageTipo
                ).includes(field.key);
                return (
                  <div key={field.key} className="col-md-4 mb-2">
                    <Form.Check
                      type="checkbox"
                      id={`cov-field-${selectedCoverageTipo}-${field.key}`}
                      label={field.label}
                      checked={hidden}
                      onChange={() =>
                        toggleCoverageField(selectedCoverageTipo, field.key)
                      }
                    />
                  </div>
                );
              })}
            </div>
          </Form.Group>

          <Button
            variant="primary"
            size="sm"
            onClick={handleSaveCoverageFieldsConfig}
            disabled={savingCoverageConfig}
          >
            {savingCoverageConfig ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Guardando...
              </>
            ) : (
              "Guardar configuración de campos"
            )}
          </Button>
        </Card.Body>
      </Card>

      {/* Configuración de datos del cliente (peso/altura) por tipo de producto */}
      <Card className="mb-4">
        <Card.Header className="d-flex align-items-center gap-2">
          <FaCogs />
          <span>Datos del cliente por tipo de producto</span>
        </Card.Header>
        <Card.Body>
          <p className="text-muted small mb-3">
            Marca qué campos <strong>se deben ocultar</strong> en la sección{" "}
            <strong>Datos Principales</strong> del cliente, según el tipo de
            producto (cobertura_tipo). Solo afecta a la interfaz visual.
          </p>

          {/* Reutilizamos el mismo selector de tipo de producto */}
          <div className="mb-3 d-flex flex-wrap gap-2">
            {COVERAGE_PRODUCT_TYPES.map((tipo) => {
              const isActive = selectedCoverageTipo === tipo;
              return (
                <Button
                  key={tipo}
                  type="button"
                  variant={isActive ? "primary" : "outline-secondary"}
                  size="sm"
                  className="d-flex flex-column align-items-start px-3 py-2"
                  onClick={() => setSelectedCoverageTipo(tipo)}
                >
                  <span className="fw-semibold small">{tipo}</span>
                </Button>
              );
            })}
          </div>

          <Form.Group className="mb-3">
            <Form.Label className="small fw-semibold text-muted">
              Campos a ocultar de datos del cliente para "
              {selectedCoverageTipo}"
            </Form.Label>
            <div className="row">
              {CLIENT_FIELD_DEFINITIONS.map((field) => {
                const disabled = getEnabledClientFields(
                  selectedCoverageTipo
                ).includes(field.key);
                return (
                  <div key={field.key} className="col-md-4 mb-2">
                    <Form.Check
                      type="checkbox"
                      id={`client-field-${selectedCoverageTipo}-${field.key}`}
                      label={field.label}
                      checked={disabled}
                      onChange={() =>
                        toggleClientField(selectedCoverageTipo, field.key)
                      }
                    />
                  </div>
                );
              })}
            </div>
          </Form.Group>

          <Button
            variant="primary"
            size="sm"
            onClick={handleSaveClientFieldsConfig}
            disabled={savingClientFieldsConfig}
          >
            {savingClientFieldsConfig ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Guardando...
              </>
            ) : (
              "Guardar configuración de datos del cliente"
            )}
          </Button>
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
