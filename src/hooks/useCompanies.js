// hooks/useCompanies.js
import { useEffect, useMemo, useState } from "react";
import { fetchCompanies, filterCompaniesForProducto } from "../services/companies";

const sortCompaniesByName = (list = []) =>
  [...list].sort((a, b) =>
    String(a?.nombre || "").localeCompare(String(b?.nombre || ""), "es", {
      sensitivity: "base",
      numeric: true,
    })
  );

/**
 * @param {{ producto?: 'dental_ms'|'salud'|null, includeId?: number|string|null, soloActivas?: boolean }} [options]
 */
export default function useCompanies(options = {}) {
  const {
    producto = null,
    includeId = null,
    soloActivas = false,
  } = options;

  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Cargar catálogo completo; el filtrado por producto se hace en cliente
        // para poder conservar includeId aunque el flag esté en false.
        const data = await fetchCompanies();
        if (mounted) setCompanies(sortCompaniesByName(data));
      } catch (e) {
        if (mounted) setError(e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(
    () =>
      filterCompaniesForProducto(companies, producto, {
        includeId,
        soloActivas,
      }),
    [companies, producto, includeId, soloActivas]
  );

  return {
    companies: filtered,
    allCompanies: companies,
    loading,
    error,
  };
}
