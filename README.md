# 300 Traces Template

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Annoymity00999/300-traces-template)

A static-first, bilingual reading-archive template for art and research projects.
It begins with an encounter rather than a dashboard: visitors meet one trace,
open its source, and keep a reading footprint in their own browser.

## Use this template

1. Click **Use this template** on GitHub to make your own repository, or click
   **Deploy with Vercel** above to create your own public site.
2. For a first version, do nothing else: the static reader works without a
   database, a password, or a server-side key.
3. Replace your own content a little at a time, then redeploy.

## What works immediately

- unread-first random encounters;
- idea / article / answer filtering;
- Chinese and English interface copy;
- original-source links and local reading footprints;
- dated image and sound layers;
- a mobile-first reading experience.

## First places to customise

- `app/data/trace-data-*.json` — archive records;
- `app/page-copy.ts` — Chinese and English text;
- `app/data/period-*.ts` and `public/period-images/` — dated materials;
- `app/globals.css` — visual atmosphere and layout.

Every trace should retain a stable `sourceId`, a type, a title or excerpt, and
a source URL. Do not fabricate authors, translations, dates, or source links.

## Local check and deployment

```bash
npm install
npm test
npm run build:vercel
npm run dev
```

The optional APIs are intentionally not required for the reader to work.
Feedback, moderation and cross-device recovery require your own server-side
configuration; never put keys or tokens in browser files.

## AI handoff

If you are using an AI coding assistant, give it the whole repository and ask
it to read `docs/AI_REPLICATION_GUIDE_300_TRACES_2026-09-11.md` first. It
explains the static-first boundary, safe replacement order and validation steps.
