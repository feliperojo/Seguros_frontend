export const EVENTO_PAGOS_GRUPO_ACTUALIZADOS = "vantun:pagos-grupo-actualizados";

const NIVELES = new Set(["pagado", "pendiente", "procesando", "otro"]);

export function indicadoresDesdeRespuesta(payload, error) {
  if (error || !payload || payload.mostrar !== true) return {};
  const map = {};
  for (const item of payload.coberturas || []) {
    const id = Number(item?.cobertura_id);
    if (!Number.isFinite(id) || id <= 0 || !item.etiqueta) continue;
    map[id] = item;
  }
  return map;
}

export function textoDetalleIndicador(indicador) {
  const filas = Array.isArray(indicador?.detalle) ? indicador.detalle : [];
  if (filas.length === 0) return indicador?.etiqueta || "";
  return filas
    .map((fila) => {
      const monto = Number(fila.monto);
      const importe = Number.isFinite(monto) ? monto.toFixed(2) : String(fila.monto ?? "");
      const fecha = fila.fecha_cobro_programada
        ? `, cobro programado ${fila.fecha_cobro_programada}`
        : "";
      return `${fila.periodo}: ${fila.estado}, ${importe}${fecha}`;
    })
    .join(". ");
}

export function nivelIndicador(indicador) {
  return NIVELES.has(indicador?.nivel) ? indicador.nivel : "otro";
}

export function eventoCorrespondeAlGrupo(evento, grupoFamiliarId) {
  return Number(evento?.detail?.grupoFamiliarId) === Number(grupoFamiliarId);
}

export function notificarPagosGrupoActualizados(grupoFamiliarId) {
  if (typeof window === "undefined" || !grupoFamiliarId) return;
  window.dispatchEvent(
    new CustomEvent(EVENTO_PAGOS_GRUPO_ACTUALIZADOS, {
      detail: { grupoFamiliarId: Number(grupoFamiliarId) },
    })
  );
}
