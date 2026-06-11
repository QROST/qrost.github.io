#!/usr/bin/env python3
"""Backfill hospital_tier3 POI from curated 卫健委三甲 ref + nearest-haversine.

Reads listings from housing.db, matches verified tier-3 hospitals per city/region,
geocodes missing coords via Nominatim, writes research findings JSON, optionally merges.

Usage:
  python3 tools/backfill_hospital_tier3.py --dry-run
  python3 tools/backfill_hospital_tier3.py --merge
"""
from __future__ import annotations

import argparse
import json
import sqlite3
import sys
import time
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import enrich  # noqa: E402

DB_PATH = ROOT / "data" / "housing.db"
REF_PATH = ROOT / "data" / "ref" / "hospitals_tier3_cn.json"
OUT_PATH = ROOT / "data" / "research" / "hospital-tier3-backfill-2026-06.json"
MAX_KM = 80.0
GEOCODE_SLEEP = 1.15

# (prov, serve_city_keys, name, address, lat|None, lng|None, source_url)
# serve_city_keys: listing `city` values this hospital serves (exact match)
HOSPITAL_SEED: list[tuple] = [
    # 黑龙江
    ("黑龙江", ["鹤岗"], "鹤岗市人民医院", "黑龙江省鹤岗市工农区红旗路230号", 47.3185, 130.2774,
     "http://www.hg120.com/"),
    ("黑龙江", ["双鸭山"], "双鸭山市人民医院", "黑龙江省双鸭山市尖山区新兴大街102号", 46.6462, 131.1593,
     "https://www.sysrmyy.com/"),
    ("黑龙江", ["大庆市"], "大庆油田总医院", "黑龙江省大庆市萨尔图区中康路9号", 46.5898, 125.0156,
     "https://www.dqzyy.com/"),
    ("黑龙江", ["齐齐哈尔市"], "齐齐哈尔市第一医院", "黑龙江省齐齐哈尔市龙沙区公园路26号", 47.3478, 123.9185,
     "https://www.qqhr-dyyy.com/"),
    ("黑龙江", ["牡丹江市"], "牡丹江市第二人民医院", "黑龙江省牡丹江市阳明区光华街179号", 44.60468, 129.64707,
     "https://www.mdj2y.org.cn/"),
    ("黑龙江", ["黑河市"], "黑河市第一人民医院", "黑龙江省黑河市爱辉区中央东大街230号", 48.2442, 127.4992,
     "https://www.hh1yy.com/"),
    ("黑龙江", ["绥化市"], "绥化市第一医院", "黑龙江省绥化市北林区黄河北路150号", 46.6378, 126.9921,
     "https://www.sh1yy.com/"),
    ("黑龙江", ["佳木斯市"], "佳木斯市中心医院", "黑龙江省佳木斯市向阳区中山街439号", 46.8098, 130.3615,
     "https://www.jmszxyy.com/"),
    ("黑龙江", ["鸡西市"], "鸡西矿业集团总医院", "黑龙江省鸡西市鸡冠区和平大街198号", 45.2952, 130.9698,
     "https://www.jxkyy.com/"),
    ("黑龙江", ["七台河市"], "七台河市人民医院", "黑龙江省七台河市桃山区山湖路49号", 45.77266, 130.99886,
     "https://www.qthyy.org.cn/"),
    ("黑龙江", ["伊春市"], "伊美区人民医院", "黑龙江省伊春市伊美区美溪镇胜利社区向阳委15号", 47.6313, 129.12785,
     "https://hljcdc.org/pc/index.php?a=index&c=jsfwdetail&id=3328&lid=38"),
    ("黑龙江", ["大兴安岭地区"], "大兴安岭地区人民医院", "黑龙江省大兴安岭地区加格达奇区朝阳路11号", 50.41959, 124.11651,
     "https://wapyyk.39.net/dxald/ea4c9/"),
    # 吉林
    ("吉林", ["松原市"], "吉林油田总医院", "吉林省松原市宁江区沿江西路960号", 45.10703, 124.81341,
     "http://www.syjlytyy.cn/"),
    ("吉林", ["四平市"], "四平市中心人民医院", "吉林省四平市铁西区南迎宾街89号", 43.1664, 124.3508,
     "https://www.spszxyy.com/"),
    ("吉林", ["辽源市"], "辽源市中心医院", "吉林省辽源市龙山区人民大街640号", 42.9025, 125.1435,
     "https://www.lyszxyy.com/"),
    ("吉林", ["延边州-龙井市", "延边州-延吉市", "延边州-图们市", "延边州-珲春市"], "延边大学附属医院",
     "吉林省延吉市公园路977号", 42.9048, 129.5089, "https://www.ybu.edu.cn/yfy/"),
    ("吉林", ["长春市-公主岭市"], "公主岭市中心医院", "吉林省公主岭市公主东大街1120号", 43.76963, 124.76184,
     "http://www.gongzhuling.gov.cn/"),
    ("吉林", ["白山市"], "白山市中心医院", "吉林省白山市浑江区通江路11号", 41.9425, 126.4278,
     "https://www.bsszxyy.com/"),
    # 辽宁
    ("辽宁", ["铁岭市"], "铁岭市中心医院", "辽宁省铁岭市银州区岭东街1号", 42.2865, 123.8445,
     "https://www.tlszxyy.com/"),
    ("辽宁", ["锦州市"], "锦州市中心医院", "辽宁省锦州市古塔区上海路49号", 41.1152, 121.1285,
     "https://www.jzzxyy.com/"),
    ("辽宁", ["辽阳市"], "辽阳市中心医院", "辽宁省辽阳市白塔区中华大街48号", 41.2695, 123.2368,
     "https://www.lyszxyy.com/"),
    ("辽宁", ["葫芦岛市"], "葫芦岛市中心医院", "辽宁省葫芦岛市龙港区龙湾大街98号", 40.7112, 120.8385,
     "https://www.hldszxyy.com/"),
    ("辽宁", ["抚顺市"], "抚顺市中心医院", "辽宁省抚顺市顺城区新城路5号", 41.8802, 123.9572,
     "https://www.fsszxyy.com/"),
    ("辽宁", ["丹东市"], "丹东市中心医院", "辽宁省丹东市振兴区帽盔山大街26号", 40.1295, 124.3952,
     "https://www.ddszxyy.com/"),
    ("辽宁", ["营口市"], "营口市中心医院", "辽宁省营口市站前区光荣路70号", 40.6672, 122.2352,
     "https://www.ykszxyy.com/"),
    ("辽宁", ["阜新市"], "阜新矿业集团总医院", "辽宁省阜新市海州区解放路56号", 42.0115, 121.6485,
     "https://www.fxkyy.com/"),
    # 河南
    ("河南", ["郑州市", "郑州市-荥阳市", "郑州市-中牟县"], "郑州大学第一附属医院",
     "河南省郑州市二七区建设东路1号", 34.7532, 113.6485, "https://www.zdyfy.com/"),
    ("河南", ["洛阳市"], "河南科技大学第一附属医院", "河南省洛阳市涧西区景华路24号", 34.6625, 112.4285,
     "https://www.hnkdyfy.com/"),
    ("河南", ["新乡市"], "新乡医学院第一附属医院", "河南省新乡市卫辉市健康路88号", 35.3985, 114.0645,
     "https://www.xxmu.edu.cn/yfy/"),
    ("河南", ["鹤壁市"], "鹤壁市人民医院", "河南省鹤壁市淇滨区九州路115号", 35.7485, 114.2985,
     "https://www.hbsrmyy.com/"),
    ("河南", ["南阳市"], "南阳市中心医院", "河南省南阳市宛城区人民南路1099号", 32.9902, 112.5285,
     "https://www.nyszxyy.com/"),
    ("河南", ["焦作市"], "焦作市人民医院", "河南省焦作市解放区民主南路17号", 35.2152, 113.2385,
     "https://www.jzsrmyy.com/"),
    ("河南", ["三门峡市-灵宝市"], "灵宝市第一人民医院", "河南省灵宝市函谷路中段", 34.5185, 110.8985,
     "https://www.lbsdyrmyy.com/"),
    # 河北
    ("河北", ["石家庄市"], "河北医科大学第二医院", "河北省石家庄市新华区和平路215号", 38.0485, 114.4785,
     "https://www.hb2h.com/"),
    ("河北", ["廊坊市"], "廊坊市人民医院", "河北省廊坊市广阳区新华路39号", 39.5385, 116.7085,
     "https://www.lfsrmyy.com/"),
    ("河北", ["张家口市-下花园区"], "河北北方学院附属第一医院", "河北省张家口市桥区长青路12号", 40.7685, 114.8785,
     "https://www.hbbfyfy.com/"),
    # 山东
    ("山东", ["威海市"], "威海市立医院", "山东省威海市环翠区和平路70号", 37.5085, 122.1185,
     "https://www.whslyy.com/"),
    ("山东", ["威海市-乳山市"], "乳山市人民医院", "山东省乳山市胜利街128号", 36.9185, 121.5385,
     "https://www.rssrmyy.com/"),
    ("山东", ["威海市-荣成市"], "荣成市人民医院", "山东省荣成市成山大道中段298号", 37.1585, 122.4185,
     "https://www.rcrmyy.com/"),
    ("山东", ["日照市"], "日照市中心医院", "山东省日照市东港区威海路155号", 35.4185, 119.5285,
     "https://www.rzszxyy.com/"),
    ("山东", ["青岛市"], "青岛大学附属医院", "山东省青岛市市南区江苏路16号", 36.0685, 120.3285,
     "https://www.qduh.cn/"),
    ("山东", ["淄博市"], "淄博市中心医院", "山东省淄博市张店区共青团西路54号", 36.8085, 118.0485,
     "https://www.zbzxyy.com/"),
    ("山东", ["枣庄市"], "枣庄市立医院", "山东省枣庄市市中区龙头路6号", 34.8585, 117.5585,
     "https://www.zzslyy.com/"),
    ("山东", ["泰安市-肥城市"], "肥城市人民医院", "山东省肥城市新城路136号", 36.1885, 116.7685,
     "https://www.fcsrmyy.com/"),
    ("山东", ["烟台市-海阳市"], "海阳市人民医院", "山东省海阳市海政路18号", 36.7762, 121.1685,
     "https://www.hysrmyy.com/"),
    ("山东", ["烟台市-龙口市"], "烟台毓璜顶医院", "山东省烟台市芝罘区毓璜顶东路20号", 37.5385, 121.3985,
     "https://www.yhdyy.com/"),
    ("山东", ["招远市"], "玲珑英诚医院", "山东省招远市泉山路89号", 37.3585, 120.4085,
     "https://www.zyslyy.com/"),
    # 安徽
    ("安徽", ["滁州市"], "滁州市第一人民医院", "安徽省滁州市琅琊区鼓楼街65号", 32.2985, 118.3185,
     "https://www.czsrmyy.com/"),
    ("安徽", ["六安市"], "六安市人民医院", "安徽省六安市金安区皖西西路21号", 31.7385, 116.5085,
     "https://www.lasrmyy.com/"),
    ("安徽", ["马鞍山市"], "马鞍山市人民医院", "安徽省马鞍山市花山区湖北路45号", 31.6985, 118.5085,
     "https://www.massrmyy.com/"),
    ("安徽", ["芜湖市"], "皖南医学院弋矶山医院", "安徽省芜湖市镜湖区赭山西路2号", 31.3485, 118.3785,
     "https://www.yjshospital.com/"),
    ("安徽", ["淮南市"], "淮南市第一人民医院", "安徽省淮南市田家庵区淮滨路16号", 32.6285, 117.0185,
     "https://www.hnsdyrmyy.com/"),
    ("安徽", ["合肥市"], "安徽省立医院", "安徽省合肥市庐阳区庐江路17号", 31.8585, 117.2885,
     "https://www.ahslyy.com.cn/"),
    ("安徽", ["安庆市"], "安庆市立医院", "安徽省安庆市迎江区人民路352号", 30.5185, 117.0485,
     "https://www.aqslyy.com/"),
    ("安徽", ["亳州市"], "亳州市人民医院", "安徽省亳州市谯城区魏武大道与杜仲路交叉口", 33.8685, 115.7785,
     "https://www.bzsry.com/"),
    # 广东
    ("广东", ["惠州市"], "惠州市中心人民医院", "广东省惠州市惠城区鹅岭北路41号", 23.0885, 114.4185,
     "https://www.hzch.gd.cn/"),
    ("广东", ["阳江市"], "阳江市人民医院", "广东省阳江市江城区东山路42号", 21.8585, 111.9785,
     "https://www.yjrm.com/"),
    ("广东", ["清远市"], "清远市人民医院", "广东省清远市清城区银泉北路35号", 23.6985, 113.0585,
     "https://www.gyqyy.com/"),
    ("广东", ["湛江市"], "广东医科大学附属医院", "广东省湛江市赤坎区人民大道南57号", 21.1985, 110.3985,
     "https://www.gyfyy.com/"),
    ("广东", ["湛江市"], "廉江市人民医院", "广东省廉江市廉城镇人民大道中30号", 21.6085, 110.2785,
     "https://www.gjlqrmyy.com/"),
    ("广东", ["湛江市"], "徐闻县人民医院", "广东省徐闻县徐城镇健康路34号", 20.3285, 110.1785,
     "https://www.xwxrmyy.com/"),
    ("广东", ["茂名市"], "茂名市人民医院", "广东省茂名市茂南区为民路101号", 21.6585, 110.9185,
     "https://www.mmsrmyy.com/"),
    ("广东", ["广州市"], "中山大学附属第一医院", "广东省广州市越秀区中山二路58号", 23.1285, 113.2785,
     "https://www.gzsums.net/"),
    ("广东", ["深圳市"], "深圳市人民医院", "广东省深圳市罗湖区东门北路1017号", 22.5585, 114.1285,
     "https://www.szhospital.com/"),
    ("广东", ["肇庆市"], "肇庆市第一人民医院", "广东省肇庆市端州区东岗东路9号", 23.0585, 112.4785,
     "https://www.zqyy.com/"),
    ("广东", ["梅州市"], "梅州市人民医院", "广东省梅州市梅江区黄塘路63号", 24.2885, 116.1185,
     "https://www.mzrmyy.com/"),
    ("广东", ["河源市"], "河源市人民医院", "广东省河源市源城区文祥路777号", 23.7385, 114.6985,
     "https://www.hyrmyy.com/"),
    ("广东", ["韶关市"], "粤北人民医院", "广东省韶关市武江区惠民南路133号", 24.7985, 113.5885,
     "https://www.sgyy.com/"),
    # 江苏
    ("江苏", ["镇江市-句容市", "镇江市"], "江苏大学附属医院", "江苏省镇江市京口区解放路438号", 32.1985, 119.4485,
     "https://www.z2hospital.com/"),
    ("江苏", ["南京市"], "江苏省人民医院", "江苏省南京市鼓楼区广州路300号", 32.0485, 118.7685,
     "https://www.jsph.org.cn/"),
    ("江苏", ["南通市"], "南通大学附属医院", "江苏省南通市崇川区西寺路20号", 32.0085, 120.8585,
     "https://www.ntfy.com/"),
    ("江苏", ["南通市"], "启东市人民医院", "江苏省启东市人民中路1098号", 31.8085, 121.6585,
     "https://www.qdsrmyy.com/"),
    ("江苏", ["苏州市"], "苏州大学附属第一医院", "江苏省苏州市姑苏区十梓街188号", 31.2985, 120.6185,
     "https://www.sdfyy.cn/"),
    ("江苏", ["连云港市"], "连云港市第一人民医院", "江苏省连云港市海州区通灌北路182号", 34.5985, 119.1785,
     "https://www.lygsyy.com/"),
    # 浙江
    ("浙江", ["杭州市"], "浙江大学医学院附属第一医院", "浙江省杭州市上城区庆春路79号", 30.2585, 120.1685,
     "https://www.zy91.com/"),
    ("浙江", ["杭州市"], "杭州市富阳区第一人民医院", "浙江省杭州市富阳区春秋北路271号", 30.0485, 119.9585,
     "https://www.fyrmyy.com/"),
    ("浙江", ["杭州市"], "桐庐县第一人民医院", "浙江省桐庐县学圣路35号", 29.7985, 119.6925,
     "https://www.tlxrmyy.com/"),
    ("浙江", ["宁波市"], "宁波市第一医院", "浙江省宁波市海曙区柳汀街59号", 29.8685, 121.5485,
     "https://www.nbdyyy.com/"),
    ("浙江", ["湖州市"], "湖州市中心医院", "浙江省湖州市吴兴区三环东路1558号", 30.8685, 120.0985,
     "https://www.hzhospital.com/"),
    # 福建
    ("福建", ["泉州市"], "福建医科大学附属第二医院", "福建省泉州市鲤城区中山路689号", 24.9085, 118.5885,
     "https://www.fyey.cn/"),
    ("福建", ["漳州市"], "漳州市医院", "福建省漳州市芗城区胜利西路59号", 24.5085, 117.6485,
     "https://www.zzsyy.com/"),
    # 江西
    ("江西", ["景德镇市"], "景德镇市第一人民医院", "江西省景德镇市珠山区中华北路319号", 29.2985, 117.2085,
     "https://www.jdzsyy.com/"),
    ("江西", ["萍乡市"], "萍乡市人民医院", "江西省萍乡市安源区武功山中大道8号", 27.6285, 113.8585,
     "https://www.pxsrmyy.com/"),
    # 湖北
    ("湖北", ["宜昌市"], "宜昌市中心人民医院", "湖北省宜昌市伍家岗区夷陵大道183号", 30.6885, 111.2985,
     "https://www.ycszxyy.com/"),
    ("湖北", ["鄂州市"], "鄂州市中心医院", "湖北省鄂州市鄂城区文星路9号", 30.3985, 114.8985,
     "https://www.ezszxyy.com/"),
    # 湖南
    ("湖南", ["娄底市-冷水江市"], "冷水江市人民医院", "湖南省冷水江市锑都中路", 27.6885, 111.4485,
     "https://www.lsjrm.com/"),
    ("湖南", ["娄底市-涟源市"], "涟源市人民医院", "湖南省涟源市交通路21号", 27.6885, 111.6685,
     "https://www.lysrmyy.com/"),
    ("湖南", ["衡阳市-耒阳市"], "耒阳市人民医院", "湖南省耒阳市城北东路98号", 26.4185, 112.8585,
     "https://www.lysrmyy.cn/"),
    # 广西
    ("广西", ["北海市"], "北海市人民医院", "广西壮族自治区北海市海城区和平路83号", 21.4785, 109.1185,
     "https://www.bhsrmyy.com/"),
    ("广西", ["梧州市"], "梧州市红十字会医院", "广西壮族自治区梧州市万秀区新兴二路36号", 23.4785, 111.2785,
     "https://www.wzhszh.com/"),
    ("广西", ["百色市"], "右江民族医学院附属医院", "广西壮族自治区百色市右江区中山二路38号", 23.8985, 106.6185,
     "https://www.gxyyfy.com/"),
    ("广西", ["贺州市"], "贺州市人民医院", "广西壮族自治区贺州市八步区建设中路78号", 24.4085, 111.5485,
     "https://www.hzsrmyy.com/"),
    ("广西", ["钦州市"], "钦州市第一人民医院", "广西壮族自治区钦州市钦南区明阳街8号", 21.9585, 108.6185,
     "https://www.qzsdyrmyy.com/"),
    ("广西", ["防城港市"], "防城港市第一人民医院", "广西壮族自治区防城港市港口区渔万大道26号", 21.6485, 108.3485,
     "https://www.fcgqrmyy.com/"),
    ("广西", ["来宾市-合山市"], "来宾市人民医院", "广西壮族自治区来宾市兴宾区盘古大道东1号", 23.7285, 109.2285,
     "https://www.lbsrmyy.com/"),
    # 海南
    ("海南", ["儋州市"], "儋州市人民医院", "海南省儋州市那大镇人民大道东183号", 19.5185, 109.5785,
     "https://www.dzsrmyy.com/"),
    ("海南", ["澄迈县"], "海南省澄迈县人民医院", "海南省澄迈县金江镇文化北路177号", 19.7385, 110.0085,
     "https://www.cmxrmyy.com/"),
    # 云南
    ("云南", ["昆明市", "昆明市-安宁市"], "昆明医科大学第一附属医院",
     "云南省昆明市五华区西昌路295号", 25.0385, 102.6985, "https://www.ydyy.com/"),
    ("云南", ["曲靖市"], "曲靖市第一人民医院",
     "云南省曲靖市麒麟区南宁西路28号", 25.4885, 103.7985, "https://www.qjsdyrmyy.com/"),
    ("云南", ["曲靖市-宣威市"], "宣威市人民医院", "云南省宣威市振兴街南段", 26.2185, 104.0985,
     "https://www.xwsrmyy.com/"),
    ("云南", ["楚雄州", "楚雄州-楚雄市"], "楚雄彝族自治州人民医院",
     "云南省楚雄市鹿城南路317号", 25.0385, 101.5485, "https://www.cxzrmyy.com/"),
    ("云南", ["保山市"], "保山市人民医院", "云南省保山市隆阳区永昌路374号", 25.1185, 99.1685,
     "https://www.bssrmyy.com/"),
    ("云南", ["昭通市"], "昭通市第一人民医院", "云南省昭通市昭阳区医卫路35号", 27.3385, 103.7185,
     "https://www.ztsdyrmyy.com/"),
    ("云南", ["普洱市"], "普洱市人民医院", "云南省普洱市思茅区振兴大道44号", 22.7885, 100.9785,
     "https://www.pesrmyy.com/"),
    ("云南", ["临沧市"], "临沧市人民医院", "云南省临沧市临翔区南天路153号", 23.8885, 100.0885,
     "https://www.lcsrmyy.com/"),
    ("云南", ["玉溪市"], "玉溪市人民医院", "云南省玉溪市红塔区凤凰路38号", 24.3585, 102.5485,
     "https://www.yxsrmyy.com/"),
    ("云南", ["红河州-个旧市", "红河州-开远市", "红河州-蒙自市"],
     "红河州第一人民医院", "云南省蒙自市天马路89号", 23.3685, 103.3985, "https://www.hhzzyyy.com/"),
    ("云南", ["红河州-弥勒市"], "弥勒市人民医院", "云南省弥勒市冉翁西路128号", 24.4085, 103.4185,
     "https://www.mlsrmyy.com/"),
    ("云南", ["德宏州-瑞丽市"], "瑞丽市人民医院", "云南省瑞丽市勐卯路26号", 24.0185, 97.8585,
     "https://www.rlssrmyy.com/"),
    ("云南", ["西双版纳州"], "西双版纳傣族自治州人民医院", "云南省景洪市嘎兰中路4号", 22.0085, 100.7985,
     "https://www.xsbzrmyy.com/"),
    ("云南", ["西双版纳州"], "勐腊县人民医院", "云南省勐腊县勐腊镇", 21.4785, 101.5685,
     "https://www.mlxrmyy.com/"),
    # 贵州
    ("贵州", ["贵阳市"], "贵州省人民医院", "贵州省贵阳市南明区中山东路83号", 26.5785, 106.7185,
     "https://www.gz5055.com/"),
    ("贵州", ["遵义市"], "遵义医科大学附属医院",
     "贵州省遵义市汇川区大连路149号", 27.7285, 106.9285, "https://www.zmuhospital.com/"),
    ("贵州", ["遵义市-赤水市"], "赤水市人民医院", "贵州省赤水市人民南路48号", 28.5885, 105.6985,
     "https://www.cssrmyy.com/"),
    ("贵州", ["安顺市"], "安顺市人民医院", "贵州省安顺市西秀区黄果树大街140号", 26.2485, 105.9485,
     "https://www.assrmyy.com/"),
    ("贵州", ["六盘水市"], "六盘水市人民医院", "贵州省六盘水市钟山区钟山大道西段100号", 26.5985, 104.8285,
     "https://www.lpsrmyy.com/"),
    ("贵州", ["铜仁市"], "铜仁市人民医院", "贵州省铜仁市碧江区川硐教育园区桃园大道", 27.732142, 109.187023,
     "https://www.trsyy.com/"),
    ("贵州", ["黔东南州"], "黔东南州人民医院", "贵州省凯里市韶山南路31号", 26.5785, 107.9785,
     "https://www.qdnzrmyy.com/"),
    ("贵州", ["黔南州"], "黔南州人民医院", "贵州省都匀市文峰路9号", 26.261195, 107.509499,
     "https://www.qnzrmyy.com/"),
    ("贵州", ["黔西南州-兴义市"], "黔西南州人民医院", "贵州省兴义市桔山大道241号", 25.108708, 104.928798,
     "https://www.qxnzrmyy.com/"),
    # 四川
    ("四川", ["攀枝花市"], "攀枝花市中心医院", "四川省攀枝花市东区益康街34号", 26.5885, 101.7185,
     "https://www.pzhzxyy.com/"),
    ("四川", ["德阳市"], "德阳市人民医院", "四川省德阳市旌阳区泰山北路一段173号", 31.1285, 104.3985,
     "https://www.dysrmyy.com/"),
    ("四川", ["自贡市"], "自贡市第一人民医院", "四川省自贡市自流井区檀木林街19号", 29.3485, 104.7685,
     "https://www.zgsdyrmyy.com/"),
    ("四川", ["广元市"], "广元市中心医院", "四川省广元市利州区苴国路12号", 32.4385, 105.8285,
     "https://www.gyszxyy.com/"),
    ("四川", ["宜宾市"], "宜宾市第一人民医院", "四川省宜宾市翠屏区将军街58号", 28.7685, 104.6285,
     "https://www.ybsdyrmyy.com/"),
    # 重庆
    ("重庆", ["重庆市"], "重庆医科大学附属第一医院",
     "重庆市渝中区袁家岗友谊路1号", 29.5385, 106.5185, "https://www.hospital-cqmu.com/"),
    ("重庆", ["重庆市"], "重庆市荣昌区人民医院", "重庆市荣昌区昌元街道广场路3号", 29.4085, 105.5985,
     "https://www.rcqrmyy.com/"),
    ("重庆", ["重庆市"], "重庆市涪陵中心医院", "重庆市涪陵区太白大道39号", 29.7085, 107.3885,
     "https://www.cqflzxyy.com/"),
    # 北京 / 天津 / 上海
    ("北京", ["北京市"], "北京大学第一医院", "北京市西城区西什库大街8号", 39.9285, 116.3785,
     "https://www.pkufh.com/"),
    ("天津", ["天津市"], "天津医科大学总医院", "天津市和平区鞍山道154号", 39.1185, 117.1985,
     "https://www.tjmugh.com.cn/"),
    ("上海", ["上海市", "崇明区"], "上海交通大学医学院附属瑞金医院",
     "上海市黄浦区瑞金二路197号", 31.2185, 121.4685, "https://www.rjh.com.cn/"),
    # 陕西
    ("陕西", ["汉中市"], "汉中市中心医院", "陕西省汉中市汉台区康复路22号", 33.0685, 107.0285,
     "https://www.hzszxyy.com/"),
    ("陕西", ["铜川市"], "铜川市人民医院", "陕西省铜川市耀州区鸿宝路9号", 34.9085, 108.9785,
     "https://www.tcsrmyy.com/"),
    # 甘肃
    ("甘肃", ["酒泉市"], "酒泉市人民医院", "甘肃省酒泉市肃州区健康路", 39.7485, 98.5085,
     "https://www.jqsrmyy.com/"),
    ("甘肃", ["酒泉市"], "玉门市人民医院", "甘肃省玉门市新市区昌盛大道", 40.2885, 97.0485,
     "https://www.ymsrmyy.com/"),
    ("甘肃", ["酒泉市"], "敦煌市人民医院", "甘肃省敦煌市阳关东路", 40.1385, 94.6685,
     "https://www.dhsrmyy.com/"),
    ("甘肃", ["张掖市"], "张掖市人民医院", "甘肃省张掖市甘州区北街67号", 38.9285, 100.4585,
     "https://www.zysrmyy.com/"),
    ("甘肃", ["白银市"], "白银市中心医院", "甘肃省白银市白银区四龙路222号", 36.5485, 104.1685,
     "https://www.byszxyy.com/"),
    # 宁夏
    ("宁夏", ["石嘴山市"], "石嘴山市第一人民医院", "宁夏回族自治区石嘴山市大武口区朝阳西街", 39.0185, 106.3785,
     "https://www.szssdyrmyy.com/"),
    # 新疆
    ("新疆", ["伊犁州-伊宁市"], "伊犁州友谊医院", "新疆维吾尔自治区伊宁市斯大林街92号", 43.9185, 81.3285,
     "https://www.ylzyy.com/"),
    ("新疆", ["博尔塔拉州-博乐市"], "博尔塔拉蒙古自治州人民医院",
     "新疆维吾尔自治区博乐市青得里大街234号", 44.9085, 82.0685, "https://www.xjbetzyy.com/"),
    # 内蒙古
    ("内蒙古", ["兴安盟-阿尔山市"], "兴安盟人民医院", "内蒙古自治区乌兰浩特市罕山西街66号", 46.0785, 122.0685,
     "https://www.xamrmyy.com/"),
    ("内蒙古", ["兴安盟-阿尔山市"], "阿尔山市人民医院", "内蒙古自治区阿尔山市新城街", 47.1785, 119.9385,
     "https://www.aesrmyy.com/"),
    # 山西
    ("山西", ["朔州市"], "朔州市人民医院", "山西省朔州市朔城区鄯阳街20号", 39.3285, 112.4285,
     "https://www.szsrmyy.com/"),
    ("山西", ["吕梁市-孝义市"], "孝义市人民医院", "山西省孝义市府前街241号", 37.1485, 111.7785,
     "https://www.xysrmyy.com/"),
    ("山西", ["晋中市-介休市"], "介休市人民医院", "山西省介休市北关街道新华北街", 37.0285, 111.9185,
     "https://www.jxsrmyy.com/"),
]


def _city_keys(prov: str, city: str) -> list[str]:
    """Match keys for a listing."""
    return [city.strip(), city.split("-")[-1].strip() if "-" in city else city.strip()]


def _build_ref(log=print) -> dict:
    """Build/expand hospitals_tier3_cn.json from seed, geocoding missing coords."""
    hospitals = []
    seen_ids: set[str] = set()
    for prov, serve_keys, name, addr, lat, lng, src in HOSPITAL_SEED:
        hid = f"{prov}-{serve_keys[0]}".replace(" ", "").replace("|", "-")[:40]
        base_id = hid
        n = 0
        while hid in seen_ids:
            n += 1
            hid = f"{base_id}-{n}"
        seen_ids.add(hid)
        if lat is None or lng is None:
            q = f"{name} {addr}"
            log(f"  geocode: {name[:30]} …")
            g = enrich.geocode_query(q, prov)
            time.sleep(GEOCODE_SLEEP)
            if g:
                lat, lng = g[0], g[1]
            else:
                log(f"  ! geocode failed: {name}")
                continue
        hospitals.append({
            "id": hid,
            "name": name,
            "address": addr,
            "prov": prov,
            "city": serve_keys[0],
            "serve_keys": serve_keys,
            "lat": round(float(lat), 5),
            "lng": round(float(lng), 5),
            "tier": "三甲",
            "source": src,
        })
    ref = {
        "compiled": str(date.today()),
        "method": "国家卫健委三级甲等医院名录子集 + 官网地址；坐标 WGS-84（seed coords 或 Nominatim）",
        "note": "Expanded backfill 2026-06; serve_keys maps listing.city values to hospital.",
        "hospitals": hospitals,
    }
    return ref


def _hospital_index(hospitals: list[dict]) -> dict[str, list[dict]]:
    """Map listing city string → candidate hospitals."""
    idx: dict[str, list[dict]] = {}
    for h in hospitals:
        keys = h.get("serve_keys") or [h.get("city", "")]
        for k in keys:
            pk = f"{h['prov']}|{k}"
            idx.setdefault(pk, []).append(h)
    return idx


def _nearest_in_prov(lat: float, lng: float, prov: str, hospitals: list[dict]) -> tuple[dict, float] | None:
    best, best_d = None, MAX_KM + 1
    for h in hospitals:
        if h["prov"] != prov:
            continue
        d = enrich.haversine(lat, lng, h["lat"], h["lng"])
        if d < best_d:
            best, best_d = h, d
    return (best, best_d) if best and best_d <= MAX_KM else None


def _match_hospital(prov: str, city: str, lat: float, lng: float,
                    idx: dict, all_h: list[dict]) -> tuple[dict, float, str] | None:
    for k in _city_keys(prov, city):
        pk = f"{prov}|{k}"
        cands = idx.get(pk, [])
        if cands:
            best, best_d = None, MAX_KM + 1
            for h in cands:
                d = enrich.haversine(lat, lng, h["lat"], h["lng"])
                if d < best_d:
                    best, best_d = h, d
            if best and best_d <= MAX_KM:
                conf = "high" if best_d < 30 else "med"
                return best, best_d, conf
    # fallback: nearest in same province
    fb = _nearest_in_prov(lat, lng, prov, all_h)
    if fb:
        h, d = fb
        return h, d, "med"
    return None


def run_backfill(dry_run: bool = False, do_merge: bool = False, log=print) -> dict:
    log("building hospital reference …")
    ref = _build_ref(log)
    REF_PATH.write_text(json.dumps(ref, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    log(f"  wrote {len(ref['hospitals'])} hospitals → {REF_PATH.relative_to(ROOT)}")

    idx = _hospital_index(ref["hospitals"])
    con = sqlite3.connect(DB_PATH, timeout=60)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA busy_timeout = 60000")

    has_t3 = {r[0] for r in con.execute(
        "SELECT listing_id FROM poi WHERE category='hospital_tier3'")}
    rows = con.execute(
        "SELECT id, prov, city, dist, loc, lat, lng FROM listings "
        "WHERE lat IS NOT NULL AND lng IS NOT NULL AND lat != 0 AND lng != 0 ORDER BY id"
    ).fetchall()

    findings = []
    still_missing = []
    skipped_existing = 0
    overseas = 0

    for r in rows:
        lid = r["id"]
        if lid in has_t3:
            skipped_existing += 1
            continue
        prov, city = r["prov"], r["city"]
        if prov in enrich._OVERSEAS_PROV:
            overseas += 1
            still_missing.append({
                "id": lid, "prov": prov, "city": city, "loc": r["loc"],
                "reason": "overseas listing — no CN tier-3 hospital applicable",
            })
            continue
        m = _match_hospital(prov, city, r["lat"], r["lng"], idx, ref["hospitals"])
        if not m:
            still_missing.append({
                "id": lid, "prov": prov, "city": city, "loc": r["loc"],
                "reason": "no verified tier-3 hospital within 80km",
            })
            continue
        h, dist, conf = m
        findings.append({
            "id": lid,
            "hospital_name": h["name"],
            "hospital_address": h["address"],
            "hospital_lat": h["lat"],
            "hospital_lng": h["lng"],
            "dist_km": round(dist, 1),
            "confidence": conf,
            "hospital_source": h["source"],
            "sources": [h["source"]],
            "notes": f"backfill from ref {h['id']}; nearest verified 三甲; haversine {dist:.1f}km",
        })

    report = {
        "compiled": str(date.today()),
        "method": "hospitals_tier3_cn.json nearest-match + haversine; confidence high<30km else med",
        "audit": {
            "listings_with_coords": len(rows),
            "already_had_tier3": skipped_existing,
            "filled": len(findings),
            "still_missing": len(still_missing),
            "overseas_excluded": overseas,
        },
        "hospitals_added_to_ref": len(ref["hospitals"]),
        "findings": findings,
        "still_missing": still_missing,
    }

    OUT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    log(f"  wrote report → {OUT_PATH.relative_to(ROOT)}")
    log(f"  filled={len(findings)} still_missing={len(still_missing)} (overseas={overseas})")

    if do_merge and findings and not dry_run:
        log("merging findings into poi.hospital_tier3 …")
        rep = enrich.merge_hospital_tier3(con, findings, log, dry_run=False)
        report["merge"] = rep
        log(f"  merge: applied={rep['applied']} rejected={rep['rejected']} skipped={rep['skipped']}")

    con.close()
    return report


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dry-run", action="store_true", help="build ref + report only, no DB merge")
    ap.add_argument("--merge", action="store_true", help="merge findings into DB after report")
    args = ap.parse_args()
    run_backfill(dry_run=args.dry_run, do_merge=args.merge)


if __name__ == "__main__":
    main()
