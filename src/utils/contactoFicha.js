/** Preparación de teléfonos y correos solo para la ficha. No altera el dato guardado. */

import countryCodes from "../services/countryCodes.js";

const codigoAPais = new Map();
const isoAPais = new Map();
(countryCodes || []).forEach((pais) => {
  const codigo = String(pais.code || "").replace(/\D+/g, "");
  const iso = String(pais.iso || "").toLowerCase();
  if (codigo && (!codigoAPais.has(codigo) || iso === "us")) {
    codigoAPais.set(codigo, { iso, nombre: pais.country || "" });
  }
  if (iso) isoAPais.set(iso, pais.country || "");
});

/** Emoji de bandera solo para un ISO de dos letras que ya está en el catálogo. */
const banderaDeIso = (iso) => {
  const codigo = String(iso || "").toLowerCase();
  if (!isoAPais.has(codigo)) return null;
  const letras = codigo.toUpperCase();
  try {
    return String.fromCodePoint(
      ...[...letras].map((letra) => 0x1f1e6 - 65 + letra.charCodeAt(0))
    );
  } catch {
    return null;
  }
};

/** Usa el ISO guardado. Si no hay, el indicativo ya registrado. No inventa un país. */
const banderaDeTelefono = (entrada) => {
  const isoGuardado = String(entrada?.iso || "").toLowerCase();
  if (isoAPais.has(isoGuardado)) {
    return { bandera: banderaDeIso(isoGuardado), pais: isoAPais.get(isoGuardado) || null };
  }
  const porCodigo = codigoAPais.get(String(entrada?.indicativo || "").replace(/\D+/g, ""));
  if (!porCodigo) return { bandera: null, pais: null };
  return { bandera: banderaDeIso(porCodigo.iso), pais: porCodigo.nombre || null };
};

const soloDigitos = (valor) => String(valor ?? "").replace(/\D/g, "");

/** Misma presentación 3-3-4 que ya usa la ficha cuando el número local tiene 10 dígitos. */
export const formatearNumeroTelefonoVisible = (numero) => {
  if (!numero) return "";
  const digitos = soloDigitos(numero);
  if (digitos.length === 10) {
    return `${digitos.slice(0, 3)}-${digitos.slice(3, 6)}-${digitos.slice(6)}`;
  }
  return String(numero);
};

const enlaceTelefono = (indicativo, numero) => {
  const codigo = soloDigitos(indicativo);
  const local = soloDigitos(numero);
  if (!local) return { whatsapp: null, llamar: null };
  const destino = codigo ? `${codigo}${local}` : local;
  return {
    whatsapp: `https://wa.me/${destino}`,
    llamar: codigo ? `tel:+${destino}` : `tel:${destino}`,
  };
};

export const prepararTelefonoContacto = (entrada) => {
  if (entrada == null) return null;

  if (typeof entrada === "string") {
    const visible = entrada.trim();
    if (!visible) return null;
    const digitos = soloDigitos(visible);
    if (!digitos) {
      return {
        id: null,
        visible,
        numero: visible,
        tipo: null,
        principal: false,
        bandera: null,
        pais: null,
        copiar: null,
        whatsapp: null,
        llamar: null,
      };
    }
    const conCodigo = visible.startsWith("+");
    return {
      id: null,
      visible,
      numero: visible,
      tipo: null,
      principal: false,
      bandera: null,
      pais: null,
      copiar: visible,
      whatsapp: `https://wa.me/${digitos}`,
      llamar: conCodigo ? `tel:+${digitos}` : `tel:${digitos}`,
    };
  }

  const numeroOriginal = entrada.numero == null ? "" : String(entrada.numero);
  if (!soloDigitos(numeroOriginal)) return null;
  const numeroVisible = formatearNumeroTelefonoVisible(numeroOriginal);
  const indicativoVisible = entrada.indicativo ? `+${entrada.indicativo} ` : "";
  const tipo = entrada.tipo ? ` (${entrada.tipo})` : "";
  const principal = entrada.principal ? " [Principal]" : "";
  const numeroMostrado = `${indicativoVisible}${numeroVisible}`.trim();
  const tipoRegistrado = String(entrada.tipo ?? "").trim();
  const visible = `${numeroMostrado}${tipo}${principal}`.trim();
  if (!visible) return null;

  const enlaces = enlaceTelefono(entrada.indicativo, numeroOriginal);
  const pais = entrada.indicativo ? banderaDeTelefono(entrada) : { bandera: null, pais: null };
  return {
    id: entrada.id ?? null,
    visible,
    numero: numeroMostrado,
    tipo: tipoRegistrado || null,
    principal: Boolean(entrada.principal),
    bandera: pais.bandera,
    pais: pais.pais,
    copiar: numeroMostrado || null,
    whatsapp: enlaces.whatsapp,
    llamar: enlaces.llamar,
  };
};

const leerTelefonos = (cliente) => {
  if (Array.isArray(cliente?.telefonos)) return cliente.telefonos;
  if (typeof cliente?.telefonos === "string" && cliente.telefonos.trim().startsWith("[")) {
    try {
      const parsed = JSON.parse(cliente.telefonos);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

export const prepararTelefonosContacto = (cliente) => {
  const telefonos = leerTelefonos(cliente);
  if (telefonos.length === 0) {
    return cliente?.telefono ? [prepararTelefonoContacto(cliente.telefono)].filter(Boolean) : [];
  }
  return [...telefonos]
    .sort((a, b) => (b?.principal ? 1 : 0) - (a?.principal ? 1 : 0))
    .map(prepararTelefonoContacto)
    .filter(Boolean);
};

const textoCorreo = (item) => {
  if (typeof item === "string") return item.trim();
  if (item && typeof item === "object" && item.email != null) return String(item.email).trim();
  return "";
};

const correoEnviable = (texto) => /^[^\s@]+@[^\s@]+$/.test(texto);

export const prepararCorreosContacto = (email) => {
  const lista = Array.isArray(email) ? email : [email];
  return lista.map(textoCorreo).filter(Boolean).map((visible) => ({
    visible,
    copiar: visible,
    mailto: correoEnviable(visible) ? `mailto:${visible}` : null,
  }));
};
