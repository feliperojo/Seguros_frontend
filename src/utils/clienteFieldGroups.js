export const CLIENTE_FIELDS_PRINCIPALES = [
  ["nombre_completo", "Nombre completo", "text"],
  ["primer_nombre", "Primer nombre", "text"],
  ["segundo_nombre", "Segundo nombre", "text"],
  ["apellidos", "Apellidos", "text"],
  ["fecha_nacimiento", "Fecha de nacimiento", "date"],
  ["genero", "Género", "text"],
  ["pais_origen", "País de origen", "text"],
  ["peso", "Peso", "number"],
  ["altura", "Altura", "number"],
  ["pulgadas", "Pulgadas", "number"],
  ["nota", "Nota", "text"],
];

export const CLIENTE_FIELDS_MIGRATORIO = [
  ["social", "Social / SSN", "text"],
  ["status", "Status", "text"],
  ["auscis", "USCIS", "text"],
  ["tarjeta_numero", "Número de tarjeta", "text"],
  ["categoria", "Categoría", "text"],
  ["fecha_emision", "Fecha de emisión", "date"],
  ["fecha_expiracion", "Fecha de expiración", "date"],
];

export const CLIENTE_FIELDS_DIRECCION = [
  ["direccion", "Dirección", "text"],
  ["dir_correspondencia", "Dirección de correspondencia", "text"],
  ["calle", "Calle", "text"],
  ["apto", "Apto", "text"],
  ["ciudad", "Ciudad", "text"],
  ["condado", "Condado", "text"],
  ["estado", "Estado", "text"],
  ["codigo_postal", "Código postal", "text"],
];

export const CLIENTE_FIELDS_CONTACTO = [
  ["telefono", "Teléfono", "text"],
  ["email", "Email", "email"],
  ["whatsapp", "Acepta WhatsApp", "checkbox"],
  ["whatsapp_num", "Número de WhatsApp", "text"],
  ["telegram", "Acepta Telegram", "checkbox"],
  ["texto_sms", "Acepta SMS", "checkbox"],
  ["secundario", "Teléfono secundario", "text"],
  ["idioma", "Idioma", "text"],
  ["primer_contacto_info", "Primer contacto / info", "text"],
];

export const CLIENTE_FIELDS_EMPLEO = [
  ["tipo_ingreso", "Tipo de ingreso", "text"],
  ["actividad_economica", "Actividad económica", "text"],
  ["empleador", "Empleador", "text"],
  ["telefono_empleador", "Teléfono del empleador", "text"],
  ["periodo_ingreso", "Periodo de ingreso", "text"],
  ["ingreso_por_periodo", "Ingreso por periodo", "number"],
  ["ingreso_anual", "Ingreso anual", "number"],
  ["empresa", "Empresa", "text"],
  ["ingreso_ocasional_anual", "Ingreso ocasional anual", "number"],
  ["periodo_ingreso_ocasional", "Periodo de ingreso ocasional", "text"],
  ["ingreso_por_periodo_ocasional", "Ingreso por periodo ocasional", "number"],
  ["nota_ingreso_ocasional", "Nota de ingreso ocasional", "text"],
];
