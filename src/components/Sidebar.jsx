import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  FaHome, FaUsers, FaProjectDiagram, FaFolder, FaSignOutAlt, FaChevronLeft, FaUserFriends,
  FaTools, FaChevronDown, FaChevronRight, FaUserPlus, FaList, FaFile, FaTags,
  FaCalendarAlt, FaChartBar, FaPlus, FaFileImport, FaFileExport, FaCogs, FaChartLine, FaMoneyCheckAlt, FaSyncAlt, FaFileInvoiceDollar,
  FaUserShield, FaShieldAlt, FaKey, FaHistory, FaFileAlt, FaClipboardCheck, FaBirthdayCake, FaTasks, FaPhone, FaClock,
  FaBook, FaColumns, FaCreditCard, FaExchangeAlt, FaBan, FaUserSlash, FaBuilding,
  FaAddressBook, FaEye
} from "react-icons/fa";
import "../styles/Sidebar.css";
import logo from "../assets/tampa.jpg";
import SincronizarContactos from "../components/SincronizarContactos";
import { useAuth } from "../context/AuthContext";
import { useHasAnyPermission, useHasPermission, useHasRole } from "../hooks/useHasPermission";
import { MENU_SECTIONS } from "../constants/menuVisibility";
import useMenuVisibility from "../hooks/useMenuVisibility";
import DateTimeDisplay from "./DateTimeDisplay";
import NotificationsDropdown from "./Tareas/NotificationsDropdown";
import { usersService } from "../services/adminApi";
import { getExtensions } from "../services/ringCentralIntegrationApi";


const Sidebar = ({ isOpen, toggleSidebar, notificationsProps = null }) => {
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
  const { isVisible } = useMenuVisibility();
  const isAdmin = useHasRole("admin");
  const canViewMenuSettings = useHasAnyPermission([
    "settings.view",
    "settings.read",
    "settings.edit",
    "settings.update",
  ]);
  const canOpenMenuVisibility = hasAdminAccess || isAdmin || canViewMenuSettings;

  const showItem = (key) => isVisible(key);
  const showSection = (sectionId) => {
    const section = MENU_SECTIONS.find((entry) => entry.id === sectionId);
    if (!section) return true;
    return section.items.some((item) => item.locked || isVisible(item.key));
  };

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
    } else if (
      location.pathname.toLowerCase().includes('/grupofamiliar') ||
      location.pathname.startsWith('/admin/renovaciones')
    ) {
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
    return location.pathname.toLowerCase() === String(path).toLowerCase();
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

      {/* Fecha / hora + notificaciones */}
      <div
        className={`sidebar-notifications ${isOpen ? "" : "sidebar-notifications--collapsed"}`}
      >
        {isOpen && (
          <div className="sidebar-datetime-container">
            <DateTimeDisplay />
          </div>
        )}
        {notificationsProps && (
          <div className="sidebar-notifications__bell">
            <NotificationsDropdown
              currentUser={notificationsProps.currentUser}
              pendientes={notificationsProps.pendientes}
              loadingTask={notificationsProps.loadingTask}
              onNotificationClick={notificationsProps.onNotificationClick}
              onNotificationsChange={notificationsProps.onNotificationsChange}
              menuPlacement="sidebar"
            />
          </div>
        )}
      </div>

      {/* Navegación */}
      <nav>
        {/* Dashboard - Sin submenú. Siempre visible: es el inicio de sesión. */}
        <Link to="/" className={`nav-link ${isActive('/') ? 'active' : ''}`}>
          <FaHome /> {isOpen && "Panel principal"}
        </Link>

        {/* Clientes - Con submenú */}
        {showSection("clientes") && (
        <div className="nav-item">
          <div
            className={`nav-link ${location.pathname.toLowerCase().includes('/clientes') ? 'active' : ''}`}
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
              {showItem("clientes.lista") && (
              <Link to="/Clientes/lista" className={`submenu-link ${isActive('/Clientes/lista') ? 'active' : ''}`}>
                <FaList /> Listado general
              </Link>
              )}
              {showItem("clientes.crear") && (
              <Link to="/Clientes/crear" className={`submenu-link ${isActive('/Clientes/crear') ? 'active' : ''}`}>
                <FaUserPlus /> Crear Cliente
              </Link>
              )}
              {showItem("clientes.contactos") && (
              <Link to="/clientes/contacto" className={`submenu-link ${isActive('/clientes/contacto') ? 'active' : ''}`}>
                <FaAddressBook /> Contactos
              </Link>
              )}
              {showItem("clientes.clasificar") && (
              <Link to="/clientes/clasificar-estado" className={`submenu-link ${isActive('/clientes/clasificar-estado') ? 'active' : ''}`}>
                <FaExchangeAlt /> Clasificar estado
              </Link>
              )}
            </div>
          )}
        </div>
        )}

        {/* Grupo Familiar - Con submenú */}
        {showSection("grupos") && (
        <div className="nav-item">
          <div
            className={`nav-link ${location.pathname.toLowerCase().includes('/grupofamiliar') || location.pathname.startsWith('/admin/renovaciones') ? 'active' : ''}`}
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
              {showItem("grupos.lista") && (
              <Link to="/Grupofamiliar/lista" className={`submenu-link ${isActive('/Grupofamiliar/lista') ? 'active' : ''}`}>
                <FaList /> Lista de Grupos
              </Link>
              )}
              {showItem("grupos.etiquetas") && (
              <Link to="/Grupofamiliar/lista-etiquetas" className={`submenu-link ${isActive('/Grupofamiliar/lista-etiquetas') ? 'active' : ''}`}>
                <FaTags /> Listado de Grupos y Etiquetas
              </Link>
              )}
              {showItem("grupos.clasificado") && (
              <Link to="/Grupofamiliar/reporte-clasificado" className={`submenu-link ${isActive('/Grupofamiliar/reporte-clasificado') ? 'active' : ''}`}>
                <FaChartBar /> Reporte Clasificado
              </Link>
              )}
              {showItem("grupos.descartados") && (
              <Link to="/grupofamiliar/reporte-descartados" className={`submenu-link ${isActive('/grupofamiliar/reporte-descartados') ? 'active' : ''}`}>
                <FaBan /> Grupos descartados
              </Link>
              )}
              {showItem("grupos.inactivos") && (
              <Link to="/grupofamiliar/reporte-inactivos" className={`submenu-link ${isActive('/grupofamiliar/reporte-inactivos') ? 'active' : ''}`}>
                <FaUserSlash /> Grupos inactivos
              </Link>
              )}
              {showItem("grupos.cotizaciones") && (
              <Link to="/Grupofamiliar/prospecto" className={`submenu-link ${isActive('/Grupofamiliar/prospecto') ? 'active' : ''}`}>
                <FaUserFriends /> Cotizaciones
              </Link>
              )}
              {/* <Link to="/Grupofamiliar/crear" className={`submenu-link ${isActive('/Grupofamiliar/crear') ? 'active' : ''}`}>
                <FaPlus /> Crear Grupo
              </Link> */}
              {showItem("grupos.documentos") && (
              <Link to="/Grupofamiliar/RequerimientosAdmin" className={`submenu-link ${isActive('/Grupofamiliar/proximos-vencimientos') ? 'active' : ''}`}>
                <FaFile /> Documentos Solicitados
              </Link>
              )}
              {showItem("grupos.renovaciones") && (
              <Link to="/admin/renovaciones" className={`submenu-link ${isActive('/admin/renovaciones') ? 'active' : ''}`}>
                <FaSyncAlt /> Renovaciones
              </Link>
              )}
            </div>
          )}
        </div>
        )}

        {/* PAGOS */}
        {showSection("pagos") && (
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
              {showItem("pagos.generar") && (
              <Link to="/Pagos/Generarpagos" className={`submenu-link ${isActive('/Pagos/Generarpagos') ? 'active' : ''}`}>
                <FaMoneyCheckAlt /> Generacion de Pagos
              </Link>
              )}
              {showItem("pagos.actualizar") && (
              <Link to="/Pagos/pagos" className={`submenu-link ${isActive('/Pagos/pagos') ? 'active' : ''}`}>
                <FaSyncAlt /> Actualizacion de Pagos
              </Link>
              )}
              {showItem("pagos.informe") && (
              <Link to="/Pagos/cartera" className={`submenu-link ${isActive('/Pagos/cartera') ? 'active' : ''}`}>
                <FaFileInvoiceDollar /> Informe de Pagos
              </Link>
              )}
            </div>
          )}
        </div>
        )}

        {/* Recursos - Actas y tablero personal */}
        {showSection("recursos") && (
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
              {showItem("recursos.actas") && (
              <Link to="/recursos/actas" className={`submenu-link ${location.pathname.startsWith('/recursos/actas') ? 'active' : ''}`}>
                <FaFileAlt /> Actas de reunión
              </Link>
              )}
              {showItem("recursos.tablero") && (
              <Link to="/recursos/mi-tablero" className={`submenu-link ${isActive('/recursos/mi-tablero') ? 'active' : ''}`}>
                <FaColumns /> Tablero de seguimiento
              </Link>
              )}
            </div>
          )}
        </div>
        )}

        {/* Informes - Con submenú */}
        {showSection("informes") && (
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
              {showItem("informes.clientes") && (
              <Link to="/informes/historialCliente" className={`submenu-link ${isActive('/informes/historialCliente') ? 'active' : ''}`}>
                <FaChartBar /> Informes de Clientes
              </Link>
              )}
              {showItem("informes.tareas") && (
              <Link to="/informes/tareas-usuario" className={`submenu-link ${isActive('/informes/tareas-usuario') ? 'active' : ''}`}>
                <FaTasks /> Tareas por Usuario
              </Link>
              )}
              {showItem("informes.tiempo") && (
              <Link to="/informes/tiempo-por-concepto" className={`submenu-link ${isActive('/informes/tiempo-por-concepto') ? 'active' : ''}`}>
                <FaClock /> Tiempo por concepto
              </Link>
              )}
              {showItem("informes.coberturas") && (
              <Link to="/informes/coberturas" className={`submenu-link ${isActive('/informes/coberturas') ? 'active' : ''}`}>
                <FaFileAlt /> Reporte de Coberturas
              </Link>
              )}
              {showItem("informes.cumpleanos") && (
              <Link to="/informes/cumpleanos" className={`submenu-link ${isActive('/informes/cumpleanos') ? 'active' : ''}`}>
                <FaBirthdayCake /> Cumpleaños de Clientes
              </Link>
              )}
              {showItem("informes.medios_pago") && (
              <Link to="/informes/medios-pago" className={`submenu-link ${isActive('/informes/medios-pago') ? 'active' : ''}`}>
                <FaCreditCard /> Clientes y medios de pago
              </Link>
              )}
              {showItem("informes.canceladas") && (
              <Link to="/informes/coberturas-canceladas-retiradas" className={`submenu-link ${isActive('/informes/coberturas-canceladas-retiradas') ? 'active' : ''}`}>
                <FaFileInvoiceDollar /> Canceladas y retiradas
              </Link>
              )}
              {showItem("informes.directorio") && (
              <Link to="/informes/directorio-de-grupos" className={`submenu-link ${isActive('/informes/directorio-de-grupos') || isActive('/informes/coberturas-por-parentesco') ? 'active' : ''}`}>
                <FaUserFriends /> Directorio de grupos
              </Link>
              )}
              {showItem("informes.documentos") && (
              <Link to="/informes/documentos" className={`submenu-link ${isActive('/informes/documentos') ? 'active' : ''}`}>
                <FaFileAlt /> Documentos Enviados
              </Link>
              )}
              {showItem("informes.auditorias") && (
              <Link to="/auditorias" className={`submenu-link ${location.pathname.toLowerCase().includes('/auditorias') ? 'active' : ''}`}>
                <FaClipboardCheck /> Auditorías Mensuales
              </Link>
              )}
              {/* <Link to="/informes/polizas" className={`submenu-link ${isActive('/informes/polizas') ? 'active' : ''}`}>
                <FaChartBar /> Informes de Pólizas
              </Link> */}
            </div>
          )}
        </div>
        )}


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
                {showItem("admin.usuarios") && (
                <Link to="/admin/users" className={`submenu-link ${isActive('/admin/users') ? 'active' : ''}`}>
                  <FaUsers /> Usuarios
                </Link>
                )}
                {showItem("admin.roles") && (
                <Link to="/admin/roles" className={`submenu-link ${isActive('/admin/roles') ? 'active' : ''}`}>
                  <FaShieldAlt /> Roles
                </Link>
                )}
                {showItem("admin.permisos") && (
                <Link to="/admin/permissions" className={`submenu-link ${isActive('/admin/permissions') ? 'active' : ''}`}>
                  <FaKey /> Permisos
                </Link>
                )}
                {showItem("admin.auditoria") && (
                <Link to="/admin/audit-logs" className={`submenu-link ${isActive('/admin/audit-logs') ? 'active' : ''}`}>
                  <FaHistory /> Auditoría
                </Link>
                )}
                {showItem("admin.horas") && (
                <Link to="/admin/horas-conectadas" className={`submenu-link ${isActive('/admin/horas-conectadas') ? 'active' : ''}`}>
                  <FaClock /> Horas Conectadas
                </Link>
                )}
                {showItem("admin.configurador") && (
                <Link to="/admin/configurador" className={`submenu-link ${isActive('/admin/configurador') ? 'active' : ''}`}>
                  <FaCogs /> Configurador
                </Link>
                )}
                {showItem("admin.companias") && (
                <Link to="/admin/companias" className={`submenu-link ${isActive('/admin/companias') ? 'active' : ''}`}>
                  <FaBuilding /> Compañías
                </Link>
                )}
                {canOpenMenuVisibility && (
                <Link to="/admin/menu-visibilidad" className={`submenu-link ${isActive('/admin/menu-visibilidad') ? 'active' : ''}`}>
                  <FaEye /> Visibilidad del menú
                </Link>
                )}
              </div>
            )}
          </div>
        )}

        {/* Herramientas - Con submenú */}
        {showSection("herramientas") && (
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
              {showItem("herramientas.importar") && (
              <Link to="/Herramientas" className={`submenu-link ${isActive('/Herramientas') ? 'active' : ''}`}>
                <FaFileImport /> Importar Clientes
              </Link>
              )}
              {showItem("herramientas.exportar") && (
              <Link to="/Herramientas/exportar" className={`submenu-link ${isActive('/Herramientas/exportar') ? 'active' : ''}`}>
                <FaFileExport /> Exportar Datos
              </Link>
              )}
              {showItem("herramientas.auditoria") && (
              <Link to="/Herramientas/auditoria" className={`submenu-link ${isActive('/Herramientas/auditoria') ? 'active' : ''}`}>
                <FaCogs /> Auditoria
              </Link>
              )}
              {showItem("herramientas.operaciones") && (
              <Link to="/Herramientas/operaciones" className={`submenu-link ${isActive('/Herramientas/operaciones') ? 'active' : ''}`}>
                <FaCogs /> Centro de Operaciones
              </Link>
              )}
              {showItem("herramientas.conciliacion") && (
              <Link to="/Herramientas/conciliacion-comisiones" className={`submenu-link ${isActive('/Herramientas/conciliacion-comisiones') ? 'active' : ''}`}>
                <FaFileInvoiceDollar /> Conciliación de comisiones
              </Link>
              )}
              {showItem("herramientas.conceptos") && (
              <Link to="/admin/operational-concepts" className={`submenu-link ${isActive('/admin/operational-concepts') ? 'active' : ''}`}>
                <FaFolder /> Conceptos Operativos
              </Link>
              )}
            </div>
          )}
        </div>
        )}
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