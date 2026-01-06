import { useAuth } from "../context/AuthContext";

export const useHasPermission = (permissionSlug) => {
  const { hasPermission } = useAuth();
  return hasPermission(permissionSlug);
};

export const useHasAnyPermission = (permissionSlugs) => {
  const { hasAnyPermission } = useAuth();
  return hasAnyPermission(permissionSlugs);
};

export const useHasAllPermissions = (permissionSlugs) => {
  const { hasAllPermissions } = useAuth();
  return hasAllPermissions(permissionSlugs);
};

export const useHasRole = (roleSlug) => {
  const { hasRole } = useAuth();
  return hasRole(roleSlug);
};

export default useHasPermission;






