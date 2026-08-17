// hooks/useCompanies.js
import { useEffect, useState } from "react";
import { fetchCompanies } from "../services/companies";

const sortCompaniesByName = (list = []) =>
  [...list].sort((a, b) =>
    String(a?.nombre || "").localeCompare(String(b?.nombre || ""), "es", {
      sensitivity: "base",
      numeric: true,
    })
  );

export default function useCompanies() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await fetchCompanies();
        if (mounted) setCompanies(sortCompaniesByName(data));
      } catch (e) {
        if (mounted) setError(e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return { companies, loading, error };
}
