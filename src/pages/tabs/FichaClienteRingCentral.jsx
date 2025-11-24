// src/pages/tabs/FichaClienteRingcentral.jsx
import React, { useMemo, useState } from "react";
import { FaCircle, FaPhone } from "react-icons/fa";
import { useFichaCliente } from "../../context/fichaClienteContext";
import apiRequest from "../../services/api";

// ===== Helpers =====

// Extrae el teléfono que se enviará a RingCentral.
// 1) Usa cliente.telefonos (array)
//    - intenta primero el principal
//    - si no hay principal, toma el primero
// 2) Si no hay arreglo, usa campos planos como fallback.
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

      // Intentar armarlo desde código + número
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

  // Fallback: campos planos del cliente (por si acaso)
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

export default function FichaClienteRingcentral() {
  const { cliente } = useFichaCliente();
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  // Teléfono que se enviará a RingCentral
  const ringPhone = useMemo(
    () => getRingcentralPhoneFromCliente(cliente),
    [cliente]
  );

  // Cobertura principal (usamos la primera del arreglo por ahora)
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

  const isLinkedToRingcentral = Boolean(cliente?.es_prospecto); // campo usado como "vinculado"

  // ==== Validaciones antes de enviar a RingCentral ====
  const missingFields = useMemo(() => {
    const missing = [];

    if (!cliente?.id) missing.push("ID de cliente");
    if (!cliente?.nombre_completo) missing.push("Nombre completo");
    if (!ringPhone) missing.push("Teléfono móvil (desde teléfonos del cliente)");
    // El email puede ser opcional. Si quieres exigirlo:
    // if (!cliente?.email) missing.push("Email");

    return missing;
  }, [cliente, ringPhone]);

  const canSendToRingcentral = missingFields.length === 0;

  const statusColorClass = isLinkedToRingcentral ? "text-success" : "text-danger";
  const statusLabel = isLinkedToRingcentral
    ? "Vinculado en RingCentral"
    : "Aún no creado en RingCentral";

  const statusIconColor = isLinkedToRingcentral ? "#28a745" : "#dc3545";

  // ==== Acciones (por ahora simuladas) ====

  const handleCreate = async () => {
    if (!canSendToRingcentral) return;

    setSaving(true);
    setStatusMessage(null);
    try {
      // Aquí luego integrarás tu endpoint real, ejemplo:
      // const resp = await apiRequest("/ringcentral/contacto-multiple", "POST", {
      //   firstName: cliente.primer_nombre ?? cliente.nombre_completo,
      //   lastName: cliente.apellidos ?? "",
      //   mobilePhone: ringPhone,
      //   cliente_id: cliente.id,
      // });
      //
      // Luego marcas el cliente como vinculado:
      // await apiRequest(`/cliente/${cliente.id}`, "PUT", { es_prospecto: true });

      setStatusMessage(
        "Contacto enviado (simulado). Integra aquí tu endpoint real de creación."
      );
      // Opcional: refrescar datos del cliente después
      // refresh();
    } catch (err) {
      console.error(err);
      setStatusMessage("Error al crear el contacto en RingCentral.");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!canSendToRingcentral) return;

    setSaving(true);
    setStatusMessage(null);
    try {
      // Endpoint real de actualización cuando lo tengas:
      // await apiRequest("/ringcentral/contacto-multiple", "PUT", { ... });

      setStatusMessage(
        "Actualización enviada (simulada). Integra aquí tu endpoint real de actualización."
      );
    } catch (err) {
      console.error(err);
      setStatusMessage("Error al actualizar el contacto en RingCentral.");
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
    {/* Card centrada y más ancha */}
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

            {/* Estado visual */}
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

            {/* Resumen de los datos que se enviarán */}
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
              </ul>
            </div>

            {/* Alerta de validación */}
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

            {/* Botones de acción */}
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
