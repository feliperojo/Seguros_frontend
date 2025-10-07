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

    // 1️⃣ Ordena todos normalmente
    const sorted = [...(items || [])].sort((a, b) =>
      (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" })
    );

    // 2️⃣ Mueve “Spanish” al principio si existe
    const spanishIndex = sorted.findIndex((l) => l.name.toLowerCase() === "spanish");
    if (spanishIndex > 0) {
      const [spanish] = sorted.splice(spanishIndex, 1);
      sorted.unshift(spanish);
    }

    return sorted;
  }, [items, sort]);

  return { languages, loading, error };
}
