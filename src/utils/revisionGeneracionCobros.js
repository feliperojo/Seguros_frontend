const idsNumericos = (ids) =>
  (Array.isArray(ids) ? ids : [])
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);

export const coberturasPorCorregir = (vista) => {
  const items = Array.isArray(vista?.items) ? vista.items : [];
  return items.filter((item) => item && item.elegible === false);
};

export const resumenConfirmacionCobros = (vista) => {
  const items = Array.isArray(vista?.items) ? vista.items : [];
  const elegibles = items.filter((item) => item?.elegible);
  return {
    periodo: vista?.periodo || "",
    nuevos: elegibles.filter((item) => !item.ya_existe).length,
    existentes: elegibles.filter((item) => Boolean(item.ya_existe)).length,
    requiereConfirmacion: Boolean(vista?.requiere_confirmacion_periodo),
  };
};

export const prepararGeneracionCobros = ({ idsLote, huella, confirmarDatosPeriodo, productos }) => {
  const coberturaIds = idsNumericos(idsLote);
  const productosIds = [...new Set(
    (Array.isArray(productos) ? productos : [])
      .map((id) => String(id || "").trim())
      .filter(Boolean)
  )].sort();

  if (coberturaIds.length === 0 || productosIds.length === 0) {
    return null;
  }

  return {
    cobertura_ids: coberturaIds,
    huella: huella || "",
    confirmar_datos_periodo: Boolean(confirmarDatosPeriodo),
    ajustes: [],
    productos: productosIds,
  };
};

export const productosDelAlcance = ({ modo, elegidos, habilitados }) => {
  const permitidos = Array.isArray(habilitados) ? habilitados.filter(Boolean) : [];
  if (modo === "todos") return [...permitidos];
  const elegidosValidos = Array.isArray(elegidos) ? elegidos : [];
  return permitidos.filter((id) => elegidosValidos.includes(id));
};

export const coberturaEnAlcance = (poliza, productos) =>
  Array.isArray(productos) && productos.length > 0 && productos.includes(poliza?.producto_id);

export const describirRevisionProductos = ({ cantidad, etiquetas, periodo, todos }) => {
  const productos = todos
    ? "todos los productos habilitados"
    : etiquetas.filter(Boolean).join(", ") || "ningún producto";
  return `Se revisarán ${cantidad} coberturas de ${productos} para ${periodo}.`;
};
