import { useCallback, useEffect, useRef, useState } from "react";
import GrupoFamiliarService from "../services/GrupoFamiliarService";

/** Heartbeat: mantiene la sesión viva en el servidor (debe ser < TTL del backend). */
const HEARTBEAT_MS = 12_000;
/** Polling: detecta otros usuarios en el grupo lo antes posible. */
const POLL_MS = 4_000;

const EMPTY_EDICION = {
  alerta: false,
  tipo: null,
  mensaje: null,
  editores: [],
};

/**
 * Presencia en grupo familiar.
 * - registrarPresencia / activo: heartbeat mientras la pantalla está abierta.
 * - Polling frecuente + refresh al recuperar foco para alertas tempranas.
 */
export default function useGrupoFamiliarEdicionPresencia(
  grupoFamiliarId,
  { activo = false, registrarPresencia = false, initialEdicion = null } = {}
) {
  const [edicion, setEdicion] = useState(initialEdicion ?? EMPTY_EDICION);
  const sessionIdRef = useRef(null);
  const grupoId = Number(grupoFamiliarId);
  const shouldRegister = Boolean(registrarPresencia || activo);

  const applyEdicionMeta = useCallback((meta) => {
    if (meta?.edicion) {
      setEdicion(meta.edicion);
    }
  }, []);

  const refreshEdicion = useCallback(async () => {
    if (!grupoId) return null;

    try {
      const data = await GrupoFamiliarService.getEdicionPresencia(grupoId);
      if (data) setEdicion(data);
      return data;
    } catch {
      return null;
    }
  }, [grupoId]);

  const touchPresencia = useCallback(async () => {
    if (!grupoId || !shouldRegister) return null;

    try {
      const res = await GrupoFamiliarService.touchEdicionPresencia(
        grupoId,
        sessionIdRef.current
      );

      const sessionId = res?.data?.session_id ?? res?.session_id;
      if (sessionId) sessionIdRef.current = sessionId;

      const metaEdicion = res?.meta?.edicion;
      if (metaEdicion) setEdicion(metaEdicion);

      return res;
    } catch {
      return null;
    }
  }, [grupoId, shouldRegister]);

  useEffect(() => {
    if (initialEdicion) {
      setEdicion(initialEdicion);
    }
  }, [initialEdicion]);

  useEffect(() => {
    if (!grupoId || !shouldRegister) return undefined;

    let cancelled = false;

    const beat = async () => {
      if (cancelled) return;
      await touchPresencia();
    };

    beat();
    const intervalId = window.setInterval(beat, HEARTBEAT_MS);

    const release = () => {
      GrupoFamiliarService.releaseEdicionPresencia(
        grupoId,
        sessionIdRef.current
      ).catch(() => {});
    };

    window.addEventListener("beforeunload", release);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("beforeunload", release);
      release();
    };
  }, [grupoId, shouldRegister, touchPresencia]);

  useEffect(() => {
    if (!grupoId) return undefined;

    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      await refreshEdicion();
    };

    poll();
    const intervalId = window.setInterval(poll, POLL_MS);

    const onVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        poll();
        if (shouldRegister) touchPresencia();
      }
    };

    window.addEventListener("focus", onVisibilityOrFocus);
    document.addEventListener("visibilitychange", onVisibilityOrFocus);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onVisibilityOrFocus);
      document.removeEventListener("visibilitychange", onVisibilityOrFocus);
    };
  }, [grupoId, shouldRegister, refreshEdicion, touchPresencia]);

  return { edicion, applyEdicionMeta, refreshEdicion, touchPresencia };
}
