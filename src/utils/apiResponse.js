/**
 * Normaliza respuestas paginadas o anidadas del API Laravel.
 */
export const getListFromApi = (res) => {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res.data)) return res.data;
  if (Array.isArray(res.data?.data)) return res.data.data;
  if (Array.isArray(res.items)) return res.items;
  return [];
};

export const getItemFromApi = (res) => {
  if (!res || typeof res !== "object") return null;
  return res.data ?? res;
};
