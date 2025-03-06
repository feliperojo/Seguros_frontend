import React, { useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "../styles/ClienteForm.css";
import apiRequest from "../services/api";

const Clientes = () => {
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
  };

  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [alert, setAlert] = useState({ type: "", message: "", visible: false });

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

  // 📌 Función para formatear números de teléfono como XXX-XXX-XXXX
  const formatPhoneNumber = (value) => {
    const cleaned = value.replace(/\D/g, ""); // Eliminar caracteres no numéricos
    const match = cleaned.match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/);

    if (!match) return value; // Retorna el valor original si no hay coincidencias

    return [match[1], match[2], match[3]].filter(Boolean).join("-");
  };

  // 📌 Función para formatear números de social como XXX-XX-XXXX
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
  

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAlert({ type: "", message: "", visible: false });
    // 🔹 Crear una copia limpia del formData sin los guiones en los números de teléfono
  const formattedData = {
    ...formData,
    telefono: formData.telefono.replace(/\D/g, ""),  // Eliminar guiones
    secundario: formData.secundario.replace(/\D/g, ""),  // Eliminar guiones
    whatsapp_num: formData.whatsapp_num.replace(/\D/g, ""),  // Eliminar guiones
  };

    try {
      const response = await apiRequest("cliente/create", "POST", formData);

      if (response?.message && response.message.toLowerCase().includes("cliente creado exitosamente")) {
        console.log("✅ Cliente fue creado con éxito:", response.message);

        // Reset form to initial state
        setFormData(INITIAL_FORM_STATE);

        // Show success alert
        setAlert({
          type: "success", 
          message: "Cliente creado exitosamente", 
          visible: true
        });

        // Hide alert after 3 seconds
        setTimeout(() => {
          setAlert({ type: "", message: "", visible: false });
        }, 10000);

      } else {
        console.error("❌ Error al crear cliente:", response.message || "Mensaje no disponible");
      }
    } catch (err) {
      console.error("⚠️ Error en la API al intentar crear el cliente:", err.message);
    }
  };



  
  
  return (
    <div className="container mt-4 label-custom">

    <h2 className="text-center mb-4">Registro de Cliente</h2>
    

    <form onSubmit={handleSubmit} className="p-4 shadow bg-white rounded">
      
      {/* Nombre Completo Bloqueado */}
      <h4 className="mb-3 ">Datos Principales</h4>
      <hr />
      <div className="row">
        <div className="col-md-10">
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

      {/* Campos de Nombre */}
      <div className="row mt-3">
        <div className="col-md-4">
          <label>Primer Nombre</label>
          <input type="text" name="primer_nombre" className="form-control" value={formData.primer_nombre} onChange={handleChange} />
        </div>
        <div className="col-md-4">
          <label>Segundo Nombre</label>
          <input type="text" name="segundo_nombre" className="form-control" value={formData.segundo_nombre} onChange={handleChange} />
        </div>
        <div className="col-md-4">
          <label>Apellidos</label>
          <input type="text" name="apellidos" className="form-control" value={formData.apellidos} onChange={handleChange} />
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
      </div>

      {/* Género */}
      <div className="row mt-3">
        <div className="col-md-4">
          <label>Género</label>
          <select name="genero" className="form-select" value={formData.genero} onChange={handleChange}>
            <option value="">Seleccione</option>
            <option value="Masculino">Masculino</option>
            <option value="Femenino">Femenino</option>
          </select>
        </div>
      </div>

      <h4 className="mt-4">Datos sobre Status Migratorio</h4>
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

      <h4 className="mt-4">Datos de Contacto</h4>
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

      <h4 className="mt-4">Servicios de Mensajería</h4>
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

      <h4 className="mt-4">Dirección</h4>
      <hr />
      <div className="row mt-3">
        <div className="col-md-10">
          <label>Dirección de Residencia</label>
          <input type="text"
           name="direccion" 
           className="form-control"
           value={formData.direccion}
            readOnly // Bloqueado para edición manual
            onChange={handleChange} />
        </div>
        <div className="col-md-4">
          <label>Calle</label>
          <input type="text" name="calle" className="form-control" value={formData.calle} onChange={handleChange} />
        </div>
        <div className="col-md-4">
          <label>APT</label>
          <input type="text" name="apto" className="form-control" value={formData.apto} onChange={handleChange} />
        </div>
        <div className="col-md-4">
          <label>Ciudad</label>
          <input type="text" name="ciudad" className="form-control" value={formData.ciudad} onChange={handleChange} />
        </div>
      
        <div className="col-md-4">
          <label>Estado</label>
          <input type="text" name="estado" className="form-control" value={formData.estado} onChange={handleChange} />
        </div>
        <div className="col-md-4">
          <label>Código Postal</label>
          <input type="text" name="codigo_postal" className="form-control" value={formData.codigo_postal} onChange={handleChange} />
        </div>
        <div className="col-md-4">
          <label>Condado</label>
          <input type="text" name="condado" className="form-control" value={formData.condado} onChange={handleChange} />
        </div>
        <div className="col-md-10">
          <label>Dirección de Correspondencia</label>
          <input type="text" name="dir_correspondencia" className="form-control" value={formData.dir_correspondencia} onChange={handleChange} />
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

        {/* <h4 className="mt-4">Datos de Empleo e Ingreso</h4>
        <hr />
      <div className="row">
          <div className="col-md-4">
            <label>Tipo de Ingreso</label>
            <input type="text" name="telefono" className="form-control" onChange={handleChange} />
          </div>
          <div className="col-md-4">
            <label>Empleador o Actividad</label>
            <input type="text" name="secundario" className="form-control" onChange={handleChange} />
          </div>
          <div className="col-md-4">
            <label>Tel Empleador</label>
            <input type="text" name="whtasapp_num" className="form-control" onChange={handleChange} />
          </div>
          <div className="col-md-3">
            <label>Periodo de Ingreso</label>
            <input type="email" name="email" className="form-control" onChange={handleChange} />
          </div>
          <div className="col-md-3">
            <label>Vr. del Ingreso por Periodo</label>
            <input type="email" name="email" className="form-control" onChange={handleChange} />
          </div>
          <div className="col-md-3">
            <label>Vr. Ingreso Anual</label>
            <input type="email" name="email" className="form-control" onChange={handleChange} />
          </div>
          <div className="col-md-3">
            <label>Prueba para MS</label>
            <input type="email" name="email" className="form-control" onChange={handleChange} />
          </div>
          <div className="col-md-4">
            <label>Periodo de Ingreso</label>
            <input type="email" name="email" className="form-control" onChange={handleChange} />
          </div>
          <div className="col-md-4">
            <label>Vr. del Ingreso por Periodo</label>
            <input type="email" name="email" className="form-control" onChange={handleChange} />
          </div>
          <div className="col-md-4">
            <label>Vr. Ingreso Anual</label>
            <input type="email" name="email" className="form-control" onChange={handleChange} />
          </div>

          <h4 className="mt-4">Ingreso por Horas Irregulares</h4>
          <hr />
     
          <div className="col-md-3">
            <label>Periodo de Ingreso</label>
            <input type="text" name="telefono" className="form-control" onChange={handleChange} />
          </div>
          <div className="col-md-3">
            <label>Cantidad de Horas</label>
            <input type="text" name="secundario" className="form-control" onChange={handleChange} />
          </div>
          <div className="col-md-3">
            <label>Valor Por Horas</label>
            <input type="text" name="whtasapp_num" className="form-control" onChange={handleChange} />
          </div>
          <div className="col-md-3">
            <label>Ingreso Anual</label>
            <input type="text" name="email" className="form-control" onChange={handleChange} />
          </div>
          <div className="col-md-3">
            <label>Ingreso Total</label>
            <input type="text" name="email" className="form-control" onChange={handleChange} />
          </div>
          <h4 className="mt-4">Detalles</h4>
          <div className="col-md-12">
            <label>Nota:</label>
            <input type="text" name="email" className="form-control" onChange={handleChange} />
          </div>
          </div>*/}
    {/* ✅ Agregar margen superior a la alerta para más espacio */}
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

          
      <div className="mt-4">
        <button type="submit" className="btn btn-primary">Guardar Cliente</button>
      </div>
      </div> 
      
    </form>
    

 

  </div>
);
};

export default Clientes;
