const crypto = require("node:crypto");
const { allowMethods, readRequestBody, sendJson } = require("./_lib/http");
const { normalizeSponsor } = require("./_lib/validation");
const { makeCode, createSponsorContractPdf } = require("./_lib/documents");
const { saveSponsor, getStorageMode } = require("./_lib/storage");
const { sendSponsorPendingEmail } = require("./_lib/email");
const { getSponsorPackage } = require("./_lib/agrex-config");

module.exports = async (req, res) => {
  if (!allowMethods(req, res, ["POST"])) return;

  try {
    const body = await readRequestBody(req);
    const data = normalizeSponsor(body);
    const sponsorPackage = getSponsorPackage(data.sponsorPackageId);
    const record = {
      id: crypto.randomUUID(),
      kind: "sponsor",
      status: "sponsor_pending_payment",
      code: makeCode("S"),
      createdAt: new Date().toISOString(),
      amountEur: sponsorPackage.amountEur,
      packageLabel: data.lang === "en" ? sponsorPackage.labelEn : sponsorPackage.labelFr,
      packageBenefits: data.lang === "en" ? sponsorPackage.benefitsEn : sponsorPackage.benefitsFr,
      ...data
    };

    await saveSponsor(record);
    const contractBuffer = await createSponsorContractPdf({ sponsor: record, lang: record.lang });
    const emailResult = await sendSponsorPendingEmail(record, contractBuffer);

    const message =
      record.lang === "en"
        ? emailResult.sent
          ? "Sponsor file recorded. The contract has been generated and sent by email."
          : "Sponsor file recorded. The contract has been generated. Email delivery will start once the mail service is activated."
        : emailResult.sent
          ? "Dossier sponsor enregistre. Le contrat a ete genere et envoye par email."
          : "Dossier sponsor enregistre. Le contrat a ete genere. L'envoi email demarrera des que le service mail sera active.";

    sendJson(res, 200, {
      ok: true,
      message,
      record: {
        id: record.id,
        code: record.code,
        status: record.status,
        amountEur: record.amountEur
      },
      contract: {
        fileName: `${record.code}-contrat-sponsor.pdf`,
        mimeType: "application/pdf",
        base64: contractBuffer.toString("base64")
      },
      email: emailResult,
      storageMode: getStorageMode()
    });
  } catch (error) {
    sendJson(res, 400, {
      ok: false,
      error: error.message || "Sponsor registration failed"
    });
  }
};
