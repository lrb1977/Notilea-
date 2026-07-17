// check-dhm.mjs
// Revisa la página de avisos del DHM y guarda cuántos avisos/alertas/
// boletines especiales encuentra, más la hora de la revisión.
// Lo corre un workflow de GitHub Actions cada 3 horas.

import { writeFile } from "node:fs/promises";
import * as cheerio from "cheerio";

const URL = "https://www.meteorologia.gov.py/avisos/";

async function main() {
  let alerts = [];
  let error = null;

  try {
    const res = await fetch(URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept-Language": "es-419,es;q=0.9"
      }
    });

    if (!res.ok) throw new Error(`Status code ${res.status}`);
    const html = await res.text();
    const $ = cheerio.load(html);

    const seen = new Set();
    $("a").each((_, el) => {
      const text = $(el).text().replace(/\s+/g, " ").trim();
      if (!text || text.length < 6) return;
      if (/aviso|alerta|bolet[ií]n especial/i.test(text)) {
        const href = $(el).attr("href") || "";
        const key = href || text;
        if (seen.has(key)) return;
        seen.add(key);
        alerts.push({
          title: text,
          link: href.startsWith("http") ? href : new URL(href, URL).toString()
        });
      }
    });

    alerts = alerts.slice(0, 10);
  } catch (err) {
    error = err.message;
    console.log(`No se pudo revisar el DHM: ${error}`);
  }

  const payload = {
    checkedAt: new Date().toISOString(),
    sourceUrl: URL,
    count: alerts.length,
    alerts,
    error
  };

  await writeFile("dhm-alertas.json", JSON.stringify(payload, null, 2) + "\n");
  console.log(`dhm-alertas.json actualizado: ${alerts.length} avisos encontrados.`);
}

main().catch((err) => {
  console.error("Error al revisar el DHM:", err);
  process.exit(1);
});
