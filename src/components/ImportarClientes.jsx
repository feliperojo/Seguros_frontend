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
  // 🔹 Paso del flujo: subir -> mapeo -> revisión/envío
  const [paso, setPaso] = useState("subir"); // "subir" | "mapeo" | "revision"
  // 🔹 Columnas originales del CSV y filas crudas
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [csvFilas, setCsvFilas] = useState([]);
  // 🔹 Mapeo dinámico: campoBD -> nombreColumnaCSV
  const [fieldMapping, setFieldMapping] = useState({});

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
    setPaso("subir");
    setCsvHeaders([]);
    setCsvFilas([]);
    setFieldMapping({});

    Papa.parse(file, {
      complete: (result) => {
        // Guardamos todas las filas crudas y headers para el mapeo dinámico
        const filasCrudas = result.data.filter(row =>
          Object.values(row).some(value => value && String(value).trim() !== "")
        );

        const headers = result.meta?.fields || Object.keys(filasCrudas[0] || {});

        setCsvHeaders(headers);
        setCsvFilas(filasCrudas);

        // Construir mapeo automático inicial en base a similitud de nombres
        const normalizar = (s) =>
          (s || "")
            .toString()
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, "_")
            .replace(/^_+|_+$/g, "");

        const headersNorm = headers.map((h) => ({
          original: h,
          norm: normalizar(h),
        }));

        const DEST_FIELDS = [
          { key: "nombre_completo", aliases: ["nombre_completo", "nombre", "full_name"] },
          { key: "primer_nombre", aliases: ["primer_nombre", "nombre", "first_name", "nombre1"] },
          { key: "segundo_nombre", aliases: ["segundo_nombre", "second_name", "nombre2"] },
          { key: "apellidos", aliases: ["apellidos", "apellido", "last_name"] },
          { key: "fecha_nacimiento", aliases: ["fecha_nacimiento", "dob", "fecha_de_nacimiento"] },
          { key: "edad", aliases: ["edad", "age"] },
          { key: "genero", aliases: ["genero", "sexo", "gender"] },
          { key: "social", aliases: ["social", "ssn", "seguro_social"] },
          { key: "status", aliases: ["status", "estatus", "migratorio"] },
          { key: "auscis", aliases: ["auscis", "uscis"] },
          { key: "tarjeta_numero", aliases: ["tarjeta_numero", "green_card", "card_number"] },
          { key: "categoria", aliases: ["categoria", "category"] },
          { key: "fecha_emision", aliases: ["fecha_emision", "issue_date"] },
          { key: "fecha_expiracion", aliases: ["fecha_expiracion", "expiry_date", "expiration_date"] },
          { key: "telefono", aliases: ["telefono", "phone", "telefono_principal"] },
          { key: "secundario", aliases: ["secundario", "telefono_secundario", "secondary_phone"] },
          { key: "whatsapp_num", aliases: ["whatsapp_num", "whatsapp", "celular"] },
          { key: "email", aliases: ["email", "correo", "correo_electronico"] },
          { key: "whatsapp", aliases: ["whatsapp", "whatsapp_flag"] },
          { key: "telegram", aliases: ["telegram"] },
          { key: "texto_sms", aliases: ["texto_sms", "sms", "sms_flag"] },
          { key: "direccion", aliases: ["direccion", "direccion_completa", "address"] },
          { key: "dir_correspondencia", aliases: ["dir_correspondencia", "direccion_correspondencia"] },
          { key: "calle", aliases: ["calle", "street"] },
          { key: "apto", aliases: ["apto", "apartamento", "apt"] },
          { key: "ciudad", aliases: ["ciudad", "city"] },
          { key: "condado", aliases: ["condado", "county"] },
          { key: "estado", aliases: ["estado", "state"] },
          { key: "codigo_postal", aliases: ["codigo_postal", "zip", "postal_code"] },
          { key: "idioma", aliases: ["idioma", "language"] },
        ];

        const autoMap = {};

        DEST_FIELDS.forEach(({ key, aliases }) => {
          const aliasNorm = aliases.map(normalizar);
          const match = headersNorm.find((h) => aliasNorm.includes(h.norm));
          if (match) {
            autoMap[key] = match.original;
          }
        });

        setFieldMapping(autoMap);
        setPaso("mapeo");
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

  // 🔹 Campos destino soportados (para mapeo y normalización)
  const DESTINO_CAMPOS = [
    { key: "nombre_completo", label: "Nombre completo", tipo: "string", required: true, maxLength: 255 },
    { key: "primer_nombre", label: "Primer nombre", tipo: "string", required: false, maxLength: 255 },
    { key: "segundo_nombre", label: "Segundo nombre", tipo: "string", required: false, maxLength: 255 },
    { key: "apellidos", label: "Apellidos", tipo: "string", required: false, maxLength: 255 },
    { key: "fecha_nacimiento", label: "Fecha de nacimiento", tipo: "date", required: false },
    { key: "edad", label: "Edad", tipo: "integer", required: false },
    { key: "genero", label: "Género", tipo: "string", required: false, maxLength: 255 },
    { key: "social", label: "Social (SSN)", tipo: "string", required: false, maxLength: 255 },
    { key: "status", label: "Status migratorio", tipo: "string", required: false, maxLength: 50 },
    { key: "auscis", label: "A/USCIS", tipo: "string", required: false, maxLength: 255 },
    { key: "tarjeta_numero", label: "Tarjeta #", tipo: "string", required: false, maxLength: 50 },
    { key: "categoria", label: "Categoría", tipo: "string", required: false, maxLength: 50 },
    { key: "fecha_emision", label: "Fecha emisión", tipo: "date", required: false },
    { key: "fecha_expiracion", label: "Fecha expiración", tipo: "date", required: false },
    { key: "telefono", label: "Teléfono principal", tipo: "telefono", required: false },
    { key: "secundario", label: "Teléfono secundario", tipo: "string", required: false, maxLength: 255 },
    { key: "whatsapp_num", label: "WhatsApp (número)", tipo: "telefono", required: false },
    { key: "email", label: "Email", tipo: "string", required: false, maxLength: 255 },
    { key: "whatsapp", label: "WhatsApp (flag)", tipo: "boolean", required: false },
    { key: "telegram", label: "Telegram (flag)", tipo: "boolean", required: false },
    { key: "texto_sms", label: "SMS (flag)", tipo: "boolean", required: false },
    { key: "direccion", label: "Dirección completa", tipo: "string", required: false, maxLength: 255 },
    { key: "dir_correspondencia", label: "Dirección de correspondencia", tipo: "string", required: false, maxLength: 255 },
    { key: "calle", label: "Calle", tipo: "string", required: false, maxLength: 255 },
    { key: "apto", label: "APT", tipo: "string", required: false, maxLength: 255 },
    { key: "ciudad", label: "Ciudad", tipo: "string", required: false, maxLength: 255 },
    { key: "condado", label: "Condado", tipo: "string", required: false, maxLength: 255 },
    { key: "estado", label: "Estado", tipo: "string", required: false, maxLength: 20 },
    { key: "codigo_postal", label: "Código postal", tipo: "string", required: false, maxLength: 10 },
    { key: "idioma", label: "Idioma", tipo: "string", required: false, maxLength: 50 },
    { key: "pais_origen", label: "País de origen", tipo: "string", required: false, maxLength: 255 },
  ];

  // 🔹 Aplica el mapeo seleccionado para construir los objetos de cliente que ya esperaba el flujo anterior
  const aplicarMapeo = () => {
    if (!csvFilas.length) return;

    const faltantesObligatorios = DESTINO_CAMPOS.filter(
      (c) => c.required && !fieldMapping[c.key]
    );
    if (faltantesObligatorios.length > 0) {
      alert(
        `Debes mapear al menos el campo obligatorio: ${faltantesObligatorios
          .map((c) => c.label)
          .join(", ")}`
      );
      return;
    }

    const dataFormateada = csvFilas.map((row, index) => {
      const cliente = {};

      DESTINO_CAMPOS.forEach((campo) => {
        const sourceCol = fieldMapping[campo.key];
        if (!sourceCol) {
          cliente[campo.key] = null;
          return;
        }
        const raw = row[sourceCol];

        if (campo.tipo === "date") {
          cliente[campo.key] = formatearFecha(raw);
          return;
        }

        if (campo.tipo === "telefono") {
          cliente[campo.key] = formatearTelefono(raw);
          return;
        }

        if (campo.tipo === "boolean") {
          cliente[campo.key] = limpiarValor(raw, "boolean");
          return;
        }

        if (campo.tipo === "integer") {
          cliente[campo.key] = limpiarValor(raw, "integer");
          return;
        }

        // string u otros
        cliente[campo.key] = limpiarValor(raw, "string", campo.maxLength || null);
      });

      // Aseguramos nombre_completo por compatibilidad
      const nombreCompleto =
        cliente.nombre_completo ||
        limpiarValor(row["nombre_completo"], "string", 255) ||
        "N/A";
      cliente.nombre_completo = nombreCompleto;

      if (!nombreCompleto) {
        console.warn(
          `⚠️ Registro en línea ${index + 1} tiene nombre_completo vacío:`,
          row
        );
      }

      // Construir arreglo telefonos a partir de telefono, secundario y whatsapp_num
      const telefonos = [];
      const baseIso = "us";
      const baseIndicativo = "1";

      if (cliente.telefono) {
        telefonos.push({
          id: `ph-${index}-1`,
          iso: baseIso,
          tipo: "Móvil",
          numero: cliente.telefono,
          principal: true,
          indicativo: baseIndicativo,
        });
      }

      if (cliente.secundario) {
        telefonos.push({
          id: `ph-${index}-2`,
          iso: baseIso,
          tipo: "Móvil",
          numero: cliente.secundario,
          principal: !telefonos.length, // si no había principal aún
          indicativo: baseIndicativo,
        });
      }

      if (cliente.whatsapp_num) {
        telefonos.push({
          id: `ph-${index}-3`,
          iso: baseIso,
          tipo: "Móvil",
          numero: cliente.whatsapp_num,
          principal: !telefonos.length, // si es el único, márcalo como principal
          indicativo: baseIndicativo,
        });
      }

      if (telefonos.length) {
        cliente.telefonos = telefonos;
      }

      return cliente;
    });

    setClientes(dataFormateada);
    validarDatos(dataFormateada);
    setPaso("revision");
  };

  const handleChangeMapping = (fieldKey, value) => {
    setFieldMapping((prev) => ({
      ...prev,
      [fieldKey]: value || undefined,
    }));
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

      <input
        type="file"
        accept=".csv"
        className="form-control"
        onChange={handleFileUpload}
        disabled={procesando}
      />

      {/* Paso 2: Mapeo de campos CSV -> BD */}
      {paso === "mapeo" && csvHeaders.length > 0 && (
        <div className="card mt-4">
          <div className="card-header bg-secondary text-white">
            Mapeo de columnas del archivo a campos del sistema
          </div>
          <div className="card-body">
            <p className="small text-muted">
              Asocia cada <strong>campo del sistema</strong> con la columna correspondiente de tu archivo CSV.
              Los campos no mapeados se enviarán como <code>null</code>. Al menos{" "}
              <strong>Nombre completo</strong> debe estar mapeado.
            </p>
            <div className="table-responsive" style={{ maxHeight: 400, overflowY: "auto" }}>
              <table className="table table-sm align-middle">
                <thead>
                  <tr>
                    <th>Campo del sistema</th>
                    <th>Columna del archivo CSV</th>
                  </tr>
                </thead>
                <tbody>
                  {DESTINO_CAMPOS.map((campo) => (
                    <tr key={campo.key}>
                      <td>
                        <span className="fw-semibold">
                          {campo.label}
                          {campo.required && <span className="text-danger"> *</span>}
                        </span>
                        <div className="small text-muted">
                          <code>{campo.key}</code>
                        </div>
                      </td>
                      <td>
                        <select
                          className="form-select form-select-sm"
                          value={fieldMapping[campo.key] || ""}
                          onChange={(e) =>
                            handleChangeMapping(campo.key, e.target.value)
                          }
                        >
                          <option value="">— No mapear —</option>
                          {csvHeaders.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="d-flex justify-content-between mt-3">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => {
                  setPaso("subir");
                  setCsvHeaders([]);
                  setCsvFilas([]);
                  setFieldMapping({});
                  setClientes([]);
                  setResumenImportacion(null);
                  setErrores([]);
                }}
              >
                Cancelar mapeo
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={aplicarMapeo}
                disabled={procesando}
              >
                Aplicar mapeo y validar datos
              </button>
            </div>
          </div>
        </div>
      )}

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