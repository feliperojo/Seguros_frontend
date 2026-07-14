// src/components/GrupoFamiliar/RenovacionCoberturasModal.jsx
import React, { useEffect, useState } from "react";
import apiRequest from "../../services/api"; // ajusta la ruta si es distinto
import RenovacionCoberturasBorrador from "./RenovacionCoberturasBorrador";

const RenovacionCoberturasModal = ({
  show,
  onHide,
  grupoFamiliarId,
  // opcional: para que el padre pueda refrescar las cards luego
  onAfterConfirm,
}) => {
  const [anioDestino, setAnioDestino] = useState(new Date().getFullYear() + 1);
  const anioOrigen = anioDestino - 1;

  const [step, setStep] = useState(1); // 1: configurar años, 2: confirmar proceso
  const [loading, setLoading] = useState(false);
  const [loadingConfirm, setLoadingConfirm] = useState(false);
  const [error, setError] = useState("");
  const [borrador, setBorrador] = useState(null);

  // 🔹 NUEVO: versiones históricas para evitar duplicar renovaciones
  const [versiones, setVersiones] = useState([]);
  const [loadingVersiones, setLoadingVersiones] = useState(false);

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
      setVersiones([]);
    }
  }, [show]);

  // 🔹 NUEVO: cargar versiones de historial cuando se abre el modal
  useEffect(() => {
    const fetchVersiones = async () => {
      if (!show || !grupoFamiliarId) return;
      setLoadingVersiones(true);
      try {
        const resp = await apiRequest(
          `/grupo_familiar/${grupoFamiliarId}/versiones-historial`,
          "GET"
        );

        // Soporta: array directo, {data: []}, {versiones: []}
        const raw = resp?.data ?? resp ?? [];
        const list = Array.isArray(raw?.data)
          ? raw.data
          : Array.isArray(raw?.versiones)
          ? raw.versiones
          : Array.isArray(raw)
          ? raw
          : [];

        setVersiones(list);
      } catch (err) {
        console.error("Error al cargar versiones de historial", err);
        // No bloqueamos el proceso, solo lo registramos en consola
      } finally {
        setLoadingVersiones(false);
      }
    };

    fetchVersiones();
  }, [show, grupoFamiliarId]);

  // 🔹 Helper: obtiene los años de origen de las renovaciones ya archivadas
  const getArchivadosLabel = () => {
    if (!Array.isArray(versiones) || versiones.length === 0) return "";
    const years = Array.from(
      new Set(
        versiones
          .map((v) =>
            Number(
              v.anio_origen ??
                v.anio ??
                v.anio_base ??
                v.anio_archivo ??
                v.anio_destino
            )
          )
          .filter((y) => Number.isFinite(y))
      )
    ).sort((a, b) => a - b);
    if (years.length === 0) return "";
    return years.join(", ");
  };

  // 🔹 Helper: verifica si ya existe una versión para el año origen dado
  const yearAlreadyExists = (year) => {
    if (!Array.isArray(versiones) || !Number.isFinite(year)) return false;
    return versiones.some((v) => {
      const y = Number(
        v.anio_origen ??
          v.anio ??
          v.anio_base ??
          v.anio_archivo ??
          v.anio_destino
      );
      return Number.isFinite(y) && y === year;
    });
  };

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

    // 🔹 NUEVO: validar que no exista ya una renovación para ese año origen
    const origen = anioOrigen;
    if (yearAlreadyExists(origen)) {
      setError(
        `La renovación para el año ${origen} ya existe. ` +
          "Puedes consultar el historial de renovaciones para ver la información de esa versión."
      );
      return; // NO seguimos al backend
    }

    setLoading(true);
    setError("");

    try {
      const payload = {
        anio_destino: anioDestino,
        anio_origen: anioOrigen,
        // dejamos el parámetro por si el backend ya lo usa
        parametros: {
          permitir_cambio_compania: true,
        },
      };

      const response = await apiRequest(
        `/grupo_familiar/${grupoFamiliarId}/renovacion/borrador`,
        "POST",
        payload
      );

      // Guardamos el borrador (lo usaremos solo para saber qué coberturas se afectan)
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
   * Paso 2: confirmar renovación
   * Ya no se editan plan/compañía/precio aquí.
   * Solo se envía la lista de coberturas a renovar para que:
   *  - se archive una copia del año origen
   *  - se creen los registros del año destino
   */
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
          // ya no mandamos cambios de plan/compañía/precio desde el UI
          borrador: it.borrador || {},
        })),
      };

      const response = await apiRequest(
        `/grupo_familiar/${grupoFamiliarId}/renovacion/confirmar`,
        "POST",
        payload
      );

      console.log("Renovación confirmada:", response);

      if (typeof onAfterConfirm === "function") {
        onAfterConfirm(response);
      }

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

  const archivadosLabel = getArchivadosLabel();

  return (
    <>
      {/* MODAL */}
      <div
        className="modal fade show d-block"
        tabIndex="-1"
        role="dialog"
        style={{ zIndex: 1055 }}
      >
        <div
          className="modal-dialog modal-xl modal-dialog-centered"
          role="document"
        >
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">
                {step === 1
                  ? "Renovar coberturas del grupo"
                  : "Confirmación de proceso de renovación"}
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
                    <div className="alert alert-danger py-2">{error}</div>
                  )}

                  {!grupoFamiliarId && (
                    <div className="alert alert-warning">
                      No se encontró el identificador del grupo familiar. Guarda
                      primero el grupo antes de renovar.
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
                        setAnioDestino(
                          Number(e.target.value) ||
                            new Date().getFullYear() + 1
                        )
                      }
                      required
                      disabled={
                        !grupoFamiliarId || loading || loadingVersiones
                      }
                    />
                    <div className="form-text">
                      Se renovarán las coberturas del año{" "}
                      <strong>{anioOrigen}</strong> hacia el año{" "}
                      <strong>{anioDestino}</strong>.
                    </div>

                    {/* 🔹 NUEVO: info de años ya archivados */}
                    {archivadosLabel && (
                      <div className="form-text text-muted mt-2">
                        Ya existen renovaciones archivadas para los años:{" "}
                        <strong>{archivadosLabel}</strong>. Si necesitas
                        consultarlas, abre el historial de renovaciones.
                      </div>
                    )}
                  </div>

                  <div className="alert alert-info">
                    <p className="mb-1">Este proceso realizará lo siguiente:</p>
                    <ul className="mb-0">
                      <li>
                        Se archivará una copia del grupo familiar y sus pólizas
                        del año <strong>{anioOrigen}</strong>.
                      </li>
                      <li>
                        Se actualizará la póliza de cada miembro renovado con
                        los datos del año <strong>{anioDestino}</strong> (nuevo
                        número de póliza), conservando su historial de pagos y
                        documentos. El período del año {anioOrigen} quedará
                        cerrado en el histórico.
                      </li>
                      <li>
                        En el siguiente paso completarás los datos de cada
                        póliza del año destino (código de póliza, compañía, plan,
                        precio, etc.) antes de confirmar.
                      </li>
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
                    disabled={
                      !grupoFamiliarId || loading || loadingVersiones
                    }
                  >
                    {loading || loadingVersiones
                      ? "Preparando renovación..."
                      : "Continuar"}
                  </button>
                </div>
              </form>
            )}

            {/* Paso 2: solo confirmación, sin edición de datos */}
            {step === 2 && (
              <RenovacionCoberturasBorrador
                borrador={borrador}
                loadingConfirm={loadingConfirm}
                error={error}
                onBack={() => setStep(1)}
                onClose={handleClose}
                onConfirm={handleConfirmar}
                // ya no se usa, pero lo dejamos por compatibilidad
                allowChangeCompany={false}
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
