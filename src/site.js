const LOCALES = [
  { code: "tc", label: "繁中", htmlLang: "zh-Hant" },
  { code: "sc", label: "简中", htmlLang: "zh-Hans" },
  { code: "en", label: "EN", htmlLang: "en" },
  { code: "ja", label: "日本語", htmlLang: "ja" }
];

const STORAGE_KEY = "kara251:locale";
const LYRICS = __LYRICS_CATALOG__;

const COPY = {
  tc: {
    heroKicker: "LYRICS INDEX",
    heroTitleLine: "歌詞頁索引",
    heroNote: "Kara251 的歌詞頁入口。每首歌保持自己的頁面與演出方式，這裡只負責索引與路由。",
    primaryAction: "查看歌詞頁",
    homeAction: "返回主頁",
    metaDomain: "DOMAIN: lyrics.kara251.com",
    metaBuild: "BUILD: __BUILD_DATE__",
    catalogKicker: "CATALOG",
    catalogTitle: "已接入的歌詞頁",
    catalogNote: "之後新增的歌詞頁會從同一份清單接入，並建立對應的靜態路由。",
    statusLabel: "狀態",
    durationLabel: "時長",
    languageLabel: "語言",
    openAction: "進入頁面",
    sourceAction: "來源倉庫"
  },
  sc: {
    heroKicker: "LYRICS INDEX",
    heroTitleLine: "歌词页索引",
    heroNote: "Kara251 的歌词页入口。每首歌保持自己的页面与演出方式，这里只负责索引与路由。",
    primaryAction: "查看歌词页",
    homeAction: "返回主页",
    metaDomain: "DOMAIN: lyrics.kara251.com",
    metaBuild: "BUILD: __BUILD_DATE__",
    catalogKicker: "CATALOG",
    catalogTitle: "已接入的歌词页",
    catalogNote: "之后新增的歌词页会从同一份清单接入，并建立对应的静态路由。",
    statusLabel: "状态",
    durationLabel: "时长",
    languageLabel: "语言",
    openAction: "进入页面",
    sourceAction: "来源仓库"
  },
  en: {
    heroKicker: "LYRICS INDEX",
    heroTitleLine: "Lyrics Page Index",
    heroNote: "A route index for Kara251 lyrics pages. Each song keeps its own page and staging while LyricsKara manages the catalog.",
    primaryAction: "View Lyrics Pages",
    homeAction: "Back Home",
    metaDomain: "DOMAIN: lyrics.kara251.com",
    metaBuild: "BUILD: __BUILD_DATE__",
    catalogKicker: "CATALOG",
    catalogTitle: "Registered Lyrics Pages",
    catalogNote: "New lyrics pages can be added from the same manifest and published as static routes.",
    statusLabel: "Status",
    durationLabel: "Duration",
    languageLabel: "Language",
    openAction: "Open Page",
    sourceAction: "Source Repo"
  },
  ja: {
    heroKicker: "LYRICS INDEX",
    heroTitleLine: "歌詞ページ索引",
    heroNote: "Kara251 の歌詞ページ入口です。各曲のページと演出は独立させ、LyricsKara は索引とルートを管理します。",
    primaryAction: "歌詞ページを見る",
    homeAction: "ホームへ戻る",
    metaDomain: "DOMAIN: lyrics.kara251.com",
    metaBuild: "BUILD: __BUILD_DATE__",
    catalogKicker: "CATALOG",
    catalogTitle: "登録済みの歌詞ページ",
    catalogNote: "今後の歌詞ページも同じマニフェストから追加し、静的ルートとして公開します。",
    statusLabel: "状態",
    durationLabel: "時間",
    languageLabel: "言語",
    openAction: "ページを開く",
    sourceAction: "ソース"
  }
};

function getStoredLocale() {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function setStoredLocale(locale) {
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {}
}

function resolveLocale(locale) {
  return LOCALES.some((item) => item.code === locale) ? locale : "tc";
}

function textFor(value, locale) {
  if (typeof value === "string") {
    return value;
  }

  return value?.[locale] ?? value?.tc ?? value?.en ?? "";
}

function applyCopy(locale) {
  const copy = COPY[locale] ?? COPY.tc;
  const localeConfig = LOCALES.find((item) => item.code === locale) ?? LOCALES[0];

  document.documentElement.lang = localeConfig.htmlLang;

  document.querySelectorAll("[data-copy]").forEach((node) => {
    const key = node.getAttribute("data-copy");
    node.textContent = copy[key] ?? "";
  });
}

function createElement(tagName, className, text) {
  const element = document.createElement(tagName);

  if (className) {
    element.className = className;
  }

  if (text) {
    element.textContent = text;
  }

  return element;
}

function renderLanguageSelect(locale) {
  const select = document.querySelector("#lang-select");

  for (const item of LOCALES) {
    const option = document.createElement("option");
    option.value = item.code;
    option.textContent = item.label;
    select.append(option);
  }

  select.value = locale;
  select.addEventListener("change", () => {
    const nextLocale = resolveLocale(select.value);
    setStoredLocale(nextLocale);
    applyCopy(nextLocale);
    renderLyrics(nextLocale);
  });
}

function renderDetail(label, value) {
  const item = createElement("div", "lyric-detail");
  item.append(createElement("span", "", label));
  item.append(createElement("span", "", value));
  return item;
}

function renderLyrics(locale) {
  const copy = COPY[locale] ?? COPY.tc;
  const list = document.querySelector("#lyric-list");
  list.replaceChildren();

  for (const lyric of LYRICS) {
    const card = createElement("article", "lyric-card");
    const meta = createElement("div", "lyric-meta");
    const label = createElement("p", "lyric-label", lyric.sourceLabel);
    const route = createElement("p", "lyric-route", lyric.route);

    meta.append(label, route);

    const heading = createElement("div");
    const title = createElement("h3", "lyric-title", textFor(lyric.title, locale));
    const subtitle = createElement("p", "lyric-subtitle", textFor(lyric.subtitle, locale));
    heading.append(title, subtitle);

    const details = createElement("div", "lyric-details");
    details.append(
      renderDetail(copy.statusLabel, lyric.status),
      renderDetail(copy.durationLabel, lyric.duration),
      renderDetail(copy.languageLabel, lyric.language)
    );

    const footer = createElement("div", "lyric-footer");
    const openLink = createElement("a", "lyric-link", copy.openAction);
    openLink.href = lyric.route;

    const sourceLink = createElement("a", "source-link", copy.sourceAction);
    sourceLink.href = lyric.sourceRepo;
    sourceLink.target = "_blank";
    sourceLink.rel = "noopener noreferrer";

    footer.append(openLink, sourceLink);
    card.append(meta, heading, details, footer);
    list.append(card);
  }
}

function init() {
  const locale = resolveLocale(getStoredLocale());
  renderLanguageSelect(locale);
  applyCopy(locale);
  renderLyrics(locale);
}

document.addEventListener("DOMContentLoaded", init);
