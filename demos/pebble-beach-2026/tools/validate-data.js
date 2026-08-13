'use strict';

const path = require('node:path');
const fs = require('node:fs');

global.window = globalThis;
require(path.join(__dirname, '..', 'assets', 'js', 'data.js'));

const data = global.PEBBLE_DATA;
const errors = [];
const allowedCategories = new Set(['essential', 'free', 'paid', 'unpriced']);
const tourOfficialUrls = [
  'https://www.pebblebeachconcours.net/event/pebble-beach-tour-delegance/',
  'https://www.pebblebeachconcours.net/updates/',
  'https://www.pebblebeachconcours.net/wp-content/uploads/2026/08/2026-Concours-Tour-Map-8-11-26-web.pdf',
  'https://www.pebblebeachconcours.net/plan-your-visit/directions-parking-event-maps/'
];
const expectedTourRoute = ['17-Mile Drive', 'Hwy 1', 'Hwy 68', 'Olmsted Road', 'Aguajito Road'];
const expectedTourWaves = ['09:30', '09:45', '10:00'];
const parkingTrafficOfficialUrls = [
  'https://www.pebblebeachconcours.net/entrants-guide/sponsor-maps-directions/',
  'https://www.pebblebeachconcours.net/wp-content/uploads/2026/07/01a_Parking-and-Traffic-Flow-THUR-SUN_LotsOnly.pdf',
  'https://www.pebblebeachconcours.net/plan-your-visit/directions-parking-event-maps/',
  'https://www.openstreetmap.org/copyright'
];
const expectedParkingTrafficCodes = [
  'T', 'V', '1', '2', '3', '4', '5', '6', '7', '8', '8A', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', 'RS', 'BD', 'PO', 'CC'
];
const expectedParkingTrafficIds = ['traffic-loop', 'one-way', 'road-closed', 'permit-only', 'test-drives'];
const expectedRouteSignatures = {
  'qp-0807': 'single::1:alvarado@area::-',
  'qp-0808': 'choice::-::A:choice:A:asilomar@area|B:choice:B:laguna@venue',
  'qp-0809': 'choice::-::A:choice:A:laguna@venue|B:choice:-',
  'qp-0810': 'branching::1:embassy@venue::A:choice:2A:carmel-valley-history@area|B:choice:2B:asilomar@area|C:choice:2C:porsche-seaside@area',
  'qp-0811': 'branching::1:carmel@area::A:choice:2A:embassy?@venue|B:choice:2B:asilomar?@area',
  'qp-0812': 'branching::1:carmel@area>2:lighthouse@area::A:choice:3A:asilomar?@area|B:choice:3B:jetcenter?@venue|C:choice:3C:pebble?@area',
  'qp-0813': 'single::1:portola@area::-',
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
  'qp-0813': '1/1/1/1/-/1',
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
  check(data.checked === '2026-08-06', 'full catalog baseline date must remain 2026-08-06');
  check(data.dynamicUpdatesChecked === '2026-08-10', 'non-Tour dynamic facts must remain scoped through 2026-08-10');
  check(data.tourUpdatesChecked === '2026-08-13', 'Tour guidance recheck date must remain 2026-08-13');
  for (const [key, value] of Object.entries(data.labels || {})) checkBilingual(value, `labels.${key}`);
  for (const [key, value] of Object.entries(data.ui || {})) checkBilingual(value, `ui.${key}`);

  const tourMorning = data.tourMorning;
  check(tourMorning && typeof tourMorning === 'object', 'tourMorning is required');
  if (tourMorning) {
    check(tourMorning.date === '2026-08-13', 'tourMorning.date must be 2026-08-13');
    check(tourMorning.noticeDate === '2026-08-12', 'tourMorning.noticeDate must track the Aug 12 update');
    check(tourMorning.mapDate === '2026-08-11', 'tourMorning.mapDate must track the Aug 11 revised map');
    check(
      tourMorning.recommendedArrival
        && tourMorning.recommendedArrival.start === '06:15'
        && tourMorning.recommendedArrival.end === '06:30',
      'tourMorning recommended arrival must remain 06:15–06:30'
    );
    check(tourMorning.lineup === '07:00', 'tourMorning lineup must remain 07:00');
    check(tourMorning.returnApprox === '12:00', 'tourMorning approximate return must remain 12:00');
    check(JSON.stringify(tourMorning.waves) === JSON.stringify(expectedTourWaves), 'tourMorning wave times drifted');
    check(JSON.stringify(tourMorning.route) === JSON.stringify(expectedTourRoute), 'tourMorning revised route drifted');
    check(JSON.stringify(tourMorning.excludes) === JSON.stringify(['Carmel', 'Big Sur']), 'tourMorning route exclusions drifted');

    const expectedPlanStarts = ['06:15', '07:00', '09:15', '09:30', '10:05', '11:40'];
    check(Array.isArray(tourMorning.viewingPlan), 'tourMorning.viewingPlan must be an array');
    check(
      JSON.stringify((tourMorning.viewingPlan || []).map((step) => step.start)) === JSON.stringify(expectedPlanStarts),
      'tourMorning viewing sequence drifted'
    );
    for (const [index, step] of (tourMorning.viewingPlan || []).entries()) {
      const label = `tourMorning.viewingPlan[${index}]`;
      check(typeof step.start === 'string' && /^\d{2}:\d{2}$/.test(step.start), `${label}.start is invalid`);
      check(typeof step.time === 'string' && step.time.trim(), `${label}.time is required`);
      check(['guide', 'official', 'walk'].includes(step.tone), `${label}.tone is invalid`);
      checkBilingual(step.title, `${label}.title`);
      checkBilingual(step.note, `${label}.note`);
    }

    const expectedParkingIds = ['mpc', 'mb7'];
    check(Array.isArray(tourMorning.parkingAlternatives), 'tourMorning.parkingAlternatives must be an array');
    check(
      JSON.stringify((tourMorning.parkingAlternatives || []).map((option) => option.id)) === JSON.stringify(expectedParkingIds),
      'tourMorning parking alternative ids drifted'
    );
    for (const [index, option] of (tourMorning.parkingAlternatives || []).entries()) {
      const label = `tourMorning.parkingAlternatives[${index}]`;
      check(['campus', 'city'].includes(option.tone), `${label}.tone is invalid`);
      for (const key of ['badge', 'title', 'place', 'cost', 'walk', 'watch', 'best', 'rule']) {
        checkBilingual(option[key], `${label}.${key}`);
      }
      check(Array.isArray(option.links) && option.links.length >= 2, `${label}.links needs at least two entries`);
      for (const [linkIndex, link] of (option.links || []).entries()) {
        const linkLabel = `${label}.links[${linkIndex}]`;
        check(['source', 'map'].includes(link.type), `${linkLabel}.type is invalid`);
        checkBilingual(link.label, `${linkLabel}.label`);
        checkUrl(link.url, `${linkLabel}.url`);
      }
    }
    const parkingText = JSON.stringify(tourMorning.parkingAlternatives || []);
    check(parkingText.includes('$3'), 'MPC alternative must preserve the $3 daily-pass rule');
    check(parkingText.includes('30-minute'), 'MPC alternative must exclude Lot D 30-minute spaces');
    check(parkingText.includes('21009'), 'MB7 alternative must preserve ParkMobile zone 21009');
    check(parkingText.includes('34 spaces'), 'MB7 alternative must preserve its limited 34-space capacity');
    check(parkingText.includes('not a Tour lot'), 'parking alternatives must preserve the non-event-lot boundary');
    check(parkingText.includes('no official source confirms'), 'parking alternatives must preserve the unconfirmed pedestrian-continuity boundary');
    check(parkingText.includes('Rejected as a Tour viewing plan'), 'MB7 must remain explicitly rejected for Tour viewing');
    check(parkingText.includes('$2/hour') && parkingText.includes('$14 daily maximum'), 'MB7 current rate details drifted');
    check(parkingText.includes('9:00–20:00'), 'MB7 enforcement window drifted');
    check(parkingText.includes('daily pass'), 'MPC daily-pass availability boundary drifted');
    check(!parkingText.includes('Bird Rock') && !parkingText.includes('Lone Cypress'), 'named 17-Mile Drive pullouts cannot be parking alternatives');
    const parkingAlternativeUrls = (tourMorning.parkingAlternatives || []).flatMap((option) => (option.links || []).map((link) => link.url));
    for (const url of [
      'https://www.mpc.edu/campus-life/coming-to-campus/parking-and-transportation/index.html',
      'https://www.mpc.edu/campus-life/coming-to-campus/campus-maps.html',
      'https://monterey.gov/your_city_hall/departments/public_works/parking/public_garages_and_lots.php'
    ]) check(parkingAlternativeUrls.includes(url), `parking alternatives must preserve source: ${url}`);

    const expectedParkingExclusionIds = ['freeway', 'airport', 'restricted'];
    check(Array.isArray(tourMorning.parkingExclusions), 'tourMorning.parkingExclusions must be an array');
    check(
      JSON.stringify((tourMorning.parkingExclusions || []).map((item) => item.id)) === JSON.stringify(expectedParkingExclusionIds),
      'tourMorning parking exclusion ids drifted'
    );
    for (const [index, item] of (tourMorning.parkingExclusions || []).entries()) {
      const label = `tourMorning.parkingExclusions[${index}]`;
      checkBilingual(item.title, `${label}.title`);
      checkBilingual(item.body, `${label}.body`);
      check(Array.isArray(item.links) && item.links.length >= 1, `${label}.links needs at least one entry`);
      for (const [linkIndex, link] of (item.links || []).entries()) {
        const linkLabel = `${label}.links[${linkIndex}]`;
        check(link.type === 'source', `${linkLabel}.type must be source`);
        checkBilingual(link.label, `${linkLabel}.label`);
        checkUrl(link.url, `${linkLabel}.url`);
      }
    }
    const exclusionText = JSON.stringify(tourMorning.parkingExclusions || []);
    check(exclusionText.includes('21718'), 'parking exclusions must preserve the freeway-parking law source');
    check(exclusionText.includes('nearing capacity'), 'parking exclusions must preserve the airport capacity reason');
    check(exclusionText.includes('permit-only'), 'parking exclusions must preserve permit-only lot guidance');
    const parkingExclusionUrls = (tourMorning.parkingExclusions || []).flatMap((item) => (item.links || []).map((link) => link.url));
    for (const url of [
      'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=VEH&sectionNum=21718.',
      'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=VEH&sectionNum=21960.',
      'https://www.montereyairport.com/parking'
    ]) check(parkingExclusionUrls.includes(url), `parking exclusions must preserve source: ${url}`);

    const tourSourceIds = new Set();
    const tourSourceUrls = [];
    for (const [index, source] of (tourMorning.sources || []).entries()) {
      const label = `tourMorning.sources[${index}]`;
      check(typeof source.id === 'string' && /^[a-z]+$/.test(source.id), `${label}.id is invalid`);
      check(!tourSourceIds.has(source.id), `${label}.id is duplicated`);
      tourSourceIds.add(source.id);
      checkBilingual(source.label, `${label}.label`);
      checkUrl(source.url, `${label}.url`);
      tourSourceUrls.push(source.url);
    }
    check(JSON.stringify(tourSourceUrls) === JSON.stringify(tourOfficialUrls), 'tourMorning must preserve all four official URLs in priority order');
  }

  const parkingMap = data.parkingTrafficMap;
  check(parkingMap && typeof parkingMap === 'object', 'parkingTrafficMap is required');
  if (parkingMap) {
    check(parkingMap.checked === '2026-08-13', 'parkingTrafficMap.checked must remain 2026-08-13');
    check(parkingMap.mapVersion === '2026-07-20', 'parking traffic-map version must remain 2026-07-20');
    check(parkingMap.defaultDay === 'thu-sat', 'parking map must default to the Aug 13 Thu–Sat scope');
    check(parkingMap.defaultLayer === 'guide', 'parking map must default to the guide layer');

    const expectedDayScopes = [
      ['thu-sat', ['2026-08-13', '2026-08-14', '2026-08-15'], '06:00–18:00'],
      ['sunday', ['2026-08-16'], '04:00–16:00']
    ];
    check(
      JSON.stringify((parkingMap.dayScopes || []).map((scope) => [scope.id, scope.dates, scope.hours])) === JSON.stringify(expectedDayScopes),
      'parking map day scopes or official hours drifted'
    );
    for (const [index, scope] of (parkingMap.dayScopes || []).entries()) {
      check(typeof scope.labelKey === 'string' && scope.labelKey in data.labels, `parkingTrafficMap.dayScopes[${index}].labelKey is invalid`);
    }
    check(
      JSON.stringify((parkingMap.layerFilters || []).map((filter) => filter.id)) === JSON.stringify(['guide', 'general', 'ada', 'assigned', 'traffic', 'all']),
      'parking map layer filters drifted'
    );
    for (const [index, filter] of (parkingMap.layerFilters || []).entries()) {
      check(typeof filter.labelKey === 'string' && filter.labelKey in data.labels, `parkingTrafficMap.layerFilters[${index}].labelKey is invalid`);
    }

    const pointIds = new Set();
    const pointCodes = [];
    const allowedPointKinds = new Set(['guide', 'general', 'ada', 'assigned', 'transit']);
    const allowedPointLayers = new Set(['guide', 'general', 'ada', 'assigned']);
    const allowedDayScopes = new Set(['thu-sat', 'sunday']);
    check(Array.isArray(parkingMap.points) && parkingMap.points.length === 27, 'parking map must contain 25 official codes plus two guide anchors');
    for (const [index, point] of (parkingMap.points || []).entries()) {
      const label = `parkingTrafficMap.points[${index}]`;
      check(typeof point.id === 'string' && /^[a-z0-9-]+$/.test(point.id), `${label}.id is invalid`);
      check(!pointIds.has(point.id), `${label}.id is duplicated`);
      pointIds.add(point.id);
      check(typeof point.code === 'string' && point.code.trim(), `${label}.code is required`);
      pointCodes.push(point.code);
      check(allowedPointKinds.has(point.kind), `${label}.kind is invalid`);
      check(Array.isArray(point.layers) && point.layers.length >= 1, `${label}.layers is required`);
      for (const layer of point.layers || []) check(allowedPointLayers.has(layer), `${label}.layers contains invalid layer ${layer}`);
      check(Array.isArray(point.dayScopes) && point.dayScopes.length >= 1, `${label}.dayScopes is required`);
      for (const scope of point.dayScopes || []) check(allowedDayScopes.has(scope), `${label}.dayScopes contains invalid scope ${scope}`);
      check(Array.isArray(point.guideScopes), `${label}.guideScopes must be an array`);
      for (const scope of point.guideScopes || []) check(allowedDayScopes.has(scope), `${label}.guideScopes contains invalid scope ${scope}`);
      if (point.adaScopes != null) {
        check(Array.isArray(point.adaScopes), `${label}.adaScopes must be an array`);
        for (const scope of point.adaScopes || []) check(allowedDayScopes.has(scope), `${label}.adaScopes contains invalid scope ${scope}`);
      }
      check(['official', 'photo'].includes(point.evidence), `${label}.evidence is invalid`);
      check(Number.isFinite(point.lat) && point.lat >= 36.56 && point.lat <= 36.60, `${label}.lat is outside the mapped Pebble Beach area`);
      check(Number.isFinite(point.lng) && point.lng >= -121.98 && point.lng <= -121.94, `${label}.lng is outside the mapped Pebble Beach area`);
      checkBilingual(point.name, `${label}.name`);
      checkBilingual(point.audience, `${label}.audience`);
      checkBilingual(point.access, `${label}.access`);
    }
    check(JSON.stringify(pointCodes) === JSON.stringify(expectedParkingTrafficCodes), 'parking traffic-map codes or order drifted');
    check(new Set(pointCodes).size === pointCodes.length, 'parking traffic-map codes must be unique');
    check(JSON.stringify(parkingMap.points.find((point) => point.id === 'lot-9').adaScopes) === JSON.stringify(['thu-sat']), 'Lot 9 must remain Thu–Sat ADA only');
    check(JSON.stringify(parkingMap.points.find((point) => point.id === 'lot-18').adaScopes) === JSON.stringify(['sunday']), 'Lot 18 must remain Sunday ADA only');
    const generalCodes = (parkingMap.points || []).filter((point) => point.layers.includes('general')).map((point) => point.code);
    check(JSON.stringify(generalCodes) === JSON.stringify(['9', '13', '16', '18', '19']), 'friend-photo General Spectators codes drifted');
    const mapPointText = JSON.stringify(parkingMap.points || []);
    check(mapPointText.includes('do not self-route') && mapPointText.includes('follow gate assignment'), 'parking-map points must preserve the no-self-routing boundary');
    check(mapPointText.includes('not a fixed parking entrance'), 'Portola pin must remain an area anchor, not a parking entrance');
    check(!mapPointText.includes('Open in OpenStreetMap'), 'approximate parking points must not offer direct navigation');

    const controls = parkingMap.trafficControls || [];
    check(JSON.stringify(controls.map((control) => control.id)) === JSON.stringify(expectedParkingTrafficIds), 'parking traffic-control ids drifted');
    check(JSON.stringify(controls.map((control) => control.kind)) === JSON.stringify(['loop', 'oneway', 'closed', 'permit', 'test']), 'parking traffic-control kinds drifted');
    for (const [index, control] of controls.entries()) {
      const label = `parkingTrafficMap.trafficControls[${index}]`;
      check(typeof control.labelKey === 'string' && control.labelKey in data.labels, `${label}.labelKey is invalid`);
      check(Array.isArray(control.dayScopes) && control.dayScopes.length >= 1, `${label}.dayScopes is required`);
      check(Array.isArray(control.guideScopes), `${label}.guideScopes must be an array`);
      check(Array.isArray(control.paths) && control.paths.length >= 1, `${label}.paths is required`);
      for (const [pathIndex, segment] of (control.paths || []).entries()) {
        check(Array.isArray(segment) && segment.length >= 2, `${label}.paths[${pathIndex}] needs at least two coordinates`);
        for (const coord of segment || []) {
          check(Array.isArray(coord) && coord.length === 2 && coord.every(Number.isFinite), `${label}.paths[${pathIndex}] has an invalid coordinate`);
        }
      }
      checkBilingual(control.note, `${label}.note`);
    }
    check(JSON.stringify(controls).includes('not live closure'), 'traffic lines must preserve the schematic, non-live boundary');

    const mapSourceIds = new Set();
    const mapSourceUrls = [];
    for (const [index, source] of (parkingMap.sources || []).entries()) {
      const label = `parkingTrafficMap.sources[${index}]`;
      check(typeof source.id === 'string' && /^[a-z]+$/.test(source.id), `${label}.id is invalid`);
      check(!mapSourceIds.has(source.id), `${label}.id is duplicated`);
      mapSourceIds.add(source.id);
      checkBilingual(source.label, `${label}.label`);
      checkUrl(source.url, `${label}.url`);
      mapSourceUrls.push(source.url);
    }
    check(JSON.stringify(mapSourceUrls) === JSON.stringify(parkingTrafficOfficialUrls), 'parking map must preserve official/PDF/OSM sources in order');
  }

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
  check(routeModeCounts.single === 3, `expected 3 single routes, found ${routeModeCounts.single}`);
  check(routeModeCounts.choice === 5, `expected 5 choice routes, found ${routeModeCounts.choice}`);
  check(routeModeCounts.branching === 3, `expected 3 branching routes, found ${routeModeCounts.branching}`);
  const tourQuickPlan = (data.quickPlan || []).find((item) => item.id === 'qp-0813');
  check(Boolean(tourQuickPlan), 'qp-0813 is required');
  if (tourQuickPlan) {
    const serializedTourPlan = JSON.stringify(tourQuickPlan);
    check(!serializedTourPlan.includes('Ferrari Carmel'), 'qp-0813 must not restore the obsolete Carmel branch');
    check(!serializedTourPlan.includes('Legends of the Autobahn'), 'qp-0813 must stay focused on the revised Tour morning');
    for (const wave of expectedTourWaves) check(serializedTourPlan.includes(wave), `qp-0813 is missing departure wave ${wave}`);
    check(serializedTourPlan.includes('11:40'), 'qp-0813 must preserve the return-viewing walk-back time');
    check(!/^\$0\b/.test(tourQuickPlan.cost.en), 'qp-0813 cost must not imply that parking is free');
    check(tourQuickPlan.cost.en.includes('Viewing free'), 'qp-0813 must label free viewing explicitly');
  }

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
  const tourEvent = (data.events || []).find((event) => event.id === 'tour');
  check(Boolean(tourEvent), 'Tour event is required');
  if (tourEvent) {
    check(tourEvent.date === '2026-08-13', 'Tour event date must remain 2026-08-13');
    check(tourEvent.time === '07:00–12:00', 'Tour event must retain the official approximate 07:00–12:00 window');
    const tourEventText = JSON.stringify(tourEvent);
    for (const road of expectedTourRoute) check(tourEventText.includes(road), `Tour event is missing revised route road: ${road}`);
    for (const wave of expectedTourWaves) check(tourEventText.includes(wave.replace(/^0/, '')) || tourEventText.includes(wave), `Tour event is missing wave time: ${wave}`);
    check(tourEventText.includes('Big Sur Timber Fire'), 'Tour event must explain the Timber Fire route change');
    check(tourEventText.includes('Do not chase the convoy'), 'Tour event English access note must prohibit convoy chasing');
    check(tourEventText.includes('不要追车'), 'Tour event Chinese access note must prohibit convoy chasing');
    const eventSourceUrls = (tourEvent.sources || []).map((source) => source.url);
    check(JSON.stringify(eventSourceUrls) === JSON.stringify(tourOfficialUrls), 'Tour event must cite all four official URLs in priority order');
  }
  const ferrariCarmelEvent = (data.events || []).find((event) => event.id === 'ferrari-carmel');
  check(Boolean(ferrariCarmelEvent), 'Ferrari Carmel event is required');
  if (ferrariCarmelEvent) {
    const ferrariSummary = JSON.stringify(ferrariCarmelEvent.summary);
    check(ferrariSummary.includes('独立备选'), 'Ferrari Carmel must be labeled as a separate Tour-day alternative');
    check(ferrariSummary.includes('separate same-day alternative'), 'Ferrari Carmel English summary must remain separate from the Tour plan');
    check(!ferrariSummary.includes('pairs naturally with the Tour'), 'Ferrari Carmel must not be presented as a Tour continuation');
  }

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
  const globalSourceUrls = new Set((data.sources || []).map((source) => source.url));
  for (const url of tourOfficialUrls) check(globalSourceUrls.has(url), `global sources missing official Tour URL: ${url}`);

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
