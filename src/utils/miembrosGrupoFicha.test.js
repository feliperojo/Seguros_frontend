import assert from "node:assert/strict";
import test from "node:test";
import { miembrosVisiblesDelGrupo } from "./miembrosGrupoFicha.js";

const cobertura = (extra) => ({
  cliente_id: extra.clienteId,
  parentesco: extra.parentesco ?? null,
  cobertura_tipo: extra.cobertura_tipo ?? "",
  plan: extra.plan ?? "",
  estado_cobertura: extra.estado_cobertura ?? "",
  cliente: {
    id: extra.clienteId,
    nombre_completo: extra.nombre,
    telefono: extra.telefono,
    email: extra.email,
  },
});

test("omite a quien ya está en la ficha y resume el plan de los demás", () => {
  const miembros = miembrosVisiblesDelGrupo([
    cobertura({
      clienteId: 10,
      nombre: "Ana Ruiz",
      parentesco: "Tomador",
      cobertura_tipo: "Plan de salud",
      plan: "Silver",
      telefono: "3050000000",
    }),
    cobertura({
      clienteId: 10,
      nombre: "Ana Ruiz",
      parentesco: "Tomador",
      cobertura_tipo: "Dental MS",
      plan: "DHMO",
    }),
    cobertura({
      clienteId: 22,
      nombre: "Luis Ruiz",
      parentesco: "Hijo",
      cobertura_tipo: "Plan de salud",
      estado_cobertura: "Medicare",
      plan: "Plan G",
      email: "luis@example.com",
    }),
  ], 10);

  assert.equal(miembros.length, 1);
  assert.equal(miembros[0].clienteId, 22);
  assert.equal(miembros[0].relacion, "Hijo");
  assert.deepEqual(miembros[0].coberturas, ["Plan de salud · Medicare · Plan G"]);
});

test("un solo miembro, el de la ficha, no deja otros ni inventa parentesco", () => {
  const miembros = miembrosVisiblesDelGrupo([
    cobertura({ clienteId: 5, nombre: "Marta Díaz", parentesco: "" }),
  ], 5);

  assert.deepEqual(miembros, []);
});

test("sin coberturas o sin cliente identificable no crea miembros", () => {
  assert.deepEqual(miembrosVisiblesDelGrupo([], 1), []);
  assert.deepEqual(miembrosVisiblesDelGrupo(null, 1), []);
  assert.deepEqual(miembrosVisiblesDelGrupo([
    { parentesco: "Cónyuge", cliente: { nombre_completo: "Sin id", telefono: "3051111111" } },
  ], 1), []);
});

test("al cambiar el grupo, la lista depende solo de los otros miembros", () => {
  const grupoA = miembrosVisiblesDelGrupo([
    cobertura({ clienteId: 1, nombre: "Ana", parentesco: "Tomador", cobertura_tipo: "Plan de salud" }),
    cobertura({ clienteId: 2, nombre: "Beto", parentesco: "Cónyuge", estado_cobertura: "Medicaid", plan: "Plus" }),
  ], 1);
  const grupoB = miembrosVisiblesDelGrupo([
    cobertura({ clienteId: 1, nombre: "Ana", parentesco: "Hijo" }),
  ], 1);

  assert.equal(grupoA.length, 1);
  assert.equal(grupoA[0].relacion, "Cónyuge");
  assert.deepEqual(grupoA[0].coberturas, ["Medicaid · Plus"]);
  assert.deepEqual(grupoB, []);
});

test("salud y dental del mismo familiar quedan en una sola fila", () => {
  const [miembro] = miembrosVisiblesDelGrupo([
    cobertura({ clienteId: 8, nombre: "Eva", parentesco: "Hija", cobertura_tipo: "Dental MS", plan: "Kids" }),
    cobertura({ clienteId: 8, nombre: "Eva", parentesco: "Hija", cobertura_tipo: "Plan de salud", plan: "Gold" }),
  ], 1);

  assert.equal(miembro.clienteId, 8);
  assert.deepEqual(miembro.coberturas, ["Plan de salud · Gold", "Dental MS · Kids"]);
});
