const STORAGE_KEY = "vantun.directorio-grupos.columnas";

export const GRUPOS_COLUMNAS = [
  {
    id: "actual",
    titulo: "Vista actual",
    descripcion: "Las columnas que el directorio muestra hoy.",
  },
  {
    id: "cobertura",
    titulo: "Cobertura",
    descripcion: "Plan, precio, fechas y motivos de la póliza.",
  },
  {
    id: "datos_principales",
    titulo: "Datos principales",
    descripcion: "Nombre, nacimiento, género e idioma del cliente.",
  },
  {
    id: "estatus_migratorio",
    titulo: "Estatus migratorio",
    descripcion: "Status, documento y categoría.",
  },
  {
    id: "datos_contacto",
    titulo: "Datos de contacto",
    descripcion: "Teléfonos, correo y medios de comunicación.",
  },
  {
    id: "direccion",
    titulo: "Dirección",
    descripcion: "Domicilio del cliente.",
  },
  {
    id: "empleo_ingreso",
    titulo: "Datos de empleo e ingreso",
    descripcion: "Trabajo e ingresos del cliente.",
  },
  {
    id: "medios_pago",
    titulo: "Medios de pago",
    descripcion: "Forma de pago registrada, sin números de tarjeta.",
  },
  {
    id: "grupo",
    titulo: "Grupo familiar",
    descripcion: "Contacto y tamaño del grupo.",
  },
];

export const COLUMNAS_DIRECTORIO = [
  { key: "grupo_familiar_id", label: "ID GF", grupo: "actual", hint: "Identificador del grupo" },
  { key: "nombre", label: "Nombre", grupo: "actual", hint: "Nombre del cliente" },
  { key: "parentesco", label: "Parentesco", grupo: "actual", hint: "Relación dentro del grupo" },
  { key: "compania", label: "Compañía", grupo: "actual", hint: "Aseguradora" },
  { key: "producto", label: "Producto", grupo: "actual", hint: "Tipo de producto" },
  { key: "fecha_activacion", label: "Fecha de activación", grupo: "actual", hint: "Inicio de la cobertura" },
  { key: "responsable", label: "Responsable", grupo: "actual", hint: "Responsable del grupo" },
  { key: "precio", label: "Precio", grupo: "actual", hint: "Prima de la cobertura" },
  { key: "codigo_poliza", label: "Número ID", grupo: "cobertura", hint: "Código de la póliza" },

  { key: "estado_cobertura", label: "Cobertura", grupo: "cobertura", hint: "Sí, No, Medicare o Medicaid" },
  { key: "estado", label: "Estado", grupo: "cobertura", hint: "Vigente, cancelada, retirada o anulada" },
  { key: "plan", label: "Plan", grupo: "cobertura", hint: "Nombre del plan" },
  { key: "metal", label: "Metal", grupo: "cobertura", hint: "Nivel del plan" },
  { key: "red", label: "Red", grupo: "cobertura", hint: "Red de la póliza" },
  { key: "agente", label: "Agente", grupo: "cobertura", hint: "Agente asignado" },
  { key: "ano_cobertura", label: "Año", grupo: "cobertura", hint: "Año de la cobertura" },
  { key: "elegibilidad", label: "Elegibilidad", grupo: "cobertura", hint: "Elegibilidad registrada" },
  { key: "pagador", label: "Pagador", grupo: "cobertura", hint: "Cliente que paga la póliza" },
  { key: "dia_pago", label: "Día de pago", grupo: "cobertura", hint: "Día del mes" },
  { key: "tipo_pago", label: "Tipo de pago", grupo: "cobertura", hint: "Forma de pago" },
  { key: "fecha_cancelacion", label: "Fecha cancelación", grupo: "cobertura", hint: "Cuándo se canceló" },
  { key: "motivo_cancelacion", label: "Motivo cancelación", grupo: "cobertura", hint: "Por qué se canceló" },
  { key: "fecha_retiro", label: "Fecha retiro", grupo: "cobertura", hint: "Cuándo se retiró" },
  { key: "motivo_retiro", label: "Motivo retiro", grupo: "cobertura", hint: "Por qué se retiró" },
  { key: "fecha_anulacion", label: "Fecha anulación", grupo: "cobertura", hint: "Cuándo se anuló" },
  { key: "motivo_anulacion", label: "Motivo anulación", grupo: "cobertura", hint: "Por qué se anuló" },

  { key: "primer_nombre", label: "Primer nombre", grupo: "datos_principales", hint: "Primer nombre del cliente" },
  { key: "segundo_nombre", label: "Segundo nombre", grupo: "datos_principales", hint: "Segundo nombre del cliente" },
  { key: "apellidos", label: "Apellidos", grupo: "datos_principales", hint: "Apellidos del cliente" },
  { key: "fecha_nacimiento", label: "Fecha de nacimiento", grupo: "datos_principales", hint: "Nacimiento del cliente" },
  { key: "edad", label: "Edad", grupo: "datos_principales", hint: "Edad registrada" },
  { key: "genero", label: "Género", grupo: "datos_principales", hint: "Género del cliente" },
  { key: "idioma", label: "Idioma", grupo: "datos_principales", hint: "Idioma del cliente" },
  { key: "pais_origen", label: "País de origen", grupo: "datos_principales", hint: "País de origen" },
  { key: "peso", label: "Peso", grupo: "datos_principales", hint: "Peso en libras" },
  { key: "altura", label: "Altura", grupo: "datos_principales", hint: "Altura en pies" },
  { key: "pulgadas", label: "Pulgadas", grupo: "datos_principales", hint: "Pulgadas de la altura" },

  { key: "status_migratorio", label: "Status", grupo: "estatus_migratorio", hint: "Estatus migratorio" },
  { key: "social", label: "Social", grupo: "estatus_migratorio", hint: "Número social" },
  { key: "auscis", label: "A/USCIS", grupo: "estatus_migratorio", hint: "Número A o USCIS" },
  { key: "tarjeta_numero", label: "Tarjeta", grupo: "estatus_migratorio", hint: "Número de tarjeta" },
  { key: "fecha_emision", label: "Fecha emisión", grupo: "estatus_migratorio", hint: "Emisión del documento" },
  { key: "fecha_expiracion", label: "Fecha expiración", grupo: "estatus_migratorio", hint: "Expiración del documento" },
  { key: "categoria", label: "Categoría", grupo: "estatus_migratorio", hint: "Categoría migratoria" },

  { key: "telefono", label: "Teléfonos", grupo: "datos_contacto", hint: "Teléfonos del cliente" },
  { key: "email", label: "Correo", grupo: "datos_contacto", hint: "Correo del cliente" },
  { key: "whatsapp", label: "WhatsApp", grupo: "datos_contacto", hint: "Usa WhatsApp" },
  { key: "telegram", label: "Telegram", grupo: "datos_contacto", hint: "Usa Telegram" },
  { key: "texto_sms", label: "SMS", grupo: "datos_contacto", hint: "Usa mensajes de texto" },
  { key: "nota_cliente", label: "Nota", grupo: "datos_contacto", hint: "Nota de contacto" },

  { key: "direccion", label: "Dirección", grupo: "direccion", hint: "Dirección del cliente" },
  { key: "calle", label: "Calle", grupo: "direccion", hint: "Calle" },
  { key: "apto", label: "Apto", grupo: "direccion", hint: "Apartamento" },
  { key: "ciudad", label: "Ciudad", grupo: "direccion", hint: "Ciudad del cliente" },
  { key: "condado", label: "Condado", grupo: "direccion", hint: "Condado del cliente" },
  { key: "codigo_postal", label: "Código postal", grupo: "direccion", hint: "ZIP del cliente" },
  { key: "dir_correspondencia", label: "Dir. correspondencia", grupo: "direccion", hint: "Dirección de correspondencia" },

  { key: "tipo_ingreso", label: "Tipo de ingreso", grupo: "empleo_ingreso", hint: "W2, 1099 u otro" },
  { key: "actividad_economica", label: "Actividad económica", grupo: "empleo_ingreso", hint: "Actividad del cliente" },
  { key: "empleador", label: "Empleador", grupo: "empleo_ingreso", hint: "Nombre del empleador" },
  { key: "telefono_empleador", label: "Teléfono empleador", grupo: "empleo_ingreso", hint: "Teléfono del empleador" },
  { key: "periodo_ingreso", label: "Período de ingreso", grupo: "empleo_ingreso", hint: "Cada cuánto ingresa" },
  { key: "ingreso_por_periodo", label: "Ingreso por período", grupo: "empleo_ingreso", hint: "Monto del período" },
  { key: "ingreso_anual", label: "Ingreso anual", grupo: "empleo_ingreso", hint: "Ingreso al año" },
  { key: "periodo_ingreso_ocasional", label: "Período ocasional", grupo: "empleo_ingreso", hint: "Período del otro ingreso" },
  { key: "ingreso_por_periodo_ocasional", label: "Ingreso ocasional", grupo: "empleo_ingreso", hint: "Monto del otro ingreso" },
  { key: "ingreso_ocasional_anual", label: "Ingreso ocasional anual", grupo: "empleo_ingreso", hint: "Otro ingreso al año" },
  { key: "nota_ingreso", label: "Nota de ingreso", grupo: "empleo_ingreso", hint: "Nota del ingreso" },

  { key: "medios_pago", label: "Medios de pago", grupo: "medios_pago", hint: "Forma, tipo y banco, sin el número" },

  { key: "persona_contacto", label: "Persona de contacto", grupo: "grupo", hint: "Contacto del grupo" },
  { key: "telefono_grupo", label: "Teléfono del grupo", grupo: "grupo", hint: "Teléfono principal del grupo" },
  { key: "zip_grupo", label: "ZIP del grupo", grupo: "grupo", hint: "Código postal del grupo" },
  { key: "personas_cobertura", label: "Personas en cobertura", grupo: "grupo", hint: "Cuántas personas cubre el grupo" },
  { key: "personas_taxes", label: "Personas en taxes", grupo: "grupo", hint: "Cuántas personas declara el grupo" },
];

export const COLUMNAS_PREDETERMINADAS = COLUMNAS_DIRECTORIO.filter(
  (columna) => columna.grupo === "actual"
).map((columna) => columna.key);

const clavesValidas = (claves) => {
  if (!Array.isArray(claves)) return [];
  const conocidas = new Set(COLUMNAS_DIRECTORIO.map((columna) => columna.key));
  return claves.filter((clave) => conocidas.has(clave));
};

export const leerColumnasGuardadas = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...COLUMNAS_PREDETERMINADAS];
    const validas = clavesValidas(JSON.parse(raw));
    if (!validas.length) return [...COLUMNAS_PREDETERMINADAS];
    const vistasAnteriores = [
      ["grupo_familiar_id", "nombre", "parentesco", "producto", "compania", "codigo_poliza", "fecha_activacion"],
      ["grupo_familiar_id", "nombre", "parentesco", "producto", "compania", "codigo_poliza", "fecha_activacion", "estado_cobertura", "estado"],
    ];
    const eraLaVistaAnterior = vistasAnteriores.some(
      (vista) => vista.length === validas.length && vista.every((clave) => validas.includes(clave))
    );
    if (eraLaVistaAnterior) {
      guardarColumnas(COLUMNAS_PREDETERMINADAS);
      return [...COLUMNAS_PREDETERMINADAS];
    }
    return validas;
  } catch {
    return [...COLUMNAS_PREDETERMINADAS];
  }
};

export const guardarColumnas = (claves) => {
  const validas = clavesValidas(claves);
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(validas.length ? validas : COLUMNAS_PREDETERMINADAS)
  );
};

export const esVistaInicial = (claves) => {
  if (!Array.isArray(claves) || claves.length !== COLUMNAS_PREDETERMINADAS.length) return false;
  return COLUMNAS_PREDETERMINADAS.every((clave) => claves.includes(clave));
};

const FILTRO_LISTA = new Set([
  "estado_cobertura",
  "estado",
  "metal",
  "red",
  "tipo_pago",
  "pagador",
  "genero",
  "idioma",
  "pais_origen",
  "status_migratorio",
  "tipo_ingreso",
  "periodo_ingreso",
  "periodo_ingreso_ocasional",
]);

export const tipoFiltroColumna = (clave) => (FILTRO_LISTA.has(clave) ? "lista" : null);
