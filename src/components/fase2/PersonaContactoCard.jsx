// src/components/contacto/ContactosAsociadosAccordion.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";

// 👇 usamos tus servicios existentes
import {
  fetchClienteContacto,
  upsertClienteComoContacto,
  linkClienteContacto,
  updateLinkClienteContacto,
  searchClientes,
  deleteLinkClienteContacto, // ⬅️ NUEVO: eliminar vínculo
} from "../../services/contactosService";

// 👇 subcomponentes existentes
import ContactForm from "../Contacto/ContactForm";
import ContactoCard from "../Contacto/ContactoCard";

export default function PersonaContactoCard({
  clienteId = null,
  grupoFamiliarId = null,
  className = "",
  relacionOptions = [
    "Cónyuge",
    "Hijo/a",
    "Padre",
    "Madre",
    "Sobrino",
    "Tio/a",
    "Hermano/a",
    "Amigo/a",
    "Otro",
  ],
  readOnly = false,
}) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]); // [{contacto, link}]
  const [linkEditar, setLinkEditar] = useState(null); // se conserva por compat, pero no se usa para editar
  const [saving, setSaving] = useState(false);

  // Modo de creación de contacto: 'nuevo' | 'existente'
  const [modo, setModo] = useState("nuevo");

  // Picker de cliente existente (con debounce)
  const [term, setTerm] = useState("");
  const [candidatos, setCandidatos] = useState([]);
  const [sel, setSel] = useState(null);
  const [loadingPicker, setLoadingPicker] = useState(false);
  const searchDebRef = useRef(null);

  // ---- form local (crear/editar) ----
  const [form, setForm] = useState({
    nombre_completo: "",
    idioma: "",
    perteneceGF: "No",
    relacion: "",
    nota: "",
    telefonos: [],
    email_principal: "",
  });

  const update = (field, val) => setForm((f) => ({ ...f, [field]: val }));
  const resetForm = () =>
    setForm({
      nombre_completo: "",
      idioma: "",
      perteneceGF: "No",
      relacion: "",
      nota: "",
      telefonos: [],
      email_principal: "",
    });

  const puedeGuardar = useMemo(() => {
    const tieneContexto = !!(clienteId || grupoFamiliarId);
    const datosCompletos =
      modo === "existente"
        ? !!sel?.id && (form.relacion || "").trim().length > 0
        : (form.nombre_completo || "").trim().length > 0;
    return tieneContexto && datosCompletos;
  }, [modo, sel, form.nombre_completo, form.relacion, clienteId, grupoFamiliarId]);

  // ---- carga inicial ----
  const cargar = async () => {
    if (!clienteId && !grupoFamiliarId) return;
    try {
      setLoading(true);
      const res = await fetchClienteContacto({ clienteId, grupoFamiliarId });
      const arr = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res)
        ? res
        : res
        ? [res]
        : [];
      const normalizados = arr.map((l) => ({
        contacto: l.contacto || {},
        link: {
          id: l.id,
          relacion: l.relacion,
          pertenece_al_grupo: !!l.pertenece_al_grupo,
          es_persona_contacto: !!l.es_persona_contacto,
          nota: l.nota || "",
        },
      }));
      setItems(normalizados);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
  }, [clienteId, grupoFamiliarId]);

  // ---- búsqueda con debounce ----
  useEffect(() => {
    if (modo !== "existente") return;
    if (searchDebRef.current) clearTimeout(searchDebRef.current);

    searchDebRef.current = setTimeout(async () => {
      const q = term.trim();
      if (q.length < 2) {
        setCandidatos([]);
        return;
      }
      setLoadingPicker(true);
      try {
        const res = await searchClientes(q);
        const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        // evita seleccionarse a sí mismo
        setCandidatos(list.filter((x) => x.id !== clienteId));
      } catch {
        setCandidatos([]);
      } finally {
        setLoadingPicker(false);
      }
    }, 300);

    return () => clearTimeout(searchDebRef.current);
  }, [term, modo, clienteId]);

  // --- pinta teléfonos/idioma cuando se elige cliente existente ---
  useEffect(() => {
    if (modo !== "existente") return;
    if (!sel?.id) {
      setForm((f) => ({ ...f, telefonos: [] }));
      return;
    }
    const tels = normalizeTelefonos(sel);
    setForm((f) => ({
      ...f,
      telefonos: tels,
      idioma: f.idioma || sel.idioma || "",
    }));
  }, [sel, modo]);

  // --- Helper para normalizar teléfonos del cliente existente o nuevo ---
  const normalizeTelefonos = (c) => {
    if (!c) return [];
    if (Array.isArray(c.telefonos)) {
      return c.telefonos
        .map((t, i) => ({
          id: t?.id ?? `${i}-${t?.tipo ?? "Móvil"}`,
          tipo: t?.tipo || "Móvil",
          numero: t?.numero || "",
          principal: t?.principal ?? i === 0,
          iso: (t?.iso || "").toLowerCase() || undefined,
          indicativo: t?.indicativo || "",
        }))
        .filter((t) => (t.numero || "").trim().length > 0);
    }
    const numeroPlano = c.telefono || "";
    return (numeroPlano || "").trim()
      ? [
          {
            id: "legacy-1",
            tipo: "Móvil",
            numero: numeroPlano,
            principal: true,
            iso: "co",
            indicativo: "57",
          },
        ]
      : [];
  };

  // ---- guardar (crea o actualiza vínculo) ----
  const handleSave = async () => {
    if (readOnly || !puedeGuardar) return;
    try {
      setSaving(true);

      let contacto = {};
      let contactoId = null;

      if (modo === "existente") {
        if (!sel?.id) throw new Error("Debe seleccionar un cliente existente.");
        if (sel.id === clienteId) throw new Error("No puedes asociar el mismo cliente como contacto.");

        const telefonosFinales = Array.isArray(form.telefonos) ? form.telefonos : [];

        const upsertRes = await upsertClienteComoContacto({
          id: sel.id, // ← update
          nombre_completo: sel.nombre_completo,
          idioma: form.idioma || sel.idioma || "",
          telefonos: telefonosFinales,
          telefono: telefonosFinales.find((x) => x.principal)?.numero || null, // compat plano
          email_principal: form.email_principal || sel.email_principal || null,
          nota: form.nota || null,
        });

        contacto = upsertRes?.contacto || {
          id: sel.id,
          nombre_completo: sel.nombre_completo,
          idioma: form.idioma || sel.idioma || "",
          telefonos: telefonosFinales,
        };
        contactoId = contacto.id;
      } else {
        const contactoRes = await upsertClienteComoContacto({
          nombre_completo: (form.nombre_completo || "").trim(),
          idioma: form.idioma || "",
          telefonos: Array.isArray(form.telefonos) ? form.telefonos : [],
          email_principal: form.email_principal || null,
          telefono:
            Array.isArray(form.telefonos) && form.telefonos.find((x) => x.principal)?.numero
              ? form.telefonos.find((x) => x.principal)?.numero
              : null,
          nota: form.nota || null,
        });
        contacto = contactoRes?.contacto || {};
        contactoId = contacto?.id;
      }

      const perteneceBool = (form.perteneceGF || "").toString().toLowerCase().startsWith("s");
      const payloadLink = {
        clienteId,
        grupoFamiliarId,
        contactoId,
        relacion: form.relacion || null,
        perteneceAlGrupo: perteneceBool,
        esPersonaContacto: false,
        prioridad: 0,
        nota: form.nota || "",
      };

      let linkRes;
      if (linkEditar?.id) {
        linkRes = await updateLinkClienteContacto(linkEditar.id, {
          relacion: payloadLink.relacion,
          pertenece_al_grupo: payloadLink.perteneceAlGrupo,
          es_persona_contacto: payloadLink.esPersonaContacto,
          nota: payloadLink.nota,
        });
      } else {
        linkRes = await linkClienteContacto(payloadLink);
      }
      const linkFinal = linkEditar?.id ? linkRes : linkRes?.link || linkRes;

      // reflejar en UI
      if (linkEditar?.id) {
        setItems((prev) =>
          prev.map((it) => (it.link.id === linkEditar.id ? { contacto, link: linkFinal } : it))
        );
      } else {
        setItems((prev) => [{ contacto, link: linkFinal }, ...prev]);
      }

      // limpiar
      setLinkEditar(null);
      resetForm();
      setSel(null);
      setTerm("");
    } catch (e) {
      console.error(e);
      alert("No se pudo guardar el contacto.");
    } finally {
      setSaving(false);
    }
  };

  // ==== SOLO ELIMINAR RELACIÓN (no borrar cliente) ====
  const handleDeleteLink = async (linkId) => {
    if (readOnly) return;
    const ok = window.confirm("¿Quitar este contacto asociado? (No elimina el cliente)");
    if (!ok) return;
    try {
      await deleteLinkClienteContacto(linkId);
      setItems((prev) => prev.filter((it) => it.link.id !== linkId));
    } catch (e) {
      console.error(e);
      alert("No se pudo eliminar la relación.");
    }
  };

  return (
    <div className={className}>
      {/* Título + contador */}
      <div className="d-flex align-items-center mb-2">
        <h6 className="mb-0">
          <i className="bi bi-people-fill me-2" /> Contactos Asociados
        </h6>
        <span className="badge bg-secondary ms-2">{items.length}</span>
      </div>

      {/* Acordeón: Crear / Editar */}
      <div className="accordion mb-3" id="accordionContactos">
        <div className="accordion-item">
          <h2 className="accordion-header" id="headingNuevo">
            <button
              className="accordion-button collapsed"
              type="button"
              data-bs-toggle="collapse"
              data-bs-target="#collapseNuevo"
              aria-expanded="false"
              aria-controls="collapseNuevo"
            >
              {linkEditar ? "Editar contacto" : "Agregar contacto"}
            </button>
          </h2>

          <div
            id="collapseNuevo"
            className="accordion-collapse collapse"
            aria-labelledby="headingNuevo"
            data-bs-parent="#accordionContactos"
          >
            <div className="accordion-body">
              <ContactForm
                modo={modo}
                setModo={setModo}
                form={form}
                update={update}
                readOnly={readOnly}
                saving={saving}
                puedeGuardar={puedeGuardar}
                onSave={handleSave}
                onReset={() => {
                  setLinkEditar(null);
                  resetForm();
                }}
                // picker existente
                term={term}
                setTerm={setTerm}
                candidatos={candidatos}
                sel={sel}
                setSel={setSel}
                loadingPicker={loadingPicker}
                // selects
                relacionOptions={relacionOptions}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Lista de tarjetas */}
      {loading && <div className="text-muted small">Cargando contactos…</div>}

      {items.map(({ contacto, link }) => (
        <ContactoCard
          key={`${link?.id || contacto?.id || Math.random()}`}
          contacto={contacto}
          link={link}
          // ⬇️ ahora mostramos el botón “Quitar” en la tarjeta
          onDelete={() => handleDeleteLink(link.id)}
          readOnly={readOnly}
        />
      ))}

      {!loading && items.length === 0 && (
        <div className="text-muted small">Sin contactos asociados aún.</div>
      )}
    </div>
  );
}
