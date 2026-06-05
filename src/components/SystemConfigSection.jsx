import React, { useState } from "react";
import { Card, Form, Button, Spinner, Alert, Table, Badge } from "react-bootstrap";
import { toast } from "react-toastify";
import systemConfigService from "../services/SystemConfigService";
import { useAuth } from "../context/AuthContext";

const CONFIG_KEYS = {
  SUPER_USER_ID: "super_user_id",
  WORK_SCHEDULE: "work_schedule",
  SHOW_PAYMENT_METHODS_DATA: "show_payment_methods_data",
};

const DAY_LABELS = {
  0: "Domingo",
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sábado",
};

function defaultWorkSchedule() {
  return {
    timezone: "America/Bogota",
    effective_from: null,
    weekly: {
      0: [],
      1: [
        { start: "08:00", end: "12:00" },
        { start: "13:00", end: "17:00" },
      ],
      2: [
        { start: "08:00", end: "12:00" },
        { start: "13:00", end: "17:00" },
      ],
      3: [
        { start: "08:00", end: "12:00" },
        { start: "13:00", end: "17:00" },
      ],
      4: [
        { start: "08:00", end: "12:00" },
        { start: "13:00", end: "17:00" },
      ],
      5: [
        { start: "08:00", end: "12:00" },
        { start: "13:00", end: "17:00" },
      ],
      6: [],
    },
    holidays: [],
  };
}

function normalizeWorkSchedule(raw) {
  const base = defaultWorkSchedule();
  const v = raw && typeof raw === "object" ? raw : {};
  const weekly = v.weekly && typeof v.weekly === "object" ? v.weekly : {};

  // Asegura que weekly siempre tenga 0..6 como arrays
  const normalizedWeekly = {};
  for (let d = 0; d <= 6; d++) {
    const windows = weekly[d] ?? weekly[String(d)];
    normalizedWeekly[d] = Array.isArray(windows)
      ? windows
          .map((w) => ({
            start: String(w?.start ?? "").slice(0, 5),
            end: String(w?.end ?? "").slice(0, 5),
          }))
          .filter((w) => w.start && w.end)
      : [];
  }

  const holidays = Array.isArray(v.holidays)
    ? v.holidays.map((x) => String(x)).filter(Boolean)
    : [];

  return {
    ...base,
    ...v,
    timezone: String(v.timezone || base.timezone),
    effective_from: v.effective_from ? String(v.effective_from) : null,
    weekly: normalizedWeekly,
    holidays,
  };
}

function isValidTimeHHmm(s) {
  return /^\d{2}:\d{2}$/.test(String(s || "")) && String(s) >= "00:00" && String(s) <= "23:59";
}

function isValidDateYYYYMMDD(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
}

/**
 * Convierte la respuesta GET /api/v1/system-config (array de { key, value, type }) en objeto para estado.
 * value en BD es text; type es int|bool|json|string. Casteamos según type para el formulario.
 */
function configFromApiResponse(items) {
  const result = {
    [CONFIG_KEYS.SUPER_USER_ID]: null,
    [CONFIG_KEYS.WORK_SCHEDULE]: defaultWorkSchedule(),
    [CONFIG_KEYS.SHOW_PAYMENT_METHODS_DATA]: false,
  };
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
    result[item.key] = item.key === CONFIG_KEYS.WORK_SCHEDULE ? normalizeWorkSchedule(value) : value;
  }
  // Si no vino work_schedule desde API, deja default para que la UI no reviente
  if (!result[CONFIG_KEYS.WORK_SCHEDULE]) result[CONFIG_KEYS.WORK_SCHEDULE] = defaultWorkSchedule();
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
  canEditSettings = true,
  canViewSettings = true,
}) => {
  const { setAppSettings } = useAuth();
  const [saving, setSaving] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [savingPaymentMethods, setSavingPaymentMethods] = useState(false);

  const update = (key, value) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!canEditSettings) return;
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

  const schedule = normalizeWorkSchedule(config?.[CONFIG_KEYS.WORK_SCHEDULE]);

  const updateSchedule = (partial) => {
    update(CONFIG_KEYS.WORK_SCHEDULE, { ...schedule, ...partial });
  };

  const updateWeeklyWindow = (day, idx, partial) => {
    const nextWeekly = { ...(schedule.weekly || {}) };
    const arr = Array.isArray(nextWeekly[day]) ? [...nextWeekly[day]] : [];
    const prev = arr[idx] || { start: "", end: "" };
    arr[idx] = { ...prev, ...partial };
    nextWeekly[day] = arr;
    updateSchedule({ weekly: nextWeekly });
  };

  const addWeeklyWindow = (day) => {
    const nextWeekly = { ...(schedule.weekly || {}) };
    const arr = Array.isArray(nextWeekly[day]) ? [...nextWeekly[day]] : [];
    arr.push({ start: "08:00", end: "17:00" });
    nextWeekly[day] = arr;
    updateSchedule({ weekly: nextWeekly });
  };

  const removeWeeklyWindow = (day, idx) => {
    const nextWeekly = { ...(schedule.weekly || {}) };
    const arr = Array.isArray(nextWeekly[day]) ? [...nextWeekly[day]] : [];
    nextWeekly[day] = arr.filter((_, i) => i !== idx);
    updateSchedule({ weekly: nextWeekly });
  };

  const holidaysText = Array.isArray(schedule.holidays) ? schedule.holidays.join("\n") : "";

  const updateHolidaysFromText = (text) => {
    const arr = String(text || "")
      .split(/\r?\n/g)
      .map((s) => s.trim())
      .filter(Boolean);
    updateSchedule({ holidays: arr });
  };

  const validateSchedule = () => {
    const tz = String(schedule.timezone || "").trim();
    if (!tz) return "La zona horaria (timezone) es obligatoria.";

    if (schedule.effective_from && !isValidDateYYYYMMDD(schedule.effective_from)) {
      return "effective_from debe tener formato YYYY-MM-DD (o quedar vacío).";
    }

    // Validar ventanas
    for (let d = 0; d <= 6; d++) {
      const arr = Array.isArray(schedule.weekly?.[d]) ? schedule.weekly[d] : [];
      for (const w of arr) {
        if (!isValidTimeHHmm(w?.start) || !isValidTimeHHmm(w?.end)) {
          return `Horario inválido en ${DAY_LABELS[d]}: usa HH:mm.`;
        }
        if (String(w.start) >= String(w.end)) {
          return `En ${DAY_LABELS[d]}: la hora de inicio debe ser menor que la hora fin.`;
        }
      }
    }

    // Validar festivos
    for (const h of schedule.holidays || []) {
      if (!isValidDateYYYYMMDD(h)) return "Festivos inválidos: cada fecha debe ser YYYY-MM-DD.";
    }

    return null;
  };

  const handleSaveShowPaymentMethodsData = async () => {
    if (!canEditSettings) return;
    setSavingPaymentMethods(true);
    try {
      const value = !!config[CONFIG_KEYS.SHOW_PAYMENT_METHODS_DATA];
      await systemConfigService.put(CONFIG_KEYS.SHOW_PAYMENT_METHODS_DATA, value, "bool");
      try {
        const runtime = await systemConfigService.getRuntime();
        const next = {
          show_payment_methods_data: !!runtime?.show_payment_methods_data,
          require_super_password: !!runtime?.require_super_password,
        };
        if (typeof setAppSettings === "function") {
          setAppSettings(next);
        }
        localStorage.setItem("app_settings", JSON.stringify(next));
      } catch {
        // no bloquear guardado si falla runtime
      }
      toast.success(
        value
          ? "Los datos de medios de pago se mostrarán sin enmascarar."
          : "Los datos de medios de pago volverán a enmascararse (comportamiento habitual)."
      );
    } catch (err) {
      const msg = err?.message || err?.response?.data?.message || "Error al guardar.";
      toast.error(msg);
    } finally {
      setSavingPaymentMethods(false);
    }
  };

  const handleSaveWorkSchedule = async () => {
    if (!canEditSettings) return;
    const err = validateSchedule();
    if (err) {
      toast.error(err);
      return;
    }

    setSavingSchedule(true);
    try {
      await systemConfigService.put(CONFIG_KEYS.WORK_SCHEDULE, schedule, "json");
      toast.success("Jornada laboral guardada correctamente.");
    } catch (err2) {
      const msg = err2?.message || err2?.response?.data?.message || "Error al guardar jornada laboral.";
      toast.error(msg);
    } finally {
      setSavingSchedule(false);
    }
  };

  return (
    <Card className="mb-4">
      <Card.Header>
        <span>Configuración del sistema</span>
      </Card.Header>
      <Card.Body>
        {!canViewSettings && (
          <Alert variant="danger">
            No tienes permisos para ver la configuración del sistema.
          </Alert>
        )}
        {loadingConfig ? (
          <div className="d-flex align-items-center gap-2">
            <Spinner animation="border" size="sm" />
            <span>Cargando configuración...</span>
          </div>
        ) : !canViewSettings ? null : (
          <>
            <Form.Group className="mb-3">
              <Form.Label>Super usuario (super admin)</Form.Label>
              <Form.Select
                value={currentSuperUserId}
                onChange={(e) =>
                  update(CONFIG_KEYS.SUPER_USER_ID, e.target.value ? parseInt(e.target.value, 10) : "")
                }
                disabled={loadingUsers || !canEditSettings}
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

            <Button variant="primary" onClick={handleSave} disabled={saving || !canEditSettings}>
              {saving ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" />
                  Guardando...
                </>
              ) : (
                "Guardar super usuario"
              )}
            </Button>

            <hr className="my-4" />

            <div className="mb-4 p-3 rounded border bg-light">
              <div className="fw-semibold mb-1">Medios de pago</div>
              <p className="text-muted small mb-3">
                Durante migraciones o configuración inicial puede activar la visualización completa
                de números de tarjeta, CVV y cuentas bancarias. Si está desactivado, se mantiene el
                enmascarado con el botón &quot;Desbloquear datos sensibles&quot;.
              </p>
              <Form.Check
                type="checkbox"
                id="show_payment_methods_data"
                label="Mostrar datos de medios de pago (sin enmascarar)"
                checked={!!config[CONFIG_KEYS.SHOW_PAYMENT_METHODS_DATA]}
                onChange={(e) =>
                  update(CONFIG_KEYS.SHOW_PAYMENT_METHODS_DATA, e.target.checked)
                }
                disabled={!canEditSettings}
                className="mb-3"
              />
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveShowPaymentMethodsData}
                disabled={savingPaymentMethods || !canEditSettings}
              >
                {savingPaymentMethods ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-2" />
                    Guardando...
                  </>
                ) : (
                  "Guardar configuración de medios de pago"
                )}
              </Button>
            </div>

            <hr className="my-4" />

            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
              <div>
                <div className="fw-semibold">Jornada laboral</div>
                <div className="text-muted small">
                  Se guarda en <Badge bg="secondary">work_schedule</Badge> y aplica globalmente.
                </div>
              </div>
              <Button
                variant="primary"
                onClick={handleSaveWorkSchedule}
                disabled={savingSchedule || !canEditSettings}
              >
                {savingSchedule ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-2" />
                    Guardando...
                  </>
                ) : (
                  "Guardar jornada laboral"
                )}
              </Button>
            </div>

            <div className="row">
              <div className="col-md-6 mb-3">
                <Form.Group className="mb-3">
                  <Form.Label>Zona horaria (IANA)</Form.Label>
                  <Form.Control
                    type="text"
                    value={schedule.timezone || ""}
                    onChange={(e) => updateSchedule({ timezone: e.target.value })}
                    disabled={!canEditSettings}
                    placeholder="America/Bogota"
                  />
                  <div className="form-text">
                    Ejemplo: <code>America/Bogota</code>, <code>America/Mexico_City</code>.
                  </div>
                </Form.Group>

                <Form.Group>
                  <Form.Label>Vigente desde (opcional)</Form.Label>
                  <Form.Control
                    type="date"
                    value={schedule.effective_from || ""}
                    onChange={(e) =>
                      updateSchedule({ effective_from: e.target.value ? e.target.value : null })
                    }
                    disabled={!canEditSettings}
                  />
                </Form.Group>
              </div>

              <div className="col-md-6 mb-3">
                <Form.Group>
                  <Form.Label>Festivos / no laborables (uno por línea)</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={6}
                    value={holidaysText}
                    onChange={(e) => updateHolidaysFromText(e.target.value)}
                    disabled={!canEditSettings}
                    placeholder={"2026-01-01\n2026-03-23"}
                  />
                  <div className="form-text">Formato requerido: YYYY-MM-DD.</div>
                </Form.Group>
              </div>
            </div>

            <div className="mb-2 fw-semibold">Horario semanal</div>
            <div className="text-muted small mb-3">
              Define las ventanas laborales por día. Puedes agregar varias ventanas (ej. mañana y tarde).
            </div>

            <Table bordered responsive size="sm">
              <thead>
                <tr>
                  <th style={{ width: 140 }}>Día</th>
                  <th>Ventanas</th>
                  <th style={{ width: 160 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 7 }).map((_, day) => {
                  const windows = Array.isArray(schedule.weekly?.[day]) ? schedule.weekly[day] : [];
                  return (
                    <tr key={day}>
                      <td className="align-middle">
                        <span className="fw-semibold">{DAY_LABELS[day]}</span>
                      </td>
                      <td>
                        {windows.length === 0 ? (
                          <span className="text-muted small">Sin horario (no laborable)</span>
                        ) : (
                          <div className="d-flex flex-column gap-2">
                            {windows.map((w, idx) => (
                              <div key={`${day}-${idx}`} className="d-flex align-items-center gap-2 flex-wrap">
                                <Form.Control
                                  type="time"
                                  value={w.start || ""}
                                  onChange={(e) => updateWeeklyWindow(day, idx, { start: e.target.value })}
                                  disabled={!canEditSettings}
                                  style={{ maxWidth: 140 }}
                                />
                                <span className="text-muted small">a</span>
                                <Form.Control
                                  type="time"
                                  value={w.end || ""}
                                  onChange={(e) => updateWeeklyWindow(day, idx, { end: e.target.value })}
                                  disabled={!canEditSettings}
                                  style={{ maxWidth: 140 }}
                                />
                                <Button
                                  variant="outline-danger"
                                  size="sm"
                                  onClick={() => removeWeeklyWindow(day, idx)}
                                  disabled={!canEditSettings}
                                >
                                  Quitar
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="align-middle">
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          onClick={() => addWeeklyWindow(day)}
                          disabled={!canEditSettings}
                        >
                          + Agregar ventana
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </>
        )}
      </Card.Body>
    </Card>
  );
};

export default SystemConfigSection;
export { CONFIG_KEYS, configFromApiResponse };
