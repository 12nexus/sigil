#!/usr/bin/env bash
#
# SIGIL — deploy / update on the host.
#
# Idempotent: safe to run for the first install and for every update after.
# Run from the repository root on the server:  ./deploy/deploy.sh
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOMAIN="${SIGIL_DOMAIN:-sigil.12nexusbpo.com}"
SITE_NAME="sigil"

cd "$APP_DIR"

echo "▸ SIGIL deploy — $DOMAIN"
echo "  directory: $APP_DIR"

# ── 1. Environment ───────────────────────────────────────────────────
if [[ ! -f .env ]]; then
  echo "✗ No .env file found."
  echo "  cp .env.example .env   then set GEMINI_API_KEY"
  exit 1
fi

if ! grep -qE '^GEMINI_API_KEY=.+' .env; then
  echo "✗ GEMINI_API_KEY is empty in .env"
  exit 1
fi
for var in SIGIL_AUTH_USERNAME SIGIL_AUTH_PASSWORD; do
  if ! grep -qE "^${var}=.+" .env; then
    echo "✗ $var is empty in .env — SIGIL will not start without sign-in credentials"
    exit 1
  fi
done
echo "  ✓ .env present with a key and sign-in credentials"

# ── 2. Build and start the container ─────────────────────────────────
echo "▸ Building image"
sudo docker compose --env-file .env build

echo "▸ Starting container"
sudo docker compose --env-file .env up -d --remove-orphans

echo "▸ Waiting for the app to answer"
for i in $(seq 1 60); do
  if curl -fsS -o /dev/null http://127.0.0.1:3210/api/gemini/status 2>/dev/null; then
    echo "  ✓ responding after ${i}s"
    break
  fi
  if [[ $i -eq 60 ]]; then
    echo "✗ App did not come up. Logs:"
    sudo docker compose logs --tail=50 sigil
    exit 1
  fi
  sleep 1
done

KEY_OK=$(curl -fsS http://127.0.0.1:3210/api/gemini/status | grep -c '"hasServerKey":true' || true)
if [[ "$KEY_OK" == "1" ]]; then
  echo "  ✓ server-side Gemini key detected"
else
  echo "  ! server key NOT detected — generation will fail"
fi

# ── 3. TLS certificate ───────────────────────────────────────────────
# `certonly --webroot` never edits nginx configuration, so the site file
# below is always exactly what this repository says it should be. Letting
# `certbot --nginx` rewrite the config instead would silently discard the
# rate limits and proxy timeouts on first install.
echo "▸ TLS certificate"
sudo mkdir -p /var/www/html

if [[ -d "/etc/letsencrypt/live/$DOMAIN" ]]; then
  echo "  ✓ certificate already present"
  HAVE_CERT=1
else
  # ACME needs port 80 answering for this host before the cert exists.
  echo "  installing a temporary HTTP-only site for the ACME challenge"
  sudo tee "/etc/nginx/sites-available/$SITE_NAME" >/dev/null <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;
    location /.well-known/acme-challenge/ { root /var/www/html; }
    location / { proxy_pass http://127.0.0.1:3210; proxy_set_header Host \$host; }
}
NGINX
  sudo ln -sf "/etc/nginx/sites-available/$SITE_NAME" "/etc/nginx/sites-enabled/$SITE_NAME"
  sudo nginx -t && sudo systemctl reload nginx

  echo "  requesting a certificate for $DOMAIN"
  if sudo certbot certonly --webroot -w /var/www/html -d "$DOMAIN" \
       --non-interactive --agree-tos --register-unsafely-without-email; then
    HAVE_CERT=1
    echo "  ✓ certificate issued"
  else
    HAVE_CERT=0
    echo "  ! certbot failed — the site will be served over plain HTTP."
    echo "    Check that $DOMAIN resolves to this machine, then re-run."
  fi
fi

# ── 4. nginx site ────────────────────────────────────────────────────
echo "▸ Installing nginx site"

if [[ "${HAVE_CERT:-0}" == "1" ]]; then
  sudo cp "$APP_DIR/deploy/sigil.nginx" "/etc/nginx/sites-available/$SITE_NAME"
  sudo sed -i \
    -e "s|__DOMAIN__|$DOMAIN|g" \
    -e "s|__SSL_CERT__|/etc/letsencrypt/live/$DOMAIN/fullchain.pem|" \
    -e "s|__SSL_KEY__|/etc/letsencrypt/live/$DOMAIN/privkey.pem|" \
    "/etc/nginx/sites-available/$SITE_NAME"
else
  # No certificate: keep the HTTP-only site already written above.
  echo "  serving HTTP only until a certificate exists"
fi

sudo ln -sf "/etc/nginx/sites-available/$SITE_NAME" "/etc/nginx/sites-enabled/$SITE_NAME"
sudo nginx -t
sudo systemctl reload nginx
echo "  ✓ nginx reloaded"

# ── 5. Verify ────────────────────────────────────────────────────────
echo "▸ Verifying"
sudo docker compose ps
STATUS=$(curl -sS -o /dev/null -w '%{http_code}' -H "Host: $DOMAIN" http://127.0.0.1/ || true)
echo "  local HTTP status: $STATUS"
echo
echo "✓ Deployed — https://$DOMAIN"
