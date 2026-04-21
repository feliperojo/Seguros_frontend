import jsPDF from "jspdf";
import { jsPDFToBlob } from "../utils/pdfHelpers";

const DOCUSEAL_CONFIRMACION_SIGNATURE_TAG = "{{Sign;type=signature;role=First Party}}";

/**
 * Genera un documento PDF de confirmación de datos.
 * @param {Object} grupo - Datos del grupo familiar
 * @param {boolean} download - Si es true, descarga el PDF. Si es false, retorna el blob.
 * @param {"es"|"en"} language - Idioma del documento ("es" por defecto)
 * @returns {Promise<{blob: Blob, filename: string}>|void} - Retorna el blob si download es false
 */
export const generarPDFConfirmacion = async (grupo, download = true, language = "es") => {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 40;
  const maxWidth = 520;
  let y = 50;

  const formatFecha = (fecha, locale = "es-ES") => {
    if (!fecha) return "N/A";
    const opciones = { day: "2-digit", month: "short", year: "numeric" };
    return new Date(fecha).toLocaleDateString(locale, opciones);
  };

  const locale = language === "en" ? "en-US" : "es-ES";

  // ✅ Buscar Tomador
  const tomador = grupo.coberturas?.find(c => c.parentesco?.toUpperCase() === "TOMADOR");
  const nombreTomador = tomador?.cliente?.nombre_completo || "____________________";
  const direccion = tomador?.cliente?.direccion || (language === "en" ? "Not available" : "No disponible");
  const email = tomador?.cliente?.email || (language === "en" ? "Not available" : "No disponible");
  const telefono = tomador?.cliente?.telefono || (language === "en" ? "Not available" : "No disponible");
  const fechaNacimiento = formatFecha(tomador?.cliente?.fecha_nacimiento, locale);

  const fechaHoy = new Date().toLocaleDateString(locale);

  // Textos según idioma
  const texts = language === "en" ? {
    titulo: "DATA CONFIRMATION FOR INITIAL PROCESSING OR LIFE CHANGES BEFORE THE INSURANCE MARKETPLACE AND/OR INSURANCE COMPANIES.",
    intro: "I hereby certify that the data provided for enrollment or life changes with the insurance marketplace and insurance companies, mine and my family group's, are correct, true and accurate. I understand that if changes arise in the data provided below, I must report them immediately to update my application.",
    nombreApellidos: "Full Name:",
    fechaNacimiento: "Date of birth:",
    telefono: "Phone:",
    direccion: "Address:",
    email: "E-mail:",
    personasImpuestos: "# of people in family group on taxes",
    ingresoFamiliar: "Expected annual family income approx. for the year",
    tablaTitulo: "FAMILY GROUP MEMBERS WITH AND WITHOUT COVERAGE",
    nombreApellidosCol: "Full Name",
    cobertura: "Coverage",
    textoConfirmacion: [
      "I confirm that none of those applying for health coverage through the insurance marketplace has other health insurance (MEDICAID, CHIP, MEDICARE) or employer-sponsored health insurance.",
      "",
      "I confirm that the information I provide to submit my eligibility and enrollment application in the Marketplace will be true to the best of my knowledge and belief.",
      "• I confirm that I have reviewed my complete application and that all information is accurate.",
      "",
      `I authorize making the related changes in this document as of the date: ${fechaHoy}`,
    ],
    cordialmente: "Sincerely",
    firma: "Signature",
  } : {
    titulo: "CONFIRMACION DE DATOS ENTREGADOS PARA TRAMITACION POR PRIMERA VEZ O CAMBIOS DE VIDA ANTE MERCADO DE SEGUROS Y/O COMPAÑÍAS ASEGURADORAS.",
    intro: "Por la presente doy fe que los datos entregados para la inscripción o cambios de vida ante el mercado de seguros y las aseguradoras, míos y de mi grupo familiar son correctos ciertos y verdaderos, comprendo que, si surgen cambios en los datos suministrados a continuación, deberé informarlo inmediatamente para actualizar mi aplicación.",
    nombreApellidos: "Nombre y Apellidos:",
    fechaNacimiento: "Fecha de nacimiento:",
    telefono: "Teléfono:",
    direccion: "Dirección:",
    email: "E-mail:",
    personasImpuestos: "# de personas en grupo familiar en impuestos",
    ingresoFamiliar: "Ingreso Familiar anual esperado aprox. para el año",
    tablaTitulo: "PERSONAS DEL GRUPO FAMILIAR CON Y SIN COBERTURA",
    nombreApellidosCol: "Nombre y Apellidos",
    cobertura: "Cobertura",
    textoConfirmacion: [
      "Confirmo que ninguno de los que está solicitando cobertura médica a través del mercado de seguros tiene otro seguro médico (MEDICAID, CHIP, MEDICARE) ni seguro médico por oferta laboral.",
      "",
      "Confirmo que la información que proporciono para ingresar en mi solicitud de elegibilidad e inscripción en el Mercado será verdadera a mi leal saber y entender.",
      "• Confirmo que he revisado mi solicitud completa y que toda la información es precisa",
      "",
      `Autorizo hacer los cambios relacionados en este documento a partir de la fecha: ${fechaHoy}`,
    ],
    cordialmente: "Cordialmente",
    firma: "Firma",
  };

  // ✅ Título centrado
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(
    texts.titulo,
    doc.internal.pageSize.getWidth() / 2,
    y,
    { align: "center", maxWidth: 520 }
  );
  y += 50;

  // ✅ Texto introductorio
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(doc.splitTextToSize(texts.intro, maxWidth), margin, y);
  y += 60;

  // ✅ Datos principales
  const bold = (text, x, yPos) => {
    doc.setFont("helvetica", "bold");
    doc.text(text, x, yPos);
    doc.setFont("helvetica", "normal");
  };

  bold(texts.nombreApellidos, margin, y); doc.text(nombreTomador, margin + 160, y);
  y += 18;
  bold(texts.fechaNacimiento, margin, y); doc.text(fechaNacimiento, margin + 160, y);
  doc.setFont("helvetica", "bold");
  doc.text(texts.telefono, margin + 300, y);
  doc.setFont("helvetica", "normal");
  doc.text(telefono, margin + 370, y);
  y += 18;
  bold(texts.direccion, margin, y); doc.text(direccion, margin + 160, y);
  y += 18;
  bold(texts.email, margin, y); doc.text(email, margin + 160, y);
  y += 30;

  // ✅ Número de personas e ingreso
  doc.setFont("helvetica", "bold");
  doc.text(texts.personasImpuestos, margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(String(grupo.personas_taxes || "0"), margin + 300, y);
  y += 18;
  doc.setFont("helvetica", "bold");
  doc.text(texts.ingresoFamiliar, margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(`${new Date().getFullYear()} $${grupo.ingreso_familiar_anual || "0"}`, margin + 330, y);
  y += 40;

  // ✅ Tabla manual: Personas del grupo familiar
  doc.setFont("helvetica", "bold");
  doc.text(texts.tablaTitulo, margin + 60, y);
  y += 20;
  doc.setFontSize(10);
  doc.text(texts.nombreApellidosCol, margin, y);
  doc.text("D.O.B.", margin + 250, y);
  doc.text(texts.cobertura, margin + 350, y);
  y += 12;
  doc.line(margin, y, margin + 450, y);
  y += 15;
  doc.setFont("helvetica", "normal");

  (grupo.coberturas || []).forEach(c => {
    doc.text(c.cliente?.nombre_completo || "N/A", margin, y);
    doc.text(formatFecha(c.cliente?.fecha_nacimiento, locale) || "N/A", margin + 250, y);
    const rawCobertura = c.estado_cobertura;
    const normalizedCobertura =
      rawCobertura === null || rawCobertura === undefined || String(rawCobertura).trim() === ""
        ? "N/A"
        : (() => {
            const v = String(rawCobertura).trim();
            const lower = v.toLowerCase();
            if (lower === "yes" || lower === "si" || lower === "sí") return language === "en" ? "YES" : "SI";
            if (lower === "no") return "NO";
            return v;
          })();
    doc.text(normalizedCobertura, margin + 350, y);
    y += 14;
  });

  y += 30;

  // ✅ Texto confirmación
  doc.setFontSize(11);
  texts.textoConfirmacion.forEach(t => {
    const lines = doc.splitTextToSize(t, maxWidth);
    doc.text(lines, margin, y);
    y += lines.length * 14 + 10;
  });

  y += 30;

  // ✅ Firma
  doc.text(texts.cordialmente, margin, y);
  y += 30;
  doc.setFont("helvetica", "bold");
  // Campo de firma DocuSeal (reemplaza el texto "Firma/Signature" solo en Confirmación)
  // Nota: el tag debe EXISTIR en el PDF para que DocuSeal lo detecte, pero no queremos que se vea.
  // Por eso lo renderizamos con color blanco y luego restauramos el color por defecto.
  const prevTextColor = doc.getTextColor?.();
  doc.setTextColor(255, 255, 255);
  doc.text(DOCUSEAL_CONFIRMACION_SIGNATURE_TAG, margin, y);
  if (typeof prevTextColor !== "undefined") {
    doc.setTextColor(prevTextColor);
  } else {
    doc.setTextColor(0, 0, 0);
  }
  y += 20;
  doc.text(nombreTomador, margin, y);

  const nombreArchivo = language === "en"
    ? `Data_Confirmation_${nombreTomador}.pdf`
    : `Confirmacion_${nombreTomador}.pdf`;

  if (download) {
    doc.save(nombreArchivo);
  } else {
    const blob = await jsPDFToBlob(doc);
    return { blob, filename: nombreArchivo };
  }
};
