import { Router } from 'express';
import { createRequire } from 'node:module';
import path from 'node:path';
import { readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import crypto from 'node:crypto';

import { env } from '../config/env.js';
import { openapi, components } from './openapi.js';

const router = Router();

// ---------------------------------------------------------------------------
// HTTP Basic auth for the API surface (openapi.json + the HTML page that
// embeds the spec). Fail-closed: when credentials are not configured the
// protected endpoints look unavailable (404) instead of accidentally exposing
// the API surface.
//
// Static Swagger UI library assets (/docs/assets/*) are intentionally served
// without auth: they are public library files (swagger-ui bundle, CSS,
// favicons), the page that references them is already protected, and exposing
// the library file itself reveals no API surface.
// ---------------------------------------------------------------------------
const docsUsername = env.API_DOCS_USERNAME ?? '';
const docsPassword = env.API_DOCS_PASSWORD ?? '';
const authConfigured = docsUsername.length > 0 && docsPassword.length > 0;
const realm = 'API Docs';

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function checkAuth(authorization) {
  if (!authConfigured) return false;
  const [scheme, credentials] = (authorization || '').split(' ');
  if (scheme !== 'Basic' || !credentials) return false;
  const decoded = Buffer.from(credentials, 'base64').toString('utf8');
  const sepIndex = decoded.indexOf(':');
  if (sepIndex <= 0) return false;
  const username = decoded.slice(0, sepIndex);
  const password = decoded.slice(sepIndex + 1);
  return (
    username.length > 0 &&
    password.length > 0 &&
    safeEqual(username, docsUsername) &&
    safeEqual(password, docsPassword)
  );
}

function unauthorized(res, realm) {
  res.set('WWW-Authenticate', `Basic realm="${realm}"`);
  res.status(401).json({ error: { message: 'API docs authentication required' } });
}

function authGuard(req, res, next) {
  if (!authConfigured) return res.status(404).end();
  if (checkAuth(req.headers.authorization)) return next();
  unauthorized(res, realm);
}

// ---------------------------------------------------------------------------
// OpenAPI document as JSON — protected alongside the HTML page.
// ---------------------------------------------------------------------------
router.get('/openapi.json', authGuard, (_, res) => {
  const spec = JSON.stringify({ ...openapi, components: { ...openapi.components, ...components } });
  res.set('Content-Type', 'application/json; charset=utf-8');
  res.set('Cache-Control', 'no-cache');
  res.send(spec);
});

// ---------------------------------------------------------------------------
// Swagger UI static assets, served from the installed package — no runtime
// CDN dependency.
// ---------------------------------------------------------------------------
const require = createRequire(import.meta.url);
const swaggerDist = path.dirname(require.resolve('swagger-ui-dist/package.json'));

router.get('/assets/*', async (req, res, next) => {
  const file = req.params[0];
  if (!file) return next();
  const filePath = path.join(swaggerDist, file);
  try {
    await stat(filePath);
    res.set('Cache-Control', 'public, max-age=86400');
    res.set('Content-Type', mimeFor(path.extname(filePath)));
    createReadStream(filePath).pipe(res);
  } catch {
    next();
  }
});

function assetUrl(file) {
  return `/docs/assets/${file}`;
}

function mimeFor(ext) {
  switch (ext) {
    case '.js': return 'application/javascript; charset=utf-8';
    case '.css': return 'text/css; charset=utf-8';
    case '.woff2': return 'font/woff2';
    case '.woff': return 'font/woff';
    case '.ttf': return 'font/ttf';
    default: return 'application/octet-stream';
  }
}

// ---------------------------------------------------------------------------
// Embedded UI page.
//
// The HTML page itself is served WITHOUT auth so the browser can render the
// in-page login form. The page then authenticates against the protected
// /docs/openapi.json endpoint and renders Swagger UI only after a successful
// sign-in. This avoids the browser receiving a raw 401 JSON body (which would
// render as a blank/blue screen).
//
// The inlined OpenAPI spec is only embedded when the request already carries
// valid Basic auth — in that case we skip the login form and render the UI
// directly, matching the behaviour of the protected route.
// ---------------------------------------------------------------------------

// Content-Security-Policy for /docs: everything is served locally from
// /docs/assets/. Scripts require the per-request nonce; styles allow
// 'unsafe-inline' because the page's own <style> block and Swagger UI's
// inline styles are not nonce-able.
function docsCsp(nonce) {
  const parts = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ];
  return parts.join('; ') + ';';
}

router.get('/', async (req, res, next) => {
  let html;
  try {
    html = await readFile(path.join(import.meta.dirname, 'index.html'), 'utf8');
  } catch {
    return next();
  }

  // Per-request nonce for the inline bootstrap script — avoids 'unsafe-inline'
  // in the CSP while still allowing the page to initialize SwaggerUIBundle.
  const nonce = crypto.randomBytes(16).toString('base64');

  // Local asset URLs (no CDN — the page is fully offline).
  html = html
    .replace('__SWAGGER_BUNDLE_URL__', assetUrl('swagger-ui-bundle.js'))
    .replace('__SWAGGER_PRESET_URL__', assetUrl('swagger-ui-standalone-preset.js'))
    .replace('__SWAGGER_CSS_URL__', assetUrl('swagger-ui.css'))
    .replace('__NONCE__', nonce);

  // Content-Security-Policy: everything is served locally from /docs/assets/,
  // so 'self' is enough; the inline bootstrap uses the nonce below.
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.set('Cache-Control', 'no-store');
  res.setHeader('Content-Security-Policy', docsCsp(nonce));

  // If the request already carries valid Basic auth, embed the spec and render
  // the UI directly (skip the login overlay). Otherwise leave the spec slot
  // empty so the in-page login form can fetch it after sign-in.
  if (authConfigured && checkAuth(req.headers.authorization)) {
    const spec = JSON.stringify({ ...openapi, components: { ...openapi.components, ...components } });
    res.send(html.replace('__SPEC_JSON__', spec.replace(/</g, '\\u003c')));
  } else {
    // No embedded spec: the in-page JS will fetch /docs/openapi.json after a
    // successful sign-in and initialize SwaggerUIBundle itself.
    res.send(html.replace('__SPEC_JSON__', ''));
  }
});

export default router;
