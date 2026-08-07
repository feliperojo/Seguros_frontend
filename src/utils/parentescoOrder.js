/**
 * Orden de visualización de miembros del grupo familiar:
 * Tomador → Cónyuge → Hijo/a → resto (orden original estable).
 */

const normalizeParentesco = (m = {}) =>
  String(m.tipo || m.parentesco || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

/** Prioridad numérica menor = aparece primero. */
export function parentescoSortRank(m = {}) {
  const v = normalizeParentesco(m);
  if (v === "tomador") return 0;
  if (v === "conyuge" || v === "esposo" || v === "esposa") return 1;
  if (v === "hijo/a" || v === "hijo" || v === "hija") return 2;
  return 3;
}

/**
 * Comparador estable por parentesco.
 * @param {object} a
 * @param {object} b
 * @param {number} [indexA=0] índice original de a
 * @param {number} [indexB=0] índice original de b
 */
export function compareMembersByParentesco(a, b, indexA = 0, indexB = 0) {
  return parentescoSortRank(a) - parentescoSortRank(b) || indexA - indexB;
}
