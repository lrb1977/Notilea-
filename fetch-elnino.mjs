// fetch-elnino.mjs
// Trae siempre el MISMO feed de Google Noticias (búsqueda fija sobre
// El Niño 2026 en Sudamérica) y genera elnino.json. Lo corre un workflow
// de GitHub Actions cada 2 días.

import Parser from "rss-parser";
import { writeFile } from "node:fs/promises";

const QUERY = 'El Niño 2026 Sudamérica clima';
const FEED_URL =
  `https://news.google.com/rss/search?q=${encodeURIComponent(QUERY)}&hl=es-419&gl=US&ceid=US:es-419`;

const SOURCE_DOMAINS = {
  "Infobae": "infobae.com",
  "Wikipedia": "es.wikipedia.org",
  "La Nación": "lanacion.com.py",
  "abc.com.py": "abc.com.py",
  "Diario HOY": "hoy.com.py",
  "El Universo": "eluniverso.com",
  "El Comercio": "elcomercio.com",
  "El Tiempo": "eltiempo.com",
  "La Tercera": "latercera.com",
  "El Mercurio": "emol.com",
  "RPP Noticias": "rpp.pe",
  "Meteored": "meteored.com"
};

function splitTitleSource(rawTitle) {
  const idx = rawTitle.lastIndexOf(" - ");
  if (idx === -1) return { title: rawTitle, source: "Google Noticias" };
  return {
    title: rawTitle.slice(0, idx).trim(),
    source: rawTitle.slice(idx + 3).trim()
  };
}

async function fetchFeedWithRetry(parser, url, tries = 4) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      return await parser.parseURL(url);
    } catch (err) {
      lastErr = err;
      const wait = 1500 * (i + 1);
      console.log(`Intento ${i + 1} falló (${err.message}). Reintentando en ${wait}ms...`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

async function main() {
  const parser = new Parser({
    customFields: { item: ["source"] },
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "application/rss+xml, application/xml;q=0.9, */*;q=0.8",
      "Accept-Language": "es-419,es;q=0.9"
    }
  });

  const feed = await fetchFeedWithRetry(parser, FEED_URL);

  const items = (feed.items || []).slice(0, 15).map((item) => {
    const fallback = splitTitleSource(item.title || "");
    const sourceName =
      (typeof item.source === "string" && item.source.trim()) ||
      fallback.source;
    return {
      title: fallback.title || item.title || "",
      link: item.link,
      source: sourceName,
      sourceDomain: SOURCE_DOMAINS[sourceName] || null,
      pubDate: item.pubDate || null
    };
  });

  const payload = {
    generatedAt: new Date().toISOString(),
    feedUrl: FEED_URL,
    items
  };

  await writeFile("elnino.json", JSON.stringify(payload, null, 2) + "\n");
  console.log(`elnino.json actualizado con ${items.length} noticias.`);
}

main().catch((err) => {
  console.error("Error al generar elnino.json:", err);
  process.exit(1);
});
