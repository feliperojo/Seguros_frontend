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
      <div className="flex items-center justify-center p-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-blue-800">
          <p className="text-sm font-medium">Cargando información del cliente…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center w-full px-4 py-6">
      <div className="w-full max-w-5xl">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 border-b border-blue-800">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <FaPhone className="text-blue-200" />
              Integración con RingCentral
            </h2>
          </div>

          <div className="p-6 space-y-6">

            {/* Información del Cliente */}
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
                Información del Cliente
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <span className="font-semibold text-gray-600 min-w-[120px]">Cliente:</span>
                    <span className="text-gray-900">{cliente.nombre_completo ?? "—"}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-semibold text-gray-600 min-w-[120px]">ID Cliente:</span>
                    <span className="text-gray-900 font-mono text-xs bg-white px-2 py-1 rounded border border-gray-300">
                      {cliente.id ?? "—"}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-semibold text-gray-600 min-w-[120px]">Teléfono:</span>
                    <div className="flex flex-wrap gap-2">
                      {Array.isArray(cliente.telefonos) && cliente.telefonos.length > 0 ? (
                        cliente.telefonos
                          .filter((t) => t.numero)
                          .map((t, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 bg-white px-2 py-1 rounded border border-gray-300 text-gray-900"
                            >
                              {t.principal && (
                                <span className="text-yellow-500" title="Principal">★</span>
                              )}
                              <span className="font-mono text-xs">
                                {t.cod_pais}
                                {t.numero}
                              </span>
                            </span>
                          ))
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-semibold text-gray-600 min-w-[120px]">Email:</span>
                    <span className="text-gray-900 break-all">{cliente.email ?? "—"}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <span className="font-semibold text-gray-600 min-w-[120px]">Grupo Familiar:</span>
                    <span className="text-gray-900">
                      {cliente.grupo_familiar_id ? (
                        <span className="inline-flex items-center px-2 py-1 rounded bg-purple-100 text-purple-800 text-xs font-medium">
                          GF {cliente.grupo_familiar_id}
                        </span>
                      ) : (
                        "—"
                      )}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-semibold text-gray-600 min-w-[120px]">Compañía:</span>
                    <span className="text-gray-900">{companiaNombre}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-semibold text-gray-600 min-w-[120px]">Año cobertura:</span>
                    <span className="text-gray-900">{anoCobertura}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-semibold text-gray-600 min-w-[120px]">Código póliza:</span>
                    <span className="text-gray-900 font-mono text-xs">{codigoPoliza}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Estado RingCentral */}
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  Estado de Vinculación
                </h3>
                <div className="flex items-center gap-2">
                  <FaCircle
                    size={12}
                    style={{ color: statusIconColor }}
                    className="animate-pulse"
                  />
                  <span className={`text-sm font-medium ${
                    isLinkedToRingcentral 
                      ? "text-green-600" 
                      : "text-red-600"
                  }`}>
                    {statusLabel}
                  </span>
                </div>
              </div>

              {/* Alertas de validación */}
              {canSendToRingcentral ? (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-2">
                    <div className="flex-shrink-0 mt-0.5">
                      <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="text-sm text-blue-800">
                      <p className="font-medium mb-1">Datos completos</p>
                      <p className="text-blue-700">
                        Los datos mínimos para enviar a RingCentral están completos.
                        Revisa que el teléfono móvil tenga formato internacional
                        (por ejemplo, <code className="bg-blue-100 px-1 rounded">+181355512533</code>) antes de proceder.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-2">
                    <div className="flex-shrink-0 mt-0.5">
                      <svg className="w-5 h-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="text-sm text-yellow-800">
                      <p className="font-semibold mb-2">No se puede enviar a RingCentral</p>
                      <p className="text-yellow-700 mb-2">
                        Para crear o actualizar el contacto, completa primero estos campos en la ficha del cliente:
                      </p>
                      <ul className="list-disc list-inside space-y-1 text-yellow-700">
                        {missingFields.map((f) => (
                          <li key={f}>{f}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Botones globales */}
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className="flex-1 min-w-[200px] px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
                  disabled={!canSendToRingcentral || savingGlobal}
                  onClick={handleCreate}
                >
                  {savingGlobal ? (
                    <>
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Procesando…
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Crear en RingCentral
                    </>
                  )}
                </button>

                <button
                  type="button"
                  className="flex-1 min-w-[200px] px-4 py-2.5 bg-white border-2 border-gray-300 hover:border-gray-400 text-gray-700 font-medium rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
                  disabled={!canSendToRingcentral || savingGlobal}
                  onClick={handleUpdateAll}
                >
                  {savingGlobal ? (
                    <>
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Procesando…
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Actualizar en todas las extensiones
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Sección por extensión */}
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
                  Detalle por Extensión
                </h3>
                <p className="text-sm text-gray-600">
                  Aquí puedes ver en qué extensiones existe el contacto y consultar los datos actuales en RingCentral por extensión.
                </p>
              </div>

              {extensions.length === 0 ? (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                  <svg className="mx-auto h-12 w-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  <p className="text-sm text-gray-600">
                    No se pudieron cargar las extensiones de RingCentral o aún no hay ninguna configurada.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {extensions.map((ext) => {
                    const info = extensionsInfo[ext.id] || {};
                    const { loading, updating, exists, contact, error } = info;

                    return (
                      <div
                        key={ext.id}
                        className="bg-gray-50 border-2 border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors duration-200"
                      >
                        {/* Header de extensión */}
                        <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-200">
                          <div>
                            <h4 className="font-semibold text-gray-900">
                              {ext.name || "Extensión"}
                            </h4>
                            {ext.extensionNumber && (
                              <p className="text-xs text-gray-500 mt-0.5">
                                Ext {ext.extensionNumber}
                              </p>
                            )}
                          </div>
                          <span className="px-2.5 py-1 bg-white border border-gray-300 rounded text-xs font-mono text-gray-600">
                            ID: {ext.id}
                          </span>
                        </div>

                        {/* Estado de contacto */}
                        {loading ? (
                          <div className="flex items-center gap-2 mb-3 p-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
                            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Consultando datos en RingCentral…
                          </div>
                        ) : exists === true ? (
                          <div className="flex items-center gap-2 mb-3 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            Contacto registrado en esta extensión
                          </div>
                        ) : exists === false ? (
                          <div className="flex items-center gap-2 mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-700">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            No existe contacto registrado para este cliente
                          </div>
                        ) : (
                          <div className="mb-3 p-2 bg-gray-100 border border-gray-200 rounded text-sm text-gray-600">
                            Aún no se ha consultado esta extensión
                          </div>
                        )}

                        {error && (
                          <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                            {error}
                          </div>
                        )}

                        {/* Comparación RingCentral vs Vantum */}
                        {contact && (
                          <div className="mb-3 p-3 bg-white border border-gray-200 rounded-lg">
                            <div className="grid grid-cols-2 gap-4 text-xs">
                              <div>
                                <h5 className="font-semibold text-blue-700 mb-2 pb-1 border-b border-blue-200">
                                  RingCentral
                                </h5>
                                <ul className="space-y-1.5 text-gray-700">
                                  <li>
                                    <span className="font-medium">Nombre:</span>{" "}
                                    {`${contact.firstName || ""} ${contact.lastName || ""}`.trim() || "—"}
                                  </li>
                                  <li>
                                    <span className="font-medium">Teléfono:</span>{" "}
                                    <span className="font-mono">{contact.mobilePhone ?? "—"}</span>
                                  </li>
                                  <li>
                                    <span className="font-medium">Email:</span>{" "}
                                    <span className="break-all">{contact.email ?? "—"}</span>
                                  </li>
                                  <li>
                                    <span className="font-medium">Empresa:</span> {contact.company ?? "—"}
                                  </li>
                                  <li className="text-xs">
                                    <span className="font-medium">Notas:</span>{" "}
                                    <span className="break-words">{contact.notes ?? "—"}</span>
                                  </li>
                                </ul>
                              </div>
                              <div>
                                <h5 className="font-semibold text-green-700 mb-2 pb-1 border-b border-green-200">
                                  Vantum
                                </h5>
                                <ul className="space-y-1.5 text-gray-700">
                                  <li>
                                    <span className="font-medium">Nombre:</span> {cliente.nombre_completo ?? "—"}
                                  </li>
                                  <li>
                                    <span className="font-medium">Teléfono:</span>{" "}
                                    <span className="font-mono">{ringPhone ?? "—"}</span>
                                  </li>
                                  <li>
                                    <span className="font-medium">Email:</span>{" "}
                                    <span className="break-all">{cliente.email ?? "—"}</span>
                                  </li>
                                  <li>
                                    <span className="font-medium">Empresa:</span> {companiaNombre ?? "—"}
                                  </li>
                                  <li className="text-xs">
                                    <span className="font-medium">Notas:</span>{" "}
                                    <span className="break-words">{vantumNotes}</span>
                                  </li>
                                </ul>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Botones por extensión */}
                        <div className="flex flex-col sm:flex-row gap-2 mt-4">
                          <button
                            type="button"
                            className="flex-1 px-3 py-2 bg-white border-2 border-blue-500 hover:bg-blue-50 text-blue-700 font-medium rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2"
                            onClick={() => handleConsultarExtension(ext.id)}
                            disabled={loading}
                          >
                            {loading ? (
                              <>
                                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Consultando…
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                Consultar
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            className="flex-1 px-3 py-2 bg-white border-2 border-green-500 hover:bg-green-50 text-green-700 font-medium rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2"
                            onClick={() => handleUpdateExtension(ext.id)}
                            disabled={!canSendToRingcentral || updating}
                          >
                            {updating ? (
                              <>
                                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Actualizando…
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Actualizar
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Mensaje de estado global */}
            {statusMessage && (
              <div className={`rounded-lg p-4 border ${
                statusMessage.includes("✅") 
                  ? "bg-green-50 border-green-200 text-green-800"
                  : statusMessage.includes("⚠️")
                  ? "bg-yellow-50 border-yellow-200 text-yellow-800"
                  : "bg-red-50 border-red-200 text-red-800"
              }`}>
                <div className="flex items-start gap-2">
                  <div className="flex-shrink-0 mt-0.5">
                    {statusMessage.includes("✅") ? (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    ) : statusMessage.includes("⚠️") ? (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <p className="text-sm font-medium">{statusMessage}</p>
                </div>
              </div>
            )}

            {/* Información adicional */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <span className="font-semibold">Instrucciones:</span> Usa <strong>"Crear en RingCentral"</strong> para registrar este
                cliente como contacto en las extensiones configuradas. Luego podrás
                usar <strong>"Actualizar en todas las extensiones"</strong> o
                actualizar de forma individual por extensión.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
