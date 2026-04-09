/**
 * Lista de administradores (misma fuente que licencias web).
 */
function getAdminEmails() {
  const raw = process.env.LICENSE_ADMIN_EMAILS || '';
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {boolean}
 */
function assertLicenseAdmin(req, res) {
  const email = req.user?.email?.toLowerCase();
  const admins = getAdminEmails();
  if (!email || admins.length === 0 || !admins.includes(email)) {
    res.status(403).json({ error: 'Solo administradores' });
    return false;
  }
  return true;
}

/**
 * @param {{ email?: string } | null | undefined} user
 * @returns {boolean}
 */
function isLicenseAdminUser(user) {
  const email = user?.email?.toLowerCase();
  const admins = getAdminEmails();
  return Boolean(email && admins.length > 0 && admins.includes(email));
}

module.exports = {
  getAdminEmails,
  assertLicenseAdmin,
  isLicenseAdminUser,
};
