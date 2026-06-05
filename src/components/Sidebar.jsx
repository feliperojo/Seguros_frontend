import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  FaHome, FaUsers, FaProjectDiagram, FaFolder, FaSignOutAlt, FaChevronLeft, FaUserFriends,
  FaTools, FaChevronDown, FaChevronRight, FaUserPlus, FaList, FaFile, FaTags,
  FaCalendarAlt, FaChartBar, FaPlus, FaFileImport, FaFileExport, FaCogs, FaChartLine, FaMoneyCheckAlt, FaSyncAlt, FaFileInvoiceDollar,
  FaUserShield, FaShieldAlt, FaKey, FaHistory, FaFileAlt, FaClipboardCheck, FaBirthdayCake, FaTasks, FaPhone, FaClock,
  FaBook, FaColumns, FaCreditCard
} from "react-icons/fa";
import "../styles/Sidebar.css";
import logo from "../assets/tampa.jpg";
import SincronizarContactos from "../components/SincronizarContactos";
import { useAuth } from "../context/AuthContext";
import { useHasPermission } from "../hooks/useHasPermission";
import DateTimeDisplay from "./DateTimeDisplay";
import { usersService } from "../services/adminApi";
import { getExtensions } from "../services/ringCentralIntegrationApi";


const Sidebar = ({ isOpen, toggleSidebar }) => {
  const storedUser = JSON.parse(localStorage.getItem("user") || "null");
  const { user } = useAuth();
  const userName = user?.name || storedUser?.name || "Usuario";

  // Extensiones RingCentral: del usuario en contexto/localStorage o carga única si no vienen en /me
  const [sidebarExtensionIds, setSidebarExtensionIds] = useState(null);
  useEffect(() => {
    if (!user?.id) {
      setSidebarExtensionIds(null);
      return;
    }
    if (user.ringcentral_extension_ids !== undefined && user.ringcentral_extension_ids !== null) {
      setSidebarExtensionIds(Array.isArray(user.ringcentral_extension_ids) ? user.ringcentral_extension_ids : []);
      return;
    }
    let cancelled = false;
    usersService.get(user.id).then((data) => {
      if (!cancelled && data?.ringcentral_extension_ids != null) {
        setSidebarExtensionIds(Array.isArray(data.ringcentral_extension_ids) ? data.ringcentral_extension_ids : []);
      } else if (!cancelled) {
        setSidebarExtensionIds([]);
      }
    }).catch(() => {
      if (!cancelled) setSidebarExtensionIds([]);
    });
    return () => { cancelled = true; };
  }, [user?.id, user?.ringcentral_extension_ids]);

  const extensionIds = sidebarExtensionIds !== null
    ? sidebarExtensionIds
    : (Array.isArray(user?.ringcentral_extension_ids) ? user.ringcentral_extension_ids : (storedUser?.ringcentral_extension_ids && Array.isArray(storedUser.ringcentral_extension_ids) ? storedUser.ringcentral_extension_ids : []));
  const hasExtension = extensionIds.length > 0;

  // Lista de extensiones RingCentral para mostrar número (105, etc.) junto al id
  const [extensionsList, setExtensionsList] = useState([]);
  useEffect(() => {
    if (!hasExtension) {
      setExtensionsList([]);
      return;
    }
    let cancelled = false;
    getExtensions({ type: "User", per_page: 250 })
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res) ? res : res?.data ?? res?.extensions ?? [];
        setExtensionsList(Array.isArray(list) ? list : []);
      })
      .catch(() => { if (!cancelled) setExtensionsList([]); });
    return () => { cancelled = true; };
  }, [hasExtension, extensionIds.join(",")]);

  const formatExtensionDisplay = (extId) => {
    const ext = extensionsList.find(
      (e) => String(e.id ?? e.extensionId ?? e.extension_id ?? "") === String(extId)
    );
    const number = ext?.extensionNumber ?? ext?.extension_number ?? ext?.number;
    if (number != null && number !== "") {
      return `Ext. ${number} (${extId})`;
    }
    return `Ext. ${extId}`;
  };
  const extensionLabel = hasExtension
    ? (extensionIds.length === 1
        ? formatExtensionDisplay(extensionIds[0])
        : extensionIds.map((id) => formatExtensionDisplay(id)).join(", "))
    : "Usuario sin extensión en RingCentral";

  const location = useLocation();

  // Estado para controlar qué submenús están expandidos
  const [expandedMenu, setExpandedMenu] = useState(null);

  const navigate = useNavigate();

  // Verificar permisos de administración usando el sistema de permisos
  const canViewUsers = useHasPermission("users.view");
  const canViewRoles = useHasPermission("roles.view");
  const canViewPermissions = useHasPermission("permissions.view");
  
  // Mostrar menú de administración si tiene al menos uno de los permisos
  const hasAdminAccess = canViewUsers || canViewRoles || canViewPermissions;

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
    if (location.pathname.toLowerCase().includes('/clientes')) {
      setExpandedMenu('clientes');
    } else if (location.pathname.includes('/Grupofamiliar')) {
      setExpandedMenu('grupos');
    } else if (location.pathname.toLowerCase().includes('/informes') || location.pathname.toLowerCase().includes('/auditorias')) {
      setExpandedMenu('informes');
    } else if (location.pathname.includes('/Herramientas')) {
      setExpandedMenu('herramientas');
    } else if (location.pathname.includes('/admin')) {
      setExpandedMenu('administracion');
    } else if (location.pathname.toLowerCase().includes('/recursos')) {
      setExpandedMenu('recursos');
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
          <span className="welcome-user-name">{userName}</span>
          <p className="welcome-extension">
            <FaPhone className="welcome-extension-icon" />
            {extensionLabel}
          </p>
        </div>
      )}

      {/* Fecha y Hora */}
      {isOpen && (
        <div className="sidebar-datetime-container">
          <DateTimeDisplay />
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
              <Link to="/clientes/contacto" className={`submenu-link ${isActive('/clientes/contacto') ? 'active' : ''}`}>                <FaUserPlus /> Contactos
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
              <Link to="/Grupofamiliar/lista-etiquetas" className={`submenu-link ${isActive('/Grupofamiliar/lista-etiquetas') ? 'active' : ''}`}>
                <FaTags /> Listado de Grupos y Etiquetas
              </Link>
              <Link to="/Grupofamiliar/reporte-clasificado" className={`submenu-link ${isActive('/Grupofamiliar/reporte-clasificado') ? 'active' : ''}`}>
                <FaChartBar /> Reporte Clasificado
              </Link>
              <Link to="/Grupofamiliar/prospecto" className={`submenu-link ${isActive('/Grupofamiliar/prospecto') ? 'active' : ''}`}>
                <FaUserFriends /> Cotizaciones
              </Link>
              {/* <Link to="/Grupofamiliar/crear" className={`submenu-link ${isActive('/Grupofamiliar/crear') ? 'active' : ''}`}>
                <FaPlus /> Crear Grupo
              </Link> */}
              <Link to="/Grupofamiliar/RequerimientosAdmin" className={`submenu-link ${isActive('/Grupofamiliar/proximos-vencimientos') ? 'active' : ''}`}>
                <FaFile /> Documentos Solicitados
              </Link>
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



        {/* Recursos - Actas y tablero personal */}
        <div className="nav-item">
          <div
            className={`nav-link ${location.pathname.toLowerCase().includes('/recursos') ? 'active' : ''}`}
            onClick={(e) => isOpen && toggleSubmenu('recursos', e)}
          >
            <FaBook />
            {isOpen && (
              <>
                <span>Recursos</span>
                {expandedMenu === 'recursos' ?
                  <FaChevronDown className="submenu-icon" /> :
                  <FaChevronRight className="submenu-icon" />
                }
              </>
            )}
          </div>

          {isOpen && expandedMenu === 'recursos' && (
            <div className="submenu">
              <Link to="/recursos/actas" className={`submenu-link ${location.pathname.startsWith('/recursos/actas') ? 'active' : ''}`}>
                <FaFileAlt /> Actas de reunión
              </Link>
              <Link to="/recursos/mi-tablero" className={`submenu-link ${isActive('/recursos/mi-tablero') ? 'active' : ''}`}>
                <FaColumns /> Tablero de seguimiento
              </Link>
            </div>
          )}
        </div>

        {/* Informes - Con submenú */}
        <div className="nav-item">
          <div
            className={`nav-link ${location.pathname.toLowerCase().includes('/informes') || location.pathname.toLowerCase().includes('/auditorias') ? 'active' : ''}`}
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
              <Link to="/informes/historialCliente" className={`submenu-link ${isActive('/informes/historialCliente') ? 'active' : ''}`}>
                <FaChartBar /> Informes de Clientes
              </Link>
              <Link to="/informes/tareas-usuario" className={`submenu-link ${isActive('/informes/tareas-usuario') ? 'active' : ''}`}>
                <FaTasks /> Tareas por Usuario
              </Link>
              <Link to="/informes/tiempo-por-concepto" className={`submenu-link ${isActive('/informes/tiempo-por-concepto') ? 'active' : ''}`}>
                <FaClock /> Tiempo por concepto
              </Link>
              <Link to="/informes/coberturas" className={`submenu-link ${isActive('/informes/coberturas') ? 'active' : ''}`}>
                <FaFileAlt /> Reporte de Coberturas
              </Link>
              <Link to="/informes/cumpleanos" className={`submenu-link ${isActive('/informes/cumpleanos') ? 'active' : ''}`}>
                <FaBirthdayCake /> Cumpleaños de Clientes
              </Link>
              <Link to="/informes/medios-pago" className={`submenu-link ${isActive('/informes/medios-pago') ? 'active' : ''}`}>
                <FaCreditCard /> Clientes y medios de pago
              </Link>
              <Link to="/informes/documentos" className={`submenu-link ${isActive('/informes/documentos') ? 'active' : ''}`}>
                <FaFileAlt /> Documentos Enviados
              </Link>
              <Link to="/auditorias" className={`submenu-link ${location.pathname.toLowerCase().includes('/auditorias') ? 'active' : ''}`}>
                <FaClipboardCheck /> Auditorías Mensuales
              </Link>
              {/* <Link to="/informes/polizas" className={`submenu-link ${isActive('/informes/polizas') ? 'active' : ''}`}>
                <FaChartBar /> Informes de Pólizas
              </Link> */}
            </div>
          )}
        </div>


        {/* Administración - Con submenú (solo si tiene permisos) */}
        {hasAdminAccess && (
          <div className="nav-item">
            <div
              className={`nav-link ${location.pathname.includes('/admin') ? 'active' : ''}`}
              onClick={(e) => isOpen && toggleSubmenu('administracion', e)}
            >
              <FaUserShield />
              {isOpen && (
                <>
                  <span>Administración</span>
                  {expandedMenu === 'administracion' ?
                    <FaChevronDown className="submenu-icon" /> :
                    <FaChevronRight className="submenu-icon" />
                  }
                </>
              )}
            </div>

            {/* Submenú de Administración */}
            {isOpen && expandedMenu === 'administracion' && (
              <div className="submenu">
                <Link to="/admin/users" className={`submenu-link ${isActive('/admin/users') ? 'active' : ''}`}>
                  <FaUsers /> Usuarios
                </Link>
                <Link to="/admin/roles" className={`submenu-link ${isActive('/admin/roles') ? 'active' : ''}`}>
                  <FaShieldAlt /> Roles
                </Link>
                <Link to="/admin/permissions" className={`submenu-link ${isActive('/admin/permissions') ? 'active' : ''}`}>
                  <FaKey /> Permisos
                </Link>
                <Link to="/admin/audit-logs" className={`submenu-link ${isActive('/admin/audit-logs') ? 'active' : ''}`}>
                  <FaHistory /> Auditoría
                </Link>
                <Link to="/admin/configurador" className={`submenu-link ${isActive('/admin/configurador') ? 'active' : ''}`}>
                  <FaCogs /> Configurador
                </Link>
              </div>
            )}
          </div>
        )}

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
              <Link to="/Herramientas/operaciones" className={`submenu-link ${isActive('/Herramientas/operaciones') ? 'active' : ''}`}>
                <FaCogs /> Centro de Operaciones
              </Link>
              <Link to="/Herramientas/conciliacion-comisiones" className={`submenu-link ${isActive('/Herramientas/conciliacion-comisiones') ? 'active' : ''}`}>
                <FaFileInvoiceDollar /> Conciliación de comisiones
              </Link>
              <Link to="/admin/operational-concepts" className={`submenu-link ${isActive('/admin/operational-concepts') ? 'active' : ''}`}>
                <FaFolder /> Conceptos Operativos
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