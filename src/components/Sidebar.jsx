import React from "react";
import { Link } from "react-router-dom";
import { FaHome, FaUsers, FaProjectDiagram, FaFolder, FaSignOutAlt, FaChevronLeft, FaTools } from "react-icons/fa";
import "../styles/Sidebar.css";
import logo from "../assets/tampa.jpg";

const Sidebar = ({ isOpen, toggleSidebar }) => {
  const users =localStorage.getItem("name")
  return (
    <div className={`sidebar ${isOpen ? "expanded" : "collapsed"}`}>
      {/* Botón de toggle */}
      <button className="toggle-btn" onClick={toggleSidebar}>
        <FaChevronLeft />
      </button>

      {/* Logo */}
      {isOpen && (
        <div className="logo-container">
          <img src={logo} alt="Tampa Seguros" className="logo-img" />
        </div>
      )}

      {/* Bienvenida */}
      {isOpen && (
        <div className="welcome-container">
          <p>Bienvenido</p>
          <span>{users}</span>
        </div>
      )}

      {/* Navegación */}
      <nav>
        <Link to="/" className="nav-link"><FaHome /> {isOpen && "Dashboard"}</Link>
        <Link to="/Clientes" className="nav-link"><FaUsers /> {isOpen && "Cliente"}</Link>
        <Link to="/Grupofamiliar" className="nav-link"><FaProjectDiagram /> {isOpen && "Grupo Familiar"}</Link>
        <Link to="/Informes" className="nav-link"><FaFolder /> {isOpen && "Informes"}</Link>
        <Link to="/Herramientas" className="nav-link"><FaTools /> {isOpen && "Importar Clientes"}</Link>
      </nav>

      {/* Cerrar sesión */}
      <div className="logout-button">
        <FaSignOutAlt className="logout-icon" />
      </div>
    </div>
  );
};

export default Sidebar;
