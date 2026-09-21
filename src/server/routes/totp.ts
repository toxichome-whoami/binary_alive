import { Hono } from 'hono';
import { setTotpSecret, getUserById } from '../db/users.js';
import { logAudit } from '../db/logs.js';
import { TotpService } from '../lib/totp.js';
import { encryptData, decryptData, verifyPassword } from '../lib/crypto.js';
import { requireAuth } from '../middleware/auth.js';
import { broadcastUsersRefresh } from '../websocket.js';

export const totpRouter = new Hono();

totpRouter.use('*', requireAuth());

// Generate 2FA setup secret and barcode URL
totpRouter.get('/setup', async (c) => {
  const currentUser = c.get('user');
  const user = await getUserById(currentUser.id);
  
  if (user && user.totp_secret) {
    return c.json({ success: false, message: '2FA is already enabled' }, 400);
  }

  const secret = TotpService.generateSecret();
  const otpauth_url = TotpService.getOtpAuthUrl(user ? user.username : currentUser.username, secret);

  return c.json({
    success: true,
    data: {
      secret,
      otpauth_url,
    },
  });
});

// Enable 2FA after code verification
totpRouter.post('/enable', async (c) => {
  const user = c.get('user');
  
  if (user.totp_secret) {
    return c.json({ success: false, message: '2FA is already enabled. You must disable it first.' }, 403);
  }

  const { secret, code } = await c.req.json();

  if (!secret || !code) {
    return c.json({ success: false, message: 'Secret and verification code are required' }, 400);
  }

  const isValid = TotpService.verifyCode(secret, code.trim());
  if (!isValid) {
    return c.json({ success: false, message: 'Invalid 2FA code. Please verify your system clock and code.' }, 400);
  }

  const encrypted = encryptData(secret);
  await setTotpSecret(user.id, encrypted);
  await logAudit(user.id, user.username, 'enable_2fa', 'Two-Factor Authentication enabled');
  broadcastUsersRefresh();

  return c.json({ success: true, message: '2FA enabled successfully!' });
});

// Disable own 2FA (requires current password and 2FA token confirmation)
totpRouter.post('/disable', async (c) => {
  const currentUser = c.get('user');
  const { password, token } = await c.req.json();

  const user = await getUserById(currentUser.id);
  if (!user) {
    return c.json({ success: false, message: 'User not found' }, 404);
  }

  const match = await verifyPassword(password, user.password_hash);
  if (!match) {
    return c.json({ success: false, message: 'Incorrect password.' }, 401);
  }

  if (user.totp_secret) {
    if (!token) {
      return c.json({ success: false, message: 'Current 2FA code is required to disable 2FA.' }, 400);
    }
    const secret = decryptData(user.totp_secret);
    if (!TotpService.verifyCode(secret, token)) {
      return c.json({ success: false, message: 'Invalid 2FA code.' }, 401);
    }
  }

  await setTotpSecret(user.id, null);
  await logAudit(user.id, user.username, 'disable_2fa', 'Two-Factor Authentication disabled');
  broadcastUsersRefresh();

  return c.json({ success: true, message: '2FA disabled.' });
});
