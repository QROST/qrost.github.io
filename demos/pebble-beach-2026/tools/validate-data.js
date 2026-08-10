'use strict';

const path = require('node:path');
const fs = require('node:fs');

global.window = globalThis;
require(path.join(__dirname, '..', 'assets', 'js', 'data.js'));

const data = global.PEBBLE_DATA;
const errors = [];
const allowedCategories = new Set(['essential', 'free', 'paid', 'unpriced']);
const expectedRouteSignatures = {
  'qp-0807': 'single::1:alvarado@area::-',
  'qp-0808': 'choice::-::A:choice:A:asilomar@area|B:choice:B:laguna@venue',
  'qp-0809': 'choice::-::A:choice:A:laguna@venue|B:choice:-',
  'qp-0810': 'branching::1:embassy@venue::A:choice:2A:carmel-valley-history@area|B:choice:2B:asilomar@area|C:choice:2C:porsche-seaside@area',
  'qp-0811': 'branching::1:carmel@area::A:choice:2A:embassy?@venue|B:choice:2B:asilomar?@area',
  'qp-0812': 'branching::1:carmel@area>2:lighthouse@area::A:choice:3A:asilomar?@area|B:choice:3B:jetcenter?@venue|C:choice:3C:pebble?@area',
  'qp-0813': 'branching::1:portola@area>2:village@area::A:choice:3A:carmel@area|B:choice:3B:pgolf@venue|C:choice:3C:asilomar@area',
  'qp-0814': 'choice::-::A:choice:A1:werks@venue>A2:bayonet?@venue|B:choice:B1:laguna@venue',
  'qp-0815': 'choice::-::A:choice:A0:embassy?@area>A1:lemons@venue>A2:exotics@area|B:choice:B1:laguna@venue',
  'qp-0816': 'choice::-::A:choice:A:pebble@venue|B:choice:B:village@area|C:addOn:C:touring-vehicles?@area',
  'qp-0817': 'single::1:stanton@venue::-'
};
const expectedTimelineSignatures = {
  'qp-0807': '-/1/1/1',
  'qp-0808': 'B/B/A/A',
  'qp-0809': 'A/A/B/B',
  'qp-0810': '1/1/2A+2B+2C/2A+2B+2C/-',
  'qp-0811': '1/1/2A+2B/2A/2B',
  'qp-0812': '1/1/2/2/3A+3B+3C/3A+3B+3C',
  'qp-0813': '1/1/2/2/3A+3B+3C/3A+3B+3C',
  'qp-0814': 'A1+B1/A1/B1/A1/A2/A2',
  'qp-0815': 'A0/A1+B1/A1/A2/B1/A2',
  'qp-0816': 'A+B/A/A/B/C',
  'qp-0817': '-/1/1/-'
};

function routeSignature(route) {
  const stopSignature = (stop) => `${stop.marker}:${stop.place}${stop.optional ? '?' : ''}@${stop.precision}`;
  const root = (route.stops || []).map(stopSignature).join('>') || '-';
  const branches = (route.branches || []).map((branch) => (
    `${branch.id}:${branch.kind}:${(branch.stops || []).map(stopSignature).join('>') || '-'}`
  )).join('|') || '-';
  return `${route.mode}::${root}::${branches}`;
}

function timelineSignature(schedule) {
  return schedule.map((slot) => slot.routeMarkers.join('+') || '-').join('/');
}

function check(condition, message) {
  if (!condition) errors.push(message);
}

function checkBilingual(value, label) {
  check(value && typeof value.zh === 'string' && value.zh.trim(), `${label}.zh is required`);
  check(value && typeof value.en === 'string' && value.en.trim(), `${label}.en is required`);
}

function checkUrl(value, label) {
  check(typeof value === 'string' && value.startsWith('https://'), `${label} must be an https URL`);
}

check(data && typeof data === 'object', 'PEBBLE_DATA must load');
if (data) {
  for (const [key, value] of Object.entries(data.labels || {})) checkBilingual(value, `labels.${key}`);
  for (const [key, value] of Object.entries(data.ui || {})) checkBilingual(value, `ui.${key}`);

  const dayIds = new Set();
  for (const [index, day] of (data.days || []).entries()) {
    check(typeof day.id === 'string' && /^2026-08-(0[7-9]|1[0-7])$/.test(day.id), `days[${index}].id is invalid`);
    check(!dayIds.has(day.id), `duplicate day id: ${day.id}`);
    dayIds.add(day.id);
    checkBilingual(day.short, `days[${index}].short`);
    checkBilingual(day.label, `days[${index}].label`);
    checkBilingual(day.badge, `days[${index}].badge`);
  }
  check(dayIds.size === 11, `expected 11 planning days, found ${dayIds.size}`);

  const routeModeCounts = { single: 0, choice: 0, branching: 0 };
  for (const [index, item] of (data.quickPlan || []).entries()) {
    for (const key of ['date', 'day', 'title', 'body', 'cost']) checkBilingual(item[key], `quickPlan[${index}].${key}`);
    check(typeof item.id === 'string' && /^qp-[a-z0-9-]+$/.test(item.id), `quickPlan[${index}].id is invalid`);
    check(item.route && typeof item.route === 'object', `quickPlan[${index}].route is required`);
    const mode = item.route && item.route.mode;
    check(['single', 'choice', 'branching'].includes(mode), `quickPlan[${index}].route.mode is invalid`);
    if (routeModeCounts[mode] != null) routeModeCounts[mode] += 1;
    check(Array.isArray(item.route.stops), `quickPlan[${index}].route.stops must be an array`);
    check(Array.isArray(item.route.branches), `quickPlan[${index}].route.branches must be an array`);

    const rootStops = item.route.stops || [];
    const branches = item.route.branches || [];
    if (mode === 'single') {
      check(rootStops.length === 1, `quickPlan[${index}] single route needs exactly one root stop`);
      check(branches.length === 0, `quickPlan[${index}] single route cannot have branches`);
    } else if (mode === 'choice') {
      check(rootStops.length === 0, `quickPlan[${index}] choice route cannot have shared root stops`);
      check(branches.filter((branch) => branch.kind === 'choice').length >= 2, `quickPlan[${index}] choice route needs at least two exclusive branches`);
    } else if (mode === 'branching') {
      check(rootStops.length >= 1, `quickPlan[${index}] branching route needs shared root stops`);
      check(branches.filter((branch) => branch.kind === 'choice').length >= 2, `quickPlan[${index}] branching route needs at least two exclusive branches`);
    }

    const markerIds = new Set();
    const referenceIds = new Set();
    const validateStop = (stop, stopLabel) => {
      check(typeof stop.marker === 'string' && /^[A-Z0-9]+$/.test(stop.marker), `${stopLabel}.marker is invalid`);
      check(!markerIds.has(stop.marker), `${stopLabel}.marker is duplicated: ${stop.marker}`);
      markerIds.add(stop.marker);
      referenceIds.add(stop.marker);
      check(typeof stop.place === 'string' && stop.place.trim(), `${stopLabel}.place is required`);
      check(data.mapPlaces && data.mapPlaces[stop.place], `${stopLabel}.place "${stop.place}" is not in mapPlaces`);
      checkBilingual(stop.label, `${stopLabel}.label`);
      check(typeof stop.optional === 'boolean', `${stopLabel}.optional must be boolean`);
      check(['venue', 'area'].includes(stop.precision), `${stopLabel}.precision is invalid`);
    };
    rootStops.forEach((stop, stopIndex) => validateStop(stop, `quickPlan[${index}].route.stops[${stopIndex}]`));

    const branchIds = new Set();
    for (const [branchIndex, branch] of branches.entries()) {
      const branchLabel = `quickPlan[${index}].route.branches[${branchIndex}]`;
      check(typeof branch.id === 'string' && /^[A-Z0-9]+$/.test(branch.id), `${branchLabel}.id is invalid`);
      check(!branchIds.has(branch.id), `${branchLabel}.id is duplicated: ${branch.id}`);
      branchIds.add(branch.id);
      checkBilingual(branch.label, `${branchLabel}.label`);
      check(['choice', 'addOn'].includes(branch.kind), `${branchLabel}.kind is invalid`);
      check(Array.isArray(branch.stops), `${branchLabel}.stops must be an array`);
      if (branch.kind === 'addOn') {
        check(branch.stops.length >= 1, `${branchLabel} add-on needs at least one stop`);
        check(branch.stops.every((stop) => stop.optional === true), `${branchLabel} add-on stops must be optional`);
      }
      if (!branch.stops.length) referenceIds.add(branch.id);
      branch.stops.forEach((stop, stopIndex) => validateStop(stop, `${branchLabel}.stops[${stopIndex}]`));
    }

    if (expectedRouteSignatures[item.id]) {
      check(routeSignature(item.route) === expectedRouteSignatures[item.id], `${item.id} route graph drifted: ${routeSignature(item.route)}`);
    } else {
      check(false, `missing golden route signature for ${item.id}`);
    }

    const schedule = item.schedule;
    check(Array.isArray(schedule) && schedule.length >= 3, `quickPlan[${index}].schedule needs at least 3 slots`);
    if (Array.isArray(schedule)) {
      check(schedule.length <= 8, `quickPlan[${index}].schedule should stay ≤8 slots for folded UI`);
      const allowedTones = new Set(['core', 'optional', 'alt', 'transit']);
      for (const [slotIndex, slot] of schedule.entries()) {
        const slotLabel = `quickPlan[${index}].schedule[${slotIndex}]`;
        check(typeof slot.time === 'string' && slot.time.trim(), `${slotLabel}.time is required`);
        checkBilingual(slot.title, `${slotLabel}.title`);
        if (slot.note) checkBilingual(slot.note, `${slotLabel}.note`);
        check(allowedTones.has(slot.tone), `${slotLabel}.tone is invalid`);
        check(Array.isArray(slot.routeMarkers), `${slotLabel}.routeMarkers must be an array`);
        const uniqueSlotMarkers = new Set(slot.routeMarkers || []);
        check(uniqueSlotMarkers.size === (slot.routeMarkers || []).length, `${slotLabel}.routeMarkers contains duplicates`);
        for (const marker of slot.routeMarkers || []) {
          check(referenceIds.has(marker), `${slotLabel}.routeMarkers has unknown marker: ${marker}`);
        }
      }
      if (schedule.every((slot) => Array.isArray(slot.routeMarkers)) && expectedTimelineSignatures[item.id]) {
        check(timelineSignature(schedule) === expectedTimelineSignatures[item.id], `${item.id} timeline markers drifted: ${timelineSignature(schedule)}`);
      } else if (!expectedTimelineSignatures[item.id]) {
        check(false, `missing golden timeline signature for ${item.id}`);
      }
    }
  }
  const quickPlanIds = new Set();
  for (const item of data.quickPlan || []) {
    check(!quickPlanIds.has(item.id), `duplicate quickPlan id: ${item.id}`);
    quickPlanIds.add(item.id);
  }
  check((data.quickPlan || []).length === 11, `quickPlan must contain exactly 11 items, found ${(data.quickPlan || []).length}`);
  check(Object.keys(expectedRouteSignatures).every((id) => quickPlanIds.has(id)), 'quickPlan ids do not match golden route fixtures');
  check(routeModeCounts.single === 2, `expected 2 single routes, found ${routeModeCounts.single}`);
  check(routeModeCounts.choice === 5, `expected 5 choice routes, found ${routeModeCounts.choice}`);
  check(routeModeCounts.branching === 4, `expected 4 branching routes, found ${routeModeCounts.branching}`);

  const liveAreaIds = new Set();
  for (const [index, area] of (data.liveAreas || []).entries()) {
    const label = `liveAreas[${index}]`;
    check(typeof area.id === 'string' && area.id.trim(), `${label}.id is required`);
    check(!liveAreaIds.has(area.id), `duplicate liveAreas id: ${area.id}`);
    liveAreaIds.add(area.id);
    checkBilingual(area.name, `${label}.name`);
  }
  check(liveAreaIds.size >= 6, `expected at least 6 live areas, found ${liveAreaIds.size}`);

  const thumbSrcPattern = /^assets\/img\/events\/[a-z0-9-]+\.webp$/;
  const allowedThumbLicenses = new Set(['wikimedia-cc', 'public-domain', 'organizer-press', 'own-photo']);
  const thumbIds = new Set();
  check(data.thumbLibrary && typeof data.thumbLibrary === 'object' && !Array.isArray(data.thumbLibrary), 'thumbLibrary must be an object');
  for (const [thumbId, thumb] of Object.entries(data.thumbLibrary || {})) {
    const label = `thumbLibrary.${thumbId}`;
    check(typeof thumbId === 'string' && thumbId.trim(), `${label} key is invalid`);
    check(!thumbIds.has(thumbId), `duplicate thumbLibrary id: ${thumbId}`);
    thumbIds.add(thumbId);
    check(thumb && typeof thumb === 'object', `${label} must be an object`);
    check(typeof thumb.src === 'string' && thumbSrcPattern.test(thumb.src), `${label}.src must match assets/img/events/[slug].webp`);
    checkBilingual(thumb.alt, `${label}.alt`);
    checkBilingual(thumb.credit, `${label}.credit`);
    checkUrl(thumb.sourceUrl, `${label}.sourceUrl`);
    check(Number.isInteger(thumb.width) && thumb.width > 0, `${label}.width must be a positive integer`);
    check(Number.isInteger(thumb.height) && thumb.height > 0, `${label}.height must be a positive integer`);
    check(allowedThumbLicenses.has(thumb.license), `${label}.license is invalid`);
    const thumbPath = path.join(__dirname, '..', thumb.src);
    check(fs.existsSync(thumbPath), `${label}.src file missing: ${thumb.src}`);
  }

  const eventIds = new Set();
  for (const [index, event] of (data.events || []).entries()) {
    const label = `events[${index}]`;
    check(typeof event.id === 'string' && /^[a-z0-9-]+$/.test(event.id), `${label}.id is invalid`);
    check(!eventIds.has(event.id), `duplicate event id: ${event.id}`);
    eventIds.add(event.id);
    check(dayIds.has(event.date), `${label}.date is outside the planning window`);
    check(typeof event.area === 'string' && event.area.trim(), `${label}.area is required`);
    check(liveAreaIds.has(event.area), `${label}.area "${event.area}" is not in liveAreas`);
    check(typeof event.time === 'string' && event.time.trim(), `${label}.time is required`);
    for (const key of ['timeNote', 'title', 'location', 'summary', 'why', 'access', 'price']) checkBilingual(event[key], `${label}.${key}`);
    check(Array.isArray(event.categories), `${label}.categories must be an array`);
    for (const category of event.categories || []) check(allowedCategories.has(category), `${label} has unknown category: ${category}`);
    const score = Number(event.score);
    check(Number.isFinite(score) && score >= 0 && score <= 5, `${label}.score must be 0–5`);

    const sources = event.sources || (event.source ? [{ url: event.source }] : []);
    check(sources.length > 0, `${label} needs at least one source`);
    for (const [sourceIndex, source] of sources.entries()) {
      checkUrl(source.url, `${label}.sources[${sourceIndex}].url`);
      if (source.label) checkBilingual(source.label, `${label}.sources[${sourceIndex}].label`);
    }
    if (event.thumbId != null && event.thumbId !== '') {
      check(typeof event.thumbId === 'string' && event.thumbId.trim(), `${label}.thumbId must be a non-empty string`);
      check(thumbIds.has(event.thumbId), `${label}.thumbId "${event.thumbId}" is not in thumbLibrary`);
    }
  }
  check(eventIds.size === 58, `expected exactly 58 events, found ${eventIds.size}`);

  for (const [index, stay] of (data.stays || []).entries()) {
    checkBilingual(stay.name, `stays[${index}].name`);
    checkBilingual(stay.body, `stays[${index}].body`);
    checkBilingual(stay.tradeoff, `stays[${index}].tradeoff`);
    check(typeof stay.price === 'string' && stay.price.trim(), `stays[${index}].price is required`);
    if (stay.priceNote) checkBilingual(stay.priceNote, `stays[${index}].priceNote`);
    for (const [metricIndex, metric] of (stay.metrics || []).entries()) {
      const metricLabel = `stays[${index}].metrics[${metricIndex}]`;
      check(typeof metric.key === 'string' && metric.key.trim(), `${metricLabel}.key is required`);
      checkBilingual(metric.value, `${metricLabel}.value`);
      if (metric.label) checkBilingual(metric.label, `${metricLabel}.label`);
    }
  }

  const placeIds = new Set((data.places || []).map((place) => place.id));
  const hubIds = new Set((data.hubs || []).map((hub) => hub.id));
  check(placeIds.size === (data.places || []).length, 'place ids must be unique');
  check(hubIds.size === (data.hubs || []).length, 'hub ids must be unique');
  for (const place of data.places || []) checkBilingual(place.name, `places.${place.id}.name`);
  for (const hub of data.hubs || []) checkBilingual(hub.name, `hubs.${hub.id}.name`);
  for (const placeId of placeIds) {
    check(data.commute && data.commute[placeId], `commute.${placeId} is required`);
    for (const hubId of hubIds) {
      const pair = data.commute && data.commute[placeId] && data.commute[placeId][hubId];
      check(Array.isArray(pair) && pair.length === 2 && pair.every((value) => typeof value === 'string' && /^\d+–\d+$/.test(value)), `commute.${placeId}.${hubId} needs two minute ranges`);
    }
  }

  if (data.commuteMiles) {
    for (const [placeId, hubs] of Object.entries(data.commuteMiles)) {
      check(placeIds.has(placeId), `commuteMiles.${placeId} is not a known place`);
      for (const [hubId, miles] of Object.entries(hubs || {})) {
        check(hubIds.has(hubId), `commuteMiles.${placeId}.${hubId} is not a known hub`);
        check(typeof miles === 'number' && Number.isFinite(miles) && miles > 0, `commuteMiles.${placeId}.${hubId} must be a positive number`);
      }
    }
  }

  for (const [index, source] of (data.sources || []).entries()) {
    checkBilingual(source.label, `sources[${index}].label`);
    checkUrl(source.url, `sources[${index}].url`);
  }

  for (const [index, item] of (data.nearby || []).entries()) {
    const label = `nearby[${index}]`;
    check(typeof item.id === 'string' && /^[a-z0-9-]+$/.test(item.id), `${label}.id is invalid`);
    for (const key of ['when', 'title', 'location', 'summary', 'why', 'price', 'drive']) checkBilingual(item[key], `${label}.${key}`);
    checkUrl(item.source, `${label}.source`);
    const score = Number(item.score);
    check(Number.isFinite(score) && score >= 0 && score <= 5, `${label}.score must be 0–5`);
  }

  const mapHubIds = new Set();
  for (const [index, hub] of (data.mapHubs || []).entries()) {
    const label = `mapHubs[${index}]`;
    check(typeof hub.id === 'string' && /^[a-z0-9-]+$/.test(hub.id), `${label}.id is invalid`);
    check(!mapHubIds.has(hub.id), `duplicate map hub id: ${hub.id}`);
    mapHubIds.add(hub.id);
    check(typeof hub.lat === 'number' && Number.isFinite(hub.lat) && hub.lat > 36 && hub.lat < 37, `${label}.lat out of Monterey range`);
    check(typeof hub.lng === 'number' && Number.isFinite(hub.lng) && hub.lng > -122.2 && hub.lng < -121.5, `${label}.lng out of Monterey range`);
    checkBilingual(hub.name, `${label}.name`);
    checkBilingual(hub.note, `${label}.note`);
    checkBilingual(hub.place, `${label}.place`);
    check(['default', 'featured', 'accent'].includes(hub.tone), `${label}.tone is invalid`);
  }
  check((data.mapHubs || []).length >= 6, `expected at least 6 map hubs, found ${(data.mapHubs || []).length}`);

  const mapPlaceIds = new Set();
  for (const [placeId, place] of Object.entries(data.mapPlaces || {})) {
    const label = `mapPlaces.${placeId}`;
    check(!mapPlaceIds.has(placeId), `duplicate mapPlaces id: ${placeId}`);
    mapPlaceIds.add(placeId);
    check(typeof place.lat === 'number' && Number.isFinite(place.lat) && place.lat > 36 && place.lat < 37, `${label}.lat out of Monterey range`);
    check(typeof place.lng === 'number' && Number.isFinite(place.lng) && place.lng > -122.2 && place.lng < -121.5, `${label}.lng out of Monterey range`);
    checkBilingual(place.name, `${label}.name`);
  }
  check(mapPlaceIds.size >= 10, `expected at least 10 map places, found ${mapPlaceIds.size}`);
}

if (errors.length) {
  console.error('data validation failed:');
  for (const error of errors) console.error(`  - ${error}`);
  process.exitCode = 1;
} else {
  console.log(`data validation passed: ${data.events.length} events, ${data.places.length} origins × ${data.hubs.length} hubs`);
}
