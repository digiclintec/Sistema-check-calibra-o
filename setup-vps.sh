#!/usr/bin/env bash
# ============================================================
#  CalibraCheck - Deploy completo na VPS (100% via terminal)
#
#  Uso (rodar no Mac, dentro da pasta do projeto):
#    ./setup-vps.sh <usuario@ip_da_vps> <dominio> [email_para_ssl]
#
#  Exemplo:
#    ./setup-vps.sh root@164.92.100.50 calibra.meudominio.com.br digiclintec@gmail.com
#
#  O que ele faz:
#    1. Compila o frontend localmente
#    2. Envia os arquivos para a VPS (rsync)
#    3. Instala Node 20, PM2, Nginx e Certbot (se faltarem)
#    4. Sobe o app numa porta livre com PM2 (reinicia sozinho)
#    5. Cria o site no Nginx para o domínio
#    6. Gera certificado HTTPS (necessário para a câmera no celular)
# ============================================================
set -e

TARGET="$1"
DOMAIN="$2"
EMAIL="${3:-digiclintec@gmail.com}"
REMOTE_DIR="/var/www/calibracheck"

if [ -z "$TARGET" ] || [ -z "$DOMAIN" ]; then
  echo "Uso: ./setup-vps.sh usuario@ip dominio [email]"
  echo "Ex.: ./setup-vps.sh root@164.92.100.50 calibra.meudominio.com.br"
  exit 1
fi

echo "==> 1/3 Compilando frontend..."
npm run build

echo "==> 2/3 Enviando arquivos para $TARGET:$REMOTE_DIR ..."
ssh -o StrictHostKeyChecking=accept-new "$TARGET" "mkdir -p $REMOTE_DIR/data"
rsync -az --delete --progress \
  --exclude="node_modules" \
  --exclude=".git" \
  --exclude=".DS_Store" \
  --exclude="data/" \
  ./ "$TARGET:$REMOTE_DIR/"

echo "==> 3/3 Configurando servidor..."
ssh "$TARGET" "bash -s -- '$DOMAIN' '$REMOTE_DIR' '$EMAIL'" << 'REMOTE'
set -e
DOMAIN="$1"; DIR="$2"; EMAIL="$3"
SUDO=""; [ "$(id -u)" -ne 0 ] && SUDO="sudo"
export DEBIAN_FRONTEND=noninteractive

# --- Node.js 20 ---
if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 18 ]; then
  echo "   - Instalando Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO bash - >/dev/null
  $SUDO apt-get install -y nodejs >/dev/null
fi

# --- PM2 ---
command -v pm2 >/dev/null || { echo "   - Instalando PM2..."; $SUDO npm i -g pm2 >/dev/null; }

# --- Quem está usando a porta 80? ---
P80=$($SUDO ss -tlnp 2>/dev/null | grep -E ':80\s' | head -1 || true)
if [ -n "$P80" ] && ! echo "$P80" | grep -q nginx; then
  echo ""
  echo "!! A porta 80 está ocupada por outro programa (não é Nginx):"
  echo "   $P80"
  echo "!! Provavelmente um painel (Easypanel/Coolify/Traefik/Docker)."
  echo "!! O app será iniciado, mas o domínio precisa ser configurado nesse painel."
  NO_NGINX=1
fi

# --- Nginx + Certbot ---
if [ -z "$NO_NGINX" ]; then
  command -v nginx >/dev/null || { echo "   - Instalando Nginx..."; $SUDO apt-get update -y >/dev/null; $SUDO apt-get install -y nginx >/dev/null; }
  command -v certbot >/dev/null || { echo "   - Instalando Certbot..."; $SUDO apt-get install -y certbot python3-certbot-nginx >/dev/null; }
fi

# --- Dependências do app ---
cd "$DIR"
npm install --omit=dev --no-audit --no-fund >/dev/null

# --- Escolhe porta livre (começa na 3010) ---
pm2 delete calibracheck >/dev/null 2>&1 || true
PORT=3010
while $SUDO ss -tln | grep -qE ":$PORT\s"; do PORT=$((PORT+1)); done
echo "   - App vai rodar na porta interna $PORT"

PORT=$PORT pm2 start server.js --name calibracheck --update-env >/dev/null
pm2 save >/dev/null
$SUDO env PATH=$PATH pm2 startup systemd -u "$(whoami)" --hp "$HOME" >/dev/null 2>&1 || true

sleep 2
if ! curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PORT" | grep -q 200; then
  echo "!! O app não respondeu. Logs:"; pm2 logs calibracheck --lines 30 --nostream; exit 1
fi
echo "   - App respondendo OK em 127.0.0.1:$PORT"

[ -n "$NO_NGINX" ] && { echo ""; echo ">> Aponte o domínio $DOMAIN no seu painel para a porta $PORT."; exit 0; }

# --- Site no Nginx ---
CONF="/etc/nginx/sites-available/$DOMAIN"
$SUDO tee "$CONF" >/dev/null << NGINX
server {
    listen 80;
    server_name $DOMAIN;
    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX
$SUDO ln -sf "$CONF" "/etc/nginx/sites-enabled/$DOMAIN"
$SUDO nginx -t && $SUDO systemctl reload nginx
echo "   - Nginx configurado para $DOMAIN"

# --- Confere DNS antes do SSL ---
VPS_IP=$(curl -s -4 ifconfig.me || true)
DNS_IP=$(getent ahostsv4 "$DOMAIN" | awk '{print $1; exit}' || true)
if [ "$VPS_IP" != "$DNS_IP" ]; then
  echo ""
  echo "!! DNS ainda não aponta para esta VPS."
  echo "   Domínio $DOMAIN -> ${DNS_IP:-(nada)} | IP da VPS -> $VPS_IP"
  echo "   Crie um registro A: $DOMAIN -> $VPS_IP, espere propagar e rode:"
  echo "   sudo certbot --nginx -d $DOMAIN --redirect -m $EMAIL --agree-tos -n"
  echo ""
  echo ">> Por enquanto acesse: http://$DOMAIN"
  exit 0
fi

# --- HTTPS ---
$SUDO certbot --nginx -d "$DOMAIN" --redirect -m "$EMAIL" --agree-tos -n
echo ""
echo "======================================================"
echo "  PRONTO!  https://$DOMAIN"
echo "======================================================"
REMOTE

