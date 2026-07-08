import { useMemo } from "react";
import { useAuth } from "../context/AuthContext";

/**
 * Solo el super usuario configurado en Vantun (system_config.super_user_id).
 */
export default function useCanManageDocumentTrash() {
  const { appSettings } = useAuth();

  return useMemo(() => {
    return !!(
      appSettings?.can_manage_document_trash || appSettings?.is_super_user
    );
  }, [appSettings]);
}
