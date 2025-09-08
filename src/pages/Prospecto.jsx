import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ProductoCotizacionModal from "../components/fase2/ProductoCotizacionModal";

import ProspectoBarra from '../components/fase2/ProspectoBarra';
import Prospectogrupo from '../components/fase2/Prospectogrupo';
import ProspectoDatos from '../components/fase2/ProspectoDatos';
import TomaDeDatos from '../components/fase2/TomaDeDatos';
import GrupoFamiliarService from '../services/GrupoFamiliarService';
import ClienteService from '../services/ClienteService';
import { mapGrupoFromForm, mapClienteFromMember } from '../adapters/prospecto.mapper';

import ProspectoService from "../services/ProspectoService";


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
  personasCobertura: '',
  personasTaxes: ''
};

// API -> UI para modo edición (ajusta si tu GET retorna otra forma)
const mapGrupoApiToForm = (g) => ({
  captadoPor: g?.captado_por || '',
  cual: g?.cual || '',
  asesor: g?.responsable || '',
  persona_contacto: g.persona_contacto,
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

  // ---------- Efecto para mostrar modal cuando es necesario ----------
  useEffect(() => {
    // Si no es edición (grupoId null) y no hay producto seleccionado, mostrar modal
    if (!grupoId && !productoCotizacion) {
      setShowProductModal(true);
    }
  }, [grupoId, productoCotizacion]);

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
          estado_cobertura: miembro.estado_cobertura || "Si/No",
          parentesco: miembro.parentesco || miembro.tipo || "Tomador",
          cobertura_tipo: productoCotizacion?.label
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

        {/* Mostrar producto seleccionado */}
        {productoCotizacion && (
          <div className="mb-3 d-flex align-items-center justify-content-between">
            <span className={`badge bg-${productoCotizacion.color} fs-6`}>
              Producto seleccionado: {productoCotizacion.label}
            </span>
            {/* Botón para cambiar producto */}
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() => setShowProductModal(true)}
            >
              Cambiar producto
            </button>
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