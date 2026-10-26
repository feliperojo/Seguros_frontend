/**
 * La consolidación solo escribe la marca de pago que ya existe en el lote,
 * y únicamente cuando la decisión del modal difiere de lo guardado.
 * Un cierre sin año destino no toca esa marca.
 */
export function pagoAConfirmarAlConsolidar({
  esCierreSinDestino = false,
  marcado = false,
  yaConfirmado = false,
} = {}) {
  if (esCierreSinDestino) return null;
  if (Boolean(marcado) === Boolean(yaConfirmado)) return null;
  return Boolean(marcado);
}
