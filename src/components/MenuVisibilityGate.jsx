import { Link, useLocation } from "react-router-dom";
import { findMenuItemByPath } from "../constants/menuVisibility";
import useMenuVisibility from "../hooks/useMenuVisibility";

/**
 * Si un ítem del menú está apagado, la ruta sigue existiendo
 * pero quien no administra ve un aviso en lugar de la pantalla.
 */
const MenuVisibilityGate = ({ children }) => {
  const location = useLocation();
  const { isVisible, canPreviewHidden } = useMenuVisibility();
  const item = findMenuItemByPath(location.pathname);

  if (!item || item.locked || isVisible(item.key) || canPreviewHidden) {
    return children;
  }

  return (
    <div className="container py-5" style={{ maxWidth: 640 }}>
      <div className="card border-0 shadow-sm">
        <div className="card-body p-4">
          <h1 className="h4 mb-2">Módulo desactivado</h1>
          <p className="mb-1">
            <strong>{item.label}</strong> está oculto para los usuarios.
          </p>
          <p className="text-muted mb-4">
            La pantalla sigue en el sistema. Quien administra la visibilidad del menú puede volver a activarla.
          </p>
          <Link to="/" className="btn btn-primary">
            Volver al panel
          </Link>
        </div>
      </div>
    </div>
  );
};

export default MenuVisibilityGate;
