# Backend — completion checklist

Every `[x]` was verified against the source **or** executed against the configured MongoDB Atlas cluster during this build. `[ ]` items are operational steps only you can perform.

## Required stack

- [x] REST API built with Node.js + Express, MongoDB + Mongoose (Atlas connection verified).
- [x] Interactive Swagger UI at `/docs`, dark by default with a light-theme toggle, accessible only behind HTTP Basic auth from `API_DOCS_USERNAME`/`API_DOCS_PASSWORD` (`.env`, already configured).
- [x] JWT authentication with separate access/refresh secrets, token types, issuer and audience.
- [x] bcrypt password hashing in the user schema save hook; hash never serialized or selected.
- [x] User/Admin roles; public registration can never choose or elevate a role (executed).
- [x] No template used.

## User permissions

- [x] Register/sign in and view own profile.
- [x] Create, list, read, edit and delete own notes (executed end to end).
- [x] Owner derived from the authenticated identity, never from request input.
- [x] A second user gets 404 reading, updating or deleting another user's note (executed).
- [x] Admin inherits note operations and can list every note (executed).

## Admin permissions

- [x] Create, read/list, update and delete users (executed: 201/200/204).
- [x] Assign user/admin roles; ordinary signup cannot (executed: role forced to `user`).
- [x] View all notes; a regular user gets 403 on every admin route (executed).
- [x] The current administrator cannot delete or demote their own account (400, source-verified).

## Pagination and indexing (critical constraint)

- [x] Every list operation paginates and returns `{ data, pagination }` (notes, all-notes, users, posts, groups, user-posts).
- [x] `page`/`limit` validated (`limit=1000` → 400, executed); `limit` max 100.
- [x] All indexes declared visibly with `schema.index()` — required by the task.
- [x] `users.email` unique: login lookup + duplicate prevention.
- [x] `users.{createdAt:-1,_id:-1}`: admin user-list sort (a `_id` index cannot serve a `createdAt` sort).
- [x] `notes.{owner,createdAt:-1,_id:-1}`: owner note list; `notes.{createdAt:-1,_id:-1}`: admin global list.
- [x] `posts.{author,createdAt:-1,_id:-1}`: `$lookup` join; `posts.{createdAt:-1,_id:-1}`: public post list.
- [x] Single reads (note, profile, login) use built-in `_id` / the unique email index.
- [x] No unnecessary indexes: nothing for `role`, `updatedAt` or `interests` — that grouping reads every profile, so a multikey index would not reduce the work.
- [x] `npm run db:indexes` output shows exactly the six declared indexes plus each collection's `_id_`, nothing more.
- [x] `explain('queryPlanner')` on every list and point query resolves to `IXSCAN` on the expected index with **no blocking sort**.

## Aggregation tasks (critical constraint)

- [x] Scenario 1 uses exactly one `User.aggregate()` call — no `find`, `countDocuments` or second aggregation.
- [x] Scenario 1 pipeline: `$match` → `$unwind` → `$group` → `$sort` → `$facet` pagination + count (executed).
- [x] Group counts correct with overlapping interests (verified).
- [x] Scenario 2 is a single pipeline containing `$lookup` from `users` to `posts` on `author`.
- [x] Scenario 2 returns only the requested user's posts — two users holding posts each, no cross-containment (executed).
- [x] Pagination inside the `$lookup` works (`limit=1` → 1 row, total 2, pages 2).
- [x] Scenario 2 requires authentication (401 anonymous, executed) and is open to every signed-in user.
- [x] Both pipelines are index-supported (`_id_` for the `$match`, `posts_author_created_at` for the join).

## Security

- [x] Zod validation on every write; passwords excluded from queries and JSON output.
- [x] Helmet, explicit CORS allowlist, 256 kB JSON body cap, rate limiting, generic 5xx messages.
- [x] Environment validated at startup; malformed IDs → 400, duplicate emails → 409.
- [x] `.env` ignored by git; `.env.example` documents every key.
- [ ] Independent 32+ character secrets in production; rotate the bootstrap admin password after handoff.
- [ ] HTTPS, MongoDB network allowlist/backups, secret management on deploy.
- [ ] Refresh-token revocation/logout, password reset, audit logging, email verification — out of scope for this task.
- [ ] Decide whether deleting a user should cascade notes/posts (current behaviour: records are retained).
- [x] Swagger UI at `/docs` reflects the live schema (auth/notes/users/posts paths, request/response schemas, pagination params, error codes) — verified by serving the app and loading `/docs` (see verification below).

## Setup and verification (performed here)

- [x] `.env` configured — Atlas URI, distinct JWT secrets, CORS origin.
- [x] `npm install` inside this folder (own lockfile and `node_modules`).
- [x] `npm run db:indexes` applied the declared indexes to the database.
- [x] `npm run seed:admin` created the administrator (password meets the 12-character policy).
- [x] Syntax check passes; end-to-end run: **46/46 assertions passed**, test data removed.

## Remaining limitations

- No committed automated test suite: verification was a scripted end-to-end pass during this build, not a repeatable `npm test`.
- JWT refresh-after-expiry behaviour was not exercised.
- Deployment, TLS and production secret management are left to the deployment environment.
