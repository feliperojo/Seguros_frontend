/**
 * Catálogo de ítems del menú lateral.
 * Una clave ausente o en true sigue visible. false la oculta sin borrar la pantalla.
 */

export const MENU_SECTIONS = [
  {
    id: "panel",
    title: "Panel principal",
    items: [
      {
        key: "panel.principal",
        label: "Panel principal",
        path: "/",
        locked: true,
        lockedReason:
          "Es la pantalla de inicio. Tiene que seguir visible para que el ingreso al sistema tenga destino.",
      },
    ],
  },
  {
    id: "clientes",
    title: "Clientes",
    items: [
      { key: "clientes.lista", label: "Listado general", path: "/Clientes/lista" },
      { key: "clientes.crear", label: "Crear Cliente", path: "/Clientes/crear" },
      { key: "clientes.contactos", label: "Contactos", path: "/clientes/contacto" },
      {
        key: "clientes.clasificar",
        label: "Clasificar estado",
        path: "/clientes/clasificar-estado",
      },
    ],
  },
  {
    id: "grupos",
    title: "Grupo Familiar",
    items: [
      { key: "grupos.lista", label: "Lista de Grupos", path: "/Grupofamiliar/lista" },
      {
        key: "grupos.etiquetas",
        label: "Listado de Grupos y Etiquetas",
        path: "/Grupofamiliar/lista-etiquetas",
      },
      {
        key: "grupos.clasificado",
        label: "Reporte Clasificado",
        path: "/Grupofamiliar/reporte-clasificado",
      },
      {
        key: "grupos.descartados",
        label: "Grupos descartados",
        path: "/grupofamiliar/reporte-descartados",
      },
      {
        key: "grupos.inactivos",
        label: "Grupos inactivos",
        path: "/grupofamiliar/reporte-inactivos",
      },
      { key: "grupos.cotizaciones", label: "Cotizaciones", path: "/Grupofamiliar/prospecto" },
      {
        key: "grupos.documentos",
        label: "Documentos Solicitados",
        path: "/Grupofamiliar/RequerimientosAdmin",
      },
      { key: "grupos.renovaciones", label: "Renovaciones", path: "/admin/renovaciones" },
    ],
  },
  {
    id: "pagos",
    title: "Pagos",
    items: [
      { key: "pagos.generar", label: "Generacion de Pagos", path: "/Pagos/Generarpagos" },
      { key: "pagos.actualizar", label: "Actualizacion de Pagos", path: "/Pagos/pagos" },
      { key: "pagos.informe", label: "Informe de Pagos", path: "/Pagos/cartera" },
    ],
  },
  {
    id: "recursos",
    title: "Recursos",
    items: [
      {
        key: "recursos.actas",
        label: "Actas de reunión",
        path: "/recursos/actas",
        matchPrefix: true,
      },
      { key: "recursos.tablero", label: "Tablero de seguimiento", path: "/recursos/mi-tablero" },
    ],
  },
  {
    id: "informes",
    title: "Informes",
    items: [
      {
        key: "informes.clientes",
        label: "Informes de Clientes",
        path: "/informes/historialCliente",
      },
      {
        key: "informes.tareas",
        label: "Tareas por Usuario",
        path: "/informes/tareas-usuario",
      },
      {
        key: "informes.tiempo",
        label: "Tiempo por concepto",
        path: "/informes/tiempo-por-concepto",
      },
      { key: "informes.coberturas", label: "Reporte de Coberturas", path: "/informes/coberturas" },
      {
        key: "informes.cumpleanos",
        label: "Cumpleaños de Clientes",
        path: "/informes/cumpleanos",
      },
      {
        key: "informes.medios_pago",
        label: "Clientes y medios de pago",
        path: "/informes/medios-pago",
      },
      {
        key: "informes.canceladas",
        label: "Canceladas y retiradas",
        path: "/informes/coberturas-canceladas-retiradas",
      },
      {
        key: "informes.directorio",
        label: "Directorio de grupos",
        path: "/informes/directorio-de-grupos",
        aliases: ["/informes/coberturas-por-parentesco"],
      },
      {
        key: "informes.documentos",
        label: "Documentos Enviados",
        path: "/informes/documentos",
      },
      {
        key: "informes.auditorias",
        label: "Auditorías Mensuales",
        path: "/auditorias",
        matchPrefix: true,
      },
    ],
  },
  {
    id: "administracion",
    title: "Administración",
    items: [
      { key: "admin.usuarios", label: "Usuarios", path: "/admin/users" },
      { key: "admin.roles", label: "Roles", path: "/admin/roles", matchPrefix: true },
      { key: "admin.permisos", label: "Permisos", path: "/admin/permissions" },
      { key: "admin.auditoria", label: "Auditoría", path: "/admin/audit-logs" },
      { key: "admin.horas", label: "Horas Conectadas", path: "/admin/horas-conectadas" },
      { key: "admin.configurador", label: "Configurador", path: "/admin/configurador" },
      { key: "admin.companias", label: "Compañías", path: "/admin/companias" },
    ],
  },
  {
    id: "herramientas",
    title: "Herramientas",
    items: [
      { key: "herramientas.importar", label: "Importar Clientes", path: "/Herramientas" },
      { key: "herramientas.exportar", label: "Exportar Datos", path: "/Herramientas/exportar" },
      { key: "herramientas.auditoria", label: "Auditoria", path: "/Herramientas/auditoria" },
      {
        key: "herramientas.operaciones",
        label: "Centro de Operaciones",
        path: "/Herramientas/operaciones",
      },
      {
        key: "herramientas.conciliacion",
        label: "Conciliación de comisiones",
        path: "/Herramientas/conciliacion-comisiones",
      },
      {
        key: "herramientas.conceptos",
        label: "Conceptos Operativos",
        path: "/admin/operational-concepts",
      },
    ],
  },
];

export function normalizeMenuPath(value) {
  const raw = String(value || "").split("?")[0];
  if (raw === "" || raw === "/") return "/";
  return raw.replace(/\/+$/, "").toLowerCase();
}

export function isMenuItemEnabled(map, key) {
  if (!map || typeof map !== "object") return true;
  return map[key] !== false;
}

export function findMenuItemByPath(pathname) {
  const normalized = normalizeMenuPath(pathname);
  const items = MENU_SECTIONS.flatMap((section) => section.items);

  const exact = items.find((item) => {
    const candidates = [item.path, ...(item.aliases || [])];
    return candidates.some((candidate) => normalizeMenuPath(candidate) === normalized);
  });
  if (exact) return exact;

  const prefixed = items
    .filter((item) => item.matchPrefix && item.path && item.path !== "/")
    .sort((a, b) => String(b.path).length - String(a.path).length);

  return (
    prefixed.find((item) => {
      const base = normalizeMenuPath(item.path);
      return normalized === base || normalized.startsWith(`${base}/`);
    }) || null
  );
}

export function toggleableItems(section) {
  return section.items.filter((item) => !item.locked);
}
