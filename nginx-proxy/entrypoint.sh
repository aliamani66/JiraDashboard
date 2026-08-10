#!/bin/sh
set -e

SSL_DIR="/etc/nginx/ssl"
CERT="$SSL_DIR/server.crt"
KEY="$SSL_DIR/server.key"

# اگر سرتیفیکیت وجود نداشت، یکی بساز
if [ ! -f "$CERT" ] || [ ! -f "$KEY" ]; then
    echo ">>> [SSL] Generating self-signed certificate..."
    mkdir -p "$SSL_DIR"
    openssl req -x509 -nodes \
        -days 3650 \
        -newkey rsa:2048 \
        -keyout "$KEY" \
        -out "$CERT" \
        -subj "/C=IR/ST=Tehran/L=Tehran/O=JiraDashboard/OU=IT/CN=localhost"
    echo ">>> [SSL] Certificate generated successfully."
else
    echo ">>> [SSL] Certificate already exists, skipping generation."
fi

# اجرای nginx
exec "$@"
