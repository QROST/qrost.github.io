/* Public, bilingual planning data for Monterey Car Week 2026.
 * The full catalog baseline was checked on 2026-08-06. Tour routing, timing and
 * parking guidance and the featured Saturday Exotics / RM / Gooding facts were
 * rechecked on 2026-08-13. Multi-day brand drives and private-hospitality access
 * notes were rechecked on 2026-08-14;
 * other selected dynamic facts remain current through 2026-08-10. Editorial
 * scores, field reports and commute bands are QROST planning judgments, not
 * organizer guarantees.
 */
const planText = (zh, en) => ({ zh, en });
const planStop = (marker, place, zh, en, optional = false, precision = 'area') => ({
  marker,
  place,
  label: planText(zh, en),
  optional,
  precision
});
const planBranch = (id, zh, en, stops = [], kind = 'choice') => ({
  id,
  label: planText(zh, en),
  stops,
  kind
});

/*
 * Reviewed route graphs. Stable markers link every map pin and timeline slot.
 * Root stops are shared in order; choice branches are mutually exclusive;
 * add-ons are optional continuations. Optional stops are never forced into a
 * route line.
 */
const reviewedQuickPlanRoutes = {
  'qp-0807': {
    mode: 'single',
    stops: [planStop('1', 'alvarado', '开幕夜', 'Kickoff')],
    branches: []
  },
  'qp-0808': {
    mode: 'choice',
    stops: [],
    branches: [
      planBranch('A', '公园日', 'Park day', [planStop('A', 'asilomar', 'Asilomar 日', 'Asilomar Day')]),
      planBranch('B', '赛道日', 'Track day', [planStop('B', 'laguna', 'Pre-Reunion', 'Pre-Reunion', false, 'venue')])
    ]
  },
  'qp-0809': {
    mode: 'choice',
    stops: [],
    branches: [
      planBranch('A', '赛道日', 'Track day', [planStop('A', 'laguna', 'Pre-Reunion 周日', 'Pre-Reunion Sunday', false, 'venue')]),
      planBranch('B', '休整与规划', 'Rest and plan')
    ]
  },
  'qp-0810': {
    mode: 'branching',
    stops: [planStop('1', 'embassy', 'ACE 展会', 'ACE Expo', false, 'venue')],
    branches: [
      planBranch('A', '英伦车日', 'British Car Day', [planStop('2A', 'carmel-valley-history', '英伦车日', 'British Car Day')]),
      planBranch('B', 'Electric Coast', 'Electric Coast', [planStop('2B', 'asilomar', 'Electric Coast', 'Electric Coast')]),
      planBranch('C', 'Porsche Seaside', 'Porsche Seaside', [planStop('2C', 'porsche-seaside', 'Porsche Seaside', 'Porsche Seaside')])
    ]
  },
  'qp-0811': {
    mode: 'branching',
    stops: [planStop('1', 'carmel', '慈善车展', 'Concours for a Cause')],
    branches: [
      planBranch('A', 'ACE 晚间拍卖', 'ACE evening auction', [planStop('2A', 'embassy', 'ACE 晚间拍卖', 'ACE Live Auction', true, 'venue')]),
      planBranch('B', 'Night Rider', 'Night Rider', [planStop('2B', 'asilomar', 'Night Rider', 'Night Rider', true)])
    ]
  },
  'qp-0812': {
    mode: 'branching',
    stops: [
      planStop('1', 'carmel', 'Astons on the Avenue', 'Astons on the Avenue'),
      planStop('2', 'lighthouse', '小车展', 'Little Car Show')
    ],
    branches: [
      planBranch('A', 'Luau', 'Luau', [planStop('3A', 'asilomar', 'Luau', 'Luau', true)]),
      planBranch('B', 'Motorlux', 'Motorlux', [planStop('3B', 'jetcenter', 'Motorlux', 'Motorlux', true, 'venue')]),
      planBranch('C', 'Motoring Classic', 'Motoring Classic', [planStop('3C', 'pebble', 'Motoring Classic', 'Motoring Classic', true)])
    ]
  },
  'qp-0813': {
    mode: 'single',
    stops: [
      planStop('1', 'portola', 'Tour 起终点', 'Tour start / finish'),
      planStop('2', 'hay-hill', 'Cadillac V-Series 体验区', 'Cadillac V-Series experience area', true)
    ],
    branches: []
  },
  'qp-0814': {
    mode: 'choice',
    stops: [],
    branches: [
      planBranch('A', 'Werks 路线', 'Werks route', [
        planStop('A1', 'werks', 'Werks Reunion', 'Werks Reunion', false, 'venue'),
        planStop('A2', 'bayonet', 'The Paddock', 'The Paddock', true, 'venue')
      ]),
      planBranch('B', 'Reunion 赛道日', 'Reunion track day', [planStop('B1', 'laguna', 'Reunion 周五', 'Reunion Friday', false, 'venue')])
    ]
  },
  'qp-0815': {
    mode: 'choice',
    stops: [],
    branches: [
      planBranch('A', '街展路线', 'Street-show route', [
        planStop('A0', 'embassy', 'Cars & Coffee', 'Cars & Coffee', true),
        planStop('A1', 'lemons', 'Concours d’Lemons', 'Concours d’Lemons', false, 'venue'),
        planStop('A2', 'exotics', 'Exotics on Broadway', 'Exotics on Broadway')
      ]),
      planBranch('B', 'Reunion 赛道日', 'Reunion track day', [planStop('B1', 'laguna', 'Reunion 周六', 'Reunion Saturday', false, 'venue')])
    ]
  },
  'qp-0816': {
    mode: 'choice',
    stops: [],
    branches: [
      planBranch('A', '主赛场付费路线', 'Paid show-field route', [planStop('A', 'pebble', 'Dawn Patrol / Concours', 'Dawn Patrol / Concours', false, 'venue')]),
      planBranch('B', '免费 Village 路线', 'Free Village route', [planStop('B', 'village', 'Concours Village', 'Concours Village')]),
      planBranch('C', '下午可选续程', 'Optional afternoon add-on', [planStop('C', 'touring-vehicles', 'Car Week Cruise-In', 'Car Week Cruise-In', true)], 'addOn')
    ]
  },
  'qp-0817': {
    mode: 'single',
    stops: [planStop('1', 'stanton', 'Stanton Center', 'Stanton Center', false, 'venue')],
    branches: []
  }
};

const reviewedTimelineMarkers = {
  'qp-0807': [[], ['1'], ['1'], ['1']],
  'qp-0808': [['B'], ['B'], ['A'], ['A']],
  'qp-0809': [['A'], ['A'], ['B'], ['B']],
  'qp-0810': [['1'], ['1'], ['2A', '2B', '2C'], ['2A', '2B', '2C'], []],
  'qp-0811': [['1'], ['1'], ['2A', '2B'], ['2A'], ['2B']],
  'qp-0812': [['1'], ['1'], ['2'], ['2'], ['3A', '3B', '3C'], ['3A', '3B', '3C']],
  'qp-0813': [['1'], ['1'], ['1'], ['1'], [], ['1'], ['2']],
  'qp-0814': [['A1', 'B1'], ['A1'], ['B1'], ['A1'], ['A2'], ['A2']],
  'qp-0815': [['A0'], ['A1', 'B1'], ['A1'], ['A2'], ['B1'], ['A2']],
  'qp-0816': [['A', 'B'], ['A'], ['A'], ['B'], ['C']],
  'qp-0817': [[], ['1'], ['1'], []]
};

function routeFor(planId) {
  const route = reviewedQuickPlanRoutes[planId];
  if (!route) throw new Error(`Missing reviewed route graph: ${planId}`);
  return route;
}

function scheduleFor(planId, schedule) {
  const markers = reviewedTimelineMarkers[planId];
  if (!markers || markers.length !== schedule.length) {
    throw new Error(`Timeline marker count mismatch: ${planId}`);
  }
  return schedule.map((slot, index) => ({ ...slot, routeMarkers: markers[index] }));
}

window.PEBBLE_DATA = {
  checked: '2026-08-06',
  dynamicUpdatesChecked: '2026-08-10',
  tourUpdatesChecked: '2026-08-13',
  saturdaySpotlightsChecked: '2026-08-13',
  brandHouseReportsChecked: '2026-08-14',

  labels: {
    pageTitle: {
      zh: '2026 圆石滩车展公众指南 · Monterey Car Week 8.7–8.17 | QROST',
      en: '2026 Pebble Beach Public Guide · Monterey Car Week Aug 7–17 | QROST'
    },
    metaDescription: {
      zh: '2026 Monterey Car Week 与 Pebble Beach Concours 公众行程指南：8 月 7–17 日逐日活动、是否值得去、票价、住宿价格快照、停车接驳与活动周通勤时间。中英双语。',
      en: 'A public guide to Monterey Car Week and the 2026 Pebble Beach Concours: Aug 7–17 events, value picks, tickets, lodging snapshots, shuttles and event-week travel times. Bilingual EN/中文.'
    },
    ogTitle: {
      zh: '2026 圆石滩车展公众指南 · 8.7–8.17',
      en: '2026 Pebble Beach Public Guide · Aug 7–17'
    },
    ogDescription: {
      zh: '何时去哪里、哪些值得去、住哪里、活动周要留多少通勤时间。官方日程与当期价格快照整理。',
      en: 'Where to go, what is worth it, where to stay and how much travel time to reserve during Monterey Car Week.'
    },
    skip: { zh: '跳到正文', en: 'Skip to content' },
    navTour: { zh: '8.13 Tour', en: 'Aug 13 Tour' },
    navPlan: { zh: '方案', en: 'Plan' },
    navParkingMap: { zh: '停车图', en: 'Parking map' },
    navBrandHouses: { zh: '品牌 House', en: 'Brand houses' },
    navSchedule: { zh: '日程', en: 'Schedule' },
    navNearby: { zh: '周边早场', en: 'Nearby early' },
    navStay: { zh: '住宿', en: 'Stay' },
    navCommute: { zh: '通勤', en: 'Travel' },
    navArchive: { zh: '存档', en: 'Archive' },
    navBackTop: { zh: '回到顶部', en: 'Back to top' },
    heroEyebrow: { zh: '公众行程指南 · 2026', en: 'Public trip guide · 2026' },
    checkedChip: { zh: '全量核对 8 月 6 日 · Tour 与周六精选复核至 8 月 13 日 · 品牌专题复核至 8 月 14 日', en: 'Full audit Aug 6 · Tour + Saturday picks rechecked Aug 13 · brand chapter rechecked Aug 14' },
    heroTitleTop: { zh: '圆石滩，不只一场车展', en: 'Pebble Beach is not one show' },
    heroTitleBottom: { zh: '早到一周，再迎旗舰主展', en: 'Arrive early, then hit the flagship' },
    heroLead: {
      zh: '官方 Monterey Car Week 自 8 月 7 日开场，高峰仍在 13–16 日。这份指南覆盖从免费早场街展到周一返程的完整 11 天：何时、去哪里、值不值得、住哪里、路上多久。',
      en: 'Official Monterey Car Week opens August 7, with peak days still August 13–16. This guide spans all eleven days from free early street shows through Monday departure: when, where, value, lodging and travel time in one plan.'
    },
    tourHeroCta: { zh: '看 8.13 Tour 早晨计划', en: 'See the Aug 13 Tour plan' },
    tourHeroCtaPast: { zh: '查看今天与后续计划', en: 'See today and upcoming plans' },
    seeQuickPlan: { zh: '先看推荐方案', en: 'See the quick plan' },
    heroFineprint: {
      zh: 'Kickoff · ACE 藏品 · 慈善街展 · 微型车展 · Tour · 品牌/赛道 · Concours · 返程',
      en: 'Kickoff · ACE automobilia · charity shows · micro-car day · Tour · marques/track · Concours · depart'
    },
    routeRule: { zh: '活动周法则', en: 'Car Week rule' },
    routeRuleValue: { zh: '一天只选一个主场', en: 'Choose one anchor per day' },
    routeBuffer: { zh: '转场多留 30–60 分钟', en: 'Add 30–60 min between hubs' },
    mapAria: { zh: '蒙特雷半岛真实活动地图', en: 'Live Monterey Peninsula event map' },
    mapFallback: { zh: '地图未能加载。请确认网络后刷新。', en: 'Map failed to load. Check your network and refresh.' },
    mapCoords: { zh: '坐标', en: 'Coords' },
    thumbCredit: { zh: '图片来源', en: 'Photo credit' },
    mapOpenOsm: { zh: '在 OpenStreetMap 打开 ↗', en: 'Open in OpenStreetMap ↗' },
    kpiDays: { zh: '天计划窗口', en: 'day planning window' },
    kpiHubs: { zh: '个主要活动区', en: 'main event hubs' },
    kpiTickets: { zh: '核心活动票价', en: 'core event prices' },
    kpiBuffer: { zh: '分钟活动周缓冲', en: 'min event-week buffer' },
    tourKicker: { zh: '8.13 周四早晨 · 最新路线', en: 'Thu Aug 13 morning · revised route' },
    tourTitle: { zh: '停一次、步行看完三批发车与归来', en: 'Park once, then walk for all three waves and the return' },
    tourIntro: {
      zh: '官方 8 月 12 日更新因 Big Sur Timber Fire 与相关疏散调整传统路线。以下把官方时刻与本站观看规划分开标注，避免把建议误当成主办方保证。',
      en: 'The official Aug 12 update changes the traditional route because of the Big Sur Timber Fire and related evacuations. Official times and this guide’s viewing plan are labeled separately below.'
    },
    tourOfficialBadge: { zh: '官方更新 · 8 月 12 日', en: 'Official update · Aug 12' },
    tourUpdateTitle: { zh: '路线只留在 Pebble Beach 与 Monterey', en: 'The route now stays in Pebble Beach and Monterey' },
    tourUpdateBody: {
      zh: '8 月 11 日官方新版地图显示环线经 17-Mile Drive、Hwy 1、Hwy 68、Olmsted Road 与 Aguajito Road；不再进入 Carmel 或 Big Sur。',
      en: 'The official Aug 11 map shows a loop via 17-Mile Drive, Hwy 1, Hwy 68, Olmsted Road and Aguajito Road; it no longer enters Carmel or Big Sur.'
    },
    tourRouteLabel: { zh: '新版环线', en: 'Revised loop' },
    tourRouteNote: {
      zh: '道路顺序来自官方路线图的视觉判读；更新正文仅明确路线留在 Pebble Beach 与 Monterey。',
      en: 'Road order is read from the official map; the written update states only that the route remains in Pebble Beach and Monterey.'
    },
    tourWaveTitle: { zh: '官方时刻', en: 'Official timing' },
    tourWaveIntro: { zh: 'Portola Road 起终点', en: 'Portola Road start / finish' },
    tourLineupLabel: { zh: '车辆约 7:00 集结', en: 'Cars gather around 7:00' },
    tourReturnLabel: { zh: '约中午返回', en: 'Approximate return around noon' },
    tourTimeCaveat: { zh: '官方注明所有时间均为约数，可能调整。', en: 'The organizer says all times are approximate and subject to change.' },
    tourParkingTitle: { zh: '停车：早进、停一次、全程步行', en: 'Parking: arrive early, park once, stay on foot' },
    tourParkingArrivalLabel: { zh: '本站建议入园', en: 'Guide-recommended arrival' },
    tourParkingArrivalNote: { zh: '6:15–6:30 不是官方开放时间', en: '6:15–6:30 is not an official opening time' },
    tourParkingBody: {
      zh: '官方没有公布普通观众固定停车场。进入 Pebble Beach 后，按现场路标和工作人员指示，停在 Portola Road 起终点附近的指定停车区域，再步行观看。',
      en: 'No fixed general-spectator lot is published. Once inside Pebble Beach, follow event signs and staff directions to designated nearby parking for the Portola Road start / finish, then continue on foot.'
    },
    tourParkingBoundary: {
      zh: '不要把未经官方确认的路肩、住宅街或 ADA Lot 9 当作普通观众停车点。',
      en: 'Do not rely on unconfirmed shoulders, residential streets or ADA Lot 9 as general-spectator parking.'
    },
    tourParkingAlternativesKicker: { zh: '路线边停车调查 · 与 Portola 互斥', en: 'Route-side parking research · choose instead of Portola' },
    tourParkingAlternativesTitle: { zh: '一个条件候选，一个仅供排除的调查笔记', en: 'One conditional candidate, one rejected research note' },
    tourParkingAlternativesIntro: {
      zh: '这是个人指南对公开停车规则的筛选，不是 Tour 官方停车场或官方观看区。MPC 仅是需要出发前完成现场安全确认的条件候选；MB7 已因步行链未证而排除。不与 Portola 方案串联。',
      en: 'This is the guide’s screening of published parking rules—not official Tour lots or official spectator zones. MPC is only a conditional candidate requiring a pre-departure onsite safety check; MB7 is rejected because the walking chain is unverified. Do not combine either with the Portola plan.'
    },
    tourParkingPlaceLabel: { zh: '停车', en: 'Park' },
    tourParkingCostLabel: { zh: '费用 / 规则', en: 'Cost / rule' },
    tourParkingWalkLabel: { zh: '步行', en: 'Walk' },
    tourParkingWatchLabel: { zh: '观看', en: 'Watch' },
    tourParkingBestLabel: { zh: '结论', en: 'Verdict' },
    tourParkingRuleLabel: { zh: '使用边界', en: 'Use boundary' },
    tourParkingEstimate: {
      zh: '步行时间为本站按公开地图估算，不是无障碍路线或当日封控保证；一律走公共人行道和标线过街处。Tour 没有公布车队到达 Aguajito Road 的时间；没有现场确认的连续安全步行路线，就不执行 Monterey 方案。',
      en: 'Walking times are guide estimates from public maps, not accessible-route or event-closure guarantees. Use public sidewalks and marked crossings only. The Tour has not published a pass time for Aguajito Road; without an onsite-confirmed continuous safe walk, do not use a Monterey-side plan.'
    },
    tourPortolaPlanKicker: { zh: 'Portola 方案专属 · 不适用于 Monterey 条件候选', en: 'Portola plan only · not for the Monterey conditional candidate' },
    tourParkingConditionalTitle: { zh: '17-Mile Drive 景点停车位不列为 8.13 选项', en: '17-Mile Drive scenic bays are not an Aug 13 option' },
    tourParkingConditionalBody: {
      zh: '普通日的划线景点停车位不等于 Tour 观众停车位；主办方也没有指定任何 scenic turnout 供 8 月 13 日 Tour 观众使用。本页不推荐 Bird Rock、Lone Cypress 或任何命名 pullout，也不停路肩；进入 Pebble Beach 后只按 Tour 当日停车指引行动。',
      en: 'A scenic bay that is legal on an ordinary day is not Tour spectator parking, and the organizer has not designated any scenic turnout for Aug 13 spectators. This guide does not recommend Bird Rock, Lone Cypress or any named pullout, and shoulders remain off limits; once inside Pebble Beach, use only day-of Tour parking directions.'
    },
    tourParkingNoGoTitle: { zh: '已排除的“看起来很近”停车点', en: 'Nearby-looking places this guide rejects' },
    tourParkingNoGoIntro: {
      zh: '“付费”或“有空地”不等于允许赛事观看停车；现场标志、物业权限与交通指挥永远优先。',
      en: 'A fee or an empty space does not make a place spectator parking. Posted signs, property permission and traffic control always take priority.'
    },
    tourPlanTitle: { zh: '推荐观看顺序', en: 'Suggested viewing sequence' },
    tourPlanIntro: { zh: '以下为本站规划，不是官方时刻表。', en: 'This sequence is a guide recommendation, not an official timetable.' },
    tourToneGuide: { zh: '本站建议', en: 'Guide' },
    tourToneOfficial: { zh: '官方时刻', en: 'Official' },
    tourToneWalk: { zh: '步行', en: 'Walk' },
    tourWarningTitle: { zh: '不要追车，也不要去 Carmel 等待', en: 'Do not chase the convoy or wait in Carmel' },
    tourWarningBody: {
      zh: '新版路线不经过 Carmel 或 Big Sur。Portola 起终点方案与 Monterey 路段备选互斥：出发前选好一处，把车留在那里，不在发车后开车换点。只在现场允许的公共步行区域观看。',
      en: 'The revised route does not pass through Carmel or Big Sur. The Portola start/finish plan and the Monterey route-side alternatives are mutually exclusive: choose before departure, leave the car there and do not drive between viewing points after the Tour starts. Watch only from public pedestrian space that remains open onsite.'
    },
    tourSourcesLabel: { zh: '四个官方复核入口', en: 'Four official checks' },
    parkingMapKicker: { zh: '地图与停车 · 坐标空间分离', en: 'Maps & parking · separate coordinate spaces' },
    parkingMapTitle: { zh: '真实方位与官方场内图，分开看清', en: 'Real-world orientation and the official onsite diagram—kept separate' },
    parkingMapIntro: {
      zh: '“真实地图”只显示有独立坐标来源的公共道路、场地区域与地标；“官方示意图”保留 7/20/26 PDF 的全部编号和交通符号。两者不会叠加，也不能据此绕过入口分配、临时路牌或工作人员指挥。',
      en: 'The Geographic Guide shows only public roads, venue areas and landmarks with independent coordinate sources. The Official Diagram preserves every code and traffic symbol from the July 20 PDF. The two spaces never overlap and neither overrides gate assignments, temporary signs or staff.'
    },
    parkingTabsLabel: { zh: '停车地图视图', en: 'Parking map views' },
    parkingTabGeographic: { zh: '真实地图', en: 'Geographic Guide' },
    parkingTabOfficial: { zh: '官方示意图', en: 'Official Diagram' },
    parkingGeoKicker: { zh: '真实经纬度 · 方位指南', en: 'Real coordinates · orientation guide' },
    parkingGeoTitle: { zh: '用误差范围理解道路与场地，不猜停车入口', en: 'Understand roads and venues with uncertainty—not guessed parking entrances' },
    parkingGeoIntro: {
      zh: '下图使用 OpenStreetMap 地理底图与独立核验的 WGS84 锚点。道路与活动区域用误差圆表达；它只帮助理解相对方位，不提供停车场入口、场内路线或逐点导航。',
      en: 'This view uses an OpenStreetMap basemap and independently checked WGS84 anchors. Roads and event areas are shown as uncertainty circles. It is for relative orientation only—not lot entrances, onsite routes or turn-by-turn navigation.'
    },
    parkingGeoBoundaryTitle: { zh: '刻意不翻译到真实地图的内容', en: 'Intentionally kept off the geographic map' },
    parkingGeoBoundaryBody: {
      zh: '所有编号停车区（包括 Thu–Sat ADA Lot 9 与 Sunday Lot 18）及单行、封路、交通环线、许可路段、试驾流线，都只在官方示意图中查看。普通停车仍由入口和现场人员分配。',
      en: 'Every numbered lot—including Thu–Sat ADA Lot 9 and Sunday Lot 18—and all one-way, closure, traffic-loop, permit-only and test-drive markings remain in the Official Diagram. General parking is still assigned at the gate and onsite.'
    },
    parkingGeoMapAria: { zh: 'Pebble Beach 停车与活动方位真实地图', en: 'Geographic orientation map for Pebble Beach parking and event areas' },
    parkingGeoCaveat: { zh: '圆圈表示位置精度或道路范围，不表示可停车范围；地标与入口的点状符号不按比例。所有锚点均禁止直接导航。', en: 'Circles show positional precision or road extent—not parking availability; point symbols for landmarks and gates are not to scale. Direct navigation is disabled for every anchor.' },
    parkingGeoListKicker: { zh: '核实锚点', en: 'Checked anchors' },
    parkingGeoListTitle: { zh: '点击条目只缩放到方位范围', en: 'Select an item to frame its orientation area' },
    parkingGeoStatus: { zh: '显示 {count} 个方位锚点', en: 'Showing {count} orientation anchors' },
    parkingGeoSelected: { zh: '已查看：{name}', en: 'Viewing: {name}' },
    parkingGeoKindRoad: { zh: '道路范围', en: 'Road area' },
    parkingGeoKindVenue: { zh: '场地区域', en: 'Venue area' },
    parkingGeoKindLandmark: { zh: '公共地标', en: 'Public landmark' },
    parkingGeoKindGate: { zh: '入口参照', en: 'Gate reference' },
    parkingGeoAccuracy: { zh: '约 ±{meters} 米', en: 'Approx. ±{meters} m' },
    parkingGeoNoNavigation: { zh: '非停车点 · 不提供导航', en: 'Not a parking point · no navigation' },
    parkingGeoOpenOsm: { zh: '在 OpenStreetMap 查看区域 ↗', en: 'View area in OpenStreetMap ↗' },
    parkingGeoSourceLabel: { zh: '坐标来源', en: 'Coordinate source' },
    parkingGeoSemanticLabel: { zh: '活动语义', en: 'Event meaning' },
    parkingGeoTileError: { zh: '地图瓦片暂不可用；核实锚点、边界说明与来源仍可使用。', en: 'Map tiles are unavailable; the checked anchors, boundaries and sources remain usable.' },
    parkingGeoTouchEnable: { zh: '启用真实地图拖动', en: 'Enable geographic-map dragging' },
    parkingGeoTouchDisable: { zh: '停用真实地图拖动', en: 'Disable geographic-map dragging' },
    parkingGeoReset: { zh: '重置方位范围', en: 'Reset orientation view' },
    parkingGeoOfficialDirections: { zh: '官方停车与入口说明 ↗', en: 'Official parking and entry guidance ↗' },
    parkingGeoOfficialEventMap: { zh: '官方活动区域图 PDF ↗', en: 'Official event-area map PDF ↗' },
    parkingGeoOsmAttribution: { zh: 'OpenStreetMap 坐标与底图 ↗', en: 'OpenStreetMap coordinates and basemap ↗' },
    parkingMapOfficialBadge: { zh: '官方 Automotive Week 交通图', en: 'Official Automotive Week traffic map' },
    parkingMapHoursThuSat: { zh: '8 月 13–15 日 · 6:00–18:00', en: 'Aug 13–15 · 6:00am–6:00pm' },
    parkingMapHoursSunday: { zh: '8 月 16 日 · 4:00–16:00', en: 'Aug 16 · 4:00am–4:00pm' },
    parkingMapEvidenceBoundary: {
      zh: '官网 PDF 是本图的唯一空间底图，包含停车编号、适用人群与交通线；上传照片与官网版本一致，用于交叉核验现场印刷图。人群注记用于识别，不等于可自行驶入或保证 8.13 Tour 普通停车。',
      en: 'The official PDF is the sole spatial base and contains the lot codes, assigned audiences and traffic lines. The uploaded photo matches it and corroborates the printed onsite copy. Audience labels aid identification but do not authorize self-routing or guarantee Aug 13 Tour parking.'
    },
    parkingMapToolbarLabel: { zh: '停车交通图筛选', en: 'Parking and traffic map filters' },
    parkingMapDayLegend: { zh: '适用日', en: 'Day scope' },
    parkingMapLayerLegend: { zh: '显示内容', en: 'Show' },
    parkingMapDayThuSat: { zh: '8.13 Tour · 周四至周六', en: 'Aug 13 Tour · Thu–Sat' },
    parkingMapDaySunday: { zh: '8.16 周日', en: 'Sun Aug 16' },
    parkingMapLayerGuide: { zh: '8.13 重点', en: 'Aug 13 essentials' },
    parkingMapLayerGeneral: { zh: '普通观众注记', en: 'General-spectator notes' },
    parkingMapLayerAda: { zh: 'ADA', en: 'ADA' },
    parkingMapLayerAssigned: { zh: '指定 / 持证', en: 'Assigned / pass' },
    parkingMapLayerTraffic: { zh: '交通管制', en: 'Traffic controls' },
    parkingMapLayerAll: { zh: '全部', en: 'All' },
    parkingMapCaveat: {
      zh: '这是官方示意图坐标，不是经纬度地图、实时交通或逐车位导航。缩放只放大原图，不表示真实距离或精确入口；开放状态与行驶方向以当天现场为准。',
      en: 'This uses official-diagram coordinates—not latitude/longitude, live traffic or stall-by-stall navigation. Zoom enlarges the source artwork; it does not imply real-world distance or an exact entrance. Day-of availability and directions control.'
    },
    parkingMapFallbackTitle: { zh: '交互图不可用时', en: 'If the interactive diagram is unavailable' },
    parkingMapFallbackBody: {
      zh: '8.13 仍按 Portola Road 附近现场指引停车；Lot 9 仅供持 DMV placard 的 ADA 车辆。其余编号只作识别，不要直接导航驶入。',
      en: 'For Aug 13, still follow onsite directions to parking near Portola Road. Lot 9 is for ADA vehicles with a DMV placard. Use other codes for identification only; do not navigate straight into them.'
    },
    parkingMapOfficialPdf: { zh: '查看官方 PDF ↗', en: 'Open official PDF ↗' },
    parkingMapHostPage: { zh: '官方承载页 ↗', en: 'Official host page ↗' },
    parkingMapDirections: { zh: 'Tour 停车指引 ↗', en: 'Tour parking directions ↗' },
    parkingMapTouchEnable: { zh: '启用地图拖动', en: 'Enable map dragging' },
    parkingMapTouchDisable: { zh: '停用地图拖动', en: 'Disable map dragging' },
    parkingMapListKicker: { zh: '同步清单', en: 'Synchronized list' },
    parkingMapListTitle: { zh: '点击条目在地图中定位', en: 'Select an item to locate it on the map' },
    parkingMapStaticPortola: { zh: '按现场指引进入附近指定停车区', en: 'Follow onsite directions to nearby assigned parking' },
    parkingMapStaticAda: { zh: '8.13–15 仅作 ADA 停车标记，须持 DMV placard', en: 'ADA parking Aug 13–15; DMV placard required' },
    parkingMapStaticGeneral: { zh: '官方图注记为 General Spectators；到场询问，不视作 Tour 保证', en: 'Official legend says General Spectators; ask onsite, not a Tour guarantee' },
    parkingMapWarningTitle: { zh: '先看状态，再看编号', en: 'Read the status before the code' },
    parkingMapWarningBody: {
      zh: '“General Spectators”是官方图例中的人群标签，不代表从任一入口都能直达。8.13 Tour 的负责做法仍是先到 Portola 起终点区域，再听从现场分配；不要为了某个编号穿越封路、许可路段或追逐车队。',
      en: '“General Spectators” is an audience label on the official legend, not proof of direct access from any gate. For the Aug 13 Tour, go first to the Portola start/finish area and accept onsite assignment; never cross closures or permit-only roads—or chase the convoy—for a code.'
    },
    parkingMapStatus: { zh: '显示 {count} 项', en: 'Showing {count} items' },
    parkingMapSelected: { zh: '已定位：{name}', en: 'Focused: {name}' },
    parkingMapEmpty: { zh: '此筛选没有可显示项目。', en: 'Nothing matches this filter.' },
    parkingMapAudienceLabel: { zh: '图例人群', en: 'Legend audience' },
    parkingMapAccessLabel: { zh: '怎么用', en: 'How to use it' },
    parkingMapEvidenceLabel: { zh: '证据', en: 'Evidence' },
    parkingMapPrecisionLabel: { zh: '位置精度', en: 'Location precision' },
    parkingMapPrecisionValue: { zh: '官方 PDF 图面位置；不声称真实经纬度或停车入口精度', en: 'Official-PDF diagram position; no claim of latitude/longitude or entrance precision' },
    parkingMapLocate: { zh: '在图中定位', en: 'Locate on map' },
    parkingMapOfficialEvidence: { zh: '官网 PDF / 官方指引', en: 'Official PDF / directions' },
    parkingMapPhotoEvidence: { zh: '官网 PDF + 上传照片印刷版交叉核验', en: 'Official PDF + uploaded-print corroboration' },
    parkingMapImageAlt: { zh: '2026 Pebble Beach Concours d’Elegance 官方停车与交通流示意图', en: 'Official 2026 Pebble Beach Concours d’Elegance parking and traffic-flow diagram' },
    parkingMapTileError: { zh: '官方矢量图暂不可用；请使用文字清单或打开官方 PDF。', en: 'The official vector diagram is unavailable; use the text list or open the official PDF.' },
    parkingMapTrafficSchematic: { zh: '定位框只帮助放大查看；交通线本身来自官方原图，不是实时封控边界。', en: 'The focus box only helps with zooming. Traffic linework comes from the official artwork and is not a live closure boundary.' },
    parkingMapKindGuide: { zh: '8.13 指引', en: 'Aug 13 guidance' },
    parkingMapKindGeneral: { zh: '普通观众注记', en: 'General note' },
    parkingMapKindAda: { zh: 'ADA', en: 'ADA' },
    parkingMapKindAssigned: { zh: '指定 / 持证', en: 'Assigned / pass' },
    parkingMapKindTransit: { zh: '接驳 / 运营', en: 'Transfer / operations' },
    parkingMapTrafficLoop: { zh: '交通环线', en: 'Traffic loop' },
    parkingMapTrafficOneWay: { zh: '单向通行', en: 'One-way' },
    parkingMapTrafficClosed: { zh: '道路封闭', en: 'Road closed' },
    parkingMapTrafficPermit: { zh: '仅持许可', en: 'Permit only' },
    parkingMapTrafficTest: { zh: '试驾流线', en: 'Test drives' },
    brandHouseKicker: { zh: '8.12–8.16 · 跨日品牌专题', en: 'Aug 12–16 · multi-day brand chapter' },
    brandHouseTitle: { zh: '品牌 House、私人驻地与公众试驾', en: 'Brand houses, private hospitality & public drives' },
    brandHouseIntro: {
      zh: 'House 往往跨越数日，但品牌“在场”不等于公众可进入。先看四项官方免费公众体验与试驾；再把 Bentley、Lamborghini、Range Rover、BMW、Bugatti、Aston Martin、McLaren、Rolls‑Royce 与 Koenigsegg 作为登记、凭证、邀请或准入未公开的 hospitality 线索。私人住宅门牌不作公众导航。',
      en: 'Brand houses often span several days, but brand presence does not equal public access. Start with four officially free public experiences and drives; then treat Bentley, Lamborghini, Range Rover, BMW, Bugatti, Aston Martin, McLaren, Rolls‑Royce and Koenigsegg as request-, credential-, invitation- or unpublished-access hospitality leads. Private residential addresses are not public navigation.'
    },
    brandHousePublicTitle: { zh: '官方公众体验与试驾', en: 'Official public experiences & drives' },
    brandHousePublicIntro: { zh: '以下项目可作为实际行程候选；试驾仍须满足年龄、驾照、现场容量与先到先得规则，周日部分项目仅保留展示或 House。', en: 'These are actionable public options. Drives remain subject to age, license, onsite capacity and first-come rules; on Sunday some continue only as displays or a house.' },
    brandHousePrivateTitle: { zh: 'House / 私人 hospitality 观察表', en: 'House / private-hospitality watchlist' },
    brandHousePrivateIntro: { zh: '仅用于判断品牌活动是否存在、持续到哪一天及如何核实；没有邀请或品牌确认时，不要直接前往。', en: 'Use this list to understand what exists, its date range and how to verify access. Do not arrive without an invitation or brand confirmation.' },
    brandHousePastSummary: { zh: '已结束项目 · {count} 项（点击展开）', en: 'Ended programs · {count} (expand)' },
    brandHouseDirectoryNote: { zh: '本章不是完整展台目录。Porsche、Ferrari、Lincoln、Brabus、Mansory 等官方展示请查总日程；“展示”不等于 House。部分县级来源文件含私人场址，只用于核验证据，不用于导航；任务组议程不等于 permit 已签发。', en: 'This is not a complete display directory. Check the master schedule for official Porsche, Ferrari, Lincoln, Brabus, Mansory and other displays; a display is not a house. Some linked county records contain private venues; use them as evidence, not navigation. A task-force agenda is not proof that a permit was issued.' },
    brandHouseDirectoryLink: { zh: '打开官方展示与试驾总日程', en: 'Open the official displays and drives schedule' },
    brandHousePermitProcessLink: { zh: '县特别活动审批与许可流程', en: 'County special-event approval and permit process' },
    brandHouseScheduleLabel: { zh: '日期 / 时段', en: 'Dates / hours' },
    brandHouseAccessLabel: { zh: '准入 / 费用', en: 'Access / cost' },
    brandHouseDriveLabel: { zh: '展示 / 试驾', en: 'Display / drive' },
    brandHouseParkingLabel: { zh: '到场 / 停车', en: 'Arrival / parking' },
    brandHouseFieldReportLabel: { zh: '现场回报 · 非官方保证', en: 'Field report · not an official guarantee' },
    brandHouseExpandLabel: { zh: '展开证据与到场边界', en: 'Expand evidence and arrival limits' },
    brandHouseActionLabel: { zh: '公众应该怎么做', en: 'What the public should do' },
    brandHouseSourcesLabel: { zh: '核验来源', en: 'Verification sources' },
    brandHouseSafetyTitle: { zh: '“门口 valet”不是路边停车许可', en: '“Door-side valet” is not curb-parking permission' },
    brandHouseSafetyBody: {
      zh: '若工作人员当日提供 valet，含义是按指示在接待点交车，不是自行停在住宅门口、路边或车道。不要把这些 House 串成驾车追点路线；没有品牌确认就选择官方公众试驾。任何试驾都应携带有效驾照，并接受品牌方的年龄、资格与容量限制。',
      en: 'If event staff offer valet that day, hand the vehicle over only at the directed reception point; do not self-park at a residential doorway, curb or drive. Do not turn these houses into a drive-and-chase loop. Without brand confirmation, choose an official public drive instead. Carry a valid license for any drive and observe brand age, eligibility and capacity rules.'
    },
    quickKicker: { zh: '早到 + 主周 · 推荐', en: 'Early + peak · recommended' },
    quickTitle: { zh: '先捡免费早场，再进高峰五天', en: 'Grab free early shows, then the peak five' },
    quickIntro: {
      zh: '若能周五至周三提前落地，慈善街展、微型车展与 Asilomar 免费活动能先建立尺度；Tour 前再决定是否要为赛道与主展买单。',
      en: 'If you can land Friday through Wednesday, charity street shows, the Little Car Show and free Asilomar events build context first—then decide on track and Concours tickets before Tour week.'
    },
    oneRuleTitle: { zh: '只记一条：', en: 'One rule:' },
    oneRuleBody: {
      zh: '周六 Asilomar Day 与 Pre-Reunion 赛道二选一；周一 ACE 藏品展值得专程；周二 Concours for a Cause 与周三 Little Car Show 是早场高性价比免费主场。高峰周五、周六的好活动大量重叠——不要把 Werks、The Quail、Paddock、Laguna Seca、Concorso 和 Exotics 全塞进同一天；半岛不是一个会场。',
      en: 'Pick Asilomar Day or Pre-Reunion on Saturday—not both. Monday’s ACE automobilia expo is worth a dedicated stop. Tuesday’s Concours for a Cause and Wednesday’s Little Car Show are the strongest free early anchors. Peak Friday and Saturday overlap heavily: do not cram Werks, The Quail, Paddock, Laguna Seca, Concorso and Exotics into one day; the peninsula is not a single venue.'
    },
    planStops: { zh: '当日地点', en: 'Stops today' },
    planRouteHint: { zh: '编号与时间线一致；绿色实线为共同/单一路线，橙色虚线为互斥分支，可选点不强制连线。相邻编号会散开，灰色细虚线与圆点标明真实规划坐标。', en: 'Numbers match the timeline; green solid lines are shared/single routes, orange dashed lines are exclusive branches, and optional stops are not forced into a route. Nearby pins spread apart; fine gray dashed legs and dots mark their exact planning coordinates.' },
    planRouteOr: { zh: '或', en: 'or' },
    planRouteShared: { zh: '共同路线', en: 'Shared route' },
    planRouteChoices: { zh: '互斥分支', en: 'Exclusive branches' },
    planRouteAddOns: { zh: '可选续程', en: 'Optional add-ons' },
    planNoMapPin: { zh: '无固定地图点', en: 'No fixed map pin' },
    planMapLabel: { zh: '路线地图', en: 'Route map' },
    planStopOptional: { zh: '可选', en: 'optional' },
    planPrecisionVenue: { zh: '场馆规划点', en: 'Venue planning point' },
    planPrecisionArea: { zh: '区域近似点', en: 'Approximate area' },
    planRouteLoading: { zh: '路线加载中…', en: 'Loading route…' },
    planRouteUnavailable: { zh: '路线暂不可用，仍显示地点。', en: 'Route unavailable; stops still shown.' },
    planTimeline: { zh: '展开每日时间规划', en: 'Expand day timeline' },
    planTimelineHint: { zh: '规划缓冲，非官方时刻表；临行前以各活动官方页为准。', en: 'Planning buffers, not an official timetable—recheck each event page before travel.' },
    planToneCore: { zh: '主场', en: 'Core' },
    planToneOptional: { zh: '可选', en: 'Optional' },
    planToneAlt: { zh: '互斥备选', en: 'Exclusive alternative' },
    planToneTransit: { zh: '转场', en: 'Transit' },
    liveClockLabel: { zh: '当前时间', en: 'Local time' },
    liveModeBrowse: { zh: '浏览全部', en: 'Browse all' },
    liveModeNow: { zh: '此刻进行中', en: 'Happening now' },
    liveModeToday: { zh: '今日活动', en: 'Today’s events' },
    liveAreaAll: { zh: '全部地点', en: 'All places' },
    livePastFolded: { zh: '已过 · 点击展开', en: 'Past · tap to expand' },
    livePastBadge: { zh: '已过', en: 'Past' },
    liveTodayBadge: { zh: '今天', en: 'Today' },
    liveUpcomingBadge: { zh: '未到', en: 'Upcoming' },
    liveOutsideWindow: { zh: '当前不在 8.7–8.17 窗口内。', en: 'Outside the Aug 7–17 window.' },
    liveOutsideWindowBefore: { zh: '尚未进入 8.7–8.17 活动窗口，显示完整未来计划。', en: 'Before the Aug 7–17 window—showing the full upcoming plan.' },
    liveOutsideWindowAfter: { zh: '活动窗口已结束，历史日程默认折叠，仍可展开查看。', en: 'The event window has ended; past plans are folded but remain available.' },
    liveNoNow: { zh: '此刻没有匹配的进行中活动（或时段无法解析）。试试“今日”或换地点。', en: 'Nothing matched as happening now (or times could not be parsed). Try Today or another place.' },
    liveNoToday: { zh: '今天没有匹配活动。', en: 'No matching events today.' },
    liveShowPast: { zh: '显示已过日期', en: 'Show past days' },
    liveHidePast: { zh: '折叠已过日期', en: 'Fold past days' },
    livePastShow: { zh: '展开所有历史日期', en: 'Expand all past days' },
    livePastHide: { zh: '折叠历史日期', en: 'Fold past days' },
    pastGroupSummary: { zh: '较早日程 · {days} 天 / {count} 项（点击展开）', en: 'Earlier days · {days} days / {count} events (expand)' },
    archiveSummary: { zh: '2026 活动周存档 · 8.7–8.17 · {count} 项（点击展开）', en: '2026 Car Week archive · Aug 7–17 · {count} events (expand)' },
    temporalPastBadge: { zh: '已结束 · 保留作参考', en: 'Past · kept for reference' },
    temporalTourLabel: { zh: '8.13 Tour 早晨计划', en: 'Aug 13 Tour morning plan' },
    temporalParkingLabel: { zh: '停车与地图指南', en: 'Parking and map guide' },
    temporalBrandLabel: { zh: '品牌 House 与体验', en: 'Brand houses & experiences' },
    temporalNearbyLabel: { zh: '车展前周边早场', en: 'Pre-week nearby events' },
    temporalStayLabel: { zh: '活动周住宿快照', en: 'Car Week lodging snapshot' },
    quickNoScript: { zh: 'JavaScript 不可用时无法自动整理推荐方案；请查看下方官方来源。', en: 'Automatic plan sorting requires JavaScript; use the official sources below.' },
    liveAllAreas: { zh: '全部地点', en: 'All places' },
    liveAreaLabel: { zh: '按地点筛选', en: 'Filter by place' },
    liveStatusNow: { zh: '此刻 {count} 个进行中', en: '{count} happening now' },
    liveStatusToday: { zh: '今日 {count} 个活动', en: '{count} events today' },
    liveStatusBrowse: { zh: '显示 {count} 个活动', en: 'Showing {count} events' },
    liveDayFilterNote: {
      zh: '“此刻/今日”模式下日期按钮暂不可用；点选日期会回到“浏览全部”。',
      en: 'Day buttons are disabled in Now/Today mode; picking a day returns to Browse all.'
    },
    liveParsedHint: { zh: '“此刻”依赖公开时段字符串的近似解析；多场次与开放式结束时间会放宽匹配。', en: '“Now” uses approximate parsing of public time strings; multi-session and open-ended times are matched loosely.' },
    scheduleKicker: { zh: '8.7–8.17 · 筛选日程', en: 'Aug 7–17 · filter the schedule' },
    scheduleTitle: { zh: '什么时候去哪里，哪些真正值得', en: 'Where to go, when—and what is worth it' },
    scheduleIntro: {
      zh: '时钟按 America/Los_Angeles（太平洋时间）。用下方筛选浏览全部、此刻进行中、今日活动，或按日期、地点、推荐与价格缩小列表；过期日期默认折叠。票价和余票会变，购买前请打开每张卡片里的官方来源复核。演示可用 ?demoDate=2026-08-08&demoTime=14:30。',
      en: 'Clock uses America/Los_Angeles (Pacific Time). Filter below: browse all, happening now, today’s events, or narrow by day, place, picks and price; past days fold by default. Tickets change—reopen each card’s official source before buying. Demo: ?demoDate=2026-08-08&demoTime=14:30.'
    },
    stayKicker: { zh: '住宿 · 当前库存快照', en: 'Lodging · inventory snapshot' },
    stayTitle: { zh: '用房价换时间，还是用通勤换房价', en: 'Trade room price for time—or time for price' },
    stayIntro: {
      zh: '下列区间不是全年均价，而是同一查询口径下仍可见房源的规划带：2026-08-13 至 08-17、1 间房 / 2 位成人、美元每晚页面标价，查询于 2026-08-06。8 月 7–12 日早场夜房价通常低于高峰四晚，若可早到请单独比价。若可住 San Jose 自家/朋友家，把零房费与每日往返路程、时间并列比较。税费、停车、度假村费与取消条款另算。',
      en: 'These are not annual averages. They are planning bands from remaining listings visible under one search: Aug 13–17, 2026, one room for two adults, advertised nightly USD, checked Aug 6. Nights before Aug 13 are often cheaper than the peak block—price early arrivals separately if you can. If you can stay free in San Jose, compare zero lodging against daily round-trip miles and drive time. Taxes, parking, resort fees and cancellation terms are extra.'
    },
    priceMethodLabel: { zh: '如何读价格', en: 'How to read prices' },
    priceMethodValue: { zh: '先看四晚总价，再看“每晚”或往返成本', en: 'Check the four-night total—or the commute cost' },
    priceMethodBody: {
      zh: '动态平台会混合剩余房型、广告位与不同取消条件。页面将价格作为“现在还剩什么”的快照，不承诺未来可订，也不把最低价当作典型价。San Jose 零房费卡用 OSRM 无拥堵路由 + 活动周缓冲估算往返；油费/电费、停车与疲劳另算。',
      en: 'Dynamic platforms mix remaining room types, promoted placements and cancellation terms. Treat this as a snapshot of what was visible, not future availability or a typical rate. The San Jose zero-lodging card uses uncongested OSRM routing plus Car Week buffers for round trips; fuel/charging, parking and fatigue are extra.'
    },
    rerunSearch: { zh: '重新查询当前库存 ↗', en: 'Rerun the current search ↗' },
    commuteKicker: { zh: '通勤 · 规划器', en: 'Travel · planner' },
    commuteTitle: { zh: '平时十几分钟，活动周可能翻倍', en: 'A short drive can double during Car Week' },
    commuteIntro: {
      zh: '选择住宿区与主会场，查看普通时段和活动周驾车规划区间。这里是出发预算，不是实时导航；当天仍需查看官方停车说明与 Caltrans 路况。',
      en: 'Choose a lodging area and event hub to compare ordinary driving with an event-week planning band. This is a departure budget, not live navigation; check official parking and Caltrans on the day.'
    },
    fromLabel: { zh: '住在', en: 'Stay in' },
    toLabel: { zh: '去往', en: 'Travel to' },
    roadKicker: { zh: '最重要的道路提醒', en: 'Most important road alert' },
    roadBody: {
      zh: '8 月 13–16 日对非 Concours 相关交通关闭；持相关活动凭证、餐厅或酒店预订者按现场规则进入。周日普通票车辆听从引导停车，再搭免费接驳到展场。',
      en: 'Closed Aug 13–16 to traffic unrelated to Concours events. Event attendees and guests with dining or lodging reservations enter under onsite rules. On Sunday, GA drivers follow staff to assigned parking and take the included shuttle.'
    },
    officialParking: { zh: '官方停车与接驳 ↗', en: 'Official parking & shuttles ↗' },
    sourcesKicker: { zh: '来源与边界', en: 'Sources & limits' },
    sourcesTitle: { zh: '公开计划，事实可以回查', en: 'A public plan with traceable facts' },
    sourcePrimary: { zh: '主要来源与复核入口', en: 'Primary sources and live checks' },
    boundaryTitle: { zh: '发布口径', en: 'Publication standard' },
    boundaryBody: {
      zh: '全量目录基线核对至 2026-08-06；Tour 路线、停车口径与周六 Exotics、RM Sotheby’s、Gooding Christie’s 三项于 8 月 13 日复核；跨日品牌 House、公众试驾与私人 hospitality 边界于 8 月 14 日复核。现场回报与官方事实分栏呈现，不构成准入、车型、候位或停车保证；其余动态事实更新至 8 月 10 日。',
      en: 'The full catalog baseline was checked Aug 6, 2026. Tour routing, parking, and Saturday’s Exotics, RM Sotheby’s and Gooding Christie’s entries were rechecked Aug 13; multi-day brand houses, public drives and private-hospitality boundaries were rechecked Aug 14. Field reports remain separate from official facts and do not guarantee admission, vehicles, waits or parking; other selected dynamic facts remain current through Aug 10.'
    },
    boundaryUpdate: {
      zh: '临行前 24 小时请重查：官方活动页、票务页、停车图、天气和道路状态。',
      en: 'Within 24 hours of departure, recheck the event page, ticket page, parking map, weather and road status.'
    },
    footerTagline: { zh: '一个面向公众的 Monterey Car Week 独立计划页。', en: 'An independent public planning page for Monterey Car Week.' },
    footerContact: { zh: '联系', en: 'Contact' },
    footerWeChat: { zh: '微信', en: 'WeChat' },
    footerInstagram: { zh: 'Instagram', en: 'Instagram' },
    footerDisclaimer: {
      zh: '全量目录核对于 2026-08-06；Tour 与周六精选于 8 月 13 日复核，品牌专题于 8 月 14 日复核，其余动态事实更新至 8 月 10 日。非官方、非主办方关联；现场回报不构成准入、车型、候位、停车或交通保证。',
      en: 'Full catalog audited Aug 6; Tour and Saturday picks rechecked Aug 13, and the brand chapter rechecked Aug 14, with other dynamic facts current through Aug 10, 2026. Independent and unaffiliated; field reports do not guarantee admission, vehicles, waits, parking or transportation.'
    },
    nearbyKicker: { zh: '车展前 · 半岛周边', en: 'Before Car Week · peninsula nearby' },
    nearbyTitle: { zh: '若能更早抵达，这些也值得顺路', en: 'Worth a detour if you land even earlier' },
    nearbyIntro: {
      zh: '7 月 31–8 月 2 日在 Big Sur / Watsonville；非 Car Week 主线，但车程约 40–90 分钟，适合提前落地缓冲。',
      en: 'Jul 31–Aug 2 in Big Sur and Watsonville—not Car Week core, but roughly 40–90 minutes by car and useful as a pre-arrival buffer.'
    }
  },

  ui: {
    allDays: { zh: '全部日期', en: 'All days' },
    allTypes: { zh: '全部活动', en: 'All events' },
    topPicks: { zh: '重点推荐', en: 'Top picks' },
    free: { zh: '免费入场', en: 'Free admission' },
    paid: { zh: '付费活动', en: 'Paid events' },
    worth: { zh: '推荐度', en: 'editorial score' },
    details: { zh: '展开理由、交通与来源', en: 'Why, access and source' },
    why: { zh: '为什么去', en: 'Why go' },
    access: { zh: '到场提醒', en: 'Access note' },
    officialSource: { zh: '打开官方来源 ↗', en: 'Open official source ↗' },
    noResults: { zh: '这个筛选组合没有活动，换一个日期或类别试试。', en: 'No events match this filter. Try another day or category.' },
    ordinary: { zh: '普通驾车', en: 'Ordinary driving' },
    eventWeek: { zh: '活动周驾车规划', en: 'Car Week driving plan' },
    minutes: { zh: '分钟', en: 'min' },
    commuteAdvice: {
      zh: '驾车到会场入口附近的估算；有固定签到时间时，再按上限多留 30 分钟。',
      en: 'Estimated drive time to the venue area. For a fixed check-in, add another 30 minutes to the upper bound.'
    },
    perNight: { zh: '页面标示每房每晚 · 不含税费', en: 'advertised per room/night · before fees' },
    bestBalance: { zh: '综合推荐', en: 'Best balance' },
    zeroLodging: { zh: '零房费往返', en: 'Zero lodging commute' },
    tradeoff: { zh: '主要取舍', en: 'Main tradeoff' },
    stayDistance: { zh: '单程路程', en: 'One-way distance' },
    stayOrdinary: { zh: '单程普通驾车', en: 'One-way ordinary' },
    stayEventWeek: { zh: '单程活动周规划', en: 'One-way Car Week plan' },
    stayRoundTrip: { zh: '每日往返规划', en: 'Daily round-trip plan' },
    stayFuel: { zh: '燃油粗算（参考）', en: 'Fuel rough cut' },
    oneWayMiles: { zh: '单程路程', en: 'One-way distance' },
    roundTripMiles: { zh: '每日往返路程', en: 'Daily round-trip distance' },
    roundTripTime: { zh: '每日往返时间规划', en: 'Daily round-trip time plan' },
    verified: { zh: '已核对', en: 'checked' },
    tentative: { zh: '出发前复核', en: 'recheck before travel' },
    freeTag: { zh: '免费', en: 'Free' },
    paidTag: { zh: '付费', en: 'Paid' },
    mixedTag: { zh: '免费 + 付费区', en: 'Free + paid zone' },
    soldOutTag: { zh: '部分售罄', en: 'Some sold out' },
    unknownTag: { zh: '价格待公布', en: 'Price pending' },
    admissionUnstatedTag: { zh: '观众票价未单列', en: 'Spectator price not separately listed' },
    subjectTag: { zh: '赛程或交通会变', en: 'Schedule/access may change' },
    dayLabel: { zh: '活动', en: 'events' },
    dayLabelSingular: { zh: '活动', en: 'event' },
    driveLabel: { zh: '车程', en: 'Drive' },
    nearbySource: { zh: '打开活动来源 ↗', en: 'Open event source ↗' },
    langAria: { zh: '切换到英文', en: 'Switch to Chinese' },
    darkAria: { zh: '切换深色模式', en: 'Switch to dark mode' },
    lightAria: { zh: '切换浅色模式', en: 'Switch to light mode' },
    darkTitle: { zh: '深色模式', en: 'Dark mode' },
    lightTitle: { zh: '浅色模式', en: 'Light mode' }
  },

  tourMorning: {
    date: '2026-08-13',
    noticeDate: '2026-08-12',
    mapDate: '2026-08-11',
    recommendedArrival: { start: '06:15', end: '06:30' },
    lineup: '07:00',
    waves: ['09:30', '09:45', '10:00'],
    returnApprox: '12:00',
    route: ['17-Mile Drive', 'Hwy 1', 'Hwy 68', 'Olmsted Road', 'Aguajito Road'],
    excludes: ['Carmel', 'Big Sur'],
    viewingPlan: [
      {
        start: '06:15', time: '06:15–06:30', tone: 'guide',
        title: { zh: '进入 Pebble Beach，按指示停一次', en: 'Enter Pebble Beach and park once as directed' },
        note: { zh: '本站为避开拥堵给出的建议；官方未发布普通观众固定停车场或 6:15 开放时间。', en: 'This is the guide’s congestion-avoidance advice; no fixed general lot or 6:15 opening time is published.' }
      },
      {
        start: '07:00', time: '07:00–09:10', tone: 'guide',
        title: { zh: '沿 Portola Road 看集结车辆', en: 'See the cars staging along Portola Road' },
        note: { zh: '车辆约 7:00 开始集结；留在人行区域并服从工作人员。', en: 'Cars gather around 7:00; remain in pedestrian areas and follow staff.' }
      },
      {
        start: '09:15', time: '09:15', tone: 'walk',
        title: { zh: '步行到 Portola / Stevenson 一侧就位', en: 'Walk into position on the Portola / Stevenson side' },
        note: { zh: 'Portola 是官方起终点，Stevenson 通往 Village；只在现场允许的位置观看。', en: 'Portola is the official start / finish and Stevenson leads toward Village; use only staff-permitted viewing space.' }
      },
      {
        start: '09:30', time: '09:30 · 09:45 · 10:00', tone: 'official',
        title: { zh: '观看三批车辆发车', en: 'Watch all three departure waves' },
        note: { zh: '三批时间来自 8 月 11 日官方新版路线图，均可能调整。', en: 'All three times come from the official Aug 11 revised map and remain subject to change.' }
      },
      {
        start: '10:05', time: '10:05–11:30', tone: 'walk',
        title: { zh: '步行去 Concours Village / RetroAuto', en: 'Walk to Concours Village / RetroAuto' },
        note: { zh: '免费展区位于 Forest Lake Road 与 Stevenson Drive 一带；不要开车换点。', en: 'The free displays sit around Forest Lake Road and Stevenson Drive; do not move the car.' }
      },
      {
        start: '11:40', time: '11:40', tone: 'walk',
        title: { zh: '返回 Portola Road 等待车辆归来', en: 'Return to Portola Road for the cars’ return' },
        note: { zh: '官方活动页预计约中午返回；时间是约数，预留等待。', en: 'The event page gives an approximate noon return; allow for delay.' }
      }
    ],
    parkingAlternatives: [
      {
        id: 'mpc', tone: 'campus',
        badge: { zh: '校方公开规则 · 非赛事专用', en: 'Published campus rules · not an event lot' },
        title: { zh: 'Monterey Peninsula College Lot A', en: 'Monterey Peninsula College Lot A' },
        place: { zh: '980 Fremont Street；从 Via Lavandera 按校内指示前往 Lot A，只停学生 / 普通标线车位', en: '980 Fremont Street; follow campus signs from Via Lavandera to Lot A and use only a marked student/general stall' },
        cost: { zh: '校方说任何人均可在停车场自助机购买 $3 日票；购买后正确展示', en: 'MPC says anyone may buy a $3 daily pass at a parking-lot kiosk; display it correctly' },
        walk: { zh: '约 8–12 分钟 / 0.4–0.6 mi 到 Aguajito / Mark Thomas 一带（地图估算）', en: 'About 8–12 min / 0.4–0.6 mi to the Aguajito / Mark Thomas area (map estimate)' },
        watch: { zh: '只有在现场确认存在连续、开放的公共步行路线与可停留位置时，才前往 Aguajito / Mark Thomas 一带', en: 'Proceed toward Aguajito / Mark Thomas only if a continuous, open public pedestrian route and a legal place to stand are confirmed onsite' },
        best: { zh: '必须在出发前确认校园 / 自助机开放，并能确认连续、开放的公共步行路线。任一条件失效就放弃路线边观看；发车后不转去 Portola，也不沿线找路肩。', en: 'Confirm before departure that campus/kiosks are open and that a continuous open public pedestrian route is available. If either condition fails, abandon route-side viewing; do not switch to Portola after departure or improvise along a shoulder.' },
        rule: { zh: '先确认校园与自助机当日开放；只停划线的 public / student 车位。不用员工、黄色、无证无障碍车位，也不依赖 Lot D 30 分钟免费访客位。MPC 不是 Tour 停车场；当日告示、保安或临时封控优先。', en: 'First confirm that campus and the kiosk are open that day; use only a marked public/student stall. Do not use staff, yellow, unpermitted accessible, or Lot D 30-minute visitor spaces. MPC is not a Tour lot; day-of signs, Security and temporary controls override this guide.' },
        links: [
          { type: 'source', label: { zh: 'MPC 停车证与校规', en: 'MPC permits and rules' }, url: 'https://www.mpc.edu/campus-life/coming-to-campus/parking-and-transportation/index.html' },
          { type: 'map', label: { zh: 'MPC 校园地图', en: 'MPC campus map' }, url: 'https://www.mpc.edu/campus-life/coming-to-campus/campus-maps.html' },
          { type: 'map', label: { zh: 'Aguajito / Mark Thomas 候选区域地图', en: 'Aguajito / Mark Thomas guide-candidate map' }, url: 'https://www.openstreetmap.org/?mlat=36.5908&mlon=-121.8799#map=18/36.5908/-121.8799' }
        ]
      },
      {
        id: 'mb7', tone: 'city',
        badge: { zh: '公共车位可核 · 观看路线不成立', en: 'Public parking verified · viewing route rejected' },
        title: { zh: 'MB7 · Monterey Bay Park', en: 'MB7 · Monterey Bay Park' },
        place: { zh: 'Del Monte Avenue × El Estero；市政公开资料列 34 个车位', en: 'Del Monte Avenue at El Estero; city materials list 34 spaces' },
        cost: { zh: '$2 / 小时，每日最高 $14；每日 9:00–20:00 执法，自助机或 ParkMobile 21009', en: '$2/hour, $14 daily maximum; enforced daily 9:00–20:00, pay station or ParkMobile 21009' },
        walk: { zh: '约 18–24 分钟 / 0.9–1.1 mi 到 Aguajito / Mark Thomas 一带（地图估算）', en: 'About 18–24 min / 0.9–1.1 mi to the Aguajito / Mark Thomas area (map estimate)' },
        watch: { zh: '只有在现场确认存在连续、开放的公共步行路线与可停留位置时，才继续前往 Aguajito / Mark Thomas', en: 'Continue toward Aguajito / Mark Thomas only if a continuous, open public pedestrian route and a legal place to stand are confirmed onsite' },
        best: { zh: '排除，不作为 Tour 观看方案：市营车位本身可核，但从车位到可合法停留观看处的连续安全步行链未获官方确认。', en: 'Rejected as a Tour viewing plan. The city parking itself is verifiable, but no official source confirms a continuous safe walk from the lot to a legal place to stand.' },
        rule: { zh: '车位只有 34 个，并且连续安全步行路线未获官方确认，因此不执行此 Tour 观看方案。不要改停两小时的 Sports Center Lot，也不停 permit-only Lot B / 18。', en: 'There are only 34 spaces, and no official source confirms a continuous safe walk, so do not use this as a Tour viewing plan. Do not substitute the two-hour Sports Center lot or permit-only Lots B / 18.' },
        links: [
          { type: 'source', label: { zh: '市政停车费率与规则', en: 'City parking rates and rules' }, url: 'https://monterey.gov/your_city_hall/departments/public_works/parking/public_garages_and_lots.php' },
          { type: 'map', label: { zh: '打开 MB7', en: 'Open MB7' }, url: 'https://www.openstreetmap.org/search?query=Monterey%20Bay%20Park%2C%20Monterey%2C%20CA' },
          { type: 'map', label: { zh: 'Aguajito / Mark Thomas 距离参考地图', en: 'Aguajito / Mark Thomas distance-reference map' }, url: 'https://www.openstreetmap.org/?mlat=36.5908&mlon=-121.8799#map=18/36.5908/-121.8799' }
        ]
      }
    ],
    parkingExclusions: [
      {
        id: 'freeway',
        title: { zh: 'Hwy 1 主线 / 匝道，Hwy 68 高速路段与路肩', en: 'Hwy 1 mainline / ramps and Hwy 68 freeway sections / shoulders' },
        body: { zh: '除紧急或明确许可情形外，加州法禁止在全控制出入高速公路停车；现场标志也可限制行人。这些法条不授权在 Hwy 68、Olmsted 或 Aguajito 其他路段停车；当地路缘、标志、物业与临时交通管制均优先，且目前没有官方指定的 Tour 停车或观看区。', en: 'California law bars parking on fully access-controlled freeways except narrow exceptions, and posted controls may restrict pedestrians. These statutes do not authorize parking elsewhere on Hwy 68, Olmsted or Aguajito; local curbs, signs, property rights and temporary traffic controls apply, and no official Tour parking or spectator area has been designated there.' },
        links: [
          { type: 'source', label: { zh: '加州车辆法 § 21718', en: 'California Vehicle Code § 21718' }, url: 'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=VEH&sectionNum=21718.' },
          { type: 'source', label: { zh: '加州车辆法 § 21960', en: 'California Vehicle Code § 21960' }, url: 'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=VEH&sectionNum=21960.' }
        ]
      },
      {
        id: 'airport',
        title: { zh: 'Monterey Regional Airport 停车场', en: 'Monterey Regional Airport parking' },
        body: { zh: '机场当前公开提醒车位接近满载，并请附近居民把位置留给旅客。即使付费，本页也不把它列为 Tour 观看停车点。', en: 'The airport currently says its lots are nearing capacity and asks nearby residents to preserve spaces for travelers. This guide does not treat paid airport parking as Tour spectator parking.' },
        links: [
          { type: 'source', label: { zh: '机场当前停车通知', en: 'Current airport parking notice' }, url: 'https://www.montereyairport.com/parking' }
        ]
      },
      {
        id: 'restricted',
        title: { zh: '员工、限时、许可证及私人车位', en: 'Staff, time-limited, permit-only and private spaces' },
        body: { zh: 'MPC 员工 / 黄色车位、Lot D 30 分钟访客位、市政 permit-only Lot B / 18，以及酒店、商家、住宅或其他顾客专用车位都不适合长时间观看。', en: 'MPC staff/yellow spaces, Lot D 30-minute visitor stalls, city permit-only Lots B / 18, and hotel, merchant, residential or customer-only property are unsuitable for a long spectator wait.' },
        links: [
          { type: 'source', label: { zh: 'MPC 停车规则', en: 'MPC parking rules' }, url: 'https://www.mpc.edu/campus-life/coming-to-campus/parking-and-transportation/index.html' },
          { type: 'source', label: { zh: '市政停车表', en: 'City parking table' }, url: 'https://monterey.gov/your_city_hall/departments/public_works/parking/public_garages_and_lots.php' }
        ]
      }
    ],
    sources: [
      {
        id: 'event',
        label: { zh: 'Tour 官方活动页', en: 'Official Tour event page' },
        url: 'https://www.pebblebeachconcours.net/event/pebble-beach-tour-delegance/'
      },
      {
        id: 'update',
        label: { zh: '8 月 12 日官方更新', en: 'Official Aug 12 update' },
        url: 'https://www.pebblebeachconcours.net/updates/'
      },
      {
        id: 'map',
        label: { zh: '8 月 11 日新版路线图 PDF', en: 'Aug 11 revised route map PDF' },
        url: 'https://www.pebblebeachconcours.net/wp-content/uploads/2026/08/2026-Concours-Tour-Map-8-11-26-web.pdf'
      },
      {
        id: 'parking',
        label: { zh: '官方方向、停车与活动图', en: 'Official directions, parking & maps' },
        url: 'https://www.pebblebeachconcours.net/plan-your-visit/directions-parking-event-maps/'
      }
    ]
  },

  brandHouseGuide: {
    checked: '2026-08-14',
    throughDate: '2026-08-16',
    directorySource: 'https://www.pebblebeachconcours.net/displays-and-ride-amp-drive-schedule/',
    permitProcessSource: 'https://www.countyofmonterey.gov/government/departments-a-h/housing-community-development/permit-center/special-events-getting-started',
    lanes: [
      { id: 'public-drive', titleKey: 'brandHousePublicTitle', introKey: 'brandHousePublicIntro', cardIds: ['cadillac-v-series', 'mercedes-benz-drive', 'lexus-drive', 'lucid-drive'] },
      { id: 'house-hospitality', titleKey: 'brandHousePrivateTitle', introKey: 'brandHousePrivateIntro', cardIds: ['bentley-home', 'lamborghini-villa', 'range-rover-residence', 'bmw-villa', 'bugatti-le-domaine', 'aston-martin-house', 'mclaren-event', 'rolls-royce-event', 'koenigsegg-private'] }
    ],
    cards: [
      {
        id: 'cadillac-v-series', lane: 'public-drive', tone: 'public', accessStatus: 'public-free', startDate: '2026-08-13', endDate: '2026-08-15', dateStatus: 'confirmed', verifiedOn: '2026-08-14',
        badge: { zh: '官方确认 · 免费公众体验', en: 'Officially confirmed · free public experience' },
        title: { zh: 'Cadillac V-Series Drive Experience', en: 'Cadillac V-Series Drive Experience' },
        location: { zh: 'Hay Hill；从 Concours Village 按现场标识步行前往', en: 'Hay Hill; follow onsite signs on foot from Concours Village' },
        schedule: { zh: '8 月 13–15 日，每日 09:00–17:00', en: 'August 13–15, daily 9:00am–5:00pm' },
        access: { zh: '免费向公众开放；可预登记以加快签到，但试驾仍先到先得、名额有限。驾驶者须年满 21 岁并出示有效驾照。', en: 'Free and open to the public. Pre-registration may speed check-in, but drives remain first-come, first-served and capacity-limited. Drivers must be 21+ with a valid license.' },
        drive: { zh: '官方列明 Escalade-V、CT5-V Blackwing、LYRIQ-V，路线约 15 分钟。CELESTIQ 官网标示低 40 万美元起，但官方活动车型表未列该车。', en: 'The official lineup lists Escalade-V, CT5-V Blackwing and LYRIQ-V on an approximately 15-minute route. Cadillac lists CELESTIQ from the low-$400Ks, but the event lineup does not name it.' },
        parking: { zh: '不要导航到朋友提供的住宅参照点。按 Concours Village / Hay Hill 标识及交通人员指示抵达；官方未承诺任何私人住宅门口 valet。', en: 'Do not navigate to the residential reference supplied by a friend. Follow Concours Village / Hay Hill signs and traffic staff; no official source promises door-side valet at a private residence.' },
        fieldReport: { date: '2026-08-13', body: { zh: '朋友当天看到 CELESTIQ 候位约 1 小时。该车型与候位时间均未出现在官方活动页，只能作为到场后向 Cadillac 工作人员复核的即时线索。', en: 'A friend reported an approximately one-hour CELESTIQ wait that day. Neither the car nor the wait appears on the official event page; treat both only as a live lead to confirm with Cadillac staff onsite.' } },
        sources: [
          { url: 'https://www.pebblebeachconcours.net/event/cadillac-v-series-drive-experience/', label: { zh: '官方 Cadillac 体验日程与规则', en: 'Official Cadillac experience schedule and rules' } },
          { url: 'https://www.pebblebeachconcours.net/plan-your-visit/automotive-week-experiences/ride-drives/', label: { zh: '官方免费展示与试驾总览', en: 'Official free displays and ride-and-drives overview' } },
          { url: 'https://www.pebblebeachconcours.net/plan-your-visit/directions-parking-event-maps/', label: { zh: '官方方向与停车说明', en: 'Official directions and parking guidance' } },
          { url: 'https://www.cadillac.com/electric/celestiq', label: { zh: 'Cadillac CELESTIQ 官方车型页', en: 'Official Cadillac CELESTIQ page' } }
        ]
      },
      {
        id: 'mercedes-benz-drive', lane: 'public-drive', tone: 'public', accessStatus: 'public-free', startDate: '2026-08-13', endDate: '2026-08-16', dateStatus: 'confirmed', verifiedOn: '2026-08-14',
        badge: { zh: '官方确认 · 免费公众体验', en: 'Officially confirmed · free public experience' },
        title: { zh: 'Mercedes-Benz Test Drive Experience', en: 'Mercedes-Benz Test Drive Experience' },
        location: { zh: 'Concours Village · Mercedes-Benz Future Classics Auction House', en: 'Concours Village · Mercedes-Benz Future Classics Auction House' },
        schedule: { zh: '试驾：8 月 13 日 Concours 专页列 09:00 开始、MBUSA 列 10:00 开始，且官方注明受 Tour 发车时间影响；保守按 10:00 后规划。14–15 日 09:00–17:00。Future Classics Auction House：14–16 日 09:00–17:00', en: 'Drives: for August 13, the Concours detail page lists a 9:00am start while MBUSA lists 10:00am, and the official note says Thursday timing varies with the Tour start; conservatively plan for 10:00am or later. August 14–15 drives run 9:00am–5:00pm. Future Classics Auction House: August 14–16, 9:00am–5:00pm' },
        access: { zh: 'House 在公布时段欢迎到访；免费试驾无需预约、现场先到先得。驾驶者须年满 21 岁、持有效驾照，并完成免责与问卷。', en: 'The House welcomes visitors during published hours. Complimentary test drives require no reservation and are first-come onsite. Drivers must be 21+ with a valid license and must complete a waiver and survey.' },
        drive: { zh: '官方称车型涵盖 Mercedes-AMG、Mercedes-Maybach 与 G-Class，由产品专家陪同；须穿包脚鞋，鞋跟不得高于 2 英寸。', en: 'The official page names Mercedes-AMG, Mercedes-Maybach and G-Class models with a product specialist. Closed-toe shoes are required and heels over two inches are prohibited.' },
        parking: { zh: '把 Auction House 当作活动地点而非独立停车场；按 Pebble Beach 场内标识停车后步行至 Village。', en: 'Treat the Auction House as the activity venue, not a standalone parking lot. Park as directed inside Pebble Beach and continue to the Village on foot.' },
        sources: [
          { url: 'https://www.mbusa.com/en/events-and-partnerships/pebble-beach', label: { zh: 'Mercedes-Benz USA · House 与试驾时段', en: 'Mercedes-Benz USA · house and drive hours' } },
          { url: 'https://www.pebblebeachconcours.net/event/mercedes-benz-drive-experience/', label: { zh: '官方 Concours 试驾规则', en: 'Official Concours drive rules' } },
          { url: 'https://www.pebblebeachconcours.net/plan-your-visit/automotive-week-experiences/ride-drives/', label: { zh: '官方免费展示与试驾总览', en: 'Official free displays and ride-and-drives overview' } }
        ]
      },
      {
        id: 'lexus-drive', lane: 'public-drive', tone: 'public', accessStatus: 'public-free', startDate: '2026-08-13', endDate: '2026-08-16', dateStatus: 'confirmed', verifiedOn: '2026-08-14',
        badge: { zh: '官方确认 · 免费公众体验', en: 'Officially confirmed · free public experience' },
        title: { zh: 'Lexus Driving Experience', en: 'Lexus Driving Experience' },
        location: { zh: '第三球道，Palmero Way 一带；只按现场活动标识进入', en: '3rd Fairway off Palmero Way; enter only as directed by onsite event signs' },
        schedule: { zh: '8 月 13–15 日 09:00–17:00 可试驾；周日试驾关闭，但官方总表仍列 08:00–18:00 展示', en: 'Drives August 13–15, 9:00am–5:00pm; Sunday drives are closed, while the official master schedule still lists display hours of 8:00am–6:00pm' },
        access: { zh: '免费向公众开放、先到先得；驾驶者须年满 18 岁并持有效驾照。', en: 'Complimentary and open to the public on a first-come basis. Drivers must be 18+ with a valid license.' },
        drive: { zh: '官方列举 GX 550、LC 500 Convertible 与全电 ES 等车型；实际车辆以现场为准。', en: 'The official page lists models including GX 550, LC 500 Convertible and the all-electric ES; onsite availability governs.' },
        parking: { zh: '第三球道是体验区，不等于普通观众停车位；按活动交通图与工作人员指示停车后步行。', en: 'The 3rd Fairway is the experience area, not a general-spectator parking promise. Park as directed by event signs and staff, then walk.' },
        sources: [
          { url: 'https://www.pebblebeachconcours.net/event/lexus-drive-experience/', label: { zh: '官方 Lexus 试驾活动页', en: 'Official Lexus drive page' } },
          { url: 'https://www.pebblebeachconcours.net/plan-your-visit/automotive-week-experiences/ride-drives/', label: { zh: '官方免费展示与试驾总览', en: 'Official free displays and ride-and-drives overview' } }
        ]
      },
      {
        id: 'lucid-drive', lane: 'public-drive', tone: 'public', accessStatus: 'public-free', startDate: '2026-08-13', endDate: '2026-08-16', dateStatus: 'confirmed', verifiedOn: '2026-08-14',
        badge: { zh: '官方确认 · 试驾至周六', en: 'Officially confirmed · drives through Saturday' },
        title: { zh: 'Lucid Demo Drive Experience', en: 'Lucid Demo Drive Experience' },
        location: { zh: 'Concours Village', en: 'Concours Village' },
        schedule: { zh: '8 月 13–15 日：Lucid 专页写 09:00–17:30，官方总表写至 17:00；按 17:00 前到场规划。8 月 16 日 08:00–18:00 仅展示', en: 'August 13–15: the Lucid detail page says 9:00am–5:30pm while the master schedule says 5:00pm; plan to arrive before 5:00pm. Display only August 16, 8:00am–6:00pm' },
        access: { zh: '免费向公众开放；无需预约、现场先到先得。驾驶者须年满 21 岁并持有效驾照，可能需签署免责与问卷。', en: 'Free and open to the public; no reservation, first-come onsite. Drivers must be 21+ with a valid license and may need to complete a waiver and survey.' },
        drive: { zh: 'Air、Gravity 与 Air Sapphire 视现场车辆供应；由 Lucid 专家陪同。', en: 'Air, Gravity and Air Sapphire are subject to onsite vehicle availability, with a Lucid specialist.' },
        parking: { zh: 'Concours Village 是活动地点，不是停车保证；按 Pebble Beach 现场标识停车后步行。', en: 'Concours Village is the activity venue, not a parking guarantee. Park as directed inside Pebble Beach and continue on foot.' },
        sources: [
          { url: 'https://www.pebblebeachconcours.net/event/lucid-demo-drive-experience/', label: { zh: '官方 Lucid 试驾活动页', en: 'Official Lucid demo-drive page' } },
          { url: 'https://www.pebblebeachconcours.net/displays-and-ride-amp-drive-schedule/', label: { zh: '官方展示与试驾总日程', en: 'Official displays and ride-and-drive schedule' } }
        ]
      },
      {
        id: 'bentley-home', lane: 'house-hospitality', tone: 'conditional', accessStatus: 'request-required', startDate: '2026-08-13', endDate: '2026-08-16', dateStatus: 'confirmed', verifiedOn: '2026-08-14',
        badge: { zh: '官方 House · 需提交意向', en: 'Official house · submit interest' },
        title: { zh: 'Home of Bentley', en: 'Home of Bentley' },
        location: { zh: 'Pebble Beach；准确入口随品牌确认提供', en: 'Pebble Beach; exact arrival details follow brand confirmation' },
        schedule: { zh: '官方确认 8 月 13–16 日；未公开逐日营业时段', en: 'Officially confirmed August 13–16; daily opening hours are not published' },
        access: { zh: '官网为 Home of Bentley 提供“submit your interest”；这不是 walk-in 保证，也没有公开票价。', en: 'The site offers “submit your interest” for Home of Bentley. This is not a walk-in guarantee, and no public price is posted.' },
        drive: { zh: '同一网站另行接受通用 Bentley Drives 体验的意向登记，但没有确认 Monterey 本周提供 Drive 名额；不要把两项合并理解。', en: 'The same site separately accepts interest in the general Bentley Drives program, but does not confirm a Monterey drive slot this week. Do not merge the two offerings.' },
        parking: { zh: '仅按 Bentley 确认邮件或接待人员到场；没有确认就不要寻找私人入口或停车。', en: 'Arrive only using Bentley confirmation or host instructions; without confirmation, do not search for a private entrance or parking.' },
        publicAction: { zh: '先在线提交意向；未收到确认时改选上方官方公众试驾。', en: 'Submit interest online first; without confirmation, choose an official public drive above.' },
        sources: [
          { url: 'https://bentleyexperiences.com/', label: { zh: 'Bentley Experiences · 2026 Pebble Beach', en: 'Bentley Experiences · Pebble Beach 2026' } }
        ]
      },
      {
        id: 'lamborghini-villa', lane: 'house-hospitality', tone: 'invite', accessStatus: 'credential-only', startDate: '2026-08-14', endDate: '2026-08-16', dateStatus: 'confirmed', verifiedOn: '2026-08-14',
        badge: { zh: 'Lamborghini America 活动票务门户 · 凭证制', en: 'Lamborghini America event ticket portal · credential only' },
        title: { zh: 'Lamborghini Villa Monterey', en: 'Lamborghini Villa Monterey' },
        location: { zh: 'Pebble Beach Golf Links 一带；本页不复述私人场址，仅按个人凭证导航', en: 'Near Pebble Beach Golf Links; this guide does not republish the private venue address—use personal credential directions' },
        schedule: { zh: '8 月 14 日的同一官方 FAQ 同时列出 09:00 与 11:00 开始，均至 17:00；以本人凭证或经销商确认为准，未确认时按 11:00 规划。15 日 09:00–17:00；16 日 08:00–16:00；晚间仅限凭证指定场次', en: 'For August 14, the same official FAQ lists both 9:00am and 11:00am starts, each ending at 5:00pm. Follow your credential or dealer confirmation; without it, plan around 11:00am. August 15 is 9:00am–5:00pm and August 16 is 8:00am–4:00pm; evening access is limited to the session on the credential' },
        access: { zh: '每位来宾须持本人不可转让的品牌 QR 凭证；没有 badge 的同行者不得进入。截至 8 月 14 日，活动票务门户列出 Argento $2,500（1 人）、Oro $6,560（2 人）、Platino $10,000（2 人）与 Diamante $11,000（2 人），价格与库存会变化；不是免费 walk-in House。', en: 'Every guest needs a named, non-transferable brand QR credential; companions without a badge are not admitted. As of August 14, the event ticket portal lists Argento at $2,500 for one, Oro at $6,560 for two, Platino at $10,000 for two and Diamante at $11,000 for two; prices and inventory can change. This is not a free walk-in house.' },
        drive: { zh: '品牌门户写明完整现款车型与 hospitality；没有公开 walk-in 试驾承诺。8 月 16 日 Miura 展示的 Concours 入场边界另算。', en: 'The brand portal describes the current lineup and hospitality, but gives no public walk-in drive promise. The August 16 Miura display remains subject to separate Concours admission.' },
        parking: { zh: 'Villa 严禁停车。持凭证者按官方说明前往 Poppy Hills 的指定 valet / 接驳点，约每 15 分钟发车；网约车也应在该处上下客。', en: 'Parking at the Villa is prohibited. Credentialed guests must use the designated valet/shuttle at Poppy Hills, running roughly every 15 minutes; rideshare uses the same transfer point.' },
        publicAction: { zh: '可在活动票务门户购买仍可用的套案，或向经销商核实；取得本人 QR 凭证前不要前往 Villa。', en: 'Purchase an available package through the event ticket portal or confirm with a dealer; do not go to the Villa before receiving your named QR credential.' },
        sources: [
          { url: 'https://eventsala.com/products/monterey-car-week-2026', label: { zh: 'Lamborghini America 活动票务门户 · 2026 套案', en: 'Lamborghini America event ticket portal · 2026 packages' } },
          { url: 'https://eventsala.com/pages/monterey-car-week-2026-faq', label: { zh: 'Lamborghini America 活动票务门户 · 2026 FAQ', en: 'Lamborghini America event ticket portal · 2026 FAQ' } },
          { url: 'https://www.lamborghini.com/cn-en/%E6%96%B0%E9%97%BB/lamborghini-marks-miuras-60th-anniversary', label: { zh: 'Lamborghini · Miura 60 周年官方公告', en: 'Lamborghini · official Miura 60th-anniversary announcement' } }
        ]
      },
      {
        id: 'bmw-villa', lane: 'house-hospitality', tone: 'conditional', accessStatus: 'unpublished', startDate: '2026-08-12', endDate: '2026-08-15', dateStatus: 'partial', verifiedOn: '2026-08-14',
        badge: { zh: '县任务组议程列名 · 准入未公开', en: 'County task-force agenda listing · access unpublished' },
        title: { zh: 'BMW Villa · Monterey Car Week', en: 'BMW Villa · Monterey Car Week' },
        location: { zh: 'Pebble Beach 私人住宅场地；本页不发布县议程中的场址，也不把它当作公众入口', en: 'Private residential venue in Pebble Beach; this guide does not republish the agenda address or treat it as a public entrance' },
        schedule: { zh: '县任务组议程列出 8 月 12–15 日，但议程不等于 permit 已签发；2026 每日时段未公开', en: 'The county task-force agenda lists August 12–15, but the agenda does not establish permit issuance; 2026 daily hours are not published' },
        access: { zh: 'BMW / 主办方没有公开 2026 walk-in、票价、试驾资格或预约规则；县议程也不证明活动已获最终批准。“未见票价”不等于官方确认免费或人人可进。', en: 'BMW and the organizer have not published 2026 walk-in, pricing, driving-eligibility or reservation rules, and the county agenda does not establish final approval. No published price does not mean officially confirmed free or open admission.' },
        drive: { zh: 'BMW 官方只确认更广泛的 Monterey Car Week 参与，没有公布 Villa 的 2026 车型、试驾或候位时间；建议携带有效驾照并先问门岗。', en: 'BMW confirms broader Monterey Car Week participation, but has not published the Villa’s 2026 cars, drives or wait times. Bring a valid license and ask the gate first.' },
        parking: { zh: '2026 valet 细则未公开。往年官方记录是入口交车给活动 valet、车辆异地停放，并非在私人场地门口或路边自行停车；今年仍须完全服从工作人员。', en: '2026 valet terms are unpublished. Prior official records describe handing vehicles to event valet for offsite parking—not self-parking at the private venue door or curb. Follow staff completely this year.' },
        publicAction: { zh: '只有门岗或 BMW 当日确认准入后才前往；不要把 8 月 13 日个案当作后续日期保证。', en: 'Go only after same-day confirmation from BMW or the gate; do not treat an August 13 observation as a guarantee for later dates.' },
        fieldReport: { date: '2026-08-13', body: { zh: '朋友 8 月 13 日现场回报：白天 walk-in、未另收费，并在入口交车给 valet。公开官方材料尚未确认这三项为 2026 通用政策，到场前与门岗复核。', en: 'A friend reported daytime walk-ins, no separate charge and vehicle handoff to valet on August 13. Public official materials do not establish those as general 2026 policy; reconfirm with the gate before relying on them.' } },
        sources: [
          { url: 'https://www.countyofmonterey.gov/home/showpublisheddocument/146630/639168767873630000', label: { zh: 'Monterey County · 2026 特别活动任务组议程', en: 'Monterey County · 2026 special-event task-force agenda' } },
          { url: 'https://www.countyofmonterey.gov/government/departments-a-h/housing-community-development/permit-center/special-events-getting-started', label: { zh: 'Monterey County · 特别活动审批与许可流程', en: 'Monterey County · special-event approval and permit process' } },
          { url: 'https://www.bmwgroup-classic.com/en/clubs-community/events/kalender-events/monterey-car-week-pebble-beach.html', label: { zh: 'BMW Group Classic · 2026 Monterey 参与', en: 'BMW Group Classic · 2026 Monterey participation' } },
          { url: 'https://www.countyofmonterey.gov/home/showpublisheddocument/133427/638887756447700000', label: { zh: 'Monterey County · 2024 walk-in / valet 历史记录', en: 'Monterey County · historical 2024 walk-in / valet record' } }
        ]
      },
      {
        id: 'bugatti-le-domaine', lane: 'house-hospitality', tone: 'conditional', accessStatus: 'unpublished', dateStatus: 'partial', verifiedOn: '2026-08-14',
        badge: { zh: '官方新车节点 · House 准入未公开', en: 'Official reveal · house access unpublished' },
        title: { zh: 'Bugatti · Destrier / Le Domaine 线索', en: 'Bugatti · Destrier / Le Domaine lead' },
        location: { zh: 'Pebble Beach；2026 House 准确地点未公开', en: 'Pebble Beach; the 2026 house location is unpublished' },
        schedule: { zh: '官方确认 1/1 Destrier 在 Car Week 亮相，并于 8 月 16 日 Concours 收官；House 日期与时段未发布', en: 'Bugatti confirms the one-off Destrier will appear during Car Week and culminate at the August 16 Concours; house dates and hours are not published' },
        access: { zh: '没有 2026 公众 RSVP、单独票价或开放说明。往年 Le Domaine 主要接待 Bugatti 客户；“未见票价”不等于免费开放。', en: 'There is no 2026 public RSVP, standalone price or open-access notice. Prior Le Domaine programs primarily hosted Bugatti customers; no posted price does not mean free entry.' },
        drive: { zh: '官方确认的是 Destrier 发布节点，不是公众试驾；不要推断可试驾 Destrier、Tourbillon 或其他 Bugatti。', en: 'The official fact is the Destrier reveal, not a public drive. Do not infer test-drive access to Destrier, Tourbillon or any other Bugatti.' },
        parking: { zh: '未发布 2026 House 停车或 valet；受邀者只按品牌信息，Concours 观众则按 Concours 官方停车。', en: 'No 2026 house parking or valet guidance is published. Invitees should follow brand instructions; Concours visitors should use official Concours parking.' },
        publicAction: { zh: '没有品牌邀请时，不把它当作公众目的地；8 月 16 日 Concours 门票也不等于 House 准入。', en: 'Without a brand invitation, do not treat it as a public destination; an August 16 Concours ticket does not grant house access.' },
        fieldReport: { date: '2026-08-14', body: { zh: '当日线索称 Bugatti House 正在举行活动；截至复核时，官方仍未发布其 2026 开放时段、入口、停车或公众资格。', en: 'A same-day lead says a Bugatti house is operating; at verification time, Bugatti still had not published 2026 hours, entrance, parking or public eligibility.' } },
        sources: [
          { url: 'https://newsroom.bugatti.com/press-releases/the-bugatti-destrier-a-sculpture-of-speed', label: { zh: 'Bugatti · 2026 Destrier 官方公告', en: 'Bugatti · official 2026 Destrier announcement' } },
          { url: 'https://newsroom.bugatti.com/en/stories/bugatti-craftsmanship-at-monterey-car-week-2025', label: { zh: 'Bugatti · 2025 Le Domaine 客户 hospitality 回顾', en: 'Bugatti · 2025 Le Domaine customer-hospitality recap' } },
          { url: 'https://www.pebblebeachconcours.net/displays-and-ride-amp-drive-schedule/', label: { zh: '2026 官方公众展示清单（未列 Bugatti）', en: '2026 official public display list (Bugatti not listed)' } }
        ]
      },
      {
        id: 'aston-martin-house', lane: 'house-hospitality', tone: 'invite', accessStatus: 'unpublished', dateStatus: 'unpublished', verifiedOn: '2026-08-14',
        badge: { zh: '2026 准入未发布 · 现场回报仅限受邀', en: '2026 access unpublished · field report says invitation only' },
        title: { zh: 'House of Aston Martin', en: 'House of Aston Martin' },
        location: { zh: '2025 官方 House 位于 Spyglass Hill 球场旁；2026 地点与时段未公开，请只使用个人邀请函中的地点', en: 'The official 2025 House was alongside Spyglass Hill; the 2026 location and hours are unpublished, so use only the location in a personal invitation' },
        schedule: { zh: 'Aston Martin 仅确认 Vanquish 25 将在 8 月 10–16 日 Monterey Car Week 首发；未发布 2026 House 专属时段', en: 'Aston Martin confirms the Vanquish 25 premiere during Monterey Car Week, August 10–16, but has not published 2026 House hours' },
        access: { zh: '2026 官方公开资料尚未发布 House 准入规则；2025 官方口径为 invited guests，8 月 13 日现场回报也称需要邀请。规划上只按受邀活动处理，但不要把往年规则冒充 2026 公告。', en: 'Public 2026 materials do not publish House access rules. The official 2025 policy used invited guests, and an August 13 field report also says an invitation was required. Plan conservatively as invite-only without presenting prior-year policy as a 2026 announcement.' },
        drive: { zh: '没有 2026 公开 House 现场试驾或 walk-in 规则。2025 官方的专属驾驶从 Bernardus Lodge 出发，不能套用成 House 排队试驾。', en: 'No public 2026 House walk-in or drive rules are posted. Aston Martin’s 2025 exclusive drives departed Bernardus Lodge and cannot be recast as House walk-in test drives.' },
        parking: { zh: '未找到 2026 公开 valet 或自驾停车说明。受邀者按邀请函与接待人员指示，不把任何私人住宅当作公众入口。', en: 'No public 2026 valet or self-parking guidance was found. Invitees should follow their invitation and host staff; do not treat any private residence as a public entrance.' },
        publicAction: { zh: '只按个人邀请函行动；无邀请者选择公开街展或上方官方公众体验。', en: 'Act only on a personal invitation; without one, choose a public street show or one of the official public experiences above.' },
        fieldReport: { date: '2026-08-13', body: { zh: '朋友当天反馈“需要 invitation”，与 Aston Martin 往年官方的 invited-guests 口径一致；但 2026 House 的地点、时段与交通细则仍未公开。', en: 'A friend’s same-day report that an invitation is required matches Aston Martin’s prior invited-guest policy, but the 2026 House location, hours and transport terms remain unpublished.' } },
        sources: [
          { url: 'https://media.astonmartin.com/vanquish-25-a-celebration-of-an-automotive-flagship/?lang=eng', label: { zh: 'Aston Martin · 2026 Monterey 首发公告', en: 'Aston Martin · 2026 Monterey premiere announcement' } },
          { url: 'https://media.astonmartin.com/aston-martin-celebrates-75-years-in-the-americas-at-2025-monterey-car-week/?lang=eng', label: { zh: 'Aston Martin · 2025 invited-guests 官方口径', en: 'Aston Martin · official 2025 invited-guest policy' } },
          { url: 'https://www.countyofmonterey.gov/home/showpublisheddocument/141493/638899014930270000', label: { zh: 'Monterey County · 2025 private / invitation-only 记录', en: 'Monterey County · 2025 private / invitation-only record' } }
        ]
      },
      {
        id: 'range-rover-residence', lane: 'house-hospitality', tone: 'conditional', accessStatus: 'request-required', startDate: '2026-08-12', endDate: '2026-08-16', dateStatus: 'confirmed', verifiedOn: '2026-08-14',
        badge: { zh: '官方套案 · 需预订确认', en: 'Official package · reservation confirmation required' },
        title: { zh: 'The Residence at Range Rover House', en: 'The Residence at Range Rover House' },
        location: { zh: 'Carmel-by-the-Sea 精品酒店包场；仅按预订指示到达', en: 'Boutique-hotel takeover in Carmel-by-the-Sea; arrive only via reservation instructions' },
        schedule: { zh: 'Car Week 项目 8 月 12–16 日；8 月 12 日入住、17 日退房，共五晚', en: 'Car Week programming August 12–16; check in August 12 and check out August 17 for a five-night stay' },
        access: { zh: '品牌新闻稿称 invitation only；当前官方套案页允许车主与爱好者提交购买请求，且按先到先得、确认付款后生效。两人套案按房型为 $23,500、$25,500、$29,500 或 $31,500；截至 8 月 14 日，最高档售罄、$29,500 档余量有限，价格与库存实时变化。', en: 'The brand release describes invitation-only access; the current official package page lets owners and enthusiasts request purchase on a first-come basis, final only after confirmation and payment. Two-person packages are $23,500, $25,500, $29,500 or $31,500. As of August 14, the top tier is sold out and the $29,500 tier has limited availability; prices and inventory can change.' },
        drive: { zh: '包含住宿、餐饮、定制咨询、机场与活动周专车，以及 The Quail 与 Concours 权益。', en: 'Includes lodging, dining, bespoke appointments, airport and event-week chauffeur transport, plus access to The Quail and Concours.' },
        parking: { zh: '套案含一个 Residence 车位、机场接送与活动周接驳；不要把酒店当作公众参观点。', en: 'The package includes one Residence parking space, airport transfers and Car Week shuttles; do not treat the hotel as a public viewing stop.' },
        publicAction: { zh: '只能先走官方预订请求；收到 concierge 确认并完成付款后再纳入行程，临时到访者跳过。', en: 'Use the official reservation request first; add it only after concierge confirmation and payment. Walk-up visitors should skip it.' },
        sources: [
          { url: 'https://media.landrover.com/en-us/news/2026/05/residence-range-rover-house-new-expression-luxury-hospitality-monterey-car-week', label: { zh: 'Range Rover · 2026 Residence 官方公告', en: 'Range Rover · official 2026 Residence announcement' } },
          { url: 'https://www.rsvprangerover.com/residence/packagedetails.aspx', label: { zh: 'Range Rover · 官方套案与实时价格', en: 'Range Rover · official packages and current prices' } },
          { url: 'https://www.rsvprangerover.com/residence/faqs.aspx', label: { zh: 'Range Rover · 官方交通与停车 FAQ', en: 'Range Rover · official transport and parking FAQ' } }
        ]
      },
      {
        id: 'mclaren-event', lane: 'house-hospitality', tone: 'conditional', accessStatus: 'unpublished', startDate: '2026-08-12', endDate: '2026-08-15', dateStatus: 'partial', verifiedOn: '2026-08-14',
        badge: { zh: '县任务组议程列名 · 准入未公开', en: 'County task-force agenda listing · access unpublished' },
        title: { zh: 'McLaren at Monterey Car Week', en: 'McLaren at Monterey Car Week' },
        location: { zh: 'Monterey Peninsula 住宅场地品牌活动线索；公开准入未发布，本页不复述议程地址', en: 'Brand-activation lead at a residential Monterey Peninsula venue; public access is unpublished and the agenda address is not repeated here' },
        schedule: { zh: '县任务组议程列出 8 月 12–15 日；议程不等于 permit 已签发，且未公开逐日时段', en: 'The county task-force agenda lists August 12–15; it does not establish permit issuance, and daily hours are not published' },
        access: { zh: '县议程只证明活动曾列入任务组审议，不证明最终批准、公众 walk-in、免费或可停车。', en: 'The county agenda shows the event was listed for task-force review; it does not establish final approval, public walk-in access, free admission or parking.' },
        drive: { zh: '没有找到 2026 公开 House 车型、试驾或 RSVP 页面。', en: 'No public 2026 house lineup, drive or RSVP page was found.' },
        parking: { zh: '仅持 McLaren 发出的确认或邀请前往，并按其交通说明；不要自行找住宅入口。', en: 'Attend only with McLaren-issued confirmation or invitation and follow its transport instructions; do not search for a residential entrance.' },
        publicAction: { zh: '没有品牌确认就跳过；不作为公众观赛点。', en: 'Skip without brand confirmation; this is not a public viewing stop.' },
        sources: [
          { url: 'https://www.countyofmonterey.gov/home/showpublisheddocument/146630/639168767873630000', label: { zh: 'Monterey County · 2026 特别活动任务组议程', en: 'Monterey County · 2026 special-event task-force agenda' } },
          { url: 'https://www.countyofmonterey.gov/government/departments-a-h/housing-community-development/permit-center/special-events-getting-started', label: { zh: 'Monterey County · 特别活动审批与许可流程', en: 'Monterey County · special-event approval and permit process' } }
        ]
      },
      {
        id: 'rolls-royce-event', lane: 'house-hospitality', tone: 'conditional', accessStatus: 'unpublished', startDate: '2026-08-13', endDate: '2026-08-15', dateStatus: 'partial', verifiedOn: '2026-08-14',
        badge: { zh: '县任务组议程列名 · 准入未公开', en: 'County task-force agenda listing · access unpublished' },
        title: { zh: 'Rolls-Royce Motor Cars North America', en: 'Rolls-Royce Motor Cars North America' },
        location: { zh: 'Monterey Peninsula 住宅场地品牌活动线索；公开准入未发布，本页不复述议程地址', en: 'Brand-activation lead at a residential Monterey Peninsula venue; public access is unpublished and the agenda address is not repeated here' },
        schedule: { zh: '县任务组议程列出 8 月 13–15 日；议程不等于 permit 已签发，且未公开逐日时段', en: 'The county task-force agenda lists August 13–15; it does not establish permit issuance, and daily hours are not published' },
        access: { zh: '县议程不证明最终批准；也没有找到 2026 公众 walk-in、门票或 RSVP 页面，只按品牌确认处理。', en: 'The county agenda does not establish final approval. No 2026 public walk-in, ticket or RSVP page was found; act only on brand confirmation.' },
        drive: { zh: '没有公开可供散客参加的车型展示或试驾规则。', en: 'No public walk-in vehicle display or drive rules are published.' },
        parking: { zh: '仅持品牌确认者按邀请中的交通安排；不要尝试住宅路边停车。', en: 'Only confirmed guests should follow the transport instructions in their invitation; do not attempt residential curb parking.' },
        publicAction: { zh: '无邀请或品牌确认就不前往。', en: 'Do not go without an invitation or brand confirmation.' },
        sources: [
          { url: 'https://www.countyofmonterey.gov/home/showpublisheddocument/146630/639168767873630000', label: { zh: 'Monterey County · 2026 特别活动任务组议程', en: 'Monterey County · 2026 special-event task-force agenda' } },
          { url: 'https://www.countyofmonterey.gov/government/departments-a-h/housing-community-development/permit-center/special-events-getting-started', label: { zh: 'Monterey County · 特别活动审批与许可流程', en: 'Monterey County · special-event approval and permit process' } }
        ]
      },
      {
        id: 'koenigsegg-private', lane: 'house-hospitality', tone: 'invite', accessStatus: 'private', startDate: '2026-08-14', endDate: '2026-08-15', dateStatus: 'partial', verifiedOn: '2026-08-14',
        badge: { zh: '县议程标题标注 · 私人活动', en: 'County agenda title · private event' },
        title: { zh: 'Koenigsegg Automotive · Private Event', en: 'Koenigsegg Automotive · Private Event' },
        location: { zh: 'Carmel 一带私人活动；不发布议程中的住宅地址', en: 'Private Carmel-area activation; the residential agenda address is not published here' },
        schedule: { zh: '县任务组议程列出 8 月 14–15 日；议程不等于 permit 已签发，且未公开逐日时段', en: 'The county task-force agenda lists August 14–15; it does not establish permit issuance, and daily hours are not published' },
        access: { zh: '县议程中的活动名称本身写作 Private Event；即使最终是否获批仍未由该议程证明，也绝不是公众参观点。', en: 'The agenda entry itself is titled Private Event. Although the agenda does not establish final approval, it is not a public viewing stop.' },
        drive: { zh: '没有公开 walk-in 展示、试驾或 RSVP 规则。', en: 'No public walk-in display, drive or RSVP rules are published.' },
        parking: { zh: '只有受邀者按品牌信息前往；不要在活动住宅周边寻找停车。', en: 'Only invited guests should follow brand instructions; do not seek parking around the event residence.' },
        publicAction: { zh: '普通观众直接跳过。', en: 'General visitors should skip it.' },
        sources: [
          { url: 'https://www.countyofmonterey.gov/home/showpublisheddocument/146630/639168767873630000', label: { zh: 'Monterey County · 2026 特别活动任务组议程', en: 'Monterey County · 2026 special-event task-force agenda' } },
          { url: 'https://www.countyofmonterey.gov/government/departments-a-h/housing-community-development/permit-center/special-events-getting-started', label: { zh: 'Monterey County · 特别活动审批与许可流程', en: 'Monterey County · special-event approval and permit process' } }
        ]
      }
    ]
  },

  parkingTrafficMap: {
    checked: '2026-08-13',
    mapVersion: '2026-07-20',
    coordinateSpace: 'official-diagram',
    diagramSize: { width: 792, height: 612 },
    diagramAsset: 'assets/img/parking-traffic-map-2026.svg',
    sourcePdf: 'https://www.pebblebeachconcours.net/wp-content/uploads/2026/07/01a_Parking-and-Traffic-Flow-THUR-SUN_LotsOnly.pdf',
    defaultDay: 'thu-sat',
    defaultLayer: 'guide',
    dayScopes: [
      { id: 'thu-sat', dates: ['2026-08-13', '2026-08-14', '2026-08-15'], hours: '06:00–18:00', labelKey: 'parkingMapDayThuSat' },
      { id: 'sunday', dates: ['2026-08-16'], hours: '04:00–16:00', labelKey: 'parkingMapDaySunday' }
    ],
    layerFilters: [
      { id: 'guide', labelKey: 'parkingMapLayerGuide' },
      { id: 'general', labelKey: 'parkingMapLayerGeneral' },
      { id: 'ada', labelKey: 'parkingMapLayerAda' },
      { id: 'assigned', labelKey: 'parkingMapLayerAssigned' },
      { id: 'traffic', labelKey: 'parkingMapLayerTraffic' },
      { id: 'all', labelKey: 'parkingMapLayerAll' }
    ],
    points: [
      {
        id: 'lot-1', code: '1', kind: 'assigned', layers: ['assigned'], dayScopes: ['thu-sat', 'sunday'], guideScopes: [], evidence: 'photo',
        mapX: 455.36, mapY: 449.94,
        name: { zh: '第三球道', en: '3rd Fairway' },
        audience: { zh: 'Lexus、PBC', en: 'Lexus, PBC' },
        access: { zh: '指定单位使用；普通观众不要自行驶入。', en: 'Assigned use; general spectators should not self-route here.' }
      },
      {
        id: 'lot-2', code: '2', kind: 'assigned', layers: ['assigned'], dayScopes: ['thu-sat', 'sunday'], guideScopes: [], evidence: 'photo',
        mapX: 420.21, mapY: 429.80,
        name: { zh: 'Casa Palmero 车库', en: 'Casa Palmero Garage' },
        audience: { zh: 'Lodge 住客、Chairman’s、Patron’s', en: 'Lodge Guests, Chairman’s, Patron’s' },
        access: { zh: '住客 / 贵宾指定；无相应资格不要驶入。', en: 'Guest / patron assignment; do not enter without the matching eligibility.' }
      },
      {
        id: 'lot-3', code: '3', kind: 'assigned', layers: ['assigned'], dayScopes: ['thu-sat', 'sunday'], guideScopes: [], evidence: 'photo',
        mapX: 350.37, mapY: 440.61,
        name: { zh: 'The Lodge', en: 'The Lodge' },
        audience: { zh: 'Lodge 住客', en: 'Lodge Guests' },
        access: { zh: '酒店住客指定，不是 Tour 普通停车。', en: 'Reserved for hotel guests; not general Tour parking.' }
      },
      {
        id: 'lot-4', code: '4', kind: 'assigned', layers: ['assigned'], dayScopes: ['thu-sat', 'sunday'], guideScopes: [], evidence: 'photo',
        mapX: 303.30, mapY: 426.00,
        name: { zh: 'Visitor Center Lot', en: 'Visitor Center Lot' },
        audience: { zh: '评委、媒体', en: 'Judges, Media' },
        access: { zh: '证件人群指定；普通观众不要占用。', en: 'Credentialed assignment; not for general spectators.' }
      },
      {
        id: 'lot-5', code: '5', kind: 'assigned', layers: ['assigned'], dayScopes: ['thu-sat', 'sunday'], guideScopes: [], evidence: 'photo',
        mapX: 320.01, mapY: 418.96,
        name: { zh: 'Golf Lot', en: 'Golf Lot' },
        audience: { zh: 'Brabus', en: 'Brabus' },
        access: { zh: '品牌指定；不是普通观众停车。', en: 'Brand-assigned; not general spectator parking.' }
      },
      {
        id: 'lot-6', code: '6', kind: 'assigned', layers: ['assigned'], dayScopes: ['thu-sat', 'sunday'], guideScopes: [], evidence: 'photo',
        mapX: 338.00, mapY: 383.00,
        name: { zh: 'The Hay Hill', en: 'The Hay Hill' },
        audience: { zh: 'Ferrari、CDE 工作人员', en: 'Ferrari & CDE Staff' },
        access: { zh: '品牌 / 工作人员指定；不要自行驶入。', en: 'Brand / staff assignment; do not self-route here.' }
      },
      {
        id: 'lot-7', code: '7', kind: 'assigned', layers: ['assigned'], dayScopes: ['thu-sat', 'sunday'], guideScopes: [], evidence: 'photo',
        mapX: 356.79, mapY: 400.90,
        name: { zh: 'Fairway One', en: 'Fairway One' },
        audience: { zh: 'Ferrari', en: 'Ferrari' },
        access: { zh: '品牌指定；不是普通观众停车。', en: 'Brand-assigned; not general spectator parking.' }
      },
      {
        id: 'lot-8', code: '8', kind: 'assigned', layers: ['assigned'], dayScopes: ['thu-sat', 'sunday'], guideScopes: [], evidence: 'photo',
        mapX: 192.16, mapY: 359.63,
        name: { zh: 'Collins Lot', en: 'Collins Lot' },
        audience: { zh: 'Venue、Entrants、Patron’s、Chairman’s', en: 'Venue, Entrants, Patron’s, Chairman’s' },
        access: { zh: '参展 / 贵宾指定；只有持相应资格或被现场分配时使用。', en: 'Entrant / patron assignment; use only with matching eligibility or an onsite assignment.' }
      },
      {
        id: 'lot-8a', code: '8A', kind: 'assigned', layers: ['assigned'], dayScopes: ['thu-sat', 'sunday'], guideScopes: [], evidence: 'photo',
        mapX: 237.91, mapY: 337.62,
        name: { zh: 'PB Driving Range', en: 'PB Driving Range' },
        audience: { zh: 'Club d’Elegance、Gallery', en: 'Club d’Elegance, Gallery' },
        access: { zh: '指定票种 / 贵宾使用；普通观众不要自行驶入。', en: 'Assigned ticket / hospitality use; general spectators should not self-route here.' }
      },
      {
        id: 'lot-9', code: '9', kind: 'ada', layers: ['general', 'ada'], dayScopes: ['thu-sat'], guideScopes: ['thu-sat'], adaScopes: ['thu-sat'], evidence: 'photo',
        mapX: 157.10, mapY: 328.93,
        name: { zh: '原马术中心', en: 'Formerly the Equestrian Center' },
        audience: { zh: '官方图注记：ADA、Sponsors、General Spectators、Torque Media', en: 'Official legend: ADA, Sponsors, General Spectators, Torque Media' },
        access: { zh: '官网明确 8.13–15 为 ADA Lot 9，须持 DMV placard。图例虽另列普通观众，也不要把它当作可自行驶入的 Tour 普通停车场。', en: 'The official site specifically assigns ADA parking here Aug 13–15 and requires a DMV placard. Although the legend also lists General Spectators, do not treat it as self-directed general Tour parking.' }
      },
      {
        id: 'lot-10', code: '10', kind: 'transit', layers: ['assigned'], dayScopes: ['thu-sat', 'sunday'], guideScopes: [], evidence: 'photo',
        mapX: 221.43, mapY: 294.85,
        name: { zh: 'Special Events Field', en: 'Special Events Field' },
        audience: { zh: '运输 / 支援车辆、International Tent', en: 'Transport and Support Vehicles & International Tent' },
        access: { zh: '后勤与运营使用，不是普通停车。', en: 'Logistics / operations use; not general parking.' }
      },
      {
        id: 'lot-11', code: '11', kind: 'transit', layers: ['assigned'], dayScopes: ['thu-sat', 'sunday'], guideScopes: [], evidence: 'photo',
        mapX: 316.17, mapY: 293.09,
        name: { zh: 'Grand Junction', en: 'Grand Junction' },
        audience: { zh: '媒体、RetroAuto、持证商户', en: 'Media & RetroAuto, Vendors w/Pass' },
        access: { zh: '证件 / 运营使用，不是普通观众停车。', en: 'Credentialed / operational use; not general spectator parking.' }
      },
      {
        id: 'lot-12', code: '12', kind: 'assigned', layers: ['assigned'], dayScopes: ['thu-sat', 'sunday'], guideScopes: [], evidence: 'photo',
        mapX: 290.17, mapY: 252.86,
        name: { zh: 'Old Driving Range', en: 'Old Driving Range' },
        audience: { zh: 'Sponsors、Media、VIP’s、Vol Chairs', en: 'Sponsors, Media, VIP’s, Vol Chairs' },
        access: { zh: '赞助商 / 媒体 / VIP / 志愿者负责人指定。', en: 'Assigned to sponsors, media, VIPs and volunteer chairs.' }
      },
      {
        id: 'lot-13', code: '13', kind: 'general', layers: ['general'], dayScopes: ['thu-sat', 'sunday'], guideScopes: [], evidence: 'photo',
        mapX: 203.44, mapY: 136.25,
        name: { zh: 'Bristol Woods', en: 'Bristol Woods' },
        audience: { zh: '官方图注记：Parc du Concours 工作人员、General Spectators', en: 'Official legend: Parc du Concours Staff, General Spectators' },
        access: { zh: '可作为到场识别编号；没有 Tour 官方文件保证 8.13 可自行进入，只有工作人员分配时才使用。', en: 'Useful as an onsite code. No Tour source guarantees self-directed Aug 13 access; use only when assigned by staff.' }
      },
      {
        id: 'lot-14', code: '14', kind: 'assigned', layers: ['assigned'], dayScopes: ['thu-sat', 'sunday'], guideScopes: [], evidence: 'photo',
        mapX: 225.05, mapY: 234.68,
        name: { zh: 'Stevenson Lot', en: 'Stevenson Lot' },
        audience: { zh: 'Gooding、持 14A Pass 的 Sponsors', en: 'Gooding & Sponsors w/14A Pass' },
        access: { zh: '明确需要相应通行证；不是普通观众停车。', en: 'Matching pass required; not general spectator parking.' }
      },
      {
        id: 'lot-15', code: '15', kind: 'transit', layers: ['assigned'], dayScopes: ['thu-sat', 'sunday'], guideScopes: [], evidence: 'photo',
        mapX: 132.04, mapY: 307.65,
        name: { zh: '101 Drake', en: '101 Drake' },
        audience: { zh: 'PBC 运营、合同安保', en: 'PBC Operations, Contract Security' },
        access: { zh: '运营 / 安保使用，不是观众停车。', en: 'Operations / security use; not spectator parking.' }
      },
      {
        id: 'lot-16', code: '16', kind: 'general', layers: ['general'], dayScopes: ['thu-sat', 'sunday'], guideScopes: [], evidence: 'photo',
        mapX: 120.41, mapY: 74.39,
        name: { zh: 'Spyglass Pit', en: 'Spyglass Pit' },
        audience: { zh: '官方图注记：General Spectators', en: 'Official legend: General Spectators' },
        access: { zh: '仅作为现场编号参考；官方 Tour 指引没有把它指定为 8.13 固定普通停车场，须听从入口分配。', en: 'Onsite code reference only. Tour guidance does not designate it as a fixed Aug 13 general lot; follow gate assignment.' }
      },
      {
        id: 'lot-17', code: '17', kind: 'assigned', layers: ['assigned'], dayScopes: ['thu-sat', 'sunday'], guideScopes: [], evidence: 'photo',
        mapX: 164.59, mapY: 66.31,
        name: { zh: 'Spyglass Lot', en: 'Spyglass Lot' },
        audience: { zh: '球手', en: 'Golfers' },
        access: { zh: '球手指定，不是普通观众停车。', en: 'Golfer-assigned; not general spectator parking.' }
      },
      {
        id: 'lot-18', code: '18', kind: 'ada', layers: ['general', 'ada'], dayScopes: ['sunday'], guideScopes: ['sunday'], adaScopes: ['sunday'], evidence: 'photo',
        mapX: 76.89, mapY: 37.11,
        name: { zh: 'Coastline / Bird Rock', en: 'Coastline / Bird Rock' },
        audience: { zh: '官方图注记：General Spectators / ADA Parking', en: 'Official legend: General Spectators / ADA Parking' },
        access: { zh: '官网明确这里只是 8.16 周日 ADA 停车；不是 8.13 ADA 或 Tour 普通停车建议。', en: 'The official site assigns ADA parking here on Sunday Aug 16 only. It is not Aug 13 ADA or a Tour parking recommendation.' }
      },
      {
        id: 'lot-19', code: '19', kind: 'general', layers: ['general'], dayScopes: ['thu-sat', 'sunday'], guideScopes: [], evidence: 'photo',
        mapX: 186.61, mapY: 65.93,
        name: { zh: 'Spyglass Driving Range', en: 'Spyglass Driving Range' },
        audience: { zh: '官方图注记：General Spectators', en: 'Official legend: General Spectators' },
        access: { zh: '仅作现场识别；8.13 是否开放及如何进入须由入口人员确认。', en: 'Identification only; gate staff must confirm Aug 13 availability and access.' }
      },
      {
        id: 'lot-20', code: '20', kind: 'assigned', layers: ['assigned'], dayScopes: ['thu-sat', 'sunday'], guideScopes: [], evidence: 'photo',
        mapX: 317.33, mapY: 75.95,
        name: { zh: 'Wilson Field', en: 'Wilson Field' },
        audience: { zh: '俱乐部会员', en: 'Club Members' },
        access: { zh: '会员指定，不是普通观众停车。', en: 'Club-member assignment; not general spectator parking.' }
      },
      {
        id: 'ride-share', code: 'RS', kind: 'transit', layers: ['assigned'], dayScopes: ['thu-sat', 'sunday'], guideScopes: [], evidence: 'photo',
        mapX: 308.00, mapY: 267.69,
        name: { zh: 'Ride Share', en: 'Ride Share' },
        audience: { zh: '网约车 / 拼车运营节点', en: 'Rideshare operations point' },
        access: { zh: '上下客 / 运营参照，不是停车授权。', en: 'Drop-off / operations reference, not parking authorization.' }
      },
      {
        id: 'bus-depot', code: 'BD', kind: 'transit', layers: ['assigned'], dayScopes: ['thu-sat', 'sunday'], guideScopes: [], evidence: 'photo',
        mapX: 315.08, mapY: 435.87,
        name: { zh: 'The Merchandise Pavilion', en: 'The Merchandise Pavilion' },
        audience: { zh: 'VC Bus Depot', en: 'VC Bus Depot' },
        access: { zh: '巴士 / 运营节点，不是普通停车。', en: 'Bus / operations point, not general parking.' }
      },
      {
        id: 'post-office', code: 'PO', kind: 'assigned', layers: ['assigned'], dayScopes: ['thu-sat', 'sunday'], guideScopes: [], evidence: 'photo',
        mapX: 277.39, mapY: 459.81,
        name: { zh: 'Post Office', en: 'Post Office' },
        audience: { zh: 'Residents、PBC', en: 'Residents, PBC' },
        access: { zh: '居民 / PBC 指定，不是观众停车。', en: 'Resident / PBC assignment; not spectator parking.' }
      },
      {
        id: 'canary-cottage', code: 'CC', kind: 'assigned', layers: ['assigned'], dayScopes: ['thu-sat', 'sunday'], guideScopes: [], evidence: 'photo',
        mapX: 295.03, mapY: 478.66,
        name: { zh: 'Canary Cottage Lot', en: 'Canary Cottage Lot' },
        audience: { zh: 'PBC Valet、SW/Chairman’s、Patron’s', en: 'PBC Valet, SW/Chairman’s, Patron’s' },
        access: { zh: '代客 / 贵宾指定；SW 在照片中未展开，不作猜测。', en: 'Valet / patron assignment. “SW” is not expanded in the photo and is left uninterpreted.' }
      }
    ],
    trafficControls: [
      {
        id: 'traffic-loop', kind: 'loop', dayScopes: ['thu-sat', 'sunday'], guideScopes: ['thu-sat'], labelKey: 'parkingMapTrafficLoop',
        focusBounds: [42, 42, 720, 548],
        note: { zh: '黄色交通环线直接来自官方图。点此只放大查看图面；不要据此选择入口或逆现场指挥。', en: 'The yellow traffic loop comes directly from the official artwork. Select this only to enlarge the diagram; do not use it to choose a gate or override onsite direction.' }
      },
      {
        id: 'one-way', kind: 'oneway', dayScopes: ['thu-sat', 'sunday'], guideScopes: ['thu-sat'], labelKey: 'parkingMapTrafficOneWay',
        focusBounds: [176, 174, 380, 505],
        note: { zh: '橙色单向箭头保留官方图原始线位；临时路牌与工作人员指挥优先。', en: 'The orange one-way arrows retain their original positions on the official diagram; temporary signs and staff directions take priority.' }
      },
      {
        id: 'road-closed', kind: 'closed', dayScopes: ['thu-sat', 'sunday'], guideScopes: [], labelKey: 'parkingMapTrafficClosed',
        focusBounds: [245, 235, 430, 380],
        note: { zh: '红色 X 封路标记直接来自官方图；它不是实时封控边界，现场临时管制优先。', en: 'The red-X closures come directly from the official artwork. They are not live closure limits; temporary onsite controls take priority.' }
      },
      {
        id: 'permit-only', kind: 'permit', dayScopes: ['thu-sat', 'sunday'], guideScopes: [], labelKey: 'parkingMapTrafficPermit',
        focusBounds: [255, 395, 600, 500],
        note: { zh: '粉色许可路段仅供具备相应资格 / 通行证者，普通观众不要尝试穿行。', en: 'Pink permit-only segments require the matching eligibility / pass; general spectators should not attempt to pass through.' }
      },
      {
        id: 'test-drives', kind: 'test', dayScopes: ['thu-sat', 'sunday'], guideScopes: [], labelKey: 'parkingMapTrafficTest',
        focusBounds: [305, 315, 390, 445],
        note: { zh: '黑色试驾流线是活动运营路线，不是观众步行或驾车捷径。', en: 'The black test-drive flow is an event operations route, not a spectator driving or walking shortcut.' }
      }
    ],
    sources: [
      {
        id: 'host', label: { zh: '官方 Sponsor Maps & Directions', en: 'Official Sponsor Maps & Directions' },
        url: 'https://www.pebblebeachconcours.net/entrants-guide/sponsor-maps-directions/'
      },
      {
        id: 'pdf', label: { zh: '7/20/26 官方停车与交通 PDF', en: 'Official July 20 parking & traffic PDF' },
        url: 'https://www.pebblebeachconcours.net/wp-content/uploads/2026/07/01a_Parking-and-Traffic-Flow-THUR-SUN_LotsOnly.pdf'
      },
      {
        id: 'directions', label: { zh: '官方 Tour 起终点停车指引', en: 'Official Tour start/finish parking directions' },
        url: 'https://www.pebblebeachconcours.net/plan-your-visit/directions-parking-event-maps/'
      }
    ]
  },

  parkingGeographicGuide: {
    checked: '2026-08-14',
    coordinateSpace: 'EPSG:4326',
    coordinateAuthority: 'OpenStreetMap',
    coordinateLicense: 'ODbL',
    defaultBounds: [[36.5685, -121.9610], [36.5910, -121.9125]],
    maxBounds: [[36.5520, -121.9820], [36.6000, -121.8880]],
    maxZoom: 16,
    boundary: {
      zh: '所有编号停车区（包括 Thu–Sat ADA Lot 9 与 Sunday Lot 18）及五类交通管制都只在官方示意图中查看；普通停车仍由入口和现场人员分配。',
      en: 'Every numbered lot—including Thu–Sat ADA Lot 9 and Sunday Lot 18—and all five traffic-control types remain in the Official Diagram; general parking is still assigned at the gate and onsite.'
    },
    anchors: [
      {
        id: 'portola-road-area', kind: 'road-area', lat: 36.5732440, lng: -121.9544633, accuracyM: 250,
        navigationAllowed: false,
        name: { zh: 'Portola Road 起终点范围', en: 'Portola Road start / finish area' },
        use: { zh: '官方确认 Tour 起终点在 Portola Road；附近普通停车仍按入口标志与工作人员分配。', en: 'The organizer confirms the Tour start / finish on Portola Road. Nearby general parking still follows gate signs and staff assignment.' },
        boundary: { zh: '道路中心参考与约 250 米方位范围；不是起跑线、停车入口或可停车圆圈。', en: 'Road-center reference with an approximate 250 m orientation area—not the start line, a lot entrance or a parkable circle.' },
        semanticSourceRefs: ['official-directions'],
        coordinateSourceRef: 'osm-way-686748528'
      },
      {
        id: 'forest-lake-road-reference', kind: 'road-area', lat: 36.5822980, lng: -121.9498689, accuracyM: 900,
        navigationAllowed: false,
        name: { zh: 'Forest Lake Road 方位参照', en: 'Forest Lake Road orientation reference' },
        use: { zh: '官方资料以 Forest Lake Road / Stevenson Drive 描述 Concours Village 方位；真实入口仍看现场标识。', en: 'Official material describes Concours Village around Forest Lake Road / Stevenson Drive; use onsite signs for the actual entrance.' },
        boundary: { zh: '这是整条道路要素的宽泛中心，不是 Village、RetroAuto 或停车场入口。', en: 'This is the broad center of a road feature—not a Village, RetroAuto or parking entrance.' },
        semanticSourceRefs: ['official-directions', 'official-event-map'],
        coordinateSourceRef: 'osm-way-10468660'
      },
      {
        id: 'the-hay-area', kind: 'venue-area', lat: 36.5718657, lng: -121.9496646, accuracyM: 160,
        navigationAllowed: false,
        name: { zh: 'The Hay 场地区域', en: 'The Hay venue area' },
        use: { zh: '帮助理解 Concours Village 与 Cadillac 公众体验的大致相对方位；从 Village 按活动标识步行。', en: 'Helps orient the Concours Village and public Cadillac experience; follow event signs on foot from the Village.' },
        boundary: { zh: '场地面要素中心与约 160 米范围；不是 Cadillac 摊位、上下客点或停车场。', en: 'Venue-feature center with an approximate 160 m area—not the Cadillac booth, a drop-off point or parking.' },
        semanticSourceRefs: ['official-event-map'],
        coordinateSourceRef: 'osm-way-1065983050'
      },
      {
        id: 'pebble-links-landmark', kind: 'landmark', lat: 36.5696646, lng: -121.9497413, accuracyM: 35,
        navigationAllowed: false,
        name: { zh: 'Pebble Beach Golf Links 地标', en: 'Pebble Beach Golf Links landmark' },
        use: { zh: '只用于辨认 The Lodge / Golf Links 与周边活动区的相对位置。', en: 'A public landmark for understanding the relative position of The Lodge / Golf Links and nearby event areas.' },
        boundary: { zh: '公共地标中心，不是观众停车或活动入口。', en: 'Public-landmark center—not spectator parking or an event entrance.' },
        semanticSourceRefs: ['official-event-map'],
        coordinateSourceRef: 'osm-way-686560759'
      },
      {
        id: 'highway-1-gate-reference', kind: 'gate-reference', lat: 36.5748806, lng: -121.9135393, accuracyM: 20,
        navigationAllowed: false,
        name: { zh: 'Hwy 1 Gate 方位参照', en: 'Hwy 1 Gate orientation reference' },
        use: { zh: '官方活动图标注 Hwy 1 Gate；活动周实际入口与分流必须服从交通人员。', en: 'The official event map labels a Hwy 1 Gate; actual Car Week entry and routing remain subject to traffic staff.' },
        boundary: { zh: '入口地标参考，不保证这是你的分配入口，也不是停车或观赛点。', en: 'Gate landmark reference—not a guaranteed assigned entrance, parking point or spectator area.' },
        semanticSourceRefs: ['official-event-map', 'official-directions'],
        coordinateSourceRef: 'osm-node-2805500918'
      }
    ],
    sources: [
      {
        id: 'official-directions', kind: 'semantic',
        label: { zh: 'Pebble Beach Concours · 停车与入口说明', en: 'Pebble Beach Concours · parking and entry guidance' },
        url: 'https://www.pebblebeachconcours.net/plan-your-visit/directions-parking-event-maps/'
      },
      {
        id: 'official-event-map', kind: 'semantic',
        label: { zh: 'Pebble Beach Concours · 2026 官方活动区域图', en: 'Pebble Beach Concours · official 2026 event-area map' },
        url: 'https://www.pebblebeachconcours.net/wp-content/uploads/2026/05/PBC_2026_Event_Map_Web_Final2.pdf'
      },
      {
        id: 'official-parking-pdf', kind: 'diagram-only',
        label: { zh: 'Pebble Beach Concours · 官方停车与交通示意图', en: 'Pebble Beach Concours · official parking and traffic diagram' },
        url: 'https://www.pebblebeachconcours.net/wp-content/uploads/2026/07/01a_Parking-and-Traffic-Flow-THUR-SUN_LotsOnly.pdf'
      },
      {
        id: 'osm-way-686748528', kind: 'coordinate', label: { zh: 'OSM · Portola Road way 686748528', en: 'OSM · Portola Road way 686748528' },
        url: 'https://www.openstreetmap.org/way/686748528'
      },
      {
        id: 'osm-way-10468660', kind: 'coordinate', label: { zh: 'OSM · Forest Lake Road way 10468660', en: 'OSM · Forest Lake Road way 10468660' },
        url: 'https://www.openstreetmap.org/way/10468660'
      },
      {
        id: 'osm-way-1065983050', kind: 'coordinate', label: { zh: 'OSM · The Hay way 1065983050', en: 'OSM · The Hay way 1065983050' },
        url: 'https://www.openstreetmap.org/way/1065983050'
      },
      {
        id: 'osm-way-686560759', kind: 'coordinate', label: { zh: 'OSM · Golf Links way 686560759', en: 'OSM · Golf Links way 686560759' },
        url: 'https://www.openstreetmap.org/way/686560759'
      },
      {
        id: 'osm-node-2805500918', kind: 'coordinate', label: { zh: 'OSM · Hwy 1 Gate node 2805500918', en: 'OSM · Hwy 1 Gate node 2805500918' },
        url: 'https://www.openstreetmap.org/node/2805500918'
      },
      {
        id: 'osm-attribution', kind: 'license', label: { zh: 'OpenStreetMap 版权与 ODbL', en: 'OpenStreetMap copyright and ODbL' },
        url: 'https://www.openstreetmap.org/copyright'
      }
    ]
  },

  days: [
    { id: '2026-08-07', short: { zh: '周五 8.7', en: 'Fri Aug 7' }, label: { zh: '周五 · 开场夜', en: 'Friday · opening night' }, badge: { zh: '免费 Kickoff', en: 'Free kickoff' } },
    { id: '2026-08-08', short: { zh: '周六 8.8', en: 'Sat Aug 8' }, label: { zh: '周六 · 州立公园或赛道', en: 'Saturday · park day or track' }, badge: { zh: '二选一', en: 'Pick one' } },
    { id: '2026-08-09', short: { zh: '周日 8.9', en: 'Sun Aug 9' }, label: { zh: '周日 · Pre-Reunion 次日', en: 'Sunday · Pre-Reunion day 2' }, badge: { zh: '赛道继续', en: 'Track continues' } },
    { id: '2026-08-10', short: { zh: '周一 8.10', en: 'Mon Aug 10' }, label: { zh: '周一 · ACE 藏品与轻量街展', en: 'Monday · ACE + light shows' }, badge: { zh: '藏品开场', en: 'Collectors open' } },
    { id: '2026-08-11', short: { zh: '周二 8.11', en: 'Tue Aug 11' }, label: { zh: '周二 · Carmel 街展与夜场', en: 'Tuesday · Carmel day + night' }, badge: { zh: '早场高性价比', en: 'Early free value' } },
    { id: '2026-08-12', short: { zh: '周三 8.12', en: 'Wed Aug 12' }, label: { zh: '周三 · 免费主场与可选夜场', en: 'Wednesday · free day + optional night' }, badge: { zh: '免费主场', en: 'Free anchor' } },
    { id: '2026-08-13', short: { zh: '周四 8.13', en: 'Thu Aug 13' }, label: { zh: '周四 · 免费高价值日', en: 'Thursday · free-value day' }, badge: { zh: '先看行驶中的车', en: 'See the cars moving' } },
    { id: '2026-08-14', short: { zh: '周五 8.14', en: 'Fri Aug 14' }, label: { zh: '周五 · 品牌或赛道', en: 'Friday · marques or track' }, badge: { zh: '冲突最多', en: 'Most overlap' } },
    { id: '2026-08-15', short: { zh: '周六 8.15', en: 'Sat Aug 15' }, label: { zh: '周六 · 赛车或街展', en: 'Saturday · racing or street shows' }, badge: { zh: '二选一', en: 'Pick a lane' } },
    { id: '2026-08-16', short: { zh: '周日 8.16', en: 'Sun Aug 16' }, label: { zh: '周日 · 旗舰主展', en: 'Sunday · flagship concours' }, badge: { zh: '提前决定预算', en: 'Decide the splurge' } },
    { id: '2026-08-17', short: { zh: '周一 8.17', en: 'Mon Aug 17' }, label: { zh: '周一 · 收尾与返程', en: 'Monday · wrap-up and depart' }, badge: { zh: '轻量安排', en: 'Keep it light' } }
  ],

  quickPlan: [
    {
      id: 'qp-0807',
      date: { zh: '8 月 7 日', en: 'Aug 7' }, day: { zh: '周五', en: 'Fri' },
      title: { zh: 'Kickoff on Alvarado → 早到落地', en: 'Kickoff on Alvarado → arrive early' },
      body: { zh: '17:00 前到 Monterey 市中心 Alvarado St，看历史赛车集结与开幕式；零成本感受车周氛围并摸清停车节奏。', en: 'Reach downtown Alvarado St before 17:00 for historic race cars and the opening ceremony—a zero-cost way to feel Car Week energy and test parking.' },
      cost: { zh: '$0', en: '$0' },
      route: routeFor('qp-0807'),
      schedule: scheduleFor('qp-0807', [
        { time: "15:30", title: { zh: "抵达半岛 · 入住或寄存行李", en: "Arrive peninsula · check in or drop bags" }, note: { zh: "周五傍晚车位紧，先安顿再出门。", en: "Friday evening parking tightens—settle in before heading out." }, tone: "transit" },
        { time: "16:15", title: { zh: "转场至 Alvarado St", en: "Transit to Alvarado St" }, note: { zh: "市中心步行区，预留找车位时间。", en: "Downtown pedestrian zone; allow time to park." }, tone: "transit" },
        { time: "17:00–19:00", title: { zh: "Monterey Car Week Kickoff", en: "Monterey Car Week Kickoff" }, note: { zh: "免费开幕式，历史赛车集结。", en: "Free opening night with historic race cars." }, tone: "core" },
        { time: "19:15", title: { zh: "市中心晚餐 · 缓冲", en: "Downtown dinner · buffer" }, note: { zh: "餐饮排队长，不必赶下一场。", en: "Restaurant lines grow; no rush to another stop." }, tone: "optional" },
      ]),
    },
    {
      id: 'qp-0808',
      date: { zh: '8 月 8 日', en: 'Aug 8' }, day: { zh: '周六', en: 'Sat' },
      title: { zh: 'Asilomar Day 或 Pre-Reunion', en: 'Asilomar Day or Pre-Reunion' },
      body: { zh: '免费选 Asilomar 州立公园庆典（老爷车、摇摆舞）；赛车迷则买 Pre-Reunion 单日票，含 Corkscrew Hillclimb。', en: 'Free Asilomar state-parks birthday with vintage rides and swing dance—or buy a Pre-Reunion single-day pass including Corkscrew Hillclimb for race fans.' },
      cost: { zh: '$0 / ~$82.62', en: '$0 / ~$82.62' },
      route: routeFor('qp-0808'),
      schedule: scheduleFor('qp-0808', [
        { time: "06:30", title: { zh: "早起出发 · 赛道分支", en: "Early departure · track branch" }, note: { zh: "选 Pre-Reunion 时建议 7 点前到 Laguna Seca。", en: "If choosing Pre-Reunion, aim for Laguna Seca before 7:00." }, tone: "transit" },
        { time: "07:00–20:00", title: { zh: "或 Pre-Reunion + Corkscrew Hillclimb", en: "or Pre-Reunion + Corkscrew Hillclimb" }, note: { zh: "官方赛程延续至晚间；与公园日完全冲突。", en: "The official program runs into the evening and fully conflicts with park day." }, tone: "alt" },
        { time: "09:30", title: { zh: "转场至 Asilomar", en: "Transit to Asilomar" }, note: { zh: "Pacific Grove 周末车位先到先得。", en: "Pacific Grove weekend parking is first come." }, tone: "transit" },
        { time: "10:00–16:00", title: { zh: "或 Asilomar Day", en: "or Asilomar Day" }, note: { zh: "免费州立公园生日庆典。", en: "Free state-parks birthday celebration." }, tone: "alt" },
      ]),
    },
    {
      id: 'qp-0809',
      date: { zh: '8 月 9 日', en: 'Aug 9' }, day: { zh: '周日', en: 'Sun' },
      title: { zh: 'Pre-Reunion 次日，或轻量休整', en: 'Pre-Reunion day 2, or rest light' },
      body: { zh: '若周六买了 2 日票或想补赛道，周日继续 Laguna Seca；否则休息、补票与核对周一 ACE / 街展计划。', en: 'Continue at Laguna Seca with a two-day pass or a Sunday catch-up; otherwise rest, buy tickets and lock Monday ACE / street-show plans.' },
      cost: { zh: '~$82.62 / $0', en: '~$82.62 / $0' },
      route: routeFor('qp-0809'),
      schedule: scheduleFor('qp-0809', [
        { time: "07:00", title: { zh: "转场至 Laguna Seca", en: "Transit to Laguna Seca" }, note: { zh: "大型活动走 South Boundary Road。", en: "Major events use South Boundary Road." }, tone: "transit" },
        { time: "07:00–18:15", title: { zh: "或 Pre-Reunion 次日", en: "or Pre-Reunion day 2" }, note: { zh: "官方赛程至 18:15；周六已买两日票则自然接续。", en: "The official program runs to 18:15; a natural follow-up with a two-day pass." }, tone: "alt" },
        { time: "10:00", title: { zh: "或 休整 · 补票与周一计划", en: "or Rest · tickets and Monday plans" }, note: { zh: "核对 ACE 与街展时段，线上购票。", en: "Lock ACE and street-show windows; buy tickets online." }, tone: "alt" },
        { time: "14:00", title: { zh: "轻量补给 · 缓冲", en: "Light resupply · buffer" }, note: { zh: "周日傍晚交通相对宽松。", en: "Sunday evening traffic is usually lighter." }, tone: "optional" },
      ]),
    },
    {
      id: 'qp-0810',
      date: { zh: '8 月 10 日', en: 'Aug 10' }, day: { zh: '周一', en: 'Mon' },
      title: { zh: 'ACE 藏品展 → 英系 / EV / 保时捷', en: 'ACE automobilia → British / EV / Porsche' },
      body: { zh: '上午 Embassy Suites 的 Automobilia Collectors Expo（车周最完整藏品展）；下午按兴趣选 Monterey British、Electric Coast 或 Porsche Seaside。', en: 'Morning Automobilia Collectors Expo at Embassy Suites—the week’s best memorabilia hall; afternoon pick Monterey British, Electric Coast or Porsche Seaside.' },
      cost: { zh: 'ACE 单日 $30 · 街展 $0', en: 'ACE 1-day $30 · street shows $0' },
      route: routeFor('qp-0810'),
      schedule: scheduleFor('qp-0810', [
        { time: "09:30", title: { zh: "转场至 Embassy Suites", en: "Transit to Embassy Suites" }, note: { zh: "Seaside 方向，ACE 10:00 开门。", en: "Head to Seaside; ACE opens at 10:00." }, tone: "transit" },
        { time: "10:00–12:30", title: { zh: "ACE Automobilia Collectors Expo", en: "ACE Automobilia Collectors Expo" }, note: { zh: "车周最完整藏品展，上午优先。", en: "The week's best automobilia hall—prioritize the morning." }, tone: "core" },
        { time: "12:45", title: { zh: "半岛转场 · 下午街展", en: "Peninsula hop · afternoon street shows" }, note: { zh: "预留 20–35 分钟车程。", en: "Allow 20–35 minutes driving time." }, tone: "transit" },
        { time: "13:00–16:00", title: { zh: "或 British / Electric Coast / Porsche Seaside", en: "or British / Electric Coast / Porsche Seaside" }, note: { zh: "三选一：英系 11–14、EV 12–16、保时捷 15–19。", en: "Pick one: British 11–14, EV 12–16, or Porsche 15–19." }, tone: "alt" },
        { time: "16:15", title: { zh: "返程缓冲", en: "Return buffer" }, note: { zh: "周一傍晚仍建议早回住宿。", en: "Monday evening—head back to lodging early." }, tone: "transit" },
      ]),
    },
    {
      id: 'qp-0811',
      date: { zh: '8 月 11 日', en: 'Aug 11' }, day: { zh: '周二', en: 'Tue' },
      title: { zh: 'Concours for a Cause · 可选 Night Rider', en: 'Concours for a Cause · optional Night Rider' },
      body: { zh: 'Carmel Ocean Ave 免费慈善街展；傍晚可加 Asilomar Night Rider（低底盘文化夜场）。藏品迷可改去 ACE 拍卖日。', en: 'Free charity show on Carmel’s Ocean Ave; optionally add Asilomar Night Rider (lowrider evening). Collectors can pivot to ACE auction day instead.' },
      cost: { zh: '$0 / Night Rider $65', en: '$0 / Night Rider $65' },
      route: routeFor('qp-0811'),
      schedule: scheduleFor('qp-0811', [
        { time: "09:30", title: { zh: "转场至 Carmel Ocean Ave", en: "Transit to Carmel Ocean Ave" }, note: { zh: "慈善街展步行区，车位紧张。", en: "Charity show in a walkable zone; parking is tight." }, tone: "transit" },
        { time: "10:00–16:00", title: { zh: "Concours for a Cause", en: "Concours for a Cause" }, note: { zh: "免费慈善街展，早场性价比最高。", en: "Free charity street show—best early value." }, tone: "core" },
        { time: "16:15", title: { zh: "转场 · 傍晚二选一", en: "Transit · evening fork" }, note: { zh: "藏品迷可改去 Seaside ACE。", en: "Collectors can pivot to ACE in Seaside." }, tone: "transit" },
        { time: "16:00–20:00", title: { zh: "或 ACE Automobilia Live Auction", en: "or ACE Automobilia Live Auction" }, note: { zh: "替代夜场，适合藏品爱好者。", en: "Evening alternative for automobilia fans." }, tone: "alt" },
        { time: "18:00–21:00", title: { zh: "可选 Night Rider", en: "Optional Night Rider" }, note: { zh: "Asilomar 地下车库低底盘文化夜场。", en: "Lowrider culture evening in Asilomar's underground garage." }, tone: "optional" },
      ]),
    },
    {
      id: 'qp-0812',
      date: { zh: '8 月 12 日', en: 'Aug 12' }, day: { zh: '周三', en: 'Wed' },
      title: { zh: 'Little Car + Astons · 晚场三选一', en: 'Little Car + Astons · pick one evening' },
      body: { zh: '白天免费串 Pacific Grove 微型车展与 Carmel Astons；傍晚在 Asilomar Luau（$70）与 Jet Center Motorlux（$845）之间只选一个，或看 Motoring Classic 抵达。', en: 'Free daytime link: Pacific Grove Little Car Show and Carmel Astons; evenings pick only one of Asilomar Luau ($70) or Jet Center Motorlux ($845), or watch Motoring Classic arrivals.' },
      cost: { zh: '$0 · 晚场另计', en: '$0 · evening optional' },
      route: routeFor('qp-0812'),
      schedule: scheduleFor('qp-0812', [
        { time: "10:45", title: { zh: "转场至 Carmel", en: "Transit to Carmel" }, note: { zh: "Astons 11:00 开门，先占 Ocean Ave。", en: "Astons opens 11:00—secure Ocean Ave first." }, tone: "transit" },
        { time: "11:00–13:30", title: { zh: "Astons on the Avenue", en: "Astons on the Avenue" }, note: { zh: "Carmel 免费阿斯顿·马丁街展。", en: "Free Aston Martin street show on Carmel's Ocean Ave." }, tone: "core" },
        { time: "13:45", title: { zh: "转场至 Pacific Grove", en: "Transit to Pacific Grove" }, note: { zh: "Lighthouse Ave 约 15–25 分钟。", en: "About 15–25 minutes to Lighthouse Ave." }, tone: "transit" },
        { time: "14:00–16:15", title: { zh: "The Little Car Show · 建议停留", en: "The Little Car Show · suggested stay" }, note: { zh: "官方活动窗口至 17:00；观众免费，若选晚场请提前离开。", en: "The official event runs until 17:00; spectators are free, but leave early if choosing an evening branch." }, tone: "core" },
        { time: "16:30", title: { zh: "转场 · 晚场只选一个", en: "Transit · pick only one evening" }, note: { zh: "Luau / Motorlux / Motoring Classic 互斥。", en: "Luau, Motorlux and Motoring Classic conflict." }, tone: "transit" },
        { time: "17:00–22:00", title: { zh: "或 Luau / Motorlux / Motoring Classic 抵达", en: "or Luau / Motorlux / Motoring Classic arrivals" }, note: { zh: "Luau $70 · Motorlux $845 · 抵达观赏免费。", en: "Luau $70 · Motorlux $845 · arrivals viewing free." }, tone: "alt" },
      ]),
    },
    {
      id: 'qp-0813',
      date: { zh: '8 月 13 日', en: 'Aug 13' }, day: { zh: '周四', en: 'Thu' },
      title: { zh: 'Tour 早晨 · 停一次，全程步行', en: 'Tour morning · park once, stay on foot' },
      body: { zh: '6:15–6:30 进入 Pebble Beach 后按指示停车；看完集结、三批发车与约中午归来，再步行去 Hay Hill 的免费 Cadillac V-Series 公众试驾。BMW 与 Aston Martin 的 2026 准入规则均未公开；Aston 往年政策与 8 月 13 日现场回报均指向仅限受邀，因此两者都不是这条公众路线的保证点。', en: 'Enter Pebble Beach at 6:15–6:30 and park as directed; see the lineup, all three waves and the approximate noon return, then walk to the free public Cadillac V-Series drive at Hay Hill. BMW and Aston Martin 2026 access are unpublished; prior Aston policy and an August 13 field report point to invitation-only access, so neither is a guaranteed public stop on this route.' },
      cost: { zh: 'Tour 观看 + Cadillac 体验免费 · Portola 停车费用未公布 · MPC 条件候选 $3', en: 'Viewing free · Cadillac experience free · Portola parking price unpublished · conditional MPC option $3' },
      route: routeFor('qp-0813'),
      schedule: scheduleFor('qp-0813', [
        { time: "06:15–06:30", title: { zh: "进入 Pebble Beach · 按指示停车", en: "Enter Pebble Beach · park as directed" }, note: { zh: "本站建议时段，并非官方开放时间；停一次后全程步行。", en: "Guide-recommended window, not an official opening time; park once and stay on foot." }, tone: "transit" },
        { time: "07:00–09:10", title: { zh: "Portola Road 车辆集结", en: "Cars stage on Portola Road" }, note: { zh: "留在人行区域，听从现场工作人员。", en: "Remain in pedestrian areas and follow onsite staff." }, tone: "core" },
        { time: "09:15", title: { zh: "步行到 Portola / Stevenson 一侧就位", en: "Walk into position on the Portola / Stevenson side" }, note: { zh: "只在现场允许的观看区域停留。", en: "Use only staff-permitted viewing space." }, tone: "transit" },
        { time: "09:30 · 09:45 · 10:00", title: { zh: "Tour 三批发车", en: "Three Tour departure waves" }, note: { zh: "三批时刻来自官方 8 月 11 日路线图，可能调整。", en: "All three times come from the official Aug 11 route map and may change." }, tone: "core" },
        { time: "10:05–11:30", title: { zh: "步行去 Concours Village / RetroAuto", en: "Walk to Concours Village / RetroAuto" }, note: { zh: "不要开车换点，也不要追车队。", en: "Do not move the car or chase the convoy." }, tone: "optional" },
        { time: "11:40", title: { zh: "返回 Portola Road 等待归来", en: "Return to Portola Road for the return" }, note: { zh: "官方预计约中午返回，时间可能延后。", en: "The official return is around noon and may run late." }, tone: "core" },
        { time: "实际归来后–14:00", title: { zh: "步行去 Hay Hill · Cadillac V-Series", en: "Walk to Hay Hill · Cadillac V-Series" }, note: { zh: "只在车辆实际归来后前往。官方免费公众体验；试驾先到先得、21+ 且需有效驾照。CELESTIQ 与候位约一小时仅为朋友现场回报。", en: "Go only after the Tour has actually returned. Official free public experience; drives are first-come, first-served, 21+ and require a valid license. CELESTIQ and the roughly one-hour wait are only a friend field report." }, tone: "optional" },
      ]),
    },
    {
      id: 'qp-0814',
      date: { zh: '8 月 14 日', en: 'Aug 14' }, day: { zh: '周五', en: 'Fri' },
      title: { zh: 'Werks 或 Laguna Seca · 可选 Paddock', en: 'Werks or Laguna Seca · optional Paddock' },
      body: { zh: '保时捷聚会是最佳免费主场；更想听引擎就买周五 Reunion。下午若还有精力，Seaside 的 The Paddock 是杂糅车展收尾（与 Quail 冲突）。', en: 'Werks is the free-value anchor; buy Friday Reunion if engines matter more. If energy remains, The Paddock in Seaside is an eclectic late show—conflicts with The Quail.' },
      cost: { zh: '$0 + $40 现金停车 / $139.67', en: '$0 + $40 cash parking / $139.67' },
      route: routeFor('qp-0814'),
      schedule: scheduleFor('qp-0814', [
        { time: "06:45", title: { zh: "转场 · 周五大分流", en: "Transit · Friday fork" }, note: { zh: "Werks 与 Reunion 方向相反，早定路线。", en: "Werks and Reunion point opposite ways—commit early." }, tone: "transit" },
        { time: "07:00", title: { zh: "可选 Werks 车辆签到", en: "Optional Werks car check-in" }, note: { zh: "参展车 7:00 签到，观众可略晚。", en: "Show cars check in at 7:00; spectators can arrive later." }, tone: "optional" },
        { time: "08:00–18:35", title: { zh: "或 Reunion 周五全天", en: "or Reunion full Friday" }, note: { zh: "正赛至约 17:25，含 paddock 与展示。", en: "Racing to ~17:25 with paddock and exhibitions." }, tone: "alt" },
        { time: "09:00–15:00", title: { zh: "或 Werks Reunion（+$40 现金停车）", en: "or Werks Reunion (+$40 cash parking)" }, note: { zh: "最佳免费主场。", en: "Best free-value Friday anchor." }, tone: "alt" },
        { time: "15:15", title: { zh: "转场至 Seaside", en: "Transit to Seaside" }, note: { zh: "与 The Quail 冲突，勿叠加。", en: "Conflicts with The Quail—do not stack both." }, tone: "transit" },
        { time: "15:00–20:00", title: { zh: "可选 The Paddock Monterey", en: "Optional The Paddock Monterey" }, note: { zh: "杂糅车展收尾，需有余力再选。", en: "Eclectic show finale—only if energy remains." }, tone: "optional" },
      ]),
    },
    {
      id: 'qp-0815',
      date: { zh: '8 月 15 日', en: 'Aug 15' }, day: { zh: '周六', en: 'Sat' },
      title: { zh: 'Lemons → Exotics，或赛道', en: 'Lemons → Exotics, or track' },
      body: { zh: '预算路线可只逛两个免费街展；Exotics 的 Broadway 公共区免费，Del Monte 围合区另售 $40 基础价 GA。赛车迷则不要中途离开 Laguna Seca；Gooding 拍卖旁听与 RM 公众预展的已核实备选见下方周六活动卡。', en: 'The value route can stay entirely within two free street shows: Exotics is free on Broadway, while the enclosed Del Monte zone separately sells $40-base-price GA. Committed race fans should stay at Laguna Seca; see the Saturday event cards below for the verified Gooding spectator and RM public-preview alternatives.' },
      cost: { zh: '免费街展 $0 · Exotics 付费区 $40 基础价 / 赛道 $181.07', en: 'Free shows $0 · Exotics paid zone $40 base / track $181.07' },
      route: routeFor('qp-0815'),
      schedule: scheduleFor('qp-0815', [
        { time: "07:00–09:30", title: { zh: "可选 Peninsula Cars & Coffee", en: "Optional Peninsula Cars & Coffee" }, note: { zh: "Seaside 清晨车友聚会，时段可能漂移。", en: "Informal Seaside morning meet; hours may shift." }, tone: "optional" },
        { time: "07:30", title: { zh: "转场 · 周六路线分流", en: "Transit · Saturday route fork" }, note: { zh: "街展路线与赛道不可兼得。", en: "Street-show route and track day are mutually exclusive." }, tone: "transit" },
        { time: "08:00–13:30", title: { zh: "Concours d’Lemons", en: "Concours d’Lemons" }, note: { zh: "免费幽默车展，最亲民周六早晨。", en: "Free comic car show—most accessible Saturday morning." }, tone: "core" },
        { time: "11:00–16:00", title: { zh: "Exotics on Broadway", en: "Exotics on Broadway" }, note: { zh: "Broadway 公共区免费；Del Monte 围合区需另购 GA。", en: "Broadway’s public zone is free; the enclosed Del Monte zone requires separate GA." }, tone: "core" },
        { time: "08:00–18:30", title: { zh: "或 Reunion 周六全天", en: "or Reunion full Saturday" }, note: { zh: "07:00 入场；赛车迷主日，勿中途离开赛道。", en: "Gates open 07:00; race fans should stay at the track for the full day." }, tone: "alt" },
        { time: "13:45", title: { zh: "街展路线 · Seaside 接驳缓冲", en: "Street route · Seaside shuttle buffer" }, note: { zh: "远端停车 + 接驳 9:00–17:00。", en: "Remote parking plus shuttle 9:00–17:00." }, tone: "transit" },
      ]),
    },
    {
      id: 'qp-0816',
      date: { zh: '8 月 16 日', en: 'Aug 16' }, day: { zh: '周日', en: 'Sun' }, flagship: true,
      title: { zh: 'Concours 主展，或免费 Village', en: 'Concours, or free Village' },
      body: { zh: '想看评审与 Dawn Patrol 就为主展买单；预算优先仍可逛 Village 与 RetroAuto。', en: 'Pay for judging and Dawn Patrol; value-first visitors can still use Village and RetroAuto.' },
      cost: { zh: '$650 / $0', en: '$650 / $0' },
      route: routeFor('qp-0816'),
      schedule: scheduleFor('qp-0816', [
        { time: "05:00", title: { zh: "转场至 Pebble Beach", en: "Transit to Pebble Beach" }, note: { zh: "周日清晨交通管制，预留充足时间。", en: "Sunday morning traffic controls—allow extra time." }, tone: "transit" },
        { time: "05:30", title: { zh: "或 Dawn Patrol", en: "or Dawn Patrol" }, note: { zh: "主展开门即入场，看黎明车队。", en: "Enter at gates opening for dawn arrivals." }, tone: "alt" },
        { time: "08:00–13:30", title: { zh: "或 Concours 评审", en: "or Concours judging" }, note: { zh: "8:00 评审开始，13:30 起颁奖。", en: "Judging from 8:00; awards from 13:30." }, tone: "alt" },
        { time: "08:00–18:00", title: { zh: "或 Concours Village 免费", en: "or Concours Village free" }, note: { zh: "不含 Golf Links 主展场与颁奖。", en: "Does not include Golf Links show field or awards." }, tone: "alt" },
        { time: "13:00–16:00", title: { zh: "可选 Car Week Cruise-In", en: "Optional Car Week Cruise-In" }, note: { zh: "展车位 $30–$100；步行观众或免费，勿当作纯免费场。", en: "Show-car spots $30–$100; walk-up spectators may be free—not a blanket free event." }, tone: "optional" },
      ]),
    },
    {
      id: 'qp-0817',
      date: { zh: '8 月 17 日', en: 'Aug 17' }, day: { zh: '周一', en: 'Mon' },
      title: { zh: 'Stanton Center → 返程', en: 'Stanton Center → depart' },
      body: { zh: '户外大活动已经结束；先退房并寄存行李，中午看历史展，再返程。', en: 'The marquee outdoor events are over; check out and store bags first, see the history exhibit at noon, then depart.' },
      cost: { zh: '$15 成人 · 18 岁以下免费', en: '$15 adult · under 18 free' },
      route: routeFor('qp-0817'),
      schedule: scheduleFor('qp-0817', [
        { time: "09:30", title: { zh: "退房 · 行李寄存", en: "Checkout · bag storage" }, note: { zh: "户外主活动已结束，节奏放慢。", en: "Marquee outdoor events are over—keep the pace light." }, tone: "core" },
        { time: "10:30", title: { zh: "转场至 Custom House Plaza", en: "Transit to Custom House Plaza" }, note: { zh: "Monterey 市中心 Stanton Center。", en: "Stanton Center in downtown Monterey." }, tone: "transit" },
        { time: "12:00–16:00", title: { zh: "Stanton Center 历史展", en: "Stanton Center history exhibit" }, note: { zh: "最后一天，15:00 最后入场。", en: "Final day; last entry at 15:00." }, tone: "core" },
        { time: "16:15", title: { zh: "取行李 · 返程", en: "Collect bags · depart" }, note: { zh: "周一午后返程交通通常顺畅。", en: "Monday afternoon departures are usually smooth." }, tone: "transit" },
      ]),
    }
  ],


  thumbLibrary: {
    'kickoff': {
      src: "assets/img/events/kickoff.webp", width: 240, height: 160, license: "wikimedia-cc",
      alt: { zh: "2019 Monterey Car Week Kickoff", en: "2019 Monterey Car Week Kickoff" },
      credit: { zh: "smaedli / Flickr · CC BY 2.0", en: "smaedli / Flickr · CC BY 2.0" },
      sourceUrl: "https://www.flickr.com/photos/75264768@N00/48500910527"
    },
    'asilomar-day': {
      src: "assets/img/events/asilomar-day.webp", width: 240, height: 160, license: "wikimedia-cc",
      alt: { zh: "Asilomar Conference Grounds 入口", en: "Asilomar Conference Grounds entrance" },
      credit: { zh: "Ed Bierman / CC BY 2.0", en: "Ed Bierman / CC BY 2.0" },
      sourceUrl: "https://commons.wikimedia.org/wiki/File%3AEntrance_to_the_Asilomar_Conference_Grounds.jpg"
    },
    'prereunion-sat': {
      src: "assets/img/events/prereunion-sat.webp", width: 240, height: 160, license: "wikimedia-cc",
      alt: { zh: "2016 Monterey Pre-Reunion · Laguna Seca", en: "2016 Monterey Pre-Reunion at Laguna Seca" },
      credit: { zh: "United Autosports / Flickr · CC BY-SA 2.0", en: "United Autosports / Flickr · CC BY-SA 2.0" },
      sourceUrl: "https://www.flickr.com/photos/48092258@N06/28715700533"
    },
    'prereunion-sun': {
      src: "assets/img/events/prereunion-sun.webp", width: 240, height: 160, license: "wikimedia-cc",
      alt: { zh: "2016 Monterey Pre-Reunion 另一组别", en: "2016 Monterey Pre-Reunion (another group)" },
      credit: { zh: "United Autosports / Flickr · CC BY-SA 2.0", en: "United Autosports / Flickr · CC BY-SA 2.0" },
      sourceUrl: "https://www.flickr.com/photos/48092258@N06/28716119473"
    },
    'electric-coast-mon': {
      src: "assets/img/events/electric-coast-mon.webp", width: 240, height: 160, license: "wikimedia-cc",
      alt: { zh: "Asilomar 海岸（Electric Coast 会场周边）", en: "Asilomar coast near Electric Coast venue" },
      credit: { zh: "The wub / CC BY-SA 4.0", en: "The wub / CC BY-SA 4.0" },
      sourceUrl: "https://commons.wikimedia.org/wiki/File%3AAsilomar_State_Beach_-_2023-02-22_-_1.jpg"
    },
    'monterey-british': {
      src: "assets/img/events/monterey-british.webp", width: 240, height: 160, license: "public-domain",
      alt: { zh: "英系经典车展 MG（同类型往年）", en: "British classic MG at a car show (same-genre past photo)" },
      credit: { zh: "Bull-Doser / Public domain", en: "Bull-Doser / Public domain" },
      sourceUrl: "https://commons.wikimedia.org/wiki/File%3AMG_MGB_%282012_Hudson_British_Car_Show%29.JPG"
    },
    'porsche-seaside': {
      src: "assets/img/events/porsche-seaside.webp", width: 240, height: 160, license: "wikimedia-cc",
      alt: { zh: "Monterey 车周 Porsche 相关展场往年", en: "Past Monterey Car Week Porsche gathering" },
      credit: { zh: "Moto Club4AG / CC BY 2.0", en: "Moto Club4AG / CC BY 2.0" },
      sourceUrl: "https://commons.wikimedia.org/wiki/File%3AGordon_McCall%27s_Motorworks_Reunion_at_Pebble_Beach_%2814825962017%29.jpg"
    },
    'ace': {
      src: "assets/img/events/ace.webp", width: 240, height: 160, license: "organizer-press",
      alt: { zh: "ACE 往年展场官方图", en: "Official past ACE expo image" },
      credit: { zh: "Automobilia Collectors Expo 官网", en: "Automobilia Collectors Expo official site" },
      sourceUrl: "https://automobiliacollectorsexpo.com/"
    },
    'poker-rally': {
      src: "assets/img/events/poker-rally.webp", width: 240, height: 160, license: "wikimedia-cc",
      alt: { zh: "半岛经典赛车聚会氛围", en: "Peninsula historic-car gathering atmosphere" },
      credit: { zh: "Craig Howell / CC BY 2.0", en: "Craig Howell / CC BY 2.0" },
      sourceUrl: "https://commons.wikimedia.org/wiki/File%3AMaserati_5000_GT_Sci%C3%A0_di_Persia_%281959%29_at_Laguna_Seca_Historics_%282014%29_05.jpg"
    },
    'concours-cause': {
      src: "assets/img/events/concours-cause.webp", width: 240, height: 160, license: "wikimedia-cc",
      alt: { zh: "半岛街边经典车展氛围", en: "Peninsula street classic-car show atmosphere" },
      credit: { zh: "jaycross / Flickr · CC BY 2.0", en: "jaycross / Flickr · CC BY 2.0" },
      sourceUrl: "https://www.flickr.com/photos/66151780@N00/9513911132"
    },
    'ace-auction': {
      src: "assets/img/events/ace-auction.webp", width: 240, height: 160, license: "wikimedia-cc",
      alt: { zh: "Monterey 车周精品展/拍卖氛围往年", en: "Past Monterey Car Week collector/auction atmosphere" },
      credit: { zh: "Moto Club4AG / CC BY 2.0", en: "Moto Club4AG / CC BY 2.0" },
      sourceUrl: "https://commons.wikimedia.org/wiki/File%3AGordon_McCall%27s_Motorworks_Reunion_at_Pebble_Beach_%2814825872558%29.jpg"
    },
    'electric-coast-tue': {
      src: "assets/img/events/electric-coast-tue.webp", width: 240, height: 160, license: "wikimedia-cc",
      alt: { zh: "Asilomar Merrill Hall", en: "Merrill Hall at Asilomar" },
      credit: { zh: "Wikimedia / CC BY-SA 3.0", en: "Wikimedia / CC BY-SA 3.0" },
      sourceUrl: "https://commons.wikimedia.org/wiki/File%3AMerrill_Hall_Asilomar_edit1.jpg"
    },
    'night-rider': {
      src: "assets/img/events/night-rider.webp", width: 240, height: 160, license: "wikimedia-cc",
      alt: { zh: "Monterey Car Week 夜间车展氛围", en: "Monterey Car Week evening car-show atmosphere" },
      credit: { zh: "smaedli / Flickr · CC BY 2.0", en: "smaedli / Flickr · CC BY 2.0" },
      sourceUrl: "https://www.flickr.com/photos/75264768@N00/51388880912"
    },
    'little-car': {
      src: "assets/img/events/little-car.webp", width: 240, height: 160, license: "wikimedia-cc",
      alt: { zh: "Pacific Grove Little Car Show 往年", en: "Past Little Car Show in Pacific Grove" },
      credit: { zh: "jaycross / Flickr · CC BY 2.0", en: "jaycross / Flickr · CC BY 2.0" },
      sourceUrl: "https://www.flickr.com/photos/66151780@N00/9513903138"
    },
    'astons': {
      src: "assets/img/events/astons.webp", width: 240, height: 160, license: "public-domain",
      alt: { zh: "英系跑车展场氛围（同类型往年）", en: "British sports-car show atmosphere (same-genre past photo)" },
      credit: { zh: "Bull-Doser / Public domain", en: "Bull-Doser / Public domain" },
      sourceUrl: "https://commons.wikimedia.org/wiki/File%3AMorgan_Plus_8_%28Hudson_British_Car_Show_%2712%29.jpg"
    },
    'motoring-classic': {
      src: "assets/img/events/motoring-classic.webp", width: 240, height: 160, license: "wikimedia-cc",
      alt: { zh: "2011 Pebble Beach Motoring Classic", en: "2011 Pebble Beach Motoring Classic" },
      credit: { zh: "Dale Simonson / CC BY-SA 2.0", en: "Dale Simonson / CC BY-SA 2.0" },
      sourceUrl: "https://commons.wikimedia.org/wiki/File%3AFerrari_375_MM_Pinin_Farina_Speciale_%281954%29.jpg"
    },
    'rmmr-wed': {
      src: "assets/img/events/rmmr-wed.webp", width: 240, height: 160, license: "wikimedia-cc",
      alt: { zh: "2022 Rolex Monterey Motorsports Reunion", en: "2022 Rolex Monterey Motorsports Reunion" },
      credit: { zh: "Prova MO / CC BY-SA 4.0", en: "Prova MO / CC BY-SA 4.0" },
      sourceUrl: "https://commons.wikimedia.org/wiki/File%3A1976_Ferrari_312_T2_at_RMMR_2022.jpg"
    },
    'luau': {
      src: "assets/img/events/luau.webp", width: 240, height: 160, license: "wikimedia-cc",
      alt: { zh: "Monterey Car Week 户外车聚氛围", en: "Monterey Car Week outdoor gathering atmosphere" },
      credit: { zh: "smaedli / Flickr · CC BY 2.0", en: "smaedli / Flickr · CC BY 2.0" },
      sourceUrl: "https://www.flickr.com/photos/75264768@N00/52303735713"
    },
    'motorlux': {
      src: "assets/img/events/motorlux.webp", width: 240, height: 160, license: "wikimedia-cc",
      alt: { zh: "McCall’s Motorworks Reunion（Motorlux 前身）", en: "McCall’s Motorworks Reunion (Motorlux predecessor)" },
      credit: { zh: "Moto Club4AG / CC BY 2.0", en: "Moto Club4AG / CC BY 2.0" },
      sourceUrl: "https://commons.wikimedia.org/wiki/File%3AGordon_McCall%27s_Motorworks_Reunion_at_Pebble_Beach_%2814825764339%29.jpg"
    },
    'tour': {
      src: "assets/img/events/tour.webp", width: 240, height: 160, license: "wikimedia-cc",
      alt: { zh: "2011 Tour d’Elegance 巡游车辆", en: "2011 Tour d’Elegance participant" },
      credit: { zh: "Moto Club4AG / CC BY 2.0", en: "Moto Club4AG / CC BY 2.0" },
      sourceUrl: "https://commons.wikimedia.org/wiki/File%3AFiat_1953_8V_Supersonic_on_Pebble_Beach_Tour_d-Elegance_2011_-Moto%40Club4AG.jpg"
    },
    'ferrari-carmel': {
      src: "assets/img/events/ferrari-carmel.webp", width: 240, height: 160, license: "wikimedia-cc",
      alt: { zh: "Ferrari California 展车（同品牌活动类型）", en: "Ferrari California display (same-marque event genre)" },
      credit: { zh: "Tabercil / CC BY-SA 2.0", en: "Tabercil / CC BY-SA 2.0" },
      sourceUrl: "https://commons.wikimedia.org/wiki/File%3AFerrari_2010_California_Left.jpg"
    },
    'legends': {
      src: "assets/img/events/legends.webp", width: 240, height: 160, license: "wikimedia-cc",
      alt: { zh: "2022 Legends of the Autobahn", en: "2022 Legends of the Autobahn" },
      credit: { zh: "smaedli / Flickr · CC BY 2.0", en: "smaedli / Flickr · CC BY 2.0" },
      sourceUrl: "https://www.flickr.com/photos/75264768@N00/52306559001"
    },
    'woodies': {
      src: "assets/img/events/woodies.webp", width: 240, height: 160, license: "organizer-press",
      alt: { zh: "Woodies in the Woods 官方宣传图", en: "Official Woodies in the Woods image" },
      credit: { zh: "Asilomar / Visit Asilomar", en: "Asilomar / Visit Asilomar" },
      sourceUrl: "https://www.visitasilomar.com/things-to-do/car-week"
    },
    'village-thu': {
      src: "assets/img/events/village-thu.webp", width: 240, height: 160, license: "organizer-press",
      alt: { zh: "Concours Village 往年现场", en: "Past Concours Village scene" },
      credit: { zh: "Pebble Beach Concours 官网", en: "Pebble Beach Concours official" },
      sourceUrl: "https://www.pebblebeachconcours.net/events/concours-village/"
    },
    'rmmr-thu': {
      src: "assets/img/events/rmmr-thu.webp", width: 240, height: 160, license: "wikimedia-cc",
      alt: { zh: "2022 RMMR · Porsche 550", en: "2022 RMMR · Porsche 550" },
      credit: { zh: "Prova MO / CC BY-SA 4.0", en: "Prova MO / CC BY-SA 4.0" },
      sourceUrl: "https://commons.wikimedia.org/wiki/File%3A1956_Porsche_550_A_front_at_RMMR_2022.jpg"
    },
    'gooding-thu': {
      src: "assets/img/events/gooding-thu.webp", width: 240, height: 160, license: "wikimedia-cc",
      alt: { zh: "2022 Gooding Pebble Beach 拍卖车辆", en: "2022 Gooding Pebble Beach auction car" },
      credit: { zh: "Prova MO / CC BY-SA 4.0", en: "Prova MO / CC BY-SA 4.0" },
      sourceUrl: "https://commons.wikimedia.org/wiki/File%3A1965_Lamborghini_350_GT_Interior.jpg"
    },
    'mecum-thu': {
      src: "assets/img/events/mecum-thu.webp", width: 240, height: 160, license: "wikimedia-cc",
      alt: { zh: "Mecum 拍卖帐篷（往年 Kissimmee）", en: "Mecum auction tent (past Kissimmee)" },
      credit: { zh: "Pokemonprime / CC BY 4.0", en: "Pokemonprime / CC BY 4.0" },
      sourceUrl: "https://commons.wikimedia.org/wiki/File%3AAuction_tent_at_Mecum_Auctions_Kissimmee.jpg"
    },
    'mecum-fri': {
      src: "assets/img/events/mecum-fri.webp", width: 240, height: 160, license: "wikimedia-cc",
      alt: { zh: "Mecum 拍卖车辆阵列（往年 Kissimmee）", en: "Mecum auction car lineup (past Kissimmee)" },
      credit: { zh: "Pokemonprime / CC BY 4.0", en: "Pokemonprime / CC BY 4.0" },
      sourceUrl: "https://commons.wikimedia.org/wiki/File%3ACar_lineup_at_Mecum_Auctions_Kissimmee_2024.jpg"
    },
    'mecum-sat': {
      src: "assets/img/events/mecum-sat.webp", width: 240, height: 160, license: "wikimedia-cc",
      alt: { zh: "Mecum 拍卖现场（2015）", en: "Mecum auction scene (2015)" },
      credit: { zh: "artistmac / CC BY-SA 2.0", en: "artistmac / CC BY-SA 2.0" },
      sourceUrl: "https://commons.wikimedia.org/wiki/File%3AMecum_auction_%282015%29.jpg"
    },
    'rm-wed': {
      src: "assets/img/events/rm-wed.webp", width: 240, height: 160, license: "wikimedia-cc",
      alt: { zh: "2018 RM Sotheby’s Monterey 预展车辆", en: "2018 RM Sotheby’s Monterey preview car" },
      credit: { zh: "Prova MO / CC BY-SA 4.0", en: "Prova MO / CC BY-SA 4.0" },
      sourceUrl: "https://commons.wikimedia.org/wiki/File%3A1972_Nissan_240ZG_at_RM_Sothebys_Monterey_2018.jpg"
    },
    'rm-thu': {
      src: "assets/img/events/rm-thu.webp", width: 240, height: 160, license: "wikimedia-cc",
      alt: { zh: "2018 RM Sotheby’s Monterey 拍卖 Ferrari 250 GTO", en: "2018 RM Sotheby’s Monterey auction Ferrari 250 GTO" },
      credit: { zh: "Prova MO / CC BY-SA 4.0", en: "Prova MO / CC BY-SA 4.0" },
      sourceUrl: "https://commons.wikimedia.org/wiki/File%3AFerrari_250_GTO_3413GT_at_RM_Sothebys_Auction_Monterey_2018.jpg"
    },
    'rm-fri': {
      src: "assets/img/events/rm-fri.webp", width: 240, height: 160, license: "wikimedia-cc",
      alt: { zh: "2022 RM Sotheby’s Monterey Ferrari 410", en: "2022 RM Sotheby’s Monterey Ferrari 410" },
      credit: { zh: "Chad Kaintz / CC BY 2.0", en: "Chad Kaintz / CC BY 2.0" },
      sourceUrl: "https://commons.wikimedia.org/wiki/File%3A2022-08-18_Monterey_Ferrari_410_0598CM.jpg"
    },
    'rm-sat': {
      src: "assets/img/events/rm-sat.webp", width: 240, height: 160, license: "wikimedia-cc",
      alt: { zh: "2022 RM Sotheby’s Monterey Maserati 200SI", en: "2022 RM Sotheby’s Monterey Maserati 200SI" },
      credit: { zh: "Chad Kainz / CC BY 2.0", en: "Chad Kainz / CC BY 2.0" },
      sourceUrl: "https://commons.wikimedia.org/wiki/File%3A2022-08-18_Monterey_Maserati_200SI_2427.jpg"
    },
    'bonhams': {
      src: "assets/img/events/bonhams.webp", width: 240, height: 160, license: "organizer-press",
      alt: { zh: "Bonhams Laguna Seca Auction 2026 官方图", en: "Bonhams Laguna Seca Auction 2026 official image" },
      credit: { zh: "Bonhams 拍卖页", en: "Bonhams auction page" },
      sourceUrl: "https://cars.bonhams.com/auction/31959/the-laguna-seca-auction"
    },
    'forum-thu': {
      src: "assets/img/events/forum-thu.webp", width: 240, height: 160, license: "wikimedia-cc",
      alt: { zh: "Concours 会场经典车（论坛同期场地）", en: "Classic car on Concours grounds (Forum venue area)" },
      credit: { zh: "Prova MO / CC BY-SA 4.0", en: "Prova MO / CC BY-SA 4.0" },
      sourceUrl: "https://commons.wikimedia.org/wiki/File%3A1958_MacMinn_Le_Mans_Coupe_at_Pebble_Beach_Concours_2023.jpg"
    },
    'werks': {
      src: "assets/img/events/werks.webp", width: 240, height: 160, license: "wikimedia-cc",
      alt: { zh: "Werks Reunion 相关往年 Porsche 展场", en: "Past Werks Reunion–related Porsche gathering" },
      credit: { zh: "J.Pitt / Flickr · CC BY-NC 2.0", en: "J.Pitt / Flickr · CC BY-NC 2.0" },
      sourceUrl: "https://www.flickr.com/photos/33385346@N08/45700549261"
    },
    'paddock': {
      src: "assets/img/events/paddock.webp", width: 240, height: 160, license: "organizer-press",
      alt: { zh: "The Paddock 官方活动图", en: "Official The Paddock event image" },
      credit: { zh: "The Paddock / International Car Week", en: "The Paddock / International Car Week" },
      sourceUrl: "https://concorso.ticketspice.com/international-car-week"
    },
    'rmmr-fri': {
      src: "assets/img/events/rmmr-fri.webp", width: 240, height: 160, license: "wikimedia-cc",
      alt: { zh: "2022 RMMR · Brabham BT44", en: "2022 RMMR · Brabham BT44" },
      credit: { zh: "Prova MO / CC BY-SA 4.0", en: "Prova MO / CC BY-SA 4.0" },
      sourceUrl: "https://commons.wikimedia.org/wiki/File%3A1974_Brabham_BT44_at_RMMR_2022.jpg"
    },
    'village-fri': {
      src: "assets/img/events/village-fri.webp", width: 240, height: 160, license: "wikimedia-cc",
      alt: { zh: "2016 Pebble Beach Concours 会场周边", en: "2016 Pebble Beach Concours grounds" },
      credit: { zh: "Guy Kawasaki / CC BY-SA 2.0", en: "Guy Kawasaki / CC BY-SA 2.0" },
      sourceUrl: "https://commons.wikimedia.org/wiki/File%3APebble_Beach_Concours_2016-13.jpg"
    },
    'forum-fri': {
      src: "assets/img/events/forum-fri.webp", width: 240, height: 160, license: "wikimedia-cc",
      alt: { zh: "2007 Pebble Beach Concours 展车", en: "2007 Pebble Beach Concours exhibit" },
      credit: { zh: "Rex Gray / CC BY 2.0", en: "Rex Gray / CC BY 2.0" },
      sourceUrl: "https://commons.wikimedia.org/wiki/File%3A1938_Phantom_Corsair_Pebble_Beach_Concours_dElegance_2007_03.jpg"
    },
    'gooding-fri': {
      src: "assets/img/events/gooding-fri.webp", width: 240, height: 160, license: "wikimedia-cc",
      alt: { zh: "2009 Gooding Pebble Beach 拍卖场", en: "2009 Gooding Pebble Beach auction" },
      credit: { zh: "PhotographyByPaul / Flickr · CC BY-NC 2.0", en: "PhotographyByPaul / Flickr · CC BY-NC 2.0" },
      sourceUrl: "https://www.flickr.com/photos/27611545@N08/3835939138"
    },
    'quail': {
      src: "assets/img/events/quail.webp", width: 240, height: 160, license: "wikimedia-cc",
      alt: { zh: "2017 The Quail Motorsports Gathering", en: "2017 The Quail, A Motorsports Gathering" },
      credit: { zh: "DuneSeaTrader / CC BY-SA 4.0", en: "DuneSeaTrader / CC BY-SA 4.0" },
      sourceUrl: "https://commons.wikimedia.org/wiki/File%3ADevin_C%27s_at_The_Quail_2017.jpg"
    },
    'broad-arrow': {
      src: "assets/img/events/broad-arrow.webp", width: 240, height: 160, license: "wikimedia-cc",
      alt: { zh: "2014 Quail 校园拍卖场 Ferrari（Bonhams 时代）", en: "2014 Quail-campus auction Ferrari (Bonhams era)" },
      credit: { zh: "Aekkm / CC BY-SA 4.0", en: "Aekkm / CC BY-SA 4.0" },
      sourceUrl: "https://commons.wikimedia.org/wiki/File%3A01-bonhams-ferrari-monterey-2014-1.jpg"
    },
    'pg-rally': {
      src: "assets/img/events/pg-rally.webp", width: 240, height: 160, license: "wikimedia-cc",
      alt: { zh: "Pacific Grove Rolling Concours / Auto Rally 往年", en: "Past Pacific Grove Rolling Concours / Auto Rally" },
      credit: { zh: "wbaiv / Flickr · CC BY-SA 2.0", en: "wbaiv / Flickr · CC BY-SA 2.0" },
      sourceUrl: "https://www.flickr.com/photos/9998127@N06/5626165611"
    },
    'lemons': {
      src: "assets/img/events/lemons.webp", width: 240, height: 160, license: "wikimedia-cc",
      alt: { zh: "2010 Concours d’LeMons Seaside", en: "2010 Concours d’LeMons in Seaside" },
      credit: { zh: "SeeMonterey / Flickr · CC BY-NC-SA 2.0", en: "SeeMonterey / Flickr · CC BY-NC-SA 2.0" },
      sourceUrl: "https://www.flickr.com/photos/34142240@N07/4893132850"
    },
    'cars-coffee': {
      src: "assets/img/events/cars-coffee.webp", width: 240, height: 160, license: "wikimedia-cc",
      alt: { zh: "Monterey Car Week 早场车辆氛围", en: "Monterey Car Week morning car atmosphere" },
      credit: { zh: "smaedli / Flickr · CC BY 2.0", en: "smaedli / Flickr · CC BY 2.0" },
      sourceUrl: "https://www.flickr.com/photos/75264768@N00/48500910227"
    },
    'barnyard-ferrari': {
      src: "assets/img/events/barnyard-ferrari.webp", width: 240, height: 160, license: "organizer-press",
      alt: { zh: "2022 Barnyard Ferrari 活动", en: "2022 Ferrari Event at The Barnyard" },
      credit: { zh: "Big Sur Food & Wine / Kris Evered", en: "Big Sur Food & Wine / Kris Evered" },
      sourceUrl: "https://www.bigsurfoodandwine.org/popup-events/28th-annual-ferrari-event-at-the-barnyard"
    },
    'exotics': {
      src: "assets/img/events/exotics.webp", width: 240, height: 160, license: "public-domain",
      alt: { zh: "2024 Exotics on Broadway · Seaside", en: "2024 Exotics on Broadway in Seaside" },
      credit: { zh: "Woestee / CC0（Wikimedia）", en: "Woestee / CC0 (Wikimedia)" },
      sourceUrl: "https://commons.wikimedia.org/wiki/File%3AExotics_on_Broadway_2024.jpg"
    },
    'rmmr-sat': {
      src: "assets/img/events/rmmr-sat.webp", width: 240, height: 160, license: "wikimedia-cc",
      alt: { zh: "2022 RMMR · Ferrari 250 LM", en: "2022 RMMR · Ferrari 250 LM" },
      credit: { zh: "Prova MO / CC BY-SA 4.0", en: "Prova MO / CC BY-SA 4.0" },
      sourceUrl: "https://commons.wikimedia.org/wiki/File%3AFerrari_250_LM_5893_at_RMMR_2022.jpg"
    },
    'concorso': {
      src: "assets/img/events/concorso.webp", width: 240, height: 160, license: "wikimedia-cc",
      alt: { zh: "2014 Concorso Italiano", en: "2014 Concorso Italiano" },
      credit: { zh: "James Bond / Flickr · CC BY 2.0", en: "James Bond / Flickr · CC BY 2.0" },
      sourceUrl: "https://commons.wikimedia.org/wiki/File%3AItalian_Concours_Ferraris_%2815004650995%29.jpg"
    },
    'village-sat': {
      src: "assets/img/events/village-sat.webp", width: 240, height: 160, license: "wikimedia-cc",
      alt: { zh: "2023 Concours 会场展区", en: "2023 Concours grounds display" },
      credit: { zh: "Prova MO / CC BY-SA 4.0", en: "Prova MO / CC BY-SA 4.0" },
      sourceUrl: "https://commons.wikimedia.org/wiki/File%3AFord_Mustang_GTD_at_Pebble_Beach_Concours_2023.jpg"
    },
    'gooding-sat': {
      src: "assets/img/events/gooding-sat.webp", width: 240, height: 160, license: "wikimedia-cc",
      alt: { zh: "2009 Gooding Pebble Beach 另一视角", en: "2009 Gooding Pebble Beach (another view)" },
      credit: { zh: "PhotographyByPaul / Flickr · CC BY-NC 2.0", en: "PhotographyByPaul / Flickr · CC BY-NC 2.0" },
      sourceUrl: "https://www.flickr.com/photos/27611545@N08/3835146417"
    },
    'forum-sat': {
      src: "assets/img/events/forum-sat.webp", width: 240, height: 160, license: "wikimedia-cc",
      alt: { zh: "2016 Pebble Beach Concours 另一视角", en: "2016 Pebble Beach Concours (another view)" },
      credit: { zh: "Guy Kawasaki / CC BY-SA 2.0", en: "Guy Kawasaki / CC BY-SA 2.0" },
      sourceUrl: "https://commons.wikimedia.org/wiki/File%3APebble_Beach_Concours_2016-12.jpg"
    },
    'mmf': {
      src: "assets/img/events/mmf.webp", width: 240, height: 160, license: "wikimedia-cc",
      alt: { zh: "2021 Monterey Car Week 周边车辆氛围", en: "2021 Monterey Car Week surrounding cars" },
      credit: { zh: "smaedli / Flickr · CC BY 2.0", en: "smaedli / Flickr · CC BY 2.0" },
      sourceUrl: "https://www.flickr.com/photos/75264768@N00/51377439972"
    },
    'concours': {
      src: "assets/img/events/concours.webp", width: 240, height: 160, license: "wikimedia-cc",
      alt: { zh: "2023 Pebble Beach Concours 展场", en: "2023 Pebble Beach Concours show field" },
      credit: { zh: "Prova MO / CC BY-SA 4.0", en: "Prova MO / CC BY-SA 4.0" },
      sourceUrl: "https://commons.wikimedia.org/wiki/File%3A1937_Delahaye_135_Roadster_at_Pebble_Beach_Concours_2023.jpg"
    },
    'village-sun': {
      src: "assets/img/events/village-sun.webp", width: 240, height: 160, license: "wikimedia-cc",
      alt: { zh: "2023 Concours 会场展车", en: "2023 Concours grounds display car" },
      credit: { zh: "Prova MO / CC BY-SA 4.0", en: "Prova MO / CC BY-SA 4.0" },
      sourceUrl: "https://commons.wikimedia.org/wiki/File%3ALamborghini_Lanzador_at_Pebble_Beach_Concours_2023.jpg"
    },
    'cruise-in': {
      src: "assets/img/events/cruise-in.webp", width: 240, height: 160, license: "wikimedia-cc",
      alt: { zh: "Monterey Car Week 街头车头阵列", en: "Monterey Car Week street grill line-up" },
      credit: { zh: "rtilden / Flickr · CC BY 2.0", en: "rtilden / Flickr · CC BY 2.0" },
      sourceUrl: "https://www.flickr.com/photos/31115420@N07/52298066874"
    },
    'stanton': {
      src: "assets/img/events/stanton.webp", width: 240, height: 160, license: "wikimedia-cc",
      alt: { zh: "Custom House Plaza（Stanton Center 所在地）", en: "Custom House Plaza (Stanton Center locale)" },
      credit: { zh: "Jsweida / CC BY-SA 3.0", en: "Jsweida / CC BY-SA 3.0" },
      sourceUrl: "https://commons.wikimedia.org/wiki/File%3ACustom_House_Monterey%2C_CA.jpg"
    },
  },

  liveAreas: [
    { id: 'pebble', name: { zh: 'Pebble Beach', en: 'Pebble Beach' } },
    { id: 'carmel', name: { zh: 'Carmel', en: 'Carmel' } },
    { id: 'carmelvalley', name: { zh: 'Carmel Valley', en: 'Carmel Valley' } },
    { id: 'monterey', name: { zh: 'Monterey', en: 'Monterey' } },
    { id: 'pacificgrove', name: { zh: 'Pacific Grove / Asilomar', en: 'Pacific Grove / Asilomar' } },
    { id: 'seaside', name: { zh: 'Seaside', en: 'Seaside' } },
    { id: 'marina', name: { zh: 'Marina', en: 'Marina' } },
    { id: 'laguna', name: { zh: 'Laguna Seca', en: 'Laguna Seca' } }
  ],

  events: [
    {
      id: 'kickoff', thumbId: 'kickoff', area: 'monterey', date: '2026-08-07', time: '17:00–19:00', timeNote: { zh: '开幕式', en: 'opening ceremony' },
      title: { zh: 'Monterey Car Week Kickoff', en: 'Monterey Car Week Kickoff' }, location: { zh: 'Alvarado St 市中心 · Monterey', en: 'Downtown Alvarado St · Monterey' },
      summary: { zh: '免费开幕式：约三十辆历史赛车、车手现身与现场音乐，拉开官方车周序幕。', en: 'Free opening night: roughly thirty historic race cars, driver appearances and live music to kick off official Car Week.' },
      why: { zh: '如果周四前就到半岛，这是零成本建立车周氛围的最佳起点；也是确认活动周交通与停车节奏的低压力试水。', en: 'If you arrive before Thursday, this is the best zero-cost way to feel Car Week energy and test peninsula traffic and parking at low pressure.' },
      access: { zh: '市中心步行区；建议提早到场，周五傍晚餐饮与停车位都会收紧。', en: 'Downtown pedestrian zone; arrive early—Friday evening dining and parking tighten quickly.' },
      price: { zh: '免费', en: 'Free' }, tags: ['free'], categories: ['essential', 'free'], score: '4.5',
      source: 'https://www.seemonterey.com/monterey-car-week-events-by-day/'
    },
    {
      id: 'asilomar-day', thumbId: 'asilomar-day', area: 'pacificgrove', date: '2026-08-08', time: '10:00–16:00', timeNote: { zh: '州立公园生日庆典', en: 'state parks birthday' },
      title: { zh: 'Asilomar Day', en: 'Asilomar Day' }, location: { zh: 'Asilomar Conference Grounds · Pacific Grove', en: 'Asilomar Conference Grounds · Pacific Grove' },
      summary: { zh: '加州州立公园生日免费庆典：老爷车乘坐、12:45 摇摆舞、现场音乐与历史讲解。', en: 'Free California State Parks birthday celebration: vintage car rides, swing dance at 12:45, live music and history programming.' },
      why: { zh: '完全免费且家庭友好；与同日 Pre-Reunion 赛道日二选一，适合不想买票进 Laguna Seca 的访客。', en: 'Completely free and family-friendly; the zero-cost alternative to Pre-Reunion at Laguna Seca on the same Saturday.' },
      access: { zh: 'Asilomar 园区内活动；按现场指示牌停车，周末车位先到先得。', en: 'Events inside Asilomar grounds; follow onsite parking signs—weekend spots are first come.' },
      price: { zh: '免费', en: 'Free' }, tags: ['free'], categories: ['free'], score: '4.0',
      sources: [
        { url: 'https://www.montereybayparent.com/event/asilomar-day-in-pacific-grove/', label: { zh: '活动详情 ↗', en: 'Event details ↗' } },
        { url: 'https://www.parks.ca.gov/', label: { zh: '加州州立公园 ↗', en: 'California State Parks ↗' } }
      ]
    },
    {
      id: 'prereunion-sat', thumbId: 'prereunion-sat', area: 'laguna', date: '2026-08-08', time: '07:00–20:00', timeNote: { zh: 'Corkscrew Hillclimb · 晚间赛程至 20:00', en: 'Corkscrew Hillclimb · evening program to 20:00' },
      title: { zh: 'Monterey Pre-Reunion & Corkscrew Hillclimb · 周六', en: 'Monterey Pre-Reunion & Corkscrew Hillclimb · Saturday' }, location: { zh: 'WeatherTech Raceway Laguna Seca', en: 'WeatherTech Raceway Laguna Seca' },
      summary: { zh: 'Pre-Reunion 首日：200+ 辆历史赛车，含 Corkscrew Hillclimb 爬坡赛。', en: 'Pre-Reunion day one: 200+ historic race cars including the Corkscrew Hillclimb.' },
      why: { zh: '想在 Reunion 前先看历史赛车、且预算低于正赛周末的赛道迷首选；与 Asilomar Day 完全冲突，只能二选一。', en: 'The track pick for historic-racing fans who want action before Reunion at a lower price than peak weekend—directly conflicts with Asilomar Day.' },
      access: { zh: '大型活动走 South Boundary Road；Grounds+Paddock 票含普通停车。', en: 'Major-event access via South Boundary Road; Grounds+Paddock pass includes general parking.' },
      price: { zh: '单日 ~$82.62 · 2 日 ~$124.15', en: '~$82.62 single day · ~$124.15 two-day' }, tags: ['paid', 'subjectTag'], categories: ['essential', 'paid'], score: '4.5',
      source: 'https://weathertechraceway.com/pages/monterey-pre-reunion-and-corkscrew-hillclimb'
    },
    {
      id: 'prereunion-sun', thumbId: 'prereunion-sun', area: 'laguna', date: '2026-08-09', time: '07:00–18:15', timeNote: { zh: '正赛日 · 最后赛程至 18:15', en: 'race day · final program to 18:15' },
      title: { zh: 'Monterey Pre-Reunion · 周日', en: 'Monterey Pre-Reunion · Sunday' }, location: { zh: 'WeatherTech Raceway Laguna Seca', en: 'WeatherTech Raceway Laguna Seca' },
      summary: { zh: 'Pre-Reunion 次日：历史赛车正赛与 paddock 近距离观赏。', en: 'Pre-Reunion day two: historic race action and close paddock access.' },
      why: { zh: '若周六选了 Asilomar，周日可补赛道；若已买 2 日票则自然接续。单日性价比略低于周六 hillclimb 特色日。', en: 'Catch the track on Sunday if you chose Asilomar Saturday; natural follow-up with a two-day pass. Single-day value is slightly below Saturday’s hillclimb hook.' },
      access: { zh: '大型活动走 South Boundary Road；Grounds+Paddock 票含普通停车。', en: 'Major-event access via South Boundary Road; Grounds+Paddock pass includes general parking.' },
      price: { zh: '单日 ~$82.62 · 2 日 ~$124.15', en: '~$82.62 single day · ~$124.15 two-day' }, tags: ['paid', 'subjectTag'], categories: ['paid'], score: '4.0',
      source: 'https://weathertechraceway.com/pages/monterey-pre-reunion-and-corkscrew-hillclimb'
    },
    {
      id: 'electric-coast-mon', thumbId: 'electric-coast-mon', area: 'pacificgrove', date: '2026-08-10', time: '12:00–16:00', timeNote: { zh: '官方时段', en: 'official hours' },
      title: { zh: 'Electric Coast on the Coast', en: 'Electric Coast on the Coast' }, location: { zh: 'Asilomar Lot B · Pacific Grove', en: 'Asilomar Lot B · Pacific Grove' },
      summary: { zh: '免费电动车展示，含 Rivian 试驾；Asilomar 官方时段 12:00–16:00。', en: 'Free EV showcase with Rivian test drives; official Asilomar hours 12:00–16:00.' },
      why: { zh: '轻量免费补充，适合周一抵达或想先看 EV 趋势再进主周的访客。', en: 'A light free add-on for Monday arrivals or visitors who want an EV preview before peak week.' },
      access: { zh: 'Asilomar Lot B；按园区指示牌停车。', en: 'Asilomar Lot B; follow grounds parking signs.' },
      price: { zh: '免费', en: 'Free' }, tags: ['free'], categories: ['free'], score: '3.5',
      source: 'https://www.visitasilomar.com/things-to-do/car-week'
    },
    {
      id: 'monterey-british', thumbId: 'monterey-british', area: 'carmelvalley', date: '2026-08-10', time: '11:00–14:00', timeNote: { zh: '公众时段', en: 'public hours' },
      title: { zh: 'Monterey British Car Day', en: 'Monterey British Car Day' }, location: { zh: 'Carmel Valley Historical Society 区域', en: 'Carmel Valley Historical Society area' },
      summary: { zh: '80+ 辆英系经典车免费展示，宠物友好。', en: '80+ British classics on free display; pet-friendly.' },
      why: { zh: '英系车迷的轻量免费主场；与同日 Porsche Seaside 可组合成半日双主题。', en: 'A light free anchor for British-marque fans; pairs with Porsche Seaside the same afternoon.' },
      access: { zh: 'Carmel Valley 区域；给停车与转场留 20–30 分钟。', en: 'Carmel Valley area; allow 20–30 minutes for parking and transfers.' },
      price: { zh: '免费', en: 'Free' }, tags: ['free'], categories: ['free'], score: '3.5',
      source: 'https://www.seemonterey.com/monterey-car-week-events-by-day/'
    },
    {
      id: 'porsche-seaside', thumbId: 'porsche-seaside', area: 'seaside', date: '2026-08-10', time: '15:00–19:00', timeNote: { zh: '公众时段', en: 'public hours' },
      title: { zh: 'Porsche Monterey', en: 'Porsche Monterey' }, location: { zh: 'Porsche Monterey · Seaside', en: 'Porsche Monterey · Seaside' },
      summary: { zh: '免费保时捷经典与现代车型展示，含音乐与 food trucks。', en: 'Free vintage and modern Porsche display with music and food trucks.' },
      why: { zh: '周一傍晚轻松收尾；为周三前 Werks 预热保时捷氛围，但不如 Werks 本身完整。', en: 'An easy Monday-evening wrap; warms up Porsche fans before Werks, though not as complete as the Friday reunion.' },
      access: { zh: 'Porsche Monterey 展厅区域；Seaside 停车相对宽松。', en: 'Porsche Monterey showroom area; Seaside parking is relatively easier.' },
      price: { zh: '免费', en: 'Free' }, tags: ['free'], categories: ['free'], score: '3.5',
      source: 'https://www.seemonterey.com/monterey-car-week-events-by-day/'
    },
    {
      id: 'ace', thumbId: 'ace', area: 'seaside', date: '2026-08-10', time: '10:00–17:00', timeNote: { zh: '三天展期首日', en: 'day 1 of three' },
      title: { zh: 'Automobilia Collectors Expo (ACE)', en: 'Automobilia Collectors Expo (ACE)' }, location: { zh: 'Embassy Suites Monterey Bay · Seaside', en: 'Embassy Suites Monterey Bay · Seaside' },
      summary: { zh: '车周开场藏品展：海报、文献、徽章、模型与文物；8/10–11 10:00–17:00，8/12 10:00–15:00。', en: 'Car Week’s opening automobilia hall—posters, literature, badges, models and artifacts. Hours: Aug 10–11 10:00–17:00; Aug 12 10:00–15:00.' },
      why: { zh: '整周最完整的“非整车”收藏体验；适合拍卖预热或雨天/中场补充。单日 $30、三日 $60，性价比高于多数高价夜场。', en: 'The week’s strongest non-car collecting experience—ideal as auction warm-up or a rainy/midweek filler. 1-day $30 / 3-day $60 beats most luxury evenings on value.' },
      access: { zh: '1441 Canyon Del Rey Blvd；购票页另有 Forum / VIP 升级。周二另有现场藏品拍卖。', en: '1441 Canyon Del Rey Blvd; Forum/VIP upgrades on the ticket page. Live automobilia auction is Tuesday.' },
      price: { zh: '单日 $30 · 三日 $60 · VIP $165（早鸟标价，以购票页为准）', en: '1-day $30 · 3-day $60 · VIP $165 (early-bird listed; recheck ticket page)' }, tags: ['paid', 'subjectTag'], categories: ['essential', 'paid'], score: '4.0',
      sources: [
        { url: 'https://automobiliacollectorsexpo.com/', label: { zh: 'ACE 官网 ↗', en: 'ACE official ↗' } },
        { url: 'https://automobiliacollectorsexpo.com/attendees/get-tickets', label: { zh: '购票 ↗', en: 'Tickets ↗' } },
        { url: 'https://automobiliacollectorsexpo.com/attendees/schedule', label: { zh: '日程 ↗', en: 'Schedule ↗' } }
      ]
    },
    {
      id: 'poker-rally', thumbId: 'poker-rally', area: 'marina', date: '2026-08-10', time: '10:00–15:00', timeNote: { zh: '公众展区免费', en: 'free public showcase' },
      title: { zh: 'Central Coast Poker Rally', en: 'Central Coast Poker Rally' }, location: { zh: 'The Brass Tap · Marina → Laguna Seca', en: 'The Brass Tap · Marina → Laguna Seca' },
      summary: { zh: '周一 Marina 运动/超跑展示 10:00–15:00 对公众免费；注册车手随后赴 Laguna Seca 巡游圈。', en: 'Monday sports/exotic showcase at Marina is free to the public 10:00–15:00; registered drivers continue to Laguna Seca parade laps.' },
      why: { zh: '周一最轻松的免费看车补充；不要跟车进赛道。若已去 ACE，这里适合当北侧顺路站。', en: 'The easiest free Monday car stop—do not follow drivers onto the track. A natural north-side add-on if you already hit ACE.' },
      access: { zh: 'The Brass Tap at The Dunes（99 General Stillwell Dr, Marina）；参赛套餐另售，赛道段仅限注册车手。', en: 'The Brass Tap at The Dunes (99 General Stillwell Dr, Marina); driver packages sold separately—track segment is registered drivers only.' },
      price: { zh: '公众展区免费 · 参赛约 $145–247', en: 'Public showcase free · drivers ~$145–247' }, tags: ['mixedTag'], categories: ['free', 'paid'], score: '3.5',
      sources: [
        { url: 'https://centralcoastpokerrally.com/itinerary/', label: { zh: '官方行程 ↗', en: 'Official itinerary ↗' } },
        { url: 'https://centralcoastpokerrally.com/', label: { zh: '报名首页 ↗', en: 'Registration home ↗' } }
      ]
    },
    {
      id: 'concours-cause', thumbId: 'concours-cause', area: 'carmel', date: '2026-08-11', time: '10:00–16:00', timeNote: { zh: '慈善街展', en: 'charity show' },
      title: { zh: 'Concours for a Cause', en: 'Concours for a Cause' }, location: { zh: 'Ocean Ave · Carmel-by-the-Sea', en: 'Ocean Ave · Carmel-by-the-Sea' },
      summary: { zh: 'Carmel Ocean Ave 免费慈善车展，经典车与步行街区氛围兼具。', en: 'Free charity car show on Carmel’s Ocean Ave with classic cars and a walkable downtown setting.' },
      why: { zh: '早场最高性价比免费主场之一；在 Tour 前就能感受 Carmel 街展尺度，且完全免费。', en: 'One of the strongest free early anchors—feel Carmel’s street-show scale before Tour week at zero cost.' },
      access: { zh: 'Ocean Ave 步行区；Carmel 停车紧张，考虑 Larson Field 接驳或早到。', en: 'Ocean Ave pedestrian zone; Carmel parking is tight—consider Larson Field shuttle or arrive early.' },
      price: { zh: '免费', en: 'Free' }, tags: ['free'], categories: ['essential', 'free'], score: '4.5',
      source: 'https://www.seemonterey.com/monterey-car-week-events-by-day/'
    },
    {
      id: 'ace-auction', thumbId: 'ace-auction', area: 'seaside', date: '2026-08-11', time: '16:00–20:00', timeNote: { zh: '现场拍卖', en: 'live auction' },
      title: { zh: 'ACE Automobilia Live Auction', en: 'ACE Automobilia Live Auction' }, location: { zh: 'Embassy Suites Monterey Bay · Seaside', en: 'Embassy Suites Monterey Bay · Seaside' },
      summary: { zh: 'ACE 现场藏品拍卖；周一/周二白天可预展，周二 16:00–20:00 开拍。', en: 'Live automobilia auction at ACE; daytime previews Mon/Tue, live sale Tuesday 16:00–20:00.' },
      why: { zh: '车周唯一专注 automobilia 的拍卖夜；想买海报/文献/纪念品比追整车拍卖门槛低。需 ACE 入场或对应票种。', en: 'The week’s only automobilia-focused auction night—lower barrier than car auctions for posters, literature and memorabilia. Requires ACE admission or matching ticket.' },
      access: { zh: '竞拍需另行注册；预展与入场规则以 ACE 拍卖页为准。', en: 'Bidding requires separate registration; preview and entry rules follow the ACE auction pages.' },
      price: { zh: '含于 ACE 票种 · 竞拍另注册', en: 'Included with ACE passes · bidder reg. separate' }, tags: ['paid'], categories: ['paid'], score: '3.5',
      sources: [
        { url: 'https://automobiliacollectorsexpo.com/auction/overview', label: { zh: '拍卖概览 ↗', en: 'Auction overview ↗' } },
        { url: 'https://automobiliacollectorsexpo.com/attendees/schedule', label: { zh: '日程 ↗', en: 'Schedule ↗' } }
      ]
    },
    {
      id: 'electric-coast-tue', thumbId: 'electric-coast-tue', area: 'pacificgrove', date: '2026-08-11', time: '10:00–14:00', timeNote: { zh: '官方时段', en: 'official hours' },
      title: { zh: 'Electric Coast on the Coast', en: 'Electric Coast on the Coast' }, location: { zh: 'Asilomar Lot B · Pacific Grove', en: 'Asilomar Lot B · Pacific Grove' },
      summary: { zh: '免费电动车展示；Asilomar 官方时段 10:00–14:00。', en: 'Free EV showcase; official Asilomar hours 10:00–14:00.' },
      why: { zh: '可接在 Concours for a Cause 之后，半天完成 Carmel 街展 + PG 电动车主题。', en: 'Follow Concours for a Cause for a half-day pairing Carmel street show with PG’s EV theme.' },
      access: { zh: 'Asilomar Lot B；从 Carmel 转场约 15–25 分钟。', en: 'Asilomar Lot B; roughly 15–25 minutes from Carmel.' },
      price: { zh: '免费', en: 'Free' }, tags: ['free'], categories: ['free'], score: '3.5',
      source: 'https://www.visitasilomar.com/things-to-do/car-week'
    },
    {
      id: 'night-rider', thumbId: 'night-rider', area: 'pacificgrove', date: '2026-08-11', time: '18:00–21:00', timeNote: { zh: '地下车库夜场', en: 'underground garage evening' },
      title: { zh: 'All Roads Lead to Asilomar: Night Rider', en: 'All Roads Lead to Asilomar: Night Rider' }, location: { zh: 'Underground Garage Lot D · Asilomar', en: 'Underground Garage Lot D · Asilomar' },
      summary: { zh: '低底盘 / Chicano 汽车文化夜场，设于 Asilomar 地下车库。', en: 'A lowrider / Chicano car-culture evening inside Asilomar’s underground garage.' },
      why: { zh: '整周少有的夜间文化向车展；与白天 Concours for a Cause 互补，比奢华 Jet Center 夜场便宜一个数量级。', en: 'A rare culture-first evening show; complements daytime Concours for a Cause and costs an order of magnitude less than Jet Center luxury nights.' },
      access: { zh: 'Asilomar Lot D 地下车库；Eventbrite 成人 $65（含 2 杯饮品）、儿童 $33；停车以 Asilomar / Eventbrite 为准。', en: 'Asilomar underground Garage Lot D; Eventbrite adult $65 (includes 2 drinks), child $33—recheck Asilomar/Eventbrite for parking.' },
      price: { zh: '成人 $65 · 儿童 $33', en: '$65 adult · $33 child' }, tags: ['paid'], categories: ['paid'], score: '4.0',
      sources: [
        { url: 'https://www.visitasilomar.com/things-to-do/car-week', label: { zh: 'Asilomar Car Week ↗', en: 'Asilomar Car Week ↗' } },
        { url: 'https://www.eventbrite.com/e/1990827025224', label: { zh: '购票 Eventbrite ↗', en: 'Tickets on Eventbrite ↗' } }
      ]
    },
    {
      id: 'little-car', thumbId: 'little-car', area: 'pacificgrove', date: '2026-08-12', time: '12:00–17:00', timeNote: { zh: '含巡航', en: 'includes cruise' },
      title: { zh: 'The Little Car Show', en: 'The Little Car Show' }, location: { zh: 'Lighthouse Ave · Pacific Grove', en: 'Lighthouse Ave · Pacific Grove' },
      summary: { zh: '观众免费的微型/迷你经典车展，展后有巡航；常规参展报名已关闭，如现场仍有名额则为 $125。', en: 'Free-for-spectators micro/mini classic show with a post-show cruise; regular exhibitor entries are closed, with $125 day-of spots only if available.' },
      why: { zh: '早场最有趣、记忆点最强的免费主场（对观众）；与同日 Carmel Astons 可组合，但不必两边赶。', en: 'The most memorable free early anchor for spectators—pair with Carmel Astons the same day, but do not rush both.' },
      access: { zh: 'Lighthouse Ave 步行区；Pacific Grove 停车先到先得。常规参展报名已关闭，不要把观众免费理解为带车免费。', en: 'Lighthouse Ave pedestrian zone; Pacific Grove parking is first come. Regular exhibitor entries are closed—do not treat spectator free as exhibitor free.' },
      price: { zh: '观众免费 · 如有现场参展名额 $125', en: 'Spectators free · day-of exhibitor spots $125 if available' }, tags: ['mixedTag'], categories: ['essential', 'free', 'paid'], score: '4.5',
      sources: [
        { url: 'https://www.thelittlecarshow.com/the-little-car-show-schedule/', label: { zh: '2026 官方日程 ↗', en: 'Official 2026 schedule ↗' } },
        { url: 'https://www.thelittlecarshow.com/', label: { zh: '官方参展状态 ↗', en: 'Official exhibitor status ↗' } }
      ]
    },
    {
      id: 'astons', thumbId: 'astons', area: 'carmel', date: '2026-08-12', time: '11:00–16:00', timeNote: { zh: '公众时段', en: 'public hours' },
      title: { zh: 'Astons on the Avenue', en: 'Astons on the Avenue' }, location: { zh: 'Ocean Ave · Carmel-by-the-Sea', en: 'Ocean Ave · Carmel-by-the-Sea' },
      summary: { zh: 'Carmel Ocean Ave 免费阿斯顿·马丁主题街展。', en: 'Free Aston Martin street show on Carmel’s Ocean Ave.' },
      why: { zh: '阿斯顿车迷 4/5；普通观众若已去 Little Car Show 可跳过，不必专程折返 Carmel。', en: 'A 4/5 for Aston fans; general visitors who hit the Little Car Show can skip unless Aston is a specific draw.' },
      access: { zh: 'Ocean Ave 步行区；从 Pacific Grove 转场约 15–25 分钟。', en: 'Ocean Ave pedestrian zone; roughly 15–25 minutes from Pacific Grove.' },
      price: { zh: '免费', en: 'Free' }, tags: ['free'], categories: ['free'], score: '4.0',
      source: 'https://www.seemonterey.com/monterey-car-week-events-by-day/'
    },
    {
      id: 'motoring-classic', thumbId: 'motoring-classic', area: 'pebble', date: '2026-08-12', time: '16:00–', timeNote: { zh: '车辆抵达', en: 'car arrivals' },
      title: { zh: 'Motoring Classic 车辆抵达', en: 'Motoring Classic car arrivals' }, location: { zh: 'Pebble Beach', en: 'Pebble Beach' },
      summary: { zh: 'Motoring Classic 参展车辆免费公开抵达观赏。', en: 'Free public viewing as Motoring Classic entrants arrive in Pebble Beach.' },
      why: { zh: '傍晚轻量收尾，提前感受 Pebble Beach 活动周氛围，为周四 Tour 预热。', en: 'A light evening finish that previews Pebble Beach energy before Thursday’s Tour.' },
      access: { zh: 'Pebble Beach 区域内按现场标识停车；17-Mile Drive 活动周前交通仍相对宽松。', en: 'Follow event signs for parking in Pebble Beach; 17-Mile Drive traffic is still relatively lighter before peak week.' },
      price: { zh: '免费', en: 'Free' }, tags: ['free'], categories: ['free'], score: '4.0',
      source: 'https://www.seemonterey.com/monterey-car-week-events-by-day/'
    },
    {
      id: 'rmmr-wed', thumbId: 'rmmr-wed', area: 'laguna', date: '2026-08-12', time: '07:00–17:10', timeNote: { zh: '07:00 入场 · 08:00–17:10 赛程', en: 'gates 07:00 · on-track 08:00–17:10' },
      title: { zh: 'Rolex Monterey Motorsports Reunion · 周三', en: 'Rolex Monterey Motorsports Reunion · Wednesday' }, location: { zh: 'WeatherTech Raceway Laguna Seca', en: 'WeatherTech Raceway Laguna Seca' },
      summary: { zh: 'Rolex Reunion 开幕日；当前 Tier 2 成人票 $93.10 含费用，15 岁及以下免费。', en: 'Opening day of Rolex Reunion; the current Tier 2 adult ticket is $93.10 all-in, and ages 15 and under are free.' },
      why: { zh: '赛道迷可提前一天进场；若只能去一天，周四至周六票价与内容组合需对比后再买。', en: 'Track fans can enter a day early; if buying only one day, compare Wednesday through Saturday pricing and programming first.' },
      access: { zh: '大型活动走 South Boundary Road；成人票含普通停车、paddock 和指定看台。', en: 'Major-event access via South Boundary Road; adult admission includes general parking, paddock and designated grandstands.' },
      price: { zh: 'Tier 2 成人 $93.10 含费用', en: 'Tier 2 adult $93.10 all-in' }, tags: ['paid', 'subjectTag'], categories: ['paid'], score: '4.0',
      sources: [
        { url: 'https://weathertechraceway.com/pages/rolex-monterey-motorsports-reunion', label: { zh: '官方赛程 ↗', en: 'Official schedule ↗' } },
        { url: 'https://tickets.weathertechraceway.com/event/rolex-reunion-wednesday---august-12-2026', label: { zh: '官方票务 ↗', en: 'Official tickets ↗' } }
      ]
    },
    {
      id: 'luau', thumbId: 'luau', area: 'pacificgrove', date: '2026-08-12', time: '17:00–20:00', timeNote: { zh: 'Woodies 前夜开场', en: 'Woodies kickoff evening' },
      title: { zh: 'Luau in Asilomar’s Grand Cypress Meadow', en: 'Luau in Asilomar’s Grand Cypress Meadow' }, location: { zh: 'Grand Cypress Meadow · Asilomar', en: 'Grand Cypress Meadow · Asilomar' },
      summary: { zh: '夏威夷风情晚会：现场乐队、舞蹈与餐饮，主办方定位为 Woodies in the Woods 正式开场。', en: 'Island-themed evening with live music, dance and dinner—positioned as the official kickoff to Woodies in the Woods.' },
      why: { zh: '想要有节目的周三晚、又不想付 Motorlux 级别票价时的中间选项；与 Jet Center 夜场时间重叠。核对时 Eventbrite 显示售罄，出发前重查候补。', en: 'The mid-priced Wednesday evening if Motorlux is too steep—time-conflicts with the Jet Center night. Eventbrite showed sold out when checked; recheck for releases.' },
      access: { zh: 'Asilomar Grand Cypress Meadow；成人 $70（含入场、晚餐与演出），Eventbrite 购票。', en: 'Asilomar Grand Cypress Meadow; $70 adult including entry, dinner and show via Eventbrite.' },
      price: { zh: '$70 / 人 · 核对时售罄', en: '$70 / person · sold out when checked' }, tags: ['paid', 'soldOutTag'], categories: ['paid'], score: '3.5',
      sources: [
        { url: 'https://www.visitasilomar.com/things-to-do/car-week', label: { zh: 'Asilomar Car Week ↗', en: 'Asilomar Car Week ↗' } },
        { url: 'https://www.eventbrite.com/e/1990913936177', label: { zh: '购票 Eventbrite ↗', en: 'Tickets on Eventbrite ↗' } }
      ]
    },
    {
      id: 'motorlux', thumbId: 'motorlux', area: 'monterey', date: '2026-08-12', time: '18:00–22:00', timeNote: { zh: 'Jet Center 夜场', en: 'Jet Center evening' },
      title: { zh: 'Motorlux', en: 'Motorlux' }, location: { zh: 'Monterey Jet Center', en: 'Monterey Jet Center' },
      summary: { zh: '喷气中心停机坪夜场：稀有汽车 + 飞机 + 餐饮酒水与现场娱乐；21+。前身为 McCall’s Motorworks Revival，现名 Motorlux。', en: 'Jet-center tarmac evening: rare cars and aircraft with cuisine, drinks and entertainment; 21+. Formerly McCall’s Motorworks Revival; now Motorlux.' },
      why: { zh: '周三最高规格社交夜场；票价极高。持票可获 Broad Arrow @ The Quail 拍卖竞拍注册（Quail 入场另购）。多数公众应跳过，改看免费抵达或另寻晚场。', en: 'Wednesday’s highest-spec social night—and extremely expensive. Tickets include Broad Arrow @ The Quail bidder registration (Quail entry separate). Most visitors should skip for free arrivals or another evening.' },
      access: { zh: 'Monterey Jet Center；成人 $845，21+，鸡尾酒着装，禁牛仔裤/人字拖；VIP 停机坪停车已售罄。', en: 'Monterey Jet Center; adult $845, ages 21+, cocktail attire, no jeans/flip-flops; VIP Tarmac Parking is sold out.' },
      price: { zh: '成人 $845 · VIP 停机坪停车已售罄', en: 'Adult $845 · VIP Tarmac Parking sold out' }, tags: ['paid', 'soldOutTag'], categories: ['paid'], score: '3.0',
      source: 'https://motorlux.com/tickets/'
    },
    {
      id: 'rm-wed', thumbId: 'rm-wed', area: 'monterey', date: '2026-08-12', time: '10:00–18:00', timeNote: { zh: '公开预展', en: 'public preview' },
      title: { zh: 'RM Sotheby’s · The Monterey Auction', en: 'RM Sotheby’s · The Monterey Auction' }, location: { zh: 'Monterey Conference Center · 1 Portola Plaza', en: 'Monterey Conference Center · 1 Portola Plaza' },
      summary: { zh: '周三公开预展；现场周末通票 $60。17:00 后 front drive 对私人活动关闭。', en: 'Wednesday public preview; $60 weekend pass sold onsite. Front drive closes after 17:00 for a private event.' },
      why: { zh: '周三白天看收藏车性价比不错；若只能去一场 RM，优先预展而非受限的夜场拍卖席。', en: 'A solid Wednesday daytime collector-car option; if choosing one RM visit, preview beats the restricted auction floor.' },
      access: { zh: '1 Portola Plaza；预展对购票公众开放。拍卖厅仅限注册竞拍人、委托方与合格媒体。', en: '1 Portola Plaza; preview is for ticketed public. The auction floor is limited to registered bidders, consignors and qualified media.' },
      price: { zh: '预展周末通票 $60（现场）', en: 'Preview weekend pass $60 (onsite)' }, tags: ['paid'], categories: ['essential', 'paid'], score: '4.0',
      source: 'https://www.rmsothebys.com/auctions/mo26/'
    },
    {
      id: 'tour', thumbId: 'tour', area: 'pebble', date: '2026-08-13', time: '07:00–12:00', timeNote: { zh: '9:30 / 9:45 / 10:00 三批发车', en: 'waves at 9:30 / 9:45 / 10:00' },
      title: { zh: 'Pebble Beach Tour d’Elegance', en: 'Pebble Beach Tour d’Elegance' }, location: { zh: 'Portola Road · Pebble Beach', en: 'Portola Road · Pebble Beach' },
      summary: { zh: '因 Big Sur Timber Fire，官方新版环线只留在 Pebble Beach 与 Monterey，经 17-Mile Drive、Hwy 1、Hwy 68、Olmsted Road 与 Aguajito Road；不再经过 Carmel 或 Big Sur。', en: 'Because of the Big Sur Timber Fire, the revised loop stays in Pebble Beach and Monterey via 17-Mile Drive, Hwy 1, Hwy 68, Olmsted Road and Aguajito Road; it no longer passes through Carmel or Big Sur.' },
      why: { zh: '主展级车辆真正开起来，而且公众观看免费。优先看 7:00 起集结、9:30 / 9:45 / 10:00 三批发车，再于约中午看车辆归来。', en: 'Concours-level cars in motion, free to the public. Prioritize staging from 7:00, all three waves at 9:30 / 9:45 / 10:00, then the approximate noon return.' },
      access: { zh: '本站建议 6:15–6:30 入园；官方未公布普通观众固定停车场。进入 Pebble Beach 后按现场指示停在 Portola Road 起终点附近指定区域，再步行观看。若改用 Monterey 条件备选，必须放弃 Portola 观看并在发车前停好；不要追车或去 Carmel 等待。', en: 'This guide suggests entering at 6:15–6:30; no fixed general-spectator lot is published. Follow onsite signs to designated nearby parking for the Portola Road start / finish, then watch on foot. A conditional Monterey alternative means skipping Portola and parking before departure. Do not chase the convoy or wait in Carmel.' },
      price: { zh: '公众观看免费', en: 'Free public viewing' }, tags: ['free'], categories: ['essential', 'free'], score: '5.0',
      sources: [
        { label: { zh: 'Tour 官方活动页', en: 'Official Tour event page' }, url: 'https://www.pebblebeachconcours.net/event/pebble-beach-tour-delegance/' },
        { label: { zh: '8 月 12 日官方更新', en: 'Official Aug 12 update' }, url: 'https://www.pebblebeachconcours.net/updates/' },
        { label: { zh: '8 月 11 日新版路线图 PDF', en: 'Aug 11 revised route map PDF' }, url: 'https://www.pebblebeachconcours.net/wp-content/uploads/2026/08/2026-Concours-Tour-Map-8-11-26-web.pdf' },
        { label: { zh: '官方方向、停车与活动图', en: 'Official directions, parking & maps' }, url: 'https://www.pebblebeachconcours.net/plan-your-visit/directions-parking-event-maps/' }
      ]
    },
    {
      id: 'ferrari-carmel', thumbId: 'ferrari-carmel', area: 'carmel', date: '2026-08-13', time: '09:00–16:00', timeNote: { zh: '公众时段', en: 'public hours' },
      title: { zh: 'Ferrari Owners Club Concours Carmel', en: 'Ferrari Owners Club Concours Carmel' }, location: { zh: 'Ocean Ave × Dolores St · Carmel', en: 'Ocean Ave at Dolores St · Carmel' },
      summary: { zh: 'Carmel 市中心的法拉利主题街展；它是同日独立备选，不是 Tour 路线上的观看点，也不要在看完发车后追车赶去。', en: 'A Ferrari-centered downtown street show. Treat it as a separate same-day alternative, not a Tour viewing point or a stop to chase after the departures.' },
      why: { zh: '免费、步行尺度友好，也是下午在意大利车与德系品牌之间做选择时的优质一站。', en: 'Free and walkable; a strong Italian-car choice when deciding between Carmel and the German-marque event.' },
      access: { zh: 'Larson Field 免费停车；8:00–21:00 免费接驳约每 10–15 分钟到 Carmel Plaza。', en: 'Free parking at Larson Field; free shuttle to Carmel Plaza roughly every 10–15 minutes from 8:00–21:00.' },
      price: { zh: '观众免费', en: 'Spectators free' }, tags: ['free'], categories: ['free'], score: '4.0',
      source: 'https://www.carmelcalifornia.com/carmel-car-week/'
    },
    {
      id: 'legends', thumbId: 'legends', area: 'pacificgrove', date: '2026-08-13', time: '08:00–17:00', timeNote: { zh: '详细节目待发布', en: 'program pending' },
      title: { zh: 'Legends of the Autobahn', en: 'Legends of the Autobahn' }, location: { zh: 'Pacific Grove Golf Links', en: 'Pacific Grove Golf Links' },
      summary: { zh: 'BMW、Audi、Mercedes-Benz 等德系品牌聚会；观众无需注册。', en: 'A German-marque gathering centered on BMW, Audi and Mercedes-Benz; spectators need no registration.' },
      why: { zh: '德系车迷推荐度 5/5；普通观众则与 Ferrari Carmel 二选一，没必要两边赶。', en: 'A 5/5 for German-marque fans. General visitors should choose this or Ferrari Carmel rather than rushing both.' },
      access: { zh: '只能停指定活动停车场；街边多为居民限制区。停车预购 $30、现场 $40。', en: 'Use designated event lots only; nearby street parking is resident-restricted. Parking is $30 prepaid or $40 onsite.' },
      price: { zh: '未列单独观众票价 · 停车 $30–40', en: 'No separate spectator price listed · $30–40 parking' }, tags: ['admissionUnstatedTag'], categories: ['unpriced'], score: '4.0',
      source: 'https://legendsoftheautobahn.org/'
    },
    {
      id: 'woodies', thumbId: 'woodies', area: 'pacificgrove', date: '2026-08-13', time: '12:00–17:00', timeNote: { zh: '下午主场', en: 'afternoon anchor' },
      title: { zh: 'Woodies in the Woods', en: 'Woodies in the Woods' }, location: { zh: 'Grand Cypress Meadow · Asilomar · Pacific Grove', en: 'Grand Cypress Meadow · Asilomar · Pacific Grove' },
      summary: { zh: '免费 woodie 旅行车聚会，含音乐、餐饮与啤酒花园；免费停车。', en: 'Free woodie wagon gathering with music, food and a beer garden; free parking.' },
      why: { zh: 'Tour 上午之后的轻松下午选择；若不想在 Village/Legends 之间赶场，这里是冲浪文化与老爷车的低压力替代。', en: 'A relaxed Thursday afternoon after the Tour morning; a low-pressure surf-culture alternative if you do not want to rush between Village and Legends.' },
      access: { zh: 'Asilomar Grand Cypress Meadow；园区内免费停车。', en: 'Asilomar Grand Cypress Meadow; free parking inside the grounds.' },
      price: { zh: '免费', en: 'Free' }, tags: ['free'], categories: ['free'], score: '4.0',
      source: 'https://www.visitasilomar.com/things-to-do/car-week'
    },
    {
      id: 'village-thu', thumbId: 'village-thu', area: 'pebble', date: '2026-08-13', time: '08:00–18:00', timeNote: { zh: '官方开放时间', en: 'official hours' },
      title: { zh: 'Concours Village + RetroAuto', en: 'Concours Village + RetroAuto' }, location: { zh: 'Forest Lake Rd × Stevenson Dr · Pebble Beach', en: 'Forest Lake Rd at Stevenson Dr · Pebble Beach' },
      summary: { zh: '免费品牌展、概念车、收藏品与 RetroAuto 市集；部分试驾先到先得。', en: 'Free manufacturer displays, concepts, collectibles and the RetroAuto marketplace; some drives are first come.' },
      why: { zh: '不买周日主展票也能获得完整车周氛围，是 Tour 之后最稳妥的免费下午。', en: 'The most complete free Car Week atmosphere without a Sunday ticket, and the safest Thursday-afternoon choice after the Tour.' },
      access: { zh: '网约车统一在 Village 上下客。各品牌试驾可能要求 21 岁、驾照、免责签署与包脚鞋，排队不能保证。', en: 'Rideshare uses the Village node. Brand drives may require age 21+, license, waiver and closed-toe shoes; queues and availability are not guaranteed.' },
      price: { zh: '免费', en: 'Free' }, tags: ['free'], categories: ['essential', 'free'], score: '5.0',
      source: 'https://www.pebblebeachconcours.net/events/concours-village/'
    },
    {
      id: 'rmmr-thu', thumbId: 'rmmr-thu', area: 'laguna', date: '2026-08-13', time: '08:00–17:35', timeNote: { zh: '赛程会调整', en: 'schedule may change' },
      title: { zh: 'Rolex Monterey Motorsports Reunion · 周四', en: 'Rolex Monterey Motorsports Reunion · Thursday' }, location: { zh: 'WeatherTech Raceway Laguna Seca', en: 'WeatherTech Raceway Laguna Seca' },
      summary: { zh: '较便宜的排位与练习日，含 paddock、普通停车及 Turn 4 / 11 看台。', en: 'The lower-cost qualifying-heavy day, including paddock, general parking and Turn 4/11 grandstands.' },
      why: { zh: '适合预算受限又想进赛道的人；若只能去一天，周五的比赛与展示更完整。', en: 'Useful for a budget track visit, but Friday is the stronger single-day balance of racing and exhibitions.' },
      access: { zh: '大型活动走 South Boundary Road。普通停车已含；过夜停车禁止。', en: 'Major-event access is via South Boundary Road. General parking is included; overnight parking is prohibited.' },
      price: { zh: '$108.62 含费用', en: '$108.62 all-in' }, tags: ['paid', 'subjectTag'], categories: ['paid'], score: '3.0',
      source: 'https://weathertechraceway.com/pages/rolex-monterey-motorsports-reunion'
    },
    {
      id: 'gooding-thu', thumbId: 'gooding-thu', area: 'pebble', date: '2026-08-13', time: '09:00–18:00', timeNote: { zh: '预展', en: 'preview' },
      title: { zh: 'Gooding Christie’s Pebble Beach Auctions', en: 'Gooding Christie’s Pebble Beach Auctions' }, location: { zh: 'Parc du Concours · Pebble Beach', en: 'Parc du Concours · Pebble Beach' },
      summary: { zh: '$50 入场覆盖本页周四至周六的预展与拍卖。', en: '$50 admission covers the Thursday-through-Saturday viewing and auctions in this guide.' },
      why: { zh: '不买 $650 主展票也能近看顶级收藏车，多日有效使它成为最划算的付费附加项之一。', en: 'One of the best paid add-ons for close access to top collector cars without buying the $650 Sunday ticket.' },
      access: { zh: '信用卡购票；12 岁以下免费。访客从 Forest Lake Road 进入 Lot 12 停车；满位后启用 Alva Lane 的 Lot 8。', en: 'Credit-card admission; under 12 free. Visitor parking is in Lot 12 via Forest Lake Road; Lot 8 on Alva Lane opens if it fills.' },
      price: { zh: '$50 全活动入场', en: '$50 all-events admission' }, tags: ['paid'], categories: ['essential', 'paid'], score: '4.5',
      source: 'https://www.goodingco.com/auction/pebble-beach-auctions-2026/'
    },
    {
      id: 'mecum-thu', thumbId: 'mecum-thu', area: 'monterey', date: '2026-08-13', time: '08:00–', timeNote: { zh: '08:00 入场 · 09:00 艺术品 · 10:00 整车拍卖', en: 'gates 08:00 · Road Art 09:00 · cars 10:00' },
      title: { zh: 'Mecum Monterey', en: 'Mecum Monterey' }, location: { zh: 'Hyatt Regency / Del Monte Golf Course · 1 Old Golf Course Rd', en: 'Hyatt Regency / Del Monte Golf Course · 1 Old Golf Course Rd' },
      summary: { zh: '约 600 辆汽车 + 约 100 辆摩托车；8:00 开门，周四 10:00 开拍。白天户外拍卖，公众友好。', en: 'Roughly 600 cars and ~100 motorcycles; gates at 8:00, bidding from 10:00 Thursday. Daytime outdoor auction—visitor-friendly.' },
      why: { zh: '整周最亲民的大型整车拍卖之一：白天、户外、票价低于多数夜场；适合首次体验拍卖或想多看肌肉车/美式经典的人。', en: 'One of the week’s most visitor-friendly major car auctions—daytime, outdoor and cheaper than most evening sales; ideal for a first auction or muscle/American classics.' },
      access: { zh: 'Del Monte 高尔夫球场帐篷区；12 岁及以下免费。网上预购可能有折扣，出发前重查 Mecum 票务页。', en: 'Tent campus at Del Monte Golf Course; ages ≤12 free. Online advance purchase may discount—recheck Mecum tickets before travel.' },
      price: { zh: '$30/日 · $75/三日 · ≤12 岁免费', en: '$30/day · $75/3-day · ages ≤12 free' }, tags: ['paid'], categories: ['essential', 'paid'], score: '4.5',
      sources: [
        { url: 'https://www.mecum.com/auctions/monterey-2026/', label: { zh: 'Mecum Monterey 2026 ↗', en: 'Mecum Monterey 2026 ↗' } },
        { url: 'https://www.mecum.com/tickets/', label: { zh: 'Mecum 票务 ↗', en: 'Mecum tickets ↗' } },
        { url: 'https://whatsupmonterey.com/events/monterey-car-week/mecum-auto-auctions-muscle-cars-more/447', label: { zh: 'What’s Up Monterey · 票价 ↗', en: 'What’s Up Monterey · pricing ↗' } }
      ]
    },
    {
      id: 'bonhams', thumbId: 'bonhams', area: 'laguna', date: '2026-08-13', time: '10:00–', timeNote: { zh: '拍卖', en: 'auction' },
      title: { zh: 'Bonhams · The Laguna Seca Auction', en: 'Bonhams · The Laguna Seca Auction' }, location: { zh: 'Bonhams Marquee · Laguna Seca Lakebed · WeatherTech Raceway', en: 'Bonhams Marquee · Laguna Seca Lakebed · WeatherTech Raceway' },
      summary: { zh: '周四 10:00 拍卖；周二 9–18 免费公开预展，周三/周四上午需 Reunion 门票。', en: 'Auction Thursday 10:00; Tuesday 9–18 free public preview, while Wed/Thu morning viewing requires Reunion tickets.' },
      why: { zh: '若能周二免费看预展，性价比极高；周四拍卖与 RMMR 同日，需提前规划赛道门票与转场。', en: 'Tuesday’s free preview is excellent value; Thursday’s sale overlaps RMMR—plan track tickets and transfer time.' },
      access: { zh: 'Lakebed 大帐篷；8 月 8–9 Pre-Reunion 期间 paddock 也可远观。周三/周四上午预展需有效 Reunion 通行证。', en: 'Lakebed marquee; paddock views possible during Aug 8–9 Pre-Reunion. Wed/Thu morning preview requires a valid Reunion pass.' },
      price: { zh: '周二预展免费 · 拍卖/其余预展需 Reunion 票', en: 'Tue preview free · auction/other preview needs Reunion pass' }, tags: ['paid'], categories: ['paid'], score: '4.0',
      source: 'https://cars.bonhams.com/auction/31959/the-laguna-seca-auction'
    },
    {
      id: 'forum-thu', thumbId: 'forum-thu', area: 'pebble', date: '2026-08-13', time: '12:00 / 14:00 / 16:00', timeNote: { zh: '需提前注册', en: 'advance registration' },
      title: { zh: 'Pebble Beach Classic Car Forum', en: 'Pebble Beach Classic Car Forum' }, location: { zh: 'Concours Village', en: 'Concours Village' },
      summary: { zh: '周四三场各 $25；截至核对时均显示可购。', en: 'Three Thursday sessions at $25 each; all showed availability when checked.' },
      why: { zh: '题目合兴趣时，是 Tour 或 Village 后的高质量低成本补充。', en: 'A strong low-cost add-on after the Tour or Village when the subject fits.' },
      access: { zh: '必须提前注册；票价与余票会变化，购买前重查官方票务页。', en: 'Advance registration is required. Price and inventory can change; recheck the official store before buying.' },
      price: { zh: '每场 $25', en: '$25 each' }, tags: ['paid'], categories: ['paid'], score: '4.0',
      source: 'https://theconcoursstore.com/collections/forums'
    },
    {
      id: 'rm-thu', thumbId: 'rm-thu', area: 'monterey', date: '2026-08-13', time: '10:00–16:00 / 18:00', timeNote: { zh: '公众预展 / 拍卖', en: 'public preview / auction' },
      title: { zh: 'RM Sotheby’s · The Monterey Auction', en: 'RM Sotheby’s · The Monterey Auction' }, location: { zh: 'Monterey Conference Center · 1 Portola Plaza', en: 'Monterey Conference Center · 1 Portola Plaza' },
      summary: { zh: '周四公众预展 10:00–16:00，18:00 开拍；$60 周末公众预展入场不包含拍卖席。', en: 'Thursday public preview runs 10:00–16:00, with the auction at 18:00; $60 weekend public-preview admission does not include the auction floor.' },
      why: { zh: '普通观众应把白天预展作为主体验；未注册竞拍人可在线观看夜场。', en: 'General visitors should treat the daytime preview as the main experience; unregistered visitors can watch the evening sale online.' },
      access: { zh: '预展入场 $60/人，在广场入口现场购买。拍卖厅仅限注册竞拍人、委托方与合格媒体。', en: 'Public-preview admission is $60 per person, sold onsite at the plaza entrance. The auction floor is limited to registered bidders, consignors and qualified media.' },
      price: { zh: '周末公众预展 $60（现场）· 不含拍卖席', en: '$60 weekend public preview (onsite) · auction floor excluded' }, tags: ['paid'], categories: ['paid'], score: '3.5',
      source: 'https://www.rmsothebys.com/auctions/mo26/'
    },
    {
      id: 'werks', thumbId: 'werks', area: 'monterey', date: '2026-08-14', time: '09:00–15:00', timeNote: { zh: '7:00 车辆签到', en: '7:00 car check-in' },
      title: { zh: 'Werks Reunion Monterey', en: 'Werks Reunion Monterey' }, location: { zh: 'Monterey Pines Golf Course', en: 'Monterey Pines Golf Course' },
      summary: { zh: '保时捷俱乐部大聚会；9:30–12:00 评审，14:00–15:00 颁奖。车辆报名已关闭，Corral 与 Judged 车位均已售罄。', en: 'The major Porsche gathering; judging runs 9:30–12:00 and awards 14:00–15:00. Vehicle registration is closed, with both Corral and Judged spots sold out.' },
      why: { zh: '保时捷车迷 5/5，普通观众也有 4.5/5；周五最强的免费主场。', en: 'A 5/5 for Porsche fans and 4.5/5 generally—the strongest free Friday anchor.' },
      access: { zh: '观众停车每车 $40、摩托 $20，只收现金且现场无 ATM；观众入场仍免费，售罄仅指参展车位。', en: 'Spectator parking is $40 per car or $20 per motorcycle, cash only, with no onsite ATM. Spectator admission remains free; sold-out status applies only to display-car spots.' },
      price: { zh: '观众免费 · 停车 $40 现金 · 参展车位已售罄', en: 'Spectators free · $40 cash parking · display spots sold out' }, tags: ['free', 'soldOutTag'], categories: ['essential', 'free'], score: '4.5',
      source: 'https://www.werksreunion.com/monterey.cfm'
    },
    {
      id: 'paddock', thumbId: 'paddock', area: 'seaside', date: '2026-08-14', time: '15:00–20:00', timeNote: { zh: '周五下午至傍晚', en: 'Friday afternoon–evening' },
      title: { zh: 'The Paddock Monterey', en: 'The Paddock Monterey' }, location: { zh: 'Bayonet Black Horse · Seaside', en: 'Bayonet Black Horse · Seaside' },
      summary: { zh: '杂糅“车展中的车展”：经典、改装与趣味车同场，设于 Seaside 高尔夫球场。', en: 'An eclectic “show of shows”—classics, customs and character cars on a Seaside golf course.' },
      why: { zh: 'Werks / Reunion 之后的周五收尾选项；与 The Quail 同日冲突。观众 GA $100（含费约 $105），≤13 岁随付费成人免费。', en: 'A Friday wrap after Werks/Reunion; same-day conflict with The Quail. Spectator GA $100 (~$105 with fees); ages ≤13 free with a paying adult.' },
      access: { zh: 'Bayonet Black Horse Golf Course（1 McClure Way）；TicketSpice / RegFox 购票，出发前重查 VIP 与展车票种。', en: 'Bayonet Black Horse Golf Course (1 McClure Way); buy via TicketSpice/RegFox and recheck VIP vs display options before travel.' },
      price: { zh: 'GA $100（含费约 $104.78）', en: 'GA $100 (~$104.78 with fees)' }, tags: ['paid'], categories: ['paid'], score: '3.5',
      sources: [
        { url: 'https://concorso.ticketspice.com/international-car-week', label: { zh: 'TicketSpice 购票 ↗', en: 'TicketSpice tickets ↗' } },
        { url: 'https://concorso.regfox.com/the-paddock-monterey-2026', label: { zh: 'RegFox 活动页 ↗', en: 'RegFox event page ↗' } }
      ]
    },
    {
      id: 'rmmr-fri', thumbId: 'rmmr-fri', area: 'laguna', date: '2026-08-14', time: '08:00–18:35', timeNote: { zh: '比赛 + 展示', en: 'races + exhibitions' },
      title: { zh: 'Rolex Monterey Motorsports Reunion · 周五', en: 'Rolex Monterey Motorsports Reunion · Friday' }, location: { zh: 'WeatherTech Raceway Laguna Seca', en: 'WeatherTech Raceway Laguna Seca' },
      summary: { zh: '正赛到约 17:25，随后还有 IndyCar、JDM 与 hypercar 等车迷展示时段。', en: 'Racing runs to about 17:25, followed by fan exhibitions including IndyCar, JDM and hypercars.' },
      why: { zh: '如果只去一天赛道，周五是价格、比赛密度和特别展示的最佳平衡。', en: 'The best one-day balance of price, race density and special exhibitions.' },
      access: { zh: '把全天都留给 Laguna Seca；门票含普通停车、paddock 与指定看台。', en: 'Give Laguna Seca the full day. Admission includes general parking, paddock and designated grandstands.' },
      price: { zh: '$139.67 含费用', en: '$139.67 all-in' }, tags: ['paid', 'subjectTag'], categories: ['essential', 'paid'], score: '5.0',
      source: 'https://weathertechraceway.com/pages/rolex-monterey-motorsports-reunion'
    },
    {
      id: 'village-fri', thumbId: 'village-fri', area: 'pebble', date: '2026-08-14', time: '09:00–18:00', timeNote: { zh: '品牌展与市集', en: 'displays & market' },
      title: { zh: 'Concours Village + RetroAuto', en: 'Concours Village + RetroAuto' }, location: { zh: 'Pebble Beach', en: 'Pebble Beach' },
      summary: { zh: '继续开放的免费展区；适合不去赛道、希望把 Werks 与 Pebble Beach 组合的人。', en: 'The free hub stays open—useful if skipping the track and pairing Werks with Pebble Beach.' },
      why: { zh: '稳定、免费，但从 Werks 转场要留足停车与接驳时间；不要再叠加 The Quail。', en: 'Reliable and free, but allow for parking and shuttles after Werks; do not also cram in The Quail.' },
      access: { zh: '17-Mile Drive 仍对无关交通关闭；按活动标识或使用 Village 网约车点。', en: '17-Mile Drive remains closed to unrelated traffic; follow event signs or use the Village rideshare node.' },
      price: { zh: '免费', en: 'Free' }, tags: ['free'], categories: ['free'], score: '4.5',
      source: 'https://www.pebblebeachconcours.net/events/concours-village/'
    },
    {
      id: 'forum-fri', thumbId: 'forum-fri', area: 'pebble', date: '2026-08-14', time: '11:30 / 14:00', timeNote: { zh: '需提前注册', en: 'advance registration' },
      title: { zh: 'Pebble Beach Classic Car Forum', en: 'Pebble Beach Classic Car Forum' }, location: { zh: 'Concours Village', en: 'Concours Village' },
      summary: { zh: '周五 11:30 场次 $25 尚可购；14:00 的 $100 场次截至核对时已售罄。', en: 'Friday 11:30 was available at $25; the 14:00 $100 session was sold out when checked.' },
      why: { zh: '题目合兴趣时，$25 场次是高质量低成本补充；不要为了 Forum 单独跨半岛。', en: 'A strong low-cost add-on when the topic fits, but not worth a cross-peninsula trip by itself.' },
      access: { zh: '必须提前注册；售罄状态会变化，购买前重查官方票务页。', en: 'Advance registration is required. Sold-out status can change; recheck the official store before buying.' },
      price: { zh: '$25–100 · 部分售罄', en: '$25–100 · some sold out' }, tags: ['paid', 'soldOutTag'], categories: ['paid'], score: '4.0',
      source: 'https://theconcoursstore.com/collections/forums'
    },
    {
      id: 'gooding-fri', thumbId: 'gooding-fri', area: 'pebble', date: '2026-08-14', time: '09:00–21:00', timeNote: { zh: '16:00 拍卖', en: '16:00 auction' },
      title: { zh: 'Gooding Christie’s Pebble Beach Auctions', en: 'Gooding Christie’s Pebble Beach Auctions' }, location: { zh: 'Parc du Concours · Pebble Beach', en: 'Parc du Concours · Pebble Beach' },
      summary: { zh: '全天预展，16:00 开拍；周四购买的 $50 通票同样有效。', en: 'Viewing runs all day and the auction starts at 16:00; Thursday’s $50 pass remains valid.' },
      why: { zh: '在 Village 行程中加入顶级收藏车的低摩擦方式，也是周五傍晚的优质选择。', en: 'A low-friction way to add top collector cars to a Village visit, with a strong late-Friday window.' },
      access: { zh: '访客首先从 Forest Lake Road 进入 Lot 12，满位后用 Lot 8；周五 15:00 后可经 Lot 8 前往 Driving Range 停车。', en: 'Start with visitor Lot 12 via Forest Lake Road, then Lot 8 if full. On Friday after 15:00, the Driving Range is also accessible through Lot 8.' },
      price: { zh: '$50 全活动入场', en: '$50 all-events admission' }, tags: ['paid'], categories: ['essential', 'paid'], score: '4.5',
      source: 'https://www.goodingco.com/auction/pebble-beach-auctions-2026/'
    },
    {
      id: 'mecum-fri', thumbId: 'mecum-fri', area: 'monterey', date: '2026-08-14', time: '08:00–', timeNote: { zh: '08:00 入场 · 09:00 艺术品 · 10:00 整车拍卖', en: 'gates 08:00 · Road Art 09:00 · cars 10:00' },
      title: { zh: 'Mecum Monterey', en: 'Mecum Monterey' }, location: { zh: 'Hyatt Regency / Del Monte Golf Course · 1 Old Golf Course Rd', en: 'Hyatt Regency / Del Monte Golf Course · 1 Old Golf Course Rd' },
      summary: { zh: '周五 8:00 入场、9:00 Road Art、10:00 整车开拍；与 Werks、Laguna Seca、The Quail 同日，需选一个主场或只留半天。', en: 'Friday gates open at 8:00, Road Art starts at 9:00 and collector cars at 10:00; it shares the day with Werks, Laguna Seca and The Quail, so choose one anchor or budget half a day.' },
      why: { zh: '若周五不去赛道或 Quail，Mecum 是白天看整车拍卖的最佳替代；三日票 $75 若周四已入场则继续有效。', en: 'If skipping the track or Quail on Friday, Mecum is the best daytime car-auction alternative; a $75 3-day pass remains valid if you entered Thursday.' },
      access: { zh: '8:00 开门；12 岁及以下免费。网上预购可能有折扣。', en: 'Gates at 8:00; ages ≤12 free. Online advance purchase may discount.' },
      price: { zh: '$30/日 · $75/三日 · ≤12 岁免费', en: '$30/day · $75/3-day · ages ≤12 free' }, tags: ['paid'], categories: ['essential', 'paid'], score: '4.5',
      sources: [
        { url: 'https://www.mecum.com/auctions/monterey-2026/', label: { zh: 'Mecum Monterey 2026 ↗', en: 'Mecum Monterey 2026 ↗' } },
        { url: 'https://www.mecum.com/tickets/', label: { zh: 'Mecum 票务 ↗', en: 'Mecum tickets ↗' } },
        { url: 'https://whatsupmonterey.com/events/monterey-car-week/mecum-auto-auctions-muscle-cars-more/447', label: { zh: 'What’s Up Monterey · 票价 ↗', en: 'What’s Up Monterey · pricing ↗' } }
      ]
    },
    {
      id: 'quail', thumbId: 'quail', area: 'carmelvalley', date: '2026-08-14', time: '09:00–16:00', timeNote: { zh: '官方时段', en: 'official hours' },
      title: { zh: 'The Quail, A Motorsports Gathering', en: 'The Quail, A Motorsports Gathering' }, location: { zh: 'The Quail Golf Club · Carmel Valley', en: 'The Quail Golf Club · Carmel Valley' },
      summary: { zh: '高端发布与款待型聚会；授权票务页目前显示 Coming Soon，未公布 2026 公共价格。', en: 'A premium launch-and-hospitality gathering. The authorized ticket page currently says Coming Soon with no 2026 public price.' },
      why: { zh: '只适合把豪华品牌发布与餐饮体验放在首位的人；在价格和库存公布前不能当作确定行程。', en: 'Only prioritize if luxury launches and hospitality are central; it cannot be treated as a confirmed plan before price and inventory appear.' },
      access: { zh: '当前官方页面尚未给出公众停车规则，授权票务页也未公布价格；不要使用历史票价推断。', en: 'Current official pages do not give public parking rules, and the authorized seller has not posted a price. Do not infer from historical prices.' },
      price: { zh: '价格与公开库存待公布', en: 'Price and public inventory pending' }, tags: ['unknownTag'], categories: ['paid'], score: '3.0',
      sources: [
        { url: 'https://www.peninsula.com/en/signature-events/events/motorsports', label: { zh: '主办方：时段与活动信息 ↗', en: 'Organizer: hours and event details ↗' } },
        { url: 'https://www.axs.com/events/1281731/the-quail-a-motorsports-gathering-2026-tickets', label: { zh: '授权票务：价格待公布 ↗', en: 'Authorized seller: price pending ↗' } }
      ]
    },
    {
      id: 'broad-arrow', thumbId: 'broad-arrow', area: 'carmelvalley', date: '2026-08-14', time: '11:00–', timeNote: { zh: '周五场；周四另有 14:00 场', en: 'Friday session; also Thu 14:00' },
      title: { zh: 'Broad Arrow · The Quail Auction', en: 'Broad Arrow · The Quail Auction' }, location: { zh: 'The Quail Golf Club · Carmel Valley', en: 'The Quail Golf Club · Carmel Valley' },
      summary: { zh: 'The Quail 官方合作拍卖：周四 14:00、周五 11:00。预展免费（周三 9–17、周四 9–14、周五 9–11）。', en: 'Official Quail-partner auction: Thu 14:00 and Fri 11:00. Free public preview Wed 9–17, Thu 9–14, Fri 9–11.' },
      why: { zh: '想看拍卖又不想付 Gooding $50 入场时，预展免费是强替代；现场竞拍注册 $300（含双人入场+号牌+图录）。与 The Quail 主会同址冲突。', en: 'Free preview is a strong alternative to Gooding’s $50 gate; in-person bidder registration is $300 (two admissions, paddle, catalog). Same-campus conflict with The Quail gathering.' },
      access: { zh: '预展对公众免费；拍卖席位优先委托方/注册竞拍人/媒体，开拍约 1 小时后可能对其他观众开放。电话/缺席/网络竞拍免费注册。Motorlux 持票含竞拍注册权益。', en: 'Preview is free to the public; auction seating prioritizes consignors, registered bidders and media, then may open ~1 hour after each session starts. Phone/absentee/internet bidding registration is complimentary. Motorlux tickets include bidder registration.' },
      price: { zh: '预展免费 · 现场竞拍注册 $300', en: 'Preview free · in-person bidder reg. $300' }, tags: ['paid'], categories: ['paid'], score: '4.0',
      sources: [
        { url: 'https://bid.broadarrowauctions.com/auctions/1-CQGJK8/the-quail-auction-2026', label: { zh: '在线图录 / 竞拍 ↗', en: 'Online catalog / bidding ↗' } },
        { url: 'https://www.broadarrowauctions.com/events/event/The%20Quail%20Auction%202026', label: { zh: 'Broad Arrow 活动页 ↗', en: 'Broad Arrow event page ↗' } },
        { url: 'https://motorlux.com/tickets/', label: { zh: 'Motorlux 票页（竞拍权益）↗', en: 'Motorlux tickets (bidder perk) ↗' } }
      ]
    },
    {
      id: 'pg-rally', thumbId: 'pg-rally', area: 'pacificgrove', date: '2026-08-14', time: '10:00–14:00+', timeNote: { zh: '14:00 发车', en: '14:00 departure' },
      title: { zh: 'Pacific Grove Concours Auto Rally', en: 'Pacific Grove Concours Auto Rally' }, location: { zh: 'Forest Ave × Lighthouse Ave', en: 'Forest Ave at Lighthouse Ave' },
      summary: { zh: '参赛车 10:00 起在 Lighthouse Ave 集结；观众可从 10:00 起观看，14:00 发车巡游。', en: 'Entrants stage from 10:00 along Lighthouse Ave; spectators can view from 10:00, with rally departure at 14:00.' },
      why: { zh: '轻松、观众免费；适合 Werks 后的下午视觉收尾（不是傍晚 17:00 场）。', en: 'Relaxed and free for spectators—a Friday afternoon visual wrap after Werks (not a 17:00 evening start).' },
      access: { zh: 'Forest Ave × Lighthouse Ave；主办方尚未发布专用观众停车方案，给市区找车位留时间。', en: 'Forest Ave at Lighthouse Ave; no dedicated spectator parking plan is posted—allow extra time downtown.' },
      price: { zh: '观众免费', en: 'Spectators free' }, tags: ['free'], categories: ['free'], score: '4.0',
      source: 'https://pgrotary.org/annual-pacific-grove-concours-auto-rally/event-registration-schedule/'
    },
    {
      id: 'rm-fri', thumbId: 'rm-fri', area: 'monterey', date: '2026-08-14', time: '10:00–16:00 / 17:30', timeNote: { zh: '公众预展 / 拍卖', en: 'public preview / auction' },
      title: { zh: 'RM Sotheby’s · The Monterey Auction', en: 'RM Sotheby’s · The Monterey Auction' }, location: { zh: 'Monterey Conference Center · 1 Portola Plaza', en: 'Monterey Conference Center · 1 Portola Plaza' },
      summary: { zh: '周五公众预展 10:00–16:00，17:30 开拍；$60 周末公众预展入场不包含拍卖席。', en: 'Friday public preview runs 10:00–16:00, with the auction at 17:30; $60 weekend public-preview admission does not include the auction floor.' },
      why: { zh: '若白天已选 Werks、Quail 或赛道，不必为受限夜场折返；普通观众可另日看预展或在线观看。', en: 'If daytime is committed to Werks, The Quail or the track, do not double back for a restricted floor; general visitors can preview another day or watch online.' },
      access: { zh: '预展入场 $60/人，在广场入口现场购买。拍卖厅仅限注册竞拍人、委托方与合格媒体。', en: 'Public-preview admission is $60 per person, sold onsite at the plaza entrance. The auction floor is limited to registered bidders, consignors and qualified media.' },
      price: { zh: '周末公众预展 $60（现场）· 不含拍卖席', en: '$60 weekend public preview (onsite) · auction floor excluded' }, tags: ['paid'], categories: ['paid'], score: '3.5',
      source: 'https://www.rmsothebys.com/auctions/mo26/'
    },
    {
      id: 'lemons', thumbId: 'lemons', area: 'seaside', date: '2026-08-15', time: '08:00–13:30', timeNote: { zh: '官方票务时段', en: 'official ticketed hours' },
      title: { zh: 'Concours d’Lemons', en: 'Concours d’Lemons' }, location: { zh: 'Seaside City Hall', en: 'Seaside City Hall' },
      summary: { zh: '用幽默对冲顶级车展的“烂车”评选；官方 2026 票务页确认观众免费，8:00–13:30。', en: 'A comic antidote to elite concours culture; the official 2026 ticket page confirms free spectator admission from 8:00–13:30.' },
      why: { zh: '最亲民、最有记忆点的周六早晨，也能自然接上 Exotics on Broadway。', en: 'The funniest, most accessible Saturday morning and a natural lead-in to Exotics on Broadway.' },
      access: { zh: 'Seaside City Hall · 440 Harcourt Ave；观众免费，临行前仍请复核停车安排。', en: 'Seaside City Hall, 440 Harcourt Ave; spectators are free. Recheck parking arrangements before departure.' },
      price: { zh: '观众免费', en: 'Spectators free' }, tags: ['free'], categories: ['essential', 'free'], score: '5.0',
      sources: [
        { url: 'https://24hoursoflemons.com/concours-d-lemons/', label: { zh: '主办方：免费入场 ↗', en: 'Organizer: free admission ↗' } },
        { url: 'https://www.eventbrite.com/e/2026-concours-dlemons-ca-tickets-1980210018471', label: { zh: '官方票务：2026 时段与地址 ↗', en: 'Official tickets: 2026 hours and address ↗' } }
      ]
    },
    {
      id: 'cars-coffee', thumbId: 'cars-coffee', area: 'seaside', date: '2026-08-15', time: '07:00–09:30', timeNote: { zh: 'DMO 所列时段', en: 'hours per DMO listing' },
      title: { zh: 'Peninsula Cars & Coffee', en: 'Peninsula Cars & Coffee' }, location: { zh: 'Chili’s 停车场 · Seaside', en: 'Chili’s parking lot · Seaside' },
      summary: { zh: '周六清晨非正式车友聚会；See Monterey 收录，未见独立 2026 主办方页。', en: 'Informal Saturday-morning cars-and-coffee meet listed by See Monterey; no dedicated 2026 organizer page found.' },
      why: { zh: '去 Lemons / Exotics 之前的零成本热身；时段可能漂移，当作可选早场而非硬锚点。', en: 'A zero-cost warm-up before Lemons/Exotics—treat hours as soft and recheck locally.' },
      access: { zh: '1349 Canyon Del Rey Blvd 停车场；早到，遵守商家与现场指示。', en: 'Parking lot at 1349 Canyon Del Rey Blvd; arrive early and follow onsite/merchant rules.' },
      price: { zh: '免费', en: 'Free' }, tags: ['free', 'subjectTag'], categories: ['free'], score: '3.0',
      source: 'https://www.seemonterey.com/event/peninsula-cars-coffee/'
    },
    {
      id: 'barnyard-ferrari', thumbId: 'barnyard-ferrari', area: 'carmel', date: '2026-08-15', time: '16:00–19:00', timeNote: { zh: '品酒接待', en: 'wine reception' },
      title: { zh: 'Ferrari Event at The Barnyard', en: 'Ferrari Event at The Barnyard' }, location: { zh: 'The Barnyard · Carmel', en: 'The Barnyard · Carmel' },
      summary: { zh: '第 28 届 Barnyard 法拉利慈善展，受益 Big Sur Food & Wine Foundation。', en: '28th annual Barnyard Ferrari charity exhibition benefiting the Big Sur Food & Wine Foundation.' },
      why: { zh: '周六下午意式车氛围、票价低于 Concorso；与 Exotics / Concorso / MMF 冲突，只适合法拉利主题专程。', en: 'Italian-car Saturday afternoon below Concorso pricing—but it conflicts with Exotics/Concorso/MMF, so only if Ferrari is the draw.' },
      access: { zh: 'The Barnyard Shopping Village（3663 The Barnyard）；16+ GA，≤15 免费；品酒 21+。预售票当前可购，现场票更贵。', en: 'The Barnyard Shopping Village (3663 The Barnyard); GA ages 16+, ≤15 free; wine tastings 21+. Advance tickets are currently in stock; day-of gate admission costs more.' },
      price: { zh: '预售 GA $85.81 含费用 · 现场 $107.01 含费用', en: 'Advance GA $85.81 all-in · day-of $107.01 all-in' }, tags: ['paid'], categories: ['paid'], score: '3.5',
      sources: [
        { url: 'https://www.bigsurfoodandwine.org/popup-events/28th-annual-ferrari-event-at-the-barnyard', label: { zh: '主办方活动页 ↗', en: 'Organizer event page ↗' } },
        { url: 'https://bsfw.ticketsauce.com/e/ferrari-event-at-the-barnyard-6/tickets', label: { zh: '购票 ↗', en: 'Tickets ↗' } }
      ]
    },
    {
      id: 'exotics', thumbId: 'exotics', area: 'seaside', date: '2026-08-15', time: '11:00–16:00', timeNote: { zh: '周六 · 总活动时段', en: 'Saturday · overall event hours' },
      title: { zh: 'Exotics on Broadway', en: 'Exotics on Broadway' }, location: { zh: 'Broadway Ave / Del Monte Blvd · Seaside', en: 'Broadway Ave / Del Monte Blvd · Seaside' },
      summary: { zh: 'Broadway Ave 公共车展区免费；Del Monte Blvd 的围合 Vendor & Hypercar Showcase 需另购 GA。$40 不是整个活动的门票。', en: 'The public car show on Broadway Ave is free; the enclosed Vendor & Hypercar Showcase on Del Monte Blvd requires separate GA. The $40 price is not admission to the whole event.' },
      why: { zh: '免费区 5/5，付费区 3/5；预算路线可不购票。主办方标示 GA 早鸟基础价 $40，Eventbrite 当前购买页显示起价 $44.52。', en: 'The free zone is 5/5 and the paid enclosure 3/5; the value route needs no paid-zone ticket. The organizer advertises $40 early-bird base GA, while Eventbrite currently displays purchase prices from $44.52.' },
      access: { zh: '活动页面定位 1601 Broadway Ave。General Jim Moore Blvd × Eucalyptus Rd 设免费远端停车与接驳，9:00–17:00。12 岁以下儿童由持票成人陪同可免费进入收费区；票不退款、现场票有限。同一出行页下方 FAQ 仍残留 Fremont 字样；分区以票务页和出行页顶部的 Del Monte 新版说明为准。', en: 'The listing address is 1601 Broadway Ave. Free remote parking and shuttle run at General Jim Moore Blvd/Eucalyptus Rd, 9:00–17:00. Children under 12 enter the paid zone free with a ticketed adult; tickets are nonrefundable and onsite inventory is limited. A lower FAQ on the same visitor page still says Fremont; use the newer Del Monte wording on the ticket page and at the top of the visitor page.' },
      price: { zh: 'Broadway 免费 · Del Monte GA 基础价 $40（购买页起 $44.52）', en: 'Broadway free · Del Monte GA $40 base (purchase page from $44.52)' }, tags: ['mixedTag'], categories: ['essential', 'free', 'paid'], score: '5.0', verifiedOn: '2026-08-13',
      sources: [
        { url: 'https://exoticsonbroadway.com/', label: { zh: '活动主页：周六 11:00–16:00 ↗', en: 'Event home: Saturday 11:00–16:00 ↗' } },
        { url: 'https://exoticsonbroadway.com/tickets/', label: { zh: '官方票务：免费 Broadway 与 Del Monte 付费区 ↗', en: 'Official tickets: free Broadway and paid Del Monte zones ↗' } },
        { url: 'https://www.eventbrite.com/e/exotics-on-broadway-tickets-1976498937528', label: { zh: '主办方链接售票页：当前购买价 ↗', en: 'Organizer-linked ticketing: current purchase price ↗' } },
        { url: 'https://exoticsonbroadway.com/knowbeforeyougo/', label: { zh: '官方出行页：停车与接驳（场地旧文案）↗', en: 'Official visitor page: parking and shuttle (stale venue copy) ↗' } }
      ]
    },
    {
      id: 'rmmr-sat', thumbId: 'rmmr-sat', area: 'laguna', date: '2026-08-15', time: '07:00–18:30', timeNote: { zh: '07:00 入场 · 08:00–18:30 赛程会调整', en: 'gates 07:00 · on-track 08:00–18:30 may change' },
      title: { zh: 'Rolex Monterey Motorsports Reunion · 周六', en: 'Rolex Monterey Motorsports Reunion · Saturday' }, location: { zh: 'WeatherTech Raceway Laguna Seca', en: 'WeatherTech Raceway Laguna Seca' },
      summary: { zh: '整日正赛，是赛车迷的主日，但会完全占用 Lemons、Exotics 与 Concorso 的时间。', en: 'A full race day for committed fans, but it consumes the same window as Lemons, Exotics and Concorso.' },
      why: { zh: '赛车迷 5/5；普通首次访客可用周五赛道 + 周六免费街展获得更多变化。', en: 'A 5/5 for race fans. First-timers may get more variety from Friday at the track and Saturday’s free street shows.' },
      access: { zh: '从 South Boundary Road 进入；门票含普通停车、paddock 与指定看台。', en: 'Enter via South Boundary Road; admission includes general parking, paddock and designated grandstands.' },
      price: { zh: '$181.07 含费用', en: '$181.07 all-in' }, tags: ['paid', 'subjectTag'], categories: ['paid'], score: '5.0',
      source: 'https://weathertechraceway.com/pages/rolex-monterey-motorsports-reunion'
    },
    {
      id: 'concorso', thumbId: 'concorso', area: 'seaside', date: '2026-08-15', time: '10:00–16:00', timeNote: { zh: '意大利车主题', en: 'Italian-car focus' },
      title: { zh: 'Concorso Italiano', en: 'Concorso Italiano' }, location: { zh: 'Bayonet Black Horse · Seaside', en: 'Bayonet Black Horse · Seaside' },
      summary: { zh: '大型意大利车聚会；普通票含停车、入场和纪念册。', en: 'The major Italian-car gathering; GA includes parking, admission and a collectible program.' },
      why: { zh: '意大利车爱好者 5/5，普通观众 3/5；票价高且与免费街展、Laguna Seca 完全冲突。', en: 'A 5/5 for Italian-car devotees and 3/5 generally; costly and in direct conflict with both free street shows and Laguna Seca.' },
      access: { zh: '主办方不同页面的儿童免费年龄存在冲突，本页不承诺儿童门槛；购买前复核。', en: 'Organizer pages conflict on the child-age cutoff, so this guide does not promise one; verify before buying.' },
      price: { zh: '$260.03 含费用', en: '$260.03 all-in' }, tags: ['paid'], categories: ['paid'], score: '3.0',
      source: 'https://www.internationalcarweek.com/faqs'
    },
    {
      id: 'village-sat', thumbId: 'village-sat', area: 'pebble', date: '2026-08-15', time: '09:00–18:00', timeNote: { zh: '品牌展与市集', en: 'displays & market' },
      title: { zh: 'Concours Village + RetroAuto', en: 'Concours Village + RetroAuto' }, location: { zh: 'Pebble Beach', en: 'Pebble Beach' },
      summary: { zh: '最后一个完整的免费试驾、品牌展与市集日。', en: 'The final full day for free drives, manufacturer displays and the marketplace.' },
      why: { zh: '若周四、周五没逛到，它是可靠补位；否则周六更值得探索 Seaside 或 Laguna Seca。', en: 'A reliable catch-up if missed earlier; otherwise Saturday is better used for Seaside or Laguna Seca.' },
      access: { zh: '试驾先到先得且会提前结束排队；进入 Pebble Beach 仍受活动交通规则管理。', en: 'Drives are first come and queues may close early; Pebble Beach access remains under event traffic controls.' },
      price: { zh: '免费', en: 'Free' }, tags: ['free'], categories: ['free'], score: '4.0',
      source: 'https://www.pebblebeachconcours.net/displays-and-ride-amp-drive-schedule/'
    },
    {
      id: 'gooding-sat', thumbId: 'gooding-sat', area: 'pebble', date: '2026-08-15', time: '09:00–17:00', timeNote: { zh: '11:00 拍卖', en: '11:00 auction' },
      title: { zh: 'Gooding Christie’s Pebble Beach Auctions', en: 'Gooding Christie’s Pebble Beach Auctions' }, location: { zh: 'Parc du Concours · Pebble Beach', en: 'Parc du Concours · Pebble Beach' },
      summary: { zh: '周六预展 09:00–17:00，现场拍卖 11:00 开始。普通入场标价 $50/人，可进入预展和拍卖场次。', en: 'Saturday viewing runs 09:00–17:00 and the live auction begins at 11:00. General admission is listed at $50 per person and includes access to the viewing and auction.' },
      why: { zh: '适合想近看收藏车并旁听拍卖的普通观众；$50 是参观入场，不等于竞买资格或保留座位。', en: 'A strong spectator option for viewing cars and observing the sale; the $50 admission does not confer bidding privileges or reserved seating.' },
      access: { zh: '只收信用卡；12 岁以下免费。竞买需另行注册（$200，含双人入场与两个保留座位，座位视供应）。访客从 Forest Lake Road 进入 Lot 12；满位后启用 Alva Lane 的 Lot 8。', en: 'Credit card only; children under 12 are free. Bidding requires separate $200 registration, including admission for two and two reserved seats subject to availability. Visitor parking is in Lot 12 via Forest Lake Road; Lot 8 on Alva Lane opens if it fills.' },
      price: { zh: 'GA $50 / 人 · 预展 + 拍卖旁听', en: '$50 GA / person · viewing + auction access' }, tags: ['paid'], categories: ['essential', 'paid'], score: '4.5', verifiedOn: '2026-08-13',
      sources: [
        { url: 'https://www.goodingco.com/auction/pebble-beach-auctions-2026/', label: { zh: '官方活动页：日程、入场与停车 ↗', en: 'Official event page: schedule, admission and parking ↗' } },
        { url: 'https://www.goodingco.com/register/', label: { zh: '官方竞买注册说明 ↗', en: 'Official bidder-registration details ↗' } }
      ]
    },
    {
      id: 'mecum-sat', thumbId: 'mecum-sat', area: 'monterey', date: '2026-08-15', time: '08:00–', timeNote: { zh: '08:00 入场 · 09:00 艺术品 · 10:00 整车拍卖', en: 'gates 08:00 · Road Art 09:00 · cars 10:00' },
      title: { zh: 'Mecum Monterey', en: 'Mecum Monterey' }, location: { zh: 'Hyatt Regency / Del Monte Golf Course · 1 Old Golf Course Rd', en: 'Hyatt Regency / Del Monte Golf Course · 1 Old Golf Course Rd' },
      summary: { zh: '周六 8:00 入场、9:00 Road Art、10:00 整车开拍；与 Lemons、Exotics、Laguna Seca 完全冲突。', en: 'Saturday’s final day opens at 8:00, with Road Art at 9:00 and collector cars at 10:00; it directly conflicts with Lemons, Exotics and Laguna Seca.' },
      why: { zh: '若周六主场在 Seaside 免费街展，不必专程折返；若已买三日票且想看肌肉车收尾，可当作下午备选。', en: 'Skip if Saturday’s anchor is free Seaside street shows; if you bought the 3-day pass and want a muscle-car finale, treat it as an afternoon backup.' },
      access: { zh: '8:00 开门；12 岁及以下免费。', en: 'Gates at 8:00; ages ≤12 free.' },
      price: { zh: '$30/日 · $75/三日 · ≤12 岁免费', en: '$30/day · $75/3-day · ages ≤12 free' }, tags: ['paid'], categories: ['essential', 'paid'], score: '4.5',
      sources: [
        { url: 'https://www.mecum.com/auctions/monterey-2026/', label: { zh: 'Mecum Monterey 2026 ↗', en: 'Mecum Monterey 2026 ↗' } },
        { url: 'https://www.mecum.com/tickets/', label: { zh: 'Mecum 票务 ↗', en: 'Mecum tickets ↗' } },
        { url: 'https://whatsupmonterey.com/events/monterey-car-week/mecum-auto-auctions-muscle-cars-more/447', label: { zh: 'What’s Up Monterey · 票价 ↗', en: 'What’s Up Monterey · pricing ↗' } }
      ]
    },
    {
      id: 'forum-sat', thumbId: 'forum-sat', area: 'pebble', date: '2026-08-15', time: '10:00 / 12:00 / 14:00', timeNote: { zh: '需提前注册', en: 'advance registration' },
      title: { zh: 'Pebble Beach Classic Car Forum', en: 'Pebble Beach Classic Car Forum' }, location: { zh: 'Concours Village', en: 'Concours Village' },
      summary: { zh: '10:00 的 $100 场截至核对时已售罄；12:00 的 $25 与 14:00 的 $50 场仍可购。', en: 'The 10:00 $100 session was sold out when checked; the 12:00 $25 and 14:00 $50 sessions remained available.' },
      why: { zh: '适合作为 Village / Gooding 路线中的定时内容，不适合从 Seaside 或赛道专程折返。', en: 'Useful as a timed element within a Village/Gooding route, but not worth doubling back from Seaside or the track.' },
      access: { zh: '必须提前注册；售罄状态会变化，购买前重查官方票务页。', en: 'Advance registration is required. Sold-out status can change; recheck the official store before buying.' },
      price: { zh: '$25–100 · 部分售罄', en: '$25–100 · some sold out' }, tags: ['paid', 'soldOutTag'], categories: ['paid'], score: '4.0',
      source: 'https://theconcoursstore.com/collections/forums'
    },
    {
      id: 'mmf', thumbId: 'mmf', area: 'monterey', date: '2026-08-15', time: '17:00–23:00', timeNote: { zh: '停车信息有冲突', en: 'parking conflict' },
      title: { zh: 'Monterey Motorsports Festival', en: 'Monterey Motorsports Festival' }, location: { zh: 'Monterey County Fairgrounds', en: 'Monterey County Fairgrounds' },
      summary: { zh: '晚间展演型活动；主办方与授权票务当前均列 GA $175，主办方另注明 $5 结账费。', en: 'An evening festival; both the organizer and authorized seller currently list GA at $175, with the organizer noting a $5 checkout fee.' },
      why: { zh: '2.5/5 的可选夜场；除非演出内容特别对口，不优先于免费 Seaside 路线。', en: 'An optional 2.5/5 evening. Do not prioritize it over the free Seaside route unless the program is a specific draw.' },
      access: { zh: '当前官方停车页写 Gate 8 免费先到先得，Monterey Pines 为 overflow；价格与停车都应在购买和出发前复核。', en: 'The current organizer page says free first-come parking at Gate 8, with Monterey Pines as overflow. Recheck both price and parking before purchase and arrival.' },
      price: { zh: 'GA $175 + 结账费用', en: 'GA $175 + checkout fees' }, tags: ['paid', 'subjectTag'], categories: ['paid'], score: '2.5',
      sources: [
        { url: 'https://montereymotorsportsfestival.com/get-tickets/', label: { zh: '主办方票页：$175 + $5 ↗', en: 'Organizer tickets: $175 + $5 ↗' } },
        { url: 'https://montereymotorsportsfestival.saffire.com/p/tickets', label: { zh: '授权票务：GA $175 ↗', en: 'Authorized seller: GA $175 ↗' } },
        { url: 'https://montereymotorsportsfestival.com/general-info/', label: { zh: '主办方停车说明 ↗', en: 'Organizer parking information ↗' } }
      ]
    },
    {
      id: 'rm-sat', thumbId: 'rm-sat', area: 'monterey', date: '2026-08-15', time: '10:00–16:00 / 17:30', timeNote: { zh: '公众预展 / 汽车拍卖', en: 'public preview / automobile auction' },
      title: { zh: 'RM Sotheby’s · The Monterey Auction', en: 'RM Sotheby’s · The Monterey Auction' }, location: { zh: 'Monterey Conference Center · 1 Portola Plaza', en: 'Monterey Conference Center · 1 Portola Plaza' },
      summary: { zh: '周六公众预展 10:00–16:00；另有需单独 RSVP 的 Concierge 房地产拍卖 15:00–16:00；RM 汽车拍卖 17:30 开始。', en: 'Saturday public preview runs 10:00–16:00; a separate RSVP-only Concierge real-estate auction runs 15:00–16:00; the RM automobile auction begins at 17:30.' },
      why: { zh: '普通观众最适合白天预展；不要把 $60 误当作 17:30 汽车拍卖入场票。未注册竞拍人可在线观看晚场。', en: 'The daytime preview is the useful public option. Do not mistake the $60 admission for a ticket to the 17:30 automobile auction; unregistered visitors can watch the evening sale online.' },
      access: { zh: '周末公众预展入场 $60/人，只在广场入口现场购买；不含现场汽车拍卖。拍卖厅仅限注册竞拍人、合格媒体与委托方。Concierge 场次另行 RSVP。', en: 'Weekend public-preview admission is $60 per person, sold onsite at the plaza entrance; it does not include the live automobile auction. The auction floor is limited to registered bidders, qualified media and consignors. The Concierge sale requires a separate RSVP.' },
      price: { zh: '周末公众预展 $60（现场）· 不含拍卖席', en: '$60 weekend public preview (onsite) · auction floor excluded' }, tags: ['paid'], categories: ['paid'], score: '3.5', verifiedOn: '2026-08-13',
      sources: [
        { url: 'https://www.rmsothebys.com/auctions/mo26/', label: { zh: 'RM 官方日程与入场规则 ↗', en: 'Official RM schedule and admission rules ↗' } },
        { url: 'https://www.conciergeauctions.com/collection/monterey-car-week-rm-sothebys-1', label: { zh: 'Concierge 官方场次与 RSVP ↗', en: 'Official Concierge session and RSVP ↗' } }
      ]
    },
    {
      id: 'concours', thumbId: 'concours', area: 'pebble', date: '2026-08-16', time: '05:30–17:00', timeNote: { zh: '8:00 评审', en: '8:00 judging' },
      title: { zh: '75th Pebble Beach Concours d’Elegance', en: '75th Pebble Beach Concours d’Elegance' }, location: { zh: 'Pebble Beach Golf Links', en: 'Pebble Beach Golf Links' },
      summary: { zh: '5:30 开门，8:00 评审，13:30–17:00 颁奖；普通票 8 月 1 日后为 $650。', en: 'Gates at 5:30, judging at 8:00 and awards 13:30–17:00. GA is $650 after Aug 1.' },
      why: { zh: '历史、设计与评审爱好者的 5/5 一生一次体验，但单看性价比只有 2.5/5；周四 Tour 已能免费看到许多参展车。', en: 'A 5/5 bucket-list experience for history, design and judging devotees, but 2.5/5 on pure value; Thursday’s Tour shows many entrants for free.' },
      access: { zh: '普通票含指定停车与内部接驳；12 岁以下随付费成人免费。网约车在 Village 上下客。Carmel Plaza 另有 $40 全天 / $20 单程接驳，8:00–18:00。', en: 'GA includes assigned parking and internal shuttle; under 12 free with a paying adult. Rideshare uses Village. An independent Carmel Plaza shuttle runs 8:00–18:00 at $40 all-day/$20 one-way.' },
      price: { zh: 'GA $650 · Club $1,200', en: 'GA $650 · Club $1,200' }, tags: ['paid'], categories: ['essential', 'paid'], score: '5.0',
      source: 'https://www.pebblebeachconcours.net/event/pebble-beach-concours-delegance/'
    },
    {
      id: 'village-sun', thumbId: 'village-sun', area: 'pebble', date: '2026-08-16', time: '08:00–18:00', timeNote: { zh: '主展外免费', en: 'free outside show field' },
      title: { zh: 'Concours Village + RetroAuto · 周日', en: 'Concours Village + RetroAuto · Sunday' }, location: { zh: 'Pebble Beach', en: 'Pebble Beach' },
      summary: { zh: '不持主展票也可进入的免费品牌展与收藏品区。', en: 'Free manufacturer and collectibles areas accessible without a main-show ticket.' },
      why: { zh: '预算优先的周日选择，但它不含 Golf Links 主展场、评审或颁奖。', en: 'The value-first Sunday choice, but it does not include the Golf Links show field, judging or awards.' },
      access: { zh: 'Village 同时是官方网约车节点；不要假设免费区等于主展入场。', en: 'Village is also the official rideshare node. Do not confuse free-area access with Concours admission.' },
      price: { zh: '免费', en: 'Free' }, tags: ['free'], categories: ['free'], score: '4.5',
      source: 'https://www.pebblebeachconcours.net/events/concours-village/'
    },
    {
      id: 'cruise-in', thumbId: 'cruise-in', area: 'monterey', date: '2026-08-16', time: '13:00–16:00', timeNote: { zh: '主展后轻松场', en: 'post-Concours casual' },
      title: { zh: 'Car Week Cruise-In', en: 'Car Week Cruise-In' }, location: { zh: 'Monterey Touring Vehicles', en: 'Monterey Touring Vehicles' },
      summary: { zh: '第 4 届 Car Week Cruise-In（13:00–16:00）。展车登记收费：VIP 车库 $100（10 个）、Preferred 前场 $50、后场 $30；勿与“每月例行 cruise-in 免费”混淆。', en: '4th Annual Car Week Cruise-In (13:00–16:00). Show-car registration is paid: VIP garage $100 (10 spots), preferred front lot $50, backlot $30—do not confuse with MTV’s free monthly cruise-ins.' },
      why: { zh: '适合 Concours/Village 后想继续看车的人；若只是步行围观，DMO 标为免费，但带车参展必须付费登记。', en: 'A post-Concours/Village car stop; DMO lists spectator entry as free, but bringing a car requires paid registration.' },
      access: { zh: 'Monterey Touring Vehicles；展车需官方登记（含早到场与部分档位 T 恤）。步行观众规则以 MTV/See Monterey 临行前页为准。', en: 'Monterey Touring Vehicles; show cars require official registration (early load-in and T-shirt on some tiers). Recheck MTV/See Monterey for walk-up spectator rules before travel.' },
      price: { zh: '观众或免费 · 展车位 $30–$100', en: 'Spectators likely free · show-car spots $30–$100' }, tags: ['mixedTag'], categories: ['free', 'paid'], score: '3.5',
      sources: [
        { url: 'https://www.montereytouringvehicles.com/drive-monterey-road-rallies/', label: { zh: 'MTV 官方：展车登记价 ↗', en: 'MTV official: show-car registration prices ↗' } },
        { url: 'https://www.seemonterey.com/events/monterey-car-week/', label: { zh: 'See Monterey：观众标 Free ↗', en: 'See Monterey: listed Free for spectators ↗' } }
      ]
    },
    {
      id: 'stanton', thumbId: 'stanton', area: 'monterey', date: '2026-08-17', time: '12:00–16:00', timeNote: { zh: '15:00 最后入场', en: 'last entry 15:00' },
      title: { zh: 'Racing to Del Monte & Pebble Beach 展览', en: 'Racing to Del Monte & Pebble Beach exhibit' }, location: { zh: 'Stanton Center · Custom House Plaza', en: 'Stanton Center · Custom House Plaza' },
      summary: { zh: '以本地赛车与 Pebble Beach 历史为主题的室内展，8 月 17 日为最后一天。', en: 'An indoor exhibit on local racing and Pebble Beach history; August 17 is its final day.' },
      why: { zh: '户外主活动周日结束后，最适合退房日的轻量汽车文化收尾。', en: 'The easiest automotive-history wrap-up after the marquee outdoor events end Sunday.' },
      access: { zh: '8/7–8/17 延长开放每日 12:00–16:00，15:00 最后入场。成人 $15、65+ / 军人 $12、18 岁以下免费；会员免费。附近可用 Waterfront Lot 或 East/West garages。', en: 'Extended hours Aug 7–17 daily 12:00–16:00; last entry 15:00. Adults $15, seniors 65+/military $12, under 18 free; members free. Use Waterfront Lot or East/West garages nearby.' },
      price: { zh: '成人 $15 · 65+/军人 $12 · 18 岁以下免费', en: '$15 adult · $12 senior/military · under 18 free' }, tags: ['paid'], categories: ['essential', 'paid'], score: '4.0',
      sources: [
        { url: 'https://www.montereyhistory.org/stanton-center/', label: { zh: 'Stanton Center：票价与开放时间 ↗', en: 'Stanton Center: admission and hours ↗' } },
        { url: 'https://www.montereyhistory.org/stanton-center/exhibits/', label: { zh: '展览页 ↗', en: 'Exhibits page ↗' } }
      ]
    }
  ],

  nearby: [
    {
      id: 'holo-fest',
      when: { zh: '7 月 31–8 月 2 日', en: 'Jul 31–Aug 2' },
      title: { zh: 'HOLO-FEST 2.0', en: 'HOLO-FEST 2.0' },
      location: { zh: 'Big Sur · Highway 1 沿线', en: 'Big Sur · along Highway 1' },
      summary: { zh: '三日音乐节，含 Jerry Garcia 生日庆典等演出；非车周活动，但适合提前落地缓冲。', en: 'Three-day music festival including a Jerry Garcia birthday bash—not Car Week, but useful as a pre-arrival buffer.' },
      why: { zh: '若能提前一周到半岛，可在 Monterey 前先在 Big Sur 休整；车程约 60–90 分钟，适合作为车周前的节奏过渡。', en: 'If you can land a week early, decompress in Big Sur before Monterey—roughly 60–90 minutes away and a good rhythm break before Car Week.' },
      price: { zh: '约 $55–189', en: 'About $55–189' },
      score: '4.0',
      drive: { zh: '距 Monterey 约 60–90 分钟 · Highway 1', en: '~60–90 min from Monterey via Hwy 1' },
      source: 'https://www.eventbrite.com/e/july-31-aug-2nd-holo-fest-20-featuring-jerry-garcia-b-day-bash-and-more-tickets-1993501930939'
    },
    {
      id: 'strawberry-fest',
      when: { zh: '7 月 31 日晚 + 8 月 1–2 日', en: 'Jul 31 eve + Aug 1–2' },
      title: { zh: 'Watsonville Strawberry Festival', en: 'Watsonville Strawberry Festival' },
      location: { zh: 'Historic Downtown Watsonville', en: 'Historic Downtown Watsonville' },
      summary: { zh: '免费草莓节市集与游行；游乐设施另收费。', en: 'Free strawberry festival with market and parade; rides are paid separately.' },
      why: { zh: '距 Monterey 仅约 40–50 分钟，适合提前落地后的轻松半日；与车周无重叠，但可填补等待入住的空档。', en: 'Only ~40–50 minutes from Monterey—a relaxed half-day while waiting to check in, with no Car Week overlap.' },
      price: { zh: '免费入场 · 游乐另计', en: 'Free admission · rides extra' },
      score: '3.5',
      drive: { zh: '距 Monterey 约 40–50 分钟 · 北侧', en: '~40–50 min north of Monterey' },
      source: 'https://www.watsonville.gov/1117/Watsonville-Strawberry-Festival'
    }
  ],

  stays: [
    {
      name: { zh: 'San Jose · 住家往返', en: 'San Jose · home-base commute' },
      price: '$0',
      priceNote: { zh: '房费免费 · 油/电、停车另算', en: 'Lodging free · fuel/charging & parking extra' },
      freeStay: true,
      recommended: false,
      metrics: [
        { key: 'stayDistance', value: { zh: '约 70–76 英里', en: '~70–76 mi' } },
        { key: 'stayOrdinary', value: { zh: '75–105 分钟', en: '75–105 min' } },
        { key: 'stayEventWeek', value: { zh: '100–180 分钟', en: '100–180 min' } },
        { key: 'stayRoundTrip', value: { zh: '约 140–155 英里 · 3–6 小时', en: '~140–155 mi · 3–6 hr' } },
        { key: 'stayFuel', value: { zh: '约 $25–40 / 天（25 mpg · ~$4.5/gal）', en: '~$25–40 / day (25 mpg · ~$4.5/gal)' } }
      ],
      body: {
        zh: '若 San Jose 有免费住处：到 Monterey / Seaside 约 70–72 英里、普通 75–95 分钟；到 Pebble Beach / Carmel 约 75–76 英里、普通 85–105 分钟（OSRM 无拥堵路由，2026-08-06）。活动周南下与回程拥堵会显著拉长；周日 Concours 更应再加缓冲。通勤规划器可选 San Jose 起点。',
        en: 'If lodging in San Jose is free: Monterey / Seaside are ~70–72 mi and usually 75–95 min; Pebble Beach / Carmel ~75–76 mi and 85–105 min (OSRM uncongested routing, checked 2026-08-06). Car Week congestion southbound and on the return stretch both; pad more on Concours Sunday. Choose San Jose as the commute origin below.'
      },
      tradeoff: {
        zh: '零房费 · 每日 3–6 小时车上时间，不适合 Dawn Patrol / 早场签到',
        en: 'Zero lodging · 3–6 hr/day in the car; weak fit for Dawn Patrol or early gates'
      }
    },
    {
      name: { zh: 'Pebble Beach / Carmel Highlands', en: 'Pebble Beach / Carmel Highlands' }, price: '$2,700–3,000+', recommended: false,
      body: { zh: '把周四 Tour 与周日 Concours 通勤压到最短；本次公开查询只剩高端结果，Pebble Beach 本身应直接询价。', en: 'Shortest travel for Thursday’s Tour and Sunday’s Concours. This public search showed only luxury results; request a direct quote for Pebble Beach itself.' },
      tradeoff: { zh: '最省时间 · 价格最高且条款最严', en: 'Least travel · highest cost and strictest terms' }
    },
    {
      name: { zh: 'Monterey / Pacific Grove', en: 'Monterey / Pacific Grove' }, price: '$590–2,700+', recommended: true,
      body: { zh: '核心活动区之间最均衡，餐饮与市区活动多；剩余库存价差极大，必须逐项看四晚总价。相对 San Jose 往返，高峰四晚房价通常仍远高于油费，但换回睡眠与早场可达性。', en: 'Best-balanced base across the key hubs, with walkable dining and city events. Remaining inventory varies wildly, so compare four-night totals. Versus a San Jose commute, peak lodging usually still dwarfs fuel—but buys sleep and early-gate access.' },
      tradeoff: { zh: '综合最方便 · 仍需应对 Pebble Beach 堵车', en: 'Best overall balance · still faces Pebble Beach traffic' }
    },
    {
      name: { zh: 'Seaside / Marina', en: 'Seaside / Marina' }, price: '$390–2,000+', recommended: false,
      body: { zh: '对 Exotics、Lemons 和 Laguna Seca 友好，通常比 Monterey 核心区更容易控制预算。', en: 'Well placed for Exotics, Lemons and Laguna Seca, and often easier to budget than central Monterey.' },
      tradeoff: { zh: '价格与赛道通勤折中 · 去 Pebble Beach 更慢', en: 'Good price/track balance · slower to Pebble Beach' }
    },
    {
      name: { zh: 'Salinas', en: 'Salinas' }, price: '$370–600+', recommended: false,
      body: { zh: '本次快照中最便宜的剩余房源集中区，也最接近 Laguna Seca 的东侧入口方向。比 San Jose 往返短得多，仍保留每晚入住。', en: 'The lowest remaining price cluster in this snapshot and aligned with the east-side approach to Laguna Seca. Far shorter than a San Jose commute while still sleeping locally.' },
      tradeoff: { zh: '最低房价 · 去 Pebble Beach 可达 60–120 分钟', en: 'Lowest room cost · 60–120 min to Pebble Beach' }
    }
  ],

  places: [
    { id: 'sanjose', name: { zh: 'San Jose（住家往返）', en: 'San Jose (home commute)' } },
    { id: 'pebble', name: { zh: 'Pebble Beach', en: 'Pebble Beach' } },
    { id: 'carmel', name: { zh: 'Carmel', en: 'Carmel' } },
    { id: 'monterey', name: { zh: 'Monterey / Pacific Grove', en: 'Monterey / Pacific Grove' } },
    { id: 'seaside', name: { zh: 'Seaside', en: 'Seaside' } },
    { id: 'marina', name: { zh: 'Marina', en: 'Marina' } },
    { id: 'salinas', name: { zh: 'Salinas', en: 'Salinas' } }
  ],
  hubs: [
    { id: 'pebble', name: { zh: 'Pebble Beach 会场', en: 'Pebble Beach events' } },
    { id: 'carmel', name: { zh: 'Carmel 市中心', en: 'Downtown Carmel' } },
    { id: 'carmelvalley', name: { zh: 'Carmel Valley / The Quail', en: 'Carmel Valley / The Quail' } },
    { id: 'monterey', name: { zh: 'Monterey / Pacific Grove', en: 'Monterey / Pacific Grove' } },
    { id: 'seaside', name: { zh: 'Seaside 街展', en: 'Seaside street shows' } },
    { id: 'laguna', name: { zh: 'Laguna Seca 赛道', en: 'Laguna Seca' } }
  ],

  /* Quick-plan coordinates; each route stop declares venue/area precision (reviewed 2026-08-10). */
  mapPlaces: {
    alvarado: { lat: 36.59931, lng: -121.89455, name: { zh: '阿尔瓦拉多街 · 蒙特雷', en: 'Alvarado St · Monterey' } },
    asilomar: { lat: 36.61923, lng: -121.93739, name: { zh: 'Asilomar 会议中心', en: 'Asilomar Conference Grounds' } },
    laguna: { lat: 36.58441, lng: -121.75339, name: { zh: 'WeatherTech Raceway Laguna Seca', en: 'WeatherTech Raceway Laguna Seca' } },
    carmel: { lat: 36.55514, lng: -121.92271, name: { zh: '海洋大道 · 卡梅尔', en: 'Ocean Ave · Carmel' } },
    lighthouse: { lat: 36.61677, lng: -121.90602, name: { zh: '灯塔大道 · 太平洋丛林', en: 'Lighthouse Ave · Pacific Grove' } },
    portola: { lat: 36.57324, lng: -121.95446, name: { zh: 'Portola Rd · 圆石滩', en: 'Portola Rd · Pebble Beach' } },
    'hay-hill': { lat: 36.57150, lng: -121.94883, name: { zh: 'Hay Hill · Cadillac V-Series 体验区域', en: 'Hay Hill · Cadillac V-Series experience area' } },
    village: { lat: 36.58230, lng: -121.94987, name: { zh: 'Concours Village · 圆石滩', en: 'Concours Village · Pebble Beach' } },
    werks: { lat: 36.59040, lng: -121.86216, name: { zh: 'Monterey Pines / Werks', en: 'Monterey Pines / Werks' } },
    lemons: { lat: 36.60356, lng: -121.85355, name: { zh: 'Seaside 市政厅 / Lemons', en: 'Seaside City Hall / Lemons' } },
    exotics: { lat: 36.60904, lng: -121.83800, name: { zh: 'Broadway Ave · Seaside', en: 'Broadway Ave · Seaside' } },
    pebble: { lat: 36.56966, lng: -121.94974, name: { zh: 'Pebble Beach Golf Links', en: 'Pebble Beach Golf Links' } },
    stanton: { lat: 36.60269, lng: -121.89343, name: { zh: 'Stanton Center · 蒙特雷', en: 'Stanton Center · Monterey' } },
    pgolf: { lat: 36.63084, lng: -121.92860, name: { zh: 'Pacific Grove Golf Links', en: 'Pacific Grove Golf Links' } },
    embassy: { lat: 36.60670, lng: -121.85560, name: { zh: 'Embassy Suites · Seaside / ACE', en: 'Embassy Suites · Seaside / ACE' } },
    jetcenter: { lat: 36.58934, lng: -121.85961, name: { zh: 'Monterey Jet Center', en: 'Monterey Jet Center' } },
    bayonet: { lat: 36.62759, lng: -121.82266, name: { zh: 'Bayonet Black Horse · Seaside', en: 'Bayonet Black Horse · Seaside' } },
    'carmel-valley-history': { lat: 36.48210, lng: -121.73190, name: { zh: 'Carmel Valley 历史区', en: 'Carmel Valley history area' } },
    'porsche-seaside': { lat: 36.60740, lng: -121.85350, name: { zh: 'Porsche Monterey · Seaside 区域', en: 'Porsche Monterey · Seaside area' } },
    'touring-vehicles': { lat: 36.61100, lng: -121.85600, name: { zh: 'Monterey Touring Vehicles 区域', en: 'Monterey Touring Vehicles area' } }
  },

  /* Real-world anchors for the Leaflet hero map (Nominatim, 2026-08-06). */
  mapHubs: [
    {
      id: 'pacificgrove', lat: 36.63084, lng: -121.92860, tone: 'default',
      name: { zh: 'Pacific Grove', en: 'Pacific Grove' },
      note: { zh: 'Legends · Little Cars · Asilomar · Night Rider', en: 'Legends · Little Cars · Asilomar · Night Rider' },
      place: { zh: 'Pacific Grove Golf Links 一带', en: 'Near Pacific Grove Golf Links' }
    },
    {
      id: 'pebble', lat: 36.56966, lng: -121.94974, tone: 'featured',
      name: { zh: 'Pebble Beach', en: 'Pebble Beach' },
      note: { zh: 'Tour · Concours · Auction · Village', en: 'Tour · Concours · Auction · Village' },
      place: { zh: 'Pebble Beach Golf Links', en: 'Pebble Beach Golf Links' }
    },
    {
      id: 'monterey', lat: 36.59040, lng: -121.86216, tone: 'default',
      name: { zh: 'Monterey', en: 'Monterey' },
      note: { zh: 'Werks · Kickoff · Jet Center · Stanton', en: 'Werks · Kickoff · Jet Center · Stanton' },
      place: { zh: 'Monterey Pines Golf Course', en: 'Monterey Pines Golf Course' }
    },
    {
      id: 'carmel', lat: 36.55514, lng: -121.92271, tone: 'default',
      name: { zh: 'Carmel', en: 'Carmel' },
      note: { zh: 'Ferrari · Concours for a Cause · Astons', en: 'Ferrari · Concours for a Cause · Astons' },
      place: { zh: 'Ocean Avenue', en: 'Ocean Avenue' }
    },
    {
      id: 'quail', lat: 36.53239, lng: -121.85149, tone: 'default',
      name: { zh: 'Carmel Valley', en: 'Carmel Valley' },
      note: { zh: 'The Quail · Broad Arrow', en: 'The Quail · Broad Arrow' },
      place: { zh: 'Quail Lodge & Golf Club', en: 'Quail Lodge & Golf Club' }
    },
    {
      id: 'seaside', lat: 36.60904, lng: -121.83800, tone: 'default',
      name: { zh: 'Seaside', en: 'Seaside' },
      note: { zh: 'Exotics · Lemons · Concorso · ACE · Paddock', en: 'Exotics · Lemons · Concorso · ACE · Paddock' },
      place: { zh: 'Broadway Ave 一带', en: 'Around Broadway Ave' }
    },
    {
      id: 'laguna', lat: 36.58441, lng: -121.75339, tone: 'accent',
      name: { zh: 'Laguna Seca', en: 'Laguna Seca' },
      note: { zh: 'Rolex Reunion · Pre-Reunion', en: 'Rolex Reunion · Pre-Reunion' },
      place: { zh: 'WeatherTech Raceway Laguna Seca', en: 'WeatherTech Raceway Laguna Seca' }
    }
  ],

  commute: {
    /* San Jose bands: OSRM uncongested one-way + Car Week peninsula approach padding.
       Miles (approx one-way): Monterey 72, Seaside 69, Laguna 71, Carmel 75, Pebble 76, Carmel Valley 77. */
    sanjose: { pebble: ['85–105', '120–180'], carmel: ['85–105', '115–170'], carmelvalley: ['95–120', '125–180'], monterey: ['75–95', '100–150'], seaside: ['75–95', '95–145'], laguna: ['85–105', '105–155'] },
    pebble: { pebble: ['0–10', '10–35'], carmel: ['15–20', '30–60'], carmelvalley: ['25–35', '45–85'], monterey: ['20–25', '40–75'], seaside: ['25–35', '50–90'], laguna: ['25–35', '45–90'] },
    carmel: { pebble: ['10–15', '25–60'], carmel: ['0–10', '10–25'], carmelvalley: ['15–25', '30–60'], monterey: ['10–20', '25–50'], seaside: ['15–25', '30–60'], laguna: ['20–30', '40–75'] },
    monterey: { pebble: ['15–20', '35–75'], carmel: ['10–20', '25–50'], carmelvalley: ['20–30', '35–70'], monterey: ['0–10', '10–25'], seaside: ['10–15', '20–40'], laguna: ['15–20', '30–60'] },
    seaside: { pebble: ['20–25', '40–80'], carmel: ['15–25', '30–60'], carmelvalley: ['25–35', '40–75'], monterey: ['10–15', '20–40'], seaside: ['0–10', '10–25'], laguna: ['15–20', '25–50'] },
    marina: { pebble: ['25–35', '50–95'], carmel: ['25–35', '45–75'], carmelvalley: ['35–45', '50–90'], monterey: ['15–25', '30–55'], seaside: ['10–15', '20–35'], laguna: ['20–30', '30–60'] },
    salinas: { pebble: ['35–45', '60–120'], carmel: ['30–40', '50–90'], carmelvalley: ['30–40', '45–80'], monterey: ['25–35', '45–75'], seaside: ['20–30', '35–65'], laguna: ['20–30', '30–60'] }
  },

  /* Approximate one-way road miles (OSRM, 2026-08-06). Used for San Jose commute display. */
  commuteMiles: {
    sanjose: { pebble: 76, carmel: 75, carmelvalley: 77, monterey: 72, seaside: 69, laguna: 71 }
  },

  transportTips: [
    {
      icon: 'SJ', title: { zh: 'San Jose 每日往返账', en: 'San Jose daily-commute math' },
      body: {
        zh: '单程约 70–76 英里；普通 75–105 分钟，活动周规划 100–180 分钟。每日往返约 140–155 英里、车上 3–6 小时；油费粗算 $25–40/天。适合午后/晚场，不适合 5:30 Concours 开门。',
        en: 'One-way ~70–76 mi; ordinary 75–105 min, Car Week plan 100–180 min. Round trip ~140–155 mi and 3–6 hr in the car; fuel roughly $25–40/day. Fine for afternoon shows—weak for 5:30 Concours gates.'
      }
    },
    {
      icon: '↗', title: { zh: '周日再加 20–45 分钟', en: 'Add 20–45 min on Sunday' },
      body: { zh: 'Pebble Beach 区间只到入口附近；普通票还要等待分配停车与内部接驳。', en: 'Pebble Beach bands end near the entrance; GA visitors still need assigned parking and an internal shuttle.' }
    },
    {
      icon: '↔', title: { zh: 'Carmel Plaza 接驳', en: 'Carmel Plaza shuttle' },
      body: { zh: '8/16 8:00–18:00；$40 当日不限次、$20 单程，约 15–30 分钟一班，受交通影响。', en: 'Aug 16, 8:00–18:00; $40 all-day or $20 one-way, roughly every 15–30 minutes subject to traffic.' }
    },
    {
      icon: 'P', title: { zh: 'Exotics 免费远端停车', en: 'Free Exotics park-and-ride' },
      body: { zh: 'General Jim Moore × Eucalyptus，8/15 9:00–17:00 免费接驳。', en: 'General Jim Moore at Eucalyptus, with free shuttle Aug 15 from 9:00–17:00.' }
    },
    {
      icon: '!', title: { zh: 'Laguna 公交先确认', en: 'Verify Laguna transit' },
      body: { zh: 'MST 38/39 在线时刻表未标 2026 有效期；可作候选，但不能假设活动日运行或免费。', en: 'Online MST 38/39 timetables show no 2026 validity date; consider them candidates, not guaranteed event service or free rides.' }
    }
  ],

  sources: [
    { label: { zh: 'Velocity · Monterey Car Week App', en: 'Velocity · Monterey Car Week App' }, url: 'https://www.viavelocity.com/monterey-car-week-app' },
    { label: { zh: 'See Monterey · Car Week 逐日活动', en: 'See Monterey · Car Week by day' }, url: 'https://www.seemonterey.com/monterey-car-week-events-by-day/' },
    { label: { zh: 'Automobilia Collectors Expo (ACE)', en: 'Automobilia Collectors Expo (ACE)' }, url: 'https://automobiliacollectorsexpo.com/' },
    { label: { zh: 'Motorlux · Monterey Jet Center', en: 'Motorlux · Monterey Jet Center' }, url: 'https://motorlux.com/tickets/' },
    { label: { zh: 'Broad Arrow · The Quail Auction', en: 'Broad Arrow · The Quail Auction' }, url: 'https://bid.broadarrowauctions.com/auctions/1-CQGJK8/the-quail-auction-2026' },
    { label: { zh: 'The Paddock Monterey · TicketSpice', en: 'The Paddock Monterey · TicketSpice' }, url: 'https://concorso.ticketspice.com/international-car-week' },
    { label: { zh: 'Central Coast Poker Rally', en: 'Central Coast Poker Rally' }, url: 'https://centralcoastpokerrally.com/itinerary/' },
    { label: { zh: 'Ferrari Event at The Barnyard', en: 'Ferrari Event at The Barnyard' }, url: 'https://www.bigsurfoodandwine.org/popup-events/28th-annual-ferrari-event-at-the-barnyard' },
    { label: { zh: 'The Little Car Show', en: 'The Little Car Show' }, url: 'https://www.thelittlecarshow.com/the-little-car-show-schedule/' },
    { label: { zh: 'Asilomar · Car Week 活动', en: 'Asilomar · Car Week events' }, url: 'https://www.visitasilomar.com/things-to-do/car-week' },
    { label: { zh: 'Pre-Reunion · 官方活动页', en: 'Pre-Reunion · official event page' }, url: 'https://weathertechraceway.com/pages/monterey-pre-reunion-and-corkscrew-hillclimb' },
    { label: { zh: 'Asilomar · Woodies in the Woods', en: 'Asilomar · Woodies in the Woods' }, url: 'https://www.visitasilomar.com/things-to-do/car-week' },
    { label: { zh: 'HOLO-FEST 2.0 · Eventbrite', en: 'HOLO-FEST 2.0 · Eventbrite' }, url: 'https://www.eventbrite.com/e/july-31-aug-2nd-holo-fest-20-featuring-jerry-garcia-b-day-bash-and-more-tickets-1993501930939' },
    { label: { zh: 'Watsonville Strawberry Festival', en: 'Watsonville Strawberry Festival' }, url: 'https://www.watsonville.gov/1117/Watsonville-Strawberry-Festival' },
    { label: { zh: 'Pebble Beach Concours · 周日主展', en: 'Pebble Beach Concours · Sunday show' }, url: 'https://www.pebblebeachconcours.net/event/pebble-beach-concours-delegance/' },
    { label: { zh: 'Tour d’Elegance · 官方日程', en: 'Tour d’Elegance · official schedule' }, url: 'https://www.pebblebeachconcours.net/event/pebble-beach-tour-delegance/' },
    { label: { zh: 'Tour d’Elegance · 8 月 12 日路线更新', en: 'Tour d’Elegance · Aug 12 route update' }, url: 'https://www.pebblebeachconcours.net/updates/' },
    { label: { zh: 'Tour d’Elegance · 8 月 11 日新版路线图 PDF', en: 'Tour d’Elegance · Aug 11 revised route map PDF' }, url: 'https://www.pebblebeachconcours.net/wp-content/uploads/2026/08/2026-Concours-Tour-Map-8-11-26-web.pdf' },
    { label: { zh: 'Village / 展示与试驾日程', en: 'Village / displays and drives' }, url: 'https://www.pebblebeachconcours.net/displays-and-ride-amp-drive-schedule/' },
    { label: { zh: 'Concours 门票商店', en: 'Concours official ticket store' }, url: 'https://theconcoursstore.com/collections/tickets' },
    { label: { zh: 'Pebble Beach 停车与接驳', en: 'Pebble Beach parking and shuttles' }, url: 'https://www.pebblebeachconcours.net/plan-your-visit/directions-parking-event-maps/' },
    { label: { zh: 'Cadillac V-Series Drive Experience', en: 'Cadillac V-Series Drive Experience' }, url: 'https://www.pebblebeachconcours.net/event/cadillac-v-series-drive-experience/' },
    { label: { zh: 'Cadillac CELESTIQ 官方车型页', en: 'Official Cadillac CELESTIQ page' }, url: 'https://www.cadillac.com/electric/celestiq' },
    { label: { zh: 'Mercedes-Benz USA · Future Classics House', en: 'Mercedes-Benz USA · Future Classics House' }, url: 'https://www.mbusa.com/en/events-and-partnerships/pebble-beach' },
    { label: { zh: 'Lexus Driving Experience', en: 'Lexus Driving Experience' }, url: 'https://www.pebblebeachconcours.net/event/lexus-drive-experience/' },
    { label: { zh: 'Lucid Demo Drive Experience', en: 'Lucid Demo Drive Experience' }, url: 'https://www.pebblebeachconcours.net/event/lucid-demo-drive-experience/' },
    { label: { zh: 'Home of Bentley · Pebble Beach 2026', en: 'Home of Bentley · Pebble Beach 2026' }, url: 'https://bentleyexperiences.com/' },
    { label: { zh: 'Lamborghini Villa · 2026 凭证与交通', en: 'Lamborghini Villa · 2026 credentials and transport' }, url: 'https://eventsala.com/pages/monterey-car-week-2026-faq' },
    { label: { zh: 'Lamborghini Villa · 2026 套案价格', en: 'Lamborghini Villa · 2026 package prices' }, url: 'https://eventsala.com/products/monterey-car-week-2026' },
    { label: { zh: 'Range Rover House · 2026 套案', en: 'Range Rover House · 2026 packages' }, url: 'https://www.rsvprangerover.com/residence/packagedetails.aspx' },
    { label: { zh: 'Bugatti · Destrier 2026 官方公告', en: 'Bugatti · official 2026 Destrier announcement' }, url: 'https://newsroom.bugatti.com/press-releases/the-bugatti-destrier-a-sculpture-of-speed' },
    { label: { zh: 'Monterey County · 2026 特别活动任务组议程', en: 'Monterey County · 2026 Special Event Task Force agenda' }, url: 'https://www.countyofmonterey.gov/home/showpublisheddocument/146630/639168767873630000' },
    { label: { zh: 'Monterey County · 特别活动审批与许可流程', en: 'Monterey County · special-event approval and permit process' }, url: 'https://www.countyofmonterey.gov/government/departments-a-h/housing-community-development/permit-center/special-events-getting-started' },
    { label: { zh: 'BMW Group Classic · Monterey Car Week 2026', en: 'BMW Group Classic · Monterey Car Week 2026' }, url: 'https://www.bmwgroup-classic.com/en/clubs-community/events/kalender-events/monterey-car-week-pebble-beach.html' },
    { label: { zh: 'Aston Martin · 2026 Vanquish 25 Monterey 公告', en: 'Aston Martin · 2026 Vanquish 25 Monterey announcement' }, url: 'https://media.astonmartin.com/vanquish-25-a-celebration-of-an-automotive-flagship/?lang=eng' },
    { label: { zh: 'Aston Martin · 2025 House 受邀口径', en: 'Aston Martin · 2025 House invited-guest policy' }, url: 'https://media.astonmartin.com/aston-martin-celebrates-75-years-in-the-americas-at-2025-monterey-car-week/?lang=eng' },
    { label: { zh: '17-Mile Drive 活动周关闭', en: '17-Mile Drive Car Week closure' }, url: 'https://www.pebblebeach.com/17-mile-drive/' },
    { label: { zh: 'Rolex Reunion · Laguna Seca', en: 'Rolex Reunion · Laguna Seca' }, url: 'https://weathertechraceway.com/pages/rolex-monterey-motorsports-reunion' },
    { label: { zh: 'Werks Reunion · Monterey', en: 'Werks Reunion · Monterey' }, url: 'https://www.werksreunion.com/monterey.cfm' },
    { label: { zh: 'Exotics on Broadway · 2026 主页', en: 'Exotics on Broadway · 2026 event home' }, url: 'https://exoticsonbroadway.com/' },
    { label: { zh: 'Exotics on Broadway · 免费/付费分区与票价', en: 'Exotics on Broadway · free/paid zones and tickets' }, url: 'https://exoticsonbroadway.com/tickets/' },
    { label: { zh: 'Gooding Christie’s · Pebble Beach', en: 'Gooding Christie’s · Pebble Beach' }, url: 'https://www.goodingco.com/auction/pebble-beach-auctions-2026/' },
    { label: { zh: 'Gooding Christie’s · 竞买注册', en: 'Gooding Christie’s · bidder registration' }, url: 'https://www.goodingco.com/register/' },
    { label: { zh: 'Mecum Monterey 2026', en: 'Mecum Monterey 2026' }, url: 'https://www.mecum.com/auctions/monterey-2026/' },
    { label: { zh: 'RM Sotheby’s Monterey 2026', en: 'RM Sotheby’s Monterey 2026' }, url: 'https://www.rmsothebys.com/auctions/mo26/' },
    { label: { zh: 'Sotheby’s Concierge Auctions · Monterey 场次', en: 'Sotheby’s Concierge Auctions · Monterey session' }, url: 'https://www.conciergeauctions.com/collection/monterey-car-week-rm-sothebys-1' },
    { label: { zh: 'Bonhams Laguna Seca Auction 2026', en: 'Bonhams Laguna Seca Auction 2026' }, url: 'https://cars.bonhams.com/auction/31959/the-laguna-seca-auction' },
    { label: { zh: 'What’s Up Monterey · Mecum', en: 'What’s Up Monterey · Mecum' }, url: 'https://whatsupmonterey.com/events/monterey-car-week/mecum-auto-auctions-muscle-cars-more/447' },
    { label: { zh: 'Monterey Car Week 交通提醒', en: 'Monterey Car Week travel alerts' }, url: 'https://www.seemonterey.com/events/monterey-car-week/monterey-car-week-travel-alerts/' },
    { label: { zh: 'Carmel → Concours 周日接驳', en: 'Carmel → Concours Sunday shuttle' }, url: 'https://members.carmelchamber.org/events/details/carmel-shuttles-to-pebble-beach-concours-d-elegance-2026-63225' },
    { label: { zh: 'Stanton Center · 历史展', en: 'Stanton Center · history exhibit' }, url: 'https://www.montereyhistory.org/stanton-center/exhibits/' },
    { label: { zh: 'Caltrans 实时道路状态', en: 'Caltrans live road conditions' }, url: 'https://roads.dot.ca.gov/' },
    { label: { zh: 'Pebble Beach · 从 SJC 约 90 分钟', en: 'Pebble Beach · ~90 min from SJC' }, url: 'https://www.pebblebeach.com/insidepebblebeach/how-to-get-to-pebble-beach-resorts/' },
    { label: { zh: 'OpenStreetMap · 地图底图与坐标', en: 'OpenStreetMap · basemap & coordinates' }, url: 'https://www.openstreetmap.org/#map=12/36.58/-121.86' },
    { label: { zh: '住宿库存查询口径', en: 'Lodging inventory search' }, url: 'https://www.hotels.com/Hotel-Search?destination=Monterey%2C%20California%2C%20United%20States%20of%20America&startDate=2026-08-13&endDate=2026-08-17&adults=2&rooms=1' }
  ]
};
