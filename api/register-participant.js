const crypto = require("node:crypto");
const { allowMethods, readRequestBody, sendJson } = require("./_lib/http");
const { normalizeParticipant } = require("./_lib/validation");
const { makeCode } = require("./_lib/documents");
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
    const emailResult = await sendParticipantEmail(record);
    const message =
      record.lang === "en"
        ? emailResult.sent
          ? "Registration recorded. A confirmation email has been sent."
          : "Registration recorded. Email delivery will start once the mail service is activated."
        : emailResult.sent
          ? "Inscription enregistree. Un email de confirmation a ete envoye."
          : "Inscription enregistree. L'envoi email demarrera des que le service mail sera active.";

    sendJson(res, 200, {
      ok: true,
      message,
      record: {
        id: record.id,
        code: record.code,
        status: record.status
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
