// src/pages/GrupofamiliarEdit.jsx
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import GrupoFamiliarService from "../../services/GrupoFamiliarService";
import Grupofamiliar from "../../pages/Grupofamiliar"; // Asegúrate que este es el componente base correcto

const GrupofamiliarEdit = () => {
  const { id } = useParams();
  const [initialData, setInitialData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGrupo = async () => {
      try {
        const response = await GrupoFamiliarService.getFullGrupoById(id);
        setInitialData(response.data); // No usamos `.data` porque el servicio ya lo entrega limpio
      } catch (err) {
        console.error("❌ Error al cargar grupo familiar:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchGrupo();
  }, [id]);

  if (loading) return <p>Cargando grupo familiar...</p>;
  if (!initialData) return <p>Error cargando los datos del grupo.</p>;

  return (
    <Grupofamiliar
      mode="edit"
      id={id}
      initialData={initialData}
    />
  );
};

export default GrupofamiliarEdit;
