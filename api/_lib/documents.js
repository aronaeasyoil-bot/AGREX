const fs = require("node:fs/promises");
const path = require("node:path");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const { EVENT, getSponsorPackage } = require("./agrex-config");

const AGREX_LOGO_PATH = path.join(__dirname, "..", "..", "assets", "images", "agrex-logo.jpeg");

let agrexLogoBytesPromise;

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

async function loadAgrexLogo(pdf) {
  try {
    if (!agrexLogoBytesPromise) {
      agrexLogoBytesPromise = fs.readFile(AGREX_LOGO_PATH);
    }
    const bytes = await agrexLogoBytesPromise;
    return pdf.embedJpg(bytes);
  } catch {
    return null;
  }
}

function fitImage(image, maxWidth, maxHeight) {
  const ratio = Math.min(maxWidth / image.width, maxHeight / image.height);
  return {
    width: image.width * ratio,
    height: image.height * ratio
  };
}

function drawTextBlock(page, lines, options) {
  const { x, y, size, lineHeight, font, color, align = "left", width = 0 } = options;
  let currentY = y;

  for (const line of lines) {
    let drawX = x;
    if (align === "center" && width) {
      drawX = x + (width - font.widthOfTextAtSize(line, size)) / 2;
    } else if (align === "right" && width) {
      drawX = x + width - font.widthOfTextAtSize(line, size);
    }

    page.drawText(line, { x: drawX, y: currentY, size, font, color });
    currentY -= lineHeight;
  }

  return currentY;
}

function badgeTheme(kind, sponsorPackageId) {
  const sponsorPackage = sponsorPackageId ? getSponsorPackage(sponsorPackageId) : null;
  const isGold = sponsorPackage ? sponsorPackage.theme === "gold" : kind === "sponsor";

  if (isGold) {
    return {
      gold: true,
      card: rgb(0.98, 0.95, 0.88),
      border: rgb(0.79, 0.66, 0.38),
      header: rgb(0.67, 0.56, 0.33),
      headerText: rgb(1, 0.98, 0.92),
      chip: rgb(0.15, 0.15, 0.17),
      chipText: rgb(0.96, 0.87, 0.58),
      text: rgb(0.16, 0.13, 0.08),
      muted: rgb(0.43, 0.35, 0.18),
      divider: rgb(0.86, 0.78, 0.57),
      footer: rgb(0.20, 0.17, 0.11),
      footerText: rgb(0.98, 0.95, 0.86),
      panel: rgb(1, 0.99, 0.97),
      status: rgb(0.13, 0.13, 0.15),
      statusText: rgb(0.98, 0.88, 0.62)
    };
  }

  return {
    gold: false,
    card: rgb(0.98, 0.99, 1),
    border: rgb(0.79, 0.86, 0.94),
    header: rgb(0.07, 0.12, 0.27),
    headerText: rgb(1, 1, 1),
    chip: rgb(0.13, 0.56, 0.91),
    chipText: rgb(1, 1, 1),
    text: rgb(0.09, 0.12, 0.18),
    muted: rgb(0.35, 0.41, 0.49),
    divider: rgb(0.84, 0.89, 0.95),
    footer: rgb(0.93, 0.96, 0.99),
    footerText: rgb(0.08, 0.12, 0.19),
    panel: rgb(1, 1, 1),
    status: rgb(0.07, 0.12, 0.27),
    statusText: rgb(1, 1, 1)
  };
}

function badgeCategory({ kind, lang, profile, sponsorPackageId }) {
  const normalizedProfile = String(profile || "").toLowerCase();
  const sponsorPackage = sponsorPackageId ? getSponsorPackage(sponsorPackageId) : null;

  if (kind === "sponsor") {
    if (sponsorPackage?.theme === "gold") {
      return lang === "en" ? "GOLD SPONSOR" : "SPONSOR GOLD";
    }
    return lang === "en" ? "BUSINESS PASS" : "PASS BUSINESS";
  }

  if (normalizedProfile.includes("visitor") || normalizedProfile.includes("visiteur")) {
    return lang === "en" ? "VISITOR PASS" : "PASS VISITEUR";
  }
  if (normalizedProfile.includes("invest")) {
    return lang === "en" ? "INVESTOR" : "INVESTISSEUR";
  }
  if (normalizedProfile.includes("partner") || normalizedProfile.includes("partenaire")) {
    return lang === "en" ? "PARTNER" : "PARTENAIRE";
  }
  if (normalizedProfile.includes("media")) {
    return "MEDIA";
  }
  if (normalizedProfile.includes("sponsor")) {
    return lang === "en" ? "SPONSOR GUEST" : "INVITE SPONSOR";
  }
  return lang === "en" ? "ATTENDEE" : "PARTICIPANT";
}

function badgeStatus({ status, lang }) {
  if (status === "participant_confirmed") {
    return lang === "en" ? "Free visitor access confirmed" : "Acces visiteur gratuit confirme";
  }
  if (status === "sponsor_paid") {
    return lang === "en" ? "Sponsor payment confirmed" : "Paiement sponsor confirme";
  }
  return lang === "en" ? "Provisional badge pending organiser validation" : "Badge provisoire en attente de validation";
}

function drawField(page, options) {
  const { label, value, y, font, fontBold, theme, width, maxChars = 28, valueSize = 13 } = options;

  page.drawText(label, {
    x: 28,
    y,
    size: 8.5,
    font: fontBold,
    color: theme.muted
  });

  const lines = wrapText(value || "-", maxChars).slice(0, 2);
  const nextY = drawTextBlock(page, lines, {
    x: 28,
    y: y - 16,
    size: valueSize,
    lineHeight: valueSize + 3,
    font,
    color: theme.text,
    width
  });

  page.drawRectangle({
    x: 28,
    y: nextY - 4,
    width: width - 16,
    height: 1,
    color: theme.divider
  });

  return nextY - 18;
}

async function createBadgePdf({ kind, status, firstName, lastName, company, jobTitle, profile, code, sponsorPackageId, lang }) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([340, 540]);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const logo = await loadAgrexLogo(pdf);
  const theme = badgeTheme(kind, sponsorPackageId);
  const category = badgeCategory({ kind, lang, profile, sponsorPackageId });
  const statusLabel = badgeStatus({ status, lang });
  const displayName = `${firstName} ${lastName}`.trim();
  const profileLabel =
    kind === "sponsor"
      ? lang === "en"
        ? "PACKAGE"
        : "FORMULE"
      : lang === "en"
        ? "PROFILE"
        : "PROFIL";
  const displayProfile =
    profile || (lang === "en" ? "Visitor Pass" : "Pass Visiteur");
  const pageWidth = 340;
  const cardX = 12;
  const cardY = 12;
  const cardWidth = 316;
  const cardHeight = 516;

  page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: 540, color: rgb(0.93, 0.95, 0.98) });
  page.drawRectangle({
    x: cardX,
    y: cardY,
    width: cardWidth,
    height: cardHeight,
    color: theme.card,
    borderColor: theme.border,
    borderWidth: 2
  });
  page.drawRectangle({
    x: cardX,
    y: 398,
    width: cardWidth,
    height: 130,
    color: theme.header
  });

  page.drawText("AGREX 2026", {
    x: 28,
    y: 501,
    size: 16,
    font: fontBold,
    color: theme.headerText
  });
  page.drawText("AFRICA GULF REAL ESTATE EXPO", {
    x: 28,
    y: 486,
    size: 7.8,
    font,
    color: theme.headerText
  });
  page.drawText(lang === "en" ? EVENT.dateEn : EVENT.dateFr, {
    x: 28,
    y: 472,
    size: 8.4,
    font: fontBold,
    color: theme.headerText
  });
  page.drawText("Dubai World Trade Centre", {
    x: 28,
    y: 459,
    size: 7.8,
    font,
    color: theme.headerText
  });

  page.drawRectangle({
    x: 88,
    y: 414,
    width: 164,
    height: 48,
    color: theme.panel,
    borderColor: theme.border,
    borderWidth: 1.2
  });

  if (logo) {
    const dimensions = fitImage(logo, 146, 34);
    page.drawImage(logo, {
      x: 88 + (164 - dimensions.width) / 2,
      y: 414 + (48 - dimensions.height) / 2,
      width: dimensions.width,
      height: dimensions.height
    });
  } else {
    page.drawText("AGREX", {
      x: 136,
      y: 431,
      size: 18,
      font: fontBold,
      color: theme.text
    });
  }

  const chipWidth = Math.max(122, Math.min(194, fontBold.widthOfTextAtSize(category, 11) + 24));
  const chipX = cardX + (cardWidth - chipWidth) / 2;
  page.drawRectangle({
    x: chipX,
    y: 384,
    width: chipWidth,
    height: 24,
    color: theme.chip
  });
  page.drawText(category, {
    x: chipX + (chipWidth - fontBold.widthOfTextAtSize(category, 11)) / 2,
    y: 391,
    size: 11,
    font: fontBold,
    color: theme.chipText
  });

  page.drawText(lang === "en" ? "NAME" : "NOM", {
    x: 28,
    y: 354,
    size: 8.5,
    font: fontBold,
    color: theme.muted
  });

  const nameLines = wrapText(displayName, 18).slice(0, 2);
  const nameSize = nameLines.some((line) => line.length > 16) ? 20 : 23;
  let nameY = 329;
  nameY = drawTextBlock(page, nameLines, {
    x: 28,
    y: nameY,
    size: nameSize,
    lineHeight: nameSize + 4,
    font: fontBold,
    color: theme.text,
    width: cardWidth - 32
  });

  page.drawRectangle({
    x: 28,
    y: nameY - 2,
    width: cardWidth - 32,
    height: 1,
    color: theme.divider
  });

  let contentY = nameY - 22;
  contentY = drawField(page, {
    label: lang === "en" ? "ORGANISATION" : "ORGANISATION",
    value: company,
    y: contentY,
    font,
    fontBold,
    theme,
    width: cardWidth - 12,
    maxChars: 28
  });
  contentY = drawField(page, {
    label: lang === "en" ? "JOB TITLE" : "FONCTION",
    value: jobTitle,
    y: contentY,
    font,
    fontBold,
    theme,
    width: cardWidth - 12,
    maxChars: 28
  });
  contentY = drawField(page, {
    label: profileLabel,
    value: displayProfile,
    y: contentY,
    font,
    fontBold,
    theme,
    width: cardWidth - 12,
    maxChars: 28
  });

  page.drawRectangle({
    x: cardX,
    y: cardY,
    width: cardWidth,
    height: 76,
    color: theme.footer
  });

  const statusWidth = Math.min(204, fontBold.widthOfTextAtSize(statusLabel, 10) + 22);
  page.drawRectangle({
    x: 28,
    y: 58,
    width: statusWidth,
    height: 18,
    color: theme.status
  });
  page.drawText(statusLabel, {
    x: 28 + (statusWidth - fontBold.widthOfTextAtSize(statusLabel, 10)) / 2,
    y: 63,
    size: 10,
    font: fontBold,
    color: theme.statusText
  });

  page.drawText(`${lang === "en" ? "Reference" : "Reference"}: ${code}`, {
    x: 28,
    y: 40,
    size: 10.2,
    font: fontBold,
    color: theme.footerText
  });
  drawTextBlock(page, wrapText(`${EVENT.website} | ${EVENT.venue}`, 42).slice(0, 2), {
    x: 28,
    y: 24,
    size: 8.6,
    lineHeight: 10.5,
    font,
    color: theme.footerText,
    width: cardWidth - 32
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
