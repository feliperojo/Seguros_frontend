import assert from "node:assert/strict";
import test from "node:test";
import {
  prepararCorreosContacto,
  prepararTelefonosContacto,
} from "./contactoFicha.js";

test("arma WhatsApp y llamada con el indicativo guardado, sin cambiar el número", () => {
  const original = {
    id: 7,
    indicativo: "1",
    numero: "(305) 555-1234",
    tipo: "Móvil",
    principal: true,
  };
  const [telefono] = prepararTelefonosContacto({ telefonos: [original] });

  assert.equal(telefono.visible, "+1 305-555-1234 (Móvil) [Principal]");
  assert.equal(telefono.numero, "+1 305-555-1234");
  assert.equal(telefono.tipo, "Móvil");
  assert.equal(telefono.principal, true);
  assert.equal(telefono.bandera, "🇺🇸");
  assert.equal(telefono.pais, "United States");
  assert.equal(telefono.copiar, "+1 305-555-1234");
  assert.equal(telefono.copiar.includes("🇺🇸"), false);
  assert.equal(telefono.whatsapp, "https://wa.me/13055551234");
  assert.equal(telefono.llamar, "tel:+13055551234");
  assert.equal(original.numero, "(305) 555-1234");
});

test("no inventa código de país cuando el teléfono no lo tiene", () => {
  const [telefono] = prepararTelefonosContacto({
    telefonos: [{ numero: "305-555-1234", tipo: "Casa", principal: false }],
  });

  assert.equal(telefono.visible, "305-555-1234 (Casa)");
  assert.equal(telefono.numero, "305-555-1234");
  assert.equal(telefono.tipo, "Casa");
  assert.equal(telefono.principal, false);
  assert.equal(telefono.bandera, null);
  assert.equal(telefono.whatsapp, "https://wa.me/3055551234");
  assert.equal(telefono.llamar, "tel:3055551234");
  assert.equal(telefono.whatsapp.includes("+"), false);
});

test("cada teléfono conserva su propio destino", () => {
  const telefonos = prepararTelefonosContacto({
    telefonos: [
      { numero: "3051111111", indicativo: "57", tipo: "Trabajo", principal: false },
      { numero: "3052222222", indicativo: "1", tipo: "Móvil", principal: true },
    ],
  });

  assert.equal(telefonos[0].whatsapp, "https://wa.me/13052222222");
  assert.equal(telefonos[1].whatsapp, "https://wa.me/573051111111");
});

test("un teléfono sin dígitos no genera enlaces", () => {
  const [telefono] = prepararTelefonosContacto({
    telefonos: [{ numero: "", tipo: "Móvil", principal: true }],
  });
  assert.equal(telefono, undefined);

  const [legacy] = prepararTelefonosContacto({ telefono: "sin número" });
  assert.equal(legacy.visible, "sin número");
  assert.equal(legacy.whatsapp, null);
  assert.equal(legacy.llamar, null);
  assert.equal(legacy.copiar, null);
});

test("el indicativo conocido muestra su bandera y un ISO guardado tiene prioridad", () => {
  const [colombia] = prepararTelefonosContacto({
    telefonos: [{ numero: "3001112233", indicativo: "57", tipo: "Móvil" }],
  });
  assert.equal(colombia.bandera, "🇨🇴");
  assert.equal(colombia.pais, "Colombia");
  assert.equal(colombia.copiar, "+57 300-111-2233");

  const [canada] = prepararTelefonosContacto({
    telefonos: [{ numero: "4165550199", indicativo: "1", iso: "ca", tipo: "Casa" }],
  });
  assert.equal(canada.bandera, "🇨🇦");
  assert.equal(canada.numero, "+1 416-555-0199");

  const [desconocido] = prepararTelefonosContacto({
    telefonos: [{ numero: "5550100", indicativo: "999", tipo: "Trabajo" }],
  });
  assert.equal(desconocido.bandera, null);
  assert.equal(desconocido.numero, "+999 5550100");
});

test("un teléfono sin tipo no recibe una etiqueta inventada", () => {
  const [telefono] = prepararTelefonosContacto({
    telefonos: [{ numero: "3055550199", indicativo: "1", tipo: "   ", principal: false }],
  });

  assert.equal(telefono.numero, "+1 305-555-0199");
  assert.equal(telefono.tipo, null);
  assert.equal(telefono.principal, false);
  assert.equal(telefono.whatsapp, "https://wa.me/13055550199");
});

test("sin teléfonos devuelve una lista vacía", () => {
  assert.deepEqual(prepararTelefonosContacto({}), []);
  assert.deepEqual(prepararTelefonosContacto({ telefonos: [], telefono: "" }), []);
});

test("el correo usa mailto sin cuerpo y un valor inválido no crea enlace", () => {
  const [correo] = prepararCorreosContacto("ana@example.com");
  assert.equal(correo.mailto, "mailto:ana@example.com");
  assert.equal(correo.mailto.includes("?"), false);

  const [invalido] = prepararCorreosContacto("no es correo");
  assert.equal(invalido.visible, "no es correo");
  assert.equal(invalido.mailto, null);

  assert.deepEqual(prepararCorreosContacto(null), []);
  assert.deepEqual(prepararCorreosContacto("   "), []);
});

test("respeta varios correos cuando el dato ya viene como lista", () => {
  const correos = prepararCorreosContacto([
    "ana@example.com",
    { email: "beth@example.com" },
  ]);
  assert.deepEqual(correos.map((correo) => correo.mailto), [
    "mailto:ana@example.com",
    "mailto:beth@example.com",
  ]);
});
