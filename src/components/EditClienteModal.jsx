import React, { useState, useEffect } from "react";
import { 
  Modal, Button, Form, Row, Col, Spinner, Alert, 
  Nav, Tab, InputGroup, Badge
} from "react-bootstrap";
import apiRequest from "../services/api";
import CountrySelect from "../components/CountrySelect"; // Ajusta según tu estructura


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
      genero: ""
    },
    // Sección 2: Status Migratorio
    statusMigratorio: {
      social: "",
      status: "",
      a_uscis: "",
      tarjeta_numero: "",
      fecha_emision: "",
      fecha_expedicion: "",
      categoria: ""
    },
    // Sección 3: Datos de Contacto
    datosContacto: {
      telefono: "",
      tel_secundario: "",
      whatsapp: "",
      nota_telefonos: "",
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
      numero: "",
      ciudad: "",
      estado: "",
      codigo_postal: "",
      pais: "",
      referencias: ""
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
        nota: "",
        periodo: "",
        monto: ""
      }
    }
  });
  
  // Estado activo para las pestañas
  const [activeTab, setActiveTab] = useState("datosPrincipales");
  
  // Estados para controlar la interfaz
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [hasChanges, setHasChanges] = useState(false);
  
  // Cargar datos del cliente al abrir el modal
  useEffect(() => {
    if (show && clienteData) {
      mapClienteDataToForm(clienteData);
      setError(null);
      setSuccessMessage("");
      setHasChanges(false);
    }
  }, [show, clienteData]);
  
  // Función para mapear los datos del cliente al formulario
  const mapClienteDataToForm = (data) => {
    // Crear un nuevo objeto para manejar todas las propiedades
    const mappedData = {
      // Sección 1: Datos Principales
      datosPrincipales: {
        primer_nombre: data.primer_nombre || "",
        segundo_nombre: data.segundo_nombre || "",
        apellidos: data.apellidos || "",
        nombre_completo: data.nombre_completo || "",
        fecha_nacimiento: data.fecha_nacimiento || "",
        edad: data.edad || "",
        genero: data.genero || ""
      },
      // Sección 2: Status Migratorio
      statusMigratorio: {
        social: data.social || "",
        status: data.status || "",
        a_uscis: data.a_uscis || "",
        tarjeta_numero: data.tarjeta_numero || "",
        fecha_emision: data.fecha_emision || "",
        fecha_expedicion: data.fecha_expedicion || "",
        categoria: data.categoria || ""
      },
      // Sección 3: Datos de Contacto
      datosContacto: {
        telefono: data.telefono || "",
        tel_secundario: data.tel_secundario || "",
        whatsapp: data.whatsapp || "",
        nota_telefonos: data.nota_telefonos || "",
        servicios_mensajeria: {
          whatsapp: data.servicios_mensajeria?.whatsapp || false,
          telegram: data.servicios_mensajeria?.telegram || false,
          texto_sms: data.servicios_mensajeria?.texto_sms || false
        },
        email: data.email || ""
      },
      // Sección 4: Dirección
      direccion: {
        calle: data.direccion?.calle || data.calle || "",
        numero: data.direccion?.numero || data.numero || "",
        ciudad: data.direccion?.ciudad || data.ciudad || "",
        estado: data.direccion?.estado || data.estado || "",
        codigo_postal: data.direccion?.codigo_postal || data.codigo_postal || "",
        pais: data.direccion?.pais || data.pais || "",
        referencias: data.direccion?.referencias || data.referencias || ""
      },
      // Sección 5: Datos de Empleo e Ingreso
      datosEmpleo: {
        tipo_ingreso: data.tipo_ingreso || "",
        actividad_economica: data.actividad_economica || "",
        empleador: data.empleador || "",
        telefono_empleador: data.telefono_empleador || "",
        periodo_ingreso: data.periodo_ingreso || "",
        ingreso_por_periodo: data.ingreso_por_periodo || "",
        ingreso_anual: data.ingreso_anual || "",
        ingreso_ocasional: {
          nota: data.ingreso_ocasional?.nota || "",
          periodo: data.ingreso_ocasional?.periodo || "",
          monto: data.ingreso_ocasional?.monto || ""
        }
      }
    };

    // Actualizar el estado
    setFormData(mappedData);
  };

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
    
    setHasChanges(true);
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
    setHasChanges(true);
  };

  // Preparar los datos para enviar
  const prepareDataForSubmit = () => {
    // Combinar todos los datos en un solo objeto
    const flatData = {
      // Datos principales
      ...formData.datosPrincipales,
      // Status migratorio
      ...formData.statusMigratorio,
      // Datos de contacto
      ...formData.datosContacto,
      servicios_mensajeria: formData.datosContacto.servicios_mensajeria,
      // Dirección
      direccion: formData.direccion,
      // Datos de empleo
      ...formData.datosEmpleo,
      ingreso_ocasional: formData.datosEmpleo.ingreso_ocasional
    };

    return flatData;
  };

  // Enviar los datos actualizados
  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    setSuccessMessage("");
    
    try {
      const dataToSubmit = prepareDataForSubmit();
      console.log("Datos a enviar:", dataToSubmit);
      
      // Usar el método PUT para actualizar el cliente
      const response = await apiRequest(`cliente/${clienteId}`, "PUT", dataToSubmit);
      console.log("Respuesta de actualización:", response);
      
      setSuccessMessage("Cliente actualizado con éxito");
      setHasChanges(false);
      
      // Notificar al componente padre sobre la actualización
      if (onClienteUpdated) {
        onClienteUpdated({
          id: clienteId,
          ...dataToSubmit
        });
      }
      
      // Cerrar el modal después de un breve retraso
      setTimeout(() => {
        onHide();
      }, 1500);
    } catch (err) {
      console.error("Error al actualizar cliente:", err);
      setError("No se pudo actualizar el cliente. " + (err.message || ""));
    } finally {
      setSaving(false);
    }
  };

  // Renderizar pestañas para la sección de datos principales
  const renderDatosPrincipalesTab = () => (
    <div className="p-3">
      <h5 className="border-bottom pb-2 mb-3">Datos Principales</h5>
      
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
              <option value="Masculino">Masculino</option>
              <option value="Femenino">Femenino</option>
              <option value="Otro">Otro</option>
            </Form.Select>
          </Form.Group>
        </Col>
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
              onChange={(e) => handleInputChange("statusMigratorio", "social", e.target.value)}
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
              <option value="Ciudadano">Ciudadano</option>
              <option value="Residente">Residente</option>
              <option value="Asilo">Asilo</option>
              <option value="DACA">DACA</option>
              <option value="TPS">TPS</option>
              <option value="Visa">Visa</option>
              <option value="Otro">Otro</option>
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
              value={formData.statusMigratorio.a_uscis}
              onChange={(e) => handleInputChange("statusMigratorio", "a_uscis", e.target.value)}
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
            />
          </Form.Group>
        </Col>
        <Col md={6}>
          <Form.Group>
            <Form.Label>Fecha Expedición</Form.Label>
            <Form.Control
              type="date"
              value={formData.statusMigratorio.fecha_expedicion}
              onChange={(e) => handleInputChange("statusMigratorio", "fecha_expedicion", e.target.value)}
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
              <CountrySelect 
                selectedCode="us" 
                onChange={() => {}} 
              />
              <Form.Control
                type="text"
                value={formData.datosContacto.telefono}
                onChange={(e) => handleInputChange("datosContacto", "telefono", e.target.value)}
              />
            </InputGroup>
          </Form.Group>
        </Col>
        <Col md={4}>
          <Form.Group>
            <Form.Label>Tel. Secundario</Form.Label>
            <InputGroup>
              <CountrySelect 
                selectedCode="us" 
                onChange={() => {}} 
              />
              <Form.Control
                type="text"
                value={formData.datosContacto.tel_secundario}
                onChange={(e) => handleInputChange("datosContacto", "tel_secundario", e.target.value)}
              />
            </InputGroup>
          </Form.Group>
        </Col>
        <Col md={4}>
          <Form.Group>
            <Form.Label>WhatsApp</Form.Label>
            <InputGroup>
              <CountrySelect 
                selectedCode="us" 
                onChange={() => {}} 
              />
              <Form.Control
                type="text"
                value={formData.datosContacto.whatsapp}
                onChange={(e) => handleInputChange("datosContacto", "whatsapp", e.target.value)}
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
              value={formData.datosContacto.nota_telefonos}
              onChange={(e) => handleInputChange("datosContacto", "nota_telefonos", e.target.value)}
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

  // Renderizar pestañas para dirección
  const renderDireccionTab = () => (
    <div className="p-3">
      <h5 className="border-bottom pb-2 mb-3">Dirección</h5>
      
      <Row className="mb-3">
        <Col md={8}>
          <Form.Group>
            <Form.Label>Calle</Form.Label>
            <Form.Control
              type="text"
              value={formData.direccion.calle}
              onChange={(e) => handleNestedInputChange("direccion", "calle", e.target.value)}
            />
          </Form.Group>
        </Col>
        <Col md={4}>
          <Form.Group>
            <Form.Label>Número</Form.Label>
            <Form.Control
              type="text"
              value={formData.direccion.numero}
              onChange={(e) => handleNestedInputChange("direccion", "numero", e.target.value)}
            />
          </Form.Group>
        </Col>
      </Row>
      
      <Row className="mb-3">
        <Col md={4}>
          <Form.Group>
            <Form.Label>Ciudad</Form.Label>
            <Form.Control
              type="text"
              value={formData.direccion.ciudad}
              onChange={(e) => handleNestedInputChange("direccion", "ciudad", e.target.value)}
            />
          </Form.Group>
        </Col>
        <Col md={4}>
          <Form.Group>
            <Form.Label>Estado</Form.Label>
            <Form.Control
              type="text"
              value={formData.direccion.estado}
              onChange={(e) => handleNestedInputChange("direccion", "estado", e.target.value)}
            />
          </Form.Group>
        </Col>
        <Col md={4}>
          <Form.Group>
            <Form.Label>Código Postal</Form.Label>
            <Form.Control
              type="text"
              value={formData.direccion.codigo_postal}
              onChange={(e) => handleNestedInputChange("direccion", "codigo_postal", e.target.value)}
            />
          </Form.Group>
        </Col>
      </Row>
      
      <Row className="mb-3">
        <Col md={6}>
          <Form.Group>
            <Form.Label>País</Form.Label>
            <Form.Control
              type="text"
              value={formData.direccion.pais}
              onChange={(e) => handleNestedInputChange("direccion", "pais", e.target.value)}
            />
          </Form.Group>
        </Col>
        <Col md={6}>
          <Form.Group>
            <Form.Label>Referencias</Form.Label>
            <Form.Control
              type="text"
              value={formData.direccion.referencias}
              onChange={(e) => handleNestedInputChange("direccion", "referencias", e.target.value)}
            />
          </Form.Group>
        </Col>
      </Row>
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
              <option value="Empleado">Empleado</option>
              <option value="Autónomo">Autónomo</option>
              <option value="Mixto">Mixto</option>
              <option value="Otro">Otro</option>
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
              onChange={(e) => handleInputChange("datosEmpleo", "telefono_empleador", e.target.value)}
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
              onChange={(e) => handleInputChange("datosEmpleo", "periodo_ingreso", e.target.value)}
            >
              <option value="">Seleccione</option>
              <option value="HOUR">Por Hora</option>
              <option value="DAY">Diario</option>
              <option value="WEEK">Semanal</option>
              <option value="BIWEEK">Quincenal</option>
              <option value="MONTH">Mensual</option>
              <option value="YEAR">Anual</option>
            </Form.Select>
          </Form.Group>
        </Col>
        <Col md={4}>
          <Form.Group>
            <Form.Label>Ingreso por Período ($)</Form.Label>
            <Form.Control
              type="number"
              value={formData.datosEmpleo.ingreso_por_periodo}
              onChange={(e) => handleInputChange("datosEmpleo", "ingreso_por_periodo", e.target.value)}
            />
          </Form.Group>
        </Col>
        <Col md={4}>
          <Form.Group>
            <Form.Label>Ingreso Anual ($)</Form.Label>
            <Form.Control
              type="number"
              value={formData.datosEmpleo.ingreso_anual}
              onChange={(e) => handleInputChange("datosEmpleo", "ingreso_anual", e.target.value)}
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
              value={formData.datosEmpleo.ingreso_ocasional.nota}
              onChange={(e) => handleNestedInputChange("datosEmpleo", "ingreso_ocasional", "nota", e.target.value)}
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
              <option value="HOUR">Por Hora</option>
              <option value="DAY">Diario</option>
              <option value="WEEK">Semanal</option>
              <option value="BIWEEK">Quincenal</option>
              <option value="MONTH">Mensual</option>
              <option value="YEAR">Anual</option>
            </Form.Select>
          </Form.Group>
        </Col>
        <Col md={6}>
          <Form.Group>
            <Form.Label>Ingreso por Período ocasional ($)</Form.Label>
            <Form.Control
              type="number"
              value={formData.datosEmpleo.ingreso_ocasional.monto}
              onChange={(e) => handleNestedInputChange("datosEmpleo", "ingreso_ocasional", "monto", e.target.value)}
            />
          </Form.Group>
        </Col>
      </Row>
    </div>
  );

  // Renderizar sección de medios de pago como referencia
  const renderMediosPagoTab = () => (
    <div className="p-3 text-center">
      <h5 className="border-bottom pb-2 mb-4">Medios de Pago</h5>
      
      <p className="mb-4">
        Los medios de pago se administran por separado después de guardar los datos del cliente.
      </p>
      
      <Button 
        variant="outline-primary"
        onClick={() => window.open(`/clientes/medios-pago/${clienteId}`, '_blank')}
        className="mb-3"
      >
        <i className="bi bi-credit-card me-2"></i>
        Administrar Medios de Pago
      </Button>

      <p className="mt-3 text-muted small">
        Se abrirá en una nueva ventana para que puedas mantener los cambios actuales.
      </p>
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
    </Modal>
  );
};

export default EditClienteModal;