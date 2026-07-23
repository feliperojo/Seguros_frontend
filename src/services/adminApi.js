import apiRequest from "./api";

export const usersService = {
  list: async (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append("page", params.page);
    if (params.per_page) queryParams.append("per_page", params.per_page);
    if (params.search) queryParams.append("search", params.search);
    if (params.status) queryParams.append("status", params.status);
    if (params.role_id) queryParams.append("role_id", params.role_id);

    const query = queryParams.toString();
    return apiRequest(`/v1/users${query ? `?${query}` : ""}`, "GET");
  },

  get: async (id) => {
    const response = await apiRequest(`/v1/users/${id}`, "GET");
    // Backend puede devolver { success, message, data: { id, name, roles, ringcentral_extension_ids, ... } }
    if (response?.data != null && typeof response.data === "object") return response.data;
    return response;
  },

  create: async (data) => {
    return apiRequest("/v1/users", "POST", data);
  },

  update: async (id, data) => {
    return apiRequest(`/v1/users/${id}`, "PUT", data);
  },

  delete: async (id) => {
    return apiRequest(`/v1/users/${id}`, "DELETE");
  },

  toggleStatus: async (id, isActive) => {
    return apiRequest(`/v1/users/${id}/status`, "PATCH", { is_active: !!isActive });
  },

  assignRoles: async (id, roleIds) => {
    return apiRequest(`/v1/users/${id}/roles`, "PUT", { roles: roleIds });
  },

  resetPassword: async (id, passwordData = {}) => {
    return apiRequest(`/v1/users/${id}/password`, "PUT", passwordData);
  },

  /**
   * Actualiza las extensiones RingCentral asociadas al usuario.
   * PUT /api/users/{id}/ringcentral-extensions
   * Body: { extension_ids: string[] }
   */
  updateRingCentralExtensions: async (id, extensionIds) => {
    return apiRequest(`/users/${id}/ringcentral-extensions`, "PUT", {
      extension_ids: Array.isArray(extensionIds) ? extensionIds : [],
    });
  },
};

export const rolesService = {
  list: async (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append("page", params.page);
    if (params.per_page) queryParams.append("per_page", params.per_page);
    if (params.search) queryParams.append("search", params.search);

    const query = queryParams.toString();
    return apiRequest(`/v1/roles${query ? `?${query}` : ""}`, "GET");
  },

  get: async (id) => {
    return apiRequest(`/v1/roles/${id}`, "GET");
  },

  create: async (data) => {
    return apiRequest("/v1/roles", "POST", data);
  },

  update: async (id, data) => {
    return apiRequest(`/v1/roles/${id}`, "PUT", data);
  },

  delete: async (id) => {
    return apiRequest(`/v1/roles/${id}`, "DELETE");
  },

  getPermissions: async (id) => {
    const role = await apiRequest(`/v1/roles/${id}`, "GET");
    return role.permissions || [];
  },

  assignPermissions: async (id, permissionIds) => {
    return apiRequest(`/v1/roles/${id}/permissions`, "PUT", {
      permissions: permissionIds,
    });
  },
};

export const permissionsService = {
  list: async (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append("page", params.page);
    if (params.per_page) queryParams.append("per_page", params.per_page);
    if (params.search) queryParams.append("search", params.search);
    if (params.module) queryParams.append("module", params.module);

    const query = queryParams.toString();
    return apiRequest(`/v1/permissions${query ? `?${query}` : ""}`, "GET");
  },

  listGrouped: async () => {
    const response = await apiRequest("/v1/permissions", "GET");
    const permissions = Array.isArray(response) ? response : (response.data || []);
    
    const grouped = {};
    permissions.forEach((perm) => {
      const module = perm.module || "Otros";
      if (!grouped[module]) {
        grouped[module] = [];
      }
      grouped[module].push(perm);
    });
    
    return { data: grouped };
  },

  get: async (id) => {
    return apiRequest(`/v1/permissions/${id}`, "GET");
  },

  create: async (data) => {
    return apiRequest("/v1/permissions", "POST", data);
  },

  update: async (id, data) => {
    return apiRequest(`/v1/permissions/${id}`, "PUT", data);
  },

  delete: async (id) => {
    return apiRequest(`/v1/permissions/${id}`, "DELETE");
  },
};

export const auditLogsService = {
  list: async (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append("page", params.page);
    if (params.per_page) queryParams.append("per_page", params.per_page);
    if (params.user_id) queryParams.append("user_id", params.user_id);
    if (params.action) queryParams.append("action", params.action);
    if (params.model) queryParams.append("model", params.model);
    if (params.start_date) queryParams.append("start_date", params.start_date);
    if (params.end_date) queryParams.append("end_date", params.end_date);

    const query = queryParams.toString();
    return apiRequest(`/v1/audit-logs${query ? `?${query}` : ""}`, "GET");
  },

  get: async (id) => {
    return apiRequest(`/v1/audit-logs/${id}`, "GET");
  },
};

export const userSessionsService = {
  list: async (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append("page", params.page);
    if (params.per_page) queryParams.append("per_page", params.per_page);
    if (params.user_id) queryParams.append("user_id", params.user_id);
    if (params.date_from) queryParams.append("date_from", params.date_from);
    if (params.date_to) queryParams.append("date_to", params.date_to);

    const query = queryParams.toString();
    return apiRequest(`/v1/user-sessions${query ? `?${query}` : ""}`, "GET");
  },

  summary: async (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.user_id) queryParams.append("user_id", params.user_id);
    if (params.date_from) queryParams.append("date_from", params.date_from);
    if (params.date_to) queryParams.append("date_to", params.date_to);

    const query = queryParams.toString();
    return apiRequest(`/v1/user-sessions/summary${query ? `?${query}` : ""}`, "GET");
  },
};

export default {
  usersService,
  rolesService,
  permissionsService,
  auditLogsService,
  userSessionsService,
};








