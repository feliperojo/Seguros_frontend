import { useEffect } from "react";
import useToast from "../hooks/useToast";

/**
 * Componente reutilizable para mostrar mensajes de éxito o error
 * Este componente usa el hook useToast y muestra el mensaje automáticamente
 * 
 * @param {string} type - Tipo de mensaje: "success", "error", "warning" o "info"
 * @param {string} message - Texto del mensaje a mostrar
 * @param {number} autoClose - Tiempo en milisegundos antes de que el mensaje desaparezca
 * @param {boolean} show - Controla si se debe mostrar el mensaje
 */
const AlertMessage = ({ 
  type = "success", 
  message, 
  autoClose = 5000,
  show = true 
}) => {
  const toast = useToast();

  useEffect(() => {
    if (show && message) {
      switch (type) {
        case "success":
          toast.showSuccess(message, { autoClose });
          break;
        case "error":
          toast.showError(message, { autoClose });
          break;
        case "warning":
          toast.showWarning(message, { autoClose });
          break;
        case "info":
          toast.showInfo(message, { autoClose });
          break;
        default:
          toast.show(message, { autoClose });
      }
    }
  }, [show, message, type, autoClose, toast]);

  // Este componente no renderiza nada, solo dispara el toast
  return null;
};

export default AlertMessage;
