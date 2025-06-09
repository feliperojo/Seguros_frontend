import React, { useState, useEffect } from "react";
import { NumericFormat } from 'react-number-format';
import { FaMapMarkerAlt } from "react-icons/fa";
import "bootstrap/dist/css/bootstrap.min.css";
import "../styles/ClienteForm.css";
import apiRequest from "../services/api";
import MediosPago from "../components/MediosPago";
import CountrySelectWithFlags from '../components/CountrySelect';
import countryCodes from '../services/countryCodes'
import idiomas  from '../services/idiomas.js';
import FormDireccion from "../components/FormDireccion";
import BitacoraModal from "../components/Tareas/BitacoraModal";


const Clientes = ({ onClienteCreado, isModal = false }) => {
  
  // Initial form state as a constant for easy resetting
  const INITIAL_FORM_STATE = {
    nombre_completo: "",
    primer_nombre: "",
    segundo_nombre: "",
    apellidos: "",
    fecha_nacimiento: "",
    edad: "",
    genero: "",
    cobertura: true,
    social: "",
    status: "",
    auscis: "",
    tarjeta_numero: "",
    categoria: "",
    fecha_emision: "",
    fecha_expiracion: "",
    telefono: "",
    email: "",
    whatsapp: false,
    telegram: false,
    texto_sms: false,
    calle: "",
    apto: "",
    ciudad: "",
    condado: "",
    estado: "",
    codigo_postal: "",
    idioma:"",
    secundario: "",
    whatsapp_num: "",
    direccion: "",
    dir_correspondencia: "",    
    copi_dir: false, // Añadido para el checkbox "Copiar Dirección"
    // Campos para Datos de Empleo e Ingreso (Paso 6)
    tipo_ingreso: "",
    actividad_economica: "",
    empleador: "",
    telefono_empleador: "",
    periodo_ingreso: "", // Valor por defecto
    ingreso_por_periodo: "",
    ingreso_anual: "",
    nota_ocasional:"",
    nota:"",
    periodo_ingreso_ocasional: "", // Valor por defecto
    ingreso_por_periodo_ocasional: ""
  };
  const [idiomasList, setIdiomasList] = useState([]);
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [alert, setAlert] = useState({ type: "", message: "", visible: false });
  const [showBankDetails, setShowBankDetails] = useState(false);
  const [showCardDetails, setShowCardDetails] = useState(false);
  const [clienteId, setClienteId] = useState(null);
  const [clienteCreado, setClienteCreado] = useState(false);
  const [tiposIngreso, setTiposIngreso] = useState([]);
  const [showModal, setShowModal] = useState(isModal); // Inicializar con isModal
  const [showBitacora, setShowBitacora] = useState(false);
  const [bitacoraData, setBitacoraData] = useState(null);
  const [logId, setLogId] = useState(null);

  
  // En la inicialización de selectedCode en tu componente Clientes
const [selectedCode, setSelectedCode] = useState({
  telefono: "us",
  secundario: "us",
  whatsapp_num: "us",
  telefono_empleador: "us"  // Añadir esta línea si no existe
});
const openModal = () => setShowModal(true);
const closeModal = () => setShowModal(false);

  
  const [currentStep, setCurrentStep] = useState(1);
 
  const totalSteps = 6;

  const pasos = [
    { id: 1, titulo: "Datos Principales" },
    { id: 2, titulo: "Datos sobre Status Migratorio" },
    { id: 3, titulo: "Datos de Contacto" },
    { id: 4, titulo: "Dirección" },
    { id: 5, titulo: "Datos de Empleo e Ingreso" },
    { id: 6, titulo: "Medios de Pago" }
  ];

  const openMap = () => {
    window.open("https://www.unitedstateszipcodes.org/", "_blank");
  }

  useEffect(() => {
    // Carga la lista de idiomas
    setIdiomasList(idiomas);
  }, []);


  const calcularEdad = (fechaNacimiento) => {
    const hoy = new Date();
    const nacimiento = new Date(fechaNacimiento);
    let edadCalculada = hoy.getFullYear() - nacimiento.getFullYear();
    const mes = hoy.getMonth() - nacimiento.getMonth();
    if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
      edadCalculada--;
    }
    return edadCalculada;
  };

  // Función para formatear números de teléfono como XXX-XXX-XXXX
  const formatPhoneNumber = (value) => {
    const cleaned = value.replace(/\D/g, ""); // Eliminar caracteres no numéricos
    const match = cleaned.match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/);

    if (!match) return value; // Retorna el valor original si no hay coincidencias

    return [match[1], match[2], match[3]].filter(Boolean).join("-");
  };

  // Función para formatear números de social como XXX-XX-XXXX
  const formatsocial = (value) => {
    const cleaned = value.replace(/\D/g, ""); // Eliminar caracteres no numéricos
    const match = cleaned.match(/^(\d{0,3})(\d{0,2})(\d{0,4})$/);

    if (!match) return value; // Retorna el valor original si no hay coincidencias

    return [match[1], match[2], match[3]].filter(Boolean).join("-");
  };

  // Función para formatear uscis como XXX-XXX-XXX
  const formatuscis = (value) => {
    const cleaned = value.replace(/\D/g, ""); // Eliminar caracteres no numéricos
    const match = cleaned.match(/^(\d{0,3})(\d{0,3})(\d{0,3})$/);

    if (!match) return value; // Retorna el valor original si no hay coincidencias

    return [match[1], match[2], match[3]].filter(Boolean).join("-");
  };

  const handleCountryCodeChange = (name, isoCode) => {
    setSelectedCode((prev) => ({
      ...prev,
      [name]: isoCode
    }));
  };
  const capitalizeWords = (str) => {
    return str
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const handleChange = (e) => {
    const { name, type, checked, value } = e.target;
   

    setFormData((prevData) => {
      let updatedValue = type === "checkbox" ? checked : value;
      const updatedData = { ...prevData };

      // Capitalizar si el campo es uno de los nombres
      if (["primer_nombre", "segundo_nombre", "apellidos"].includes(name)) {
        updatedValue = capitalizeWords(value);
      }
  
      updatedData[name] = updatedValue;
  
      // Aplicar formato de teléfono solo a los campos requeridos
      if (["telefono", "secundario", "whatsapp_num", "telefono_empleador"].includes(name)) {
        updatedData[name] = formatPhoneNumber(value);
      }
  
      // Aplicar formato de social
      if (["social"].includes(name)) {
        updatedData[name] = formatsocial(value);
      }
  
      // Aplicar formato de uscis
      if (["auscis"].includes(name)) {
        updatedData[name] = formatuscis(value);
      }
  
      // Calcular edad si cambia la fecha de nacimiento
      if (name === "fecha_nacimiento") {
        updatedData.edad = calcularEdad(value);
      }
  
      // Generar nombre completo dinámicamente
      updatedData.nombre_completo = [
        updatedData.primer_nombre,
        updatedData.segundo_nombre,
        updatedData.apellidos,
      ]
        .filter(Boolean)
        .join(" ");
  
      // Construir dirección de residencia
      updatedData.direccion = [
        updatedData.calle,
        updatedData.apto,
        updatedData.ciudad,
        updatedData.estado,
        updatedData.codigo_postal,
      ]
        .filter(Boolean)
        .join(" ");
  
      // Si el checkbox de "Copiar Dirección" se activa, copiar la dirección de residencia
      if (name === "copi_dir" && checked) {
        updatedData.dir_correspondencia = updatedData.direccion;
      }
  
      // Si cambia ingreso_por_periodo o periodo_ingreso, calcular ingreso anual
      if (name === 'ingreso_por_periodo' || name === 'periodo_ingreso') {
        const periodo = name === 'periodo_ingreso' ? value : updatedData.periodo_ingreso;
        const monto = name === 'ingreso_por_periodo' ? value : updatedData.ingreso_por_periodo;
        updatedData.ingreso_anual = calcularIngresoAnual(monto, periodo);
      }
  
      return updatedData;
    });
  };


  // Función para calcular ingreso anual automáticamente - fuera del método guardarCliente
const calcularIngresoAnual = (monto, periodo) => {
  let montoNumerico = parseFloat(monto) || 0;
  
  switch (periodo) {
    case 'HOUR':
      return (montoNumerico * 40 * 52).toFixed(2); // Asumiendo 40 horas por semana
    case 'WEEKLY P.TIME':
      return (montoNumerico * 52 * 0.5).toFixed(2); // Asumiendo medio tiempo
    case 'WEEKLY':
      return (montoNumerico * 52).toFixed(2);
    case 'BIWEEKLY':
      return (montoNumerico * 26).toFixed(2);
    case 'MONTHLY':
      return (montoNumerico * 12).toFixed(2);
    case 'ANNUAL':
      return montoNumerico.toFixed(2);
    default:
      return "0.00";
  }
};
  
  // Función para avanzar al siguiente paso


  const nextStep = () => {
   
    if (currentStep < totalSteps) {
      setShowModal(true);  // Mantén el modal abierto
      setCurrentStep(currentStep + 1);
    }
  };
  
  useEffect(() => {
  }, [showModal, isModal]);
  
  

  // Función para retroceder al paso anterior
  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Función para ir a un paso específico
  const goToStep = (step) => {
    if (step >= 1 && step <= totalSteps) {
      setCurrentStep(step);
    }
  };

 // Función para guardar cliente (ahora llamada en paso 5)
 const guardarCliente = async () => {
  setAlert({ type: "", message: "", visible: false });

  // Encuentra el código numérico del país según el ISO
  const getCountryCode = (iso) => {
    const country = countryCodes.find((c) => c.iso.toLowerCase() === iso.toLowerCase());
    if (!country) {
      console.warn(`❌ País no encontrado para iso: ${iso}`);
    }
    return country ? country.code.replace("+", "") : "";
  };

  // Crear una copia limpia del formData
  const formattedData = {
    ...formData,
    telefono: formData.telefono,
    secundario: formData.secundario,
    whatsapp_num: formData.whatsapp_num,
    telefono_empleador: formData.telefono_empleador,
    cod_tel_1: selectedCode.telefono,
    cod_tel_2: selectedCode.secundario,
    cod_tel_3: selectedCode.whatsapp_num,
  };

  let jsonFinal = {
    clientes: [formattedData],
  };

  console.log("📦 Datos preparados para enviar:", formattedData);

  try {
    const response = await apiRequest("cliente/create", "POST", jsonFinal);

    if (response?.message && response.message.includes("cliente creado exitosamente")) {
      const newId = response.clientes?.[0]?.id;

      if (newId) {
        setClienteId(newId);
        setClienteCreado(true);

        // 👉 Actualiza el log temporal con el cliente_id si logId está definido
        if (logId) {
          try {
            await apiRequest(`bitacora_operativa/${logId}/update`, "PUT", {
              cliente_id: newId,
            });
            console.log(`✅ Bitácora actualizada con cliente_id: ${newId}`);
          } catch (err) {
            console.warn("⚠️ No se pudo actualizar la bitácora con el cliente_id", err);
          }
        }

        if (onClienteCreado) {
          onClienteCreado(response.clientes[0]);
        }
      }

      setAlert({
        type: "success",
        message: "Cliente creado exitosamente. Puede continuar configurando los medios de pago.",
        visible: true,
      });

      setCurrentStep(6);

      if (currentStep === 6 && showModal) {
        setShowModal(true);
      }

    } else {
      setAlert({
        type: "danger",
        message: "Error al crear cliente: " + (response.message || "Error desconocido"),
        visible: true,
      });
    }

  } catch (err) {
    setAlert({
      type: "danger",
      message: "❌ Error al crear cliente: " + err.message,
      visible: true,
    });
  }
};

  // Función para reiniciar el formulario
  const reiniciarFormulario = () => {
    setFormData(INITIAL_FORM_STATE);
    setClienteId(null);
    setClienteCreado(false);
    setCurrentStep(1);
    setAlert({ type: "", message: "", visible: false });
  };

  // Componente para barra de progreso
  const ProgressBar = () => {
    return (
      <div className="wizard-progress mb-4">
        <div className="progress">
          <div
            className="progress-bar"
            role="progressbar"
            style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            aria-valuenow={(currentStep / totalSteps) * 100}
            aria-valuemin="0"
            aria-valuemax="100"
          >
            Paso {currentStep} de {totalSteps}
          </div>
        </div>
        <div className="d-flex justify-content-between mt-2">
          {pasos.map((paso) => (
            <div 
              key={paso.id} 
              className={`wizard-step ${currentStep === paso.id ? 'active' : ''} ${currentStep > paso.id ? 'completed' : ''}`}
              onClick={() => goToStep(paso.id)}
            >
              <div className="step-number">{paso.id}</div>
              <div className="step-title">{paso.titulo}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Renderizado condicional de los pasos del formulario
  const renderStep = () => {
    switch (currentStep) {
      
      case 1:
        return (
          <>
            <h4 className="mb-3">Datos Principales</h4>
            <hr />
            {/* Campos de Nombre */}
            <div className="row mt-3">
              <div className="col-md-3">
                <label>Primer Nombre</label>
                <input type="text" name="primer_nombre" className="form-control" value={formData.primer_nombre} onChange={handleChange} />
              </div>
              <div className="col-md-3">
                <label>Segundo Nombre</label>
                <input type="text" name="segundo_nombre" className="form-control" value={formData.segundo_nombre} onChange={handleChange} />
              </div>
              <div className="col-md-3">
                <label>Apellidos</label>
                <input type="text" name="apellidos" className="form-control" value={formData.apellidos} onChange={handleChange} />
              </div>
              <div className="col-md-3">
                <label>Nombre Completo</label>
                <input
                  type="text"
                  name="nombre_completo"
                  className="form-control"
                  value={formData.nombre_completo}
                  readOnly // Bloqueado para edición manual
                />
              </div>
            </div>

            {/* Fecha de Nacimiento y Edad */}
            <div className="row mt-3">
              <div className="col-md-4">
                <label>Fecha de Nacimiento</label>
                <input type="date" 
                name="fecha_nacimiento" 
                className="form-control" 
                value={formData.fecha_nacimiento} 
                onChange={handleChange}
                max="2099-12-31"
                min="1900-01-01" />
              </div>
              <div className="col-md-2">
                <label>Edad</label>
                <input type="number" 
                  name="edad" 
                  className="form-control" 
                  value={formData.edad}
                  onChange={handleChange} />
              </div>
              <div className="col-md-3">
                  <label>Idioma</label>
                  <select 
                    name="idioma"
                    className="form-select"
                    value={formData.idioma}
                    onChange={handleChange}
                  >
                    <option value="">Seleccione</option>
                    {idiomasList.map(idioma => (
                      <option key={idioma.code} value={idioma.name}>
                        {idioma.name}
                      </option>
                    ))}
                  </select>
                </div>
              {/* Género */}
              <div className="col-md-3">
                <label>Género</label>
                <select name="genero" className="form-select" value={formData.genero} onChange={handleChange}>
                  <option value="">Seleccione</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
            </div>
          </>
        );
      case 2:
        return (
          <>
            <h4 className="mb-3">Datos sobre Status Migratorio</h4>
            <hr />
            <div className="row mt-3">
              <div className="col-md-3">
                <label>Social</label>
                <input type="text" name="social" className="form-control" value={formData.social} onChange={handleChange} maxLength={11}/>
              </div>
              <div className="col-md-3">
                <label>Status</label>
                <select name="status" className="form-select" value={formData.status} onChange={handleChange}>
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
                </select>
              </div>
              <div className="col-md-3">
                <label>A/USCIS</label>
                <input type="text" name="auscis" className="form-control" value={formData.auscis} onChange={handleChange} maxLength={11}/>
              </div>
              <div className="col-md-3">
                <label>Tarjeta #</label>
                <input type="text" name="tarjeta_numero" className="form-control" value={formData.tarjeta_numero} onChange={handleChange} />
              </div>
              <div className="col-md-6">
                <label>Categoria</label>
                <input type="text" name="categoria" className="form-control" value={formData.categoria} onChange={handleChange} />
              </div>
              <div className="col-md-3">
                <label>Fecha Emision</label>
                <input type="date" name="fecha_emision" className="form-control" value={formData.fecha_emision} onChange={handleChange}
                max="2099-12-31"
                min="1900-01-01"/>
              </div>
              <div className="col-md-3">
                <label>Fecha Expiración</label>
                <input type="date" name="fecha_expiracion" className="form-control" value={formData.fecha_expiracion} onChange={handleChange}
                max="2099-12-31"
                min="1900-01-01"/>
              </div>
            </div>
          </>
        );
      case 3:
        return (
          <>
            <h4 className="mb-3">Datos de Contacto</h4>
            <hr />
            <div className="row mt-3">
                <div className="col-md-4">
                          <label>Teléfono</label>
                          <div className="input-group">
                            <span className="input-group-text p-0">
                              <CountrySelectWithFlags name="telefono" selectedCode={selectedCode.telefono} onChange={handleCountryCodeChange} />
                            </span>
                            <input
                              type="text"
                              name="telefono"
                              className="form-control"
                              value={formData.telefono}
                              onChange={handleChange}
                              
                            />
                          </div>
                        </div>
                  
             
              
              <div className="col-md-4">
                <label>Tel. Secundario</label>
                <div className="input-group">
                            <span className="input-group-text p-0">
                              <CountrySelectWithFlags name="secundario" selectedCode={selectedCode.secundario} onChange={handleCountryCodeChange} />
                            </span>
                <input type="text" name="secundario" className="form-control" value={formData.secundario} onChange={handleChange}  />
              </div>
          </div>
              <div className="col-md-4">
                <label>Whatsapp</label>
                <div className="input-group">
                            <span className="input-group-text p-0">
                              <CountrySelectWithFlags name="whatsapp_num" selectedCode={selectedCode.whatsapp_num} onChange={handleCountryCodeChange} />
                            </span>
                <input type="text" name="whatsapp_num" className="form-control" value={formData.whatsapp_num} onChange={handleChange} />
              </div>
              </div>
              
            </div>

            <div className="row mb-3">
            <div className="col-md-6">
            <label>Nota</label>
                  <div className="form-group">
                    <textarea
                      className="form-control"
                      value={formData.nota}
                      id="exampleFormControlTextarea1"
                      rows="3"
                      name="nota"
                      onChange={handleChange}
                    ></textarea>
                  </div>
              </div>

              </div>  
            <h5 className="mt-4">Servicios de Mensajería</h5>
            <hr />
            <div className="row mb-3">
              <div className="col-6">
                <div className="d-flex flex-row flex-wrap align-items-center gap-3">
                  <div className="form-check">
                    <input className="form-check-input" type="checkbox" name="whatsapp" checked={formData.whatsapp} onChange={handleChange} />
                    <label className="form-check-label">WhatsApp</label>
                  </div>
                  <div className="form-check">
                    <input className="form-check-input" type="checkbox" name="telegram" checked={formData.telegram} onChange={handleChange} />
                    <label className="form-check-label">Telegram</label>
                  </div>
                  <div className="form-check">
                    <input className="form-check-input" type="checkbox" name="texto_sms" checked={formData.texto_sms} onChange={handleChange} />
                    <label className="form-check-label">Texto SMS</label>
                  </div>
                </div>
            </div>
        </div>
            <div className="col-md-6">
                <label>Email</label>
                <input type="email" name="email" className="form-control" value={formData.email} onChange={handleChange} />
              </div>
          </>
        );
        case 4:
          return (
            <>
              <h4 className="mb-3">Dirección</h4>
              <hr />
              
              <FormDireccion
                formData={{
                  calle: formData.calle,
                  apto: formData.apto,
                  ciudad: formData.ciudad,
                  estado: formData.estado,
                  codigo_postal: formData.codigo_postal,
                  condado: formData.condado,
                  dir_correspondencia: formData.dir_correspondencia,
                  copi_dir: formData.copi_dir
                }}
                onChange={(name, value, direccionCompleta) => {
                  // Crear un evento sintético para reutilizar handleChange
                  const syntheticEvent = {
                    target: {
                      name: name,
                      value: value,
                      type: name === "copi_dir" ? "checkbox" : "text",
                      checked: value
                    }
                  };
                  
                  // Usar la función handleChange existente
                  handleChange(syntheticEvent);
                  
                  // Si hay dirección concatenada y no es para dir_correspondencia o copi_dir,
                  // actualizar explícitamente el campo direccion
                  if (direccionCompleta && name !== "dir_correspondencia" && name !== "copi_dir") {
                    setFormData(prev => ({
                      ...prev,
                      direccion: direccionCompleta
                    }));
                  }
                }}
                editable={true}
              />
            </>
          );

        case 5:
  return (
    <>
      <h4 className="mb-3">Datos de Empleo e Ingreso</h4>
      <hr />
      
      <div className="row mt-3">
        <div className="col-md-4">
          
                <label>Tipo de Ingreso</label>
                <select name="tipo_ingreso" className="form-select" value={formData.tipo_ingreso} onChange={handleChange}>
                  <option value="">Seleccione</option>
                  <option value="W2">W2</option>
                  <option value="1099">1099</option>
                  <option value="SOCIAL SECURITY">SOCIAL SECURITY</option>
                  <option value="SELF EMPLOYMENT">SELF EMPLOYMENT</option>
                  <option value="SUPPORT">SUPPORT</option>
                  <option value="ALIMONY">ALIMONY</option>
                </select>
              </div>
 
        
        <div className="col-md-4">
          <label>Actividad Económica</label>
          <input
            type="text"
            name="actividad_economica"
            className="form-control"
            value={formData.actividad_economica}
            onChange={handleChange}
            placeholder="Ej: Comercio, Servicios, etc."
          />
        </div>
        
        <div className="col-md-4">
          <label>Empleador</label>
          <input
            type="text"
            name="empleador"
            className="form-control"
            value={formData.empleador}
            onChange={handleChange}
            placeholder="Nombre de la empresa"
          />
        </div>
      </div>
      <div className="row mt-3">
          <div className="col-md-4">
                    <label>Teléfono del Empleador</label>
                    <div className="input-group">
                                <span className="input-group-text p-0">
                                  <CountrySelectWithFlags name="telefono_empleador" selectedCode={selectedCode.telefono_empleador} onChange={handleCountryCodeChange} />
                                </span>
                    <input type="text" name="telefono_empleador" className="form-control" value={formData.telefono_empleador} onChange={handleChange}  />
                  </div>
              </div>

        <div className="col-md-2">
          <label>Período de Ingreso</label>
          <select
            name="periodo_ingreso"
            className="form-select"
            value={formData.periodo_ingreso}
            onChange={handleChange}
          >
            <option value="HOUR">HOUR</option>
            <option value="WEEKLY P.TIME">WEEKLY P.TIME</option>
            <option value="WEEKLY">WEEKLY</option>
            <option value="BIWEEKLY">BIWEEKLY</option>
            <option value="MONTHLY">MONTHLY</option>
            <option value="ANNUAL">ANNUAL</option>
          </select>
        </div>
        
        <div className="col-md-3">
  <label>Ingreso por Período ($)</label>
  <div className="input-group">
    <span className="input-group-text">$</span>
    <NumericFormat
          name="ingreso_por_periodo"
          className="form-control"
          value={formData.ingreso_por_periodo}
          thousandSeparator=","
          decimalSeparator="."
          prefix="$"
          decimalScale={2}
          fixedDecimalScale
          allowNegative={false}
          onValueChange={(values) => {
                  const { value } = values; // este es el valor sin formato ($, comas)
                  handleChange({
                    target: {
                      name: "ingreso_por_periodo",
                      value: value
                    }
                  });
                }}
              />



  </div>
</div>
        
<div className="col-md-3">
  <label>Ingreso Anual ($)</label>
  <div className="input-group">
    <span className="input-group-text">$</span>
    <input
      type="text"
      name="ingreso_anual"
      className="form-control bg-light"
      value={formData.ingreso_anual
        ? parseFloat(formData.ingreso_anual).toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2
          })
        : "$0.00"}
      readOnly
    />
  </div>
</div>

        <div className="row mt-3">
          <hr />
          <h4 className="mb-3">Ingreso Ocasional</h4>
          <div className="col-md-6">
                  <label>Nota</label>
                  <div className="form-group">
                    <textarea
                      className="form-control"
                      value={formData.nota_ocasional}
                      id="exampleFormControlTextarea1"
                      rows="3"
                      name="nota_ocasional"
                      onChange={handleChange}
                    ></textarea>
                  </div>
                </div>


              <div className="col-md-3">
          <label>Período de Ingreso Ocacional</label>
          <select
            name="periodo_ingreso_ocasional"
            className="form-select"
            value={formData.periodo_ingreso_ocasional}
            onChange={handleChange}
          >
            <option value="HOUR">HOUR</option>
            <option value="WEEKLY P.TIME">WEEKLY P.TIME</option>
            <option value="WEEKLY">WEEKLY</option>
            <option value="BIWEEKLY">BIWEEKLY</option>
            <option value="MONTHLY">MONTHLY</option>
            <option value="ANNUAL">ANNUAL</option>
          </select>
        </div>  


        <div className="col-md-3">
            <label>Ingreso por Período ocacional ($)</label>
            <div className="input-group">
              <span className="input-group-text">$</span>
              <NumericFormat
                      name="ingreso_por_periodo_ocasional"
                      className="form-control"
                      value={formData.ingreso_por_periodo_ocasional}
                      thousandSeparator=","
                      decimalSeparator="."
                      prefix="$"
                      decimalScale={2}
                      fixedDecimalScale
                      allowNegative={false}
                      onValueChange={(values) => {
                        const { value } = values;
                        handleChange({
                          target: {
                            name: "ingreso_por_periodo_ocasional",
                            value: value
                          }
                        });
                      }}
                    />

            </div>
          </div>

        </div>
      </div>
    </>
  );
      case 6:
        return (
          <>
            <h4 className="mb-3">Medios de Pago</h4>
            <hr />
            {clienteCreado ? (
              <MediosPago 
                key={clienteId} // Esto forzará el re-render cuando `clienteId` cambie
                clienteId={clienteId} 
                grupoFamiliarId={null} 
                onSave={() => {
                  setAlert({
                    type: "success", 
                    message: "Medio de pago guardado exitosamente", 
                    visible: true
                  });
                  setTimeout(() => {
                    setAlert({ type: "", message: "", visible: false });
                  }, 3000);
                }} 
              />
            ) : (
              <div className="text-center py-4">
                <p>Antes de agregar medios de pago, debemos guardar los datos del cliente.</p>
                <button 
                  className="btn btn-primary" 
                  onClick={guardarCliente}
                >
                  Guardar datos del cliente
                </button>
              </div>
            )}
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="content mt-4 label-custom">
      {/* Barra de progreso */}
      <ProgressBar />
      
      {/* Contenido del paso actual */}
      <div className="wizard-content">
        {renderStep()}
      </div>
  
      {/* Alertas */}
      {alert.visible && (
        <div className="d-flex justify-content-center mt-4">
          <div className={`alert alert-${alert.type} d-flex align-items-center w-75 shadow-sm`}
               role="alert"
               style={{ borderRadius: "8px", fontSize: "16px", textAlign: "center" }}>
            <span className="me-2">{alert.type === "success" ? "✅" : "⚠️"}</span>
            <span>{alert.message}</span>
          </div>
        </div>
      )}
  
     {/* Controles de navegación */}
        <div className="wizard-controls d-flex justify-content-between mt-4">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={prevStep}
            disabled={currentStep === 1}
          >
            Anterior
          </button>
          
          {currentStep < 5 ? (
  <button
    type="button"
    className="btn btn-primary"
    onClick={nextStep}
  >
    Siguiente
  </button>
) : currentStep === 5 ? (
  <button
    type="button"
    className="btn btn-success"
    onClick={async () => {
      try {
        const tempLog = await apiRequest("bitacora_operativa/log_temp", "POST", {
          action_type: "create",
          entity_type: "cliente",
          note: "(registro temporal)", // ✅ evitar que note sea null
          
        });
        setLogId(tempLog.id);

        if (tempLog && tempLog.id) {
          setLogId(tempLog.id);
          setBitacoraData({
            accion: "create",
            note: "note",
            entity_type: "cliente",
            logId: tempLog.id,
            cliente_id: clienteId
          });
          setShowBitacora(true);
        } else {
          setAlert({ type: "danger", message: "No se pudo iniciar bitácora.", visible: true });
        }
      } catch (err) {
        console.error("Error iniciando bitácora temporal:", err);
        setAlert({ type: "danger", message: "Error al preparar la bitácora.", visible: true });
      }
    }}
  >
    Guardar Cliente y Continuar
  </button>
) : (
  <button
    type="button"
    className="btn btn-success"
    onClick={reiniciarFormulario}
  >
    Finalizar y Crear Nuevo Cliente
  </button>
)}

        </div>
        {showBitacora && logId && (
  <BitacoraModal
    show={showBitacora}
    onHide={(wasSaved) => {
      setShowBitacora(false);
      if (wasSaved) {
        guardarCliente();
      } else {
        apiRequest(`bitacora_operativa/delete-ultima`, "DELETE");
      }
    }}
    data={bitacoraData}
    logId={logId}
  />
)}

    </div>
  );
};

export default Clientes;