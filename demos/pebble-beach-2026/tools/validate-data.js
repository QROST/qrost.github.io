'use strict';

const path = require('node:path');

global.window = globalThis;
require(path.join(__dirname, '..', 'assets', 'js', 'data.js'));

const data = global.PEBBLE_DATA;
const errors = [];
const allowedCategories = new Set(['essential', 'free', 'paid', 'unpriced']);

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

  for (const [index, item] of (data.quickPlan || []).entries()) {
    for (const key of ['date', 'day', 'title', 'body', 'cost']) checkBilingual(item[key], `quickPlan[${index}].${key}`);
    check(typeof item.id === 'string' && /^qp-[a-z0-9-]+$/.test(item.id), `quickPlan[${index}].id is invalid`);
    check(item.route && typeof item.route === 'object', `quickPlan[${index}].route is required`);
    const mode = item.route && item.route.mode;
    check(['single', 'sequence', 'choice'].includes(mode), `quickPlan[${index}].route.mode is invalid`);
    check(Array.isArray(item.route.stops) && item.route.stops.length >= 1, `quickPlan[${index}].route.stops must have at least one stop`);
    if (mode === 'choice') check(item.route.stops.length >= 2, `quickPlan[${index}] choice route needs at least 2 stops`);
    for (const [stopIndex, stop] of (item.route.stops || []).entries()) {
      const stopLabel = `quickPlan[${index}].route.stops[${stopIndex}]`;
      check(typeof stop.place === 'string' && stop.place.trim(), `${stopLabel}.place is required`);
      check(data.mapPlaces && data.mapPlaces[stop.place], `${stopLabel}.place "${stop.place}" is not in mapPlaces`);
      checkBilingual(stop.label, `${stopLabel}.label`);
    }
  }
  const quickPlanIds = new Set();
  for (const item of data.quickPlan || []) {
    check(!quickPlanIds.has(item.id), `duplicate quickPlan id: ${item.id}`);
    quickPlanIds.add(item.id);
  }
  check((data.quickPlan || []).length >= 7, `quickPlan must contain at least 7 items, found ${(data.quickPlan || []).length}`);

  const eventIds = new Set();
  for (const [index, event] of (data.events || []).entries()) {
    const label = `events[${index}]`;
    check(typeof event.id === 'string' && /^[a-z0-9-]+$/.test(event.id), `${label}.id is invalid`);
    check(!eventIds.has(event.id), `duplicate event id: ${event.id}`);
    eventIds.add(event.id);
    check(dayIds.has(event.date), `${label}.date is outside the planning window`);
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
  }
  check(eventIds.size >= 20, `expected at least 20 events, found ${eventIds.size}`);

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
