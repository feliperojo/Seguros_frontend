// utils/calcularIngresoAnual.js

export const calcularIngresoAnual = (monto, periodo) => {
    let montoNumerico = parseFloat(monto) || 0;
  
    switch (periodo) {
      case 'HOUR':
        return (montoNumerico * 40 * 52).toFixed(2); // Asumiendo 40 horas por semana
      case 'WEEKLY P.TIME':
        return (montoNumerico * 52 * 0.5).toFixed(2); // Medio tiempo
      case 'WEEKLY':
        return (montoNumerico * 52).toFixed(2);
      case 'BIWEEKLY':
        return (montoNumerico * 26).toFixed(2);
      case 'MONTHLY':
        return (montoNumerico * 12).toFixed(2);
      case 'ANNUAL':
        return montoNumerico.toFixed(2);
      default:
        return "0.00";
    }
  };
  
