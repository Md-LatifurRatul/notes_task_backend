import mongoose from 'mongoose';
import { User } from '../models/user.model.js';
import { verifyAccessToken } from '../utils/tokens.js';
import { HttpError } from '../utils/http-error.js';
import { asyncHandler } from '../utils/async-handler.js';

export const requireAuth = asyncHandler(async (req, _res, next) => {
  const header = req.get('authorization') || '';
  const [scheme, token, extra] = header.split(' ');
  if (scheme !== 'Bearer' || !token || extra) throw new HttpError(401, 'Authentication required');
  let claims;
  try { claims = verifyAccessToken(token); } catch { throw new HttpError(401, 'Invalid or expired access token'); }
  if (claims.type !== 'access') throw new HttpError(401, 'Invalid access token');
  if (!mongoose.isValidObjectId(claims.sub)) throw new HttpError(401, 'Invalid access token');
  const user = await User.findById(claims.sub).select('_id email role interests createdAt updatedAt').lean();
  if (!user) throw new HttpError(401, 'Account no longer exists');
  req.user = user;
  next();
});

export function requireAdmin(req, _res, next) {
  if (req.user?.role !== 'admin') return next(new HttpError(403, 'Administrator access required'));
  next();
}
