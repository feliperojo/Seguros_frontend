import React from "react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

/**
 * Componente reutilizable para mostrar mensajes de éxito o error
 * @param {string} type - Tipo de mensaje: "success" o "error"
 * @param {string} message - Texto del mensaje a mostrar
 * @param {number} autoClose - Tiempo en milisegundos antes de que el mensaje desaparezca
 */
const AlertMessage = ({ type = "success", message, autoClose = 3000 }) => {
  // Mostrar la alerta con el mensaje adecuado
  if (type === "success") {
    toast.success(`✅ ${message}`, {
      position: "top-right",
      autoClose,
      hideProgressBar: false,
    });
  } else if (type === "error") {
    toast.error(`❌ ${message}`, {
      position: "top-right",
      autoClose,
      hideProgressBar: false,
    });
  }

  return <ToastContainer />;
};

export default AlertMessage;
