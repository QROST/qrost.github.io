'use strict';

const path = require('node:path');

global.window = globalThis;
require(path.join(__dirname, '..', 'assets', 'js', 'data.js'));

const data = global.PEBBLE_2027_DATA;
const errors = [];

function check(condition, message) {
  if (!condition) errors.push(message);
}

function checkBilingual(value, label) {
  check(value && typeof value.zh === 'string' && value.zh.trim(), `${label}.zh is required`);
  check(value && typeof value.en === 'string' && value.en.trim(), `${label}.en is required`);
}

function checkIsoDate(value, label) {
  check(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value), `${label} must be an ISO date`);
}

function checkHttps(url, label) {
  check(typeof url === 'string' && url.startsWith('https://'), `${label} must be an https URL`);
}

function objectKeysDeep(value, result = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => objectKeysDeep(item, result));
  } else if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, child]) => {
      result.push(key);
      objectKeysDeep(child, result);
    });
  }
  return result;
}

check(data && typeof data === 'object', 'PEBBLE_2027_DATA must load');

if (data) {
  check(data.schemaVersion === 2, 'schemaVersion must be 2');
  check(data.year === 2027, 'year must be 2027');
  check(data.status === 'partial', 'guide status must remain partial until every module is complete');
  checkIsoDate(data.initializedOn, 'initializedOn');
  checkIsoDate(data.factsCheckedOn, 'factsCheckedOn');
  check(data.confirmedEventCount === 7, 'confirmedEventCount must match the seven official signature events');
  check(data.provenance?.scope === 'official-current-year-only', 'provenance must enforce current-year official sources');
  check(data.provenance?.checkedOn === data.factsCheckedOn, 'provenance.checkedOn must match factsCheckedOn');
  checkBilingual(data.provenance?.note, 'provenance.note');
  check(data.archive?.year === 2026, 'archive year must be 2026');
  check(data.archive?.href === '../pebble-beach-2026/', 'archive href must preserve the published 2026 URL');
  checkBilingual(data.archive?.label, 'archive.label');

  for (const [key, value] of Object.entries(data.meta || {})) checkBilingual(value, `meta.${key}`);
  for (const [key, value] of Object.entries(data.labels || {})) checkBilingual(value, `labels.${key}`);

  const requiredLabels = [
    'skip', 'home', 'navStatus', 'navFramework', 'navWatchlist', 'navArchive', 'navMenu',
    'navMenuOpen', 'navMenuClose', 'navBackTop', 'langToggle', 'themeLight', 'themeDark',
    'heroTitle', 'heroLead', 'heroPrimary', 'heroSecondary', 'pendingBadge', 'partialBadge',
    'confirmedBadge', 'moduleExpand', 'moduleKnown', 'moduleDates', 'moduleNeeds', 'moduleSources',
    'checkedLabel', 'sourceEvidence', 'sourceWatchpoint', 'archiveAction', 'footerDisclaimer'
  ];
  requiredLabels.forEach((key) => checkBilingual(data.labels?.[key], `labels.${key}`));

  check(Array.isArray(data.sources), 'sources must be an array');
  const sourceIds = new Set((data.sources || []).map((source) => source.id));
  check(sourceIds.size === (data.sources || []).length, 'source ids must be unique');
  check((data.sources || []).filter((source) => source.watchlist !== false).length === 7, 'official source overview must stay concise at seven links');
  const expectedSourceUrls = {
    'official-calendar': 'https://www.pebblebeachconcours.net/event-calendar/',
    'official-tour': 'https://www.pebblebeachconcours.net/event/pebble-beach-tour-delegance/',
    'official-tickets': 'https://www.pebblebeachconcours.net/plan-your-visit/tickets/',
    'official-directions': 'https://www.pebblebeachconcours.net/plan-your-visit/directions-parking-event-maps/',
    'official-village': 'https://www.pebblebeachconcours.net/event/concours-village/'
  };
  for (const [index, source] of (data.sources || []).entries()) {
    const label = `sources[${index}]`;
    checkHttps(source.url, `${label}.url`);
    check(new URL(source.url).hostname === 'www.pebblebeachconcours.net', `${label}.url must stay on the official Concours domain`);
    check(!/\/wp-content\/uploads\/2026\//.test(source.url), `${label}.url must not reuse a 2026 document`);
    check(['evidence', 'watchpoint'].includes(source.role), `${label}.role must be evidence or watchpoint`);
    checkIsoDate(source.checkedOn, `${label}.checkedOn`);
    check(source.checkedOn === data.factsCheckedOn, `${label}.checkedOn must match the guide check date`);
    checkBilingual(source.label, `${label}.label`);
  }
  for (const [id, url] of Object.entries(expectedSourceUrls)) {
    const source = (data.sources || []).find((item) => item.id === id);
    check(source?.url === url, `${id} must use its canonical official URL`);
    check(source?.role === 'evidence', `${id} must be an evidence source`);
  }
  check((data.sources || []).find((source) => source.id === 'official-updates')?.role === 'watchpoint', 'Updates must remain a watchpoint, not 2027 evidence');

  const expectedEvents = [
    ['motoring-classic', '2027-08-02', '2027-08-11'],
    ['pebble-beach-auctions', '2027-08-11', '2027-08-14'],
    ['tour-delegance', '2027-08-12', '2027-08-12'],
    ['retroauto', '2027-08-12', '2027-08-15'],
    ['classic-car-forum', '2027-08-12', '2027-08-14'],
    ['concours-village', '2027-08-12', '2027-08-15'],
    ['concours-delegance', '2027-08-15', '2027-08-15']
  ];
  check(Array.isArray(data.confirmedEvents), 'confirmedEvents must be an array');
  check(data.confirmedEvents?.length === data.confirmedEventCount, 'confirmedEvents length must match confirmedEventCount');
  check(
    JSON.stringify((data.confirmedEvents || []).map((event) => [event.id, event.startDate, event.endDate])) === JSON.stringify(expectedEvents),
    'confirmedEvents must preserve the exact seven official ranges in chronological editorial order'
  );
  check(new Set((data.confirmedEvents || []).map((event) => event.id)).size === (data.confirmedEvents || []).length, 'confirmed event ids must be unique');
  for (const [index, event] of (data.confirmedEvents || []).entries()) {
    const label = `confirmedEvents[${index}]`;
    checkBilingual(event.title, `${label}.title`);
    checkBilingual(event.dateLabel, `${label}.dateLabel`);
    if (event.details) checkBilingual(event.details, `${label}.details`);
    checkIsoDate(event.startDate, `${label}.startDate`);
    checkIsoDate(event.endDate, `${label}.endDate`);
    check(event.startDate.startsWith('2027-') && event.endDate.startsWith('2027-'), `${label} must contain only 2027 dates`);
    check(event.startDate <= event.endDate, `${label} date range is reversed`);
    check(event.checkedOn === data.factsCheckedOn, `${label}.checkedOn must match factsCheckedOn`);
    check(Array.isArray(event.sourceIds) && event.sourceIds.length > 0, `${label}.sourceIds is required`);
    for (const id of event.sourceIds || []) {
      const source = (data.sources || []).find((item) => item.id === id);
      check(Boolean(source), `${label} references unknown source ${id}`);
      check(source?.role === 'evidence', `${label} may reference evidence sources only`);
    }
  }
  const detailedEventIds = new Set((data.confirmedEvents || []).filter((event) => event.details).map((event) => event.id));
  ['motoring-classic', 'pebble-beach-auctions', 'tour-delegance', 'retroauto', 'concours-village', 'concours-delegance']
    .forEach((id) => check(detailedEventIds.has(id), `${id} must retain its concise official schedule detail`));
  const detailedSchedules = JSON.stringify((data.confirmedEvents || []).map((event) => event.details || {}));
  check(
    !/(?:^|[\s；;,])\d{1,2}–\d{1,2}(?=[；;,.，\s]|$)/.test(detailedSchedules),
    'clock ranges in event details must include explicit AM/PM markers'
  );
  const motoring = (data.confirmedEvents || []).find((event) => event.id === 'motoring-classic');
  const motoringDetail = JSON.stringify(motoring?.details || {});
  check(
    ['Seattle', 'Kirkland', '4:00 PM', '4:30 PM'].every((token) => motoringDetail.includes(token)),
    'Motoring Classic detail must disclose the conflict between its two official schedule pages'
  );
  check(
    ['official-motoring-event', 'official-motoring-info'].every((id) => motoring?.sourceIds?.includes(id)),
    'Motoring Classic conflict must cite both official schedule pages'
  );

  const expectedModuleIds = ['calendar', 'tour', 'tickets', 'parking', 'brands', 'stay', 'commute'];
  const expectedStatuses = {
    calendar: 'partial', tour: 'partial', tickets: 'partial', parking: 'partial',
    brands: 'placeholder', stay: 'placeholder', commute: 'partial'
  };
  check(Array.isArray(data.modules), 'modules must be an array');
  check(
    JSON.stringify((data.modules || []).map((module) => module.id)) === JSON.stringify(expectedModuleIds),
    'modules must preserve the seven planning modules in editorial order'
  );
  check(new Set((data.modules || []).map((module) => module.id)).size === (data.modules || []).length, 'module ids must be unique');

  const forbiddenMapFields = new Set(['coordinates', 'lat', 'lng', 'mapX', 'mapY', 'accuracyM', 'routeGeometry', 'geojson']);
  for (const [index, module] of (data.modules || []).entries()) {
    const label = `modules[${index}]`;
    check(['placeholder', 'partial', 'confirmed'].includes(module.status), `${label}.status is invalid`);
    check(module.status === expectedStatuses[module.id], `${label}.status must be ${expectedStatuses[module.id]}`);
    check(/^\d{2}$/.test(module.icon), `${label}.icon must be a two-digit editorial index`);
    checkBilingual(module.title, `${label}.title`);
    checkBilingual(module.summary, `${label}.summary`);
    check(Array.isArray(module.facts), `${label}.facts must be an array`);
    if (module.status === 'partial') check(module.facts.length > 0, `${label} partial module must expose at least one sourced fact`);
    if (module.status === 'placeholder') check(module.facts.length === 0, `${label} placeholder module must not contain facts`);
    for (const [factIndex, fact] of (module.facts || []).entries()) {
      const factLabel = `${label}.facts[${factIndex}]`;
      checkBilingual(fact.text, `${factLabel}.text`);
      check(fact.checkedOn === data.factsCheckedOn, `${factLabel}.checkedOn must match factsCheckedOn`);
      check(Array.isArray(fact.sourceIds) && fact.sourceIds.length > 0, `${factLabel}.sourceIds is required`);
      for (const id of fact.sourceIds || []) {
        const source = (data.sources || []).find((item) => item.id === id);
        check(Boolean(source), `${factLabel} references unknown source ${id}`);
        check(source?.role === 'evidence', `${factLabel} may reference evidence sources only`);
      }
    }
    check(Array.isArray(module.needs) && module.needs.length >= 3, `${label}.needs must contain at least three items`);
    (module.needs || []).forEach((item, itemIndex) => checkBilingual(item, `${label}.needs[${itemIndex}]`));
    check(Array.isArray(module.sourceIds) && module.sourceIds.length > 0, `${label}.sourceIds is required`);
    (module.sourceIds || []).forEach((id) => check(sourceIds.has(id), `${label} references unknown source ${id}`));
    const forbiddenFound = objectKeysDeep(module).filter((key) => forbiddenMapFields.has(key));
    check(forbiddenFound.length === 0, `${label} contains unverified map fields: ${forbiddenFound.join(', ')}`);
  }
  check((data.modules || []).filter((module) => module.status === 'partial').length === 5, 'exactly five modules must be partial');
  check((data.modules || []).filter((module) => module.status === 'placeholder').length === 2, 'exactly two modules must remain placeholders');

  for (const group of ['reusable', 'reset']) {
    check(Array.isArray(data.framework?.[group]) && data.framework[group].length === 4, `framework.${group} must contain four items`);
    (data.framework?.[group] || []).forEach((item, index) => checkBilingual(item, `framework.${group}[${index}]`));
  }

  const serialized = JSON.stringify(data);
  check(!serialized.includes('chatgpt.com/c/'), 'private ChatGPT conversation URLs must never be published');
  check(!serialized.includes('parking-traffic-map-2026'), '2026 parking map must not enter the 2027 data layer');
  check(!serialized.includes('/assets/img/events/'), '2026 event thumbnails must not enter the 2027 data layer');
  check(!serialized.includes('pebble-beach-2026-og'), '2026 social image must not enter the 2027 data layer');
  check(!/\$\s*\d/.test(serialized), '2027 data must not contain unverified monetary amounts');
  check(!/Big Sur Timber Fire|Hwy 68/i.test(serialized), 'prior-edition route details must not enter the 2027 data layer');
}

if (errors.length) {
  console.error(`Pebble Beach 2027 data validation failed (${errors.length}):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`Pebble Beach 2027 data: OK (${data.confirmedEventCount} official event ranges, 5 partial modules, 2 pending modules)`);
