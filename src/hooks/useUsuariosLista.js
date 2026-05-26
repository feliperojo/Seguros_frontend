import { useEffect, useState } from "react";
import apiRequest from "../services/api";

const normalizeUsers = (res) => {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.data?.data)) return res.data.data;
  return [];
};

/**
 * Carga la lista de usuarios para menciones y selectores.
 */
export function useUsuariosLista() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        let res = await apiRequest("users?per_page=1000", "GET");
        let list = normalizeUsers(res);
        if (!list.length) {
          res = await apiRequest("/v1/users?per_page=1000", "GET");
          list = normalizeUsers(res);
        }
        if (!cancelled) setUsuarios(list);
      } catch (e) {
        if (!cancelled) {
          setUsuarios([]);
          setError(e?.message || "No se pudieron cargar los usuarios");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { usuarios, loading, error };
}
