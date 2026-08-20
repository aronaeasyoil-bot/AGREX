const { allowMethods, readRequestBody, sendJson } = require("./_lib/http");
const { getSponsorById, updateSponsor, getStorageMode } = require("./_lib/storage");
const { createBadgePdf } = require("./_lib/documents");
const { sendSponsorConfirmedEmail } = require("./_lib/email");

function requireToken(req, res) {
  const token =
    req.headers["x-admin-token"] ||
    (req.query && req.query.token) ||
    "";

  if (!process.env.ADMIN_ACCESS_TOKEN) {
    sendJson(res, 503, { ok: false, error: "ADMIN_ACCESS_TOKEN is not configured" });
    return false;
  }

  if (token !== process.env.ADMIN_ACCESS_TOKEN) {
    sendJson(res, 401, { ok: false, error: "Invalid admin token" });
    return false;
  }

  return true;
}

module.exports = async (req, res) => {
  if (!allowMethods(req, res, ["POST"])) return;
  if (!requireToken(req, res)) return;

  try {
    const body = await readRequestBody(req);
    const sponsorId = String(body.id || "").trim();
    if (!sponsorId) {
      throw new Error("Sponsor id is required");
    }

    const sponsor = await getSponsorById(sponsorId);
    if (!sponsor) {
      throw new Error("Sponsor not found");
    }

    const updated = {
      ...sponsor,
      status: "sponsor_paid",
      paymentConfirmedAt: new Date().toISOString()
    };

    await updateSponsor(updated);

    const badgeBuffer = await createBadgePdf({
      kind: "sponsor",
      status: updated.status,
      firstName: updated.firstName,
      lastName: updated.lastName,
      company: updated.company,
      jobTitle: updated.jobTitle,
      profile: updated.packageLabel,
      code: updated.code,
      sponsorPackageId: updated.sponsorPackageId,
      lang: updated.lang
    });

    const emailResult = await sendSponsorConfirmedEmail(updated, badgeBuffer);

    sendJson(res, 200, {
      ok: true,
      message:
        updated.lang === "en"
          ? emailResult.sent
            ? "Sponsor payment confirmed. The final badge has been regenerated and sent."
            : "Sponsor payment confirmed. The final badge has been regenerated. Email delivery is waiting for SMTP configuration."
          : emailResult.sent
            ? "Paiement sponsor confirme. Le badge final a ete regenere et envoye."
            : "Paiement sponsor confirme. Le badge final a ete regenere. L'envoi email attend la configuration SMTP.",
      record: updated,
      badge: {
        fileName: `${updated.code}-badge-sponsor-confirme.pdf`,
        mimeType: "application/pdf",
        base64: badgeBuffer.toString("base64")
      },
      email: emailResult,
      storageMode: getStorageMode()
    });
  } catch (error) {
    sendJson(res, 400, { ok: false, error: error.message || "Unable to confirm sponsor payment" });
  }
};
