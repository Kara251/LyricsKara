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

`npm run build` reads `content/lyrics.json`, clones each public Kara251 lyrics repository into `.lyrics-sources/`, builds it, and copies the generated output into `dist/<slug>/`.

Set `LYRICSKARA_REFRESH_SOURCES=1` when you want to force an existing local source checkout to refresh before building.

## First Route

`/Echoes-of-Longing/` is sourced from `https://github.com/Kara251/Echoes-of-Longing`.

The homepage only indexes and routes to the lyrics page. The lyric page design remains inside its own repository.
