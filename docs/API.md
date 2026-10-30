# CitizenCare REST API

Base URL: `http://localhost:5000/api` in development.

## Conventions

**Authentication.** Send the JWT from login or registration as a bearer token:

```http
Authorization: Bearer <token>
```

Every authenticated request re-loads the account from the database, so a
demoted or deactivated user loses access immediately rather than when their
token expires.

**Access column.** Each endpoint below is marked:

| Mark | Meaning |
|---|---|
| Public | No token needed |
| Any | Any signed-in account |
| Staff | `police` or `admin` |
| Admin | `admin` only |

**Errors.** Failures return a JSON body with a human-readable `message`, plus an
`errors` array for validation failures:

```json
{
  "message": "Password must be at least 8 characters",
  "errors": [{ "type": "field", "path": "password", "msg": "Password must be at least 8 characters" }]
}
```

| Status | Meaning |
|---|---|
| `400` | Validation failed, or a malformed id |
| `401` | Missing, expired or rejected token |
| `403` | Authenticated but not permitted, or the account is disabled |
| `404` | Not found — also returned instead of `403` where existence itself is private |
| `409` | Conflict (duplicate email or station code, last-admin guard) |
| `429` | Rate limit exceeded |
| `502` | An upstream service (the Python AI) failed |

**Rate limits.** 20 requests per 15 minutes on authentication endpoints
(successful requests are not counted), 300/minute across the rest of `/api`,
and 240/minute for CCTV frame uploads. Tunable via `RATE_LIMIT_*`.

---

## Health

### `GET /api/health` · Public

```json
{ "ok": true, "time": "2026-08-22T15:48:11.153Z", "db": "connected", "uptimeSeconds": 117 }
```

Not rate limited — safe for uptime monitors.

---

## Authentication — `/api/auth`

### `POST /register` · Public

Creates a **citizen** account. `role` in the body is ignored — this endpoint
cannot produce an elevated account.

```json
{ "name": "Asha Rahman", "email": "asha@example.com", "password": "at-least-8-chars", "phone": "+8801700000000" }
```

`201` → `{ "token": "...", "user": { "id", "name", "email", "role": "citizen", ... } }`
`409` → email already registered.

### `POST /register/police` · Public, code-gated

Creates a **police** account. Requires the registration code of an active
station, issued from the admin portal. Codes are compared case-insensitively.

```json
{
  "name": "Officer Karim",
  "email": "karim@police.gov",
  "password": "at-least-8-chars",
  "stationCode": "PS-CENTRAL01",
  "badgeId": "BD-0042"
}
```

`201` → token and user, with `role: "police"` and the station attached.
`403` → the code is unknown or the station is inactive.

### `POST /login` · Public

```json
{ "email": "asha@example.com", "password": "..." }
```

`200` → token and user. `401` for a bad email *or* password — the message is
identical either way, so the endpoint does not reveal which addresses exist.
`403` if the account has been disabled.

### `GET /me` · Any

The full current user, with `station` populated for officers.

### `PATCH /me` · Any

Body: `{ "name"?, "phone"? }`.

### `POST /change-password` · Any

Body: `{ "currentPassword", "newPassword" }`. `401` if the current password is wrong.

---

## Police stations — `/api/stations`

### `GET /public` · Public

Registered active stations, **codes excluded** — used by the police signup form
so an officer can confirm their station exists.

```json
[{ "_id": "...", "name": "Central Police Station", "district": "Dhaka" }]
```

### `GET /` · Admin

All stations with an `officerCount`. Add `?includeCodes=true` to include the
registration codes.

### `POST /` · Admin

```json
{ "name": "Gulshan Police Station", "district": "Dhaka", "address": "...", "phone": "...", "lat": 23.7925, "lng": 90.4078, "code": "OPTIONAL-CUSTOM" }
```

Omit `code` and a secure one is generated (`PS-` plus eight unambiguous
characters). `201` returns the station **including its code** — this is the
moment to copy it.

### `PATCH /:id` · Admin

Update `name`, `district`, `address`, `phone`, `lat`, `lng`, `isActive`.

### `POST /:id/rotate-code` · Admin

Issues a new code and invalidates the old one. Officers who already registered
are unaffected.

`200` → `{ "id": "...", "code": "PS-9GMPAYYS" }`

### `DELETE /:id` · Admin

`409` if any officer account still belongs to the station — deactivate it instead.

---

## Reports — `/api/reports`

### `POST /` · Any — `multipart/form-data`

| Field | Required | Notes |
|---|:---:|---|
| `title` | ✅ | ≤ 200 characters |
| `description` | ✅ | ≤ 8000 characters |
| `crimeType` | ✅ | `theft`, `assault`, `vandalism`, `traffic`, `domestic`, `drugs`, `other` |
| `lat`, `lng` | ✅ | Decimal degrees |
| `address` | | ≤ 500 characters |
| `media` | | Up to 5 files, 25 MB each — JPEG, PNG, GIF, WebP, MP4, WebM, MOV |

Creates the report as `pending`, notifies all staff over Socket.IO, and
confirms to the reporter.

### `GET /map` · Public (richer for staff)

Query: `crimeType`, `from`, `to` (ISO 8601), `limit` (≤ 1000), and `status`
(**staff only** — the public feed is always `verified`).

The public response omits `submittedBy` entirely; staff receive it populated.

### `GET /mine` · Any

The caller's own reports, any status.

### `GET /` · Staff

Paginated queue. Query: `status`, `crimeType`, `page`, `limit` (≤ 100).

```json
{ "items": [...], "total": 42, "page": 1, "limit": 20 }
```

### `GET /:id` · Public (conditional)

Staff see any report. A citizen sees their own report, or any verified one.
An unverified report belonging to someone else returns `404`, not `403` — its
existence is itself private.

### `PATCH /:id/status` · Staff

```json
{ "status": "verified", "note": "Confirmed by patrol." }
```

`status` is one of `pending`, `verified`, `fake`, `resolved`. Notifies the
reporter; verifying also broadcasts `public-safety` so every open map refreshes.

---

## Emergency alerts — `/api/alerts`

### `POST /` · Any

```json
{ "message": "Need help", "lat": 23.8103, "lng": 90.4125, "address": "Ramna, Dhaka" }
```

Creates an `active` alert and pushes it to every officer on duty over
Socket.IO, with the caller's name, email and phone.

### `GET /mine` · Any — the caller's own SOS history.

### `GET /` · Staff

Query: `status` (`active`, `acknowledged`, `resolved`), `limit` (≤ 200).

### `PATCH /:id/acknowledge` · Staff — marks it `acknowledged` and tells the citizen.

### `PATCH /:id/resolve` · Staff — marks it `resolved` and tells the citizen.

---

## CCTV & detection — `/api/cctv`

### `POST /upload-frame` · Any — `multipart/form-data`

Field `frame` (JPEG), plus optional `cameraId`, `place`, `lat`, `lng`,
`address`. Forwards the frame to the Python service and returns its verdict.

```json
{
  "weaponDetected": true,
  "labels": ["knife"],
  "detections": [{ "label": "knife", "confidence": 0.82, "box": { "x1": 120, "y1": 80, "x2": 210, "y2": 260 } }],
  "frameWidth": 640,
  "frameHeight": 480,
  "aiUnavailable": false
}
```

If the AI service is unreachable the request still succeeds with
`aiUnavailable: true`, so the live view keeps working. A detection records a
`CctvEvent` and alerts all staff.

### `POST /detect-test` · Any — one image (field `image`) with full debug output.

### `GET /status` · Staff — the most recent frame status per live camera.

### `GET /map` · Staff — recent weapon detections with coordinates.

### `GET /public-map` · Public — the same feed, anonymised for citizen maps.

### `GET /events` · Staff — recent detection events with the reporting user.

### `GET /my-events` · Any — the caller's own detections.

### `GET /ai-health` · Staff — proxied health of the Python service, so the UI can
distinguish "no detections" from "detection is offline".

---

## Safety score

### `GET /api/safety-status` · Public

Query: `lat`, `lng` (required), `radiusM` (100–5000, default 1000), `days`
(1–60, default 14).

```json
{
  "status": "LOW RISK",
  "score": 2,
  "nearbyIncidents": 1,
  "breakdown": { "recentCrimes": 1, "weaponDetections": 0, "days": 14, "radiusM": 1000 },
  "topCrimeTypes": [{ "crimeType": "theft", "count": 1 }],
  "note": "Risk increases at night."
}
```

Verified reports weigh 2 and CCTV weapon detections weigh 3 — a live detection
is a stronger signal than a filed report. `SAFE` at 0, `LOW RISK` below 5,
`HIGH RISK` at 5 or above.

---

## Analytics

### `GET /api/analytics/summary` · Staff

Query: `days` (1–365, default 30). Returns totals, `byType`, `byStatus`,
`reportsOverTime` and `topLocations`.

---

## Notifications — `/api/notifications`

| Endpoint | Access | Purpose |
|---|---|---|
| `GET /` | Any | The caller's notifications (`limit` ≤ 200). The unread count rides along in the `X-Unread-Count` header |
| `GET /unread-count` | Any | `{ "unread": 3 }` |
| `PATCH /:id/read` | Any | Mark one read |
| `POST /read-all` | Any | Mark all read |
| `DELETE /` | Any | Clear the caller's notifications |

---

## Administration — `/api/admin`

Every endpoint here is **Admin** only.

### `GET /overview`

System-wide counts: users by role, reports by status, alerts, stations, CCTV
events, and a 30-day signup series.

### `GET /users`

Query: `page`, `limit` (≤ 100), `role`, `status` (`active`/`inactive`), `q`
(matches name, email or badge).

### `PATCH /users/:id`

Body: `name`, `phone`, `badgeId`, `role`, `isActive`, `stationId`.

Guards: the last active admin cannot be demoted or disabled (`409`), and you
cannot deactivate your own account (`400`). Changing a role away from `police`
clears the station posting and badge.

### `POST /users/:id/reset-password`

Body: `{ "newPassword": "at-least-8-chars" }`.

### `DELETE /users/:id`

Removes the account and its notifications; reports are kept for the record.
You cannot delete yourself or the last admin.

### `GET /audit`

The append-only trail of privileged actions (`limit` ≤ 200).

### `POST /broadcast`

```json
{ "title": "Scheduled maintenance", "body": "The API restarts at 02:00.", "audience": "all" }
```

`audience` is `all`, `citizen` or `police`. Stores a notification per recipient
and pushes it live.

---

## Object detection — `/api/ai`

### `POST /detect` · Any — `multipart/form-data`, field `image`

Prefers the bundled Python service (`PYTHON_AI_URL`), falls back to an external
endpoint (`YOLOV8_API_URL`), and finally to a demo response so the page is
still demonstrable with nothing configured. The response's `mode` says which
path ran.

---

## Realtime events (Socket.IO)

Connect with the JWT in the handshake:

```js
io(SOCKET_URL, { auth: { token } });
```

The handshake verifies the token **and** re-checks that the account is still
active. Every client joins `user:<id>`; staff also join `staff`, and admins
join `admin`.

| Event | Sent to | Payload |
|---|---|---|
| `notification` | The user, or a room | `{ type, title, body, ... }` |
| `emergency` | `staff` | New SOS with location and caller details |
| `emergency-updated` | `staff` | `{ id, status }` after acknowledge/resolve |
| `cctv-status` | `staff` | Per-frame camera status and throttled snapshot |
| `cctv-frame` | `staff` | Low-latency base64 preview frame |
| `cctv-alert` | `staff` + the camera owner | Weapon detection with boxes and location |
| `public-safety` | Everyone | A verified report or detection — a cue to refresh maps |
