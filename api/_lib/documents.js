const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const { EVENT, getSponsorPackage } = require("./agrex-config");

function euros(amount) {
  return `${Number(amount || 0).toLocaleString("fr-FR")} EUR`;
}

function makeCode(prefix) {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `AGRX-${prefix}-${stamp}-${rand}`;
}

function wrapText(text, maxChars) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);
  return lines;
}

async function createBadgePdf({ kind, status, firstName, lastName, company, jobTitle, profile, code, sponsorPackageId, lang }) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([420, 240]);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  const isGold = kind === "sponsor";
  const background = isGold ? rgb(0.95, 0.86, 0.55) : rgb(0.08, 0.09, 0.27);
  const textColor = isGold ? rgb(0.09, 0.08, 0.05) : rgb(1, 1, 1);
  const accent = isGold ? rgb(0.53, 0.39, 0.08) : rgb(0.09, 0.87, 0.78);

  page.drawRectangle({ x: 0, y: 0, width: 420, height: 240, color: background });
  page.drawRectangle({ x: 0, y: 196, width: 420, height: 44, color: accent });

  page.drawText("AGREX 2026", {
    x: 24,
    y: 210,
    size: 22,
    font: fontBold,
    color: isGold ? rgb(1, 1, 1) : rgb(0.05, 0.09, 0.18)
  });

  const badgeTitle =
    kind === "participant"
      ? lang === "en"
        ? "Participant Badge"
        : "Badge Participant"
      : lang === "en"
        ? "Sponsor Gold Badge"
        : "Badge Sponsor Gold";

  page.drawText(badgeTitle, {
    x: 24,
    y: 172,
    size: 18,
    font: fontBold,
    color: textColor
  });

  page.drawText(`${firstName} ${lastName}`, {
    x: 24,
    y: 142,
    size: 24,
    font: fontBold,
    color: textColor
  });

  const detailLines = [
    company,
    jobTitle,
    profile || (kind === "participant" ? "Participant" : "Sponsor"),
    EVENT.venue,
    `${lang === "en" ? "Code" : "Code"}: ${code}`
  ];

  let y = 116;
  for (const line of detailLines) {
    page.drawText(line, { x: 24, y, size: 11.5, font, color: textColor });
    y -= 18;
  }

  const statusLabel =
    status === "participant_confirmed"
      ? lang === "en"
        ? "Confirmed free access"
        : "Acces gratuit confirme"
      : status === "sponsor_paid"
        ? lang === "en"
          ? "Payment confirmed"
          : "Paiement confirme"
        : lang === "en"
          ? "Pending organiser confirmation"
          : "En attente de confirmation organisateur";

  page.drawRectangle({ x: 24, y: 18, width: 200, height: 24, color: accent });
  page.drawText(statusLabel, {
    x: 32,
    y: 26,
    size: 11,
    font: fontBold,
    color: isGold ? rgb(1, 1, 1) : rgb(0.05, 0.09, 0.18)
  });

  return Buffer.from(await pdf.save());
}

async function createSponsorContractPdf({ sponsor, lang }) {
  const pack = getSponsorPackage(sponsor.sponsorPackageId);
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  page.drawRectangle({ x: 0, y: 0, width: 595, height: 842, color: rgb(1, 1, 1) });
  page.drawRectangle({ x: 0, y: 780, width: 595, height: 62, color: rgb(0.08, 0.09, 0.27) });
  page.drawText("AGREX 2026", { x: 32, y: 802, size: 24, font: fontBold, color: rgb(1, 1, 1) });

  const title =
    lang === "en" ? "Sponsorship agreement summary" : "Contrat de sponsoring - synthese";
  page.drawText(title, { x: 32, y: 748, size: 20, font: fontBold, color: rgb(0.08, 0.09, 0.27) });

  const rows = [
    [lang === "en" ? "Reference" : "Reference", sponsor.code],
    [lang === "en" ? "Company" : "Societe", sponsor.company],
    [lang === "en" ? "Contact" : "Contact", `${sponsor.firstName} ${sponsor.lastName}`],
    [lang === "en" ? "Title" : "Fonction", sponsor.jobTitle],
    [lang === "en" ? "Country" : "Pays", sponsor.country],
    [lang === "en" ? "Email" : "Email", sponsor.email],
    [lang === "en" ? "Phone" : "Telephone", sponsor.phone],
    [lang === "en" ? "Package" : "Formule", lang === "en" ? pack.labelEn : pack.labelFr],
    [lang === "en" ? "Amount due" : "Montant a payer", euros(pack.amountEur)],
    [lang === "en" ? "Status" : "Statut", lang === "en" ? "Pending payment confirmation" : "En attente de confirmation du paiement"]
  ];

  let y = 710;
  for (const [label, value] of rows) {
    page.drawText(`${label}:`, { x: 32, y, size: 11, font: fontBold, color: rgb(0.12, 0.12, 0.18) });
    const lines = wrapText(value, 62);
    let lineY = y;
    for (const line of lines) {
      page.drawText(line, { x: 165, y: lineY, size: 11, font, color: rgb(0.2, 0.2, 0.25) });
      lineY -= 14;
    }
    y = lineY - 6;
  }

  page.drawText(lang === "en" ? "Included benefits" : "Avantages inclus", {
    x: 32,
    y: y - 4,
    size: 14,
    font: fontBold,
    color: rgb(0.08, 0.09, 0.27)
  });

  y -= 28;
  const benefits = lang === "en" ? pack.benefitsEn : pack.benefitsFr;
  for (const benefit of benefits) {
    const lines = wrapText(`- ${benefit}`, 78);
    for (const line of lines) {
      page.drawText(line, { x: 40, y, size: 11, font, color: rgb(0.2, 0.2, 0.25) });
      y -= 14;
    }
    y -= 4;
  }

  const notes = lang === "en"
    ? [
        "The digital sponsor badge attached to this registration remains provisional until payment has been confirmed by the organiser.",
        "Physical sponsor badges will be printed only for paid registrations confirmed by the organiser."
      ]
    : [
        "Le badge sponsor numerique joint a cette inscription reste provisoire tant que le paiement n'a pas ete confirme par l'organisateur.",
        "Les badges physiques sponsor seront imprimes uniquement pour les inscriptions reglees et confirmees par l'organisateur."
      ];

  y -= 10;
  for (const note of notes) {
    const lines = wrapText(note, 86);
    for (const line of lines) {
      page.drawText(line, { x: 32, y, size: 10.5, font, color: rgb(0.28, 0.28, 0.34) });
      y -= 13;
    }
    y -= 6;
  }

  page.drawText(`${EVENT.name} | ${lang === "en" ? EVENT.dateEn : EVENT.dateFr} | ${EVENT.venue}`, {
    x: 32,
    y: 30,
    size: 10,
    font,
    color: rgb(0.35, 0.35, 0.4)
  });

  return Buffer.from(await pdf.save());
}

module.exports = {
  makeCode,
  createBadgePdf,
  createSponsorContractPdf
};
