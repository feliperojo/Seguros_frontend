/**
 * Servicio de generación de PDF para contratos con tag de firma DocuSeal.
 * Genera PDF con jsPDF y retorna base64 para envío al backend.
 */
import jsPDF from "jspdf";
import {
  COMPANY_NAME,
  getContractTitle,
  getContractBody,
  getFooterText,
  SIGNATURE_TAG,
} from "../utils/pdfTemplate";

const MARGIN = 40;
const MAX_WIDTH = 515;
const LINE_HEIGHT = 14;
const PAGE_HEIGHT = 842; // A4 pt

/**
 * Genera el PDF del contrato con header, datos del cliente, cuerpo, tag de firma y footer.
 * @param {Object} clientData - Datos del cliente
 * @param {string} clientData.nombreCompleto - Nombre completo
 * @param {string} clientData.email - Email
 * @param {string} clientData.telefono - Teléfono
 * @param {string} clientData.tipoContrato - Tipo de contrato (value del dropdown)
 * @returns {Promise<string>} PDF en base64 (sin prefijo data URL)
 */
export async function generatePDF(clientData) {
  const { nombreCompleto, email, telefono, tipoContrato } = clientData;

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  let y = 50;

  // ----- Header (logo / nombre de empresa) -----
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(16);
  doc.text(COMPANY_NAME, MARGIN, y);
  y += 8;
  doc.setDrawColor(200, 200, 200);
  doc.line(MARGIN, y, doc.internal.pageSize.getWidth() - MARGIN, y);
  y += 25;

  // ----- Título del contrato -----
  const title = getContractTitle(tipoContrato);
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(14);
  doc.text(title, doc.internal.pageSize.getWidth() / 2, y, { align: "center" });
  y += 28;

  // ----- Datos del cliente -----
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Datos del cliente", MARGIN, y);
  y += LINE_HEIGHT + 4;

  doc.setFont("Helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Nombre completo: ${nombreCompleto || "—"}`, MARGIN, y);
  y += LINE_HEIGHT;
  doc.text(`Email: ${email || "—"}`, MARGIN, y);
  y += LINE_HEIGHT;
  doc.text(`Teléfono: ${telefono || "—"}`, MARGIN, y);
  y += LINE_HEIGHT + 12;

  // ----- Cuerpo del contrato -----
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Contenido del contrato", MARGIN, y);
  y += LINE_HEIGHT + 4;

  doc.setFont("Helvetica", "normal");
  doc.setFontSize(10);
  const body = getContractBody(tipoContrato);
  const bodyLines = doc.splitTextToSize(body, MAX_WIDTH);
  doc.text(bodyLines, MARGIN, y);
  y += bodyLines.length * LINE_HEIGHT + 20;

  // Si no hay espacio suficiente para la sección de firma, nueva página
  if (y > PAGE_HEIGHT - 120) {
    doc.addPage();
    y = 40;
  }

  // ----- Firma del cliente + tag DocuSeal -----
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Firma del Cliente:", MARGIN, y);
  y += LINE_HEIGHT + 6;

  doc.setFont("Helvetica", "normal");
  doc.setFontSize(10);
  doc.text(SIGNATURE_TAG, MARGIN, y);
  y += LINE_HEIGHT + 25;

  // ----- Footer -----
  if (y > PAGE_HEIGHT - 40) {
    doc.addPage();
    y = 40;
  }
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  const footerLines = doc.splitTextToSize(getFooterText(), MAX_WIDTH);
  doc.text(footerLines, MARGIN, y);

  // Retornar base64 sin prefijo data URL
  const dataUrl = doc.output("dataurlstring");
  const base64 = dataUrl.replace(/^data:application\/pdf;base64,/, "");
  return base64;
}
