#!/usr/bin/env bash
# Script de Atualização Rápida do CalibraCheck na VPS
set -e

echo "=========================================="
echo "🚀 Atualizando CalibraCheck Digiclintec..."
echo "=========================================="

cd /var/www/calibracheck

echo "📥 1/4 - Baixando últimas atualizações do GitHub..."
git fetch origin main
git reset --hard origin/main

echo "📦 2/4 - Verificando dependências..."
npm install

echo "🔨 3/4 - Compilando frontend otimizado..."
npm run build

echo "🔄 4/4 - Reiniciando servidor CalibraCheck..."
pm2 restart calibracheck || pm2 start ecosystem.config.cjs

echo "=========================================="
echo "✅ CalibraCheck atualizado com sucesso!"
echo "🌐 Acesse: https://calibracao.helpclintec.com.br"
echo "=========================================="
pm2 status
