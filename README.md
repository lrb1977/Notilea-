# Notilea

Portal de noticias estático (GitHub Pages) que se actualiza solo todos los días
desde el mismo topic de Google Noticias.

## Archivos
- `index.html` — la página (diseño futurista, lee `news.json`)
- `news.json` — noticias del día (lo regenera el workflow)
- `scripts/fetch-news.mjs` — descarga el RSS del topic y arma `news.json`
- `.github/workflows/update-news.yml` — corre el script todos los días

## Activar la actualización automática
1. Subí **todos** estos archivos y carpetas a la raíz de `lrb1977/notilea`
   (incluida la carpeta `.github/`).
2. En el repo: **Settings → Actions → General → Workflow permissions** →
   elegí **"Read and write permissions"** y guardá.
3. Andá a la pestaña **Actions → "Actualizar noticias Notilea" → Run workflow**
   para generar el primer `news.json` real con noticias y enlaces actuales.
4. A partir de ahí corre solo, todos los días a las 05:00 (hora Paraguay).

## Activar GitHub Pages
Settings → Pages → Source: **Deploy from a branch** → Branch **main** / **root** → Save.
