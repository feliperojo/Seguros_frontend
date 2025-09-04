// services/api.js
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const getAuthToken = () => localStorage.getItem("auth_token");

// util opcional: genera un UUID sencillo para idempotencia
const genUUID = () =>
  ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g,c=>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );

/**
 * apiRequest(endpoint, method, body, extraHeaders)
 */
const apiRequest = async (endpoint, method = "GET", body = null, extraHeaders = {}) => {
  const token = getAuthToken();

  const headers = {
    "Accept": "application/json",
    "Content-Type": "application/json",
    ...extraHeaders,
  };

  if (token) headers["Authorization"] = `Bearer ${token}`;

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const response = await fetch(`${API_BASE_URL}/${endpoint}`, options);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || "Error en la petición");
  }
  return data;
};

export { apiRequest, genUUID };
export default apiRequest;
