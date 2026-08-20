export const COBERTURA_DEFINIDA = {
  VIGENTE: "Vigente",
  CANCELADO: "Cancelado",
  RETIRADO: "Retirado",
  TERMINADO: "Terminado",
  ANULADO: "Anulado",
};

export const OPCIONES_COBERTURA_RETIRO = [
  COBERTURA_DEFINIDA.RETIRADO,
  COBERTURA_DEFINIDA.TERMINADO,
  COBERTURA_DEFINIDA.CANCELADO,
];

export const badgeCoberturaDefinida = (valor) => {
  const map = {
    [COBERTURA_DEFINIDA.VIGENTE]: "success",
    [COBERTURA_DEFINIDA.CANCELADO]: "danger",
    [COBERTURA_DEFINIDA.RETIRADO]: "secondary",
    [COBERTURA_DEFINIDA.TERMINADO]: "dark",
    [COBERTURA_DEFINIDA.ANULADO]: "warning",
  };
  return map[valor] || "secondary";
};
