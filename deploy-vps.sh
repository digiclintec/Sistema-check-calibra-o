#!/usr/bin/env bash

# Script de deploy rápido para VPS
# Uso: ./deploy-vps.sh <usuario@ip_da_vps> [diretorio_remoto]
# Exemplo: ./deploy-vps.sh root@164.92.100.50 /var/www/calibracheck

set -e

REMOTE_TARGET="$1"
REMOTE_DIR="${2:-/var/www/calibracheck}"

if [ -z "$REMOTE_TARGET" ]; then
  echo "❌ Erro: Informe o usuário e IP da VPS."
  echo "👉 Uso: ./deploy-vps.sh usuario@ip [caminho_no_servidor]"
  echo "Exemplo: ./deploy-vps.sh root@192.168.1.100 /var/www/calibracheck"
  exit 1
fi

echo "📦 1/3. Compilando o frontend localmente..."
npm run build

echo "🚀 2/3. Enviando arquivos para a VPS ($REMOTE_TARGET:$REMOTE_DIR)..."
# Garante que o diretório remoto existe
ssh -o StrictHostKeyChecking=no "$REMOTE_TARGET" "mkdir -p $REMOTE_DIR"

# Sincroniza via rsync ignorando node_modules e arquivos desnecessários
rsync -avz --progress \
  --exclude="node_modules" \
  --exclude=".git" \
  --exclude=".DS_Store" \
  --exclude="data/db.json" \
  ./ "$REMOTE_TARGET:$REMOTE_DIR/"

echo "⚙️ 3/3. Instalando dependências e iniciando processo na VPS..."
ssh "$REMOTE_TARGET" << EOF
  cd $REMOTE_DIR
  npm install --omit=dev
  mkdir -p data

  # Se tiver PM2 instalado, reinicia ou inicia
  if command -v pm2 > /dev/null; then
    pm2 restart calibracheck || pm2 start ecosystem.config.cjs
    pm2 save
    echo "✅ CalibraCheck rodando com PM2 na porta 3000!"
  else
    echo "⚠️ PM2 não encontrado. Para rodar em background 24/7, instale com: npm i -g pm2"
    echo "👉 Para iniciar manualmente na VPS: cd $REMOTE_DIR && npm start"
  fi
EOF

echo ""
echo "🎉 Deploy concluído com sucesso!"
echo "Acesse: http://${REMOTE_TARGET#*@}:3000"

