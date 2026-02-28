// Jmaka ASCII + Favicon randomizer
// 42 logo variants + 42 favicon variants, randomized on each page load.

const JMAKA_ASCII_BASE = [
  `
     ██╗███╗   ███╗ █████╗ ██╗  ██╗ █████╗
     ██║████╗ ████║██╔══██╗██║ ██╔╝██╔══██╗
     ██║██╔████╔██║███████║█████╔╝ ███████║
██   ██║██║╚██╔╝██║██╔══██║██╔═██╗ ██╔══██║
╚█████╔╝██║ ╚═╝ ██║██║  ██║██║  ██╗██║  ██║
 ╚════╝ ╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝`,
  `
      _                 _
     | |_ __ ___   __ _| | ____ _
  _  | | '_ \` _ \\ / _\` | |/ / _\` |
 | |_| | | | | | | (_| |   < (_| |
  \\___/|_| |_| |_|\\__,_|_|\\_\\__,_|`,
  `
     __                __
    / /___ ___  ____ _/ /_____ _
 __/ / __ \`__ \\/ __ \`/ //_/ __ |
/___/_/ /_/ /_/\\__,_/_/|_|\\__,_/`,
  `
     ╻┏┳┓┏━┓┏ ┏┏━┓
     ┃┃┃┃┣━┫┃┏┛┣━┫
  ┗━┛╹ ╹╹ ╹┗┛ ╹ ╹`,
  `
  ######                 ##
      ##  ## ## ##   ## ##   ####
      ##  ####### ## ###### ##  ##
 ##   ##  ## ## ## ## ## ## ##  ##
  #####      ##   ## ## ##  ####`,
  `
 ▄▄▄███▄▄▄  ▄▄▄▄███▄▄▄▄   ▄████████    ▄█   ▄█▄    ▄████████
██▀     ▀██ ██▀     ▀██  ███    ███   ███  ██▀    ███    ███
██       ██ ██       ██  ███    ███   ███▄██      ███    ███
██       ██ ██       ██  ███    ███   ▀▀▀▀██▄     ███    ███
██       ██ ██       ██▀███████████     ▀███▀   ▀███████████`,
  `
     888           888
     888           888
     888           888
     88888b.d88b. 888  888 8888b.
     888 "888 "88b888 .88P    "88b
     888  888  888888888K .d888888
     888  888  888888 "88b888  888`
];

function padAscii(text) {
  return String(text || '').replace(/\t/g, '  ').trimEnd();
}

function buildAsciiVariants(targetCount = 42) {
  const variants = JMAKA_ASCII_BASE.map((x) => padAscii(x));
  const blockVariants = ['█', '▓', '▒', '■', '▉', '▊'];

  let i = 0;
  while (variants.length < targetCount) {
    const src = padAscii(JMAKA_ASCII_BASE[i % JMAKA_ASCII_BASE.length]);
    const blockChar = blockVariants[i % blockVariants.length];
    const transformed = src
      .replace(/[█▓▒■▉▊]/g, blockChar)
      .replace(/_/g, i % 2 === 0 ? '_' : '‾');

    variants.push(transformed);
    i += 1;
  }

  return variants.slice(0, targetCount);
}

function buildAsciiPalettes(targetCount = 42) {
  const palettes = [];
  for (let i = 0; i < targetCount; i += 1) {
    const h1 = (i * 31) % 360;
    const h2 = (h1 + 70 + (i % 5) * 7) % 360;
    const h3 = (h2 + 95 + (i % 7) * 5) % 360;
    palettes.push({
      c1: `hsl(${h1} 85% 65%)`,
      c2: `hsl(${h2} 82% 62%)`,
      c3: `hsl(${h3} 80% 66%)`,
      badgeBg1: `hsla(${h1} 85% 65% / 0.18)`,
      badgeBg2: `hsla(${h2} 82% 62% / 0.18)`,
      badgeBorder: `hsla(${h1} 80% 60% / 0.45)`,
      badgeText: `hsl(${h3} 92% 76%)`
    });
  }
  return palettes;
}

function buildFaviconConfigs(targetCount = 42) {
  const glyphs = ['J', 'JM', 'JK', 'JA', 'J*', 'J#', 'J+', 'J!'];
  const out = [];
  for (let i = 0; i < targetCount; i += 1) {
    const h1 = (i * 29 + 5) % 360;
    const h2 = (h1 + 120 + (i % 6) * 3) % 360;
    out.push({
      glyph: glyphs[i % glyphs.length],
      bg1: `hsl(${h1} 82% 48%)`,
      bg2: `hsl(${h2} 88% 56%)`,
      fg: i % 2 === 0 ? '#ffffff' : '#0b1220',
      ring: `hsl(${(h1 + 180) % 360} 90% 72%)`
    });
  }
  return out;
}

const JMAKA_ASCII_STYLES = buildAsciiVariants(42);
const JMAKA_ASCII_PALETTES = buildAsciiPalettes(42);
const JMAKA_FAVICON_CONFIGS = buildFaviconConfigs(42);

let JMAKA_SELECTED_VARIANT = null;

function pickRandomVariant() {
  if (JMAKA_SELECTED_VARIANT) return JMAKA_SELECTED_VARIANT;
  const idx = Math.floor(Math.random() * 42);
  JMAKA_SELECTED_VARIANT = {
    index: idx,
    art: JMAKA_ASCII_STYLES[idx],
    palette: JMAKA_ASCII_PALETTES[idx],
    favicon: JMAKA_FAVICON_CONFIGS[idx]
  };
  return JMAKA_SELECTED_VARIANT;
}

function applyAsciiPalette(palette) {
  if (!palette || !document || !document.documentElement) return;
  const root = document.documentElement;
  root.style.setProperty('--ascii-c1', palette.c1);
  root.style.setProperty('--ascii-c2', palette.c2);
  root.style.setProperty('--ascii-c3', palette.c3);
  root.style.setProperty('--version-bg-1', palette.badgeBg1);
  root.style.setProperty('--version-bg-2', palette.badgeBg2);
  root.style.setProperty('--version-border', palette.badgeBorder);
  root.style.setProperty('--version-text', palette.badgeText);
}

function faviconSvg(config) {
  const fontSize = config.glyph.length > 1 ? 18 : 28;
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${config.bg1}"/>
      <stop offset="100%" stop-color="${config.bg2}"/>
    </linearGradient>
  </defs>
  <rect x="2" y="2" width="60" height="60" rx="14" fill="url(#g)"/>
  <rect x="5" y="5" width="54" height="54" rx="11" fill="none" stroke="${config.ring}" stroke-width="2"/>
  <text x="32" y="39" text-anchor="middle" font-family="monospace" font-size="${fontSize}" font-weight="700" fill="${config.fg}">${config.glyph}</text>
</svg>`.trim();
}

function setFaviconDataUri(svgText) {
  const encoded = `data:image/svg+xml,${encodeURIComponent(svgText)}`;
  const rels = ['icon', 'shortcut icon', 'apple-touch-icon'];

  for (const rel of rels) {
    let link = document.querySelector(`link[rel="${rel}"]`);
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', rel);
      document.head.appendChild(link);
    }
    link.setAttribute('href', encoded);
    link.setAttribute('type', 'image/svg+xml');
  }
}

function applyRandomBranding() {
  const variant = pickRandomVariant();
  applyAsciiPalette(variant.palette);
  setFaviconDataUri(faviconSvg(variant.favicon));
  return variant;
}

function getRandomAsciiArt() {
  return pickRandomVariant().art;
}

if (typeof window !== 'undefined') {
  window.getRandomAsciiArt = getRandomAsciiArt;
  window.JMAKA_ASCII_STYLES = JMAKA_ASCII_STYLES;
  window.applyRandomAsciiTheme = applyRandomBranding;
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyRandomBranding, { once: true });
  } else {
    applyRandomBranding();
  }
}
