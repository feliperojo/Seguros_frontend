import React, { useState, useEffect } from "react";
import { 
  Modal, Button, Form, Row, Col, Spinner, Alert, 
  Nav, Tab, InputGroup, Badge
} from "react-bootstrap";
import apiRequest from "../services/api";
import FormDireccion from "../components/FormDireccion";
import CountrySelectWithFlags from "../components/CountrySelect";
import { NumericFormat } from 'react-number-format';
import { calcularIngresoAnual } from "../services/calcularIngresoAnual";
import MediosPagoTablas from './MediosPagoTablas';
import BitacoraModal from "../components/Tareas/BitacoraModal";
import PrimerContacto from "../components/PrimerContacto";


// Dentro del render del tab de mediosPago en EditClienteModal.js
const renderMediosPagoTab = () => (
  <div className="p-3">
    <div className="d-flex justify-content-between align-items-center mb-3">
      <h5 className="border-bottom pb-2 mb-0">Medios de Pago...</h5>
      <Button
        variant="primary"
        onClick={() => window.open(`/clientes/mediopago/${clienteId}`, '_blank')}
      >
        <i className="bi bi-credit-card me-2"></i>
        Administrar Medios de Pago..
      </Button>
    </div>

    {loadingMediosPago ? (
      <div className="text-center py-4">
        <Spinner animation="border" variant="primary" size="sm" />
        <p className="mt-2 mb-0 text-muted">Cargando medios de pago...</p>
      </div>
    ) : errorMediosPago ? (
      <Alert variant="danger" className="mt-3">
        <i className="bi bi-exclamation-triangle me-2"></i>
        {errorMediosPago}
      </Alert>
    ) : mediosPago.length === 0 ? (
      <div className="text-center border rounded py-4 mt-3 bg-light">
        <i className="bi bi-credit-card-2-front display-5 text-muted mb-3"></i>
        <h6 className="mb-3">No hay medios de pago registrados</h6>
        <p className="text-muted mb-3">
          Utilice el administrador de medios de pago para añadir nuevos métodos de pago.
        </p>
      </div>
    ) : (
      <MediosPagoTablas
        mediosPago={mediosPago}
        onView={(medio) => alert(`Ver medio de pago: ${medio.titular} (${medio.forma_pago})`)}
        onEdit={() => alert('Para editar, use el administrador de medios de pago.')}
        onDelete={() => alert('Para eliminar, use el administrador de medios de pago.')}
      />
    )}

    <div className="alert alert-info mt-4">
      <div className="d-flex">
        <i className="bi bi-info-circle me-2 fs-5"></i>
        <div>
          <h6 className="mb-1">Nota importante:</h6>
          <p className="mb-0">
            Para administrar completamente los medios de pago (añadir nuevos, editar existentes,
            etc.), utilice el botón "Administrar Medios de Pago" que abrirá
            la herramienta específica en una nueva ventana.
          </p>
        </div>
      </div>
    </div>
  </div>
);


// Dentro de EditClienteModal.jsx (fuera del componente, al inicio del archivo)
const parsePrimerContactoInfo = (texto) => {
  if (!texto) return {
    referido: "",
    cobertura: "",
    taxes: "",
    zipcode: "",
    edad: "",
    ingresos: "",
    telefono: ""
  };

  return {
    referido: (texto.match(/REF\s+([^\n]+)/i)?.[1] || "").trim(),
    cobertura: (texto.match(/COB\.\s*([^\n]+)/i)?.[1] || "").trim(),
    taxes: (texto.match(/TAXES\s+([^\n]+)/i)?.[1] || "").trim(),
    zipcode: (texto.match(/ZIPCODE\s+([^\n]+)/i)?.[1] || "").trim(),
    edad: (texto.match(/EDAD\s+(\d+)/i)?.[1] || "").trim(),
    ingresos: (texto.match(/INGRESOS\s+([^\n]+)/i)?.[1] || "").trim(),
    telefono: (texto.match(/TLF\s+([^\n]+)/i)?.[1] || "").trim()
  };
};

const buildPrimerContactoInfo = (fields) => {
  return `REF ${fields.referido || ""}
COB.${fields.cobertura || ""}
TAXES ${fields.taxes || ""}
ZIPCODE ${fields.zipcode || ""}
EDAD ${fields.edad ? `${fields.edad} AÑOS` : ""}
INGRESOS ${fields.ingresos || ""}
TLF ${fields.telefono || ""}`.trim();
};



const EditClienteModal = ({ show, onHide, clienteId, clienteData, onClienteUpdated }) => {
  // Estado para los datos del cliente organizados por secciones


  const [formData, setFormData] = useState({
    // Sección 1: Datos Principales
    datosPrincipales: {
      primer_nombre: "",
      segundo_nombre: "",
      apellidos: "",
      nombre_completo: "",
      fecha_nacimiento: "",
      edad: "",
      genero: "",
      estado_cliente: "cliente", // o "prospecto" o "descartado"
      es_prospecto: false,
      primer_contacto_info: ""
    },
    // Sección 2: Status Migratorio
    statusMigratorio: {
      social: "",
      status: "",
      auscis: "",
      tarjeta_numero: "",
      fecha_emision: "",
      fecha_expedicion: "",
      categoria: ""
    },
    // Sección 3: Datos de Contacto
    datosContacto: {
      telefono: "",
      secundario: "",
      whatsapp_num: "",
      nota: "",
      cod_tel_1: "",
      cod_tel_2: "",
      cod_tel_3: "",
      activo: true,
      servicios_mensajeria: {
        whatsapp: false,
        telegram: false,
        texto_sms: false
      },
      email: ""
     
    },
   
    // Sección 4: Dirección
    direccion: {
      calle: "",
      apto: "",
      ciudad: "",
      estado: "",
      codigo_postal: "",
      condado: "",
      dir_correspondencia: "",
      copi_dir: false
    },
    
    // Sección 5: Datos de Empleo e Ingreso
    datosEmpleo: {
      tipo_ingreso: "",
      actividad_economica: "",
      empleador: "",
      telefono_empleador: "",
      periodo_ingreso: "",
      ingreso_por_periodo: "",
      ingreso_anual: "",
      ingreso_ocasional: {
        nota_ingreso_ocasional: "",
        periodo: "",
        monto: ""
      }
    }
  });

  const buildPrimerContactoInfo = (data) => {
    return `REF ${data.referido || ""}
  COB.${data.cobertura || ""}
  TAXES ${data.taxes || ""}
  ZIPCODE ${data.zipcode || ""}
  EDAD ${data.edad ? `${data.edad} AÑOS` : ""}
  INGRESOS ${data.ingresos || ""}
  TLF ${data.telefono || ""}`.trim();
  };
  
  
  // Estado activo para las pestañas
  const [activeTab, setActiveTab] = useState("datosPrincipales");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [hasChanges, setHasChanges] = useState(false);
  const [mediosPago, setMediosPago] = useState([]);
  const [loadingMediosPago, setLoadingMediosPago] = useState(false);
  const [errorMediosPago, setErrorMediosPago] = useState(null);
  const [isIngresoModificado, setIsIngresoModificado] = useState(false);
  const [showBitacoraModal, setShowBitacoraModal] = useState(false);
  const [dataToLog, setDataToLog] = useState(null);
  
  const formatPhoneNumber = (value) => {
    if (!value) return "";
    const cleaned = value.replace(/\D/g, "");
    const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
    return match ? `${match[1]}-${match[2]}-${match[3]}` : value;
  };
  
  const handleBitacoraSuccess = () => {
    setShowBitacoraModal(false);
    onHide(); // <-- Cierra el modal principal
  };


  const recalcularIngresoAnualTotal = (datosEmpleo) => {
    const montoPrincipal = datosEmpleo.ingreso_por_periodo;
    const periodoPrincipal = datosEmpleo.periodo_ingreso;
  
    const montoOcasional = datosEmpleo.ingreso_ocasional.monto;
    const periodoOcasional = datosEmpleo.ingreso_ocasional.periodo;
  
    const ingresoPrincipal = parseFloat(calcularIngresoAnual(montoPrincipal, periodoPrincipal));
    const ingresoOcasional = parseFloat(calcularIngresoAnual(montoOcasional, periodoOcasional));
  
    return (ingresoPrincipal + ingresoOcasional).toFixed(2);
  };
  
  
// Añadir esta función para cargar los medios de pago
const fetchMediosPago = async () => {
  if (!clienteId) return;
  
  setLoadingMediosPago(true);
  setErrorMediosPago(null);
  
  try {
    // Llamada a la API
    const response = await apiRequest(`mediopago/cliente/${clienteId}`, "GET");
   
    if (Array.isArray(response)) {
      setMediosPago(response);
    } else {
      console.error("Respuesta inesperada:", response);
      setMediosPago([]);
    }
  } catch (error) {
    console.error("Error al cargar medios de pago:", error);
    setErrorMediosPago("No se pudieron cargar los medios de pago.");
  } finally {
    setLoadingMediosPago(false);
  }
};



// Cargar los medios de pago cuando se abre la pestaña
useEffect(() => {
  if (show && activeTab === "mediosPago") {
    fetchMediosPago();
  }
}, [show, activeTab, clienteId]);


useEffect(() => {
  if (show && clienteData) {
    console.log("📦 Cargando datos del cliente:", clienteData);

    const mapped = mapClienteDataToForm(clienteData);
    setFormData(mapped);
    setInitialFormData(JSON.parse(JSON.stringify(mapped))); // Copia profunda
    setError(null);
    setSuccessMessage("");
    setHasChanges(false);
    setIsIngresoModificado(false);
  }
}, [show, clienteData]);


const formatuscis = (value) => {
  const cleaned = value?.replace(/\D/g, ""); // elimina todo lo que no sea número
  const match = cleaned?.match(/^(\d{0,3})(\d{0,3})(\d{0,3})$/);
  return match ? [match[1], match[2], match[3]].filter(Boolean).join("-") : value;
};

const formatsocial = (value) => {
  const cleaned = value?.replace(/\D/g, ""); // elimina todo lo que no sea número
  const match = cleaned?.match(/^(\d{0,3})(\d{0,2})(\d{0,4})$/);
  return match ? [match[1], match[2], match[3]].filter(Boolean).join("-") : value;
};
  
const mapClienteDataToForm = (data) => {

  const parsedProspecto = parsePrimerContactoInfo(data.primer_contacto_info);
  
  return {
    datosPrincipales: {
      primer_nombre: data.primer_nombre || "",
      segundo_nombre: data.segundo_nombre || "",
      apellidos: data.apellidos || "",
      nombre_completo: data.nombre_completo || "",
      fecha_nacimiento: data.fecha_nacimiento || "",
      edad: data.edad || "",
      genero: data.genero || "",
      estado_cliente: data.estado_cliente || "cliente",
      es_prospecto: data.es_prospecto || false,
      primer_contacto_info: data.primer_contacto_info || "",
      referido: parsedProspecto.referido || "",
      cobertura_prospecto: parsedProspecto.cobertura || "", // 🔄 renombrado
      taxes: parsedProspecto.taxes || "",
      zipcode: parsedProspecto.zipcode || "",
      edad_prospecto: parsedProspecto.edad || "",
      ingresos: parsedProspecto.ingresos || "",
      telefono_prospecto: parsedProspecto.telefono || ""
    },
    statusMigratorio: {
      social: data.social || "",
      status: data.status || "",
      auscis: data.auscis || "",
      tarjeta_numero: data.tarjeta_numero || "",
      fecha_emision: data.fecha_emision || "",
      fecha_expedicion: data.fecha_expiracion || "",
      categoria: data.categoria || ""
    },
    datosContacto: {
      telefono: formatPhoneNumber(data.telefono || ""),
      secundario: formatPhoneNumber(data.secundario || ""),
      whatsapp_num: formatPhoneNumber(data.whatsapp_num || ""),
      nota: data.nota || "",
      cod_tel_1: data.cod_tel_1 || "",
      cod_tel_2: data.cod_tel_2 || "",
      cod_tel_3: data.cod_tel_3 || "",
      servicios_mensajeria: {
        whatsapp: data.whatsapp || false,
        telegram: data.telegram || false,
        texto_sms: data.texto_sms || false
      },
      email: data.email || ""
    },
    direccion: {
      calle: data.calle || "",
      apto: data.apto || "",
      ciudad: data.ciudad || "",
      estado: data.estado || "",
      codigo_postal: data.codigo_postal || "",
      condado: data.condado || "",
      direccion: data.direccion || "",
      dir_correspondencia: data.dir_correspondencia || "",
      copi_dir: false
    },
    datosEmpleo: {
      tipo_ingreso: data.tipo_ingreso || "",
      actividad_economica: data.actividad_economica || "",
      empleador: data.empleador || "",
      telefono_empleador: data.telefono_empleador || "",
      periodo_ingreso: data.periodo_ingreso || "",
      ingreso_por_periodo: data.ingreso_por_periodo || "",
      ingreso_anual: data.ingreso_anual || "",
      ingreso_ocasional: {
        nota_ingreso_ocasional: data.nota_ingreso_ocasional || "",
        periodo: data.periodo_ingreso_ocasional || "",
        monto: data.ingreso_por_periodo_ocasional || ""
      }
    }
  };
};

const [initialFormData, setInitialFormData] = useState(null);

useEffect(() => {
  if (show && clienteData) {
    const mapped = mapClienteDataToForm(clienteData);
    setFormData(mapped);
    setInitialFormData(JSON.parse(JSON.stringify(mapped))); // misma estructura
    setError(null);
    setSuccessMessage("");
    setHasChanges(false);
    setIsIngresoModificado(false);
  }
}, [show, clienteData]);


useEffect(() => {
  if (!initialFormData) return;

  const formChanged = JSON.stringify(formData) !== JSON.stringify(initialFormData);
  setHasChanges(formChanged);
}, [formData, initialFormData]);

  const handleInputChange = (section, field, value) => {
    setFormData(prevData => {
      // Si estamos modificando campos que afectan el nombre completo
      if (section === "datosPrincipales" && 
          (field === "primer_nombre" || field === "segundo_nombre" || field === "apellidos")) {
        
        // Obtener los valores actualizados
        const primerNombre = field === "primer_nombre" ? value : prevData.datosPrincipales.primer_nombre || "";
        const segundoNombre = field === "segundo_nombre" ? value : prevData.datosPrincipales.segundo_nombre || "";
        const apellidos = field === "apellidos" ? value : prevData.datosPrincipales.apellidos || "";
        
        // Construir el nombre completo
        const nombreCompleto = [primerNombre, segundoNombre, apellidos]
          .filter(part => part && part.trim() !== "")
          .join(" ");
        
        // Actualizar el estado con todos los cambios
        return {
          ...prevData,
          [section]: {
            ...prevData[section],
            [field]: value,
            nombre_completo: nombreCompleto
          }
        };
      }
      
      // Para otros campos, actualizar normalmente
      return {
        ...prevData,
        [section]: {
          ...prevData[section],
          [field]: value
        }
      };
    });
    
    
  };

  // Manejar cambios en campos anidados (como servicios_mensajeria)
  const handleNestedInputChange = (section, nestedField, field, value) => {
    setFormData(prevData => ({
      ...prevData,
      [section]: {
        ...prevData[section],
        [nestedField]: {
          ...prevData[section][nestedField],
          [field]: value
        }
      }
    }));
   
  };

 
  // Preparar los datos para enviar
  const prepareDataForSubmit = () => {
    // Crear dirección concatenada como texto simple
    const direccionConcatenada = [
      formData.direccion.calle,
      formData.direccion.apto, 
      formData.direccion.ciudad,
      formData.direccion.estado,
      formData.direccion.codigo_postal
    ].filter(Boolean).join(" ");
  
    const flatData = {
      // Datos principales
      ...formData.datosPrincipales,
      
      // Status migratorio
      ...formData.statusMigratorio,
      
      // Datos de contacto
      ...formData.datosContacto,
      servicios_mensajeria: formData.datosContacto.servicios_mensajeria,
      
      // Incluir los campos individuales de dirección
      calle: formData.direccion.calle,
      apto: formData.direccion.apto,
      ciudad: formData.direccion.ciudad,
      estado: formData.direccion.estado,
      codigo_postal: formData.direccion.codigo_postal,
      condado: formData.direccion.condado,
      
      
      // Guardar la dirección como texto concatenado (no como objeto)
      direccion: direccionConcatenada,
      
      // Dirección de correspondencia
      dir_correspondencia: formData.direccion.dir_correspondencia,
      
      // Datos de empleo
      ...formData.datosEmpleo,
      nota_ingreso_ocasional: formData.datosEmpleo.ingreso_ocasional.nota_ingreso_ocasional,
      periodo_ingreso_ocasional: formData.datosEmpleo.ingreso_ocasional.periodo,
      ingreso_por_periodo_ocasional: formData.datosEmpleo.ingreso_ocasional.monto,


    };
  
    return flatData;
  };  // Enviar los datos actualizados
  const handleSubmit = () => {
    setDataToLog({
      cliente_id: clienteId,
      grupo_familiar_id: clienteData?.grupo_familiar_id || null,
      accion: "update",
      entidad: "cliente",
      entity_type: "cliente"
    });
    setShowBitacoraModal(true);
  };
  
  const actualizarCliente = async () => {
    const dataToSubmit = prepareDataForSubmit();
    try {
      const response = await apiRequest(`cliente/${clienteId}`, "PUT", dataToSubmit);
     
  
      if (onClienteUpdated) {
        // ⬅️ Aquí debes pasar el cliente actualizado (usa el response.data)
        onClienteUpdated({
          id: clienteId,
          ...dataToSubmit,
          nombre_completo: formData.datosPrincipales.nombre_completo,
          grupoFamiliarIds: clienteData?.grupoFamiliarIds || [], // ← mantenerlo
        });
      }
  
      onHide(); // <- cerrar modal
    } catch (error) {
      console.error("❌ Error al actualizar el cliente:", error);
      setError("No se pudo actualizar el cliente.");
    }
  };
  
  

  const handlePhoneInput = (section, field) => (e) => {
    const raw = e.target.value.replace(/\D/g, "");
    const match = raw.match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/);
    const formatted = match ? [match[1], match[2], match[3]].filter(Boolean).join("-") : raw;
    handleInputChange(section, field, formatted);
  };
  
  const estadoActual = formData.datosPrincipales.estado_cliente;
  const estadoOriginal = clienteData?.estado_cliente; // este viene desde el backend
  const esClienteFijo = estadoOriginal === "cliente";
  
  
  // Renderizar pestañas para la sección de datos principales
  const renderDatosPrincipalesTab = () => (
    
    <div className="p-3">
     <div className="btn-group mt-2 mt-md-0" role="group" aria-label="Tipo de cliente">
     <input
  type="radio"
  className="btn-check"
  name="estado_cliente"
  id="btnCliente"
  autoComplete="off"
  checked={estadoActual === "cliente"}
  onChange={() =>
    setFormData(prev => ({
      ...prev,
      datosPrincipales: {
        ...prev.datosPrincipales,
        estado_cliente: "cliente",
        es_prospecto: false,
      }
    }))
  }
/>
<label className="btn btn-outline-primary fw-semibold" htmlFor="btnCliente">
  Cliente
</label>

<input
  type="radio"
  className="btn-check"
  name="estado_cliente"
  id="btnProspecto"
  autoComplete="off"
  disabled={esClienteFijo} // ❌ si ya es cliente, no puede volver a prospecto
  checked={estadoActual === "prospecto"}
  onChange={() =>
    setFormData(prev => ({
      ...prev,
      datosPrincipales: {
        ...prev.datosPrincipales,
        estado_cliente: "prospecto",
        es_prospecto: true,
      }
    }))
  }
/>
<label className="btn btn-outline-warning fw-semibold" htmlFor="btnProspecto">
  Prospecto
</label>

<input
  type="radio"
  className="btn-check"
  name="estado_cliente"
  id="btnDescartado"
  autoComplete="off"
  disabled={esClienteFijo} // ❌ si ya es cliente, no puede ser descartado
  checked={estadoActual === "descartado"}
  onChange={() =>
    setFormData(prev => ({
      ...prev,
      datosPrincipales: {
        ...prev.datosPrincipales,
        estado_cliente: "descartado",
        es_prospecto: true,
      }
    }))
  }
/>
<label className="btn btn-outline-danger fw-semibold" htmlFor="btnDescartado">
  Descartado
</label>
</div>

      
      <Row className="mb-3">
        <Col md={4}>
          <Form.Group>
            <Form.Label>Primer Nombre</Form.Label>
            <Form.Control
              type="text"
              value={formData.datosPrincipales.primer_nombre}
              onChange={(e) => handleInputChange("datosPrincipales", "primer_nombre", e.target.value)}
            />
          </Form.Group>
        </Col>
        <Col md={4}>
          <Form.Group>
            <Form.Label>Segundo Nombre</Form.Label>
            <Form.Control
              type="text"
              value={formData.datosPrincipales.segundo_nombre}
              onChange={(e) => handleInputChange("datosPrincipales", "segundo_nombre", e.target.value)}
            />
          </Form.Group>
        </Col>
        <Col md={4}>
          <Form.Group>
            <Form.Label>Apellidos</Form.Label>
            <Form.Control
              type="text"
              value={formData.datosPrincipales.apellidos}
              onChange={(e) => handleInputChange("datosPrincipales", "apellidos", e.target.value)}
            />
          </Form.Group>
        </Col>
      </Row>
      
                <Form.Group>
            <Form.Label>Nombre Completo</Form.Label>
            <Form.Control
              type="text"
              value={formData.datosPrincipales.nombre_completo}
              disabled
              className="bg-light"
            />
          
          </Form.Group>
      
      <Row className="mb-3">
        <Col md={4}>
          <Form.Group>
            <Form.Label>Fecha de Nacimiento</Form.Label>
            <Form.Control
              type="date"
              value={formData.datosPrincipales.fecha_nacimiento}
              onChange={(e) => handleInputChange("datosPrincipales", "fecha_nacimiento", e.target.value)}
            max="2099-12-31"
            min="1900-01-01"
            />
          </Form.Group>
        </Col>
        <Col md={4}>
          <Form.Group>
            <Form.Label>Edad</Form.Label>
            <Form.Control
              type="number"
              value={formData.datosPrincipales.edad}
              onChange={(e) => handleInputChange("datosPrincipales", "edad", e.target.value)}
            />
          </Form.Group>
        </Col>
        <Col md={4}>
          <Form.Group>
            <Form.Label>Género</Form.Label>
            <Form.Select
              value={formData.datosPrincipales.genero}
              onChange={(e) => handleInputChange("datosPrincipales", "genero", e.target.value)}
            >
              <option value="">Seleccione</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              
            </Form.Select>
          </Form.Group>
        </Col>
      </Row>
      <Row className="mb-3">
  <PrimerContacto
    initialValue={formData.datosPrincipales.primer_contacto_info || ""}
    initialData={parsePrimerContactoInfo(formData.datosPrincipales.primer_contacto_info)}
    onChange={(fields) => {
      const nuevoTexto = buildPrimerContactoInfo(fields);
      setFormData((prev) => ({
        ...prev,
        datosPrincipales: {
          ...prev.datosPrincipales,
          primer_contacto_info: nuevoTexto
        },
      }));
    }}
  />
</Row>

    </div>
  );

  // Renderizar pestañas para status migratorio
  const renderStatusMigratorioTab = () => (
    <div className="p-3">
      <h5 className="border-bottom pb-2 mb-3">Datos sobre Status Migratorio</h5>
      
      <Row className="mb-3">
        <Col md={6}>
        <Form.Group>
              <Form.Label>Social</Form.Label>
              <Form.Control
                type="text"
                value={formData.statusMigratorio.social}
                onChange={(e) => {
                  const formatted = formatsocial(e.target.value);
                  handleInputChange("statusMigratorio", "social", formatted);
                }}
                maxLength={11}
              />

          </Form.Group>
        </Col>
        <Col md={6}>
          <Form.Group>
            <Form.Label>Status</Form.Label>
            <Form.Select
                  value={formData.statusMigratorio.status}
                  onChange={(e) => handleInputChange("statusMigratorio", "status", e.target.value)}
                >


              <option value="">Seleccione</option>
              <option value="P. TRABAJO">P. TRABAJO</option>
                  <option value="RESIDENTE">RESIDENTE</option>
                  <option value="CIUDADANO">CIUDADANO</option>
                  <option value="I-862">I-862</option>
                  <option value="I-797">I-797</option>
                  <option value="I-589 ASILUM">I-589 ASILUM</option>
                  <option value="ESTUDIANTE">ESTUDIANTE</option>
                  <option value="VISA E2">VISA E2</option>
                  <option value="VISA K1">VISA K1</option>
                  <option value="VISA J">VISA J</option>
                  <option value="I-94">I-94</option>
                  <option value="TPS">TPS</option>
            </Form.Select>
          </Form.Group>
        </Col>
      </Row>
      
      <Row className="mb-3">
        <Col md={6}>
          <Form.Group>
            <Form.Label>A/USCIS</Form.Label>
            <Form.Control
                type="text"
                value={formData.statusMigratorio.auscis}
                onChange={(e) => {
                  const formatted = formatuscis(e.target.value);
                  handleInputChange("statusMigratorio", "auscis", formatted);
                }}
                maxLength={11}

              />
          </Form.Group>
        </Col>
        <Col md={6}>
          <Form.Group>
            <Form.Label>Tarjeta #</Form.Label>
            <Form.Control
              type="text"
              value={formData.statusMigratorio.tarjeta_numero}
              onChange={(e) => handleInputChange("statusMigratorio", "tarjeta_numero", e.target.value)}
            />
          </Form.Group>
        </Col>
      </Row>
      
      <Row className="mb-3">
        <Col md={6}>
          <Form.Group>
            <Form.Label>Fecha Emisión</Form.Label>
            <Form.Control
              type="date"
              value={formData.statusMigratorio.fecha_emision}
              onChange={(e) => handleInputChange("statusMigratorio", "fecha_emision", e.target.value)}
              max="2099-12-31"
              min="1900-01-01" 
              />
          </Form.Group>
        </Col>
        <Col md={6}>
          <Form.Group>
            <Form.Label>Fecha Expiración</Form.Label>
            <Form.Control
              type="date"
              value={formData.statusMigratorio.fecha_expedicion}
              onChange={(e) => handleInputChange("statusMigratorio", "fecha_expedicion", e.target.value)}
                max="2099-12-31"
                min="1900-01-01"
            />
          </Form.Group>
        </Col>
      </Row>
      
      <Row className="mb-3">
        <Col md={12}>
          <Form.Group>
            <Form.Label>Categoría</Form.Label>
            <Form.Control
              type="text"
              value={formData.statusMigratorio.categoria}
              onChange={(e) => handleInputChange("statusMigratorio", "categoria", e.target.value)}
            />
          </Form.Group>
        </Col>
      </Row>
    </div>
  );

  // Renderizar pestañas para datos de contacto
  const renderDatosContactoTab = () => (
    <div className="p-3">
      <h5 className="border-bottom pb-2 mb-3">Datos de Contacto</h5>
      
      <Row className="mb-3">
        <Col md={4}>
          <Form.Group>
            <Form.Label>Teléfono</Form.Label>
            <InputGroup>
            <CountrySelectWithFlags
                    selectedCode={formData.datosContacto.cod_tel_1}
                    name="cod_tel_1"
                    onChange={(field, value) => handleInputChange("datosContacto", field, value)}
                  />
             <Form.Control
                      type="text"
                      value={formData.datosContacto.telefono}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, "");
                        const match = raw.match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/);
                        const formatted = match ? [match[1], match[2], match[3]].filter(Boolean).join("-") : raw;

                        handleInputChange("datosContacto", "telefono", formatted);
                      }}
                    />
            </InputGroup>
          </Form.Group>
        </Col>
        <Col md={4}>
          <Form.Group>
            <Form.Label>Tel. Secundario</Form.Label>
            <InputGroup>
            <CountrySelectWithFlags
                        selectedCode={formData.datosContacto.cod_tel_2}
                        name="cod_tel_2"
                        onChange={(field, value) => handleInputChange("datosContacto", field, value)}
                      />
              <Form.Control
                type="text"
                value={formData.datosContacto.secundario}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, "");
                  const match = raw.match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/);
                  const formatted = match ? [match[1], match[2], match[3]].filter(Boolean).join("-") : raw;

                  handleInputChange("datosContacto", "secundario", formatted);
                }}
               />
            </InputGroup>
          </Form.Group>
        </Col>
        <Col md={4}>
          <Form.Group>
            <Form.Label>WhatsApp</Form.Label>
            <InputGroup>
            <CountrySelectWithFlags
                        selectedCode={formData.datosContacto.cod_tel_3}
                        name="cod_tel_3"
                        onChange={(field, value) => handleInputChange("datosContacto", field, value)}
                      />
                 <Form.Control
                      type="text"
                      value={formData.datosContacto.whatsapp_num}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, "");
                        const match = raw.match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/);
                        const formatted = match ? [match[1], match[2], match[3]].filter(Boolean).join("-") : raw;

                        handleInputChange("datosContacto", "whatsapp_num", formatted);
                      }}
                    />

            </InputGroup>
          </Form.Group>
        </Col>
      </Row>
      
      <Row className="mb-3">
        <Col md={12}>
          <Form.Group>
            <Form.Label>Nota</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={formData.datosContacto.nota}
              onChange={(e) => handleInputChange("datosContacto", "nota", e.target.value)}
            />
          </Form.Group>
        </Col>
      </Row>
      
      <h6 className="mt-4 mb-3">Servicios de Mensajería</h6>
      
      <div className="mb-3 d-flex gap-4">
        <Form.Check 
          type="checkbox"
          id="whatsapp-check"
          label="WhatsApp"
          checked={formData.datosContacto.servicios_mensajeria.whatsapp}
          onChange={(e) => handleNestedInputChange("datosContacto", "servicios_mensajeria", "whatsapp", e.target.checked)}
        />
        <Form.Check 
          type="checkbox"
          id="telegram-check"
          label="Telegram"
          checked={formData.datosContacto.servicios_mensajeria.telegram}
          onChange={(e) => handleNestedInputChange("datosContacto", "servicios_mensajeria", "telegram", e.target.checked)}
        />
        <Form.Check 
          type="checkbox"
          id="sms-check"
          label="Texto SMS"
          checked={formData.datosContacto.servicios_mensajeria.texto_sms}
          onChange={(e) => handleNestedInputChange("datosContacto", "servicios_mensajeria", "texto_sms", e.target.checked)}
        />
      </div>
      
      <Row className="mb-3">
        <Col md={12}>
          <Form.Group>
            <Form.Label>Email</Form.Label>
            <Form.Control
              type="email"
              value={formData.datosContacto.email}
              onChange={(e) => handleInputChange("datosContacto", "email", e.target.value)}
            />
          </Form.Group>
        </Col>
      </Row>
    </div>
  );

 // En el archivo EditClienteModal.js
const renderDireccionTab = () => (
  <div className="p-3">
    <h5 className="border-bottom pb-2 mb-3">Dirección</h5>
    
    <FormDireccion
      formData={formData.direccion || {}}
      onChange={(name, value, direccionCompleta) => {
        setFormData(prevData => {
          // Crear una copia actualizada de los datos de dirección
          const updatedDireccion = {
            ...prevData.direccion,
            [name]: value,
          };
          
          // Si se actualizó un campo que afecta la dirección completa y no es el campo
          // de correspondencia o el checkbox, actualizar la visualización de dirección
          if (direccionCompleta && name !== "dir_correspondencia" && name !== "copi_dir") {
            updatedDireccion.direccion = direccionCompleta;
          }
          
          return {
            ...prevData,
            direccion: updatedDireccion
          };
        });
        
        setHasChanges(true);
      }}
      editable={true}
    />
  </div>
);

  // Renderizar pestañas para datos de empleo
  const renderDatosEmpleoTab = () => (
    <div className="p-3">
      <h5 className="border-bottom pb-2 mb-3">Datos de Empleo e Ingreso</h5>
      
      <Row className="mb-3">
        <Col md={6}>
          <Form.Group>
            <Form.Label>Tipo de Ingreso</Form.Label>
            <Form.Select
              value={formData.datosEmpleo.tipo_ingreso}
              onChange={(e) => handleInputChange("datosEmpleo", "tipo_ingreso", e.target.value)}
            >
              <option value="">Seleccione</option>
                  <option value="W2">W2</option>
                  <option value="1099">1099</option>
                  <option value="SOCIAL SECURITY">SOCIAL SECURITY</option>
                  <option value="SELF EMPLOYMENT">SELF EMPLOYMENT</option>
                  <option value="SUPPORT">SUPPORT</option>
                  <option value="ALIMONY">ALIMONY</option>
            </Form.Select>
          </Form.Group>
        </Col>
        <Col md={6}>
          <Form.Group>
            <Form.Label>Actividad Económica</Form.Label>
            <Form.Control
              type="text"
              placeholder="Ej: Comercio, Servicios, etc."
              value={formData.datosEmpleo.actividad_economica}
              onChange={(e) => handleInputChange("datosEmpleo", "actividad_economica", e.target.value)}
            />
          </Form.Group>
        </Col>
      </Row>
      
      <Row className="mb-3">
        <Col md={6}>
          <Form.Group>
            <Form.Label>Empleador</Form.Label>
            <Form.Control
              type="text"
              placeholder="Nombre de la empresa"
              value={formData.datosEmpleo.empleador}
              onChange={(e) => handleInputChange("datosEmpleo", "empleador", e.target.value)}
            />
          </Form.Group>
        </Col>
        <Col md={6}>
          <Form.Group>
            <Form.Label>Teléfono del Empleador</Form.Label>
            <Form.Control
                      type="text"
                      value={formData.datosEmpleo.telefono_empleador}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, "");
                        const match = raw.match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/);
                        const formatted = match ? [match[1], match[2], match[3]].filter(Boolean).join("-") : raw;

                        handleInputChange("datosEmpleo", "telefono_empleador", formatted);
                      }}
                    />
          </Form.Group>
        </Col>
      </Row>
      
      <Row className="mb-3">
        <Col md={4}>
          <Form.Group>
            <Form.Label>Período de Ingreso</Form.Label>
            <Form.Select
                    value={formData.datosEmpleo.periodo_ingreso}
                    onChange={(e) => {
                      const value = e.target.value;
                      const nuevosDatosEmpleo = {
                        ...formData.datosEmpleo,
                        periodo_ingreso: value
                      };
                      const nuevoTotal = recalcularIngresoAnualTotal(nuevosDatosEmpleo);
                      handleInputChange("datosEmpleo", "periodo_ingreso", value);
                      handleInputChange("datosEmpleo", "ingreso_anual", nuevoTotal);
                    }}
                    
                  >


                    <option value="">Seleccione</option>
                    <option value="HOUR">HOUR</option>
                    <option value="WEEKLY P.TIME">WEEKLY P.TIME</option>
                    <option value="WEEKLY">WEEKLY</option>
                    <option value="BIWEEKLY">BIWEEKLY</option>
                    <option value="MONTHLY">MONTHLY</option>
                    <option value="ANNUAL">ANNUAL</option>
                  </Form.Select>


          </Form.Group>
        </Col>
        <Col md={4}>
          <Form.Group>
          <Form.Label>Ingreso por Período ($)</Form.Label>
          <NumericFormat
                    value={formData.datosEmpleo.ingreso_por_periodo}
                    thousandSeparator=","
                    decimalSeparator="."
                    prefix="$"
                    decimalScale={2}
                    fixedDecimalScale
                    allowNegative={false}
                    className="form-control"
                    onValueChange={({ value }) => {
                      const nuevosDatosEmpleo = {
                        ...formData.datosEmpleo,
                        ingreso_por_periodo: value,
                      };
                      const nuevoTotal = recalcularIngresoAnualTotal(nuevosDatosEmpleo);
                      handleInputChange("datosEmpleo", "ingreso_por_periodo", value);
                      handleInputChange("datosEmpleo", "ingreso_anual", nuevoTotal);
                    }}
                  />



          </Form.Group>
        </Col>
        <Col md={4}>
          <Form.Group>
          <Form.Label>Ingreso Anual ($)</Form.Label>
              <NumericFormat
                value={formData.datosEmpleo.ingreso_anual}
                thousandSeparator=","
                decimalSeparator="."
                prefix="$"
                decimalScale={2}
                fixedDecimalScale
                allowNegative={false}
                className="form-control"
                onValueChange={(values) => {
                  const { value } = values;
                  handleInputChange("datosEmpleo", "ingreso_anual", value);
                }}
              />

          </Form.Group>
        </Col>
      </Row>
      
      <h6 className="mt-4 mb-3">Ingreso Ocasional</h6>
      
      <Row className="mb-3">
        <Col md={12}>
          <Form.Group>
            <Form.Label>Nota</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              value={formData.datosEmpleo.ingreso_ocasional.nota_ingreso_ocasional}
              onChange={(e) => handleNestedInputChange("datosEmpleo", "ingreso_ocasional", "nota_ingreso_ocasional", e.target.value)}
              
            />
          </Form.Group>
        </Col>
      </Row>
      
      <Row className="mb-3">
        <Col md={6}>
          <Form.Group>
            <Form.Label>Período de Ingreso Ocasional</Form.Label>
            <Form.Select
              value={formData.datosEmpleo.ingreso_ocasional.periodo}
              onChange={(e) => handleNestedInputChange("datosEmpleo", "ingreso_ocasional", "periodo", e.target.value)}
            >
              <option value="">Seleccione</option>
              <option value="HOUR">HOUR</option>
            <option value="WEEKLY P.TIME">WEEKLY P.TIME</option>
            <option value="WEEKLY">WEEKLY</option>
            <option value="BIWEEKLY">BIWEEKLY</option>
            <option value="MONTHLY">MONTHLY</option>
            <option value="ANNUAL">ANNUAL</option>
            </Form.Select>
          </Form.Group>
        </Col>
        <Col md={6}>
          <Form.Group>
          <Form.Label>Ingreso por Período ocasional ($)</Form.Label>
              <NumericFormat
                value={formData.datosEmpleo.ingreso_ocasional.monto}
                thousandSeparator=","
                decimalSeparator="."
                prefix="$"
                decimalScale={2}
                fixedDecimalScale
                allowNegative={false}
                className="form-control"
                onValueChange={(values) => {
                  const { value } = values;
                  const nuevosDatosEmpleo = {
                    ...formData.datosEmpleo,
                    ingreso_ocasional: {
                      ...formData.datosEmpleo.ingreso_ocasional,
                      monto: value
                    }
                  };
                  const nuevoTotal = recalcularIngresoAnualTotal(nuevosDatosEmpleo);
                  handleNestedInputChange("datosEmpleo", "ingreso_ocasional", "monto", value);
                  handleInputChange("datosEmpleo", "ingreso_anual", nuevoTotal);
                }}
                
              />

          </Form.Group>
        </Col>
      </Row>
    </div>
  );

  // Renderizar sección de medios de pago como referencia
  const renderMediosPagoTab = () => (
    <div className="p-3">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="border-bottom pb-2 mb-0">Medios de Pago</h5>
        <Button 
          variant="primary"
          onClick={() => window.open(`/clientes/mediopago/${clienteId}`, '_blank')}
        >
          <i className="bi bi-credit-card me-2"></i>
          Administrar Medios de Pago
        </Button>
      </div>
  
      {loadingMediosPago ? (
        <div className="text-center py-4">
          <Spinner animation="border" variant="primary" size="sm" />
          <p className="mt-2 mb-0 text-muted">Cargando medios de pago...</p>
        </div>
      ) : errorMediosPago ? (
        <Alert variant="danger" className="mt-3">
          <i className="bi bi-exclamation-triangle me-2"></i>
          {errorMediosPago}
        </Alert>
      ) : mediosPago.length === 0 ? (
        <div className="text-center border rounded py-4 mt-3 bg-light">
          <i className="bi bi-credit-card-2-front display-5 text-muted mb-3"></i>
          <h6 className="mb-3">No hay medios de pago registrados</h6>
          <p className="text-muted mb-3">
            Utilice el administrador de medios de pago para añadir nuevos métodos de pago.
          </p>
        </div>
      ) : (
        <MediosPagoTablas
        mediosPago={mediosPago}
        onView={(medio) =>
          alert(`Ver medio de pago:\nTitular: ${medio.titular}\nTipo: ${medio.forma_pago}`)
        }
        onEdit={() => {}}
        onDelete={() => {}}
        showActions={false}
      />
      
      
      )}
  
      <div className="alert alert-info mt-4">
        <div className="d-flex">
          <i className="bi bi-info-circle me-2 fs-5"></i>
          <div>
            <h6 className="mb-1">Nota importante:</h6>
            <p className="mb-0">
              Para administrar completamente los medios de pago (añadir nuevos, editar existentes, 
              etc.), utilice el botón "Administrar Medios de Pago" que abrirá 
              la herramienta específica en una nueva ventana.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
  
  return (
    <Modal 
      show={show} 
      onHide={() => {
        if (hasChanges && !saving) {
          if (window.confirm("¿Estás seguro que deseas cerrar? Perderás los cambios no guardados.")) {
            onHide();
          }
        } else {
          onHide();
        }
      }}
      size="xl"
      centered
      backdrop="static"
      className="cliente-edit-modal"
      dialogClassName="modal-90w"
    >
      <Modal.Header closeButton className="align-items-center">
        <Modal.Title>
          <i className="bi bi-pencil-square me-2"></i>
          Editar Cliente: {clienteData?.nombre_completo || ""}
        </Modal.Title>
        {hasChanges && (
          <Badge bg="warning" className="ms-3">
            Cambios sin guardar
          </Badge>
        )}
      </Modal.Header>
      
      <Modal.Body className="p-0">
        {loading ? (
          <div className="text-center py-5">
            <Spinner animation="border" variant="primary" />
            <p className="mt-3">Cargando datos del cliente...</p>
          </div>
        ) : error ? (
          <Alert variant="danger" className="m-3">
            {error}
          </Alert>
        ) : (
          <>
            {successMessage && (
              <Alert variant="success" className="m-3">
                <i className="bi bi-check-circle me-2"></i>
                {successMessage}
              </Alert>
            )}
            
            <Tab.Container activeKey={activeTab} onSelect={setActiveTab}>
              <div className="d-flex">
                <div className="nav-tabs-left border-end" style={{ width: "220px", minHeight: "500px" }}>
                  <Nav variant="pills" className="flex-column p-2">
                    <Nav.Item>
                      <Nav.Link eventKey="datosPrincipales" className="d-flex align-items-center">
                        <div className="tab-icon rounded-circle text-white d-flex align-items-center justify-content-center me-2" 
                             style={{ width: "24px", height: "24px", backgroundColor: "#0d6efd" }}>
                          1
                        </div>
                        <span>Datos Principales</span>
                      </Nav.Link>
                    </Nav.Item>
                    <Nav.Item>
                      <Nav.Link eventKey="statusMigratorio" className="d-flex align-items-center">
                        <div className="tab-icon rounded-circle text-white d-flex align-items-center justify-content-center me-2" 
                             style={{ width: "24px", height: "24px", backgroundColor: "#0d6efd" }}>
                          2
                        </div>
                        <span>Status Migratorio</span>
                      </Nav.Link>
                    </Nav.Item>
                    <Nav.Item>
                      <Nav.Link eventKey="datosContacto" className="d-flex align-items-center">
                        <div className="tab-icon rounded-circle text-white d-flex align-items-center justify-content-center me-2" 
                             style={{ width: "24px", height: "24px", backgroundColor: "#0d6efd" }}>
                          3
                        </div>
                        <span>Datos de Contacto</span>
                      </Nav.Link>
                    </Nav.Item>
                    <Nav.Item>
                      <Nav.Link eventKey="direccion" className="d-flex align-items-center">
                        <div className="tab-icon rounded-circle text-white d-flex align-items-center justify-content-center me-2" 
                             style={{ width: "24px", height: "24px", backgroundColor: "#0d6efd" }}>
                          4
                        </div>
                        <span>Dirección</span>
                      </Nav.Link>
                    </Nav.Item>
                    <Nav.Item>
                      <Nav.Link eventKey="datosEmpleo" className="d-flex align-items-center">
                        <div className="tab-icon rounded-circle text-white d-flex align-items-center justify-content-center me-2" 
                             style={{ width: "24px", height: "24px", backgroundColor: "#0d6efd" }}>
                          5
                        </div>
                        <span>Empleo e Ingreso</span>
                      </Nav.Link>
                    </Nav.Item>
                    <Nav.Item>
                      <Nav.Link eventKey="mediosPago" className="d-flex align-items-center">
                        <div className="tab-icon rounded-circle text-white d-flex align-items-center justify-content-center me-2" 
                             style={{ width: "24px", height: "24px", backgroundColor: "#0d6efd" }}>
                          6
                        </div>
                        <span>Medios de Pago</span>
                      </Nav.Link>
                    </Nav.Item>
                  </Nav>
                  
                  <div className="p-3 mt-auto">
                    <Button 
                      variant="success" 
                      className="w-100 d-flex align-items-center justify-content-center"
                      onClick={handleSubmit}
                      disabled={saving || !hasChanges}
                    >
                      {saving ? (
                        <>
                          <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" />
                          <span>Guardando...</span>
                        </>
                      ) : (
                        <>
                          <i className="bi bi-save me-2"></i>
                          Guardar Cambios
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                
                <div className="tab-content-right" style={{ flex: "1" }}>
                  <Tab.Content>
                    <Tab.Pane eventKey="datosPrincipales">
                      {renderDatosPrincipalesTab()}
                    </Tab.Pane>
                    <Tab.Pane eventKey="statusMigratorio">
                      {renderStatusMigratorioTab()}
                    </Tab.Pane>
                    <Tab.Pane eventKey="datosContacto">
                      {renderDatosContactoTab()}
                    </Tab.Pane>
                    <Tab.Pane eventKey="direccion">
                      {renderDireccionTab()}
                    </Tab.Pane>
                    <Tab.Pane eventKey="datosEmpleo">
                      {renderDatosEmpleoTab()}
                    </Tab.Pane>
                    <Tab.Pane eventKey="mediosPago">
                      {renderMediosPagoTab()}
                    </Tab.Pane>
                  </Tab.Content>
                  
                  <div className="d-flex justify-content-between p-3 border-top">
                    <Button 
                      variant="outline-secondary" 
                      onClick={() => {
                        const tabs = ["datosPrincipales", "statusMigratorio", "datosContacto", "direccion", "datosEmpleo", "mediosPago"];
                        const currentIndex = tabs.indexOf(activeTab);
                        if (currentIndex > 0) {
                          setActiveTab(tabs[currentIndex - 1]);
                        }
                      }}
                      disabled={activeTab === "datosPrincipales"}
                    >
                      <i className="bi bi-arrow-left me-2"></i>
                      Anterior
                    </Button>
                    
                    <Button 
                      variant="outline-primary" 
                      onClick={() => {
                        const tabs = ["datosPrincipales", "statusMigratorio", "datosContacto", "direccion", "datosEmpleo", "mediosPago"];
                        const currentIndex = tabs.indexOf(activeTab);
                        if (currentIndex < tabs.length - 1) {
                          setActiveTab(tabs[currentIndex + 1]);
                        }
                      }}
                      disabled={activeTab === "mediosPago"}
                    >
                      Siguiente
                      <i className="bi bi-arrow-right ms-2"></i>
                    </Button>
                  </div>
                </div>
              </div>
            </Tab.Container>
          </>
        )}
      </Modal.Body>
      {showBitacoraModal && (
      <BitacoraModal
      show={showBitacoraModal}
      data={dataToLog}
      logId={dataToLog?.logId} // si lo usas
      onHide={async (wasSaved) => {
        setShowBitacoraModal(false);
        if (wasSaved) {
          await actualizarCliente(); // 🟢 actualizar cliente
          onHide(); // 🟢 cerrar modal de edición
        }
      }}
    />
    


)}

    </Modal>
  );
};

export default EditClienteModal;