/**
 * Prueba de regresión: clasificación retiro programado vs efectivo.
 * Ejecutar: npx vite-node scripts/test-retiro-clasificacion.mjs
 */
import {
  isFechaActivacionPendiente,
  isFechaRetiroProgramada,
  isFechaRetiroEfectiva,
  esMiembroEnSeccionRetirados,
  debeResaltarRetiroMiembro,
  esElegibleParaCopiarEntreMiembros,
  esCierreFiscalPorRenovacionAnual,
  etiquetaAvisoRetiroMiembro,
} from "../src/utils/estadoPoliza.js";

const now = new Date(2026, 8, 16); // 2026-09-16 (local)
let passed = 0;
let failed = 0;

function assert(name, actual, expected) {
  const ok = Object.is(actual, expected);
  if (ok) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${name}\n    expected: ${expected}\n    actual:   ${actual}`);
  }
}

function splitLikeTomaDeDatos(members) {
  const active = [];
  const inactive = [];
  for (const m of members) {
    if (esMiembroEnSeccionRetirados(m, now)) inactive.push(m);
    else active.push(m);
  }
  return { active, inactive };
}

console.log("\n1) Fechas de retiro (helpers)");
assert("futuro es programado", isFechaRetiroProgramada("2026-12-31", now), true);
assert("futuro NO es efectivo", isFechaRetiroEfectiva("2026-12-31", now), false);
assert("hoy NO es programado", isFechaRetiroProgramada("2026-09-16", now), false);
assert("hoy SÍ es efectivo", isFechaRetiroEfectiva("2026-09-16", now), true);
assert("pasado es efectivo", isFechaRetiroEfectiva("2026-01-01", now), true);
assert("pasado NO es programado", isFechaRetiroProgramada("2026-01-01", now), false);
assert("sin fecha → programado false", isFechaRetiroProgramada(null, now), false);
assert("sin fecha → efectivo false", isFechaRetiroEfectiva(null, now), false);
assert("ISO midnight UTC no desfase día", isFechaRetiroProgramada("2026-12-31T00:00:00.000000Z", now), true);

console.log("\n2) Sección Miembros Retirados vs activos");
assert(
  "retiro futuro + activo=false → NO sección retirados",
  esMiembroEnSeccionRetirados({ activo: false, fecha_retiro: "2026-12-31" }, now),
  false
);
assert(
  "retiro pasado + activo=false → SÍ sección retirados",
  esMiembroEnSeccionRetirados({ activo: false, fecha_retiro: "2026-01-01" }, now),
  true
);
assert(
  "retiro hoy → SÍ sección retirados",
  esMiembroEnSeccionRetirados({ activo: false, fecha_retiro: "2026-09-16" }, now),
  true
);
assert(
  "anulación → SÍ sección retirados",
  esMiembroEnSeccionRetirados({ activo: false, fecha_anulacion: "2026-09-01" }, now),
  true
);
assert(
  "legacy activo=false sin fecha → SÍ sección retirados",
  esMiembroEnSeccionRetirados({ activo: false }, now),
  true
);
assert(
  "miembro normal → NO sección retirados",
  esMiembroEnSeccionRetirados({ activo: true, estado_cobertura: "Sí" }, now),
  false
);

console.log("\n3) Resaltado amarillo");
assert(
  "programado se resalta",
  debeResaltarRetiroMiembro({ activo: false, fecha_retiro: "2026-12-31" }, now),
  true
);
assert(
  "efectivo se resalta",
  debeResaltarRetiroMiembro({ activo: false, fecha_retiro: "2026-01-01" }, now),
  true
);
assert(
  "activo normal NO se resalta",
  debeResaltarRetiroMiembro({ activo: true }, now),
  false
);

console.log("\n4) Split tipo TomaDeDatos (caso screenshot)");
const onyx = {
  nombre: "Onyx",
  activo: true,
  fecha_retiro: null,
};
const kiara = {
  nombre: "Kiara",
  activo: false,
  fecha_retiro: "2026-12-31",
};
const retiradoReal = {
  nombre: "RetiradoReal",
  activo: false,
  fecha_retiro: "2026-08-01",
};
const { active, inactive } = splitLikeTomaDeDatos([onyx, kiara, retiradoReal]);
assert("activos incluye Onyx", active.some((m) => m.nombre === "Onyx"), true);
assert("activos incluye Kiara (programado)", active.some((m) => m.nombre === "Kiara"), true);
assert("retirados NO incluye Kiara", inactive.some((m) => m.nombre === "Kiara"), false);
assert("retirados incluye RetiradoReal", inactive.some((m) => m.nombre === "RetiradoReal"), true);
assert("Kiara se resalta en activos", debeResaltarRetiroMiembro(kiara, now), true);

console.log("\n5) Regresión: helpers previos intactos");
assert(
  "activación futura pendiente",
  isFechaActivacionPendiente("2026-12-01", now),
  true
);
assert(
  "activación pasada no pendiente",
  isFechaActivacionPendiente("2026-01-01", now),
  false
);
assert(
  "copiar: activo sin retiro elegible",
  esElegibleParaCopiarEntreMiembros({
    activo: true,
    fecha_retiro: null,
    fecha_cancelacion: null,
  }),
  true
);
assert(
  "copiar: con fecha_retiro NO elegible (aunque programado)",
  esElegibleParaCopiarEntreMiembros({
    activo: false,
    fecha_retiro: "2026-12-31",
  }),
  false
);
assert(
  "copiar: activo=false NO elegible",
  esElegibleParaCopiarEntreMiembros({ activo: false }),
  false
);

console.log("\n6) Cierre fiscal por renovación anual (títulos)");

const miembroRenovado = {
  fue_renovado: true,
  fecha_retiro: "2026-12-31",
  activo: true,
};
const miembroNoRenueva = {
  fue_renovado: false,
  fecha_retiro: "2026-12-31",
  activo: false,
  motivo_retiro: "No renovará: el cliente no continúa al siguiente período",
};
const retiroOperativo = {
  fue_renovado: false,
  fecha_retiro: "2026-12-31",
  activo: false,
  motivo_retiro: "Cambio de vida",
};

assert("renovado es cierre fiscal", esCierreFiscalPorRenovacionAnual(miembroRenovado), true);
assert("no-renueva es cierre fiscal", esCierreFiscalPorRenovacionAnual(miembroNoRenueva), true);
assert(
  "omitida_renovacion es cierre fiscal",
  esCierreFiscalPorRenovacionAnual({
    omitida_renovacion: true,
    fecha_retiro: "2026-12-31",
  }),
  true
);
assert(
  "Terminado es cierre fiscal",
  esCierreFiscalPorRenovacionAnual({
    cobertura_definida: "Terminado",
    fecha_retiro: "2026-12-31",
  }),
  true
);
assert(
  "retiro operativo NO es cierre fiscal",
  esCierreFiscalPorRenovacionAnual(retiroOperativo),
  false
);
assert(
  "banner renovado programado",
  etiquetaAvisoRetiroMiembro(miembroRenovado, now),
  "Programado para cierre fiscal 2026"
);
assert(
  "banner no-renueva programado",
  etiquetaAvisoRetiroMiembro(miembroNoRenueva, now),
  "Programado para cierre fiscal 2026"
);
assert(
  "banner operativo programado",
  etiquetaAvisoRetiroMiembro(retiroOperativo, now),
  "Retiro programado del Grupo Familiar"
);

const now2027 = new Date(2027, 0, 15);
assert(
  "banner renovado efectivo ene-2027",
  etiquetaAvisoRetiroMiembro(miembroRenovado, now2027),
  "Cierre fiscal 2026"
);
assert(
  "banner no-renueva efectivo ene-2027",
  etiquetaAvisoRetiroMiembro(miembroNoRenueva, now2027),
  "Cierre fiscal 2026"
);
assert(
  "banner operativo efectivo",
  etiquetaAvisoRetiroMiembro(retiroOperativo, now2027),
  "Retirado del Grupo Familiar"
);

console.log(`\nResultado: ${passed} ok, ${failed} fallos\n`);
if (failed > 0) process.exit(1);
console.log("OK — nada roto en la clasificación de retiros.\n");
