# SafeShare: Secure Document Sharing Portal (MERN)

Fine-grained access control, per-file encryption, document versioning, and a tamper-evident audit trail.

## Run it (5 minutes)
Requirements: Node 18+, MongoDB running locally (or an Atlas URI in `server/.env`).

```bash
npm run install:all
npm run seed          # loads demo users + sample files
npm run server        # terminal 1 -> http://localhost:5000
npm run client        # terminal 2 -> http://localhost:5173
```

Demo logins (password in brackets): admin@safeshare.com (Admin@123), alice@safeshare.com / bob@safeshare.com / carol@safeshare.com (Pass@1234)

## Architecture
React (Vite) -> REST /api -> Express -> MongoDB (metadata) + encrypted blobs on disk (`server/storage`)

| Requirement | How it is built |
|---|---|
| Encryption | AES-256-GCM, a fresh data key per file version, wrapped by `MASTER_KEY` (envelope encryption). GCM auth tag detects tampering. |
| Access control | Roles per file: owner / editor / viewer, plus `canDownload` flag and optional expiry per grant. Unauthorised files return 404 (no existence leak). Admins manage people and audit but cannot read others' files. |
| Versioning | Every upload creates an immutable version with SHA-256 checksum. Restore creates a new version, so history is never rewritten. |
| Auditing | Every view, download, share, denial, login and failure is logged. Entries are hash-chained (each stores the hash of the previous), verified by `GET /api/audit/verify`. |
| Share links | Random 192-bit token, expiry, optional password (bcrypt), download limit, revocable. |
| Hardening | bcrypt(12), JWT 8h, account lockout after 5 failures, rate limiting, helmet, upload size cap, sandboxed preview CSP, soft-delete trash, secure shredding of ciphertext on permanent delete. |

## 10-minute demo script
1. Login screen: show the live "sealing" animation. Sign in as **Alice**.
2. Overview: stats, 7-day activity chart. Open **Q3-Budget-Forecast.csv**.
3. Versions tab: 3 versions with checksums. Preview v1, **Restore** v1, see v4 appear.
4. Access tab: share with a new user as *viewer, no download*. Add an expiry.
5. Links tab: create a link with password + max 1 download. Open it in a private window (`/s/<token>`), download, then retry: it is exhausted.
6. Open another browser as **Carol** (view-only): Preview works, no Download button; calling the API directly returns 403 and is logged.
7. As Alice, Activity tab: every action by every person.
8. Login as **Admin** -> Activity log -> **Verify log integrity** (green). Then in MongoDB edit one audit row and verify again: tampering is detected at that entry.
9. Show `server/storage/*.enc`: unreadable ciphertext on disk.

## Deploy to Render

You can deploy SafeShare directly to [Render](https://render.com) as a single Web Service:

1. **Create a Web Service** on Render and connect your GitHub repository (`nivethaselvam-2411/safeshare`).
2. Set the following configuration:
   - **Environment**: `Node`
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/api/health`
3. Add the **Environment Variables**:
   - `NODE_ENV`: `production`
   - `MONGO_URI`: Your MongoDB Atlas connection string (e.g., `mongodb+srv://<user>:<password>@cluster0.mongodb.net/safeshare?retryWrites=true&w=majority`)
   - `JWT_SECRET`: A long random secret key
   - `MASTER_KEY`: A separate long random secret key (used for envelope encryption)
   - `MAX_FILE_MB`: `25`
4. (Optional) Run `npm run seed` from the Render Shell tab if you want to preload demo accounts and files.

Alternatively, if using Render Blueprints, Render will automatically detect the included `render.yaml`.

## Production notes
Use a KMS (AWS KMS / Vault) for `MASTER_KEY`, S3 + SSE for blobs, HTTPS only, refresh tokens/httpOnly cookies, antivirus scanning on upload, and streamed (chunked) encryption for very large files.
