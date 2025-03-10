import React, { useState } from "react";
import Papa from "papaparse";

const ImportarClientes = () => {
  const [clientes, setClientes] = useState([]);
  const [errores, setErrores] = useState([]);
  const [archivo, setArchivo] = useState(null);
  const [procesando, setProcesando] = useState(false);

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

    data.forEach((cliente, index) => {
      if (!cliente.nombre_completo || cliente.nombre_completo.trim() === "") {
        erroresTemp.push(`Error en línea ${index + 1}: El nombre completo es obligatorio.`);
        console.warn(`⚠️ Registro inválido en línea ${index + 1}:`, cliente);
      }
    });

    setErrores(erroresTemp);
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

    setProcesando(true);
    const token = "3yw3OnKzFKEcTrEu1JYPCrAqMLgxM9Hcqpx5l6aEd26d405f";

    console.log("🚀 Enviando clientes a la API:", clientes);

    try {
      const response = await fetch("http://127.0.0.1:8000/api/cliente/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ clientes }),
      });

      const data = await response.json();
      console.log("✅ Respuesta de la API:", data);
      alert(data.message || `Se importaron ${data.cantidad} clientes correctamente`);

      setClientes([]);
      setArchivo(null);
      setErrores([]);
    } catch (error) {
      console.error("❌ Error al importar clientes:", error);
      alert("Error al importar los clientes: " + (error.message || "Error de conexión"));
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div className="container mt-4">
      <h2 className="text-center mb-4">Importar clientes</h2>
      <input type="file" accept=".csv" className="form-control" onChange={handleFileUpload} disabled={procesando} />
      <button className="btn btn-success mt-3" onClick={enviarDatos} disabled={errores.length > 0 || clientes.length === 0 || procesando}>Crear Clientes</button>
    </div>
  );
};

export default ImportarClientes;
