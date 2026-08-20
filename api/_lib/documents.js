const fs = require("node:fs/promises");
const path = require("node:path");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const { EVENT, getSponsorPackage } = require("./agrex-config");

const AGREX_LOGO_PATH = path.join(__dirname, "..", "..", "assets", "images", "agrex-logo.jpeg");
const CONTACT_EMAIL = "contact@agrex.events";

const BADGE = {
  width: 360,
  height: 540,
  margin: 10,
  radius: 22,
  gold: rgb(0.73, 0.62, 0.47),
  goldSoft: rgb(0.95, 0.90, 0.82),
  goldLine: rgb(0.78, 0.67, 0.52),
  navy: rgb(0.08, 0.24, 0.40),
  navySoft: rgb(0.16, 0.30, 0.47),
  white: rgb(1, 1, 1),
  panel: rgb(0.99, 0.99, 0.99),
  ink: rgb(0.14, 0.15, 0.18),
  muted: rgb(0.40, 0.42, 0.45),
  rule: rgb(0.82, 0.76, 0.68),
  slot: rgb(0.20, 0.22, 0.25)
};

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

function fitLines(text, maxChars, maxLines) {
  const lines = wrapText(text, maxChars);
  if (lines.length <= maxLines) return lines;

  const kept = lines.slice(0, maxLines);
  const last = kept[maxLines - 1];
  kept[maxLines - 1] = last.length > maxChars - 3 ? `${last.slice(0, maxChars - 3)}...` : `${last}...`;
  return kept;
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

function roundedRectPath(x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  const c = r * 0.552284749831;
  const x2 = x + width;
  const y2 = y + height;

  return [
    `M ${x + r} ${y}`,
    `L ${x2 - r} ${y}`,
    `C ${x2 - r + c} ${y} ${x2} ${y + r - c} ${x2} ${y + r}`,
    `L ${x2} ${y2 - r}`,
    `C ${x2} ${y2 - r + c} ${x2 - r + c} ${y2} ${x2 - r} ${y2}`,
    `L ${x + r} ${y2}`,
    `C ${x + r - c} ${y2} ${x} ${y2 - r + c} ${x} ${y2 - r}`,
    `L ${x} ${y + r}`,
    `C ${x} ${y + r - c} ${x + r - c} ${y} ${x + r} ${y}`,
    "Z"
  ].join(" ");
}

function drawRoundedRect(page, options) {
  const { x, y, width, height, radius, color, borderColor, borderWidth = 0 } = options;
  page.drawSvgPath(roundedRectPath(x, y, width, height, radius), {
    color,
    borderColor,
    borderWidth
  });
}

function drawCenteredText(page, text, options) {
  const { x, y, width, font, size, color } = options;
  const textWidth = font.widthOfTextAtSize(text, size);
  page.drawText(text, {
    x: x + (width - textWidth) / 2,
    y,
    size,
    font,
    color
  });
}

function drawIconBadge(page, options) {
  const { x, y, kind } = options;
  const iconColor = BADGE.white;

  page.drawCircle({
    x,
    y,
    size: 11.5,
    color: BADGE.gold
  });

  if (kind === "person") {
    page.drawCircle({ x, y: y + 3.5, size: 2.9, color: iconColor });
    page.drawEllipse({ x, y: y - 4.5, xScale: 6.8, yScale: 4.8, color: iconColor });
    return;
  }

  if (kind === "building") {
    page.drawRectangle({ x: x - 5, y: y - 5.5, width: 10, height: 11, color: iconColor });
    page.drawRectangle({ x: x - 1.2, y: y - 5.5, width: 2.4, height: 4, color: BADGE.gold });
    page.drawLine({ start: { x: x - 2.8, y: y + 1.5 }, end: { x: x - 2.8, y: y + 5 }, thickness: 0.8, color: BADGE.gold });
    page.drawLine({ start: { x: x + 2.8, y: y + 1.5 }, end: { x: x + 2.8, y: y + 5 }, thickness: 0.8, color: BADGE.gold });
    return;
  }

  if (kind === "briefcase") {
    page.drawRectangle({ x: x - 6, y: y - 4.5, width: 12, height: 8, color: iconColor });
    page.drawRectangle({ x: x - 2.5, y: y + 2.8, width: 5, height: 1.6, color: iconColor });
    page.drawLine({ start: { x: x, y: y + 2.8 }, end: { x: x, y: y + 5 }, thickness: 0.9, color: iconColor });
    return;
  }

  if (kind === "group") {
    page.drawCircle({ x: x - 3.5, y: y + 3, size: 2.3, color: iconColor });
    page.drawCircle({ x: x + 3.5, y: y + 3, size: 2.3, color: iconColor });
    page.drawEllipse({ x: x - 3.5, y: y - 4, xScale: 4.5, yScale: 3.4, color: iconColor });
    page.drawEllipse({ x: x + 3.5, y: y - 4, xScale: 4.5, yScale: 3.4, color: iconColor });
    return;
  }

  if (kind === "calendar") {
    page.drawRectangle({ x: x - 5.5, y: y - 5, width: 11, height: 10, color: iconColor });
    page.drawRectangle({ x: x - 5.5, y: y + 1.5, width: 11, height: 2, color: BADGE.gold });
    page.drawLine({ start: { x: x - 2.5, y: y + 5 }, end: { x: x - 2.5, y: y + 7 }, thickness: 1, color: iconColor });
    page.drawLine({ start: { x: x + 2.5, y: y + 5 }, end: { x: x + 2.5, y: y + 7 }, thickness: 1, color: iconColor });
    return;
  }

  if (kind === "pin") {
    page.drawCircle({ x, y: y + 2.5, size: 3.2, color: iconColor });
    page.drawSvgPath(`M ${x} ${y - 7} L ${x - 4.5} ${y - 1.5} L ${x + 4.5} ${y - 1.5} Z`, { color: iconColor });
  }
}

function drawValueLines(page, lines, options) {
  const { x, y, font, size, color, fontBold } = options;
  let currentY = y;
  for (const [index, line] of lines.entries()) {
    page.drawText(line, {
      x,
      y: currentY,
      size: index === 0 ? size : Math.max(size - 1, 9),
      font: index === 0 ? fontBold : font,
      color
    });
    currentY -= size + 2;
  }
  return currentY;
}

function drawInfoRow(page, options) {
  const {
    topY,
    iconKind,
    labelFr,
    labelEn,
    value,
    font,
    fontBold,
    valueSize = 13,
    maxChars = 28
  } = options;

  drawIconBadge(page, { x: 40, y: topY - 10, kind: iconKind });

  page.drawText(labelFr, {
    x: 62,
    y: topY - 2,
    size: 7.9,
    font: fontBold,
    color: BADGE.ink
  });
  page.drawText(labelEn, {
    x: 62,
    y: topY - 13,
    size: 6.5,
    font,
    color: BADGE.muted
  });

  const nextY = drawValueLines(page, fitLines(value || "-", maxChars, 2), {
    x: 62,
    y: topY - 31,
    font,
    fontBold,
    size: valueSize,
    color: BADGE.ink
  });

  page.drawLine({
    start: { x: 62, y: nextY - 4 },
    end: { x: 300, y: nextY - 4 },
    thickness: 0.7,
    color: BADGE.rule
  });
}

function roleMeta({ kind, profile, sponsorPackageId }) {
  const normalizedProfile = String(profile || "").toLowerCase();
  const sponsorPackage = sponsorPackageId ? getSponsorPackage(sponsorPackageId) : null;

  if (kind === "sponsor") {
    if (sponsorPackage?.id === "platinum") {
      return { bandLabel: "PLATINUM SPONSOR", typeChoice: "sponsor", bandColor: BADGE.goldSoft };
    }
    if (sponsorPackage?.id === "gold") {
      return { bandLabel: "GOLD SPONSOR", typeChoice: "sponsor", bandColor: BADGE.goldSoft };
    }
    if (sponsorPackage?.id === "silver") {
      return { bandLabel: "SILVER SPONSOR", typeChoice: "sponsor", bandColor: BADGE.white };
    }
    if (sponsorPackage?.id === "bronze") {
      return { bandLabel: "BRONZE SPONSOR", typeChoice: "sponsor", bandColor: BADGE.goldSoft };
    }
    return { bandLabel: "BUSINESS PASS", typeChoice: "delegate", bandColor: BADGE.white };
  }

  if (normalizedProfile.includes("invest")) {
    return { bandLabel: "INVESTOR", typeChoice: "investor", bandColor: BADGE.white };
  }
  if (normalizedProfile.includes("media")) {
    return { bandLabel: "MEDIA", typeChoice: "other", bandColor: BADGE.white };
  }
  if (normalizedProfile.includes("partner") || normalizedProfile.includes("partenaire")) {
    return { bandLabel: "PARTNER", typeChoice: "other", bandColor: BADGE.white };
  }
  if (normalizedProfile.includes("sponsor")) {
    return { bandLabel: "SPONSOR GUEST", typeChoice: "sponsor", bandColor: BADGE.goldSoft };
  }

  return { bandLabel: "PARTICIPANT", typeChoice: "delegate", bandColor: BADGE.white };
}

function statusMeta(status) {
  if (status === "participant_confirmed") {
    return { label: "CONFIRME / CONFIRMED", fill: BADGE.navy, text: BADGE.white };
  }
  if (status === "sponsor_paid") {
    return { label: "PAYE / PAID", fill: BADGE.navy, text: BADGE.goldSoft };
  }
  return { label: "PROVISOIRE / PROVISIONAL", fill: BADGE.gold, text: BADGE.white };
}

function drawTypeOptions(page, options) {
  const { topY, selected, font, fontBold } = options;

  drawIconBadge(page, { x: 40, y: topY - 12, kind: "group" });

  page.drawText("TYPE DE PARTICIPANT", {
    x: 62,
    y: topY - 2,
    size: 7.9,
    font: fontBold,
    color: BADGE.ink
  });
  page.drawText("TYPE OF PARTICIPANT", {
    x: 62,
    y: topY - 13,
    size: 6.5,
    font,
    color: BADGE.muted
  });

  const items = [
    { id: "delegate", fr: "DELEGUE", en: "DELEGATE" },
    { id: "sponsor", fr: "SPONSOR", en: "SPONSOR" },
    { id: "investor", fr: "INVESTISSEUR", en: "INVESTOR" },
    { id: "other", fr: "AUTRE", en: "OTHER" }
  ];

  const startX = 74;
  const boxY = topY - 35;
  const gap = 60;

  items.forEach((item, index) => {
    const x = startX + gap * index;
    const checked = item.id === selected;

    page.drawRectangle({
      x,
      y: boxY,
      width: 10,
      height: 10,
      borderColor: BADGE.gold,
      borderWidth: 1
    });

    if (checked) {
      page.drawRectangle({
        x: x + 2,
        y: boxY + 2,
        width: 6,
        height: 6,
        color: BADGE.navy
      });
    }

    drawCenteredText(page, item.fr, {
      x: x - 12,
      y: boxY - 16,
      width: 34,
      font: fontBold,
      size: 5.8,
      color: BADGE.ink
    });
    drawCenteredText(page, item.en, {
      x: x - 12,
      y: boxY - 25,
      width: 34,
      font,
      size: 5.3,
      color: BADGE.muted
    });
  });

  page.drawLine({
    start: { x: 62, y: 126 },
    end: { x: 300, y: 126 },
    thickness: 0.7,
    color: BADGE.rule
  });
}

function drawBottomInfo(page, options) {
  const { font, fontBold } = options;

  drawIconBadge(page, { x: 40, y: 100, kind: "calendar" });
  page.drawText("DATE", { x: 62, y: 108, size: 7.7, font: fontBold, color: BADGE.ink });
  page.drawText("DATE", { x: 62, y: 97, size: 6.3, font, color: BADGE.muted });
  page.drawText("19 & 20 OCTOBRE 2026", {
    x: 62,
    y: 79,
    size: 8.7,
    font: fontBold,
    color: BADGE.ink
  });
  page.drawText("19th & 20th OCTOBER 2026", {
    x: 62,
    y: 67,
    size: 7.2,
    font,
    color: BADGE.muted
  });

  page.drawLine({
    start: { x: 176, y: 62 },
    end: { x: 176, y: 116 },
    thickness: 0.6,
    color: BADGE.rule
  });

  drawIconBadge(page, { x: 194, y: 100, kind: "pin" });
  page.drawText("LIEU", { x: 216, y: 108, size: 7.7, font: fontBold, color: BADGE.ink });
  page.drawText("VENUE", { x: 216, y: 97, size: 6.3, font, color: BADGE.muted });
  page.drawText("DUBAI - EMIRATS ARABES UNIS", {
    x: 216,
    y: 79,
    size: 6.2,
    font: fontBold,
    color: BADGE.ink
  });
  page.drawText("DUBAI - UNITED ARAB EMIRATES", {
    x: 216,
    y: 67,
    size: 5.8,
    font,
    color: BADGE.muted
  });
}

async function createBadgePdf({ kind, status, firstName, lastName, company, jobTitle, profile, code, sponsorPackageId }) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([BADGE.width, BADGE.height]);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const logo = await loadAgrexLogo(pdf);
  const meta = roleMeta({ kind, profile, sponsorPackageId });
  const statusPill = statusMeta(status);
  const cardX = BADGE.margin;
  const cardY = BADGE.margin;
  const cardWidth = BADGE.width - BADGE.margin * 2;
  const cardHeight = BADGE.height - BADGE.margin * 2;

  page.drawRectangle({
    x: 0,
    y: 0,
    width: BADGE.width,
    height: BADGE.height,
    color: rgb(0.95, 0.95, 0.95)
  });

  drawRoundedRect(page, {
    x: cardX,
    y: cardY,
    width: cardWidth,
    height: cardHeight,
    radius: BADGE.radius,
    color: BADGE.white,
    borderColor: BADGE.goldLine,
    borderWidth: 1.2
  });

  page.drawRectangle({
    x: cardX,
    y: cardY + cardHeight - 128,
    width: cardWidth,
    height: 128,
    color: BADGE.gold
  });
  page.drawCircle({
    x: cardX + BADGE.radius,
    y: cardY + cardHeight - BADGE.radius,
    size: BADGE.radius,
    color: BADGE.gold
  });
  page.drawCircle({
    x: cardX + cardWidth - BADGE.radius,
    y: cardY + cardHeight - BADGE.radius,
    size: BADGE.radius,
    color: BADGE.gold
  });

  page.drawEllipse({
    x: BADGE.width / 2,
    y: 382,
    xScale: 178,
    yScale: 54,
    color: BADGE.white
  });

  drawRoundedRect(page, {
    x: BADGE.width / 2 - 22,
    y: cardY + cardHeight - 22,
    width: 44,
    height: 14,
    radius: 7,
    color: BADGE.slot
  });

  drawRoundedRect(page, {
    x: 112,
    y: 354,
    width: 136,
    height: 76,
    radius: 14,
    color: BADGE.white,
    borderColor: BADGE.goldSoft,
    borderWidth: 1
  });

  if (logo) {
    const dimensions = fitImage(logo, 188, 60);
    page.drawImage(logo, {
      x: (BADGE.width - dimensions.width) / 2,
      y: 365,
      width: dimensions.width,
      height: dimensions.height
    });
  } else {
    drawCenteredText(page, "AGREX", {
      x: 40,
      y: 395,
      width: BADGE.width - 80,
      font: fontBold,
      size: 26,
      color: BADGE.navy
    });
  }

  page.drawLine({
    start: { x: 34, y: 345 },
    end: { x: BADGE.width - 34, y: 345 },
    thickness: 0.8,
    color: BADGE.rule
  });

  drawRoundedRect(page, {
    x: BADGE.width - 136,
    y: 352,
    width: 102,
    height: 16,
    radius: 8,
    color: statusPill.fill
  });
  drawCenteredText(page, statusPill.label, {
    x: BADGE.width - 136,
    y: 357,
    width: 102,
    font: fontBold,
    size: 5.7,
    color: statusPill.text
  });

  page.drawText(`REF. ${code}`, {
    x: 34,
    y: 356,
    size: 6.3,
    font,
    color: BADGE.muted
  });

  drawInfoRow(page, {
    topY: 320,
    iconKind: "person",
    labelFr: "NOM ET PRENOM",
    labelEn: "FULL NAME",
    value: `${firstName} ${lastName}`,
    font,
    fontBold,
    valueSize: 14,
    maxChars: 24
  });

  drawInfoRow(page, {
    topY: 276,
    iconKind: "building",
    labelFr: "COMPANY / ORGANISATION",
    labelEn: "COMPANY / ORGANISATION",
    value: company,
    font,
    fontBold,
    valueSize: 12.3,
    maxChars: 28
  });

  drawInfoRow(page, {
    topY: 232,
    iconKind: "briefcase",
    labelFr: "FONCTION",
    labelEn: "JOB TITLE",
    value: jobTitle,
    font,
    fontBold,
    valueSize: 12.2,
    maxChars: 28
  });

  drawTypeOptions(page, {
    topY: 188,
    selected: meta.typeChoice,
    font,
    fontBold
  });

  drawBottomInfo(page, {
    font,
    fontBold
  });

  page.drawRectangle({
    x: cardX,
    y: 48,
    width: cardWidth,
    height: 26,
    color: BADGE.gold
  });

  drawCenteredText(page, `${EVENT.website}   |   ${CONTACT_EMAIL}`, {
    x: cardX + 18,
    y: 56,
    width: cardWidth - 36,
    font,
    size: 8,
    color: BADGE.white
  });

  page.drawRectangle({
    x: cardX,
    y: cardY,
    width: cardWidth,
    height: 38,
    color: BADGE.navy
  });
  page.drawCircle({
    x: cardX + BADGE.radius,
    y: cardY + BADGE.radius,
    size: BADGE.radius,
    color: BADGE.navy
  });
  page.drawCircle({
    x: cardX + cardWidth - BADGE.radius,
    y: cardY + BADGE.radius,
    size: BADGE.radius,
    color: BADGE.navy
  });

  page.drawLine({
    start: { x: 28, y: 28 },
    end: { x: 64, y: 28 },
    thickness: 1,
    color: BADGE.goldSoft
  });
  page.drawLine({
    start: { x: BADGE.width - 64, y: 28 },
    end: { x: BADGE.width - 28, y: 28 },
    thickness: 1,
    color: BADGE.goldSoft
  });

  drawCenteredText(page, meta.bandLabel, {
    x: 78,
    y: 19,
    width: BADGE.width - 156,
    font: fontBold,
    size: meta.bandLabel.length > 16 ? 11 : 12.4,
    color: meta.bandColor
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
