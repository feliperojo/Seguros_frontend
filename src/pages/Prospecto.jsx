import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import ProspectoBarra from '../components/fase2/ProspectoBarra';
import Prospectogrupo from '../components/fase2/Prospectogrupo';
import ProspectoDatos from '../components/fase2/ProspectoDatos';
import TomaDeDatos from '../components/fase2/TomaDeDatos';
import GrupoFamiliarService from '../services/GrupoFamiliarService';
import ClienteService from '../services/ClienteService';
import { mapGrupoFromForm, mapClienteFromMember } from '../adapters/prospecto.mapper';

import ProspectoService from "../services/ProspectoService";

// ---------- Estado inicial limpio (crear) ----------
const EMPTY_FORM = {
  // Captación
  captadoPor: '',
  cual: '',
  asesor: '',
  // Contacto
  nombre: '',
  apellidos: '',
  perteneceFamilia: 'No',
  telefono1: '',
  telefono2: '',
  nota: '',
  relacion: '',
  whatsapp: false,
  telegram: false,
  sms: false,
  // Económicos
  zipCode: '',
  ingresoFamiliar: '',
  personasCobertura: '',
  personasTaxes: ''
};

// API -> UI para modo edición (ajusta si tu GET retorna otra forma)
const mapGrupoApiToForm = (g) => ({
  captadoPor: g?.captado_por || '',
  cual: g?.cual || '',
  asesor: g?.responsable || '',
  persona_contacto: [form.nombre, form.apellidos].filter(Boolean).join(" "),
  perteneceFamilia: g?.pertenece_grupo_familiar ? 'Sí' : 'No',
  telefono1: g?.telefono_1 || '',
  telefono2: g?.telefono_2 || '',
  nota: g?.nota || '',
  relacion: g?.relacion || '',
  whatsapp: !!g?.whatsapp,
  telegram: !!g?.telegram,
  sms: !!g?.mensaje_sms,
  zipCode: g?.zip_code || '',
  ingresoFamiliar: g?.ingreso_familiar_anual ?? '',
  personasCobertura: g?.personas_cobertura ?? '',
  personasTaxes: g?.personas_taxes ?? ''
});

const Prospecto = () => {
  const { grupoId: routeGrupoId } = useParams();
  const navigate = useNavigate();

  // si hay :grupoId en la URL estamos en edición, si no, creación
  const [grupoId, setGrupoId] = useState(routeGrupoId || null);

  const [formData, setFormData] = useState(EMPTY_FORM);
  const [familyMembers, setFamilyMembers] = useState([]);

  const [estadoActual, setEstadoActual] = useState('PROSPECTO');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!grupoId);

  // ---------- Cargar datos si es edición ----------
  useEffect(() => {
    const load = async () => {
      if (!grupoId) return; // creación → mantener limpio
      try {
        setLoading(true);
  
        const g = await GrupoFamiliarService.getFullById(grupoId);
        setFormData(mapGrupoApiToForm(g));
  
        // NUEVO: estado actual para pintar barra
        const estado = await GrupoFamiliarService.getEstadoActual(grupoId);
        setEstadoActual(estado?.codigo || 'PROSPECTO');
  
        // TODO: si quieres precargar miembros...
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [grupoId]);


  
    // 👉 util: primera letra en mayúscula
    const capitalizeFirst = (str = "") => {
      if (!str) return "";
      const trimmed = str.trimStart();
      return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    };
  
    // 👉 util: cada palabra con mayúscula (para nombre/apellido)
    const capitalizeWords = (str = "") =>
      str
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());
  
    const handleInputChange = (e) => {
      const { name, value, type, checked } = e.target;
  
      setFormData((prev) => {
        let transformed = value;
  
        // capitalizar nombre y apellidos palabra por palabra
        if (name === "nombre" || name === "apellidos") {
          transformed = capitalizeWords(value);
        } else if (type === "text" || type === "textarea") {
          // otros campos de texto: solo la primera letra en mayúscula
          transformed = capitalizeFirst(value);
        }
  
        return {
          ...prev,
          [name]: type === "checkbox" ? checked : transformed,
        };
      });
    };
  

  


  const handleSubmit = async () => {
    try {
      setSaving(true);

      if (grupoId) {
        // ====== EDICIÓN (update del grupo) ======
        const payload = mapGrupoFromForm(formData);
        await GrupoFamiliarService.fullUpdate(grupoId, payload);
        alert('Prospecto actualizado');
        return;
      }

      // ====== CREACIÓN (flujo existente) ======
      // 1) Crear grupo familiar
      const grupoPayload = mapGrupoFromForm(formData);
      const grupoRes = await ProspectoService.createProspecto(grupoPayload);
      const newGrupoId = grupoRes?.id || grupoRes?.grupo?.id || grupoRes?.data?.id;
      if (!newGrupoId) throw new Error("No se obtuvo id del grupo");

      // 2) Crear TODOS los clientes en una sola petición
      const clientesPayload = familyMembers.map(mapClienteFromMember);
      let createdClients = [];
      if (clientesPayload.length) {
        const cliRes = await ClienteService.createMany(clientesPayload);
        const lista = cliRes?.data || cliRes?.clientes || cliRes;
        createdClients = (Array.isArray(lista) ? lista : []).map((c, idx) => ({
          clienteId: c.id,
          miembro: familyMembers[idx],
        }));
      }

              // 3) Crear coberturas (una por cliente)
       
          for (const { clienteId, miembro } of createdClients) {
            await GrupoFamiliarService.createCoberturaSimple({
              grupo_familiar_id: newGrupoId,
              cliente_id: clienteId,
              estado_cobertura: miembro.estado_cobertura || "Si/No", // si tu API lo llama así
              parentesco: miembro.parentesco || miembro.tipo || "Tomador", // ← clave
            });
          }


          // NUEVO: registrar estado COTIZACION al guardar el prospecto
          await GrupoFamiliarService.setEstado(newGrupoId, 'COTIZACION', 'Alta de prospecto');

          setGrupoId(newGrupoId);
          setEstadoActual('COTIZACION');       // <- la barra se pinta en Cotización
         // alert('Prospecto creado y enviado a Cotización.');



            // 5) navegar a la página DETALLE (solo lectura por defecto)
            navigate(`/grupo_familiar/${newGrupoId}`);

    } catch (e) {
      console.error(e);
      alert(e.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container-fluid bg-light min-vh-100 py-4">
    <div className="container">
      <ProspectoBarra currentCode={estadoActual} />

      {loading ? (
        <div className="text-center text-muted my-5">
          <div className="spinner-border me-2" role="status" />
          Cargando...
        </div>
      ) : (
        <>
          {/* 1) Captación + económicos */}
          <Prospectogrupo formData={formData} onChange={handleInputChange} />

          {/* 2) Miembros: tarjetas o acordeón según estado */}
          {["PROSPECTO", "COTIZACION", "SEGUIMIENTO"].includes(
            (estadoActual || "").toUpperCase()
          ) ? (
            <ProspectoDatos
              familyMembers={familyMembers}
              setFamilyMembers={setFamilyMembers}
            />
          ) : estadoActual?.toUpperCase() === "TOMA_DATOS" ? (
            <TomaDeDatos
              familyMembers={familyMembers}
              setFamilyMembers={setFamilyMembers}
              // opcional: guarda granular
              onSaveMember={(m) => console.log("Guardar cliente:", m)}
              onSaveCobertura={(m) => console.log("Guardar cobertura:", m)}
            />
          ) : (
            // fallback si cae en otro estado (INSCRIPCION_INI / GRUPO_FAMILIAR…)
            <ProspectoDatos
              familyMembers={familyMembers}
              setFamilyMembers={setFamilyMembers}
            />
          )}

          {/* 3) Guardar/Actualizar */}
          <div className="text-end">
            <button
              type="button"
              onClick={handleSubmit}
              className="btn btn-primary"
              disabled={saving}
            >
              {saving ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" />
                  Guardando...
                </>
              ) : grupoId ? 'Actualizar' : 'Guardar'}
            </button>
          </div>
        </>
      )}
    </div>
  </div>
);
};

export default Prospecto;
