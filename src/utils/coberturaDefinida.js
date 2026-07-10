export const COBERTURA_DEFINIDA = {
  VIGENTE: "Vigente",
  CANCELADO: "Cancelado",
  RETIRADO: "Retirado",
  TERMINADO: "Terminado",
};

export const OPCIONES_COBERTURA_RETIRO = [
  COBERTURA_DEFINIDA.RETIRADO,
  COBERTURA_DEFINIDA.TERMINADO,
];

export const badgeCoberturaDefinida = (valor) => {
  const map = {
    [COBERTURA_DEFINIDA.VIGENTE]: "success",
    [COBERTURA_DEFINIDA.CANCELADO]: "danger",
    [COBERTURA_DEFINIDA.RETIRADO]: "secondary",
    [COBERTURA_DEFINIDA.TERMINADO]: "dark",
  };
  return map[valor] || "secondary";
};
