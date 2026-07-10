// utils/parentescoColors.js
export const getTypeColor = (tipo = "") => {
  const normalized = String(tipo).trim().toLowerCase();

  // Solo el tomador es azul, todos los demás grises
  if (normalized === "tomador") return "primary"; // azul
  return "secondary"; // gris para todos los demás
};

  