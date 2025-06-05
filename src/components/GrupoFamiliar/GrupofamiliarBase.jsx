// GrupofamiliarBase.jsx
import React, { useEffect, useState } from "react";
import Grupofamiliar from "../../pages/Grupofamiliar";
import apiRequest from "../../services/api";

const GrupofamiliarBase = ({ mode, id }) => {
  const [initialData, setInitialData] = useState(null);
  const [loading, setLoading] = useState(mode === "edit");
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      if (mode === "edit" && id) {
        try {
          const response = await apiRequest(`grupo_familiar/show/${id}`, "GET");
          
          setInitialData(response.data);
        } catch (err) {
          console.error("Error loading data:", err);
          setError("No se pudo cargar la información del grupo familiar.");
        } finally {
          setLoading(false);
        }
      }
    };

    fetchData();
  }, [mode, id]);

  if (loading) return <div className="text-center py-4">Cargando grupo familiar...</div>;
  if (error) return <div className="text-danger text-center py-4">{error}</div>;

  return <Grupofamiliar mode={mode} id={id} initialData={initialData} />;


};

export default GrupofamiliarBase;
