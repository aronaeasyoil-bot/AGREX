const { allowMethods, sendJson } = require("./_lib/http");
const { listRecords, getStorageMode } = require("./_lib/storage");
const { isEmailConfigured } = require("./_lib/email");

function getToken(req) {
  return (
    req.headers["x-admin-token"] ||
    (req.query && req.query.token) ||
    ""
  );
}

function requireToken(req, res) {
  if (!process.env.ADMIN_ACCESS_TOKEN) {
    sendJson(res, 503, { ok: false, error: "ADMIN_ACCESS_TOKEN is not configured" });
    return false;
  }

  if (getToken(req) !== process.env.ADMIN_ACCESS_TOKEN) {
    sendJson(res, 401, { ok: false, error: "Invalid admin token" });
    return false;
  }

  return true;
}

function toCsv(rows, columns) {
  const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  return [columns.join(","), ...rows.map((row) => columns.map((col) => escape(row[col])).join(","))].join("\n");
}

module.exports = async (req, res) => {
  if (!allowMethods(req, res, ["GET"])) return;
  if (!requireToken(req, res)) return;

  try {
    const data = await listRecords();

    if (req.query && req.query.format === "csv") {
      const type = req.query.type || "participants";
      const participants = data.participants.map((item) => ({
        code: item.code,
        firstName: item.firstName,
        lastName: item.lastName,
        organization: item.organization,
        jobTitle: item.jobTitle,
        profile: item.profile,
        email: item.email,
        phone: item.phone,
        country: item.country,
        status: item.status,
        createdAt: item.createdAt
      }));
      const sponsors = data.sponsors
        .filter((item) => (type === "sponsors-paid" ? item.status === "sponsor_paid" : true))
        .map((item) => ({
          code: item.code,
          firstName: item.firstName,
          lastName: item.lastName,
          company: item.company,
          jobTitle: item.jobTitle,
          packageLabel: item.packageLabel,
          amountEur: item.amountEur,
          email: item.email,
          phone: item.phone,
          country: item.country,
          status: item.status,
          createdAt: item.createdAt
        }));

      const rows = type.startsWith("sponsor") ? sponsors : participants;
      const columns = rows[0] ? Object.keys(rows[0]) : [];
      const csv = toCsv(rows, columns);
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${type}.csv"`);
      res.end(csv);
      return;
    }

    sendJson(res, 200, {
      ok: true,
      data,
      meta: {
        storageMode: getStorageMode(),
        emailConfigured: isEmailConfigured()
      }
    });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message || "Unable to load records" });
  }
};
