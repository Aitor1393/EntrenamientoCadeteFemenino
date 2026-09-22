#!/usr/bin/env bash
# Arma en _sitio/ lo único que se publica.
#
# Lo usan igual la Action de validación y la compilación de Cloudflare Pages,
# para que no haya dos listas de «qué se publica» que puedan separarse.
#
# Fuera se quedan fuentes/, scripts/ y pruebas/. No hacen falta para que la web
# funcione, y fuentes/ contiene los documentos de trabajo del entrenador: no
# tienen por qué ser descargables desde la dirección que se le pasa a nadie.
set -euo pipefail

raiz="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$raiz"

rm -rf _sitio
mkdir -p _sitio
cp -r index.html assets data _sitio/
cp _headers _sitio/
touch _sitio/.nojekyll

echo "Se publica:"
find _sitio -type f | sort
echo "Total: $(du -sh _sitio | cut -f1)"
