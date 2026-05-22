#!/bin/bash
# ============================================================
#  IKLAN CUAN - Auto Install Script untuk VPS Ubuntu/Debian
#  Jalankan: bash install.sh
# ============================================================

set -e

APP_NAME="iklancuan"
APP_DIR="/var/www/$APP_NAME"
NGINX_CONF="/etc/nginx/sites-available/$APP_NAME"

echo ""
echo "======================================================"
echo "  IKLAN CUAN - Installer VPS"
echo "======================================================"
echo ""

# --- 1. Update sistem ---
echo "[1/7] Update sistem..."
apt-get update -qq

# --- 2. Install Node.js 20 ---
echo "[2/7] Install Node.js 20..."
if ! command -v node &> /dev/null || [[ $(node -v | cut -d'v' -f2 | cut -d'.' -f1) -lt 18 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
  apt-get install -y nodejs > /dev/null 2>&1
fi
echo "    Node.js: $(node -v)"

# --- 3. Install pnpm ---
echo "[3/7] Install pnpm..."
if ! command -v pnpm &> /dev/null; then
  npm install -g pnpm --silent
fi
echo "    pnpm: $(pnpm -v)"

# --- 4. Install Nginx ---
echo "[4/7] Install Nginx..."
if ! command -v nginx &> /dev/null; then
  apt-get install -y nginx > /dev/null 2>&1
fi
echo "    Nginx: $(nginx -v 2>&1)"

# --- 5. Build aplikasi ---
echo "[5/7] Install dependencies & build..."

# Cek apakah kode ada di direktori saat ini
if [ ! -f "package.json" ]; then
  echo ""
  echo "  ERROR: File package.json tidak ditemukan."
  echo "  Pastikan Anda sudah mengupload kode ke direktori ini."
  echo "  Petunjuk:"
  echo "    1. Download kode dari Enter.pro (tombol Download Code)"
  echo "    2. Upload ZIP ke VPS lalu extract:"
  echo "       unzip kode.zip -d /tmp/app && cd /tmp/app && bash install.sh"
  echo ""
  exit 1
fi

pnpm install --silent
pnpm build

echo "    Build selesai: $(ls dist/ | wc -l) file"

# --- 6. Deploy ke /var/www ---
echo "[6/7] Deploy ke $APP_DIR..."
rm -rf "$APP_DIR"
mkdir -p "$APP_DIR"
cp -r dist/. "$APP_DIR/"
chown -R www-data:www-data "$APP_DIR"

# --- 7. Konfigurasi Nginx ---
echo "[7/7] Konfigurasi Nginx..."

# Tanya domain/IP
echo ""
read -p "  Masukkan domain atau IP server Anda (contoh: 103.175.218.218): " SERVER_NAME
SERVER_NAME=${SERVER_NAME:-"_"}

cat > "$NGINX_CONF" << EOF
server {
    listen 80;
    listen [::]:80;
    server_name $SERVER_NAME;

    root $APP_DIR;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA fallback - semua route ke index.html
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header X-XSS-Protection "1; mode=block";
}
EOF

# Aktifkan site
ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/$APP_NAME 2>/dev/null || true
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

# Test dan reload Nginx
nginx -t 2>/dev/null
systemctl restart nginx
systemctl enable nginx > /dev/null 2>&1

echo ""
echo "======================================================"
echo "  INSTALASI SELESAI!"
echo "======================================================"
echo ""
echo "  Aplikasi berjalan di: http://$SERVER_NAME"
echo "  Direktori app      : $APP_DIR"
echo "  Config Nginx       : $NGINX_CONF"
echo ""
echo "  Update aplikasi di masa depan:"
echo "    cd [folder kode] && pnpm build && cp -r dist/. $APP_DIR/"
echo ""

# Opsional: pasang SSL dengan Certbot
if [[ "$SERVER_NAME" != "_" && "$SERVER_NAME" != "localhost" && ! "$SERVER_NAME" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "  Untuk pasang HTTPS gratis (Let's Encrypt):"
  echo "    apt install certbot python3-certbot-nginx -y"
  echo "    certbot --nginx -d $SERVER_NAME"
  echo ""
fi
