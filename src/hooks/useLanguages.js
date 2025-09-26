import { useEffect, useState, useMemo } from "react";
import languagesDefault from "../services/idiomas";

/**
 * Hook para obtener la lista de idiomas (desde servicio local o remoto)
 * Devuelve: { languages, loading, error }
 */
export default function useLanguages({ sort = true } = {}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    try {
        setItems(Array.isArray(languagesDefault) ? languagesDefault : []);
      setLoading(false);
    } catch (e) {
      setError(e);
      setLoading(false);
    }
  }, []);

  const languages = useMemo(() => {
    if (!sort) return items || [];
    return [...(items || [])].sort((a, b) =>
      (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" })
    );
  }, [items, sort]);

  return { languages, loading, error };
}
