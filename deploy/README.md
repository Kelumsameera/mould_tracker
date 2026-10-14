# Ubuntu NUC deployment

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
