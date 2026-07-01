import { useCallback, useEffect, useRef, useState } from "react";
import GrupoFamiliarService from "../services/GrupoFamiliarService";

const HEARTBEAT_MS = 45_000;
const POLL_MS = 60_000;

const EMPTY_EDICION = {
  alerta: false,
  tipo: null,
  mensaje: null,
  editores: [],
};

/**
 * Presencia de edición en grupo familiar.
 * - activo=true: registra heartbeat (usuario editando).
 * - Siempre hace polling para mostrar si otro usuario está editando.
 */
export default function useGrupoFamiliarEdicionPresencia(
  grupoFamiliarId,
  { activo = false, initialEdicion = null } = {}
) {
  const [edicion, setEdicion] = useState(initialEdicion ?? EMPTY_EDICION);
  const sessionIdRef = useRef(null);
  const grupoId = Number(grupoFamiliarId);

  const applyEdicionMeta = useCallback((meta) => {
    if (meta?.edicion) {
      setEdicion(meta.edicion);
    }
  }, []);

  useEffect(() => {
    if (initialEdicion) {
      setEdicion(initialEdicion);
    }
  }, [initialEdicion]);

  useEffect(() => {
    if (!grupoId || !activo) return undefined;

    let cancelled = false;

    const beat = async () => {
      try {
        const res = await GrupoFamiliarService.touchEdicionPresencia(
          grupoId,
          sessionIdRef.current
        );
        if (cancelled) return;

        const sessionId = res?.data?.session_id ?? res?.session_id;
        if (sessionId) sessionIdRef.current = sessionId;

        const metaEdicion = res?.meta?.edicion;
        if (metaEdicion) setEdicion(metaEdicion);
      } catch {
        // No interrumpir la edición si falla el heartbeat
      }
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
  }, [grupoId, activo]);

  useEffect(() => {
    if (!grupoId) return undefined;

    let cancelled = false;

    const poll = async () => {
      try {
        const data = await GrupoFamiliarService.getEdicionPresencia(grupoId);
        if (!cancelled && data) setEdicion(data);
      } catch {
        // Polling silencioso
      }
    };

    poll();
    const intervalId = window.setInterval(poll, POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [grupoId]);

  return { edicion, applyEdicionMeta };
}
