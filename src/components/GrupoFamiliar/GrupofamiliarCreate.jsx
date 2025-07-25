import React from "react";
import Grupofamiliar from "../../pages/Grupofamiliar";
import { Helmet } from "react-helmet-async";


const GrupofamiliarCreate = () => {
  return (
    <>
      <Helmet>
        <title>Vantun/Crear Grupo Familiar</title>
      </Helmet>
      <Grupofamiliar mode="create" />
    </>
  );
};

export default GrupofamiliarCreate;
