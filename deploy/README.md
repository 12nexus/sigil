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
cp .env.example .env          # then set GEMINI_API_KEY
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

**SIGIL ships with no authentication.** On a public domain with a server-side
Gemini key, anyone who finds the URL can spend your API quota. nginx applies a
30 requests/minute per-IP limit to `/api/gemini/*` as a floor, but that is a
brake, not a lock.

To require a password:

```bash
sudo apt-get install -y apache2-utils
sudo htpasswd -c /etc/nginx/.sigil-htpasswd yourname
sudo sed -i 's|# auth_basic |auth_basic |g' /etc/nginx/sites-available/sigil
sudo nginx -t && sudo systemctl reload nginx
```

To run with no server key at all — every visitor then supplies their own key in
Settings — leave `GEMINI_API_KEY` empty in `.env`. The app degrades cleanly and
tells the user what to do.

## Where the data lives

Projects and generated artwork live in each visitor's own browser (IndexedDB).
The container is stateless: rebuilding or replacing it loses nothing, and no
client's work is stored on the server.
