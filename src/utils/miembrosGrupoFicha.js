/** Miembros del grupo a partir de las coberturas ya cargadas. No infiere parentesco. */

import { isDentalCoberturaTipo } from "../constants/coberturaTipos.js";

const idPositivo = (valor) => {
  const n = Number(valor);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const nombreDeCobertura = (cobertura) => {
  const cliente = cobertura?.cliente;
  const completo = String(cliente?.nombre_completo ?? "").trim();
  if (completo) return completo;
  const partes = [cliente?.primer_nombre, cliente?.segundo_nombre, cliente?.apellidos]
    .map((parte) => String(parte ?? "").trim())
    .filter(Boolean);
  return partes.join(" ") || "Sin nombre";
};

const relacionDeCobertura = (cobertura) => {
  const valor = String(cobertura?.parentesco ?? cobertura?.relacion ?? "").trim();
  return valor || null;
};

const programaCobertura = (estado) => {
  const valor = String(estado ?? "").trim().toLowerCase();
  if (valor === "medicare") return "Medicare";
  if (valor === "medicaid" || valor === "medicai") return "Medicaid";
  return "";
};

/** Tipo registrado, Medicare o Medicaid si aplica, y el plan. Sin datos inventados. */
const resumenCobertura = (cobertura) => {
  const tipo = String(cobertura?.cobertura_tipo ?? "").trim();
  const plan = String(cobertura?.plan ?? "").trim();
  const programa = programaCobertura(cobertura?.estado_cobertura);
  const partes = [];
  const yaEsta = (texto) => partes.some((parte) => parte.toLowerCase() === texto.toLowerCase());

  if (tipo) partes.push(tipo);
  if (programa && !yaEsta(programa)) partes.push(programa);
  if (plan && !yaEsta(plan)) partes.push(plan);
  return partes.join(" · ");
};

const resumenesDeCoberturas = (coberturas) => {
  const ordenadas = [...coberturas].sort((a, b) => {
    const dentalA = isDentalCoberturaTipo(a?.cobertura_tipo) ? 1 : 0;
    const dentalB = isDentalCoberturaTipo(b?.cobertura_tipo) ? 1 : 0;
    return dentalA - dentalB;
  });
  const vistos = new Set();
  const lineas = [];
  ordenadas.forEach((cobertura) => {
    const resumen = resumenCobertura(cobertura);
    if (!resumen) return;
    const clave = resumen.toLowerCase();
    if (vistos.has(clave)) return;
    vistos.add(clave);
    lineas.push(resumen);
  });
  return lineas;
};

export const miembrosVisiblesDelGrupo = (coberturas, clienteActualId) => {
  const actualId = idPositivo(clienteActualId);
  const porCliente = new Map();

  (Array.isArray(coberturas) ? coberturas : []).forEach((cobertura) => {
    const clienteId = idPositivo(cobertura?.cliente_id ?? cobertura?.cliente?.id);
    if (!clienteId) return;

    const relacion = relacionDeCobertura(cobertura);
    const previo = porCliente.get(clienteId);
    if (!previo) {
      porCliente.set(clienteId, {
        clienteId,
        nombre: nombreDeCobertura(cobertura),
        relacion,
        esActual: actualId != null && clienteId === actualId,
        coberturas: [cobertura],
      });
      return;
    }

    previo.coberturas.push(cobertura);
    if (!previo.relacion && relacion) previo.relacion = relacion;
    if (previo.nombre === "Sin nombre") {
      const nombre = nombreDeCobertura(cobertura);
      if (nombre !== "Sin nombre") previo.nombre = nombre;
    }
  });

  return [...porCliente.values()]
    .filter((miembro) => !miembro.esActual)
    .map((miembro) => ({
      clienteId: miembro.clienteId,
      nombre: miembro.nombre,
      relacion: miembro.relacion,
      coberturas: resumenesDeCoberturas(miembro.coberturas),
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
};
