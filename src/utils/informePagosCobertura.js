export function filasInformePagos(pagos, filtros) {
  const filas = new Map();
  for (const pago of pagos || []) {
    if (String(pago.anio_generado) !== String(filtros.anio)) continue;
    const mes = Number(pago.mes_generado);
    if (!Number.isInteger(mes) || mes < 1 || mes > 12) continue;
    const fiscal = pago.cobertura_fiscal_informe || {};
    const cliente = pago.cliente?.nombre_completo || "";
    if (!cliente.toLowerCase().includes((filtros.cliente || "").toLowerCase())) continue;
    const busqueda = (filtros.compania || "").toLowerCase();
    if (!String(fiscal.compania_nombre || "").toLowerCase().includes(busqueda) &&
        !String(fiscal.plan || "").toLowerCase().includes(busqueda)) continue;
    if (filtros.estado && pago.estado !== filtros.estado) continue;
    const key = `${pago.anio_generado}|${pago.cobertura_id ?? `pago-${pago.id}`}`;
    if (!filas.has(key)) filas.set(key, {
      id: key, cobertura_id: pago.cobertura_id ?? null,
      cliente, cliente_id: pago.cliente_id || pago.cliente?.id,
      grupo_familiar_id: pago.grupo_familiar_id,
      codigo_poliza: fiscal.codigo_poliza, compania: fiscal.compania_nombre,
      pagador: fiscal.pagador_nombre, plan: fiscal.plan,
      pagos: Array(12).fill(null),
    });
    const fila = filas.get(key);
    if (!fila.pagos[mes - 1]) fila.pagos[mes - 1] = { cobros: [] };
    fila.pagos[mes - 1].cobros.push(pago);
    fila.pagos[mes - 1].estado = fila.pagos[mes - 1].cobros.every(p => p.estado === 'pagado') ? 'pagado' : 'pendiente';
  }
  return [...filas.values()];
}
