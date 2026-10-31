---
title: Deployment
description: Production stack, environment, release and rollback
audience: IT, developers
last_verified: 2026-10-29
app_version: "web/API 2.0.0; native 2.2.0"
status: Verified from compose.yaml and deploy/README.md; not executed in this pass
---

# Deployment

The authoritative step-by-step guide is [`deploy/README.md`](../../deploy/README.md), with HTTPS in [`deploy/LOCAL-HTTPS.md`](../../deploy/LOCAL-HTTPS.md). This page summarises them.

## Stack (`compose.yaml`)
| Service | Image | Role |
|---|---|---|
| mongo | mongo:7.0 | Replica set `rs0`, keyfile auth, internal network only |
| mongo-init | mongo:7.0 | Creates the app user (one-shot) |
| backend | ./backend | API on 4000, health check `/api/health` must report `connected` |
| frontend | ./frontend | Next.js |
| proxy | nginx:stable-alpine | Port `${HTTP_PORT:-8081}` → 80 |

Volumes `mongo-data`, `mongo-config`. **Never delete these volumes.**

> ⚠️ **Risk:** `compose.yaml` declares no volume for the backend's `/app/uploads` (item and work-log pictures, created in `backend/Dockerfile`). Unless the Coolify service adds one, pictures are lost when the backend container is recreated. Confirm this; see [GAPS](../analysis/GAPS-AND-QUESTIONS.md) Q1.

## Current production
Managed by **Coolify** on the factory server. Build the backend/frontend images from the source folder, then redeploy in Coolify. Secrets live in the Coolify environment settings. Do not start a second standalone copy. (The host, paths and URL are in `deploy/README.md`; they are not repeated here.)

## Release procedure
1. Run `npm test` in `backend` and `frontend`; run `npm run build` in `frontend`.
2. **Back up the database** (see [Operations](../administration/operations-and-recovery.md)).
3. Run any required migration as a dry run, then with `--apply`.
4. Build the images and redeploy.
5. Check `/api/health` and sign in.

## Rollback
Redeploy the previous images. The data model is append-only, so code rollback does not need data rollback unless a migration ran; then restore the backup taken in step 2.

## Native shells
- Windows: `native/desktop` → `npm ci && npm run dist:win` (unsigned NSIS installer).
- Android: `python native/android/build.py` (Java 21, Android SDK). The signing key is kept outside the repo; **back it up**.
- Bump the version for shell updates. Web UI updates need no reinstall.
