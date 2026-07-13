// scripts/fetch-news.mjs
// Descarga DOS feeds fijos de Google Noticias, siempre los mismos enlaces:
//  1) El topic general de Paraguay (país / seguridad)
//  2) Una búsqueda dedicada a Nueva Asunción y Nanawa (Presidente Hayes),
//     que alimenta EXCLUSIVAMENTE la sección "Barrio".
// Lo ejecuta el workflow de GitHub Actions una vez al día.

import Parser from "rss-parser";
import { writeFile } from "node:fs/promises";

const FEED_URL =
  "https://news.google.com/rss/topics/CAAqLQgKIidDQkFTRndvTkwyY3ZNVEYwWDNKaWRITmZNUklHWlhNdE5ERTVLQUFQAQ?ceid=US:es-419&hl=es-419&gl=US";

// Búsqueda dedicada al barrio: Nueva Asunción y Nanawa, Presidente Hayes.
const LOCAL_QUERY = '("Nueva Asunción" OR Nanawa) Paraguay';
const LOCAL_FEED_URL =
  `https://news.google.com/rss/search?q=${encodeURIComponent(LOCAL_QUERY)}&hl=es-419&gl=PY&ceid=PY:es-419`;

// Dominio real de cada fuente, para poder mostrar su logo/favicon.
const SOURCE_DOMAINS = {
  "ABC Color": "abc.com.py",
  "abc.com.py": "abc.com.py",
  "La Nación": "lanacion.com.py",
  "Diario HOY": "hoy.com.py",
  "Diario HOY – En Paraguay y el Mundo": "hoy.com.py",
  "El Nacional": "elnacional.com.py",
  "Municipalidad de Asunción": "asuncion.gov.py",
  "InfoNegocios Paraguay": "infonegocios.com.py",
  "Telefuturo": "telefuturo.com.py",
  "MSPBS": "mspbs.gov.py",
  "Última Hora": "ultimahora.com",
  "ultimahora.com": "ultimahora.com",
  "5Días": "5dias.com.py",
  "Paraguay.com": "paraguay.com",
  "La Política Online": "lapoliticaonline.com"
};

const RULES = {
  seguridad: [
    "polic", "asalt", "detien", "detenc", "homicid", "asesin", "balacer",
    "robo", "hurt", "narco", "droga", "marihuana", "crimen", "fiscal",
    "desaparecid", "violen", "arma", "preso", "condena"
  ]
};

function guessCategory(title) {
  const t = title.toLowerCase();
  if (RULES.seguridad.some((k) => t.includes(k))) return "seguridad";
  return "pais";
}

function splitTitleSource(rawTitle) {
  // Google News suele dar "Titular - Medio"
  const idx = rawTitle.lastIndexOf(" - ");
  if (idx === -1) return { title: rawTitle, source: "Google Noticias" };
  return {
    title: rawTitle.slice(0, idx).trim(),
    source: rawTitle.slice(idx + 3).trim()
  };
}

function mapItem(item, category) {
  const fallback = splitTitleSource(item.title || "");
  const sourceName =
    (typeof item.source === "string" && item.source.trim()) ||
    fallback.source;
  const title = fallback.title || item.title || "";
  const domain = SOURCE_DOMAINS[sourceName] || null;

  return {
    title,
    link: item.link,
    source: sourceName,
    sourceDomain: domain,
    pubDate: item.pubDate || null,
    category
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

  const [feed, localFeed] = await Promise.all([
    fetchFeedWithRetry(parser, FEED_URL),
    fetchFeedWithRetry(parser, LOCAL_FEED_URL)
  ]);

  const nationalItems = (feed.items || [])
    .slice(0, 20)
    .map((item) => mapItem(item, guessCategory(item.title || "")));

  const barrioItems = (localFeed.items || [])
    .slice(0, 12)
    .map((item) => mapItem(item, "barrio"));

  const items = [...barrioItems, ...nationalItems];

  const payload = {
    generatedAt: new Date().toISOString(),
    feedUrl: FEED_URL,
    localFeedUrl: LOCAL_FEED_URL,
    items
  };

  await writeFile("news.json", JSON.stringify(payload, null, 2) + "\n");
  console.log(
    `news.json actualizado con ${items.length} noticias (${barrioItems.length} de barrio).`
  );
}

main().catch((err) => {
  console.error("Error al generar news.json:", err);
  process.exit(1);
});
