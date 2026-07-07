import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import systemConfigService from "../services/SystemConfigService";

/**
 * Lee flags globales de la aplicación (p. ej. show_payment_methods_data).
 * Prioridad: AuthContext → localStorage → GET /v1/system-config/runtime
 */
export default function useAppSettings() {
  const { appSettings, setAppSettings } = useAuth();
  const [loading, setLoading] = useState(false);

  const showPaymentMethodsData = !!appSettings?.show_payment_methods_data;

  const refreshAppSettings = useCallback(async () => {
    setLoading(true);
    try {
      const runtime = await systemConfigService.getRuntime();
      const next = {
        ...(appSettings || {}),
        show_payment_methods_data: !!runtime?.show_payment_methods_data,
        require_super_password: !!runtime?.require_super_password,
        allow_family_document_archive_folders: !!runtime?.allow_family_document_archive_folders,
        is_super_user: !!runtime?.is_super_user,
        can_manage_document_trash: !!runtime?.can_manage_document_trash,
      };
      if (typeof setAppSettings === "function") {
        setAppSettings(next);
      }
      localStorage.setItem("app_settings", JSON.stringify(next));
      return next;
    } catch (err) {
      console.warn("No se pudo cargar configuración runtime:", err);
      return appSettings;
    } finally {
      setLoading(false);
    }
  }, [appSettings, setAppSettings]);

  useEffect(() => {
    if (appSettings != null) return;
    try {
      const raw = localStorage.getItem("app_settings");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof setAppSettings === "function") {
          setAppSettings(parsed);
        }
        return;
      }
    } catch {
      // ignore
    }
    refreshAppSettings();
  }, [appSettings, refreshAppSettings, setAppSettings]);

  return {
    appSettings,
    showPaymentMethodsData,
    loading,
    refreshAppSettings,
  };
}
