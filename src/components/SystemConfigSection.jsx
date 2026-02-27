import React, { useState } from "react";
import { Card, Form, Button, Spinner } from "react-bootstrap";
import { toast } from "react-toastify";
import systemConfigService from "../services/SystemConfigService";

const CONFIG_KEYS = {
  SUPER_USER_ID: "super_user_id",
};

/**
 * Convierte la respuesta GET /api/v1/system-config (array de { key, value, type }) en objeto para estado.
 * value en BD es text; type es int|bool|json|string. Casteamos según type para el formulario.
 */
function configFromApiResponse(items) {
  const result = { [CONFIG_KEYS.SUPER_USER_ID]: null };
  if (!Array.isArray(items)) return result;
  for (const item of items) {
    if (!item || typeof item.key !== "string") continue;
    let value = item.value;
    const type = (item.type || "string").toLowerCase();
    if (type === "int") {
      if (value != null && value !== "") {
        const num = typeof value === "number" ? value : parseInt(String(value), 10);
        value = Number.isNaN(num) ? null : num;
      } else {
        value = null;
      }
    } else if (type === "bool") {
      value = value === true || value === "true" || value === 1;
    } else if (type === "json") {
      if (typeof value === "string" && value.trim()) {
        try {
          value = JSON.parse(value);
        } catch {
          value = {};
        }
      } else if (typeof value !== "object" || value === null) {
        value = {};
      }
    }
    result[item.key] = value;
  }
  return result;
}

/**
 * Sección de configuración del sistema: inicialmente solo Super usuario (super admin).
 * Props: config, setConfig, users, loadingUsers, loadingConfig
 */
const SystemConfigSection = ({
  config,
  setConfig,
  users = [],
  loadingUsers = false,
  loadingConfig = false,
}) => {
  const [saving, setSaving] = useState(false);

  const update = (key, value) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    const superUserId = config[CONFIG_KEYS.SUPER_USER_ID];
    if (superUserId == null || superUserId === "" || String(superUserId).trim() === "") {
      toast.error("El super usuario es requerido.");
      return;
    }
    const num = typeof superUserId === "number" ? superUserId : parseInt(String(superUserId), 10);
    if (Number.isNaN(num) || num < 1) {
      toast.error("Selecciona un usuario válido.");
      return;
    }

    setSaving(true);
    try {
      await systemConfigService.put(CONFIG_KEYS.SUPER_USER_ID, num, "int");
      toast.success("Super usuario guardado correctamente.");
    } catch (err) {
      const msg = err?.message || err?.response?.data?.message || "Error al guardar.";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const superUserId = config[CONFIG_KEYS.SUPER_USER_ID];
  const currentSuperUserId = superUserId != null && superUserId !== "" ? String(superUserId) : "";

  return (
    <Card className="mb-4">
      <Card.Header>
        <span>Configuración del sistema</span>
      </Card.Header>
      <Card.Body>
        {loadingConfig ? (
          <div className="d-flex align-items-center gap-2">
            <Spinner animation="border" size="sm" />
            <span>Cargando configuración...</span>
          </div>
        ) : (
          <>
            <Form.Group className="mb-3">
              <Form.Label>Super usuario (super admin)</Form.Label>
              <Form.Select
                value={currentSuperUserId}
                onChange={(e) =>
                  update(CONFIG_KEYS.SUPER_USER_ID, e.target.value ? parseInt(e.target.value, 10) : "")
                }
                disabled={loadingUsers}
              >
                <option value="">Seleccionar usuario...</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {[u.name, u.nombre_completo, u.full_name].find(Boolean) || u.email || `Usuario #${u.id}`}
                    {u.email ? ` (${u.email})` : ""}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>

            <Button variant="primary" onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" />
                  Guardando...
                </>
              ) : (
                "Guardar super usuario"
              )}
            </Button>
          </>
        )}
      </Card.Body>
    </Card>
  );
};

export default SystemConfigSection;
export { CONFIG_KEYS, configFromApiResponse };
