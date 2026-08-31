const stableStringify = (value) => {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const valuesDiffer = (a, b) => stableStringify(a) !== stableStringify(b);

/**
 * Compara dos objetos planos y devuelve solo las claves que cambiaron (valores del actual).
 */
export const diffPayloadObjects = (baseline = {}, current = {}) => {
  const campos = {};
  const keys = new Set([...Object.keys(baseline), ...Object.keys(current)]);

  keys.forEach((key) => {
    if (valuesDiffer(baseline[key], current[key])) {
      campos[key] = current[key];
    }
  });

  return campos;
};

/**
 * Construye el bloque `cambios` para modo delta a partir de payloads baseline vs actual.
 */
export const buildDeltaCambiosFromPayloads = ({
  baselineGrupo = {},
  currentGrupo = {},
  baselineClientes = [],
  currentClientes = [],
  baselineCoberturas = [],
  currentCoberturas = [],
}) => {
  const cambios = {};

  const grupoDiff = diffPayloadObjects(baselineGrupo, currentGrupo);
  if (Object.keys(grupoDiff).length > 0) {
    cambios.grupo = grupoDiff;
  }

  const sameId = (a, b) => Number(a) === Number(b) && Number.isFinite(Number(a));

  const clientesDiff = [];
  currentClientes.forEach((cur) => {
    const base = baselineClientes.find((c) => sameId(c.id, cur.id));
    if (!base) return;

    const campos = diffPayloadObjects(base, cur);
    delete campos.id;
    if (Object.keys(campos).length > 0) {
      clientesDiff.push({ id: Number(cur.id), campos });
    }
  });
  if (clientesDiff.length > 0) {
    cambios.clientes = clientesDiff;
  }

  const coberturasDiff = [];
  currentCoberturas.forEach((cur) => {
    const base = baselineCoberturas.find((c) => sameId(c.id, cur.id));
    if (!base) return;

    const { id, cliente_id, ...curCampos } = cur;
    const { id: _id, cliente_id: _clienteId, ...baseCampos } = base;
    const campos = diffPayloadObjects(baseCampos, curCampos);
    const dirtyFields = Object.keys(campos);

    if (dirtyFields.length > 0) {
      coberturasDiff.push({
        id,
        cliente_id,
        campos,
        _dirty_fields: dirtyFields,
      });
    }
  });
  if (coberturasDiff.length > 0) {
    cambios.coberturas = coberturasDiff;
  }

  return cambios;
};

/**
 * En legacy el backend solo permite vaciar campos de cobertura si vienen en `_dirty_fields`.
 * Reutiliza el diff ya calculado (mismo criterio que modo delta) y lo adjunta al payload completo.
 * También reinyecta valores null del diff que stripNulls hubiera omitido (p. ej. precio).
 */
export const attachCoberturaDirtyFieldsForLegacy = (
  coberturasPayload = [],
  coberturasCambios = [],
) => {
  if (!Array.isArray(coberturasPayload) || coberturasPayload.length === 0) {
    return coberturasPayload;
  }
  if (!Array.isArray(coberturasCambios) || coberturasCambios.length === 0) {
    return coberturasPayload;
  }

  const cambioById = new Map(
    coberturasCambios
      .filter((c) => c?.id != null && Array.isArray(c._dirty_fields) && c._dirty_fields.length > 0)
      .map((c) => [Number(c.id), c]),
  );

  if (cambioById.size === 0) {
    return coberturasPayload;
  }

  return coberturasPayload.map((cobertura) => {
    const cambio = cambioById.get(Number(cobertura?.id));
    if (!cambio) {
      return cobertura;
    }

    const merged = {
      ...cobertura,
      _dirty_fields: cambio._dirty_fields,
    };

    (cambio._dirty_fields || []).forEach((field) => {
      if (
        cambio.campos &&
        Object.prototype.hasOwnProperty.call(cambio.campos, field) &&
        merged[field] === undefined
      ) {
        merged[field] = cambio.campos[field] ?? null;
      }
    });

    return merged;
  });
};
