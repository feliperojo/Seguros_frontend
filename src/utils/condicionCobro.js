export const TEXTO_PENDIENTE_COBRO = "Pendiente de confirmar";

export function condicionCobro(pago, campo) {
  const snap = pago?.cobertura_snapshot;
  if (!snap || typeof snap !== "object") {
    return { texto: TEXTO_PENDIENTE_COBRO, pendiente: true, origen: null };
  }

  const valor = snap[campo];
  if (valor == null || String(valor).trim() === "") {
    return { texto: TEXTO_PENDIENTE_COBRO, pendiente: true, origen: snap.origen || null };
  }

  const desdeActual =
    Array.isArray(snap.campos_desde_cobertura_actual) &&
    snap.campos_desde_cobertura_actual.includes(campo);

  return {
    texto: String(valor),
    pendiente: false,
    origen: snap.origen || null,
    desdeActual,
  };
}

export function tituloCondicionCobro(condicion) {
  if (!condicion || condicion.pendiente) {
    return "Este cobro no tiene una copia histórica confirmada.";
  }
  if (condicion.origen === "correccion") {
    return "Corregido en este cobro. No modifica la cobertura ni otros períodos.";
  }
  if (condicion.origen === "revision") {
    return "Ajustado en la revisión de este cobro, antes de generarlo.";
  }
  if (condicion.origen === "historial_plan" && !condicion.desdeActual) {
    return "Tomado del historial de plan vigente en el período.";
  }
  if (condicion.desdeActual || condicion.origen === "cobertura_actual") {
    return "Guardado al generar. Este dato se tomó de la cobertura vigente, no de un historial de plan.";
  }
  return undefined;
}

export function textosCondicionCobros(items, campo) {
  const textos = [
    ...new Set((items || []).map((pago) => condicionCobro(pago, campo).texto)),
  ];
  return textos.length ? textos.join(", ") : TEXTO_PENDIENTE_COBRO;
}
