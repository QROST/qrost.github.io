'use strict';

(function () {
  const bilingual = (zh, en) => ({ zh, en });
  const checkedOn = '2026-08-21';

  window.PEBBLE_2027_DATA = {
    schemaVersion: 2,
    year: 2027,
    status: 'partial',
    initializedOn: '2026-08-21',
    factsCheckedOn: checkedOn,
    confirmedEventCount: 7,
    provenance: {
      scope: 'official-current-year-only',
      checkedOn,
      note: bilingual(
        '只收录明确标注 2027 的 Pebble Beach Concours 官方页面；旧年地图、路线、价格和品牌安排不跨年复制。',
        'Only official Pebble Beach Concours pages that explicitly identify 2027 are admitted; prior-year maps, routes, prices, and brand programs are never carried forward.'
      )
    },
    meta: {
      title: bilingual('Pebble Beach 2027 初步规划 · 官方日期已确认 | QROST', 'Pebble Beach 2027 early guide · official dates confirmed | QROST'),
      description: bilingual('Pebble Beach 2027 独立双语规划页：已核实 7 项官方 signature event 日期及少量 Tour、门票、停车与接驳信息；路线图、票价、品牌活动和住宿仍待发布。', 'An independent bilingual Pebble Beach 2027 guide with seven official signature-event date ranges and limited Tour, ticket, parking, and shuttle facts verified. Route maps, prices, brand programs, and stays remain pending.'),
      imageAlt: bilingual('Pebble Beach 2027 初步规划，官方日历已就位，路线与票价仍待发布', 'Pebble Beach 2027 early guide with the official calendar recorded and routes and prices still pending')
    },
    archive: {
      year: 2026,
      href: '../pebble-beach-2026/',
      label: bilingual('打开 2026 完整档案', 'Open the complete 2026 archive')
    },
    labels: {
      skip: bilingual('跳到正文', 'Skip to content'),
      home: bilingual('返回 QROST 首页', 'Back to QROST home'),
      navStatus: bilingual('已知与待补', 'Known & pending'),
      navFramework: bilingual('沿用框架', 'Framework'),
      navWatchlist: bilingual('官方来源', 'Official sources'),
      navArchive: bilingual('2026 档案', '2026 archive'),
      navMenu: bilingual('章节', 'Sections'),
      navMenuOpen: bilingual('打开章节菜单', 'Open section menu'),
      navMenuClose: bilingual('关闭章节菜单', 'Close section menu'),
      navBackTop: bilingual('回到顶部', 'Back to top'),
      navAria: bilingual('主要导航', 'Primary navigation'),
      navSectionsAria: bilingual('页面章节', 'Page sections'),
      bannerAria: bilingual('2027 页面状态', '2027 page status'),
      boardAria: bilingual('规划状态概览', 'Planning status overview'),
      kpiAria: bilingual('规划状态摘要', 'Planning status summary'),
      langToggle: bilingual('Switch to English', '切换为中文'),
      themeLight: bilingual('切换为浅色模式', 'Switch to light mode'),
      themeDark: bilingual('切换为深色模式', 'Switch to dark mode'),
      heroEyebrow: bilingual('2027 · 初步规划', '2027 · early guide'),
      heroChip: bilingual('7 项官方活动日期已确认', '7 official event ranges confirmed'),
      heroTitle: bilingual('Pebble Beach 2027', 'Pebble Beach 2027'),
      heroSubtitle: bilingual('官方日期已就位，出行细节继续等待', 'Official dates are in; travel details are still developing'),
      heroLead: bilingual(
        '2026 版本已经整体归档。2027 官方日历现已列出 7 项 signature events；Tour 基础时段、部分准入、停车和接驳规则也已记录。尚未发布的路线图、票价、品牌 House 与住宿继续保持占位，不从旧版推断。',
        'The 2026 edition is archived in full. The official 2027 calendar now lists seven signature events, and a limited baseline for the Tour, access, parking, and shuttles is recorded. Unpublished route maps, prices, brand houses, and stays remain placeholders and are not inferred from the prior edition.'
      ),
      heroPrimary: bilingual('查看已知与待补', 'Review known and pending'),
      heroSecondary: bilingual('打开 2026 档案', 'Open the 2026 archive'),
      heroFineprint: bilingual(
        '本页仍不完整；购票、导航或预订前请打开对应官方原始来源复核。',
        'This guide remains incomplete; open the linked primary source before buying, navigating, or booking.'
      ),
      boardTitle: bilingual('年度数据闸门', 'Annual data gates'),
      boardBody: bilingual('已确认事实与待发布内容分开呈现；模块只有完整后才会升级为“已确认”。', 'Confirmed facts and unpublished details stay separate; a module becomes “confirmed” only when it is complete.'),
      boardReady: bilingual('页面基础设施', 'Page infrastructure'),
      boardReadyValue: bilingual('已就绪', 'Ready'),
      boardPending: bilingual('年度事实模块', 'Annual fact modules'),
      boardPendingValue: bilingual('5 部分确认 · 2 待核实', '5 partial · 2 pending'),
      boardArchive: bilingual('历史参考', 'Historical reference'),
      boardArchiveValue: bilingual('2026 已归档', '2026 archived'),
      kpiEvents: bilingual('项官方活动日期', 'official event ranges'),
      kpiPartial: bilingual('个模块部分确认', 'partially confirmed modules'),
      kpiUnpublished: bilingual('份路线图或票价', 'route maps or prices published here'),
      kpiArchive: bilingual('历史版本可回看', 'historical edition retained'),
      statusKicker: bilingual('Current state · 当前状态', 'Current state · 当前状态'),
      statusTitle: bilingual('先看已知，再看仍缺什么', 'See what is known, then what is still missing'),
      statusIntro: bilingual(
        '卡片默认保持折叠，只显示当前结论。展开后可查看已核实事实、官方来源和仍待补齐的字段，避免未完成信息吞噬注意力。',
        'Cards stay folded by default and lead with the current conclusion. Expand one for verified facts, official sources, and the remaining gaps without letting incomplete detail dominate the page.'
      ),
      pendingBadge: bilingual('待核实', 'Pending'),
      partialBadge: bilingual('部分确认', 'Partial'),
      confirmedBadge: bilingual('已确认', 'Confirmed'),
      moduleExpand: bilingual('展开事实与待补项', 'Expand facts and gaps'),
      moduleKnown: bilingual('当前已确认', 'Confirmed so far'),
      moduleDates: bilingual('官方 Signature Events', 'Official signature events'),
      moduleNeeds: bilingual('仍待发布 / 核实', 'Still pending'),
      moduleSources: bilingual('原始来源', 'Primary sources'),
      checkedLabel: bilingual('核实日期', 'Checked'),
      frameworkKicker: bilingual('Reusable infrastructure · 可复用基础', 'Reusable infrastructure · 可复用基础'),
      frameworkTitle: bilingual('沿用体验，年度事实逐项重建', 'Keep the experience; rebuild annual facts one by one'),
      frameworkIntro: bilingual(
        '视觉、双语、深色模式、折叠、键盘操作和验证工具可以跨年复用；会影响出行判断的内容必须按年份重新核实。',
        'Visual design, bilingual controls, dark mode, disclosures, keyboard behavior, and validation tooling carry forward; anything that affects a travel decision must be reverified for the new year.'
      ),
      reusableTitle: bilingual('继续沿用', 'Carries forward'),
      resetTitle: bilingual('每年重新核实', 'Reverified yearly'),
      watchKicker: bilingual('Official sources · 官方来源', 'Official sources · 官方来源'),
      watchTitle: bilingual('证据页与后续监测入口', 'Evidence pages and future watchpoints'),
      watchIntro: bilingual(
        '标记为“2027 证据”的页面支持当前已知事实；Updates 仅作为后续监测入口。所有来源均在 2026-08-21 复核。',
        'Pages marked “2027 evidence” support the facts currently shown; Updates remains a future watchpoint only. Every source was checked on 2026-08-21.'
      ),
      sourceOpen: bilingual('打开官方页面 ↗', 'Open official page ↗'),
      sourceEvidence: bilingual('2027 证据', '2027 evidence'),
      sourceWatchpoint: bilingual('后续监测', 'Watchpoint'),
      archiveKicker: bilingual('Historical edition · 历史版本', 'Historical edition · 历史版本'),
      archiveTitle: bilingual('2026 内容原样保留，单独查阅', 'The 2026 edition remains available as a separate archive'),
      archiveBody: bilingual(
        '旧版的日程、Tour 路线、停车图、品牌活动、票价与旅行判断只属于 2026。它们没有被复制到 2027 数据层。',
        'The old schedule, Tour route, parking diagrams, brand programs, prices, and travel judgments belong to 2026 only. None were copied into the 2027 data layer.'
      ),
      archiveAction: bilingual('进入 2026 完整档案', 'Enter the complete 2026 archive'),
      footerTagline: bilingual('Pebble Beach 2027 独立初步规划。', 'An independent early guide to Pebble Beach 2027.'),
      footerDisclaimer: bilingual(
        '2027 日历与少量基础事实已核实，但路线、票价及多项出行细节仍未发布。非官方、非主办方关联；行动前请回查原始来源。',
        'The 2027 calendar and a limited baseline are verified, but routes, prices, and many travel details remain unpublished. Independent and unaffiliated; check primary sources before acting.'
      ),
      contact: bilingual('联系', 'Contact'),
      initialized: bilingual('初步事实核实于 2026-08-21', 'Initial facts checked 2026-08-21')
    },
    confirmedEvents: [
      {
        id: 'motoring-classic',
        title: bilingual('Pebble Beach Motoring Classic', 'Pebble Beach Motoring Classic'),
        startDate: '2027-08-02', endDate: '2027-08-11',
        dateLabel: bilingual('8 月 2–11 日', 'Aug 2–11'),
        details: bilingual('8/2 集结、8/3 出发、8/11 抵达 Casa Palmero；两个官方页面分别写 Seattle / 4:00 PM 与 Kirkland / 4:30 PM，且均提示时间可能调整，出发前须再确认。', 'Gathers Aug 2, departs Aug 3, and reaches Casa Palmero Aug 11. Two official pages conflict—Seattle / 4:00 PM versus Kirkland / 4:30 PM—and both say timing may change, so recheck before acting.'),
        sourceIds: ['official-calendar', 'official-motoring-event', 'official-motoring-info'], checkedOn
      },
      {
        id: 'pebble-beach-auctions',
        title: bilingual('Pebble Beach Auctions', 'Pebble Beach Auctions'),
        startDate: '2027-08-11', endDate: '2027-08-14',
        dateLabel: bilingual('8 月 11–14 日', 'Aug 11–14'),
        details: bilingual('预展：8/11 10:00 AM–6:00 PM、8/12 9:00 AM–6:00 PM、8/13 9:00 AM–9:00 PM、8/14 9:00 AM–5:00 PM；拍卖：8/13 4:00 PM、8/14 11:00 AM。', 'Viewing: Aug 11 10:00 AM–6:00 PM, Aug 12 9:00 AM–6:00 PM, Aug 13 9:00 AM–9:00 PM, and Aug 14 9:00 AM–5:00 PM; auctions: Aug 13 at 4:00 PM and Aug 14 at 11:00 AM.'),
        sourceIds: ['official-calendar', 'official-auctions'], checkedOn
      },
      {
        id: 'tour-delegance',
        title: bilingual('Pebble Beach Tour d’Elegance', 'Pebble Beach Tour d’Elegance'),
        startDate: '2027-08-12', endDate: '2027-08-12',
        dateLabel: bilingual('8 月 12 日（周四）', 'Thu, Aug 12'),
        details: bilingual('7:00 AM 集结，9:30 AM 发车，约 12:00 PM 返回；时间可能调整。', 'Lineup at 7:00 AM, departure at 9:30 AM, return around 12:00 PM; times are subject to change.'),
        sourceIds: ['official-calendar', 'official-tour'], checkedOn
      },
      {
        id: 'retroauto',
        title: bilingual('Pebble Beach RetroAuto', 'Pebble Beach RetroAuto'),
        startDate: '2027-08-12', endDate: '2027-08-15',
        dateLabel: bilingual('8 月 12–15 日', 'Aug 12–15'),
        details: bilingual('周四 8:00 AM–6:00 PM；周五至周六 9:00 AM–6:00 PM；周日 8:00 AM–6:00 PM。', 'Thu 8:00 AM–6:00 PM; Fri–Sat 9:00 AM–6:00 PM; Sun 8:00 AM–6:00 PM.'),
        sourceIds: ['official-calendar', 'official-retroauto'], checkedOn
      },
      {
        id: 'classic-car-forum',
        title: bilingual('Pebble Beach Classic Car Forum', 'Pebble Beach Classic Car Forum'),
        startDate: '2027-08-12', endDate: '2027-08-14',
        dateLabel: bilingual('8 月 12–14 日', 'Aug 12–14'),
        sourceIds: ['official-calendar', 'official-forum'], checkedOn
      },
      {
        id: 'concours-village',
        title: bilingual('Concours Village', 'Concours Village'),
        startDate: '2027-08-12', endDate: '2027-08-15',
        dateLabel: bilingual('8 月 12–15 日', 'Aug 12–15'),
        details: bilingual('周四 8:00 AM–6:00 PM；周五至周六 9:00 AM–6:00 PM；周日 8:00 AM–6:00 PM，公众免费开放。', 'Thu 8:00 AM–6:00 PM; Fri–Sat 9:00 AM–6:00 PM; Sun 8:00 AM–6:00 PM, open to the public at no cost.'),
        sourceIds: ['official-calendar', 'official-village'], checkedOn
      },
      {
        id: 'concours-delegance',
        title: bilingual('Pebble Beach Concours d’Elegance', 'Pebble Beach Concours d’Elegance'),
        startDate: '2027-08-15', endDate: '2027-08-15',
        dateLabel: bilingual('8 月 15 日（周日）', 'Sun, Aug 15'),
        details: bilingual('5:30 AM 持证观众入场；8:00 AM 评审开始；1:30–5:00 PM 颁奖与直播。', 'Credentialed spectator entry at 5:30 AM; judging at 8:00 AM; awards and live show 1:30–5:00 PM.'),
        sourceIds: ['official-calendar', 'official-concours'], checkedOn
      }
    ],
    modules: [
      {
        id: 'calendar', icon: '01',
        title: bilingual('日期与逐日日程', 'Dates and daily schedule'),
        summary: bilingual('7 项官方 signature event 日期与部分时段已记录；完整逐日计划仍待补。', 'Seven official signature-event ranges and selected hours are recorded; a complete day-by-day plan remains pending.'),
        status: 'partial',
        facts: [{
          text: bilingual('官方日历目前覆盖 8 月 2 日至 15 日的 7 项 signature events；下方按开始日期连续排列。', 'The official calendar currently spans seven signature events from August 2 through 15, shown below in start-date order.'),
          sourceIds: ['official-calendar'], checkedOn
        }],
        needs: [
          bilingual('各活动完整开放时段、地点与公众准入', 'Complete hours, venues, and public access for each event'),
          bilingual('同日活动的可执行连续时间表', 'An actionable chronological plan for overlapping events'),
          bilingual('新增活动与临时变更的持续复核', 'Ongoing checks for added events and schedule changes')
        ],
        sourceIds: ['official-calendar', 'official-home', 'official-updates']
      },
      {
        id: 'tour', icon: '02',
        title: bilingual('Tour d’Elegance', 'Tour d’Elegance'),
        summary: bilingual('8 月 12 日基础时段与起终点已确认；2027 路线图仍待发布。', 'The August 12 baseline and start/finish are confirmed; the 2027 route map remains pending.'),
        status: 'partial',
        facts: [
          {
            text: bilingual('车辆在 7:00 AM 前开始于 Portola Road 集结；9:30 AM 发车，约 12:00 PM 返回。官方注明时间为约数、可能调整。', 'Cars begin lining up on Portola Road before 7:00 AM, depart at 9:30 AM, and return around 12:00 PM. Official times are approximate and subject to change.'),
            sourceIds: ['official-tour'], checkedOn
          },
          {
            text: bilingual('公众可在若干观看点免费观看；当前页面尚未据此推断具体沿途点位。', 'The public may watch without fee at several points; this guide does not yet infer specific roadside locations.'),
            sourceIds: ['official-tour'], checkedOn
          }
        ],
        needs: [
          bilingual('明确标注 2027 的官方路线图与更新通知', 'An official route map and update notice explicitly marked 2027'),
          bilingual('经确认的观看点、步行关系与安全边界', 'Verified viewing points, walkability, and safety boundaries'),
          bilingual('临近活动日再次复核时段与交通安排', 'A near-event recheck of timing and traffic arrangements')
        ],
        sourceIds: ['official-tour', 'official-directions', 'official-updates']
      },
      {
        id: 'tickets', icon: '03',
        title: bilingual('门票、预约与准入', 'Tickets, reservations, and access'),
        summary: bilingual('开售窗口与部分公众准入已说明；具体票价尚未发布。', 'The sales window and some public-access rules are stated; specific prices remain unpublished.'),
        status: 'partial',
        facts: [
          {
            text: bilingual('Concours 官方票务页称 2027 门票将在 2026 年末开售，尚未列出价格。', 'The official ticket page says 2027 Concours tickets will become available in late 2026; prices are not listed yet.'),
            sourceIds: ['official-tickets'], checkedOn
          },
          {
            text: bilingual('Classic Car Forum 面向公众，但需要预先注册，费用因场次而异。', 'The Classic Car Forum is open to the public, but preregistration is required and cost varies.'),
            sourceIds: ['official-forum'], checkedOn
          },
          {
            text: bilingual('Concours Village、赞助商展示与 Merchandise Pavilion 在 8 月 12–15 日向公众免费开放。', 'Concours Village, sponsor displays, and the Merchandise Pavilion are open to the public at no cost August 12–15.'),
            sourceIds: ['official-directions'], checkedOn
          }
        ],
        needs: [
          bilingual('各票种基础价格、费用与销售链接', 'Base prices, fees, and sales links for each ticket type'),
          bilingual('售罄、候补、转让与退款规则', 'Sellout, waitlist, transfer, and refund rules'),
          bilingual('各活动免费、需票或受邀准入的完整矩阵', 'A complete free, ticketed, and invitation-only access matrix')
        ],
        sourceIds: ['official-tickets', 'official-forum', 'official-directions', 'official-updates']
      },
      {
        id: 'parking', icon: '04',
        title: bilingual('停车、地图与交通管制', 'Parking, maps, and traffic controls'),
        summary: bilingual('官方文字规则已记录；2027 停车图与真实地理图层仍未收入。', 'Official text guidance is recorded; no 2027 parking diagram or geographic layer is admitted yet.'),
        status: 'partial',
        facts: [
          {
            text: bilingual('Tour 起终点在 Portola Road；进入 Pebble Beach 后应按指示牌前往附近停车区。', 'The Tour starts and finishes on Portola Road; once inside Pebble Beach, follow directional signage to nearby parking areas.'),
            sourceIds: ['official-directions'], checkedOn
          },
          {
            text: bilingual('Concours 周日普通票观众应服从现场停车指挥，再乘接驳车前往活动区。', 'On Concours Sunday, General Admission guests should park as directed and use the provided shuttle to the event.'),
            sourceIds: ['official-directions'], checkedOn
          },
          {
            text: bilingual('无障碍停车：8 月 12–14 日为 Portola Road 附近 Lot 9；8 月 15 日为 Bird Rock，均须按 ADA 指示。', 'ADA parking is listed at Lot 9 off Portola Road on August 12–14 and at Bird Rock on August 15; follow ADA signage.'),
            sourceIds: ['official-directions'], checkedOn
          }
        ],
        needs: [
          bilingual('确认下载文件明确标注 2027 后，再收入官方停车示意图', 'Admit an official parking diagram only after its download is explicitly marked 2027'),
          bilingual('单独建立并人工校准真实地理底图', 'Build and manually calibrate a separate geographic basemap'),
          bilingual('普通、VIP、无障碍与活动专用停车的完整边界', 'Complete boundaries for General, VIP, ADA, and event-specific parking')
        ],
        sourceIds: ['official-directions', 'official-updates']
      },
      {
        id: 'brands', icon: '05',
        title: bilingual('品牌 House 与公众体验', 'Brand houses and public experiences'),
        summary: bilingual('2027 品牌名单、试驾与 hospitality 尚未发布。', 'The 2027 brand lineup, drives, and hospitality programs are not yet published.'),
        status: 'placeholder', facts: [],
        needs: [
          bilingual('明确标注 2027 的官方品牌展示与 Ride & Drive 日程', 'An official 2027 display and Ride & Drive schedule'),
          bilingual('公众体验与私人 hospitality 分栏', 'Separate public experiences from private hospitality'),
          bilingual('日期、准入、驾驶资格与停车说明', 'Dates, access, driver eligibility, and parking')
        ],
        sourceIds: ['official-calendar', 'official-updates']
      },
      {
        id: 'stay', icon: '06',
        title: bilingual('住宿与价格快照', 'Stay and price snapshot'),
        summary: bilingual('没有录入 2027 房价、库存或预订建议。', 'No 2027 room prices, inventory, or booking advice is recorded.'),
        status: 'placeholder', facts: [],
        needs: [
          bilingual('明确入住日期与可取消条件', 'Explicit stay dates and cancellation terms'),
          bilingual('同一时点、同一口径的价格快照', 'A same-time, like-for-like price snapshot'),
          bilingual('住宿位置与活动日通勤取舍', 'Location and event-day travel tradeoffs')
        ],
        sourceIds: ['official-home', 'official-directions']
      },
      {
        id: 'commute', icon: '07',
        title: bilingual('通勤、接驳与道路状态', 'Travel, shuttles, and road status'),
        summary: bilingual('活动周道路准入与周日接驳基线已确认；实时行车时间仍待临近复核。', 'Event-week road access and Sunday shuttle basics are confirmed; live travel times await a near-event check.'),
        status: 'partial',
        facts: [
          {
            text: bilingual('8 月 12–15 日，17-Mile Drive 对非 Concours 相关车流关闭；相关活动访客、居民及正常通行证持有人仍可按规则进入。', 'From August 12–15, 17-Mile Drive is closed to non-Concours-related traffic; event visitors, residents, and normal pass holders remain eligible for access under the stated rules.'),
            sourceIds: ['official-directions'], checkedOn
          },
          {
            text: bilingual('Concours 周日网约车上下客统一引导至 Concours Village。', 'On Concours Sunday, rideshare pickup and drop-off is directed to Concours Village.'),
            sourceIds: ['official-directions'], checkedOn
          },
          {
            text: bilingual('8 月 15 日可从 Carmel Plaza 乘收费接驳前往 Concours，车票可提前或当天购买。', 'On August 15, a paid shuttle runs from Carmel Plaza to the Concours, with passes sold in advance or on the day.'),
            sourceIds: ['official-directions'], checkedOn
          }
        ],
        needs: [
          bilingual('活动日入口、临时改道与接驳班次', 'Event-day gates, temporary detours, and shuttle frequency'),
          bilingual('普通时段与活动时段的实测行车时间', 'Measured travel times for normal and event conditions'),
          bilingual('临行前道路、天气与突发更新复核', 'Pre-departure checks for roads, weather, and urgent updates')
        ],
        sourceIds: ['official-directions', 'official-updates']
      }
    ],
    framework: {
      reusable: [
        bilingual('双语、深色模式与无障碍交互', 'Bilingual, dark-mode, and accessible interactions'),
        bilingual('当前优先、历史折叠与连续日期排序', 'Current-first display, folded history, and chronological ordering'),
        bilingual('官方示意图与真实地图的独立图层', 'Separate official-diagram and geographic-map layers'),
        bilingual('数据验证、缓存戳与公开元数据检查', 'Data validation, cache tokens, and public-metadata checks')
      ],
      reset: [
        bilingual('活动日期、时段与先后顺序', 'Event dates, hours, and sequence'),
        bilingual('票价、库存、预约与准入规则', 'Prices, inventory, reservations, and access rules'),
        bilingual('路线、停车、道路管制与接驳', 'Routes, parking, traffic controls, and shuttles'),
        bilingual('品牌活动、住宿价格与通勤判断', 'Brand programs, stay prices, and travel judgments')
      ]
    },
    sources: [
      { id: 'official-home', label: bilingual('Pebble Beach Concours 官方首页', 'Pebble Beach Concours official home'), url: 'https://www.pebblebeachconcours.net/', role: 'evidence', checkedOn },
      { id: 'official-calendar', label: bilingual('官方 Event Calendar', 'Official Event Calendar'), url: 'https://www.pebblebeachconcours.net/event-calendar/', role: 'evidence', checkedOn },
      { id: 'official-tour', label: bilingual('Tour d’Elegance 官方活动页', 'Official Tour d’Elegance event page'), url: 'https://www.pebblebeachconcours.net/event/pebble-beach-tour-delegance/', role: 'evidence', checkedOn },
      { id: 'official-tickets', label: bilingual('官方 Tickets 页面', 'Official Tickets page'), url: 'https://www.pebblebeachconcours.net/plan-your-visit/tickets/', role: 'evidence', checkedOn },
      { id: 'official-forum', label: bilingual('Classic Car Forum 官方活动页', 'Official Classic Car Forum event page'), url: 'https://www.pebblebeachconcours.net/event/pebble-beach-classic-car-forum/', role: 'evidence', checkedOn },
      { id: 'official-directions', label: bilingual('官方 Directions、Parking 与 Maps', 'Official directions, parking, and maps'), url: 'https://www.pebblebeachconcours.net/plan-your-visit/directions-parking-event-maps/', role: 'evidence', checkedOn },
      { id: 'official-updates', label: bilingual('官方 Updates（后续监测）', 'Official Updates (future watchpoint)'), url: 'https://www.pebblebeachconcours.net/updates/', role: 'watchpoint', checkedOn },
      { id: 'official-motoring-event', label: bilingual('Motoring Classic 官方公开活动页', 'Official Motoring Classic public event page'), url: 'https://www.pebblebeachconcours.net/event/pebble-beach-motoring-classic/', role: 'evidence', checkedOn, watchlist: false },
      { id: 'official-motoring-info', label: bilingual('Motoring Classic 官方行程信息', 'Official Motoring Classic schedule'), url: 'https://www.pebblebeachconcours.net/participants/pebble-beach-motoring-classic-information/', role: 'evidence', checkedOn, watchlist: false },
      { id: 'official-auctions', label: bilingual('Pebble Beach Auctions 官方活动页', 'Official Pebble Beach Auctions event page'), url: 'https://www.pebblebeachconcours.net/event/pebble-beach-auctions-presented-by-gooding-company-2/', role: 'evidence', checkedOn, watchlist: false },
      { id: 'official-retroauto', label: bilingual('RetroAuto 官方活动页', 'Official RetroAuto event page'), url: 'https://www.pebblebeachconcours.net/event/pebble-beach-retroauto/', role: 'evidence', checkedOn, watchlist: false },
      { id: 'official-village', label: bilingual('Concours Village 官方活动页', 'Official Concours Village event page'), url: 'https://www.pebblebeachconcours.net/event/concours-village/', role: 'evidence', checkedOn, watchlist: false },
      { id: 'official-concours', label: bilingual('Concours d’Elegance 官方活动页', 'Official Concours d’Elegance event page'), url: 'https://www.pebblebeachconcours.net/event/pebble-beach-concours-delegance/', role: 'evidence', checkedOn, watchlist: false }
    ]
  };
})();
