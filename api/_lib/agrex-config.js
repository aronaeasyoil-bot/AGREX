const EVENT = {
  name: "AGREX 2026 - Africa Gulf Real Estate Expo",
  dateFr: "19-20 octobre 2026",
  dateEn: "19-20 October 2026",
  venue: "Dubai World Trade Centre, Dubai, UAE",
  website: "www.agrex.events"
};

const DEFAULT_ORGANIZER_EMAILS = [
  "contact@agrex.events",
  "contact@lebrief.energy",
  "psgueye1@gmail.com"
];

const SPONSOR_PACKAGES = {
  platinum: {
    id: "platinum",
    labelFr: "Platinum Sponsor",
    labelEn: "Platinum Sponsor",
    amountEur: 35000,
    theme: "gold",
    benefitsFr: [
      "Statut de partenaire principal",
      "Prise de parole (10 min) a la ceremonie d'ouverture",
      "Emplacement premium (stand 6x3 m)",
      "Visibilite logo maximale sur supports et medias",
      "Interview exclusive et mise en avant prioritaire"
    ],
    benefitsEn: [
      "Main partner status",
      "10-minute speaking slot at the opening ceremony",
      "Premium location (6x3 m stand)",
      "Maximum logo visibility across media and event support",
      "Exclusive interview and priority featuring"
    ]
  },
  gold: {
    id: "gold",
    labelFr: "Gold Sponsor",
    labelEn: "Gold Sponsor",
    amountEur: 25000,
    theme: "gold",
    benefitsFr: [
      "Statut de partenaire officiel",
      "Emplacement premium (stand 4x3 m)",
      "Visibilite logo renforcee sur supports et ecran LED",
      "Mention dans les discours officiels",
      "Acces VIP au networking et aux conferences"
    ],
    benefitsEn: [
      "Official partner status",
      "Premium location (4x3 m stand)",
      "Enhanced logo visibility across support material and LED screen",
      "Mention in official speeches",
      "VIP access to networking and conferences"
    ]
  },
  silver: {
    id: "silver",
    labelFr: "Silver Sponsor",
    labelEn: "Silver Sponsor",
    amountEur: 15000,
    theme: "gold",
    benefitsFr: [
      "Emplacement privilegie (stand 3x2 m)",
      "Visibilite logo sur supports imprimes et digitaux",
      "Mention sur le site web et les reseaux sociaux",
      "Acces aux conferences et au networking VIP"
    ],
    benefitsEn: [
      "Preferred location (3x2 m stand)",
      "Logo visibility across printed and digital material",
      "Mention on the website and social media",
      "Access to conferences and VIP networking"
    ]
  },
  bronze: {
    id: "bronze",
    labelFr: "Bronze Sponsor",
    labelEn: "Bronze Sponsor",
    amountEur: 10000,
    theme: "gold",
    benefitsFr: [
      "Stand standard (2x2 m)",
      "Listing logo sur le site web de l'evenement",
      "Mention sur les reseaux sociaux",
      "Acces au salon et aux sessions de networking"
    ],
    benefitsEn: [
      "Standard stand (2x2 m)",
      "Logo listing on the event website",
      "Mention on social media",
      "Access to the expo and networking sessions"
    ]
  },
  "simple-registration": {
    id: "simple-registration",
    labelFr: "Inscription simple",
    labelEn: "Simple Registration",
    amountEur: 500,
    theme: "standard",
    benefitsFr: [
      "Inscription simple pour 1 participant",
      "Acces au forum AGREX",
      "Acces aux sessions de networking"
    ],
    benefitsEn: [
      "Simple registration for 1 participant",
      "Access to the AGREX forum",
      "Access to networking sessions"
    ]
  }
};

function getOrganizerEmails() {
  const raw = process.env.ORGANIZER_EMAILS;
  if (!raw) return DEFAULT_ORGANIZER_EMAILS;
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function getSponsorPackage(packageId) {
  return SPONSOR_PACKAGES[packageId] || null;
}

module.exports = {
  EVENT,
  SPONSOR_PACKAGES,
  DEFAULT_ORGANIZER_EMAILS,
  getOrganizerEmails,
  getSponsorPackage
};
