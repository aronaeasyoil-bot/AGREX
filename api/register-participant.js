const crypto = require("node:crypto");
const { allowMethods, readRequestBody, sendJson } = require("./_lib/http");
const { normalizeParticipant } = require("./_lib/validation");
const { makeCode, createBadgeImage } = require("./_lib/documents");
const { saveParticipant, getStorageMode } = require("./_lib/storage");
const { sendParticipantEmail } = require("./_lib/email");

module.exports = async (req, res) => {
  if (!allowMethods(req, res, ["POST"])) return;

  try {
    const body = await readRequestBody(req);
    const data = normalizeParticipant(body);
    const record = {
      id: crypto.randomUUID(),
      kind: "participant",
      status: "participant_confirmed",
      code: makeCode("P"),
      createdAt: new Date().toISOString(),
      ...data
    };

    await saveParticipant(record);
    const badgeBuffer = await createBadgeImage({
      kind: "participant",
      status: record.status,
      firstName: record.firstName,
      lastName: record.lastName,
      company: record.organization,
      jobTitle: record.jobTitle,
      profile: record.profile,
      code: record.code,
      lang: record.lang
    });

    const emailResult = await sendParticipantEmail(record, badgeBuffer);
    const message =
      record.lang === "en"
        ? emailResult.sent
          ? "Registration recorded. The digital badge has been generated and sent by email."
          : "Registration recorded. The digital badge has been generated. Email delivery will start once the mail service is activated."
        : emailResult.sent
          ? "Inscription enregistree. Le badge numerique a ete genere et envoye par email."
          : "Inscription enregistree. Le badge numerique a ete genere. L'envoi email demarrera des que le service mail sera active.";

    sendJson(res, 200, {
      ok: true,
      message,
      record: {
        id: record.id,
        code: record.code,
        status: record.status
      },
      badge: {
        fileName: `${record.code}-badge-participant.svg`,
        mimeType: "image/svg+xml",
        base64: badgeBuffer.toString("base64")
      },
      email: emailResult,
      storageMode: getStorageMode()
    });
  } catch (error) {
    sendJson(res, 400, {
      ok: false,
      error: error.message || "Participant registration failed"
    });
  }
};
