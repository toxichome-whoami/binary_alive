import { Hono } from 'hono';
import { setCookie, deleteCookie, getCookie } from 'hono/cookie';
import {
  getUserByUsername,
  countUsers,
  createUser,
  incrementFailedAttempts,
  resetFailedAttempts,
} from '../db/users.js';
import { createSession, deleteSession } from '../db/sessions.js';
import { logAudit, logLoginAttempt } from '../db/logs.js';
import { getSetting } from '../db/settings.js';
import {
  verifyPassword,
  hashPassword,
  generateCsrfToken,
  decryptData,
} from '../lib/crypto.js';
import { TotpService } from '../lib/totp.js';
import { CaptchaService } from '../lib/captcha.js';
import { requireAuth } from '../middleware/auth.js';
import { loginRateLimiter } from '../middleware/rateLimit.js';
import { broadcastUsersRefresh } from '../websocket.js';
import crypto from 'crypto';
import os from 'os';

export const authRouter = new Hono();

// Setup status: checks if DB is empty
authRouter.get('/setup', async (c) => {
  const count = await countUsers();
  const captchaSetting = await getSetting('enable_captcha', '0');
  const maintenanceSetting = await getSetting('maintenance_mode', '0');
  return c.json({ 
    setup_mode: count === 0,
    captcha_enabled: captchaSetting === '1',
    maintenance_enabled: maintenanceSetting === '1'
  });
});

// Setup master admin (only when users table is empty)
let isSettingUp = false;
authRouter.post('/setup', async (c) => {
  if (isSettingUp) return c.json({ success: false, message: 'Setup in progress' }, 409);
  isSettingUp = true;
  
  try {
    const count = await countUsers();
    if (count > 0) {
      return c.json({ success: false, message: 'Setup is already completed.' }, 403);
    }

    const { username, password, email } = await c.req.json();
    if (!username || typeof username !== 'string' || !username.match(/^[a-zA-Z0-9_.-]+$/)) {
      return c.json({ success: false, message: 'Invalid username format.' }, 400);
    }
    if (!password || password.length < 12) {
      return c.json({ success: false, message: 'Password must be at least 12 characters.' }, 400);
    }

    const hash = await hashPassword(password);
    const id = await createUser(username, hash, 'owner', '{}', email || null);

    await logAudit(id, username, 'setup_first_admin', 'Initial master admin account initialized');
    return c.json({ success: true, message: 'Master Administrator created successfully!' });
  } finally {
    isSettingUp = false;
  }
});

// Captcha generator
authRouter.get('/captcha', async (c) => {
  let sid = getCookie(c, 'captcha_sid');
  if (!sid) {
    sid = crypto.randomBytes(16).toString('hex');
    setCookie(c, 'captcha_sid', sid, {
      path: '/',
      httpOnly: true,
      sameSite: 'Strict',
      maxAge: 300,
    });
  }

  const { svg } = CaptchaService.generate(sid);
  c.header('Content-Type', 'image/svg+xml');
  c.header('Cache-Control', 'no-store, no-cache, must-revalidate');
  return c.body(svg);
});


  }

  const valid = CaptchaService.verify(sid, answer, false);
  return c.json({ valid });
});

// CSRF token recovery
authRouter.get('/csrf', (c) => {
  let token = getCookie(c, 'csrf_token');
  if (!token) {
    token = generateCsrfToken();
    setCookie(c, 'csrf_token', token, {
      path: '/',
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });
  }
  return c.json({ success: true, token });
});

// Login
authRouter.post('/login', loginRateLimiter(), async (c) => {
  let ip = '127.0.0.1';
  const fwd = c.req.header('x-forwarded-for');
  if (process.env.TRUST_PROXY === 'true' && fwd) {
    ip = fwd.split(',')[0].trim();
  } else {
    // @ts-ignore
    ip = c.env?.incoming?.socket?.remoteAddress || c.env?.incoming?.client?.remoteAddress || '127.0.0.1';
  }

  let body; try { body = await c.req.json(); } catch { return c.json({success:false,message:'Bad Request'}, 400); }
  const username = (body.username || '').trim();
  const password = body.password || '';
  const totpCode = (body.totp || '').trim();
  const captchaAnswer = (body.captcha || '').trim();

  // Check CAPTCHA if enabled
  const captchaSetting = await getSetting('enable_captcha', '0');
  if (captchaSetting === '1') {
    const sid = getCookie(c, 'captcha_sid');
    if (!sid || !CaptchaService.verify(sid, captchaAnswer)) {
      await logLoginAttempt(username, false, ip);
      return c.json({ success: false, message: 'Invalid security CAPTCHA code.' }, 401);
    }
  }

  const user = await getUserByUsername(username);
  if (!user) {
    await logLoginAttempt(username, false, ip);
    return c.json({ success: false, message: 'Invalid username or password.' }, 401);
  }

  // Check maintenance mode
  const maintenanceSetting = await getSetting('maintenance_mode', '0');
  const canBypassMaintenance = user.role === 'owner' || user.permissions?.settings_maintenance;
  
  if (maintenanceSetting === '1' && !canBypassMaintenance) {
    await logLoginAttempt(username, false, ip);
    return c.json({ success: false, message: 'System is under maintenance. Only authorized staff can log in.' }, 503);
  }

  // Check account lockout
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    const isPermanentlyDisabled = new Date(user.locked_until).getFullYear() === 2099;
    return c.json({ 
      success: false, 
      message: isPermanentlyDisabled 
        ? 'Your account has been disabled by an administrator.' 
        : 'Your account is temporarily locked due to too many failed attempts.' 
    }, 403);
  }

  // Verify password
  const match = await verifyPassword(password, user.password_hash);
  if (!match) {
    await incrementFailedAttempts(user.username);
    broadcastUsersRefresh();
    await logLoginAttempt(user.username, false, ip, user.email || null);
    
    const updatedUser = await getUserByUsername(username);
    if (updatedUser?.locked_until && new Date(updatedUser.locked_until) > new Date()) {
      const isPermanentlyDisabled = new Date(updatedUser.locked_until).getFullYear() === 2099;
      return c.json({ 
        success: false, 
        message: isPermanentlyDisabled 
          ? 'Your account has been disabled by an administrator.' 
          : 'Your account is temporarily locked due to too many failed attempts.' 
      }, 403);
    }
    return c.json({ success: false, message: 'Invalid username or password.' }, 401);
  }

  // Verify 2FA if configured
  if (user.totp_secret) {
    const secret = decryptData(user.totp_secret);
    if (!totpCode || !TotpService.verifyCode(secret, totpCode)) {
      await incrementFailedAttempts(user.username);
      broadcastUsersRefresh();
      await logLoginAttempt(user.username, false, ip, user.email || null);
      return c.json(
        {
          success: false,
          requires_2fa: true,
          message: 'Invalid or missing Two-Factor Authentication (2FA) code.',
        },
        401
      );
    }
  }

  // Login success
  if (user.failed_attempts > 0) {
    await resetFailedAttempts(user.username);
    broadcastUsersRefresh();
  } else {
    await resetFailedAttempts(user.username);
  }
  await logLoginAttempt(user.username, true, ip, user.email || null);
  await logAudit(user.id, user.username, 'login_success', '', ip, user.email || null);

  const timeout = parseInt(process.env.SESSION_TIMEOUT_MINUTES || '60', 10);
  const sessionId = await createSession(user.id, timeout);
  const csrfToken = generateCsrfToken();

  // Set cookies
  setCookie(c, 'session_id', sessionId, {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict',
    maxAge: timeout * 60,
  });

  // CSRF cookie is non-HttpOnly so client JavaScript can read and pass it
  setCookie(c, 'csrf_token', csrfToken, {
    path: '/',
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict',
    maxAge: timeout * 60,
  });

  return c.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
        has_2fa: !!user.totp_secret,
        hostname: os.hostname(),
      },
    });
});

// Logout
authRouter.post('/logout', requireAuth(), async (c) => {
  const user = c.get('user');
  const sessionId = getCookie(c, 'session_id');

  if (sessionId) {
    await deleteSession(sessionId);
  }

  deleteCookie(c, 'session_id', { path: '/' });
  deleteCookie(c, 'csrf_token', { path: '/' });

  if (user) {
    await logAudit(user.id, user.username, 'logout');
  }

  return c.json({ success: true, message: 'Logged out successfully.' });
});

// Current user profile bootstrap
authRouter.get('/me', requireAuth(), async (c) => {
  const user = c.get('user');
  return c.json({
    success: true,
    data: {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
        has_2fa: !!user.totp_secret,
        hostname: os.hostname(),
      },
    },
  });
});