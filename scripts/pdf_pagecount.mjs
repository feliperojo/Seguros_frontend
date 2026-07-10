import { jsPDF } from "jspdf";

function pagesAutorizacion({ language = "es" } = {}) {
  const nombre = "Juan Pérez";
  const email = "juan@example.com";
  const direccion = "123 Main St, Tampa, FL";
  const now = new Date("2026-04-06T12:00:00Z");
  const fechaEs = now.toLocaleDateString("es-ES");
  const fechaEn = now.toLocaleDateString("en-US");

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 35;
  const maxWidth = 525;
  let y = 50;
  const pageHeight = doc.internal.pageSize.getHeight();
  const bottomMargin = 50;
  const lineHeight = 14;

  const titulo =
    language === "en"
      ? "AUTHORIZATION FOR THE USE AND MANAGEMENT OF HEALTH INSURANCE INFORMATION"
      : "AUTORIZACIÓN PARA EL MANEJO DE INFORMACIÓN DE MI SEGURO MÉDICO";

  doc.setFont("Helvetica", "bold");
  doc.setFontSize(13);
  const tituloLines = doc.splitTextToSize(titulo, maxWidth);
  doc.text(tituloLines, 297.5, y, { align: "center" });
  y += tituloLines.length * lineHeight + 10;

  doc.setFontSize(11);
  doc.setFont("Helvetica", "normal");

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

  const ensureSpace = (linesCount = 1, extraSpacing = 6) => {
    const neededHeight = linesCount * lineHeight + extraSpacing;
    if (y + neededHeight > pageHeight - bottomMargin) {
      doc.addPage();
      y = 50;
    }
  };

  texto.forEach((item) => {
    if (typeof item === "string") {
      const lines = doc.splitTextToSize(item, maxWidth);
      ensureSpace(lines.length, 6);
      doc.text(lines, margin, y);

      let extraSpacing = 6;
      if (
        item.includes("entrará en vigor") ||
        item.includes("shall become effective")
      ) {
        extraSpacing = 12;
      } else if (item.includes("Cordialmente") || item.includes("Sincerely")) {
        extraSpacing = 12;
      } else if (
        item.includes("Firma:") ||
        item.includes("Client Signature:")
      ) {
        extraSpacing = 20;
      } else if (
        item.includes("Nombre completo") ||
        item.includes("Printed Name")
      ) {
        extraSpacing = 4;
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

  return doc.getNumberOfPages();
}

function pagesConfirmacion({ language = "es", members = 4 } = {}) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 40;
  const maxWidth = 520;
  let y = 50;

  const locale = language === "en" ? "en-US" : "es-ES";

  const formatFecha = (fecha, locale2 = "es-ES") => {
    if (!fecha) return "N/A";
    const opciones = { day: "2-digit", month: "short", year: "numeric" };
    return new Date(fecha).toLocaleDateString(locale2, opciones);
  };

  const coberturas = Array.from({ length: members }).map((_, idx) => ({
    parentesco: idx === 0 ? "TOMADOR" : "DEPENDIENTE",
    estado_cobertura: idx % 2 === 0 ? "yes" : "no",
    cliente: {
      id: 1000 + idx,
      nombre_completo: idx === 0 ? "Juan Pérez" : `Miembro ${idx}`,
      direccion: idx === 0 ? "123 Main St, Tampa, FL" : undefined,
      email: idx === 0 ? "juan@example.com" : undefined,
      telefono: idx === 0 ? "8135550000" : undefined,
      fecha_nacimiento: `199${idx}-01-15`,
    },
  }));

  const grupo = {
    personas_taxes: members,
    ingreso_familiar_anual: 45000,
    coberturas,
  };

  const tomador = grupo.coberturas?.find(
    (c) => c.parentesco?.toUpperCase() === "TOMADOR"
  );
  const nombreTomador = tomador?.cliente?.nombre_completo || "____________________";
  const direccion =
    tomador?.cliente?.direccion ||
    (language === "en" ? "Not available" : "No disponible");
  const email =
    tomador?.cliente?.email || (language === "en" ? "Not available" : "No disponible");
  const telefono =
    tomador?.cliente?.telefono ||
    (language === "en" ? "Not available" : "No disponible");
  const fechaNacimiento = formatFecha(tomador?.cliente?.fecha_nacimiento, locale);

  const fechaHoy = new Date("2026-04-06T12:00:00Z").toLocaleDateString(locale);

  const texts =
    language === "en"
      ? {
          titulo:
            "DATA CONFIRMATION FOR INITIAL PROCESSING OR LIFE CHANGES BEFORE THE INSURANCE MARKETPLACE AND/OR INSURANCE COMPANIES.",
          intro:
            "I hereby certify that the data provided for enrollment or life changes with the insurance marketplace and insurance companies, mine and my family group's, are correct, true and accurate. I understand that if changes arise in the data provided below, I must report them immediately to update my application.",
          nombreApellidos: "Full Name:",
          fechaNacimiento: "Date of birth:",
          telefono: "Phone:",
          direccion: "Address:",
          email: "E-mail:",
          personasImpuestos: "# of people in family group on taxes",
          ingresoFamiliar:
            "Expected annual family income approx. for the year",
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
        }
      : {
          titulo:
            "CONFIRMACION DE DATOS ENTREGADOS PARA TRAMITACION POR PRIMERA VEZ O CAMBIOS DE VIDA ANTE MERCADO DE SEGUROS Y/O COMPAÑÍAS ASEGURADORAS.",
          intro:
            "Por la presente doy fe que los datos entregados para la inscripción o cambios de vida ante el mercado de seguros y las aseguradoras, míos y de mi grupo familiar son correctos ciertos y verdaderos, comprendo que, si surgen cambios en los datos suministrados a continuación, deberé informarlo inmediatamente para actualizar mi aplicación.",
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

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(texts.titulo, doc.internal.pageSize.getWidth() / 2, y, {
    align: "center",
    maxWidth: 520,
  });
  y += 50;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(doc.splitTextToSize(texts.intro, maxWidth), margin, y);
  y += 60;

  const bold = (text, x, yPos) => {
    doc.setFont("helvetica", "bold");
    doc.text(text, x, yPos);
    doc.setFont("helvetica", "normal");
  };

  bold(texts.nombreApellidos, margin, y);
  doc.text(nombreTomador, margin + 160, y);
  y += 18;
  bold(texts.fechaNacimiento, margin, y);
  doc.text(fechaNacimiento, margin + 160, y);
  doc.setFont("helvetica", "bold");
  doc.text(texts.telefono, margin + 300, y);
  doc.setFont("helvetica", "normal");
  doc.text(telefono, margin + 370, y);
  y += 18;
  bold(texts.direccion, margin, y);
  doc.text(direccion, margin + 160, y);
  y += 18;
  bold(texts.email, margin, y);
  doc.text(email, margin + 160, y);
  y += 30;

  doc.setFont("helvetica", "bold");
  doc.text(texts.personasImpuestos, margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(String(grupo.personas_taxes || "0"), margin + 300, y);
  y += 18;
  doc.setFont("helvetica", "bold");
  doc.text(texts.ingresoFamiliar, margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(
    `${new Date("2026-04-06T12:00:00Z").getFullYear()} $${grupo.ingreso_familiar_anual || "0"}`,
    margin + 330,
    y
  );
  y += 40;

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

  (grupo.coberturas || []).forEach((c) => {
    doc.text(c.cliente?.nombre_completo || "N/A", margin, y);
    doc.text(
      formatFecha(c.cliente?.fecha_nacimiento, locale) || "N/A",
      margin + 250,
      y
    );
    const coberturaVal =
      c.estado_cobertura?.toLowerCase() === "yes"
        ? language === "en"
          ? "YES"
          : "SI"
        : "NO";
    doc.text(coberturaVal, margin + 350, y);
    y += 14;
  });

  y += 30;

  doc.setFontSize(11);
  texts.textoConfirmacion.forEach((t) => {
    const lines = doc.splitTextToSize(t, maxWidth);
    doc.text(lines, margin, y);
    y += lines.length * 14 + 10;
  });

  y += 30;
  doc.text(texts.cordialmente, margin, y);
  y += 30;
  doc.setFont("helvetica", "bold");
  doc.text(texts.firma, margin, y);
  y += 20;
  doc.text(nombreTomador, margin, y);

  return doc.getNumberOfPages();
}

const out = {
  autorizacion: {
    a4: {
      es: pagesAutorizacion({ language: "es" }),
      en: pagesAutorizacion({ language: "en" }),
    },
  },
  confirmacion: {
    letter: {
      es_4_miembros: pagesConfirmacion({ language: "es", members: 4 }),
      en_4_miembros: pagesConfirmacion({ language: "en", members: 4 }),
      es_10_miembros: pagesConfirmacion({ language: "es", members: 10 }),
      en_10_miembros: pagesConfirmacion({ language: "en", members: 10 }),
    },
  },
};

console.log(JSON.stringify(out, null, 2));

