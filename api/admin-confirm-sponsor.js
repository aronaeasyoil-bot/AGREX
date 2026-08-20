const { allowMethods, readRequestBody, sendJson } = require("./_lib/http");
const { getSponsorById, updateSponsor, getStorageMode } = require("./_lib/storage");
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
    const emailResult = await sendSponsorConfirmedEmail(updated);

    sendJson(res, 200, {
      ok: true,
      message:
        updated.lang === "en"
          ? emailResult.sent
            ? "Sponsor payment confirmed. A confirmation email has been sent."
            : "Sponsor payment confirmed. Email delivery will start once the mail service is activated."
          : emailResult.sent
            ? "Paiement sponsor confirme. Un email de confirmation a ete envoye."
            : "Paiement sponsor confirme. L'envoi email demarrera des que le service mail sera active.",
      record: updated,
      email: emailResult,
      storageMode: getStorageMode()
    });
  } catch (error) {
    sendJson(res, 400, { ok: false, error: error.message || "Unable to confirm sponsor payment" });
  }
};
