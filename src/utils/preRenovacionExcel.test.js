import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";
import {
  extraerLibroPreRenovacion,
  leerPreRenovacionExcel,
  validarContenedorExcel,
} from "./preRenovacionExcel.js";

function libroDesdeHojas(hojas) {
  const workbook = XLSX.utils.book_new();
  Object.entries(hojas).forEach(([nombre, sheet]) => {
    if (!sheet["!ref"]) {
      const refs = Object.keys(sheet).filter((key) => !key.startsWith("!"));
      if (refs.length) sheet["!ref"] = refs[0];
    }
    XLSX.utils.book_append_sheet(workbook, sheet, nombre);
  });
  return workbook;
}

function texto(valor) {
  return { t: "s", v: valor };
}

function hojaPersona(parcial = {}) {
  const sheet = {
    C8: texto("DATOS DEL TITULAR DE LA POLIZA"),
    C12: texto("1ER NOMBRE"),
    F12: texto("2DO NOMBRE"),
    I12: texto("APELLIDOS"),
    G10: texto("FECHA DE NACIMIENTO"),
    J10: texto("EDAD"),
    L10: texto("COBERTURA"),
    C18: texto("SOCIAL"),
    E18: texto("STATUS"),
    C26: texto("TELEFONO"),
    C30: texto("CALLE"),
    C35: texto("DATOS DE EMPLEO E INGRESO"),
    C37: texto("TIPO DE INGRESO"),
    F37: texto("EMPLEADOR O ACTIVIDAD"),
    C39: texto("PERIODO DE INGRESO"),
    F39: texto("VR. DEL INGRESO POR PERIODO"),
    J39: texto("INGRESO ANUAL"),
    C43: texto("INGRESO POR HORAS IRREGULARES"),
    C59: texto("DATOS DE CUENTAS DEL USUARIO EN ASEGURADORA"),
    C61: texto("USUARIO"),
    G61: texto("CLAVE"),
    "!ref": "A1:N70",
  };
  Object.assign(sheet, parcial);
  return sheet;
}

test("lee titular, cónyuge y dependiente con cobertura NO sin crear hojas vacías", () => {
  const titular = hojaPersona({
    D12: texto("Ana"),
    G12: texto("Luisa"),
    J12: texto("Pérez"),
    I10: { t: "d", v: new Date(1990, 4, 2) },
    M10: texto("SI"),
    D18: texto("001234567"),
    F18: texto("CIUDADANO"),
    D26: texto("5551112222"),
    D30: texto("Calle 10"),
    E37: texto("W2"),
    I37: texto("Taller"),
    E39: texto("MENSUAL"),
    I39: { t: "n", v: 1000 },
    L39: { t: "n", v: 12000, f: "I39*12" },
    G61: texto("secreto-no-leer"),
  });
  const conyuge = hojaPersona({
    D12: texto("Luis"),
    J12: texto("Pérez"),
    M10: texto("SI"),
    D18: texto("008887776"),
  });
  const dependiente = hojaPersona({
    D12: texto("Nino"),
    J12: texto("Pérez"),
    M10: texto("NO"),
    D18: texto("004445556"),
  });
  const vacio = hojaPersona();
  const resultado = extraerLibroPreRenovacion(libroDesdeHojas({
    "VIDA": {},
    "DEPENDIENTE 2": vacio,
    "DATOS DEL CONYUGE": conyuge,
    "DEPENDIENTE 1": dependiente,
    "DATOS DEL CLIENTE": titular,
    "OBAMACARE": {
      C8: texto("DATOS DE LA POLIZA OBAMACARE"),
      C10: texto("COMPAÑIA"),
      D10: texto("OSCAR"),
      G10: texto("PLAN ELEGIDO"),
      H10: texto("Bronze Classic"),
      K10: texto("METAL"),
      L10: texto("BRONCE"),
      M10: texto("PRECIO $"),
      N10: { t: "n", v: 320.5 },
      F12: texto("# PERSONAS EN TAXES"),
      H12: { t: "n", v: 3 },
      I12: texto("# PERSONAS COBERTURA"),
      K12: { t: "n", v: 2 },
      L12: texto("INGRESO FAMILIAR ANUAL"),
      N12: { t: "n", v: 40000, f: "SUM(A1)" },
      C20: texto("PERSONAS CON COBERTURA"),
      D22: texto("NOMBRE"),
      G22: texto("PARENTESCO"),
      H22: texto("F.ACTIVACION"),
      D23: texto("Ana Luisa Pérez"),
      G23: texto("TOMADOR"),
      C33: texto("DATOS DE PAGO"),
      C46: texto("CVV"),
      D46: texto("4321"),
      "!ref": "A1:N60",
    },
    "CARTA CONFIRMACION DE DATOS": {
      A15: texto("Ingreso Familiar anual esperado aprox.  para el año"),
      D15: { t: "n", v: 41000 },
      "!ref": "A1:H20",
    },
  }));

  assert.equal(resultado.ok, true);
  assert.equal(resultado.extraccion.personas.length, 3);
  const persona = resultado.extraccion.personas.find((item) => item.rol_hoja === "titular");
  assert.equal(persona.rol_hoja, "titular");
  assert.equal(persona.campos.social, "001234567");
  assert.equal(persona.campos.fecha_nacimiento, "1990-05-02");
  assert.equal(persona.campos.nombre_completo, "Ana Luisa Pérez");
  assert.equal(persona.campos.ingreso_anual, 12000);
  assert.equal(persona.campos.calle, "Calle 10");
  assert.equal("edad" in persona.campos, false);
  assert.equal("clave" in persona.campos, false);
  const personaSinCobertura = resultado.extraccion.personas.find((item) => item.rol_hoja === "dependiente");
  assert.equal(personaSinCobertura.cobertura_excel, "NO");
  assert.equal(resultado.extraccion.obamacare.compania, "OSCAR");
  assert.equal(resultado.extraccion.obamacare.precio, 320.5);
  assert.equal(resultado.extraccion.obamacare.personas_taxes, 3);
  assert.equal(JSON.stringify(resultado.extraccion).includes("4321"), false);
  assert.equal(JSON.stringify(resultado.extraccion).includes("secreto-no-leer"), false);
  assert.ok(resultado.extraccion.advertencias.some((item) => item.codigo === "hoja_vacia"));
  assert.ok(resultado.extraccion.advertencias.some((item) => item.codigo === "diferencia_ingreso_familiar"));
  assert.ok(resultado.extraccion.hojas_ignoradas.includes("VIDA"));
});

test("un cero calculado y un texto vacío no confirman datos", () => {
  const sheet = hojaPersona({
    D12: texto("   , "),
    J12: texto(" "),
    L39: { t: "n", v: 0, f: "I39*12" },
    I39: { t: "n", v: 0, f: "0" },
  });
  const resultado = extraerLibroPreRenovacion(libroDesdeHojas({
    "DATOS DEL CLIENTE": hojaPersona({
      D12: texto("Ana"),
      J12: texto("Pérez"),
    }),
    "DEPENDIENTE 1": sheet,
  }));
  assert.equal(resultado.ok, true);
  assert.equal(resultado.extraccion.personas.length, 1);
  assert.equal(resultado.extraccion.personas[0].campos.ingreso_anual, undefined);
});

test("rechaza binario, xlsb y zip que no es un libro", () => {
  const ole = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0, 0]);
  assert.match(validarContenedorExcel(ole).mensaje, /binario/i);

  const xlsb = new Uint8Array(300);
  xlsb[0] = 0x50;
  xlsb[1] = 0x4b;
  const marca = new TextEncoder().encode("xl/workbook.bin");
  xlsb.set(marca, 30);
  assert.match(leerPreRenovacionExcel(xlsb).mensaje, /xlsb/i);

  const zipRoto = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]);
  const leido = leerPreRenovacionExcel(zipRoto);
  assert.equal(leido.ok, false);
});

test("una hoja desconocida no impide leer el titular y no crea personas", () => {
  const resultado = extraerLibroPreRenovacion(libroDesdeHojas({
    "OTRA COSA": { A1: texto("x"), "!ref": "A1" },
    "DATOS DEL CLIENTE": hojaPersona({
      D12: texto("Ana"),
      J12: texto("Pérez"),
      M10: texto("NO"),
    }),
  }));
  assert.equal(resultado.ok, true);
  assert.equal(resultado.extraccion.personas.length, 1);
  assert.equal(resultado.extraccion.personas[0].cobertura_excel, "NO");
  assert.ok(resultado.extraccion.advertencias.some((item) => item.codigo === "hoja_no_reconocida"));
  assert.ok(resultado.extraccion.advertencias.some((item) => item.codigo === "obamacare_ausente"));
});

test("sin la hoja del titular no devuelve datos", () => {
  const resultado = extraerLibroPreRenovacion(libroDesdeHojas({
    "DATOS DEL CONYUGE": hojaPersona({ D12: texto("Luis"), J12: texto("Pérez") }),
  }));
  assert.equal(resultado.ok, false);
});
