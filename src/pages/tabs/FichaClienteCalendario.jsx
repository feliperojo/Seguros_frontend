import React, { useMemo } from "react";
import CalendarioTareas from "../../components/Tareas/CalendarioTareas";
import { useFichaCliente } from "../../context/fichaClienteContext";

const toValidId = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export default function FichaClienteCalendario() {
  const { cliente, coberturaPrincipal, selectedGrupoId } = useFichaCliente();
  const currentUser = JSON.parse(localStorage.getItem("user")) || null;

  const grupoFamiliarId = useMemo(() => {
    if (selectedGrupoId) return toValidId(selectedGrupoId);
    if (!cliente) return null;
    return (
      toValidId(coberturaPrincipal?.grupo_familiar_id) ??
      toValidId(coberturaPrincipal?.grupo_familiar?.id) ??
      toValidId(cliente.grupo_familiar_id) ??
      null
    );
  }, [cliente, coberturaPrincipal, selectedGrupoId]);

  return (
    <div className="mt-3">
      <CalendarioTareas
        tareas={[]}
        currentUser={currentUser}
        grupoFamiliarId={grupoFamiliarId}
      />
    </div>
  );
}




