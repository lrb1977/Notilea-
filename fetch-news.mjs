// scripts/fetch-news.mjs
// Descarga siempre el MISMO topic de Google Noticias (versión RSS del enlace
// que ya usás) y genera news.json con lo último. Lo ejecuta el workflow de
// GitHub Actions una vez al día, así el sitio estático se "actualiza solo".

import Parser from "rss-parser";
import { writeFile } from "node:fs/promises";

// Mismo topic / mismo enlace que ya definiste, solo en formato RSS.
const FEED_URL =
  "https://news.google.com/rss/topics/CAAqLQgKIidDQkFTRndvTkwyY3ZNVEYwWDNKaWRITmZNUklHWlhNdE5ERTVLQUFQAQ?ceid=US:es-419&hl=es-419&gl=US";

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
  "5Días": "5dias.com.py",
  "Paraguay.com": "paraguay.com"
};

const RULES = {
  seguridad: [
    "polic", "asalt", "detien", "detenc", "homicid", "asesin", "balacer",
    "robo", "hurt", "narco", "droga", "marihuana", "crimen", "fiscal",
    "desaparecid", "violen", "arma", "preso", "condena"
  ],
  barrio: [
    "barrio", "municipalidad", "plaza", "vecin", "comunidad", "festival",
    "colegio", "escuela", "calle", "avenida"
  ]
};

function guessCategory(title) {
  const t = title.toLowerCase();
  if (RULES.seguridad.some((k) => t.includes(k))) return "seguridad";
  if (RULES.barrio.some((k) => t.includes(k))) return "barrio";
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

async function main() {
  const parser = new Parser({ customFields: { item: ["source"] } });
  const feed = await parser.parseURL(FEED_URL);

  const items = (feed.items || []).slice(0, 24).map((item) => {
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
      category: guessCategory(title)
    };
  });

  const payload = {
    generatedAt: new Date().toISOString(),
    feedUrl: FEED_URL,
    items
  };

  await writeFile("news.json", JSON.stringify(payload, null, 2) + "\n");
  console.log(`news.json actualizado con ${items.length} noticias.`);
}

main().catch((err) => {
  console.error("Error al generar news.json:", err);
  process.exit(1);
});
