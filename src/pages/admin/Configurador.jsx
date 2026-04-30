import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  Form,
  Button,
  Spinner,
  Alert,
  ListGroup,
  Badge,
  Collapse,
  Table,
  Modal,
} from "react-bootstrap";
import { FaCogs, FaPhone, FaUser, FaSave } from "react-icons/fa";
import { toast } from "react-toastify";
import { useHasPermission } from "../../hooks/useHasPermission";
import { usersService } from "../../services/adminApi";
import { getExtensions } from "../../services/ringCentralIntegrationApi";
import {
  ensureSubscription,
  getSubscriptionsStatus,
} from "../../services/ringCentralSubscriptionsApi";
import systemConfigService from "../../services/SystemConfigService";
import RealtimeConnectionStatus from "../../components/CallIdentifier/RealtimeConnectionStatus";
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
  { key: "codigo_poliza", label: "Código de ID" },
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

  // === RingCentral → Suscripción Webhook ===
  const [rcStatus, setRcStatus] = useState(null);
  const [rcLoading, setRcLoading] = useState(false);
  const [rcEnsuring, setRcEnsuring] = useState(false);
  const [rcError, setRcError] = useState(null);
  const [rcShowForm, setRcShowForm] = useState(false);
  const [rcShowDetail, setRcShowDetail] = useState(false);
  const [rcWebhookUrl, setRcWebhookUrl] = useState("");
  const [rcExtensionIds, setRcExtensionIds] = useState([]);
  const [rcForceModalOpen, setRcForceModalOpen] = useState(false);

  const parseExtensionIds = (raw) => {
    const parts = String(raw || "")
      .split(/[\s,]+/g)
      .map((s) => s.trim())
      .filter(Boolean);
    // Unique, preserve order
    const seen = new Set();
    const unique = [];
    for (const p of parts) {
      if (!seen.has(p)) {
        seen.add(p);
        unique.push(p);
      }
    }
    return unique;
  };

  const loadRingCentralSubscriptionsStatus = useCallback(
    async ({ sync = true } = {}) => {
      try {
        setRcLoading(true);
        setRcError(null);
        const res = await getSubscriptionsStatus({ sync: sync ? 1 : 0 });
        setRcStatus(res || null);

        const configured = res?.config?.webhook_url;
        if (configured && !rcWebhookUrl) {
          setRcWebhookUrl(String(configured));
        }
      } catch (err) {
        const status = err?.response?.status;
        if (status === 401) {
          toast.error("Sesión expirada / sin permisos");
        } else {
          toast.error(err?.message || "Error al consultar estado de suscripciones");
        }
        setRcError(err?.message || "Error al consultar estado");
        setRcStatus(null);
      } finally {
        setRcLoading(false);
      }
    },
    [rcWebhookUrl]
  );

  useEffect(() => {
    // Carga inicial con sync=1 para que el panel muestre datos reales de RingCentral.
    loadRingCentralSubscriptionsStatus({ sync: true });
  }, [loadRingCentralSubscriptionsStatus]);

  const runEnsureSubscription = async ({ forceCreate = false } = {}) => {
    if (!canEdit) return;
    try {
      setRcEnsuring(true);
      setRcError(null);

      const body = {
        force_create: !!forceCreate,
      };
      const url = String(rcWebhookUrl || "").trim();
      if (url) body.webhook_url = url;
      if (Array.isArray(rcExtensionIds) && rcExtensionIds.length > 0) {
        body.extension_ids = rcExtensionIds;
      }

      const res = await ensureSubscription(body);
      const msg =
        res?.message ||
        (res?.created
          ? "Suscripción creada correctamente."
          : "Suscripción verificada/actualizada correctamente.");
      toast.success(msg);
      await loadRingCentralSubscriptionsStatus({ sync: true });
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401) {
        toast.error("Sesión expirada / sin permisos");
      } else {
        toast.error(err?.message || "Error al asegurar suscripción");
      }
      setRcError(err?.message || "Error al asegurar suscripción");
    } finally {
      setRcEnsuring(false);
    }
  };

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
          <FaPhone />
          <span>RingCentral: estado de conexión (tiempo real)</span>
        </Card.Header>
        <Card.Body>
          <p className="text-muted small mb-3">
            Este estado es global (no depende del cliente). Indica si el sistema está listo para recibir
            eventos de llamadas en tiempo real y muestra advertencias/errores del backend.
          </p>
          <RealtimeConnectionStatus minutes={60} />
        </Card.Body>
      </Card>

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

      {/* RingCentral → Suscripción Webhook */}
      <Card className="mb-4">
        <Card.Header className="d-flex align-items-center justify-content-between gap-2 flex-wrap">
          <div className="d-flex align-items-center gap-2">
            <FaPhone />
            <span>RingCentral → Suscripción Webhook</span>
          </div>
          <div className="d-flex align-items-center gap-2">
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={() => loadRingCentralSubscriptionsStatus({ sync: true })}
              disabled={rcLoading}
            >
              {rcLoading ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" />
                  Actualizando...
                </>
              ) : (
                "Actualizar estado"
              )}
            </Button>
            {canEdit && (
              <>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => runEnsureSubscription({ forceCreate: false })}
                  disabled={rcEnsuring || rcLoading}
                >
                  {rcEnsuring ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-2" />
                      Procesando...
                    </>
                  ) : (
                    "Reparar / Asegurar suscripción"
                  )}
                </Button>
                <Button
                  variant="outline-danger"
                  size="sm"
                  onClick={() => setRcForceModalOpen(true)}
                  disabled={rcEnsuring || rcLoading}
                >
                  Forzar nueva suscripción
                </Button>
              </>
            )}
          </div>
        </Card.Header>
        <Card.Body>
          <p className="text-muted small mb-3">
            Estado y validación de la suscripción webhook (DB + RingCentral). Si ves{" "}
            <strong>WARNING/ERROR</strong>, puedes ejecutar “Asegurar” o “Forzar”.
          </p>

          {rcError && (
            <Alert variant="danger" className="mb-3">
              {rcError}
            </Alert>
          )}

          {/* Panel de estado */}
          {rcLoading && !rcStatus ? (
            <div className="d-flex align-items-center gap-2">
              <Spinner animation="border" size="sm" />
              <span>Cargando estado...</span>
            </div>
          ) : (
            <>
              {(() => {
                const webhookUrl = rcStatus?.config?.webhook_url || "";
                const summary = rcStatus?.summary || {};
                const activeCount = Number(summary?.ringcentral_active_count || 0);
                const matches = !!summary?.address_matches_configured_webhook_url;
                const hasFilter = !!summary?.has_account_telephony_sessions_filter;

                const webhookOk = !!String(webhookUrl || "").trim();
                const activeOk = activeCount > 0;

                const badgeFor = (level) => {
                  if (level === "OK") return <Badge bg="success">OK</Badge>;
                  if (level === "WARNING") return <Badge bg="warning" text="dark">WARNING</Badge>;
                  return <Badge bg="danger">ERROR</Badge>;
                };

                return (
                  <div className="mb-3 p-3 rounded border bg-light">
                    <div className="d-flex flex-column gap-2">
                      <div className="d-flex align-items-start justify-content-between gap-3 flex-wrap">
                        <div className="flex-grow-1">
                          <div className="fw-semibold">Webhook URL configurada</div>
                          <div className="small text-muted">
                            {webhookUrl ? (
                              <span style={{ wordBreak: "break-all" }}>{webhookUrl}</span>
                            ) : (
                              "No hay URL configurada."
                            )}
                          </div>
                        </div>
                        <div>{badgeFor(webhookOk ? "OK" : "ERROR")}</div>
                      </div>

                      <div className="d-flex align-items-start justify-content-between gap-3 flex-wrap">
                        <div className="flex-grow-1">
                          <div className="fw-semibold">Suscripciones activas en RingCentral</div>
                          <div className="small text-muted">
                            {Number.isFinite(activeCount) ? `${activeCount}` : "—"}
                          </div>
                        </div>
                        <div>{badgeFor(activeOk ? "OK" : "ERROR")}</div>
                      </div>

                      <div className="d-flex align-items-start justify-content-between gap-3 flex-wrap">
                        <div className="flex-grow-1">
                          <div className="fw-semibold">La URL coincide con la configurada</div>
                          <div className="small text-muted">
                            {matches
                              ? "La dirección del delivery_mode coincide con la URL configurada."
                              : "La dirección NO coincide con la URL configurada (recomendado reparar)."}
                          </div>
                        </div>
                        <div>{badgeFor(matches ? "OK" : "WARNING")}</div>
                      </div>

                      <div className="d-flex align-items-start justify-content-between gap-3 flex-wrap">
                        <div className="flex-grow-1">
                          <div className="fw-semibold">Existe filtro account telephony sessions</div>
                          <div className="small text-muted">
                            {hasFilter
                              ? "La suscripción incluye el filtro requerido."
                              : "No se encontró el filtro requerido (recomendado reparar)."}
                          </div>
                        </div>
                        <div>{badgeFor(hasFilter ? "OK" : "WARNING")}</div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Formulario opcional */}
              <div className="mb-3 d-flex align-items-center gap-2">
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => setRcShowForm((v) => !v)}
                  aria-controls="rc-sub-form"
                  aria-expanded={rcShowForm}
                >
                  {rcShowForm ? "Ocultar formulario" : "Mostrar formulario opcional"}
                </Button>
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => setRcShowDetail((v) => !v)}
                  aria-controls="rc-sub-detail"
                  aria-expanded={rcShowDetail}
                >
                  {rcShowDetail ? "Ocultar detalle" : "Mostrar detalle"}
                </Button>
              </div>

              <Collapse in={rcShowForm}>
                <div id="rc-sub-form" className="mb-3">
                  <div className="p-3 rounded border">
                    <div className="row">
                      <div className="col-md-6 mb-3">
                        <Form.Group>
                          <Form.Label>webhook_url</Form.Label>
                          <Form.Control
                            type="url"
                            placeholder="https://api.vantun.com/api/webhooks/ringcentral"
                            value={rcWebhookUrl}
                            onChange={(e) => setRcWebhookUrl(e.target.value)}
                            disabled={!canEdit}
                          />
                          <div className="form-text">
                            Si lo dejas vacío, el backend usará el valor configurado en el sistema.
                          </div>
                        </Form.Group>
                      </div>

                      <div className="col-md-6 mb-3">
                        <Form.Group>
                          <Form.Label>extension_ids</Form.Label>
                          <Form.Control
                            type="text"
                            placeholder="Pega IDs separados por coma (ej: 6301...,6301...)"
                            onChange={(e) => setRcExtensionIds(parseExtensionIds(e.target.value))}
                            disabled={!canEdit}
                          />
                          <div className="form-text">
                            Puedes pegar una lista separada por coma o espacios. Se normaliza automáticamente.
                          </div>
                        </Form.Group>

                        {Array.isArray(rcExtensionIds) && rcExtensionIds.length > 0 && (
                          <div className="mt-2 d-flex flex-wrap gap-2">
                            {rcExtensionIds.map((id) => (
                              <Badge
                                key={id}
                                bg="secondary"
                                className="d-inline-flex align-items-center gap-2"
                                style={{ cursor: canEdit ? "pointer" : "default" }}
                                onClick={() => {
                                  if (!canEdit) return;
                                  setRcExtensionIds((prev) => prev.filter((x) => x !== id));
                                }}
                                title={canEdit ? "Click para quitar" : undefined}
                              >
                                {id}
                                {canEdit ? <span className="ms-1">×</span> : null}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </Collapse>

              {/* Detalle colapsable */}
              <Collapse in={rcShowDetail}>
                <div id="rc-sub-detail">
                  <div className="p-3 rounded border">
                    <div className="mb-3">
                      <div className="fw-semibold mb-1">Última suscripción en DB</div>
                      {rcStatus?.db?.latest ? (
                        <div className="small text-muted">
                          <div>
                            <strong>ID:</strong> {String(rcStatus.db.latest?.id ?? "—")}
                          </div>
                          <div>
                            <strong>Status:</strong> {String(rcStatus.db.latest?.status ?? "—")}
                          </div>
                          <div>
                            <strong>Expiration:</strong>{" "}
                            {String(rcStatus.db.latest?.expiration_time ?? "—")}
                          </div>
                          <div>
                            <strong>Delivery address:</strong>{" "}
                            {String(
                              rcStatus.db.latest?.delivery_mode_address ??
                                rcStatus.db.latest?.delivery_mode?.address ??
                                "—"
                            )}
                          </div>
                          <div>
                            <strong>Event filters:</strong>{" "}
                            {Array.isArray(rcStatus.db.latest?.event_filters)
                              ? rcStatus.db.latest.event_filters.length
                              : "—"}
                          </div>
                        </div>
                      ) : (
                        <Alert variant="warning" className="mb-0">
                          No hay registro de suscripción en DB.
                        </Alert>
                      )}
                    </div>

                    <div>
                      <div className="fw-semibold mb-2">Suscripciones en RingCentral</div>
                      {Array.isArray(rcStatus?.ringcentral?.subscriptions) &&
                      rcStatus.ringcentral.subscriptions.length > 0 ? (
                        <Table responsive size="sm" bordered hover className="mb-0">
                          <thead>
                            <tr>
                              <th>ID</th>
                              <th>Status</th>
                              <th>Expiration</th>
                              <th>Delivery address</th>
                              <th>Event filters</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rcStatus.ringcentral.subscriptions.map((s, idx) => (
                              <tr key={String(s?.id ?? idx)}>
                                <td style={{ wordBreak: "break-all" }}>
                                  {String(s?.id ?? "—")}
                                </td>
                                <td>{String(s?.status ?? "—")}</td>
                                <td>{String(s?.expiration_time ?? "—")}</td>
                                <td style={{ wordBreak: "break-all" }}>
                                  {String(s?.delivery_mode?.address ?? "—")}
                                </td>
                                <td>
                                  {Array.isArray(s?.event_filters)
                                    ? s.event_filters.length
                                    : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      ) : (
                        <Alert variant="warning" className="mb-0">
                          No se encontraron suscripciones en RingCentral (o no se sincronizó).
                        </Alert>
                      )}
                    </div>
                  </div>
                </div>
              </Collapse>
            </>
          )}

          {!canEdit && (
            <Alert variant="info" className="mt-3 mb-0">
              No tienes permisos para ejecutar acciones de reparación/creación. Puedes ver el estado y el detalle.
            </Alert>
          )}
        </Card.Body>
      </Card>

      <Modal show={rcForceModalOpen} onHide={() => setRcForceModalOpen(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Forzar nueva suscripción</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Esta acción intentará crear una nueva suscripción en RingCentral (force_create=true).
          Úsala solo si “Asegurar suscripción” no resolvió el problema.
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="outline-secondary"
            onClick={() => setRcForceModalOpen(false)}
            disabled={rcEnsuring}
          >
            Cancelar
          </Button>
          <Button
            variant="danger"
            onClick={async () => {
              setRcForceModalOpen(false);
              await runEnsureSubscription({ forceCreate: true });
            }}
            disabled={rcEnsuring}
          >
            Sí, forzar
          </Button>
        </Modal.Footer>
      </Modal>

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
