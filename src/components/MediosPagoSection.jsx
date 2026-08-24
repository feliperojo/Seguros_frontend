// src/components/MediosPagoSection.jsx
import { useEffect, useState, useCallback } from "react";
import { MediosPagoService } from "../services/MediosPagoService";
import MediosPagoTablas from "./MediosPagoTablas";
import useAppSettings from "../hooks/useAppSettings";
import useToast from "../hooks/useToast";
import apiRequest from "../services/api";
import { normalizeDireccion, resolveClienteDireccion } from "../utils/direccion";

export default function MediosPagoSection({ clienteId, isOpen }) {
  const { showPaymentMethodsData } = useAppSettings();
  const toast = useToast();
  const [medios, setMedios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [clienteDireccion, setClienteDireccion] = useState("");

  const fetchData = useCallback(async () => {
    if (!clienteId) return;
    setLoading(true);
    setErr("");
    try {
      const data = await MediosPagoService.getByCliente(clienteId);
      // asumiendo que el back devuelve array directamente.
      // si devuelve {data: [...]}, entonces: setMedios(data.data || []);
      setMedios(Array.isArray(data) ? data : (data?.data ?? []));
    } catch (e) {
      setErr(e?.message || "Error cargando medios de pago");
    } finally {
      setLoading(false);
    }
  }, [clienteId]);

  // Lazy-load: solo cuando el panel esté abierto y haya clienteId
  useEffect(() => {
    if (isOpen && clienteId) fetchData();
  }, [isOpen, clienteId, fetchData]);

  useEffect(() => {
    const fetchClienteDireccion = async () => {
      if (!isOpen || !clienteId) return;
      try {
        const response = await apiRequest(`cliente/${clienteId}`, "GET");
        setClienteDireccion(resolveClienteDireccion(response));
      } catch (error) {
        console.error("Error al cargar la dirección del cliente:", error);
        setClienteDireccion("");
      }
    };

    fetchClienteDireccion();
  }, [isOpen, clienteId]);

  const handleApplyClienteDireccion = async (medio) => {
    const direccion = String(clienteDireccion || "").trim();
    if (!medio?.id) return;
    if (!direccion) {
      toast.showWarning("El cliente no tiene una dirección configurada.");
      return;
    }
    if (normalizeDireccion(medio.direccion) === normalizeDireccion(direccion)) {
      toast.showInfo("Este medio de pago ya usa la dirección del cliente.");
      return;
    }

    try {
      const response = await MediosPagoService.update(medio.id, { direccion });
      const updated = response?.data || response;
      setMedios((prev) =>
        prev.map((item) =>
          item.id === medio.id
            ? { ...item, ...updated, direccion: updated.direccion ?? direccion }
            : item
        )
      );
      toast.showSuccess("Dirección actualizada con la del cliente.");
    } catch (error) {
      console.error("Error al actualizar la dirección del medio de pago:", error);
      toast.showError(error?.message || "No se pudo actualizar la dirección.");
    }
  };

  return (
    <div className="p-3">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="border-bottom pb-2 mb-0">Medios de Pago</h5>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-secondary btn-sm" onClick={fetchData} disabled={loading}>
            <i className="bi bi-arrow-clockwise me-1" />
            Recargar
          </button>
          <a
            className="btn btn-primary btn-sm"
            href={`/clientes/mediopago/${clienteId}`}
            target="_blank"
            rel="noreferrer"
          >
            <i className="bi bi-credit-card me-2" />
            Administrar Medios de Pago
          </a>
        </div>
      </div>

      {loading && (
        <div className="text-center py-4">
          <div className="spinner-border spinner-border-sm text-primary" role="status" />
          <p className="mt-2 mb-0 text-muted">Cargando medios de pago…</p>
        </div>
      )}

      {!loading && err && (
        <div className="alert alert-danger">
          <i className="bi bi-exclamation-triangle me-2" />
          {err}
        </div>
      )}

      {!loading && !err && (medios?.length ?? 0) === 0 && (
        <div className="text-center border rounded py-4 mt-2 bg-light">
          <i className="bi bi-credit-card-2-front display-5 text-muted mb-3"></i>
          <h6 className="mb-2">No hay medios de pago registrados</h6>
          <p className="text-muted mb-0">Use “Administrar Medios de Pago” para añadirlos.</p>
        </div>
      )}

      {!loading && !err && (medios?.length ?? 0) > 0 && (
        <MediosPagoTablas
          mediosPago={medios}
          showPaymentMethodsData={showPaymentMethodsData}
          clienteDireccion={clienteDireccion}
          onApplyClienteDireccion={handleApplyClienteDireccion}
          onView={(medio) =>
            alert(`Ver medio de pago:\nTitular: ${medio.titular}\nTipo: ${medio.forma_pago}`)
          }
          onEdit={() => {}}
          onDelete={() => {}}
          showActions={false}
        />
      )}

      <div className="alert alert-info mt-4 mb-0">
        <div className="d-flex">
          <i className="bi bi-info-circle me-2 fs-5"></i>
          <div>
            <h6 className="mb-1">Nota importante:</h6>
            <p className="mb-0">
              Para administrar completamente los medios (añadir, editar, eliminar), use el botón
              <em> Administrar Medios de Pago</em> que abre la herramienta en otra pestaña.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
