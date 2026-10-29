# Secure Notes — Backend API

Standalone Express REST API with JWT auth and role-based access control, backed by MongoDB/Mongoose. It owns its `package.json`, lockfile, `node_modules` and `.env`, so it installs, builds and deploys on its own.

## Stack

- Node.js 20+, Express 4, Mongoose 8 (MongoDB local or Atlas)
- JWT access/refresh tokens, bcrypt password hashing
- Zod request validation, Helmet, CORS allowlist, API rate limiting

## Run

```sh
npm install
npm run db:indexes    # applies the schema.index() declarations (auto-indexing is off when NODE_ENV=production)
npm run seed:admin    # optional: creates ADMIN_EMAIL from .env
npm run dev           # http://localhost:4000
```

Production: `npm start`. The client lives in `../frontend` and runs separately.

## Configuration (`.env`)

| Key | Meaning |
|---|---|
| `PORT` | API port (default 4000) |
| `MONGODB_URI` | Connection string — credentials inline or via `MONGODB_USERNAME`/`MONGODB_PASSWORD` |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | Different secrets, each ≥32 characters |
| `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN` | e.g. `15m` and `7d` |
| `BCRYPT_ROUNDS` | Hash cost (default 12) |
| `CORS_ORIGIN` | Allowed client origin (default `http://localhost:3000`) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Used only by `npm run seed:admin` (12+ characters) |
| `API_DOCS_USERNAME`, `API_DOCS_PASSWORD` | Optional. When both are set, `/docs` is protected by HTTP Basic auth; when either is empty, `/docs` returns 404.

`dotenv` never overwrites an existing variable — if the host exports a conflicting `PORT`, unset it. Never commit `.env`.

## API

All endpoints sit under `/api`. Protected routes require `Authorization: Bearer <accessToken>`. List responses return `{ data, pagination }`; `page` defaults to 1, `limit` to 20 and is capped at 100.

### API documentation

Open `http://localhost:4000/docs` in a browser (adjust `PORT`). The UI authenticates with the `API_DOCS_USERNAME`/`API_DOCS_PASSWORD` values from `.env` (HTTP Basic auth, browser password prompt) and renders a full, interactive Swagger UI for every endpoint, including the `Try it out` button so you can call the live API from the docs.

The docs page is dark by default and includes a `Theme` button in the top bar that toggles a light theme and remembers the choice in `localStorage`. It is also self-contained: the OpenAPI spec is inlined into the page so it renders without a second authenticated fetch, and the Swagger UI runtime is loaded from the jsDelivr CDN (the project is otherwise fully offline-capable — only the docs UI uses a CDN, for visual polish; no API logic depends on it).

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/health` | Public | Health check |
| POST | `/auth/register` | Public | Create a user (never accepts a role) |
| POST | `/auth/login` | Public | Sign in |
| POST | `/auth/refresh` | Public, refresh token required | Rotate access/refresh JWTs |
| GET | `/auth/me` | User/Admin | Current profile |
| GET | `/notes?page=&limit=` | User/Admin | Own notes |
| POST | `/notes` | User/Admin | Create own note |
| GET | `/notes/:id` | Owner/Admin | Read note |
| PATCH | `/notes/:id` | Owner/Admin | Update note |
| DELETE | `/notes/:id` | Owner/Admin | Delete note |
| GET | `/notes/admin/all?page=&limit=` | Admin | Everyone's notes |
| GET | `/users?page=&limit=` | Admin | Paginated user list |
| POST | `/users` | Admin | Create user/admin |
| GET | `/users/:id` | Admin | Read user |
| PATCH | `/users/:id` | Admin | Update email/password/role/interests |
| DELETE | `/users/:id` | Admin | Remove user (self-delete is rejected) |
| GET | `/users/groups/interests?page=&limit=` | Admin | Users grouped by interests — exactly one `User.aggregate()` call |
| GET | `/users/:id/posts?page=&limit=` | User/Admin | A user's posts via one pipeline with `$lookup`; posts are visible to every signed-in user |
| GET | `/posts?page=&limit=` | Public | Public posts |
| POST | `/posts` | User/Admin | Create a post as the signed-in user |

```sh
curl -X POST http://localhost:4000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"reader@example.com","password":"use-a-long-unique-password","interests":["reading","chess"]}'
```

Copy the returned `accessToken` into the bearer header. Only the seed script can create an admin; public registration always yields `user`.

## Design and access control

- `requireAuth` verifies HS256 bearer access JWTs (issuer/audience/type/expiry) and reloads the user's current role from MongoDB, so role changes apply without waiting for the token to expire.
- Registration always assigns `user`; privilege changes are only possible in admin-protected `/api/users` routes.
- On `/api/users`, only `GET /:id/posts` is open to every authenticated user (posts are visible to everyone); user listing/creation/detail/update/delete and the interest grouping require `admin`.
- Every note read/update/delete is scoped by `{ _id, owner }` for regular users; admins may target any note. The owner is always taken from the authenticated identity, never from the request body.
- Passwords are bcrypt-hashed in the model save hook, never selected by default and stripped from JSON. Login returns one generic error for unknown email and wrong password.
- Access and refresh JWTs use separate secrets plus explicit token type, issuer, audience and algorithm; refresh rotates both tokens. There is no server-side revocation — clients discard tokens on sign-out.
- Admins cannot delete or demote their own account, preventing accidental lockout.
- Errors have a stable `{ error: { message, details? } }` envelope; malformed IDs → 400, duplicates → 409, 5xx messages are generic.

## Aggregation scenarios (task requirements)

1. **Group by interests** — `GET /api/users/groups/interests` uses exactly one `User.aggregate(pipeline)` call (no `find`, no `countDocuments`, no second aggregation): `$match` → `$unwind` → `$group` → `$sort` → `$facet` for paginated rows plus count. It reads every profile, so a multikey `interests` index would not reduce the work and is deliberately not created.
2. **User posts with `$lookup`** — `GET /api/users/:id/posts` validates the ObjectId, then runs one pipeline: `$match` on `_id` plus a `$lookup` into `posts` on `author`, with `$facet` paginating/counting inside the lookup. The foreign-key index serves the join; the route returns 404 for a missing profile.

## Index inventory (declared with `schema.index()`)

| Model | Index | Supports |
|---|---|---|
| User | `{ email: 1 }`, unique | Login lookup and duplicate email prevention |
| User | `{ createdAt: -1, _id: -1 }` | Admin user listing: chronological skip/limit (the `_id` index cannot serve a `createdAt` sort) |
| Note | `{ owner: 1, createdAt: -1, _id: -1 }` | Owner-filtered chronological notes |
| Note | `{ createdAt: -1, _id: -1 }` | Global admin note listing |
| Post | `{ author: 1, createdAt: -1, _id: -1 }` | `$lookup` equality join and per-author posts |
| Post | `{ createdAt: -1, _id: -1 }` | Public post list |

MongoDB's built-in `_id` index serves single profile/note point reads. Nothing is indexed for `role`, `updatedAt` or the interests grouping — no query in the task needs them. Every list and point query was confirmed with `explain('queryPlanner')` to be an `IXSCAN` on the expected index with no blocking sort.

## Production

With `NODE_ENV=production` Mongoose auto-indexing is disabled — run `npm run db:indexes` after deployment (it creates exactly the declared indexes and never drops anything). Also: secrets from a secret manager, HTTPS, restricted `CORS_ORIGIN`, TLS MongoDB URI, backups and monitoring. Deleting a user intentionally leaves their notes/posts in place rather than destroying data implicitly.

## Verification performed

- `node --check` on every source file.
- `npm run db:indexes` → `users: _id_, user_email_unique, users_created_at` / `notes: _id_, notes_owner_created_at, notes_created_at` / `posts: _id_, posts_author_created_at, posts_created_at`.
- End-to-end run against the configured Atlas cluster: **46/46 assertions** covering auth, RBAC boundaries, note ownership, pagination limits, both aggregation scenarios and index plans; test data removed afterwards.

Requirement-by-requirement status: [CHECKLIST.md](CHECKLIST.md).
