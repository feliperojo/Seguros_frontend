import React from "react";
import UserCoverageIcon from "../fase2/UserCoverageIcon"; 

// util: nombre completo (soporta cliente anidado o plano)
const fullName = (m) => {
  const c = m?.cliente ?? m ?? {};
  const composed =
    [c.primer_nombre?.trim(), c.segundo_nombre?.trim(), c.apellidos?.trim()]
      .filter(Boolean)
      .join(" ");
  return (
    composed ||
    c.nombre_completo ||
    m?.nombreCompleto ||
    "Sin nombre"
  );
};

// util: campo de formulario
const Field = ({ label, children, className = "col-md-6" }) => (
  <div className={className}>
    <label className="form-label small fw-semibold text-muted">{label}</label>
    {children}
  </div>
);

const TomaDeDatos = ({
  familyMembers,
  setFamilyMembers,
  onSaveMember,
  onSaveCobertura,
  onDeleteMember,
}) => {
  // Actualiza miembro (plano) como ya lo tenías
  const updateMember = (idx, patch) => {
    setFamilyMembers((prev) =>
      prev.map((m, i) => (i === idx ? { ...m, ...patch } : m))
    );
  };

  // Cambio genérico para estructura PLANA (compatibilidad)
  const onChange = (idx) => (e) => {
    const { name, value } = e.target;
    updateMember(idx, { [name]: value });
  };

  // Cambio para estructura con m.cliente (si existe); si no, cae al plano
  const onChangeCliente = (idx) => (e) => {
    const { name, value } = e.target;
    setFamilyMembers((prev) =>
      prev.map((m, i) => {
        if (i !== idx) return m;
        if (m?.cliente && typeof m.cliente === "object") {
          return {
            ...m,
            cliente: {
              ...m.cliente,
              [name]: value,
            },
          };
        }
        // fallback a plano si no hay cliente anidado
        return { ...m, [name]: value };
      })
    );
  };

  // Datos de ejemplo para la demo (igual que antes)
  const sampleMembers = [
    {
      id: 1,
      tipo: "Tomador",
      primer_nombre: "Jose David",
      apellidos: "Castillo Ospina",
      edad: 49,
      genero: "Masculino",
      fecha_nacimiento: "1975-03-15",
      idioma: "Español",
      nota: "",
      parentesco: "Tomador",
      estado_cobertura: "Sí",
      codigo_poliza: "POL-001234",
      vigencia: "2025-01",
    },
    {
      id: 2,
      tipo: "Cónyuge",
      primer_nombre: "Maria Elena",
      apellidos: "Rodriguez Lopez",
      edad: 45,
      genero: "Femenino",
      fecha_nacimiento: "1979-07-22",
      idioma: "Español",
      nota: "",
      parentesco: "Cónyuge",
      estado_cobertura: "No",
      codigo_poliza: "",
      vigencia: "",
    },
  ];

  const members = familyMembers?.length > 0 ? familyMembers : sampleMembers;

  // Helper para leer siempre del cliente anidado si existe
  const getC = (m) => (m?.cliente ? m.cliente : m);

  return (
    <div className="container-fluid p-0">
      {members.map((m, idx) => {
        const itemId = `member-${m.id || idx}`;
        const leftRightWidth = 180;

        const c = getC(m); // <- todos los bindings leen desde aquí

        return (
          <div className="card shadow-sm mb-3" key={itemId}>
            {/* Header de la card */}
            <div className="card-header bg-white border-0 px-4 py-3">
              <div className="d-flex align-items-center position-relative" style={{ minHeight: 64 }}>
                {/* IZQUIERDA: rol + icono */}
                <div
                  className="d-flex flex-column justify-content-center align-items-start me-3"
                  style={{ width: leftRightWidth }}
                >
                  <span className="fw-semibold" style={{ color: "#0d6efd" }}>
                    {m.tipo || "Miembro"}
                  </span>

                  <div className="mt-2">
                    <UserCoverageIcon status={m.estado_cobertura} size={50} />
                  </div>
                </div>

                {/* CENTRO: nombre siempre centrado */}
                <div className="flex-grow-1 text-center">
                  <span className="fw-semibold text-dark">{fullName(m)}</span>
                </div>

                {/* DERECHA: edad / género */}
                <div
                  className="d-flex align-items-center justify-content-end ms-3"
                  style={{ width: leftRightWidth }}
                >
                  <div className="text-start me-3">
                    <div className="small">
                      <span className="text-muted">Edad: </span>
                      <span className="fw-semibold text-muted">{c.edad ?? m.edad ?? "N/A"}</span>
                    </div>
                    <div className="small text-muted">Género: {c.genero ?? m.genero ?? "—"}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Acordeones internos */}
            <div className="card-body p-0">
              <div className="accordion accordion-flush" id={`accordion-${itemId}`}>
               {/* Datos Cliente */}
<div className="accordion-item">
  <h2 className="accordion-header" id={`cliente-${itemId}`}>
    <button
      className="accordion-button collapsed py-3 px-4"
      type="button"
      data-bs-toggle="collapse"
      data-bs-target={`#collapse-cliente-${itemId}`}
      aria-expanded="false"
      aria-controls={`collapse-cliente-${itemId}`}
    >
      <div className="d-flex align-items-center">
        <i className="fas fa-user me-2 text-muted"></i>
        <span className="fw-semibold">Datos Cliente</span>
      </div>
    </button>
  </h2>
  <div
    id={`collapse-cliente-${itemId}`}
    className="accordion-collapse collapse"
    aria-labelledby={`cliente-${itemId}`}
    data-bs-parent={`#accordion-${itemId}`}
  >
    <div className="accordion-body px-4 py-4">
      {/* SUB-ACORDEON */}
      <div className="accordion" id={`sub-accordion-${itemId}`}>

        {/* Sección: Datos Principales */}
        <div className="accordion-item">
          <h2 className="accordion-header" id={`datos-principales-${itemId}`}>
            <button
              className="accordion-button collapsed"
              type="button"
              data-bs-toggle="collapse"
              data-bs-target={`#collapse-principales-${itemId}`}
              aria-expanded="false"
              aria-controls={`collapse-principales-${itemId}`}
            >
              Datos Principales
            </button>
          </h2>
          <div
            id={`collapse-principales-${itemId}`}
            className="accordion-collapse collapse"
            aria-labelledby={`datos-principales-${itemId}`}
            data-bs-parent={`#sub-accordion-${itemId}`}
          >
            <div className="accordion-body">
              <div className="row g-3">
                <Field label="Primer Nombre" className="col-md-4">
                  <input
                    className="form-control form-control-sm"
                    name="primer_nombre"
                    value={c.primer_nombre ?? ""}
                    onChange={onChangeCliente(idx)}
                  />
                </Field>
                <Field label="Segundo Nombre" className="col-md-4">
                  <input
                    className="form-control form-control-sm"
                    name="segundo_nombre"
                    value={c.segundo_nombre ?? ""}
                    onChange={onChangeCliente(idx)}
                  />
                </Field>
                <Field label="Apellidos" className="col-md-4">
                  <input
                    className="form-control form-control-sm"
                    name="apellidos"
                    value={c.apellidos ?? ""}
                    onChange={onChangeCliente(idx)}
                  />
                </Field>
                <Field label="Fecha de Nacimiento" className="col-md-4">
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    name="fecha_nacimiento"
                    value={c.fecha_nacimiento ?? ""}
                    onChange={onChangeCliente(idx)}
                  />
                </Field>
                <Field label="Edad" className="col-md-2">
                  <input
                    type="number"
                    className="form-control form-control-sm"
                    name="edad"
                    value={c.edad ?? ""}
                    readOnly
                  />
                </Field>
                <Field label="Género" className="col-md-3">
                  <select
                    className="form-select form-select-sm"
                    name="genero"
                    value={c.genero ?? ""}
                    onChange={onChangeCliente(idx)}
                  >
                    <option value="">Seleccione</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Femenino">Femenino</option>
                  </select>
                </Field>
                <Field label="Idioma" className="col-md-3">
                  <select
                    className="form-select form-select-sm"
                    name="idioma"
                    value={c.idioma ?? ""}
                    onChange={onChangeCliente(idx)}
                  >
                    <option value="">Seleccione</option>
                    <option value="Español">Español</option>
                    <option value="Inglés">Inglés</option>
                    <option value="Otro">Otro</option>
                  </select>
                </Field>
              </div>
            </div>
          </div>
        </div>

        {/* Sección: Estatus migratorio */}
<div className="accordion-item">
  <h2 className="accordion-header" id={`estatus-${itemId}`}>
    <button
      className="accordion-button collapsed"
      type="button"
      data-bs-toggle="collapse"
      data-bs-target={`#collapse-estatus-${itemId}`}
      aria-expanded="false"
      aria-controls={`collapse-estatus-${itemId}`}
    >
      Estatus migratorio
    </button>
  </h2>

  <div
    id={`collapse-estatus-${itemId}`}
    className="accordion-collapse collapse"
    aria-labelledby={`estatus-${itemId}`}
    data-bs-parent={`#sub-accordion-${itemId}`}
  >
    <div className="accordion-body">
      <div className="row g-3">
        {/* Fila 1 */}
        <Field label="Social" className="col-md-6">
          <input
            className="form-control form-control-sm"
            name="social"
            value={c.social ?? ""}
            onChange={onChangeCliente(idx)}
          />
        </Field>

        <Field label="Status" className="col-md-6">
          <select
            className="form-select form-select-sm"
            name="status"
            value={c.status ?? ""}
            onChange={onChangeCliente(idx)}
          >
            <option value="">Seleccione</option>
            <option value="Ciudadano">Ciudadano</option>
            <option value="Residente">Residente</option>
            <option value="Visa">Visa</option>
            <option value="Permiso de Trabajo">Permiso de Trabajo</option>
            <option value="Indocumentado">Indocumentado</option>
            <option value="Otro">Otro</option>
          </select>
        </Field>

        {/* Fila 2 */}
        <Field label="A/USCIS" className="col-md-6">
          <input
            className="form-control form-control-sm"
            name="auscis"
            value={c.auscis ?? ""}
            onChange={onChangeCliente(idx)}
          />
        </Field>

        <Field label="Tarjeta #" className="col-md-6">
          <input
            className="form-control form-control-sm"
            name="tarjeta_numero"
            value={c.tarjeta_numero ?? ""}
            onChange={onChangeCliente(idx)}
          />
        </Field>

        {/* Fila 3 */}
        <Field label="Fecha Emisión" className="col-md-3">
          <input
            type="date"
            className="form-control form-control-sm"
            name="fecha_emision"
            value={c.fecha_emision ?? ""}
            onChange={onChangeCliente(idx)}
          />
        </Field>

        <Field label="Fecha Expiración" className="col-md-3">
          <input
            type="date"
            className="form-control form-control-sm"
            name="fecha_expiracion"
            value={c.fecha_expiracion ?? ""}
            onChange={onChangeCliente(idx)}
          />
        </Field>

        <Field label="Categoría" className="col-md-6">
          <input
            className="form-control form-control-sm"
            name="categoria"
            value={c.categoria ?? ""}
            onChange={onChangeCliente(idx)}
          />
        </Field>
      </div>
    </div>
  </div>
</div>

        {/* Sección: Datos de Contacto (simple, sin códigos de país) */}
<div className="accordion-item">
  <h2 className="accordion-header" id={`datos-contacto-${itemId}`}>
    <button
      className="accordion-button collapsed"
      type="button"
      data-bs-toggle="collapse"
      data-bs-target={`#collapse-contacto-${itemId}`}
      aria-expanded="false"
      aria-controls={`collapse-contacto-${itemId}`}
    >
      Datos de Contacto
    </button>
  </h2>

  <div
    id={`collapse-contacto-${itemId}`}
    className="accordion-collapse collapse"
    aria-labelledby={`datos-contacto-${itemId}`}
    data-bs-parent={`#sub-accordion-${itemId}`}
  >
    <div className="accordion-body">
      <div className="row g-3">
        {/* Teléfono */}
        <Field label="Teléfono" className="col-md-4">
          <input
            className="form-control form-control-sm"
            name="telefono"
            value={c.telefono ?? ""}
            onChange={onChangeCliente(idx)}
            placeholder="Número principal"
          />
        </Field>

        {/* Tel. Secundario */}
        <Field label="Tel. Secundario" className="col-md-4">
          <input
            className="form-control form-control-sm"
            name="secundario"
            value={c.secundario ?? ""}
            onChange={onChangeCliente(idx)}
            placeholder="Número alterno"
          />
        </Field>

        {/* WhatsApp */}
        <Field label="WhatsApp" className="col-md-4">
          <input
            className="form-control form-control-sm"
            name="whatsapp_num"
            value={c.whatsapp_num ?? ""}
            onChange={onChangeCliente(idx)}
            placeholder="Número de WhatsApp"
          />
        </Field>

        {/* Nota */}
        <Field label="Nota" className="col-12">
          <textarea
            rows={3}
            className="form-control form-control-sm"
            name="nota"
            value={c.nota ?? ""}
            onChange={onChangeCliente(idx)}
          />
        </Field>

        {/* Servicios de Mensajería */}
        <div className="col-12">
          <div className="small fw-semibold text-muted mb-1">Servicios de Mensajería</div>

          <div className="form-check form-check-inline">
            <input
              className="form-check-input"
              type="checkbox"
              id={`svc-wa-${itemId}`}
              checked={!!c.whatsapp}
              onChange={(e) =>
                setFamilyMembers(prev =>
                  prev.map((mm, i) =>
                    i !== idx
                      ? mm
                      : mm?.cliente
                      ? { ...mm, cliente: { ...mm.cliente, whatsapp: e.target.checked } }
                      : { ...mm, whatsapp: e.target.checked }
                  )
                )
              }
            />
            <label className="form-check-label" htmlFor={`svc-wa-${itemId}`}>WhatsApp</label>
          </div>

          <div className="form-check form-check-inline">
            <input
              className="form-check-input"
              type="checkbox"
              id={`svc-tg-${itemId}`}
              checked={!!c.telegram}
              onChange={(e) =>
                setFamilyMembers(prev =>
                  prev.map((mm, i) =>
                    i !== idx
                      ? mm
                      : mm?.cliente
                      ? { ...mm, cliente: { ...mm.cliente, telegram: e.target.checked } }
                      : { ...mm, telegram: e.target.checked }
                  )
                )
              }
            />
            <label className="form-check-label" htmlFor={`svc-tg-${itemId}`}>Telegram</label>
          </div>

          <div className="form-check form-check-inline">
            <input
              className="form-check-input"
              type="checkbox"
              id={`svc-sms-${itemId}`}
              checked={!!c.texto_sms}
              onChange={(e) =>
                setFamilyMembers(prev =>
                  prev.map((mm, i) =>
                    i !== idx
                      ? mm
                      : mm?.cliente
                      ? { ...mm, cliente: { ...mm.cliente, texto_sms: e.target.checked } }
                      : { ...mm, texto_sms: e.target.checked }
                  )
                )
              }
            />
            <label className="form-check-label" htmlFor={`svc-sms-${itemId}`}>Texto SMS</label>
          </div>
        </div>

        {/* Email */}
        <Field label="Email" className="col-md-6">
          <input
            type="email"
            className="form-control form-control-sm"
            name="email"
            value={c.email ?? ""}
            onChange={onChangeCliente(idx)}
            placeholder="correo@dominio.com"
          />
        </Field>

        {/* (Opcional) Dirección de Correspondencia */}
        <Field label="Dir. Correspondencia" className="col-md-6">
          <input
            className="form-control form-control-sm"
            name="dir_correspondencia"
            value={c.dir_correspondencia ?? ""}
            onChange={onChangeCliente(idx)}
          />
        </Field>
      </div>
    </div>
  </div>
</div>


        {/* Sección: Dirección */}
<div className="accordion-item">
  <h2 className="accordion-header" id={`direccion-${itemId}`}>
    <button
      className="accordion-button collapsed"
      type="button"
      data-bs-toggle="collapse"
      data-bs-target={`#collapse-direccion-${itemId}`}
      aria-expanded="false"
      aria-controls={`collapse-direccion-${itemId}`}
    >
      Dirección
    </button>
  </h2>

  <div
    id={`collapse-direccion-${itemId}`}
    className="accordion-collapse collapse"
    aria-labelledby={`direccion-${itemId}`}
    data-bs-parent={`#sub-accordion-${itemId}`}
  >
    <div className="accordion-body">
      <div className="row g-3">
        {/* Dirección principal */}
        <Field label="Dirección de Residencia" className="col-12">
          <input
            className="form-control form-control-sm"
            name="direccion"
            value={c.direccion ?? ""}
            onChange={onChangeCliente(idx)}
            placeholder="Dirección completa"
          />
        </Field>

        {/* Calle, APT, Ciudad */}
        <Field label="Calle" className="col-md-4">
          <input
            className="form-control form-control-sm"
            name="calle"
            value={c.calle ?? ""}
            onChange={onChangeCliente(idx)}
          />
        </Field>
        <Field label="APT" className="col-md-2">
          <input
            className="form-control form-control-sm"
            name="apto"
            value={c.apto ?? ""}
            onChange={onChangeCliente(idx)}
          />
        </Field>
        <Field label="Ciudad" className="col-md-3">
          <input
            className="form-control form-control-sm"
            name="ciudad"
            value={c.ciudad ?? ""}
            onChange={onChangeCliente(idx)}
          />
        </Field>

        {/* Estado, Código Postal, Condado */}
        <Field label="Estado" className="col-md-3">
          <input
            className="form-control form-control-sm"
            name="estado"
            value={c.estado ?? ""}
            onChange={onChangeCliente(idx)}
          />
        </Field>
        <Field label="Código Postal" className="col-md-3">
          <input
            className="form-control form-control-sm"
            name="codigo_postal"
            value={c.codigo_postal ?? ""}
            onChange={onChangeCliente(idx)}
          />
        </Field>
        <Field label="Condado" className="col-md-3">
          <input
            className="form-control form-control-sm"
            name="condado"
            value={c.condado ?? ""}
            onChange={onChangeCliente(idx)}
          />
        </Field>

        {/* Dirección de Correspondencia + Copiar Dirección */}
        <Field label="Dirección de Correspondencia" className="col-md-9">
          <input
            className="form-control form-control-sm"
            name="dir_correspondencia"
            value={c.dir_correspondencia ?? ""}
            onChange={onChangeCliente(idx)}
          />
        </Field>

        <div className="col-md-3 d-flex align-items-center">
          <div className="form-check mt-3">
            <input
              className="form-check-input"
              type="checkbox"
              id={`copy-dir-${itemId}`}
              onChange={(e) => {
                if (e.target.checked) {
                  setFamilyMembers((prev) =>
                    prev.map((mm, i) =>
                      i !== idx
                        ? mm
                        : mm?.cliente
                        ? {
                            ...mm,
                            cliente: {
                              ...mm.cliente,
                              dir_correspondencia: mm.cliente.direccion ?? "",
                            },
                          }
                        : {
                            ...mm,
                            dir_correspondencia: mm.direccion ?? "",
                          }
                    )
                  );
                }
              }}
            />
            <label className="form-check-label" htmlFor={`copy-dir-${itemId}`}>
              Copiar Dirección
            </label>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
{/* Sección: Empleo e Ingreso */}
<div className="accordion-item">
  <h2 className="accordion-header" id={`empleo-ingreso-${itemId}`}>
    <button
      className="accordion-button collapsed"
      type="button"
      data-bs-toggle="collapse"
      data-bs-target={`#collapse-empleo-ingreso-${itemId}`}
      aria-expanded="false"
      aria-controls={`collapse-empleo-ingreso-${itemId}`}
    >
      Datos de Empleo e Ingreso
    </button>
  </h2>

  <div
    id={`collapse-empleo-ingreso-${itemId}`}
    className="accordion-collapse collapse"
    aria-labelledby={`empleo-ingreso-${itemId}`}
    data-bs-parent={`#sub-accordion-${itemId}`}
  >
    <div className="accordion-body">
      <div className="row g-3">
        {/* Tipo de Ingreso / Actividad Económica */}
        <Field label="Tipo de Ingreso" className="col-md-6">
          <select
            className="form-select form-select-sm"
            name="tipo_ingreso"
            value={c.tipo_ingreso ?? ""}
            onChange={onChangeCliente(idx)}
          >
            <option value="">Seleccione</option>
            <option value="Empleado">Empleado</option>
            <option value="Independiente">Independiente</option>
            <option value="Contratista">Contratista</option>
            <option value="Jubilado">Jubilado</option>
            <option value="Desempleado">Desempleado</option>
            <option value="Otro">Otro</option>
          </select>
        </Field>

        <Field label="Actividad Económica" className="col-md-6">
          <input
            className="form-control form-control-sm"
            name="actividad_economica"
            value={c.actividad_economica ?? ""}
            onChange={onChangeCliente(idx)}
            placeholder="Ej: Comercio, Servicios, etc."
          />
        </Field>

        {/* Empleador / Teléfono del Empleador */}
        <Field label="Empleador" className="col-md-6">
          <input
            className="form-control form-control-sm"
            name="empleador"
            value={c.empleador ?? ""}
            onChange={onChangeCliente(idx)}
            placeholder="Nombre de la empresa"
          />
        </Field>

        <Field label="Teléfono del Empleador" className="col-md-6">
          <input
            className="form-control form-control-sm"
            name="telefono_empleador"
            value={c.telefono_empleador ?? ""}
            onChange={onChangeCliente(idx)}
          />
        </Field>

        {/* Periodicidad / Monto por período / Ingreso anual */}
        <Field label="Período de Ingreso" className="col-md-4">
          <select
            className="form-select form-select-sm"
            name="periodo_ingreso"
            value={c.periodo_ingreso ?? ""}
            onChange={onChangeCliente(idx)}
          >
            <option value="">Seleccione</option>
            <option value="Semanal">Semanal</option>
            <option value="Quincenal">Quincenal</option>
            <option value="Mensual">Mensual</option>
            <option value="Bimestral">Bimestral</option>
            <option value="Trimestral">Trimestral</option>
            <option value="Semestral">Semestral</option>
            <option value="Anual">Anual</option>
          </select>
        </Field>

        <Field label="Ingreso por Período ($)" className="col-md-4">
          <input
            className="form-control form-control-sm"
            name="ingreso_por_periodo"
            value={c.ingreso_por_periodo ?? ""}
            onChange={onChangeCliente(idx)}
            placeholder="0.00"
          />
        </Field>

        <Field label="Ingreso Anual ($)" className="col-md-4">
          <input
            className="form-control form-control-sm"
            name="ingreso_anual"
            value={c.ingreso_anual ?? ""}
            onChange={onChangeCliente(idx)}
            placeholder="0.00"
          />
        </Field>

        {/* Separador visual */}
        <div className="col-12">
          <div className="small fw-semibold text-muted mt-2">Ingreso Ocasional</div>
        </div>

        {/* Nota de ingreso ocasional */}
        <Field label="Nota" className="col-12">
          <textarea
            rows={3}
            className="form-control form-control-sm"
            name="nota_ingreso_ocasional"
            value={c.nota_ingreso_ocasional ?? ""}
            onChange={onChangeCliente(idx)}
          />
        </Field>

        {/* Período / Monto ocasional */}
        <Field label="Período de Ingreso Ocasional" className="col-md-6">
          <select
            className="form-select form-select-sm"
            name="periodo_ingreso_ocasional"
            value={c.periodo_ingreso_ocasional ?? ""}
            onChange={onChangeCliente(idx)}
          >
            <option value="">Seleccione</option>
            <option value="Único">Único</option>
            <option value="Mensual">Mensual</option>
            <option value="Trimestral">Trimestral</option>
            <option value="Semestral">Semestral</option>
            <option value="Anual">Anual</option>
          </select>
        </Field>

        <Field label="Ingreso por Período ocasional ($)" className="col-md-6">
          <input
            className="form-control form-control-sm"
            name="ingreso_por_periodo_ocasional"
            value={c.ingreso_por_periodo_ocasional ?? ""}
            onChange={onChangeCliente(idx)}
            placeholder="0.00"
          />
        </Field>
      </div>
    </div>
  </div>
</div>

        {/* Aquí puedes seguir agregando más secciones: Status Migratorio, Empleo e Ingreso, Medios de Pago, etc. */}

      </div>
    </div>
  </div>
</div>


                {/* Datos Cobertura */}
                <div className="accordion-item">
                  <h2 className="accordion-header" id={`cobertura-${itemId}`}>
                    <button
                      className="accordion-button collapsed py-3 px-4"
                      type="button"
                      data-bs-toggle="collapse"
                      data-bs-target={`#collapse-cobertura-${itemId}`}
                      aria-expanded="false"
                      aria-controls={`collapse-cobertura-${itemId}`}
                    >
                      <div className="d-flex align-items-center">
                        <i className="fas fa-shield-alt me-2 text-muted"></i>
                        <span className="fw-semibold">Datos Cobertura</span>
                      </div>
                    </button>
                  </h2>
                  <div
                    id={`collapse-cobertura-${itemId}`}
                    className="accordion-collapse collapse"
                    aria-labelledby={`cobertura-${itemId}`}
                    data-bs-parent={`#accordion-${itemId}`}
                  >
                    <div className="accordion-body px-4 py-4">
                      <div className="row g-3">
                        <Field label="Parentesco" className="col-md-3">
                          <input
                            className="form-control form-control-sm"
                            value={m.parentesco || m.tipo || ""}
                            name="parentesco"
                            onChange={onChange(idx)} // cobertura sigue como antes (plano)
                            placeholder="Tomador / Cónyuge / Hijo/a..."
                          />
                        </Field>

                        <Field label="Estado Cobertura" className="col-md-3">
                          <select
                            className="form-select form-select-sm"
                            name="estado_cobertura"
                            value={m.estado_cobertura || ""}
                            onChange={onChange(idx)}
                          >
                            <option value="">Seleccione</option>
                            <option value="Sí">Sí</option>
                            <option value="No">No</option>
                            <option value="Medicare">Medicare</option>
                            <option value="Medicaid">Medicaid</option>
                          </select>
                        </Field>

                        <Field label="Código Póliza" className="col-md-3">
                          <input
                            className="form-control form-control-sm"
                            name="codigo_poliza"
                            value={m.codigo_poliza || ""}
                            onChange={onChange(idx)}
                          />
                        </Field>

                        <Field label="Vigencia (AAAA-MM)" className="col-md-3">
                          <input
                            className="form-control form-control-sm"
                            name="vigencia"
                            placeholder="2025-01"
                            value={m.vigencia || ""}
                            onChange={onChange(idx)}
                          />
                        </Field>
                      </div>

                      <div className="text-end mt-4">
                        <button
                          className="btn btn-primary btn-sm px-4"
                          onClick={() => onSaveCobertura?.(members[idx])}
                        >
                          <i className="fas fa-save me-2"></i>
                          Guardar Cobertura
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TomaDeDatos;
