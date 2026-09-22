#!/usr/bin/env bash
# Sirve el visor de Édito A1 en http://localhost:8080
# Usa Node para tener soporte de Range (búsqueda dentro de los audios).
cd "$(dirname "$0")"
PORT="${PORT:-8080}"

if command -v node >/dev/null 2>&1; then
  echo "Abriendo Édito A1 en http://localhost:${PORT}"
  exec node serve.js
else
  echo "Node no encontrado; usando python3 (sin búsqueda dentro del audio)."
  echo "Abriendo Édito A1 en http://localhost:${PORT}"
  exec python3 -m http.server "$PORT"
fi
