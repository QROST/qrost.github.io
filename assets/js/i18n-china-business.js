/**
 * Bilingual UI: English stays in HTML; ZH strings applied when lang === 'zh'.
 * Dispatches window event 'china-biz-lang-change' with { lang: 'en'|'zh' }.
 */
(function () {
    const STORAGE_KEY = 'china-biz-lang';

    const ZH = {
        'meta.title': '如何在中国开公司——美国AEC创业者',

        'nav.setup': '设置',
        'nav.regions': '区域',
        'nav.financials': '财务',
        'lang.to_zh': '中文',
        'lang.to_en': 'English',

        'hero.h1': '如何在中国开公司',
        'hero.lead': '本页对比不同路径：下方<strong class="font-medium text-slate-800">WFOE</strong>流程面向<strong class="font-medium text-slate-800">美国籍</strong>在境内设立<strong class="font-medium text-slate-800">外商投资公司</strong>；另有标签页概括<strong class="font-medium text-slate-800">中国公民</strong>设立<strong class="font-medium text-slate-800">内资有限责任公司</strong>的常见步骤。财务板块覆盖<strong class="font-medium text-slate-800">资金去向</strong>与<strong class="font-medium text-slate-800">24 个城市</strong>的 AEC（建筑、工程与施工）用工成本，服务承接<strong class="font-medium text-slate-800">国际项目工作</strong>的团队。',

        'process.h2': '设立流程：分步说明',
        'process.tab_mainland': '大陆（外商独资·美国籍）',
        'process.tab_domestic': '大陆（内资有限责任公司）',
        'process.tab_sar': '香港与澳门（特别行政区）',
        'process.mainland_intro': '以<strong>美国籍创始人</strong>或境外母公司投资视角，按顺序完成<strong>WFOE</strong>设立。每一行是一个动作；更多说明可展开查看。在递交前请预算<strong>注册资本</strong>（第8–9步）与<strong>运营成本</strong>。',
        'process.domestic_intro': '<strong>中国公民</strong>（或股东均为境内主体）常见路径为通过当地<strong>「企业开办一窗通」</strong>等渠道设立<strong>有限责任公司</strong>——无需境外公证、海牙认证或外商投资资本金专户。具体步骤与时效因城市而异，以下为常见顺序。',
        'process.fee_note_domestic': '右侧栏：各步<strong>大致现金影响</strong>（2024–2025 常见预估区间）。非报价——城市与银行政策不同。',
        'process.fee_note': '右侧栏：各步<strong>大致现金影响</strong>（2024–2025 常见预估区间）。非报价——城市、银行与代理机构不同，结果会有差异。',

        'common.sr.toggle': '显示或隐藏本步补充说明',

        'sar.intro': '香港与澳门适用不同法律体系，设立流程与大陆外商独资企业相比更简单、差异很大。',
        'sar.hk_title': '香港设立',
        'sar.mo_title': '澳门设立',
        'sar.hk1': '<strong>聘请公司秘书：</strong>法律规定须聘请本地个人或机构担任公司秘书并提供注册地址。',
        'sar.hk2': '<strong>提供KYC资料：</strong>向代理机构提供美国护照复印件及近期水电账单（地址证明）。',
        'sar.hk3': '<strong>网上递交：</strong>代理机构向公司注册处递交NNC1等表格。',
        'sar.hk4': '<strong>领取证书：</strong>公司通常在<strong>24–48小时内</strong>成立。一般无需公章或复杂政府现场手续。',
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
        'gba.hk': '国际金融与设计。底薪高，雇主社保负担相对低。',
        'gba.mo': '酒店与建筑特色。劳动力市场独特，税负很低。',
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
        'north.tj': '大港，距北京约30分钟车程。重工业设计。',
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
        'hn.fold_p1': '全省按<strong>海南自由贸易港</strong>规则运作。在现行规则下，岛外进口多类货物适用<strong>“特殊海关监管”</strong>：自境外进入本岛的许多货物可<strong>免征进口关税、增值税与消费税</strong>（进入内地仍可能按“二线”征税，除非在本岛实质性加工）。重点面向旅游、现代服务、高新技术、医疗与物流等。',
        'hn.fold_li1': '<strong>企业所得税：</strong>鼓励类产业等符合条件的企业可适用<strong>15%</strong>（政策分阶段延续，请以主管部门与律师核实有效期限）。',
        'hn.fold_li2': '<strong>个人所得税：</strong>符合条件的高端与紧缺人才，对符合条件的海南来源所得可适用<strong>15%</strong>封顶等安排（资格与认定规则适用；请与顾问确认现行框架）。',
        'hn.fold_note': '下方海口/三亚的用工成本示例使用典型社保与公积金负担；不构成税务或法律意见。',
        'hn.hk': '省会与政策行政中心；相对小岛城市企业与基建设计岗位更多；底薪通常低于一线沿海但随自贸港投资改善。',
        'hn.sy': '旅游与酒店经济；生活成本较高、技术劳动力池较小，同级别薪酬相对海口常有保留溢价。',

        'costs.h2': '年度财务建模仪表盘',
        'costs.intro': '本交互表计算<strong>年度用工总成本</strong>。将底薪按12个月计，并按各地雇主法定缴费（大陆“五险一金”/港澳强积金等）测算24个城市。底薪参考2024–2025招聘与薪酬调研（如猎聘、前程无忧、i人事等）；写字楼租金采用中指、仲量联行、戴德梁行等机构公布的各地甲级/优质办公<strong>有效租金</strong>（多为2024年三、四季度），公用事业按气候与供暖分摊。均为<strong>规划用预估</strong>，非报价。可选<strong>人均模拟间接成本</strong>——租金、工位设备、公用事业与AEC软件（见下方方法）。<strong>点击任意城市条形</strong>查看细分。设立背景见<a href="#process" class="text-emerald-600 font-semibold underline underline-offset-2">设置第8–9步</a>。',
        'costs.overhead_method': '<strong>间接成本模型（人均·年，预估）：</strong><strong>租金</strong>——甲级/优质办公有效租金（人民币/平方米/月）×约10平方米工位 ×12；特别行政区按核心写字楼人民币等价。<strong>硬件与家具</strong>——工程类工作站（含BIM用内存/显卡）、双显示器、桌椅按约3年摊销（约¥1.38万/年）。<strong>公用事业与物业</strong>——电费、集中供暖/供冷或空调、燃气及公区分摊（因城市气候而异）。<strong>软件</strong>——Autodesk <em>AEC Collection</em>年费（Revit、AutoCAD等；美国公开标价约每用户每年3,560–3,795美元，2025–2026）及<em>Rhino</em>商业许可（永久约995美元；按约3年摊销+维护估算）；美元标价按与图表相同的美元/人民币汇率折算（在线拉取成功则用实时汇率，否则 6.8）。经销商与谈判条款不同——数量级参考即可。',

        'dash.role': '岗位',
        'dash.junior': '初级CAD',
        'dash.senior': '高级建模',
        'dash.currency': '货币',
        'dash.usd': '美元 ($)',
        'dash.rmb': '人民币 (¥)',
        'dash.headcount': '人数',
        'dash.overhead': '间接成本（人均）',
        'dash.exclude': '不含',
        'dash.include': '含',

        'dash.macro': '年度宏观对比：',
        'dash.macro.sub': '名员工。',
        'dash.macro.cost_base': '年度总成本（底薪 + 雇主缴费）',
        'dash.macro.cost_oh': '年度总成本（底薪 + 雇主缴费 + 模拟间接成本）',

        'dash.micro': '年度细分：',
        'dash.micro.sub1': '年度构成：用工 + 间接成本（租金、设备、公用事业、软件）',
        'dash.micro.sub2': '年度底薪与雇主“五险一金”',
        'dash.total_row': '年度总成本',

        'dash.sar_title': '特别行政区法律结构提示',
        'dash.sar_body': '您选择的是特别行政区。底薪通常更高，但雇主法定缴费远低于大陆，因为特别行政区不使用大陆社保/公积金体系（例如香港强积金有较低上限）。为便于比较，数值以人民币/美元等价展示。',

        'footer.rights': '© 2026 QROST. 保留所有权利。',
        'footer.ai': '本页内容由 Gemini 3.1 Pro 于2026年4月辅助生成；流程与成本为知识库时点信息。图表中美元金额优先使用在线美元/人民币汇率；若接口失败则按 1 美元 = 6.8 人民币。港币与澳门元按人民币等价计入图表。',
        'footer.disclaimer': '免责声明：本站信息仅供教育与战略规划参考，不对绝对准确性、完整性或时效作任何保证。QROST 对基于本内容的商业、法律或财务决策不承担责任。跨境扩张前请咨询当地持牌律师与会计师。',

        'chart.fx_line': '美元展示换算：1 美元 ≈ {rate} 人民币（{mode}）。',
        'chart.fx_mode_live': '在线汇率',
        'chart.fx_mode_fallback': '离线默认 6.8',

        'chart.base': '年度底薪',
        'chart.contrib': '雇主缴费',
        'chart.overhead': '间接成本（模拟）',
        'chart.tooltip_total': '年度合计：',
        'chart.total_annual_cost': '年度总成本',

        'donut.base': '年度底薪',
        'donut.pension': '1. 养老保险（16%）',
        'donut.medical': '2. 医疗与生育（10%）',
        'donut.unemp': '3. 失业保险（0.5%）',
        'donut.injury': '4. 工伤保险（0.5%）',
        'donut.housing': '5. 住房公积金（{pct}%）',
        'donut.rent': '办公室租金（分摊）',
        'donut.hardware': '硬件与家具（工作站、桌椅）',
        'donut.utilities': '公用事业、保洁与空调（分摊）',
        'donut.software': '软件（AEC Collection + Rhino，人均年模拟）',
        'donut.mpf': '强积金（法定退休）',
        'donut.fss': '社会保障（FSS）',

        'role.junior_short': '初级CAD',
        'role.senior_short': '高级建模',

        'desc.mainland': '<strong>大陆缴费：</strong>雇主法定缴费包括“五险一金”（养老、医疗、失业、工伤、生育及住房公积金）。比例随地方政策变化。',
        'desc.mainland_oh': '<strong>间接成本：</strong>租金、公用事业、硬件摊销及AEC软件栈按人均年模拟（见上文方法）。',
        'desc.hainan_extra': '<strong>海南自贸港：</strong>符合条件企业可适用<strong>15%企业所得税</strong>（鼓励类产业、实质性运营等）。符合条件人才对符合条件的海南来源所得可适用<strong>15%个人所得税</strong>上限等安排。货物“二线”进内地规则请咨询当地顾问。',
        'desc.sar_strong': '<strong>特别行政区框架：</strong> ',
        'desc.sar_line': '约{pct}%的法定缴费代表本地化退休计划（如香港强积金）的大致上限，而非大陆社保体系。',
        'desc.sar_oh_append': ' <strong>间接成本：</strong>特别行政区租金按核心写字楼人民币区间；硬件/软件与大陆采用同一许可模型以便比较。'
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
        's01.money': '<strong>尚无WFOE账户。</strong><strong class="text-slate-800">预估：</strong>本步约<strong>$0 / ¥0</strong>；名称预审通常含于代理合同（第5步）。',

        's02.title': '仅可选择<strong>商业办公</strong>地址——住宅不能作为WFOE注册地址。',
        's02.detail': '<p class="text-sm text-slate-600 mt-3">用途须允许工商登记；签约前请与代理机构核实规划用途。</p>',
        's02.money': '<strong>尚无WFOE账户。</strong><strong class="text-slate-800">预估：</strong>约<strong>$0</strong>；仅看房差旅等软成本。',

        's03.title': '向房东索取红色<strong>不动产权证书</strong>（或同等权属证明）供递交材料使用。',
        's03.detail': '<p class="text-sm text-slate-600 mt-3">缺少该文件，市场监管部门通常会驳回申请。</p>',
        's03.money': '<strong>尚无WFOE账户。</strong><strong class="text-slate-800">预估：</strong>约<strong>$0 / ¥0</strong>（由房东提供权证）。',

        's04.title': '签署商业租赁合同（押金与前期租金常由个人或境外母公司垫付）。',
        's04.detail': '<p class="text-sm text-slate-600 mt-3">承租人可能尚未在册成立；取得执照与公章后，WFOE可对符合条件的设立前费用进行报销——请与代理机构及会计师确认。</p>',
        's04.money': '<strong>个人 /</strong>境外母公司。<strong class="text-slate-800">现金预估：</strong>押金（常<strong>1–3 个月租金</strong>）+ 首期租金 + 杂费——一线城市小面积预估<strong>约 ¥3 万–25 万+</strong>，因城市差异大。',

        's05.title': '书面委托<strong>企业登记代理服务机构</strong>（工商代办/咨询公司），约定服务范围：设立、刻章及可选的开户与记账。',
        's05.detail': '<ul class="list-disc pl-4 text-sm text-slate-600 space-y-1.5 mt-3"><li>法律并未要求外商投资企业<strong>必须</strong>聘请代理，但市监网上申报、材料模板与口径多依赖中文且因城市而异，<strong>境外投资者实务上几乎均委托</strong>本地机构办理。</li><li>典型服务：拟定章程与高管安排、向 AMR 递交设立登记、协调刻章；部分套餐含开户陪同或首年代账，须在合同中写明。</li><li>建议在<strong>寄出公证/海牙认证文件前</strong>取得书面报价；比较“仅设立”与“设立+银行+财税”全包价差。</li></ul>',
        's05.money': '<strong>代理服务费</strong>（市场区间）：常见<strong>USD 1,500–5,000</strong>（≈ <strong>¥1.1 万–3.6 万</strong>，按约 6.8–7.2 人民币/美元预估）；<strong>~USD 500–1,500</strong> 仅递交；<strong>全包</strong>（银行+账）常<strong>&gt;USD 5,000</strong>。市监<strong>政府性收费</strong>另常<strong>¥0–800</strong>。<strong>个人/母公司</strong>垫付——尚无 WFOE。',

        's06.title': '在美国由公证员对美国护照或母公司文件进行公证。',
        's06.detail': '<p class="text-sm text-slate-600 mt-3">自然人投资者提交护照；法人股东提交主体资格文件——代理机构会列明清单。</p>',
        's06.money': '<strong>个人</strong>/母公司。<strong class="text-slate-800">预估：</strong>常见材料包<strong>约 $10–150</strong>；单次公证多<strong>$5–25</strong>；法人全套更高。',

        's07.title': '向所在州州务卿申请<strong>海牙认证（Apostille）</strong>。',
        's07.detail': '<p class="text-sm text-slate-600 mt-3">此路径一般不再要求中国驻外使领馆领事认证；海牙认证为标准手续。</p>',
        's07.money': '<strong>个人</strong>/母公司。<strong class="text-slate-800">预估：</strong>每份海牙约<strong>$10–50</strong>（州务卿费常<strong>$5–30</strong>/份；加急/快递另计）。',

        's08.title': '在章程中确定<strong>注册资本</strong>与缴付安排——<strong>此时尚不要汇出资本金</strong>。',
        's08.detail': '<ul class="list-disc pl-4 text-sm text-slate-600 space-y-1.5 mt-3"><li><strong>注册资本</strong>是执照上登记的认缴总额，不同于年租金或工资总额。</li><li>依2024年7月修订的《公司法》，原则上须自成立之日起<strong>五年内</strong>缴足（存量公司有过渡规则）。</li><li>金额应结合行业许可最低要求、商业计划、银行资信与利润汇出安排，与会计师对齐。</li><li>雇主社保与公积金为独立科目——见第9步与仪表盘。</li></ul>',
        's08.money': '<strong>仅纸面</strong>—勿汇资本金。<strong class="text-slate-800">预估：</strong>增量约<strong>$0</strong>（章程多在第5步代理范围内）。待第<strong>14–18</strong>步后再汇入。',

        's09.title': '编制12个月预算：租金、代理费、工资与法定“五险一金”。',
        's09.detail': '<ul class="list-disc pl-4 text-sm text-slate-600 space-y-1.5 mt-3"><li>设立前费用（租约、差旅）多由个人或母公司垫付；设立后或可报销——与代理确认。</li><li>对CAD类企业，工资与法定缴费通常是最大变量——请使用<a href="#costs" class="text-emerald-600 font-semibold underline">仪表盘</a>测算。</li><li>资本金注入并产生收入后，再规划在岸营运现金。</li></ul>',
        's09.money': '<strong>仅表格测算。</strong><strong class="text-slate-800">预估：</strong>约<strong>$0</strong>；若外包财务建模<strong>约 $200–2,000+</strong>。',

        's10.title': '指定<strong>法定代表人</strong>、<strong>执行董事</strong>与<strong>监事</strong>——其中两职不得为同一人。',
        's10.detail': '<p class="text-sm text-slate-600 mt-3">监事不得兼任法定代表人或执行董事；上述人选将写入章程与银行印鉴授权。</p>',
        's10.money': '<strong>仅纸面。</strong><strong class="text-slate-800">预估：</strong>工商填报高管约<strong>¥0</strong>规费。',

        's11.title': '向市场监管部门（AMR）递交设立全套材料（租约、海牙认证文件、章程等）。',
        's11.detail': '<p class="text-sm text-slate-600 mt-3">向当地市场监督管理局提交：租约、经认证的身份/母公司文件、章程（资本、缴付计划、高管安排）及其他必备公司治理文件。</p>',
        's11.money': '<strong>个人</strong>/母公司垫付。<strong class="text-slate-800">预估：</strong>市监<strong>政府收费</strong>常<strong>¥0–500</strong>；若已含于第5步代理，增量约<strong>$0</strong>。',

        's12.title': '领取<strong>营业执照</strong>——公司依法成立。',
        's12.detail': '<p class="text-sm text-slate-600 mt-3">此时尚未开立可日常运营的企业银行账户（见第14–15步）。</p>',
        's12.money': '尚未收投资款。<strong class="text-slate-800">预估：</strong>领照多数城市<strong>约 ¥0</strong>另收工本费。',

        's13.title': '刻制并备案公司印章（公章、财务章等）。',
        's13.detail': '<p class="text-sm text-slate-600 mt-3">公安备案 + 有资质刻章单位。红章对合同效力至关重要——妥善保管；持章人即对外签署权的核心。</p>',
        's13.money': '尚无日常现金流。<strong class="text-slate-800">预估：</strong>公章+财务章+发票章+法人章一套常<strong>¥400–2,000</strong>（因城而异）。',

        's14.title': '凭执照与印章开立<strong>人民币基本存款账户（基本户）</strong>。',
        's14.detail': '<p class="text-sm text-slate-600 mt-3">主要用于工资、租金与纳税等——多为唯一能发放现金工资的账户；银行会执行KYC。</p>',
        's14.money': '<strong>首批企业账户</strong>，可空户开。<strong class="text-slate-800">预估：</strong>开户费<strong>¥0–800</strong>（多可减免）；注意最低余额要求。',

        's15.title': '开立<strong>外商投资资本金账户</strong>用于接收境外股权投资（外币）。',
        's15.detail': '<p class="text-sm text-slate-600 mt-3">各银行名称不一（FDI/资本金专户等），并配合外汇局对外商投资企业登记。</p>',
        's15.money': '可收 FDI。<strong class="text-slate-800">预估：</strong>第二账户若收费常<strong>¥0–500</strong>，多<strong>¥0</strong>。',

        's16.title': '与代理机构准备银行要求的资本金入账及结汇申报文件（投资款用途表述）。',
        's16.detail': '<p class="text-sm text-slate-600 mt-3">汇款须明确为<strong>注册资本</strong>性质，而非随意“转账”；各银行编码要求不同。</p>',
        's16.money': '<strong>尚未汇出。</strong><strong class="text-slate-800">预估：</strong>纸面<strong>约 $0</strong>；代理超时工时或<strong>约 $50–200</strong>/小时。',

        's17.title': '自境外以外币汇入<strong>注册资本</strong>至指定入账账户。',
        's17.detail': '<p class="text-sm text-slate-600 mt-3">银行登记实缴出资并配合外汇手续；可在五年缴付期内分次缴纳（见第8步）。</p>',
        's17.money': '<strong>资本金到账。</strong><strong class="text-slate-800">预估：</strong>汇出行<strong>约 $15–50+</strong>；入账行可能有<strong>汇差</strong>（非固定“手续费”行）。',

        's18.title': '办理资本金<strong>结汇</strong>并将人民币划入基本户用于经营。',
        's18.detail': '<p class="text-sm text-slate-600 mt-3">按银行流程办理；属公司资本金结汇，不同于个人换汇。</p>',
        's18.money': '<strong>基本户可用人民币。</strong><strong class="text-slate-800">预估：</strong>结汇常<strong>¥0–300</strong>或含在套餐；少见单独规费。',

        's19.title': '办理税务登记并开通<strong>发票（fapiao）</strong>开具能力。',
        's19.detail': '<p class="text-sm text-slate-600 mt-3">在中国大陆向客户合规开票所必需。</p>',
        's19.money': '自<strong>基本户</strong>支付。<strong class="text-slate-800">预估：</strong>税务登记<strong>¥0–400</strong>；税控/开票设备（若需）<strong>¥0–1,500</strong>一次性。',

        's20.title': '办理<strong>社会保险</strong>登记——之后方可聘用员工并发放工资。',
        's20.detail': '<p class="text-sm text-slate-600 mt-3">法定缴费自人民币基本户支付，资金来自资本金与经营收入。城市对比见<a href="#costs" class="text-emerald-600 font-semibold underline">仪表盘</a>。</p>',
        's20.money': '<strong>工资+法定缴费</strong>自基本户。<strong class="text-slate-800">预估：</strong>登记<strong>¥0–300</strong>；<strong>持续</strong>缴费见<a href="#costs" class="text-emerald-700 font-semibold underline">仪表盘</a>。',

        'd01.title': '确定<strong>股东</strong>、<strong>法定代表人</strong>、<strong>监事</strong>及（如需）<strong>财务负责人</strong>；准备身份证与用于实名的手机号。',
        'd01.detail': '常见一人有限公司结构下，执行董事与监事不得为同一人；网上填报系统会对冲突项提示。',
        'd01.money': '<strong>预估：</strong>政府规费<strong>¥0</strong>；主要为时间成本。',

        'd02.title': '准备<strong>3–5 个备选名称</strong>并落实<strong>合规注册地址</strong>——租赁合同 + 产权证明，或在允许情形下使用政府/园区<strong>集中登记地址</strong>。',
        'd02.detail': '多数城市在同一政务平台内做名称查重；最终名称以市场监管部门核准为准。',
        'd02.money': '<strong>预估：</strong>名称查询常<strong>¥0</strong>；地址成本为<strong>租金或园区费用</strong>——预估<strong>¥0–2 万+</strong>起，因城市与面积而异。',

        'd03.title': '确定<strong>认缴注册资本</strong>、<strong>股权比例</strong>、缴付安排与<strong>经营范围</strong>（注意是否触发许可审批）。',
        'd03.detail': '依 2024 年修订《公司法》，认缴出资原则上须自成立之日起<strong>五年内</strong>缴足（存量公司有过渡规则）——须在章程中写明缴付计划。',
        'd03.money': '<strong>预估：</strong>填报认缴<strong>¥0</strong>规费；认缴制下设立当日<strong>不强制</strong>实缴到位。',

        'd04.title': '通过省级<strong>政务服务网</strong> / <strong>企业开办一窗通</strong>在线填报——上传身份证明、地址材料、系统生成的章程等，并以人脸识别等方式<strong>电子签名</strong>。',
        'd04.detail': '可选：委托本地<strong>代办/代理记账</strong>机构（首次创业者较常见）；合同应列明设立、刻章与税务报到范围。',
        'd04.money': '<strong>自助：</strong>市监侧政府性收费常<strong>¥0–500</strong>。<strong>代办：</strong>仅递交常见<strong>¥800–3,000</strong>；「设立+银行+首年记账」全包常<strong>¥3,000–1 万+</strong>。',

        'd05.title': '市场监管部门审核通过后领取<strong>营业执照</strong>（多数城市可先领电子执照，纸质可选）。',
        'd05.detail': '材料齐备时，审核周期常见约<strong>1–3 个工作日</strong>；名称或经营范围补正则可能延长。',
        'd05.money': '<strong>预估：</strong>执照工本费多地<strong>¥0</strong>；邮寄纸质可选<strong>¥0–30</strong>。',

        'd06.title': '刻制并备案<strong>公章、财务章、法人章、发票专用章</strong>等（按公安刻章备案要求）。',
        'd06.detail': '部分地区对新设主体提供<strong>首套印章免费</strong>政策——可在同一「一窗通」渠道查询。',
        'd06.money': '<strong>预估：</strong>若不免费，全套常<strong>¥300–1,200</strong>；加急或材质另计。',

        'd07.title': '凭执照与印章开立<strong>人民币基本存款账户（基本户）</strong>——银行会执行 KYC，但通常较外商投资企业简便。',
        'd07.detail': '股东可按认缴安排自个人账户向公司注资，<strong>无需</strong>外商投资资本金专户。',
        'd07.money': '<strong>预估：</strong>开户费多地<strong>¥0</strong>；U 盾/网银工具<strong>¥0–500</strong>。',

        'd08.title': '完成<strong>税务登记</strong>并开通<strong>数电发票</strong>等开票能力——不少地区与开办流程并联。',
        'd08.detail': '在对外开票前，与代理或税务顾问确认<strong>小规模纳税人</strong>与<strong>一般纳税人</strong>路径。',
        'd08.money': '<strong>预估：</strong>税务侧工本多<strong>¥0–200</strong>；税控设备若仍涉及硬件<strong>¥0–1,000</strong>——多地已全电票、无盘化。',

        'd09.title': '办理<strong>社会保险</strong>与<strong>住房公积金</strong>单位登记，以便后续用工与发薪合规。',
        'd09.detail': '缴费比例依地方规则——规划时可对照本站<a href="#costs" class="text-emerald-600 font-semibold underline">仪表盘</a>的城市假设。',
        'd09.money': '<strong>预估：</strong>开户登记常<strong>¥0–300</strong>；实际缴费自用工起发生。',

        'd10.title': '建立<strong>账务与按期纳税申报</strong>（增值税、企业所得税预缴、代扣代缴等）——自聘或委托<strong>代理记账</strong>。',
        'd10.detail': '逾期申报会产生滞纳金与处罚——建议在首笔收入前进线财税安排。',
        'd10.money': '<strong>预估：</strong>代理记账小微企业常见<strong>¥200–800+/月</strong>；业务复杂或进出口另议。',

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
            document.title = 'How I open a company in China — US AEC founders';
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
