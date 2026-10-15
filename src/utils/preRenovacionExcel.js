import * as XLSX from "xlsx";

/** Primera entrega: solo .xlsx OOXML. El lector no escribe en Bantune. */
export const LIMITE_BYTES_EXCEL = 8 * 1024 * 1024;

const ETIQUETAS = new Set([
  "1ER NOMBRE",
  "2DO NOMBRE",
  "APELLIDOS",
  "FECHA DE NACIMIENTO",
  "GENERO",
  "COBERTURA",
  "SOCIAL",
  "STATUS",
  "A/USCIS",
  "TARJETA #",
  "CATEGORIA",
  "F.EXPIRACION",
  "F. DE EMISION",
  "TELEFONO",
  "E-MAIL",
  "WHATSAPP",
  "TELEGRAM",
  "TEXTO SMS",
  "CALLE",
  "APT",
  "CIUDAD",
  "ESTADO",
  "CODIGO POSTAL",
  "CONDADO",
  "IDIOMA",
  "TIPO DE INGRESO",
  "EMPLEADOR O ACTIVIDAD",
  "TEL. EMPLEADOR",
  "PERIODO DE INGRESO",
  "VR. DEL INGRESO POR PERIODO",
  "INGRESO ANUAL",
  "INGRESO POR HORAS IRREGULARES",
  "COMPANIA",
  "COMPAÑIA",
  "PLAN ELEGIDO",
  "METAL",
  "PRECIO $",
  "PRECIO",
  "ELEGIBILIDAD",
  "# PERSONAS EN TAXES",
  "# PERSONAS COBERTURA",
  "INGRESO FAMILIAR ANUAL",
  "NOMBRE",
  "PARENTESCO",
  "F.ACTIVACION",
  "F. CANCELACION",
  "ID",
  "EDAD",
  "DATOS DE PAGO",
  "DATOS DE CUENTAS DEL USUARIO EN ASEGURADORA",
  "DATOS DE EMPLEO E INGRESO",
  "USUARIO",
  "CLAVE",
  "CVV",
]);

const HOJAS_FUERA_DE_ALCANCE = new Set([
  "VISION Y DENTAL",
  "PLAN FUNERAL",
  "PLAN DE DESCUENTOS",
  "VIDA",
  "LISTAS",
]);

function normalizarEtiqueta(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function limpiarTexto(value) {
  const texto = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!texto) return null;
  if (/^[,.\-_/|;:]+$/.test(texto)) return null;
  return texto;
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function formatearFecha(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function serialAFecha(serial) {
  const parsed = XLSX.SSF.parse_date_code(serial);
  if (!parsed || !parsed.y) return null;
  return `${parsed.y}-${pad(parsed.m)}-${pad(parsed.d)}`;
}

function esFormulaExterna(formula) {
  return /\[|WEBSERVICE|HYPERLINK|CMD\(|EXEC\(/i.test(String(formula || ""));
}

function valorConfirmado(cell, modo = "texto") {
  if (!cell) return { vacio: true };
  if (cell.f && esFormulaExterna(cell.f)) {
    return { vacio: true, advertencia: "formula_externa" };
  }

  const raw = cell.v;
  if (cell.t === "d" || raw instanceof Date) {
    const fecha = formatearFecha(raw instanceof Date ? raw : new Date(raw));
    return fecha ? { valor: fecha } : { vacio: true };
  }

  if (typeof raw === "string" || cell.t === "s" || cell.t === "inlineStr") {
    const texto = limpiarTexto(raw ?? cell.w);
    return texto ? { valor: texto } : { vacio: true };
  }

  if (typeof raw === "number") {
    if (cell.f && raw === 0) return { vacio: true, calculado: true };
    if (modo === "fecha") {
      const fecha = serialAFecha(raw);
      return fecha ? { valor: fecha } : { vacio: true };
    }
    if (modo === "identificador") {
      return { vacio: true, advertencia: "identificador_numerico" };
    }
    if (modo === "telefono") {
      if (!Number.isSafeInteger(raw)) return { vacio: true, advertencia: "telefono_numerico" };
      return { valor: String(raw), advertencia: "telefono_numerico" };
    }
    if (modo === "dinero") {
      if (!Number.isFinite(raw) || raw === 0) return { vacio: true, calculado: Boolean(cell.f) };
      return { valor: Math.round(raw * 100) / 100, calculado: Boolean(cell.f) };
    }
    if (modo === "entero") {
      if (!Number.isFinite(raw) || raw < 0) return { vacio: true };
      return { valor: Math.round(raw) };
    }
    return { valor: raw, calculado: Boolean(cell.f) };
  }

  if (cell.f) return { vacio: true, calculado: true };
  return { vacio: true };
}

function celdasDeHoja(sheet) {
  const ref = sheet?.["!ref"];
  if (!ref) return [];
  const range = XLSX.utils.decode_range(ref);
  if (range.e.r > 250 || range.e.c > 40) {
    return { error: "La hoja supera el tamaño admitido para esta plantilla." };
  }
  const celdas = [];
  const filaMax = Math.min(range.e.r, 90);
  const colMax = Math.min(range.e.c, 20);
  for (let r = range.s.r; r <= filaMax; r += 1) {
    for (let c = range.s.c; c <= colMax; c += 1) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[addr];
      if (!cell) continue;
      const texto = typeof cell.v === "string" ? limpiarTexto(cell.v) : null;
      celdas.push({
        r,
        c,
        addr,
        cell,
        etiqueta: texto ? normalizarEtiqueta(texto) : null,
      });
    }
  }
  return celdas;
}

function buscarEtiquetas(celdas, etiqueta, filtro = {}) {
  const objetivo = normalizarEtiqueta(etiqueta);
  return celdas.filter((item) => {
    if (item.etiqueta !== objetivo) return false;
    if (filtro.desdeFila != null && item.r < filtro.desdeFila) return false;
    if (filtro.hastaFila != null && item.r > filtro.hastaFila) return false;
    return true;
  });
}

function esEtiquetaConocida(etiqueta) {
  if (!etiqueta) return false;
  return ETIQUETAS.has(etiqueta) || ETIQUETAS.has(normalizarEtiqueta(etiqueta));
}

function valorALaDerecha(celdas, origen, modo) {
  const candidatos = celdas
    .filter((item) => item.r === origen.r && item.c > origen.c && item.c <= origen.c + 4)
    .sort((a, b) => a.c - b.c);
  for (const item of candidatos) {
    if (item.etiqueta && esEtiquetaConocida(item.etiqueta)) break;
    const leido = valorConfirmado(item.cell, modo);
    if (!leido.vacio) return leido;
    if (leido.advertencia) return leido;
  }
  return { vacio: true };
}

function filaDe(celdas, etiqueta) {
  return buscarEtiquetas(celdas, etiqueta)[0]?.r ?? null;
}

function clasificarHoja(nombre) {
  const normal = normalizarEtiqueta(nombre);
  if (normal === "DATOS DEL CLIENTE") return "titular";
  if (normal === "DATOS DEL CONYUGE" || normal === "DATOS DEL CONYUGE") return "conyuge";
  if (normal.startsWith("DATOS DEL CONYUGE")) return "conyuge";
  if (/^DEPENDIENTE \d+$/.test(normal)) return "dependiente";
  if (normal === "OBAMACARE") return "obamacare";
  if (normal.startsWith("CARTA ") && (normal.includes("CONFIRMACION") || normal.includes("CORROBORACION"))) {
    return "carta";
  }
  if (HOJAS_FUERA_DE_ALCANCE.has(normal)) return "fuera";
  return "desconocida";
}

function booleanoSiNo(valor) {
  const normal = normalizarEtiqueta(valor);
  if (normal === "SI" || normal === "YES") return true;
  if (normal === "NO") return false;
  return null;
}

function extraerPersona(sheet, meta) {
  const celdas = celdasDeHoja(sheet);
  if (celdas?.error) {
    return { persona: null, advertencias: [{ codigo: "hoja_grande", mensaje: celdas.error, hoja: meta.hoja }] };
  }
  const corteCuentas = filaDe(celdas, "DATOS DE CUENTAS DEL USUARIO EN ASEGURADORA");
  const empleo = filaDe(celdas, "DATOS DE EMPLEO E INGRESO");
  const advertencias = [];

  const leer = (etiqueta, modo, filtro) => {
    const encontrados = buscarEtiquetas(celdas, etiqueta, filtro);
    if (!encontrados.length) return { vacio: true };
    return valorALaDerecha(celdas, encontrados[0], modo);
  };

  const tomar = (destino, etiqueta, modo, filtro) => {
    const leido = leer(etiqueta, modo, filtro);
    if (leido.advertencia === "identificador_numerico") {
      advertencias.push({
        codigo: "identificador_numerico",
        mensaje: `No se importó ${destino} porque la celda es numérica y podría perder ceros iniciales.`,
        hoja: meta.hoja,
      });
      return;
    }
    if (leido.advertencia === "formula_externa") {
      advertencias.push({
        codigo: "formula_externa",
        mensaje: "Se ignoró una fórmula con vínculo externo.",
        hoja: meta.hoja,
      });
      return;
    }
    if (!leido.vacio && leido.valor != null) {
      campos[destino] = leido.valor;
    }
  };

  const campos = {};
  const filtroPersona = corteCuentas == null ? {} : { hastaFila: corteCuentas - 1 };
  tomar("primer_nombre", "1ER NOMBRE", "texto", filtroPersona);
  tomar("segundo_nombre", "2DO NOMBRE", "texto", filtroPersona);
  tomar("apellidos", "APELLIDOS", "texto", filtroPersona);
  tomar("fecha_nacimiento", "FECHA DE NACIMIENTO", "fecha", filtroPersona);
  tomar("genero", "GENERO", "texto", filtroPersona);
  tomar("social", "SOCIAL", "identificador", filtroPersona);
  tomar("status", "STATUS", "texto", filtroPersona);
  tomar("auscis", "A/USCIS", "identificador", filtroPersona);
  tomar("tarjeta_numero", "TARJETA #", "identificador", filtroPersona);
  tomar("categoria", "CATEGORIA", "texto", filtroPersona);
  tomar("fecha_expiracion", "F.EXPIRACION", "fecha", filtroPersona);
  tomar("fecha_emision", "F. DE EMISION", "fecha", filtroPersona);
  tomar("telefono", "TELEFONO", "telefono", filtroPersona);
  tomar("email", "E-MAIL", "texto", filtroPersona);
  tomar("calle", "CALLE", "texto", filtroPersona);
  tomar("apto", "APT", "texto", filtroPersona);
  tomar("ciudad", "CIUDAD", "texto", filtroPersona);
  tomar("condado", "CONDADO", "texto", filtroPersona);
  tomar("estado", "ESTADO", "texto", filtroPersona);
  tomar("codigo_postal", "CODIGO POSTAL", "texto", filtroPersona);
  tomar("idioma", "IDIOMA", "texto", filtroPersona);

  const whatsapp = leer("WHATSAPP", "texto", filtroPersona);
  const telegram = leer("TELEGRAM", "texto", filtroPersona);
  const sms = leer("TEXTO SMS", "texto", filtroPersona);
  if (!whatsapp.vacio) {
    const valor = booleanoSiNo(whatsapp.valor);
    if (valor != null) campos.whatsapp = valor;
  }
  if (!telegram.vacio) {
    const valor = booleanoSiNo(telegram.valor);
    if (valor != null) campos.telegram = valor;
  }
  if (!sms.vacio) {
    const valor = booleanoSiNo(sms.valor);
    if (valor != null) campos.texto_sms = valor;
  }

  const cobertura = leer("COBERTURA", "texto", filtroPersona);
  let coberturaExcel = null;
  if (!cobertura.vacio) {
    const normal = normalizarEtiqueta(cobertura.valor);
    if (normal === "SI" || normal === "NO") coberturaExcel = normal;
    else {
      advertencias.push({
        codigo: "cobertura_no_reconocida",
        mensaje: "La cobertura de la hoja no es SI ni NO y no se usará para asegurar a nadie.",
        hoja: meta.hoja,
      });
    }
  }

  if (empleo != null) {
    const finEmpleo = corteCuentas == null ? empleo + 25 : Math.min(corteCuentas - 1, empleo + 25);
    const filtroEmpleo = { desdeFila: empleo, hastaFila: finEmpleo };
    tomar("tipo_ingreso", "TIPO DE INGRESO", "texto", filtroEmpleo);
    tomar("empleador", "EMPLEADOR O ACTIVIDAD", "texto", filtroEmpleo);
    tomar("telefono_empleador", "TEL. EMPLEADOR", "telefono", filtroEmpleo);

    const periodos = buscarEtiquetas(celdas, "PERIODO DE INGRESO", filtroEmpleo);
    const valoresPeriodo = buscarEtiquetas(celdas, "VR. DEL INGRESO POR PERIODO", filtroEmpleo);
    const anuales = buscarEtiquetas(celdas, "INGRESO ANUAL", filtroEmpleo);
    const asignarIngreso = (indice, periodoKey, valorKey, anualKey) => {
      const periodo = periodos[indice];
      const valor = valoresPeriodo[indice];
      const anual = anuales[indice];
      if (periodo) {
        const leido = valorALaDerecha(celdas, periodo, "texto");
        if (!leido.vacio) campos[periodoKey] = leido.valor;
      }
      let valorConfirmadoPeriodo = false;
      if (valor) {
        const leido = valorALaDerecha(celdas, valor, "dinero");
        if (!leido.vacio) {
          campos[valorKey] = leido.valor;
          valorConfirmadoPeriodo = true;
        }
      }
      if (anual) {
        const leido = valorALaDerecha(celdas, anual, "dinero");
        const hayRespaldo = valorConfirmadoPeriodo || campos.empleador || campos.tipo_ingreso;
        if (!leido.vacio && (!leido.calculado || hayRespaldo)) {
          campos[anualKey] = leido.valor;
        }
      }
    };
    asignarIngreso(0, "periodo_ingreso", "ingreso_por_periodo", "ingreso_anual");
    asignarIngreso(1, "periodo_ingreso_ocasional", "ingreso_por_periodo_ocasional", "ingreso_ocasional_anual");

    const horas = buscarEtiquetas(celdas, "INGRESO POR HORAS IRREGULARES", filtroEmpleo)[0];
    if (horas) {
      const posteriores = celdas.filter((item) => item.r > horas.r && item.r <= horas.r + 4);
      const hayDato = posteriores.some((item) => {
        if (item.etiqueta && esEtiquetaConocida(item.etiqueta)) return false;
        const leido = valorConfirmado(item.cell, "dinero");
        return !leido.vacio && leido.valor !== 0;
      });
      if (hayDato) {
        advertencias.push({
          codigo: "ingreso_horas_pendiente",
          mensaje: "Hay ingreso por horas irregulares. Esta entrega no lo copia al borrador.",
          hoja: meta.hoja,
        });
      }
    }
  }

  const partes = [campos.primer_nombre, campos.segundo_nombre, campos.apellidos].filter(Boolean);
  if (partes.length) campos.nombre_completo = partes.join(" ");

  const tieneIdentidad = Boolean(
    campos.primer_nombre || campos.apellidos || campos.social || campos.fecha_nacimiento
  );
  if (!tieneIdentidad) {
    return {
      persona: null,
      advertencias: advertencias.concat([{
        codigo: "hoja_vacia",
        mensaje: "La hoja no tiene una persona diligenciada y no crea un integrante.",
        hoja: meta.hoja,
      }]),
    };
  }

  return {
    persona: {
      rol_hoja: meta.rol,
      hoja: meta.hoja,
      cobertura_excel: coberturaExcel,
      campos,
      ingreso_anual_registrado: campos.ingreso_anual ?? null,
    },
    advertencias,
  };
}

function extraerObamacare(sheet) {
  const celdas = celdasDeHoja(sheet);
  if (celdas?.error) {
    return { obamacare: null, advertencias: [{ codigo: "hoja_grande", mensaje: celdas.error, hoja: "OBAMACARE" }] };
  }
  const cortePago = filaDe(celdas, "DATOS DE PAGO");
  const filtro = cortePago == null ? {} : { hastaFila: cortePago - 1 };
  const advertencias = [];
  const leer = (etiqueta, modo) => {
    const origen = buscarEtiquetas(celdas, etiqueta, filtro)[0];
    if (!origen) return { vacio: true };
    return valorALaDerecha(celdas, origen, modo);
  };
  const obamacare = {};
  const compania = leer("COMPAÑIA", "texto").valor || leer("COMPANIA", "texto").valor;
  const plan = leer("PLAN ELEGIDO", "texto");
  const metal = leer("METAL", "texto");
  const precio = leer("PRECIO $", "dinero").valor ?? leer("PRECIO", "dinero").valor;
  const elegibilidad = leer("ELEGIBILIDAD", "texto");
  const taxes = leer("# PERSONAS EN TAXES", "entero");
  const cobertura = leer("# PERSONAS COBERTURA", "entero");
  const ingreso = leer("INGRESO FAMILIAR ANUAL", "dinero");
  if (compania) obamacare.compania = compania;
  if (!plan.vacio) obamacare.plan = plan.valor;
  if (!metal.vacio) obamacare.metal = metal.valor;
  if (precio != null) obamacare.precio = precio;
  if (!elegibilidad.vacio) obamacare.elegibilidad = elegibilidad.valor;
  if (!taxes.vacio) obamacare.personas_taxes = taxes.valor;
  if (!cobertura.vacio) obamacare.personas_cobertura = cobertura.valor;
  if (!ingreso.vacio) obamacare.ingreso_familiar_anual = ingreso.valor;

  const encabezadoNombre = buscarEtiquetas(celdas, "NOMBRE", filtro).find((item) => {
    return celdas.some((otro) => otro.r === item.r && otro.etiqueta === "PARENTESCO");
  });
  const integrantes = [];
  if (encabezadoNombre) {
    const columnas = {};
    celdas.filter((item) => item.r === encabezadoNombre.r && item.etiqueta).forEach((item) => {
      columnas[item.etiqueta] = item.c;
    });
    for (let r = encabezadoNombre.r + 1; r <= encabezadoNombre.r + 12; r += 1) {
      if (cortePago != null && r >= cortePago) break;
      const nombreCell = celdas.find((item) => item.r === r && item.c === columnas.NOMBRE);
      const nombre = nombreCell ? valorConfirmado(nombreCell.cell, "texto") : { vacio: true };
      if (nombre.vacio) continue;
      const leerCol = (etiqueta, modo) => {
        const col = columnas[etiqueta];
        if (col == null) return null;
        const cell = celdas.find((item) => item.r === r && item.c === col);
        if (!cell) return null;
        const leido = valorConfirmado(cell.cell, modo);
        return leido.vacio ? null : leido.valor;
      };
      integrantes.push({
        nombre: nombre.valor,
        parentesco: leerCol("PARENTESCO", "texto"),
        fecha_activacion: leerCol("F.ACTIVACION", "fecha"),
        fecha_cancelacion: leerCol("F. CANCELACION", "fecha"),
      });
    }
  }
  obamacare.integrantes = integrantes;
  if (!Object.keys(obamacare).some((key) => key !== "integrantes" && obamacare[key] != null) && integrantes.length === 0) {
    advertencias.push({
      codigo: "obamacare_vacio",
      mensaje: "La hoja Obamacare no tiene datos confirmados.",
      hoja: "OBAMACARE",
    });
  }
  return { obamacare, advertencias };
}

function extraerCarta(sheet) {
  const celdas = celdasDeHoja(sheet);
  if (celdas?.error) return { carta: null, advertencias: [] };
  const ingresoEtiqueta = celdas.find((item) => item.etiqueta && item.etiqueta.startsWith("INGRESO FAMILIAR ANUAL ESPERADO"));
  let ingreso = null;
  if (ingresoEtiqueta) {
    const leido = valorALaDerecha(celdas, ingresoEtiqueta, "dinero");
    if (!leido.vacio) ingreso = leido.valor;
    if (leido.vacio) {
      const numerica = celdas.find((item) => item.r === ingresoEtiqueta.r && item.c > ingresoEtiqueta.c && typeof item.cell.v === "number" && item.cell.v !== 0);
      if (numerica) ingreso = Math.round(numerica.cell.v * 100) / 100;
    }
  }
  return {
    carta: { ingreso_familiar_esperado: ingreso },
    advertencias: [],
  };
}

function contrastar(personas, obamacare, carta) {
  const advertencias = [];
  if (carta?.ingreso_familiar_esperado != null && obamacare?.ingreso_familiar_anual != null) {
    if (Number(carta.ingreso_familiar_esperado) !== Number(obamacare.ingreso_familiar_anual)) {
      advertencias.push({
        codigo: "diferencia_ingreso_familiar",
        mensaje: "El ingreso familiar de Obamacare y el ingreso esperado de la carta no coinciden. No se resolvió solo.",
      });
    }
  }
  const nombres = new Set(personas.map((persona) => normalizarEtiqueta(persona.campos.nombre_completo || "")));
  (obamacare?.integrantes || []).forEach((integrante) => {
    const nombre = normalizarEtiqueta(integrante.nombre || "");
    if (nombre && !nombres.has(nombre)) {
      advertencias.push({
        codigo: "integrante_obamacare_sin_hoja",
        mensaje: "Un integrante de Obamacare no coincide con las hojas de personas. Queda pendiente de revisión.",
      });
    }
  });
  return advertencias;
}

export function validarContenedorExcel(bytes) {
  const buffer = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (buffer.byteLength === 0) {
    return { ok: false, mensaje: "El archivo está vacío." };
  }
  if (buffer.byteLength > LIMITE_BYTES_EXCEL) {
    return { ok: false, mensaje: "El archivo supera el límite de 8 MB." };
  }
  if (buffer[0] === 0xd0 && buffer[1] === 0xcf) {
    return {
      ok: false,
      mensaje: "Este archivo es Excel binario. Esta entrega solo admite .xlsx OOXML. Los .xlsb y los .xlsx con contenido binario no se importan.",
    };
  }
  if (!(buffer[0] === 0x50 && buffer[1] === 0x4b)) {
    return {
      ok: false,
      mensaje: "El contenido no es un .xlsx OOXML. Esta entrega no admite .xlsb ni archivos .xlsx con contenido binario.",
    };
  }
  const muestra = new TextDecoder("iso-8859-1").decode(buffer.subarray(0, Math.min(buffer.byteLength, 200000)));
  if (muestra.includes("workbook.bin") || muestra.includes("spreadsheetml.sheet.binary")) {
    return {
      ok: false,
      mensaje: "El archivo es Excel binario (.xlsb), aunque la extensión diga otra cosa. No se importó nada.",
    };
  }
  return { ok: true };
}

export function extraerLibroPreRenovacion(workbook) {
  const advertencias = [];
  const hojas = workbook?.SheetNames || [];
  if (!hojas.length) {
    return { ok: false, mensaje: "El archivo no tiene hojas reconocibles." };
  }
  const personas = [];
  let obamacare = null;
  let carta = null;
  let hayTitular = false;
  const hojasIgnoradas = [];
  const hojasReconocidas = [];

  hojas.forEach((nombre) => {
    const tipo = clasificarHoja(nombre);
    const sheet = workbook.Sheets[nombre];
    if (tipo === "fuera") {
      hojasIgnoradas.push(nombre);
      return;
    }
    if (tipo === "desconocida") {
      advertencias.push({
        codigo: "hoja_no_reconocida",
        mensaje: `La hoja "${nombre}" no forma parte de la plantilla reconocida y se ignoró.`,
        hoja: nombre,
      });
      return;
    }
    hojasReconocidas.push(nombre);
    if (tipo === "titular" || tipo === "conyuge" || tipo === "dependiente") {
      if (tipo === "titular") hayTitular = true;
      const extraido = extraerPersona(sheet, { hoja: nombre, rol: tipo });
      advertencias.push(...extraido.advertencias);
      if (extraido.persona) personas.push(extraido.persona);
      return;
    }
    if (tipo === "obamacare") {
      const extraido = extraerObamacare(sheet);
      obamacare = extraido.obamacare;
      advertencias.push(...extraido.advertencias);
      return;
    }
    if (tipo === "carta") {
      const extraido = extraerCarta(sheet);
      carta = extraido.carta;
    }
  });

  if (!hayTitular) {
    return {
      ok: false,
      mensaje: "No se encontró la hoja DATOS DEL CLIENTE. No se importó nada.",
    };
  }

  advertencias.push(...contrastar(personas, obamacare, carta));
  if (!obamacare) {
    advertencias.push({
      codigo: "obamacare_ausente",
      mensaje: "No está la hoja OBAMACARE. Los datos de póliza de esa hoja quedan pendientes.",
    });
  }

  return {
    ok: true,
    extraccion: {
      version: 1,
      hojas_reconocidas: hojasReconocidas,
      hojas_ignoradas: hojasIgnoradas,
      advertencias,
      personas,
      obamacare,
      carta,
    },
  };
}

export function leerPreRenovacionExcel(bytes) {
  const contenedor = validarContenedorExcel(bytes);
  if (!contenedor.ok) return { ok: false, mensaje: contenedor.mensaje };
  let workbook;
  try {
    workbook = XLSX.read(bytes, {
      type: "array",
      cellDates: true,
      cellFormula: true,
      cellStyles: false,
      bookVBA: false,
      WTF: false,
    });
  } catch {
    return {
      ok: false,
      mensaje: "No se pudo leer el archivo como .xlsx OOXML. No se importó nada.",
    };
  }
  if (workbook?.vbaraw) {
    return { ok: false, mensaje: "El archivo contiene macros y no se procesa." };
  }
  return extraerLibroPreRenovacion(workbook);
}
