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
echo "  ✓ .env present with a key"

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

# ── 3. nginx ─────────────────────────────────────────────────────────
echo "▸ Installing nginx site"
sudo cp "$APP_DIR/deploy/sigil.nginx" "/etc/nginx/sites-available/$SITE_NAME"
sudo ln -sf "/etc/nginx/sites-available/$SITE_NAME" "/etc/nginx/sites-enabled/$SITE_NAME"

# Certbot has not run yet on a first install, so the ssl directives would
# point at a certificate that does not exist. Serve plain HTTP until then.
if [[ ! -d "/etc/letsencrypt/live/$DOMAIN" ]]; then
  echo "  ! No certificate yet — installing a temporary HTTP-only site"
  sudo tee "/etc/nginx/sites-available/$SITE_NAME" >/dev/null <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;
    location /.well-known/acme-challenge/ { root /var/www/html; }
    location / {
        proxy_pass http://127.0.0.1:3210;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
    }
}
NGINX
fi

sudo mkdir -p /var/www/html
sudo nginx -t
sudo systemctl reload nginx
echo "  ✓ nginx reloaded"

# ── 4. TLS ───────────────────────────────────────────────────────────
if [[ ! -d "/etc/letsencrypt/live/$DOMAIN" ]]; then
  echo "▸ Requesting a certificate for $DOMAIN"
  sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos \
    --register-unsafely-without-email --redirect || {
      echo "! certbot failed — the site is still served over HTTP."
      echo "  Check that $DOMAIN resolves to this machine, then re-run."
    }
  # Re-apply the full config now that the certificate exists, so the
  # rate limits and proxy timeouts are not lost to certbot's rewrite.
  if [[ -d "/etc/letsencrypt/live/$DOMAIN" ]]; then
    sudo cp "$APP_DIR/deploy/sigil.nginx" "/etc/nginx/sites-available/$SITE_NAME"
    sudo sed -i "s|listen 443 ssl;|listen 443 ssl;\n    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;\n    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;\n    include /etc/letsencrypt/options-ssl-nginx.conf;\n    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;|" \
      "/etc/nginx/sites-available/$SITE_NAME"
    sudo nginx -t && sudo systemctl reload nginx
    echo "  ✓ TLS enabled"
  fi
else
  echo "  ✓ certificate already present"
fi

# ── 5. Verify ────────────────────────────────────────────────────────
echo "▸ Verifying"
sudo docker compose ps
STATUS=$(curl -sS -o /dev/null -w '%{http_code}' -H "Host: $DOMAIN" http://127.0.0.1/ || true)
echo "  local HTTP status: $STATUS"
echo
echo "✓ Deployed — https://$DOMAIN"
