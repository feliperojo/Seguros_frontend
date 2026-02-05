import jsPDF from "jspdf";
import { jsPDFToBlob } from "../utils/pdfHelpers";

/**
 * Genera un documento PDF de confirmación de datos.
 * @param {Object} grupo - Datos del grupo familiar
 * @param {boolean} download - Si es true, descarga el PDF. Si es false, retorna el blob.
 * @returns {Promise<{blob: Blob, filename: string}>|void} - Retorna el blob si download es false
 */
export const generarPDFConfirmacion = async (grupo, download = true) => {
    console.log("grupo", grupo);
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 40;
  const maxWidth = 520;
  let y = 50;

  const formatFecha = (fecha) => {
    if (!fecha) return "N/A";
    const opciones = { day: "2-digit", month: "short", year: "numeric" };
    return new Date(fecha).toLocaleDateString("es-ES", opciones);
  };
  

  // ✅ Buscar Tomador
  const tomador = grupo.coberturas.find(c => c.parentesco?.toUpperCase() === "TOMADOR");
  const nombreTomador = tomador?.cliente?.nombre_completo || "____________________";
  const direccion = tomador?.cliente?.direccion || "No disponible";
  const email = tomador?.cliente?.email || "No disponible";
  const telefono = tomador?.cliente?.telefono || "No disponible";
  const fechaNacimiento = formatFecha(tomador?.cliente?.fecha_nacimiento);

  const fechaHoy = new Date().toLocaleDateString("es-ES");

  // ✅ Título centrado
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(
    "CONFIRMACION DE DATOS ENTREGADOS PARA TRAMITACION POR PRIMERA VEZ O CAMBIOS DE VIDA ANTE MERCADO DE SEGUROS Y/O COMPAÑÍAS ASEGURADORAS.",
    doc.internal.pageSize.getWidth() / 2,
    y,
    { align: "center", maxWidth: 520 }
  );
  y += 50; // 🔹 Aumentamos el espacio (antes era 40)

  // ✅ Texto introductorio
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const intro = `Por la presente doy fe que los datos entregados para la inscripción o cambios de vida ante el mercado de seguros y las aseguradoras, míos y de mi grupo familiar son correctos ciertos y verdaderos, comprendo que, si surgen cambios en los datos suministrados a continuación, deberé informarlo inmediatamente para actualizar mi aplicación.`;
  doc.text(doc.splitTextToSize(intro, maxWidth), margin, y);
  y += 60;

  // ✅ Datos principales
  const bold = (text, x, y) => {
    doc.setFont("helvetica", "bold");
    doc.text(text, x, y);
    doc.setFont("helvetica", "normal");
  };

  bold("Nombre y Apellidos:", margin, y); doc.text(nombreTomador, margin + 160, y);
  y += 18;
  bold("Fecha de nacimiento:", margin, y); doc.text(fechaNacimiento, margin + 160, y);
  doc.setFont("helvetica", "bold");
  doc.text("Teléfono:", margin + 300, y);
  doc.setFont("helvetica", "normal");
  doc.text(telefono, margin + 370, y);
  y += 18;
  bold("Dirección:", margin, y); doc.text(direccion, margin + 160, y);
  y += 18;
  bold("E-mail:", margin, y); doc.text(email, margin + 160, y);
  y += 30;

  // ✅ Número de personas e ingreso
  doc.setFont("helvetica", "bold");
  doc.text("# de personas en grupo familiar en impuestos", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(String(grupo.personas_taxes || "0"), margin + 300, y);
  y += 18;
  doc.setFont("helvetica", "bold");
  doc.text("Ingreso Familiar anual esperado aprox. para el año", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(`${new Date().getFullYear()} $${grupo.ingreso_familiar_anual || "0"}`, margin + 330, y);
  y += 40;

  // ✅ Tabla manual: Personas del grupo familiar
doc.setFont("helvetica", "bold");
doc.text("PERSONAS DEL GRUPO FAMILIAR CON Y SIN COBERTURA", margin + 60, y);
y += 20;
doc.setFontSize(10);
doc.text("Nombre y Apellidos", margin, y);
doc.text("D.O.B.", margin + 250, y);
doc.text("Cobertura", margin + 350, y);
y += 12;
doc.line(margin, y, margin + 450, y);
y += 15;
doc.setFont("helvetica", "normal");

grupo.coberturas.forEach(c => {
  doc.text(c.cliente?.nombre_completo || "N/A", margin, y);
  doc.text(formatFecha(c.cliente?.fecha_nacimiento) || "N/A", margin + 250, y);
  const cobertura = c.estado_cobertura?.toLowerCase() === "yes" ? "SI" : "NO";
    doc.text(cobertura, margin + 350, y);

  y += 14;
});

  y += 30;

  // ✅ Texto confirmación
  doc.setFontSize(11);
  const textoConfirmacion = [
    "Confirmo que ninguno de los que está solicitando cobertura médica a través del mercado de seguros tiene otro seguro médico (MEDICAID, CHIP, MEDICARE) ni seguro médico por oferta laboral.",
    "",
    "Confirmo que la información que proporciono para ingresar en mi solicitud de elegibilidad e inscripción en el Mercado será verdadera a mi leal saber y entender.",
    "• Confirmo que he revisado mi solicitud completa y que toda la información es precisa",
    "",
    `Autorizo hacer los cambios relacionados en este documento a partir de la fecha: ${fechaHoy}` // 🔹 Fecha incluida al final del texto
  ];

  textoConfirmacion.forEach(t => {
    const lines = doc.splitTextToSize(t, maxWidth);
    doc.text(lines, margin, y);
    y += lines.length * 14 + 10;
  });

  y += 30;

  // ✅ Firma
  doc.text("Cordialmente", margin, y);
  y += 30;
  doc.setFont("helvetica", "bold");
  doc.text("Firma", margin, y);
  y += 20;
  doc.text(nombreTomador, margin, y);

  if (download) {
    // Comportamiento original: descargar directamente
    doc.save(`Confirmacion_${nombreTomador}.pdf`);
  } else {
    // Retornar blob para usar en modal
    const blob = await jsPDFToBlob(doc);
    return { blob, filename: `Confirmacion_${nombreTomador}.pdf` };
  }
};
