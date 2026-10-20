import { useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { publicarFechaOperacion } from "../utils/fechaOperacion";

export default function useFechaOperacion() {
  const { appSettings } = useAuth();
  return useMemo(
    () => publicarFechaOperacion(appSettings?.fecha_operacion),
    [appSettings?.fecha_operacion]
  );
}
