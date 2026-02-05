import jsPDF from "jspdf";
import apiRequest from "./api";
import { jsPDFToBlob, downloadBlob } from "../utils/pdfHelpers";

/**
 * Genera un documento PDF para la carta de autorización.
 * Obtiene datos completos del cliente usando su ID.
 * @param {number|string} clienteId - ID del cliente
 * @param {boolean} download - Si es true, descarga el PDF. Si es false, retorna el blob.
 * @returns {Promise<Blob|void>} - Retorna el blob si download es false
 */
export const generarPDFAutorizacion = async (clienteId, download = true) => {
  try {
    // 1️⃣ Llamar API para obtener datos completos
    const clienteData = await apiRequest(`cliente/show/${clienteId}`, "GET");

  const nombre = clienteData?.nombre_completo || "__________________";
  const email = clienteData?.email || "No disponible";
  const direccion = clienteData?.direccion || "No disponible";
  const fecha = new Date().toLocaleDateString("es-ES");

  // Configuración A4
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 35;
  const maxWidth = 525;
  let y = 50;

  // **Título**
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(14);
  doc.text("AUTORIZACIÓN DE MANEJO DE INFORMACIÓN DE MI SEGURO MÉDICO", 297.5, y, { align: "center" });
  y += 35;

  doc.setFontSize(11);
  doc.setFont("Helvetica", "normal");

  // **Texto principal**
  const texto = [
    `Mediante la presente, yo ${nombre}, otorgo mi autorización y poder para actuar como agente o corredor de seguro médico para mí y para todo mi hogar, si corresponde, para fines de inscripción en un Plan de Salud Cualificado ofrecido en el Mercado Facilitado Federalmente (Marketplace) y las diferentes aseguradoras a:`,
    `\n`,
    { bold: true, text: "La agencia de seguros GODAGER GROUP LLC (Tampa seguros SBA) NPN18369597" },
    { text: "a sus agentes:" },
    {
      list: [
        "Natalia A Osorio Jiménez, con NPN 18086661",
        "Henry L Canas NPN 195523362",
        "Samuel Canas NPN 20110218",
        "Asistentes de Soporte al Cliente: Catalina Ospina / Andrea Munoz / Daniela Palacio / Johana Osorio"
      ]
    },
    `\nAl aceptar este acuerdo, autorizo al Agente mencionado con anterioridad a ver y utilizar la información confidencial proporcionada por mí por escrito, electrónicamente o por teléfono solo para uno o más de los siguientes:`,
    {
      list: [
        "Búsqueda de una aplicación de Mercado de Seguros existente",
        "Completar una solicitud de elegibilidad e inscripción en un Plan de Salud Cualificado del Mercado o créditos fiscales anticipados para ayudar a pagar las primas del Mercado.",
        "Proporcionar mantenimiento continuo de la cuenta y asistencia para la inscripción, cambios de vida y Renovaciones cada año, según sea necesario.",
        "Responder a consultas del Mercado sobre mi solicitud.",
        "Cancelar mi póliza de seguro médico en el momento que lo indique, de ser necesario.",
        "Comunicarse conmigo a través de MSM, email, WhatsApp, o llamadas telefónicas."
      ]
    },
    `\n`,
    { bold: true, text: "Importante:" },
    " Entiendo que la Agencia – Agente no utilizará ni compartirá mi información de identificación personal (IP) para ningún propósito distinto de los enumerados anteriormente. La Agencia-Agente se asegurará de que mi IP se mantenga privada y segura al recopilar, almacenar y utilizar mi IP para los fines indicados anteriormente.",
    `\nConfirmo NO tengo otro seguro médico (MEDICAID, CHIP, MEDICARE) así como también que no tengo cobertura médica por un empleador.`,
    `\nEsta autorización entrará en vigor a partir de la fecha ${fecha} y durará indefinidamente, salvo que se revoque por escrito de mi parte.`,
    `\nCordialmente:`,
    `\nFirma: _______________________________`,
    `Nombre Completo: ${nombre}\nEmail: ${email}\nDirección: ${direccion}`
  ];

  // **Render del contenido**
  texto.forEach((item) => {
    if (typeof item === "string") {
      const lines = doc.splitTextToSize(item, maxWidth);
      doc.text(lines, margin, y);
      y += lines.length * 14 + 6;
    } else if (item.bold) {
      doc.setFont("Helvetica", "bold");
      const lines = doc.splitTextToSize(item.text, maxWidth);
      doc.text(lines, margin, y);
      doc.setFont("Helvetica", "normal");
      y += lines.length * 14 + 6;
    } else if (item.list) {
      item.list.forEach((li) => {
        const lines = doc.splitTextToSize(`• ${li}`, maxWidth - 20);
        doc.text(lines, margin + 15, y);
        y += lines.length * 14 + 4;
      });
    }
  });

  if (download) {
    // Comportamiento original: descargar directamente
    doc.save(`Autorizacion_${nombre}.pdf`);
  } else {
    // Retornar blob para usar en modal
    const blob = await jsPDFToBlob(doc);
    return { blob, filename: `Autorizacion_${nombre}.pdf` };
  }
} catch (error) {
  console.error("❌ Error al generar PDF:", error);
  throw error;
}
};
