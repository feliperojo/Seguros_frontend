import { useState } from 'react';
import apiRequest from "../services/api.js";

const SincronizarContactos = () => {
  const [estado, setEstado] = useState("");

  const sincronizar = async () => {
    try {
      setEstado("Sincronizando...");
      const data = await apiRequest("sincronizar-ringcentral", "GET");
      setEstado("✅ " + data.mensaje);
    } catch (err) {
      console.error(err);
      setEstado("❌ Error al sincronizar");
    }
  };

  return (
    <div>
      <button className="btn btn-primary" onClick={sincronizar}>
        🔄 Sincronizar contactos con RingCentral
      </button>
      {estado && <p className="mt-2">{estado}</p>}
    </div>
  );
};

export default SincronizarContactos;
