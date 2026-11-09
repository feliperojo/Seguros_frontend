import assert from "node:assert/strict";
import test from "node:test";
import { puedeCompletarTarea } from "./puedeCompletarTarea.js";

test("el mismo id numérico permite completar", () => {
  assert.equal(puedeCompletarTarea({ id: 15 }, { assigned_user_id: 15 }), true);
});

test("el mismo id como número y como cadena permite completar", () => {
  assert.equal(puedeCompletarTarea({ id: "15" }, { assigned_user_id: 15 }), true);
  assert.equal(puedeCompletarTarea({ id: 15 }, { assigned_user_id: "15" }), true);
  assert.equal(puedeCompletarTarea({ user_id: " 15 " }, { assigned_user_id: 15 }), true);
});

test("el mismo nombre con otro id no permite completar", () => {
  assert.equal(
    puedeCompletarTarea(
      { id: 8, name: "Ana Pérez" },
      { assigned_user_id: 15, asignado_a: "Ana Pérez", responsable: "Ana Pérez" }
    ),
    false
  );
});

test("otro nombre con el mismo id permite completar", () => {
  assert.equal(
    puedeCompletarTarea(
      { id: 15, name: "Carlos" },
      { assigned_user_id: 15, asignado_a: "Ana Pérez" }
    ),
    true
  );
});

test("un id ausente o inválido no permite completar", () => {
  assert.equal(puedeCompletarTarea({ id: 15 }, { assigned_user_id: null }), false);
  assert.equal(puedeCompletarTarea({ id: 15 }, {}), false);
  assert.equal(puedeCompletarTarea({ id: 15 }, { assigned_user_id: 0 }), false);
  assert.equal(puedeCompletarTarea({ id: 15 }, { assigned_user_id: "abc" }), false);
  assert.equal(puedeCompletarTarea({ id: 15 }, { assigned_user_id: 1.5 }), false);
  assert.equal(puedeCompletarTarea(null, { assigned_user_id: 15 }), false);
  assert.equal(puedeCompletarTarea({ id: "0" }, { assigned_user_id: 15 }), false);
});

test("un alias distinto no reemplaza el id canónico válido", () => {
  const tarea = {
    assigned_user_id: 15,
    assign_to_user_id: 8,
    assigned_user: { id: 8, name: "Ana Pérez" },
    log: { assigned_user_id: 8 },
  };
  assert.equal(puedeCompletarTarea({ id: 8, name: "Ana Pérez" }, tarea), false);
  assert.equal(puedeCompletarTarea({ id: 15, name: "Otra persona" }, tarea), true);
});

test("una mención o users.view no conceden completar", () => {
  const usuario = { id: 8, name: "Ana Pérez", permissions: ["users.view"], mentioned: true };
  const tarea = { assigned_user_id: 15, mentioned_user_ids: [8], fromNotification: true };
  assert.equal(puedeCompletarTarea(usuario, tarea), false);
});

test("sin id canónico usa un id alterno real y no el nombre", () => {
  assert.equal(puedeCompletarTarea({ id: 15 }, { assign_to_user_id: "15", asignado_a: "Ana" }), true);
  assert.equal(puedeCompletarTarea({ id: 15 }, { assigned_user: { id: 15 }, asignado_a: "Ana" }), true);
  assert.equal(puedeCompletarTarea({ id: 8, name: "Ana" }, { asignado_a: "Ana" }), false);
});
