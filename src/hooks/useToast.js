import { toast } from "react-toastify";

/**
 * Hook personalizado para mostrar mensajes toast de forma consistente
 * @returns {Object} Objeto con funciones para mostrar diferentes tipos de mensajes
 */
const useToast = () => {
  /**
   * Muestra un mensaje de éxito
   * @param {string} message - Mensaje a mostrar
   * @param {Object} options - Opciones adicionales para el toast
   */
  const showSuccess = (message, options = {}) => {
    toast.success(message, {
      position: "top-right",
      autoClose: options.autoClose || 5000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      ...options,
    });
  };

  /**
   * Muestra un mensaje de error
   * @param {string} message - Mensaje a mostrar
   * @param {Object} options - Opciones adicionales para el toast
   */
  const showError = (message, options = {}) => {
    toast.error(message, {
      position: "top-right",
      autoClose: options.autoClose || 5000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      ...options,
    });
  };

  /**
   * Muestra un mensaje de advertencia
   * @param {string} message - Mensaje a mostrar
   * @param {Object} options - Opciones adicionales para el toast
   */
  const showWarning = (message, options = {}) => {
    toast.warning(message, {
      position: "top-right",
      autoClose: options.autoClose || 5000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      ...options,
    });
  };

  /**
   * Muestra un mensaje informativo
   * @param {string} message - Mensaje a mostrar
   * @param {Object} options - Opciones adicionales para el toast
   */
  const showInfo = (message, options = {}) => {
    toast.info(message, {
      position: "top-right",
      autoClose: options.autoClose || 5000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      ...options,
    });
  };

  /**
   * Muestra un mensaje personalizado
   * @param {string} message - Mensaje a mostrar
   * @param {Object} options - Opciones adicionales para el toast
   */
  const show = (message, options = {}) => {
    toast(message, {
      position: "top-right",
      autoClose: options.autoClose || 5000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      ...options,
    });
  };

  return {
    showSuccess,
    showError,
    showWarning,
    showInfo,
    show,
  };
};

export default useToast;

