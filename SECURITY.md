# Security Policy

## Reporting a vulnerability

Please **do not open a public issue** for a security problem.

Report it privately through GitHub's [Report a vulnerability](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing/privately-reporting-a-security-vulnerability)
form on this repository, or email the maintainer directly.

Include the affected component, the steps to reproduce, and what an attacker
could achieve. You can expect an acknowledgement within a few days.

## Supported versions

The `main` branch is the only supported version.

## Scope

CitizenCare handles crime reports, location data and emergency alerts, so the
following are treated as high severity:

- Any path to obtaining the `police` or `admin` role without a valid station
  code or an admin promotion
- Reading another user's unverified reports, personal details or SOS location
- Retrieving a police station registration code without admin authentication
- Authentication bypass, token forgery, or session fixation
- Stored or reflected XSS in any portal

## Hardening a deployment

- Set a strong `JWT_SECRET` — 32+ characters is enforced when
  `NODE_ENV=production`.
- Pin `CLIENT_URL` to your exact frontend origin. Never use `*`.
- Serve over HTTPS. Browsers also require it for camera access.
- Change every seeded password and rotate the seeded station code.
- Restrict the Google Maps API key by HTTP referrer.
- Set `TRUST_PROXY_HOPS` to match your proxy depth so rate limiting sees real
  client IPs rather than the proxy's.
- Keep dependencies current: `npm audit` in both `client/` and `server/`.

## What is deliberately not a vulnerability

- The seeded demo credentials in `README.md` — they exist for first-run setup
  and the documentation says to change them.
- Rate limits being lenient in development; set `DISABLE_RATE_LIMIT=false` and
  tune `RATE_LIMIT_*` for production.
