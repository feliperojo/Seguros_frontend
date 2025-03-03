import React from "react";
import "../styles/Dashboard.css";
import TableComponent from "../components/TableComponent"; // Importar el nuevo componente de tabla

const Dashboard = () => {
  return (
    <div className="content">
      
      <TableComponent />
    </div>
  );
};

export default Dashboard;
