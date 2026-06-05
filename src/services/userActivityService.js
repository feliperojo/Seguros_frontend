import apiRequest from "./api";

/**
 * Servicio de actividad unificada de usuarios.
 * API: GET /v1/user-activity
 */
export const userActivityService = {
  list: async (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append("page", params.page);
    if (params.per_page) queryParams.append("per_page", params.per_page);
    if (params.user_id) queryParams.append("user_id", params.user_id);
    if (params.action) queryParams.append("action", params.action);
    if (params.entity) queryParams.append("entity", params.entity);
    if (params.model) queryParams.append("model", params.model);
    if (params.search) queryParams.append("search", params.search);
    if (params.start_date) queryParams.append("start_date", params.start_date);
    if (params.end_date) queryParams.append("end_date", params.end_date);

    const query = queryParams.toString();
    const response = await apiRequest(
      `/v1/user-activity${query ? `?${query}` : ""}`,
      "GET"
    );

    return {
      data: Array.isArray(response?.data) ? response.data : [],
      meta: response?.meta ?? {},
      filters: response?.filters ?? null,
    };
  },

  byUser: async (userId, params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append("page", params.page);
    if (params.per_page) queryParams.append("per_page", params.per_page);
    if (params.action) queryParams.append("action", params.action);
    if (params.search) queryParams.append("search", params.search);
    if (params.start_date) queryParams.append("start_date", params.start_date);
    if (params.end_date) queryParams.append("end_date", params.end_date);

    const query = queryParams.toString();
    const response = await apiRequest(
      `/v1/user-activity/user/${userId}${query ? `?${query}` : ""}`,
      "GET"
    );

    return {
      data: Array.isArray(response?.data) ? response.data : [],
      meta: response?.meta ?? {},
      filters: response?.filters ?? null,
    };
  },

  get: async (id) => {
    const response = await apiRequest(`/v1/user-activity/${id}`, "GET");
    return response?.data ?? response;
  },
};

export default userActivityService;
