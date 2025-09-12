#!/bin/bash

# Script pour démarrer le frontend News Agent

echo "🚀 Démarrage du frontend News Agent..."

cd frontend

# Vérifier si node_modules existe
if [ ! -d "node_modules" ]; then
    echo "📦 Installation des dépendances..."
    npm install --legacy-peer-deps
fi

echo "🏁 Démarrage du serveur de développement..."
npm run dev -- --host 0.0.0.0 --port 3000

echo "✨ Frontend disponible sur http://localhost:3000"