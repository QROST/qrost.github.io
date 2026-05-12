// Pinned — pin catalog.
// Renders pins as WHITE OUTLINE SILHOUETTES, then recolored in-place to the picked finish
// via CSS filters + a metallic overlay. PNGs dropped into /assets/pins/ override the default
// glyph rendering — they should be white on transparent background; the site tints them.

window.PinnedCatalog = (() => {
  const cats = {
    letters: { label: 'Letters', color: 'var(--lime)' },
    numbers: { label: 'Numbers', color: 'var(--cobalt)' },
    emoji:   { label: 'Emoji',   color: 'var(--pink)' },
    icons:   { label: 'Icons',   color: 'var(--tangerine)' },
    flags:   { label: 'Flags',   color: 'var(--lavender)' },
    sports:  { label: 'Sports',  color: '#F6C53D' },
    cars:    { label: 'Cars',    color: '#72D8C1' },
  };

  const pins = [];
  // Letters A–Z
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach(ch => {
    pins.push({ id: `L_${ch}`, category: 'letters', label: ch, glyph: ch, price: 3 });
  });
  // Numbers 0–9
  '0123456789'.split('').forEach(n => {
    pins.push({ id: `N_${n}`, category: 'numbers', label: n, glyph: n, price: 3 });
  });
  const emoji = [
    ['heart','❤'],['star','★'],['fire','🔥'],['rocket','🚀'],['crown','👑'],
    ['peace','✌'],['rainbow','🌈'],['sparkle','✦'],['lightning','⚡'],['sun','☀'],
    ['moon','☾'],['cherry','🍒'],['pizza','🍕'],['cat','🐱'],['dog','🐶'],
    ['panda','🐼'],['unicorn','🦄'],['palm','🌴'],['music','♪'],['skull','☠'],
    ['smiley','☺'],['kiss','💋'],['thumbs','👍'],['ok','👌'],
  ];
  emoji.forEach(([k,e]) => pins.push({ id:`E_${k}`, category:'emoji', label:k, glyph:e, price: 4 }));

  const icons = [
    ['heart-outline','♡'],['heart-fill','♥'],['diamond','◆'],['circle','●'],
    ['square','■'],['triangle','▲'],['arrow','→'],['yinyang','☯'],
    ['snowflake','❄'],['cross','✚'],['peace-sign','☮'],['infinity','∞'],
    ['female','♀'],['male','♂'],['note','♪'],['anchor','⚓'],
  ];
  icons.forEach(([k,i]) => pins.push({ id:`I_${k}`, category:'icons', label:k, glyph:i, price: 4 }));

  const flags = [
    ['us','🇺🇸'],['cn','🇨🇳'],['jp','🇯🇵'],['kr','🇰🇷'],['mx','🇲🇽'],
    ['de','🇩🇪'],['fr','🇫🇷'],['es','🇪🇸'],['it','🇮🇹'],['uk','🇬🇧'],
    ['br','🇧🇷'],['ca','🇨🇦'],['au','🇦🇺'],['in','🇮🇳'],['ph','🇵🇭'],['vn','🇻🇳'],
  ];
  flags.forEach(([k,f]) => pins.push({ id:`F_${k}`, category:'flags', label:k.toUpperCase(), glyph:f, price: 5 }));

  const sports = [
    ['lal','LAL'],['nyk','NYK'],['gsw','GSW'],['bos','BOS'],['mia','MIA'],
    ['lad','LAD'],['nyy','NYY'],['sf','SF'],['chi','CHI'],['bkn','BKN'],
    ['cowboys','DAL'],['49ers','SF'],['pats','NE'],['pack','GB'],
  ];
  sports.forEach(([k,t]) => pins.push({ id:`S_${k}`, category:'sports', label:t, glyph:t, price: 5 }));

  const cars = [
    ['gt','GT'],['v8','V8'],['ev','EV'],['turbo','TRB'],['rs','RS'],
    ['amg','AMG'],['m','/M/'],['st','ST'],['ss','SS'],['hellcat','HC'],
    ['awd','4WD'],['jdm','JDM'],['kdm','KDM'],['drift','DRFT'],
  ];
  cars.forEach(([k,c]) => pins.push({ id:`C_${k}`, category:'cars', label:c, glyph:c, price: 5 }));

  return { cats, pins };
})();

// Async manifest loader — merges /assets/pins/manifest.json into the catalog
// so backend team just drops PNGs + appends manifest entries. Safely no-ops offline.
window.PinnedAssetsLoaded = fetch('assets/pins/manifest.json').then(r => r.ok ? r.json() : null).then(manifest => {
  if (!manifest || !manifest.pins) return;
  manifest.pins.forEach(entry => {
    const existing = window.PinnedCatalog.pins.find(p => p.id === entry.id);
    const record = Object.assign({}, entry, { img: 'assets/pins/' + entry.file });
    if (existing) Object.assign(existing, record);
    else window.PinnedCatalog.pins.push(record);
  });
  window.dispatchEvent(new CustomEvent('pinned:assets-loaded'));
}).catch(()=>{});

// The finishes — used for tint overlays
window.PINNED_FINISHES = [
  { key: 'silver', label: 'Silver', swatch: 'var(--silver)' },
  { key: 'gold',   label: 'Gold',   swatch: 'var(--gold)' },
  { key: 'black',  label: 'Black Chrome', swatch: 'var(--black-chrome)' },
  { key: 'rose',   label: 'Rose Gold', swatch: 'var(--rose)' },
];

// Core render — returns an HTML string. Pin is drawn as a WHITE SILHOUETTE in `size` px
// with a bold white outline; then the finish is applied as a metallic fill on the glyph.
// If the pin has an `img` (PNG), the PNG takes over as the silhouette.
window.renderPinVisual = (pin, finish='silver', size=44) => {
  const fgrad = {
    silver: 'linear-gradient(135deg,#F6F6F6 0%,#B8B8B8 35%,#FFFFFF 55%,#7A7A7A 100%)',
    gold:   'linear-gradient(135deg,#FBE27A 0%,#C68A2E 40%,#FFF0A8 60%,#7E4E12 100%)',
    black:  'linear-gradient(135deg,#6E6E6E 0%,#0A0A0A 45%,#8E8E8E 60%,#000 100%)',
    rose:   'linear-gradient(135deg,#F7C7C1 0%,#B8685A 45%,#FFE3DD 60%,#6E3428 100%)',
  }[finish] || 'linear-gradient(135deg,#F6F6F6 0%,#B8B8B8 35%,#FFFFFF 55%,#7A7A7A 100%)';

  const strokePx = Math.max(2, size * 0.09); // thick white outline
  const common = `width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;line-height:1;user-select:none;position:relative;`;

  // PNG path — tint via filter. Start with the white silhouette then overlay the metallic fill.
  if (pin.img) {
    return `<div class="pin-visual" data-finish="${finish}" style="${common}">
      <div style="position:absolute;inset:0;background-image:url('${pin.img}');background-size:contain;background-position:center;background-repeat:no-repeat;"></div>
      <div style="position:absolute;inset:0;background:${fgrad};-webkit-mask-image:url('${pin.img}');-webkit-mask-size:contain;-webkit-mask-position:center;-webkit-mask-repeat:no-repeat;mask-image:url('${pin.img}');mask-size:contain;mask-position:center;mask-repeat:no-repeat;"></div>
    </div>`;
  }

  const textLen = (pin.glyph || '').length;
  const fontSize = textLen <= 1 ? size * 0.88 : textLen <= 2 ? size*0.58 : size*0.40;

  // Glyph path — stacked: (1) thick white outline via text-stroke simulation, (2) metallic fill on top.
  // We use multi-layer text-shadow to create the outline, then overlay a clipped gradient.
  const ox = strokePx;
  const shadows = [];
  const steps = 16;
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    shadows.push(`${(Math.cos(a)*ox).toFixed(2)}px ${(Math.sin(a)*ox).toFixed(2)}px 0 #FFFFFF`);
  }
  const outline = shadows.join(',');

  return `<div class="pin-visual" data-finish="${finish}" style="${common}font-family:'Space Grotesk',sans-serif;font-weight:800;letter-spacing:-.02em;">
    <span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:${fontSize}px;color:#FFFFFF;text-shadow:${outline};">${pin.glyph}</span>
    <span style="position:relative;font-size:${fontSize}px;background:${fgrad};-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent;">${pin.glyph}</span>
  </div>`;
};
