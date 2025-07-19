import React from "react";
import { Document, Packer, Paragraph, TextRun, AlignmentType } from "docx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";

const CartaAutorizacion = ({ cliente }) => {
  if (!cliente) return null;

  const nombre = cliente.nombre_completo || "__________________";
  const email = cliente.email || "__________________";
  const direccion = cliente.direccion || "__________________";
  const fecha = new Date().toLocaleDateString("es-ES");

  const textoAutorizacion = [
    { text: "AUTORIZACIÓN DE MANEJO DE INFORMACIÓN DE MI SEGURO MÉDICO", style: "title", bold: true },
    {
      text: `Mediante la presente, yo ${nombre}, otorgo mi autorización y poder para actuar como agente o corredor de seguro médico para mí y para todo mi hogar, si corresponde, para fines de inscripción en un Plan de Salud Cualificado ofrecido en el Mercado Facilitado Federalmente (Marketplace) y las diferentes aseguradoras a:`,
      style: "normal",
      boldName: nombre
    },
    { text: "La agencia de seguros GODAGER GROUP LLC (Tampa seguros SBA) NPN18369597", style: "normal", bold: true },
    { text: "a sus agentes:", style: "normal" },
    {
      text: "• Natalia A Osorio Jiménez, con NPN 18086661.\n• Henry L Canas NPN 195523362.\n• Samuel Canas NPN 20110218.\n• Asistentes de Soporte al Cliente: Catalina Ospina / Andrea Munoz / Daniela Palacio / Johana Osorio",
      style: "list"
    },
    {
      text: "Al aceptar este acuerdo, autorizo al Agente mencionado con anterioridad a ver y utilizar la información confidencial proporcionada por mí por escrito, electrónicamente o por teléfono solo para uno o más de los siguientes:",
      style: "normal"
    },
    {
      text: "• Búsqueda de una aplicación de Mercado de Seguros existente\n• Completar una solicitud de elegibilidad e inscripción en un Plan de Salud Cualificado del Mercado o créditos fiscales anticipados para ayudar a pagar las primas del Mercado.\n• Proporcionar mantenimiento continuo de la cuenta y asistencia para la inscripción, cambios de vida y Renovaciones cada año, según sea necesario.\n• Responder a consultas del Mercado sobre mi solicitud.\n• Cancelar mi póliza de seguro médico en el momento que lo indique, de ser necesario.\n• Comunicarse conmigo a través de MSM, email, WhatsApp, o llamadas telefónicas.",
      style: "list"
    },
    {
      text: "Entiendo que la Agencia – Agente no utilizará ni compartirá mi información de identificación personal (IP) para ningún propósito distinto de los enumerados anteriormente. La Agencia-Agente se asegurará de que mi IP se mantenga privada y segura al recopilar, almacenar y utilizar mi IP para los fines indicados anteriormente.",
      style: "normal"
    },
    {
      text: "Confirmo NO tengo otro seguro médico, (MEDICAID, CHIP, MEDICARE) así como también que no tengo cobertura médica por un empleador.",
      style: "normal"
    },
    {
      text: `Esta autorización entrará en vigor a partir de la fecha ${fecha} y durará indefinidamente, salvo que se revoque por escrito de mi parte.`,
      style: "normal"
    },
    { text: "Cordialmente:", style: "normal", bold: true },
    { text: "Firma: _______________________________", style: "normal", bold: true },
    { text: `Nombre Completo: ${nombre}\nEmail: ${email}\nDirección: ${direccion}`, style: "normal", bold: true }
  ];

  // ✅ Generar Word con Arial y negrilla
  const generarWord = async () => {
    const doc = new Document({
      sections: [
        {
          children: textoAutorizacion.map(item => {
            return new Paragraph({
              children: [
                new TextRun({
                  text: item.text,
                  font: "Arial", // Cambio a Arial
                  size: 24,
                  bold: item.bold ? true : false
                })
              ],
              spacing: { after: 300 },
              alignment: item.style === "title" ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
              indent: item.style === "list" ? { left: 720 } : {}
            });
          })
        }
      ]
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `Autorizacion_${nombre}.docx`);
  };

  // ✅ Generar PDF con Arial y negrilla
  const generarPDF = () => {
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    doc.setFont("Arial", "normal");
    const margin = 40;
    const maxWidth = 520;
    let y = 60;

    // Título en negrilla
    doc.setFont("Arial", "bold");
    doc.setFontSize(14);
    doc.text("AUTORIZACIÓN DE MANEJO DE INFORMACIÓN DE MI SEGURO MÉDICO", 300, y, { align: "center" });
    y += 40;

    doc.setFontSize(12);
    textoAutorizacion.slice(1).forEach(item => {
      const lines = doc.splitTextToSize(item.text, maxWidth);
      const indent = item.style === "list" ? margin + 20 : margin;
      if (item.bold) doc.setFont("Arial", "bold");
      else doc.setFont("Arial", "normal");
      doc.text(lines, indent, y);
      y += lines.length * 16 + 10;
    });

    doc.save(`Autorizacion_${nombre}.pdf`);
  };

  return (
    <div className="mt-3">
      <button className="btn btn-outline-primary w-100 mb-2" onClick={generarWord}>
        <i className="bi bi-file-earmark-word me-2"></i>
        Descargar Word
      </button>
      <button className="btn btn-outline-danger w-100" onClick={generarPDF}>
        <i className="bi bi-file-earmark-pdf me-2"></i>
        Descargar PDF
      </button>
    </div>
  );
};

export default CartaAutorizacion;
