const fs = require("node:fs/promises");
const path = require("node:path");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const { EVENT, getSponsorPackage } = require("./agrex-config");

const AGREX_LOGO_PATH = path.join(__dirname, "..", "..", "assets", "images", "agrex-logo.jpeg");
const CONTACT_EMAIL = "contact@agrex.events";
const BADGE_IMAGE = {
  width: 1080,
  height: 1620,
  cardX: 30,
  cardY: 30,
  cardWidth: 1020,
  cardHeight: 1560,
  radius: 66
};
const BADGE_HEX = {
  gold: "#baa27a",
  goldSoft: "#f2e6cf",
  goldLine: "#c7ae84",
  navy: "#173d66",
  white: "#ffffff",
  ink: "#2a2c35",
  muted: "#6d7682",
  rule: "#d6c6b2",
  slot: "#2f343b"
};

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
let agrexLogoDataUriPromise;

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

async function loadAgrexLogoDataUri() {
  try {
    if (!agrexLogoDataUriPromise) {
      agrexLogoDataUriPromise = fs
        .readFile(AGREX_LOGO_PATH)
        .then((bytes) => `data:image/jpeg;base64,${bytes.toString("base64")}`);
    }
    return await agrexLogoDataUriPromise;
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

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function normalizeBadgeValue(value) {
  return String(value || "-").replace(/\s+/g, " ").trim() || "-";
}

function shortenText(value, maxChars) {
  const text = normalizeBadgeValue(value);
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 3)).trim()}...`;
}

function fitSvgFontSize(text, options) {
  const { baseSize, minSize, softLimit } = options;
  const value = normalizeBadgeValue(text);
  if (value.length <= softLimit) return baseSize;
  const nextSize = baseSize - (value.length - softLimit) * 1.05;
  return Math.max(minSize, Number(nextSize.toFixed(1)));
}

function svgText(options) {
  const {
    x,
    y,
    text,
    size,
    fill,
    weight = 400,
    anchor = "start",
    letterSpacing = 0,
    opacity = 1
  } = options;

  return `<text x="${x}" y="${y}" fill="${fill}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" letter-spacing="${letterSpacing}" opacity="${opacity}">${escapeXml(text)}</text>`;
}

function svgLine(x1, y1, x2, y2, color, width) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}" />`;
}

function svgBadgeIcon(kind, x, y) {
  const base = `<circle cx="${x}" cy="${y}" r="34" fill="${BADGE_HEX.gold}" />`;

  if (kind === "person") {
    return `${base}
      <circle cx="${x}" cy="${y - 10}" r="9" fill="${BADGE_HEX.white}" />
      <ellipse cx="${x}" cy="${y + 16}" rx="18" ry="13" fill="${BADGE_HEX.white}" />`;
  }

  if (kind === "building") {
    return `${base}
      <rect x="${x - 14}" y="${y - 17}" width="28" height="32" rx="2" fill="${BADGE_HEX.white}" />
      <rect x="${x - 4}" y="${y + 1}" width="8" height="14" fill="${BADGE_HEX.gold}" />
      <line x1="${x - 8}" y1="${y - 8}" x2="${x - 8}" y2="${y + 8}" stroke="${BADGE_HEX.gold}" stroke-width="2" />
      <line x1="${x + 8}" y1="${y - 8}" x2="${x + 8}" y2="${y + 8}" stroke="${BADGE_HEX.gold}" stroke-width="2" />`;
  }

  if (kind === "briefcase") {
    return `${base}
      <rect x="${x - 18}" y="${y - 8}" width="36" height="20" rx="2" fill="${BADGE_HEX.white}" />
      <rect x="${x - 8}" y="${y - 15}" width="16" height="7" rx="2" fill="${BADGE_HEX.white}" />`;
  }

  if (kind === "group") {
    return `${base}
      <circle cx="${x - 10}" cy="${y - 8}" r="7" fill="${BADGE_HEX.white}" />
      <circle cx="${x + 10}" cy="${y - 8}" r="7" fill="${BADGE_HEX.white}" />
      <ellipse cx="${x - 10}" cy="${y + 12}" rx="13" ry="9" fill="${BADGE_HEX.white}" />
      <ellipse cx="${x + 10}" cy="${y + 12}" rx="13" ry="9" fill="${BADGE_HEX.white}" />`;
  }

  if (kind === "calendar") {
    return `${base}
      <rect x="${x - 16}" y="${y - 14}" width="32" height="28" rx="3" fill="${BADGE_HEX.white}" />
      <rect x="${x - 16}" y="${y - 14}" width="32" height="8" fill="${BADGE_HEX.gold}" />
      <line x1="${x - 8}" y1="${y - 22}" x2="${x - 8}" y2="${y - 8}" stroke="${BADGE_HEX.white}" stroke-width="3" />
      <line x1="${x + 8}" y1="${y - 22}" x2="${x + 8}" y2="${y - 8}" stroke="${BADGE_HEX.white}" stroke-width="3" />`;
  }

  return `${base}
    <circle cx="${x}" cy="${y - 5}" r="8" fill="${BADGE_HEX.white}" />
    <path d="M ${x} ${y + 18} L ${x - 12} ${y - 1} Q ${x} ${y + 5} ${x + 12} ${y - 1} Z" fill="${BADGE_HEX.white}" />`;
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

function drawCapsule(page, options) {
  const { x, y, width, height, color } = options;
  const radius = height / 2;
  page.drawRectangle({
    x: x + radius,
    y,
    width: width - radius * 2,
    height,
    color
  });
  page.drawCircle({ x: x + radius, y: y + radius, size: radius, color });
  page.drawCircle({ x: x + width - radius, y: y + radius, size: radius, color });
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

function fitLineText(text, font, options) {
  const { maxWidth, maxSize, minSize = 8.5 } = options;
  const value = String(text || "-").replace(/\s+/g, " ").trim() || "-";
  let size = maxSize;

  while (size > minSize && font.widthOfTextAtSize(value, size) > maxWidth) {
    size -= 0.4;
  }

  if (font.widthOfTextAtSize(value, size) <= maxWidth) {
    return { text: value, size };
  }

  let trimmed = value;
  while (trimmed.length > 3 && font.widthOfTextAtSize(`${trimmed}...`, size) > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }

  return {
    text: `${trimmed}...`,
    size
  };
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
    maxWidth = 226
  } = options;

  const fitted = fitLineText(value, fontBold, {
    maxWidth,
    maxSize: valueSize,
    minSize: 9
  });

  drawIconBadge(page, { x: 42, y: topY - 12, kind: iconKind });

  page.drawText(labelFr, {
    x: 62,
    y: topY,
    size: 7.9,
    font: fontBold,
    color: BADGE.ink
  });
  page.drawText(labelEn, {
    x: 62,
    y: topY - 11,
    size: 6.5,
    font,
    color: BADGE.muted
  });

  page.drawText(fitted.text, {
    x: 62,
    y: topY - 34,
    size: fitted.size,
    font: fontBold,
    color: BADGE.ink
  });

  page.drawLine({
    start: { x: 62, y: topY - 44 },
    end: { x: 302, y: topY - 44 },
    thickness: 0.7,
    color: BADGE.rule
  });

  return topY - 54;
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
  if (status === "sponsor_paid") {
    return { label: "PAYE / PAID", fill: BADGE.navy, text: BADGE.goldSoft };
  }
  if (status === "participant_confirmed") {
    return null;
  }
  return { label: "PROVISOIRE / PROVISIONAL", fill: BADGE.gold, text: BADGE.white };
}

function drawTypeOptions(page, options) {
  const { topY, selected, font, fontBold } = options;

  drawIconBadge(page, { x: 42, y: topY - 12, kind: "group" });

  page.drawText("TYPE DE PARTICIPANT", {
    x: 62,
    y: topY,
    size: 7.9,
    font: fontBold,
    color: BADGE.ink
  });
  page.drawText("TYPE OF PARTICIPANT", {
    x: 62,
    y: topY - 11,
    size: 6.5,
    font,
    color: BADGE.muted
  });

  const items = [
    { id: "delegate", label: "DELEGUE" },
    { id: "sponsor", label: "SPONSOR" },
    { id: "investor", label: "INVESTOR" },
    { id: "other", label: "AUTRE" }
  ];

  const startX = 78;
  const boxY = topY - 26;
  const gap = 56;

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

    drawCenteredText(page, item.label, {
      x: x - 15,
      y: boxY - 12,
      width: 40,
      font: fontBold,
      size: 6,
      color: BADGE.ink
    });
  });

  page.drawLine({
    start: { x: 62, y: topY - 54 },
    end: { x: 302, y: topY - 54 },
    thickness: 0.7,
    color: BADGE.rule
  });

  return topY - 60;
}

function drawBottomInfo(page, options) {
  const { font, fontBold } = options;

  drawIconBadge(page, { x: 42, y: 84, kind: "calendar" });
  page.drawText("DATE", { x: 62, y: 92, size: 7.7, font: fontBold, color: BADGE.ink });
  page.drawText("DATE", { x: 62, y: 81, size: 6.3, font, color: BADGE.muted });
  page.drawText("19-20 OCT 2026", {
    x: 62,
    y: 75,
    size: 8.8,
    font: fontBold,
    color: BADGE.ink
  });

  page.drawLine({
    start: { x: 178, y: 56 },
    end: { x: 178, y: 100 },
    thickness: 0.6,
    color: BADGE.rule
  });

  drawIconBadge(page, { x: 196, y: 84, kind: "pin" });
  page.drawText("LIEU", { x: 218, y: 92, size: 7.7, font: fontBold, color: BADGE.ink });
  page.drawText("VENUE", { x: 218, y: 81, size: 6.3, font, color: BADGE.muted });
  page.drawText("DUBAI WORLD TRADE CENTRE", {
    x: 216,
    y: 75,
    size: 6.3,
    font: fontBold,
    color: BADGE.ink
  });
}

function svgInfoRow(options) {
  const {
    y,
    iconKind,
    labelFr,
    labelEn,
    value,
    baseSize = 44,
    minSize = 31,
    softLimit = 26
  } = options;

  const displayText = shortenText(value, 34);
  const valueSize = fitSvgFontSize(displayText, { baseSize, minSize, softLimit });

  return `
    ${svgBadgeIcon(iconKind, 126, y + 62)}
    ${svgText({ x: 190, y: y + 18, text: labelFr, size: 24, fill: BADGE_HEX.ink, weight: 700 })}
    ${svgText({ x: 190, y: y + 56, text: labelEn, size: 18, fill: BADGE_HEX.muted })}
    ${svgText({ x: 190, y: y + 118, text: displayText, size: valueSize, fill: BADGE_HEX.ink, weight: 700 })}
    ${svgLine(190, y + 152, 900, y + 152, BADGE_HEX.rule, 2)}
  `;
}

function svgTypeOptions(selected) {
  const items = [
    { id: "delegate", label: "DELEGUE", x: 255 },
    { id: "sponsor", label: "SPONSOR", x: 425 },
    { id: "investor", label: "INVESTOR", x: 595 },
    { id: "other", label: "AUTRE", x: 765 }
  ];

  return `
    ${svgBadgeIcon("group", 126, 1186)}
    ${svgText({ x: 190, y: 1142, text: "TYPE DE PARTICIPANT", size: 24, fill: BADGE_HEX.ink, weight: 700 })}
    ${svgText({ x: 190, y: 1180, text: "TYPE OF PARTICIPANT", size: 18, fill: BADGE_HEX.muted })}
    ${items
      .map((item) => {
        const checked = item.id === selected;
        return `
          <rect x="${item.x - 16}" y="1220" width="32" height="32" fill="${BADGE_HEX.white}" stroke="${BADGE_HEX.gold}" stroke-width="4" />
          ${
            checked
              ? `<rect x="${item.x - 8}" y="1228" width="16" height="16" fill="${BADGE_HEX.navy}" />`
              : ""
          }
          ${svgText({ x: item.x, y: 1288, text: item.label, size: 18, fill: BADGE_HEX.ink, weight: 700, anchor: "middle" })}
        `;
      })
      .join("")}
    ${svgLine(190, 1336, 900, 1336, BADGE_HEX.rule, 2)}
  `;
}

function svgDateVenueSection() {
  return `
    ${svgBadgeIcon("calendar", 126, 1424)}
    ${svgText({ x: 190, y: 1388, text: "DATE", size: 24, fill: BADGE_HEX.ink, weight: 700 })}
    ${svgText({ x: 190, y: 1424, text: "DATE", size: 18, fill: BADGE_HEX.muted })}
    ${svgText({ x: 190, y: 1484, text: "19-20 OCT 2026", size: 20, fill: BADGE_HEX.ink, weight: 700 })}
    ${svgLine(540, 1384, 540, 1506, BADGE_HEX.rule, 2)}
    ${svgBadgeIcon("pin", 600, 1424)}
    ${svgText({ x: 666, y: 1388, text: "LIEU", size: 24, fill: BADGE_HEX.ink, weight: 700 })}
    ${svgText({ x: 666, y: 1424, text: "VENUE", size: 18, fill: BADGE_HEX.muted })}
    ${svgText({ x: 666, y: 1484, text: "DUBAI WORLD TRADE CENTRE", size: 19, fill: BADGE_HEX.ink, weight: 700 })}
  `;
}

function badgeBandTextColor(meta) {
  return /GOLD|PLATINUM|BRONZE/.test(meta.bandLabel) ? BADGE_HEX.goldSoft : BADGE_HEX.white;
}

function badgeStatusVisual(status) {
  if (status === "sponsor_paid") {
    return { label: "PAYE / PAID", fill: BADGE_HEX.navy, text: BADGE_HEX.goldSoft };
  }
  if (status === "participant_confirmed") {
    return null;
  }
  return { label: "PROVISOIRE / PROVISIONAL", fill: BADGE_HEX.gold, text: BADGE_HEX.white };
}

async function createBadgeImage({ kind, status, firstName, lastName, company, jobTitle, profile, code, sponsorPackageId }) {
  const logoDataUri = await loadAgrexLogoDataUri();
  const meta = roleMeta({ kind, profile, sponsorPackageId });
  const statusPill = badgeStatusVisual(status);
  const bandTextColor = badgeBandTextColor(meta);
  const logoMarkup = logoDataUri
    ? `<image href="${logoDataUri}" x="342" y="326" width="396" height="126" preserveAspectRatio="xMidYMid meet" />`
    : svgText({ x: 540, y: 388, text: "AGREX", size: 58, fill: BADGE_HEX.navy, weight: 700, anchor: "middle" });

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${BADGE_IMAGE.width}" height="${BADGE_IMAGE.height}" viewBox="0 0 ${BADGE_IMAGE.width} ${BADGE_IMAGE.height}">
      <rect width="1080" height="1620" fill="${BADGE_HEX.white}" />
      <rect x="${BADGE_IMAGE.cardX}" y="${BADGE_IMAGE.cardY}" width="${BADGE_IMAGE.cardWidth}" height="${BADGE_IMAGE.cardHeight}" rx="${BADGE_IMAGE.radius}" fill="${BADGE_HEX.white}" stroke="${BADGE_HEX.goldLine}" stroke-width="4" />
      <rect x="30" y="30" width="1020" height="360" rx="66" fill="${BADGE_HEX.gold}" />
      <ellipse cx="540" cy="402" rx="510" ry="120" fill="${BADGE_HEX.white}" />
      <rect x="474" y="52" width="132" height="42" rx="21" fill="${BADGE_HEX.slot}" />
      <rect x="292" y="300" width="496" height="176" rx="36" fill="${BADGE_HEX.white}" stroke="${BADGE_HEX.goldSoft}" stroke-width="3" />
      ${logoMarkup}
      ${svgLine(105, 588, 975, 588, BADGE_HEX.rule, 3)}
      ${svgText({ x: 105, y: 548, text: `REF. ${code}`, size: 26, fill: BADGE_HEX.muted })}
      ${
        statusPill
          ? `
            <rect x="675" y="520" width="300" height="52" rx="26" fill="${statusPill.fill}" />
            ${svgText({ x: 825, y: 555, text: statusPill.label, size: 23, fill: statusPill.text, weight: 700, anchor: "middle" })}
          `
          : ""
      }
      ${svgInfoRow({
        y: 628,
        iconKind: "person",
        labelFr: "NOM ET PRENOM",
        labelEn: "FULL NAME",
        value: `${firstName} ${lastName}`,
        baseSize: 56,
        minSize: 40,
        softLimit: 20
      })}
      ${svgInfoRow({
        y: 786,
        iconKind: "building",
        labelFr: "COMPANY / ORGANISATION",
        labelEn: "COMPANY / ORGANISATION",
        value: company,
        baseSize: 46,
        minSize: 32,
        softLimit: 24
      })}
      ${svgInfoRow({
        y: 944,
        iconKind: "briefcase",
        labelFr: "FONCTION",
        labelEn: "JOB TITLE",
        value: jobTitle,
        baseSize: 46,
        minSize: 32,
        softLimit: 24
      })}
      ${svgTypeOptions(meta.typeChoice)}
      ${svgDateVenueSection()}
      <rect x="30" y="1445" width="1020" height="78" fill="${BADGE_HEX.gold}" />
      ${svgText({ x: 540, y: 1496, text: `${EVENT.website}  |  ${CONTACT_EMAIL}`, size: 28, fill: BADGE_HEX.white, anchor: "middle" })}
      <path d="M 30 1535 h 1020 v 75 h -1020 z" fill="${BADGE_HEX.navy}" />
      <circle cx="96" cy="1572" r="56" fill="${BADGE_HEX.navy}" />
      <circle cx="984" cy="1572" r="56" fill="${BADGE_HEX.navy}" />
      ${svgLine(82, 1578, 192, 1578, BADGE_HEX.goldSoft, 3)}
      ${svgLine(888, 1578, 998, 1578, BADGE_HEX.goldSoft, 3)}
      ${svgText({ x: 540, y: 1614, text: meta.bandLabel, size: meta.bandLabel.length > 16 ? 34 : 40, fill: bandTextColor, weight: 700, anchor: "middle" })}
    </svg>
  `;

  return Buffer.from(svg.trim(), "utf8");
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
  createBadgeImage,
  createSponsorContractPdf
};
