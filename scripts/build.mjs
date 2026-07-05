import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const srcDir = path.join(rootDir, "src");
const contentFile = path.join(rootDir, "content", "lyrics.json");
const distDir = path.join(rootDir, "dist");
const sourceCacheDir = path.join(rootDir, ".lyrics-sources");
const canonicalOrigin = "https://lyrics.kara251.com";
const skipLyricsBuild = process.env.LYRICSKARA_SKIP_LYRICS_BUILD === "1";
const refreshSources = process.env.LYRICSKARA_REFRESH_SOURCES === "1";
const buildDate = new Date().toISOString();
const buildVersion = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function assertInside(parentDir, targetPath, label) {
  const relative = path.relative(parentDir, targetPath);

  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label} escapes the project boundary: ${targetPath}`);
  }
}

function assertSafeSlug(slug) {
  if (!/^[A-Za-z0-9][A-Za-z0-9-]*$/.test(slug)) {
    throw new Error(`Unsafe lyrics route slug: ${slug}`);
  }
}

function assertTrustedRepo(repoUrl) {
  let parsed;

  try {
    parsed = new URL(repoUrl);
  } catch {
    throw new Error(`Invalid source repository URL: ${repoUrl}`);
  }

  if (parsed.protocol !== "https:" || parsed.hostname !== "github.com") {
    throw new Error(`Only HTTPS GitHub repositories are allowed: ${repoUrl}`);
  }

  if (!parsed.pathname.startsWith("/Kara251/")) {
    throw new Error(`Lyrics source repositories must live under Kara251: ${repoUrl}`);
  }
}

function splitCommand(command) {
  const parts = command.trim().split(/\s+/);

  if (!parts.length || !parts[0]) {
    throw new Error("Empty command is not allowed");
  }

  return [parts[0], parts.slice(1)];
}

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
      shell: false,
      env: {
        ...process.env,
        CI: process.env.CI ?? "1"
      }
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code}`));
    });
  });
}

async function removeAndRecreate(dir) {
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
}

function shouldCopyEntry(entry) {
  return entry.name !== ".DS_Store";
}

async function copyDir(source, target) {
  await fs.mkdir(target, { recursive: true });
  const entries = await fs.readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    if (!shouldCopyEntry(entry)) {
      continue;
    }

    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);

    if (entry.isDirectory()) {
      await copyDir(sourcePath, targetPath);
    } else if (entry.isFile()) {
      await fs.copyFile(sourcePath, targetPath);
    }
  }
}

async function readLyricsEntries() {
  const source = await fs.readFile(contentFile, "utf8");
  const entries = JSON.parse(source);

  if (!Array.isArray(entries)) {
    throw new Error("content/lyrics.json must contain an array");
  }

  for (const entry of entries) {
    assertSafeSlug(entry.slug);
    assertTrustedRepo(entry.sourceRepo);

    if (!entry.route || entry.route !== `/${entry.slug}/`) {
      throw new Error(`Route for ${entry.slug} must be /${entry.slug}/`);
    }

    if (entry.outputDir && (path.isAbsolute(entry.outputDir) || entry.outputDir.includes(".."))) {
      throw new Error(`Unsafe outputDir for ${entry.slug}: ${entry.outputDir}`);
    }
  }

  return entries;
}

function clientCatalog(entries) {
  return entries.map((entry) => ({
    slug: entry.slug,
    title: entry.title,
    subtitle: entry.subtitle,
    artist: entry.artist,
    duration: entry.duration,
    language: entry.language,
    status: entry.status,
    route: entry.route,
    sourceLabel: entry.sourceLabel,
    sourceRepo: entry.sourceRepo.replace(/\.git$/, "")
  }));
}

async function replacePlaceholders(filePath, entries) {
  const ext = path.extname(filePath).toLowerCase();

  if (![".html", ".css", ".js", ".txt", ".xml", ".json"].includes(ext)) {
    return;
  }

  const source = await fs.readFile(filePath, "utf8");
  const replaced = source
    .replaceAll("__BUILD_VERSION__", buildVersion)
    .replaceAll("__BUILD_DATE__", buildDate)
    .replaceAll("__LYRICS_CATALOG__", JSON.stringify(clientCatalog(entries)));

  await fs.writeFile(filePath, replaced);
}

async function collectFiles(dir) {
  const files = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...await collectFiles(entryPath));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}

async function replaceAllPlaceholders(entries) {
  const files = await collectFiles(distDir);

  await Promise.all(files.map((file) => replacePlaceholders(file, entries)));
}

async function ensureSource(entry) {
  await fs.mkdir(sourceCacheDir, { recursive: true });
  const targetDir = path.join(sourceCacheDir, entry.slug);
  assertInside(sourceCacheDir, targetDir, entry.slug);

  const hasGitCheckout = await pathExists(path.join(targetDir, ".git"));

  if (!hasGitCheckout) {
    await fs.rm(targetDir, { recursive: true, force: true });
    await run("git", ["clone", "--depth", "1", "--branch", entry.branch ?? "main", entry.sourceRepo, targetDir], rootDir);
    return targetDir;
  }

  if (refreshSources) {
    await run("git", ["fetch", "--depth", "1", "origin", entry.branch ?? "main"], targetDir);
    await run("git", ["checkout", "FETCH_HEAD"], targetDir);
  }

  return targetDir;
}

async function buildLyricsRoute(entry) {
  if (skipLyricsBuild) {
    await writeSkippedRoute(entry);
    return;
  }

  const sourceDir = await ensureSource(entry);
  const [installCommand, installArgs] = splitCommand(entry.installCommand ?? "npm ci");
  const [buildCommand, buildArgs] = splitCommand(entry.buildCommand ?? "npm run build");

  await run(installCommand, installArgs, sourceDir);
  await run(buildCommand, buildArgs, sourceDir);

  const outputDir = path.resolve(sourceDir, entry.outputDir ?? "dist");
  assertInside(sourceDir, outputDir, `${entry.slug} outputDir`);

  const targetDir = path.join(distDir, entry.slug);
  await removeAndRecreate(targetDir);
  await copyDir(outputDir, targetDir);
}

async function writeSkippedRoute(entry) {
  const targetDir = path.join(distDir, entry.slug);
  await removeAndRecreate(targetDir);
  await fs.writeFile(
    path.join(targetDir, "index.html"),
    `<!doctype html>
<html lang="zh-Hant">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex">
    <title>${entry.title?.en ?? entry.slug} - LyricsKara</title>
  </head>
  <body>
    <p>This route is registered. Run the full build to sync the lyrics page.</p>
  </body>
</html>
`
  );
}

async function writeMachineCatalog(entries) {
  await fs.writeFile(
    path.join(distDir, "catalog.json"),
    `${JSON.stringify(clientCatalog(entries), null, 2)}\n`
  );
}

async function writeSitemap(entries) {
  const urls = [
    { loc: `${canonicalOrigin}/`, priority: "1.0" },
    ...entries.map((entry) => ({
      loc: `${canonicalOrigin}${entry.route}`,
      priority: "0.8"
    }))
  ];

  const body = urls.map((url) => `  <url>
    <loc>${url.loc}</loc>
    <lastmod>${buildDate.slice(0, 10)}</lastmod>
    <priority>${url.priority}</priority>
  </url>`).join("\n");

  await fs.writeFile(
    path.join(distDir, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`
  );
}

function lineNumberFor(source, index) {
  return source.slice(0, index).split("\n").length;
}

async function assertNoEmptySources() {
  const files = (await collectFiles(distDir)).filter((file) => /\.(html|js|css)$/i.test(file));
  const failures = [];
  const emptySrcPattern = /\bsrc\s*=\s*(["'])\s*\1/gi;

  for (const file of files) {
    const source = await fs.readFile(file, "utf8");
    let match;

    while ((match = emptySrcPattern.exec(source)) !== null) {
      failures.push(`${path.relative(rootDir, file)}:${lineNumberFor(source, match.index)}`);
    }
  }

  if (failures.length) {
    throw new Error(`Empty src attributes are not allowed:\n${failures.join("\n")}`);
  }
}

async function main() {
  const entries = await readLyricsEntries();
  await removeAndRecreate(distDir);
  await copyDir(srcDir, distDir);
  await replaceAllPlaceholders(entries);

  for (const entry of entries) {
    await buildLyricsRoute(entry);
  }

  await writeMachineCatalog(entries);
  await writeSitemap(entries);
  await assertNoEmptySources();

  console.log(`LyricsKara build complete: ${entries.length} lyric route(s), ${buildVersion}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
