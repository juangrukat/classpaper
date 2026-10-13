# Production deployment

Classpaper is prepared for a small classroom deployment behind an HTTPS reverse proxy. Compose/container deployment and PostgreSQL backup/restore have been rehearsed on a separate Podman ARM64 instance. This is not a claim of universal format compatibility, high-scale performance, or completed field usability testing.

## Install and configure

From `app/`, copy `.env.example` to `.env`. Use a long unique PostgreSQL password. Set `PUBLIC_URL=https://tests.your-school.example`, `COOKIE_SECURE=true`, and `TRUST_PROXY=1` only if exactly one trusted reverse proxy connects directly to the app. Leave `ALLOW_REGISTRATION=false` to permit only initial account setup; enable it temporarily when adding teachers.

Run `docker compose up --build -d`. Compose binds the app to `127.0.0.1:3100`; the database is not published. Set your existing HTTPS reverse proxy to forward to that port. For example, a Caddy site on the same host:

```caddyfile
tests.your-school.example {
    reverse_proxy 127.0.0.1:3100
}
```

Replace the example host with your actual domain and configure DNS/TLS through your hosting provider. Check `/health/ready`, create the initial administrator account, then close registration. Confirm the student link uses the HTTPS domain. Trust-proxy settings must match your actual topology; do not enable arbitrary proxy trust.

The app runs as an unprivileged user with dropped Linux capabilities and no privilege escalation. PDF rendering is capped at two concurrent Chromium processes, with a 1 GB app memory cap and a 256-process limit. Chromium's own sandbox is disabled in the container; the renderer runs inside this constrained container and accepts only owner-scoped print snapshots. External requests from the renderer are blocked. Keep the container's default seccomp profile and network isolation in place. This configuration is intended for trusted teachers, not anonymous public document conversion.

## Teacher administration and password recovery

The first account is the administrator. On an upgraded database without an administrator, initialization assigns the existing account with the first sorted ID; review the administrator after upgrading. Teacher accounts can be disabled/re-enabled by the administrator. Disabling immediately revokes sessions. An administrator can create a recovery link after verifying the teacher's identity and share it privately. Links expire after 30 minutes, can be used once, and revoke all old sessions when a new password is saved.

If the administrator cannot sign in, issue a recovery link from the server:

```sh
docker compose exec app npm run recover -- teacher@school.example
```

Only the server operator can run this command. Recovery emails are not automatically sent. Do not log or publicly paste a recovery URL.

## Classroom recovery

In Results, review an active attempt to add 15 minutes to a timed attempt or issue a single-use device recovery code. A device recovery code expires after 15 minutes. Students use it on the original student link. Redeeming rotates their attempt token and revokes the old device. Submitted attempts cannot be reopened or extended. Grade multi-part answers individually; the total is computed and validated against each part's maximum.

Question statistics show the average earned marks among graded submissions. Pending teacher grades are excluded. This is a classroom diagnostic, not a psychometric analysis.

## PDFs and printing

The container includes Chromium. Local installations can enable the same renderer with `CHROMIUM_PATH` pointing to an installed Chrome/Chromium executable. Download PDF or Check print layout from a saved print version. Layout checks report horizontal overflow and question blocks taller than a printable page. They do not prove all browser/page-break combinations are flawless. Use the native print option as a fallback.

## Back up and rehearse restoration

Store backups securely outside the repository. From `app/`:

```sh
sh scripts/backup.sh /secure-backups/classpaper.dump
```

For restoration, provision a fresh database/container with the same PostgreSQL major version and restore into an empty database:

```sh
sh scripts/restore.sh /secure-backups/classpaper.dump
```

Verify sign-in, test contents, student results, grade overrides, print versions, presets and retained imports. Do not restore over a live database. Backups contain student responses and retained teacher source files; restrict access and apply your school's retention policy. The rehearsal in this repository restored an actual database and verified those application records through the API.

## Operation and upgrades

- Monitor readiness, container restarts, disk space, backup age and the time needed to render PDFs.
- Run `npm run build` and `npm test` before upgrading. CI also builds and launches the container against PostgreSQL.
- Back up before upgrading. Current migrations are additive; no destructive schema changes are performed.
- The app handles SIGTERM/SIGINT and closes the database. Allow at least 15 seconds before forcefully terminating it.
- Configure a server disk quota. Each teacher's retained import archive is capped at 200 MB of encoded data. Questions/pictures currently live in JSON, so this release fits modest classroom libraries.
- A 50-student simultaneous start/save/submit check passed on the test deployment. It does not establish capacity for a district or continuous high-volume use.
- Review `backlog.md` before claiming full original-app parity. Real teacher/student usability, broader migration/engine compatibility, arbitrary table layouts and phone scanning remain open.
