import React, { createContext, useContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import apiRequest from "../services/api";
import { normalizePermissions, normalizePermission, getPermissionAliases } from "../utils/permissions";

const AuthContext = createContext(null);

/**
 * Acepta { data: { user } }, { data: { id, email, ... } } (usuario plano en data) o { user }.
 * Evita guardar el envelope completo en localStorage (sin user.id en la raíz).
 */
function extractUserFromAuthPayload(response) {
  if (!response || typeof response !== "object") return null;
  const d = response.data;
  if (d && typeof d === "object") {
    if (d.user && typeof d.user === "object") return d.user;
    if (d.id != null || d.email != null || d.name != null) return d;
  }
  if (response.user && typeof response.user === "object") return response.user;
  if (response.id != null || response.email != null) return response;
  return null;
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [appSettings, setAppSettings] = useState(() => {
    try {
      const raw = localStorage.getItem("app_settings");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Cargar datos del usuario al iniciar
  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (token) {
      loadUserData();
    } else {
      setIsAuthenticated(false);
      setLoading(false);
    }
  }, []);

  const loadUserData = async () => {
    try {
      const response = await apiRequest("/v1/auth/me", "GET");
      
      // Nueva estructura del backend:
      // { success, message, data: { user: { roles: [...], permissions: [...] }, roles: [...], permissions: [...] } }
      // Prioridad para permisos: data.permissions (array de strings) > data.user.permissions (objetos) > otros
      // Prioridad para roles: data.user.roles (objetos completos) > data.roles (objetos) > otros
      let userData = extractUserFromAuthPayload(response);
      if (!userData) {
        userData = response.data?.user || response.user || response;
      }

      // Extraer roles: preferir data.user.roles (objetos completos), luego data.roles
      let rolesData = userData?.roles || response.data?.roles || response.roles || [];

      // Extraer permisos: preferir data.permissions (array de strings), luego data.user.permissions (objetos)
      let permissionsData = response.data?.permissions || userData?.permissions || response.permissions || [];
      
      // Normalizar permisos: convertir objetos a strings y normalizar
      // Los permisos pueden venir como objetos { id, slug, name } o como strings
      const normalizedPermissions = normalizePermissions(permissionsData);
      
      // Log para debugging (siempre en desarrollo, condicional en producción)
      if (import.meta.env.DEV || import.meta.env.MODE === 'development') {
        console.log("✅ Datos del usuario cargados:", {
          user: userData,
          roles: rolesData,
          permissions: {
            raw: permissionsData,
            normalized: normalizedPermissions,
            count: normalizedPermissions.length,
            sample: normalizedPermissions.slice(0, 5), // Primeros 5 para debug
          },
        });
      }
      
      const settingsData =
        response.data?.app_settings ||
        response.app_settings ||
        null;

      setUser(userData);
      setRoles(Array.isArray(rolesData) ? rolesData : []);
      setPermissions(normalizedPermissions); // Guardar como array de strings normalizados
      if (settingsData && typeof settingsData === "object") {
        setAppSettings(settingsData);
        localStorage.setItem("app_settings", JSON.stringify(settingsData));
      }
      setIsAuthenticated(true);
      
      // Guardar en localStorage
      if (userData) {
        localStorage.setItem("user", JSON.stringify(userData));
      }
      if (rolesData && Array.isArray(rolesData) && rolesData.length > 0) {
        localStorage.setItem("roles", JSON.stringify(rolesData));
      }
      if (normalizedPermissions && normalizedPermissions.length > 0) {
        localStorage.setItem("permissions", JSON.stringify(normalizedPermissions));
      }
    } catch (error) {
      const status = error.response?.status;
      // Solo cerrar sesión ante rechazo de autenticación/autorización, no por fallos de red o 5xx
      if (status === 401 || status === 403) {
        localStorage.removeItem("auth_token");
        localStorage.removeItem("user");
        localStorage.removeItem("roles");
        localStorage.removeItem("permissions");
        localStorage.removeItem("app_settings");
        setUser(null);
        setRoles([]);
        setPermissions([]);
        setAppSettings(null);
        setIsAuthenticated(false);
        const currentPath = window.location.pathname;
        if (currentPath !== "/login") {
          navigate("/login", { replace: true });
        }
      } else {
        console.warn("No se pudo refrescar /v1/auth/me:", error);
        try {
          const rawUser = localStorage.getItem("user");
          const token = localStorage.getItem("auth_token");
          if (rawUser && token) {
            const parsed = JSON.parse(rawUser);
            setUser(parsed);
            setRoles(JSON.parse(localStorage.getItem("roles") || "[]"));
            setPermissions(normalizePermissions(JSON.parse(localStorage.getItem("permissions") || "[]")));
            setIsAuthenticated(true);
          } else {
            setUser(null);
            setRoles([]);
            setPermissions([]);
            setIsAuthenticated(false);
          }
        } catch {
          setUser(null);
          setRoles([]);
          setPermissions([]);
          setIsAuthenticated(false);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await apiRequest("/v1/auth/login", "POST", {
        email,
        password,
      });

      // El backend retorna: { success, message, data: { token, user: { roles, permissions } } }
      // Estructura: response.data.token y response.data.user
      const token = response.data?.token || response.token;
      let userData = extractUserFromAuthPayload(response);
      if (!userData) {
        userData = response.data?.user || response.user;
      }

      if (token) {
        localStorage.setItem("auth_token", token);
        
        // Si el usuario viene en la respuesta del login, usarlo directamente
        // Estructura del login puede ser: { data: { token, user: {...}, roles: [...], permissions: [...] } }
        if (userData) {
          // Extraer roles y permisos con la misma lógica que loadUserData
          const rolesData = userData.roles || response.data?.roles || [];
          const permissionsData = response.data?.permissions || userData.permissions || [];
          
          // Normalizar permisos del login
          const normalizedPermissions = normalizePermissions(permissionsData);
          
          setUser(userData);
          setRoles(Array.isArray(rolesData) ? rolesData : []);
          setPermissions(normalizedPermissions);
          setIsAuthenticated(true);
          
          // Guardar en localStorage
          localStorage.setItem("user", JSON.stringify(userData));
          if (rolesData && Array.isArray(rolesData) && rolesData.length > 0) {
            localStorage.setItem("roles", JSON.stringify(rolesData));
          }
          if (normalizedPermissions && normalizedPermissions.length > 0) {
            localStorage.setItem("permissions", JSON.stringify(normalizedPermissions));
          }
        } else {
          // Si no viene el usuario en el login, cargarlo con /me
          await loadUserData();
        }
        
        return { success: true };
      }
      
      throw new Error("Token no recibido");
    } catch (error) {
      let errorMessage = "Error al iniciar sesión";
      let errorType = "unknown";
      
      if (error.response) {
        const status = error.response.status;
        const errs = error.response.data?.errors;
        const firstFieldError =
          errs && typeof errs === "object"
            ? Object.values(errs).flat().find((m) => typeof m === "string")
            : null;
        const backendMessage =
          error.response.data?.message || firstFieldError || null;

        if (status === 401 || status === 422) {
          errorType = "credentials";
          errorMessage = backendMessage || "Usuario o contraseña incorrectos";
        } else if (status >= 500) {
          errorType = "server";
          errorMessage = "Error del servidor. Por favor, intenta más tarde.";
        } else if (status === 404) {
          errorType = "server";
          errorMessage = "Servicio no disponible. Por favor, contacta al administrador.";
        } else {
          errorType = "server";
          errorMessage = backendMessage || "Error del servidor. Por favor, intenta más tarde.";
        }
      } else {
        errorType = "connection";
        errorMessage = "Error de conexión con el servidor. Verifica tu conexión a internet.";
      }
      
      return {
        success: false,
        error: errorMessage,
        errorType,
      };
    }
  };

  const logout = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      if (token) {
        await apiRequest("/v1/auth/logout", "POST");
      }
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    } finally {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("user");
      localStorage.removeItem("roles");
      localStorage.removeItem("permissions");
      localStorage.removeItem("app_settings");
      setUser(null);
      setRoles([]);
      setPermissions([]);
      setAppSettings(null);
      setIsAuthenticated(false);
      navigate("/login");
    }
  };

  const hasPermission = (permissionSlug) => {
    if (!permissions || permissions.length === 0) {
      if (import.meta.env.DEV) {
        console.warn("⚠️ hasPermission: No hay permisos disponibles", { permissionSlug });
      }
      return false;
    }
    
    // Normalizar el permiso solicitado
    const normalizedRequested = normalizePermission(permissionSlug);
    if (!normalizedRequested) {
      if (import.meta.env.DEV) {
        console.warn("⚠️ hasPermission: Permiso solicitado inválido", { permissionSlug });
      }
      return false;
    }
    
    // Obtener aliases del permiso solicitado (incluye el permiso original)
    const aliases = getPermissionAliases(normalizedRequested);
    
    // Verificar si alguno de los permisos del usuario coincide con el permiso solicitado o sus aliases
    const hasAccess = permissions.some((userPerm) => {
      const normalizedUserPerm = normalizePermission(userPerm);
      
      // Verificar coincidencia exacta
      if (normalizedUserPerm === normalizedRequested) return true;
      
      // Verificar si el permiso del usuario es uno de los aliases del permiso solicitado
      if (aliases.includes(normalizedUserPerm)) return true;
      
      // Verificar si el permiso solicitado es un alias del permiso del usuario
      const userAliases = getPermissionAliases(normalizedUserPerm);
      if (userAliases.includes(normalizedRequested)) return true;
      
      return false;
    });
    
    // Log para debugging en desarrollo
    if (import.meta.env.DEV && !hasAccess) {
      console.log("🔍 hasPermission - Acceso denegado:", {
        requested: permissionSlug,
        normalizedRequested,
        aliases,
        userPermissions: permissions.slice(0, 10), // Primeros 10 para no saturar
        totalPermissions: permissions.length,
      });
    }
    
    return hasAccess;
  };

  const hasRole = (roleSlug) => {
    if (!roles || roles.length === 0) return false;
    return roles.some((role) => role.slug === roleSlug || role === roleSlug);
  };

  const hasAnyPermission = (permissionSlugs) => {
    return permissionSlugs.some((slug) => hasPermission(slug));
  };

  const hasAllPermissions = (permissionSlugs) => {
    return permissionSlugs.every((slug) => hasPermission(slug));
  };

  const refreshUserData = async () => {
    await loadUserData();
  };

  const value = {
    user,
    roles,
    permissions,
    appSettings,
    setAppSettings,
    isAuthenticated,
    loading,
    login,
    logout,
    hasPermission,
    hasRole,
    hasAnyPermission,
    hasAllPermissions,
    refreshUserData,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe usarse dentro de AuthProvider");
  }
  return context;
};

export default AuthContext;

