// src/components/GrupoFamiliar/RenovacionCoberturasModal.jsx
import React, { useEffect, useState } from "react";
import apiRequest from "../../services/api"; // ajusta la ruta si es distinto
import RenovacionCoberturasBorrador from "./RenovacionCoberturasBorrador";

const RenovacionCoberturasModal = ({ show, onHide, grupoFamiliarId }) => {
  const [anioDestino, setAnioDestino] = useState(new Date().getFullYear() + 1);
  const anioOrigen = anioDestino - 1;

  const [step, setStep] = useState(1);            // 1: configurar años, 2: revisar borrador
  const [loading, setLoading] = useState(false);
  const [loadingConfirm, setLoadingConfirm] = useState(false);
  const [error, setError] = useState("");
  const [borrador, setBorrador] = useState(null);
  

  // Cuando se abre el modal, dejamos todo limpio
  useEffect(() => {
    if (show) {
      const currentYear = new Date().getFullYear();
      setAnioDestino(currentYear + 1);
      setStep(1);
      setLoading(false);
      setLoadingConfirm(false);
      setError("");
      setBorrador(null);
    }
  }, [show]);

  if (!show) return null;

  const handleClose = () => {
    if (loading || loadingConfirm) return;
    onHide?.();
  };

  /**
   * Paso 1: llama al backend para generar el borrador
   */
  const handleContinuarPaso1 = async (e) => {
    e.preventDefault();
    if (!grupoFamiliarId) return;

    setLoading(true);
    setError("");

    try {
      const payload = {
        anio_destino: anioDestino,
        anio_origen: anioOrigen,
        parametros: {}, // por ahora vacío
      };

      const response = await apiRequest(
        `/grupo_familiar/${grupoFamiliarId}/renovacion/borrador`,
        "POST",
        payload
      );
      

      // Guardamos el borrador y pasamos al paso 2
      setBorrador(response);
      setStep(2);
    } catch (err) {
      console.error("Error al generar borrador de renovación", err);
      setError(
        err?.response?.data?.message ||
          "Ocurrió un error al generar el borrador de renovación."
      );
    } finally {
      setLoading(false);
    }
  };

  /**
   * Paso 2: confirmar renovación enviando items al backend
   */
  // 👇 arriba: ya tienes estos useState

const handleConfirmar = async (itemsFromUI) => {
  if (!grupoFamiliarId || !borrador) return;

  setLoadingConfirm(true);
  setError("");

  try {
    const payload = {
      anio_origen: borrador.anio_origen,
      anio_destino: borrador.anio_destino,
      parametros: borrador.parametros || {},
      items: itemsFromUI.map((it) => ({
        renovar: it.renovar,
        cobertura_id: it.cobertura_id,
        borrador: it.borrador || {},
      })),
    };

    const response = await apiRequest(
      `/grupo_familiar/${grupoFamiliarId}/renovacion/confirmar`,
      "POST",
      payload
    );

    console.log("Renovación confirmada:", response);

    // 👉 aquí podrías disparar un toast y refrescar datos del grupo en el padre
    // por ejemplo:
    // onAfterConfirm?.(response);

    onHide?.();
  } catch (err) {
    console.error("Error al confirmar renovación:", err);
    setError(
      err?.response?.data?.message ||
        "Ocurrió un error al confirmar la renovación."
    );
    setLoadingConfirm(false);
  }
};

  

  return (
    <>
      {/* MODAL */}
      <div
        className="modal fade show d-block"
        tabIndex="-1"
        role="dialog"
        style={{ zIndex: 1055 }}
      >
        <div className="modal-dialog modal-xl modal-dialog-centered" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">
                {step === 1
                  ? "Renovar coberturas del grupo"
                  : "Revisión de coberturas a renovar"}
              </h5>
              <button
                type="button"
                className="btn-close"
                onClick={handleClose}
                disabled={loading || loadingConfirm}
              />
            </div>

            {/* Paso 1: configurar año destino */}
            {step === 1 && (
              <form onSubmit={handleContinuarPaso1}>
                <div className="modal-body">
                  {error && (
                    <div className="alert alert-danger py-2">
                      {error}
                    </div>
                  )}

                  {!grupoFamiliarId && (
                    <div className="alert alert-warning">
                      No se encontró el identificador del grupo familiar. Guarda primero el grupo antes de renovar.
                    </div>
                  )}

                  <div className="mb-3">
                    <label className="form-label">Año destino</label>
                    <input
                      type="number"
                      className="form-control"
                      min="2000"
                      max="2100"
                      value={anioDestino}
                      onChange={(e) =>
                        setAnioDestino(Number(e.target.value) || new Date().getFullYear() + 1)
                      }
                      required
                      disabled={!grupoFamiliarId || loading}
                    />
                    <div className="form-text">
                      Se renovarán las coberturas del año <strong>{anioOrigen}</strong> hacia el año{" "}
                      <strong>{anioDestino}</strong>.
                    </div>
                  </div>

                  <div className="alert alert-info">
                    Este es el primer paso del proceso de renovación. En el siguiente paso podrás:
                    <ul className="mb-0">
                      <li>Revisar las coberturas actuales vs las del nuevo año.</li>
                      <li>Decidir qué miembros se renuevan y cuáles no.</li>
                      <li>Ajustar datos como plan, compañía, precio y forma de pago.</li>
                    </ul>
                  </div>
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleClose}
                    disabled={loading}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={!grupoFamiliarId || loading}
                  >
                    {loading ? "Generando borrador..." : "Continuar con la renovación"}
                  </button>
                </div>
              </form>
            )}

            {/* Paso 2: revisar y confirmar borrador */}
            {step === 2 && (
              <RenovacionCoberturasBorrador
              borrador={borrador}
              loadingConfirm={loadingConfirm}
              error={error}
              onBack={() => setStep(1)}
              onClose={handleClose}
              onConfirm={handleConfirmar}
            />
            
            )}
          </div>
        </div>
      </div>

      {/* BACKDROP */}
      <div
        className="modal-backdrop fade show"
        style={{ zIndex: 1050 }}
        onClick={handleClose}
      />
    </>
  );
};

export default RenovacionCoberturasModal;
