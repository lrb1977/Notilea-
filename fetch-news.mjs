// scripts/fetch-news.mjs
// Trae noticias de DOS orígenes fijos:
//  1) "País": directo de 4 medios paraguayos (ABC, Popular, Última Hora, HOY)
//  2) "Barrio": búsqueda de Google Noticias sobre Nueva Asunción y Nanawa
// Se ejecuta una vez al día (24 horas) vía GitHub Actions.

import Parser from "rss-parser";
import { writeFile } from "node:fs/promises";

// Cada medio puede exponer su RSS en distintas rutas según su plataforma;
// se prueban en orden y se usa la primera que responda.
const PAIS_SOURCES = [
  {
    name: "abc.com.py",
    domain: "abc.com.py",
    candidates: [
      "https://www.abc.com.py/arc/outboundfeeds/rss/nacionales/?outputType=xml",
      "https://www.abc.com.py/arc/outboundfeeds/rss/?outputType=xml"
    ]
  },
  {
    name: "Popular",
    domain: "popular.com.py",
    candidates: [
      "https://www.popular.com.py/feed/",
      "https://popular.com.py/feed/"
    ]
  },
  {
    name: "Última Hora",
    domain: "ultimahora.com",
    candidates: [
      "https://www.ultimahora.com/rss.xml",
      "https://www.ultimahora.com/arc/outboundfeeds/rss/?outputType=xml",
      "https://www.ultimahora.com/feed"
    ]
  },
  {
    name: "Diario HOY",
    domain: "hoy.com.py",
    candidates: [
      "https://www.hoy.com.py/rss.xml",
      "https://www.hoy.com.py/arc/outboundfeeds/rss/?outputType=xml",
      "https://www.hoy.com.py/feed"
    ]
  }
];

// Búsqueda dedicada al barrio: Nueva Asunción y Nanawa, Presidente Hayes.
const LOCAL_QUERY = '("Nueva Asunción" OR Nanawa) Paraguay';
const LOCAL_FEED_URL =
  `https://news.google.com/rss/search?q=${encodeURIComponent(LOCAL_QUERY)}&hl=es-419&gl=PY&ceid=PY:es-419`;

function splitTitleSource(rawTitle, defaultSource) {
  const idx = rawTitle.lastIndexOf(" - ");
  if (idx === -1) return { title: rawTitle, source: defaultSource };
  return {
    title: rawTitle.slice(0, idx).trim(),
    source: rawTitle.slice(idx + 3).trim() || defaultSource
  };
}

function mapItem(item, category, defaultSource, defaultDomain) {
  const fallback = splitTitleSource(item.title || "", defaultSource);
  const sourceName =
    (typeof item.source === "string" && item.source.trim()) || fallback.source;

  return {
    title: fallback.title || item.title || "",
    link: item.link,
    source: sourceName,
    sourceDomain: sourceName === defaultSource ? defaultDomain : defaultDomain,
    pubDate: item.pubDate || item.isoDate || null,
    category
  };
}

async function fetchFeedWithRetry(parser, url, tries = 3) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      return await parser.parseURL(url);
    } catch (err) {
      lastErr = err;
      const wait = 1200 * (i + 1);
      console.log(`  intento ${i + 1} falló (${err.message}). Reintentando en ${wait}ms...`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

async function fetchSite(parser, site) {
  for (const url of site.candidates) {
    try {
      console.log(`Probando ${site.name}: ${url}`);
      const feed = await fetchFeedWithRetry(parser, url);
      console.log(`  OK (${(feed.items || []).length} items)`);
      return feed;
    } catch (err) {
      console.log(`  falló: ${err.message}`);
    }
  }
  console.log(`  ${site.name}: ninguna URL candidata funcionó, se omite.`);
  return null;
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

  // País: los 4 medios directos
  const pais = [];
  for (const site of PAIS_SOURCES) {
    const feed = await fetchSite(parser, site);
    if (!feed) continue;
    const items = (feed.items || [])
      .slice(0, 8)
      .map((item) => mapItem(item, "pais", site.name, site.domain));
    pais.push(...items);
  }
  // Ordenar por fecha, más recientes primero
  pais.sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0));

  // Barrio: búsqueda local en Google Noticias
  let barrio = [];
  try {
    const localFeed = await fetchFeedWithRetry(parser, LOCAL_FEED_URL);
    barrio = (localFeed.items || [])
      .slice(0, 12)
      .map((item) => mapItem(item, "barrio", "Google Noticias", null));
  } catch (err) {
    console.log(`Feed de barrio falló: ${err.message}`);
  }

  const items = [...barrio, ...pais];

  const payload = {
    generatedAt: new Date().toISOString(),
    localFeedUrl: LOCAL_FEED_URL,
    paisSources: PAIS_SOURCES.map((s) => s.name),
    items
  };

  await writeFile("news.json", JSON.stringify(payload, null, 2) + "\n");
  console.log(
    `news.json actualizado con ${items.length} noticias (${barrio.length} de barrio, ${pais.length} de país).`
  );
}

main().catch((err) => {
  console.error("Error al generar news.json:", err);
  process.exit(1);
});
