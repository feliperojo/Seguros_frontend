import React, { useState, useEffect } from "react";
import Papa from "papaparse";
import apiRequest from "../services/api";
import ClienteService from "../services/ClienteService";
import { mapClienteFromMember } from "../adapters/prospecto.mapper";

const ImportarClientes = () => {
  const [clientes, setClientes] = useState([]);
  const [clientesExistentes, setClientesExistentes] = useState([]);
  const [errores, setErrores] = useState([]);
  const [archivo, setArchivo] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [resumenImportacion, setResumenImportacion] = useState(null);

  // 🔹 Obtener clientes existentes al cargar el componente
  useEffect(() => {
    obtenerClientesExistentes();
  }, []);

  // 🔹 Función para obtener los clientes existentes
  const obtenerClientesExistentes = async () => {
    try {
      const data = await apiRequest("/cliente", "GET");
      console.log("✅ Clientes existentes obtenidos:", data);
      
      // Extraemos solo los códigos sociales para facilitar la búsqueda
      const socialesExistentes = data.map(cliente => cliente.social).filter(social => social !== null);
      setClientesExistentes(socialesExistentes);
    } catch (error) {
      console.error("❌ Error al obtener clientes existentes:", error);
      setErrores(prev => [...prev, "Error al obtener clientes existentes. La validación de duplicados puede no ser precisa."]);
    }
  };

  // 🔹 Función para limpiar valores vacíos y asignar `null` si corresponde
  const limpiarValor = (valor, tipo, maxLength = null) => {
    if (!valor || valor.trim() === "") {
      if (tipo === "boolean") return false; // 🔥 Booleanos no deben ser null, sino false
      return null;
    }

    if (tipo === "boolean") {
      return ["true", "t", "yes", "y", "si", "1"].includes(valor.toString().toLowerCase());
    }

    if (tipo === "integer") {
      return isNaN(parseInt(valor)) ? null : parseInt(valor);
    }

    if (tipo === "string" && maxLength) {
      return valor.trim().length > maxLength ? valor.trim().substring(0, maxLength) : valor.trim();
    }

    return valor;
  };

  // 🔹 Validador sencillo de email (para limpiar datos del CSV antes de enviarlos)
  const esEmailValido = (email) => {
    if (!email) return false;
    const trimmed = String(email).trim();
    // Regex simple y suficiente para descartar valores claramente inválidos
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(trimmed);
  };

  // 🔹 Genera y dispara la descarga de un CSV con el resumen de importación
  const descargarReporteImportacion = (resumen) => {
    if (!resumen) return;

    const { clientesNuevos = [], clientesDuplicados = [] } = resumen;

    const filas = [];

    clientesNuevos.forEach((c) => {
      filas.push({
        estado: "CREADO",
        linea: c.index,
        nombre_completo: c.nombre,
        social: c.social,
      });
    });

    clientesDuplicados.forEach((c) => {
      filas.push({
        estado: "DUPLICADO",
        linea: c.index,
        nombre_completo: c.nombre,
        social: c.social,
      });
    });

    if (filas.length === 0) return;

    try {
      const csv = Papa.unparse(filas);
      const blob = new Blob([csv], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const fecha = new Date().toISOString().slice(0, 10);
      link.download = `reporte_importacion_clientes_${fecha}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("❌ Error al generar/descargar el reporte de importación:", e);
    }
  };

  // 🔹 Función para convertir fechas a formato YYYY-MM-DD
  const formatearFecha = (fecha) => {
    console.log("📌 Fecha original recibida:", fecha);

    if (!fecha || fecha.trim() === "") return null;

    fecha = fecha.trim();

    // 🔹 Si ya está en formato YYYY-MM-DD, devolverla directamente
    if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        console.log("✅ Fecha ya está en formato correcto:", fecha);
        return fecha;
    }

    // 🔹 Separar la fecha por "/", "-", ".", " "
    const partes = fecha.split(/[\/\-\. ]/);

    if (partes.length !== 3) return null; // Si no tiene 3 partes, es inválida

    let año, mes, dia;

    // 🔹 Caso 1: Formato YYYY/MM/DD
    if (partes[0].length === 4) {
        [año, mes, dia] = partes;
    }
    // 🔹 Caso 2: Formato MM/DD/YYYY
    else if (partes[2].length === 4) {
        [mes, dia, año] = partes;
    }
    // 🔹 Caso 3: Formato inválido
    else {
        return null;
    }

    // 🔹 Convertir a enteros y validar
    año = parseInt(año, 10);
    mes = parseInt(mes, 10);
    dia = parseInt(dia, 10);

    if (isNaN(dia) || isNaN(mes) || isNaN(año) || dia < 1 || dia > 31 || mes < 1 || mes > 12) {
        return null; // Si alguno es inválido
    }

    // 🔹 Formatear correctamente (YYYY-MM-DD)
    mes = String(mes).padStart(2, "0");
    dia = String(dia).padStart(2, "0");
    año = String(año).padStart(4, "0");

    const fechaFormateada = `${año}-${mes}-${dia}`;
    console.log("✅ Fecha formateada correctamente:", fechaFormateada);

    return fechaFormateada;
  };

  // 🔹 Función para limpiar números de teléfono
  const formatearTelefono = (telefono) => {
    if (!telefono) return null;
    return telefono.replace(/\D/g, ""); // Elimina caracteres no numéricos
  };

  // 🔹 Procesamiento del archivo CSV
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setArchivo(file);
    setProcesando(true);
    setErrores([]);
    setResumenImportacion(null);

    Papa.parse(file, {
      complete: (result) => {
        const filasFiltradas = result.data.filter(row =>
          Object.values(row).some(value => value && value.trim() !== "")
        );

        const dataFormateada = filasFiltradas.map((cliente, index) => {
          const nombreCompleto = limpiarValor(cliente.nombre_completo, "string", 255) || "N/A";

          if (!nombreCompleto) {
            console.warn(`⚠️ Registro en línea ${index + 1} tiene nombre_completo vacío:`, cliente);
          }

          return {
            nombre_completo: nombreCompleto,
            primer_nombre: limpiarValor(cliente.primer_nombre, "string", 255),
            segundo_nombre: limpiarValor(cliente.segundo_nombre, "string", 255),
            apellidos: limpiarValor(cliente.apellidos, "string", 255),
            fecha_nacimiento: formatearFecha(cliente.fecha_nacimiento),  // 🔥 Se toma del archivo
            edad: limpiarValor(cliente.edad, "integer"),
            genero: limpiarValor(cliente.genero, "string", 255),
            cobertura: limpiarValor(cliente.cobertura, "boolean"),
            social: limpiarValor(cliente.social, "string", 255),
            status: limpiarValor(cliente.status, "string", 50),
            auscis: limpiarValor(cliente.auscis, "string", 255),
            tarjeta_numero: limpiarValor(cliente.tarjeta_numero, "string", 50),
            categoria: limpiarValor(cliente.categoria, "string", 50),
            fecha_emision: formatearFecha(cliente.fecha_emision),  // 🔥 Se toma del archivo
            fecha_expiracion: formatearFecha(cliente.fecha_expiracion),  // 🔥 Se toma del archivo
            telefono: formatearTelefono(cliente.telefono),
            email: limpiarValor(cliente.email, "string", 255),
            whatsapp: limpiarValor(cliente.whatsapp, "boolean"),
            telegram: limpiarValor(cliente.telegram, "boolean"),
            texto_sms: limpiarValor(cliente.texto_sms, "boolean"),
            direccion: limpiarValor(cliente.direccion, "string", 255),
            dir_correspondencia: limpiarValor(cliente.dir_correspondencia, "string", 255),
            calle: limpiarValor(cliente.calle, "string", 255),
            apto: limpiarValor(cliente.apto, "string", 255),
            ciudad: limpiarValor(cliente.ciudad, "string", 255),
            condado: limpiarValor(cliente.condado, "string", 255),
            estado: limpiarValor(cliente.estado, "string", 20),
            codigo_postal: limpiarValor(cliente.codigo_postal, "string", 10),
            idioma: limpiarValor(cliente.idioma, "string", 50),
            secundario: limpiarValor(cliente.secundario, "string", 255),
            whatsapp_num: formatearTelefono(cliente.whatsapp_num),
          };
        });

        setClientes(dataFormateada);
        validarDatos(dataFormateada);
        setProcesando(false);
      },
      header: true,
      skipEmptyLines: true,
      error: (error) => {
        setErrores([`Error al procesar el archivo: ${error.message}`]);
        setProcesando(false);
      }
    });
  };

  // 🔹 Validación de datos antes de enviarlos a la API
  const validarDatos = (data) => {
    let erroresTemp = [];
    let clientesNuevos = [];
    let clientesDuplicados = [];

    data.forEach((cliente, index) => {
      // Validar campos obligatorios
      if (!cliente.nombre_completo || cliente.nombre_completo.trim() === "") {
        erroresTemp.push(`Error en línea ${index + 1}: El nombre completo es obligatorio.`);
        console.warn(`⚠️ Registro inválido en línea ${index + 1}:`, cliente);
      }

      // Validar duplicados por código social
      if (cliente.social) {
        if (clientesExistentes.includes(cliente.social)) {
          clientesDuplicados.push({
            index: index + 1,
            nombre: cliente.nombre_completo,
            social: cliente.social
          });
          console.warn(`⚠️ Cliente duplicado en línea ${index + 1}:`, cliente);
        } else {
          clientesNuevos.push({
            index: index + 1,
            nombre: cliente.nombre_completo,
            social: cliente.social
          });
        }
      } else {
        // Cliente sin social no se puede validar como duplicado
        clientesNuevos.push({
          index: index + 1,
          nombre: cliente.nombre_completo,
          social: "No especificado"
        });
      }
    });

    // Generar resumen de importación
    setResumenImportacion({
      total: data.length,
      nuevos: clientesNuevos.length,
      duplicados: clientesDuplicados.length,
      clientesNuevos,
      clientesDuplicados
    });

    setErrores(erroresTemp);
  };

  // 🔹 Filtrar clientes duplicados antes de enviar
  const filtrarClientesNuevos = () => {
    return clientes.filter(cliente => 
      !cliente.social || !clientesExistentes.includes(cliente.social)
    );
  };

  // 🔹 Envío de datos a la API
  const enviarDatos = async () => {
    if (errores.length > 0) {
      alert("Corrige los errores antes de enviar los datos.");
      return;
    }

    if (clientes.length === 0) {
      alert("No hay datos para enviar.");
      return;
    }

    // Filtrar solo los clientes que no existen en la base de datos
    const clientesNuevos = filtrarClientesNuevos();
    
    if (clientesNuevos.length === 0) {
      alert("Todos los clientes ya existen en la base de datos. No hay datos nuevos para enviar.");
      return;
    }

    if (!window.confirm(`¿Estás seguro de crear ${clientesNuevos.length} nuevos clientes? Se omitirán ${clientes.length - clientesNuevos.length} clientes duplicados.`)) {
      return;
    }

    setProcesando(true);

    // Normalizar la carga útil usando el mismo mapeo que el flujo de Prospectos
    // para cumplir exactamente con las validaciones del backend.
    const clientesPayload = clientesNuevos.map((c, idx) => {
      const payload = mapClienteFromMember(c);

      // Para migraciones CSV queremos que emails claramente inválidos
      // no rompan la validación del backend: los limpiamos a null aquí.
      if (payload.email && !esEmailValido(payload.email)) {
        console.warn(
          `⚠️ Email inválido en cliente #${idx + 1} (${payload.nombre_completo}):`,
          payload.email
        );
        payload.email = null;
      }

      console.log("🧾 Cliente listo para API", idx + 1, payload);
      return payload;
    });

    console.log("🚀 Enviando clientes a la API:", clientesPayload);

    try {
      const data = await ClienteService.createMany(clientesPayload);
      console.log("✅ Respuesta de la API:", data);
      alert(
        data.message ||
          `Se importaron ${data.cantidad ?? clientesNuevos.length} clientes correctamente. Se omitieron ${
            clientes.length - clientesNuevos.length
          } clientes duplicados.`
      );

      // Descargar reporte resumido (creados vs duplicados)
      descargarReporteImportacion(resumenImportacion);

      // Actualizar la lista de clientes existentes después de la importación
      obtenerClientesExistentes();

      setClientes([]);
      setArchivo(null);
      setErrores([]);
      setResumenImportacion(null);
    } catch (error) {
      console.error("❌ Error al importar clientes:", error);
      if (error?.response) {
        console.error("❌ Detalle error de validación al importar clientes:", {
          status: error.response.status,
          url: error.response.url,
          data: error.response.data,
          errors: error.response.errors,
          code: error.response.code,
        });
      }
      const apiMessage =
        error?.response?.data?.message ||
        error?.message ||
        "Error de conexión";
      alert(
        error?.response?.status === 401
          ? "No autenticado. Por favor, inicia sesión nuevamente e intenta de nuevo la importación."
          : `Error al importar los clientes: ${apiMessage}`
      );
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div className="container mt-4">
      <h2 className="text-center mb-4">Importar clientes</h2>
      
      <div className="card mb-4">
        <div className="card-body">
          <h5 className="card-title">Instrucciones</h5>
          <p className="card-text">Sube un archivo CSV con los datos de los clientes. El sistema verificará si ya existen en la base de datos utilizando el campo <strong>social</strong> para evitar duplicados.</p>
        </div>
      </div>
      
      <input type="file" accept=".csv" className="form-control" onChange={handleFileUpload} disabled={procesando} />
      
      {/* Mostrar resumen de importación */}
      {resumenImportacion && (
        <div className="card mt-3">
          <div className="card-header bg-info text-white">
            Resumen de importación
          </div>
          <div className="card-body">
            <h5 className="card-title">Total de registros: {resumenImportacion.total}</h5>
            <div className="row">
              <div className="col-md-6">
                <div className="alert alert-success">
                  <h6>Clientes nuevos: {resumenImportacion.nuevos}</h6>
                  <p>Estos clientes serán importados a la base de datos.</p>
                </div>
              </div>
              <div className="col-md-6">
                <div className="alert alert-warning">
                  <h6>Clientes duplicados: {resumenImportacion.duplicados}</h6>
                  <p>Estos clientes ya existen en la base de datos y serán omitidos.</p>
                </div>
              </div>
            </div>
            
            {resumenImportacion.duplicados > 0 && (
              <div className="mt-3">
                <h6>Detalle de clientes duplicados:</h6>
                <ul className="list-group">
                  {resumenImportacion.clientesDuplicados.slice(0, 30).map((cliente, idx) => (
                    <li key={idx} className="list-group-item list-group-item-warning">
                      Línea {cliente.index}: {cliente.nombre} (Social: {cliente.social})
                    </li>
                  ))}
                  {resumenImportacion.clientesDuplicados.length > 30 && (
                    <li className="list-group-item list-group-item-light">
                      ... y {resumenImportacion.clientesDuplicados.length - 30} más
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Mostrar errores de validación */}
      {errores.length > 0 && (
        <div className="alert alert-danger mt-3">
          <h6>Errores de validación:</h6>
          <ul>
            {errores.map((error, idx) => (
              <li key={idx}>{error}</li>
            ))}
          </ul>
        </div>
      )}
      
      <button 
        className="btn btn-success mt-3" 
        onClick={enviarDatos} 
        disabled={errores.length > 0 || clientes.length === 0 || procesando || (resumenImportacion && resumenImportacion.nuevos === 0)}
      >
        {procesando ? "Procesando..." : `Crear ${resumenImportacion ? resumenImportacion.nuevos : 0} Clientes`}
      </button>
    </div>
  );
};

export default ImportarClientes;