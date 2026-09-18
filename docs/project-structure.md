# Project Structure

```text
content/lyrics.json       Lyrics route manifest
docs/                     Project documentation
scripts/build.mjs         Static build and lyrics route sync
src/                      LyricsKara homepage, headers, redirects, robots
stages/<slug>/            Self-contained lyric stage projects (Vite apps)
dist/                     Generated output, ignored by Git
```

## Adding A Lyrics Page

1. Create the stage project under `stages/<slug>/` with its own `package.json` and build output.
2. Add a new entry to `content/lyrics.json`.
3. Keep the `slug` URL-safe; it becomes `/<slug>/`.
4. Set `sourceDir` only when the project lives outside `stages/<slug>/`.
5. Run `npm run build`.

The build script rejects unsafe slugs, path traversal in source and output directories, and missing stage sources.
