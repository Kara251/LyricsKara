# LyricsKara Deployment

LyricsKara is a static Cloudflare Pages project for `lyrics.kara251.com`.

## Cloudflare Pages

- Project name: `lyrics-kara`
- Production domain: `lyrics.kara251.com`
- Build command: `npm run build`
- Build output directory: `dist`
- Node.js version: `22`

## Local Commands

```bash
npm run check
npm run build
npm run dev
npm run deploy
```

`npm run build` reads `content/lyrics.json`, builds each stage project under `stages/<slug>/`, and copies the generated output into `dist/<slug>/`.

## First Route

`/Echoes-of-Longing/` is built from `stages/Echoes-of-Longing/`.

The homepage only indexes and routes to the lyrics pages. Each stage's design lives in its own directory.
