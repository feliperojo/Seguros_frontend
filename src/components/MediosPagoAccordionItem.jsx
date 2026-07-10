// src/components/MediosPagoAccordionItem.jsx
import { useEffect, useRef, useState } from "react";
import MediosPagoSection from "./MediosPagoSection";

export default function MediosPagoAccordionItem({ itemId, parentId, clienteId }) {
  const collapseId = `collapse-medios-pago-${itemId}`;
  const headerId = `medios-pago-${itemId}`;
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const el = document.getElementById(collapseId);
    if (!el) return;
    const onShow = () => setIsOpen(true);
    const onHide = () => setIsOpen(false);
    el.addEventListener("shown.bs.collapse", onShow);
    el.addEventListener("hidden.bs.collapse", onHide);
    return () => {
      el.removeEventListener("shown.bs.collapse", onShow);
      el.removeEventListener("hidden.bs.collapse", onHide);
    };
  }, [collapseId]);

  return (
    <div className="accordion-item">
      <h2 className="accordion-header" id={headerId}>
        <button
          className="accordion-button collapsed"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target={`#${collapseId}`}
          aria-expanded="false"
          aria-controls={collapseId}
        >
          Medios de Pago
        </button>
      </h2>

      <div
        id={collapseId}
        ref={ref}
        className="accordion-collapse collapse"
        aria-labelledby={headerId}
        data-bs-parent={`#${parentId}`}
      >
        <div className="accordion-body">
          <MediosPagoSection clienteId={clienteId} isOpen={isOpen} />
        </div>
      </div>
    </div>
  );
}
