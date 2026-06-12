/**
 * Bilingual UI: English stays in HTML; ZH strings applied when lang === 'zh'.
 * Dispatches window event 'china-biz-lang-change' with { lang: 'en'|'zh' }.
 */
(function () {
    const STORAGE_KEY = 'china-biz-lang';

    const ZH = {
        'meta.title': '如何在中国开公司 — WFOE 设立与 AEC 用工成本 | QROST',

        'nav.setup': '设置',
        'nav.regions': '区域',
        'nav.financials': '财务',
        'nav.skip': '跳到正文',
        'nav.menu_open': '打开菜单',
        'nav.menu_close': '关闭菜单',
        'lang.to_zh': '中文',
        'lang.to_en': 'English',

        'hero.h1': '如何在中国开公司',
        'hero.lead': '关于<strong class="font-medium text-slate-800">在中国开公司</strong>与<strong class="font-medium text-slate-800">大致成本预期</strong>的整理性研究。请用各标签查看不同地区设立流程，在财务板块做<strong class="font-medium text-slate-800">24 个城市</strong>量级的粗略成本测算——仅为示意，不构成法律或税务意见。',
        'hero.timestamp': '数据时点：<strong class="font-medium text-slate-700">2024 年第四季度</strong>；最近复核：<strong class="font-medium text-slate-700">2026-04</strong>。来源详见<a href="#methodology" class="text-emerald-700 underline underline-offset-2 hover:text-emerald-600">方法论</a>。',

        'process.h2': '设立流程：分步说明',
        'process.tab_mainland': '大陆（外商独资·国际）',
        'process.tab_domestic': '大陆（内资有限责任公司）',
        'process.tab_jv': '大陆（中外合资）',
        'process.tab_sar': '香港与澳门（特别行政区）',
        'process.mainland_intro': '本标签面向<strong>境外投资者</strong>——境外<strong>自然人</strong>（国籍不限，<strong>美国籍</strong>为常见示例之一）或<strong>境外母公司</strong>——说明如何设立<strong>WFOE</strong>（<strong>外商独资企业</strong>）。按顺序完成各步；更多说明可展开查看。<strong>第5步之前</strong>请核对拟从事的 CAD/设计活动是否符合登记经营范围、<strong>2024年外商投资负面清单</strong>及行业许可——<strong>建设工程设计</strong>常与一般技术咨询不同。在递交前请预算<strong>注册资本</strong>（第8–9步）与<strong>运营成本</strong>。',
        'process.domestic_intro': '<strong>境内股东</strong>（自然人或境内企业/组织）常见路径为通过当地<strong>「企业开办一窗通」</strong>等渠道设立<strong>有限责任公司</strong>——无需境外公证、海牙认证或外商投资资本金专户。步骤5–9在多数城市可<strong>一窗并联</strong>或分时补办；下列顺序为逻辑拆分而非强制时序。港澳台居民投资另有专项规定。',
        'process.jv_intro': '本标签面向<strong>中外合资有限责任公司</strong>（外商投资有限责任公司）——一名或多名<strong>境外投资者</strong>与<strong>中方股东</strong>共同设立。登记路径与外商独资相近，但须额外完成伙伴尽调、股东/合资合同、<strong>2024年负面清单</strong>项下股权比例规则及双语治理安排。请按顺序推进；在递交前预算<strong>律师费</strong>（通常高于独资）与<strong>注册资本</strong>。',
        'process.fee_note_jv': '右侧栏：各步<strong>大致现金影响</strong>（2024–2026 常见预估区间，一线城市口径）。非报价——城市、银行、伙伴与律师差异大。<strong>中文界面仅显示人民币</strong>；切换 English 后显示人民币与美元对照（汇率规则与财务区一致）。',
        'process.fee_note_domestic': '右侧栏：各步<strong>大致现金影响</strong>（2024–2025 常见预估区间，<strong>人民币</strong>）。非报价——城市与银行政策不同。<strong>中文界面仅显示人民币</strong>；切换 English 后显示人民币与美元对照（汇率规则与财务区一致）。',
        'process.fee_note': '右侧栏：各步<strong>大致现金影响</strong>（2024–2025 常见预估区间，<strong>人民币</strong>）。非报价——城市、银行与代理机构不同，结果会有差异。<strong>中文界面仅显示人民币</strong>；切换 English 后显示人民币与美元对照（汇率规则与财务区一致）。',
        'process.col_step': '步骤',
        'process.col_cost': '预估成本',

        'common.sr.toggle': '显示或隐藏本步补充说明',
        'common.sr.more': '更多',

        'sar.intro': '香港与澳门适用不同法律体系，设立流程与大陆外商独资企业相比更简单、差异很大。',
        'sar.hk_title': '香港设立',
        'sar.mo_title': '澳门设立',
        'sar.hk1': '<strong>聘请公司秘书：</strong>法律规定须聘请本地个人或机构担任公司秘书并提供注册地址。',
        'sar.hk2': '<strong>提供KYC资料：</strong>向代理机构提供护照复印件及近期水电账单（地址证明）。',
        'sar.hk3': '<strong>网上递交：</strong>代理机构向公司注册处递交NNC1等表格。',
        'sar.hk4': '<strong>领取证书：</strong>电子递交（e-Services）材料齐备时常见<strong>约1小时</strong>；纸本约<strong>4个工作日</strong>。一般无需公章或复杂政府现场手续；银行 KYC 仍可能需数周。',
        'sar.hk5': '<strong>银行账户（难点）：</strong>在港开立企业账户反洗钱审查严格，往往需数周，并可能要求面签或视频面谈。',
        'sar.mo1': '<strong>名称核准：</strong>向澳门商业及动产登记局申请预留公司名称。',
        'sar.mo2': '<strong>起草章程：</strong>准备章程；多数外资企业采用“有限公司”（Lda.）。',
        'sar.mo3': '<strong>公证签署：</strong>创始人须在澳门公证人前签署设立文件。',
        'sar.mo4': '<strong>登记：</strong>将公证文件递交登记局登记。',
        'sar.mo5': '<strong>税务局：</strong>向财政局提交开业申报。<em>全程约2–3周。</em>',

        'regions.h2': '工程人才热点',
        'regions.intro': '本部分将大中华区<strong>24 个城市</strong>按区域梳理——粤港澳大湾区、华东、北方沿海、内陆与中原、西南以及海南——便于在可比框架下对照薪酬与成本。',

        'gba.h3': '粤港澳大湾区（GBA）及南方',
        'gba.summary': '大湾区对AEC团队的特别之处',
        'gba.fold': '珠江三角洲串联制造、金融与设计：<strong>深圳</strong>与<strong>广州</strong>工程人才池大；<strong>香港</strong>与<strong>澳门</strong>（特别行政区）薪酬与社保结构不同；<strong>珠海</strong>毗邻澳门，是进入大湾区成本较低的选择。',
        'gba.sz': '硬件与科技之都。需求旺，CAD节奏快。',
        'gba.gz': '传统商贸与制造重镇。工程基础扎实。',
        'gba.hk': '国际金融与设计。底薪高；本模型中雇主<strong>法定薪酬缴费</strong>（强积金有上限）相对较低。',
        'gba.mo': '酒店与建筑特色。劳动力市场独特；本模型中雇主<strong>法定薪酬缴费</strong>（FSS 定额）很低。',
        'gba.zh': '与澳门相邻，滨海城市，性价比高的大湾区入口。',

        'east.h3': '华东热点',
        'east.summary': '华东热点概览',
        'east.fold': '长三角汇聚<strong>上海</strong>的国际实践、<strong>杭州</strong>的数字经济、<strong>南京</strong>的土木强项、<strong>合肥</strong>的高端制造，以及<strong>苏州</strong>工业园区与制造配套设计人才——往往是除大湾区外竞争最激烈的薪酬带。',
        'east.sh': '国际一线。同济等建筑人才集中。',
        'east.hz': '电商/科技（阿里）。竞争激烈，技能更新快。',
        'east.nj': '古都。东南大学等土木精英。',
        'east.hf': '新能源汽车与制造快速崛起。性价比较好。',
        'east.sz2': '工业园区与制造带；BIM/CAD需求强，薪酬常略低于上海。',

        'north.h3': '北方、内陆与中原',
        'north.summary': '北方、内陆与中原概览',
        'north.fold': '<strong>北方与东北沿海：</strong><strong>北京</strong>、<strong>天津</strong>、<strong>哈尔滨</strong>、<strong>青岛</strong>、<strong>大连</strong>——政策与港口型城市，本行中底薪相对较低。<strong>内陆与中原：</strong><strong>郑州</strong>（河南/中原）、<strong>武汉</strong>（长江中游）、<strong>长沙</strong>（湖南）、<strong>西安</strong>（西北内陆）——毕业生供给大、租金适中。本块<strong>不含</strong>“西南地区”；川渝滇见下一节。',
        'north.bj': '政治与教育中心。薪酬高，工程人才顶尖。',
        'north.tj': '大港，与北京南站间城际高铁<strong>约30分钟</strong>（站间）。重工业设计。',
        'north.hrb': '东北工业基地。成本低，工科名校底蕴深。',
        'north.qd': '山东沿海港口；制造与海洋工程；甲级写字楼成本高于多数内陆城市。',
        'north.dl': '辽宁港口与造船传统；供暖季公用事业负担高于南方沿海。',
        'north.zz': '河南/中原物流枢纽；南北内陆通道；甲级写字楼可负担。',
        'north.wh': '长江中游枢纽；毕业生供给巨大。',
        'north.cs': '湖南省会；工程与传媒；中南内陆。',
        'north.xa': '西北内陆；航空军工；三维技能。',

        'sw.h3': '中国西南',
        'sw.summary': '中国西南概览',
        'sw.fold_title': '中国西南的特别之处',
        'sw.fold': '此处<strong>西南</strong>指<strong>四川</strong>（<strong>成都</strong>）、<strong>重庆</strong>直辖市与<strong>云南</strong>（<strong>昆明</strong>）——与上文“中原”（如郑州）或长江中游内陆（如武汉）相区分。',
        'sw.cd': '四川盆地核心；宜居；BIM人才强。',
        'sw.cq': '山城特大城市；人才池大；内陆交付基地。',
        'sw.km': '云南门户；气候温和；AEC市场小于成渝。',

        'hn.h3': '海南自由贸易港（本岛）',
        'hn.summary': '海南特别说明',
        'hn.fold_title': '海南的特别之处',
        'hn.fold_p1': '全省按<strong>海南自由贸易港</strong>规则运作。自<strong>2025年12月</strong>岛域特殊海关监管运行后，对符合条件的 FTP 主体：未列入征税商品目录的进口货物可适用<strong>零进口关税</strong>；增值税、消费税按自贸港货物税收政策执行（并非所有品类一律“全免”）。货物经“二线”进入内地另行征税，除非在本岛实质性加工。重点面向旅游、现代服务、高新技术、医疗与物流等。',
        'hn.fold_li1': '<strong>企业所得税：</strong>鼓励类产业等符合条件的企业可适用<strong>15%</strong>（政策分阶段延续，请以主管部门与律师核实有效期限）。',
        'hn.fold_li2': '<strong>个人所得税：</strong>符合条件的高端与紧缺人才，对符合条件的海南来源所得可适用<strong>15%</strong>封顶等安排（资格与认定规则适用；请与顾问确认现行框架）。',
        'hn.fold_note': '下方海口/三亚的用工成本示例使用典型社保与公积金负担；不构成税务或法律意见。',
        'hn.hk': '省会与政策行政中心；相对小岛城市企业与基建设计岗位更多；底薪通常低于一线沿海但随自贸港投资改善。<strong>15%优惠税率</strong>须满足鼓励类产业+实质性运营等条件，非默认适用。',
        'hn.sy': '旅游与酒店经济；生活成本较高、技术劳动力池较小，同级别薪酬相对海口常有保留溢价。<strong>15%优惠税率</strong>须满足鼓励类产业+实质性运营等条件，非默认适用。',

        'costs.h2': '年度财务建模仪表盘',
        'costs.intro': '本交互表计算<strong>年度用工总成本</strong>。将底薪按12个月计，并按各地雇主法定缴费（大陆“五险一金”/港澳强积金等）测算24个城市。底薪参考2024–2025招聘与薪酬调研（如猎聘、前程无忧、i人事等）；写字楼租金采用中指、仲量联行、戴德梁行等机构公布的各地甲级/优质办公<strong>有效租金</strong>（多为2024年三、四季度），公用事业按气候与供暖分摊。均为<strong>规划用预估</strong>，非报价。可选<strong>人均模拟间接成本</strong>——租金、工位设备、公用事业与AEC软件（见下方方法）。<strong>点击任意城市条形</strong>查看细分。设立背景见<a href="#process" class="text-emerald-600 font-semibold underline underline-offset-2">设置第8–9步</a>。',
        'costs.overhead_method': '<strong>间接成本模型（人均·年，预估）：</strong><strong>租金</strong>——甲级/优质办公有效租金（人民币/平方米/月）×约10平方米工位 ×12；特别行政区按核心写字楼人民币等价。<strong>硬件与家具</strong>——工程类工作站（含BIM用内存/显卡）、双显示器、桌椅按约3年摊销（约¥1.38万/年）。<strong>公用事业与物业</strong>——电费、集中供暖/供冷或空调、燃气及公区分摊（因城市气候而异）。<strong>软件</strong>——Autodesk <em>AEC Collection</em>年费（Revit、AutoCAD等；美国公开标价约每用户每年3,560–3,795美元，2025–2026）及<em>Rhino</em>商业许可（永久约995美元；按约3年摊销+维护估算）；美元标价按与图表相同的美元/人民币汇率折算（在线拉取成功则用实时汇率，若接口失败则按 2024 年均值兜底 7.2）。经销商与谈判条款不同——数量级参考即可。',

        'dash.role': '岗位',
        'dash.junior': '初级CAD',
        'dash.senior': '高级建模',
        'dash.currency': '货币',
        'dash.usd': '美元 ($)',
        'dash.rmb': '人民币 (¥)',
        'dash.headcount': '人数',
        'dash.city_select': '聚焦城市',
        'dash.overhead': '间接成本（人均）',
        'dash.exclude': '不含',
        'dash.include': '含',
        'dash.international': '国际城市',
        'dash.international_hide': '仅中国',
        'dash.international_show': '含国际',
        'dash.intl_title': '国际对标提示',
        'dash.intl_body': '您选择的是大中华区以外的国际城市。薪酬与本地办公成本以<strong>美元</strong>为锚，再按与图表相同的美元/人民币汇率折算为人民币以便比较。雇主法定负担为规划百分比——非大陆五险一金。',

        'dash.macro': '年度宏观对比：',
        'dash.macro.sub': '名员工。',
        'dash.macro.cost_base': '年度总成本（底薪 + 雇主缴费）',
        'dash.macro.cost_oh': '年度总成本（底薪 + 雇主缴费 + 模拟间接成本）',

        'dash.micro': '年度细分：',
        'dash.micro.sub1': '年度构成：用工 + 间接成本（租金、设备、公用事业、软件）',
        'dash.micro.sub2': '年度底薪与雇主“五险一金”',
        'dash.micro.intl_sub2': '年度底薪与本地雇主法定负担',
        'dash.micro.intl_sub2': '年度底薪与本地雇主法定负担',
        'dash.total_row': '年度总成本',

        'dash.sar_title': '特别行政区法律结构提示',
        'dash.sar_body': '您选择的是特别行政区。底薪通常更高，但雇主<strong>法定薪酬缴费</strong>远低于大陆五险一金（香港强积金按<strong>5%且月收入上限 HKD 30,000、雇主月缴上限 HKD 1,500</strong>建模；澳门 FSS 雇主为<strong>定额 MOP 60/月</strong>）。为便于比较，数值以人民币/美元等价展示。',

        'footer.rights': '© 2026 QROST. 保留所有权利。',
        'footer.disclaimer': '免责声明：本站信息仅供教育与战略规划参考，不对绝对准确性、完整性或时效作任何保证。QROST 对基于本内容的商业、法律或财务决策不承担责任。跨境扩张前请咨询当地持牌律师与会计师。',

        'method.h2': '方法论、数据来源与披露',
        'method.sources_h': '数据来源',
        'method.sources_body': '底薪参考 <strong>2024–2025</strong> 招聘与薪酬调研（猎聘、前程无忧、i人事）；写字楼租金采用 <strong>中指院、JLL、戴德梁行、莱坊、高力国际</strong>等机构发布的甲级/优质办公有效租金（多为 2024 年三、四季度），公用事业按气候与供暖分摊。软件价格用 Autodesk AEC Collection 美国公开标价（约每用户每年 3,560–3,795 美元，2025–2026）与 Rhino 商业许可（约 995 美元永久授权）。所有数字均为<strong>规划用预估，非报价</strong>。',
        'method.modeling_h': '建模规则',
        'method.modeling_body': '图表中薪酬、租金、缴费与间接成本均以<strong>人民币</strong>为底层；美元展示为人民币除以美元/人民币汇率（优先在线汇率；若接口失败则按 <strong>2024 年均值兜底 7.2</strong>）。香港、澳门薪酬与缴费为经复核的<strong>人民币规划等价</strong>（含强积金上限与澳门 FSS 定额），非实时港币/澳门元换算。',
        'method.timestamp_h': '最近复核',
        'method.timestamp_body': '<strong>数据时点 2024 年第四季度</strong>；最近复核 <strong>2026-04</strong>。法规引用（如 2024 年 7 月修订《公司法》）在对应步骤就地标注。',
        'method.ai_h': 'AI 协助说明',
        'method.ai_body': '本页内容在<strong>AI 协助（Gemini 3.1 Pro，2026 年 4 月）</strong>下，基于上述公开来源整理并经作者复核。仅作为参考起点，不构成法律或税务意见。',

        'chart.fx_line': '美元展示换算：1 美元 ≈ {rate} 人民币（{mode}）。',
        'chart.fx_mode_live': '在线汇率',
        'chart.fx_mode_fallback': '2024 年均值兜底 7.2',
        'chart.fx_status_pending': '汇率获取中…',
        'chart.fx_status_live': '实时汇率',
        'chart.fx_status_fallback': '离线 · 兜底 7.2',
        'chart.cdn_unavailable': '图表暂不可用（Chart.js 加载失败）。薪资与缴费数字不受影响；刷新页面可重试。',

        'chart.base': '年度底薪',
        'chart.contrib': '雇主缴费',
        'chart.overhead': '间接成本（模拟）',
        'chart.tooltip_total': '年度合计：',
        'chart.total_annual_cost': '年度总成本',

        'donut.base': '年度底薪',
        'donut.pension': '1. 养老保险（16%）',
        'donut.medical': '2. 医疗与生育（9%）',
        'donut.unemp': '3. 失业保险（0.5%）',
        'donut.injury': '4. 工伤保险（0.5%）',
        'donut.housing': '5. 住房公积金（{pct}%）',
        'donut.rent': '办公室租金（分摊）',
        'donut.hardware': '硬件与家具（工作站、桌椅）',
        'donut.utilities': '公用事业、保洁与空调（分摊）',
        'donut.software': '软件（AEC Collection + Rhino，人均年模拟）',
        'donut.mpf': '强积金（法定退休）',
        'donut.fss': '社会保障（FSS）',
        'donut.intl_contrib': '雇主法定负担',

        'role.junior_short': '初级CAD',
        'role.senior_short': '高级建模',

        'desc.mainland': '<strong>大陆缴费：</strong>雇主法定缴费包括“五险一金”（养老、医疗、失业、工伤、生育及住房公积金）。比例随地方政策变化。',
        'desc.mainland_oh': '<strong>间接成本：</strong>租金、公用事业、硬件摊销及AEC软件栈按人均年模拟（见上文方法）。',
        'desc.hainan_extra': '<strong>海南自贸港：</strong>符合条件企业可适用<strong>15%企业所得税</strong>（鼓励类产业、实质性运营等）。符合条件人才对符合条件的海南来源所得可适用<strong>15%个人所得税</strong>上限等安排。货物“二线”进内地规则请咨询当地顾问。',
        'desc.sar_strong': '<strong>特别行政区框架：</strong> ',
        'desc.sar_line': '约{pct}%的法定缴费代表本地化退休计划（如香港强积金）的大致上限，而非大陆社保体系。',
        'desc.sar_oh_append': ' <strong>间接成本：</strong>特别行政区租金按核心写字楼人民币区间；硬件/软件与大陆采用同一许可模型以便比较。',
        'desc.international': '<strong>国际对标：</strong>薪酬与本地办公成本以美元为锚，再按与图表相同的美元/人民币汇率折算。雇主法定负担（约{pct}%）为薪酬税、养老金/CPF、强积金(super)或签证相关雇主成本的规划比例——非大陆五险一金。',
        'desc.international_oh': '<strong>间接成本：</strong>本地租金与公用事业以美元为锚；硬件与AEC软件与中方城市采用同一人均年许可模型以便横向比较。'
    };

    Object.assign(ZH, {
        'gba.fold_title': '大湾区对AEC团队的特别之处',
        'east.fold_title': '华东热点的特别之处',
        'north.fold_title': '北方、内陆与中原的特别之处',

        'dash.macro_prefix': '年度宏观对比：',
        'dash.micro_prefix': '年度细分：',
        'dash.macro_connector': '适用于',
        'dash.macro_emp_suffix': '名员工。',

        'hub.beijing': '北京',
        'hub.shanghai': '上海',
        'hub.shenzhen': '深圳',
        'hub.guangzhou': '广州',
        'hub.hangzhou': '杭州',
        'hub.nanjing': '南京',
        'hub.tianjin': '天津',
        'hub.wuhan': '武汉',
        'hub.chengdu': '成都',
        'hub.zhuhai': '珠海',
        'hub.xian': '西安',
        'hub.hefei': '合肥',
        'hub.harbin': '哈尔滨',
        'hub.haikou': '海口',
        'hub.sanya': '三亚',
        'hub.hongkong': '香港',
        'hub.macau': '澳门',
        'hub.suzhou': '苏州',
        'hub.changsha': '长沙',
        'hub.chongqing': '重庆',
        'hub.kunming': '昆明',
        'hub.qingdao': '青岛',
        'hub.zhengzhou': '郑州',
        'hub.dalian': '大连',

        's01.title': '按<em>「城市 + 品牌 + 行业 + 有限公司」</em>模式拟定公司名称。',
        's01.detail': '<ul class="list-disc pl-4 text-sm text-slate-600 space-y-1.5 mt-3"><li>法律格式严格——例如上海某某 CAD 设计有限公司。</li><li>最终名称核准在注册环节完成；代理机构可预审可用性。</li></ul>',
        's02.title': '落实<strong>可用于工商登记</strong>的注册地址（商业或经批准的商住/商办）。',
        's02.detail': '<p class="text-sm text-slate-600 mt-3">纯住宅地址通常不被接受，但不少城市在权属证明或租约允许时可使用商住/商办物业；部分园区提供合规<strong>集中登记地址</strong>——签约前向市场监管部门核实。</p>',

        's03.title': '向房东索取红色<strong>不动产权证书</strong>（或同等权属证明）供递交材料使用。',
        's03.detail': '<p class="text-sm text-slate-600 mt-3">缺少该文件，市场监管部门通常会驳回申请。</p>',

        's04.title': '签署商业租赁合同（押金与前期租金常由个人或境外母公司垫付）。',
        's04.detail': '<p class="text-sm text-slate-600 mt-3">承租人可能尚未在册成立；取得执照与公章后，WFOE可对符合条件的设立前费用进行报销——请与代理机构及会计师确认。</p>',

        's05.title': '书面委托<strong>企业登记代理服务机构</strong>（工商代办/咨询公司），约定服务范围：设立、刻章及可选的开户与记账。',
        's05.detail': '<ul class="list-disc pl-4 text-sm text-slate-600 space-y-1.5 mt-3"><li>法律并未要求外商投资企业<strong>必须</strong>聘请代理，但市监网上申报、材料模板与口径多依赖中文且因城市而异，<strong>境外投资者实务上几乎均委托</strong>本地机构办理。</li><li>典型服务：拟定章程与高管安排、向 AMR 递交设立登记、协调刻章；部分套餐含开户陪同或首年代账，须在合同中写明。</li><li>建议在<strong>寄出公证/海牙认证文件前</strong>取得书面报价；比较“仅设立”与“设立+银行+财税”全包价差。</li></ul>',
        's05.fee_fx_note': '人民币为锚；美元由 ÷ 汇率得出。与下方财务区一致：当前约 <strong>1 USD ≈ {rate} CNY</strong>（在线成功则为实时汇率，若接口失败则按 2024 年均值兜底 7.2）。',

        's06.title': '在<strong>本国</strong>由公证机构对<strong>护照</strong>或母公司文件进行公证（例如<strong>美国护照</strong>持有人常见由美国公证员办理；具体以代理机构清单为准）。',
        's06.detail': '<p class="text-sm text-slate-600 mt-3">自然人投资者提交护照；法人股东提交主体资格文件——代理机构会列明清单。</p>',

        's07.title': '向本国指定的海牙公约主管机关申请<strong>海牙认证（Apostille）</strong>（例如<strong>美国</strong>为各州<strong>州务卿</strong>；其他国家依当地规则）。',
        's07.detail': '<p class="text-sm text-slate-600 mt-3"><strong>海牙公约成员国</strong>：公证+海牙认证可替代使领馆认证（中国自2023-11-07起适用）。<strong>非成员国</strong>仍须领事认证。须附经认证的<strong>中文译文</strong>，并以当地市场监管部门清单为准。</p>',

        's08.title': '在章程中确定<strong>注册资本</strong>与缴付安排——<strong>此时尚不要汇出资本金</strong>。',
        's08.detail': '<ul class="list-disc pl-4 text-sm text-slate-600 space-y-1.5 mt-3"><li><strong>注册资本</strong>是执照上登记的认缴总额，不同于年租金或工资总额。</li><li>依2024年7月修订的《公司法》，原则上须自成立之日起<strong>五年内</strong>缴足（存量公司有过渡规则）。</li><li>递交前对照<strong>2024年外商投资负面清单</strong>与<strong>市场准入负面清单</strong>；执照经营范围具有约束力。<strong>建设工程设计</strong>与一般 CAD/技术咨询监管路径不同，常需中外合作设计安排。</li><li>雇主社保与公积金为独立科目——见第9步与仪表盘。</li></ul>',

        's09.title': '编制12个月预算：租金、代理费、工资与法定“五险一金”。',
        's09.detail': '<ul class="list-disc pl-4 text-sm text-slate-600 space-y-1.5 mt-3"><li>设立前费用（租约、差旅）多由个人或母公司垫付；设立后或可报销——与代理确认。</li><li>对CAD类企业，工资与法定缴费通常是最大变量——请使用<a href="#costs" class="text-emerald-600 font-semibold underline">仪表盘</a>测算。</li><li>资本金注入并产生收入后，再规划在岸营运现金。</li></ul>',

        's10.title': '指定<strong>法定代表人</strong>与<strong>董事</strong>；如设<strong>监事</strong>，其不得与法定代表人/董事为同一人。',
        's10.detail': '<p class="text-sm text-slate-600 mt-3">法定代表人与唯一董事常为同一人。如设监事，不得兼任法定代表人或董事。依2024年《公司法》，规模较小或股东人数较少的公司经全体股东一致同意可<strong>不设监事</strong>或改设董事会审计委员会——以当地申报表为准。</p>',

        's11.title': '向市场监管部门（AMR）递交设立全套材料（租约、海牙认证文件、章程等）。',
        's11.detail': '<p class="text-sm text-slate-600 mt-3">向当地市场监督管理局提交：租约、经认证的身份/母公司文件、章程（资本、缴付计划、高管安排）及其他必备公司治理文件。在同一网上设立流程中完成<strong>外商投资初始信息报告</strong>（投资者、实际控制人、投资交易信息）。递交前再次核对经营范围与负面清单及行业许可要求。</p>',

        's12.title': '领取<strong>营业执照</strong>——公司依法成立。',
        's12.detail': '<p class="text-sm text-slate-600 mt-3">此时尚未开立可日常运营的企业银行账户（见第14–15步）。</p>',

        's13.title': '刻制并备案公司印章（公章、财务章等——<strong>数电票场景通常不需发票专用章</strong>）。',
        's13.detail': '<p class="text-sm text-slate-600 mt-3">公安备案 + 有资质刻章单位。红章对合同效力至关重要——妥善保管。仅在使用纸质 legacy 开票或银行要求时再刻发票章。</p>',

        's14.title': '凭执照与印章开立<strong>人民币基本存款账户（基本户）</strong>。',
        's14.detail': '<p class="text-sm text-slate-600 mt-3">主要营运人民币账户；为工资、奖金<strong>现金支取</strong>的法定渠道；工资发放通常通过本账户<strong>转账</strong>完成。银行会执行KYC。</p>',

        's15.title': '开立<strong>外商投资资本金账户</strong>用于接收境外股权投资（外币）。',
        's15.detail': '<p class="text-sm text-slate-600 mt-3">各银行名称不一（FDI/资本金专户等），并配合外汇局对外商投资企业登记。</p>',

        's16.title': '与代理机构准备银行要求的资本金入账及结汇申报文件（投资款用途表述）。',
        's16.detail': '<p class="text-sm text-slate-600 mt-3">汇款须明确为<strong>注册资本</strong>性质，而非随意“转账”；各银行编码要求不同。</p>',
        's17.title': '自境外以外币汇入<strong>注册资本</strong>至指定入账账户。',
        's17.detail': '<p class="text-sm text-slate-600 mt-3">境外汇入后，银行须通过资本项目系统完成<strong>货币出资入账登记</strong>（区别于第15步基本信息登记），方可结汇及营运使用。可在五年缴付期内分次缴纳（见第8步）。</p>',

        's18.title': '办理资本金<strong>结汇</strong>并将人民币划入基本户用于经营。',
        's18.detail': '<p class="text-sm text-slate-600 mt-3">按银行流程办理；属公司资本金结汇，不同于个人换汇。</p>',

        's19.title': '完成<strong>新办纳税人信息确认</strong>并开通<strong>数电发票</strong>。',
        's19.detail': '<p class="text-sm text-slate-600 mt-3">通过电子税务局办理——多数新设主体不再采购金税盘/UKey。在中国大陆向客户合规开票所必需。</p>',

        's20.title': '<strong>用工前</strong>办理<strong>社会保险与住房公积金</strong>单位登记——开办时可一窗通<strong>可选</strong>同步办理。',
        's20.detail': '<p class="text-sm text-slate-600 mt-3">设立时可勾选“否”并后续补办；无员工前通常无强制立即开户。用工后法定缴费自人民币基本户支付。城市对比见<a href="#costs" class="text-emerald-600 font-semibold underline">仪表盘</a>。</p>',

        'd01.title': '确定<strong>股东</strong>、<strong>法定代表人</strong>、<strong>登记联络员</strong>及（如设）<strong>监事</strong>；准备身份证与用于实名的手机号。',
        'd01.detail': '如设监事，<strong>董事</strong>（或经理）不得兼任监事。依2024年《公司法》，经全体股东一致同意可不设监事或改设董事会审计委员会（第69、83条）。须备案<strong>登记联络员</strong>联系方式（可与法定代表人或员工兼任）。',

        'd02.title': '准备<strong>3–5 个备选名称</strong>并落实<strong>合规注册地址</strong>——租赁合同 + 产权证明，或在允许情形下使用政府/园区<strong>集中登记地址</strong>。',
        'd02.detail': '多数城市在同一政务平台内做名称查重；最终名称以市场监管部门核准为准。<strong>集中登记地址因区而异</strong>——许可类/高风险行业可能不可用；注意执照住所标注及期限。',

        'd03.title': '确定<strong>认缴注册资本</strong>、<strong>股权比例</strong>、缴付安排与<strong>经营范围</strong>（注意是否触发许可审批）。',
        'd03.detail': '依 2024 年修订《公司法》，认缴出资原则上须自成立之日起<strong>五年内</strong>缴足（存量公司有过渡规则）——须在章程中写明缴付计划。',

        'd04.title': '通过省级<strong>政务服务网</strong> / <strong>企业开办一窗通</strong>在线填报——上传身份证明、地址材料、系统生成的章程等，并以人脸识别等方式<strong>电子签名</strong>。',
        'd04.detail': '可选：委托本地<strong>代办/代理记账</strong>机构（首次创业者较常见）；合同应列明设立、刻章与税务报到范围。多数城市可在同一次网上申请中<strong>并联</strong>刻章、数电票、社保、公积金与银行预约。',

        'd05.title': '市场监管部门审核通过后领取<strong>营业执照</strong>（多数城市可先领电子执照，纸质可选）。',
        'd05.detail': '材料齐备时，多数城市<strong>1个工作日内</strong>办结（部分<strong>当日</strong>）；名称、经营范围补正或前置许可除外。',

        'd06.title': '刻制并备案<strong>公章、财务章、法人章</strong>等（<strong>数电票场景通常不需发票专用章</strong>）。',
        'd06.detail': '部分地区对新设主体提供<strong>首套印章免费</strong>政策（<strong>枚数因城而异</strong>）——可在同一「一窗通」渠道查询。仅在使用纸质/legacy 开票或银行要求时再刻发票章。',

        'd07.title': '凭执照与印章开立<strong>人民币基本存款账户（基本户）</strong>——银行会执行 KYC，但通常较外商投资企业简便。',
        'd07.detail': '股东可在<strong>五年认缴期内</strong>按章程自个人账户注资并保留会计凭证；<strong>无需</strong>外商投资资本金专户。',

        'd08.title': '完成<strong>新办纳税人信息确认</strong>（多证合一赋码）并开通<strong>数电发票</strong>——不少地区与开办流程并联。',
        'd08.detail': '领取统一社会信用代码执照后无需单独税务登记证。在对外开票前，与代理或税务顾问确认<strong>小规模纳税人</strong>与<strong>一般纳税人</strong>路径。',

        'd09.title': '<strong>用工前</strong>办理<strong>社会保险与住房公积金</strong>单位登记——开办时可一窗通<strong>可选</strong>同步办理。',
        'd09.detail': '无员工前通常无强制立即开户要求；开办时可选“否”并后续补办。缴费比例依地方规则——规划时可对照本站<a href="#costs" class="text-emerald-600 font-semibold underline">仪表盘</a>。',

        'd10.title': '建立<strong>账务与按期纳税申报</strong>——增值税（<strong>小规模纳税人通常按季</strong>；一般纳税人通常按月）、企业所得税预缴、代扣代缴等。',
        'd10.detail': '无收入期间仍须<strong>按期零申报</strong>（按核定税种），否则可能被列入异常名录或产生滞纳金——建议在首笔收入前进线财税安排。',

        'jv01.title': '选择中方伙伴、开展尽职调查并签署意向书——<strong>在任何登记之前</strong>完成。',
        'jv01.detail': '<ul class="list-disc pl-4 text-sm text-slate-600 space-y-1.5 mt-3"><li>对中方伙伴做工商、征信、司法及许可核查——避免对接持有错误资产的空壳主体。</li><li>签署不具约束力的意向书或条款清单，约定股权、治理、出资安排与排他期。</li><li>常见周期：<strong>4–8周</strong>（国企或多方交易往往更长）。</li><li>多数合资失败源于伙伴选择而非登记瑕疵——尽调律师费应单独预算，不含于设立代办。</li></ul>',

        'jv02.title': '谈判<strong>合资/股东协议</strong>与<strong>公司章程</strong>。',
        'jv02.detail': '<ul class="list-disc pl-4 text-sm text-slate-600 space-y-1.5 mt-3"><li>依《外商投资法》及2024年《公司法》，新设合资为有限责任公司——原《合资经营企业法》《合作经营企业法》不再适用于新设。</li><li>股东协议对内；章程向市场监管部门备案。治理、僵局、知识产权、优先购买/共售及利润分配应在此明确。</li><li>常见周期：<strong>4–8周</strong>——常为设立前最耗时环节。</li><li>2020年后：股东会为最高权力机构——不同于旧法下董事会居首。</li></ul>',

        'jv03.title': '对照<strong>2024年全国外商投资准入负面清单</strong>核查经营范围并取得所需行业前置许可。',
        'jv03.detail': '<ul class="list-disc pl-4 text-sm text-slate-600 space-y-1.5 mt-3"><li>清单外领域内外资一致。清单内须按规定的股权上限引入中方股东。</li><li>多数合资在设立登记时同步提交外商投资<strong>初始报告</strong>——不再单独领取商务部批准证书。</li><li>限制类行业可能须在登记前后办理发改项目备案/核准或工信、民航、文旅等前置许可。</li><li>耗时<strong>0–24+周</strong>——一般服务业可为0；需行业审批则另加2–6个月。</li></ul>',

        'jv04.title': '通过市场监管<strong>名称自主申报</strong>预留公司名称。',
        'jv04.detail': '<p class="text-sm text-slate-600 mt-3">四段式：行政区划+字号+行业+组织形式。外商投资企业适用外资名称规则；保留期通常约2个月。含“中国”或“（中国）”字样规则更严——建议代理预审。</p>',

        'jv05.title': '落实<strong>商业注册地址</strong>并完成外方出资人文件认证。',
        'jv05.detail': '<ul class="list-disc pl-4 text-sm text-slate-600 space-y-1.5 mt-3"><li>商业租赁+房东不动产权属证明（贸易/制造类合资通常不接受住宅地址）。</li><li>外方公司：境外公证+海牙认证；自然人：护照海牙认证。须附经认证的简体中文译文。</li><li>中方提供境内主体资格材料；注意文件有效期，过期材料会被退回。</li><li>境外海牙认证常为进度瓶颈——预留<strong>2–4周</strong>。</li></ul>',

        'jv06.title': '向市场监管部门办理<strong>设立登记</strong>并同步报送外商投资初始报告 → 领取<strong>营业执照</strong>。',
        'jv06.detail': '<ul class="list-disc pl-4 text-sm text-slate-600 space-y-1.5 mt-3"><li>提交设立全套材料：全体股东签署的章程、住所证明、各方主体资格及认证文件、董事/监事/法定代表人任职文件，以及登记系统中的外商投资初始报告信息。</li><li>在章程中载明认缴注册资本及依2024年《公司法》第47条的<strong>五年</strong>缴足安排。</li><li>多数非限制行业材料齐备后约<strong>5–10个工作日</strong>。</li><li>2014年改革后多数有限责任公司无法定最低注册资本——但行业许可、海关及银行有实务门槛。</li></ul>',

        'jv07.title': '刻制并备案<strong>公司印章</strong>（公章、财务章、法人章——<strong>数电票场景通常不需发票专用章</strong>）——启用前须在合资合同中约定印鉴保管。',
        'jv07.detail': '<p class="text-sm text-slate-600 mt-3">领取执照后向公安备案刻章点办理。合资争议中常见印鉴争夺——首枚公章启用前应锁定双签与保管规则。部分城市推行电子印章或对新设主体首套免费。通常<strong>3–7个工作日</strong>。</p>',

        'jv08.title': '完成<strong>新办纳税人信息确认</strong>（多证合一）并开通<strong>数电发票</strong>。',
        'jv08.detail': '<p class="text-sm text-slate-600 mt-3">多数地区已与市监多证合一同步——无需单独税务登记证。按适用税种办理增值税、企业所得税等认定。若存在关联方交易，双方应尽早协调转让定价文档。通常<strong>1–2周</strong>。</p>',

        'jv09.title': '开立<strong>人民币基本户</strong>与<strong>外币资本金账户</strong>；在银行完成<strong>外商投资外汇登记</strong>。',
        'jv09.detail': '<ul class="list-disc pl-4 text-sm text-slate-600 space-y-1.5 mt-3"><li>依2024年《资本项目外汇业务指引》取得业务登记凭证——接收境内直接投资款的入口。</li><li>法定代表人现场面签较常见；银行选择影响付汇与结汇效率。</li><li>账户及外汇登记完成前勿汇入“注册资本”——常为关键路径（约<strong>4–8周</strong>）。</li></ul>',

        'jv10.title': '按认缴计划<strong>缴纳出资</strong>（认缴制；标准有限责任公司无需政府验资报告）。',
        'jv10.detail': '<ul class="list-disc pl-4 text-sm text-slate-600 space-y-1.5 mt-3"><li>外方以外币汇入资本金账户；中方以人民币或经评估的实物/知识产权出资。</li><li>非货币出资须经有资质评估机构评估后方为市监所接受。</li><li>认缴与实缴情况通过国家企业信用信息公示系统公示；首笔通常在账户就绪后<strong>1–2周</strong>。</li></ul>',

        'jv11.title': '聘用员工前办理<strong>社会保险</strong>与<strong>住房公积金</strong>单位登记。',
        'jv11.detail': '<p class="text-sm text-slate-600 mt-3">雇主法定缴费独立于注册资本，从人民币基本户经营资金支付。招聘前请按城市档位在<a href="#costs" class="text-emerald-600 font-semibold underline">仪表盘</a>测算用工成本。通常<strong>1–2周</strong>。</p>',

        'jv12.title': '办理后置许可：<strong>海关</strong>、<strong>ICP</strong>及行业许可证（视业务而定）。',
        'jv12.detail': '<ul class="list-disc pl-4 text-sm text-slate-600 space-y-1.5 mt-3"><li>从事进出口须办理海关注册登记——与营业执照相互独立。</li><li>互联网平台需ICP备案或许可证；电信增值、教育、医疗、广电等行业须取得主管部门许可——常为真正耗时环节。</li><li>技术进口合同可能须商务部登记/备案——预留法律审查。</li><li>外商投资年度报告每年1月1日至6月30日通过国家企业信用信息公示系统报送（次年起）。耗时<strong>2周–6个月以上</strong>，视行业而定。</li></ul>',

        'regions.sr.gba': '显示或隐藏粤港澳大湾区背景说明',
        'regions.sr.east': '显示或隐藏华东热点背景说明',
        'regions.sr.north': '显示或隐藏北方、内陆与中原背景说明',
        'regions.sr.sw': '显示或隐藏中国西南背景说明',
        'regions.sr.hainan': '显示或隐藏海南自由贸易港政策背景说明'
    });

    function getLang() {
        return document.documentElement.lang && document.documentElement.lang.startsWith('zh') ? 'zh' : 'en';
    }

    function setLang(lang) {
        const isZh = lang === 'zh';
        document.documentElement.lang = isZh ? 'zh-CN' : 'en';
        if (document.body) document.body.dataset.lang = lang;
        try {
            localStorage.setItem(STORAGE_KEY, lang);
        } catch (e) { /* ignore */ }

        document.querySelectorAll('[data-i18n]').forEach(function (el) {
            const key = el.getAttribute('data-i18n');
            if (!key) return;
            if (!el.dataset.i18nEnCache) {
                el.dataset.i18nEnCache = el.innerHTML;
            }
            if (isZh && ZH[key]) {
                el.innerHTML = ZH[key];
            } else {
                el.innerHTML = el.dataset.i18nEnCache;
            }
        });

        const titleKey = 'meta.title';
        if (isZh && ZH[titleKey]) {
            document.title = ZH[titleKey];
        } else {
            document.title = 'How to open a company in China — WFOE setup & AEC hiring costs | QROST';
        }

        const btn = document.getElementById('lang-toggle');
        if (btn) {
            btn.textContent = isZh ? ZH['lang.to_en'] : ZH['lang.to_zh'];
            btn.setAttribute('aria-pressed', isZh ? 'true' : 'false');
        }

        window.dispatchEvent(new CustomEvent('china-biz-lang-change', { detail: { lang: isZh ? 'zh' : 'en' } }));
    }

    function toggleLang() {
        setLang(getLang() === 'zh' ? 'en' : 'zh');
    }

    function init() {
        let saved = 'en';
        try {
            saved = localStorage.getItem(STORAGE_KEY) || 'en';
        } catch (e) { /* ignore */ }
        setLang(saved === 'zh' ? 'zh' : 'en');

        const btn = document.getElementById('lang-toggle');
        if (btn) {
            btn.addEventListener('click', toggleLang);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.ChinaBizI18n = {
        getLang: getLang,
        setLang: setLang,
        toggleLang: toggleLang,
        zh: ZH,
        t: function (key) {
            const L = getLang();
            if (L === 'zh' && ZH[key]) return ZH[key];
            return null;
        }
    };
})();
