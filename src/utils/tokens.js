import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function issueTokens(user) {
  const claims = { sub: user.id, role: user.role, type: 'access' };
  const accessToken = jwt.sign(claims, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN, issuer: 'secure-notes-api', audience: 'secure-notes-client' });
  const refreshToken = jwt.sign({ sub: user.id, type: 'refresh' }, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES_IN, issuer: 'secure-notes-api', audience: 'secure-notes-client' });
  return { accessToken, refreshToken, tokenType: 'Bearer' };
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_SECRET, { issuer: 'secure-notes-api', audience: 'secure-notes-client', algorithms: ['HS256'] });
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET, { issuer: 'secure-notes-api', audience: 'secure-notes-client', algorithms: ['HS256'] });
}
