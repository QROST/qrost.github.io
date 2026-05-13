// Makoauto — pin catalog is manifest-only.
// Listing = every entry in `assets/pins/manifest.json` with a `file` (PNG path under assets/pins/).

window.MakoautoCatalog = (() => ({
  cats: {
    letters: { label: 'Letters', color: 'var(--lime)' },
    numbers: { label: 'Numbers', color: 'var(--cobalt)' },
    emoji: { label: 'Emoji', color: 'var(--pink)' },
    icons: { label: 'Icons', color: 'var(--tangerine)' },
    flags: { label: 'Flags', color: 'var(--lavender)' },
    sports: { label: 'Sports', color: '#F6C53D' },
    cars: { label: 'Cars', color: '#72D8C1' },
  },
  pins: [],
}))();

function normalizeManifestPin(entry) {
  if (!entry || typeof entry.id !== 'string' || !entry.id.trim()) return null;
  const file = typeof entry.file === 'string' ? entry.file.trim() : '';
  if (!file || !/\.png$/i.test(file)) return null;

  const id = entry.id.trim();
  let category = entry.category;
  if (!category || typeof category !== 'string') {
    if (/^L_[A-Z]$/.test(id)) category = 'letters';
    else if (/^N_[0-9]$/.test(id)) category = 'numbers';
    else category = 'icons';
  }

  let label = entry.label;
  if (typeof label !== 'string' || !label.trim()) {
    const l = id.match(/^L_([A-Z])$/);
    const n = id.match(/^N_([0-9])$/);
    if (l) label = l[1];
    else if (n) label = n[1];
    else label = id;
  } else label = label.trim();

  const price = typeof entry.price === 'number' && entry.price >= 0 ? entry.price : 5;
  const glyph = typeof entry.glyph === 'string' ? entry.glyph : '';

  return {
    id,
    category,
    label,
    glyph,
    price,
    file,
    img: 'assets/pins/' + file,
  };
}

window.MakoautoAssetsLoaded = fetch('assets/pins/manifest.json?v=18')
  .then((r) => (r.ok ? r.json() : null))
  .then((manifest) => {
    if (!manifest || !Array.isArray(manifest.pins)) return;
    const seen = new Set();
    const next = [];
    manifest.pins.forEach((raw) => {
      const n = normalizeManifestPin(raw);
      if (!n || seen.has(n.id)) return;
      seen.add(n.id);
      next.push(n);
    });
    const list = window.MakoautoCatalog.pins;
    list.length = 0;
    next.forEach((p) => list.push(p));
    window.dispatchEvent(new CustomEvent('pinned:assets-loaded'));
  })
  .catch(() => {});

// Kept for saved layouts / cart copy; render ignores finish.
window.PINNED_FINISHES = [
  { key: 'silver', label: 'Silver', swatch: 'var(--silver)' },
  { key: 'gold', label: 'Gold', swatch: 'var(--gold)' },
  { key: 'black', label: 'Black Chrome', swatch: 'var(--black-chrome)' },
  { key: 'rose', label: 'Rose Gold', swatch: 'var(--rose)' },
];

function encodeRasterPinSrc(path) {
  const slash = path.lastIndexOf('/');
  const dir = slash < 0 ? '' : path.slice(0, slash + 1);
  const file = slash < 0 ? path : path.slice(slash + 1);
  return dir + encodeURIComponent(file);
}

// Every listed pin has `img` (PNG). Fallback if manifest row is malformed.
window.renderPinVisual = (pin, _finish = 'silver', size = 44) => {
  const common = `width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;line-height:1;user-select:none;position:relative;`;
  if (pin.img) {
    const src = encodeRasterPinSrc(pin.img);
    return `<div class="pin-visual pin-visual--raster" style="${common}">
      <img src="${src}" alt="" draggable="false" width="${size}" height="${size}"
        style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;pointer-events:none;display:block;">
    </div>`;
  }
  return `<div class="pin-visual pin-visual--missing" style="${common}align-items:center;justify-content:center;background:#E8E8E8;border:1px dashed #999;font-size:10px;font-family:system-ui,sans-serif;color:#555">?</div>`;
};
