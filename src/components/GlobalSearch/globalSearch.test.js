import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_RESULTS,
  activarEnlaceNuevaPestana,
  atributosNuevaPestana,
  buildClienteFichaPath,
  buildGrupoFamiliarPath,
  clienteSearchPath,
  destinoResultado,
  esRutaCreacion,
  grupoSearchPath,
  isLatestRequest,
  mapClientesBusqueda,
  mapGruposBusqueda,
  messageForSearchFailure,
  sectionFromSettled,
  shouldSearch,
} from "./globalSearch.js";

test("no consulta con menos de 3 caracteres", () => {
  assert.equal(shouldSearch(""), false);
  assert.equal(shouldSearch("  ab "), false);
  assert.equal(shouldSearch(" ana"), true);
});

test("una respuesta vieja no reemplaza a la vigente", () => {
  assert.equal(isLatestRequest(2, 3), false);
  assert.equal(isLatestRequest(3, 3), true);
});

test("la ruta de clientes solo envía el nombre y no pide teléfono ni correo", () => {
  const path = clienteSearchPath(" Ana Ruiz ");
  assert.equal(path.startsWith("cliente/buscar-con-grupos?"), true);
  assert.equal(path.includes("q=Ana%20Ruiz"), true);
  assert.equal(path.includes("telefono"), false);
  assert.equal(path.includes("email"), false);
  assert.equal(path.includes("cliente/buscar?"), false);
});

test("la ruta de grupos pide una página corta y no altera otros filtros", () => {
  const path = grupoSearchPath(" familia ");
  const params = new URLSearchParams(path.split("?")[1]);
  assert.equal(path.startsWith("grupo_familiar/grupos-familiares-listado?"), true);
  assert.equal(params.get("search"), "familia");
  assert.equal(params.get("page"), "1");
  assert.equal(params.get("per_page"), String(MAX_RESULTS));
  assert.equal(params.get("estado"), null);
  assert.equal(params.get("anio"), null);
  assert.equal(params.get("telefono"), null);
});

test("de cada cliente conserva solo nombre e id", () => {
  const mapped = mapClientesBusqueda({
    data: [
      {
        cliente_id: 4,
        nombre_completo: "Ana Ruiz",
        email: "ana@example.com",
        telefonos: [{ numero: "3001112233" }],
        fecha_nacimiento: "1990-01-01",
        grupos: [{ grupo_familiar_id: 9, parentesco: "Tomador" }],
      },
      { cliente_id: 4, nombre_completo: "Ana Ruiz" },
      { cliente_id: 0, nombre_completo: "Invalido" },
      { cliente_id: 5, nombre_completo: "   " },
    ],
  });

  assert.deepEqual(mapped, [{ id: 4, nombre: "Ana Ruiz" }]);
  assert.equal("email" in mapped[0], false);
  assert.equal("grupos" in mapped[0], false);
});

test("muestra como máximo 8 clientes", () => {
  const data = Array.from({ length: 20 }, (_, index) => ({
    cliente_id: index + 1,
    nombre_completo: `Persona ${index + 1}`,
  }));
  assert.equal(mapClientesBusqueda({ data }).length, MAX_RESULTS);
});

test("de cada grupo conserva nombre, id y el año solo si el servidor lo envió", () => {
  const mapped = mapGruposBusqueda({
    status: "success",
    data: [
      {
        id: 3,
        anio_plan: 2024,
        tomador_nombre: "Ana Ruiz",
        persona_contacto: "Otra",
        responsable: "Agente",
        tags: ["vip"],
        compania_nombre: "Compañía",
        estado: "Activo",
      },
      {
        id: 8,
        anio_plan: null,
        tomador_nombre: "Sin asignar",
        persona_contacto: "Luis Gómez",
        responsable: "Agente",
      },
      {
        id: 9,
        tomador_nombre: "Sin asignar",
        persona_contacto: "",
      },
    ],
  });

  assert.deepEqual(mapped, [
    { id: 3, nombre: "Ana Ruiz", anioPlan: 2024 },
    { id: 8, nombre: "Luis Gómez", anioPlan: null },
    { id: 9, nombre: "Sin nombre", anioPlan: null },
  ]);
  assert.equal("responsable" in mapped[0], false);
  assert.equal("tags" in mapped[0], false);
});

test("abre la ficha y el grupo con las rutas reales", () => {
  assert.equal(buildClienteFichaPath(15), "/clientes/15/ficha");
  assert.equal(buildClienteFichaPath(0), null);
  assert.equal(buildGrupoFamiliarPath(9, null, 2026), "/grupo_familiar/9");
  assert.equal(buildGrupoFamiliarPath(9, 2026, 2026), "/grupo_familiar/9");
  assert.equal(buildGrupoFamiliarPath(9, 2024, 2026), "/grupo_familiar/9?anio=2024");
});

test("solo las rutas de creación abren otra pestaña", () => {
  assert.equal(esRutaCreacion("/clientes/crear"), true);
  assert.equal(esRutaCreacion("/grupofamiliar/crear"), true);
  assert.equal(esRutaCreacion("/CLIENTES/CREAR"), true);
  assert.equal(esRutaCreacion("/grupofamiliar/crear/"), true);
  assert.equal(esRutaCreacion("/grupofamiliar/crear?cliente_id=4"), true);
  assert.equal(esRutaCreacion("/clientes/crear#paso"), true);

  assert.equal(esRutaCreacion("/clientes/lista"), false);
  assert.equal(esRutaCreacion("/clientes/lista?next=/clientes/crear"), false);
  assert.equal(esRutaCreacion("/clientes/crear-borrador"), false);
  assert.equal(esRutaCreacion("/clientes/crear/extra"), false);
  assert.equal(esRutaCreacion("/grupofamiliar/lista"), false);
  assert.equal(esRutaCreacion("/grupo_familiar/9"), false);
  assert.equal(esRutaCreacion(""), false);
});

test("el enlace de otra pestaña reutiliza el destino y el año", () => {
  const cliente = atributosNuevaPestana(
    destinoResultado({ type: "cliente", id: 15 }, 2026)
  );
  assert.deepEqual(cliente, {
    href: "/clientes/15/ficha",
    target: "_blank",
    rel: "noopener noreferrer",
  });

  const grupo = atributosNuevaPestana(
    destinoResultado({ type: "grupo", id: 9, anioPlan: 2024 }, 2026)
  );
  assert.equal(grupo.href, "/grupo_familiar/9?anio=2024");
  assert.equal(grupo.target, "_blank");
  assert.equal(grupo.rel, "noopener noreferrer");
  assert.equal(grupo.href.includes("token"), false);

  const mismoAnio = atributosNuevaPestana(
    destinoResultado({ type: "grupo", id: 9, anioPlan: 2026 }, 2026)
  );
  assert.equal(mismoAnio.href, "/grupo_familiar/9");
  assert.equal(atributosNuevaPestana(null), null);
});

test("Enter solo activa el enlace real y no una navegación de respaldo", () => {
  let clics = 0;
  const enlace = {
    tagName: "A",
    getAttribute(nombre) {
      if (nombre === "href") return "/grupo_familiar/9?anio=2024";
      if (nombre === "target") return "_blank";
      if (nombre === "rel") return "noopener noreferrer";
      return null;
    },
    click() {
      clics += 1;
    },
  };

  assert.equal(activarEnlaceNuevaPestana(enlace), true);
  assert.equal(clics, 1);

  const boton = {
    tagName: "BUTTON",
    getAttribute() {
      return null;
    },
    click() {
      clics += 1;
    },
  };
  assert.equal(activarEnlaceNuevaPestana(boton), false);
  assert.equal(clics, 1);
  assert.equal(activarEnlaceNuevaPestana(null), false);
});

test("una sesión vencida no se presenta como lista vacía", () => {
  const denied = sectionFromSettled(
    { status: "rejected", reason: { response: { status: 403 } } },
    () => [{ id: 1, nombre: "No debe usarse" }]
  );
  assert.equal(denied.message, "No tienes permiso para esta búsqueda.");
  assert.equal(denied.showEmpty, false);
  assert.deepEqual(denied.items, []);

  const expired = sectionFromSettled(
    { status: "rejected", reason: { response: { status: 401 } } },
    () => []
  );
  assert.equal(expired.message, null);
  assert.equal(expired.showEmpty, false);

  const empty = sectionFromSettled({ status: "fulfilled", value: { data: [] } }, () => []);
  assert.equal(empty.showEmpty, true);
  assert.deepEqual(empty.items, []);
});

test("distingue falta de permiso, sesión vencida y error", () => {
  assert.equal(
    messageForSearchFailure({ response: { status: 403 } }),
    "No tienes permiso para esta búsqueda."
  );
  assert.equal(messageForSearchFailure({ response: { status: 401 } }), null);
  assert.equal(
    messageForSearchFailure({ response: { status: 500 } }),
    "No se pudo completar la búsqueda."
  );
});
