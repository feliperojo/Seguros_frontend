import { useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import systemConfigService from "../services/SystemConfigService";
import { isMenuItemEnabled } from "../constants/menuVisibility";

function asVisibilityMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value;
}

const loadsByUser = new Map();

function readStoredSettings() {
  try {
    const raw = localStorage.getItem("app_settings");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function persistSettings(next) {
  localStorage.setItem("app_settings", JSON.stringify(next));
}

/**
 * Visibilidad global del menú.
 * Clave ausente o true = visible. false = oculto para quien no administra.
 */
export default function useMenuVisibility() {
  const { user, appSettings, setAppSettings, hasRole, hasAnyPermission } = useAuth();

  useEffect(() => {
    const userId = user?.id;
    if (!userId || loadsByUser.has(userId)) return undefined;

    const request = systemConfigService
      .getRuntime()
      .then((runtime) => {
        const menuVisibility = asVisibilityMap(runtime?.menu_visibility);
        if (typeof setAppSettings === "function") {
          setAppSettings((prev) => {
            const base = prev || readStoredSettings() || {};
            const next = { ...base, menu_visibility: menuVisibility };
            persistSettings(next);
            return next;
          });
        }
      })
      .catch(() => {
        loadsByUser.delete(userId);
      });

    loadsByUser.set(userId, request);
    return undefined;
  }, [user?.id, setAppSettings]);

  const map = asVisibilityMap(appSettings?.menu_visibility);

  const isVisible = (key) => isMenuItemEnabled(map, key);

  const canPreviewHidden =
    hasRole("admin") || hasAnyPermission(["settings.edit", "settings.update"]);

  const publishVisibility = (menuVisibility) => {
    if (typeof setAppSettings !== "function") return;
    setAppSettings((prev) => {
      const base = prev || readStoredSettings() || {};
      const next = { ...base, menu_visibility: menuVisibility || {} };
      persistSettings(next);
      return next;
    });
  };

  return {
    map,
    isVisible,
    canPreviewHidden,
    publishVisibility,
  };
}
