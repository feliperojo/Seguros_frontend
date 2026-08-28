import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Modal, Form, Alert, Spinner, Badge } from "react-bootstrap";
import CompanySelect from "../selects/CompanySelect";
import PayerSelect from "../selects/PayerSelect";
import DateInputWithCalendar from "../common/DateInputWithCalendar";
import apiRequest from "../../services/api";
import CoveragePriceInput from "../common/CoveragePriceInput";
import {
  COBERTURA_TIPO_DENTAL_MS,
  memberTieneSaludMsActiva,
} from "../../constants/coberturaTipos";
import { mapCoberturaApiToFields, pickPagoFieldsFromSalud } from "../../utils/coberturaDental";
import { extractCoberturaFromCreateResponse } from "../../utils/buildMemberFromClienteExistente";
import { parseMoney } from "../../services/ingresos";
import useCompanies from "../../hooks/useCompanies";
import { buildPayerOptions } from "../../utils/payers";
import { TIPO_PAGO_OPTIONS } from "../../constants/coberturaFields";
import "./AgregarDentalModal.css";

const MSG_SIN_SALUD =
  "Para tener Dental MS, el miembro debe tener una cobertura de salud MS activa.";
const MSG_SIN_SELECCION =
  "Seleccione al menos un miembro para crear la cobertura Dental MS.";

const fullName = (m) =>
  m?.nombreCompleto ||
  [m?.primer_nombre, m?.segundo_nombre, m?.apellidos].filter(Boolean).join(" ") ||
  "Sin nombre";

const memberKey = (m) => m.cliente_id ?? m.id;

const emptyForm = () => ({
  fecha_activacion: "",
  compania_id: null,
  policy_number: "",
  agente: "",
  plan: "",
  estado_cobertura: "Sí",
  tipo_pago: "",
  pagador_id: null,
  dia_pago: "",
  precio: "",
});

const buildFormFromSalud = (saludMember) => ({
  ...emptyForm(),
  ...pickPagoFieldsFromSalud(saludMember || {}),
});

const FieldLabel = ({ children, hint }) => (
  <Form.Label className="agregar-dental-modal__label">
    {children}
    {hint && <span className="agregar-dental-modal__label-hint"> {hint}</span>}
  </Form.Label>
);

export default function AgregarDentalModal({
  open,
  onClose,
  members = [],
  grupoFamiliarId,
  onDentalCreated,
}) {
  const [form, setForm] = useState(emptyForm);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [memberIds, setMemberIds] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const { companies, loading: companiesLoading } = useCompanies();
  const payerOptions = useMemo(
    () => [
      ...buildPayerOptions(members || []),
      { value: "OTRO", label: "Otro (externo)" },
    ],
    [members]
  );

  const elegibles = useMemo(
    () =>
      (members || []).filter(
        (m) =>
          memberTieneSaludMsActiva(m) &&
          !m?.coberturaDental?.cobertura_id
      ),
    [members]
  );

  const selectedMembers = useMemo(
    () => elegibles.filter((m) => selectedIds.has(memberKey(m))),
    [elegibles, selectedIds]
  );

  useEffect(() => {
    if (!open) return;
    const fuente = elegibles[0] || null;
    setForm(buildFormFromSalud(fuente));
    setMemberIds({});
    setError("");
    setSelectedIds(new Set(elegibles.map(memberKey)));
  }, [open, elegibles]);

  const toggleMember = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const lastPagoSyncKeyRef = useRef(null);

  /** Con un solo miembro seleccionado, hereda agente/pago/pagador de su salud (sigue editable). */
  useEffect(() => {
    if (!open) {
      lastPagoSyncKeyRef.current = null;
      return;
    }
    if (selectedMembers.length !== 1) {
      lastPagoSyncKeyRef.current = null;
      return;
    }
    const fuente = selectedMembers[0];
    const key = memberKey(fuente);
    if (lastPagoSyncKeyRef.current === key) return;
    lastPagoSyncKeyRef.current = key;
    setForm((prev) => ({
      ...prev,
      ...pickPagoFieldsFromSalud(fuente),
    }));
  }, [open, selectedMembers]);

  const selectAll = () => {
    setSelectedIds(new Set(elegibles.map(memberKey)));
  };

  const clearAll = () => {
    setSelectedIds(new Set());
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    let v = value;
    if (name === "compania_id" || name === "pagador_id") {
      v = value === "" || value == null ? null : Number(value);
    }
    setForm((prev) => ({ ...prev, [name]: v }));
  };

  const handlePrecioChange = (nextValue) => {
    setForm((prev) => ({ ...prev, precio: nextValue }));
  };

  const handleSave = async () => {
    setError("");

    if (!grupoFamiliarId) {
      setError("No se encontró el grupo familiar.");
      return;
    }

    if (selectedMembers.length === 0) {
      setError(MSG_SIN_SELECCION);
      return;
    }

    const sinSalud = selectedMembers.filter((m) => !memberTieneSaludMsActiva(m));
    if (sinSalud.length) {
      setError(MSG_SIN_SALUD);
      return;
    }

    const idsPendientes = selectedMembers.filter(
      (m) => !(memberIds[memberKey(m)] || "").trim()
    );
    if (idsPendientes.length) {
      const ok = window.confirm(
        "Verifique e ingrese el Número de ID correspondiente a cada miembro seleccionado."
      );
      if (!ok) return;
    }

    setSaving(true);
    try {
      const results = [];

      for (const m of selectedMembers) {
        const cid = memberKey(m);
        const desdeSalud = pickPagoFieldsFromSalud(m);
        const payload = {
          grupo_familiar_id: grupoFamiliarId,
          cliente_id: cid,
          parentesco: m.parentesco || m.tipo || "Tomador",
          cobertura_tipo: COBERTURA_TIPO_DENTAL_MS,
          estado_cobertura: form.estado_cobertura || "Sí",
          ano_cobertura: String(m.ano_cobertura || new Date().getFullYear()),
          elegibilidad: m.elegibilidad || "",
          codigo_poliza: (memberIds[cid] || "").trim(),
          policy_number: form.policy_number || "",
          fecha_activacion: form.fecha_activacion || null,
          compania_id: form.compania_id,
          agente: (form.agente || desdeSalud.agente || "").trim(),
          plan: form.plan || "",
          tipo_pago: form.tipo_pago || desdeSalud.tipo_pago || null,
          pagador_id:
            form.pagador_id != null && form.pagador_id !== ""
              ? form.pagador_id
              : desdeSalud.pagador_id,
          dia_pago:
            form.dia_pago !== "" && form.dia_pago != null
              ? form.dia_pago
              : desdeSalud.dia_pago || null,
          precio: form.precio ? parseMoney(form.precio) : null,
          activo: true,
        };

        const res = await apiRequest("cobertura/create", "POST", payload);
        const cov = extractCoberturaFromCreateResponse(res);
        results.push({
          cliente_id: cid,
          coberturaDental: {
            ...mapCoberturaApiToFields(cov || {}),
            compania_id: cov?.compania_id ?? form.compania_id ?? null,
            pagador_id:
              cov?.pagador_id ??
              form.pagador_id ??
              desdeSalud.pagador_id ??
              null,
            agente: cov?.agente ?? form.agente ?? desdeSalud.agente ?? "",
            tipo_pago:
              cov?.tipo_pago ?? form.tipo_pago ?? desdeSalud.tipo_pago ?? null,
            dia_pago:
              cov?.dia_pago ?? form.dia_pago ?? desdeSalud.dia_pago ?? "",
            cobertura_tipo: COBERTURA_TIPO_DENTAL_MS,
            cobertura_id: cov?.id ?? res?.id ?? res?.data?.id,
          },
        });
      }

      onDentalCreated?.(results);
      onClose();
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "No se pudo crear la cobertura Dental MS."
      );
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <Modal
      show={open}
      onHide={onClose}
      size="xl"
      centered
      backdrop="static"
      dialogClassName="agregar-dental-modal"
    >
      <Modal.Header closeButton className="agregar-dental-modal__header">
        <div className="d-flex align-items-center gap-3 w-100">
          <div className="agregar-dental-modal__header-icon">
            <i className="fas fa-tooth" aria-hidden="true" />
          </div>
          <div>
            <h2 className="agregar-dental-modal__title">Nueva cobertura Dental MS</h2>
            <p className="agregar-dental-modal__subtitle">
              Registro de póliza dental complementaria al plan de salud del grupo familiar
            </p>
          </div>
        </div>
      </Modal.Header>

      <Modal.Body className="agregar-dental-modal__body">
        {elegibles.length === 0 ? (
          <div className="agregar-dental-modal__empty-state">
            <div className="agregar-dental-modal__empty-icon">
              <i className="fas fa-user-slash" aria-hidden="true" />
            </div>
            <h6 className="fw-semibold text-dark mb-2">Sin miembros elegibles</h6>
            <p className="text-muted small mb-0 mx-auto" style={{ maxWidth: 420 }}>
              Solo pueden registrarse personas con cobertura de Salud MS activa (estado Sí,
              vigente) que aún no cuenten con Dental MS en este grupo familiar.
            </p>
          </div>
        ) : (
          <>
            {error && (
              <Alert variant="danger" className="py-2 px-3 small mb-3 border-0">
                <i className="fas fa-exclamation-circle me-2" />
                {error}
              </Alert>
            )}

            {/* Miembros habilitados — primero */}
            <section className="agregar-dental-modal__section agregar-dental-modal__section--members">
              <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
                <div>
                  <h3 className="agregar-dental-modal__section-title mb-1 border-0 pb-0">
                    <i className="fas fa-users" />
                    Miembros a cubrir con Dental MS
                  </h3>
                  <p className="agregar-dental-modal__section-desc mb-0">
                    Solo aparecen miembros con <strong>Salud MS vigente</strong> en estado{" "}
                    <strong>Sí</strong> sin Dental MS. Marque a quiénes recibirán el producto.
                  </p>
                </div>
                <div className="d-flex gap-2 flex-shrink-0">
                  <button
                    type="button"
                    className="btn btn-link btn-sm text-decoration-none p-0"
                    onClick={selectAll}
                  >
                    Seleccionar todos
                  </button>
                  <span className="text-muted">|</span>
                  <button
                    type="button"
                    className="btn btn-link btn-sm text-decoration-none p-0"
                    onClick={clearAll}
                  >
                    Desmarcar todos
                  </button>
                </div>
              </div>

              <div className="agregar-dental-modal__selection-summary">
                <Badge bg="primary" pill className="me-2">
                  {selectedMembers.length}
                </Badge>
                <span>
                  de {elegibles.length} miembro{elegibles.length !== 1 ? "s" : ""} seleccionado
                  {selectedMembers.length !== 1 ? "s" : ""}
                </span>
              </div>

              <div className="agregar-dental-modal__members-list">
                {elegibles.map((m) => {
                  const id = memberKey(m);
                  const selected = selectedIds.has(id);
                  return (
                    <div
                      key={id}
                      className={`agregar-dental-modal__member-card${
                        selected ? " agregar-dental-modal__member-card--selected" : ""
                      }`}
                    >
                      <div className="agregar-dental-modal__member-card-header">
                        <Form.Check
                          type="checkbox"
                          id={`dental-member-${id}`}
                          checked={selected}
                          onChange={() => toggleMember(id)}
                          label={
                            <span className="agregar-dental-modal__member-name">
                              {fullName(m)}
                            </span>
                          }
                          className="agregar-dental-modal__member-check"
                        />
                        <span className="agregar-dental-modal__member-role">
                          {m.parentesco || m.tipo}
                        </span>
                        <Badge
                          bg="success"
                          className="agregar-dental-modal__salud-badge"
                          pill
                        >
                          Salud MS: Sí
                        </Badge>
                      </div>

                      {selected && (
                        <div className="agregar-dental-modal__member-card-body">
                          <div className="row g-2 align-items-end">
                            <div className="col-md-5">
                              <FieldLabel>Número de ID</FieldLabel>
                              <Form.Control
                                size="sm"
                                placeholder="Número de póliza + dígitos de miembro"
                                value={memberIds[id] || ""}
                                onChange={(e) =>
                                  setMemberIds((prev) => ({
                                    ...prev,
                                    [id]: e.target.value,
                                  }))
                                }
                                aria-label={`Número de ID para ${fullName(m)}`}
                              />
                            </div>
                            <div className="col-md-3">
                              <span className="agregar-dental-modal__inherited-label">
                                Año cobertura
                              </span>
                              <div className="agregar-dental-modal__inherited-value">
                                {m.ano_cobertura || "—"}
                              </div>
                            </div>
                            <div className="col-md-4">
                              <span className="agregar-dental-modal__inherited-label">
                                Elegibilidad
                              </span>
                              <div className="agregar-dental-modal__inherited-value">
                                {m.elegibilidad || "—"}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            <div className="agregar-dental-modal__notice" role="note">
              <i className="fas fa-info-circle agregar-dental-modal__notice-icon" />
              <span>
                Los datos del plan (compañía, plan, precio, etc.) se aplican a todos los
                miembros seleccionados. Verifique bajo qué miembro está registrado el precio
                total ante la aseguradora. El <strong>Número de ID</strong> es individual por
                persona.
              </span>
            </div>

            <section className="agregar-dental-modal__section">
              <h3 className="agregar-dental-modal__section-title">
                <i className="fas fa-id-card" />
                Identificación de póliza
              </h3>
              <div className="row g-3">
                <div className="col-md-6">
                  <FieldLabel>Código ID</FieldLabel>
                  <Form.Control
                    name="policy_number"
                    value={form.policy_number}
                    onChange={handleChange}
                    placeholder="Identificador adicional de póliza"
                  />
                </div>
                <div className="col-md-6">
                  <FieldLabel>Fecha de activación</FieldLabel>
                  <DateInputWithCalendar
                    valueIso={(form.fecha_activacion || "").slice(0, 10)}
                    onChangeIso={(iso) =>
                      setForm((prev) => ({ ...prev, fecha_activacion: iso || "" }))
                    }
                    inputName="fecha_activacion"
                  />
                </div>
              </div>
            </section>

            <section className="agregar-dental-modal__section">
              <h3 className="agregar-dental-modal__section-title">
                <i className="fas fa-building" />
                Aseguradora y plan
              </h3>
              <div className="row g-3">
                <div className="col-md-6">
                  <FieldLabel>Compañía</FieldLabel>
                  <CompanySelect
                    companies={companies}
                    name="compania_id"
                    value={form.compania_id}
                    onChange={handleChange}
                    disabled={companiesLoading}
                    className="form-select"
                  />
                  {companiesLoading && (
                    <div className="text-muted small mt-1">
                      <Spinner animation="border" size="sm" className="me-1" />
                      Cargando aseguradoras…
                    </div>
                  )}
                </div>
                <div className="col-md-6">
                  <FieldLabel>Agente</FieldLabel>
                  <Form.Control
                    name="agente"
                    value={form.agente}
                    onChange={handleChange}
                    placeholder="Nombre del agente o broker"
                  />
                </div>
                <div className="col-md-6">
                  <FieldLabel>Plan</FieldLabel>
                  <Form.Control
                    name="plan"
                    value={form.plan}
                    onChange={handleChange}
                    placeholder="Nombre del plan dental"
                  />
                </div>
                <div className="col-md-6">
                  <FieldLabel>Precio ($)</FieldLabel>
                  <CoveragePriceInput
                    value={form.precio}
                    onChange={handlePrecioChange}
                    className="form-control"
                  />
                </div>
              </div>
            </section>

            <section className="agregar-dental-modal__section">
              <h3 className="agregar-dental-modal__section-title">
                <i className="fas fa-credit-card" />
                Información de pago
              </h3>
              <div className="row g-3">
                <div className="col-md-4">
                  <FieldLabel>Tipo de pago</FieldLabel>
                  <Form.Select name="tipo_pago" value={form.tipo_pago} onChange={handleChange}>
                    <option value="">Seleccione…</option>
                    {TIPO_PAGO_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </Form.Select>
                </div>
                <div className="col-md-4">
                  <FieldLabel>Pagador</FieldLabel>
                  <PayerSelect
                    options={payerOptions}
                    value={
                      form.pagador_id === undefined ||
                      form.pagador_id === null ||
                      form.pagador_id === ""
                        ? "OTRO"
                        : String(form.pagador_id)
                    }
                    onChange={handleChange}
                    className="form-select"
                  />
                </div>
                <div className="col-md-4">
                  <FieldLabel>Día de pago</FieldLabel>
                  <Form.Control
                    name="dia_pago"
                    value={form.dia_pago}
                    onChange={handleChange}
                    placeholder="1–31"
                    inputMode="numeric"
                  />
                </div>
              </div>
            </section>
          </>
        )}
      </Modal.Body>

      <Modal.Footer className="agregar-dental-modal__footer">
        <button
          type="button"
          className="btn btn-outline-secondary agregar-dental-modal__btn-cancel"
          onClick={onClose}
          disabled={saving}
        >
          Cancelar
        </button>
        <button
          type="button"
          className="btn btn-primary agregar-dental-modal__btn-save"
          disabled={saving || elegibles.length === 0 || selectedMembers.length === 0}
          onClick={handleSave}
        >
          {saving ? (
            <>
              <Spinner
                animation="border"
                size="sm"
                className="me-2"
                role="status"
                aria-hidden="true"
              />
              Registrando…
            </>
          ) : (
            <>
              <i className="fas fa-check me-2" aria-hidden="true" />
              Guardar Dental MS
              {selectedMembers.length > 0 && (
                <span className="ms-1">({selectedMembers.length})</span>
              )}
            </>
          )}
        </button>
      </Modal.Footer>
    </Modal>,
    document.body
  );
}
