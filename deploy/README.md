# Deploying SIGIL

The production setup is a single Docker container behind the host's nginx.
nginx terminates TLS and proxies to the container on `127.0.0.1:3210`, so the
app is never directly reachable from the internet on its own port.

```
internet ──▶ nginx :443 (TLS, rate limit) ──▶ 127.0.0.1:3210 ──▶ sigil container
```

## First install

```bash
sudo mkdir -p /opt/sigil && sudo chown "$USER":"$USER" /opt/sigil
git clone https://github.com/shozibabbas/sigil.git /opt/sigil
cd /opt/sigil
cp .env.example .env          # then set GEMINI_API_KEY and the SIGIL_AUTH_* credentials
./deploy/deploy.sh
```

The script builds the image, starts the container, installs the nginx site,
requests a Let's Encrypt certificate, and verifies the app answers. It is
idempotent — run it again for every update.

## Updating

```bash
cd /opt/sigil && git pull && ./deploy/deploy.sh
```

## Operating

```bash
sudo docker compose ps                  # status
sudo docker compose logs -f sigil       # follow logs
sudo docker compose restart sigil       # restart
sudo docker compose down                # stop
```

## Access control

**Every page and API route requires sign-in.** Credentials come from `.env`:

```bash
SIGIL_AUTH_USERNAME=yourname
SIGIL_AUTH_PASSWORD=a-long-random-password
SIGIL_AUTH_SECRET=$(openssl rand -base64 32)   # optional
```

`docker compose` and `deploy.sh` both refuse to start without the username and
password. Changing the password (or the secret) and re-running `deploy.sh`
signs every existing session out. nginx limits `/api/auth/login` to 5
attempts/minute per IP, and `/api/gemini/*` to 30 requests/minute per IP.

To run with no server key at all — every visitor then supplies their own key in
Settings — leave `GEMINI_API_KEY` empty in `.env`. The app degrades cleanly and
tells the user what to do.

## Where the data lives

Projects and generated artwork live in each visitor's own browser (IndexedDB).
The container is stateless: rebuilding or replacing it loses nothing, and no
client's work is stored on the server.
