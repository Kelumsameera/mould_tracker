# Ubuntu NUC deployment

## Current NUC installation: managed by Coolify

The live installation is in Coolify under **Mould Tracker / production / Tool
Tracker**, at https://tools.192.168.0.116.sslip.io:8444. Start, stop and redeploy it through Coolify.
Install the LAN certificate using [LOCAL-HTTPS.md](LOCAL-HTTPS.md). Port 8081
redirects to HTTPS and serves public certificate downloads.
Do not start a second copy with the standalone commands below on this NUC.

Coolify configuration directory:
`/data/coolify/services/tt0rylhzn4ipcgbjqjdrrmcu`.
Source code and supporting config files remain at `/home/flexi/apps/tool-tracker`
(also accessible through `/home/flexi/Tool-Tracker`). The imported service uses the
existing local images `tool-tracker-backend:latest` and `tool-tracker-frontend:latest`.
For a code update, build those images from the source folder, then redeploy from
Coolify. Secrets are stored in Coolify environment settings.

The external MongoDB volumes `tool-tracker_mongo-data` and
`tool-tracker_mongo-config` were preserved during migration. Do not delete these
volumes. A migration backup is stored at
`/home/flexi/apps/tool-tracker/backups/before-coolify-migration.archive.gz`.

## Passkeys and role permissions

Admin manages users and all tool actions. Operator can add, edit and move tools.
Viewer can only read tools, machines and history. Every protected request reads
the user's current role and active status from MongoDB, so existing sessions do
not keep old permissions after a role change or account disablement.

Users can add passkeys from the sidebar after entering their current password,
and use fingerprint, Face ID or a device PIN to sign in. Only public credential
keys are stored on the server. Password login remains available for recovery.

Passkeys require a trusted HTTPS hostname. This NUC now uses the local HTTPS
configuration described in [LOCAL-HTTPS.md](LOCAL-HTTPS.md). For another server,
configure a trusted HTTPS route for this service, then set these
backend environment settings (or use the root .env for standalone deployments):

```dotenv
WEBAUTHN_ORIGIN=https://tools.example.com
WEBAUTHN_RP_ID=tools.example.com
CORS_ORIGIN=https://tools.example.com
COOKIE_SECURE=true
```

For standalone Compose, set APP_ORIGIN instead of CORS_ORIGIN. The origin must
match the actual browser URL exactly, with no trailing slash. A local CA must be
trusted by each client device when using local HTTPS. A browser certificate
warning bypass is not sufficient. Do not change the RP hostname after enrolling
passkeys without planning re-enrollment.

Until HTTPS is configured, biometric controls show the HTTPS requirement and
password authentication continues to work. For development only,
WEBAUTHN_ORIGIN=http://localhost:3000 and WEBAUTHN_RP_ID=localhost are supported.

Backend authentication tests: `cd backend && npm test`.

## Standalone installation commands

Install Docker Engine and the Compose plugin using the official Ubuntu guide:
https://docs.docker.com/engine/install/ubuntu/

Copy this project to the NUC, excluding node_modules, .next and all .env files.
Run the following from the project root on the NUC:

```sh
cp .env.production.example .env
chmod 600 .env
nano .env
```

Generate separate MONGO_ROOT_PASSWORD, MONGO_APP_PASSWORD and JWT_SECRET values
with `openssl rand -hex 32`. Use hex passwords so the application password is safe
in a MongoDB connection URI. Keep secrets on the server, outside Git. Keep database
passwords unchanged when upgrading an existing installation.

APP_ORIGIN must match the browser URL, including its port. The LAN default is
http://192.168.0.116:8081. Change HTTP_PORT if port 8081 is already occupied.

```sh
sudo docker compose up -d --build
sudo docker compose ps
curl --fail http://localhost:8081/api/health
```

Open http://192.168.0.116:8081 from a device on the same LAN. Nginx sends /api/
requests to Express and other requests to Next.js, keeping login cookies on one
origin. Only the Nginx port is published. MongoDB runs on an internal Docker network
with authentication, a single-node replica set for transactions, and persistent
mongo-data and mongo-config volumes. Containers restart automatically after Docker
starts on reboot. Atlas data is not automatically copied into this new database.
MongoDB 7.0 is used because MongoDB 8.0 is incompatible with this NUC's Linux
7.0.0 kernel. Do not upgrade the database major version without checking kernel
compatibility and making a backup first.

Do not use `docker compose down -v`: it deletes persistent database volumes.
Back up the local database regularly and before upgrades:

```sh
mkdir -p backups
chmod 700 backups
sudo docker compose exec -T --interactive=false mongo bash -c 'mongodump --username root --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --archive --gzip' > "backups/tooltracker-$(date +%F-%H%M%S).archive.gz"
```

If npm downloads are blocked on this network, set NPM_REGISTRY to an accessible
registry in the root .env; the default is https://registry.npmjs.org. Dependencies
remain pinned and integrity checked by package-lock.json.

Do not run the seed command against an existing populated database as part of
deployment. For a new database only, `sudo docker compose exec backend npm run seed`
creates the documented default admin account and sample tools; change the admin
password immediately through the app.

Inspect logs with `sudo docker compose logs --tail=100`. After uploading updates,
run `sudo docker compose up -d --build` again.

Public access requires a domain and HTTPS reverse proxy configuration. Set
APP_ORIGIN to the HTTPS URL and COOKIE_SECURE=true for that setup.
