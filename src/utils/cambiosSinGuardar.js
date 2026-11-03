const consultas = new Set();

/**
 * Una pantalla registra cómo leer sus cambios pendientes.
 * El registro vive solo mientras el componente está montado.
 */
export function registrarCambiosSinGuardar(consulta) {
  if (typeof consulta !== "function") return () => {};
  consultas.add(consulta);
  return () => {
    consultas.delete(consulta);
  };
}

export function leerCambiosSinGuardar() {
  let pendiente = false;
  let guardando = false;

  consultas.forEach((consulta) => {
    try {
      const estado = consulta() || {};
      if (estado.guardando) guardando = true;
      if (estado.pendiente) pendiente = true;
    } catch {
      pendiente = true;
    }
  });

  return { pendiente: pendiente && !guardando, guardando };
}
