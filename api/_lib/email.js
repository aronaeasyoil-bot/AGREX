const nodemailer = require("nodemailer");
const { Resend } = require("resend");
const { EVENT, getOrganizerEmails, getSponsorPackage } = require("./agrex-config");

function isEmailConfigured() {
  return Boolean(
    process.env.RESEND_API_KEY ||
      (
        process.env.SMTP_HOST &&
        process.env.SMTP_PORT &&
        process.env.SMTP_USER &&
        process.env.SMTP_PASS &&
        process.env.SMTP_FROM
      )
  );
}

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

function getFromAddress() {
  return process.env.EMAIL_FROM || process.env.SMTP_FROM || "AGREX 2026 <contact@agrex.events>";
}

function buildAttachment(filename, buffer, contentType = "application/octet-stream") {
  return {
    filename,
    content: buffer.toString("base64"),
    contentType
  };
}

async function sendWithConfiguredProvider({ to, cc, subject, html, attachments }) {
  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const response = await resend.emails.send({
      from: getFromAddress(),
      to: Array.isArray(to) ? to : [to],
      cc: Array.isArray(cc) ? cc : String(cc || "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean),
      subject,
      html,
      attachments: attachments || []
    });

    if (response.error) {
      throw new Error(response.error.message || "Resend delivery failed");
    }

    return { sent: true, provider: "resend", id: response.data?.id || null };
  }

  const transporter = createTransporter();
  await transporter.sendMail({
    from: getFromAddress(),
    to,
    cc,
    subject,
    html,
    attachments: (attachments || []).map((item) => ({
      filename: item.filename,
      content: Buffer.from(item.content, "base64"),
      contentType: item.contentType
    }))
  });

  return { sent: true, provider: "smtp" };
}

function detailRow(label, value) {
  return `<li><strong>${label}:</strong> ${value || "-"}</li>`;
}

async function sendParticipantEmail(record, badgeBuffer) {
  if (!isEmailConfigured()) {
    return { sent: false, reason: "email_not_configured" };
  }

  const badgeFilename = `${record.code}-badge-participant.svg`;
  const organizers = getOrganizerEmails();

  return sendWithConfiguredProvider({
    to: record.email,
    cc: organizers.join(", "),
    subject:
      record.lang === "en"
        ? `AGREX 2026 - participant badge - ${record.code}`
        : `AGREX 2026 - badge participant - ${record.code}`,
    html: `
      ${
        record.lang === "en"
          ? `<p>Hello ${record.firstName} ${record.lastName},</p>
      <p>Your free registration for AGREX 2026 has been recorded successfully.</p>
      <p>Your digital participant badge image is attached to this email.</p>
      <p><strong>File reference:</strong> ${record.code}</p>`
          : `<p>Bonjour ${record.firstName} ${record.lastName},</p>
      <p>Votre inscription gratuite a AGREX 2026 a bien ete enregistree.</p>
      <p>Vous trouverez votre badge numerique participant en image jointe.</p>
      <p><strong>Code dossier:</strong> ${record.code}</p>`
      }
      <p>${EVENT.name}<br/>${record.lang === "en" ? EVENT.dateEn : EVENT.dateFr}<br/>${EVENT.venue}</p>
      <hr />
      <p><strong>${record.lang === "en" ? "Registration details" : "Details de l'inscription"}</strong></p>
      <ul>
        ${detailRow(record.lang === "en" ? "First name" : "Prenom", record.firstName)}
        ${detailRow(record.lang === "en" ? "Last name" : "Nom", record.lastName)}
        ${detailRow(record.lang === "en" ? "Company" : "Organisation", record.organization)}
        ${detailRow(record.lang === "en" ? "Job title" : "Fonction", record.jobTitle)}
        ${detailRow(record.lang === "en" ? "Profile" : "Profil", record.profile)}
        ${detailRow(record.lang === "en" ? "Country" : "Pays", record.country)}
        ${detailRow("Email", record.email)}
        ${detailRow(record.lang === "en" ? "Phone" : "Telephone", record.phone)}
        ${detailRow(record.lang === "en" ? "Interest" : "Interet", record.interest)}
      </ul>
    `,
    attachments: [buildAttachment(badgeFilename, badgeBuffer, "image/svg+xml")]
  });
}

async function sendSponsorPendingEmail(record, badgeBuffer, contractBuffer) {
  if (!isEmailConfigured()) {
    return { sent: false, reason: "email_not_configured" };
  }

  const pack = getSponsorPackage(record.sponsorPackageId);
  const organizers = getOrganizerEmails();

  return sendWithConfiguredProvider({
    to: record.email,
    cc: organizers.join(", "),
    subject:
      record.lang === "en"
        ? `AGREX 2026 - sponsor file - ${record.code}`
        : `AGREX 2026 - dossier sponsor - ${record.code}`,
    html: `
      ${
        record.lang === "en"
          ? `<p>Hello ${record.firstName} ${record.lastName},</p>
      <p>Your AGREX 2026 sponsor registration has been recorded successfully.</p>
      <p><strong>Package:</strong> ${pack.labelEn}</p>
      <p><strong>Amount due:</strong> ${pack.amountEur.toLocaleString("fr-FR")} EUR</p>
      <p>Your sponsorship contract and provisional digital badge image are attached.</p>
      <p>The physical sponsor badge will be printed once payment has been confirmed by the organiser.</p>`
          : `<p>Bonjour ${record.firstName} ${record.lastName},</p>
      <p>Votre dossier sponsor AGREX 2026 a bien ete enregistre.</p>
      <p><strong>Formule:</strong> ${pack.labelFr}</p>
      <p><strong>Montant:</strong> ${pack.amountEur.toLocaleString("fr-FR")} EUR</p>
      <p>Vous trouverez en pieces jointes votre contrat et votre badge numerique provisoire en image.</p>
      <p>Le badge physique sera imprime apres confirmation du paiement par l'organisateur.</p>`
      }
      <hr />
      <p><strong>${record.lang === "en" ? "Sponsor details" : "Details du sponsor"}</strong></p>
      <ul>
        ${detailRow(record.lang === "en" ? "First name" : "Prenom", record.firstName)}
        ${detailRow(record.lang === "en" ? "Last name" : "Nom", record.lastName)}
        ${detailRow(record.lang === "en" ? "Company" : "Societe", record.company)}
        ${detailRow(record.lang === "en" ? "Job title" : "Fonction", record.jobTitle)}
        ${detailRow(record.lang === "en" ? "Country" : "Pays", record.country)}
        ${detailRow("Email", record.email)}
        ${detailRow(record.lang === "en" ? "Phone" : "Telephone", record.phone)}
        ${detailRow(record.lang === "en" ? "Website" : "Site web", record.website)}
        ${detailRow(record.lang === "en" ? "Package" : "Formule", record.lang === "en" ? pack.labelEn : pack.labelFr)}
        ${detailRow(record.lang === "en" ? "Message" : "Message", record.message)}
      </ul>
    `,
    attachments: [
      buildAttachment(`${record.code}-badge-sponsor-provisoire.svg`, badgeBuffer, "image/svg+xml"),
      buildAttachment(`${record.code}-contrat-sponsor.pdf`, contractBuffer, "application/pdf")
    ]
  });
}

async function sendSponsorConfirmedEmail(record, badgeBuffer) {
  if (!isEmailConfigured()) {
    return { sent: false, reason: "email_not_configured" };
  }

  const organizers = getOrganizerEmails();

  return sendWithConfiguredProvider({
    to: record.email,
    cc: organizers.join(", "),
    subject:
      record.lang === "en"
        ? `AGREX 2026 - sponsor payment confirmed - ${record.code}`
        : `AGREX 2026 - paiement sponsor confirme - ${record.code}`,
    html: `
      ${
        record.lang === "en"
          ? `<p>Hello ${record.firstName} ${record.lastName},</p>
      <p>Your AGREX 2026 sponsor payment has been confirmed by the organiser.</p>
      <p>Your final sponsor digital badge image is attached.</p>
      <p>Your physical badge can now be produced for the forum.</p>`
          : `<p>Bonjour ${record.firstName} ${record.lastName},</p>
      <p>Le paiement de votre dossier sponsor AGREX 2026 a ete confirme par l'organisateur.</p>
      <p>Vous trouverez ci-joint votre badge numerique sponsor confirme en image.</p>
      <p>Le badge physique pourra etre imprime pour le jour du forum.</p>`
      }
    `,
    attachments: [buildAttachment(`${record.code}-badge-sponsor-confirme.svg`, badgeBuffer, "image/svg+xml")]
  });
}

module.exports = {
  isEmailConfigured,
  sendParticipantEmail,
  sendSponsorPendingEmail,
  sendSponsorConfirmedEmail
};
