// Inline-SVG placeholder generator for product cards in the lookbook + set PDP.
// The original product photos carried the old brand's wordmark embossed on the
// frame, so we render brand-correct placeholders until real Makoauto photography
// lands.
window.MakoautoPlaceholders = (function () {
  const presets = {
    '1-1-exclusive':            { bg:'#0F0F0F', fg:'#D4FF4F', accent:'#FF3D8A', tag:'1/1',     glyph:'★' },
    '277-legacy':               { bg:'#1A2E5C', fg:'#F5F0E3', accent:'#E63946', tag:'METAL',   glyph:'277' },
    'blue-urban-camo':          { bg:'#1E3A5F', fg:'#F5F0E3', accent:'#5B8DEF', tag:'CAMO',    glyph:'▲' },
    'cartoon-pup':              { bg:'#FFE0AC', fg:'#1A1A1A', accent:'#E63946', tag:'CUTE',    glyph:'◉' },
    'classic-comic-pup':        { bg:'#F5F0E3', fg:'#1A1A1A', accent:'#FFD93D', tag:'COMIC',   glyph:'◐' },
    'classic-comic-pup-yellow-bird': { bg:'#FFD93D', fg:'#1A1A1A', accent:'#000000', tag:'DUO', glyph:'◑' },
    'clear-vibe':               { bg:'#E8F4F8', fg:'#1A1A1A', accent:'#5BC0DE', tag:'CLEAR',   glyph:'◇' },
    'cyber-pilot':              { bg:'#0A0E27', fg:'#00F0FF', accent:'#FF006E', tag:'CYBER',   glyph:'⌬' },
    'ew-people-cat':            { bg:'#FFB5C5', fg:'#1A1A1A', accent:'#000000', tag:'MEOW',    glyph:'≋' },
    'multi-theme':              { bg:'#F5F0E3', fg:'#1A1A1A', accent:'#D4FF4F', tag:'MIX',     glyph:'⊕' },
    'nostalgic-comic':          { bg:'#FFEAA7', fg:'#1A1A1A', accent:'#E63946', tag:'RETRO',   glyph:'◔' },
    'pet-lovers':               { bg:'#A8E6CF', fg:'#1A1A1A', accent:'#FF6B6B', tag:'PETS',    glyph:'❀' },
    'pirate-anime':             { bg:'#1A1A1A', fg:'#FFD93D', accent:'#E63946', tag:'ANIME',   glyph:'⚓' },
    'pixel-fighter':            { bg:'#2D1B69', fg:'#00F5A0', accent:'#FF006E', tag:'PIXEL',   glyph:'▣' },
    'premium-pink-kawaii':      { bg:'#FFB5D8', fg:'#1A1A1A', accent:'#FF006E', tag:'KAWAII',  glyph:'❀' },
    'retro-arcade':             { bg:'#1A0033', fg:'#FFD93D', accent:'#FF006E', tag:'ARCADE',  glyph:'◀' },
    'retro-cat-mouse':          { bg:'#FF9F1C', fg:'#1A1A1A', accent:'#FFFFFF', tag:'TOM',     glyph:'◢' },
    'silicone-base':            { bg:'#F5F0E3', fg:'#1A1A1A', accent:'#D4FF4F', tag:'BASE',    glyph:'▭' },
    'varsity-racing':           { bg:'#E63946', fg:'#F5F0E3', accent:'#1A1A1A', tag:'VARSITY', glyph:'V' },
  };
  const titles = {
    '1-1-exclusive':'Streetwear 1/1','277-legacy':'The 277 Legacy','blue-urban-camo':'Blue Urban Camo',
    'cartoon-pup':'Cartoon Pup','classic-comic-pup':'Classic Comic Pup',
    'classic-comic-pup-yellow-bird':'Comic Pup & Bird','clear-vibe':'Clear Vibe','cyber-pilot':'Cyber Pilot',
    'ew-people-cat':'Ew, People','multi-theme':'Multi-Theme','nostalgic-comic':'Nostalgic Comic',
    'pet-lovers':'Pet Lovers','pirate-anime':'Pirate Anime','pixel-fighter':'Pixel Fighter',
    'premium-pink-kawaii':'Pink Kawaii','retro-arcade':'Retro Arcade','retro-cat-mouse':'Cat & Mouse',
    'silicone-base':'The Frame','varsity-racing':'Varsity Racing',
  };
  const dark = (bg) => ['#0F0F0F','#1A1A1A','#1A0033','#0A0E27','#2D1B69','#1A2E5C','#1E3A5F'].indexOf(bg) >= 0;

  function render(slug, price, setLabel) {
    const p = presets[slug] || { bg:'#F5F0E3', fg:'#1A1A1A', accent:'#D4FF4F', tag:'MAKOAUTO', glyph:'◆' };
    const title = titles[slug] || slug;
    const plateW = 720, plateH = 360, plateX = (1200 - plateW) / 2, plateY = (900 - plateH) / 2 - 20;
    let seed = 0; for (let i = 0; i < slug.length; i++) seed = (seed * 31 + slug.charCodeAt(i)) >>> 0;
    const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0x100000000; };
    const pins = [];
    for (let i = 0; i < 6; i++) {
      pins.push({ cx: 60 + i * (plateW - 120) / 5, cy: 22, on: rng() > 0.45 });
      pins.push({ cx: 60 + i * (plateW - 120) / 5, cy: plateH - 22, on: rng() > 0.45 });
    }
    const tagW = 20 + p.tag.length * 16;
    const label = setLabel || 'LOOKBOOK SET';
    const priceLine = price != null ? `$${Math.round(price)} · ${label}` : label;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900" preserveAspectRatio="xMidYMid slice" style="width:100%;height:100%;display:block">
<defs>
<pattern id="ph-dots-${slug}" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse"><circle cx="20" cy="20" r="1.2" fill="${p.fg}" opacity="0.07"/></pattern>
<linearGradient id="ph-frame-${slug}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${p.fg}" stop-opacity="0.08"/><stop offset="100%" stop-color="${p.fg}" stop-opacity="0.18"/></linearGradient>
</defs>
<rect width="1200" height="900" fill="${p.bg}"/>
<rect width="1200" height="900" fill="url(#ph-dots-${slug})"/>
<g><rect x="48" y="48" width="${tagW}" height="40" rx="20" fill="${p.accent}" stroke="${p.fg}" stroke-width="2"/><text x="${48 + tagW / 2}" y="73" font-family="JetBrains Mono, monospace" font-size="14" font-weight="700" fill="${dark(p.bg) ? p.fg : '#1A1A1A'}" text-anchor="middle" letter-spacing="1.5">${p.tag}</text></g>
<text x="1152" y="78" font-family="Space Grotesk, sans-serif" font-size="24" font-weight="700" fill="${p.fg}" text-anchor="end" opacity="0.6" letter-spacing="-1">Makoauto</text>
<text x="600" y="560" font-family="Space Grotesk, sans-serif" font-size="640" font-weight="700" fill="${p.accent}" text-anchor="middle" opacity="0.18">${p.glyph}</text>
<g transform="translate(${plateX}, ${plateY})">
<rect x="0" y="0" width="${plateW}" height="${plateH}" rx="18" fill="url(#ph-frame-${slug})" stroke="${p.fg}" stroke-width="3" opacity="0.9"/>
<rect x="60" y="50" width="${plateW - 120}" height="${plateH - 100}" rx="10" fill="${p.bg}" stroke="${p.fg}" stroke-width="1.5" opacity="0.5"/>
${pins.map(pin => `<circle cx="${pin.cx}" cy="${pin.cy}" r="${pin.on ? 11 : 6}" fill="${pin.on ? p.accent : 'none'}" stroke="${p.fg}" stroke-width="${pin.on ? 2.5 : 1.5}" opacity="${pin.on ? 1 : 0.4}"/>`).join('')}
</g>
<text x="600" y="${plateY + plateH + 80}" font-family="Space Grotesk, sans-serif" font-size="56" font-weight="700" fill="${p.fg}" text-anchor="middle" letter-spacing="-1.5">${title}</text>
<text x="600" y="${plateY + plateH + 120}" font-family="JetBrains Mono, monospace" font-size="18" fill="${p.fg}" text-anchor="middle" opacity="0.55" letter-spacing="2">${priceLine}</text>
</svg>`;
  }
  return { render };
})();
