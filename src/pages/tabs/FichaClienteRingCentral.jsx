// src/pages/tabs/FichaClienteRingcentral.jsx
import React, { useMemo, useState, useEffect } from "react";
import { FaCircle, FaPhone } from "react-icons/fa";
import { useFichaCliente } from "../../context/fichaClienteContext";
import apiRequest from "../../services/api";

// ===== Helpers =====

const getRingcentralPhoneFromCliente = (cliente) => {
  if (!cliente) return null;

  const telefonos = Array.isArray(cliente.telefonos) ? cliente.telefonos : [];

  if (telefonos.length > 0) {
    const principal = telefonos.find((t) => t?.principal) || telefonos[0];

    if (principal) {
      const candidates = [
        principal.numero_e164,
        principal.numeroE164,
        principal.internacional,
        principal.full,
        principal.telefono,
        principal.numero,
      ].filter(Boolean);

      if (candidates.length > 0) {
        const raw = String(candidates[0]).trim();
        const cleaned = raw.replace(/[^+\d]/g, "");
        if (cleaned) {
          return cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
        }
      }

      const code =
        (principal.cod_pais ??
          principal.code ??
          principal.codigo ??
          "") + "";
      const num =
        (principal.numero ??
          principal.phone ??
          principal.telefono ??
          "") + "";

      const digits = (code + num).replace(/[^\d]/g, "");
      if (digits) return `+${digits}`;
    }
  }

  const fallbackCandidates = [
    cliente.telefono,
    cliente.whatsapp_num,
    cliente.secundario,
  ]
    .filter(Boolean)
    .map((v) => String(v).trim());

  if (fallbackCandidates.length === 0) return null;

  const raw = fallbackCandidates[0];
  const cleaned = raw.replace(/[^+\d]/g, "");
  if (!cleaned) return null;
  return cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
};

const getRingcentralNamesFromCliente = (cliente) => {
  if (!cliente) return { firstName: "", lastName: "" };

  const firstNameFromFields =
    cliente.primer_nombre ||
    cliente.nombre ||
    null;

  const lastNameFromFields =
    cliente.apellidos ||
    cliente.primer_apellido ||
    cliente.segundo_apellido
      ? [
          cliente.primer_apellido,
          cliente.segundo_apellido,
          cliente.apellidos,
        ]
          .filter(Boolean)
          .join(" ")
      : null;

  if (firstNameFromFields || lastNameFromFields) {
    return {
      firstName: firstNameFromFields || cliente.nombre_completo || "",
      lastName: lastNameFromFields || "",
    };
  }

  const fullName = (cliente.nombre_completo || "").trim();
  if (!fullName) return { firstName: "", lastName: "" };

  const parts = fullName.split(/\s+/);
  const firstName = parts[0];
  const lastName = parts.slice(1).join(" ");

  return { firstName, lastName };
};

const summarizeRingcentralResponse = (resp) => {
  if (!resp || typeof resp !== "object") {
    return "Respuesta inesperada de RingCentral. Revisa la consola del navegador.";
  }
  const resultados = resp.resultados || resp.results || {};
  const entries = Array.isArray(resultados)
    ? resultados
    : Object.entries(resultados);

  if (entries.length === 0) {
    return "RingCentral respondió sin resultados por extensión.";
  }

  let creados = 0;
  let yaExiste = 0;
  let actualizados = 0;
  let errores = 0;

  entries.forEach((entry) => {
    const value = Array.isArray(resultados) ? entry : entry[1];
    const status = (value?.status || "").toLowerCase();
    const action = (value?.action || "").toLowerCase();

    if (status.includes("creado") || action === "created") creados++;
    else if (status.includes("ya existe")) yaExiste++;
    else if (action === "updated" || status.includes("actualizado"))
      actualizados++;
    else if (status.includes("error") || status.includes("fallo")) errores++;
  });

  const partes = [];
  if (creados > 0) partes.push(`${creados} extensión(es) con contacto creado`);
  if (actualizados > 0)
    partes.push(`${actualizados} extensión(es) con contacto actualizado`);
  if (yaExiste > 0)
    partes.push(`${yaExiste} extensión(es) donde el contacto ya existía`);
  if (errores > 0) partes.push(`${errores} extensión(es) con error`);

  const resumen = partes.length > 0 ? partes.join(" · ") : "Estado desconocido";
  return `RingCentral: ${resumen}.`;
};

export default function FichaClienteRingcentral() {
  const { cliente } = useFichaCliente();
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [ringLinked, setRingLinked] = useState(false);

  useEffect(() => {
    setRingLinked(Boolean(cliente?.es_prospecto));
  }, [cliente]);

  const ringPhone = useMemo(
    () => getRingcentralPhoneFromCliente(cliente),
    [cliente]
  );

  const coberturaInfo = useMemo(() => {
    if (Array.isArray(cliente?.coberturas) && cliente.coberturas.length > 0) {
      return cliente.coberturas[0];
    }
    return null;
  }, [cliente]);

  const anoCobertura = coberturaInfo?.ano_cobertura ?? "—";
  const codigoPoliza = coberturaInfo?.codigo_poliza ?? "—";
  const companiaNombre =
    coberturaInfo?.compania?.nombre ??
    coberturaInfo?.compania_nombre ??
    cliente?.compania_nombre ??
    cliente?.compania ??
    "—";

  const isLinkedToRingcentral = ringLinked;

  const missingFields = useMemo(() => {
    const missing = [];
    if (!cliente?.id) missing.push("ID de cliente");
    if (!cliente?.nombre_completo) missing.push("Nombre completo");
    if (!ringPhone) missing.push("Teléfono móvil (desde teléfonos del cliente)");
    return missing;
  }, [cliente, ringPhone]);

  const canSendToRingcentral = missingFields.length === 0;

  const statusColorClass = isLinkedToRingcentral ? "text-success" : "text-danger";
  const statusLabel = isLinkedToRingcentral
    ? "Vinculado en RingCentral"
    : "Aún no creado en RingCentral";
  const statusIconColor = isLinkedToRingcentral ? "#28a745" : "#dc3545";

  const { firstName, lastName } = getRingcentralNamesFromCliente(cliente || {});

  const vantumNotes = `Origen: Vantum | cliente_id=${cliente?.id ?? ""}${
    cliente?.grupo_familiar_id ? " | grupo_familiar_id=" + cliente.grupo_familiar_id : ""
  }`;

  const appBaseUrl =
    import.meta.env?.VITE_APP_URL || window.location.origin;

  const webPageUrl =
    cliente?.id != null ? `${appBaseUrl}/clientes/${cliente.id}` : "";

  const buildPayload = () => ({
    firstName: firstName || cliente?.nombre_completo || "SIN_NOMBRE",
    lastName: lastName || "SIN_APELLIDO",
    mobilePhone: ringPhone,
    email: cliente?.email || null,
    company: companiaNombre || "Vantum",
    webPage: webPageUrl || null,
    notes: vantumNotes,
    clienteId: cliente?.id ?? null,
  });

  const handleCreate = async () => {
    if (!canSendToRingcentral) return;
    setSaving(true);
    setStatusMessage("Enviando contacto a RingCentral…");

    try {
      const payload = buildPayload();
      console.log("Payload RingCentral (create):", payload);

      const resp = await apiRequest(
        "/ringcentral/contacto-multiple",
        "POST",
        payload
      );

      console.log("Respuesta RingCentral (create):", resp);

      const resultados = resp?.resultados || {};
      const entries = Object.entries(resultados);
      const anyOK = entries.some(([, v]) => {
        const st = (v?.status || "").toLowerCase();
        return st.includes("creado") || st.includes("ya existe");
      });
      const anyError = entries.some(([, v]) => {
        const st = (v?.status || "").toLowerCase();
        return st.includes("error") || st.includes("fallo");
      });

      const resumen = summarizeRingcentralResponse(resp);

      if (anyOK && !anyError) {
        setStatusMessage(`✅ ${resumen}`);
        setRingLinked(true);
      } else if (anyOK && anyError) {
        setStatusMessage(`⚠️ ${resumen}`);
        setRingLinked(true);
      } else {
        setStatusMessage(`❌ ${resumen}`);
      }
    } catch (err) {
      console.error(err);
      setStatusMessage("❌ Error al crear el contacto en RingCentral.");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!canSendToRingcentral) return;
    setSaving(true);
    setStatusMessage("Enviando actualización a RingCentral…");

    try {
      const payload = buildPayload();
      console.log("Payload RingCentral (update):", payload);

      const resp = await apiRequest(
        "/ringcentral/actualizar-contacto",
        "PUT",
        payload
      );

      console.log("Respuesta RingCentral (update):", resp);

      const resumen = summarizeRingcentralResponse(resp);
      const results = resp?.results || [];
      const anySuccess = results.some((r) => r.success);
      const anyError = results.some((r) => !r.success);

      if (anySuccess && !anyError) {
        setStatusMessage(`✅ ${resumen}`);
        setRingLinked(true);
      } else if (anySuccess && anyError) {
        setStatusMessage(`⚠️ ${resumen}`);
        setRingLinked(true);
      } else {
        setStatusMessage(`❌ ${resumen}`);
      }
    } catch (err) {
      console.error(err);
      setStatusMessage("❌ Error al actualizar el contacto en RingCentral.");
    } finally {
      setSaving(false);
    }
  };

  if (!cliente) {
    return (
      <div className="alert alert-info">
        Cargando información del cliente…
      </div>
    );
  }

  return (
    <div className="row justify-content-center">
      <div className="col-12 col-lg-9 col-xl-8">
        <div className="card h-100 shadow-sm">
          <div className="card-body">
            <h6 className="mb-3">Integración con RingCentral</h6>

            <div className="row small mb-2">
              <div className="col-md-6">
                <div>
                  <strong>Cliente:</strong> {cliente.nombre_completo ?? "—"}
                </div>
                <div>
                  <strong>ID Cliente:</strong> {cliente.id ?? "—"}
                </div>
                <div>
                  <strong>Teléfono:</strong>{" "}
                  {Array.isArray(cliente.telefonos) &&
                  cliente.telefonos.length > 0 ? (
                    <span>
                      {cliente.telefonos
                        .filter((t) => t.numero)
                        .map((t, idx) => (
                          <span
                            key={idx}
                            style={{ display: "inline-block", marginRight: 8 }}
                          >
                            {t.principal ? (
                              <>
                                <i
                                  className="fas fa-star text-warning"
                                  title="Principal"
                                ></i>{" "}
                                {t.cod_pais}
                                {t.numero}
                              </>
                            ) : (
                              <>
                                {t.cod_pais}
                                {t.numero}
                              </>
                            )}
                          </span>
                        ))}
                    </span>
                  ) : (
                    "—"
                  )}
                </div>
                <div>
                  <strong>Email:</strong> {cliente.email ?? "—"}
                </div>
              </div>

              <div className="col-md-6">
                <div>
                  <strong>Grupo Familiar:</strong>{" "}
                  {cliente.grupo_familiar_id
                    ? `GF ${cliente.grupo_familiar_id}`
                    : "—"}
                </div>
                <div>
                  <strong>Compañía:</strong> {companiaNombre}
                </div>
                <div>
                  <strong>Año cobertura:</strong> {anoCobertura}
                </div>
                <div>
                  <strong>Código póliza:</strong> {codigoPoliza}
                </div>
              </div>
            </div>

            <hr />

            <div className="d-flex align-items-center mb-2">
              <span className="me-2">
                <strong>Estado RingCentral:</strong>
              </span>
              <FaCircle
                size={10}
                className="me-2"
                style={{ color: statusIconColor }}
              />
              <span className={statusColorClass}>{statusLabel}</span>
            </div>

            <div className="mb-2 small">
              <strong>Datos que se enviarán a RingCentral:</strong>
              <ul className="mb-0">
                <li>Nombre: {cliente.nombre_completo ?? "—"}</li>
                <li>
                  Teléfono móvil para RingCentral:{" "}
                  {ringPhone ? (
                    <>
                      <FaPhone className="me-1" /> {ringPhone}
                    </>
                  ) : (
                    <span className="text-danger">No definido</span>
                  )}
                </li>
                <li>Email (opcional): {cliente.email ?? "—"}</li>
                <li>Notas: {vantumNotes}</li>
                {webPageUrl && <li>Link Vantum: {webPageUrl}</li>}
              </ul>
            </div>

            <div className="mt-3">
              {canSendToRingcentral ? (
                <div className="alert alert-info py-2 mb-3 small">
                  Los datos mínimos para enviar a RingCentral están completos.
                  Revisa que el teléfono móvil tenga formato internacional
                  (por ejemplo, <code>+181355512533</code>) antes de proceder.
                </div>
              ) : (
                <div className="alert alert-warning py-2 mb-3 small">
                  <strong>No se puede enviar a RingCentral.</strong> Para crear
                  o actualizar el contacto, completa primero estos campos en la
                  ficha del cliente:
                  <ul className="mb-0">
                    {missingFields.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="d-flex gap-2 mt-2">
              <button
                type="button"
                className="btn btn-sm btn-primary"
                disabled={!canSendToRingcentral || saving}
                onClick={handleCreate}
              >
                {saving ? "Procesando…" : "Crear en RingCentral"}
              </button>

            <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                disabled={!canSendToRingcentral || saving}
                onClick={handleUpdate}
              >
                {saving ? "Procesando…" : "Actualizar en RingCentral"}
              </button>
            </div>

            {statusMessage && (
              <div className="alert alert-secondary mt-3 mb-0 py-2 small">
                {statusMessage}
              </div>
            )}

            <div className="mt-3 small text-muted">
              Usa <strong>“Crear en RingCentral”</strong> para registrar este
              cliente como contacto. Después podrás usar{" "}
              <strong>“Actualizar en RingCentral”</strong> si cambian sus datos.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
