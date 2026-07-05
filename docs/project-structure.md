# Project Structure

```text
content/lyrics.json       Lyrics route manifest
docs/                     Project documentation
scripts/build.mjs         Static build and lyrics route sync
src/                      LyricsKara homepage, headers, redirects, robots
dist/                     Generated output, ignored by Git
.lyrics-sources/          Cloned lyrics repositories, ignored by Git
```

## Adding A Lyrics Page

1. Add a new entry to `content/lyrics.json`.
2. Keep the `slug` URL-safe; it becomes `/<slug>/`.
3. Point `sourceRepo` to a public `https://github.com/Kara251/...` repository.
4. Confirm the repository has a build command and output directory.
5. Run `npm run build`.

The build script rejects unsafe slugs, path traversal in output directories, and non-Kara251 GitHub sources.
