/**
 * PD-SAAS-FORK: Admin-only middleware.
 */
export function requireAdmin(req, res, next) {
  const role = req.user?.role;
  if (role === 'super-admin' || role === 'admin') {
    return next();
  }
  return res.status(403).json({ error: 'Admin access required' });
}
