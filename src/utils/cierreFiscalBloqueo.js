export function cierreFiscalDesdeError(error) {
  const data = error?.response?.data;
  if (data?.code !== "cierre_fiscal_pendiente") return null;
  return {
    message: data.message || error.message,
    anio: data.anio_origen,
  };
}

export function cierreFiscalDesdeFila(fila) {
  if (fila?.code !== "cierre_fiscal_pendiente") return null;
  return {
    message: fila.resultado,
    anio: fila.anio_origen,
  };
}
