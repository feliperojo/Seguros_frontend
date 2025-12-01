// src/pages/tabs/FichaClienteRingcentral.jsx
import React, { useMemo, useState, useEffect } from "react";
import { FaCircle, FaPhone } from "react-icons/fa";
import { useFichaCliente } from "../../context/fichaClienteContext";
import apiRequest from "../../services/api";

// =======================================================
// Constantes
// =======================================================

// Solo trabajaremos con estas extensiones
const ALLOWED_EXTENSION_IDS = [
  "63007828023",
  "63011175023",
  "63015547023",
  "63015557023",
  "63015562023",
];

// =======================================================
// Helpers
// =======================================================

// Extrae el teléfono que se enviará a RingCentral
const getRingcentralPhoneFromCliente = (cliente) => {
  if (!cliente) return null;

  const telefonos = Array.isArray(cliente.telefonos) ? cliente.telefonos : [];

  if (telefonos.length > 0) {
    const principal = telefonos.find((t) => t?.principal) || telefonos[0];

    if (principal) {
      // Intentar campos ya normalizados
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

      // Armar desde cod_pais + número
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

  // Fallback: campos planos
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

// Intenta separar nombre y apellidos para RingCentral
const getRingcentralNamesFromCliente = (cliente) => {
  if (!cliente) return { firstName: "", lastName: "" };

  const firstNameFromFields = cliente.primer_nombre || cliente.nombre || null;

  const lastNameFromFields =
    cliente.apellidos ||
    (cliente.primer_apellido || cliente.segundo_apellido
      ? [cliente.primer_apellido, cliente.segundo_apellido]
          .filter(Boolean)
          .join(" ")
      : null);

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

// Resumen para el endpoint de CREACIÓN (/ringcentral/contacto-multiple)
const summarizeCreateResponse = (resp) => {
  if (!resp || typeof resp !== "object") {
    return "Respuesta inesperada de RingCentral al crear contactos.";
  }

  const resultados = resp.resultados || {};
  const values = Object.values(resultados);

  if (values.length === 0) {
    return "RingCentral respondió sin resultados por extensión al crear.";
  }

  let creados = 0;
  let yaExiste = 0;
  let errores = 0;

  values.forEach((value) => {
    if (!value) return;
    const status = (value.status ?? "").toString().toLowerCase();

    if (status.includes("creado")) {
      creados++;
    } else if (status.includes("ya existe")) {
      yaExiste++;
    } else if (status.includes("error") || status.includes("fallo")) {
      errores++;
    }
  });

  const partes = [];
  if (creados > 0) partes.push(`${creados} extensión(es) con contacto creado`);
  if (yaExiste > 0)
    partes.push(`${yaExiste} extensión(es) donde el contacto ya existía`);
  if (errores > 0) partes.push(`${errores} extensión(es) con error`);

  const resumen = partes.length > 0 ? partes.join(" · ") : "Estado desconocido";
  return `RingCentral (crear): ${resumen}.`;
};

// Resumen para el endpoint de ACTUALIZACIÓN GLOBAL (/ringcentral/actualizar-contacto)
const summarizeUpdateResponse = (resp) => {
  if (!resp || typeof resp !== "object") {
    return "Respuesta inesperada de RingCentral al actualizar contactos.";
  }

  const results = Array.isArray(resp.results) ? resp.results : [];
  if (results.length === 0) {
    return "RingCentral respondió sin resultados por extensión al actualizar.";
  }

  let actualizados = 0;
  let sinMapping = 0;
  let errores = 0;

  results.forEach((r) => {
    const action = (r.action ?? "").toString().toLowerCase();
    const success = Boolean(r.success);

    if (action === "updated" && success) {
      actualizados++;
    } else if (action === "no_mapping") {
      sinMapping++;
    } else if (!success) {
      errores++;
    }
  });

  const partes = [];
  if (actualizados > 0)
    partes.push(`${actualizados} extensión(es) actualizada(s) correctamente`);
  if (sinMapping > 0)
    partes.push(
      `${sinMapping} extensión(es) sin contact_id registrado (no se pudo actualizar)`
    );
  if (errores > 0) partes.push(`${errores} extensión(es) con error`);

  const resumen = partes.length > 0 ? partes.join(" · ") : "Estado desconocido";
  return `RingCentral (actualizar): ${resumen}.`;
};

// =======================================================
// Componente
// =======================================================

export default function FichaClienteRingcentral() {
  const { cliente } = useFichaCliente();

  const [savingGlobal, setSavingGlobal] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [ringLinked, setRingLinked] = useState(false);

  // Lista de extensiones
  const [extensions, setExtensions] = useState([]);
  // Info por extensión: { [id]: { loading, updating, exists, contact, error } }
  const [extensionsInfo, setExtensionsInfo] = useState({});

  // Mantener estado visual "vinculado"
  // Cargar estado global desde la tabla ringcentral_contacts
useEffect(() => {
  const fetchRingcentralState = async () => {
    if (!cliente?.id) {
      setRingLinked(false);
      return;
    }

    try {
      const resp = await apiRequest(
        `/ringcentral/estado-cliente/${cliente.id}`,
        "GET"
      );

      if (resp?.success) {
        // Si tiene al menos un mapeo, consideramos que está vinculado
        setRingLinked(Boolean(resp.hasAny));

        // Marcar en las tarjetas qué extensiones ya tienen contacto
        if (Array.isArray(resp.extensions)) {
          setExtensionsInfo((prev) => {
            const next = { ...prev };
            resp.extensions.forEach((extId) => {
              next[extId] = {
                ...(next[extId] || {}),
                exists: true,   // esto hará que se muestre el mensajito verde
              };
            });
            return next;
          });
        }
      } else {
        setRingLinked(false);
      }
    } catch (err) {
      console.error("Error al obtener estado RingCentral:", err);
      setRingLinked(false);
    }
  };

  fetchRingcentralState();
}, [cliente?.id]);

  // Teléfono para RingCentral (lo usamos también en consultas por extensión)
  const ringPhone = useMemo(
    () => getRingcentralPhoneFromCliente(cliente),
    [cliente]
  );

  // Notas para identificar origen + IDs (también se usan en consultas por extensión)
  const vantumNotes = `Origen: Vantum | cliente_id=${cliente?.id ?? ""}${
    cliente?.grupo_familiar_id
      ? " | grupo_familiar_id=" + cliente.grupo_familiar_id
      : ""
  }`;

  // Cargar extensiones disponibles desde el back (listarExtensiones)
  useEffect(() => {
    const fetchExtensions = async () => {
      try {
        const resp = await apiRequest("/ringcentral/extensiones", "GET");
        if (resp?.success && Array.isArray(resp.extensiones)) {
          // 🔴 Aquí filtramos solo las extensiones que nos interesan
          const filtered = resp.extensiones.filter((ext) =>
            ALLOWED_EXTENSION_IDS.includes(String(ext.id))
          );
          setExtensions(filtered);
        } else {
          console.warn("Respuesta inesperada al listar extensiones:", resp);
        }
      } catch (err) {
        console.error("Error al listar extensiones RingCentral:", err);
      }
    };

    fetchExtensions();
  }, []);

  // Cobertura principal (por ahora la primera)
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

  // Validaciones mínimas
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

  // Nombre / apellidos que enviaremos
  const { firstName, lastName } = getRingcentralNamesFromCliente(
    cliente || {}
  );

  // URL base de la app (para WebPage)
  const appBaseUrl = import.meta.env?.VITE_APP_URL || window.location.origin;
  const webPageUrl =
    cliente?.id != null ? `${appBaseUrl}/clientes/${cliente.id}` : "";

  // Payload común para crear/actualizar
  const buildPayload = () => {
    let safeFirstName =
      firstName || cliente?.nombre_completo || "SIN_NOMBRE";
    let safeLastName = lastName || "SIN_APELLIDO";

    safeFirstName = safeFirstName.toString().trim().slice(0, 64) || "N/A";
    safeLastName = safeLastName.toString().trim().slice(0, 64);

    return {
      firstName: safeFirstName,
      lastName: safeLastName,
      mobilePhone: ringPhone,
      email: cliente?.email || null,
      company: companiaNombre || "Vantum",
      webPage: webPageUrl || null,
      notes: vantumNotes,
      clienteId: cliente?.id ?? null,
    };
  };

  // =====================================================
  // Acciones globales (todas las extensiones)
  // =====================================================

  const handleCreate = async () => {
    if (!canSendToRingcentral) return;

    setSavingGlobal(true);
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

      const resumen = summarizeCreateResponse(resp);

      const resultados = resp?.resultados || {};
      const entries = Object.values(resultados);
      const anyOK = entries.some((v) => {
        const st = (v?.status ?? "").toString().toLowerCase();
        return st.includes("creado") || st.includes("ya existe");
      });
      const anyError = entries.some((v) => {
        const st = (v?.status ?? "").toString().toLowerCase();
        return st.includes("error") || st.includes("fallo");
      });

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
      setSavingGlobal(false);
    }
  };

  const handleUpdateAll = async () => {
    if (!canSendToRingcentral) return;

    setSavingGlobal(true);
    setStatusMessage("Enviando actualización a todas las extensiones…");

    try {
      const payload = buildPayload();
      console.log("Payload RingCentral (update all):", payload);

      const resp = await apiRequest(
        "/ringcentral/actualizar-contacto",
        "PUT",
        payload
      );

      console.log("Respuesta RingCentral (update all):", resp);

      const resumen = summarizeUpdateResponse(resp);
      const results = Array.isArray(resp?.results) ? resp.results : [];
      const anySuccess = results.some((r) => r.success);
      const anyError = results.some((r) => r.success === false);

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
      setSavingGlobal(false);
    }
  };

  // =====================================================
  // Acciones por extensión
  // =====================================================

  const updateExtensionInfo = (extensionId, partial) => {
    setExtensionsInfo((prev) => ({
      ...prev,
      [extensionId]: {
        ...(prev[extensionId] || {}),
        ...partial,
      },
    }));
  };

  const handleConsultarExtension = async (extensionId) => {
    if (!cliente?.id) return;
  
    updateExtensionInfo(extensionId, { loading: true, error: null });
  
    try {
      const resp = await apiRequest(
        "/ringcentral/consultar-contacto-extension",
        "POST",
        {
          clienteId: cliente.id,
          extensionId,
        }
      );
  
      if (resp?.exists && resp.contact) {
        updateExtensionInfo(extensionId, {
          loading: false,
          exists: true,
          contact: resp.contact,
          error: null,
        });
      } else {
        updateExtensionInfo(extensionId, {
          loading: false,
          exists: false,
          contact: null,
          error: null,
        });
      }
    } catch (err) {
      updateExtensionInfo(extensionId, {
        loading: false,
        error: "Error al consultar contacto en RingCentral.",
      });
    }
  };
  
  const handleUpdateExtension = async (extensionId) => {
    if (!canSendToRingcentral || !cliente?.id) return;
  
    const info = extensionsInfo[extensionId] || {};
    const contactId = info.contact?.id; // puede venir de la consulta previa
  
    updateExtensionInfo(extensionId, {
      updating: true,
      error: null,
    });
    setStatusMessage(
      `Enviando actualización a la extensión ${extensionId}…`
    );
  
    try {
      const payload = buildPayload();
  
      const resp = await apiRequest(
        "/ringcentral/actualizar-contacto-extension",
        "PUT",
        {
          ...payload,
          extensionId,
          clienteId: cliente.id,
          contactId, // si existe, el back lo usa directamente
        }
      );
  
      console.log(
        `Respuesta actualizar-contacto-extension (${extensionId}):`,
        resp
      );
  
      if (resp?.success) {
        setStatusMessage(
          `✅ Contacto actualizado correctamente en la extensión ${extensionId}.`
        );
        setRingLinked(true);
        await handleConsultarExtension(extensionId); // refrescar datos
      } else {
        const msg =
          resp?.message ||
          "No se pudo actualizar el contacto en esta extensión.";
        setStatusMessage(
          `❌ No se pudo actualizar el contacto en la extensión ${extensionId}.`
        );
        updateExtensionInfo(extensionId, { error: msg });
      }
    } catch (err) {
      console.error("Error al actualizar contacto por extensión:", err);
      setStatusMessage(
        `❌ Error al actualizar el contacto en la extensión ${extensionId}.`
      );
      updateExtensionInfo(extensionId, {
        error: "Error al actualizar contacto en RingCentral.",
      });
    } finally {
      updateExtensionInfo(extensionId, { updating: false });
    }
  };
  
  // =====================================================
  // Render
  // =====================================================

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

            {/* Datos del cliente */}
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

           

            {/* Alertas de validación */}
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

            {/* Botones globales */}
            <div className="d-flex gap-2 mt-2 mb-3">
              <button
                type="button"
                className="btn btn-sm btn-primary"
                disabled={!canSendToRingcentral || savingGlobal}
                onClick={handleCreate}
              >
                {savingGlobal ? "Procesando…" : "Crear en RingCentral"}
              </button>

              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                disabled={!canSendToRingcentral || savingGlobal}
                onClick={handleUpdateAll}
              >
                {savingGlobal
                  ? "Procesando…"
                  : "Actualizar en todas las extensiones"}
              </button>
            </div>

            {/* Sección por extensión */}
            <hr />
            <h6 className="mb-2">Detalle por extensión</h6>
            <div className="small mb-2 text-muted">
              Aquí puedes ver en qué extensiones existe el contacto y consultar
              los datos actuales en RingCentral por extensión.
            </div>

            {extensions.length === 0 ? (
              <div className="alert alert-light small">
                No se pudieron cargar las extensiones de RingCentral o aún no hay
                ninguna configurada.
              </div>
            ) : (
              <div className="row">
                {extensions.map((ext) => {
                  const info = extensionsInfo[ext.id] || {};
                  const { loading, updating, exists, contact, error } = info;

                  return (
                    <div className="col-md-6 mb-3" key={ext.id}>
                      <div className="border rounded p-2 h-100">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <div>
                            <strong>{ext.name || "Extensión"}</strong>
                            {ext.extensionNumber && (
                              <span className="ms-1 text-muted">
                                (Ext {ext.extensionNumber})
                              </span>
                            )}
                          </div>
                          <span className="badge bg-light text-muted">
                            ID: {ext.id}
                          </span>
                        </div>

                        {/* Estado de contacto en esta extensión */}
                        {loading ? (
                          <div className="small text-info mb-2">
                            Consultando datos en RingCentral…
                          </div>
                        ) : exists === true ? (
                          <div className="small text-success mb-2">
                            Contacto registrado en esta extensión.
                          </div>
                        ) : exists === false ? (
                          <div className="small text-warning mb-2">
                            No existe contacto registrado para este cliente en
                            esta extensión.
                          </div>
                        ) : (
                          <div className="small text-muted mb-2">
                            Aún no se ha consultado esta extensión.
                          </div>
                        )}

                        {error && (
                          <div className="alert alert-danger py-1 small mb-2">
                            {error}
                          </div>
                        )}

                        {/* Comparación RingCentral vs Vantum si hay contacto */}
                        {contact && (
                          <div className="small mb-2">
                            <div className="row">
                              <div className="col-6">
                                <strong>RingCentral</strong>
                                <ul className="mb-0">
                                  <li>
                                    Nombre:{" "}
                                    {`${contact.firstName || ""} ${
                                      contact.lastName || ""
                                    }`.trim() || "—"}
                                  </li>
                                  <li>
                                    Teléfono: {contact.mobilePhone ?? "—"}
                                  </li>
                                  <li>Email: {contact.email ?? "—"}</li>
                                  <li>Empresa: {contact.company ?? "—"}</li>
                                  <li>Notas: {contact.notes ?? "—"}</li>
                                </ul>
                              </div>
                              <div className="col-6">
                                <strong>Vantum</strong>
                                <ul className="mb-0">
                                  <li>
                                    Nombre: {cliente.nombre_completo ?? "—"}
                                  </li>
                                  <li>Teléfono: {ringPhone ?? "—"}</li>
                                  <li>Email: {cliente.email ?? "—"}</li>
                                  <li>Empresa: {companiaNombre ?? "—"}</li>
                                  <li>Notas: {vantumNotes}</li>
                                </ul>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Botones por extensión */}
                        <div className="d-flex gap-2 mt-2">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary"
                            onClick={() =>
                              handleConsultarExtension(ext.id)
                            }
                            disabled={loading}
                          >
                            {loading ? "Consultando…" : "Consultar"}
                          </button>

                          <button
                            type="button"
                            className="btn btn-sm btn-outline-success"
                            onClick={() => handleUpdateExtension(ext.id)}
                            disabled={
                              !canSendToRingcentral || updating
                            }
                          >
                            {updating
                              ? "Actualizando…"
                              : "Actualizar esta extensión"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Mensaje de estado global */}
            {statusMessage && (
              <div className="alert alert-secondary mt-3 mb-0 py-2 small">
                {statusMessage}
              </div>
            )}

            <div className="mt-3 small text-muted">
              Usa <strong>“Crear en RingCentral”</strong> para registrar este
              cliente como contacto en las extensiones configuradas. Luego podrás
              usar <strong>“Actualizar en todas las extensiones”</strong> o
              actualizar de forma individual por extensión.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
