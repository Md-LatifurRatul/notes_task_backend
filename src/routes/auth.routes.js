import { Router } from 'express';
import { z } from 'zod';
import { User } from '../models/user.model.js';
import { asyncHandler } from '../utils/async-handler.js';
import { HttpError } from '../utils/http-error.js';
import { issueTokens, verifyRefreshToken } from '../utils/tokens.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { env } from '../config/env.js';
import jwt from 'jsonwebtoken';

const router = Router();
const credentials = z.object({ email: z.string().email().max(254), password: z.string().min(12).max(72) });

router.post('/register', asyncHandler(async (req, res) => {
  const input = credentials.extend({ interests: z.array(z.string().trim().min(1).max(40)).max(50).optional() }).parse(req.body);
  if (Buffer.byteLength(input.password, 'utf8') > 72) throw new HttpError(400, 'Password must be at most 72 UTF-8 bytes');
  const user = await User.create({ email: input.email, password: input.password, interests: input.interests ?? [], role: 'user' });
  res.status(201).json({ data: { user: user.toJSON(), ...issueTokens(user) } });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const input = credentials.parse(req.body);
  if (Buffer.byteLength(input.password, 'utf8') > 72) throw new HttpError(400, 'Invalid email or password');
  const user = await User.findOne({ email: input.email.toLowerCase() }).select('+password');
  if (!user || !(await user.verifyPassword(input.password))) throw new HttpError(401, 'Invalid email or password');
  res.json({ data: { user: user.toJSON(), ...issueTokens(user) } });
}));

router.post('/refresh', asyncHandler(async (req, res) => {
  const token = z.string().min(1).parse(req.body.refreshToken);
  let claims;
  try { claims = verifyRefreshToken(token); } catch { throw new HttpError(401, 'Invalid or expired refresh token'); }
  if (claims.type !== 'refresh') throw new HttpError(401, 'Invalid refresh token');
  const user = await User.findById(claims.sub).select('_id email role interests createdAt updatedAt');
  if (!user) throw new HttpError(401, 'Account no longer exists');
  const nextRefresh = jwt.sign({ sub: user.id, type: 'refresh' }, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES_IN, issuer: 'secure-notes-api', audience: 'secure-notes-client' });
  const accessToken = jwt.sign({ sub: user.id, role: user.role, type: 'access' }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN, issuer: 'secure-notes-api', audience: 'secure-notes-client' });
  res.json({ data: { user: user.toJSON(), accessToken, refreshToken: nextRefresh, tokenType: 'Bearer' } });
}));

router.get('/me', requireAuth, (req, res) => res.json({ data: { user: req.user } }));

export default router;
