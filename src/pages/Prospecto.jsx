import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ProductoCotizacionModal from "../components/fase2/ProductoCotizacionModal";

import ProspectoBarra from '../components/fase2/ProspectoBarra';
import Prospectogrupo from '../components/fase2/Prospectogrupo';
import ProspectoDatos from '../components/fase2/ProspectoDatos';
import TomaDeDatos from '../components/fase2/TomaDeDatos';
import GrupoFamiliarService from '../services/GrupoFamiliarService';
import ClienteService from '../services/ClienteService';
import { mapGrupoFromForm, mapClienteFromMember, stripNulls } from '../adapters/prospecto.mapper';
import { calcIngresoFamiliar, sanitizeMoneyInput, parseMoney } from '../services/ingresos';
import ProspectoService from "../services/ProspectoService";
import apiRequest from '../services/api';
import { toApiPhones } from '../utils/phone-mappers';


const normalizeCode = (s) =>
  (s ?? "")
    .toString()
    .normalize("NFD")                // separa los diacríticos
    .replace(/[\u0300-\u036f]/g, "") // quita tildes
    .toUpperCase()
    .trim();

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
 personasCobertura: 0,
 personasTaxes: 0
};

// API -> UI para modo edición (ajusta si tu GET retorna otra forma)
const mapGrupoApiToForm = (g) => ({
  captadoPor: g?.captado_por || '',
  cual: g?.cual || '',
  asesor: g?.responsable || '',
  nombre: g?.persona_contacto || '',
  apellidos: g?.apellido_persona_contacto || '',
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

 // helper local
 const moneyToDecimal = (v) => {
     const num = parseMoney(String(v ?? ""));
     if (!Number.isFinite(num)) return 0;
     return Math.min(Number(num), 99999999.99);
   };
 // --- arriba del componente, junto a otros helpers ---
const getLoggedUserName = () => {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return "";
    const u = JSON.parse(raw);
    // contempla distintas convenciones de nombre por si cambian
    return u?.name || u?.nombre || u?.full_name || "";
  } catch {
    return "";
  }
};


const Prospecto = () => {
  const { grupoId: routeGrupoId } = useParams();
  const navigate = useNavigate();

  // Estados
  const [grupoId, setGrupoId] = useState(routeGrupoId || null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [familyMembers, setFamilyMembers] = useState([]);

  const [estadoActual, setEstadoActual] = useState('PROSPECTO');
  const [productoCotizacion, setProductoCotizacion] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!grupoId);
  const [showProductModal, setShowProductModal] = useState(false); // 👈 Nuevo estado para controlar el modal

  // Cálculos derivados (después de las declaraciones)
  const isCotizacion = normalizeCode(estadoActual) === "COTIZACION";
    const handleDerivedCounts = ({ taxes, cobertura }) => {
        setFormData(prev => ({
          ...prev,
          personasTaxes: taxes,
          personasCobertura: cobertura,
        }));
      };
  // ---------- Efecto para mostrar modal cuando es necesario ----------
  useEffect(() => {
    // Si no es edición (grupoId null) y no hay producto seleccionado, mostrar modal
    if (!grupoId && !productoCotizacion) {
      setShowProductModal(true);
    }
  }, [grupoId, productoCotizacion]);


  useEffect(() => {
    const total = calcIngresoFamiliar(familyMembers);
    setFormData((prev) =>
      prev.ingresoFamiliar === total ? prev : { ...prev, ingresoFamiliar: total }
    );
  }, [familyMembers]);
// --- dentro de Prospecto, junto a otros useEffect ---
useEffect(() => {
  // sólo autollenar en creación
  if (grupoId) return;

  const name = getLoggedUserName();
  if (name) {
    setFormData(prev => prev.asesor ? prev : { ...prev, asesor: name });
  }
}, [grupoId]);

  
  // ---------- Cargar datos si es edición ----------
  useEffect(() => {
    const load = async () => {
      if (!grupoId) return;
      try {
        setLoading(true);
  
        const g = await GrupoFamiliarService.getFullById(grupoId);
        setFormData(mapGrupoApiToForm(g));
  
        // Puede venir "Cotización", "cotizacion", etc.
        const est = await GrupoFamiliarService.getEstadoActual(grupoId);
        const rawCode =
          typeof est === "string" ? est : (est?.codigo || est?.code || "");
        setEstadoActual(normalizeCode(rawCode) || "PROSPECTO");

        // En modo edición, podríamos cargar el producto existente si está guardado
        // setProductoCotizacion(existingProduct);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [grupoId]);

  // ---------- Manejador de selección de producto ----------
  const handleProductSelect = (producto) => {
    setProductoCotizacion(producto);
    setShowProductModal(false); // 👈 Cerrar modal después de selección
  };

  // ---------- Manejador para cerrar modal (opcional: regresar o mostrar advertencia) ----------
  const handleCloseModal = () => {
    if (!productoCotizacion) {
      // Si no hay producto seleccionado, podrías mostrar una advertencia
      // o redirigir a otra página
      const confirmClose = window.confirm(
        'Debe seleccionar un producto para continuar con la cotización. ¿Desea salir sin guardar?'
      );
      if (confirmClose) {
        navigate(-1); // Regresar a la página anterior
      }
      return;
    }
    setShowProductModal(false);
  };
  
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

  // Handler para agregar cliente existente (cuando no hay grupoId aún)
  const handleClienteExistenteLocal = async (payload, clienteSeleccionado) => {
    if (!clienteSeleccionado?.id) return;
    
    // Verificar que no esté ya en el grupo
    const yaExiste = familyMembers.some(
      (m) => m.cliente_id === clienteSeleccionado.id || m?.cliente?.id === clienteSeleccionado.id
    );
    if (yaExiste) {
      alert("Este cliente ya está agregado al grupo familiar");
      return;
    }

    // Mapear cliente a miembro local (sin crear cobertura aún, porque no hay grupoId)
    const mapClienteToMember = (c, tipoSel, coberturaTipo, estadoCobertura) => {
      const toTitle = (s = "") =>
        s
          .toLowerCase()
          .replace(/(^|\s|['-])(\p{L})/gu, (_, pre, c) => pre + c.toUpperCase());
      
      const calcAge = (iso) => {
        if (!iso) return "";
        const b = new Date(iso);
        if (isNaN(b)) return "";
        const t = new Date();
        let a = t.getFullYear() - b.getFullYear();
        const m = t.getMonth() - b.getMonth();
        if (m < 0 || (m === 0 && t.getDate() < b.getDate())) a--;
        return a;
      };

      const primer = toTitle(c.primer_nombre || c.nombre || "");
      const segundo = toTitle(c.segundo_nombre || "");
      const apell = toTitle(c.apellidos || c.apellido || "");
      const fecha = c.fecha_nacimiento || c.fechaNacimiento || "";
      const nombreCompleto =
        c.nombre_completo || `${primer} ${segundo} ${apell}`.replace(/\s+/g, " ").trim();
      const edad = calcAge(fecha);
      const genero = c.genero || "Masculino";

      return {
        id: c.id || `temp-${Date.now()}-${Math.random()}`,
        primer_nombre: primer,
        segundo_nombre: segundo,
        apellidos: apell,
        nombreCompleto,
        genero,
        edad,
        fecha_nacimiento: fecha,
        fecha_retiro: null,
        parentesco: tipoSel,
        tipo: tipoSel,
        estado_cobertura: estadoCobertura,
        cobertura_tipo: coberturaTipo,
        origen: "existente",
        cobertura_id: null,
        cliente_id: c.id,
        idioma: c.idioma || "",
        ingreso_anual: c.ingreso_anual || 0,
        nota: c.nota || "",
        cliente: {
          id: c.id,
          primer_nombre: primer,
          segundo_nombre: segundo,
          apellidos: apell,
          nombre_completo: nombreCompleto,
          genero,
          fecha_nacimiento: fecha,
          edad,
          telefono: c.telefono || "",
          idioma: c.idioma || "",
          ingreso_anual: c.ingreso_anual || 0,
          nota: c.nota || "",
        },
      };
    };

    const nuevoMiembro = mapClienteToMember(
      clienteSeleccionado,
      payload.tipo,
      payload.cobertura_tipo || productoCotizacion?.label || "Plan de salud",
      payload.estado_cobertura || "Sí"
    );

    setFamilyMembers((prev) => [...prev, nuevoMiembro]);
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

      // 2) Separar miembros: nuevos vs existentes
      const miembrosNuevos = familyMembers.filter(m => !m.cliente_id && m.origen !== "existente");
      const miembrosExistentes = familyMembers.filter(m => m.cliente_id && m.origen === "existente");

      // 2a) Crear solo los clientes NUEVOS en una sola petición
      const clientesPayload = miembrosNuevos.map((m) => {
        const base = mapClienteFromMember(m);
      
        // Fuerza ingreso_anual numérico para el backend
        const raw = m.ingreso_anual ?? base.ingreso_anual;
          const limpio = typeof raw === "number"
            ? raw
            : parseMoney(String(raw ?? ""));
        
          return {
            ...base,
            ingreso_anual: moneyToDecimal(limpio),   // ahora numérico y consistente
          };
      });
      
      // (opcional) debug antes del POST
      console.log("clientesPayload", clientesPayload.map(c => ({
        ingreso_anual: c.ingreso_anual, tipo: typeof c.ingreso_anual
      })));
      let createdClients = [];
      if (clientesPayload.length) {
        const cliRes = await ClienteService.createMany(clientesPayload);
        const lista = cliRes?.data || cliRes?.clientes || cliRes;
        createdClients = (Array.isArray(lista) ? lista : []).map((c, idx) => ({
          clienteId: c.id,
          miembro: miembrosNuevos[idx],
        }));
      }

      // 2b) Actualizar clientes existentes con los datos modificados
      // IMPORTANTE: Solo enviar campos del acordeón para evitar borrar datos existentes
      for (const miembro of miembrosExistentes) {
        if (!miembro.cliente_id) continue;

        // Mapear los datos del miembro a formato de cliente para actualizar
        const c = miembro?.cliente || {};
        const pick = (k) => (miembro[k] ?? c[k] ?? null);
        const date10 = (v) => (v ? String(v).slice(0, 10) : null);
        
        // Construir nombre completo
        const buildNombreCompleto = (o = {}) =>
          [o.primer_nombre, o.segundo_nombre, o.apellidos]
            .map(v => (v || "").toString().trim())
            .filter(Boolean)
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();

        const nombre_completo = buildNombreCompleto({
          primer_nombre: pick("primer_nombre"),
          segundo_nombre: pick("segundo_nombre"),
          apellidos: pick("apellidos"),
        });

        // Normalizar ingreso
        const moneyToDecimal = (v) => {
          const num = parseMoney(String(v ?? ""));
          if (!Number.isFinite(num)) return 0;
          return Math.min(Number(num.toFixed(2)), 99999999.99);
        };

        // ✅ SOLO campos del acordeón (según ProspectoDatos.jsx - MemberAccordionForm):
        // - primer_nombre, segundo_nombre, apellidos, nombre_completo
        // - fecha_nacimiento, genero, idioma
        // - ingreso_anual, nota
        const clientePayload = {
          id: Number(miembro.cliente_id),
          primer_nombre: pick("primer_nombre"),
          segundo_nombre: pick("segundo_nombre"),
          apellidos: pick("apellidos"),
          nombre_completo,
          fecha_nacimiento: date10(pick("fecha_nacimiento")),
          genero: pick("genero"),
          idioma: pick("idioma"),
          ingreso_anual: moneyToDecimal(pick("ingreso_anual")),
          nota: pick("nota"),
        };

        // Solo incluir campos que tienen valor (no null/undefined)
        const payloadFinal = Object.fromEntries(
          Object.entries(clientePayload).filter(([_, v]) => v !== null && v !== undefined)
        );

        // Actualizar el cliente en el servidor
        try {
          await apiRequest(`cliente/${miembro.cliente_id}`, "PUT", payloadFinal);
          console.log(`✅ Cliente ${miembro.cliente_id} actualizado correctamente`);
        } catch (error) {
          console.error(`❌ Error al actualizar cliente ${miembro.cliente_id}:`, error);
          // Continuar con el siguiente cliente aunque falle uno
        }
      }

      // 2c) Preparar clientes existentes para crear coberturas
      const clientesExistentes = miembrosExistentes.map(m => ({
        clienteId: m.cliente_id,
        miembro: m,
      }));

      // 3) Crear coberturas para TODOS (nuevos + existentes)
      const todosLosClientes = [...createdClients, ...clientesExistentes];
      for (const { clienteId, miembro } of todosLosClientes) {
        await GrupoFamiliarService.createCoberturaSimple({
          grupo_familiar_id: newGrupoId,
          cliente_id: clienteId,
          estado_cobertura: miembro.estado_cobertura || "Sí",
          fecha_retiro: null,
          parentesco: miembro.parentesco || miembro.tipo || "Tomador",
          cobertura_tipo: miembro.cobertura_tipo || productoCotizacion?.label
        });
      }

      // NUEVO: registrar estado COTIZACION al guardar el prospecto
      await GrupoFamiliarService.setEstado(newGrupoId, 'COTIZACION', 'Alta de prospecto');

      setGrupoId(newGrupoId);
      setEstadoActual('COTIZACION');

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
        
        {/* Modal de selección de producto - SE MUESTRA PRIMERO */}
        <ProductoCotizacionModal
          open={showProductModal}
          onSelect={handleProductSelect}
          onClose={handleCloseModal}
        />

  {/* Sección dedicada para el plan después de la barra de progreso */}
{productoCotizacion && (
  <div className="card mb-4 border-0 shadow-sm">
    <div className="card-body py-3">
      <div className="d-flex align-items-center justify-content-between">
        <div className="d-flex align-items-center">
          <i className="fas fa-shield-alt text-primary me-2"></i>
          <span className="fw-bold text-muted me-2">Plan seleccionado:</span>
          <span className={`badge bg-${productoCotizacion?.color || 'secondary'} fs-6`}>
            {productoCotizacion?.label || 'Sin plan'}
          </span>
        </div>
        <button
          type="button"
          className="btn btn-sm btn-outline-primary"
          onClick={() => setShowProductModal(true)}
        >
          <i className="fas fa-edit me-1"></i>
          Cambiar plan
        </button>
      </div>
    </div>
  </div>
)}

        {loading ? (
          <div className="text-center text-muted my-5">
            <div className="spinner-border me-2" role="status" />
            Cargando...
          </div>
        ) : (
          <>
            {/* Solo mostrar el formulario SI hay producto seleccionado o es edición */}
            {(productoCotizacion || grupoId) ? (
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
                  canAdd={true}
                  readOnly={false}
                  isProspecto={true}
                  estadoActual={estadoActual}
                  grupoFamiliarId={grupoId}
                  defaultCoberturaTipo={productoCotizacion?.label || "Plan de salud"}
                  onCreateCoberturaDeClienteExistente={grupoId ? undefined : handleClienteExistenteLocal}
                  onDerivedCounts={handleDerivedCounts}
                  onBlockedAddClick={() => alert("No puedes agregar miembros en este estado")}
                />
                
                ) : estadoActual?.toUpperCase() === "TOMA_DATOS" ? (
                  <TomaDeDatos
                    familyMembers={familyMembers}
                    setFamilyMembers={setFamilyMembers}
                    onSaveMember={(m) => console.log("Guardar cliente:", m)}
                    onSaveCobertura={(m) => console.log("Guardar cobertura:", m)}
                  />
                ) : (
                  <ProspectoDatos
                  familyMembers={familyMembers}
                  setFamilyMembers={setFamilyMembers}
                  canAdd={true}
                  readOnly={false}
                  isProspecto={true}
                  estadoActual={estadoActual}
                  grupoFamiliarId={grupoId}
                  defaultCoberturaTipo={productoCotizacion?.label || "Plan de salud"}
                  onCreateCoberturaDeClienteExistente={grupoId ? undefined : handleClienteExistenteLocal}
                  onDerivedCounts={handleDerivedCounts}
                  onBlockedAddClick={() => alert("No puedes agregar miembros en este estado")}
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
            ) : (
              // Mensaje mientras no se selecciona producto
              <div className="text-center my-5">
                <div className="alert alert-info">
                  <h5>Selecciona un producto para continuar</h5>
                  <p className="mb-0">Debes elegir el tipo de cotización antes de proceder con el registro del prospecto.</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Prospecto;