import jsPDF from "jspdf";
import apiRequest from "./api";
import { jsPDFToBlob, downloadBlob } from "../utils/pdfHelpers";

/**
 * Genera un documento PDF para la carta de autorización.
 * Obtiene datos completos del cliente usando su ID.
 * @param {number|string} clienteId - ID del cliente
 * @param {boolean} download - Si es true, descarga el PDF. Si es false, retorna el blob.
 * @param {"es"|"en"} language - Idioma del documento ("es" por defecto)
 * @returns {Promise<Blob|void>} - Retorna el blob si download es false
 */
export const generarPDFAutorizacion = async (
  clienteId,
  download = true,
  language = "es"
) => {
  try {
    // 1️⃣ Llamar API para obtener datos completos
    const clienteData = await apiRequest(`cliente/show/${clienteId}`, "GET");

  const nombre = clienteData?.nombre_completo || "No disponible";
  const email = clienteData?.email || "No disponible";
  const direccion = clienteData?.direccion || "No disponible";
  const now = new Date();
  const fechaEs = now.toLocaleDateString("es-ES");
  const fechaEn = now.toLocaleDateString("en-US");

  // Configuración A4
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 35;
  const maxWidth = 525;
  let y = 50;
  const pageHeight = doc.internal.pageSize.getHeight();
  const bottomMargin = 50;
  const lineHeight = 14;

  // **Título (dinámico según idioma)**
  const titulo = language === "en"
    ? "AUTHORIZATION FOR THE USE AND MANAGEMENT OF HEALTH INSURANCE INFORMATION"
    : "AUTORIZACIÓN PARA EL MANEJO DE INFORMACIÓN DE MI SEGURO MÉDICO";

  doc.setFont("Helvetica", "bold");
  doc.setFontSize(13);
  const tituloLines = doc.splitTextToSize(titulo, maxWidth);
  doc.text(tituloLines, 297.5, y, { align: "center" });
  y += tituloLines.length * lineHeight + 10;

  doc.setFontSize(11);
  doc.setFont("Helvetica", "normal");

  // **Texto principal (ajustado al nuevo formato, ES / EN)**
  const textoEs = [
    `Por medio de la presente, yo, ${nombre}, otorgo mi autorización expresa para que la agencia de seguros GODAGER GROUP LLC, A brand of Tampa Seguros, actúe como agente y/o representante autorizado para mí y, de ser aplicable, para todo mi grupo familiar, con el fin de realizar gestiones relacionadas con la inscripción y administración de un Plan de Salud Cualificado ofrecido en el Mercado Facilitado Federalmente (Health Insurance Marketplace) y ante las diferentes compañías aseguradoras.`,
    `\n`,
    { bold: true, text: "AGENCIA DE SEGUROS" },
    "GODAGER GROUP LLC A brand of Tampa Seguros NPN de la agencia: 18369597",
    `\n`,
    { bold: true, text: "AGENTES CON LICENCIA (NPN)" },
    {
      list: [
        "Natalia A. Osorio Jiménez – NPN 18086661",
        "Henry L. Canas – NPN 195523362",
        "Samuel Canas – NPN 20110218",
      ],
    },
    `\n`,
    { bold: true, text: "REPRESENTANTES AUTORIZADOS / SOPORTE AL CLIENTE" },
    {
      list: ["Andrea Muñoz", "Catalina Ospina"],
    },
    "Los Representantes Autorizados están facultados para realizar gestiones administrativas, comunicación con el Marketplace y asistencia operativa.",
    `\n`,
    { bold: true, text: "ALCANCE DE LA AUTORIZACIÓN" },
    "Al aceptar este acuerdo, autorizo a la agencia, agentes y representantes autorizados mencionados anteriormente a ver, utilizar y gestionar mi información confidencial, proporcionada por escrito, de forma electrónica o por teléfono, exclusivamente para uno o más de los siguientes fines:",
    {
      list: [
        "Localizar una solicitud existente en el Mercado de Seguros.",
        "Completar solicitudes de elegibilidad e inscripción en un Plan de Salud Cualificado del Mercado y/o créditos fiscales anticipados para el pago de primas.",
        "Proporcionar mantenimiento continuo de la cuenta, asistencia para inscripciones, cambios de vida y renovaciones anuales, según sea necesario.",
        "Responder a consultas del Mercado relacionadas con mi solicitud.",
        "Cancelar mi póliza de seguro médico cuando así lo indique.",
        "Comunicarse conmigo a través del Marketplace, correo electrónico, WhatsApp o llamadas telefónicas.",
      ],
    },
    `\n`,
    { bold: true, text: "CONFIDENCIALIDAD" },
    "Entiendo que la Agencia y los Agentes no utilizarán ni compartirán mi información de identificación personal (PII) para ningún propósito distinto de los enumerados anteriormente.",
    "La Agencia se compromete a mantener mi información privada y segura al recopilarla, almacenarla y utilizarla para los fines aquí autorizados.",
    `\nConfirmo que no tengo otro seguro médico activo, incluyendo Medicaid, CHIP, Medicare, ni cobertura médica ofrecida por un empleador, a la fecha de firma de este documento.`,
    `\nEsta autorización entrará en vigor a partir del ${fechaEs} y permanecerá vigente hasta que sea revocada por escrito por mi parte.`,
    `\n\nCordialmente,`,
    `\n\n\nFirma:`,
    `\n\nNombre completo: ${nombre}\nCorreo electrónico: ${email}\nDirección: ${direccion}`,
  ];

  const textoEn = [
    `By signing this document, I, ${nombre}, hereby grant my express authorization for GODAGER GROUP LLC, A brand of Tampa Seguros, to act as my insurance agent and/or authorized representative and, if applicable, for my entire household, for purposes related to enrollment and administration of a Qualified Health Plan offered through the Federally Facilitated Marketplace (Health Insurance Marketplace) and with participating insurance carriers.`,
    `\n`,
    { bold: true, text: "INSURANCE AGENCY" },
    "GODAGER GROUP LLC brand of Tampa Seguros  Agency NPN: 18369597",
    `\n`,
    { bold: true, text: "LICENSED INSURANCE AGENTS (NPN)" },
    {
      list: [
        "Natalia A. Osorio Jiménez – NPN 18086661",
        "Henry L. Canas – NPN 195523362",
        "Samuel Canas – NPN 20110218",
      ],
    },
    `\n`,
    { bold: true, text: "AUTHORIZED REPRESENTATIVES / CLIENT SUPPORT" },
    {
      list: ["Andrea Muñoz", "Catalina Ospina"],
    },
    "Authorized Representatives are permitted to perform administrative services, communicate with the Health Insurance Marketplace, and provide operational assistance.",
    `\n`,
    { bold: true, text: "SCOPE OF AUTHORIZATION" },
    "By accepting this agreement, I authorize the agency, licensed agents, and authorized representatives listed above to access, use, and manage my confidential information, provided in writing, electronically, or by phone, solely for one or more of the following purposes:",
    {
      list: [
        "Locate an existing Health Insurance Marketplace application.",
        "Complete eligibility and enrollment applications for a Qualified Health Plan and/or advance premium tax credits.",
        "Provide ongoing account maintenance and assistance with enrollments, life change events, and annual renewals, as needed.",
        "Respond to Marketplace inquiries regarding my application.",
        "Cancel my health insurance policy upon my request, if necessary.",
        "Communicate with me through the Marketplace, email, WhatsApp, or telephone calls.",
      ],
    },
    `\n`,
    { bold: true, text: "CONFIDENTIALITY" },
    "I understand that the Agency and its Agents will not use or share my personally identifiable information (PII) for any purpose other than those listed above.",
    "The Agency agrees to ensure that my PII is kept private and secure when collected, stored, and used for the purposes authorized herein.",
    `\nI confirm that I do not currently have any other active health insurance coverage, including Medicaid, CHIP, Medicare, or employer-sponsored health insurance, as of the date of signing this document.`,
    `\nThis authorization shall become effective on ${fechaEn} and shall remain in effect until revoked by me in writing.`,
    `\n\nSincerely,`,
    `\n\n\nClient Signature:`,
    `\n\nPrinted Name: ${nombre}\nEmail: ${email}\nAddress: ${direccion}`,
  ];

  const texto = language === "en" ? textoEn : textoEs;

  // Helper para saltar de página cuando no haya espacio suficiente
  const ensureSpace = (linesCount = 1, extraSpacing = 6) => {
    const neededHeight = linesCount * lineHeight + extraSpacing;
    if (y + neededHeight > pageHeight - bottomMargin) {
      doc.addPage();
      y = 50; // Reiniciar en la parte superior de la nueva página
    }
  };

  // **Render del contenido con manejo de salto de página**
  texto.forEach((item, index) => {
    if (typeof item === "string") {
      const lines = doc.splitTextToSize(item, maxWidth);
      ensureSpace(lines.length, 6);
      doc.text(lines, margin, y);
      
      // Aumentar espaciado después de la fecha y antes de la firma
      let extraSpacing = 6;
      if (item.includes("entrará en vigor") || item.includes("shall become effective")) {
        extraSpacing = 12; // Más espacio después de la fecha
      } else if (item.includes("Cordialmente") || item.includes("Sincerely")) {
        extraSpacing = 12; // Más espacio después de "Cordialmente"
      } else if (item.includes("Firma:") || item.includes("Client Signature:")) {
        extraSpacing = 20; // Más espacio después de "Firma:" para dejar lugar para la firma
      } else if (item.includes("Nombre completo") || item.includes("Printed Name")) {
        extraSpacing = 4; // Menos espacio para los datos del cliente (cerca de la firma)
      }
      
      y += lines.length * lineHeight + extraSpacing;
    } else if (item.bold) {
      const lines = doc.splitTextToSize(item.text, maxWidth);
      ensureSpace(lines.length, 6);
      doc.setFont("Helvetica", "bold");
      doc.text(lines, margin, y);
      doc.setFont("Helvetica", "normal");
      y += lines.length * lineHeight + 6;
    } else if (item.list) {
      item.list.forEach((li) => {
        const lines = doc.splitTextToSize(`• ${li}`, maxWidth - 20);
        ensureSpace(lines.length, 4);
        doc.text(lines, margin + 15, y);
        y += lines.length * lineHeight + 4;
      });
    }
  });

  // Nombre del archivo según idioma
  const nombreArchivo = language === "en"
    ? `Authorization_health_insurance_${nombre}.pdf`
    : `Autorizacion_manejo_informacion_${nombre}.pdf`;

  if (download) {
    // Comportamiento original: descargar directamente
    doc.save(nombreArchivo);
  } else {
    // Retornar blob para usar en modal
    const blob = await jsPDFToBlob(doc);
    return { blob, filename: nombreArchivo };
  }
} catch (error) {
  console.error("❌ Error al generar PDF:", error);
  throw error;
}
};
