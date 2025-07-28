// src/pages/GrupofamiliarEdit.jsx
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import GrupoFamiliarService from "../../services/GrupoFamiliarService";
import Grupofamiliar from "../../pages/Grupofamiliar"; // Asegúrate que este es el componente base correcto
import { Helmet } from "react-helmet-async";


const GrupofamiliarEdit = () => {
  const { id } = useParams();
  const [initialData, setInitialData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGrupo = async () => {
      try {
        const response = await GrupoFamiliarService.getFullGrupoById(id, true); // ← solo activas
      
        setInitialData(response);
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
    <>
      <Helmet>
            <title>Vantun/Editar Grupo</title>
          </Helmet>
    <Grupofamiliar
      mode="edit"
      id={id}
      initialData={initialData}
      />
      </>
  );
};

export default GrupofamiliarEdit;
