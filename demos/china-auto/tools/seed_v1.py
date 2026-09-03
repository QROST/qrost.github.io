#!/usr/bin/env python3
"""Emit the China Auto V1 atlas with external-source provenance gates.

Unverified research candidates remain in the public data at low confidence, but
they never cite QROST's own notes as evidence. Precise output figures are linked
only when a specific external statistical release is available.
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from urllib.parse import urlparse

from search_index import attach

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "assets" / "data"

LV = "2026-09"
CANDIDATE_CONFIDENCE = 0.45
SRC_STAT_CHONGQING_2025 = "src-stat-chongqing-2025"
SRC_STAT_GUANGZHOU_2025 = "src-stat-guangzhou-2025"
SRC_STAT_GUANGZHOU_NEV_2025 = "src-stat-guangzhou-nev-2025"
SRC_STAT_WUHU_2025 = "src-stat-wuhu-2025"
SRC_STAT_SHANGHAI_2025 = "src-stat-shanghai-2025"
SRC_STAT_SHANGHAI_NEV_2025 = "src-stat-shanghai-nev-2025"
SRC_STAT_XIAN_2025 = "src-stat-xian-2025"
SRC_STAT_BEIJING_2025 = "src-stat-beijing-2025"
SRC_STAT_BEIJING_NEV_2025 = "src-stat-beijing-nev-2025"
SRC_STAT_ZHENGZHOU_2025 = "src-stat-zhengzhou-2025"
SRC_STAT_WUHAN_2025 = "src-stat-wuhan-2025"
SRC_STAT_WUHAN_NEV_2025 = "src-stat-wuhan-nev-2025"
SRC_STAT_SHIYAN_2025 = "src-stat-shiyan-2025"
SRC_STAT_HEFEI_NEV_2025 = "src-stat-hefei-nev-2025"
SRC_NIO_ABOUT = "src-nio-about-2025"
SRC_AUTOHOME_20F = "src-autohome-20f-2025"
SRC_BAIDU_YOUJIA_PRIVACY = "src-baidu-youjia-privacy"
SRC_CAAM_AUTO_ZONGHENG = "src-caam-auto-zongheng"
SRC_TESLA_SHANGHAI_CONTACT = "src-tesla-shanghai-contact"
SRC_CATL_YIBIN = "src-catl-yibin"
SRC_GWM_GLOBAL = "src-gwm-global-manufacturing"
SRC_THSVM = "src-tsinghua-svm-profile"
SRC_BIT_ME = "src-bit-me-profile"
SRC_TONGJI_AUTO = "src-tongji-auto-profile"
SRC_JLU_AUTO = "src-jlu-auto-profile"
SRC_HFUT_AUTO = "src-hfut-auto-profile"
SRC_CHD_AUTO = "src-changan-university-auto-profile"


def dump(name: str, obj: dict) -> None:
    path = DATA / name
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"  wrote {path.relative_to(ROOT)}")


def srcs(*ids: str | None) -> list[str]:
    return [sid for sid in ids if sid]


CITIES = [
    dict(
        id="beijing", name_zh="北京", name_en="Beijing",
        province_zh="北京市", province_en="Beijing Municipality",
        admin_level="municipality", admin_code="110000", lat=39.9042, lng=116.4074, tier="core",
        summary_zh="全国汽车总部、智能化、标准和媒体中心。官方产业规划将经开区、顺义、房山、昌平、怀柔和密云列为主要汽车产业承载区。",
        summary_en="National auto HQ, intelligence, standards and media hub. Official plans name BDA, Shunyi, Fangshan, Changping, Huairou and Miyun as main auto-industry zones.",
        history_summary_zh="从计划经济时期的整车试制与零部件配套，转向总部、软件、自动驾驶与标准制定。产量不代表北京的全部汽车实力。",
        history_summary_en="Shifted from planned-era assembly toward HQ, software, autonomous driving and standards. Output does not capture Beijing's full auto weight.",
        role_tags=["headquarters", "auto_software", "autonomous_driving", "chips", "testing", "higher_education", "auto_media", "oem_manufacturing"],
        cluster_ids=["jingjinji"],
        districts_zh=["经开区", "顺义", "房山", "昌平", "怀柔", "密云"],
        districts_en=["Beijing Economic-Technological Development Area", "Shunyi", "Fangshan", "Changping", "Huairou", "Miyun"],
    ),
    dict(
        id="shanghai", name_zh="上海", name_en="Shanghai",
        province_zh="上海市", province_en="Shanghai Municipality",
        admin_level="municipality", admin_code="310000", lat=31.2304, lng=121.4737, tier="core",
        summary_zh="综合汽车中心和国际汽车产业窗口：整车、零部件、软件、测试认证、汽车会展和国际合作并存。",
        summary_en="A full-stack auto centre and international window: vehicles, parts, software, testing, auto shows and cross-border cooperation.",
        history_summary_zh="中国最早的轿车工业基地之一。嘉定上海国际汽车城与临港特斯拉超级工厂把总部、测试和大规模制造叠在同一座城市。",
        history_summary_en="One of China's earliest passenger-car bases. Jiading's International Auto City and the Tesla Gigafactory stack HQ, testing and mass manufacturing in one city.",
        role_tags=["headquarters", "oem_manufacturing", "parts", "auto_software", "chips", "testing", "expo_culture", "export_logistics", "higher_education", "auto_media"],
        cluster_ids=["yangtze-river-delta"],
        districts_zh=["嘉定", "临港", "浦东", "安亭"],
        districts_en=["Jiading", "Lingang", "Pudong", "Anting"],
    ),
    dict(
        id="shenzhen", name_zh="深圳", name_en="Shenzhen",
        province_zh="广东省", province_en="Guangdong",
        admin_level="prefecture", admin_code="440300", lat=22.5431, lng=114.0579, tier="core",
        summary_zh="新能源总部、汽车电子、软件和出口中心。官方规划明确区分深汕整车制造与南山、宝安、坪山、龙岗的研发和产业功能。",
        summary_en="NEV headquarters, auto-electronics, software and export hub. Official plans split Shenshan vehicle manufacturing from Nanshan, Bao'an, Pingshan and Longgang R&D.",
        history_summary_zh="比亚迪总部位于深圳，但大量整车在西安、合肥、郑州、长沙、济南、常州和深汕等地生产。把产量记在深圳会严重高估其制造份额。",
        history_summary_en="BYD is headquartered in Shenzhen, but much of its vehicle output sits in Xi'an, Hefei, Zhengzhou, Changsha, Jinan, Changzhou and Shenshan. Booking that output to Shenzhen overstates its plants.",
        role_tags=["headquarters", "battery", "auto_electronics", "auto_software", "autonomous_driving", "export_logistics", "rd_design"],
        cluster_ids=["greater-bay-area"],
        districts_zh=["南山", "宝安", "坪山", "龙岗", "深汕特别合作区"],
        districts_en=["Nanshan", "Bao'an", "Pingshan", "Longgang", "Shenshan Special Cooperation Zone"],
    ),
    dict(
        id="guangzhou", name_zh="广州", name_en="Guangzhou",
        province_zh="广东省", province_en="Guangdong",
        admin_level="prefecture", admin_code="440100", lat=23.1291, lng=113.2644, tier="core",
        summary_zh="多品牌整车制造、自动驾驶、会展和汽车媒体中心。产业空间覆盖番禺、南沙、花都、黄埔和增城。",
        summary_en="Multi-brand vehicle manufacturing plus autonomous driving, auto shows and auto media. Industry space spans Panyu, Nansha, Huadu, Huangpu and Zengcheng.",
        history_summary_zh="日系合资长期主导乘用车产量；广汽埃安与小鹏把新能源和自动驾驶叠进同一座制造型城市。",
        history_summary_en="Japanese JVs long dominated passenger-car output; GAC Aion and XPENG folded NEVs and autonomy into the same manufacturing city.",
        role_tags=["oem_manufacturing", "headquarters", "autonomous_driving", "expo_culture", "auto_media", "higher_education"],
        cluster_ids=["greater-bay-area"],
        districts_zh=["番禺", "南沙", "花都", "黄埔", "增城"],
        districts_en=["Panyu", "Nansha", "Huadu", "Huangpu", "Zengcheng"],
    ),
    dict(
        id="chongqing", name_zh="重庆", name_en="Chongqing",
        province_zh="重庆市", province_en="Chongqing Municipality",
        admin_level="municipality", admin_code="500000", lat=29.5630, lng=106.5516, tier="core",
        summary_zh="大规模整车制造和智能网联转型中心。多家整车企业、大量零部件企业和正在增长的汽车软件集群并存。",
        summary_en="A large-scale vehicle-manufacturing and intelligent-connected transition hub, with multiple OEMs, a dense parts base and a growing auto-software cluster.",
        history_summary_zh="长安体系与兵工转产塑造了西南最大的乘用车和商用车基地之一；2025年地方统计拼合产量居全国城市前列。",
        history_summary_en="Changan and the defence-to-civilian conversion built one of the southwest's largest passenger- and commercial-vehicle bases. Compiled 2025 local output ranks among the top cities.",
        role_tags=["oem_manufacturing", "headquarters", "parts", "auto_software", "testing", "higher_education"],
        cluster_ids=["chengyu"],
        districts_zh=["两江新区", "渝北", "江北", "巴南"],
        districts_en=["Liangjiang New Area", "Yubei", "Jiangbei", "Banan"],
    ),
    dict(
        id="hefei", name_zh="合肥", name_en="Hefei",
        province_zh="安徽省", province_en="Anhui",
        admin_level="prefecture", admin_code="340100", lat=31.8206, lng=117.2272, tier="core",
        summary_zh="新能源整车增长最快的综合节点之一。江淮、蔚来、大众安徽、比亚迪、长安与国轩高科同城布局。",
        summary_en="One of the fastest-growing NEV manufacturing nodes: JAC, NIO, Volkswagen Anhui, BYD, Changan and Gotion share the city.",
        history_summary_zh="从江淮商用车和乘用车基地，叠加蔚来中国总部制造与比亚迪新基地后，2025年汽车与新能源汽车产量均位于全国前列。",
        history_summary_en="A JAC commercial/passenger base that absorbed NIO manufacturing and a BYD plant; 2025 auto and NEV output both rank nationally among the leaders.",
        role_tags=["oem_manufacturing", "headquarters", "battery", "higher_education"],
        cluster_ids=["yangtze-river-delta"],
        districts_zh=["经开区", "新站", "肥西"],
        districts_en=["Economic Development Area", "Xinzhan", "Feixi"],
    ),
    dict(
        id="wuhu", name_zh="芜湖", name_en="Wuhu",
        province_zh="安徽省", province_en="Anhui",
        admin_level="prefecture", admin_code="340200", lat=31.3528, lng=118.4331, tier="core",
        summary_zh="奇瑞主导的全球化整车与供应链城市，围绕发动机、变速箱、出口体系和本地零部件集群展开。",
        summary_en="A Chery-centred global vehicle and supply-chain city: engines, transmissions, export systems and a local parts cluster.",
        history_summary_zh="奇瑞从地方项目成长为出口导向整车集团，芜湖因此成为少有的“一企主导、产量全国前列”的地级市样本。",
        history_summary_en="Chery grew from a local project into an export-oriented OEM, making Wuhu a rare prefecture-level city whose output ranks nationally on one group.",
        role_tags=["oem_manufacturing", "headquarters", "parts", "export_logistics"],
        cluster_ids=["yangtze-river-delta"],
        districts_zh=["经济技术开发区"],
        districts_en=["Wuhu Economic & Technological Development Area"],
    ),
    dict(
        id="xian", name_zh="西安", name_en="Xi'an",
        province_zh="陕西省", province_en="Shaanxi",
        admin_level="prefecture", admin_code="610100", lat=34.3416, lng=108.9398, tier="core",
        summary_zh="比亚迪大规模制造与西北汽车教育节点。2025年主要产量来自比亚迪和吉利，新能源汽车占比较高。",
        summary_en="BYD's large-scale manufacturing node and a northwest auto-education hub. 2025 output is mainly BYD and Geely, with a high NEV share.",
        history_summary_zh="军工和商用车遗产之上，比亚迪西安基地把西北城市推入全国产量第一梯队。",
        history_summary_en="On a defence and commercial-vehicle legacy, BYD's Xi'an base pushed the city into the national output first tier.",
        role_tags=["oem_manufacturing", "higher_education", "battery"],
        cluster_ids=["northwest"],
        districts_zh=["高新区", "经开区"],
        districts_en=["High-tech Zone", "Economic Development Area"],
    ),
    dict(
        id="changchun", name_zh="长春", name_en="Changchun",
        province_zh="吉林省", province_en="Jilin",
        admin_level="prefecture", admin_code="220100", lat=43.8171, lng=125.3235, tier="core",
        summary_zh="中国汽车工业历史核心和一汽总部城市。历史、制造、研发和汽车文化均适合重点呈现。",
        summary_en="Historical core of China's auto industry and FAW headquarters. History, manufacturing, R&D and auto culture all belong on the city page.",
        history_summary_zh="第一汽车制造厂1950年代在此建厂，红旗、解放、一汽-大众构成中国最长的整车谱系之一。",
        history_summary_en="FAW was founded here in the 1950s. Hongqi, Jiefang and FAW-Volkswagen form one of China's longest vehicle lineages.",
        role_tags=["oem_manufacturing", "headquarters", "auto_history", "higher_education", "expo_culture", "rd_design"],
        cluster_ids=["northeast"],
        districts_zh=["汽车经济技术开发区", "绿园"],
        districts_en=["Automobile Economic & Technological Development Area", "Lvyuan"],
    ),
    dict(
        id="zhengzhou", name_zh="郑州", name_en="Zhengzhou",
        province_zh="河南省", province_en="Henan",
        admin_level="prefecture", admin_code="410100", lat=34.7466, lng=113.6254, tier="core",
        summary_zh="新能源整车和客车双重中心。比亚迪郑州基地与宇通客车构成乘用车和商用车两条主线。",
        summary_en="A dual NEV-vehicle and coach hub: BYD's Zhengzhou complex and Yutong form the passenger and commercial spines.",
        history_summary_zh="从客车出口和日产品牌，转向比亚迪综合制造基地后，产量跃入全国前列。",
        history_summary_en="Coach exports and the Nissan marque gave way to a BYD integrated manufacturing base, lifting output into the national top tier.",
        role_tags=["oem_manufacturing", "export_logistics"],
        cluster_ids=["central-plains"],
        districts_zh=["经开区", "航空港"],
        districts_en=["Economic Development Area", "Airport Economy Zone"],
    ),
    dict(
        id="liuzhou", name_zh="柳州", name_en="Liuzhou",
        province_zh="广西壮族自治区", province_en="Guangxi",
        admin_level="prefecture", admin_code="450200", lat=24.3264, lng=109.4281, tier="core",
        summary_zh="小型车、商用车和本地汽车文化城市。四家主要整车生产主体和数百家新能源汽车及零部件企业。",
        summary_en="A small-car, commercial-vehicle and local auto-culture city, with four main vehicle producers and hundreds of NEV and parts firms.",
        history_summary_zh="五菱微型车和东风柳汽商用车把一座工业城市塑造成“车城”认同。",
        history_summary_en="Wuling minicars and Dongfeng Liuzhou trucks turned an industrial city into a self-identified auto town.",
        role_tags=["oem_manufacturing", "parts", "auto_history", "expo_culture"],
        cluster_ids=["guangxi"],
        districts_zh=["柳东", "阳和"],
        districts_en=["Liudong", "Yanghe"],
    ),
    dict(
        id="wuhan", name_zh="武汉", name_en="Wuhan",
        province_zh="湖北省", province_en="Hubei",
        admin_level="prefecture", admin_code="420100", lat=30.5928, lng=114.3055, tier="core",
        summary_zh="东风体系、乘用车和智能网联中心。武汉经开区（中国车谷）聚集整车工厂、供应链和产业平台。",
        summary_en="Dongfeng system, passenger cars and intelligent-connected hub. Wuhan Economic & Technological Development Area (China Auto Valley) hosts plants, suppliers and platforms.",
        history_summary_zh="二汽总部东迁武汉后，车谷成为乘用车、新能源和智能网联的湖北轴线起点。",
        history_summary_en="After Dongfeng's HQ moved east to Wuhan, Auto Valley became the Hubei axis starting point for passenger cars, NEVs and intelligent connectivity.",
        role_tags=["oem_manufacturing", "headquarters", "autonomous_driving", "higher_education", "parts"],
        cluster_ids=["hubei-axis"],
        districts_zh=["武汉经开区", "汉阳"],
        districts_en=["Wuhan Economic & Technological Development Area", "Hanyang"],
    ),
    dict(
        id="changsha", name_zh="长沙", name_en="Changsha",
        province_zh="湖南省", province_en="Hunan",
        admin_level="prefecture", admin_code="430100", lat=28.2282, lng=112.9388, tier="core",
        summary_zh="新能源整车与湖南汽车产业轴核心。页面还应关联株洲的新能源商用车和湘潭的吉利体系。",
        summary_en="NEV manufacturing core of the Hunan auto axis. Later pages should link Zhuzhou NEV commercial vehicles and Xiangtan's Geely system.",
        history_summary_zh="比亚迪、上汽大众、广汽埃安和北汽福田把长沙推成中部新能源整车节点。",
        history_summary_en="BYD, SAIC Volkswagen, GAC Aion and BAIC Foton made Changsha a central-China NEV vehicle node.",
        role_tags=["oem_manufacturing", "higher_education"],
        cluster_ids=["hunan-axis"],
        districts_zh=["经开区", "雨花"],
        districts_en=["Economic Development Area", "Yuhua"],
    ),
    dict(
        id="tianjin", name_zh="天津", name_en="Tianjin",
        province_zh="天津市", province_en="Tianjin Municipality",
        admin_level="municipality", admin_code="120000", lat=39.3434, lng=117.3616, tier="core",
        summary_zh="整车生产、检测认证和行业标准中心。天津经开区承担天津大部分汽车产量，并主办泰达汽车论坛。",
        summary_en="Vehicle production, testing/certification and industry-standards centre. TEDA accounts for most of Tianjin's output and hosts the TEDA Auto Forum.",
        history_summary_zh="港口城市叠加一汽丰田、一汽-大众和长城产能，并以中汽中心掌握检测与标准话语权。",
        history_summary_en="A port city stacking FAW Toyota, FAW-Volkswagen and GWM capacity, with CATARC holding testing and standards authority.",
        role_tags=["oem_manufacturing", "testing", "expo_culture", "export_logistics"],
        cluster_ids=["jingjinji"],
        districts_zh=["天津经开区", "西青"],
        districts_en=["Tianjin Economic-Technological Development Area", "Xiqing"],
    ),
    dict(
        id="chengdu", name_zh="成都", name_en="Chengdu",
        province_zh="四川省", province_en="Sichuan",
        admin_level="prefecture", admin_code="510100", lat=30.5728, lng=104.0668, tier="core",
        summary_zh="西南整车生产和成渝供应链节点。与重庆、宜宾之间存在整车、零部件和动力电池协作。",
        summary_en="Southwest vehicle production and a Chengdu–Chongqing supply node, collaborating with Chongqing and Yibin on vehicles, parts and batteries.",
        history_summary_zh="一汽-大众、一汽丰田、沃尔沃与吉利/领克相关基地把成都经开区做成西南乘用车第二中心。",
        history_summary_en="FAW-Volkswagen, FAW Toyota, Volvo and Geely/Lynk & Co plants made Chengdu's development area the southwest's second passenger-car centre.",
        role_tags=["oem_manufacturing", "parts"],
        cluster_ids=["chengyu"],
        districts_zh=["成都经开区", "龙泉驿"],
        districts_en=["Chengdu Economic Development Area", "Longquanyi"],
    ),
    dict(
        id="hangzhou", name_zh="杭州", name_en="Hangzhou",
        province_zh="浙江省", province_en="Zhejiang",
        admin_level="prefecture", admin_code="330100", lat=30.2741, lng=120.1551, tier="core",
        summary_zh="吉利控股、零跑、极氪/领克/银河等民营整车总部与网易汽车所在地。产量在宁波杭州湾等地，总部在杭州。",
        summary_en="HQ city for Geely Holding, Leapmotor, Zeekr/Lynk/Galaxy and NetEase Auto. Plants sit around Ningbo Hangzhou Bay; headquarters are in Hangzhou.",
        history_summary_zh="浙江民营车企把集团总部放在杭州，制造放在宁波、台州、金华等地。用杭州产量代表吉利会把总部和工厂混在一起。",
        history_summary_en="Zhejiang private OEMs keep group HQ in Hangzhou and manufacturing in Ningbo, Taizhou and Jinhua. Booking that output to Hangzhou would mix HQ with plants.",
        role_tags=["headquarters", "auto_software", "auto_media", "rd_design"],
        cluster_ids=["yangtze-river-delta"],
        districts_zh=["滨江", "萧山", "余杭"],
        districts_en=["Binjiang", "Xiaoshan", "Yuhang"],
    ),
    dict(
        id="shenyang", name_zh="沈阳", name_en="Shenyang",
        province_zh="辽宁省", province_en="Liaoning",
        admin_level="prefecture", admin_code="210100", lat=41.8057, lng=123.4315, tier="core",
        summary_zh="华晨宝马总部与整车制造所在地，东北乘用车合资枢纽。",
        summary_en="BMW Brilliance headquarters and vehicle manufacturing; the northeast's passenger-car JV hub.",
        history_summary_zh="一汽在长春、华晨宝马在沈阳，是两条并列的东北乘用车主轴，不能把沈阳产量记到长春。",
        history_summary_en="FAW in Changchun and BMW Brilliance in Shenyang are parallel northeast passenger-car axes; Shenyang output is not Changchun's.",
        role_tags=["headquarters", "oem_manufacturing"],
        cluster_ids=["northeast"],
        districts_zh=["铁西", "大东", "浑南"],
        districts_en=["Tiexi", "Dadong", "Hunnan"],
    ),
    dict(
        id="ningde", name_zh="宁德", name_en="Ningde",
        province_zh="福建省", province_en="Fujian",
        admin_level="prefecture", admin_code="350900", lat=26.6655, lng=119.5480, tier="specialist",
        summary_zh="动力电池总部和产业集群。宁德时代已形成跨城市、跨国生产和研发网络。",
        summary_en="Power-battery headquarters and industrial cluster. CATL already runs a cross-city and cross-border manufacturing and R&D network.",
        history_summary_zh="一座原本不以整车见长的东部地级市，因动力电池成为全球汽车供应链关键节点。",
        history_summary_en="An eastern prefecture that was never an OEM city became a global auto-supply node through power batteries.",
        role_tags=["battery", "headquarters", "rd_design"],
        cluster_ids=["battery-corridor"],
        districts_zh=["蕉城", "福鼎", "霞浦"],
        districts_en=["Jiaocheng", "Fuding", "Xiapu"],
    ),
    dict(
        id="changzhou", name_zh="常州", name_en="Changzhou",
        province_zh="江苏省", province_en="Jiangsu",
        admin_level="prefecture", admin_code="320400", lat=31.8107, lng=119.9741, tier="specialist",
        summary_zh="新能源整车与动力电池高度集聚：理想汽车、比亚迪、江苏时代、蜂巢能源、中创新航及大量零部件企业。",
        summary_en="Dense NEV vehicles and batteries: Li Auto, BYD, CATL Jiangsu, SVOLT, CALB and a large parts base.",
        history_summary_zh="在长三角协作中常被点名为动力电池节点，同时承接理想和比亚迪整车。",
        history_summary_en="Named in Yangtze Delta collaboration cases as a battery node, while also hosting Li Auto and BYD vehicle plants.",
        role_tags=["oem_manufacturing", "battery", "parts"],
        cluster_ids=["yangtze-river-delta", "battery-corridor"],
        districts_zh=["金坛", "武进", "经开区"],
        districts_en=["Jintan", "Wujin", "Economic Development Area"],
    ),
    dict(
        id="suzhou", name_zh="苏州", name_en="Suzhou",
        province_zh="江苏省", province_en="Jiangsu",
        admin_level="prefecture", admin_code="320500", lat=31.2989, lng=120.5853, tier="specialist",
        summary_zh="汽车电子、零部件、智能网联测试和出口。太仓德系零部件集群与太仓港汽车出口是跨城市网络的典型接口。",
        summary_en="Auto electronics, parts, intelligent-connected testing and export. Taicang's German parts cluster and auto export port are typical cross-city interfaces.",
        history_summary_zh="不靠整车厂定义自己，而靠给上海和长三角整车配套。",
        history_summary_en="Defines itself by supplying Shanghai and Yangtze Delta OEMs rather than by hosting a flagship plant.",
        role_tags=["auto_electronics", "parts", "testing", "export_logistics"],
        cluster_ids=["yangtze-river-delta"],
        districts_zh=["工业园区", "太仓", "昆山"],
        districts_en=["Suzhou Industrial Park", "Taicang", "Kunshan"],
    ),
    dict(
        id="ningbo", name_zh="宁波", name_en="Ningbo",
        province_zh="浙江省", province_en="Zhejiang",
        admin_level="prefecture", admin_code="330200", lat=29.8683, lng=121.5440, tier="specialist",
        summary_zh="全球化零部件公司集群：均胜电子、拓普集团、敏实集团、华翔集团及大量规模以上汽车企业。",
        summary_en="A cluster of globalising parts groups: Joyson, Tuopu, Minth, Huaxiang and many above-scale auto firms.",
        history_summary_zh="国家发展改革委区域资料将宁波整车制造与上海软件芯片、常州动力电池并列为长三角协作案例。",
        history_summary_en="NDRC regional materials cite Ningbo vehicle manufacturing alongside Shanghai software/chips and Changzhou batteries as a Yangtze Delta collaboration case.",
        role_tags=["parts", "auto_electronics", "oem_manufacturing", "export_logistics"],
        cluster_ids=["yangtze-river-delta"],
        districts_zh=["杭州湾", "北仑", "慈溪"],
        districts_en=["Hangzhou Bay", "Beilun", "Cixi"],
    ),
    dict(
        id="huizhou", name_zh="惠州", name_en="Huizhou",
        province_zh="广东省", province_en="Guangdong",
        admin_level="prefecture", admin_code="441300", lat=23.1115, lng=114.4162, tier="specialist",
        summary_zh="汽车电子、智能座舱和动力电池。德赛西威、华阳集团、亿纬锂能与深圳、广州形成电子与零部件协作。",
        summary_en="Auto electronics, smart cockpit and batteries. Desay SV, Foryou/HuaYang and EVE Energy collaborate with Shenzhen and Guangzhou.",
        history_summary_zh="湾区电子制造外溢，使惠州成为座舱域控制器和电池的专业城市。",
        history_summary_en="Bay Area electronics overflow made Huizhou a specialist city for cockpit domain controllers and batteries.",
        role_tags=["auto_electronics", "battery", "parts"],
        cluster_ids=["greater-bay-area"],
        districts_zh=["仲恺", "惠城"],
        districts_en=["Zhongkai", "Huicheng"],
    ),
    dict(
        id="yibin", name_zh="宜宾", name_en="Yibin",
        province_zh="四川省", province_en="Sichuan",
        admin_level="prefecture", admin_code="511500", lat=28.7518, lng=104.6432, tier="specialist",
        summary_zh="动力电池制造和能源条件城市。四川时代、动力电池产业园与世界动力电池大会构成成渝电池支点。",
        summary_en="Power-battery manufacturing plus energy conditions. CATL Sichuan, the battery park and the World Power Battery Conference form the Chengyu battery pivot.",
        history_summary_zh="水电与工业用地条件吸引宁德时代落地，宜宾因此进入汽车图谱，而不是因为整车厂。",
        history_summary_en="Hydropower and industrial land brought CATL in; Yibin enters the auto atlas through batteries, not OEMs.",
        role_tags=["battery", "expo_culture"],
        cluster_ids=["chengyu", "battery-corridor"],
        districts_zh=["三江新区"],
        districts_en=["Sanjiang New Area"],
    ),
    dict(
        id="baoding", name_zh="保定", name_en="Baoding",
        province_zh="河北省", province_en="Hebei",
        admin_level="prefecture", admin_code="130600", lat=38.8510, lng=115.4900, tier="specialist",
        summary_zh="民营整车总部和完整制造链。长城汽车总部、研发设施、徐水智慧工厂及本地零部件体系。",
        summary_en="A private OEM headquarters with a full manufacturing chain: GWM HQ, R&D, the Xushui smart plant and a local parts system.",
        history_summary_zh="长城从皮卡和SUV起家，使保定成为京津冀整车制造的河北支点。",
        history_summary_en="GWM's pickup and SUV path made Baoding the Hebei vehicle-manufacturing pivot of Jing-Jin-Ji.",
        role_tags=["headquarters", "oem_manufacturing", "rd_design", "parts"],
        cluster_ids=["jingjinji"],
        districts_zh=["徐水", "莲池"],
        districts_en=["Xushui", "Lianchi"],
    ),
    dict(
        id="jinan", name_zh="济南", name_en="Jinan",
        province_zh="山东省", province_en="Shandong",
        admin_level="prefecture", admin_code="370100", lat=36.6512, lng=117.1201, tier="specialist",
        summary_zh="重型商用车与新能源整车。中国重汽、比亚迪、吉利及相关零部件园区。",
        summary_en="Heavy commercial vehicles plus NEV passenger cars: Sinotruk, BYD, Geely and related parts parks.",
        history_summary_zh="重汽体系长期定义济南的商用车身份，比亚迪等新基地把它拉进新能源乘用车版图。",
        history_summary_en="Sinotruk long defined Jinan as a commercial-vehicle city; BYD and others pulled it into NEV passenger cars.",
        role_tags=["oem_manufacturing", "headquarters", "parts"],
        cluster_ids=["shandong"],
        districts_zh=["高新区", "章丘"],
        districts_en=["High-tech Zone", "Zhangqiu"],
    ),
    dict(
        id="shiyan", name_zh="十堰", name_en="Shiyan",
        province_zh="湖北省", province_en="Hubei",
        admin_level="prefecture", admin_code="420300", lat=32.6294, lng=110.7980, tier="specialist",
        summary_zh="中国商用车历史和专业供应链城市。东风商用车、重型与中型商用车工厂、大量专用零部件企业。",
        summary_en="China's commercial-vehicle history city and a specialist supply chain: Dongfeng Commercial Vehicles, medium/heavy plants and dedicated parts firms.",
        history_summary_zh="第二汽车制造厂因备战选址十堰。总部东迁武汉后，十堰仍是中重卡和专用件的历史产地。",
        history_summary_en="Second Auto Works was sited in Shiyan for defence-in-depth. After HQ moved to Wuhan, Shiyan remained the historical home of medium/heavy trucks and specialist parts.",
        role_tags=["oem_manufacturing", "auto_history", "parts"],
        cluster_ids=["hubei-axis"],
        districts_zh=["张湾", "茅箭"],
        districts_en=["Zhangwan", "Maojian"],
    ),
    dict(
        id="xiamen", name_zh="厦门", name_en="Xiamen",
        province_zh="福建省", province_en="Fujian",
        admin_level="prefecture", admin_code="350200", lat=24.4798, lng=118.0894, tier="specialist",
        summary_zh="客车和新能源商用车。金龙客车、金旅客车，以及新能源客车与燃料电池商用车产业。",
        summary_en="Coaches and NEV commercial vehicles: King Long, Golden Dragon, plus NEV buses and fuel-cell commercial vehicles.",
        history_summary_zh="港口城市用客车出口建立全球可见度，而不是用乘用车产量。",
        history_summary_en="A port city that earned global visibility through coach exports rather than passenger-car volume.",
        role_tags=["oem_manufacturing", "export_logistics"],
        cluster_ids=["fujian-bus"],
        districts_zh=["集美", "湖里"],
        districts_en=["Jimei", "Huli"],
    ),
    dict(
        id="jiaxing", name_zh="嘉兴", name_en="Jiaxing",
        province_zh="浙江省", province_en="Zhejiang",
        admin_level="prefecture", admin_code="330400", lat=30.7462, lng=120.7555, tier="specialist",
        summary_zh="哪吒汽车（合众新能源）总部在桐乡。长三角整车总部节点，制造与上海、杭州联动。",
        summary_en="Neta Auto (Hozon) is headquartered in Tongxiang. A Yangtze Delta OEM-HQ node linked to Shanghai and Hangzhou plants.",
        history_summary_zh="合众把集团总部放在嘉兴桐乡，不等于嘉兴产量等于哪吒全国产量。",
        history_summary_en="Hozon putting group HQ in Tongxiang, Jiaxing, does not mean Jiaxing output equals Neta's national volume.",
        role_tags=["headquarters", "oem_manufacturing"],
        cluster_ids=["yangtze-river-delta"],
        districts_zh=["桐乡", "秀洲"],
        districts_en=["Tongxiang", "Xiuzhou"],
    ),
]

for c in CITIES:
    c["featured_entity_ids"] = []
    c["last_verified"] = LV
    c["confidence"] = CANDIDATE_CONFIDENCE
    c["source_ids"] = []


def org(**kw):
    row = dict(
        parent_id=None,
        founded_year=None,
        website=None,
        status="active",
        focus_tags=[],
        aliases=[],
        last_verified=LV,
        confidence=CANDIDATE_CONFIDENCE,
        source_ids=[],
    )
    row.update(kw)
    return row


ORGS = [
    org(id="baic", legal_name_zh="北京汽车集团有限公司", legal_name_en="Beijing Automotive Group Co., Ltd.",
        display_name_zh="北汽", display_name_en="BAIC", organization_type="automaker",
        headquarters_city_id="beijing", founded_year=1958, focus_tags=["oem_manufacturing", "headquarters"]),
    org(id="beijing-benz", legal_name_zh="北京奔驰汽车有限公司", legal_name_en="Beijing Benz Automotive Co., Ltd.",
        display_name_zh="北京奔驰", display_name_en="Beijing Benz", organization_type="automaker",
        parent_id="baic", headquarters_city_id="beijing", focus_tags=["oem_manufacturing"]),
    org(id="xiaomi-auto", legal_name_zh="小米汽车", legal_name_en="Xiaomi Auto",
        display_name_zh="小米汽车", display_name_en="Xiaomi Auto", organization_type="automaker",
        headquarters_city_id="beijing", founded_year=2021, focus_tags=["oem_manufacturing", "auto_software"]),
    org(id="li-auto", legal_name_zh="理想汽车", legal_name_en="Li Auto",
        display_name_zh="理想汽车", display_name_en="Li Auto", organization_type="automaker",
        headquarters_city_id="beijing", founded_year=2015, website="https://www.lixiang.com/",
        focus_tags=["headquarters", "oem_manufacturing"]),
    org(id="baidu", legal_name_zh="百度", legal_name_en="Baidu",
        display_name_zh="百度", display_name_en="Baidu", organization_type="software_company",
        headquarters_city_id="beijing", focus_tags=["autonomous_driving", "auto_software"]),
    org(id="horizon-robotics", legal_name_zh="地平线", legal_name_en="Horizon Robotics",
        display_name_zh="地平线", display_name_en="Horizon Robotics", organization_type="chip_company",
        headquarters_city_id="beijing", focus_tags=["chips", "autonomous_driving"]),
    org(id="saic", legal_name_zh="上海汽车集团股份有限公司", legal_name_en="SAIC Motor Corporation Limited",
        display_name_zh="上汽集团", display_name_en="SAIC Motor", organization_type="automaker",
        headquarters_city_id="shanghai", website="https://www.saicmotor.com/", focus_tags=["headquarters", "oem_manufacturing"]),
    org(id="tesla-china", legal_name_zh="特斯拉（上海）有限公司", legal_name_en="Tesla (Shanghai) Co., Ltd.",
        display_name_zh="特斯拉上海", display_name_en="Tesla Shanghai", organization_type="automaker",
        headquarters_city_id="shanghai", founded_year=2018, focus_tags=["oem_manufacturing", "export_logistics"]),
    org(id="byd", legal_name_zh="比亚迪股份有限公司", legal_name_en="BYD Company Limited",
        display_name_zh="比亚迪", display_name_en="BYD", organization_type="automaker",
        headquarters_city_id="shenzhen", website="https://www.byd.com/", founded_year=1995,
        focus_tags=["headquarters", "oem_manufacturing", "battery"]),
    org(id="gac", legal_name_zh="广州汽车集团股份有限公司", legal_name_en="Guangzhou Automobile Group Co., Ltd.",
        display_name_zh="广汽集团", display_name_en="GAC Group", organization_type="automaker",
        headquarters_city_id="guangzhou", website="https://www.gac.com.cn/", focus_tags=["headquarters", "oem_manufacturing"]),
    org(id="gac-honda", legal_name_zh="广汽本田汽车有限公司", legal_name_en="GAC Honda Automobile Co., Ltd.",
        display_name_zh="广汽本田", display_name_en="GAC Honda", organization_type="automaker",
        parent_id="gac", headquarters_city_id="guangzhou", focus_tags=["oem_manufacturing"]),
    org(id="gac-toyota", legal_name_zh="广汽丰田汽车有限公司", legal_name_en="GAC Toyota Motor Co., Ltd.",
        display_name_zh="广汽丰田", display_name_en="GAC Toyota", organization_type="automaker",
        parent_id="gac", headquarters_city_id="guangzhou", focus_tags=["oem_manufacturing"]),
    org(id="dongfeng-nissan", legal_name_zh="东风汽车有限公司东风日产乘用车公司", legal_name_en="Dongfeng Nissan Passenger Vehicle Company",
        display_name_zh="东风日产", display_name_en="Dongfeng Nissan", organization_type="automaker",
        parent_id="dongfeng", headquarters_city_id="guangzhou", focus_tags=["oem_manufacturing"]),
    org(id="xpeng", legal_name_zh="小鹏汽车", legal_name_en="XPENG",
        display_name_zh="小鹏汽车", display_name_en="XPENG", organization_type="automaker",
        headquarters_city_id="guangzhou", website="https://www.xiaopeng.com/", focus_tags=["oem_manufacturing", "autonomous_driving"]),
    org(id="weiride", legal_name_zh="文远知行", legal_name_en="WeRide",
        display_name_zh="文远知行", display_name_en="WeRide", organization_type="software_company",
        headquarters_city_id="guangzhou", focus_tags=["autonomous_driving"]),
    org(id="pony-ai", legal_name_zh="小马智行", legal_name_en="Pony.ai",
        display_name_zh="小马智行", display_name_en="Pony.ai", organization_type="software_company",
        headquarters_city_id="guangzhou", focus_tags=["autonomous_driving"]),
    org(id="changan", legal_name_zh="重庆长安汽车股份有限公司", legal_name_en="Chongqing Changan Automobile Co., Ltd.",
        display_name_zh="长安汽车", display_name_en="Changan Auto", organization_type="automaker",
        headquarters_city_id="chongqing", website="https://www.changan.com.cn/", focus_tags=["headquarters", "oem_manufacturing"]),
    org(id="seres", legal_name_zh="赛力斯集团", legal_name_en="Seres Group",
        display_name_zh="赛力斯", display_name_en="Seres", organization_type="automaker",
        headquarters_city_id="chongqing", focus_tags=["oem_manufacturing"]),
    org(id="qianli", legal_name_zh="千里科技", legal_name_en="Qianli Technology",
        display_name_zh="千里科技", display_name_en="Qianli Technology", organization_type="software_company",
        headquarters_city_id="chongqing", focus_tags=["auto_software"]),
    org(id="jac", legal_name_zh="安徽江淮汽车集团股份有限公司", legal_name_en="Anhui Jianghuai Automobile Group",
        display_name_zh="江淮汽车", display_name_en="JAC", organization_type="automaker",
        headquarters_city_id="hefei", focus_tags=["headquarters", "oem_manufacturing"]),
    org(id="nio", legal_name_zh="蔚来", legal_name_en="NIO",
        display_name_zh="蔚来", display_name_en="NIO", organization_type="automaker",
        headquarters_city_id="shanghai", website="https://www.nio.com/", focus_tags=["headquarters", "oem_manufacturing"],
        confidence=0.80, source_ids=[SRC_NIO_ABOUT]),
    org(id="vw-anhui", legal_name_zh="大众汽车（安徽）有限公司", legal_name_en="Volkswagen (Anhui) Co., Ltd.",
        display_name_zh="大众安徽", display_name_en="Volkswagen Anhui", organization_type="automaker",
        headquarters_city_id="hefei", focus_tags=["oem_manufacturing"]),
    org(id="gotion", legal_name_zh="国轩高科", legal_name_en="Gotion High-tech",
        display_name_zh="国轩高科", display_name_en="Gotion", organization_type="battery_company",
        headquarters_city_id="hefei", focus_tags=["battery"]),
    org(id="chery", legal_name_zh="奇瑞汽车股份有限公司", legal_name_en="Chery Automobile Co., Ltd.",
        display_name_zh="奇瑞汽车", display_name_en="Chery", organization_type="automaker",
        headquarters_city_id="wuhu", website="https://www.cheryinternational.com/", focus_tags=["headquarters", "oem_manufacturing", "export_logistics"]),
    org(id="geely", legal_name_zh="浙江吉利控股集团", legal_name_en="Zhejiang Geely Holding Group",
        display_name_zh="吉利", display_name_en="Geely", organization_type="automaker",
        headquarters_city_id="hangzhou", website="https://www.geely.com/", focus_tags=["headquarters", "oem_manufacturing"]),
    org(id="faw", legal_name_zh="中国第一汽车集团有限公司", legal_name_en="China FAW Group Co., Ltd.",
        display_name_zh="中国一汽", display_name_en="FAW", organization_type="automaker",
        headquarters_city_id="changchun", founded_year=1953, website="https://www.faw.com.cn/",
        focus_tags=["headquarters", "oem_manufacturing", "auto_history"]),
    org(id="hongqi", legal_name_zh="一汽红旗", legal_name_en="FAW Hongqi",
        display_name_zh="红旗", display_name_en="Hongqi", organization_type="brand",
        parent_id="faw", headquarters_city_id="changchun", focus_tags=["oem_manufacturing"]),
    org(id="jiefang", legal_name_zh="一汽解放", legal_name_en="FAW Jiefang",
        display_name_zh="解放", display_name_en="Jiefang", organization_type="brand",
        parent_id="faw", headquarters_city_id="changchun", focus_tags=["oem_manufacturing"]),
    org(id="bestune", legal_name_zh="一汽奔腾", legal_name_en="Bestune",
        display_name_zh="奔腾", display_name_en="Bestune", organization_type="brand",
        parent_id="faw", headquarters_city_id="changchun", focus_tags=["oem_manufacturing"]),
    org(id="faw-vw", legal_name_zh="一汽-大众汽车有限公司", legal_name_en="FAW-Volkswagen Automotive Co., Ltd.",
        display_name_zh="一汽-大众", display_name_en="FAW-Volkswagen", organization_type="automaker",
        parent_id="faw", headquarters_city_id="changchun", focus_tags=["oem_manufacturing"]),
    org(id="audi-faw-nev", legal_name_zh="奥迪一汽新能源汽车有限公司", legal_name_en="Audi FAW NEV Co., Ltd.",
        display_name_zh="奥迪一汽新能源", display_name_en="Audi FAW NEV", organization_type="automaker",
        parent_id="faw", headquarters_city_id="changchun", focus_tags=["oem_manufacturing"]),
    org(id="yutong", legal_name_zh="宇通客车股份有限公司", legal_name_en="Yutong Bus Co., Ltd.",
        display_name_zh="宇通客车", display_name_en="Yutong", organization_type="automaker",
        headquarters_city_id="zhengzhou", website="https://en.yutong.com/", founded_year=1993,
        focus_tags=["oem_manufacturing", "export_logistics"]),
    org(id="zhengzhou-nissan", legal_name_zh="郑州日产汽车有限公司", legal_name_en="Zhengzhou Nissan Automobile Co., Ltd.",
        display_name_zh="郑州日产", display_name_en="Zhengzhou Nissan", organization_type="automaker",
        headquarters_city_id="zhengzhou", focus_tags=["oem_manufacturing"]),
    org(id="sgmw", legal_name_zh="上汽通用五菱汽车股份有限公司", legal_name_en="SAIC-GM-Wuling Automobile Co., Ltd.",
        display_name_zh="上汽通用五菱", display_name_en="SGMW", organization_type="automaker",
        parent_id="saic", headquarters_city_id="liuzhou", focus_tags=["oem_manufacturing"]),
    org(id="dongfeng-liuzhou", legal_name_zh="东风柳州汽车有限公司", legal_name_en="Dongfeng Liuzhou Motor Co., Ltd.",
        display_name_zh="东风柳汽", display_name_en="Dongfeng Liuzhou Motor", organization_type="automaker",
        parent_id="dongfeng", headquarters_city_id="liuzhou", focus_tags=["oem_manufacturing"]),
    org(id="guangxi-auto", legal_name_zh="广西汽车集团有限公司", legal_name_en="Guangxi Automobile Group Co., Ltd.",
        display_name_zh="广西汽车集团", display_name_en="Guangxi Auto Group", organization_type="automaker",
        headquarters_city_id="liuzhou", focus_tags=["oem_manufacturing"]),
    org(id="dongfeng", legal_name_zh="东风汽车集团有限公司", legal_name_en="Dongfeng Motor Corporation",
        display_name_zh="东风集团", display_name_en="Dongfeng Motor", organization_type="automaker",
        headquarters_city_id="wuhan", website="https://www.dfmc.com.cn/", focus_tags=["headquarters", "oem_manufacturing", "auto_history"]),
    org(id="voyah", legal_name_zh="岚图汽车科技股份有限公司", legal_name_en="VOYAH Automotive Technology Co., Ltd.",
        display_name_zh="岚图汽车", display_name_en="VOYAH", organization_type="automaker",
        parent_id="dongfeng", headquarters_city_id="wuhan", founded_year=2021,
        website="https://www.voyah.com.cn/", focus_tags=["oem_manufacturing"]),
    org(id="mengshi", legal_name_zh="猛士汽车", legal_name_en="Mengshi",
        display_name_zh="猛士", display_name_en="Mengshi", organization_type="brand",
        parent_id="dongfeng", headquarters_city_id="wuhan", focus_tags=["oem_manufacturing"]),
    org(id="aeolus", legal_name_zh="东风奕派（eπ）", legal_name_en="Dongfeng eπ",
        display_name_zh="东风奕派", display_name_en="Dongfeng eπ", organization_type="brand",
        parent_id="dongfeng", headquarters_city_id="wuhan", focus_tags=["oem_manufacturing"]),
    org(id="faw-toyota", legal_name_zh="一汽丰田", legal_name_en="FAW Toyota",
        display_name_zh="一汽丰田", display_name_en="FAW Toyota", organization_type="automaker",
        parent_id="faw", headquarters_city_id="tianjin", focus_tags=["oem_manufacturing"]),
    org(id="gwm", legal_name_zh="长城汽车股份有限公司", legal_name_en="Great Wall Motor Company Limited",
        display_name_zh="长城汽车", display_name_en="Great Wall Motor", organization_type="automaker",
        headquarters_city_id="baoding", website="https://www.gwm.com.cn/", focus_tags=["headquarters", "oem_manufacturing"]),
    org(id="volvo-cars-chengdu", legal_name_zh="沃尔沃汽车成都工厂运营主体", legal_name_en="Volvo Cars Chengdu plant operator",
        display_name_zh="沃尔沃成都", display_name_en="Volvo Chengdu", organization_type="automaker",
        headquarters_city_id="chengdu", focus_tags=["oem_manufacturing"]),
    org(id="catl", legal_name_zh="宁德时代新能源科技股份有限公司", legal_name_en="Contemporary Amperex Technology Co., Limited",
        display_name_zh="宁德时代", display_name_en="CATL", organization_type="battery_company",
        headquarters_city_id="ningde", website="https://www.catl.com/", founded_year=2011,
        focus_tags=["battery", "headquarters"]),
    org(id="svolt", legal_name_zh="蜂巢能源", legal_name_en="SVOLT Energy",
        display_name_zh="蜂巢能源", display_name_en="SVOLT", organization_type="battery_company",
        headquarters_city_id="changzhou", focus_tags=["battery"]),
    org(id="calb", legal_name_zh="中创新航", legal_name_en="CALB",
        display_name_zh="中创新航", display_name_en="CALB", organization_type="battery_company",
        headquarters_city_id="changzhou", focus_tags=["battery"]),
    org(id="desay-sv", legal_name_zh="惠州市德赛西威汽车电子股份有限公司", legal_name_en="Huizhou Desay SV Automotive Co., Ltd.",
        display_name_zh="德赛西威", display_name_en="Desay SV", organization_type="supplier",
        headquarters_city_id="huizhou", focus_tags=["auto_electronics"]),
    org(id="holosonics", legal_name_zh="惠州市华阳集团", legal_name_en="Foryou / HuaYang Group",
        display_name_zh="华阳集团", display_name_en="HuaYang", organization_type="supplier",
        headquarters_city_id="huizhou", focus_tags=["auto_electronics"]),
    org(id="eve-energy", legal_name_zh="亿纬锂能", legal_name_en="EVE Energy",
        display_name_zh="亿纬锂能", display_name_en="EVE Energy", organization_type="battery_company",
        headquarters_city_id="huizhou", focus_tags=["battery"]),
    org(id="joyson", legal_name_zh="宁波均胜电子股份有限公司", legal_name_en="Ningbo Joyson Electronic Corp.",
        display_name_zh="均胜电子", display_name_en="Joyson", organization_type="supplier",
        headquarters_city_id="ningbo", focus_tags=["auto_electronics", "parts"]),
    org(id="tuopu", legal_name_zh="宁波拓普集团股份有限公司", legal_name_en="Ningbo Tuopu Group Co., Ltd.",
        display_name_zh="拓普集团", display_name_en="Tuopu", organization_type="supplier",
        headquarters_city_id="ningbo", focus_tags=["parts"]),
    org(id="minth", legal_name_zh="敏实集团有限公司", legal_name_en="Minth Group Limited",
        display_name_zh="敏实集团", display_name_en="Minth", organization_type="supplier",
        headquarters_city_id="ningbo", focus_tags=["parts"]),
    org(id="huaxiang", legal_name_zh="华翔集团股份有限公司", legal_name_en="Huaxiang Group Co., Ltd.",
        display_name_zh="华翔集团", display_name_en="Huaxiang", organization_type="supplier",
        headquarters_city_id="ningbo", focus_tags=["parts"]),
    org(id="sinotruk", legal_name_zh="中国重型汽车集团有限公司", legal_name_en="China National Heavy Duty Truck Group",
        display_name_zh="中国重汽", display_name_en="Sinotruk", organization_type="automaker",
        headquarters_city_id="jinan", focus_tags=["headquarters", "oem_manufacturing"]),
    org(id="king-long", legal_name_zh="厦门金龙联合汽车工业有限公司", legal_name_en="Xiamen King Long United Automotive Industry Co., Ltd.",
        display_name_zh="金龙客车", display_name_en="King Long", organization_type="automaker",
        headquarters_city_id="xiamen", focus_tags=["oem_manufacturing"]),
    org(id="golden-dragon", legal_name_zh="厦门金龙旅行车有限公司", legal_name_en="Xiamen Golden Dragon Bus Co., Ltd.",
        display_name_zh="金旅客车", display_name_en="Golden Dragon", organization_type="automaker",
        headquarters_city_id="xiamen", focus_tags=["oem_manufacturing"]),
    org(id="catarc", legal_name_zh="中国汽车技术研究中心有限公司", legal_name_en="China Automotive Technology and Research Center",
        display_name_zh="中汽中心", display_name_en="CATARC", organization_type="testing_body",
        headquarters_city_id="tianjin", focus_tags=["testing"]),
    org(id="caeri", legal_name_zh="中国汽车工程研究院股份有限公司", legal_name_en="China Automotive Engineering Research Institute",
        display_name_zh="中国汽研", display_name_en="CAERI", organization_type="research_institute",
        headquarters_city_id="chongqing", focus_tags=["testing", "rd_design"]),
    org(id="tsinghua", legal_name_zh="清华大学", legal_name_en="Tsinghua University",
        display_name_zh="清华大学", display_name_en="Tsinghua University", organization_type="university",
        headquarters_city_id="beijing", website="https://www.tsinghua.edu.cn/", focus_tags=["higher_education"]),
    org(id="bit", legal_name_zh="北京理工大学", legal_name_en="Beijing Institute of Technology",
        display_name_zh="北京理工大学", display_name_en="BIT", organization_type="university",
        headquarters_city_id="beijing", focus_tags=["higher_education"]),
    org(id="tongji", legal_name_zh="同济大学", legal_name_en="Tongji University",
        display_name_zh="同济大学", display_name_en="Tongji University", organization_type="university",
        headquarters_city_id="shanghai", focus_tags=["higher_education"]),
    org(id="sjtu", legal_name_zh="上海交通大学", legal_name_en="Shanghai Jiao Tong University",
        display_name_zh="上海交通大学", display_name_en="SJTU", organization_type="university",
        headquarters_city_id="shanghai", focus_tags=["higher_education"]),
    org(id="jlu", legal_name_zh="吉林大学", legal_name_en="Jilin University",
        display_name_zh="吉林大学", display_name_en="Jilin University", organization_type="university",
        headquarters_city_id="changchun", focus_tags=["higher_education", "auto_history"]),
    org(id="whut", legal_name_zh="武汉理工大学", legal_name_en="Wuhan University of Technology",
        display_name_zh="武汉理工大学", display_name_en="WUT", organization_type="university",
        headquarters_city_id="wuhan", focus_tags=["higher_education"]),
    org(id="hfut", legal_name_zh="合肥工业大学", legal_name_en="Hefei University of Technology",
        display_name_zh="合肥工业大学", display_name_en="HFUT", organization_type="university",
        headquarters_city_id="hefei", focus_tags=["higher_education"]),
    org(id="changan-univ", legal_name_zh="长安大学", legal_name_en="Chang'an University",
        display_name_zh="长安大学", display_name_en="Chang'an University", organization_type="university",
        headquarters_city_id="xian", focus_tags=["higher_education"]),
    org(id="hnu", legal_name_zh="湖南大学", legal_name_en="Hunan University",
        display_name_zh="湖南大学", display_name_en="Hunan University", organization_type="university",
        headquarters_city_id="changsha", focus_tags=["higher_education"]),
    org(id="scut", legal_name_zh="华南理工大学", legal_name_en="South China University of Technology",
        display_name_zh="华南理工大学", display_name_en="SCUT", organization_type="university",
        headquarters_city_id="guangzhou", focus_tags=["higher_education"]),
    org(id="cqu", legal_name_zh="重庆大学", legal_name_en="Chongqing University",
        display_name_zh="重庆大学", display_name_en="Chongqing University", organization_type="university",
        headquarters_city_id="chongqing", focus_tags=["higher_education"]),
    org(id="cqut", legal_name_zh="重庆理工大学", legal_name_en="Chongqing University of Technology",
        display_name_zh="重庆理工大学", display_name_en="CQUT", organization_type="university",
        headquarters_city_id="chongqing", focus_tags=["higher_education"]),
    org(id="autohome", legal_name_zh="汽车之家", legal_name_en="Autohome",
        display_name_zh="汽车之家", display_name_en="Autohome", organization_type="media_company",
        headquarters_city_id="beijing", website="https://www.autohome.com.cn/", focus_tags=["auto_media"],
        source_ids=[]),
    org(id="gasgoo", legal_name_zh="盖世汽车", legal_name_en="Gasgoo",
        display_name_zh="盖世汽车", display_name_en="Gasgoo", organization_type="media_company",
        headquarters_city_id="shanghai", website="https://www.gasgoo.com/", focus_tags=["auto_media"],
        source_ids=[]),
    org(id="garage42", legal_name_zh="42号车库", legal_name_en="Garage 42",
        display_name_zh="42号车库", display_name_en="Garage 42", organization_type="media_company",
        headquarters_city_id="shanghai", website="https://www.42how.com/", focus_tags=["auto_media"],
        source_ids=[]),
    org(id="xchuxing", legal_name_zh="新出行", legal_name_en="Xchuxing",
        display_name_zh="新出行", display_name_en="Xchuxing", organization_type="media_company",
        headquarters_city_id="shenzhen", website="https://www.xchuxing.com/", focus_tags=["auto_media"],
        source_ids=[]),
    org(id="pcauto", legal_name_zh="太平洋汽车", legal_name_en="PCauto",
        display_name_zh="太平洋汽车", display_name_en="PCauto", organization_type="media_company",
        headquarters_city_id="guangzhou", website="https://www.pcauto.com.cn/", focus_tags=["auto_media"],
        source_ids=[]),
    org(id="yiche", legal_name_zh="北京易车信息科技有限公司", legal_name_en="Bitauto / Yiche",
        display_name_zh="易车", display_name_en="Yiche", organization_type="media_company",
        headquarters_city_id="beijing", website="https://www.yiche.com/", founded_year=2000, focus_tags=["auto_media"],
        source_ids=[]),
    org(id="dongchedi", legal_name_zh="懂车帝", legal_name_en="Dongchedi",
        display_name_zh="懂车帝", display_name_en="Dongchedi", organization_type="media_company",
        headquarters_city_id="beijing", website="https://www.dongchedi.com/", focus_tags=["auto_media"],
        source_ids=[]),
    org(id="xcar", legal_name_zh="爱卡汽车", legal_name_en="Xcar",
        display_name_zh="爱卡汽车", display_name_en="Xcar", organization_type="media_company",
        headquarters_city_id="beijing", website="https://www.xcar.com.cn/", focus_tags=["auto_media"],
        source_ids=[]),
    org(id="youjia", legal_name_zh="有驾", legal_name_en="Youjia",
        display_name_zh="有驾", display_name_en="Youjia", organization_type="media_company",
        parent_id="baidu", headquarters_city_id="beijing", website="https://youjia.baidu.com/", focus_tags=["auto_media"],
        source_ids=[]),
    org(id="cheshi", legal_name_zh="网上车市", legal_name_en="Cheshi",
        display_name_zh="网上车市", display_name_en="Cheshi", organization_type="media_company",
        headquarters_city_id="beijing", website="https://www.cheshi.com/", focus_tags=["auto_media"],
        source_ids=[]),
    org(id="sohu-auto", legal_name_zh="搜狐汽车", legal_name_en="Sohu Auto",
        display_name_zh="搜狐汽车", display_name_en="Sohu Auto", organization_type="media_company",
        headquarters_city_id="beijing", website="https://auto.sohu.com/", focus_tags=["auto_media"],
        source_ids=[]),
    org(id="sina-auto", legal_name_zh="新浪汽车", legal_name_en="Sina Auto",
        display_name_zh="新浪汽车", display_name_en="Sina Auto", organization_type="media_company",
        headquarters_city_id="beijing", website="https://auto.sina.com.cn/", focus_tags=["auto_media"],
        source_ids=[]),
    org(id="ifeng-auto", legal_name_zh="凤凰汽车", legal_name_en="Ifeng Auto",
        display_name_zh="凤凰汽车", display_name_en="Ifeng Auto", organization_type="media_company",
        headquarters_city_id="beijing", website="https://auto.ifeng.com/", focus_tags=["auto_media"],
        source_ids=[]),
    org(id="tencent-auto", legal_name_zh="腾讯汽车", legal_name_en="Tencent Auto",
        display_name_zh="腾讯汽车", display_name_en="Tencent Auto", organization_type="media_company",
        headquarters_city_id="shenzhen", website="https://auto.qq.com/", focus_tags=["auto_media"],
        source_ids=[]),
    org(id="netease-auto", legal_name_zh="网易汽车", legal_name_en="NetEase Auto",
        display_name_zh="网易汽车", display_name_en="NetEase Auto", organization_type="media_company",
        headquarters_city_id="hangzhou", website="https://auto.163.com/", focus_tags=["auto_media"],
        source_ids=[]),
    org(id="d1ev", legal_name_zh="第一电动网", legal_name_en="D1EV",
        display_name_zh="第一电动网", display_name_en="D1EV", organization_type="media_company",
        headquarters_city_id="beijing", website="https://www.d1ev.com/", focus_tags=["auto_media"],
        source_ids=[]),
    org(id="chedongxi", legal_name_zh="车东西", legal_name_en="CheDongXi",
        display_name_zh="车东西", display_name_en="CheDongXi", organization_type="media_company",
        headquarters_city_id="beijing", website="https://www.chedongxi.com/", focus_tags=["auto_media"],
        source_ids=[]),
    org(id="diandong", legal_name_zh="电动邦", legal_name_en="Diandong",
        display_name_zh="电动邦", display_name_en="Diandong", organization_type="media_company",
        headquarters_city_id="beijing", website="https://www.diandong.com/", focus_tags=["auto_media"],
        source_ids=[]),
    org(id="china-auto-news", legal_name_zh="中国汽车报", legal_name_en="China Automotive News",
        display_name_zh="中国汽车报", display_name_en="China Automotive News", organization_type="media_company",
        headquarters_city_id="beijing", website="https://www.cnautonews.com/", focus_tags=["auto_media"],
        source_ids=[]),
    org(id="auto-business-review", legal_name_zh="汽车商业评论", legal_name_en="Auto Business Review",
        display_name_zh="汽车商业评论", display_name_en="Auto Business Review", organization_type="media_company",
        headquarters_city_id="beijing", focus_tags=["auto_media"],
        source_ids=[]),
    org(id="auto-fan", legal_name_zh="汽车之友", legal_name_en="Auto Fan",
        display_name_zh="汽车之友", display_name_en="Auto Fan", organization_type="media_company",
        headquarters_city_id="beijing", website="http://www.autofan.com.cn/", focus_tags=["auto_media"],
        source_ids=[]),
    org(id="nbd-auto", legal_name_zh="每日经济新闻", legal_name_en="National Business Daily",
        display_name_zh="每经汽车", display_name_en="NBD Auto", organization_type="media_company",
        headquarters_city_id="chengdu", website="https://www.nbd.com.cn/", focus_tags=["auto_media"],
        source_ids=[]),
    org(id="yicai-auto", legal_name_zh="第一财经", legal_name_en="Yicai",
        display_name_zh="第一财经汽车", display_name_en="Yicai Auto", organization_type="media_company",
        headquarters_city_id="shanghai", website="https://www.yicai.com/", focus_tags=["auto_media"],
        source_ids=[]),
    # National media/association coverage by beat (portals, desks, NEV, trade, CV, magazines, review-video KOLs).
    # Skip WeChat-only accounts and classified marketplaces (58che/瓜子). National review-video KOLs are in-scope.
    org(id="chexun", legal_name_zh="车讯网", legal_name_en="Chexun",
        display_name_zh="车讯网", display_name_en="Chexun", organization_type="media_company",
        headquarters_city_id="beijing", website="https://www.chexun.com/", focus_tags=["auto_media"],
        source_ids=[]),
    org(id="che168", legal_name_zh="二手车之家", legal_name_en="Che168",
        display_name_zh="二手车之家", display_name_en="Che168", organization_type="media_company",
        parent_id="autohome", headquarters_city_id="beijing", website="https://www.che168.com/", focus_tags=["auto_media"],
        source_ids=[]),
    org(id="people-auto", legal_name_zh="人民网汽车", legal_name_en="People's Daily Auto",
        display_name_zh="人民网汽车", display_name_en="People.cn Auto", organization_type="media_company",
        headquarters_city_id="beijing", website="http://auto.people.com.cn/", focus_tags=["auto_media"],
        source_ids=[]),
    org(id="xinhua-auto", legal_name_zh="新华网汽车", legal_name_en="Xinhua Auto",
        display_name_zh="新华网汽车", display_name_en="Xinhua Auto", organization_type="media_company",
        headquarters_city_id="beijing", website="https://www.news.cn/auto/", focus_tags=["auto_media"],
        source_ids=[]),
    org(id="cctv-auto", legal_name_zh="央视网汽车", legal_name_en="CCTV Auto",
        display_name_zh="央视网汽车", display_name_en="CCTV Auto", organization_type="media_company",
        headquarters_city_id="beijing", website="https://auto.cctv.com/", focus_tags=["auto_media"],
        source_ids=[]),
    org(id="thepaper-auto", legal_name_zh="澎湃汽车", legal_name_en="The Paper Auto",
        display_name_zh="澎湃汽车", display_name_en="The Paper Auto", organization_type="media_company",
        headquarters_city_id="shanghai", website="https://www.thepaper.cn/", focus_tags=["auto_media"],
        source_ids=[]),
    org(id="chinanews-auto", legal_name_zh="中新网汽车", legal_name_en="China News Auto",
        display_name_zh="中新网汽车", display_name_en="China News Auto", organization_type="media_company",
        headquarters_city_id="beijing", website="https://www.chinanews.com.cn/auto/", focus_tags=["auto_media"],
        source_ids=[]),
    org(id="21jingji-auto", legal_name_zh="21世纪经济报道汽车", legal_name_en="21st Century Business Herald Auto",
        display_name_zh="21世纪经济报道汽车", display_name_en="21CBH Auto", organization_type="media_company",
        headquarters_city_id="guangzhou", website="https://www.21jingji.com/", focus_tags=["auto_media"],
        source_ids=[]),
    org(id="caixin-auto", legal_name_zh="财新汽车", legal_name_en="Caixin Auto",
        display_name_zh="财新汽车", display_name_en="Caixin Auto", organization_type="media_company",
        headquarters_city_id="beijing", website="https://www.caixin.com/", focus_tags=["auto_media"],
        source_ids=[]),
    org(id="jiemian-auto", legal_name_zh="界面汽车", legal_name_en="Jiemian Auto",
        display_name_zh="界面汽车", display_name_en="Jiemian Auto", organization_type="media_company",
        headquarters_city_id="shanghai", website="https://www.jiemian.com/", focus_tags=["auto_media"],
        source_ids=[]),
    org(id="eeo-auto", legal_name_zh="经济观察网汽车", legal_name_en="Economic Observer Auto",
        display_name_zh="经济观察网汽车", display_name_en="EEO Auto", organization_type="media_company",
        headquarters_city_id="beijing", website="https://www.eeo.com.cn/", focus_tags=["auto_media"],
        source_ids=[]),
    org(id="cheyun", legal_name_zh="车云网", legal_name_en="Cheyun",
        display_name_zh="车云网", display_name_en="Cheyun", organization_type="media_company",
        headquarters_city_id="beijing", website="https://www.cheyun.com/", focus_tags=["auto_media"],
        source_ids=[]),
    org(id="gaogong-ev", legal_name_zh="高工智能汽车", legal_name_en="Gaogong Auto Intelligence",
        display_name_zh="高工智能汽车", display_name_en="GG-EV", organization_type="media_company",
        headquarters_city_id="shenzhen", website="https://www.ggai.ai/", focus_tags=["auto_media"],
        source_ids=[]),
    org(id="yanzhi-auto", legal_name_zh="焉知汽车", legal_name_en="Yanzhi Auto",
        display_name_zh="焉知汽车", display_name_en="Yanzhi Auto", organization_type="media_company",
        headquarters_city_id="shanghai", website="https://www.3cst.cn/", focus_tags=["auto_media"],
        source_ids=[]),
    org(id="auto-zongheng", legal_name_zh="汽车纵横", legal_name_en="Auto Review",
        display_name_zh="汽车纵横", display_name_en="Auto Zongheng", organization_type="media_company",
        parent_id="caam", headquarters_city_id="beijing", website="https://www.autoreview.com.cn/", focus_tags=["auto_media"],
        source_ids=[]),
    org(id="motor-trend-china", legal_name_zh="汽车族", legal_name_en="Motor Trend China",
        display_name_zh="汽车族", display_name_en="Motor Trend China", organization_type="media_company",
        headquarters_city_id="beijing", website="http://www.cnmotortrend.com/", focus_tags=["auto_media"],
        source_ids=[]),
    org(id="truck-home", legal_name_zh="北京卡车之家信息技术股份有限公司", legal_name_en="Beijing 360che Information Technology",
        display_name_zh="卡车之家", display_name_en="Truck Home", organization_type="media_company",
        headquarters_city_id="beijing", website="https://www.360che.com/", founded_year=2008, focus_tags=["auto_media"],
        source_ids=[]),
    org(id="chinabuses", legal_name_zh="客车网", legal_name_en="Chinabuses",
        display_name_zh="客车网", display_name_en="Chinabuses", organization_type="media_company",
        headquarters_city_id="beijing", website="https://www.chinabuses.com/", focus_tags=["auto_media"],
        source_ids=[]),
    org(id="chinaspv", legal_name_zh="专用汽车网", legal_name_en="China SPV",
        display_name_zh="专用汽车网", display_name_en="China SPV", organization_type="media_company",
        headquarters_city_id="beijing", website="https://www.chinaspv.com.cn/", focus_tags=["auto_media"],
        source_ids=[]),
    org(id="caam", legal_name_zh="中国汽车工业协会", legal_name_en="China Association of Automobile Manufacturers",
        display_name_zh="中汽协", display_name_en="CAAM", organization_type="industry_association",
        headquarters_city_id="beijing", website="http://www.caam.org.cn/", focus_tags=["auto_history"],
        source_ids=[]),
    org(id="cada", legal_name_zh="中国汽车流通协会", legal_name_en="China Automobile Dealers Association",
        display_name_zh="中汽流通协会", display_name_en="CADA", organization_type="industry_association",
        headquarters_city_id="beijing", website="https://www.cada.cn/", focus_tags=["auto_history"],
        source_ids=[]),
    org(id="sae-china", legal_name_zh="中国汽车工程学会", legal_name_en="SAE-China",
        display_name_zh="中汽学会", display_name_en="SAE-China", organization_type="industry_association",
        headquarters_city_id="beijing", website="https://www.sae-china.org/", focus_tags=["rd_design"],
        source_ids=[]),
    org(id="china-ev100", legal_name_zh="中国电动汽车百人会", legal_name_en="China EV100",
        display_name_zh="电动汽车百人会", display_name_en="China EV100", organization_type="industry_association",
        headquarters_city_id="beijing", website="https://www.chinaev100.com/", focus_tags=["rd_design"],
        source_ids=[]),
    org(id="luobo-report", legal_name_zh="北京格锐驰广告传媒有限公司", legal_name_en="Beijing Grechi Advertising Media",
        display_name_zh="萝卜报告", display_name_en="Luobo Report", organization_type="media_company",
        headquarters_city_id="beijing", website="https://www.luobobaogao.com/", founded_year=2014, focus_tags=["auto_media"],
        source_ids=[]),
    org(id="laosiji", legal_name_zh="北京锋巢信息技术有限公司", legal_name_en="Beijing Fengchao Information Technology",
        display_name_zh="老司机出品", display_name_en="Laosiji", organization_type="media_company",
        headquarters_city_id="beijing", website="https://www.laosiji.com/", focus_tags=["auto_media"],
        source_ids=[]),
    org(id="review-38", legal_name_zh="38号车评中心", legal_name_en="38 Car Review Center",
        display_name_zh="38号车评中心", display_name_en="Review 38", organization_type="media_company",
        headquarters_city_id="beijing", website="https://www.cheping38.com/", focus_tags=["auto_media"],
        source_ids=[]),
    org(id="li-laoshu", legal_name_zh="北京吱道文化传媒有限公司", legal_name_en="Beijing Zhidao Culture Media",
        display_name_zh="李老鼠说车", display_name_en="Li Laoshu", organization_type="media_company",
        headquarters_city_id="beijing", focus_tags=["auto_media"],
        source_ids=[]),
    org(id="speedsters", legal_name_zh="广州爪黄飞电广告有限公司", legal_name_en="Guangzhou Speedsters",
        display_name_zh="极速拍档", display_name_en="Speedsters", organization_type="media_company",
        headquarters_city_id="guangzhou", focus_tags=["auto_media"],
        source_ids=[]),
    org(id="dajia-cheyan", legal_name_zh="广州朋客网络科技有限公司", legal_name_en="Guangzhou Pengke Network",
        display_name_zh="大家车言论", display_name_en="Dajia Cars Talk", organization_type="media_company",
        headquarters_city_id="guangzhou", focus_tags=["auto_media"],
        source_ids=[]),
    org(id="xincheping", legal_name_zh="新车评网", legal_name_en="Xincheping",
        display_name_zh="新车评", display_name_en="Xincheping", organization_type="media_company",
        headquarters_city_id="guangzhou", website="https://xincheping.com/", founded_year=2006, focus_tags=["auto_media"],
        source_ids=[]),
    org(id="tichebang", legal_name_zh="北京唯优沃德新媒体科技有限公司", legal_name_en="Beijing Weiyou Wode New Media",
        display_name_zh="踢车帮", display_name_en="Tichebang", organization_type="media_company",
        headquarters_city_id="beijing", focus_tags=["auto_media"],
        source_ids=[]),
    org(id="yan-chuang", legal_name_zh="闫闯说车", legal_name_en="Yan Chuang Says Car",
        display_name_zh="闫闯说车", display_name_en="Yan Chuang", organization_type="media_company",
        headquarters_city_id="beijing", focus_tags=["auto_media"],
        source_ids=[]),
    org(id="che-ruo-chujian", legal_name_zh="北京爱车新世界文化传播有限公司", legal_name_en="Beijing Aiche New World",
        display_name_zh="车若初见", display_name_en="Che Ruo Chujian", organization_type="media_company",
        headquarters_city_id="beijing", focus_tags=["auto_media"],
        source_ids=[]),
    org(id="doudouche", legal_name_zh="北京笑忘车文化传播有限公司", legal_name_en="Beijing Xiaowangche Culture",
        display_name_zh="逗斗车", display_name_en="Doudouche", organization_type="media_company",
        headquarters_city_id="beijing", focus_tags=["auto_media"],
        source_ids=[]),
    org(id="y-car-review", legal_name_zh="武汉楚天牛米汽车服务有限公司", legal_name_en="Wuhan Chutian Niumi Auto Service",
        display_name_zh="Y车评", display_name_en="Y Car Review", organization_type="media_company",
        headquarters_city_id="wuhan", focus_tags=["auto_media"],
        source_ids=[]),
    org(id="dabiaoche", legal_name_zh="素美微尚国际信息咨询（北京）有限公司", legal_name_en="Sumei Weishang Beijing",
        display_name_zh="大飙车", display_name_en="Da Biaoche", organization_type="media_company",
        headquarters_city_id="beijing", website="http://dabiaoche.com/", focus_tags=["auto_media"],
        source_ids=[]),
    org(id="cidi-wuyin", legal_name_zh="此地无垠", legal_name_en="Cidi Wuyin",
        display_name_zh="此地无垠", display_name_en="Cidi Wuyin", organization_type="media_company",
        headquarters_city_id="beijing", focus_tags=["auto_media"],
        source_ids=[]),
    org(id="gac-aion", legal_name_zh="广汽埃安新能源汽车股份有限公司", legal_name_en="GAC Aion New Energy Automobile Co., Ltd.",
        display_name_zh="广汽埃安", display_name_en="GAC Aion", organization_type="brand",
        parent_id="gac", headquarters_city_id="guangzhou", focus_tags=["oem_manufacturing"]),
    org(id="saic-vw", legal_name_zh="上汽大众汽车有限公司", legal_name_en="SAIC Volkswagen Automotive Co., Ltd.",
        display_name_zh="上汽大众", display_name_en="SAIC Volkswagen", organization_type="automaker",
        parent_id="saic", headquarters_city_id="shanghai", focus_tags=["oem_manufacturing"]),
    org(id="baic-foton", legal_name_zh="北汽福田汽车股份有限公司", legal_name_en="BAIC Foton Motor Co., Ltd.",
        display_name_zh="北汽福田", display_name_en="Foton", organization_type="automaker",
        parent_id="baic", headquarters_city_id="beijing", focus_tags=["oem_manufacturing"]),
    org(id="dongfeng-cv", legal_name_zh="东风商用车有限公司", legal_name_en="Dongfeng Commercial Vehicle Co., Ltd.",
        display_name_zh="东风商用车", display_name_en="Dongfeng Commercial Vehicles", organization_type="automaker",
        parent_id="dongfeng", headquarters_city_id="shiyan", founded_year=2013,
        focus_tags=["oem_manufacturing", "auto_history"]),
    # —— V1 城内补录：原 brief 点名或目录里明显缺席的整车/品牌 ——
    org(id="arcfox", legal_name_zh="北京蓝谷极狐汽车科技有限公司", legal_name_en="BAIC BluePark Arcfox",
        display_name_zh="极狐", display_name_en="Arcfox", organization_type="brand",
        parent_id="baic", headquarters_city_id="beijing", focus_tags=["oem_manufacturing"]),
    org(id="beijing-hyundai", legal_name_zh="北京现代汽车有限公司", legal_name_en="Beijing Hyundai Motor Co., Ltd.",
        display_name_zh="北京现代", display_name_en="Beijing Hyundai", organization_type="automaker",
        headquarters_city_id="beijing", focus_tags=["oem_manufacturing"]),
    org(id="saic-gm", legal_name_zh="上汽通用汽车有限公司", legal_name_en="SAIC-GM Corporation",
        display_name_zh="上汽通用", display_name_en="SAIC-GM", organization_type="automaker",
        parent_id="saic", headquarters_city_id="shanghai", focus_tags=["oem_manufacturing"]),
    org(id="im-motors", legal_name_zh="智己汽车科技有限公司", legal_name_en="IM Motors",
        display_name_zh="智己汽车", display_name_en="IM Motors", organization_type="brand",
        parent_id="saic", headquarters_city_id="shanghai", focus_tags=["oem_manufacturing"]),
    org(id="rising-auto", legal_name_zh="飞凡汽车", legal_name_en="Rising Auto",
        display_name_zh="飞凡汽车", display_name_en="Rising Auto", organization_type="brand",
        parent_id="saic", headquarters_city_id="shanghai", focus_tags=["oem_manufacturing"]),
    org(id="roewe", legal_name_zh="荣威", legal_name_en="Roewe",
        display_name_zh="荣威", display_name_en="Roewe", organization_type="brand",
        parent_id="saic", headquarters_city_id="shanghai", focus_tags=["oem_manufacturing"]),
    org(id="mg", legal_name_zh="名爵", legal_name_en="MG Motor",
        display_name_zh="名爵", display_name_en="MG", organization_type="brand",
        parent_id="saic", headquarters_city_id="shanghai", focus_tags=["oem_manufacturing", "export_logistics"]),
    org(id="denza", legal_name_zh="腾势汽车", legal_name_en="Denza",
        display_name_zh="腾势", display_name_en="Denza", organization_type="brand",
        parent_id="byd", headquarters_city_id="shenzhen", focus_tags=["oem_manufacturing"]),
    org(id="yangwang", legal_name_zh="仰望汽车", legal_name_en="Yangwang",
        display_name_zh="仰望", display_name_en="Yangwang", organization_type="brand",
        parent_id="byd", headquarters_city_id="shenzhen", focus_tags=["oem_manufacturing"]),
    org(id="fangchengbao", legal_name_zh="方程豹汽车", legal_name_en="Fangchengbao",
        display_name_zh="方程豹", display_name_en="Fangchengbao", organization_type="brand",
        parent_id="byd", headquarters_city_id="shenzhen", focus_tags=["oem_manufacturing"]),
    org(id="huawei-car", legal_name_zh="华为智能汽车解决方案", legal_name_en="Huawei Intelligent Automotive Solution",
        display_name_zh="华为车BU", display_name_en="Huawei IAS", organization_type="software_company",
        headquarters_city_id="shenzhen", focus_tags=["auto_software", "autonomous_driving", "auto_electronics"]),
    org(id="gac-trumpchi", legal_name_zh="广汽传祺", legal_name_en="GAC Trumpchi",
        display_name_zh="广汽传祺", display_name_en="Trumpchi", organization_type="brand",
        parent_id="gac", headquarters_city_id="guangzhou", focus_tags=["oem_manufacturing"]),
    org(id="hyptec", legal_name_zh="广汽昊铂", legal_name_en="Hyptec",
        display_name_zh="昊铂", display_name_en="Hyptec", organization_type="brand",
        parent_id="gac", headquarters_city_id="guangzhou", focus_tags=["oem_manufacturing"]),
    org(id="avatr", legal_name_zh="阿维塔科技有限公司", legal_name_en="Avatr Technology",
        display_name_zh="阿维塔", display_name_en="Avatr", organization_type="brand",
        parent_id="changan", headquarters_city_id="chongqing", focus_tags=["oem_manufacturing"]),
    org(id="deepal", legal_name_zh="深蓝汽车科技有限公司", legal_name_en="Deepal Automobile",
        display_name_zh="深蓝汽车", display_name_en="Deepal", organization_type="brand",
        parent_id="changan", headquarters_city_id="chongqing", focus_tags=["oem_manufacturing"]),
    org(id="aito", legal_name_zh="问界", legal_name_en="AITO",
        display_name_zh="问界", display_name_en="AITO", organization_type="brand",
        parent_id="seres", headquarters_city_id="chongqing", focus_tags=["oem_manufacturing"]),
    org(id="dongfeng-honda", legal_name_zh="东风本田汽车有限公司", legal_name_en="Dongfeng Honda Automobile Co., Ltd.",
        display_name_zh="东风本田", display_name_en="Dongfeng Honda", organization_type="automaker",
        parent_id="dongfeng", headquarters_city_id="wuhan", focus_tags=["oem_manufacturing"]),
    org(id="lotus", legal_name_zh="Lotus Technology Inc.", legal_name_en="Lotus Technology Inc.",
        display_name_zh="路特斯科技", display_name_en="Lotus Technology", organization_type="automaker",
        parent_id="geely", headquarters_city_id="wuhan", founded_year=2021,
        website="https://ir.group-lotus.com/", focus_tags=["oem_manufacturing"]),
    org(id="lynk-co", legal_name_zh="领克汽车", legal_name_en="Lynk & Co",
        display_name_zh="领克", display_name_en="Lynk & Co", organization_type="brand",
        parent_id="geely", headquarters_city_id="hangzhou", focus_tags=["oem_manufacturing"]),
    org(id="zeekr", legal_name_zh="极氪智能科技有限公司", legal_name_en="Zeekr Intelligent Technology",
        display_name_zh="极氪", display_name_en="Zeekr", organization_type="brand",
        parent_id="geely", headquarters_city_id="hangzhou", focus_tags=["oem_manufacturing"]),
    org(id="geely-galaxy", legal_name_zh="吉利银河", legal_name_en="Geely Galaxy",
        display_name_zh="吉利银河", display_name_en="Geely Galaxy", organization_type="brand",
        parent_id="geely", headquarters_city_id="hangzhou", focus_tags=["oem_manufacturing"]),
    org(id="wuling", legal_name_zh="五菱", legal_name_en="Wuling",
        display_name_zh="五菱", display_name_en="Wuling", organization_type="brand",
        parent_id="sgmw", headquarters_city_id="liuzhou", focus_tags=["oem_manufacturing"]),
    org(id="baojun", legal_name_zh="宝骏", legal_name_en="Baojun",
        display_name_zh="宝骏", display_name_en="Baojun", organization_type="brand",
        parent_id="sgmw", headquarters_city_id="liuzhou", focus_tags=["oem_manufacturing"]),
    org(id="haval", legal_name_zh="哈弗", legal_name_en="Haval",
        display_name_zh="哈弗", display_name_en="Haval", organization_type="brand",
        parent_id="gwm", headquarters_city_id="baoding", focus_tags=["oem_manufacturing"]),
    org(id="tank", legal_name_zh="坦克", legal_name_en="Tank",
        display_name_zh="坦克", display_name_en="Tank", organization_type="brand",
        parent_id="gwm", headquarters_city_id="baoding", focus_tags=["oem_manufacturing"]),
    org(id="ora", legal_name_zh="欧拉", legal_name_en="ORA",
        display_name_zh="欧拉", display_name_en="ORA", organization_type="brand",
        parent_id="gwm", headquarters_city_id="baoding", focus_tags=["oem_manufacturing"]),
    org(id="wey", legal_name_zh="魏牌", legal_name_en="WEY",
        display_name_zh="魏牌", display_name_en="WEY", organization_type="brand",
        parent_id="gwm", headquarters_city_id="baoding", focus_tags=["oem_manufacturing"]),
    org(id="exeed", legal_name_zh="星途", legal_name_en="Exeed",
        display_name_zh="星途", display_name_en="Exeed", organization_type="brand",
        parent_id="chery", headquarters_city_id="wuhu", focus_tags=["oem_manufacturing", "export_logistics"]),
    org(id="jetour", legal_name_zh="捷途", legal_name_en="Jetour",
        display_name_zh="捷途", display_name_en="Jetour", organization_type="brand",
        parent_id="chery", headquarters_city_id="wuhu", focus_tags=["oem_manufacturing", "export_logistics"]),
    org(id="icar", legal_name_zh="奇瑞iCAR", legal_name_en="Chery iCAR",
        display_name_zh="iCAR", display_name_en="iCAR", organization_type="brand",
        parent_id="chery", headquarters_city_id="wuhu", focus_tags=["oem_manufacturing"]),
    org(id="leapmotor", legal_name_zh="零跑科技", legal_name_en="Leapmotor",
        display_name_zh="零跑汽车", display_name_en="Leapmotor", organization_type="automaker",
        headquarters_city_id="hangzhou", website="https://www.leapmotor.com/", focus_tags=["headquarters", "oem_manufacturing"],
        aliases=["零跑", "leapmotor", "lpqc"]),
    org(id="neta", legal_name_zh="合众新能源汽车股份有限公司", legal_name_en="Hozon New Energy Automobile Co., Ltd.",
        display_name_zh="哪吒汽车", display_name_en="Neta", organization_type="automaker",
        headquarters_city_id="jiaxing", focus_tags=["headquarters", "oem_manufacturing"],
        aliases=["哪吒", "neta", "hozon", "合众"]),
    org(id="bmw-brilliance", legal_name_zh="华晨宝马汽车有限公司", legal_name_en="BMW Brilliance Automotive",
        display_name_zh="华晨宝马", display_name_en="BMW Brilliance", organization_type="automaker",
        headquarters_city_id="shenyang", website="https://www.bmw-brilliance.cn/", focus_tags=["headquarters", "oem_manufacturing"],
        aliases=["宝马", "bmw", "华晨", "bba"]),
    org(id="saic-maxus", legal_name_zh="上汽大通汽车有限公司", legal_name_en="SAIC Maxus",
        display_name_zh="上汽大通", display_name_en="SAIC Maxus", organization_type="automaker",
        parent_id="saic", headquarters_city_id="shanghai", focus_tags=["headquarters", "oem_manufacturing"],
        aliases=["大通", "maxus", "ldv"]),
]

ORG_BY_ID = {o["id"]: o for o in ORGS}

CITY_ALIASES = {
    "beijing": ["bj", "pek", "peking", "帝都"],
    "shanghai": ["sh", "hu", "沪"],
    "shenzhen": ["sz", "鹏城"],
    "guangzhou": ["gz", "canton", "穗"],
    "chongqing": ["cq", "渝"],
    "hefei": ["hf"],
    "wuhu": ["whu"],
    "xian": ["xa", "xian", "sian", "xi'an"],
    "changchun": ["cc"],
    "zhengzhou": ["zz"],
    "liuzhou": ["lz"],
    "wuhan": ["wh", "汉"],
    "changsha": ["cs"],
    "tianjin": ["tj", "津"],
    "chengdu": ["cd", "蓉"],
    "hangzhou": ["hgh", "杭"],
    "shenyang": ["syang", "沈阳"],
    "ningde": ["nd"],
    "changzhou": ["cz"],
    "suzhou": ["su"],
    "ningbo": ["nb", "甬"],
    "huizhou": ["hz"],
    "yibin": ["yb"],
    "baoding": ["bd"],
    "jinan": ["jn", "泉城"],
    "shiyan": ["sy"],
    "xiamen": ["xm", "amoy", "鹭"],
    "jiaxing": ["jx", "桐乡"],
}

ORG_ALIASES = {
    "baic": ["北汽", "北汽集团", "baic", "bjqc"],
    "beijing-benz": ["奔驰", "benz", "mercedes", "bbac"],
    "xiaomi-auto": ["小米", "xiaomi", "su7"],
    "li-auto": ["理想", "lixiang", "li", "理想汽车"],
    "baidu": ["百度", "apollo", "萝卜快跑"],
    "horizon-robotics": ["地平线", "horizon", "征程"],
    "saic": ["上汽", "上汽集团", "saic"],
    "tesla-china": ["特斯拉", "tesla", "tsla", "上海工厂"],
    "byd": ["比亚迪", "byd", "王朝", "海洋"],
    "gac": ["广汽", "广汽集团", "gac"],
    "gac-honda": ["广本", "ghac"],
    "gac-toyota": ["广丰", "gtmc"],
    "dongfeng-nissan": ["日产", "nissan", "轩逸", "venucia", "启辰"],
    "xpeng": ["小鹏", "xpeng", "xiaopeng"],
    "weiride": ["文远", "weride"],
    "pony-ai": ["小马", "pony"],
    "changan": ["长安", "长安汽车", "changan", "caqc"],
    "seres": ["赛力斯", "sf5", "sokon", "金康"],
    "jac": ["江淮", "jac", "江淮汽车"],
    "nio": ["蔚来", "nio", "weilai", "es8"],
    "vw-anhui": ["大众安徽", "volkswagen", "vw"],
    "gotion": ["国轩", "gotion"],
    "chery": ["奇瑞", "chery", "奇瑞汽车"],
    "geely": ["吉利", "geely", "吉利控股"],
    "faw": ["一汽", "一汽集团", "faw", "中国一汽"],
    "hongqi": ["红旗", "hongqi"],
    "jiefang": ["解放", "jiefang", "一汽解放"],
    "bestune": ["奔腾", "bestune"],
    "faw-vw": ["一汽大众", "faw-vw", "fawvw"],
    "audi-faw-nev": ["奥迪", "audi"],
    "yutong": ["宇通", "yutong"],
    "zhengzhou-nissan": ["郑州日产", "zznissan"],
    "sgmw": ["五菱", "宝骏", "sgmw", "上汽通用五菱", "宏光"],
    "dongfeng-liuzhou": ["柳汽", "乘龙", "chenglong"],
    "dongfeng": ["东风", "东风集团", "dfmc", "dfm", "二汽"],
    "voyah": ["岚图", "voyah"],
    "mengshi": ["猛士", "mengshi"],
    # Stable id retained for URLs/data joins; Aeolus/风神 is a different brand.
    "aeolus": ["奕派", "东风奕派", "eπ", "yipai", "dongfeng epi"],
    "faw-toyota": ["一汽丰田", "tftm"],
    "gwm": ["长城", "长城汽车", "gwm", "greatwall"],
    "volvo-cars-chengdu": ["沃尔沃", "volvo"],
    "catl": ["宁德时代", "catl", "时代新能源"],
    "svolt": ["蜂巢", "svolt"],
    "calb": ["中创新航", "calb"],
    "desay-sv": ["德赛西威", "desay"],
    # Stable id retained for joins; the entity is Huizhou Foryou/HuaYang.
    "holosonics": ["华阳", "华阳集团", "foryou", "huayang"],
    "eve-energy": ["亿纬", "eve"],
    "joyson": ["均胜", "joyson"],
    "tuopu": ["拓普", "tuopu"],
    "minth": ["敏实", "minth"],
    "huaxiang": ["华翔"],
    "sinotruk": ["重汽", "中国重汽", "howo", "sinotruk", "cnhtc"],
    "king-long": ["金龙", "kinglong"],
    "golden-dragon": ["金旅", "goldendragon"],
    "catarc": ["中汽中心", "catarc", "中汽研"],
    "caeri": ["中国汽研", "caeri"],
    "gac-aion": ["埃安", "aion"],
    "saic-vw": ["上汽大众", "svw", "大众"],
    "baic-foton": ["福田", "foton"],
    "dongfeng-cv": ["东风商用车", "东风卡车"],
    "arcfox": ["极狐", "arcfox", "北汽新能源", "bluepark"],
    "beijing-hyundai": ["现代", "hyundai", "bhmc"],
    "saic-gm": ["通用", "gm", "别克", "buick", "雪佛兰", "cadillac", "凯迪拉克"],
    "im-motors": ["智己", "im", "zhiji"],
    "rising-auto": ["飞凡", "rising"],
    "roewe": ["荣威", "roewe"],
    "mg": ["名爵", "mg", "morris"],
    "denza": ["腾势", "denza"],
    "yangwang": ["仰望", "yangwang", "u8"],
    "fangchengbao": ["方程豹", "豹5"],
    "huawei-car": ["华为", "huawei", "ads", "乾崑", "qiankun"],
    "gac-trumpchi": ["传祺", "trumpchi"],
    "hyptec": ["昊铂", "hyptec", "hyper"],
    "avatr": ["阿维塔", "avatr"],
    "deepal": ["深蓝", "deepal", "sl03"],
    "aito": ["问界", "aito", "m7", "m9"],
    "dongfeng-honda": ["东本", "honda", "本田"],
    "lotus": ["路特斯", "lotus", "莲花"],
    "lynk-co": ["领克", "lynk", "lynkco"],
    "zeekr": ["极氪", "zeekr", "001"],
    "geely-galaxy": ["银河", "galaxy"],
    "wuling": ["五菱", "wuling", "miniev"],
    "baojun": ["宝骏", "baojun"],
    "haval": ["哈弗", "haval", "h6"],
    "tank": ["坦克", "tank", "坦克300"],
    "ora": ["欧拉", "ora", "好猫"],
    "wey": ["魏牌", "wey"],
    "exeed": ["星途", "exeed"],
    "jetour": ["捷途", "jetour"],
    "icar": ["icar", "奇瑞新能源"],
    "leapmotor": ["零跑", "leapmotor", "c11"],
    "neta": ["哪吒", "neta", "hozon"],
    "bmw-brilliance": ["宝马", "bmw", "华晨宝马"],
    "saic-maxus": ["大通", "maxus"],
    "autohome": ["汽车之家", "autohome", "之家"],
    "gasgoo": ["盖世", "gasgoo"],
    "garage42": ["42号车库", "garage42", "42how"],
    "xchuxing": ["新出行", "xchuxing"],
    "pcauto": ["太平洋", "pcauto", "太平洋汽车"],
    "yiche": ["易车", "yiche", "bitauto", "易车网"],
    "dongchedi": ["懂车帝", "dongchedi", "dcd"],
    "xcar": ["爱卡", "爱卡汽车", "xcar"],
    "youjia": ["有驾", "youjia", "百度有驾"],
    "cheshi": ["网上车市", "cheshi", "车市"],
    "sohu-auto": ["搜狐汽车", "sohu", "搜狐"],
    "sina-auto": ["新浪汽车", "sina", "新浪"],
    "ifeng-auto": ["凤凰汽车", "ifeng", "凤凰"],
    "tencent-auto": ["腾讯汽车", "腾讯", "qq汽车"],
    "netease-auto": ["网易汽车", "网易", "163汽车"],
    "d1ev": ["第一电动", "d1ev", "第一电动网"],
    "chedongxi": ["车东西", "chedongxi"],
    "diandong": ["电动邦", "diandong"],
    "china-auto-news": ["中国汽车报", "中汽报", "cnautonews"],
    "auto-business-review": ["汽车商业评论", "车评"],
    "auto-fan": ["汽车之友", "autofan"],
    "nbd-auto": ["每经汽车", "每日经济新闻", "每经"],
    "yicai-auto": ["第一财经", "一财", "yicai"],
    "chexun": ["车讯", "chexun", "车讯网"],
    "che168": ["二手车之家", "che168", "车168"],
    "people-auto": ["人民网汽车", "人民网", "people"],
    "xinhua-auto": ["新华网汽车", "新华", "xinhua"],
    "cctv-auto": ["央视网汽车", "央视", "cctv"],
    "thepaper-auto": ["澎湃汽车", "澎湃", "thepaper"],
    "chinanews-auto": ["中新网汽车", "中新网", "chinanews"],
    "21jingji-auto": ["21世纪", "21世纪经济报道", "21jingji"],
    "caixin-auto": ["财新", "caixin", "财新汽车"],
    "jiemian-auto": ["界面", "界面汽车", "jiemian"],
    "eeo-auto": ["经济观察网", "经观", "eeo"],
    "cheyun": ["车云网", "cheyun", "车云"],
    "gaogong-ev": ["高工智能汽车", "高工", "gg-ev"],
    "yanzhi-auto": ["焉知", "焉知汽车", "yanzhi"],
    "auto-zongheng": ["汽车纵横", "zongheng"],
    "motor-trend-china": ["汽车族", "motortrend", "mt中国"],
    "truck-home": ["卡车之家", "360che", "卡车"],
    "chinabuses": ["客车网", "chinabuses", "客车"],
    "chinaspv": ["专用汽车网", "chinaspv", "专用车"],
    "caam": ["中汽协", "caam", "汽车工业协会"],
    "cada": ["流通协会", "cada", "中汽流通"],
    "sae-china": ["中汽学会", "sae", "汽车工程学会"],
    "china-ev100": ["百人会", "ev100", "电动汽车百人会"],
    "luobo-report": ["萝卜报告", "陈震", "二环十三郎", "luobo"],
    "laosiji": ["老司机", "韩路", "锋巢", "laosiji"],
    "review-38": ["38号", "38号车评中心", "李天扬"],
    "li-laoshu": ["李老鼠", "李老鼠说车", "吱道"],
    "speedsters": ["极速拍档", "speedsters", "jacky"],
    "dajia-cheyan": ["大家车言论", "袁启聪", "yyp", "颜宇鹏"],
    "xincheping": ["新车评", "新车评网", "xincheping"],
    "tichebang": ["踢车帮", "夏东", "tichebang"],
    "yan-chuang": ["闫闯", "闫闯说车"],
    "che-ruo-chujian": ["车若初见", "初晓敏", "晓敏"],
    "doudouche": ["逗斗车", "胡永平", "丈母娘"],
    "y-car-review": ["Y车评", "y车评"],
    "dabiaoche": ["大飙车", "拆车"],
    "cidi-wuyin": ["此地无垠", "王垠"],
    "tsinghua": ["清华", "thu", "tsinghua"],
    "bit": ["北理工", "bit"],
    "tongji": ["同济", "tongji"],
    "sjtu": ["上交", "交大", "sjtu"],
    "jlu": ["吉大", "jlu"],
    "whut": ["武汉理工", "whut"],
    "hfut": ["合工大", "hfut"],
    "changan-univ": ["长大", "长安大学"],
    "hnu": ["湖大", "hnu"],
    "scut": ["华工", "scut"],
    "cqu": ["重大", "cqu"],
    "cqut": ["重理工", "cqut"],
}

FEATURED = {
    "beijing": ["baic", "beijing-benz", "xiaomi-auto", "li-auto", "baidu", "horizon-robotics",
                "tsinghua", "bit", "autohome", "yiche", "dongchedi", "xcar", "youjia", "cheshi",
                "sohu-auto", "sina-auto", "ifeng-auto", "d1ev", "chedongxi", "diandong",
                "china-auto-news", "auto-business-review", "auto-fan", "arcfox", "beijing-hyundai", "baic-foton",
                "chexun", "che168", "people-auto", "xinhua-auto", "cctv-auto", "chinanews-auto",
                "caixin-auto", "eeo-auto", "cheyun", "auto-zongheng", "motor-trend-china",
                "truck-home", "chinabuses", "chinaspv", "caam", "cada", "sae-china", "china-ev100",
                "luobo-report", "laosiji", "review-38", "li-laoshu", "tichebang", "yan-chuang",
                "che-ruo-chujian", "doudouche", "dabiaoche", "cidi-wuyin"],
    "shanghai": ["saic", "tesla-china", "tongji", "sjtu", "gasgoo", "garage42", "yicai-auto", "saic-vw",
                 "saic-gm", "im-motors", "rising-auto", "roewe", "mg", "saic-maxus",
                 "thepaper-auto", "jiemian-auto", "yanzhi-auto"],
    "shenzhen": ["byd", "xchuxing", "tencent-auto", "denza", "yangwang", "fangchengbao", "huawei-car", "gaogong-ev"],
    "guangzhou": ["gac", "gac-honda", "gac-toyota", "dongfeng-nissan", "xpeng", "weiride", "pony-ai",
                  "scut", "pcauto", "gac-aion", "gac-trumpchi", "hyptec", "21jingji-auto",
                  "speedsters", "dajia-cheyan", "xincheping"],
    "chongqing": ["changan", "seres", "qianli", "caeri", "cqu", "cqut", "avatr", "deepal", "aito"],
    "hefei": ["jac", "nio", "vw-anhui", "byd", "changan", "gotion", "hfut"],
    "wuhu": ["chery", "exeed", "jetour", "icar"],
    "xian": ["byd", "geely", "changan-univ"],
    "changchun": ["faw", "hongqi", "jiefang", "bestune", "faw-vw", "audi-faw-nev", "jlu"],
    "zhengzhou": ["byd", "yutong", "zhengzhou-nissan", "saic"],
    "liuzhou": ["sgmw", "dongfeng-liuzhou", "guangxi-auto", "jiefang", "wuling", "baojun"],
    "wuhan": ["dongfeng", "voyah", "mengshi", "aeolus", "whut", "dongfeng-honda", "lotus", "y-car-review"],
    "changsha": ["byd", "saic-vw", "gac-aion", "baic-foton", "hnu"],
    "tianjin": ["faw-toyota", "faw-vw", "gwm", "catarc"],
    "chengdu": ["faw-vw", "faw-toyota", "volvo-cars-chengdu", "geely", "lynk-co", "nbd-auto"],
    "hangzhou": ["geely", "leapmotor", "lynk-co", "zeekr", "geely-galaxy", "netease-auto"],
    "shenyang": ["bmw-brilliance"],
    "ningde": ["catl"],
    "changzhou": ["li-auto", "byd", "catl", "svolt", "calb"],
    "suzhou": [],
    "ningbo": ["joyson", "tuopu", "minth", "huaxiang", "geely", "zeekr", "geely-galaxy"],
    "huizhou": ["desay-sv", "holosonics", "eve-energy"],
    "yibin": ["catl"],
    "baoding": ["gwm", "haval", "tank", "ora", "wey"],
    "jinan": ["sinotruk", "byd", "geely"],
    "shiyan": ["dongfeng-cv"],
    "xiamen": ["king-long", "golden-dragon"],
    "jiaxing": ["neta"],
}


def fac(**kw):
    city = next(c for c in CITIES if c["id"] == kw["city_id"])
    row = dict(
        district_zh=None, district_en=None, lat=city["lat"], lng=city["lng"],
        status="active", opened_at=None, current_products=[], technology_tags=[],
        operator_legal_name_zh=None, operator_legal_name_en=None,
        operator_legal_name_en_is_translation=False,
        operator_matches_entity_boundary=None, associated_organization_ids=[],
        manufactures_for_ids=[],
        last_verified=LV, confidence=0.40, source_ids=[],
        coord_note_zh="坐标暂用城市中心点，待工厂级地理编码。",
        coord_note_en="Coordinates currently use the city centroid pending plant-level geocoding.",
    )
    row.update(kw)
    return row


FACILITIES = [
    fac(id="tesla-shanghai-gigafactory", name_zh="特斯拉上海超级工厂", name_en="Tesla Shanghai Gigafactory",
        operator_id="tesla-china", city_id="shanghai", district_zh="临港", district_en="Lingang",
        facility_type="vehicle_plant", technology_tags=["nev"], current_products=["Model 3", "Model Y"]),
    fac(id="byd-shenzhen-hq", name_zh="比亚迪深圳总部及研发", name_en="BYD Shenzhen HQ & R&D",
        operator_id="byd", city_id="shenzhen", district_zh="坪山", district_en="Pingshan",
        facility_type="headquarters_campus", technology_tags=["nev", "battery"]),
    fac(id="byd-xian-plant", name_zh="比亚迪西安基地", name_en="BYD Xi'an base",
        operator_id="byd", city_id="xian", facility_type="vehicle_plant", technology_tags=["nev"]),
    fac(id="byd-hefei-plant", name_zh="比亚迪合肥基地", name_en="BYD Hefei base",
        operator_id="byd", city_id="hefei", facility_type="vehicle_plant", technology_tags=["nev"]),
    fac(id="byd-zhengzhou-plant", name_zh="比亚迪郑州基地", name_en="BYD Zhengzhou base",
        operator_id="byd", city_id="zhengzhou", facility_type="vehicle_plant", technology_tags=["nev"]),
    fac(id="byd-changsha-plant", name_zh="比亚迪长沙基地", name_en="BYD Changsha base",
        operator_id="byd", city_id="changsha", facility_type="vehicle_plant", technology_tags=["nev"]),
    fac(id="byd-jinan-plant", name_zh="比亚迪济南基地", name_en="BYD Jinan base",
        operator_id="byd", city_id="jinan", facility_type="vehicle_plant", technology_tags=["nev"]),
    fac(id="byd-changzhou-plant", name_zh="比亚迪常州基地", name_en="BYD Changzhou base",
        operator_id="byd", city_id="changzhou", facility_type="vehicle_plant", technology_tags=["nev"]),
    fac(id="chery-wuhu-plant", name_zh="奇瑞芜湖整车基地", name_en="Chery Wuhu vehicle base",
        operator_id="chery", city_id="wuhu", facility_type="vehicle_plant", technology_tags=["export"]),
    fac(id="faw-changchun-hq", name_zh="中国一汽长春总部", name_en="FAW Changchun headquarters",
        operator_id="faw", city_id="changchun", facility_type="headquarters_campus", technology_tags=["auto_history"]),
    fac(id="li-auto-changzhou", name_zh="理想汽车常州工厂", name_en="Li Auto Changzhou plant",
        operator_id="li-auto", city_id="changzhou", facility_type="vehicle_plant", technology_tags=["nev"]),
    fac(id="catl-ningde", name_zh="宁德时代宁德基地", name_en="CATL Ningde base",
        operator_id="catl", city_id="ningde", facility_type="battery_plant", technology_tags=["battery"]),
    fac(id="catl-yibin", name_zh="四川时代宜宾生产基地", name_en="CATL-SC Yibin Production Base",
        operator_id="catl", city_id="yibin", facility_type="battery_plant", technology_tags=["battery"],
        operator_legal_name_zh="四川时代新能源科技有限公司",
        operator_legal_name_en="Sichuan Contemporary Amperex Technology Limited",
        operator_matches_entity_boundary=False),
    fac(id="gwm-xushui", name_zh="长城汽车徐水智慧工厂", name_en="GWM Xushui smart plant",
        operator_id="gwm", city_id="baoding", district_zh="徐水", district_en="Xushui",
        facility_type="vehicle_plant"),
    fac(id="sgmw-liuzhou", name_zh="上汽通用五菱柳州基地", name_en="SGMW Liuzhou base",
        operator_id="sgmw", city_id="liuzhou", facility_type="vehicle_plant"),
    fac(id="yutong-zhengzhou", name_zh="宇通客车十八里河生产基地", name_en="Yutong Bus Shibalihe Production Base",
        operator_id="yutong", city_id="zhengzhou", facility_type="vehicle_plant", technology_tags=["bus"]),
    fac(id="nio-hefei", name_zh="蔚来合肥制造基地", name_en="NIO Hefei manufacturing base",
        operator_id="nio", city_id="hefei", facility_type="vehicle_plant", technology_tags=["nev"]),
    fac(id="dongfeng-shiyan", name_zh="东风商用车十堰D600智慧工厂", name_en="Dongfeng CV Shiyan D600 Smart Factory",
        operator_id="dongfeng-cv", city_id="shiyan", facility_type="vehicle_plant", technology_tags=["commercial"]),
    fac(id="catarc-tianjin", name_zh="中汽中心天津检测基地", name_en="CATARC Tianjin testing campus",
        operator_id="catarc", city_id="tianjin", facility_type="testing_center", technology_tags=["testing"]),
    fac(id="dongfeng-honda-wuhan-first-factory", name_zh="东风本田第一工厂", name_en="Dongfeng Honda First Factory",
        operator_id="dongfeng-honda", city_id="wuhan", facility_type="vehicle_plant"),
    fac(id="saic-gm-shanghai", name_zh="上汽通用上海工厂", name_en="SAIC-GM Shanghai plant",
        operator_id="saic-gm", city_id="shanghai", facility_type="vehicle_plant"),
    fac(id="beijing-hyundai-plant", name_zh="北京现代整车工厂", name_en="Beijing Hyundai vehicle plant",
        operator_id="beijing-hyundai", city_id="beijing", facility_type="vehicle_plant"),
    fac(id="zeekr-ningbo", name_zh="极氪宁波杭州湾工厂", name_en="Zeekr Ningbo Hangzhou Bay plant",
        operator_id="zeekr", city_id="ningbo", district_zh="杭州湾", district_en="Hangzhou Bay",
        facility_type="vehicle_plant", technology_tags=["nev"]),
    fac(id="lotus-wuhan", name_zh="武汉路特斯纯电车型合同制造工厂", name_en="Wuhan contract-manufacturing plant for Lotus BEVs",
        operator_id="geely", city_id="wuhan", facility_type="vehicle_plant", technology_tags=["nev"],
        operator_legal_name_zh="浙江吉利汽车有限公司武汉分公司",
        operator_legal_name_en="Zhejiang Geely Automobile Co., Ltd., Wuhan Branch",
        operator_matches_entity_boundary=False,
        manufactures_for_ids=["lotus"]),
]

FACILITY_EVIDENCE = {
    # The Tesla contact page establishes the Shanghai entity/location, but not
    # every current-product detail in this candidate record.
    "tesla-shanghai-gigafactory": (SRC_TESLA_SHANGHAI_CONTACT, 0.50),
    "catl-yibin": (SRC_CATL_YIBIN, 0.80),
    "gwm-xushui": (SRC_GWM_GLOBAL, 0.75),
}
for facility in FACILITIES:
    if facility["id"] in FACILITY_EVIDENCE:
        source_id, confidence = FACILITY_EVIDENCE[facility["id"]]
        facility["source_ids"] = [source_id]
        facility["confidence"] = confidence


# Factory-level official evidence added during the 2025 organization pass.
# One source record is registered per facility even when a page supports more
# than one plant; this keeps support_scope exact and mechanically auditable.
FACILITY_SOURCE_META = {}


def verified_facility(fid, name_zh, name_en, operator_id, city_id, url, publisher_zh,
                      publisher_en, title_zh, title_en=None, facility_type="vehicle_plant",
                      source_type="company_site", fact_date="2025", district_zh=None,
                      district_en=None, technology_tags=None, status="active",
                      opened_at=None, operator_legal_name_zh=None,
                      operator_legal_name_en=None, operator_legal_name_en_is_translation=False,
                      operator_matches_entity_boundary=None,
                      associated_organization_ids=None, manufactures_for_ids=None,
                      confidence=0.85, support_fields=None, address_zh=None,
                      address_en=None, site_scope_note_zh=None,
                      site_scope_note_en=None):
    source_id = f"src-{fid}"
    patch = dict(
        id=fid, name_zh=name_zh, name_en=name_en, operator_id=operator_id,
        city_id=city_id, facility_type=facility_type, status=status,
        confidence=confidence, source_ids=[source_id], last_verified=LV,
    )
    if district_zh is not None:
        patch["district_zh"] = district_zh
    if district_en is not None:
        patch["district_en"] = district_en
    if technology_tags is not None:
        patch["technology_tags"] = technology_tags
    if opened_at is not None:
        patch["opened_at"] = opened_at
    if address_zh is not None:
        patch["address_zh"] = address_zh
    if address_en is not None:
        patch["address_en"] = address_en
    if site_scope_note_zh is not None:
        patch["site_scope_note_zh"] = site_scope_note_zh
    if site_scope_note_en is not None:
        patch["site_scope_note_en"] = site_scope_note_en
    if operator_legal_name_zh is not None:
        patch["operator_legal_name_zh"] = operator_legal_name_zh
    if operator_legal_name_en is not None:
        patch["operator_legal_name_en"] = operator_legal_name_en
    patch["operator_legal_name_en_is_translation"] = operator_legal_name_en_is_translation
    if operator_matches_entity_boundary is None and operator_legal_name_zh and operator_legal_name_en:
        catalog = ORG_BY_ID.get(operator_id) or {}
        operator_matches_entity_boundary = (
            operator_legal_name_zh == catalog.get("legal_name_zh")
            and operator_legal_name_en == catalog.get("legal_name_en")
        )
    patch["operator_matches_entity_boundary"] = operator_matches_entity_boundary
    if associated_organization_ids is not None:
        patch["associated_organization_ids"] = associated_organization_ids
    if manufactures_for_ids is not None:
        patch["manufactures_for_ids"] = manufactures_for_ids
    existing = next((row for row in FACILITIES if row["id"] == fid), None)
    if existing:
        patch["source_ids"] = list(dict.fromkeys((existing.get("source_ids") or []) + [source_id]))
        existing.update(patch)
    else:
        FACILITIES.append(fac(**patch))
    FACILITY_SOURCE_META[source_id] = dict(
        facility_id=fid, url=url, publisher_zh=publisher_zh,
        publisher_en=publisher_en, title_zh=title_zh,
        title_en=title_en or title_zh, source_type=source_type,
        fact_date=fact_date,
        support_fields=support_fields or [
            "name_zh", "name_en", "operator_id", "city_id", "status", "facility_type",
            *(
                ["operator_legal_name_zh", "operator_matches_entity_boundary"]
                + ([] if operator_legal_name_en_is_translation else ["operator_legal_name_en"])
                if operator_legal_name_zh or operator_legal_name_en else []
            ),
            *(["associated_organization_ids"] if associated_organization_ids else []),
            *(["manufactures_for_ids"] if manufactures_for_ids else []),
            *(["address_zh"] if address_zh else []),
            *(["address_en"] if address_en else []),
        ],
    )


def supporting_facility_source(fid, suffix, url, publisher_zh, publisher_en,
                               title_zh, title_en=None, source_type="company_site",
                               fact_date="2025", support_fields=None, field_patch=None,
                               scope_zh=None, scope_en=None):
    """Attach a second exact source without pretending one page proves all fields."""
    facility = next((row for row in FACILITIES if row["id"] == fid), None)
    if facility is None:
        raise SystemExit(f"supporting source references unknown facility: {fid}")
    if field_patch:
        facility.update(field_patch)
    source_id = f"src-{fid}-{suffix}"
    facility["source_ids"] = list(dict.fromkeys((facility.get("source_ids") or []) + [source_id]))
    FACILITY_SOURCE_META[source_id] = dict(
        facility_id=fid, url=url, publisher_zh=publisher_zh,
        publisher_en=publisher_en, title_zh=title_zh,
        title_en=title_en or title_zh, source_type=source_type,
        fact_date=fact_date, support_fields=support_fields or [],
        scope_zh=scope_zh,
        scope_en=scope_en,
    )


supporting_facility_source(
    "catl-yibin", "official-contact", "https://www.catl.com/en/contactus/",
    "宁德时代", "CATL", "联系地址与子公司名录", "Contact and subsidiary directory",
    support_fields=[
        "operator_legal_name_en", "operator_matches_entity_boundary",
        "address_zh", "address_en",
    ],
    field_patch={
        "address_zh": "四川省宜宾市临港经济开发区产业大道1号",
        "address_en": "No. 1 Industry Avenue, Lingang Economic Development Zone, Yibin, Sichuan",
    },
)


LI_AUTO_AR = "https://ir.lixiang.com/system/files-encrypted/nasdaq_kms/assets/2026/04/10/6-28-41/2025%20Annual%20Report.pdf"
NIO_20F = "https://www.sec.gov/Archives/edgar/data/1736541/000110465926041765/nio-20251231x20f.htm"
BBAC_NETWORK = "https://group.mercedes-benz.com/unternehmen/produktion/produktionsnetzwerk/produktionsnetzwerk-peking.html"
SGMW_ABOUT = "https://www.sgmw.com.cn/aboutUs"
DFLZM_ABOUT = "https://www.dflzm.com.cn/index.php/about"
GAC_HONDA_PLANT = "https://global.honda/en/newsroom/news/2024/c241223eng.html"
DF_NISSAN_HUADU = "https://img.dongfeng-nissan.com.cn/Content/magazine/201902/webPC20190218/page17_view.html"
BMW_PROFILE = "https://www.bmw-brilliance.cn/cn/zh/pr/index.html"
VW_CHINA_PLANTS = "https://m.volkswagengroupchina.com.cn/zh-cn/volkswagengroupchina/plant1"
SAIC_GM_PROFILE = "https://gdpg.apps.saic-gm.com/MainPage.html?id=1&pid=1"
HYUNDAI_ENV = "https://www.beijing-hyundai.com.cn/MaterialFile/EnvImportFiles/20250213/d47a15da-7183-48b5-b229-06295a2a774e.pdf"
CATL_BASES = "https://www.catl.com/news/8368.html"
CALB_BASES = "https://www.calb-tech.com/AboutUs.html"
EVE_BASES = "https://www.evebattery.com/en/about.htm"
SERES_FACTORY = "https://cdn-web.seres.cn/uploads/20250109/f65444b4e5c67a343892fcfd100d60bd.pdf"
VOYAH_FACTORY = "https://etp.dfmc.com.cn/xydt/002002/20260512/d0b316f1-098b-4b74-bf64-4bbb14f1d96.html"
FAW_TOYOTA_BASES = "https://www.teda.gov.cn/contents/1262/89974.html"
XPENG_20F = "https://www.sec.gov/Archives/edgar/data/1810997/000119312526157849/R11.htm"

for args in [
    ("beijing-benz-yizhuang", "北京奔驰亦庄工厂", "Beijing Benz Yizhuang Plant", "beijing-benz", "beijing", BBAC_NETWORK, "梅赛德斯-奔驰集团", "Mercedes-Benz Group", "北京生产网络：亦庄工厂", "Beijing production network: Yizhuang plant"),
    ("beijing-benz-shunyi", "北京奔驰顺义工厂", "Beijing Benz Shunyi Plant", "beijing-benz", "beijing", BBAC_NETWORK, "梅赛德斯-奔驰集团", "Mercedes-Benz Group", "北京生产网络：顺义工厂", "Beijing production network: Shunyi plant"),
    ("li-auto-changzhou", "理想汽车常州制造基地", "Li Auto Changzhou Manufacturing Base", "li-auto", "changzhou", LI_AUTO_AR, "理想汽车", "Li Auto", "理想汽车2025年年度报告", "Li Auto 2025 annual report"),
    ("li-auto-beijing", "理想汽车北京制造基地", "Li Auto Beijing Manufacturing Base", "li-auto", "beijing", LI_AUTO_AR, "理想汽车", "Li Auto", "理想汽车2025年年度报告", "Li Auto 2025 annual report"),
    ("nio-hefei", "蔚来合肥F1制造基地", "NIO Hefei F1 Manufacturing Base", "nio", "hefei", NIO_20F, "蔚来", "NIO", "蔚来2025年Form 20-F", "NIO 2025 Form 20-F"),
    ("nio-hefei-f2", "蔚来合肥F2新桥智能电动汽车产业园", "NIO Hefei F2 NeoPark", "nio", "hefei", NIO_20F, "蔚来", "NIO", "蔚来2025年Form 20-F", "NIO 2025 Form 20-F"),
    ("sgmw-liuzhou", "上汽通用五菱柳州河西基地", "SGMW Liuzhou Hexi Base", "sgmw", "liuzhou", SGMW_ABOUT, "上汽通用五菱", "SAIC-GM-Wuling", "上汽通用五菱企业介绍", "SGMW company profile"),
    ("sgmw-liuzhou-baojun", "上汽通用五菱柳州宝骏基地", "SGMW Liuzhou Baojun Base", "sgmw", "liuzhou", SGMW_ABOUT, "上汽通用五菱", "SAIC-GM-Wuling", "上汽通用五菱企业介绍", "SGMW company profile"),
    ("dongfeng-liuzhou-commercial", "东风柳汽商用车生产基地", "Dongfeng Liuzhou Commercial Vehicle Base", "dongfeng-liuzhou", "liuzhou", DFLZM_ABOUT, "东风柳州汽车", "Dongfeng Liuzhou Motor", "东风柳汽公司简介", "Dongfeng Liuzhou Motor profile"),
    ("dongfeng-liuzhou-passenger", "东风柳汽乘用车生产基地", "Dongfeng Liuzhou Passenger Vehicle Base", "dongfeng-liuzhou", "liuzhou", DFLZM_ABOUT, "东风柳州汽车", "Dongfeng Liuzhou Motor", "东风柳汽公司简介", "Dongfeng Liuzhou Motor profile"),
    ("gac-honda-huangpu", "广汽本田黄埔工厂", "GAC Honda Huangpu Plant", "gac-honda", "guangzhou", GAC_HONDA_PLANT, "本田汽车", "Honda Motor", "广汽本田新能源工厂投产", "GAC Honda NEV plant begins production"),
    ("gac-honda-zengcheng", "广汽本田增城工厂", "GAC Honda Zengcheng Plant", "gac-honda", "guangzhou", GAC_HONDA_PLANT, "本田汽车", "Honda Motor", "广汽本田新能源工厂投产", "GAC Honda NEV plant begins production"),
    ("gac-honda-nev", "广汽本田开发区新能源工厂", "GAC Honda Development District NEV Plant", "gac-honda", "guangzhou", GAC_HONDA_PLANT, "本田汽车", "Honda Motor", "广汽本田新能源工厂投产", "GAC Honda NEV plant begins production"),
    ("dongfeng-nissan-huadu-1", "东风日产花都一工厂", "Dongfeng Nissan Huadu Plant No. 1", "dongfeng-nissan", "guangzhou", DF_NISSAN_HUADU, "东风日产", "Dongfeng Nissan", "东风日产花都工厂", "Dongfeng Nissan Huadu plant"),
    ("dongfeng-nissan-huadu-2", "东风日产花都二工厂", "Dongfeng Nissan Huadu Plant No. 2", "dongfeng-nissan", "guangzhou", DF_NISSAN_HUADU, "东风日产", "Dongfeng Nissan", "东风日产花都工厂", "Dongfeng Nissan Huadu plant"),
    ("bmw-brilliance-dadong", "华晨宝马大东工厂", "BMW Brilliance Plant Dadong", "bmw-brilliance", "shenyang", BMW_PROFILE, "华晨宝马", "BMW Brilliance", "华晨宝马公司概况", "BMW Brilliance company profile"),
    ("bmw-brilliance-tiexi", "华晨宝马铁西工厂（含里达厂区）", "BMW Brilliance Plant Tiexi including Lydia", "bmw-brilliance", "shenyang", BMW_PROFILE, "华晨宝马", "BMW Brilliance", "华晨宝马公司概况", "BMW Brilliance company profile"),
    ("saic-vw-anting", "上汽大众安亭一厂", "SAIC Volkswagen Anting Plant No. 1", "saic-vw", "shanghai", VW_CHINA_PLANTS, "大众汽车集团（中国）", "Volkswagen Group China", "大众汽车集团在华工厂", "Volkswagen Group plants in China"),
    ("saic-vw-meb-shanghai", "上汽大众上海MEB新能源工厂", "SAIC Volkswagen Shanghai MEB NEV Plant", "saic-vw", "shanghai", VW_CHINA_PLANTS, "大众汽车集团（中国）", "Volkswagen Group China", "大众汽车集团在华工厂", "Volkswagen Group plants in China"),
    ("saic-vw-ningbo", "上汽大众宁波工厂", "SAIC Volkswagen Ningbo Plant", "saic-vw", "ningbo", VW_CHINA_PLANTS, "大众汽车集团（中国）", "Volkswagen Group China", "大众汽车集团在华工厂", "Volkswagen Group plants in China"),
    ("saic-vw-changsha", "上汽大众长沙工厂", "SAIC Volkswagen Changsha Plant", "saic-vw", "changsha", VW_CHINA_PLANTS, "大众汽车集团（中国）", "Volkswagen Group China", "大众汽车集团在华工厂", "Volkswagen Group plants in China"),
    ("saic-gm-shanghai", "上汽通用浦东金桥基地", "SAIC-GM Pudong Jinqiao Base", "saic-gm", "shanghai", SAIC_GM_PROFILE, "上汽通用", "SAIC-GM", "上汽通用公司简介", "SAIC-GM company profile"),
    ("saic-gm-shenyang", "上汽通用沈阳北盛基地", "SAIC-GM Shenyang Beisheng Base", "saic-gm", "shenyang", SAIC_GM_PROFILE, "上汽通用", "SAIC-GM", "上汽通用公司简介", "SAIC-GM company profile"),
    ("saic-gm-wuhan", "上汽通用武汉基地", "SAIC-GM Wuhan Base", "saic-gm", "wuhan", SAIC_GM_PROFILE, "上汽通用", "SAIC-GM", "上汽通用公司简介", "SAIC-GM company profile"),
    ("beijing-hyundai-plant", "北京现代仁和工厂", "Beijing Hyundai Renhe Plant", "beijing-hyundai", "beijing", HYUNDAI_ENV, "北京现代", "Beijing Hyundai", "北京现代环境信息披露", "Beijing Hyundai environmental disclosure"),
    ("beijing-hyundai-yangzhen", "北京现代杨镇工厂", "Beijing Hyundai Yangzhen Plant", "beijing-hyundai", "beijing", HYUNDAI_ENV, "北京现代", "Beijing Hyundai", "北京现代环境信息披露", "Beijing Hyundai environmental disclosure"),
    ("catl-ningde", "宁德时代湖东生产基地", "CATL Ningde Hudong Production Base", "catl", "ningde", CATL_BASES, "宁德时代", "CATL", "走近十三大电池生产基地", "Inside CATL battery production bases", "battery_plant"),
    ("catl-ningde-huxi", "宁德时代湖西生产基地", "CATL Ningde Huxi Production Base", "catl", "ningde", CATL_BASES, "宁德时代", "CATL", "走近十三大电池生产基地", "Inside CATL battery production bases", "battery_plant"),
    ("catl-ningde-jiaocheng", "宁德时代蕉城生产基地", "CATL Ningde Jiaocheng Production Base", "catl", "ningde", CATL_BASES, "宁德时代", "CATL", "走近十三大电池生产基地", "Inside CATL battery production bases", "battery_plant"),
    ("catl-ningde-fuding", "宁德时代福鼎生产基地", "CATL Ningde Fuding Production Base", "catl", "ningde", CATL_BASES, "宁德时代", "CATL", "走近十三大电池生产基地", "Inside CATL battery production bases", "battery_plant"),
    ("catl-ningde-z", "宁德时代Z生产基地", "CATL Ningde Z Production Base", "catl", "ningde", CATL_BASES, "宁德时代", "CATL", "走近十三大电池生产基地", "Inside CATL battery production bases", "battery_plant"),
    ("catl-liyang", "宁德时代溧阳生产基地", "CATL Liyang Production Base", "catl", "changzhou", "https://www.catl.com/en/news/6652.html", "宁德时代", "CATL", "CATL Liyang lighthouse factory", "CATL Liyang lighthouse factory", "battery_plant"),
    ("calb-changzhou", "中创新航常州产业基地", "CALB Changzhou Industrial Base", "calb", "changzhou", CALB_BASES, "中创新航", "CALB", "中创新航产业基地", "CALB industrial bases", "battery_plant"),
    ("calb-xiamen", "中创新航厦门产业基地", "CALB Xiamen Industrial Base", "calb", "xiamen", CALB_BASES, "中创新航", "CALB", "中创新航产业基地", "CALB industrial bases", "battery_plant"),
    ("calb-chengdu", "中创新航成都产业基地", "CALB Chengdu Industrial Base", "calb", "chengdu", CALB_BASES, "中创新航", "CALB", "中创新航产业基地", "CALB industrial bases", "battery_plant"),
    ("calb-wuhan", "中创新航武汉产业基地", "CALB Wuhan Industrial Base", "calb", "wuhan", CALB_BASES, "中创新航", "CALB", "中创新航产业基地", "CALB industrial bases", "battery_plant"),
    ("eve-huizhou-a", "亿纬锂能惠州总部A区生产基地", "EVE Huizhou Headquarters Area A Base", "eve-energy", "huizhou", EVE_BASES, "亿纬锂能", "EVE Energy", "亿纬锂能全球布局", "EVE Energy global footprint", "battery_plant"),
    ("eve-huizhou-b", "亿纬锂能惠州总部B区生产基地", "EVE Huizhou Headquarters Area B Base", "eve-energy", "huizhou", EVE_BASES, "亿纬锂能", "EVE Energy", "亿纬锂能全球布局", "EVE Energy global footprint", "battery_plant"),
    ("eve-huizhou-c", "亿纬锂能惠州总部C区生产基地", "EVE Huizhou Headquarters Area C Base", "eve-energy", "huizhou", EVE_BASES, "亿纬锂能", "EVE Energy", "亿纬锂能全球布局", "EVE Energy global footprint", "battery_plant"),
    ("seres-liangjiang", "赛力斯两江工厂", "SERES Liangjiang Factory", "seres", "chongqing", SERES_FACTORY, "赛力斯集团", "SERES Group", "赛力斯资产审核问询函回复", "SERES asset-review response"),
    ("seres-phoenix", "赛力斯凤凰工厂", "SERES Phoenix Factory", "seres", "chongqing", SERES_FACTORY, "赛力斯集团", "SERES Group", "赛力斯资产审核问询函回复", "SERES asset-review response"),
    ("seres-super", "赛力斯超级工厂", "SERES Super Factory", "seres", "chongqing", "https://cdn-web.seres.cn/uploads/20250902/16d86a4ef54310af944762148f4e9c3a.pdf", "赛力斯集团", "SERES Group", "赛力斯2025年半年度报告", "SERES 2025 interim report"),
    ("voyah-yunfeng", "岚图云峰工厂", "VOYAH Yunfeng Factory", "voyah", "wuhan", VOYAH_FACTORY, "东风汽车", "Dongfeng Motor", "岚图上市后体系能力报道", "VOYAH post-listing capability report"),
    ("voyah-gold", "岚图黄金工厂", "VOYAH Gold Factory", "voyah", "wuhan", VOYAH_FACTORY, "东风汽车", "Dongfeng Motor", "岚图上市后体系能力报道", "VOYAH post-listing capability report"),
    ("golden-dragon-haicang", "金旅海沧生产基地", "Golden Dragon Haicang Production Base", "golden-dragon", "xiamen", "https://www.goldendragonbus.com/news/272973.html", "金旅客车", "Golden Dragon Bus", "Golden Dragon company history", "Golden Dragon company history"),
    ("faw-toyota-tianjin", "一汽丰田天津新能源工厂", "FAW Toyota Tianjin NEV Plant", "faw-toyota", "tianjin", "https://www.eco-city.gov.cn/m1/tpxw/20250516/58517.html", "中新天津生态城", "Sino-Singapore Tianjin Eco-City", "一汽丰田第1200万辆新车下线", "FAW Toyota 12 millionth vehicle", "vehicle_plant", "government_site"),
    ("faw-toyota-changchun", "一汽丰田长春丰越工厂", "FAW Toyota Changchun Fengyue Plant", "faw-toyota", "changchun", "https://www.jl.gov.cn/yaowen/202510/t20251031_3508375.html", "吉林省人民政府", "Jilin Provincial Government", "吉林工业经济高质量发展观察", "Jilin industrial economy report", "vehicle_plant", "government_site"),
    ("faw-toyota-chengdu", "一汽丰田成都工厂", "FAW Toyota Chengdu Plant", "faw-toyota", "chengdu", FAW_TOYOTA_BASES, "天津经济技术开发区", "TEDA", "一汽丰田销售公司启动业务", "FAW Toyota sales company launch", "vehicle_plant", "government_site"),
    ("xpeng-guangzhou", "小鹏汽车广州工厂", "XPENG Guangzhou Plant", "xpeng", "guangzhou", XPENG_20F, "小鹏汽车", "XPENG", "小鹏汽车2025年Form 20-F", "XPENG 2025 Form 20-F", "vehicle_plant", "company_ir"),
    ("xpeng-wuhan", "小鹏汽车武汉制造基地", "XPENG Wuhan Manufacturing Base", "xpeng", "wuhan", XPENG_20F, "小鹏汽车", "XPENG", "小鹏汽车2025年Form 20-F", "XPENG 2025 Form 20-F", "vehicle_plant", "company_ir"),
    ("volvo-chengdu", "沃尔沃汽车成都工厂", "Volvo Cars Chengdu Plant", "volvo-cars-chengdu", "chengdu", "https://www.volvocars.com/intl/media/press-releases/A92B18442980B66D/", "沃尔沃汽车", "Volvo Cars", "Volvo Cars Chengdu plant renewable electricity", "Volvo Cars Chengdu plant renewable electricity"),
    ("gac-aion-changsha", "广汽埃安长沙智能生态工厂", "GAC AION Changsha Smart Eco-Factory", "gac-aion", "changsha", "https://www.hkexnews.hk/listedco/listconews/sehk/2025/0425/2025042502715.pdf", "广汽集团", "GAC Group", "广汽集团2024年年度报告", "GAC Group 2024 annual report", "vehicle_plant", "company_ir"),
    ("tesla-shanghai-gigafactory", "特斯拉上海超级工厂", "Tesla Shanghai Gigafactory", "tesla-china", "shanghai", "https://www.sec.gov/Archives/edgar/data/1318605/000162828026003952/tsla-20251231.htm", "特斯拉 / 美国证券交易委员会", "Tesla / U.S. Securities and Exchange Commission", "Tesla 2025 Form 10-K: Gigafactory Shanghai", "Tesla 2025 Form 10-K: Gigafactory Shanghai", "vehicle_plant", "regulator"),
]:
    verified_facility(*args)

verified_facility(
    "lotus-wuhan", "武汉路特斯纯电车型合同制造工厂",
    "Wuhan contract-manufacturing plant for Lotus BEVs", "geely", "wuhan",
    "https://www.sec.gov/Archives/edgar/data/1962746/000110465923080197/filename10.htm",
    "Lotus Technology / 美国证券交易委员会", "Lotus Technology / U.S. SEC",
    "制造合作协议：武汉工厂运营主体",
    "Manufacturing cooperation agreement: Wuhan plant operator",
    source_type="regulator", technology_tags=["nev"],
    operator_legal_name_zh="浙江吉利汽车有限公司武汉分公司",
    operator_legal_name_en="Zhejiang Geely Automobile Co., Ltd., Wuhan Branch",
    operator_matches_entity_boundary=False, manufactures_for_ids=["lotus"],
)

# Wuhan / Zhengzhou / Shiyan physical-site audit. Generic city-level plant
# labels are narrowed to exact campuses; closed plants and production lines
# inside one campus are not counted as separate current facilities.
verified_facility(
    "dongfeng-honda-wuhan-first-factory", "东风本田第一工厂",
    "Dongfeng Honda First Factory", "dongfeng-honda", "wuhan",
    "https://www.dongfeng-honda.com/first_factory.shtml", "东风本田",
    "Dongfeng Honda", "第一工厂", "First Factory", fact_date="2004-04-01",
    opened_at="2004-04-01",
)
verified_facility(
    "dongfeng-honda-wuhan-third-factory", "东风本田第三工厂",
    "Dongfeng Honda Third Factory", "dongfeng-honda", "wuhan",
    "https://www.dongfeng-honda.com/third_factory.shtml", "东风本田",
    "Dongfeng Honda", "第三工厂", "Third Factory", fact_date="2019-04-12",
    opened_at="2019-04-12",
)
verified_facility(
    "dongfeng-honda-wuhan-nev-factory", "东风本田新能源工厂",
    "Dongfeng Honda New Energy Vehicle Factory", "dongfeng-honda", "wuhan",
    "https://www.honda.com.cn/news/20241011.html", "本田中国", "Honda China",
    "东风Honda新能源工厂正式投产", "Dongfeng Honda NEV factory begins production",
    fact_date="2024-10-11", technology_tags=["nev"], opened_at="2024-10-11",
)
verified_facility(
    "yutong-zhengzhou", "宇通客车十八里河生产基地",
    "Yutong Bus Shibalihe Production Base", "yutong", "zhengzhou",
    "https://gc.jiceng.zhengzhou.gov.cn/attachment/%E5%AE%87%E9%80%9A%E5%AE%A2%E8%BD%A6%E8%82%A1%E4%BB%BD%E6%9C%89%E9%99%90%E5%85%AC%E5%8F%B8%E9%AB%98%E7%AB%AF%E7%94%B5%E5%8A%A8%E5%AE%A2%E8%BD%A6%E6%8A%80%E6%9C%AF%E5%B9%B3%E5%8F%B0%E7%A0%94%E5%8F%91%E8%83%BD%E5%8A%9B%E5%8F%8A%E7%94%9F%E4%BA%A7%E5%88%B6%E9%80%A0%E6%B0%B4%E5%B9%B3%E6%8F%90%E5%8D%87%E9%A1%B9%E7%9B%AE%E6%8A%A5%E5%91%8A%E8%A1%A8.pdf?dAa1ReeZxZY9Xkmpt4xs0LMf1bWr1Ek5PtZnxDLpDIu9WqM6hi9WF5VtqnvpvJLQaIbgwKawojStsL-XELX8DuxcRN5lGFjS=",
    "郑州市管城回族区政府", "Guancheng District Government, Zhengzhou",
    "宇通客车十八里河基地环境影响报告", "Yutong Shibalihe base EIA",
    source_type="government_site", technology_tags=["bus"],
)
verified_facility(
    "yutong-zhengzhou-new-energy-bus-base", "宇通新能源客车生产基地",
    "Yutong New Energy Bus Production Base", "yutong", "zhengzhou",
    "https://public.zzjkq.gov.cn/attachment/2025%E5%B9%B4%E5%AE%87%E9%80%9A%E6%96%B0%E8%83%BD%E6%BA%90%E5%AE%A2%E8%BD%A6%E5%88%86%E5%85%AC%E5%8F%B8%E5%9C%B0%E4%B8%8B%E6%B0%B4%E8%87%AA%E8%A1%8C%E7%9B%91%E6%B5%8B%E6%8A%A5%E5%91%8A.pdf?-ROeI8JlwUqpmPx2TJ_Evw6328Q-42bY4DhnkXpl9cJpe1jVY3VdCXhNM_tKjsg7SuF0xzhrpXv0h14SjwxmMJgJ8ymBqHWF2g=%3D",
    "郑州经济技术开发区", "Zhengzhou Economic-Technological Development Zone",
    "宇通新能源客车基地2025年监测报告", "Yutong NEV bus base 2025 monitoring report",
    source_type="government_site", technology_tags=["bus", "nev"],
)
verified_facility(
    "zhengzhou-nissan-zhengzhou-zhongmu-plant", "郑州日产中牟工厂",
    "Zhengzhou Nissan Zhongmu Plant", "zhengzhou-nissan", "zhengzhou",
    "https://www.zznissan.com/crafting-cars-with-ingenuity/", "郑州日产",
    "Zhengzhou Nissan", "制造能力与新能源专长", "Manufacturing capabilities and NEV expertise",
    district_zh="中牟", district_en="Zhongmu",
)
verified_facility(
    "dongfeng-shiyan", "东风商用车十堰D600智慧工厂",
    "Dongfeng Commercial Vehicle Shiyan D600 Smart Factory", "dongfeng-cv", "shiyan",
    "https://www.dfcv.com.cn/cn/xwxq?newsId=104", "东风商用车",
    "Dongfeng Commercial Vehicle", "D600智慧工厂正式投产",
    "D600 smart factory begins production", fact_date="2026-01-24",
    technology_tags=["commercial"], opened_at="2026-01-24",
)

# Northern-city physical-campus audit. Brand links remain associations when
# the legal plant operator is a group company or subsidiary represented by a
# broader catalog row.
verified_facility(
    "hongqi-changchun-fanrong", "红旗制造中心繁荣厂区",
    "Hongqi Manufacturing Center Fanrong Campus", "faw", "changchun",
    "https://gxt.jl.gov.cn/ztzl/zzyszhzx/sdsf/202303/t20230322_3531253.html",
    "吉林省工业和信息化厅", "Jilin Department of Industry and Information Technology",
    "一汽集团红旗繁荣工厂", "FAW Hongqi Fanrong Factory", source_type="government_site",
    district_zh="汽车经济技术开发区", district_en="Automobile Economic and Technological Development Zone",
    technology_tags=["nev"], operator_legal_name_zh="中国第一汽车股份有限公司",
    operator_legal_name_en="China FAW Corporation Limited",
    operator_matches_entity_boundary=False, associated_organization_ids=["hongqi"],
)
verified_facility(
    "jiefang-changchun-dongfeng-j7", "一汽解放长春东风大街厂区（含J7整车智能工厂）",
    "FAW Jiefang Changchun Dongfeng Avenue Campus (including J7 Smart Plant)",
    "faw", "changchun", "https://gxt.jl.gov.cn/ztzl/zzyszhzx/sdsf/202303/t20230321_3531252.html",
    "吉林省工业和信息化厅", "Jilin Department of Industry and Information Technology",
    "一汽解放J7整车智能工厂", "FAW Jiefang J7 Smart Factory", source_type="government_site",
    district_zh="汽车经济技术开发区", district_en="Automobile Economic and Technological Development Zone",
    technology_tags=["commercial"], opened_at="2021-12-14",
    operator_legal_name_zh="一汽解放汽车有限公司",
    operator_legal_name_en="FAW Jiefang Automobile Co., Ltd.",
    operator_matches_entity_boundary=False, associated_organization_ids=["jiefang"],
)
verified_facility(
    "faw-vw-changchun-main", "一汽-大众长春主厂区",
    "FAW-Volkswagen Changchun Main Campus", "faw-vw", "changchun",
    "https://www.faw-vw.com/industry-tourism", "一汽-大众", "FAW-Volkswagen",
    "品质之旅：长春基地", "Industry tour: Changchun base",
    district_zh="汽车经济技术开发区", district_en="Automobile Economic and Technological Development Zone",
)
verified_facility(
    "faw-vw-changchun-q-plant", "一汽-大众长春Q工厂",
    "FAW-Volkswagen Changchun Q Plant", "faw-vw", "changchun",
    "https://sthjt.jl.gov.cn/ywdt/gkgs/gszx/slgs/201708/P020230109658410278809.pdf",
    "吉林省生态环境厅", "Jilin Department of Ecology and Environment",
    "一汽-大众长春工厂结构更新项目环境影响报告", "FAW-Volkswagen Changchun restructuring EIA",
    source_type="regulator", district_zh="汽车经济技术开发区", district_en="Automobile Economic and Technological Development Zone",
)
verified_facility(
    "faw-vw-tianjin-huabei", "一汽-大众天津华北基地",
    "FAW-Volkswagen Tianjin North China Base", "faw-vw", "tianjin",
    "https://www.teda.gov.cn/szym/contents/2604/421.html", "天津经济技术开发区",
    "Tianjin Economic-Technological Development Area", "一汽-大众天津分公司",
    "FAW-Volkswagen Tianjin branch", source_type="government_site",
    district_zh="宁河区", district_en="Ninghe District",
)
verified_facility(
    "audi-faw-nev-changchun-ppe", "奥迪一汽新能源汽车长春PPE工厂",
    "Audi FAW NEV Changchun PPE Plant", "audi-faw-nev", "changchun",
    "https://www.audi.com/en/press-releases/audi-starts-production-of-electric-models-at-its-new-plant-in-china-16427",
    "奥迪", "Audi", "奥迪一汽新能源工厂投产", "Audi FAW NEV plant starts production",
    technology_tags=["nev"], opened_at="2024-12",
)
verified_facility(
    "bmw-brilliance-dadong", "华晨宝马大东工厂", "BMW Brilliance Plant Dadong",
    "bmw-brilliance", "shenyang", "https://www.bmw-brilliance.cn/cn/zh/pr/shenyang.html",
    "华晨宝马", "BMW Brilliance", "沈阳生产基地", "Shenyang production base",
    district_zh="大东区", district_en="Dadong District",
)
verified_facility(
    "bmw-brilliance-tiexi", "华晨宝马铁西原厂区", "BMW Brilliance Original Tiexi Campus",
    "bmw-brilliance", "shenyang", "https://www.bmw-brilliance.cn/cn/zh/pr/shenyang.html",
    "华晨宝马", "BMW Brilliance", "沈阳生产基地", "Shenyang production base",
    district_zh="铁西区", district_en="Tiexi District",
)
verified_facility(
    "bmw-brilliance-lydia", "华晨宝马里达厂区", "BMW Brilliance Lydia Campus",
    "bmw-brilliance", "shenyang", "https://www.bmw-brilliance.cn/cn/zh/pr/shenyang.html",
    "华晨宝马", "BMW Brilliance", "沈阳生产基地：里达厂区", "Shenyang production base: Lydia",
    district_zh="铁西区", district_en="Tiexi District", technology_tags=["nev"], opened_at="2022-06-23",
)
verified_facility(
    "gwm-baoding-lianchi", "长城汽车保定莲池整车厂区", "GWM Baoding Lianchi Vehicle Campus",
    "gwm", "baoding", "https://www.gwm.com.cn/globalBusiness.html", "长城汽车", "Great Wall Motor",
    "全球布局：保定生产基地", "Global footprint: Baoding production base",
    district_zh="莲池区", district_en="Lianchi District", opened_at="2003",
)
verified_facility(
    "gwm-xushui", "长城汽车徐水智慧工厂园区", "GWM Xushui Smart Manufacturing Campus",
    "gwm", "baoding", "https://www.gwm.com.cn/globalBusiness.html", "长城汽车", "Great Wall Motor",
    "全球布局：徐水生产基地", "Global footprint: Xushui production base",
    district_zh="徐水区", district_en="Xushui District",
)
verified_facility(
    "gwm-tianjin-teda-west", "长城汽车天津生产基地", "GWM Tianjin Production Base",
    "gwm", "tianjin", "https://www.teda.gov.cn/contents/2758/95385.html", "天津经济技术开发区",
    "Tianjin Economic-Technological Development Area", "长城汽车全动力智能超级平台落地泰达",
    "GWM full-powertrain intelligent platform in TEDA", source_type="government_site",
    district_zh="滨海新区经开区西区", district_en="TEDA West, Binhai New Area",
)
verified_facility(
    "faw-toyota-tianjin-teda", "一汽丰田天津经开区整车厂区（泰达/新一工厂）",
    "FAW Toyota Tianjin TEDA Vehicle Campus (TEDA/New No. 1 Plants)", "faw-toyota", "tianjin",
    "https://www.toyota.com.cn/about/profile/", "丰田中国", "Toyota China",
    "丰田在中国：一汽丰田", "Toyota in China: FAW Toyota",
    district_zh="滨海新区天津经济技术开发区", district_en="TEDA, Binhai New Area",
)
verified_facility(
    "faw-toyota-tianjin", "一汽丰田新能源工厂（天津生态城）",
    "FAW Toyota NEV Plant (Tianjin Eco-City)", "faw-toyota", "tianjin",
    "https://www.eco-city.gov.cn/m1/stcxw/20250325/58208.html", "中新天津生态城",
    "Sino-Singapore Tianjin Eco-City", "一汽丰田新能源工厂绿色制造实践",
    "FAW Toyota NEV plant green manufacturing", source_type="government_site",
    district_zh="滨海新区中新天津生态城", district_en="Sino-Singapore Tianjin Eco-City",
    technology_tags=["nev"],
)
verified_facility(
    "faw-toyota-changchun", "一汽丰田长春丰越工厂", "FAW Toyota Changchun Fengyue Plant",
    "faw-toyota", "changchun", "https://www.toyota.com.cn/about/profile/", "丰田中国", "Toyota China",
    "丰田在中国：长春丰越分公司", "Toyota in China: Changchun Fengyue branch",
    district_zh="汽车经济技术开发区", district_en="Automobile Economic and Technological Development Zone",
)
verified_facility(
    "catarc-tianjin", "中汽中心天津检测基地", "CATARC Tianjin Testing Campus",
    "catarc", "tianjin", "https://www.catarc.ac.cn/zxjj_0", "中国汽车技术研究中心",
    "China Automotive Technology and Research Center", "中心简介", "Center profile",
    facility_type="testing_center", technology_tags=["testing"],
)
verified_facility(
    "sinotruk-jinan-laiwu", "中国重汽济南卡车莱芜厂区", "Sinotruk Jinan Truck Laiwu Campus",
    "sinotruk", "jinan", "https://www.miit.gov.cn/datainfo/dljdclscqyjcpgg/xcpgs404wdsdww/art/2026/art_a907c9c6c1374a9399c1886f03b3da5d.html",
    "中华人民共和国工业和信息化部", "Ministry of Industry and Information Technology",
    "道路机动车辆生产企业及产品公告", "Road-motor-vehicle manufacturer announcement",
    source_type="regulator", district_zh="莱芜区", district_en="Laiwu District",
    technology_tags=["commercial"], operator_legal_name_zh="中国重汽集团济南卡车股份有限公司",
    operator_legal_name_en="Sinotruk Jinan Truck Co., Ltd.", operator_matches_entity_boundary=False,
)
verified_facility(
    "sinotruk-jinan-zhangqiu", "中国重汽章丘圣井工业园整车厂区",
    "Sinotruk Zhangqiu Shengjing Industrial Park Vehicle Campus", "sinotruk", "jinan",
    "https://jnepb.jinan.gov.cn/module/download/downfile.jsp?classid=0&filename=53403f90fe684793b65dd7535569ba8e.pdf&showname=%E5%85%AC%E4%BC%97%E5%8F%82%E4%B8%8E%E8%AF%B4%E6%98%8E.pdf",
    "济南市生态环境局", "Jinan Municipal Ecology and Environment Bureau",
    "中国重汽章丘园区建设项目公众参与说明", "Sinotruk Zhangqiu project participation statement",
    source_type="regulator", district_zh="章丘区圣井街道", district_en="Shengjing, Zhangqiu District",
    technology_tags=["commercial"], operator_legal_name_zh="中国重汽集团济南商用车有限公司",
    operator_legal_name_en="Sinotruk Jinan Commercial Vehicle Co., Ltd.", operator_matches_entity_boundary=False,
)

# Additional physical-facility pass. Production lines sharing one land parcel
# remain one facility, so GAC Toyota's five lines resolve to three campuses.
verified_facility(
    "xiaomi-auto-beijing-factory", "小米汽车北京工厂（小米汽车超级工厂）",
    "Xiaomi Auto Beijing Factory (Xiaomi EV Factory)", "xiaomi-auto", "beijing",
    "https://www.xiaomiauto.com/global/factory", "小米汽车", "Xiaomi Auto",
    "小米汽车工厂", "Xiaomi Auto Factory", district_zh="经开区",
    district_en="Beijing Economic-Technological Development Area",
    technology_tags=["nev"],
)
verified_facility(
    "jac-hefei-light-truck-super-factory", "江汽集团高端轻卡先进制造基地",
    "JAC High-end Light Truck Advanced Manufacturing Base", "jac", "hefei",
    "https://www.jac.com.cn/u/cms/www/202411/011535268qqf.pdf", "江汽集团", "JAC Group",
    "江汽集团制造基地", "JAC Group manufacturing bases", source_type="company_ir",
    technology_tags=["commercial"],
)
verified_facility(
    "jac-hefei-zunjie-super-factory", "尊界超级工厂", "Zunjie Super Factory",
    "jac", "hefei", "https://www.jac.com.cn/news/20250618/6263.html", "江汽集团", "JAC Group",
    "尊界S800批量投产", "Zunjie S800 enters mass production", district_zh="肥西新港",
    district_en="Feixi Xingang", technology_tags=["nev"],
)
verified_facility(
    "vw-anhui-hefei-meb-plant", "大众安徽智能制造基地（MEB工厂）",
    "Volkswagen Anhui MEB Plant", "vw-anhui", "hefei",
    "https://www.volkswagengroupchina.com.cn/zh-cn/partner/volkswagenanhui",
    "大众汽车集团（中国）", "Volkswagen Group China", "大众安徽", "Volkswagen Anhui",
    technology_tags=["nev"],
)
verified_facility(
    "gac-toyota-nansha-lines-1-2-campus", "广汽丰田一、二生产线厂区",
    "GAC Toyota Lines 1–2 Plant Campus", "gac-toyota", "guangzhou",
    "https://sthjj.gz.gov.cn/attachment/7/7823/7823480/9974388.pdf",
    "广州市生态环境局", "Guangzhou Municipal Ecology and Environment Bureau",
    "广汽丰田核技术利用建设项目环境影响报告表",
    "GAC Toyota environmental impact report", source_type="regulator",
    district_zh="南沙", district_en="Nansha",
)
verified_facility(
    "gac-toyota-nansha-lines-3-4-campus", "广汽丰田三、四生产线厂区",
    "GAC Toyota Lines 3–4 Plant Campus", "gac-toyota", "guangzhou",
    "https://sthjj.gz.gov.cn/attachment/7/7823/7823480/9974388.pdf",
    "广州市生态环境局", "Guangzhou Municipal Ecology and Environment Bureau",
    "广汽丰田核技术利用建设项目环境影响报告表",
    "GAC Toyota environmental impact report", source_type="regulator",
    district_zh="南沙", district_en="Nansha",
)
verified_facility(
    "gac-toyota-nansha-line-5-plant", "广汽丰田第五生产线（新能源扩能二期）",
    "GAC Toyota Line 5 Plant (NEV Expansion Phase II)", "gac-toyota", "guangzhou",
    "https://www.gacgroup.com/cn/news/detail?baseid=18517", "广汽集团", "GAC Group",
    "广汽丰田新能源汽车扩能二期正式投产",
    "GAC Toyota NEV expansion phase II begins production", district_zh="南沙",
    district_en="Nansha", technology_tags=["nev"],
)
verified_facility(
    "saic-maxus-shanghai-lingang-plant", "上汽大通临港基地（EV31总装工厂）",
    "SAIC Maxus Lingang Plant (EV31 Assembly Plant)", "saic-maxus", "shanghai",
    "https://www.shlingang.com/lg1/lingangjituan/xwzx/zcgx/201810/t20181015_16084.shtml",
    "上海临港集团", "Shanghai Lingang Group", "上汽大通临港分公司正式揭牌，EV31首台整车下线",
    "SAIC Maxus Lingang branch opens and first EV31 rolls off line", district_zh="临港",
    district_en="Lingang", technology_tags=["nev"],
)
_saic_lingang = next(row for row in FACILITIES if row["id"] == "saic-maxus-shanghai-lingang-plant")
_saic_lingang_current_source = "src-saic-maxus-shanghai-lingang-plant-current"
_saic_lingang["source_ids"].append(_saic_lingang_current_source)
FACILITY_SOURCE_META[_saic_lingang_current_source] = dict(
    facility_id="saic-maxus-shanghai-lingang-plant",
    url="https://sthj.sh.gov.cn/cmsres/de/dec906ac573445c8ad21b090449ce6d8/aec43c86ea5986d2a561024a713e84d8.pdf",
    publisher_zh="上海市生态环境局", publisher_en="Shanghai Municipal Bureau of Ecology and Environment",
    title_zh="2024年度排污单位生态环境信用初步评价结果（临港）",
    title_en="2024 preliminary environmental-credit results for regulated entities in Lingang",
    source_type="regulator", fact_date="2024",
    support_fields=["operator_id", "city_id", "status"],
    scope_zh="该监管名单用于确认上汽大通临港分公司在2024年度仍作为临港排污单位被评价。",
    scope_en="This regulatory list confirms that the SAIC Maxus Lingang branch remained an evaluated Lingang regulated entity in 2024.",
)

# Physical sites recovered by the September 2026 entity-by-entity audit.
# Keep the Foton R&D/testing campus out of the manufacturing-plant count, and
# classify Li Auto's SiC power-module site as an automotive parts plant.
verified_facility(
    "foton-changsha-super-truck-factory", "北汽福田长沙超级卡车工厂",
    "BAIC Foton Changsha Super Truck Factory", "baic-foton", "changsha",
    "https://static.cninfo.com.cn/finalpage/2026-04-25/1225194454.PDF",
    "北汽福田", "BAIC Foton", "北汽福田2025年年度报告",
    "BAIC Foton 2025 annual report", source_type="company_ir",
    technology_tags=["commercial"],
)
verified_facility(
    "foton-beijing-engineering-research-institute",
    "北汽福田北京工程研究总院及试验园区",
    "BAIC Foton Beijing Engineering Research Institute and Testing Campus",
    "baic-foton", "beijing", "https://www.foton.com.cn/innovate.html",
    "北汽福田", "BAIC Foton", "福田汽车科技创新与研发布局",
    "Foton technology and R&D footprint", facility_type="testing_center",
    fact_date="2026",
)
verified_facility(
    "li-auto-suzhou-semiconductor-base", "理想汽车苏州半导体制造基地",
    "Li Auto Suzhou Semiconductor Manufacturing Base", "li-auto", "suzhou",
    LI_AUTO_AR, "理想汽车", "Li Auto", "理想汽车2025年年度报告",
    "Li Auto 2025 annual report", facility_type="parts_plant",
    source_type="company_ir", technology_tags=["semiconductor"],
)

# Shanghai and Guangzhou entity-boundary audit. These records distinguish
# physical campuses from brands and from production lines inside one campus.
NIO_ESG_2025 = "https://cdn-udp-public.eu.nio.com/www-nio/esg/2025/NIO-2025-ESG-Report-Simplified-Chinese.pdf"
for args in [
    ("nio-hefei", "蔚来先进制造合肥一工厂（F1）", "NIO Advanced Manufacturing Hefei Plant 1 (F1)"),
    ("nio-hefei-f2", "蔚来先进制造新桥二工厂（F2）", "NIO Advanced Manufacturing Xinqiao Plant 2 (F2)"),
    ("nio-hefei-f3", "蔚来先进制造新桥三工厂（F3）", "NIO Advanced Manufacturing Xinqiao Plant 3 (F3)"),
]:
    verified_facility(
        args[0], args[1], args[2], "nio", "hefei", NIO_ESG_2025,
        "蔚来", "NIO", "蔚来2025年环境、社会及管治报告",
        "NIO 2025 ESG report", source_type="company_ir", technology_tags=["nev"],
    )

for args in [
    (
        "saic-passenger-vehicle-lingang", "上汽乘用车临港制造基地",
        "SAIC Passenger Vehicle Lingang Manufacturing Base", "shanghai",
        "https://sheitc.sh.gov.cn/zxxx/20250430/619996be762a4f278515ee677284f715.html",
        "上海市经济和信息化委员会", "Shanghai Municipal Commission of Economy and Informatization",
        "上汽集团与临港新片区签署深化合作协议",
        "SAIC signs an expanded cooperation agreement with Lingang",
    ),
    (
        "saic-passenger-vehicle-zhengzhou", "上汽乘用车郑州基地",
        "SAIC Passenger Vehicle Zhengzhou Base", "zhengzhou",
        "https://www.saicmotor.com/m/xwzx/xwk/2022/57846.shtml",
        "上汽集团", "SAIC Motor",
        "上汽乘用车郑州基地整车二厂正式投产",
        "SAIC Passenger Vehicle Zhengzhou Plant 2 begins production",
    ),
    (
        "saic-passenger-vehicle-ningde", "上汽乘用车福建宁德基地",
        "SAIC Passenger Vehicle Fujian Ningde Base", "ningde",
        "https://www.saicmotor.com/chinese/download/esg/2024.pdf",
        "上汽集团", "SAIC Motor", "上汽集团2024年度环境、社会和公司治理报告",
        "SAIC Motor 2024 environmental, social and governance report",
    ),
]:
    verified_facility(
        args[0], args[1], args[2], "saic", args[3], args[4], args[5], args[6],
        args[7], args[8], source_type="government_site" if args[0] != "saic-passenger-vehicle-ningde" else "company_site",
    )

SAIC_VW_JIADING = "https://www.shanghai.gov.cn/nw15343/20250725/9becfc0d9c8d4c54a690397bcf68cee9.html"
verified_facility(
    "saic-vw-anting", "上汽大众安亭一厂（当前用途待核）",
    "SAIC Volkswagen Anting Plant 1 (current use pending review)", "saic-vw", "shanghai",
    SAIC_VW_JIADING, "上海市人民政府", "Shanghai Municipal Government",
    "嘉定区调研上汽大众安亭生产基地", "Jiading review of SAIC Volkswagen's Anting production base",
    source_type="government_site", status="unknown",
)
for fid, zh, en in [
    ("saic-vw-anting-2", "上汽大众安亭二厂", "SAIC Volkswagen Anting Plant 2"),
    ("saic-vw-anting-3", "上汽大众安亭三厂", "SAIC Volkswagen Anting Plant 3"),
    ("saic-vw-meb-shanghai", "上汽大众安亭MEB工厂", "SAIC Volkswagen Anting MEB Plant"),
]:
    verified_facility(
        fid, zh, en, "saic-vw", "shanghai", SAIC_VW_JIADING,
        "上海市人民政府", "Shanghai Municipal Government",
        "嘉定区调研上汽大众安亭生产基地", "Jiading review of SAIC Volkswagen's Anting production base",
        source_type="government_site", technology_tags=["nev"] if "meb" in fid else None,
    )

# The last exact regulator record establishes that the Lingang branch existed
# in 2024, but does not prove current 2025/26 vehicle production. Keep the site
# visible without counting it as a confirmed active plant.
_saic_lingang["status"] = "unknown"
_saic_lingang["confidence"] = 0.75

verified_facility(
    "xpeng-wuhan", "小鹏汽车武汉零部件及混合制造基地",
    "XPENG Wuhan Components and Mixed Manufacturing Base", "xpeng", "wuhan",
    "https://www.whkfq.gov.cn/xwzx/yw/kfqyw/qnxw/202603/t20260309_2737179.html",
    "武汉经济技术开发区", "Wuhan Economic & Technological Development Zone",
    "小鹏汽车回“家乡”", "XPENG returns home to Wuhan", facility_type="parts_plant",
    source_type="government_site", fact_date="2026", technology_tags=["components"],
)

for fid, zh, en, address_note in [
    (
        "gac-aion-guangzhou-first-smart-eco-factory", "广汽埃安第一智造中心",
        "GAC Aion First Smart Manufacturing Center", "一厂",
    ),
    (
        "gac-aion-guangzhou-second-smart-manufacturing-center", "广汽埃安第二智造中心",
        "GAC Aion Second Smart Manufacturing Center", "第二智造中心",
    ),
]:
    verified_facility(
        fid, zh, en, "gac-aion", "guangzhou",
        "https://sthjj.gz.gov.cn/ztlm/wryhjjgxxgk/hjzf/zmqd/content/post_10606583.html",
        "广州市生态环境局", "Guangzhou Municipal Ecology and Environment Bureau",
        f"2026年广州市生态环境监督执法正面清单：广汽埃安{address_note}",
        f"2026 Guangzhou environmental positive list: GAC Aion {address_note}",
        source_type="regulator", fact_date="2026", technology_tags=["nev"],
    )

NISSAN_ASIA = "https://www.nissan-global.com/EN/COMPANY/PROFILE/EN_ESTABLISHMENT/ASIA.html"
for fid, zh, en, city_id in [
    ("dongfeng-nissan-zhengzhou", "东风日产郑州整车生产基地", "Dongfeng Nissan Zhengzhou Vehicle Production Base", "zhengzhou"),
    ("dongfeng-nissan-wuhan", "东风日产武汉整车生产基地", "Dongfeng Nissan Wuhan Vehicle Production Base", "wuhan"),
]:
    verified_facility(
        fid, zh, en, "dongfeng-nissan", city_id, NISSAN_ASIA,
        "日产汽车", "Nissan Motor", "日产汽车亚洲生产据点",
        "Nissan production sites in Asia", source_type="company_site",
    )

# Nissan's establishment directory and Guangzhou regulator identify the exact
# manufacturing legal entities. The catalog row remains the network anchor,
# while the operator mismatch is explicitly disclosed.
for _fid, _zh, _en in [
    ("dongfeng-nissan-huadu-1", "东风日产花都一工厂", "Dongfeng Nissan Huadu Plant No. 1"),
    ("dongfeng-nissan-huadu-2", "东风日产花都二工厂", "Dongfeng Nissan Huadu Plant No. 2"),
]:
    verified_facility(
        _fid, _zh, _en, "dongfeng-nissan", "guangzhou",
        "https://sthjj.gz.gov.cn/attachment/8/8006/8006643/10775547.pdf",
        "广州市生态环境局", "Guangzhou Municipal Ecology and Environment Bureau",
        "东风日产花都工厂VOCs改造及电池车间项目环评批复",
        "Regulatory approval for Dongfeng Nissan Huadu plant upgrades",
        source_type="regulator", technology_tags=["nev", "ice"],
        operator_legal_name_zh="广州风神汽车有限公司",
        operator_legal_name_en="Guangzhou Fengshen Automobile Co., Ltd.",
        operator_matches_entity_boundary=False,
    )
verified_facility(
    "dongfeng-nissan-zhengzhou", "东风日产郑州整车生产基地",
    "Dongfeng Nissan Zhengzhou Vehicle Production Base", "dongfeng-nissan", "zhengzhou",
    NISSAN_ASIA, "日产汽车", "Nissan Motor Co., Ltd.", "亚洲生产据点名录",
    "Asia production-establishment directory", technology_tags=["nev", "ice"],
    operator_legal_name_zh="广州风神汽车有限公司郑州分公司",
    operator_legal_name_en="Guangzhou Fengshen Automobile Co., Ltd. Zhengzhou Branch",
    operator_matches_entity_boundary=False,
)
verified_facility(
    "dongfeng-nissan-wuhan", "东风日产武汉整车生产基地",
    "Dongfeng Nissan Wuhan Vehicle Production Base", "dongfeng-nissan", "wuhan",
    NISSAN_ASIA, "日产汽车", "Nissan Motor Co., Ltd.", "亚洲生产据点名录",
    "Asia production-establishment directory", technology_tags=["nev", "ice"],
    operator_legal_name_zh="东风汽车有限公司武汉分公司",
    operator_legal_name_en="Dongfeng Motor Co., Ltd. Wuhan Branch",
    operator_matches_entity_boundary=False,
)

# Government pages directly identify the active BYD bases.  Keep one physical
# site per atlas city; headquarters/R&D remains a separate non-plant facility.
for args in [
    ("byd-xian-plant", "比亚迪西安基地", "BYD Xi'an Base", "byd", "xian", "https://xdz.xa.gov.cn/xwzx/gxyw/2008094583654723585.html", "西安高新区", "Xi'an High-tech Zone", "比亚迪西安产业园", "BYD Xi'an industrial park"),
    ("byd-hefei-plant", "比亚迪合肥基地", "BYD Hefei Base", "byd", "hefei", "https://gxj.hefei.gov.cn/gzdt/18623967.html", "合肥市工业和信息化局", "Hefei Bureau of Industry and IT", "比亚迪合肥基地", "BYD Hefei base"),
    ("byd-zhengzhou-plant", "比亚迪郑州基地", "BYD Zhengzhou Base", "byd", "zhengzhou", "https://www.zhengzhou.gov.cn/news1/7050246.jhtml", "郑州市人民政府", "Zhengzhou Municipal Government", "比亚迪郑州基地", "BYD Zhengzhou base"),
    ("byd-changsha-plant", "比亚迪长沙基地", "BYD Changsha Base", "byd", "changsha", "https://gxt.hunan.gov.cn/xxgk_71033/gzdt/qyzx/202304/t20230414_29313457.html", "湖南省工业和信息化厅", "Hunan Department of Industry and IT", "比亚迪长沙基地", "BYD Changsha base"),
    ("byd-jinan-plant", "比亚迪济南基地", "BYD Jinan Base", "byd", "jinan", "https://jnxxq.jinan.gov.cn/col123348/art/2024/art_123348_4781830.html", "济南新旧动能转换起步区", "Jinan Start-up Area", "比亚迪济南基地", "BYD Jinan base"),
    ("byd-changzhou-plant", "比亚迪常州基地", "BYD Changzhou Base", "byd", "changzhou", "https://www.changzhou.gov.cn/ns_news/17168718749666", "常州市人民政府", "Changzhou Municipal Government", "比亚迪常州基地", "BYD Changzhou base"),
]:
    verified_facility(*args, source_type="government_site", technology_tags=["nev"])

# Shenzhen / Huizhou organization audit.  Preserve one record per physical
# campus: brand/model lines do not become duplicate factories, while EVE's
# separately named A/B/C/Xikeng sites remain distinct until address evidence
# supports merging them.
verified_facility(
    "byd-shenshan-xiaomo-plant", "比亚迪深汕小漠工业园（深汕工厂）",
    "BYD Shenshan Xiaomo Industrial Park (Shenshan Plant)", "byd", "shenzhen",
    "https://www.byd.com/cn/news/2025/detail599", "比亚迪", "BYD",
    "比亚迪第1300万辆新能源汽车下线", "BYD's 13 millionth NEV rolls off the line",
    technology_tags=["nev"],
)
for args in [
    (
        "eve-huizhou-xikeng", "亿纬锂能惠州西坑生产基地",
        "EVE Huizhou Xikeng Production Base", "huizhou",
    ),
    (
        "eve-ningbo-production-base", "亿纬锂能宁波生产基地",
        "EVE Ningbo Production Base", "ningbo",
    ),
]:
    verified_facility(
        args[0], args[1], args[2], "eve-energy", args[3],
        "https://www.evebattery.com/cn/about.html", "亿纬锂能", "EVE Energy",
        "亿纬锂能全球布局", "EVE Energy global footprint",
        facility_type="battery_plant", technology_tags=["battery"],
    )
verified_facility(
    "desay-sv-huizhou-huinan-industrial-park", "德赛西威惠南工业园智能工厂",
    "Desay SV Huinan Industrial Park Smart Factory", "desay-sv", "huizhou",
    "https://www.desaysv.com/newsDetails/366.html", "德赛西威", "Desay SV",
    "德赛西威智能工厂二期正式启动", "Desay SV smart-factory phase II begins",
    facility_type="parts_plant", technology_tags=["auto_electronics"],
)
verified_facility(
    "foryou-huizhou-huayang-industrial-park", "华阳集团惠州华阳工业园",
    "Foryou Huizhou Industrial Park", "holosonics", "huizhou",
    "https://www.foryougroup.com/news/627.html", "华阳集团", "Foryou Group",
    "华阳工业园制造活动", "Manufacturing at Foryou Industrial Park",
    facility_type="parts_plant", technology_tags=["auto_electronics", "components"],
)
verified_facility(
    "foryou-shanghai-new-production-base", "华阳集团上海新生产基地",
    "Foryou New Shanghai Production Base", "holosonics", "shanghai",
    "https://disc.static.szse.cn/disc/disk03/finalpage/2026-03-28/5505667f-a2a3-4dd2-867c-fcd4a87713c8.PDF",
    "华阳集团／深圳证券交易所", "Foryou Group / Shenzhen Stock Exchange",
    "华阳集团2025年年度报告", "Foryou Group 2025 annual report",
    facility_type="parts_plant", source_type="company_ir",
    technology_tags=["auto_electronics", "components"],
)

# Chongqing / Chengdu audit.  The former generic Changan point is split into
# distinct addresses.  Avatr, Deepal and AITO model production stays attached
# to the legal plant operator instead of being duplicated under brand rows.
for args in [
    (
        "changan-yubei-yangfan", "长安汽车渝北工厂（扬帆基地）",
        "Changan Yubei Plant (Yangfan Base)", "chongqing",
        "https://sthjj.cq.gov.cn/zwgk_249/zfxxgkzl/fdzdgknr/hjyxpj/pzgcxx/scjsxmhpxxgs/202605/t20260525_15700847_wap.html",
        "重庆市生态环境局", "Chongqing Ecology and Environment Bureau",
        "长安渝北工厂产能转移环评", "EIA for Changan Yubei plant capacity transfer",
        "渝北区", "Yubei District", "regulator", "unknown",
    ),
    (
        "changan-yubei-digital", "长安汽车数智工厂", "Changan Automobile Digital Factory",
        "chongqing", "https://sthjj.cq.gov.cn/zwgk_249/zfxxgkzl/fdzdgknr/hjyxpj/pzgcxx/scjsxmhpxxgs/202605/t20260525_15700847_wap.html",
        "重庆市生态环境局", "Chongqing Ecology and Environment Bureau",
        "长安数智工厂扩能环评", "EIA for Changan Digital Factory expansion",
        "渝北区", "Yubei District", "regulator", "active",
    ),
    (
        "changan-liangjiang-1", "长安汽车两江工厂一厂区", "Changan Liangjiang Plant Campus 1",
        "chongqing", "https://sthjj.cq.gov.cn/zwxx_249/tzgg/202205/P020220507517792174187.pdf",
        "重庆市生态环境局", "Chongqing Ecology and Environment Bureau",
        "重庆市环境信息强制性披露企业名单", "Chongqing mandatory environmental-disclosure register",
        "两江新区", "Liangjiang New Area", "regulator", "active",
    ),
    (
        "changan-liangjiang-2", "长安汽车两江工厂二厂区", "Changan Liangjiang Plant Campus 2",
        "chongqing", "https://sthjj.cq.gov.cn/zwxx_249/tzgg/202205/P020220507517792174187.pdf",
        "重庆市生态环境局", "Chongqing Ecology and Environment Bureau",
        "重庆市环境信息强制性披露企业名单", "Chongqing mandatory environmental-disclosure register",
        "两江新区", "Liangjiang New Area", "regulator", "active",
    ),
    (
        "changan-liangjiang-3", "长安汽车两江工厂三厂区", "Changan Liangjiang Plant Campus 3",
        "chongqing", "https://sthjj.cq.gov.cn/zwgk_249/zfxxgkml/hjgl/qjscsh_1/202203/t20220321_10531512_wap.html",
        "重庆市生态环境局", "Chongqing Ecology and Environment Bureau",
        "重庆市清洁生产审核名单", "Chongqing clean-production audit register",
        "两江新区", "Liangjiang New Area", "regulator", "active",
    ),
    (
        "changan-lingyao-banan", "重庆铃耀巴南整车基地", "Chongqing Lingyao Banan Vehicle Base",
        "chongqing", "https://www.cqbn.gov.cn/zwgk_252/fdzdgknr/zdxm/pzjgxx_1/202303/t20230307_11717607_wap.html",
        "重庆市巴南区人民政府", "Banan District Government",
        "重庆铃耀整车基地技改备案", "Chongqing Lingyao vehicle-base retrofit filing",
        "巴南区", "Banan District", "government_site", "active",
    ),
    (
        "changan-beijing", "北京长安汽车公司工厂", "Beijing Changan Automobile Plant",
        "beijing", "https://jxj.beijing.gov.cn/jxdt/tzgg/202512/P020251224523067931768.pdf",
        "北京市经济和信息化局", "Beijing Bureau of Economy and Information Technology",
        "北京市绿色工厂名单", "Beijing green-factory register",
        "房山区", "Fangshan District", "government_site", "active",
    ),
    (
        "changan-hefei", "合肥长安汽车工厂", "Hefei Changan Automobile Plant",
        "hefei", "https://www.miit.gov.cn/datainfo/dljdclscqyjcpgg/xcpgs402sduwe2e/art/2025/art_ea903ee176454eaabf57e7e312dab939.html",
        "工业和信息化部", "Ministry of Industry and Information Technology",
        "合肥长安车型申报", "Hefei Changan vehicle filing",
        "高新区", "High-tech Zone", "government_site", "active",
    ),
]:
    verified_facility(
        args[0], args[1], args[2], "changan", args[3], args[4], args[5], args[6],
        args[7], args[8], source_type=args[11], district_zh=args[9],
        district_en=args[10], status=args[12],
    )

for args in [
    (
        "seres-shuangfu", "赛力斯双福工厂", "SERES Shuangfu Plant", "chongqing",
        "https://sthjj.cq.gov.cn/zwgk_249/zfxxgkml/zcwj/qtwj/202404/t20240402_13102454.html",
        "重庆市生态环境局", "Chongqing Ecology and Environment Bureau",
        "重庆市2024年清洁生产审核名单", "Chongqing 2024 clean-production audit register",
        "江津区", "Jiangjin District", "regulator",
    ),
    (
        "seres-shiyan", "赛力斯汽车十堰工厂", "SERES Automobile Shiyan Plant", "shiyan",
        "https://www.miit.gov.cn/datainfo/dljdclscqyjcpgg/xcpgs390ssew/art/2024/art_57a37c132cb44fd9b4b2870b5f9e9d10.html",
        "工业和信息化部", "Ministry of Industry and Information Technology",
        "赛力斯汽车（湖北）车型申报", "Seres Automobile Hubei vehicle filing",
        "茅箭区", "Maojian District", "government_site",
    ),
]:
    verified_facility(
        args[0], args[1], args[2], "seres", args[3], args[4], args[5], args[6],
        args[7], args[8], source_type=args[11], district_zh=args[9], district_en=args[10],
        technology_tags=["nev"],
    )

verified_facility(
    "caeri-kai-rui-special-vehicle-dazu", "重庆凯瑞特种车大足工厂",
    "Chongqing Kai Rui Special Vehicle Dazu Plant", "caeri", "chongqing",
    "https://caeri.com.cn/zgqy/zjzgqy/lxwm/", "中国汽车工程研究院", "CAERI",
    "中国汽研联系我们", "CAERI contact and subsidiary locations",
    facility_type="vehicle_plant", source_type="company_site",
    district_zh="大足区双桥经开区", district_en="Dazu Shuangqiao Economic Development Zone",
    technology_tags=["commercial", "special_purpose"],
)
verified_facility(
    "qianli-ruilan-beibei", "睿蓝制造北碚工厂", "Ruilan Manufacturing Beibei Plant",
    "qianli", "chongqing",
    "https://www.beibei.gov.cn/bm/qsthjj/zwgk_58246/fdzdgknr_58248/qtfdzdgknr/202508/t20250806_14880437.html",
    "重庆市北碚区人民政府", "Beibei District Government",
    "北碚区2025年环境监管重点单位名录", "Beibei 2025 key environmental-regulation register",
    source_type="regulator", district_zh="北碚区", district_en="Beibei District",
)
verified_facility(
    "volvo-chengdu", "沃尔沃汽车成都工厂", "Volvo Cars Chengdu Plant",
    "volvo-cars-chengdu", "chengdu", "https://www.volvocars.com.cn/zh-cn/l/volvo-experience-centers/",
    "沃尔沃汽车中国", "Volvo Cars China", "体验沃尔沃汽车",
    "Experience Volvo Cars", district_zh="龙泉驿区", district_en="Longquanyi District",
)

# Yangtze-region physical-campus audit. Subsidiary or branch operators are
# named explicitly; their catalog parent remains only the graph anchor.
verified_facility(
    "jac-hefei-zunjie-super-factory", "尊界超级工厂", "Zunjie Super Factory", "jac", "hefei",
    "https://www.jac.com.cn/news/20250618/6263.html", "江汽集团", "JAC Group",
    "尊界S800正式批量投产", "Zunjie S800 enters mass production",
    operator_legal_name_zh="安徽江淮汽车集团股份有限公司肥西新能源乘用车分公司",
    operator_legal_name_en="Anhui Jianghuai Automobile Group Corp., Ltd. Feixi New Energy Passenger Vehicle Branch",
    operator_legal_name_en_is_translation=True,
    operator_matches_entity_boundary=False, technology_tags=["nev"], opened_at="2025-06-18",
)
verified_facility(
    "vw-anhui-hefei-meb-plant", "大众安徽合肥MEB工厂", "Volkswagen Anhui Hefei MEB Plant",
    "vw-anhui", "hefei", "https://www.volkswagengroupchina.com.cn/en/partner/volkswagenanhui",
    "大众汽车集团（中国）", "Volkswagen Group China", "大众汽车（安徽）",
    "Volkswagen Anhui", operator_legal_name_zh="大众汽车（安徽）有限公司",
    operator_legal_name_en="Volkswagen (Anhui) Automotive Company Limited",
    technology_tags=["nev"],
)
verified_facility(
    "gotion-hefei-xinzhan-base", "国轩高科合肥新站动力电池基地",
    "Gotion Hefei Xinzhan Battery Base", "gotion", "hefei",
    "https://www.gotion.com.cn/news/announcementinfos/1529.html", "国轩高科", "Gotion High-tech",
    "合肥国轩新站园区当前招标公告", "Current tender notice for Gotion's Xinzhan campus",
    facility_type="battery_plant", operator_legal_name_zh="合肥国轩高科动力能源有限公司",
    operator_legal_name_en="Hefei Gotion High-tech Power Energy Co., Ltd.",
    operator_legal_name_en_is_translation=True,
    operator_matches_entity_boundary=False, technology_tags=["battery"],
)
verified_facility(
    "gotion-hefei-lujiang-battery-base", "国轩新能源庐江动力电池基地",
    "Gotion Lujiang Battery Base", "gotion", "hefei",
    "https://www.gotion.com.cn/news/companydetails/613.html", "国轩高科", "Gotion High-tech",
    "国轩新能源（庐江）项目介绍", "Gotion New Energy Lujiang project",
    facility_type="battery_plant", operator_legal_name_zh="国轩新能源（庐江）有限公司",
    operator_legal_name_en="Gotion New Energy (Lujiang) Co., Ltd.",
    operator_legal_name_en_is_translation=True,
    operator_matches_entity_boundary=False, technology_tags=["battery"],
)
verified_facility(
    "chery-wuhu-plant", "奇瑞芜湖长春路整车制造园区", "Chery Wuhu Changchun Road Vehicle Campus",
    "chery", "wuhu", "https://weda.wuhu.gov.cn/zwgk/tzgg/18467752.html",
    "芜湖经济技术开发区管理委员会", "Wuhu Economic and Technological Development Zone",
    "奇瑞整车三工厂升级改造项目公示", "Chery Vehicle Plant No. 3 upgrade notice",
    source_type="government_site", operator_legal_name_zh="奇瑞汽车股份有限公司",
    operator_legal_name_en="Chery Automobile Co., Ltd.",
)
verified_facility(
    "svolt-changzhou-jintan-campus", "蜂巢能源常州金坛生产基地",
    "SVOLT Changzhou Jintan Production Base", "svolt", "changzhou",
    "https://svolt.cn/news/229", "蜂巢能源", "SVOLT Energy",
    "堡垒2.0电池在常州工厂量产下线", "Fortress 2.0 battery enters production in Changzhou",
    facility_type="battery_plant", operator_legal_name_zh="蜂巢能源科技股份有限公司",
    operator_legal_name_en="SVOLT Energy Technology Co., Ltd.", technology_tags=["battery"],
)
verified_facility(
    "calb-changzhou", "中创新航常州基地", "CALB Changzhou Base", "calb", "changzhou",
    "https://www.calb-tech.com/newsDetails/13.html", "中创新航", "CALB",
    "中创新航常州基地获评国家级绿色工厂", "CALB Changzhou named a national green factory",
    facility_type="battery_plant", operator_legal_name_zh="中创新航科技集团股份有限公司",
    operator_legal_name_en="CALB Group Co., Ltd.", technology_tags=["battery"],
)
verified_facility(
    "calb-hefei-base", "中创新航合肥基地", "CALB Hefei Base", "calb", "hefei",
    "https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0429/2026042900019.pdf",
    "中创新航 / 香港交易所", "CALB / Hong Kong Stock Exchange",
    "中创新航2025年年度报告", "CALB 2025 annual report", source_type="regulator",
    facility_type="battery_plant", operator_legal_name_zh="中创新航科技（合肥）有限公司",
    operator_legal_name_en="CALB Technology (Hefei) Co., Ltd.",
    operator_legal_name_en_is_translation=True,
    operator_matches_entity_boundary=False, technology_tags=["battery"],
)
verified_facility(
    "catl-liyang", "宁德时代溧阳基地", "CATL Liyang Base", "catl", "changzhou",
    "https://www.catl.com/news/8368.html", "宁德时代", "CATL",
    "走近十三大电池生产基地", "Thirteen battery production bases",
    facility_type="battery_plant", operator_legal_name_zh="江苏时代新能源科技有限公司",
    operator_legal_name_en="Jiangsu Contemporary Amperex Technology Co., Ltd.",
    operator_legal_name_en_is_translation=True,
    operator_matches_entity_boundary=False, technology_tags=["battery"],
)

# Liuzhou, Xiamen and Ningbo physical-campus audit.  A catalog organization is
# only a graph anchor when the official source names a subsidiary/operator;
# brand rows never inherit their parent's facilities.
verified_facility(
    "sgmw-liuzhou", "上汽通用五菱柳州河西总部生产基地",
    "SGMW Liuzhou Hexi Headquarters Production Base", "sgmw", "liuzhou",
    "https://lu.sgmw.com.cn/portal/details.html?id=47418", "上汽通用五菱工会",
    "SGMW labour union", "上汽通用五菱河西基地介绍", "SGMW Hexi base profile",
    operator_legal_name_zh="上汽通用五菱汽车股份有限公司",
    operator_legal_name_en="SAIC-GM-Wuling Automobile Co., Ltd.",
    site_scope_note_zh="河西厂区按一个总部兼生产园区计数，不拆分园区内生产线。",
    site_scope_note_en="The Hexi campus is counted once as a combined headquarters and production site; lines inside it are not split.",
    support_fields=[
        "name_zh", "name_en", "operator_id", "operator_legal_name_zh",
        "operator_legal_name_en", "operator_matches_entity_boundary", "city_id",
        "status", "facility_type", "site_scope_note_zh", "site_scope_note_en",
    ],
)
supporting_facility_source(
    "sgmw-liuzhou", "company-profile", "https://www.sgmw.com.cn/aboutUs",
    "上汽通用五菱", "SAIC-GM-Wuling", "企业介绍", "Company profile",
    support_fields=["operator_id", "operator_legal_name_zh", "operator_legal_name_en"],
)
verified_facility(
    "sgmw-liuzhou-baojun", "上汽通用五菱柳州宝骏生产与研发试验基地",
    "SGMW Liuzhou Baojun Production and R&D/Test Campus", "sgmw", "liuzhou",
    "https://lu.sgmw.com.cn/portal/details.html?id=54294", "上汽通用五菱工会",
    "SGMW labour union", "宝骏基地生产与研发试验设施介绍",
    "Baojun campus production and R&D/test profile",
    operator_legal_name_zh="上汽通用五菱汽车股份有限公司",
    operator_legal_name_en="SAIC-GM-Wuling Automobile Co., Ltd.",
    district_zh="鱼峰区雒容镇", district_en="Luorong Town, Yufeng District",
    address_zh="广西壮族自治区柳州市鱼峰区雒容镇宝骏大道10号",
    address_en="No. 10 Baojun Avenue, Luorong Town, Yufeng District, Liuzhou, Guangxi",
    site_scope_note_zh="宝骏基地按一个物理园区计数，园区内生产、研发和试验设施不重复计数。",
    site_scope_note_en="The Baojun campus is counted as one physical site; its production, R&D and test facilities are not counted separately.",
    support_fields=[
        "name_zh", "name_en", "operator_id", "operator_legal_name_zh",
        "operator_legal_name_en", "operator_matches_entity_boundary", "city_id",
        "status", "facility_type", "site_scope_note_zh", "site_scope_note_en",
    ],
)
supporting_facility_source(
    "sgmw-liuzhou-baojun", "laboratory-address",
    "https://gxxnyqch.sgmw.com.cn/col30/171.html", "广西新能源汽车实验室",
    "Guangxi New Energy Vehicle Laboratory", "实验室联系地址",
    "Laboratory contact address", support_fields=[
        "district_zh", "district_en", "address_zh", "address_en",
    ],
)
verified_facility(
    "dongfeng-liuzhou-passenger", "东风柳汽柳东乘用车生产基地",
    "Dongfeng Liuzhou Liudong Passenger Vehicle Production Base",
    "dongfeng-liuzhou", "liuzhou", "https://www.dflzm.com.cn/index.php/about",
    "东风柳州汽车", "Dongfeng Liuzhou Motor", "公司简介", "Company profile",
    operator_legal_name_zh="东风柳州汽车有限公司",
    operator_legal_name_en="Dongfeng Liuzhou Motor Co., Ltd.",
    district_zh="鱼峰区雒容镇", district_en="Luorong Town, Yufeng District",
    site_scope_note_zh="该记录仅表示柳东乘用车物理基地；商用车基地另列，不新增含糊的综合点。",
    site_scope_note_en="This row represents only the Liudong passenger-vehicle campus; the commercial-vehicle campus remains separate and no ambiguous composite point is added.",
    support_fields=[
        "name_zh", "name_en", "operator_id", "operator_legal_name_zh",
        "operator_legal_name_en", "operator_matches_entity_boundary", "city_id",
        "status", "facility_type", "site_scope_note_zh", "site_scope_note_en",
    ],
)
supporting_facility_source(
    "dongfeng-liuzhou-passenger", "address",
    "https://www.dflzm.com.cn/index.php/about/purchase_detail/805", "东风柳州汽车",
    "Dongfeng Liuzhou Motor", "柳东乘用车基地采购公告", "Liudong passenger-vehicle base procurement notice",
    support_fields=["district_zh", "district_en", "address_zh", "address_en"],
    field_patch={
        "address_zh": "广西壮族自治区柳州市鱼峰区雒容镇博园大道6号",
        "address_en": "No. 6 Boyuan Avenue, Luorong Town, Yufeng District, Liuzhou, Guangxi",
    },
)
verified_facility(
    "golden-dragon-haicang", "厦门金龙旅行车海沧生产基地",
    "Xiamen Golden Dragon Haicang Production Base", "golden-dragon", "xiamen",
    "https://www.goldendragonbus.com/news/272973.html", "厦门金龙旅行车",
    "Xiamen Golden Dragon Bus", "金旅客车发展历程", "Golden Dragon company history",
    operator_legal_name_zh="厦门金龙旅行车有限公司",
    operator_legal_name_en="Xiamen Golden Dragon Bus Co., Ltd.",
    district_zh="海沧区新阳工业区", district_en="Xinyang Industrial Zone, Haicang District",
)
supporting_facility_source(
    "golden-dragon-haicang", "current-profile", "https://goldendragonbus.com/about.html",
    "厦门金龙旅行车", "Xiamen Golden Dragon Bus", "企业简介", "Company profile",
    support_fields=["operator_id", "operator_legal_name_zh", "operator_legal_name_en", "status"],
)
verified_facility(
    "guangxi-auto-liuzhou-hexi-headquarters", "广西汽车集团柳州河西总部",
    "Guangxi Automobile Group Liuzhou Hexi Headquarters", "guangxi-auto", "liuzhou",
    "https://www.wuling.com.cn/", "广西汽车集团", "Guangxi Automobile Group",
    "广西汽车集团官方网站", "Guangxi Automobile Group official website",
    facility_type="headquarters_campus",
    operator_legal_name_zh="广西汽车集团有限公司",
    operator_legal_name_en="Guangxi Automobile Group Co., Ltd.",
    district_zh="柳南区", district_en="Liunan District",
    address_zh="广西壮族自治区柳州市河西路18号五菱大厦",
    address_en="Wuling Building, No. 18 Hexi Road, Liuzhou, Guangxi",
)
verified_facility(
    "king-long-xiamen-jimei-campus", "厦门金龙联合集美生产基地",
    "Xiamen King Long Jimei Production Base", "king-long", "xiamen",
    "https://www.xmklm.com.cn/info/1070/48331.htm", "厦门金龙联合汽车工业",
    "Xiamen King Long", "金龙客车2025年生产报道", "King Long 2025 production report",
    operator_legal_name_zh="厦门金龙联合汽车工业有限公司",
    operator_legal_name_en="Xiamen King Long United Automotive Industry Co., Ltd.",
    district_zh="集美区", district_en="Jimei District",
    address_zh="福建省厦门市集美区金龙路9号",
    address_en="No. 9 Jinlong Road, Jimei District, Xiamen, Fujian",
    support_fields=[
        "name_zh", "name_en", "operator_id", "operator_legal_name_zh",
        "operator_legal_name_en", "operator_matches_entity_boundary", "city_id",
        "status", "facility_type",
    ],
)
supporting_facility_source(
    "king-long-xiamen-jimei-campus", "contact", "https://www.king-long.com.cn/col126/index",
    "厦门金龙联合汽车工业", "Xiamen King Long", "联系我们", "Contact us",
    support_fields=["district_zh", "district_en", "address_zh", "address_en"],
)
verified_facility(
    "joyson-ningbo-qingyi-campus", "均胜电子宁波清逸路总部",
    "Joyson Ningbo Qingyi Road Headquarters", "joyson", "ningbo",
    "https://www.hkexnews.hk/listedco/listconews/sehk/2026/0421/2026042101442.pdf",
    "均胜电子 / 香港交易所", "Joyson / Hong Kong Stock Exchange",
    "均胜电子2025年年度报告", "Joyson 2025 annual report", source_type="regulator",
    facility_type="headquarters_campus",
    operator_legal_name_zh="宁波均胜电子股份有限公司",
    operator_legal_name_en="Ningbo Joyson Electronic Corp.",
    district_zh="鄞州区", district_en="Yinzhou District",
    address_zh="浙江省宁波市鄞州区清逸路99号",
    address_en="No. 99 Qingyi Road, Yinzhou District, Ningbo, Zhejiang",
)
verified_facility(
    "tuopu-ningbo-yuwangshan-campus", "拓普集团宁波育王山路总部",
    "Tuopu Ningbo Yuwangshan Road Headquarters", "tuopu", "ningbo",
    "https://www.tuopu.com/wp-content/uploads/2026/03/%E6%8B%93%E6%99%AE%E9%9B%86%E5%9B%A22025%E5%B9%B4%E5%B9%B4%E5%BA%A6%E6%8A%A5%E5%91%8A.pdf",
    "拓普集团", "Tuopu Group", "拓普集团2025年年度报告", "Tuopu 2025 annual report",
    source_type="company_ir", facility_type="headquarters_campus",
    operator_legal_name_zh="宁波拓普集团股份有限公司",
    operator_legal_name_en="Ningbo Tuopu Group Co., Ltd.",
    district_zh="北仑区", district_en="Beilun District",
    address_zh="浙江省宁波市北仑区育王山路268号",
    address_en="No. 268 Yuwangshan Road, Beilun District, Ningbo, Zhejiang",
)
verified_facility(
    "minth-ningbo-chunxiao-campus", "宁波信泰春晓零部件生产基地",
    "Ningbo Shintai Chunxiao Parts Production Base", "minth", "ningbo",
    "https://sthjt.zj.gov.cn/module/download/downfile.jsp?classid=-1&filename=2406151827354466107.pdf",
    "浙江省生态环境厅", "Zhejiang Department of Ecology and Environment",
    "宁波信泰春晓厂区环境材料", "Ningbo Shintai Chunxiao site environmental filing",
    source_type="regulator", facility_type="parts_plant",
    operator_legal_name_zh="宁波信泰机械有限公司",
    operator_legal_name_en="Ningbo Shintai Machines Co., Ltd.",
    operator_matches_entity_boundary=False,
    district_zh="北仑区春晓街道", district_en="Chunxiao Subdistrict, Beilun District",
    site_scope_note_zh="按一个共址物理园区计数；不把园区内三家运营主体拆成三座工厂。",
    site_scope_note_en="Counted as one co-located physical campus; its three operating entities are not split into three plants.",
    support_fields=[
        "name_zh", "name_en", "operator_id", "operator_legal_name_zh",
        "operator_matches_entity_boundary", "city_id", "status", "facility_type",
        "district_zh", "district_en", "site_scope_note_zh", "site_scope_note_en",
    ],
)
supporting_facility_source(
    "minth-ningbo-chunxiao-campus", "english-operator",
    "https://www.minthgroup.com/ENG/upload/files/2026/4/e_00425ar-20260429.pdf",
    "敏实集团", "Minth Group", "敏实集团2025年年度报告", "Minth 2025 annual report",
    source_type="company_ir", support_fields=["operator_legal_name_en"],
)
supporting_facility_source(
    "minth-ningbo-chunxiao-campus", "address",
    "https://www-static.sf-express.com/uploads/24_7_c7ffe46d5f.pdf",
    "顺丰速运", "SF Express", "服务网点目录", "Service-site directory",
    source_type="company_site", support_fields=["address_zh", "address_en"],
    field_patch={
        "address_zh": "浙江省宁波市北仑区春晓观海路155号",
        "address_en": "No. 155 Guanhai Road, Chunxiao, Beilun District, Ningbo, Zhejiang",
    },
)
verified_facility(
    "huaxiang-group-xizhou-zhenan-campus", "华翔集团西周镇安路总部",
    "Huaxiang Group Xizhou Zhen'an Road Headquarters", "huaxiang", "ningbo",
    "https://disc.static.szse.cn/disc/disk01/finalpage/2016-12-20/3f75a238-20fd-450b-96e7-7d39af21a6e2.PDF",
    "深圳证券交易所", "Shenzhen Stock Exchange", "华翔集团相关交易披露",
    "Huaxiang Group transaction disclosure", source_type="regulator",
    fact_date="2016", facility_type="headquarters_campus", confidence=0.75,
    operator_legal_name_zh="华翔集团股份有限公司",
    operator_legal_name_en="Huaxiang Group Co., Ltd.",
    district_zh="象山县西周镇", district_en="Xizhou Town, Xiangshan County",
    address_zh="浙江省宁波市象山县西周镇镇安路104号",
    address_en="No. 104 Zhen'an Road, Xizhou Town, Xiangshan County, Ningbo, Zhejiang",
)
supporting_facility_source(
    "huaxiang-group-xizhou-zhenan-campus", "current-related-site",
    "https://www.cn-huazhong.com/index.php?act=list&case=archive&catid=39",
    "华众控股", "Huazhong In-Vehicle", "集团简介", "Group profile",
    support_fields=["status"],
    scope_zh="该关联公司官网仅用于交叉核对西周集团园区仍处于当前运营网络；不支持上市主体归属。",
    scope_en="This related-company page is used only to cross-check that the Xizhou group campus remains in the current operating network; it does not support issuer ownership.",
)

# These physical locations are real research leads, but the current evidence
# does not resolve their exact operating legal entity or current status. Keep
# them in the audit ledger rather than publishing a false direct-operator edge.
# The CATL Ningde page proves five place names/topology only; ZEEKR's own filing
# says the factories it uses are not owned by the former issuer represented by
# this row; the last first-party SAIC-GM page does not prove Shenyang's current
# post-conversion state.
WITHHELD_FACILITY_IDS = {
    "zeekr-ningbo",
    "saic-gm-shenyang",
    "catl-ningde", "catl-ningde-huxi", "catl-ningde-jiaocheng",
    "catl-ningde-fuding", "catl-ningde-z",
}
FACILITIES[:] = [
    facility for facility in FACILITIES
    if facility["id"] not in WITHHELD_FACILITY_IDS
]
for source_id, meta in list(FACILITY_SOURCE_META.items()):
    if meta["facility_id"] in WITHHELD_FACILITY_IDS:
        FACILITY_SOURCE_META.pop(source_id)


def role(city_id, entity_id, role_type, zh, en):
    return dict(
        id=f"{city_id}__{entity_id}__{role_type}",
        city_id=city_id, entity_id=entity_id, role_type=role_type,
        description_zh=zh, description_en=en,
        confidence=0.40, source_ids=[],
    )


ROLES = []
ROLE_TYPE_OVERRIDES = {
    # Wuling and Baojun are brand lineages in Liuzhou; the SGMW legal entity is
    # the operator of the city's physical plants.
    ("liuzhou", "wuling"): "historical_origin",
    ("liuzhou", "baojun"): "historical_origin",
}
ROLE_EXCLUSIONS = {
    # ZEEKR's filing does not identify this catalog brand as the operator of a
    # current Ningbo campus. Keep the research lead out of the public graph.
    ("ningbo", "zeekr"),
}
for city_id, ids in FEATURED.items():
    for eid in ids:
        if (city_id, eid) in ROLE_EXCLUSIONS:
            continue
        o = ORG_BY_ID.get(eid)
        if not o:
            continue
        rtype = "headquarters" if o.get("headquarters_city_id") == city_id else "factory"
        if o["organization_type"] == "university":
            rtype = "university_campus"
        elif o["organization_type"] == "media_company":
            rtype = "media_editorial_office"
        elif o["organization_type"] in ("testing_body", "research_institute"):
            rtype = "testing_center"
        elif o["organization_type"] in ("software_company", "chip_company") and o.get("headquarters_city_id") == city_id:
            rtype = "rd_center"
        elif o["organization_type"] in ("supplier", "battery_company") and o.get("headquarters_city_id") != city_id:
            rtype = "supplier_plant"
        rtype = ROLE_TYPE_OVERRIDES.get((city_id, eid), rtype)
        ROLES.append(role(city_id, eid, rtype, f"{o['display_name_zh']}在{city_id}的{rtype}角色", f"{o['display_name_en']} {rtype} role in {city_id}"))

# Extra BYD multi-city manufacturing roles
for cid in ("xian", "hefei", "zhengzhou", "changsha", "jinan", "changzhou"):
    if not any(r["city_id"] == cid and r["entity_id"] == "byd" for r in ROLES):
        ROLES.append(role(cid, "byd", "factory", "比亚迪整车制造基地", "BYD vehicle manufacturing base"))
if not any(r["city_id"] == "shenzhen" and r["entity_id"] == "byd" and r["role_type"] == "rd_center" for r in ROLES):
    ROLES.append(role("shenzhen", "byd", "rd_center", "南山与坪山研发集群", "Nanshan and Pingshan R&D cluster"))

CLUSTERS = [
    dict(id="yangtze-river-delta", name_zh="长三角汽车网络", name_en="Yangtze River Delta auto network",
         city_ids=["shanghai", "hangzhou", "jiaxing", "suzhou", "changzhou", "ningbo", "hefei", "wuhu"],
         summary_zh="上海总部与国际窗口；杭州民营整车总部（吉利/零跑/极氪）；嘉兴桐乡哪吒总部；常州电池与新能源整车；苏州宁波零部件；合肥芜湖整车。",
         summary_en="Shanghai HQ and international window; Hangzhou private OEM HQs (Geely/Leapmotor/Zeekr); Jiaxing Tongxiang Neta HQ; Changzhou batteries and NEVs; Suzhou/Ningbo parts; Hefei and Wuhu vehicles.",
         output_note_zh="国家发展改革委区域资料将上海软件芯片、常州动力电池和宁波整车制造作为协作案例。",
         output_note_en="NDRC regional materials cite Shanghai software/chips, Changzhou batteries and Ningbo vehicle manufacturing as a collaboration case."),
    dict(id="greater-bay-area", name_zh="粤港澳大湾区汽车网络", name_en="Greater Bay Area auto network",
         city_ids=["guangzhou", "shenzhen", "huizhou"],
         summary_zh="广州多品牌整车；深圳比亚迪总部、汽车电子和智能驾驶；惠州德赛西威、华阳和亿纬锂能。佛山、东莞将在二期补入。",
         summary_en="Guangzhou multi-brand plants; Shenzhen BYD HQ, electronics and autonomy; Huizhou Desay SV, HuaYang and EVE. Foshan and Dongguan join in phase 2.",
         output_note_zh="广州和深圳官方产业规划均将跨城市协作列为重要方向。",
         output_note_en="Guangzhou and Shenzhen official industry plans both treat cross-city collaboration as a priority."),
    dict(id="jingjinji", name_zh="京津冀汽车网络", name_en="Jing-Jin-Ji auto network",
         city_ids=["beijing", "tianjin", "baoding"],
         summary_zh="北京总部、算法、软件和创新平台；天津整车、检测标准和港口；保定长城总部和制造。廊坊等河北配套城市二期补入。",
         summary_en="Beijing HQ, algorithms, software and platforms; Tianjin vehicles, testing standards and port; Baoding GWM HQ and manufacturing. Langfang joins in phase 2.",
         output_note_zh="京津冀已形成以数小时运输半径组织的汽车供应链。",
         output_note_en="Jing-Jin-Ji already organises auto supply on a same-day trucking radius."),
    dict(id="chengyu", name_zh="成渝汽车网络", name_en="Chengdu–Chongqing auto network",
         city_ids=["chongqing", "chengdu", "yibin"],
         summary_zh="重庆与成都构成整车和零部件双中心，宜宾提供动力电池产业支持。",
         summary_en="Chongqing and Chengdu form a dual vehicle-and-parts centre; Yibin supplies power batteries.",
         output_note_zh="2024年成渝地区汽车产量约343万辆，新能源汽车约108.7万辆。",
         output_note_en="In 2024 the Chengdu–Chongqing region produced about 3.43 million vehicles, including about 1.087 million NEVs."),
    dict(id="hubei-axis", name_zh="湖北汽车轴线", name_en="Hubei auto axis",
         city_ids=["wuhan", "shiyan"],
         summary_zh="武汉侧重乘用车、新能源和智能网联；十堰侧重中重型商用车。襄阳、随州二期补入，适合做成东风历史专题。",
         summary_en="Wuhan: passenger cars, NEVs and intelligent connectivity; Shiyan: medium/heavy commercial vehicles. Xiangyang and Suizhou join in phase 2 as a Dongfeng history special.",
         output_note_zh=None, output_note_en=None),
    dict(id="hunan-axis", name_zh="湖南汽车轴线", name_en="Hunan auto axis",
         city_ids=["changsha"],
         summary_zh="长沙拥有比亚迪、广汽埃安和上汽大众。株洲新能源商用车和湘潭吉利体系二期补入。",
         summary_en="Changsha hosts BYD, GAC Aion and SAIC Volkswagen. Zhuzhou NEV commercial vehicles and Xiangtan's Geely system join in phase 2.",
         output_note_zh=None, output_note_en=None),
    dict(id="northeast", name_zh="东北一汽枢纽", name_en="Northeast FAW hub",
         city_ids=["changchun", "shenyang"],
         summary_zh="长春一汽总部与历史核心；沈阳华晨宝马总部与整车。两条东北乘用车主轴分开记账。",
         summary_en="Changchun is FAW HQ and historical core; Shenyang is BMW Brilliance HQ and plants. Two northeast passenger-car axes, booked separately.",
         output_note_zh=None, output_note_en=None),
    dict(id="central-plains", name_zh="中原客车与新能源", name_en="Central Plains coaches and NEVs",
         city_ids=["zhengzhou"],
         summary_zh="郑州同时承担比亚迪综合制造和宇通全球客车影响力。",
         summary_en="Zhengzhou hosts both BYD integrated manufacturing and Yutong's global coach role.",
         output_note_zh=None, output_note_en=None),
    dict(id="guangxi", name_zh="桂中车城", name_en="Central Guangxi auto city",
         city_ids=["liuzhou"],
         summary_zh="柳州以五菱、柳汽和本地汽车文化构成相对完整的地方车城。",
         summary_en="Liuzhou forms a relatively complete local auto city around Wuling, Dongfeng Liuzhou Motor and civic auto culture.",
         output_note_zh=None, output_note_en=None),
    dict(id="battery-corridor", name_zh="动力电池走廊", name_en="Power-battery corridor",
         city_ids=["ningde", "changzhou", "yibin", "hefei", "huizhou"],
         summary_zh="宁德总部、常州集聚、宜宾能源条件、合肥国轩与整车、惠州亿纬，用来说明电池城市不必拥有整车厂。",
         summary_en="CATL HQ, Changzhou agglomeration, Yibin energy conditions, Hefei Gotion plus vehicles, Huizhou EVE — battery cities need not host OEM plants.",
         output_note_zh=None, output_note_en=None),
    dict(id="northwest", name_zh="西北制造节点", name_en="Northwest manufacturing node",
         city_ids=["xian"],
         summary_zh="西安以比亚迪大规模制造进入全国产量第一梯队。",
         summary_en="Xi'an entered the national output first tier through BYD-scale manufacturing.",
         output_note_zh=None, output_note_en=None),
    dict(id="shandong", name_zh="山东商用车与新能源", name_en="Shandong commercial vehicles and NEVs",
         city_ids=["jinan"],
         summary_zh="济南以重汽商用车叠加比亚迪、吉利新能源整车。青岛一汽-大众/解放/奇瑞将在二期补入。",
         summary_en="Jinan stacks Sinotruk commercial vehicles with BYD and Geely NEV plants. Qingdao FAW-VW/Jiefang/Chery joins in phase 2.",
         output_note_zh=None, output_note_en=None),
    dict(id="fujian-bus", name_zh="福建客车", name_en="Fujian coaches",
         city_ids=["xiamen"],
         summary_zh="厦门金龙与金旅代表客车和新能源商用车出口路径。",
         summary_en="Xiamen King Long and Golden Dragon represent the coach and NEV-commercial export path.",
         output_note_zh=None, output_note_en=None),
]

for cluster in CLUSTERS:
    cluster["confidence"] = 0.40
    cluster["source_ids"] = []

ADJACENT = [
    ("yangtze-river-delta", [("shanghai", "suzhou"), ("suzhou", "changzhou"), ("changzhou", "ningbo"), ("shanghai", "hefei"), ("hefei", "wuhu"), ("shanghai", "hangzhou"), ("hangzhou", "ningbo"), ("hangzhou", "jiaxing"), ("jiaxing", "shanghai")]),
    ("greater-bay-area", [("guangzhou", "shenzhen"), ("shenzhen", "huizhou"), ("guangzhou", "huizhou")]),
    ("jingjinji", [("beijing", "tianjin"), ("beijing", "baoding"), ("tianjin", "baoding")]),
    ("chengyu", [("chongqing", "chengdu"), ("chengdu", "yibin"), ("chongqing", "yibin")]),
    ("hubei-axis", [("wuhan", "shiyan")]),
    ("northeast", [("changchun", "shenyang")]),
]


def rel(from_id, rtype, to_id, cluster_id=None, zh="", en=""):
    cid = cluster_id or ""
    return dict(
        id=f"{from_id}__{rtype}__{to_id}__{cid}",
        from_id=from_id, relation_type=rtype, to_id=to_id, cluster_id=cluster_id,
        description_zh=zh, description_en=en,
        confidence=0.40, source_ids=[],
    )


RELATIONS = []
for cl in CLUSTERS:
    for cid in cl["city_ids"]:
        RELATIONS.append(rel(cid, "belongs_to_cluster", cl["id"], cl["id"], "城市属于该产业集群", "City belongs to this cluster"))
for cl_id, pairs in ADJACENT:
    for a, b in pairs:
        RELATIONS.append(rel(a, "cluster_adjacent", b, cl_id, "产业集群相邻协作", "Adjacent collaboration inside the cluster"))
        RELATIONS.append(rel(b, "cluster_adjacent", a, cl_id, "产业集群相邻协作", "Adjacent collaboration inside the cluster"))
RELATIONS.append(rel("geely", "located_in", "hangzhou", None, "集团总部", "Group headquarters"))
RELATIONS.append(rel("byd", "located_in", "shenzhen", None, "集团总部", "Group headquarters"))
RELATIONS.append(rel("catl", "located_in", "ningde", None, "集团总部", "Group headquarters"))
RELATIONS.append(rel("faw", "historically_linked_to", "changchun", None, "一汽发源地", "FAW place of origin"))
RELATIONS.append(rel("dongfeng", "historically_linked_to", "shiyan", None, "二汽发源地", "Second Auto Works place of origin"))
for o in ORGS:
    pid = o.get("parent_id")
    if pid and pid in ORG_BY_ID:
        parent = ORG_BY_ID[pid]
        relation_type = "operates" if o["id"] in {"youjia", "che168"} else "owns"
        RELATIONS.append(rel(
            pid, relation_type, o["id"], None,
            f"{parent['display_name_zh']}运营{o['display_name_zh']}" if relation_type == "operates" else f"{parent['display_name_zh']}旗下{o['display_name_zh']}",
            f"{parent['display_name_en']} operates {o['display_name_en']}" if relation_type == "operates" else f"{parent['display_name_en']} owns {o['display_name_en']}",
        ))

def clique(ids, rtype, zh, en):
    present = [i for i in ids if i in ORG_BY_ID]
    for i, a in enumerate(present):
        for b in present[i + 1:]:
            RELATIONS.append(rel(a, rtype, b, None, zh, en))
            RELATIONS.append(rel(b, rtype, a, None, zh, en))

clique(
    ["autohome", "yiche", "dongchedi", "pcauto", "xcar", "cheshi", "youjia", "chexun"],
    "competes_with", "全国汽车垂直门户同赛道", "National consumer auto portals, same beat",
)
clique(
    ["sohu-auto", "sina-auto", "ifeng-auto", "tencent-auto", "netease-auto",
     "people-auto", "xinhua-auto", "cctv-auto", "thepaper-auto", "chinanews-auto"],
    "competes_with", "综合门户/通讯社汽车频道同赛道", "Portal and wire-service auto desks, same beat",
)
clique(
    ["yicai-auto", "nbd-auto", "21jingji-auto", "caixin-auto", "jiemian-auto", "eeo-auto"],
    "competes_with", "财经媒体汽车频道同赛道", "Business-paper auto desks, same beat",
)
clique(
    ["d1ev", "chedongxi", "diandong", "garage42", "xchuxing", "cheyun", "gaogong-ev", "yanzhi-auto"],
    "competes_with", "新能源/智能汽车垂直媒体同赛道", "NEV and intelligent-vehicle trade press, same beat",
)
clique(
    ["truck-home", "chinabuses", "chinaspv"],
    "competes_with", "商用车垂直媒体同赛道", "Commercial-vehicle trade media, same beat",
)
clique(
    ["china-auto-news", "auto-business-review", "gasgoo", "auto-zongheng"],
    "competes_with", "汽车行业报/产经媒体同赛道", "Official and B2B auto trade press, same beat",
)
clique(
    ["auto-fan", "motor-trend-china"],
    "competes_with", "汽车消费杂志同赛道", "Consumer auto magazines, same beat",
)
clique(
    ["luobo-report", "laosiji", "review-38", "li-laoshu", "speedsters", "dajia-cheyan",
     "xincheping", "tichebang", "yan-chuang", "che-ruo-chujian", "doudouche",
     "y-car-review", "dabiaoche", "cidi-wuyin"],
    "competes_with", "全国汽车评测视频KOL同赛道", "National auto review-video KOLs, same beat",
)
RELATIONS.append(rel("xincheping", "historically_linked_to", "dajia-cheyan", None,
                     "颜宇鹏等从新车评独立创办大家车言论", "YYP and others left Xincheping to found Dajia Cars Talk"))
RELATIONS.append(rel("dajia-cheyan", "historically_linked_to", "xincheping", None,
                     "大家车言论源自新车评主创团队", "Dajia Cars Talk spun out of the Xincheping founding team"))
for kid, parent, zh, en in (
    ("luobo-report", "autohome", "陈震团队出自汽车之家", "Chen Zhen's team came out of Autohome"),
    ("laosiji", "autohome", "韩路团队出自汽车之家", "Han Lu's studio came out of Autohome"),
    ("yan-chuang", "autohome", "闫闯说车由汽车之家孵化", "Yan Chuang's show was incubated at Autohome"),
    ("doudouche", "autohome", "逗斗车主创出自汽车之家", "Doudouche founders came out of Autohome"),
    ("che-ruo-chujian", "yiche", "车若初见与易车资本/分发协作", "Che Ruo Chujian is linked to Yiche capital and distribution"),
):
    RELATIONS.append(rel(kid, "historically_linked_to", parent, None, zh, en))
    RELATIONS.append(rel(parent, "historically_linked_to", kid, None, zh, en))
RELATIONS.append(rel("cheshi", "historically_linked_to", "xcar", None,
                     "曾同属CBSi在华汽车垂直资产", "Former CBSi China auto vertical assets"))
RELATIONS.append(rel("xcar", "historically_linked_to", "cheshi", None,
                     "曾同属CBSi在华汽车垂直资产", "Former CBSi China auto vertical assets"))
RELATIONS.append(rel("caam", "researches_with", "china-auto-news", None,
                     "行业协会与行业报协作", "Industry association collaborates with the trade newspaper"))
RELATIONS.append(rel("china-auto-news", "researches_with", "caam", None,
                     "行业报与中汽协协作", "Trade newspaper collaborates with CAAM"))
RELATIONS.append(rel("sae-china", "researches_with", "auto-fan", None,
                     "学会与《汽车之友》办刊协作", "SAE-China collaborates with Auto Fan"))
RELATIONS.append(rel("auto-fan", "researches_with", "sae-china", None,
                     "《汽车之友》与中汽学会办刊协作", "Auto Fan collaborates with SAE-China"))

RELATION_EVIDENCE = {
    ("autohome", "operates", "che168"): SRC_AUTOHOME_20F,
    ("baidu", "operates", "youjia"): SRC_BAIDU_YOUJIA_PRIVACY,
    ("caam", "owns", "auto-zongheng"): SRC_CAAM_AUTO_ZONGHENG,
}
for relation in RELATIONS:
    key = (relation["from_id"], relation["relation_type"], relation["to_id"])
    if key in RELATION_EVIDENCE:
        relation["source_ids"] = [RELATION_EVIDENCE[key]]
        relation["confidence"] = 0.85

STATS = []
OUTPUT_2025 = {
    "chongqing": 2787700, "guangzhou": 2409600, "wuhu": 1801000,
    "shanghai": 1772000, "xian": 1482700, "beijing": 1467100,
    "zhengzhou": 1205000, "wuhan": 811000, "shiyan": 240307,
}
NEV_2025 = {
    "chongqing": 1296100, "guangzhou": 661900, "hefei": 1371000, "wuhu": 411000, "xian": 1051400,
    "shanghai": 1161100, "beijing": 699000, "wuhan": 520000, "shiyan": 51560,
}
STAT_SOURCE_BY_CITY = {
    "chongqing": SRC_STAT_CHONGQING_2025,
    "guangzhou": SRC_STAT_GUANGZHOU_2025,
    "wuhu": SRC_STAT_WUHU_2025,
    "shanghai": SRC_STAT_SHANGHAI_2025,
    "xian": SRC_STAT_XIAN_2025,
    "beijing": SRC_STAT_BEIJING_2025,
    "zhengzhou": SRC_STAT_ZHENGZHOU_2025,
    "wuhan": SRC_STAT_WUHAN_2025,
    "shiyan": SRC_STAT_SHIYAN_2025,
}
STAT_EXTRA_SOURCE_BY_CITY = {
    # Extra pages may support one subfield or document a scope mismatch. A row
    # remains verified only when STAT_SOURCE_BY_CITY has a city-level total.
    "guangzhou": SRC_STAT_GUANGZHOU_NEV_2025,
    "shanghai": SRC_STAT_SHANGHAI_NEV_2025,
    "beijing": SRC_STAT_BEIJING_NEV_2025,
    "wuhan": SRC_STAT_WUHAN_NEV_2025,
    "hefei": SRC_STAT_HEFEI_NEV_2025,
}


def reviewed_city_decisions() -> dict[str, dict]:
    path = ROOT / "tools" / "reviewed_entity_audit_2026_09.json"
    if not path.is_file():
        return {}
    blob = json.loads(path.read_text(encoding="utf-8"))
    return {row["id"]: row.get("fields") or {} for row in blob.get("cities") or []}


def reviewed_organization_decisions() -> dict[str, dict]:
    path = ROOT / "tools" / "reviewed_entity_audit_2026_09.json"
    if not path.is_file():
        return {}
    blob = json.loads(path.read_text(encoding="utf-8"))
    return {row["id"]: row.get("fields") or {} for row in blob.get("organizations") or []}


def reviewed_founded_year(decision: dict | None) -> int | None:
    if not isinstance(decision, dict) or decision.get("status") != "verified":
        return None
    value = decision.get("value")
    if isinstance(value, int) and not isinstance(value, bool):
        return value
    if isinstance(value, str):
        match = re.search(r"(?:18|19|20)\d{2}", value)
        if match:
            return int(match.group(0))
    if isinstance(value, dict):
        # Prefer the date that matches the audited row boundary.  For example,
        # JAC's 1999 issuer incorporation outranks its 1964 institutional
        # lineage, while CAERI deliberately displays its 1965 lineage anchor.
        for key in (
            "incorporated", "legal_entity_established", "issuer_incorporated",
            "current_group_established", "brand_launch_date", "date",
            "institutional_origin", "current_joint_stock_company",
        ):
            match = re.search(r"(?:18|19|20)\d{2}", str(value.get(key) or ""))
            if match:
                return int(match.group(0))
        for key in (
            "year", "approximate_year", "legal_entity_established_year",
            "joint_stock_company_established_year", "legal_company_created_year",
            "brand_launch_year", "institutional_origin_year",
            "earliest_lineage_year", "academy_lineage_year",
            "brand_reorganization_year",
        ):
            candidate = value.get(key)
            if isinstance(candidate, int) and not isinstance(candidate, bool):
                return candidate
    return None


def reviewed_city_number(decision: dict | None) -> int | None:
    """Read the supported integer from heterogeneous research receipts."""
    if not isinstance(decision, dict):
        return None
    value = decision.get("value")
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return int(value)
    if isinstance(value, dict):
        for key in ("count", "vehicles", "units", "value", "output", "total"):
            candidate = value.get(key)
            if isinstance(candidate, (int, float)) and not isinstance(candidate, bool):
                return int(candidate)
    return None


def compact_city_review(decision: dict | None) -> dict:
    decision = decision if isinstance(decision, dict) else {}
    source = next(
        (
            item for item in decision.get("sources") or []
            if str(item.get("url") or "").startswith(("http://", "https://"))
        ),
        {},
    )
    return {
        "status": decision.get("status") or "unverified",
        "scope": decision.get("scope"),
        "as_of": decision.get("as_of"),
        "note_zh": decision.get("note_zh") or "",
        "note_en": decision.get("note_en") or "",
        "caveat_zh": decision.get("caveat_zh") or "",
        "caveat_en": decision.get("caveat_en") or "",
        "source_url": source.get("url"),
        "source_title": source.get("title"),
        "source_publisher": source.get("publisher"),
        "source_date": source.get("published_or_fact_date"),
        "source_accessed_at": source.get("accessed_at"),
    }


_CITY_AUDIT = reviewed_city_decisions()
_ORG_AUDIT = reviewed_organization_decisions()
# Only an explicitly reviewed, directly reported partial may retain a public
# number. Derived or mixed-boundary partials stay in the audit receipt as null
# on the city card so they cannot enter rankings or look like city totals.
CITY_PARTIAL_PUBLIC_VALUES = {("hefei", "nev_output")}
for city in CITIES:
    cid = city["id"]
    source_id = STAT_SOURCE_BY_CITY.get(cid)
    context_source_id = STAT_EXTRA_SOURCE_BY_CITY.get(cid)
    audited = _CITY_AUDIT.get(cid) or {}
    total_review = audited.get("total_vehicle_output")
    nev_review = audited.get("nev_output")
    total_status = (
        total_review.get("status") if isinstance(total_review, dict) else
        "verified" if source_id and cid in OUTPUT_2025 else "unverified"
    )
    nev_status = (
        nev_review.get("status") if isinstance(nev_review, dict) else
        "verified" if cid in NEV_2025 and (source_id or context_source_id) else "unverified"
    )
    total = reviewed_city_number(total_review) if (
        total_status == "verified" or (cid, "total_vehicle_output") in CITY_PARTIAL_PUBLIC_VALUES
    ) else None
    nev = reviewed_city_number(nev_review) if (
        nev_status == "verified" or (cid, "nev_output") in CITY_PARTIAL_PUBLIC_VALUES
    ) else None
    if total is None and not total_review and total_status == "verified":
        total = OUTPUT_2025.get(cid)
    if nev is None and not nev_review and nev_status == "verified":
        nev = NEV_2025.get(cid)
    total_verified = total_status == "verified" and total is not None
    STATS.append(dict(
        city_id=cid, year=2025, total_vehicle_output=total,
        nev_output=nev, commercial_vehicle_output=None, passenger_vehicle_output=None,
        availability={"total_vehicle_output": total_status, "nev_output": nev_status},
        field_reviews={
            "total_vehicle_output": compact_city_review(total_review),
            "nev_output": compact_city_review(nev_review),
        },
        statistical_scope="reviewed_official_city_output" if total_verified else "reviewed_no_verified_total",
        scope_note_zh="逐字段核对2025年城市官方统计口径；只有已核实的城市总产量进入排序，未披露、口径不符或未核实项保留为空。各城市口径不构成国家统一排行。",
        scope_note_en="Each 2025 city-output field is reviewed against official city statistics. Only verified total output enters the ranking; undisclosed, scope-mismatched or unverified fields stay empty. City scopes do not form a unified national ranking.",
        source_ids=srcs(source_id, context_source_id),
        confidence=0.80 if total_verified else CANDIDATE_CONFIDENCE,
    ))
# Qingdao is not in the V1 city-card set and is not promoted from an internal compilation.

MEDIA_EXTRA = {
    "autohome": dict(media_type="portal", founded_year=2005, confidence=0.8),
    "gasgoo": dict(media_type="trade_media", confidence=0.75),
    "garage42": dict(media_type="nev_media", confidence=0.7),
    "xchuxing": dict(media_type="nev_media", confidence=0.72),
    "pcauto": dict(media_type="portal", confidence=0.75),
    "yiche": dict(media_type="portal", founded_year=2000, confidence=0.8),
    "dongchedi": dict(media_type="portal", confidence=0.78),
    "xcar": dict(media_type="portal", confidence=0.76),
    "youjia": dict(media_type="portal", confidence=0.74),
    "cheshi": dict(media_type="portal", confidence=0.72),
    "sohu-auto": dict(media_type="portal", confidence=0.74),
    "sina-auto": dict(media_type="portal", confidence=0.74),
    "ifeng-auto": dict(media_type="portal", confidence=0.72),
    "tencent-auto": dict(media_type="portal", confidence=0.74),
    "netease-auto": dict(media_type="portal", confidence=0.74),
    "d1ev": dict(media_type="nev_media", confidence=0.76),
    "chedongxi": dict(media_type="nev_media", confidence=0.74),
    "diandong": dict(media_type="nev_media", confidence=0.72),
    "china-auto-news": dict(media_type="trade_media", confidence=0.8),
    "auto-business-review": dict(media_type="trade_media", confidence=0.74),
    "auto-fan": dict(media_type="auto_culture", confidence=0.72),
    "nbd-auto": dict(media_type="business_media", confidence=0.74),
    "yicai-auto": dict(media_type="business_media", confidence=0.74),
    "chexun": dict(media_type="portal", confidence=0.72),
    "che168": dict(media_type="portal", founded_year=2004, confidence=0.8),
    "people-auto": dict(media_type="portal", confidence=0.8),
    "xinhua-auto": dict(media_type="portal", confidence=0.82),
    "cctv-auto": dict(media_type="portal", confidence=0.8),
    "thepaper-auto": dict(media_type="portal", confidence=0.76),
    "chinanews-auto": dict(media_type="portal", confidence=0.74),
    "21jingji-auto": dict(media_type="business_media", confidence=0.82),
    "caixin-auto": dict(media_type="business_media", confidence=0.8),
    "jiemian-auto": dict(media_type="business_media", confidence=0.78),
    "eeo-auto": dict(media_type="business_media", confidence=0.76),
    "cheyun": dict(media_type="nev_media", confidence=0.74),
    "gaogong-ev": dict(media_type="nev_media", confidence=0.78),
    "yanzhi-auto": dict(media_type="nev_media", confidence=0.72),
    "auto-zongheng": dict(media_type="trade_media", confidence=0.84),
    "motor-trend-china": dict(media_type="auto_culture", confidence=0.76),
    "truck-home": dict(media_type="trade_media", founded_year=2008, confidence=0.85),
    "chinabuses": dict(media_type="trade_media", confidence=0.8),
    "chinaspv": dict(media_type="trade_media", confidence=0.76),
    "luobo-report": dict(media_type="review_video", founded_year=2014, confidence=0.84),
    "laosiji": dict(media_type="review_video", confidence=0.84),
    "review-38": dict(media_type="review_video", confidence=0.8),
    "li-laoshu": dict(media_type="review_video", confidence=0.82),
    "speedsters": dict(media_type="review_video", confidence=0.82),
    "dajia-cheyan": dict(media_type="review_video", confidence=0.82),
    "xincheping": dict(media_type="review_video", founded_year=2006, confidence=0.8),
    "tichebang": dict(media_type="review_video", confidence=0.78),
    "yan-chuang": dict(media_type="review_video", confidence=0.8),
    "che-ruo-chujian": dict(media_type="review_video", confidence=0.78),
    "doudouche": dict(media_type="review_video", confidence=0.78),
    "y-car-review": dict(media_type="review_video", confidence=0.75),
    "dabiaoche": dict(media_type="review_video", confidence=0.76),
    "cidi-wuyin": dict(media_type="review_video", confidence=0.76),
}

MEDIA = []
for _o in ORGS:
    if _o["organization_type"] != "media_company":
        continue
    if _o["id"] not in MEDIA_EXTRA:
        raise SystemExit(f"media org {_o['id']} missing MEDIA_EXTRA")
    _x = MEDIA_EXTRA[_o["id"]]
    _city = _o.get("headquarters_city_id")
    MEDIA.append(dict(
        id=f"media-{_o['id']}", organization_id=_o["id"],
        media_name_zh=_o["display_name_zh"], media_name_en=_o["display_name_en"],
        media_type=_x["media_type"],
        operating_company_zh=_o["legal_name_zh"], operating_company_en=_o["legal_name_en"],
        registered_city_id=_city, editorial_city_id=_city,
        founded_year=_x.get("founded_year"),
        focus_tags=[_x["media_type"]], website=_o.get("website"), status="active",
        last_verified=LV, confidence=CANDIDATE_CONFIDENCE, source_ids=[],
        national_platform=True,
    ))

INSTITUTIONS = [
    dict(id="inst-tsinghua", organization_id="tsinghua", school_zh="清华大学", school_en="Tsinghua University",
         city_id="beijing", college_zh="车辆与运载学院", college_en="School of Vehicle and Mobility",
         strengths_zh="新能源、智能驾驶、跨学科研究", strengths_en="NEV, autonomous driving, cross-disciplinary research",
         industry_partners=[], last_verified=LV, source_ids=[]),
    dict(id="inst-bit", organization_id="bit", school_zh="北京理工大学", school_en="Beijing Institute of Technology",
         city_id="beijing", college_zh="机械与车辆学院", college_en="School of Mechanical Engineering",
         strengths_zh="车辆工程与军工车辆传统", strengths_en="Vehicle engineering and defence-vehicle tradition",
         industry_partners=[], last_verified=LV, source_ids=[]),
    dict(id="inst-tongji", organization_id="tongji", school_zh="同济大学", school_en="Tongji University",
         city_id="shanghai", college_zh="汽车与能源学院", college_en="School of Automotive and Energy Engineering",
         strengths_zh="汽车工程、测试与国际合作", strengths_en="Automotive engineering, testing and international cooperation",
         industry_partners=["saic"], last_verified=LV, source_ids=[]),
    dict(id="inst-sjtu", organization_id="sjtu", school_zh="上海交通大学", school_en="Shanghai Jiao Tong University",
         city_id="shanghai", college_zh="汽车动力与智能控制相关研究机构", college_en="Automotive power and intelligent-control labs",
         strengths_zh="动力系统与控制", strengths_en="Powertrain and control",
         industry_partners=[], last_verified=LV, source_ids=[]),
    dict(id="inst-jlu", organization_id="jlu", school_zh="吉林大学", school_en="Jilin University",
         city_id="changchun", college_zh="汽车工程学院", college_en="College of Automotive Engineering",
         strengths_zh="传统车辆工程积累深厚", strengths_en="Deep traditional vehicle-engineering stock",
         industry_partners=["faw"], last_verified=LV, source_ids=[]),
    dict(id="inst-whut", organization_id="whut", school_zh="武汉理工大学", school_en="Wuhan University of Technology",
         city_id="wuhan", college_zh="汽车工程学院", college_en="School of Automotive Engineering",
         strengths_zh="传统车辆工程", strengths_en="Traditional vehicle engineering",
         industry_partners=["dongfeng"], last_verified=LV, source_ids=[]),
    dict(id="inst-hfut", organization_id="hfut", school_zh="合肥工业大学", school_en="Hefei University of Technology",
         city_id="hefei", college_zh="汽车与交通工程学院", college_en="School of Automotive and Transportation Engineering",
         strengths_zh="传统车辆工程", strengths_en="Traditional vehicle engineering",
         industry_partners=["jac"], last_verified=LV, source_ids=[]),
    dict(id="inst-chd", organization_id="changan-univ", school_zh="长安大学", school_en="Chang'an University",
         city_id="xian", college_zh="汽车学院", college_en="School of Automobile",
         strengths_zh="传统车辆工程", strengths_en="Traditional vehicle engineering",
         industry_partners=[], last_verified=LV, source_ids=[]),
    dict(id="inst-hnu", organization_id="hnu", school_zh="湖南大学", school_en="Hunan University",
         city_id="changsha", college_zh="车辆工程及智能汽车研究", college_en="Vehicle engineering and intelligent-vehicle research",
         strengths_zh="车辆工程与智能汽车", strengths_en="Vehicle engineering and intelligent vehicles",
         industry_partners=[], last_verified=LV, source_ids=[]),
    dict(id="inst-scut", organization_id="scut", school_zh="华南理工大学", school_en="South China University of Technology",
         city_id="guangzhou", college_zh="车辆工程相关院系", college_en="Vehicle-engineering departments",
         strengths_zh="车辆工程", strengths_en="Vehicle engineering",
         industry_partners=["gac"], last_verified=LV, source_ids=[]),
    dict(id="inst-cqu", organization_id="cqu", school_zh="重庆大学", school_en="Chongqing University",
         city_id="chongqing", college_zh="车辆工程相关学院", college_en="Vehicle-engineering schools",
         strengths_zh="车辆工程", strengths_en="Vehicle engineering",
         industry_partners=["changan"], last_verified=LV, source_ids=[]),
    dict(id="inst-cqut", organization_id="cqut", school_zh="重庆理工大学", school_en="Chongqing University of Technology",
         city_id="chongqing", college_zh="车辆工程相关学院", college_en="Vehicle-engineering schools",
         strengths_zh="车辆工程", strengths_en="Vehicle engineering",
         industry_partners=["changan"], last_verified=LV, source_ids=[]),
]

INSTITUTION_EVIDENCE = {
    "inst-tsinghua": SRC_THSVM,
    "inst-bit": SRC_BIT_ME,
    "inst-tongji": SRC_TONGJI_AUTO,
    "inst-jlu": SRC_JLU_AUTO,
    "inst-hfut": SRC_HFUT_AUTO,
    "inst-chd": SRC_CHD_AUTO,
}
for institution in INSTITUTIONS:
    source_id = INSTITUTION_EVIDENCE.get(institution["id"])
    # Identity pages do not prove the legacy partnership leads, so a record
    # carrying those raw candidates never crosses the verified threshold.
    institution["confidence"] = 0.50 if source_id else 0.40
    institution["source_ids"] = [source_id] if source_id else []

SOURCES = [
    dict(
        id=SRC_STAT_CHONGQING_2025,
        publisher_zh="重庆市统计局、国家统计局重庆调查总队",
        publisher_en="Chongqing Municipal Bureau of Statistics and NBS Chongqing Survey Office",
        title_zh="2025年重庆市国民经济和社会发展统计公报",
        title_en="2025 Chongqing statistical communiqué",
        source_type="government_stats", grade="A", published_at="2026-03-26",
        accessed_at="2026-08-24", fact_date="2025",
        url="https://tjj.cq.gov.cn/zwgk_233/fdzdgknr/tjxx/sjjd_55469/202603/t20260326_15568538_wap.html",
        confidence=0.95,
        notes_zh="表3直接列出汽车278.77万辆、新能源汽车129.61万辆，口径为规模以上工业主要产品。",
        notes_en="Table 3 directly reports 2.7877M vehicles and 1.2961M NEVs as major above-scale industrial products.",
    ),
    dict(
        id=SRC_STAT_GUANGZHOU_2025,
        publisher_zh="广州市统计局、国家统计局广州调查队",
        publisher_en="Guangzhou Municipal Bureau of Statistics and NBS Guangzhou Survey Office",
        title_zh="2025年广州市国民经济和社会发展统计公报",
        title_en="2025 Guangzhou statistical communiqué",
        source_type="government_stats", grade="A", published_at="2026-05-10",
        accessed_at="2026-08-24", fact_date="2025",
        url="https://tjj.gz.gov.cn/stats_newtjyw/tjsj/tjgb/qstjgb/content/post_10800227.html",
        confidence=0.95,
        notes_zh="规模以上主要工业产品表列出汽车240.96万辆；城市口径不可与其他发布口径无条件混排。",
        notes_en="The major above-scale industrial-products table reports 2.4096M vehicles; its city scope is not automatically comparable with other releases.",
    ),
    dict(
        id=SRC_STAT_GUANGZHOU_NEV_2025,
        publisher_zh="广州市统计局",
        publisher_en="Guangzhou Municipal Bureau of Statistics",
        title_zh="基本盘活力彰显 实力盘潜能释放——2025年广州经济运行解读",
        title_en="Interpretation of Guangzhou's economic performance in 2025",
        source_type="government_stats", grade="A", published_at="2026-01-30",
        accessed_at="2026-09-03", fact_date="2025",
        url="https://tjj.gz.gov.cn/stats_newtjyw/sjjd/content/mpost_10669183.html",
        confidence=0.95,
        notes_zh="广州市统计局直接披露2025年新能源汽车产量66.19万辆，同比增长21.6%，占汽车产量27.5%。",
        notes_en="Guangzhou Statistics directly reports 661,900 NEVs in 2025, up 21.6% and equal to 27.5% of vehicle output.",
    ),
    dict(
        id=SRC_STAT_WUHU_2025,
        publisher_zh="芜湖市统计局、国家统计局芜湖调查队",
        publisher_en="Wuhu Municipal Bureau of Statistics and NBS Wuhu Survey Office",
        title_zh="芜湖市2025年国民经济和社会发展统计公报",
        title_en="2025 Wuhu statistical communiqué",
        source_type="government_stats", grade="A", published_at="2026-07",
        accessed_at="2026-08-24", fact_date="2025",
        url="https://www.wuhu.gov.cn/mlwh/tjgb/41219509.html",
        confidence=0.95,
        notes_zh="主要工业产品表直接列出汽车180.1万辆、新能源汽车41.1万辆；据此纠正早期候选值183万辆。",
        notes_en="The industrial-products table directly reports 1.801M vehicles and 0.411M NEVs, correcting the earlier 1.83M candidate value.",
    ),
    dict(
        id=SRC_STAT_SHANGHAI_2025,
        publisher_zh="上海市统计局、国家统计局上海调查总队",
        publisher_en="Shanghai Municipal Bureau of Statistics and NBS Shanghai Survey Office",
        title_zh="2025年上海市国民经济和社会发展统计公报",
        title_en="2025 Shanghai statistical communiqué",
        source_type="government_stats", grade="A", published_at="2026-03-30",
        accessed_at="2026-08-24", fact_date="2025",
        url="https://tjj.sh.gov.cn/tjgb/20260330/e0772941e8e041eaaad2df850b44ef98.html",
        confidence=0.95,
        notes_zh="主要工业产品表列出汽车177.20万辆，按上海市公报口径记录。",
        notes_en="The major-industrial-products table reports 1.7720M vehicles under the Shanghai communiqué's scope.",
    ),
    dict(
        id=SRC_STAT_SHANGHAI_NEV_2025,
        publisher_zh="上海市统计局",
        publisher_en="Shanghai Municipal Bureau of Statistics",
        title_zh="2025年12月规模以上工业主要产品产量",
        title_en="December 2025 output of major above-scale industrial products",
        source_type="government_stats", grade="A", published_at="2026-01-14",
        accessed_at="2026-09-03", fact_date="2025",
        url="https://tjj.sh.gov.cn/ydsj36/20260114/345bd5c71dd04c9294a8a996309369c7.html",
        confidence=0.95,
        notes_zh="官方附表1—12月栏直接列出汽车177.20万辆，其中新能源汽车116.11万辆；统计范围为规模以上工业企业。",
        notes_en="The official workbook's January–December column directly reports 1.7720M vehicles, including 1.1611M NEVs; scope is above-scale industrial enterprises.",
    ),
    dict(
        id=SRC_STAT_XIAN_2025,
        publisher_zh="西安市统计局、国家统计局西安调查队",
        publisher_en="Xi'an Municipal Bureau of Statistics and NBS Xi'an Survey Office",
        title_zh="西安市2025年国民经济和社会发展统计公报",
        title_en="2025 Xi'an statistical communiqué",
        source_type="government_stats", grade="A", published_at="2026-05-15",
        accessed_at="2026-08-24", fact_date="2025",
        url="https://tjj.xa.gov.cn/web_files/tjj/file/2026/05/15/202605151000219859531.pdf",
        confidence=0.95,
        notes_zh="表2直接列出汽车148.27万辆、新能源汽车105.14万辆，口径为规模以上工业主要产品。",
        notes_en="Table 2 directly reports 1.4827M vehicles and 1.0514M NEVs as major above-scale industrial products.",
    ),
    dict(
        id=SRC_STAT_BEIJING_2025,
        publisher_zh="北京市统计局、国家统计局北京调查总队",
        publisher_en="Beijing Municipal Bureau of Statistics and NBS Beijing Survey Office",
        title_zh="北京市2025年国民经济和社会发展统计公报",
        title_en="2025 Beijing statistical communiqué",
        source_type="government_stats", grade="A", published_at="2026-03-26",
        accessed_at="2026-08-24", fact_date="2025",
        url="https://tjj.beijing.gov.cn/tjsj_31433/tjgb_31445/ndgb_31446/202603/t20260326_4566469.html",
        confidence=0.95,
        notes_zh="规模以上主要工业产品表列出汽车146.71万辆，按北京市公报口径记录。",
        notes_en="The major above-scale industrial-products table reports 1.4671M vehicles under the Beijing communiqué's scope.",
    ),
    dict(
        id=SRC_STAT_BEIJING_NEV_2025,
        publisher_zh="北京市统计局",
        publisher_en="Beijing Municipal Bureau of Statistics",
        title_zh="工业经济量质齐升 产业结构向新向优——2025年北京规模以上工业运行情况解读",
        title_en="Beijing above-scale industrial performance in 2025",
        source_type="government_stats", grade="A", published_at="2026-01-21",
        accessed_at="2026-09-03", fact_date="2025",
        url="https://tjj.beijing.gov.cn/zxfbu/202601/t20260121_4451731.html",
        confidence=0.95,
        notes_zh="北京市统计局直接列出2025年新能源汽车产量69.9万辆，占全市汽车产量47.7%。",
        notes_en="Beijing Statistics directly reports 699,000 NEVs in 2025, or 47.7% of municipal vehicle output.",
    ),
    dict(
        id=SRC_STAT_ZHENGZHOU_2025,
        publisher_zh="郑州市统计局、国家统计局郑州调查队",
        publisher_en="Zhengzhou Municipal Bureau of Statistics and NBS Zhengzhou Survey Office",
        title_zh="2025年郑州市国民经济和社会发展统计公报",
        title_en="2025 Zhengzhou statistical communiqué",
        source_type="government_stats", grade="A", published_at="2026-04-24",
        accessed_at="2026-08-24", fact_date="2025",
        url="https://tjj.zhengzhou.gov.cn/tjgb/10017864.jhtml",
        confidence=0.95,
        notes_zh="公报直接列出汽车120.5万辆、同比增长9.6%。",
        notes_en="The communiqué directly reports 1.205M vehicles, up 9.6% year over year.",
    ),
    dict(
        id=SRC_STAT_WUHAN_2025,
        publisher_zh="武汉市统计局、国家统计局武汉调查队",
        publisher_en="Wuhan Municipal Bureau of Statistics and NBS Wuhan Survey Office",
        title_zh="2025年武汉市国民经济和社会发展统计公报",
        title_en="2025 Wuhan statistical communiqué",
        source_type="government_stats", grade="A", published_at="2026-04-09",
        accessed_at="2026-09-03", fact_date="2025",
        url="https://tjj.wuhan.gov.cn/tjfw/tjgb/202604/t20260408_2750693.shtml",
        confidence=0.95,
        notes_zh="表1直接列出规模以上工业汽车产量81.10万辆。",
        notes_en="Table 1 directly reports 811,000 vehicles as above-scale industrial output.",
    ),
    dict(
        id=SRC_STAT_WUHAN_NEV_2025,
        publisher_zh="武汉市经济和信息化局",
        publisher_en="Wuhan Municipal Bureau of Economy and Information Technology",
        title_zh="武汉市2025年新能源汽车产量公开信息",
        title_en="Wuhan 2025 NEV output disclosure",
        source_type="government_stats", grade="A", published_at="2026-01-22",
        accessed_at="2026-09-03", fact_date="2025",
        url="https://jxj.wuhan.gov.cn/xwzx_9/tztg/202601/t20260122_2715936.html",
        confidence=0.95,
        notes_zh="市经信局页面直接列出2025年新能源汽车产量52万辆。",
        notes_en="The municipal industry bureau directly reports 520,000 NEVs in 2025.",
    ),
    dict(
        id=SRC_STAT_SHIYAN_2025,
        publisher_zh="湖北省统计局（十堰市统计公报）",
        publisher_en="Hubei Provincial Bureau of Statistics (Shiyan communiqué)",
        title_zh="十堰市2025年国民经济和社会发展统计公报",
        title_en="2025 Shiyan statistical communiqué",
        source_type="government_stats", grade="A", published_at="2026-05-06",
        accessed_at="2026-09-03", fact_date="2025",
        url="https://tjj.hubei.gov.cn/tjsj/tjgb/ndtjgb/sztjgb/202605/P020260508379027628693.pdf",
        confidence=0.95,
        notes_zh="主要工业产品表直接列出汽车240307辆，其中新能源汽车51560辆。",
        notes_en="The major-product table directly reports 240,307 vehicles, including 51,560 NEVs.",
    ),
    dict(
        id=SRC_STAT_HEFEI_NEV_2025,
        publisher_zh="合肥市政务网站", publisher_en="Hefei government website",
        title_zh="合肥新能源汽车产量信息", title_en="Hefei NEV output information",
        source_type="government_stats", grade="A", published_at=None,
        accessed_at="2026-08-24", fact_date="2025",
        url="https://www.hfyaohai.gov.cn/zwdt/bmts/11485597.html", confidence=0.90,
        notes_zh="页面支持2025年新能源汽车137.1万辆，不支持整车总量187.2万辆；因此合肥统计行仍为候选。",
        notes_en="The page supports 1.371M NEVs in 2025, not the 1.872M total-vehicle figure; the Hefei statistics row therefore remains candidate.",
    ),
    dict(
        id=SRC_NIO_ABOUT,
        publisher_zh="蔚来", publisher_en="NIO",
        title_zh="关于蔚来", title_en="About NIO",
        source_type="company_site", grade="A", published_at=None,
        accessed_at="2026-08-24", fact_date="2025",
        url="https://www.nio.com/about/2025", confidence=0.95,
        notes_zh="页面明确区分上海全球总部与合肥蔚来中国总部、制造中心；本图谱据此把集团总部记为上海，并保留合肥制造设施。",
        notes_en="The page distinguishes the global headquarters in Shanghai from NIO China headquarters and the manufacturing centre in Hefei; the atlas therefore records the group HQ in Shanghai and keeps the Hefei plant.",
    ),
    dict(
        id=SRC_AUTOHOME_20F,
        publisher_zh="汽车之家", publisher_en="Autohome Inc.",
        title_zh="2025 年年度报告（Form 20-F）", title_en="2025 annual report (Form 20-F)",
        source_type="company_ir", grade="A", published_at=None,
        accessed_at="2026-08-24", fact_date="2025",
        url="https://www.sec.gov/Archives/edgar/data/1527636/000119312526155932/athm-20251231.htm", confidence=0.95,
        notes_zh="公司申报文件说明其通过 autohome.com.cn 与 che168.com 提供服务；关系采用“运营”，不推断 Che168 是独立股权主体。",
        notes_en="The filing says the company serves users through autohome.com.cn and che168.com; the relation is modelled as operates, without inferring that Che168 is a separate equity entity.",
    ),
    dict(
        id=SRC_BAIDU_YOUJIA_PRIVACY,
        publisher_zh="百度有驾", publisher_en="Baidu Youjia",
        title_zh="有驾隐私政策", title_en="Youjia privacy policy",
        source_type="company_site", grade="A", published_at=None,
        accessed_at="2026-08-24", fact_date=None,
        url="https://youjia.baidu.com/pages/my/privacy", confidence=0.95,
        notes_zh="法律披露列出北京百度网讯科技有限公司及百度关联方为运营主体；关系采用“运营”而非股权“拥有”。",
        notes_en="The legal disclosure names Beijing Baidu Netcom Technology and Baidu affiliates as operators; the relation is modelled as operates rather than equity ownership.",
    ),
    dict(
        id=SRC_CAAM_AUTO_ZONGHENG,
        publisher_zh="中国汽车工业协会", publisher_en="China Association of Automobile Manufacturers",
        title_zh="中国汽车工业协会工作报告", title_en="CAAM work report",
        source_type="industry_association", grade="A", published_at=None,
        accessed_at="2026-08-24", fact_date=None,
        url="https://www.caam.org.cn/chn/5/cate_69/con_5236042.html", confidence=0.95,
        notes_zh="报告将《汽车纵横》明确称为协会自有媒体，直接支持中汽协与该媒体的归属关系。",
        notes_en="The report explicitly identifies Auto Zongheng as CAAM's own media, directly supporting the affiliation relation.",
    ),
    dict(
        id=SRC_TESLA_SHANGHAI_CONTACT,
        publisher_zh="特斯拉", publisher_en="Tesla",
        title_zh="特斯拉联系信息", title_en="Tesla contact information",
        source_type="company_site", grade="A", published_at=None,
        accessed_at="2026-08-24", fact_date=None,
        url="https://www.tesla.com/en_sg/contact", confidence=0.90,
        notes_zh="官方联系页支持上海实体和所在地；不单独支持页面所列车型，故设施记录保持候选阈值。",
        notes_en="The official contact page supports the Shanghai entity and location, but not the listed model mix; the facility row therefore stays at the candidate threshold.",
    ),
    dict(
        id=SRC_CATL_YIBIN,
        publisher_zh="宁德时代", publisher_en="CATL",
        title_zh="四川时代宜宾基地官方报道", title_en="Official report on CATL's Yibin base",
        source_type="company_site", grade="A", published_at=None,
        accessed_at="2026-08-24", fact_date=None,
        url="https://www.catl.com/en/news/6652.html", confidence=0.90,
        notes_zh="公司报道直接支持四川时代宜宾电池制造基地的身份和运行状态。",
        notes_en="The company report directly supports the identity and operating status of CATL's battery-manufacturing base in Yibin.",
    ),
    dict(
        id=SRC_GWM_GLOBAL,
        publisher_zh="长城汽车", publisher_en="Great Wall Motor",
        title_zh="全球制造布局", title_en="Global manufacturing footprint",
        source_type="company_site", grade="A", published_at=None,
        accessed_at="2026-08-24", fact_date=None,
        url="https://www.gwm-global.com/global.html", confidence=0.90,
        notes_zh="公司全球制造页列出徐水工厂，支持设施身份与保定所在地。",
        notes_en="The company's manufacturing page lists the Xushui factory, supporting its identity and Baoding location.",
    ),
    dict(
        id=SRC_THSVM,
        publisher_zh="清华大学车辆与运载学院", publisher_en="Tsinghua School of Vehicle and Mobility",
        title_zh="学院概况", title_en="School profile",
        source_type="university_site", grade="A", published_at=None,
        accessed_at="2026-08-24", fact_date=None,
        url="https://www.svm.tsinghua.edu.cn/column/15.html", confidence=0.90,
        notes_zh="学院官网支持院系名称与研究方向；未用来证明特定企业合作。",
        notes_en="The school site supports the unit name and research profile; it is not used to prove specific corporate partnerships.",
    ),
    dict(
        id=SRC_BIT_ME,
        publisher_zh="北京理工大学机械与车辆学院", publisher_en="BIT School of Mechanical Engineering",
        title_zh="学院介绍", title_en="School introduction",
        source_type="university_site", grade="A", published_at=None,
        accessed_at="2026-08-24", fact_date=None,
        url="https://me.bit.edu.cn/xygk/xyjs/index.htm", confidence=0.90,
        notes_zh="学院官网支持院系名称与车辆工程定位；未用来证明特定企业合作。",
        notes_en="The school site supports the unit name and vehicle-engineering profile; it is not used to prove specific corporate partnerships.",
    ),
    dict(
        id=SRC_TONGJI_AUTO,
        publisher_zh="同济大学汽车与能源学院", publisher_en="Tongji automotive and energy school",
        title_zh="汽车与能源学院官网", title_en="Official automotive and energy school site",
        source_type="university_site", grade="A", published_at=None,
        accessed_at="2026-08-24", fact_date=None,
        url="https://auto.tongji.edu.cn/", confidence=0.90,
        notes_zh="当前官网显示院系名称为“汽车与能源学院”，据此替换旧称；未用来证明上汽合作。",
        notes_en="The current site names the unit the automotive and energy school, replacing the stale label; it is not used to prove an SAIC partnership.",
    ),
    dict(
        id=SRC_JLU_AUTO,
        publisher_zh="吉林大学汽车工程学院", publisher_en="Jilin University College of Automotive Engineering",
        title_zh="学院简介", title_en="College profile",
        source_type="university_site", grade="A", published_at=None,
        accessed_at="2026-08-24", fact_date=None,
        url="https://auto.jlu.edu.cn/xygk/xyjj.htm", confidence=0.90,
        notes_zh="学院官网支持院系名称与车辆工程沿革；未用来证明一汽合作。",
        notes_en="The college site supports the unit name and automotive-engineering history; it is not used to prove an FAW partnership.",
    ),
    dict(
        id=SRC_HFUT_AUTO,
        publisher_zh="合肥工业大学汽车与交通工程学院", publisher_en="HFUT School of Automotive and Transportation Engineering",
        title_zh="学院简介", title_en="School profile",
        source_type="university_site", grade="A", published_at=None,
        accessed_at="2026-08-24", fact_date=None,
        url="https://qjxy.hfut.edu.cn/xygk/xyjj.htm", confidence=0.90,
        notes_zh="学院官网支持院系名称与车辆工程定位；未用来证明江淮合作。",
        notes_en="The school site supports the unit name and vehicle-engineering profile; it is not used to prove a JAC partnership.",
    ),
    dict(
        id=SRC_CHD_AUTO,
        publisher_zh="长安大学汽车学院", publisher_en="Chang'an University School of Automobile",
        title_zh="学院简介", title_en="School profile",
        source_type="university_site", grade="A", published_at=None,
        accessed_at="2026-08-24", fact_date=None,
        url="https://qiche.chd.edu.cn/8458/list.htm", confidence=0.90,
        notes_zh="学院官网支持院系名称与车辆工程定位；未用来证明特定企业合作。",
        notes_en="The school site supports the unit name and vehicle-engineering profile; it is not used to prove specific corporate partnerships.",
    ),
]

for source_id, meta in FACILITY_SOURCE_META.items():
    default_scope_zh = "该外部官方页面仅用于确认此设施的名称、运营方、所在城市与当前状态。"
    default_scope_en = "This external official page supports only this facility's name, operator, city and current status."
    SOURCES.append(dict(
        id=source_id,
        publisher_zh=meta["publisher_zh"], publisher_en=meta["publisher_en"],
        title_zh=meta["title_zh"], title_en=meta["title_en"],
        source_type=meta["source_type"], grade="A", published_at=None,
        accessed_at="2026-09-03", fact_date=meta["fact_date"],
        url=meta["url"], confidence=0.90,
        notes_zh=meta.get("scope_zh") or default_scope_zh,
        notes_en=meta.get("scope_en") or default_scope_en,
    ))

SOURCE_SUPPORT = {
    SRC_STAT_CHONGQING_2025: (
        "statistics:chongqing:2025",
        ["total_vehicle_output", "nev_output", "statistical_scope"],
    ),
    SRC_STAT_GUANGZHOU_2025: (
        "statistics:guangzhou:2025",
        ["total_vehicle_output", "statistical_scope"],
    ),
    SRC_STAT_GUANGZHOU_NEV_2025: (
        "statistics:guangzhou:2025",
        ["nev_output"],
    ),
    SRC_STAT_WUHU_2025: (
        "statistics:wuhu:2025",
        ["total_vehicle_output", "nev_output", "statistical_scope"],
    ),
    SRC_STAT_SHANGHAI_2025: (
        "statistics:shanghai:2025",
        ["total_vehicle_output", "statistical_scope"],
    ),
    SRC_STAT_SHANGHAI_NEV_2025: (
        "statistics:shanghai:2025",
        ["nev_output"],
    ),
    SRC_STAT_XIAN_2025: (
        "statistics:xian:2025",
        ["total_vehicle_output", "nev_output", "statistical_scope"],
    ),
    SRC_STAT_BEIJING_2025: (
        "statistics:beijing:2025",
        ["total_vehicle_output", "statistical_scope"],
    ),
    SRC_STAT_BEIJING_NEV_2025: (
        "statistics:beijing:2025",
        ["nev_output"],
    ),
    SRC_STAT_ZHENGZHOU_2025: (
        "statistics:zhengzhou:2025",
        ["total_vehicle_output", "statistical_scope"],
    ),
    SRC_STAT_WUHAN_2025: (
        "statistics:wuhan:2025",
        ["total_vehicle_output", "statistical_scope"],
    ),
    SRC_STAT_WUHAN_NEV_2025: (
        "statistics:wuhan:2025",
        ["nev_output"],
    ),
    SRC_STAT_SHIYAN_2025: (
        "statistics:shiyan:2025",
        ["total_vehicle_output", "nev_output", "statistical_scope"],
    ),
    SRC_STAT_HEFEI_NEV_2025: (
        "statistics:hefei:2025",
        ["nev_output", "scope_note_zh", "scope_note_en"],
    ),
    SRC_NIO_ABOUT: (
        "organization:nio",
        ["legal_name_zh", "legal_name_en", "headquarters_city_id"],
    ),
    SRC_AUTOHOME_20F: (
        "relation:autohome__operates__che168__",
        ["from_id", "relation_type", "to_id"],
    ),
    SRC_BAIDU_YOUJIA_PRIVACY: (
        "relation:baidu__operates__youjia__",
        ["from_id", "relation_type", "to_id"],
    ),
    SRC_CAAM_AUTO_ZONGHENG: (
        "relation:caam__owns__auto-zongheng__",
        ["from_id", "relation_type", "to_id"],
    ),
    SRC_TESLA_SHANGHAI_CONTACT: (
        "facility:tesla-shanghai-gigafactory",
        ["name_zh", "name_en", "operator_id", "city_id", "facility_type"],
    ),
    SRC_CATL_YIBIN: (
        "facility:catl-yibin",
        [
            "name_zh", "name_en", "operator_id", "operator_legal_name_zh",
            "city_id", "status", "facility_type",
        ],
    ),
    SRC_GWM_GLOBAL: (
        "facility:gwm-xushui",
        ["name_zh", "name_en", "operator_id", "city_id", "facility_type"],
    ),
    SRC_THSVM: (
        "institution:inst-tsinghua",
        ["organization_id", "city_id", "college_zh", "college_en"],
    ),
    SRC_BIT_ME: (
        "institution:inst-bit",
        ["organization_id", "city_id", "college_zh", "college_en"],
    ),
    SRC_TONGJI_AUTO: (
        "institution:inst-tongji",
        ["organization_id", "city_id", "college_zh", "college_en"],
    ),
    SRC_JLU_AUTO: (
        "institution:inst-jlu",
        ["organization_id", "city_id", "college_zh", "college_en"],
    ),
    SRC_HFUT_AUTO: (
        "institution:inst-hfut",
        ["organization_id", "city_id", "college_zh", "college_en"],
    ),
    SRC_CHD_AUTO: (
        "institution:inst-chd",
        ["organization_id", "city_id", "college_zh", "college_en"],
    ),
}

for source_id, meta in FACILITY_SOURCE_META.items():
    SOURCE_SUPPORT[source_id] = (
        f"facility:{meta['facility_id']}",
        meta.get(
            "support_fields",
            ["name_zh", "name_en", "operator_id", "city_id", "status", "facility_type"],
        ),
    )

# Promote each newly reviewed city statistic source into the public source
# registry.  Existing hand-curated sources are reused by URL; otherwise a
# deterministic field-specific record is generated from the checked-in audit.
_source_by_id = {source["id"]: source for source in SOURCES}
for stat in STATS:
    for field in ("total_vehicle_output", "nev_output"):
        review = (stat.get("field_reviews") or {}).get(field) or {}
        if review.get("status") not in {"verified", "partial"} or stat.get(field) is None:
            continue
        url = review.get("source_url")
        if not str(url or "").startswith(("http://", "https://")):
            continue
        existing = next(
            (sid for sid in stat["source_ids"] if (_source_by_id.get(sid) or {}).get("url") == url),
            None,
        )
        if existing:
            continue
        suffix = "total" if field == "total_vehicle_output" else "nev"
        source_id = f"src-audit-stat-{stat['city_id']}-2025-{suffix}"
        source = dict(
            id=source_id,
            publisher_zh=review.get("source_publisher") or "城市政府或统计部门",
            publisher_en=review.get("source_publisher") or "Municipal government or statistics authority",
            title_zh=review.get("source_title") or f"{stat['city_id']} 2025年城市产量官方材料",
            title_en=review.get("source_title") or f"{stat['city_id']} official 2025 city-output release",
            source_type="government_stats", grade="A",
            published_at=review.get("source_date"),
            accessed_at=review.get("source_accessed_at") or "2026-09-03",
            fact_date="2025", url=url, confidence=0.90,
            notes_zh=f"外部官方材料仅支持{stat['city_id']}的2025年{field}及其披露口径。",
            notes_en=f"This external official release supports only {stat['city_id']}'s 2025 {field} and its disclosed scope.",
        )
        SOURCES.append(source)
        _source_by_id[source_id] = source
        stat["source_ids"].append(source_id)
        SOURCE_SUPPORT[source_id] = (
            f"statistics:{stat['city_id']}:2025",
            [field, "statistical_scope"],
        )

if set(SOURCE_SUPPORT) != {source["id"] for source in SOURCES}:
    raise SystemExit("every public source must declare one exact support scope")

for source in SOURCES:
    parsed = urlparse(source["url"])
    entity_ref, fields = SOURCE_SUPPORT[source["id"]]
    source["publisher_domain"] = (parsed.hostname or "").lower()
    source["publisher_ownership"] = "external"
    source["support_scope"] = {
        "entity_refs": [entity_ref],
        "fields": fields,
        "scope_zh": source["notes_zh"],
        "scope_en": source["notes_en"],
    }


def main() -> None:
    DATA.mkdir(parents=True, exist_ok=True)
    for c in CITIES:
        c["featured_entity_ids"] = [eid for eid in FEATURED.get(c["id"], []) if eid in ORG_BY_ID]
        aliases = list(dict.fromkeys((c.get("aliases") or []) + CITY_ALIASES.get(c["id"], [])))
        c["aliases"] = aliases
        attach(c, "name_zh", "name_en", "province_zh", "province_en", extra=aliases)

    for o in ORGS:
        audited_year = reviewed_founded_year((_ORG_AUDIT.get(o["id"]) or {}).get("founded"))
        if audited_year is not None:
            o["founded_year"] = audited_year
        aliases = list(dict.fromkeys((o.get("aliases") or []) + ORG_ALIASES.get(o["id"], [])))
        o["aliases"] = aliases
        attach(o, "display_name_zh", "display_name_en", "legal_name_zh", "legal_name_en", extra=aliases)
        if o["id"] in {"aeolus", "holosonics"}:
            # These are compatibility-only IDs. Their historical English words
            # name different companies/brands and must never behave as aliases.
            o["search_keys"] = [key for key in o["search_keys"] if key != o["id"]]

    for f in FACILITIES:
        attach(f, "name_zh", "name_en")
    for cl in CLUSTERS:
        attach(cl, "name_zh", "name_en", "summary_zh", "summary_en")
    for m in MEDIA:
        attach(m, "media_name_zh", "media_name_en", "operating_company_zh", "operating_company_en")
    for inst in INSTITUTIONS:
        attach(inst, "school_zh", "school_en", "college_zh", "college_en")

    dump("cities.json", {"cities": CITIES})
    dump("organizations.json", {"organizations": ORGS})
    dump("facilities.json", {"facilities": FACILITIES})
    dump("city-roles.json", {"city_roles": ROLES})
    dump("relations.json", {"relations": RELATIONS})
    dump("clusters.json", {"clusters": CLUSTERS})
    dump("statistics.json", {"statistics": STATS})
    dump("media.json", {"media": MEDIA})
    dump("institutions.json", {"institutions": INSTITUTIONS})
    dump("sources.json", {"sources": SOURCES})

    counts = {
        "cities": len(CITIES),
        "organizations": len(ORGS),
        "facilities": len(FACILITIES),
        "city_roles": len(ROLES),
        "relations": len(RELATIONS),
        "clusters": len(CLUSTERS),
        "statistics": len(STATS),
        "media": len(MEDIA),
        "institutions": len(INSTITUTIONS),
        "sources": len(SOURCES),
        "core_cities": sum(1 for c in CITIES if c["tier"] == "core"),
        "specialist_cities": sum(1 for c in CITIES if c["tier"] == "specialist"),
    }
    audit_path = ROOT / "tools" / "reviewed_entity_audit_2026_09.json"
    if audit_path.is_file():
        audit_meta = json.loads(audit_path.read_text(encoding="utf-8")).get("metadata") or {}
        counts["organization_field_reviews"] = audit_meta.get("field_decision_count", 0)
        counts["city_output_field_reviews"] = audit_meta.get("city_field_decision_count", 0)
    dump("manifest.json", {
        "data_version": "v1-2026-09-deep-audit",
        "generated_at": "2026-09-03",
        "last_verified": LV,
        "counts": counts,
        "notes_zh": "V1：17座核心城 + 11座专业城。QROST自有简报不作为证据；外部一手来源可核实，二手来源标为部分核实，未逐条核验的数据保留为低置信候选。",
        "notes_en": "V1: 17 core + 11 specialist cities. QROST-authored briefs are not evidence; linked primary sources can verify a fact, secondary sources are marked partial, and unreviewed rows remain low-confidence candidates.",
    })
    print("seed counts:", counts)


if __name__ == "__main__":
    main()
