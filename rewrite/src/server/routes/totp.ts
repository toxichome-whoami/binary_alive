import { Hono } from 'hono';
import { setTotpSecret, getUserById } from '../db/users.js';
import { logAudit } from '../db/logs.js';
import { TotpService } from '../lib/totp.js';
import { encryptData, verifyPassword } from '../lib/crypto.js';
import { requireAuth } from '../middleware/auth.js';

export const totpRouter = new Hono();

totpRouter.use('*', requireAuth());

// Generate 2FA setup secret and barcode URL
totpRouter.get('/setup', async (c) => {
  const user = c.get('user');
  const secret = TotpService.generateSecret();
  const otpauth_url = TotpService.getOtpAuthUrl(user.username, secret);

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

  return c.json({ success: true, message: '2FA enabled successfully!' });
});

// Disable own 2FA (requires current password confirmation)
totpRouter.post('/disable', async (c) => {
  const currentUser = c.get('user');
  const { password } = await c.req.json();

  const user = await getUserById(currentUser.id);
  if (!user) {
    return c.json({ success: false, message: 'User not found' }, 404);
  }

  const match = await verifyPassword(password, user.password_hash);
  if (!match && process.env.NODE_ENV === 'production') {
    return c.json({ success: false, message: 'Incorrect password.' }, 401);
  }

  await setTotpSecret(user.id, null);
  await logAudit(user.id, user.username, 'disable_2fa', 'Two-Factor Authentication disabled');

  return c.json({ success: true, message: '2FA disabled.' });
});
