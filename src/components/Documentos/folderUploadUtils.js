const ARCHIVOS_IGNORAR = new Set([".ds_store", "thumbs.db", "desktop.ini"]);

/**
 * Lee todas las entradas de un directorio (API del navegador).
 */
const readAllDirectoryEntries = (reader) =>
  new Promise((resolve, reject) => {
    const entries = [];

    const readBatch = () => {
      reader.readEntries(
        (batch) => {
          if (!batch.length) {
            resolve(entries);
            return;
          }
          entries.push(...batch);
          readBatch();
        },
        reject
      );
    };

    readBatch();
  });

/**
 * Recorre recursivamente una entrada del sistema de archivos (drag & drop de carpetas).
 */
const traverseFileSystemEntry = async (entry, relativePath, files) => {
  if (!entry) return;

  if (entry.isFile) {
    const file = await new Promise((resolve, reject) => entry.file(resolve, reject));
    const fullPath = relativePath ? `${relativePath}${file.name}` : file.name;

    if (!esArchivoIgnorado(fullPath)) {
      Object.defineProperty(file, "webkitRelativePath", {
        value: fullPath,
        writable: false,
        configurable: true,
      });
      files.push(file);
    }
    return;
  }

  if (entry.isDirectory) {
    const dirPath = relativePath ? `${relativePath}${entry.name}/` : `${entry.name}/`;
    const reader = entry.createReader();
    const childEntries = await readAllDirectoryEntries(reader);

    for (const child of childEntries) {
      await traverseFileSystemEntry(child, dirPath, files);
    }
  }
};

/**
 * Determina si un archivo debe omitirse (metadatos del sistema).
 */
export const esArchivoIgnorado = (ruta = "") => {
  const nombre = ruta.split("/").pop()?.toLowerCase() || "";
  return ARCHIVOS_IGNORAR.has(nombre);
};

/**
 * Extrae archivos de un DataTransfer, incluyendo carpetas anidadas.
 */
export const getFilesFromDataTransfer = async (dataTransfer) => {
  if (!dataTransfer) return [];

  const items = dataTransfer.items ? Array.from(dataTransfer.items) : [];
  const entries = items
    .map((item) => (item.kind === "file" ? item.webkitGetAsEntry?.() : null))
    .filter(Boolean);

  if (!entries.length) {
    return Array.from(dataTransfer.files || []);
  }

  const files = [];
  for (const entry of entries) {
    await traverseFileSystemEntry(entry, "", files);
  }

  return files.length ? files : Array.from(dataTransfer.files || []);
};

/**
 * Separa archivos planos de los que pertenecen a una estructura de carpetas.
 */
export const clasificarArchivosSubida = (files) => {
  const lista = Array.from(files || []);
  const conEstructura = [];
  const planos = [];

  for (const file of lista) {
    const ruta = file.webkitRelativePath || "";
    if (ruta.includes("/")) {
      if (!esArchivoIgnorado(ruta)) {
        conEstructura.push(file);
      }
    } else if (!esArchivoIgnorado(file.name)) {
      planos.push(file);
    }
  }

  return { conEstructura, planos };
};

/**
 * Obtiene los segmentos de carpetas de una ruta relativa (sin el nombre del archivo).
 * Incluye la carpeta raíz arrastrada (ej: "imagenes/foto.jpg" → ["imagenes"]).
 */
export const obtenerSegmentosCarpeta = (webkitRelativePath = "") => {
  const partes = webkitRelativePath.split("/").filter(Boolean);
  if (partes.length <= 1) return [];
  partes.pop();
  return partes;
};

/**
 * Lista rutas únicas de subcarpetas ordenadas por profundidad.
 */
export const obtenerRutasCarpetasUnicas = (files) => {
  const rutas = new Set();

  for (const file of files) {
    const segmentos = obtenerSegmentosCarpeta(file.webkitRelativePath || "");
    if (!segmentos.length) continue;

    for (let i = 1; i <= segmentos.length; i++) {
      rutas.add(segmentos.slice(0, i).join("/"));
    }
  }

  return [...rutas].sort(
    (a, b) => a.split("/").length - b.split("/").length
  );
};
