/* Public, bilingual planning data for Monterey Car Week 2026.
 * Event facts and prices were checked against organizer or authorized ticketing
 * pages on 2026-08-06. Editorial scores and commute bands are QROST planning
 * judgments, not organizer guarantees.
 */
window.PEBBLE_DATA = {
  checked: '2026-08-06',

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
    navSchedule: { zh: '日程', en: 'Schedule' },
    navNearby: { zh: '周边早场', en: 'Nearby early' },
    navStay: { zh: '住宿', en: 'Stay' },
    navCommute: { zh: '通勤', en: 'Travel' },
    navLive: { zh: '此刻', en: 'Now' },
    heroEyebrow: { zh: '公众行程指南 · 2026', en: 'Public trip guide · 2026' },
    checkedChip: { zh: '已核对 8 月 6 日', en: 'Checked Aug 6' },
    heroTitleTop: { zh: '圆石滩，不只一场车展', en: 'Pebble Beach is not one show' },
    heroTitleBottom: { zh: '早到一周，再迎旗舰主展', en: 'Arrive early, then hit the flagship' },
    heroLead: {
      zh: '官方 Monterey Car Week 自 8 月 7 日开场，高峰仍在 13–16 日。这份指南覆盖从免费早场街展到周一返程的完整 11 天：何时、去哪里、值不值得、住哪里、路上多久。',
      en: 'Official Monterey Car Week opens August 7, with peak days still August 13–16. This guide spans all eleven days from free early street shows through Monday departure: when, where, value, lodging and travel time in one plan.'
    },
    buildTrip: { zh: '开始排日程', en: 'Build your schedule' },
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
    planRouteHint: { zh: '实线为推荐驾车顺序；虚线/圆点为二选一地点。', en: 'Solid line = recommended drive order; dashed/dots = either-or picks.' },
    planRouteOr: { zh: '或', en: 'or' },
    planRouteLoading: { zh: '路线加载中…', en: 'Loading route…' },
    planRouteUnavailable: { zh: '路线暂不可用，仍显示地点。', en: 'Route unavailable; stops still shown.' },
    planTimeline: { zh: '展开每日时间规划', en: 'Expand day timeline' },
    planTimelineHint: { zh: '规划缓冲，非官方时刻表；临行前以各活动官方页为准。', en: 'Planning buffers, not an official timetable—recheck each event page before travel.' },
    planToneCore: { zh: '主场', en: 'Core' },
    planToneOptional: { zh: '可选', en: 'Optional' },
    planToneAlt: { zh: '二选一', en: 'Either/or' },
    planToneTransit: { zh: '转场', en: 'Transit' },
    liveKicker: { zh: '动态 · 半岛本地时', en: 'Live · peninsula local time' },
    liveTitle: { zh: '此刻去哪、今天哪里有什么', en: 'What’s on now—and where today' },
    liveIntro: {
      zh: '时钟按 America/Los_Angeles（太平洋时间）。过期日期默认折叠；可按“此刻 / 今日 / 地点”快速筛选。演示可用 ?demoDate=2026-08-08&demoTime=14:30。',
      en: 'Clock uses America/Los_Angeles (Pacific Time). Past days fold by default; filter by Now / Today / place. Demo with ?demoDate=2026-08-08&demoTime=14:30.'
    },
    liveClockLabel: { zh: '当前时间', en: 'Local time' },
    liveModeBrowse: { zh: '浏览全部', en: 'Browse all' },
    liveModeNow: { zh: '此刻进行中', en: 'Happening now' },
    liveModeToday: { zh: '今日活动', en: 'Today’s events' },
    liveAreaAll: { zh: '全部地点', en: 'All places' },
    livePastFolded: { zh: '已过 · 点击展开', en: 'Past · tap to expand' },
    livePastBadge: { zh: '已过', en: 'Past' },
    liveTodayBadge: { zh: '今天', en: 'Today' },
    liveUpcomingBadge: { zh: '未到', en: 'Upcoming' },
    liveOutsideWindow: { zh: '当前不在 8.7–8.17 窗口内，显示完整计划。', en: 'Outside the Aug 7–17 window—showing the full plan.' },
    liveNoNow: { zh: '此刻没有匹配的进行中活动（或时段无法解析）。试试“今日”或换地点。', en: 'Nothing matched as happening now (or times could not be parsed). Try Today or another place.' },
    liveNoToday: { zh: '今天没有匹配活动。', en: 'No matching events today.' },
    liveShowPast: { zh: '显示已过日期', en: 'Show past days' },
    liveHidePast: { zh: '折叠已过日期', en: 'Fold past days' },
    livePastShow: { zh: '显示已过日期', en: 'Show past days' },
    livePastHide: { zh: '折叠已过日期', en: 'Fold past days' },
    liveAllAreas: { zh: '全部地点', en: 'All places' },
    liveAreaLabel: { zh: '按地点筛选', en: 'Filter by place' },
    liveStatusNow: { zh: '此刻 {count} 个进行中', en: '{count} happening now' },
    liveStatusToday: { zh: '今日 {count} 个活动', en: '{count} events today' },
    liveStatusBrowse: { zh: '显示 {count} 个活动', en: 'Showing {count} events' },
    liveScheduleSynced: { zh: ' · 日程区已同步', en: ' · schedule synced below' },
    liveDayFilterNote: { zh: '“此刻/今日”模式下日期筛选已放宽', en: 'Day filter widened in Now/Today mode' },
    liveParsedHint: { zh: '“此刻”依赖公开时段字符串的近似解析；多场次与开放式结束时间会放宽匹配。', en: '“Now” uses approximate parsing of public time strings; multi-session and open-ended times are matched loosely.' },
    scheduleKicker: { zh: '8.7–8.17 · 逐日选择', en: 'Aug 7–17 · day by day' },
    scheduleTitle: { zh: '什么时候去哪里，哪些真正值得', en: 'Where to go, when—and what is worth it' },
    scheduleIntro: {
      zh: '“推荐”基于公众可达性、内容独特性、价格与转场成本。票价和余票会变，购买前请打开每张卡片里的官方来源复核。',
      en: 'Recommendations weigh public access, uniqueness, price and transfer cost. Tickets and availability change; reopen the official source on each card before buying.'
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
      zh: '活动时间、票价、售罄状态与道路规则截至 2026-08-06；酒店价格是单次库存快照；通勤为有意放宽的活动周计划值。任何“值得去”都是编辑判断，不是主办方背书。',
      en: 'Event times, ticket prices, sold-out status and road rules are current to Aug 6, 2026. Hotel prices are a one-time inventory snapshot, and travel bands are deliberately padded planning values. Every “worth it” score is editorial, not an organizer endorsement.'
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
      zh: '最后核对 2026-08-06。非官方、非主办方关联；不构成票务、住宿或交通保证。',
      en: 'Last checked Aug 6, 2026. Independent and unaffiliated; no ticket, lodging or transportation guarantee.'
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
      route: {
        mode: 'single',
        stops: [{ place: 'alvarado', label: { zh: 'Kickoff 开幕', en: 'Kickoff' } }]
      },
      schedule: [
        { time: "15:30", title: { zh: "抵达半岛 · 入住或寄存行李", en: "Arrive peninsula · check in or drop bags" }, note: { zh: "周五傍晚车位紧，先安顿再出门。", en: "Friday evening parking tightens—settle in before heading out." }, tone: "transit" },
        { time: "16:15", title: { zh: "转场至 Alvarado St", en: "Transit to Alvarado St" }, note: { zh: "市中心步行区，预留找车位时间。", en: "Downtown pedestrian zone; allow time to park." }, tone: "transit" },
        { time: "17:00–19:00", title: { zh: "Monterey Car Week Kickoff", en: "Monterey Car Week Kickoff" }, note: { zh: "免费开幕式，历史赛车集结。", en: "Free opening night with historic race cars." }, tone: "core" },
        { time: "19:15", title: { zh: "市中心晚餐 · 缓冲", en: "Downtown dinner · buffer" }, note: { zh: "餐饮排队长，不必赶下一场。", en: "Restaurant lines grow; no rush to another stop." }, tone: "optional" },
      ],
    },
    {
      id: 'qp-0808',
      date: { zh: '8 月 8 日', en: 'Aug 8' }, day: { zh: '周六', en: 'Sat' },
      title: { zh: 'Asilomar Day 或 Pre-Reunion', en: 'Asilomar Day or Pre-Reunion' },
      body: { zh: '免费选 Asilomar 州立公园庆典（老爷车、摇摆舞）；赛车迷则买 Pre-Reunion 单日票，含 Corkscrew Hillclimb。', en: 'Free Asilomar state-parks birthday with vintage rides and swing dance—or buy a Pre-Reunion single-day pass including Corkscrew Hillclimb for race fans.' },
      cost: { zh: '$0 / ~$82.62', en: '$0 / ~$82.62' },
      route: {
        mode: 'choice',
        stops: [
          { place: 'asilomar', label: { zh: 'Asilomar Day', en: 'Asilomar Day' } },
          { place: 'laguna', label: { zh: 'Pre-Reunion', en: 'Pre-Reunion' } }
        ]
      },
      schedule: [
        { time: "06:30", title: { zh: "早起出发 · 赛道分支", en: "Early departure · track branch" }, note: { zh: "选 Pre-Reunion 时建议 7 点前到 Laguna Seca。", en: "If choosing Pre-Reunion, aim for Laguna Seca before 7:00." }, tone: "transit" },
        { time: "07:00–17:00", title: { zh: "或 Pre-Reunion + Corkscrew Hillclimb", en: "or Pre-Reunion + Corkscrew Hillclimb" }, note: { zh: "单日票含爬坡赛，与公园日完全冲突。", en: "Single-day pass includes hillclimb; fully conflicts with park day." }, tone: "alt" },
        { time: "09:30", title: { zh: "转场至 Asilomar", en: "Transit to Asilomar" }, note: { zh: "Pacific Grove 周末车位先到先得。", en: "Pacific Grove weekend parking is first come." }, tone: "transit" },
        { time: "10:00–16:00", title: { zh: "或 Asilomar Day", en: "or Asilomar Day" }, note: { zh: "免费州立公园生日庆典。", en: "Free state-parks birthday celebration." }, tone: "alt" },
      ],
    },
    {
      id: 'qp-0809',
      date: { zh: '8 月 9 日', en: 'Aug 9' }, day: { zh: '周日', en: 'Sun' },
      title: { zh: 'Pre-Reunion 次日，或轻量休整', en: 'Pre-Reunion day 2, or rest light' },
      body: { zh: '若周六买了 2 日票或想补赛道，周日继续 Laguna Seca；否则休息、补票与核对周一 ACE / 街展计划。', en: 'Continue at Laguna Seca with a two-day pass or a Sunday catch-up; otherwise rest, buy tickets and lock Monday ACE / street-show plans.' },
      cost: { zh: '~$82.62 / $0', en: '~$82.62 / $0' },
      route: {
        mode: 'single',
        stops: [{ place: 'laguna', label: { zh: 'Pre-Reunion 周日', en: 'Pre-Reunion Sunday' } }]
      },
      schedule: [
        { time: "07:00", title: { zh: "转场至 Laguna Seca", en: "Transit to Laguna Seca" }, note: { zh: "大型活动走 South Boundary Road。", en: "Major events use South Boundary Road." }, tone: "transit" },
        { time: "07:00–17:00", title: { zh: "或 Pre-Reunion 次日", en: "or Pre-Reunion day 2" }, note: { zh: "周六已买两日票则自然接续。", en: "Natural follow-up if you bought a two-day pass Saturday." }, tone: "alt" },
        { time: "10:00", title: { zh: "或 休整 · 补票与周一计划", en: "or Rest · tickets and Monday plans" }, note: { zh: "核对 ACE 与街展时段，线上购票。", en: "Lock ACE and street-show windows; buy tickets online." }, tone: "alt" },
        { time: "14:00", title: { zh: "轻量补给 · 缓冲", en: "Light resupply · buffer" }, note: { zh: "周日傍晚交通相对宽松。", en: "Sunday evening traffic is usually lighter." }, tone: "optional" },
      ],
    },
    {
      id: 'qp-0810',
      date: { zh: '8 月 10 日', en: 'Aug 10' }, day: { zh: '周一', en: 'Mon' },
      title: { zh: 'ACE 藏品展 → 英系 / EV / 保时捷', en: 'ACE automobilia → British / EV / Porsche' },
      body: { zh: '上午 Embassy Suites 的 Automobilia Collectors Expo（车周最完整藏品展）；下午按兴趣选 Monterey British、Electric Coast 或 Porsche Seaside。', en: 'Morning Automobilia Collectors Expo at Embassy Suites—the week’s best memorabilia hall; afternoon pick Monterey British, Electric Coast or Porsche Seaside.' },
      cost: { zh: 'ACE 单日 $30 · 街展 $0', en: 'ACE 1-day $30 · street shows $0' },
      route: {
        mode: 'sequence',
        stops: [
          { place: 'embassy', label: { zh: 'ACE 藏品展', en: 'ACE Expo' } },
          { place: 'asilomar', label: { zh: 'Electric Coast', en: 'Electric Coast' } }
        ]
      },
      schedule: [
        { time: "09:30", title: { zh: "转场至 Embassy Suites", en: "Transit to Embassy Suites" }, note: { zh: "Seaside 方向，ACE 10:00 开门。", en: "Head to Seaside; ACE opens at 10:00." }, tone: "transit" },
        { time: "10:00–12:30", title: { zh: "ACE Automobilia Collectors Expo", en: "ACE Automobilia Collectors Expo" }, note: { zh: "车周最完整藏品展，上午优先。", en: "The week's best automobilia hall—prioritize the morning." }, tone: "core" },
        { time: "12:45", title: { zh: "半岛转场 · 下午街展", en: "Peninsula hop · afternoon street shows" }, note: { zh: "预留 20–35 分钟车程。", en: "Allow 20–35 minutes driving time." }, tone: "transit" },
        { time: "13:00–16:00", title: { zh: "或 British / Electric Coast / Porsche Seaside", en: "or British / Electric Coast / Porsche Seaside" }, note: { zh: "三选一：英系 11–14、EV 12–16、保时捷 15–19。", en: "Pick one: British 11–14, EV 12–16, or Porsche 15–19." }, tone: "alt" },
        { time: "16:15", title: { zh: "返程缓冲", en: "Return buffer" }, note: { zh: "周一傍晚仍建议早回住宿。", en: "Monday evening—head back to lodging early." }, tone: "transit" },
      ],
    },
    {
      id: 'qp-0811',
      date: { zh: '8 月 11 日', en: 'Aug 11' }, day: { zh: '周二', en: 'Tue' },
      title: { zh: 'Concours for a Cause · 可选 Night Rider', en: 'Concours for a Cause · optional Night Rider' },
      body: { zh: 'Carmel Ocean Ave 免费慈善街展；傍晚可加 Asilomar Night Rider（低底盘文化夜场）。藏品迷可改去 ACE 拍卖日。', en: 'Free charity show on Carmel’s Ocean Ave; optionally add Asilomar Night Rider (lowrider evening). Collectors can pivot to ACE auction day instead.' },
      cost: { zh: '$0 / Night Rider $65', en: '$0 / Night Rider $65' },
      route: {
        mode: 'sequence',
        stops: [
          { place: 'carmel', label: { zh: 'Concours for a Cause', en: 'Concours for a Cause' } },
          { place: 'asilomar', label: { zh: 'Night Rider', en: 'Night Rider' } }
        ]
      },
      schedule: [
        { time: "09:30", title: { zh: "转场至 Carmel Ocean Ave", en: "Transit to Carmel Ocean Ave" }, note: { zh: "慈善街展步行区，车位紧张。", en: "Charity show in a walkable zone; parking is tight." }, tone: "transit" },
        { time: "10:00–16:00", title: { zh: "Concours for a Cause", en: "Concours for a Cause" }, note: { zh: "免费慈善街展，早场性价比最高。", en: "Free charity street show—best early value." }, tone: "core" },
        { time: "16:15", title: { zh: "转场 · 傍晚二选一", en: "Transit · evening fork" }, note: { zh: "藏品迷可改去 Seaside ACE。", en: "Collectors can pivot to ACE in Seaside." }, tone: "transit" },
        { time: "16:00–20:00", title: { zh: "或 ACE Automobilia Live Auction", en: "or ACE Automobilia Live Auction" }, note: { zh: "替代夜场，适合藏品爱好者。", en: "Evening alternative for automobilia fans." }, tone: "alt" },
        { time: "18:00–21:00", title: { zh: "可选 Night Rider", en: "Optional Night Rider" }, note: { zh: "Asilomar 地下车库低底盘文化夜场。", en: "Lowrider culture evening in Asilomar's underground garage." }, tone: "optional" },
      ],
    },
    {
      id: 'qp-0812',
      date: { zh: '8 月 12 日', en: 'Aug 12' }, day: { zh: '周三', en: 'Wed' },
      title: { zh: 'Little Car + Astons · 晚场二选一', en: 'Little Car + Astons · pick an evening' },
      body: { zh: '白天免费串 Pacific Grove 微型车展与 Carmel Astons；傍晚在 Asilomar Luau（$70）与 Jet Center Motorlux（$825）之间只选一个，或看 Motoring Classic 抵达。', en: 'Free daytime link: Pacific Grove Little Car Show and Carmel Astons; evenings pick only one of Asilomar Luau ($70) or Jet Center Motorlux ($825), or watch Motoring Classic arrivals.' },
      cost: { zh: '$0 · 晚场另计', en: '$0 · evening optional' },
      route: {
        mode: 'sequence',
        stops: [
          { place: 'lighthouse', label: { zh: 'Little Car Show', en: 'Little Car Show' } },
          { place: 'carmel', label: { zh: 'Astons on the Avenue', en: 'Astons on the Avenue' } },
          { place: 'pebble', label: { zh: 'Motoring Classic', en: 'Motoring Classic' } }
        ]
      },
      schedule: [
        { time: "10:45", title: { zh: "转场至 Carmel", en: "Transit to Carmel" }, note: { zh: "Astons 11:00 开门，先占 Ocean Ave。", en: "Astons opens 11:00—secure Ocean Ave first." }, tone: "transit" },
        { time: "11:00–13:30", title: { zh: "Astons on the Avenue", en: "Astons on the Avenue" }, note: { zh: "Carmel 免费阿斯顿·马丁街展。", en: "Free Aston Martin street show on Carmel's Ocean Ave." }, tone: "core" },
        { time: "13:45", title: { zh: "转场至 Pacific Grove", en: "Transit to Pacific Grove" }, note: { zh: "Lighthouse Ave 约 15–25 分钟。", en: "About 15–25 minutes to Lighthouse Ave." }, tone: "transit" },
        { time: "14:00–17:00", title: { zh: "The Little Car Show", en: "The Little Car Show" }, note: { zh: "观众免费；参展另收费。", en: "Spectators free; exhibitors pay separately." }, tone: "core" },
        { time: "16:30", title: { zh: "转场 · 晚场只选一个", en: "Transit · pick only one evening" }, note: { zh: "Luau / Motorlux / Motoring Classic 互斥。", en: "Luau, Motorlux and Motoring Classic conflict." }, tone: "transit" },
        { time: "17:00–22:00", title: { zh: "或 Luau / Motorlux / Motoring Classic 抵达", en: "or Luau / Motorlux / Motoring Classic arrivals" }, note: { zh: "Luau $70 · Motorlux $825 · 抵达观赏免费。", en: "Luau $70 · Motorlux $825 · arrivals viewing free." }, tone: "alt" },
      ],
    },
    {
      id: 'qp-0813',
      date: { zh: '8 月 13 日', en: 'Aug 13' }, day: { zh: '周四', en: 'Thu' },
      title: { zh: 'Tour 发车 → 免费展区', en: 'Tour departure → free displays' },
      body: { zh: '7 点前到 Portola Road；9:30 发车后，下午在 Village，再按品牌偏好选 Carmel Ferrari、Legends 或 Asilomar Woodies。', en: 'Reach Portola Road before 7; after the 9:30 departure, use Village, then choose Ferrari Carmel, Legends or Asilomar Woodies by marque.' },
      cost: { zh: '免费项目为主 · 停车另算', en: 'Mostly free · parking varies' },
      route: {
        mode: 'sequence',
        stops: [
          { place: 'portola', label: { zh: 'Tour d’Elegance', en: 'Tour d’Elegance' } },
          { place: 'village', label: { zh: 'Concours Village', en: 'Concours Village' } },
          { place: 'carmel', label: { zh: 'Ferrari Carmel', en: 'Ferrari Carmel' } }
        ]
      },
      schedule: [
        { time: "06:15", title: { zh: "转场至 Portola Road", en: "Transit to Portola Road" }, note: { zh: "7 点前到起点看车辆集结。", en: "Reach the start before 7:00 to see cars stage." }, tone: "transit" },
        { time: "07:00–09:30", title: { zh: "Tour d’Elegance 集结 · 09:30 发车", en: "Tour d’Elegance staging · 9:30 departure" }, note: { zh: "听引擎驶上 17-Mile Drive 与 Highway 1。", en: "Watch entrants depart onto 17-Mile Drive and Highway 1." }, tone: "core" },
        { time: "09:45", title: { zh: "转场至 Concours Village", en: "Transit to Concours Village" }, note: { zh: "发车后前往免费品牌展区。", en: "Head to free manufacturer displays after departure." }, tone: "transit" },
        { time: "10:00–14:00", title: { zh: "Concours Village + RetroAuto", en: "Concours Village + RetroAuto" }, note: { zh: "免费品牌展与市集，试驾先到先得。", en: "Free displays and marketplace; drives are first come." }, tone: "core" },
        { time: "14:15", title: { zh: "转场 · 下午品牌选一", en: "Transit · afternoon marque pick" }, note: { zh: "按品牌偏好只选一个下午主场。", en: "Choose one afternoon anchor by marque interest." }, tone: "transit" },
        { time: "14:30–17:00", title: { zh: "或 Ferrari Carmel / Legends / Woodies", en: "or Ferrari Carmel / Legends / Woodies" }, note: { zh: "法拉利街展、德系聚会或木旅行车。", en: "Ferrari street show, German marques, or woodies." }, tone: "alt" },
      ],
    },
    {
      id: 'qp-0814',
      date: { zh: '8 月 14 日', en: 'Aug 14' }, day: { zh: '周五', en: 'Fri' },
      title: { zh: 'Werks 或 Laguna Seca · 可选 Paddock', en: 'Werks or Laguna Seca · optional Paddock' },
      body: { zh: '保时捷聚会是最佳免费主场；更想听引擎就买周五 Reunion。下午若还有精力，Seaside 的 The Paddock 是杂糅车展收尾（与 Quail 冲突）。', en: 'Werks is the free-value anchor; buy Friday Reunion if engines matter more. If energy remains, The Paddock in Seaside is an eclectic late show—conflicts with The Quail.' },
      cost: { zh: '$0 + $40 现金停车 / $139.67', en: '$0 + $40 cash parking / $139.67' },
      route: {
        mode: 'choice',
        stops: [
          { place: 'werks', label: { zh: 'Werks Reunion', en: 'Werks Reunion' } },
          { place: 'laguna', label: { zh: 'Reunion 周五', en: 'Reunion Friday' } }
        ]
      },
      schedule: [
        { time: "06:45", title: { zh: "转场 · 周五大分流", en: "Transit · Friday fork" }, note: { zh: "Werks 与 Reunion 方向相反，早定路线。", en: "Werks and Reunion point opposite ways—commit early." }, tone: "transit" },
        { time: "07:00", title: { zh: "可选 Werks 车辆签到", en: "Optional Werks car check-in" }, note: { zh: "参展车 7:00 签到，观众可略晚。", en: "Show cars check in at 7:00; spectators can arrive later." }, tone: "optional" },
        { time: "08:00–18:35", title: { zh: "或 Reunion 周五全天", en: "or Reunion full Friday" }, note: { zh: "正赛至约 17:25，含 paddock 与展示。", en: "Racing to ~17:25 with paddock and exhibitions." }, tone: "alt" },
        { time: "09:00–15:00", title: { zh: "或 Werks Reunion（+$40 现金停车）", en: "or Werks Reunion (+$40 cash parking)" }, note: { zh: "最佳免费主场。", en: "Best free-value Friday anchor." }, tone: "alt" },
        { time: "15:15", title: { zh: "转场至 Seaside", en: "Transit to Seaside" }, note: { zh: "与 The Quail 冲突，勿叠加。", en: "Conflicts with The Quail—do not stack both." }, tone: "transit" },
        { time: "15:00–20:00", title: { zh: "可选 The Paddock Monterey", en: "Optional The Paddock Monterey" }, note: { zh: "杂糅车展收尾，需有余力再选。", en: "Eclectic show finale—only if energy remains." }, tone: "optional" },
      ],
    },
    {
      id: 'qp-0815',
      date: { zh: '8 月 15 日', en: 'Aug 15' }, day: { zh: '周六', en: 'Sat' },
      title: { zh: 'Lemons → Exotics，或赛道', en: 'Lemons → Exotics, or track' },
      body: { zh: '预算路线两站都免费；赛车迷则不要中途离开 Laguna Seca。', en: 'The two-stop street-show route is free; committed race fans should stay at Laguna Seca instead.' },
      cost: { zh: '$0 / $181.07', en: '$0 / $181.07' },
      route: {
        mode: 'sequence',
        stops: [
          { place: 'lemons', label: { zh: 'Concours d’Lemons', en: 'Concours d’Lemons' } },
          { place: 'exotics', label: { zh: 'Exotics on Broadway', en: 'Exotics on Broadway' } }
        ]
      },
      schedule: [
        { time: "07:00–09:30", title: { zh: "可选 Peninsula Cars & Coffee", en: "Optional Peninsula Cars & Coffee" }, note: { zh: "Seaside 清晨车友聚会，时段可能漂移。", en: "Informal Seaside morning meet; hours may shift." }, tone: "optional" },
        { time: "07:30", title: { zh: "转场 · 周六路线分流", en: "Transit · Saturday route fork" }, note: { zh: "街展路线与赛道不可兼得。", en: "Street-show route and track day are mutually exclusive." }, tone: "transit" },
        { time: "08:00–13:30", title: { zh: "Concours d’Lemons", en: "Concours d’Lemons" }, note: { zh: "免费幽默车展，最亲民周六早晨。", en: "Free comic car show—most accessible Saturday morning." }, tone: "core" },
        { time: "11:00–16:00", title: { zh: "Exotics on Broadway", en: "Exotics on Broadway" }, note: { zh: "接 Lemons 后转 Broadway，免费区无需买票。", en: "Follow Lemons onto Broadway; free zone needs no ticket." }, tone: "core" },
        { time: "08:00–18:10", title: { zh: "或 Reunion 周六全天", en: "or Reunion full Saturday" }, note: { zh: "赛车迷主日，勿中途离开赛道。", en: "Race fans' main day—do not leave mid-day." }, tone: "alt" },
        { time: "13:45", title: { zh: "街展路线 · Seaside 接驳缓冲", en: "Street route · Seaside shuttle buffer" }, note: { zh: "远端停车 + 接驳 9:00–17:00。", en: "Remote parking plus shuttle 9:00–17:00." }, tone: "transit" },
      ],
    },
    {
      id: 'qp-0816',
      date: { zh: '8 月 16 日', en: 'Aug 16' }, day: { zh: '周日', en: 'Sun' }, flagship: true,
      title: { zh: 'Concours 主展，或免费 Village', en: 'Concours, or free Village' },
      body: { zh: '想看评审与 Dawn Patrol 就为主展买单；预算优先仍可逛 Village 与 RetroAuto。', en: 'Pay for judging and Dawn Patrol; value-first visitors can still use Village and RetroAuto.' },
      cost: { zh: '$650 / $0', en: '$650 / $0' },
      route: {
        mode: 'single',
        stops: [{ place: 'pebble', label: { zh: 'Concours / Village', en: 'Concours / Village' } }]
      },
      schedule: [
        { time: "05:00", title: { zh: "转场至 Pebble Beach", en: "Transit to Pebble Beach" }, note: { zh: "周日清晨交通管制，预留充足时间。", en: "Sunday morning traffic controls—allow extra time." }, tone: "transit" },
        { time: "05:30", title: { zh: "或 Dawn Patrol", en: "or Dawn Patrol" }, note: { zh: "主展开门即入场，看黎明车队。", en: "Enter at gates opening for dawn arrivals." }, tone: "alt" },
        { time: "08:00–13:30", title: { zh: "或 Concours 评审", en: "or Concours judging" }, note: { zh: "8:00 评审开始，13:30 起颁奖。", en: "Judging from 8:00; awards from 13:30." }, tone: "alt" },
        { time: "08:00–18:00", title: { zh: "或 Concours Village 免费", en: "or Concours Village free" }, note: { zh: "不含 Golf Links 主展场与颁奖。", en: "Does not include Golf Links show field or awards." }, tone: "alt" },
        { time: "13:00–16:00", title: { zh: "可选 Car Week Cruise-In", en: "Optional Car Week Cruise-In" }, note: { zh: "展车位 $30–$100；步行观众或免费，勿当作纯免费场。", en: "Show-car spots $30–$100; walk-up spectators may be free—not a blanket free event." }, tone: "optional" },
      ],
    },
    {
      id: 'qp-0817',
      date: { zh: '8 月 17 日', en: 'Aug 17' }, day: { zh: '周一', en: 'Mon' },
      title: { zh: 'Stanton Center → 返程', en: 'Stanton Center → depart' },
      body: { zh: '户外大活动已经结束；先退房并寄存行李，中午看历史展，再返程。', en: 'The marquee outdoor events are over; check out and store bags first, see the history exhibit at noon, then depart.' },
      cost: { zh: '$15 成人 · 18 岁以下免费', en: '$15 adult · under 18 free' },
      route: {
        mode: 'single',
        stops: [{ place: 'stanton', label: { zh: 'Stanton Center', en: 'Stanton Center' } }]
      },
      schedule: [
        { time: "09:30", title: { zh: "退房 · 行李寄存", en: "Checkout · bag storage" }, note: { zh: "户外主活动已结束，节奏放慢。", en: "Marquee outdoor events are over—keep the pace light." }, tone: "core" },
        { time: "10:30", title: { zh: "转场至 Custom House Plaza", en: "Transit to Custom House Plaza" }, note: { zh: "Monterey 市中心 Stanton Center。", en: "Stanton Center in downtown Monterey." }, tone: "transit" },
        { time: "12:00–16:00", title: { zh: "Stanton Center 历史展", en: "Stanton Center history exhibit" }, note: { zh: "最后一天，15:00 最后入场。", en: "Final day; last entry at 15:00." }, tone: "core" },
        { time: "16:15", title: { zh: "取行李 · 返程", en: "Collect bags · depart" }, note: { zh: "周一午后返程交通通常顺畅。", en: "Monday afternoon departures are usually smooth." }, tone: "transit" },
      ],
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
      id: 'prereunion-sat', thumbId: 'prereunion-sat', area: 'laguna', date: '2026-08-08', time: '07:00–17:00+', timeNote: { zh: 'Corkscrew Hillclimb 周六', en: 'Corkscrew Hillclimb Saturday' },
      title: { zh: 'Monterey Pre-Reunion & Corkscrew Hillclimb · 周六', en: 'Monterey Pre-Reunion & Corkscrew Hillclimb · Saturday' }, location: { zh: 'WeatherTech Raceway Laguna Seca', en: 'WeatherTech Raceway Laguna Seca' },
      summary: { zh: 'Pre-Reunion 首日：200+ 辆历史赛车，含 Corkscrew Hillclimb 爬坡赛。', en: 'Pre-Reunion day one: 200+ historic race cars including the Corkscrew Hillclimb.' },
      why: { zh: '想在 Reunion 前先看历史赛车、且预算低于正赛周末的赛道迷首选；与 Asilomar Day 完全冲突，只能二选一。', en: 'The track pick for historic-racing fans who want action before Reunion at a lower price than peak weekend—directly conflicts with Asilomar Day.' },
      access: { zh: '大型活动走 South Boundary Road；Grounds+Paddock 票含普通停车。', en: 'Major-event access via South Boundary Road; Grounds+Paddock pass includes general parking.' },
      price: { zh: '单日 ~$82.62 · 2 日 ~$124.15', en: '~$82.62 single day · ~$124.15 two-day' }, tags: ['paid', 'subjectTag'], categories: ['essential', 'paid'], score: '4.5',
      source: 'https://tickets.weathertechraceway.com/event/2-day-grounds-and-paddock-pass-monterey-pre-reunion--corkscrew-hillclimb---august-8-9-2026'
    },
    {
      id: 'prereunion-sun', thumbId: 'prereunion-sun', area: 'laguna', date: '2026-08-09', time: '07:00–17:00+', timeNote: { zh: '正赛日', en: 'race day' },
      title: { zh: 'Monterey Pre-Reunion · 周日', en: 'Monterey Pre-Reunion · Sunday' }, location: { zh: 'WeatherTech Raceway Laguna Seca', en: 'WeatherTech Raceway Laguna Seca' },
      summary: { zh: 'Pre-Reunion 次日：历史赛车正赛与 paddock 近距离观赏。', en: 'Pre-Reunion day two: historic race action and close paddock access.' },
      why: { zh: '若周六选了 Asilomar，周日可补赛道；若已买 2 日票则自然接续。单日性价比略低于周六 hillclimb 特色日。', en: 'Catch the track on Sunday if you chose Asilomar Saturday; natural follow-up with a two-day pass. Single-day value is slightly below Saturday’s hillclimb hook.' },
      access: { zh: '大型活动走 South Boundary Road；Grounds+Paddock 票含普通停车。', en: 'Major-event access via South Boundary Road; Grounds+Paddock pass includes general parking.' },
      price: { zh: '单日 ~$82.62 · 2 日 ~$124.15', en: '~$82.62 single day · ~$124.15 two-day' }, tags: ['paid', 'subjectTag'], categories: ['paid'], score: '4.0',
      source: 'https://tickets.weathertechraceway.com/event/2-day-grounds-and-paddock-pass-monterey-pre-reunion--corkscrew-hillclimb---august-8-9-2026'
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
      summary: { zh: '观众免费的微型/迷你经典车展，展后有巡航；参展报名另收费（约 $100–$125），勿当作“带车也免费”。', en: 'Spectator-free micro/mini classic show with a post-show cruise; exhibitor registration is separate (~$100–$125)—not free if you bring a car.' },
      why: { zh: '早场最有趣、记忆点最强的免费主场（对观众）；与同日 Carmel Astons 可组合，但不必两边赶。', en: 'The most memorable free early anchor for spectators—pair with Carmel Astons the same day, but do not rush both.' },
      access: { zh: 'Lighthouse Ave 步行区；Pacific Grove 停车先到先得。想参展请走官方报名，勿按观众免费理解。', en: 'Lighthouse Ave pedestrian zone; Pacific Grove parking is first come. Exhibitors must register officially—do not treat spectator free as exhibitor free.' },
      price: { zh: '观众免费 · 参展约 $100–$125', en: 'Spectators free · exhibitors ~$100–$125' }, tags: ['mixedTag'], categories: ['essential', 'free', 'paid'], score: '4.5',
      source: 'https://www.thelittlecarshow.com/'
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
      id: 'rmmr-wed', thumbId: 'rmmr-wed', area: 'laguna', date: '2026-08-12', time: '07:00–', timeNote: { zh: 'Reunion 首日', en: 'Reunion day 1' },
      title: { zh: 'Rolex Monterey Motorsports Reunion · 周三', en: 'Rolex Monterey Motorsports Reunion · Wednesday' }, location: { zh: 'WeatherTech Raceway Laguna Seca', en: 'WeatherTech Raceway Laguna Seca' },
      summary: { zh: 'Rolex Reunion 开幕日；赛程与票价以官方票务页为准。', en: 'Opening day of Rolex Reunion; schedule and pricing per the official ticket page.' },
      why: { zh: '赛道迷可提前一天进场；若只能去一天，周四至周六票价与内容组合需对比后再买。', en: 'Track fans can enter a day early; if buying only one day, compare Wednesday through Saturday pricing and programming first.' },
      access: { zh: '大型活动走 South Boundary Road；购买前重查官方票务页。', en: 'Major-event access via South Boundary Road; recheck the official ticket page before buying.' },
      price: { zh: '票价见官方', en: 'See official tickets' }, tags: ['unknownTag', 'subjectTag'], categories: ['paid', 'unpriced'], score: '4.0',
      source: 'https://weathertechraceway.com/pages/rolex-monterey-motorsports-reunion'
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
      access: { zh: 'Monterey Jet Center；成人 $825（8/7 后可能涨价），鸡尾酒着装，禁牛仔裤/人字拖；VIP 停车另售。', en: 'Monterey Jet Center; adult $825 (may rise after Aug 7), cocktail attire, no jeans/flip-flops; VIP tarmac parking sold separately.' },
      price: { zh: '成人 $825 · VIP 停车 $225', en: 'Adult $825 · VIP parking $225' }, tags: ['paid'], categories: ['paid'], score: '3.0',
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
      id: 'tour', thumbId: 'tour', area: 'pebble', date: '2026-08-13', time: '07:00–12:00', timeNote: { zh: '9:30 发车', en: '9:30 departure' },
      title: { zh: 'Pebble Beach Tour d’Elegance', en: 'Pebble Beach Tour d’Elegance' }, location: { zh: 'Portola Road · Pebble Beach', en: 'Portola Road · Pebble Beach' },
      summary: { zh: '先在起点看主展车辆集结，再听着引擎驶上 17-Mile Drive 与 Highway 1；2026 年不在 Carmel 停靠。', en: 'Watch concours entrants gather, then hear them leave for 17-Mile Drive and Highway 1. The 2026 route does not stop in Carmel.' },
      why: { zh: '主展级车辆真正开起来，而且公众观看免费；这是整周性价比最高、最不能错过的一段。优先看清晨集结与 9:30 发车。', en: 'Concours-level cars in motion, free to the public. It is the week’s strongest value and the best first-timer anchor; prioritize lineup and departure.' },
      access: { zh: '7:00 前到 Portola Road 附近，跟随活动标识停车。17-Mile Drive 对无关交通关闭，但活动观众可按现场规则进入。', en: 'Arrive near Portola Road before 7 and follow event parking signs. The road is closed to unrelated traffic, but event visitors enter under onsite rules.' },
      price: { zh: '公众观看免费', en: 'Free public viewing' }, tags: ['free'], categories: ['essential', 'free'], score: '5.0',
      source: 'https://www.pebblebeachconcours.net/event/pebble-beach-tour-delegance/'
    },
    {
      id: 'ferrari-carmel', thumbId: 'ferrari-carmel', area: 'carmel', date: '2026-08-13', time: '09:00–16:00', timeNote: { zh: '公众时段', en: 'public hours' },
      title: { zh: 'Ferrari Owners Club Concours Carmel', en: 'Ferrari Owners Club Concours Carmel' }, location: { zh: 'Ocean Ave × Dolores St · Carmel', en: 'Ocean Ave at Dolores St · Carmel' },
      summary: { zh: 'Carmel 市中心的法拉利主题街展，适合接在 Tour 发车之后。', en: 'A Ferrari-centered downtown street show that pairs naturally with the Tour departure.' },
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
      sources: [
        { url: 'https://www.santacruzwoodies.com/august-14-2025-woodies-in-the-woods/', label: { zh: 'Santa Cruz Woodies：2026 日程 ↗', en: 'Santa Cruz Woodies: 2026 schedule ↗' } },
        { url: 'https://www.visitasilomar.com/things-to-do/car-week', label: { zh: 'Asilomar Car Week ↗', en: 'Asilomar Car Week ↗' } }
      ]
    },
    {
      id: 'village-thu', thumbId: 'village-thu', area: 'pebble', date: '2026-08-13', time: '09:00–18:00', timeNote: { zh: '保守开放时间', en: 'conservative hours' },
      title: { zh: 'Concours Village + RetroAuto', en: 'Concours Village + RetroAuto' }, location: { zh: 'Forest Lake Rd × Stevenson Dr · Pebble Beach', en: 'Forest Lake Rd at Stevenson Dr · Pebble Beach' },
      summary: { zh: '免费品牌展、概念车、收藏品与 RetroAuto 市集；部分试驾先到先得。', en: 'Free manufacturer displays, concepts, collectibles and the RetroAuto marketplace; some drives are first come.' },
      why: { zh: '不买周日主展票也能获得完整车周氛围，是 Tour 之后最稳妥的免费下午。', en: 'The most complete free Car Week atmosphere without a Sunday ticket, and the safest Thursday-afternoon choice after the Tour.' },
      access: { zh: '网约车统一在 Village 上下客。各品牌试驾可能要求 21 岁、驾照、免责签署与包脚鞋，排队不能保证。', en: 'Rideshare uses the Village node. Brand drives may require age 21+, license, waiver and closed-toe shoes; queues and availability are not guaranteed.' },
      price: { zh: '免费', en: 'Free' }, tags: ['free'], categories: ['essential', 'free'], score: '5.0',
      source: 'https://www.pebblebeachconcours.net/displays-and-ride-amp-drive-schedule/'
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
      id: 'mecum-thu', thumbId: 'mecum-thu', area: 'monterey', date: '2026-08-13', time: '10:00–', timeNote: { zh: '拍卖/区块', en: 'auction / blocks' },
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
      id: 'rm-thu', thumbId: 'rm-thu', area: 'monterey', date: '2026-08-13', time: '18:00–', timeNote: { zh: '夜场拍卖', en: 'evening auction' },
      title: { zh: 'RM Sotheby’s · The Monterey Auction', en: 'RM Sotheby’s · The Monterey Auction' }, location: { zh: 'Monterey Conference Center · 1 Portola Plaza', en: 'Monterey Conference Center · 1 Portola Plaza' },
      summary: { zh: '周四 18:00 夜场开拍；拍卖厅对普通观众受限。', en: 'Thursday evening session from 18:00; the auction floor is restricted for general visitors.' },
      why: { zh: '分数偏低是因为拍卖席门槛高——未注册竞拍人多半只能在线观看；若只为看车，周三预展或 Mecum 白天场更划算。', en: 'Score is lower because floor access is limited—unregistered visitors mostly watch online; for viewing cars, Wednesday preview or Mecum daytime is better value.' },
      access: { zh: '拍卖厅：注册竞拍人、委托方、合格媒体；公众预展见周三场次。', en: 'Auction floor: registered bidders, consignors, qualified media; public preview is Wednesday’s session.' },
      price: { zh: '预展 $60 周末通票 · 拍卖席受限', en: 'Preview $60 weekend pass · floor restricted' }, tags: ['paid'], categories: ['paid'], score: '3.5',
      source: 'https://www.rmsothebys.com/auctions/mo26/'
    },
    {
      id: 'werks', thumbId: 'werks', area: 'monterey', date: '2026-08-14', time: '09:00–15:00', timeNote: { zh: '7:00 车辆签到', en: '7:00 car check-in' },
      title: { zh: 'Werks Reunion Monterey', en: 'Werks Reunion Monterey' }, location: { zh: 'Monterey Pines Golf Course', en: 'Monterey Pines Golf Course' },
      summary: { zh: '保时捷俱乐部大聚会；9:30–12:00 评审，14:00–15:00 颁奖。', en: 'The major Porsche gathering; judging runs 9:30–12:00 and awards 14:00–15:00.' },
      why: { zh: '保时捷车迷 5/5，普通观众也有 4.5/5；周五最强的免费主场。', en: 'A 5/5 for Porsche fans and 4.5/5 generally—the strongest free Friday anchor.' },
      access: { zh: '观众停车每车 $40、摩托 $20，只收现金且现场无 ATM；入场本身免费。', en: 'Spectator parking is $40 per car or $20 per motorcycle, cash only, with no onsite ATM. Admission itself is free.' },
      price: { zh: '观众免费 · 停车 $40 现金', en: 'Free · $40 cash parking' }, tags: ['free'], categories: ['essential', 'free'], score: '4.5',
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
      id: 'mecum-fri', thumbId: 'mecum-fri', area: 'monterey', date: '2026-08-14', time: '09:00–', timeNote: { zh: '拍卖/区块', en: 'auction / blocks' },
      title: { zh: 'Mecum Monterey', en: 'Mecum Monterey' }, location: { zh: 'Hyatt Regency / Del Monte Golf Course · 1 Old Golf Course Rd', en: 'Hyatt Regency / Del Monte Golf Course · 1 Old Golf Course Rd' },
      summary: { zh: '周五 9:00 开拍；与 Werks、Laguna Seca、The Quail 同日，需二选一或只留半天。', en: 'Friday bidding from 9:00; same day as Werks, Laguna Seca and The Quail—pick one anchor or budget half a day.' },
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
        { url: 'https://www.broadarrowauctions.com/events/event/The%20Quail%20Auction%202026', label: { zh: 'Broad Arrow 活动页 ↗', en: 'Broad Arrow event page ↗' } },
        { url: 'https://bid.broadarrowauctions.com/auctions/1-CQGJK8/the-quail-auction-2026', label: { zh: '在线图录 / 竞拍 ↗', en: 'Online catalog / bidding ↗' } },
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
      id: 'rm-fri', thumbId: 'rm-fri', area: 'monterey', date: '2026-08-14', time: '17:30–', timeNote: { zh: '夜场拍卖', en: 'evening auction' },
      title: { zh: 'RM Sotheby’s · The Monterey Auction', en: 'RM Sotheby’s · The Monterey Auction' }, location: { zh: 'Monterey Conference Center · 1 Portola Plaza', en: 'Monterey Conference Center · 1 Portola Plaza' },
      summary: { zh: '周五 17:30 夜场；与 Werks、Quail、RMMR 高峰重叠，拍卖席对公众受限。', en: 'Friday evening from 17:30; overlaps peak Werks/Quail/RMMR hours, and the auction floor is restricted.' },
      why: { zh: '周五白天已被赛道或街展占满时，夜场只适合已注册竞拍人或在线观看；看车优先周三预展。', en: 'When Friday daytime is already booked with track or street shows, this evening is mainly for registered bidders or online viewing—preview Wednesday for car access.' },
      access: { zh: '拍卖厅：注册竞拍人、委托方、合格媒体。', en: 'Auction floor: registered bidders, consignors, qualified media.' },
      price: { zh: '预展 $60 周末通票 · 拍卖席受限', en: 'Preview $60 weekend pass · floor restricted' }, tags: ['paid'], categories: ['paid'], score: '3.5',
      source: 'https://www.rmsothebys.com/auctions/mo26/'
    },
    {
      id: 'lemons', thumbId: 'lemons', area: 'seaside', date: '2026-08-15', time: '08:00–13:30', timeNote: { zh: '时间为县旅游页所列', en: 'hours per county listing' },
      title: { zh: 'Concours d’Lemons', en: 'Concours d’Lemons' }, location: { zh: 'Seaside City Hall', en: 'Seaside City Hall' },
      summary: { zh: '用幽默对冲顶级车展的“烂车”评选；主办方确认免费，但 2026 详细时段尚未在主办方页发布。', en: 'A comic antidote to elite concours culture. The organizer confirms free admission, but has not posted detailed 2026 hours.' },
      why: { zh: '最亲民、最有记忆点的周六早晨，也能自然接上 Exotics on Broadway。', en: 'The funniest, most accessible Saturday morning and a natural lead-in to Exotics on Broadway.' },
      access: { zh: 'Seaside City Hall 草坪一带；08:00–13:30 来自县级活动页，不是主办方最终时刻表；临行前复核停车和时段。', en: 'Around Seaside City Hall lawn; 08:00–13:30 comes from a county listing, not the organizer’s final timetable—recheck hours and parking.' },
      price: { zh: '免费', en: 'Free' }, tags: ['free', 'subjectTag'], categories: ['essential', 'free'], score: '5.0',
      sources: [
        { url: 'https://24hoursoflemons.com/concours-d-lemons/', label: { zh: '主办方：免费入场 ↗', en: 'Organizer: free admission ↗' } },
        { url: 'https://www.seemonterey.com/event/concours-dlemons/', label: { zh: '县旅游页：所列时段 ↗', en: 'County listing: listed hours ↗' } }
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
      access: { zh: 'The Barnyard Shopping Village（3663 The Barnyard）；16+ GA，≤15 免费；品酒 21+。', en: 'The Barnyard Shopping Village (3663 The Barnyard); GA ages 16+, ≤15 free; wine tastings 21+.' },
      price: { zh: 'GA $80 + 费用（约 $86）', en: 'GA $80 + fees (~$86)' }, tags: ['paid'], categories: ['paid'], score: '3.5',
      sources: [
        { url: 'https://www.bigsurfoodandwine.org/popup-events/28th-annual-ferrari-event-at-the-barnyard', label: { zh: '主办方活动页 ↗', en: 'Organizer event page ↗' } },
        { url: 'https://bsfw.ticketsauce.com/e/ferrari-event-at-the-barnyard-6/tickets', label: { zh: '购票 ↗', en: 'Tickets ↗' } }
      ]
    },
    {
      id: 'exotics', thumbId: 'exotics', area: 'seaside', date: '2026-08-15', time: '11:00–16:00', timeNote: { zh: '接驳 9:00–17:00', en: 'shuttle 9:00–17:00' },
      title: { zh: 'Exotics on Broadway', en: 'Exotics on Broadway' }, location: { zh: 'Broadway Ave / Del Monte Blvd · Seaside', en: 'Broadway Ave / Del Monte Blvd · Seaside' },
      summary: { zh: 'Broadway 四街区免费；封闭 hypercar / vendor 区普通票 $40，VIP $375 起。', en: 'Four blocks of Broadway are free; the enclosed hypercar/vendor zone is $40 GA, with VIP from $375.' },
      why: { zh: '免费区 5/5，付费区 3/5；预算路线无需买票，就能与 Lemons 拼成完整一天。', en: 'The free zone is 5/5 and paid enclosure 3/5. The budget route needs no ticket and pairs cleanly with Lemons.' },
      access: { zh: 'General Jim Moore Blvd × Eucalyptus Rd 设免费远端停车与接驳，9:00–17:00。停车 FAQ 与 2026 票务页的场地用语尚未完全同步，临行前复核。', en: 'Free remote parking and shuttle at General Jim Moore Blvd/Eucalyptus Rd, 9:00–17:00. The parking FAQ is not fully synchronized with the 2026 ticket page’s venue wording, so recheck before departure.' },
      price: { zh: 'Broadway 免费 · 付费区 $40', en: 'Broadway free · paid zone $40' }, tags: ['mixedTag'], categories: ['essential', 'free', 'paid'], score: '5.0',
      sources: [
        { url: 'https://exoticsonbroadway.com/tickets/', label: { zh: '官方票务：2026 价格与 Del Monte 付费区 ↗', en: 'Official tickets: 2026 prices and Del Monte paid zone ↗' } },
        { url: 'https://exoticsonbroadway.com/knowbeforeyougo/', label: { zh: '官方出行页：停车与接驳 ↗', en: 'Official visitor page: parking and shuttle ↗' } }
      ]
    },
    {
      id: 'rmmr-sat', thumbId: 'rmmr-sat', area: 'laguna', date: '2026-08-15', time: '08:00–18:10', timeNote: { zh: '赛程会调整', en: 'schedule may change' },
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
      summary: { zh: '09:00 开放预展、11:00 开拍；同一张 $50 通票覆盖全部三天。', en: 'Viewing opens at 09:00 and the auction begins at 11:00; the same $50 pass covers all three days.' },
      why: { zh: '若周六主场在 Pebble Beach，这是比再买一张大型活动票更划算的附加项。', en: 'If Saturday’s anchor is Pebble Beach, this is a better-value add-on than another major show ticket.' },
      access: { zh: '信用卡购票；12 岁以下免费。访客从 Forest Lake Road 进入 Lot 12 停车；满位后启用 Alva Lane 的 Lot 8。', en: 'Credit-card admission; under 12 free. Visitor parking is in Lot 12 via Forest Lake Road; Lot 8 on Alva Lane opens if it fills.' },
      price: { zh: '$50 全活动入场', en: '$50 all-events admission' }, tags: ['paid'], categories: ['essential', 'paid'], score: '4.5',
      source: 'https://www.goodingco.com/auction/pebble-beach-auctions-2026/'
    },
    {
      id: 'mecum-sat', thumbId: 'mecum-sat', area: 'monterey', date: '2026-08-15', time: '09:00–', timeNote: { zh: '拍卖/区块', en: 'auction / blocks' },
      title: { zh: 'Mecum Monterey', en: 'Mecum Monterey' }, location: { zh: 'Hyatt Regency / Del Monte Golf Course · 1 Old Golf Course Rd', en: 'Hyatt Regency / Del Monte Golf Course · 1 Old Golf Course Rd' },
      summary: { zh: '周六 9:00 最后一日拍卖；与 Lemons、Exotics、Laguna Seca 完全冲突。', en: 'Saturday’s final day from 9:00; in direct conflict with Lemons, Exotics and Laguna Seca.' },
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
      summary: { zh: '晚间展演型活动；当前主办方页面写 $175 + $5 处理费，授权票务页仍显示 $189。', en: 'An evening festival; the organizer currently says $175 + a $5 processing fee, while the authorized seller still shows $189.' },
      why: { zh: '2.5/5 的可选夜场；除非演出内容特别对口，不优先于免费 Seaside 路线。', en: 'An optional 2.5/5 evening. Do not prioritize it over the free Seaside route unless the program is a specific draw.' },
      access: { zh: '当前官方停车页写 Gate 8 免费先到先得，Monterey Pines 为 overflow；价格与停车都应在购买和出发前复核。', en: 'The current organizer page says free first-come parking at Gate 8, with Monterey Pines as overflow. Recheck both price and parking before purchase and arrival.' },
      price: { zh: '主办方 $175 + $5 · 票务页 $189', en: 'Organizer $175 + $5 · seller $189' }, tags: ['paid', 'subjectTag'], categories: ['paid'], score: '2.5',
      sources: [
        { url: 'https://montereymotorsportsfestival.com/get-tickets/', label: { zh: '主办方票页：$175 + $5 ↗', en: 'Organizer tickets: $175 + $5 ↗' } },
        { url: 'https://montereymotorsportsfestival.saffire.com/p/tickets', label: { zh: '授权票务：$189 ↗', en: 'Authorized seller: $189 ↗' } },
        { url: 'https://montereymotorsportsfestival.com/general-info/', label: { zh: '主办方停车说明 ↗', en: 'Organizer parking information ↗' } }
      ]
    },
    {
      id: 'rm-sat', thumbId: 'rm-sat', area: 'monterey', date: '2026-08-15', time: '17:30–', timeNote: { zh: '夜场拍卖；15:00 Concierge', en: 'evening auction; 15:00 Concierge' },
      title: { zh: 'RM Sotheby’s · The Monterey Auction', en: 'RM Sotheby’s · The Monterey Auction' }, location: { zh: 'Monterey Conference Center · 1 Portola Plaza', en: 'Monterey Conference Center · 1 Portola Plaza' },
      summary: { zh: '周六 17:30 收官夜场；15:00 另有 Concierge 场次。拍卖席对公众受限。', en: 'Saturday finale from 17:30, plus a 15:00 Concierge session. Auction floor is restricted.' },
      why: { zh: '与 MMF、Exotics 晚间时段冲突；未注册竞拍人更适合在线观看或改看白天 Mecum/Gooding。', en: 'Conflicts with MMF and Exotics evening windows; unregistered visitors are better served online or at daytime Mecum/Gooding.' },
      access: { zh: '拍卖厅：注册竞拍人、委托方、合格媒体；Concierge 场次规则见官方页。', en: 'Auction floor: registered bidders, consignors, qualified media; see official page for Concierge rules.' },
      price: { zh: '预展 $60 周末通票 · 拍卖席受限', en: 'Preview $60 weekend pass · floor restricted' }, tags: ['paid'], categories: ['paid'], score: '3.5',
      source: 'https://www.rmsothebys.com/auctions/mo26/'
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

  /* Nominatim-verified coordinates for quick-plan day maps (2026-08-06). */
  mapPlaces: {
    alvarado: { lat: 36.59931, lng: -121.89455, name: { zh: '阿尔瓦拉多街 · 蒙特雷', en: 'Alvarado St · Monterey' } },
    asilomar: { lat: 36.61923, lng: -121.93739, name: { zh: 'Asilomar 会议中心', en: 'Asilomar Conference Grounds' } },
    laguna: { lat: 36.58441, lng: -121.75339, name: { zh: 'WeatherTech Raceway Laguna Seca', en: 'WeatherTech Raceway Laguna Seca' } },
    carmel: { lat: 36.55514, lng: -121.92271, name: { zh: '海洋大道 · 卡梅尔', en: 'Ocean Ave · Carmel' } },
    lighthouse: { lat: 36.61677, lng: -121.90602, name: { zh: '灯塔大道 · 太平洋丛林', en: 'Lighthouse Ave · Pacific Grove' } },
    portola: { lat: 36.57324, lng: -121.95446, name: { zh: 'Portola Rd · 圆石滩', en: 'Portola Rd · Pebble Beach' } },
    village: { lat: 36.58230, lng: -121.94987, name: { zh: 'Concours Village · 圆石滩', en: 'Concours Village · Pebble Beach' } },
    werks: { lat: 36.59040, lng: -121.86216, name: { zh: 'Monterey Pines / Werks', en: 'Monterey Pines / Werks' } },
    lemons: { lat: 36.60356, lng: -121.85355, name: { zh: 'Seaside 市政厅 / Lemons', en: 'Seaside City Hall / Lemons' } },
    exotics: { lat: 36.60904, lng: -121.83800, name: { zh: 'Broadway Ave · Seaside', en: 'Broadway Ave · Seaside' } },
    pebble: { lat: 36.56966, lng: -121.94974, name: { zh: 'Pebble Beach Golf Links', en: 'Pebble Beach Golf Links' } },
    stanton: { lat: 36.60269, lng: -121.89343, name: { zh: 'Stanton Center · 蒙特雷', en: 'Stanton Center · Monterey' } },
    pgolf: { lat: 36.63084, lng: -121.92860, name: { zh: 'Pacific Grove Golf Links', en: 'Pacific Grove Golf Links' } },
    embassy: { lat: 36.60670, lng: -121.85560, name: { zh: 'Embassy Suites · Seaside / ACE', en: 'Embassy Suites · Seaside / ACE' } },
    jetcenter: { lat: 36.58934, lng: -121.85961, name: { zh: 'Monterey Jet Center', en: 'Monterey Jet Center' } },
    bayonet: { lat: 36.62759, lng: -121.82266, name: { zh: 'Bayonet Black Horse · Seaside', en: 'Bayonet Black Horse · Seaside' } }
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
    { label: { zh: 'Broad Arrow · The Quail Auction', en: 'Broad Arrow · The Quail Auction' }, url: 'https://www.broadarrowauctions.com/events/event/The%20Quail%20Auction%202026' },
    { label: { zh: 'The Paddock Monterey · TicketSpice', en: 'The Paddock Monterey · TicketSpice' }, url: 'https://concorso.ticketspice.com/international-car-week' },
    { label: { zh: 'Central Coast Poker Rally', en: 'Central Coast Poker Rally' }, url: 'https://centralcoastpokerrally.com/itinerary/' },
    { label: { zh: 'Ferrari Event at The Barnyard', en: 'Ferrari Event at The Barnyard' }, url: 'https://www.bigsurfoodandwine.org/popup-events/28th-annual-ferrari-event-at-the-barnyard' },
    { label: { zh: 'The Little Car Show', en: 'The Little Car Show' }, url: 'https://www.thelittlecarshow.com/' },
    { label: { zh: 'Asilomar · Car Week 活动', en: 'Asilomar · Car Week events' }, url: 'https://www.visitasilomar.com/things-to-do/car-week' },
    { label: { zh: 'Pre-Reunion · 官方票务', en: 'Pre-Reunion · official tickets' }, url: 'https://tickets.weathertechraceway.com/event/2-day-grounds-and-paddock-pass-monterey-pre-reunion--corkscrew-hillclimb---august-8-9-2026' },
    { label: { zh: 'Santa Cruz Woodies · Woodies in the Woods', en: 'Santa Cruz Woodies · Woodies in the Woods' }, url: 'https://www.santacruzwoodies.com/august-14-2025-woodies-in-the-woods/' },
    { label: { zh: 'HOLO-FEST 2.0 · Eventbrite', en: 'HOLO-FEST 2.0 · Eventbrite' }, url: 'https://www.eventbrite.com/e/july-31-aug-2nd-holo-fest-20-featuring-jerry-garcia-b-day-bash-and-more-tickets-1993501930939' },
    { label: { zh: 'Watsonville Strawberry Festival', en: 'Watsonville Strawberry Festival' }, url: 'https://www.watsonville.gov/1117/Watsonville-Strawberry-Festival' },
    { label: { zh: 'Pebble Beach Concours · 周日主展', en: 'Pebble Beach Concours · Sunday show' }, url: 'https://www.pebblebeachconcours.net/event/pebble-beach-concours-delegance/' },
    { label: { zh: 'Tour d’Elegance · 官方日程', en: 'Tour d’Elegance · official schedule' }, url: 'https://www.pebblebeachconcours.net/event/pebble-beach-tour-delegance/' },
    { label: { zh: 'Village / 展示与试驾日程', en: 'Village / displays and drives' }, url: 'https://www.pebblebeachconcours.net/displays-and-ride-amp-drive-schedule/' },
    { label: { zh: 'Concours 门票商店', en: 'Concours official ticket store' }, url: 'https://theconcoursstore.com/collections/tickets' },
    { label: { zh: 'Pebble Beach 停车与接驳', en: 'Pebble Beach parking and shuttles' }, url: 'https://www.pebblebeachconcours.net/plan-your-visit/directions-parking-event-maps/' },
    { label: { zh: '17-Mile Drive 活动周关闭', en: '17-Mile Drive Car Week closure' }, url: 'https://www.pebblebeach.com/17-mile-drive/' },
    { label: { zh: 'Rolex Reunion · Laguna Seca', en: 'Rolex Reunion · Laguna Seca' }, url: 'https://weathertechraceway.com/pages/rolex-monterey-motorsports-reunion' },
    { label: { zh: 'Werks Reunion · Monterey', en: 'Werks Reunion · Monterey' }, url: 'https://www.werksreunion.com/monterey.cfm' },
    { label: { zh: 'Exotics on Broadway · 到场须知', en: 'Exotics on Broadway · know before you go' }, url: 'https://exoticsonbroadway.com/knowbeforeyougo/' },
    { label: { zh: 'Gooding Christie’s · Pebble Beach', en: 'Gooding Christie’s · Pebble Beach' }, url: 'https://www.goodingco.com/auction/pebble-beach-auctions-2026/' },
    { label: { zh: 'Mecum Monterey 2026', en: 'Mecum Monterey 2026' }, url: 'https://www.mecum.com/auctions/monterey-2026/' },
    { label: { zh: 'RM Sotheby’s Monterey 2026', en: 'RM Sotheby’s Monterey 2026' }, url: 'https://www.rmsothebys.com/auctions/mo26/' },
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
