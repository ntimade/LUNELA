/**
 * Génère l'icône LUNELA (carré arrondi rose/violet, lune + silhouette féminine
 * stylisée formant un "L") puis la convertit en PNG via sharp.
 * Exécuter : node generate-logo.js
 */
const sharp = require('sharp');
const path  = require('path');

// ── Glyphe partagé : lune + silhouette (viewBox 0 0 100 100) ──────────────────
// glowOpacity: intensité du halo lumineux derrière la lune
// silColor: couleur de la silhouette (blanc sur fond coloré, coloré sur fond transparent)
const makeGlyph = ({ silColor = '#FFFFFF', moonColor = '#FFFFFF', cutColor, glow = true }) => `
  ${glow ? `<circle cx="42" cy="34" r="26" fill="url(#glowGrad)"/>` : ''}

  <!-- Silhouette féminine stylisée (cheveux/robe fluides formant un "L") -->
  <path
    d="M 44 23
       C 52 25, 58 31, 54 39
       C 51 45, 45 49, 43 55
       C 41 61, 50 65, 52 71
       C 54 77, 50 85, 45 89
       C 40 86, 34 79, 31 73
       C 27 67, 34 61, 30 53
       C 26 45, 14 41, 16 35
       C 18 29, 31 25, 44 23 Z"
    fill="${silColor}" opacity="0.97"
  />

  <!-- Lune croissant -->
  <circle cx="48" cy="32" r="15.5" fill="${moonColor}"/>
  <circle cx="55.5" cy="27.5" r="12.5" fill="${cutColor}"/>
`;

const makeIconSVG = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <defs>
    <radialGradient id="bgGrad" cx="42%" cy="32%" r="75%">
      <stop offset="0%"   stop-color="#F9A8D4"/>
      <stop offset="45%"  stop-color="#EC4899"/>
      <stop offset="100%" stop-color="#9D174D"/>
    </radialGradient>
    <radialGradient id="glowGrad" cx="50%" cy="50%" r="50%">
      <stop offset="0%"  stop-color="#FFFFFF" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect x="0" y="0" width="100" height="100" rx="22" fill="url(#bgGrad)"/>
  ${makeGlyph({ silColor: '#FFFFFF', moonColor: '#FFFFFF', cutColor: '#EC4899' })}
</svg>
`;

// Icône adaptative Android : glyphe seul, fond transparent (le fond est géré par app.json)
const makeAdaptiveSVG = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <defs>
    <radialGradient id="glowGrad" cx="50%" cy="50%" r="50%">
      <stop offset="0%"  stop-color="#FFFFFF" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <g transform="translate(50 50) scale(0.62) translate(-50 -50)">
    ${makeGlyph({ silColor: '#FFFFFF', moonColor: '#FFFFFF', cutColor: '#BE185D', glow: false })}
  </g>
</svg>
`;

// Marque seule : glyphe recadré serré, fond transparent — pour badges/logos dans l'UI
const makeLogoMarkSVG = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  ${makeGlyph({ silColor: '#FFFFFF', moonColor: '#FFFFFF', cutColor: '#BE185D', glow: false })}
</svg>
`;

// Splash : glyphe + wordmark "LUNELA" en dessous, sur fond dégradé
const makeSplashSVG = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <defs>
    <radialGradient id="bgGrad" cx="50%" cy="38%" r="70%">
      <stop offset="0%"   stop-color="#F9A8D4"/>
      <stop offset="45%"  stop-color="#EC4899"/>
      <stop offset="100%" stop-color="#9D174D"/>
    </radialGradient>
    <radialGradient id="glowGrad" cx="50%" cy="50%" r="50%">
      <stop offset="0%"  stop-color="#FFFFFF" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect x="0" y="0" width="100" height="100" fill="url(#bgGrad)"/>
  <g transform="translate(50 30) scale(0.62) translate(-50 -50)">
    ${makeGlyph({ silColor: '#FFFFFF', moonColor: '#FFFFFF', cutColor: '#EC4899' })}
  </g>
  <text x="50" y="72" font-family="Georgia, 'Times New Roman', serif" font-weight="700"
        font-size="11" text-anchor="middle" letter-spacing="1.5" fill="#FFFFFF">Lunela</text>
  <text x="50" y="80" font-family="Arial, sans-serif" font-size="3.6" text-anchor="middle"
        letter-spacing="0.6" fill="rgba(255,255,255,0.8)">SANTÉ &amp; BIEN-ÊTRE</text>
</svg>
`;

async function generate() {
  const assetsDir = path.join(__dirname, 'assets');

  const targets = [
    { name: 'icon.png',          size: 1024, svg: makeIconSVG },
    { name: 'adaptive-icon.png', size: 1024, svg: makeAdaptiveSVG },
    { name: 'splash-icon.png',   size: 1024, svg: makeSplashSVG },
    { name: 'favicon.png',       size: 96,   svg: makeIconSVG },
    { name: 'logo-mark.png',     size: 512,  svg: makeLogoMarkSVG },
  ];

  for (const { name, size, svg } of targets) {
    const buf = Buffer.from(svg(size));
    const out = path.join(assetsDir, name);
    await sharp(buf, { density: 384 }).resize(size, size).png().toFile(out);
    console.log(`✅  ${name}  (${size}×${size})`);
  }

  console.log('\n🎉  Icônes LUNELA (rose/violet) générées avec succès !');
}

generate().catch(console.error);
