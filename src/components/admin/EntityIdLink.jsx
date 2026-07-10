import React from "react";
import { Link } from "react-router-dom";
import { getEntityPath } from "../../utils/entityRoutes";

/**
 * Enlace al ID de entidad (cliente o grupo familiar) cuando aplica.
 */
const EntityIdLink = ({ entityType, entityId, className = "" }) => {
  if (entityId == null || entityId === "") {
    return null;
  }

  const path = getEntityPath(entityType, entityId);

  if (!path) {
    return <small className={`text-muted ${className}`.trim()}>#{entityId}</small>;
  }

  return (
    <Link
      to={path}
      className={`ms-1 fw-semibold text-decoration-none ${className}`.trim()}
      title="Abrir ficha"
    >
      #{entityId}
    </Link>
  );
};

export default EntityIdLink;
