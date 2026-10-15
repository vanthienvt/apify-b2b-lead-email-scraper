import { Actor } from 'apify';

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)|\d{2,4})[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g;

export async function scrapeUrl(url) {
  const started = Date.now();
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; B2BLeadExtractor/1.0)' },
  });
  const html = await res.text();
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || null;
  const emails = [...new Set((html.match(EMAIL_RE) || []).filter((e) => !/\.(png|jpg|jpeg|gif|svg|webp|css|js)$/i.test(e)))];
  const phones = [...new Set((html.match(PHONE_RE) || []).map((p) => p.trim()).filter((p) => p.replace(/\D/g, '').length >= 9))];

  return {
    url,
    statusCode: res.status,
    title,
    emails,
    phones,
    responseTimeMs: Date.now() - started,
    scrapedAt: new Date().toISOString(),
  };
}

await Actor.init();
const input = (await Actor.getInput()) || {};
const urls = Array.isArray(input.urls) && input.urls.length > 0 ? input.urls : ['https://example.com'];

const results = [];
for (const u of urls) {
  try {
    results.push(await scrapeUrl(u));
  } catch (e) {
    results.push({ url: u, error: e.message, scrapedAt: new Date().toISOString() });
  }
}

await Actor.pushData(results);
console.log('Pushed', results.length, 'B2B lead records to Apify Dataset.');
await Actor.exit();
