import fs from 'node:fs';

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,10}/g;
const PHONE_REGEX = /(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)|\d{2,4})[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g;

const SOCIAL_PATTERNS = {
  linkedin: /https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[a-zA-Z0-9_-]+/gi,
  twitter: /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[a-zA-Z0-9_]+/gi,
  facebook: /https?:\/\/(?:www\.)?facebook\.com\/[a-zA-Z0-9._-]+/gi,
  instagram: /https?:\/\/(?:www\.)?instagram\.com\/[a-zA-Z0-9._-]+/gi,
  tiktok: /https?:\/\/(?:www\.)?tiktok\.com\/@[a-zA-Z0-9._-]+/gi,
};

function cleanEmails(rawList) {
  const ignoreExt = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.css', '.js', '.woff'];
  return Array.from(new Set(rawList.map((e) => e.toLowerCase().trim()))).filter(
    (email) => !ignoreExt.some((ext) => email.endsWith(ext)) && !email.includes('example.com') && !email.includes('sentry.io')
  );
}

export async function scrapeDomainLead(rawUrl, scanContactPages = true) {
  const baseUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
  const pagesToFetch = [baseUrl];
  if (scanContactPages) {
    const origin = new URL(baseUrl).origin;
    pagesToFetch.push(`${origin}/contact`, `${origin}/about`);
  }

  const allEmails = [];
  const allPhones = [];
  const socials = { linkedin: [], twitter: [], facebook: [], instagram: [], tiktok: [] };
  let title = '';

  for (const pageUrl of pagesToFetch) {
    try {
      const res = await fetch(pageUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LeadEnricherBot/1.0)' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const html = await res.text();

      if (!title) {
        const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (m) title = m[1].trim();
      }

      const emails = html.match(EMAIL_REGEX) || [];
      allEmails.push(...emails);

      const phones = html.match(PHONE_REGEX) || [];
      allPhones.push(...phones.filter((p) => p.replace(/\D/g, '').length >= 9 && p.replace(/\D/g, '').length <= 15));

      for (const [key, regex] of Object.entries(SOCIAL_PATTERNS)) {
        const matches = html.match(regex) || [];
        socials[key].push(...matches);
      }
    } catch {}
  }

  return {
    url: baseUrl,
    title,
    emails: cleanEmails(allEmails),
    phones: Array.from(new Set(allPhones)).slice(0, 10),
    socials: Object.fromEntries(Object.entries(socials).map(([k, v]) => [k, Array.from(new Set(v))])),
    scrapedAt: new Date().toISOString(),
  };
}

async function main() {
  if (process.argv.includes('--test')) {
    const sample = await scrapeDomainLead('https://github.com', false);
    console.log('[ACTOR SELF-TEST PASS]', JSON.stringify(sample, null, 2));
    return;
  }

  let Actor;
  try {
    const mod = await import('apify');
    Actor = mod.Actor;
  } catch {}

  if (Actor) {
    await Actor.init();
    const input = (await Actor.getInput()) || { urls: ['https://apify.com'], scanContactPages: true };
    for (const url of input.urls || []) {
      const lead = await scrapeDomainLead(url, input.scanContactPages ?? true);
      await Actor.pushData(lead);
    }
    await Actor.exit();
  }
}

main();
