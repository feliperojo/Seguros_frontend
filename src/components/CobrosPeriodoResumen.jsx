/* eslint-disable react/prop-types */
import { MESES_COBRO } from "../utils/periodoCobros";
import "./CobrosPeriodoResumen.css";

const CobrosPeriodoResumen = ({
  anio,
  meses = [],
  mesSeleccionado,
  onSeleccionarMes,
  limitacion,
  registrosSinPeriodo = 0,
}) => {
  if (!anio || meses.length === 0) return null;

  return (
    <div className="cobros-periodo">
      <div className="cobros-periodo__grid" role="group" aria-label={`Cobros generados en ${anio}`}>
        {meses.map((item) => {
          const seleccionado = item.mes === mesSeleccionado;
          const conCobros = item.estado_generacion === "con_cobros";
          const estado = item.estado_texto || (conCobros ? "Con cobros" : "Sin cobros");
          const cobros = Number(item.cobros) || 0;
          const nombre = MESES_COBRO.find((mes) => mes.value === item.mes);
          return (
            <button
              key={item.mes}
              type="button"
              className={[
                "cobros-periodo__mes",
                conCobros ? "cobros-periodo__mes--con" : "cobros-periodo__mes--sin",
                seleccionado ? "cobros-periodo__mes--activo" : "",
              ].join(" ")}
              aria-pressed={seleccionado}
              aria-label={`${item.etiqueta || nombre?.etiqueta || ""} ${anio}: ${estado}, ${cobros} ${cobros === 1 ? "cobro" : "cobros"}${seleccionado ? ", seleccionado" : ""}`}
              onClick={() => onSeleccionarMes(item.mes)}
            >
              <span className="cobros-periodo__nombre">{nombre?.corto || item.etiqueta}</span>
              <span className="cobros-periodo__estado">{estado}</span>
              <span className="cobros-periodo__cuenta">{cobros}</span>
            </button>
          );
        })}
      </div>
      {limitacion ? <p className="cobros-periodo__nota">{limitacion}</p> : null}
      {registrosSinPeriodo > 0 ? (
        <p className="cobros-periodo__nota cobros-periodo__nota--aviso">
          Hay {registrosSinPeriodo} cobro{registrosSinPeriodo === 1 ? "" : "s"} histórico
          {registrosSinPeriodo === 1 ? "" : "s"} cuyo período no se pudo identificar, porque el mes
          guardado no coincide con la fecha de pago. No se asignaron a un año.
        </p>
      ) : null}
    </div>
  );
};

export default CobrosPeriodoResumen;
