import React, { useMemo, useState } from "react";
import { useFichaCliente } from "../../context/fichaClienteContext";
import RequerimientosModal from "../../components/RequerimientosModal";

const toValidId = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export default function FichaClienteRequerimientos() {
  const { cliente, coberturaPrincipal, selectedGrupoId } = useFichaCliente();
  const [showModal, setShowModal] = useState(false);

  const grupoFamiliarId = useMemo(() => {
    if (selectedGrupoId) return toValidId(selectedGrupoId);
    if (!cliente) return null;
    return (
      toValidId(coberturaPrincipal?.grupo_familiar_id) ??
      toValidId(coberturaPrincipal?.grupo_familiar?.id) ??
      toValidId(cliente?.grupo_familiar_id) ??
      null
    );
  }, [cliente, coberturaPrincipal, selectedGrupoId]);

  return (
    <>
      <div className="card border-0 shadow-sm">
        <div className="card-body">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
            <div>
              <h5 className="mb-1">Requerimientos del cliente</h5>
              <p className="text-muted mb-0">
                Visualiza documentos solicitados y agrega nuevos requerimientos para el grupo familiar asociado.
              </p>
              <small className="text-secondary">
                {grupoFamiliarId
                  ? `Grupo Familiar activo: GF #${grupoFamiliarId}`
                  : "Este cliente no tiene un grupo familiar activo para requerimientos."}
              </small>
            </div>
            <button
              type="button"
              className="btn btn-outline-primary"
              onClick={() => setShowModal(true)}
              disabled={!grupoFamiliarId}
            >
              <i className="bi bi-folder2-open me-2"></i>
              Ver requerimientos
            </button>
          </div>
        </div>
      </div>

      <RequerimientosModal
        show={showModal}
        onHide={() => setShowModal(false)}
        grupoFamiliarId={grupoFamiliarId}
      />
    </>
  );
}
