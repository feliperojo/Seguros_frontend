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

// 👇 Importar estilos
import "../../styles/ContactosAsociadosAccordion.css";

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
  const [accordionOpen, setAccordionOpen] = useState(false); // Control del estado del acordeón

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
    primer_nombre: "",
    segundo_nombre: "",
    apellidos: "",
    nombre_completo: "", // Mantener por compatibilidad
    idioma: "",
    perteneceGF: "No",
    relacion: "",
    nota: "",
    telefonos: [],
    email_principal: "",
  });

  const update = (field, val) => {
    setForm((f) => {
      const updated = { ...f, [field]: val };
      // Si se actualizan campos de nombre, recalcular nombre_completo
      if (["primer_nombre", "segundo_nombre", "apellidos"].includes(field)) {
        const parts = [
          updated.primer_nombre,
          updated.segundo_nombre,
          updated.apellidos
        ].filter(Boolean);
        updated.nombre_completo = parts.join(" ").trim();
      }
      return updated;
    });
  };
  
  const resetForm = () =>
    setForm({
      primer_nombre: "",
      segundo_nombre: "",
      apellidos: "",
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
        : (form.primer_nombre || "").trim().length > 0 && (form.apellidos || "").trim().length > 0;
    return tieneContexto && datosCompletos;
  }, [modo, sel, form.primer_nombre, form.apellidos, form.relacion, clienteId, grupoFamiliarId]);

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

  // --- Limpiar datos cuando cambia el modo ---
  useEffect(() => {
    if (modo === "nuevo") {
      // Al cambiar a modo nuevo, limpiar selección de cliente existente
      setSel(null);
      setTerm("");
      setCandidatos([]);
      // Mantener relación, perteneceGF y nota por si el usuario quiere reutilizarlos
      setForm((f) => ({
        ...f,
        primer_nombre: f.primer_nombre || "",
        segundo_nombre: f.segundo_nombre || "",
        apellidos: f.apellidos || "",
        telefonos: f.telefonos || [],
        idioma: f.idioma || "",
      }));
    } else {
      // Al cambiar a modo existente, limpiar campos de nombre
      setForm((f) => ({
        ...f,
        primer_nombre: "",
        segundo_nombre: "",
        apellidos: "",
        nombre_completo: "",
        telefonos: [],
        idioma: "",
      }));
    }
  }, [modo]);

  // --- pinta teléfonos/idioma cuando se elige cliente existente ---
  useEffect(() => {
    if (modo !== "existente") return;
    if (!sel?.id) {
      setForm((f) => ({ ...f, telefonos: [], idioma: "" }));
      return;
    }
    const tels = normalizeTelefonos(sel);
    setForm((f) => ({
      ...f,
      telefonos: tels,
      idioma: sel.idioma || "",
    }));
  }, [sel, modo]);

  // --- Helper para normalizar teléfonos del cliente existente o nuevo ---
  const normalizeTelefonos = (c) => {
    if (!c) return [];
    
    // Si tiene array de telefonos, normalizarlos
    if (Array.isArray(c.telefonos) && c.telefonos.length > 0) {
      return c.telefonos
        .map((t, i) => ({
          id: t?.id ?? `tel-${c.id}-${i}`,
          tipo: t?.tipo || "Móvil",
          numero: (t?.numero || "").trim(),
          principal: t?.principal ?? i === 0,
          iso: (t?.iso || "co").toLowerCase(),
          indicativo: t?.indicativo || "57",
        }))
        .filter((t) => (t.numero || "").trim().length > 0);
    }
    
    // Fallback: si tiene telefono plano (string), convertirlo
    const numeroPlano = c.telefono || "";
    if ((numeroPlano || "").trim()) {
      return [
        {
          id: `tel-legacy-${c.id || "new"}`,
          tipo: "Móvil",
          numero: numeroPlano.trim(),
          principal: true,
          iso: "co",
          indicativo: "57",
        },
      ];
    }
    
    return [];
  };

  // ---- guardar (crea o actualiza vínculo) ----
  const handleSave = async () => {
    if (readOnly || !puedeGuardar) return;
    try {
      setSaving(true);

      const modoActual = modo; // Guardar el modo actual antes de cualquier cambio
      let contacto = {};
      let contactoId = null;

      if (modoActual === "existente") {
        // MODO EXISTENTE: Solo crear vínculo, NO modificar ni crear cliente
        if (!sel?.id) throw new Error("Debe seleccionar un cliente existente.");
        if (sel.id === clienteId) throw new Error("No puedes asociar el mismo cliente como contacto.");

        // Usar directamente el cliente seleccionado sin modificarlo
        contacto = {
          id: sel.id,
          nombre_completo: sel.nombre_completo || "",
          idioma: sel.idioma || "",
          telefonos: Array.isArray(sel.telefonos) ? sel.telefonos : (sel.telefono ? [{ numero: sel.telefono, principal: true }] : []),
        };
        contactoId = sel.id;
      } else {
        // MODO NUEVO: Crear nuevo cliente como contacto
        // Construir nombre_completo desde los campos separados
        const nombreCompleto = [
          form.primer_nombre?.trim(),
          form.segundo_nombre?.trim(),
          form.apellidos?.trim()
        ].filter(Boolean).join(" ");

        const contactoRes = await upsertClienteComoContacto({
          nombre_completo: nombreCompleto,
          primer_nombre: form.primer_nombre?.trim() || null,
          segundo_nombre: form.segundo_nombre?.trim() || null,
          apellidos: form.apellidos?.trim() || null,
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
      setModo("nuevo"); // Resetear a modo nuevo después de guardar
      setAccordionOpen(false); // Cerrar acordeón después de guardar
      
      // Mensaje de éxito
      if (modoActual === "existente") {
        alert("Contacto asociado correctamente. El cliente existente no ha sido modificado.");
      }
    } catch (e) {
      console.error(e);
      alert(e.message || "No se pudo guardar el contacto.");
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
              className={`accordion-button ${accordionOpen ? "" : "collapsed"}`}
              type="button"
              onClick={() => setAccordionOpen(!accordionOpen)}
              aria-expanded={accordionOpen}
              aria-controls="collapseNuevo"
            >
              {linkEditar ? "Editar contacto" : "Agregar contacto"}
            </button>
          </h2>

          {accordionOpen && (
            <div
              id="collapseNuevo"
              className="accordion-collapse collapse show contacto-accordion-open"
              aria-labelledby="headingNuevo"
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
          )}
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
