import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { 
  FaHome, FaUsers, FaProjectDiagram, FaFolder, FaSignOutAlt, FaChevronLeft, 
  FaTools, FaChevronDown, FaChevronRight, FaUserPlus, FaList, FaFile,
  FaCalendarAlt, FaChartBar, FaPlus, FaFileImport, FaFileExport, FaCogs, FaChartLine, FaMoneyCheckAlt, FaSyncAlt, FaFileInvoiceDollar
} from "react-icons/fa";
import "../styles/Sidebar.css";
import logo from "../assets/tampa.jpg";
import  SincronizarContactos from "../components/SincronizarContactos";


const Sidebar = ({ isOpen, toggleSidebar }) => {
  const users = JSON.parse(localStorage.getItem("user"))?.name || "Usuario";

  const location = useLocation();
  
  // Estado para controlar qué submenús están expandidos
  const [expandedMenu, setExpandedMenu] = useState(null);

  const navigate = useNavigate();

const handleLogout = () => {
  localStorage.removeItem("auth_token");
  localStorage.removeItem("name"); // Opcional
  navigate("/login");
};
useEffect(() => {
  const token = localStorage.getItem("auth_token");
  if (!token) {
    navigate("/login");
  }
}, []);

  
  // Expandir automáticamente el menú basado en la ruta actual
  useEffect(() => {
    if (location.pathname.includes('/Clientes')) {
      setExpandedMenu('clientes');
    } else if (location.pathname.includes('/Grupofamiliar')) {
      setExpandedMenu('grupos');
    } else if (location.pathname.includes('/Informes')) {
      setExpandedMenu('informes');
    } else if (location.pathname.includes('/Herramientas')) {
      setExpandedMenu('herramientas');
    }
  }, [location]);
  
  // Función para manejar la expansión de submenús
  const toggleSubmenu = (menu, e) => {
    e.stopPropagation(); // Evita que el evento se propague
    if (expandedMenu === menu) {
      setExpandedMenu(null);
    } else {
      setExpandedMenu(menu);
    }
  };
  
  // Verifica si un enlace está activo
  const isActive = (path) => {
    return location.pathname === path;
  };
  
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
        {/* Dashboard - Sin submenú */}
        <Link to="/" className={`nav-link ${isActive('/') ? 'active' : ''}`}>
          <FaHome /> {isOpen && "Panel principal"}
        </Link>
        
        {/* Clientes - Con submenú */}
        <div className="nav-item">
          <div 
            className={`nav-link ${location.pathname.includes('/Clientes') ? 'active' : ''}`}
            onClick={(e) => isOpen && toggleSubmenu('clientes', e)}
          >
            <FaUsers /> 
            {isOpen && (
              <>
                <span>Clientes</span>
                {expandedMenu === 'clientes' ? 
                  <FaChevronDown className="submenu-icon" /> : 
                  <FaChevronRight className="submenu-icon" />
                }
              </>
            )}
          </div>
          
          {/* Submenú de Clientes */}
          {isOpen && expandedMenu === 'clientes' && (
            <div className="submenu">
              <Link to="/Clientes/lista" className={`submenu-link ${isActive('/Clientes/lista') ? 'active' : ''}`}>
                <FaList /> Lista de Clientes
              </Link>
              <Link to="/Clientes/crear" className={`submenu-link ${isActive('/Clientes/crear') ? 'active' : ''}`}>
                <FaUserPlus /> Crear Cliente
              </Link>
            </div>
          )}
        </div>
        
        {/* Grupo Familiar - Con submenú */}
        <div className="nav-item">
          <div 
            className={`nav-link ${location.pathname.includes('/Grupofamiliar') ? 'active' : ''}`}
            onClick={(e) => isOpen && toggleSubmenu('grupos', e)}
          >
            <FaProjectDiagram /> 
            {isOpen && (
              <>
                <span>Grupo Familiar</span>
                {expandedMenu === 'grupos' ? 
                  <FaChevronDown className="submenu-icon" /> : 
                  <FaChevronRight className="submenu-icon" />
                }
              </>
            )}
          </div>
          
          {/* Submenú de Grupo Familiar */}
          {isOpen && expandedMenu === 'grupos' && (
            <div className="submenu">
              <Link to="/Grupofamiliar/lista" className={`submenu-link ${isActive('/Grupofamiliar/lista') ? 'active' : ''}`}>
                <FaList /> Lista de Grupos
              </Link>
              <Link to="/Grupofamiliar/crear" className={`submenu-link ${isActive('/Grupofamiliar/crear') ? 'active' : ''}`}>
                <FaPlus /> Crear Grupo
              </Link>
              <Link to="/Grupofamiliar/RequerimientosAdmin" className={`submenu-link ${isActive('/Grupofamiliar/proximos-vencimientos') ? 'active' : ''}`}>
                <FaFile /> Documentos Solicitados
              </Link>
              {/* <Link to="/Grupofamiliar/proximos-vencimientos" className={`submenu-link ${isActive('/Grupofamiliar/proximos-vencimientos') ? 'active' : ''}`}>
                <FaCalendarAlt /> Polizas Vencidas
              </Link> */}
            </div>
          )}
        </div>
    
       {/* PAGOS */}
       <div className="nav-item">
          <div 
            className={`nav-link ${location.pathname.includes('/Pagos') ? 'active' : ''}`}
            onClick={(e) => isOpen && toggleSubmenu('pagos', e)}
          >
            <FaChartLine /> 
            {isOpen && (
              <>
                <span>Pagos</span>
                {expandedMenu === 'pagos' ? 
                  <FaChevronDown className="submenu-icon" /> : 
                  <FaChevronRight className="submenu-icon" />
                }
              </>
            )}
          </div>
          
          {/* Submenú de Pagos */}
          {isOpen && expandedMenu === 'pagos' && (
            <div className="submenu">
              <Link to="/Pagos/Generarpagos" className={`submenu-link ${isActive('/Pagos/Generarpagos') ? 'active' : ''}`}>
                <FaMoneyCheckAlt /> Generacion de Pagos
              </Link>
              <Link to="/Pagos/pagos" className={`submenu-link ${isActive('/Pagos/pagos') ? 'active' : ''}`}>
                <FaSyncAlt /> Actualizacion de Pagos
              </Link>
              <Link to="/Pagos/cartera" className={`submenu-link ${isActive('/Pagos/cartera') ? 'active' : ''}`}>
                <FaFileInvoiceDollar /> Informe de Pagos
              </Link>
            </div>
          )}
        </div>
        

        
        {/* Informes - Con submenú */}
        <div className="nav-item">
          <div 
            className={`nav-link ${location.pathname.includes('/Informes') ? 'active' : ''}`}
            onClick={(e) => isOpen && toggleSubmenu('informes', e)}
          >
            <FaFolder /> 
            {isOpen && (
              <>
                <span>Informes</span>
                {expandedMenu === 'informes' ? 
                  <FaChevronDown className="submenu-icon" /> : 
                  <FaChevronRight className="submenu-icon" />
                }
              </>
            )}
          </div>
          
          {/* Submenú de Informes */}
          {isOpen && expandedMenu === 'informes' && (
            <div className="submenu">
              <Link to="/Informes/historialCliente" className={`submenu-link ${isActive('/Informes/historialCliente') ? 'active' : ''}`}>
                <FaChartBar /> Informes de Clientes
              </Link>
              {/* <Link to="/Informes/polizas" className={`submenu-link ${isActive('/Informes/polizas') ? 'active' : ''}`}>
                <FaChartBar /> Informes de Pólizas
              </Link> */}
            </div>
          )}
        </div>

        
        {/* Herramientas - Con submenú */}
        <div className="nav-item">
          <div 
            className={`nav-link ${location.pathname.includes('/Herramientas') ? 'active' : ''}`}
            onClick={(e) => isOpen && toggleSubmenu('herramientas', e)}
          >
            <FaTools /> 
            {isOpen && (
              <>
                <span>Herramientas</span>
                {expandedMenu === 'herramientas' ? 
                  <FaChevronDown className="submenu-icon" /> : 
                  <FaChevronRight className="submenu-icon" />
                }
              </>
            )}
          </div>
          
          {/* Submenú de Herramientas */}
          {isOpen && expandedMenu === 'herramientas' && (
            <div className="submenu">
              <Link to="/Herramientas" className={`submenu-link ${isActive('/Herramientas') ? 'active' : ''}`}>
                <FaFileImport /> Importar Clientes
              </Link>
              <Link to="/Herramientas/exportar" className={`submenu-link ${isActive('/Herramientas/exportar') ? 'active' : ''}`}>
                <FaFileExport /> Exportar Datos
              </Link>
              <Link to="/Herramientas/auditoria" className={`submenu-link ${isActive('/Herramientas/auditoria') ? 'active' : ''}`}>
                <FaCogs /> Auditoria
              </Link>
              <Link to="/Herramientas/operaciones" className={`submenu-link ${isActive('/Herramientas/auditoria') ? 'active' : ''}`}>
                <FaCogs /> Centro de Operaciones
              </Link>
            </div>
          )}
        </div>
      </nav>
      
      {/* Cerrar sesión */}
            <div className="logout-button" onClick={handleLogout} style={{ cursor: "pointer" }}>
              <FaSignOutAlt className="logout-icon" />
              {isOpen && <span className="logout-text">Cerrar sesión</span>}
            </div>

    </div>
  );
};

export default Sidebar;