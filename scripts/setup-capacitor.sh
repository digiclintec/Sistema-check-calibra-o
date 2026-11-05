#!/bin/bash
# ============================================================
# Script de Ativação do Standby: APK Nativo Android com Capacitor
# CalibraCheck - Digiclintec
# ============================================================

set -e

echo "🚀 Iniciando configuração do ambiente Nativo Android (Capacitor)..."

# 1. Instala dependências do Capacitor e plugins de câmera nativa
echo "📦 Instalando pacotes do Capacitor e plugins de hardware..."
npm install @capacitor/core @capacitor/android @capacitor/camera @capacitor-community/barcode-scanner
npm install -D @capacitor/cli

# 2. Build de produção do Vite
echo "🔨 Compilando aplicação web (dist)..."
npm run build

# 3. Adiciona a plataforma Android nativa caso não exista
if [ ! -d "android" ]; then
  echo "📱 Adicionando plataforma Android..."
  npx cap add android
fi

# 4. Sincroniza arquivos web e plugins com o Android Studio
echo "🔄 Sincronizando projeto nativo..."
npx cap sync android

echo "✅ Ambiente Nativo Android preparado com sucesso!"
echo "👉 Para abrir no Android Studio e gerar o APK: npx cap open android"
