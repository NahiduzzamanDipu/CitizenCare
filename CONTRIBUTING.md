# Contributing to CitizenCare

Thanks for your interest. This guide covers the setup, the conventions the code follows, and what a good pull request looks like.

## Getting set up

```bash
npm run install:all
cp server/.env.example server/.env
cp client/.env.example client/.env
npm run seed
npm run dev
```

You need Node 18+ and a running MongoDB. Python 3.10+ is only needed if you are working on the AI service.

## Before you open a pull request

```bash
npm run lint     # ESLint across client and server
npm run build    # the client must build cleanly
```

Both run in CI, so a failure here will fail the PR.

## Conventions

**JavaScript** — ES modules everywhere, both sides. Two-space indent, single quotes, semicolons. ESLint is the arbiter; run `npm run lint:fix` in `client/` for the easy ones.

**React** — function components and hooks only. One component per concern; shared pieces belong in `ui/` (presentational) or `shared/` (screens used by more than one portal). Data fetching lives in the component that renders it, wrapped in `useCallback` when it needs to be re-run.

**API routes** — every route file wraps its router in `wrapRouter()` so async rejections reach the error handler. Validate input with `express-validator` chains followed by the shared `validate` middleware, and give each check a `.withMessage()` a user could actually read.

**Authorisation** — never trust the JWT's role claim alone. `authenticate` loads the account on every request; put `requireStaff` or `requireAdmin` after it. Any new privileged action should call `recordAudit`.

**Comments** — explain *why*, not *what*. A comment earns its place when it captures a constraint that is not visible in the code: a browser quirk, an ordering requirement, a security boundary. Skip the ones that restate the line below them.

**Commits** — imperative mood, one logical change each: `Add station code rotation`, not `updates`.

## Where things live

| Adding… | Goes in |
|---|---|
| A REST endpoint | `server/src/routes/` — register it in `server/src/index.js` |
| A database collection | `server/src/models/` |
| A screen for one portal | `client/src/{admin,police,citizen}/` |
| A screen shared by portals | `client/src/shared/` |
| A reusable control | `client/src/ui/` |
| Anything map-related | `client/src/maps/` |

## Working with Google Maps

Load the script **only** through `useGoogleMaps()`. Calling `useJsApiLoader` directly with different options throws at runtime as soon as a user navigates between two map pages. If you need another Google library, add it to `GOOGLE_MAPS_LIBRARIES` in `client/src/maps/useGoogleMaps.js` so every caller stays in agreement.

Every map path must also degrade gracefully when no API key is configured — check `hasGoogleMapsKey()` and render a useful fallback.

## Security

Do not open a public issue for a vulnerability — see [SECURITY.md](SECURITY.md).

Take particular care with anything that touches roles. The rule the whole model rests on: a user can never choose their own role. Citizens self-register, police need a station code, admins are promoted by admins.

## Reporting bugs

Include what you did, what you expected, what happened, and the relevant output from the API console or the browser devtools. Mention your Node version, operating system, and whether MongoDB is local or Atlas.
