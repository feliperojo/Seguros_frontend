import { useMemo } from "react";
import { useAuth } from "../context/AuthContext";

/**
 * Admin, permiso documentos.gestionar_eliminados o super usuario de Vantun (system_config).
 */
export default function useCanManageDocumentTrash() {
  const { hasRole, hasPermission, appSettings } = useAuth();

  return useMemo(() => {
    if (appSettings?.can_manage_document_trash) {
      return true;
    }

    if (appSettings?.is_super_user) {
      return true;
    }

    return hasRole("admin") || hasPermission("documentos.gestionar_eliminados");
  }, [appSettings, hasRole, hasPermission]);
}
