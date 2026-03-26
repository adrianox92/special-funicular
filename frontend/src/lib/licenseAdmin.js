/**
 * Emails con permiso de admin de licencias (debe coincidir con LICENSE_ADMIN_EMAILS en el servidor).
 */
export function parseLicenseAdminEmails() {
  return (process.env.REACT_APP_LICENSE_ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isLicenseAdminUser(user) {
  const admins = parseLicenseAdminEmails();
  const e = user?.email?.toLowerCase();
  return Boolean(e && admins.length > 0 && admins.includes(e));
}
