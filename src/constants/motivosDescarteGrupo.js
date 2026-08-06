/** Motivos de descarte del proceso de grupo familiar (prospecto). */
export const MOTIVOS_DESCARTE_GRUPO = [
  {
    value: "cliente_no_respondio",
    label: "El cliente no respondió",
  },
  {
    value: "cliente_no_elegible",
    label: "Cliente no elegible (status / requisitos)",
  },
  {
    value: "no_pago_inicial",
    label: "No realizó el pago inicial",
  },
  {
    value: "precio_muy_alto",
    label: "Precio muy alto",
  },
  {
    value: "compro_otra_agencia",
    label: "Compró con otra agencia",
  },
  {
    value: "informacion_incompleta",
    label: "Información incompleta",
  },
  {
    value: "otro",
    label: "Otro",
  },
];

export function labelMotivoDescarte(value) {
  return (
    MOTIVOS_DESCARTE_GRUPO.find((m) => m.value === value)?.label || value || ""
  );
}

/**
 * Arma motivo (texto) + metadata para grupo_estado_historial.
 */
export function buildDescartePayload({ motivoCodigo, nota }) {
  const label = labelMotivoDescarte(motivoCodigo);
  const notaTrim = (nota || "").trim();
  const esOtro = motivoCodigo === "otro";

  const motivo = esOtro
    ? notaTrim
      ? `Otro: ${notaTrim}`
      : "Otro"
    : notaTrim
      ? `${label}. Nota: ${notaTrim}`
      : label;

  return {
    motivo,
    metadata: {
      tipo: "descarte_grupo",
      motivo_codigo: motivoCodigo,
      motivo_label: label,
      nota: notaTrim || null,
    },
  };
}
