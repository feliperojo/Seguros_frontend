// components/CoberturaDeleteButton.jsx
import React, { useState } from "react";
import { canDeleteMember, deleteCoberturaFlow } from "../../utils/coberturas";


export default function CoberturaDeleteButton({
  member,
  readOnly,
  allowDeleteTomador = false,
  service,        // { deleteCobertura: (id) => Promise }
  removeLocal,    // (memberId) => void
  onDeleted,      // callback opcional
  className = "btn btn-outline-danger btn-sm",
  title = "Eliminar cobertura",
}) {
  const [busy, setBusy] = useState(false);

  if (!canDeleteMember(member, { readOnly, allowDeleteTomador })) return null;

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const ok = await deleteCoberturaFlow(member, { service, removeLocal });
      if (ok && onDeleted) onDeleted(member);
    } catch (err) {
      console.error(err);
      alert("No fue posible eliminar la cobertura. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      className={className}
      title={title}
      onClick={handleClick}
      disabled={busy}
    >
      {busy ? (
        <>
          <i className="fas fa-spinner fa-spin me-1" /> Eliminando…
        </>
      ) : (
        <>
          <i className="fas fa-trash me-1" /> Eliminar
        </>
      )}
    </button>
  );
}

