import React, { useState, useEffect } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "../styles/ClienteForm.css";
import apiRequest from "../services/api";
import MediosPago from "../components/MediosPago";

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
    secundario: "",
    whatsapp_num: "",
    direccion: "",
    dir_correspondencia: "",
    copi_dir: false, // Añadido para el checkbox "Copiar Dirección"
  };

  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [alert, setAlert] = useState({ type: "", message: "", visible: false });
  const [showBankDetails, setShowBankDetails] = useState(false);
  const [showCardDetails, setShowCardDetails] = useState(false);
  const [clienteId, setClienteId] = useState(null);
  const [clienteCreado, setClienteCreado] = useState(false);

  // Estado para controlar el paso actual del formulario
  const [currentStep, setCurrentStep] = useState(1);
  // Total de pasos en el formulario
  const totalSteps = 5;

  const pasos = [
    { id: 1, titulo: "Datos Principales" },
    { id: 2, titulo: "Datos sobre Status Migratorio" },
    { id: 3, titulo: "Datos de Contacto" },
    { id: 4, titulo: "Dirección" },
    { id: 5, titulo: "Medios de Pago" }
  ];

  const handlePaymentToggle = (type) => {
    if (type === "bank") {
      setShowBankDetails(!showBankDetails);
    } else if (type === "card") {
      setShowCardDetails(!showCardDetails);
    }
  };

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

  const handleChange = (e) => {
    const { name, type, checked, value } = e.target;
  
    setFormData((prevData) => {
      let updatedValue = type === "checkbox" ? checked : value;
  
      // Aplicar formato de teléfono solo a los campos requeridos
      if (["telefono", "secundario", "whatsapp_num"].includes(name)) {
        updatedValue = formatPhoneNumber(value);
      }
  
      // Aplicar formato de social
      if (["social"].includes(name)) {
        updatedValue = formatsocial(value);
      }
  
      const updatedData = { ...prevData, [name]: updatedValue };
  
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
  
      return updatedData;
    });
  };
  
  // Función para avanzar al siguiente paso
  const nextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

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

  // Función para guardar cliente (llamada en paso 4)
  const guardarCliente = async () => {
    setAlert({ type: "", message: "", visible: false });
    
    // Crear una copia limpia del formData sin los guiones en los números de teléfono
    const formattedData = {
      ...formData,
      telefono: formData.telefono.replace(/\D/g, ""),  // Eliminar guiones
      secundario: formData.secundario.replace(/\D/g, ""),  // Eliminar guiones
      whatsapp_num: formData.whatsapp_num.replace(/\D/g, ""),  // Eliminar guiones
    };

    // Crear el JSON con la estructura deseada
    let jsonFinal = {
      "clientes": [formData] // Insertar el JSON dentro de un array
    };
    console.log("formato antes de enviar ", jsonFinal);

    try {
      const response = await apiRequest("cliente/create", "POST", jsonFinal);

      if (response?.message && response.message.includes("cliente creado exitosamente")) {
        console.log("✅ Cliente fue creado con éxito:", response.message);
        
        // Guardamos el ID del cliente
        if (response.clientes && response.clientes[0] && response.clientes[0].id) {
          setClienteId(response.clientes[0].id);
          setClienteCreado(true);
          
          // Notificamos a `Grupofamiliar.js` enviándole el nuevo cliente
          if (onClienteCreado) {
            console.log("entramos a onclientes", response.clientes[0].id);
            onClienteCreado(response.clientes[0]);
            
            // Si estamos en un modal, no avanzamos al paso 5 automáticamente
            if (isModal) {
              return; // Salimos de la función sin avanzar al paso 5
            }
          }
        }

        // Show success alert
        setAlert({
          type: "success", 
          message: "Cliente creado exitosamente. Puede continuar configurando los medios de pago.", 
          visible: true
        });

        // Avanzar al paso 5 automáticamente solo si no estamos en un modal
        if (!isModal) {
          setCurrentStep(5);
        }

      } else {
        console.error("❌ Error al crear cliente:", response.message || "Mensaje no disponible");
        setAlert({
          type: "danger", 
          message: "Error al crear cliente: " + (response.message || "Error desconocido"), 
          visible: true
        });
      }
    } catch (err) {
      console.error("⚠️ Error en la API al intentar crear el cliente:", err.message);
      setAlert({
        type: "danger", 
        message: "❌ Error al crear cliente: " + err.message, 
        visible: true
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
              <div className="col-md-6">
                <label>Fecha de Nacimiento</label>
                <input type="date" name="fecha_nacimiento" className="form-control" value={formData.fecha_nacimiento} onChange={handleChange} />
              </div>
              <div className="col-md-2">
                <label>Edad</label>
                <input type="number" 
                  name="edad" 
                  className="form-control" 
                  value={formData.edad}
                  onChange={handleChange} />
              </div>
              {/* Género */}
              <div className="col-md-4">
                <label>Género</label>
                <select name="genero" className="form-select" value={formData.genero} onChange={handleChange}>
                  <option value="">Seleccione</option>
                  <option value="Masculino">Masculino</option>
                  <option value="Femenino">Femenino</option>
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
                <input type="text" name="social" className="form-control" value={formData.social} onChange={handleChange} />
              </div>
              <div className="col-md-3">
                <label>Status</label>
                <input type="text" name="status" className="form-control" value={formData.status} onChange={handleChange} />
              </div>
              <div className="col-md-3">
                <label>A/USCIS</label>
                <input type="text" name="auscis" className="form-control" value={formData.auscis} onChange={handleChange} />
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
                <input type="date" name="fecha_emision" className="form-control" value={formData.fecha_emision} onChange={handleChange}/>
              </div>
              <div className="col-md-3">
                <label>Fecha Expedicion</label>
                <input type="date" name="fecha_expiracion" className="form-control" value={formData.fecha_expiracion} onChange={handleChange} />
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
              <div className="col-md-6">
                <label>Teléfono</label>
                <input type="text" name="telefono" className="form-control" value={formData.telefono} onChange={handleChange} />
              </div>
              <div className="col-md-6">
                <label>Tel. Secundario</label>
                <input type="text" name="secundario" className="form-control" value={formData.secundario} onChange={handleChange} />
              </div>
              <div className="col-md-6">
                <label>Whatsapp</label>
                <input type="text" name="whatsapp_num" className="form-control" value={formData.whatsapp_num} onChange={handleChange} />
              </div>
              <div className="col-md-6">
                <label>Email</label>
                <input type="email" name="email" className="form-control" value={formData.email} onChange={handleChange} />
              </div>
            </div>

            <h5 className="mt-4">Servicios de Mensajería</h5>
            <hr />
            <div className="form-group checkbox-group">
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
          </>
        );
      case 4:
        return (
          <>
            <h4 className="mb-3">Dirección</h4>
            <hr />
            <div className="row mt-3">
              <div className="col-md-10">
                <label>Dirección de Residencia</label>
                <input type="text"
                  name="direccion" 
                  className="form-control"
                  value={formData.direccion}
                  readOnly // Bloqueado para edición manual
                  onChange={handleChange} 
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault(); // Prevenir el envío cuando se presiona Enter
                      nextStep(); // Opcional: avanzar al siguiente paso
                    }
                  }}
                  
                  />
              </div>
              <div className="col-md-4">
                <label>Calle</label>
                <input type="text" name="calle" className="form-control" value={formData.calle} onChange={handleChange} 
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault(); // Prevenir el envío cuando se presiona Enter
                    nextStep(); // Opcional: avanzar al siguiente paso
                  }
                }}
                />
              </div>
              <div className="col-md-4">
                <label>APT</label>
                <input type="text" name="apto" className="form-control" value={formData.apto} onChange={handleChange} 
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault(); // Prevenir el envío cuando se presiona Enter
                    nextStep(); // Opcional: avanzar al siguiente paso
                  }
                }}
                />
              </div>
              <div className="col-md-4">
                <label>Ciudad</label>
                <input type="text" name="ciudad" className="form-control" value={formData.ciudad} onChange={handleChange} 
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault(); // Prevenir el envío cuando se presiona Enter
                    nextStep(); // Opcional: avanzar al siguiente paso
                  }
                }}
                />
              </div>
              <div className="col-md-4">
                <label>Estado</label>
                <input type="text" name="estado" className="form-control" value={formData.estado} onChange={handleChange} 
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault(); // Prevenir el envío cuando se presiona Enter
                    nextStep(); // Opcional: avanzar al siguiente paso
                  }
                }}
                />
              </div>
              <div className="col-md-4">
                <label>Código Postal</label>
                <input type="text" name="codigo_postal" className="form-control" value={formData.codigo_postal} onChange={handleChange} 
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault(); // Prevenir el envío cuando se presiona Enter
                    nextStep(); // Opcional: avanzar al siguiente paso
                  }
                }}
                />
              </div>
              <div className="col-md-4">
                <label>Condado</label>
                <input type="text" name="condado" className="form-control" value={formData.condado} onChange={handleChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault(); // Prevenir el envío cuando se presiona Enter
                    nextStep(); // Opcional: avanzar al siguiente paso
                  }
                }}
                />
              </div>
              <div className="col-md-10">
                <label>Dirección de Correspondencia</label>
                <input type="text" name="dir_correspondencia" className="form-control" value={formData.dir_correspondencia} onChange={handleChange} 
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault(); // Prevenir el envío cuando se presiona Enter
                    nextStep(); // Opcional: avanzar al siguiente paso
                  }
                }}
                />
              </div>
              <div className="form-check mt-3">
                <input
                  className="form-check-input"
                  type="checkbox"
                  name="copi_dir"
                  checked={formData.copi_dir}
                  onChange={handleChange}
                />
                <label className="form-check-label ms-2">Copiar Dirección</label>
              </div>
            </div>
          </>
        );
      case 5:
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
                  console.log("Medio de pago guardado");
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
        
        {currentStep < 4 ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={nextStep}
          >
            Siguiente
          </button>
        ) : currentStep === 4 ? (
          <button
            type="button"
            className="btn btn-success"
            onClick={guardarCliente}
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
    </div>
  );
};

export default Clientes;