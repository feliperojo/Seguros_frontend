// src/pages/GrupofamiliarEdit.jsx
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import GrupoFamiliarService from "../../services/GrupoFamiliarService";
import Grupofamiliar from "../../pages/Grupofamiliar"; // Asegúrate que este es el componente base correcto
import { Helmet } from "react-helmet-async";
import useGrupoFamiliarEdicionPresencia from "../../hooks/useGrupoFamiliarEdicionPresencia";
import GrupoFamiliarEdicionAlerta from "./GrupoFamiliarEdicionAlerta";


const GrupofamiliarEdit = () => {
  const { id } = useParams();
  const [initialData, setInitialData] = useState(null);
  const [initialEdicion, setInitialEdicion] = useState(null);
  const [loading, setLoading] = useState(true);

  const { edicion } = useGrupoFamiliarEdicionPresencia(id, {
    registrarPresencia: true,
    activo: true,
    initialEdicion,
  });

  useEffect(() => {
    const fetchGrupo = async () => {
      try {
        const { data, meta } = await GrupoFamiliarService.fetchFullGrupo(id, {
          onlyActive: true,
        });
      
        setInitialData(data);
        setInitialEdicion(meta?.edicion ?? null);
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
    <div className="container-fluid py-2 px-3">
      <GrupoFamiliarEdicionAlerta edicion={edicion} />
      <Grupofamiliar
      mode="edit"
      id={id}
      initialData={initialData}
      />
    </div>
      </>
  );
};

export default GrupofamiliarEdit;
