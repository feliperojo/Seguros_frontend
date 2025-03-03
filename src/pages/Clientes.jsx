import React, { useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css"; // Importar Bootstrap
import "../styles/ClienteForm.css"; // Archivo CSS adicional si es necesario
import { ToastContainer, toast } from "react-toastify"; // Importar Toastify
import "react-toastify/dist/ReactToastify.css"; // Importar estilos de Toastify
import apiRequest from "../services/api"; // Importa el servicio de API

const Clientes = () => {
  const [formData, setFormData] = useState({
    nombre_completo: "",
    primer_nombre: "",
    segundo_nombre: "",
    apellidos: "",
    fecha_nacimiento: "",
    edad: "",
    genero: "",
    cobertura: "",
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
  });

  const [error, setError] = useState(null);

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

  const handleChange = (e) => {
    const { name, type, checked, value } = e.target;
    const newFormData = { ...formData, [name]: type === "checkbox" ? checked : value };

    if (name === "fecha_nacimiento") {
      newFormData.edad = calcularEdad(value);
    }

    newFormData.nombre_completo = [
      newFormData.primer_nombre,
      newFormData.segundo_nombre,
      newFormData.apellidos,
    ].filter(Boolean).join(" ");

    newFormData.direccion = [
      newFormData.calle,
      newFormData.apto,
      newFormData.ciudad,
      newFormData.estado,
      newFormData.codigo_postal,
    ].filter(Boolean).join(", ");

    setFormData(newFormData);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const formattedData = {
      ...formData,
      edad: Number(formData.edad),
      cobertura: Boolean(formData.cobertura),
      whatsapp: Boolean(formData.whatsapp),
      telegram: Boolean(formData.telegram),
      texto_sms: Boolean(formData.texto_sms),
    };

    console.log("📌 Datos a enviar:", formattedData);

    const token = localStorage.getItem("auth_token"); // Obtener el token del localStorage

    if (!token) {
      setError("No tienes autorización. Inicia sesión nuevamente.");
      return;
    }

    try {
      const response = await apiRequest("cliente/create", "POST", formattedData, token);

      if (response && response.success) {
        toast.success("✅ Cliente registrado exitosamente", {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });

        setFormData({
          nombre_completo: "",
          primer_nombre: "",
          segundo_nombre: "",
          apellidos: "",
          fecha_nacimiento: "",
          edad: "",
          genero: "",
          cobertura: "",
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
        });
      } else {
        throw new Error(response.message || "Error al registrar el cliente");
      }
    } catch (err) {
      console.error("❌ Error en la petición:", err.message);
      toast.error(`❌ Error: ${err.message}`, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    }
  };

  return (
    <div className="container mt-4">
    <h2 className="text-center mb-4">Formulario de Registro de Cliente</h2>
    <form onSubmit={handleSubmit} className="p-4 shadow bg-white rounded">
      
      {/* Nombre Completo Bloqueado */}
      <h4 className="mb-3">Datos Principales</h4>
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
          <input type="text" name="primer_nombre" className="form-control" onChange={handleChange} />
        </div>
        <div className="col-md-4">
          <label>Segundo Nombre</label>
          <input type="text" name="segundo_nombre" className="form-control" onChange={handleChange} />
        </div>
        <div className="col-md-4">
          <label>Apellidos</label>
          <input type="text" name="apellidos" className="form-control" onChange={handleChange} />
        </div>
      </div>

      {/* Fecha de Nacimiento y Edad */}
      <div className="row mt-3">
        <div className="col-md-6">
          <label>Fecha de Nacimiento</label>
          <input type="date" name="fecha_nacimiento" className="form-control" onChange={handleChange} />
        </div>
        <div className="col-md-2">
          <label>Edad</label>
          <input type="number" name="edad" className="form-control" onChange={handleChange} />
        </div>
      </div>

      {/* Género */}
      <div className="row mt-3">
        <div className="col-md-4">
          <label>Género</label>
          <select name="genero" className="form-select" onChange={handleChange}>
            <option value="">Seleccione</option>
            <option value="Masculino">Masculino</option>
            <option value="Femenino">Femenino</option>
          </select>
        </div>
      </div>

      <h4 className="mt-4">Datos de Contacto</h4>
      <div className="row">
          <div className="col-md-6">
            <label>Teléfono</label>
            <input type="text" name="telefono" className="form-control" onChange={handleChange} />
          </div>
          <div className="col-md-6">
            <label>Secundario</label>
            <input type="text" name="secundario" className="form-control" onChange={handleChange} />
          </div>
          <div className="col-md-6">
            <label>Whatsapp</label>
            <input type="text" name="whtasapp_num" className="form-control" onChange={handleChange} />
          </div>
          <div className="col-md-6">
            <label>Email</label>
            <input type="email" name="email" className="form-control" onChange={handleChange} />
          </div>
        

      </div>

      <h4 className="mt-4">Servicios de Mensajería</h4>
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
      <div className="row">
        <div className="col-md-10">
          <label>Dirección de Residencia</label>
          <input type="text" name="direccion" className="form-control" onChange={handleChange} />
        </div>
        <div className="col-md-4">
          <label>Calle</label>
          <input type="text" name="calle" className="form-control" onChange={handleChange} />
        </div>
        <div className="col-md-4">
          <label>APT</label>
          <input type="text" name="apto" className="form-control" onChange={handleChange} />
        </div>
        <div className="col-md-4">
          <label>Ciudad</label>
          <input type="text" name="ciudad" className="form-control" onChange={handleChange} />
        </div>
      
        <div className="col-md-4">
          <label>Estado</label>
          <input type="text" name="estado" className="form-control" onChange={handleChange} />
        </div>
        <div className="col-md-4">
          <label>Código Postal</label>
          <input type="text" name="codigo_postal" className="form-control" onChange={handleChange} />
        </div>
        <div className="col-md-4">
          <label>Condado</label>
          <input type="text" name="ciudad" className="form-control" onChange={handleChange} />
        </div>
      <div className="col-md-10">
          <label>Direccion de Correspondencia</label>
          <input type="text" name="dir_correspondencia" className="form-control" onChange={handleChange} />
        </div>

        <h4 className="mt-4">Datos de Empleo e Ingreso</h4>
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

      </div>
      <div className="mt-4">
        <button type="submit" className="btn btn-primary">Guardar Cliente</button>
      </div>
      </div>
      
    </form>
  </div>
);
};

export default Clientes;
