import { useEffect, useState, useMemo } from "react";
import languagesDefault from "../services/idiomas";

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
  
    // Prioridad fija: primero EN, luego ES
    const PRIORITY = ["en", "es"];
    const weight = (code) => {
      const i = PRIORITY.indexOf((code || "").toLowerCase());
      return i === -1 ? PRIORITY.length : i; // otros van después de los prioritarios
    };
  
    // Orden final: prioridad (en, es) -> alfabético por nombre
    const sorted = [...(items || [])].sort((a, b) => {
      const byPriority = weight(a.code) - weight(b.code);
      if (byPriority !== 0) return byPriority;
      return (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" });
    });
  
    return sorted;
  }, [items, sort]);
  

  return { languages, loading, error };
}
