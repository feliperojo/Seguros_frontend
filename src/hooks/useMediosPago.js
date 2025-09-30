// hooks/useMediosPago.js
import { useEffect, useRef, useState, useCallback } from "react";
import { getByCliente } from "../services/MediosPagoService";

export function useMediosPago({ clienteId, enabled = true }) {
  const [data, setData] = useState(null);        // null = no cargado aún; [] = sin medios
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef(null);

  const fetchNow = useCallback(async () => {
    if (!clienteId) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const res = await getByCliente(clienteId, controller.signal);
      setData(Array.isArray(res) ? res : []);
    } catch (err) {
      if (err.name !== "AbortError") setError(err.message || "Error cargando medios de pago");
    } finally {
      setLoading(false);
    }
  }, [clienteId]);

  // Lazy-load: solo cuando enabled === true y aún no hay data ni error
  useEffect(() => {
    if (enabled && data === null && !error) fetchNow();
  }, [enabled, data, error, fetchNow]);

  // Cleanup
  useEffect(() => () => abortRef.current?.abort(), []);

  return {
    medios: data || [],
    loading,
    error,
    reload: fetchNow,
    hasLoaded: data !== null || !!error,
  };
}
