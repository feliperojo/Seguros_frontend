/* eslint-disable react/prop-types */
import { Link } from "react-router-dom";

export default function CierreFiscalBloqueo({ bloqueo }) {
  if (!bloqueo) return null;
  const anio = bloqueo.anio ? String(bloqueo.anio) : "";

  return (
    <div className="alert alert-danger">
      <div>{bloqueo.message}</div>
      <Link
        className="alert-link d-inline-block mt-2"
        to={`/admin/renovaciones?vista=cierres${anio ? `&anio=${anio}` : ""}`}
      >
        Ir a Cierres fiscales{anio ? ` ${anio}` : ""}
      </Link>
    </div>
  );
}
