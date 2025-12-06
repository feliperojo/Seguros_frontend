/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // Importante: usar important para que Tailwind tenga prioridad solo cuando se use explícitamente
  // Esto evita conflictos con Bootstrap
  important: true,
  theme: {
    extend: {},
  },
  plugins: [],
  // Configuración para evitar conflictos con Bootstrap
  corePlugins: {
    // Mantener todos los plugins activos
    preflight: false, // Desactivar preflight para no interferir con Bootstrap
  },
}
