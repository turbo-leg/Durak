/** Client expiry check only. The server still verifies the signature and identity. */
export function isSessionTokenCurrent(token: string, now = Date.now()): boolean {
  try {
    const payload = token.split('.')[1];
    if (!payload) return false;
    const claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof claims.exp === 'number' && Number.isFinite(claims.exp) && claims.exp * 1000 > now;
  } catch {
    return false;
  }
}
