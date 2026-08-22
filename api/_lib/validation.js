const { getSponsorPackage } = require("./agrex-config");

function normalizeString(value) {
  return String(value || "").trim();
}

function assertRequired(value, label) {
  if (!normalizeString(value)) {
    throw new Error(`${label} is required`);
  }
}

function validateEmail(value) {
  const email = normalizeString(value).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Valid email is required");
  }
  return email;
}

function normalizeParticipant(payload) {
  assertRequired(payload.firstName, "First name");
  assertRequired(payload.lastName, "Last name");
  assertRequired(payload.organization, "Company");
  assertRequired(payload.jobTitle, "Job title");
  assertRequired(payload.country, "Country");

  const lang = normalizeString(payload.lang) === "en" ? "en" : "fr";
  const defaultProfile = lang === "en" ? "Free Visitor Pass" : "Pass Visiteur Gratuit";

  return {
    firstName: normalizeString(payload.firstName),
    lastName: normalizeString(payload.lastName),
    organization: normalizeString(payload.organization),
    jobTitle: normalizeString(payload.jobTitle),
    profile: normalizeString(payload.profile) || defaultProfile,
    country: normalizeString(payload.country),
    email: validateEmail(payload.email),
    phone: normalizeString(payload.phone),
    interest: normalizeString(payload.interest),
    lang
  };
}

function normalizeSponsor(payload) {
  assertRequired(payload.firstName, "First name");
  assertRequired(payload.lastName, "Last name");
  assertRequired(payload.company, "Company");
  assertRequired(payload.jobTitle, "Job title");
  assertRequired(payload.country, "Country");
  assertRequired(payload.sponsorPackageId, "Sponsor package");

  const sponsorPackage = getSponsorPackage(normalizeString(payload.sponsorPackageId));
  if (!sponsorPackage) {
    throw new Error("Unknown sponsor package");
  }

  return {
    firstName: normalizeString(payload.firstName),
    lastName: normalizeString(payload.lastName),
    company: normalizeString(payload.company),
    jobTitle: normalizeString(payload.jobTitle),
    country: normalizeString(payload.country),
    email: validateEmail(payload.email),
    phone: normalizeString(payload.phone),
    website: normalizeString(payload.website),
    message: normalizeString(payload.message),
    sponsorPackageId: sponsorPackage.id,
    lang: normalizeString(payload.lang) === "en" ? "en" : "fr"
  };
}

module.exports = {
  normalizeParticipant,
  normalizeSponsor
};
