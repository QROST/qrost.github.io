#!/usr/bin/env python3
"""Merge reviewed external-source organization facts and explicit field states.

This file is intentionally hand-reviewed.  It keeps legal-entity, group and
brand scopes separate; an unavailable exact value is represented as a state,
never borrowed from a parent or rounded into a false precision.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "assets" / "data"
OUT = DATA / "org-enrichment.json"
LV = "2026-08"


NOTE_EN_TRANSLATIONS = {
    "1930年为谱系起点；现集团于2001年重组。":
        "1930 is the lineage starting point; the current group was restructured in 2001.",
    "1954年为谱系起点；现名启用于1997年。":
        "1954 is the lineage starting point; the current name was adopted in 1997.",
    "1965年为机构谱系起点；2010年整体变更为股份公司。":
        "1965 is the institution's lineage starting point; it was wholly converted into a joint-stock company in 2010.",
    "2017年成立时名为江淮大众，2020年更名。":
        "Founded as JAC Volkswagen in 2017; renamed in 2020.",
    "834327属于运营法人，不赋给车讯网品牌。":
        "Ticker 834327 belongs to the operating legal entity and is not assigned to the Chexun media brand.",
    "MG是品牌；600104属于母公司上汽集团。":
        "MG is a brand; ticker 600104 belongs to its parent, SAIC Motor.",
    "che168网站不得继承ATHM/2518。":
        "The che168 website does not inherit Autohome's ATHM/2518 tickers.",
    "iCAR是奇瑞品牌，不是独立发行人。":
        "iCAR is a Chery brand, not a standalone issuer.",
    "一汽丰田合资运营主体未单独上市。":
        "FAW Toyota's joint-venture operating entities are not separately listed.",
    "上市主体为Lotus Technology，不是英国跑车品牌法人。":
        "The listed issuer is Lotus Technology, not the legal entity behind the British sports-car marque.",
    "上市法人2018年注册；官方企业谱系采用2014年。":
        "The listed legal entity was incorporated in 2018; the official corporate lineage dates to 2014.",
    "上汽50%、大众汽车40%、大众中国10%的中德合资公司。":
        "A Sino-German joint venture held 50% by SAIC, 40% by Volkswagen AG and 10% by Volkswagen China.",
    "上汽大通为上汽集团全资子公司，未单独上市。":
        "SAIC Maxus is a wholly owned SAIC Motor subsidiary and is not separately listed.",
    "上汽集团全资子公司。":
        "A wholly owned subsidiary of SAIC Motor.",
    "上海市国资委经上汽总公司控制上市公司。":
        "Shanghai SASAC controls the listed company through SAIC Group.",
    "东风50%、本田40%、本田中国10%。":
        "Dongfeng holds 50%, Honda 40% and Honda China 10%.",
    "东风与沃尔沃持股55:45；修正旧有国企单一分类。":
        "Dongfeng and Volvo hold 55% and 45%, respectively; this corrects the former SOE-only classification.",
    "东风商用车本体未单独上市。":
        "Dongfeng Commercial Vehicle itself is not separately listed.",
    "东风日产乘用车公司未单独上市。":
        "Dongfeng Nissan Passenger Vehicle Company is not separately listed.",
    "东风柳汽本体未单独上市。":
        "Dongfeng Liuzhou Motor itself is not separately listed.",
    "东风汽车集团有限公司本体未单独上市；0489.HK属于其上市子公司。":
        "Dongfeng Motor Corporation itself is not separately listed; 0489.HK belongs to its listed subsidiary.",
    "中国一汽集团本体未单独上市。":
        "China FAW Group itself is not separately listed.",
    "中国重汽集团本体未单独上市；3808.HK属于上市子公司。":
        "Sinotruk Group itself is not separately listed; 3808.HK belongs to a listed subsidiary.",
    "中汽中心本体未单独上市。":
        "CATARC itself is not separately listed.",
    "丰田官方列示合资生产主体及50%（含关联方）权益。":
        "Toyota's official disclosure lists the production joint ventures and a 50% interest, including affiliates.",
    "五菱品牌及运营公司未单独上市。":
        "Neither the Wuling brand nor its operating company is separately listed.",
    "代码属于品牌运营上市公司一汽解放集团。":
        "The ticker belongs to FAW Jiefang Group, the listed company that operates the brand.",
    "仰望品牌未单独上市；母公司代码不转填。":
        "The Yangwang brand is not separately listed; its parent's ticker is not assigned to this row.",
    "企业性质公示为国有控股企业。":
        "The enterprise filing identifies the company as state-controlled.",
    "传祺品牌及运营子公司未单独上市。":
        "Neither the Trumpchi brand nor its operating subsidiary is separately listed.",
    "北汽投资与现代汽车各持股50%。":
        "BAIC Investment and Hyundai Motor each hold 50%.",
    "北汽集团本体未单独上市；北汽股份等子公司证券不转填。":
        "BAIC Group itself is not separately listed; securities of subsidiaries such as Beijing Automotive are not assigned to this row.",
    "合众新能源成立于2014年；哪吒品牌始于2018年。":
        "Hozon New Energy was founded in 2014; the Neta brand began in 2018.",
    "合众新能源未单独上市。":
        "Hozon New Energy is not separately listed.",
    "合资公司未单独上市。":
        "The joint venture is not separately listed.",
    "哈弗是品牌，母公司代码不转填。":
        "Haval is a brand; its parent's ticker is not assigned to this row.",
    "国资控股上市公司体系内子公司。":
        "A subsidiary within a state-controlled listed-company group.",
    "坦克是品牌，母公司代码不转填。":
        "Tank is a brand; its parent's ticker is not assigned to this row.",
    "奔腾品牌及运营公司未单独上市。":
        "Neither the Bestune brand nor its operating company is separately listed.",
    "奥迪55%、大众中国5%、一汽40%。":
        "Audi holds 55%, Volkswagen China 5% and FAW 40%.",
    "安徽省国资委为实际控制人。":
        "Anhui SASAC is the ultimate controller.",
    "官方材料对成立年份存在1990/1991冲突，保留待核。":
        "Official materials conflict between 1990 and 1991 as the founding year; verification remains pending.",
    "官方称浙江吉利控股集团为民营汽车科技集团；0175.HK不转填至本行。":
        "Official materials describe Zhejiang Geely Holding as a privately owned automotive technology group; 0175.HK is not assigned to this row.",
    "官网称广西区属大型国有企业；按实际控制口径分类。":
        "The official site describes it as a large Guangxi regional SOE; classification follows ultimate control.",
    "宝马集团与华晨汽车集团合资公司。":
        "A joint venture between BMW Group and Brilliance Auto Group.",
    "宝骏是上汽通用五菱品牌，未单独上市。":
        "Baojun is an SGMW brand and is not separately listed.",
    "小米汽车本体未单独上市；1810.HK属于小米集团。":
        "Xiaomi Auto itself is not separately listed; 1810.HK belongs to Xiaomi Corporation.",
    "年报披露28.00万辆，不表示个位精度。":
        "The annual report discloses 280,000 vehicles (28.00 x 10,000), which does not imply unit-level precision.",
    "广州市国资委称其为国有控股股份制企业集团。":
        "Guangzhou SASAC describes it as a state-controlled joint-stock enterprise group.",
    "广汽50%、本田40%、本田中国10%。":
        "GAC holds 50%, Honda 40% and Honda China 10%.",
    "广汽、丰田汽车与丰田中国共同控制的合资实体；广汽持股50%。":
        "A joint venture jointly controlled by GAC, Toyota Motor and Toyota China; GAC holds 50%.",
    "广汽埃安未单独上市；2238.HK属于广汽集团。":
        "GAC Aion is not separately listed; 2238.HK belongs to GAC Group.",
    "当前主体未上市。":
        "The current entity is not listed.",
    "按Li Auto Inc.集团口径；仓库行名不是唯一境内法定主体。":
        "Classified at the Li Auto Inc. group level; the atlas row name does not denote a single mainland legal entity.",
    "按NIO Inc.集团及投票权控制口径；仓库行名为集团/品牌名。":
        "Classified at the NIO Inc. group and voting-control level; the atlas row uses the group or brand name.",
    "按小米智能电动车业务及集团控制口径；1810.HK不下沉为境内运营公司的证券代码。":
        "Classified by Xiaomi's smart-EV business and group control; 1810.HK is not assigned to the mainland operating company.",
    "按最后披露的股权控制分类；公司正处法院监督重整，未将日常重整控制等同为股权变更。":
        "Classified by the latest disclosed equity control; the company is under court-supervised restructuring, whose day-to-day control is not treated as an equity change.",
    "按沃尔沃汽车集团最终控制口径；官网同时列示成都生产基地。":
        "Classified by ultimate control of Volvo Cars Group; the official site also lists the Chengdu production base.",
    "捷途是奇瑞品牌，不是独立发行人。":
        "Jetour is a Chery brand, not a standalone issuer.",
    "控股股东性质为自然人控股。":
        "The controlling shareholder is classified as controlled by natural persons.",
    "方程豹品牌未单独上市；母公司代码不转填。":
        "The Fangchengbao brand is not separately listed; its parent's ticker is not assigned to this row.",
    "昊铂是集团品牌，未单独上市。":
        "Hyptec is a group brand and is not separately listed.",
    "易车2020年完成私有化，历史代码不作为当前上市状态。":
        "Yiche completed its privatization in 2020; historical tickers are not treated as a current listing.",
    "星途是奇瑞品牌，不是独立发行人。":
        "Exeed is a Chery brand, not a standalone issuer.",
    "智己未单独上市；600104属于母公司上汽集团。":
        "IM Motors is not separately listed; 600104 belongs to its parent, SAIC Motor.",
    "最终控制方为自然人。":
        "The ultimate controller is a natural person.",
    "极氪已并入吉利汽车，原NYSE代码ZK不再是当前独立上市状态。":
        "Zeekr has been integrated into Geely Automobile; its former NYSE ticker ZK no longer represents a current standalone listing.",
    "极狐运营公司未单独上市；600733属于母公司北汽蓝谷。":
        "The Arcfox operating company is not separately listed; 600733 belongs to its parent, BAIC BluePark.",
    "欧拉是品牌，母公司代码不转填。":
        "Ora is a brand; its parent's ticker is not assigned to this row.",
    "每经汽车频道未单独上市。":
        "NBD's automotive channel is not separately listed.",
    "汽车频道不得继承FENG。":
        "The automotive channel does not inherit ticker FENG.",
    "汽车频道不得继承NTES/9999。":
        "The automotive channel does not inherit NTES/9999.",
    "汽车频道不得继承SOHU。":
        "The automotive channel does not inherit ticker SOHU.",
    "汽车频道不得继承人民网股份603000。":
        "The automotive channel does not inherit People's Daily Online's ticker 603000.",
    "汽车频道不得继承新浪历史证券状态。":
        "The automotive channel does not inherit Sina's historical listing status.",
    "汽车频道不得继承腾讯控股0700。":
        "The automotive channel does not inherit Tencent Holdings' ticker 0700.",
    "汽车频道不是独立证券发行人。":
        "The automotive channel is not a standalone securities issuer.",
    "汽车频道未单独上市。":
        "The automotive channel is not separately listed.",
    "浙江吉利控股集团本体未单独上市；0175.HK属于吉利汽车控股。":
        "Zhejiang Geely Holding Group itself is not separately listed; 0175.HK belongs to Geely Automobile Holdings.",
    "深蓝汽车科技有限公司未单独上市。":
        "Deepal Automobile Technology Co., Ltd. is not separately listed.",
    "特斯拉上海本体未单独上市；TSLA属于美国母公司。":
        "Tesla Shanghai itself is not separately listed; TSLA belongs to its U.S. parent.",
    "特斯拉上海法定主体被列为外商独资企业；不下沉美国母公司上市状态。":
        "Tesla Shanghai's legal entity is identified as wholly foreign-owned; the U.S. parent's listing status is not assigned to it.",
    "猛士品牌及运营公司未单独上市。":
        "Neither the M-Hero brand nor its operating company is separately listed.",
    "现有22名分散股东并含部分国企；招股书明确并非国有、国有控股或国有实际控制企业。":
        "It has 22 dispersed shareholders, including some SOEs; the prospectus states that it is not state-owned, state-controlled or ultimately controlled by the state.",
    "现集团成立于2015年；产业谱系可追溯至1928年。":
        "The current group was established in 2015; its industrial lineage dates to 1928.",
    "百度旗下产品不得继承BIDU/9888。":
        "The Baidu product does not inherit BIDU/9888.",
    "监管披露列示创始人拥有过半综合投票权。":
        "Regulatory disclosure shows that the founder holds a majority of the aggregate voting power.",
    "监管披露列示北汽集团为控股股东。":
        "Regulatory disclosure identifies BAIC Group as the controlling shareholder.",
    "监管披露列示民营创始人一致行动股东组为最大股东。":
        "Regulatory disclosure identifies the private founder's concert-party shareholder group as the largest shareholder.",
    "监管披露列示民营控股股东及实际控制人。":
        "Regulatory disclosure identifies a private controlling shareholder and ultimate controller.",
    "监管披露列示自然人实际控制人。":
        "Regulatory disclosure identifies a natural person as the ultimate controller.",
    "红旗是品牌，不是独立发行人。":
        "Hongqi is a brand, not a standalone issuer.",
    "网站/运营主体未单独上市。":
        "Neither the website nor its operating entity is separately listed.",
    "网站不得继承历任股东证券代码。":
        "The website does not inherit the tickers of current or former shareholders.",
    "腾势品牌未单独上市；母公司代码不转填。":
        "The Denza brand is not separately listed; its parent's ticker is not assigned to this row.",
    "荣威是品牌；600104属于母公司上汽集团。":
        "Roewe is a brand; ticker 600104 belongs to its parent, SAIC Motor.",
    "车BU不是独立发行人，华为集团亦非上市公司。":
        "The Automotive BU is not a standalone issuer, and Huawei Group is also unlisted.",
    "通用汽车与上汽集团各持股50%。":
        "General Motors and SAIC Motor each hold 50%.",
    "郑州日产是中日50:50合资体系的全资子公司，不表述为本体直接50:50。":
        "Zhengzhou Nissan is a wholly owned subsidiary within a 50:50 Sino-Japanese joint-venture group; the company itself is not described as directly held 50:50.",
    "金旅客车是子公司；600686属于母公司。":
        "Golden Dragon Bus is a subsidiary; ticker 600686 belongs to its parent.",
    "金龙客车是子公司；600686属于母公司金龙汽车。":
        "King Long Bus is a subsidiary; ticker 600686 belongs to its parent, Xiamen King Long Motor Group.",
    "银河是产品品牌，不是独立发行人。":
        "Geely Galaxy is a product brand, not a standalone issuer.",
    "问界是品牌，不是独立发行人。":
        "AITO is a brand, not a standalone issuer.",
    "阿维塔科技未单独上市。":
        "Avatr Technology is not separately listed.",
    "集团本体未单独上市。":
        "The group itself is not separately listed.",
    "领克品牌及运营法人未单独上市。":
        "Neither the Lynk & Co brand nor its operating legal entity is separately listed.",
    "频道不得继承太平洋网络0543.HK。":
        "The channel does not inherit Pacific Online's 0543.HK ticker.",
    "飞凡处于上汽业务体系，未单独上市。":
        "Rising Auto is within SAIC's business system and is not separately listed.",
    "魏牌是品牌，母公司代码不转填。":
        "Wey is a brand; its parent's ticker is not assigned to this row.",
}


def founded(value: int, url: str, title: str, scope: str, zh: str = "", en: str = "") -> dict:
    if zh and not en:
        en = NOTE_EN_TRANSLATIONS.get(
            zh,
            "The displayed year follows the entity or lineage scope shown above; see the cited source for details.",
        )
    return {
        "value": value, "scope": scope, "source_url": url, "source_title": title,
        "note_zh": zh, "note_en": en,
    }


def listing(listed: bool, url: str, title: str, exchange: str = "none", ticker: str | None = None,
            zh: str = "", en: str = "", venues: list[dict] | None = None) -> dict:
    if zh and not en:
        fallback = (
            "The ticker belongs to the exact listed operating entity represented by this row; "
            "see the cited source for its legal-entity scope."
            if listed else
            "This entity is not separately listed; no parent or affiliate ticker is assigned to this row."
        )
        en = NOTE_EN_TRANSLATIONS.get(zh, fallback)
    row = {
        "listed": listed, "exchange": exchange if listed else "none", "ticker": ticker if listed else None,
        "source_url": url, "source_title": title, "note_zh": zh, "note_en": en,
    }
    if venues:
        row["venues"] = venues
    return row


def metric(value: int, year: int, url: str, title: str, scope: str,
           zh: str = "", en: str = "", unit: str = "vehicles", qualifier: str | None = None) -> dict:
    if zh and not en:
        en = NOTE_EN_TRANSLATIONS.get(
            zh,
            "The value follows the reporting scope and precision in the cited source.",
        )
    row = {
        "value": value, "year": year, "unit": unit, "scope": scope,
        "source_url": url, "source_title": title, "note_zh": zh, "note_en": en,
    }
    if qualifier:
        row["qualifier"] = qualifier
    return row


def own(url: str, title: str, zh: str = "", en: str = "") -> dict:
    if zh and not en:
        fallback = (
            "Ownership classification follows the control or equity basis in the cited source; "
            "see it for exact holdings and caveats."
        )
        en = NOTE_EN_TRANSLATIONS.get(zh, fallback)
    return {"source_url": url, "source_title": title, "note_zh": zh, "note_en": en}


HKEX_DFM_2025 = "https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0112/2026011200612.pdf"
SAIC_SALES_2025 = "https://www.saicmotor.com/chinese/tzzgx/jbqk/xssj/63718.shtml"
GAC_SALES_2025 = "https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0107/2026010701600.pdf"
BYD_AR_2025 = "https://disc.static.szse.cn/disc/disk03/finalpage/2026-03-31/7f027565-a539-4fde-abe9-2da54f4984d9.PDF"
SAIC_AR_2025 = "https://www.saicmotor.com/chinese/images/tzzgx/ggb/dqgg/2025ndqgg/2026/4/1/03D5AE52F7884360BDB6A8A7BC830D5D.pdf"


PATCH: dict[str, dict] = {
    "baic": {
        "founded": founded(1958, "https://epp.baicgroup.com.cn/homepage/bqjt/about-us.html", "北汽集团公司简介", "group_lineage"),
        "listing": listing(False, "https://epp.baicgroup.com.cn/homepage/bqjt/about-us.html", "北汽集团公司简介",
                           zh="北汽集团本体未单独上市；北汽股份等子公司证券不转填。"),
        "vehicle_sales": metric(1752000, 2025, "https://www.baicgroup.com.cn/baicgroup/News/NewsShort/2026/1/I1464293603709812736.html", "北汽集团2025销量公告", "group_sales"),
        "ownership_evidence": own("https://epp.baicgroup.com.cn/homepage/bqjt/about-us.html", "北汽集团公司简介"),
    },
    "beijing-benz": {
        "founded": founded(2005, "https://www.bbac.com.cn/CN/2/21/default.html", "北京奔驰公司简介", "current_joint_venture"),
        "listing": listing(False, "https://www.bbac.com.cn/CN/2/21/default.html", "北京奔驰公司简介", zh="合资公司未单独上市。"),
        "employees": metric(11000, 2025, "https://group.mercedes-benz.com/unternehmen/produktion/produktionsnetzwerk/produktionsnetzwerk-peking.html", "Mercedes-Benz production network: Beijing", "joint_venture", unit="people"),
        "ownership_evidence": own("https://www.bbac.com.cn/CN/2/21/default.html", "北京奔驰公司简介"),
    },
    "xiaomi-auto": {
        "founded": founded(2021, "https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0428/2026042800526.pdf", "Xiaomi 2025 annual report", "Xiaomi_EV_Inc"),
        "listing": listing(False, "https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0428/2026042800526.pdf", "Xiaomi 2025 annual report", zh="小米汽车本体未单独上市；1810.HK属于小米集团。"),
        "vehicle_sales": metric(411082, 2025, "https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0428/2026042800526.pdf", "Xiaomi 2025 annual report", "vehicle_deliveries"),
    },
    "li-auto": {
        "founded": founded(2015, "https://ir.lixiang.com/system/files-encrypted/nasdaq_kms/assets/2026/04/10/6-28-41/2025%20Annual%20Report.pdf", "Li Auto 2025 annual report", "listed_group"),
        "listing": listing(True, "https://ir.lixiang.com/system/files-encrypted/nasdaq_kms/assets/2026/04/10/6-28-41/2025%20Annual%20Report.pdf", "Li Auto 2025 annual report", "NASDAQ", "LI", venues=[{"exchange": "NASDAQ", "ticker": "LI"}, {"exchange": "HKEX", "ticker": "2015"}]),
        "employees": metric(30728, 2025, "https://ir.lixiang.com/system/files-encrypted/nasdaq_kms/assets/2026/04/10/6-28-41/2025%20Annual%20Report.pdf", "Li Auto 2025 annual report", "listed_group", unit="people"),
        "vehicle_sales": metric(406343, 2025, "https://ir.lixiang.com/system/files-encrypted/nasdaq_kms/assets/2026/04/10/6-28-41/2025%20Annual%20Report.pdf", "Li Auto 2025 annual report", "vehicle_deliveries"),
    },
    "saic": {
        "founded": founded(1997, SAIC_AR_2025, "SAIC Motor 2025 annual report", "current_listed_company"),
        "listing": listing(True, SAIC_AR_2025, "SAIC Motor 2025 annual report", "SSE", "600104"),
        "employees": metric(179797, 2025, SAIC_AR_2025, "SAIC Motor 2025 annual report", "listed_group", unit="people"),
        "vehicle_sales": metric(4507518, 2025, SAIC_SALES_2025, "SAIC Motor 2025 vehicle sales", "group_wholesale"),
    },
    "changan": {
        "founded": founded(1996, "https://disc.static.szse.cn/disc/disk03/finalpage/2026-04-11/1b030296-baad-43f8-b1c6-fb69c790305a.PDF", "Changan Auto 2025 annual report", "current_listed_company"),
        "listing": listing(True, "https://disc.static.szse.cn/disc/disk03/finalpage/2026-04-11/1b030296-baad-43f8-b1c6-fb69c790305a.PDF", "Changan Auto 2025 annual report", "SZSE", "000625", venues=[{"exchange": "SZSE", "ticker": "000625"}, {"exchange": "SZSE", "ticker": "200625"}]),
        "employees": metric(58274, 2025, "https://disc.static.szse.cn/disc/disk03/finalpage/2026-04-11/1b030296-baad-43f8-b1c6-fb69c790305a.PDF", "Changan Auto 2025 annual report", "listed_group", unit="people"),
        "vehicle_sales": metric(2913042, 2025, "https://disc.static.szse.cn/disc/disk03/finalpage/2026-04-11/1b030296-baad-43f8-b1c6-fb69c790305a.PDF", "Changan Auto 2025 annual report", "company_JV_and_associates"),
    },
    "seres": {
        "founded": founded(2007, "https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0330/2026033004282_c.pdf", "Seres 2025 annual report", "current_listed_company"),
        "listing": listing(True, "https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0330/2026033004282_c.pdf", "Seres 2025 annual report", "SSE", "601127", venues=[{"exchange": "SSE", "ticker": "601127"}, {"exchange": "HKEX", "ticker": "9927"}]),
        "employees": metric(21955, 2025, "https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0330/2026033004282_c.pdf", "Seres 2025 annual report", "listed_group", unit="people"),
        "vehicle_sales": metric(516860, 2025, "https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0330/2026033004282_c.pdf", "Seres 2025 annual report", "group_vehicle_sales"),
    },
    "jac": {
        "founded": founded(1999, "https://static.cninfo.com.cn/finalpage/2026-04-04/1225079663.PDF", "JAC 2025 annual report", "current_listed_company"),
        "listing": listing(True, "https://static.cninfo.com.cn/finalpage/2026-04-04/1225079663.PDF", "JAC 2025 annual report", "SSE", "600418"),
        "employees": metric(22179, 2025, "https://static.cninfo.com.cn/finalpage/2026-04-04/1225079663.PDF", "JAC 2025 annual report", "listed_group", unit="people"),
        "vehicle_sales": metric(384071, 2025, "https://static.cninfo.com.cn/finalpage/2026-04-04/1225079663.PDF", "JAC 2025 annual report", "vehicles_and_chassis"),
    },
    "nio": {
        "founded": founded(2014, "https://www.sec.gov/Archives/edgar/data/1736541/000110465926041765/nio-20251231x20f.htm", "NIO 2025 Form 20-F", "listed_group_lineage"),
        "listing": listing(True, "https://www.sec.gov/Archives/edgar/data/1736541/000110465926041765/nio-20251231x20f.htm", "NIO 2025 Form 20-F", "NYSE", "NIO", venues=[{"exchange": "NYSE", "ticker": "NIO"}, {"exchange": "HKEX", "ticker": "9866"}, {"exchange": "SGX", "ticker": "NIO"}]),
        "employees": metric(35032, 2025, "https://www.sec.gov/Archives/edgar/data/1736541/000110465926041765/nio-20251231x20f.htm", "NIO 2025 Form 20-F", "listed_group", unit="people"),
        "vehicle_sales": metric(326028, 2025, "https://ir.nio.com/news-releases/news-release-details/nio-inc-provides-december-fourth-quarter-and-full-year-2025/", "NIO 2025 delivery release", "NIO_ONVO_FIREFLY_deliveries"),
    },
}

PATCH.update({
    "vw-anhui": {
        "founded": founded(2017, "https://www.volkswagengroupchina.com.cn/zh-cn/partner/volkswagenanhui", "大众汽车（安徽）", "current_joint_venture", zh="2017年成立时名为江淮大众，2020年更名。"),
        "listing": listing(False, "https://www.volkswagengroupchina.com.cn/zh-cn/partner/volkswagenanhui", "大众汽车（安徽）", zh="合资公司未单独上市。"),
        "ownership_evidence": own("https://www.volkswagengroupchina.com.cn/zh-cn/partner/volkswagenanhui", "大众汽车（安徽）"),
    },
    "zhengzhou-nissan": {
        "founded": founded(1993, "https://www.zznissan.com/zh/global-services/", "郑州日产全球服务", "current_joint_venture"),
        "listing": listing(False, "https://www.zznissan.com/zh/global-services/", "郑州日产全球服务", zh="合资公司未单独上市。"),
        "vehicle_sales": metric(52140, 2025, HKEX_DFM_2025, "Dongfeng Motor Group December 2025 sales bulletin", "joint_venture_wholesale"),
    },
    "sgmw": {
        "founded": founded(2002, "https://www.saicmotor.com/chinese/history/h1.html", "上汽集团历史：上汽通用五菱", "current_joint_venture"),
        "listing": listing(False, "https://www.sgmw.com.cn/aboutUs", "上汽通用五菱公司简介", zh="合资公司未单独上市。"),
        "vehicle_sales": metric(1615066, 2025, SAIC_SALES_2025, "SAIC Motor 2025 vehicle sales", "joint_venture_wholesale"),
        "ownership_evidence": own("https://www.sgmw.com.cn/aboutUs", "上汽通用五菱公司简介"),
    },
    "dongfeng-liuzhou": {
        "founded": founded(1954, "https://www.dflzm.com.cn/index.php/about/history", "东风柳汽发展历程", "company_lineage", zh="1954年为谱系起点；现名启用于1997年。"),
        "listing": listing(False, "https://www.dflzm.com.cn/index.php/about", "东风柳汽公司简介", zh="东风柳汽本体未单独上市。"),
        "vehicle_sales": metric(132951, 2025, HKEX_DFM_2025, "Dongfeng Motor Group December 2025 sales bulletin", "company_wholesale"),
        "ownership_evidence": own("https://www.dflzm.com.cn/index.php/about", "东风柳汽公司简介"),
    },
    "guangxi-auto": {
        "founded": founded(2015, "https://www.wuling.com.cn/company-news-249", "广西汽车集团成立", "current_group", zh="现集团成立于2015年；产业谱系可追溯至1928年。"),
        "listing": listing(False, "https://www.wuling.com.cn/", "广西汽车集团", zh="集团本体未单独上市。"),
    },
    "dongfeng": {
        "founded": founded(1969, "https://www.dfmc.com.cn/zoujindf/qiyegaikuang/qiyejieshao.html", "东风汽车集团企业介绍", "group_lineage"),
        "listing": listing(False, "https://www.dfmc.com.cn/zoujindf/qiyegaikuang/qiyejieshao.html", "东风汽车集团企业介绍", zh="东风汽车集团有限公司本体未单独上市；0489.HK属于其上市子公司。"),
        "ownership_evidence": own("https://www.dfmc.com.cn/zoujindf/qiyegaikuang/qiyejieshao.html", "东风汽车集团企业介绍"),
    },
    "tesla-china": {
        "founded": founded(2018, "https://tradeinservices.mofcom.gov.cn/article/shidian/gzjz/201805/61596.html", "商务部：特斯拉上海公司设立", "Tesla_Shanghai_legal_entity"),
        "listing": listing(False, "https://ir.tesla.com/_flysystem/s3/sec/000162828026003952/tsla-20251231-gen.pdf", "Tesla 2025 Form 10-K", zh="特斯拉上海本体未单独上市；TSLA属于美国母公司。"),
        "vehicle_sales": metric(851000, 2025, "https://english.shanghai.gov.cn/en-Latest-WhatsNew/20260107/4c2060e1dc874d40b56a3a8fa8baedf5.html", "Shanghai government: Gigafactory deliveries in 2025", "Shanghai_factory_deliveries"),
    },
    "byd": {
        "founded": founded(1995, "https://www.bydglobal.com/en/CompanyIntro.html", "BYD company profile", "listed_group"),
        "listing": listing(True, BYD_AR_2025, "BYD 2025 annual report", "SZSE", "002594", venues=[{"exchange": "SZSE", "ticker": "002594"}, {"exchange": "HKEX", "ticker": "1211"}]),
        "employees": metric(869622, 2025, "https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0327/2026032702828.pdf", "BYD 2025 sustainability report", "listed_group", unit="people"),
        "vehicle_sales": metric(4602436, 2025, "https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0101/2026010100423.pdf", "BYD December 2025 production and sales bulletin", "new_energy_vehicle_sales"),
    },
    "gac": {
        "founded": founded(1997, "https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0428/2026042800986.pdf", "GAC Group 2025 annual report", "current_listed_company"),
        "listing": listing(True, GAC_SALES_2025, "GAC December 2025 sales bulletin", "SSE", "601238", venues=[{"exchange": "SSE", "ticker": "601238"}, {"exchange": "HKEX", "ticker": "2238"}]),
        "vehicle_sales": metric(1721489, 2025, GAC_SALES_2025, "GAC December 2025 sales bulletin", "group_sales"),
    },
    "gac-honda": {
        "founded": founded(1998, "https://global.honda/en/newsroom/news/2024/c241223eng.html", "Honda: GAC Honda NEV plant", "current_joint_venture"),
        "listing": listing(False, "https://global.honda/en/newsroom/news/2024/c241223eng.html", "Honda: GAC Honda NEV plant", zh="合资公司未单独上市。"),
        "vehicle_sales": metric(351926, 2025, GAC_SALES_2025, "GAC December 2025 sales bulletin", "joint_venture_wholesale"),
    },
    "gac-toyota": {
        "founded": founded(2004, "https://www.gac-toyota.com.cn/pdf/web/mypdf/Environment3/report.pdf", "GAC Toyota environmental report", "current_joint_venture"),
        "listing": listing(False, "https://www.gac-toyota.com.cn/pdf/web/mypdf/Environment3/report.pdf", "GAC Toyota environmental report", zh="合资公司未单独上市。"),
        "vehicle_sales": metric(756000, 2025, GAC_SALES_2025, "GAC December 2025 sales bulletin", "joint_venture_wholesale"),
    },
    "chery": {
        "founded": founded(1997, "https://www.chery.cn/brandshow/about/", "奇瑞汽车公司简介", "current_listed_company_lineage"),
        "listing": listing(True, "https://www1.hkexnews.hk/listedco/listconews/sehk/2025/0924/2025092401263_c.pdf", "Chery listing document", "HKEX", "9973"),
        "employees": metric(70103, 2025, "https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0402/2026040203392.pdf", "Chery 2025 annual report", "listed_group", unit="people"),
        "vehicle_sales": metric(2631381, 2025, "https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0101/2026010100573.pdf", "Chery 2025 sales announcement", "listed_group_five_brands"),
    },
    "geely": {
        "founded": founded(1986, "https://zgh.com/overview/?lang=en", "Zhejiang Geely Holding overview", "holding_group_lineage"),
        "listing": listing(False, "https://zgh.com/overview/?lang=en", "Zhejiang Geely Holding overview", zh="浙江吉利控股集团本体未单独上市；0175.HK属于吉利汽车控股。"),
        "vehicle_sales": metric(4116321, 2025, "https://zgh.com/media-center/news/2026-01-08/?lang=en", "Geely Holding 2025 sales release", "holding_group_brand_aggregate"),
    },
    "faw": {
        "founded": founded(1953, "https://www.faw.com.cn/fawcn/373692/jtgl/jtjj42/index.html", "中国一汽集团简介", "group_lineage"),
        "listing": listing(False, "https://www.faw.com.cn/fawcn/373692/jtgl/jtjj42/index.html", "中国一汽集团简介", zh="中国一汽集团本体未单独上市。"),
        "ownership_evidence": own("https://www.faw.com.cn/fawcn/373692/jtgl/jtjj42/index.html", "中国一汽集团简介"),
    },
    "faw-vw": {
        "founded": founded(1991, "https://www.faw-vw.com/development-journey", "一汽-大众发展历程", "current_joint_venture"),
        "listing": listing(False, "https://www.faw-vw.com/development-journey", "一汽-大众发展历程", zh="合资公司未单独上市。"),
    },
    "audi-faw-nev": {
        "founded": founded(2021, "https://www.volkswagengroupchina.com.cn/zh-cn/volkswagengroupchina/aboutvgc", "Volkswagen Group China overview", "current_joint_venture"),
        "listing": listing(False, "https://www.volkswagengroupchina.com.cn/zh-cn/volkswagengroupchina/aboutvgc", "Volkswagen Group China overview", zh="合资公司未单独上市。"),
    },
    "gwm": {
        "founded": founded(1984, "https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0327/2026032703716.pdf", "Great Wall Motor 2025 annual report", "company_lineage"),
        "listing": listing(True, "https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0327/2026032703716.pdf", "Great Wall Motor 2025 annual report", "SSE", "601633", venues=[{"exchange": "SSE", "ticker": "601633"}, {"exchange": "HKEX", "ticker": "2333"}]),
        "employees": metric(97600, 2025, "https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0327/2026032703716.pdf", "Great Wall Motor 2025 annual report", "listed_group", unit="people"),
        "vehicle_sales": metric(1323672, 2025, "https://www.gwm.com.cn/news/3403845.html", "Great Wall Motor 2025 sales release", "group_sales"),
    },
})

# Exact values were not found for these independently scoped entities in the
# official-source pass.  The UI must say so instead of silently rendering a dash.
EMP_NOT_DISCLOSED = {
    "xiaomi-auto", "vw-anhui", "zhengzhou-nissan", "sgmw", "dongfeng-liuzhou",
    "guangxi-auto", "tesla-china", "gac-honda", "gac-toyota", "geely", "faw",
    "hongqi", "bestune", "faw-vw", "audi-faw-nev", "faw-toyota", "volvo-cars-chengdu",
    "sinotruk", "king-long", "golden-dragon", "catarc", "caeri", "saic-vw",
    "dongfeng-cv", "beijing-hyundai", "saic-gm", "gac-aion", "arcfox", "im-motors",
    "rising-auto", "roewe", "mg", "denza", "yangwang", "fangchengbao", "gac-trumpchi",
    "hyptec", "avatr", "deepal", "aito", "dongfeng-honda", "bmw-brilliance",
    "saic-maxus", "lotus", "lynk-co", "zeekr", "geely-galaxy", "wuling", "baojun",
    "haval", "tank", "ora", "wey", "exeed", "jetour", "icar", "neta", "qianli",
    "huawei-car", "calb",
}

SALES_NOT_DISCLOSED = {
    "beijing-benz", "vw-anhui", "guangxi-auto", "faw", "hongqi", "bestune",
    "audi-faw-nev", "volvo-cars-chengdu", "sinotruk", "king-long", "golden-dragon",
    "gac-trumpchi", "hyptec", "avatr", "deepal", "aito", "bmw-brilliance", "neta",
    "aeolus", "arcfox", "rising-auto", "roewe", "mg", "denza", "yangwang",
    "fangchengbao", "wuling", "beijing-hyundai", "dongfeng",
}

DROP_FIELDS = {
    # A Mercedes China localization total was previously presented as BBAC
    # standalone sales; that scope is not exact enough for this entity row.
    "beijing-benz": {"vehicle_sales"},
    # The prior Neta number was an industry retail estimate rather than a
    # company-issued full-year figure.
    "neta": {"vehicle_sales"},
    # Exact-entity and metric-definition boundaries found during final review.
    "dongfeng": {"vehicle_sales"},
    "huaxiang": {"employees"},
    "pcauto": {"employees"},
    "changan-univ": {"employees"},
    "cqut": {"employees"},
    "hfut": {"employees"},
    "jlu": {"employees"},
}

STATUS_OVERRIDES = {
    "huawei-car": {"listing": "not_applicable"},
    "qianli": {"plants": "unverified"},
    "arcfox": {"plants": "unverified"},
}

VEHICLE_SELLERS = {"automaker", "brand"}
MANUFACTURING_TYPES = {"automaker", "brand", "battery_company", "supplier"}
AVAILABILITY_VALUES = {
    "verified", "partial", "not_disclosed", "not_applicable",
    "not_separately_listed", "unverified",
}
REVIEWED_FACT_FIELDS = {"founded", "listing", "employees", "vehicle_sales", "ownership_evidence"}


def merge_dict(base: dict, patch: dict) -> dict:
    out = dict(base)
    for key, value in patch.items():
        if isinstance(value, dict) and isinstance(out.get(key), dict):
            out[key] = merge_dict(out[key], value)
        else:
            out[key] = value
    return out


def has_external_metric(row: dict, field: str) -> bool:
    value = row.get(field)
    return isinstance(value, dict) and value.get("value") is not None and str(value.get("source_url", "")).startswith(("http://", "https://"))


def main() -> int:
    blob = json.loads(OUT.read_text(encoding="utf-8"))
    enrichment = blob["enrichment"]
    orgs = json.loads((DATA / "organizations.json").read_text(encoding="utf-8"))["organizations"]
    facilities = json.loads((DATA / "facilities.json").read_text(encoding="utf-8"))["facilities"]
    roles = json.loads((DATA / "city-roles.json").read_text(encoding="utf-8"))["city_roles"]
    org_by_id = {row["id"]: row for row in orgs}

    unknown = sorted(set(PATCH) - set(org_by_id))
    if unknown:
        raise SystemExit(f"unknown organization ids in official patch: {unknown}")

    for org_id, patch in PATCH.items():
        row = enrichment.setdefault(org_id, {})
        for field in DROP_FIELDS.get(org_id, set()):
            row.pop(field, None)
        merged = merge_dict(row, patch)
        for field in REVIEWED_FACT_FIELDS & set(patch):
            merged[field] = patch[field]
        enrichment[org_id] = merged
        enrichment[org_id]["last_verified"] = LV

    plant_counts: dict[str, int] = {}
    explicit_city_org: set[tuple[str, str]] = set()
    plant_types = {"vehicle_plant", "engine_plant", "battery_plant", "parts_plant"}
    for facility in facilities:
        if facility.get("facility_type") not in plant_types or not facility.get("operator_id"):
            continue
        org_id = facility["operator_id"]
        plant_counts[org_id] = plant_counts.get(org_id, 0) + 1
        explicit_city_org.add((facility["city_id"], org_id))
    seen_candidates: set[tuple[str, str]] = set()
    for role in roles:
        key = (role.get("city_id"), role.get("entity_id"))
        if role.get("role_type") not in {"factory", "supplier_plant"} or key in explicit_city_org or key in seen_candidates:
            continue
        seen_candidates.add(key)
        plant_counts[key[1]] = plant_counts.get(key[1], 0) + 1

    for org in orgs:
        org_id = org["id"]
        row = enrichment.setdefault(org_id, {"last_verified": LV})
        availability = dict(row.get("availability") or {})
        availability["founded"] = "verified" if isinstance(row.get("founded"), dict) and row["founded"].get("source_url") else "unverified"

        current_listing = row.get("listing")
        if isinstance(current_listing, dict) and current_listing.get("source_url"):
            availability["listing"] = "verified" if current_listing.get("listed") else "not_separately_listed"
        else:
            availability["listing"] = "unverified"

        ownership_evidence = row.get("ownership_evidence")
        if isinstance(ownership_evidence, dict) and ownership_evidence.get("source_url"):
            availability["ownership"] = "partial" if ownership_evidence.get("scope_quality") == "qualified" else "verified"
        else:
            availability["ownership"] = "unverified"
        if has_external_metric(row, "employees"):
            metric_row = row["employees"]
            availability["employees"] = "partial" if metric_row.get("source_authority") == "secondary" else "verified"
        elif org_id in EMP_NOT_DISCLOSED:
            availability["employees"] = "not_disclosed"
        else:
            availability["employees"] = "unverified"

        if has_external_metric(row, "vehicle_sales"):
            metric_row = row["vehicle_sales"]
            limited_scope = "unspecified" in str(metric_row.get("scope", "")).lower()
            availability["vehicle_sales"] = "partial" if metric_row.get("source_authority") == "secondary" or limited_scope else "verified"
        elif org["organization_type"] not in VEHICLE_SELLERS:
            availability["vehicle_sales"] = "not_applicable"
        elif org_id in SALES_NOT_DISCLOSED:
            availability["vehicle_sales"] = "not_disclosed"
        else:
            availability["vehicle_sales"] = "unverified"

        if plant_counts.get(org_id):
            availability["plants"] = "partial"
        elif org["organization_type"] not in MANUFACTURING_TYPES:
            availability["plants"] = "not_applicable"
        else:
            availability["plants"] = "unverified"

        availability.update(STATUS_OVERRIDES.get(org_id, {}))
        bad = sorted(set(availability.values()) - AVAILABILITY_VALUES)
        if bad:
            raise SystemExit(f"{org_id}: invalid availability values {bad}")
        row["availability"] = availability

    rendered = json.dumps(
        {"enrichment": enrichment}, ensure_ascii=False, indent=2, sort_keys=True
    ) + "\n"
    OUT.write_text(rendered, encoding="utf-8")
    counts = {field: {} for field in ("founded", "ownership", "listing", "employees", "vehicle_sales", "plants")}
    for row in enrichment.values():
        for field, status in row["availability"].items():
            if field in counts:
                counts[field][status] = counts[field].get(status, 0) + 1
    print(f"wrote {OUT.relative_to(ROOT)} n={len(enrichment)}")
    print(json.dumps(counts, ensure_ascii=False, sort_keys=True))
    return 0


GWM_BRAND_SALES = "https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0101/2026010100010_c.pdf"
PATCH.update({
    "baojun": {
        "founded": founded(2010, "https://lu.sgmw.com.cn/portal/details.html?id=47379", "上汽通用五菱宝骏品牌报道", "brand_launch"),
        "listing": listing(False, "https://www.sgmw.com.cn/aboutUs", "上汽通用五菱企业介绍", zh="宝骏是上汽通用五菱品牌，未单独上市。"),
        "vehicle_sales": metric(49002, 2025, "https://lu.sgmw.com.cn/portal/details.html?id=54256", "上汽通用五菱2025销量成绩单", "brand_sales"),
    },
    "haval": {
        "founded": founded(2013, "https://www.gwm.com.cn/history.html", "长城汽车发展历程", "independent_brand_launch"),
        "listing": listing(False, "https://www.gwm.com.cn/news/3403860.html", "长城汽车2025业绩", zh="哈弗是品牌，母公司代码不转填。"),
        "vehicle_sales": metric(758554, 2025, GWM_BRAND_SALES, "Great Wall Motor December 2025 sales bulletin", "brand_sales_unaudited"),
    },
    "tank": {
        "founded": founded(2021, "https://res.gwm.com.cn/2022/03/29/1814842_201_C-10.pdf", "长城汽车2021年度报告", "independent_brand_launch"),
        "listing": listing(False, "https://www.gwm.com.cn/news/3403860.html", "长城汽车2025业绩", zh="坦克是品牌，母公司代码不转填。"),
        "vehicle_sales": metric(232713, 2025, GWM_BRAND_SALES, "Great Wall Motor December 2025 sales bulletin", "brand_sales_unaudited"),
    },
    "ora": {
        "founded": founded(2018, "https://www.gwm.com.cn/ora.html", "欧拉品牌", "brand_launch"),
        "listing": listing(False, "https://www.gwm.com.cn/news/3403860.html", "长城汽车2025业绩", zh="欧拉是品牌，母公司代码不转填。"),
        "vehicle_sales": metric(48289, 2025, GWM_BRAND_SALES, "Great Wall Motor December 2025 sales bulletin", "brand_sales_unaudited"),
    },
    "wey": {
        "founded": founded(2016, "https://www.gwm.com.cn/wey.html", "WEY品牌", "brand_launch"),
        "listing": listing(False, "https://www.gwm.com.cn/news/3403860.html", "长城汽车2025业绩", zh="魏牌是品牌，母公司代码不转填。"),
        "vehicle_sales": metric(101954, 2025, GWM_BRAND_SALES, "Great Wall Motor December 2025 sales bulletin", "brand_sales_unaudited"),
    },
})

PATCH.update({
    "baidu": {
        "founded": founded(2000, "https://ir.baidu.com/shareholder-services/investor-faqs/", "Baidu investor FAQs", "listed_group"),
        "listing": listing(True, "https://ir.baidu.com/index.php/index.php/static-files/f655f8c4-bfaa-41c5-872c-005087bce94f", "Baidu 2025 Form 20-F", "NASDAQ", "BIDU", venues=[{"exchange": "NASDAQ", "ticker": "BIDU"}, {"exchange": "HKEX", "ticker": "9888"}, {"exchange": "HKEX-RMB", "ticker": "89888"}]),
        "employees": metric(33500, 2025, "https://ir.baidu.com/index.php/index.php/static-files/f655f8c4-bfaa-41c5-872c-005087bce94f", "Baidu 2025 Form 20-F", "listed_group", unit="people", qualifier="approximately"),
    },
    "horizon-robotics": {
        "founded": founded(2015, "https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0430/2026043001830.pdf", "Horizon Robotics 2025 annual report", "listed_group_lineage"),
        "listing": listing(True, "https://www.horizon.auto/en/investor-relations", "Horizon Robotics investor relations", "HKEX", "9660"),
        "employees": metric(2215, 2025, "https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0430/2026043001830.pdf", "Horizon Robotics 2025 annual report", "listed_group", unit="people"),
    },
    "weiride": {
        "founded": founded(2017, "https://ir.weride.ai/node/8631/html", "WeRide 2025 annual report", "Cayman_holding_company"),
        "listing": listing(True, "https://ir.weride.ai/ir-resources/investor-faqs", "WeRide investor FAQs", "NASDAQ", "WRD", venues=[{"exchange": "NASDAQ", "ticker": "WRD"}, {"exchange": "HKEX", "ticker": "0800"}]),
        "employees": metric(3661, 2025, "https://ir.weride.ai/node/8631/html", "WeRide 2025 annual report", "listed_group_worldwide", unit="people"),
    },
    "pony-ai": {
        "founded": founded(2016, "https://ir.pony.ai/static-files/9369cdc2-0bb6-4933-8ca8-7bd9eadc89a6", "Pony AI 2025 annual report", "Cayman_holding_company"),
        "listing": listing(True, "https://ir.pony.ai/", "Pony AI investor relations", "NASDAQ", "PONY", venues=[{"exchange": "NASDAQ", "ticker": "PONY"}, {"exchange": "HKEX", "ticker": "2026"}]),
        "employees": metric(1669, 2025, "https://ir.pony.ai/static-files/52c70018-a45d-49ea-b40c-652cf7c40cd3", "Pony AI 2025 annual results", "listed_group", unit="people"),
    },
    "qianli": {
        "listing": listing(True, "https://www.qianli-ai.com/about/invest", "千里科技投资者关系", "SSE", "601777"),
    },
    "huawei-car": {
        "founded": founded(2019, "https://www.huawei.com/cn/huaweitech/publication/winwin/34/eric-xu-car-2019", "华为智能汽车解决方案BU成立", "internal_business_unit"),
        "listing": listing(False, "https://www.huawei.com/en/media-center/company-facts/", "Huawei company facts", zh="车BU不是独立发行人，华为集团亦非上市公司。"),
    },
    "catl": {
        "founded": founded(2011, "https://www.catl.com/about/profile/", "宁德时代企业简介", "current_listed_company"),
        "listing": listing(True, "https://www.catl.com/news/9654.html", "宁德时代2025年度报告发布", "SZSE", "300750", venues=[{"exchange": "SZSE", "ticker": "300750"}, {"exchange": "HKEX", "ticker": "3750"}]),
        "employees": metric(185839, 2025, "https://www.catl.com/en/uploads/1/file/public/202603/20260310105310_46xjbwckvn.pdf", "CATL 2025 annual report", "listed_group", unit="people", qualifier="approximately"),
    },
    "svolt": {
        "founded": founded(2018, "https://www.svolt.cn/about/profile", "蜂巢能源公司概况", "current_company"),
        "listing": listing(False, "https://www.svolt.cn/about/profile", "蜂巢能源公司概况", zh="当前主体未上市。"),
    },
    "calb": {
        "founded": founded(2015, "https://invest.calb-tech.com/upload/file/20220923/20220923075324.pdf", "中创新航全球发售文件", "listed_group_legal_continuity"),
        "listing": listing(True, "https://invest.calb-tech.com/show_list.php?id=65", "中创新航联系方式", "HKEX", "3931"),
    },
    "eve-energy": {
        "founded": founded(2001, "https://www.evebattery.com/cn/about.html", "亿纬锂能企业简介", "current_listed_company"),
        "listing": listing(True, "https://www.evebattery.com/cn/about.html", "亿纬锂能企业简介", "SZSE", "300014"),
    },
    "gotion": {
        "founded": founded(2006, "https://www.gotion.com.cn/upload/at/file/20230605/1685950272255981kj4h.pdf", "国轩高科2022年度ESG报告", "operating_group_lineage"),
        "listing": listing(True, "https://static.cninfo.com.cn/finalpage/2026-04-29/1225241936.PDF", "国轩高科2025年年度报告", "SZSE", "002074"),
        "employees": metric(33087, 2025, "https://static.cninfo.com.cn/finalpage/2026-04-29/1225241936.PDF", "国轩高科2025年年度报告", "listed_group", unit="people"),
    },
    "desay-sv": {
        "founded": founded(1986, "https://en.desaysv.com/newsDetails/147.html", "Desay SV company history", "company_lineage"),
        "listing": listing(True, "https://www.desaysv.com/investor.html?class=1", "德赛西威投资者关系", "SZSE", "002920"),
        "employees": metric(11940, 2025, "https://disc.static.szse.cn/disc/disk03/finalpage/2026-03-06/1a53e9d0-2e8a-437b-9c3f-0b1062834cf2.PDF", "德赛西威2025年年度报告", "listed_group", unit="people"),
    },
    "holosonics": {
        "founded": founded(1993, "https://disc.static.szse.cn/disc/disk03/finalpage/2026-03-28/5505667f-a2a3-4dd2-867c-fcd4a87713c8.PDF", "华阳集团2025年年度报告", "company_lineage"),
        "listing": listing(True, "https://www.foryougroup.com/Investor-Relations.html", "华阳集团投资者关系", "SZSE", "002906"),
        "employees": metric(9481, 2025, "https://disc.static.szse.cn/disc/disk03/finalpage/2026-03-28/5505667f-a2a3-4dd2-867c-fcd4a87713c8.PDF", "华阳集团2025年年度报告", "listed_group", unit="people"),
    },
    "joyson": {
        "founded": founded(2004, "https://www.joyson.com/index.php/about.html", "均胜电子公司简介", "company_lineage"),
        "listing": listing(True, "https://www.joyson.com/index.php/investor_ft.html", "均胜电子投资者关系", "SSE", "600699", venues=[{"exchange": "SSE", "ticker": "600699"}, {"exchange": "HKEX", "ticker": "00699"}]),
        "employees": metric(47789, 2024, "https://www.joyson.com/bocupload/2025/10/27/17615673138515m10wn.pdf", "均胜电子2024年年度报告", "listed_group", unit="people"),
    },
    "tuopu": {
        "founded": founded(1983, "https://www.tuopu.com/about/aboutus/", "拓普集团公司简介", "first_factory_lineage"),
        "listing": listing(True, "https://www.tuopu.com/about/aboutus/", "拓普集团公司简介", "SSE", "601689"),
        "employees": metric(26123, 2025, "https://www.tuopu.com/wp-content/uploads/2026/03/%E6%8B%93%E6%99%AE%E9%9B%86%E5%9B%A22025%E5%B9%B4%E5%B9%B4%E5%BA%A6%E6%8A%A5%E5%91%8A.pdf", "拓普集团2025年年度报告", "listed_group", unit="people"),
    },
})

PATCH.update({
    "hongqi": {
        "founded": founded(1958, "https://www.faw.com.cn/fawcn/373696/5133380/5133398/index.html", "红旗品牌", "brand_launch"),
        "listing": listing(False, "https://www.faw.com.cn/fawcn/373696/5133380/5133398/index.html", "红旗品牌", zh="红旗是品牌，不是独立发行人。"),
    },
    "jiefang": {
        "founded": founded(1956, "https://www.fawjiefang.com.cn/fawjiefang/gywm12/gsjj/hhlc/index.html", "一汽解放辉煌历程", "brand_birth"),
        "listing": listing(True, "https://disc.static.szse.cn/disc/disk03/finalpage/2026-03-28/892a44c3-cdab-403f-9d60-8fc183527dab.PDF", "一汽解放2025年年度报告", "SZSE", "000800", zh="代码属于品牌运营上市公司一汽解放集团。"),
        "employees": metric(19117, 2025, "https://disc.static.szse.cn/disc/disk03/finalpage/2026-03-28/892a44c3-cdab-403f-9d60-8fc183527dab.PDF", "一汽解放2025年年度报告", "listed_operating_group", unit="people"),
        "vehicle_sales": metric(280000, 2025, "https://disc.static.szse.cn/disc/disk03/finalpage/2026-03-28/892a44c3-cdab-403f-9d60-8fc183527dab.PDF", "一汽解放2025年年度报告", "listed_group_reported_precision", zh="年报披露28.00万辆，不表示个位精度。"),
    },
    "bestune": {
        "founded": founded(2006, "https://www.faw.com.cn/fawcn/373696/ppzl/5426227/index.html", "奔腾品牌", "brand_launch"),
        "listing": listing(False, "https://www.faw.com.cn/fawcn/373696/ppzl/5426227/index.html", "奔腾品牌", zh="奔腾品牌及运营公司未单独上市。"),
    },
    "voyah": {
        "founded": founded(2020, "https://www.dfmc.com.cn/news/company/news_20200720_0836.html", "东风公司：岚图启程", "brand_launch"),
        "listing": listing(True, "https://www.dfmc.com.cn/news/company/news_20260320_1111.html", "岚图汽车港股上市", "HKEX", "7489"),
        "vehicle_sales": metric(150169, 2025, "https://www.dfmc.com.cn/news/company/news_20260121_1257.html", "岚图汽车2025发展报道", "brand_deliveries"),
    },
    "mengshi": {
        "founded": founded(2022, "https://www.dfmc.com.cn/news/company/news_20220829_1142.html", "东风发布猛士品牌", "brand_launch"),
        "listing": listing(False, "https://www.dfmc.com.cn/news/company/news_20220829_1142.html", "东风发布猛士品牌", zh="猛士品牌及运营公司未单独上市。"),
        "vehicle_sales": metric(10228, 2025, "https://etp.dfmc.com.cn/xydt/002002/20260109/a6ae86b3-d0ff-440b-999d-cf8ea209e2d2.html", "东风2025销量回顾", "brand_company_sales"),
    },
    "roewe": {
        "founded": founded(2006, "https://www.saicmotor.com/chinese/history/q1.html", "荣威品牌历史", "brand_launch"),
        "listing": listing(False, SAIC_AR_2025, "SAIC Motor 2025 annual report", zh="荣威是品牌；600104属于母公司上汽集团。"),
    },
    "mg": {
        "founded": founded(1924, "https://www.saicmotor.com/chinese/history/r1.html", "MG品牌历史", "brand_origin"),
        "listing": listing(False, SAIC_AR_2025, "SAIC Motor 2025 annual report", zh="MG是品牌；600104属于母公司上汽集团。"),
    },
    "denza": {
        "listing": listing(False, BYD_AR_2025, "BYD 2025 annual report", zh="腾势品牌未单独上市；母公司代码不转填。"),
    },
    "yangwang": {
        "founded": founded(2023, "https://www.bydglobal.com/sites/Satellite?c=BydArticle&cid=1617161943712&d=Touch&pagename=BYD_EN%2FBydArticle%2FBYD_ENCommon%2FArticleDetails&rendermode=preview", "BYD unveils Yangwang", "brand_launch"),
        "listing": listing(False, BYD_AR_2025, "BYD 2025 annual report", zh="仰望品牌未单独上市；母公司代码不转填。"),
    },
    "fangchengbao": {
        "founded": founded(2023, "https://www.bydglobal.com/co/sobre-byd/Company", "BYD company timeline", "brand_launch"),
        "listing": listing(False, BYD_AR_2025, "BYD 2025 annual report", zh="方程豹品牌未单独上市；母公司代码不转填。"),
    },
    "gac-aion": {
        "listing": listing(False, GAC_SALES_2025, "GAC December 2025 sales bulletin", zh="广汽埃安未单独上市；2238.HK属于广汽集团。"),
        "vehicle_sales": metric(290081, 2025, GAC_SALES_2025, "GAC December 2025 sales bulletin", "company_sales_unaudited"),
    },
    "arcfox": {
        "listing": listing(False, "https://www.arcfox.com.cn/", "ARCFOX official site", zh="极狐运营公司未单独上市；600733属于母公司北汽蓝谷。"),
    },
    "im-motors": {
        "listing": listing(False, "https://www.saicmotor.com/m/xwzx/mtbd/2026/63689.shtml", "上汽集团智己汽车报道", zh="智己未单独上市；600104属于母公司上汽集团。"),
        "vehicle_sales": metric(81017, 2025, "https://www.saicmotor.com/m/xwzx/mtbd/2026/63689.shtml", "上汽集团智己汽车报道", "brand_sales"),
    },
    "rising-auto": {
        "listing": listing(False, "https://www.saicmotor.com/m/xwzx/mtbd/60554.shtml", "上汽集团飞凡业务报道", zh="飞凡处于上汽业务体系，未单独上市。"),
    },
    "gac-trumpchi": {
        "founded": founded(2008, "https://big5.sse.com.cn/site/cht/www.sse.com.cn/disclosure/listedinfo/announcement/c/new/2024-08-31/601238_20240831_M6OS.pdf", "GAC 2024 interim report", "operating_legal_entity"),
        "listing": listing(False, "https://big5.sse.com.cn/disclosure/listedinfo/announcement/c/new/2025-07-05/601238_20250705_6XVX.pdf", "GAC June 2025 sales bulletin", zh="传祺品牌及运营子公司未单独上市。"),
    },
    "hyptec": {
        "listing": listing(False, "https://gpsp.gac.com.cn/", "广汽集团采购服务平台", zh="昊铂是集团品牌，未单独上市。"),
    },
    "avatr": {
        "founded": founded(2021, "https://www.avatr.com/news?newsChId=6cf339a165e4c151a0b4566d929317d0&newsEngId=9118cc5bf81d59077fb9d26db764b190", "阿维塔科技正式定名", "entity_renaming_and_brand_creation"),
        "listing": listing(False, "https://www.avatr.com/news?newsChId=6cf339a165e4c151a0b4566d929317d0&newsEngId=9118cc5bf81d59077fb9d26db764b190", "阿维塔科技正式定名", zh="阿维塔科技未单独上市。"),
    },
    "deepal": {
        "listing": listing(False, "https://www.deepal.com.cn/202501161716/%E8%90%A5%E4%B8%9A%E6%89%A7%E7%85%A7.pdf", "深蓝汽车营业执照", zh="深蓝汽车科技有限公司未单独上市。"),
    },
    "aito": {
        "founded": founded(2021, "https://www.seres.cn/company-news/1416.html", "赛力斯与华为联合打造问界", "brand_creation"),
        "listing": listing(False, "https://www.seres.cn/", "赛力斯集团官网", zh="问界是品牌，不是独立发行人。"),
    },
    "lotus": {
        "founded": founded(1948, "https://ir.group-lotus.com/static-files/0222b8ec-e86f-4fce-ba94-1f2c53c14fcb", "Lotus Technology filing", "brand_origin"),
        "listing": listing(True, "https://www.sec.gov/Archives/edgar/data/1962746/000110465926050310/lot-20251231x20f.htm", "Lotus Technology 2025 Form 20-F", "NASDAQ", "LOT", zh="上市主体为Lotus Technology，不是英国跑车品牌法人。"),
        "employees": metric(1132, 2025, "https://www.sec.gov/Archives/edgar/data/1962746/000110465926050310/lot-20251231x20f.htm", "Lotus Technology 2025 Form 20-F", "listed_group", unit="people"),
        "vehicle_sales": metric(6520, 2025, "https://www.sec.gov/Archives/edgar/data/1962746/000110465926041704/tm2611583d1_ex99-1.htm", "Lotus Technology FY2025 results", "global_deliveries"),
    },
    "lynk-co": {
        "founded": founded(2016, "https://global.geely.com/en/news/2026/geely-full-domain-ai-auto-china-2026", "Geely at Auto China 2026", "brand_launch"),
        "listing": listing(False, "https://www.geelyauto.com.hk/wp-content/uploads/2026/04/e00175_2025-annual-report.pdf", "Geely Auto 2025 annual report", zh="领克品牌及运营法人未单独上市。"),
        "vehicle_sales": metric(350495, 2025, "https://www.geelyauto.com.hk/wp-content/uploads/2026/01/Geely_2025_Dec-sales_EN_V3.pdf", "Geely Auto December 2025 sales", "brand_sales_unaudited"),
    },
    "zeekr": {
        "founded": founded(2021, "https://global.geely.com/-/media/project/web-portal/2022/pdf-1030/geely-holding-group-sustainability-report-2021.pdf", "Geely Holding sustainability report 2021", "brand_launch"),
        "listing": listing(False, "https://www.geelyauto.com.hk/wp-content/uploads/2026/04/e00175_2025-annual-report.pdf", "Geely Auto 2025 annual report", zh="极氪已并入吉利汽车，原NYSE代码ZK不再是当前独立上市状态。"),
        "vehicle_sales": metric(224133, 2025, "https://www.geelyauto.com.hk/wp-content/uploads/2026/01/Geely_2025_Dec-sales_EN_V3.pdf", "Geely Auto December 2025 sales", "brand_sales_unaudited"),
    },
    "geely-galaxy": {
        "founded": founded(2023, "https://global.geely.com/en/news/2023/geely-auto-financial-results-2022", "Geely Auto 2022 results", "product_brand_launch"),
        "listing": listing(False, "https://global.geely.com/en/news/2026/geely-auto-record-h1-2026-revenue", "Geely Auto H1 2026 results", zh="银河是产品品牌，不是独立发行人。"),
        "vehicle_sales": metric(1235807, 2025, "https://www.geelyauto.com.hk/wp-content/uploads/2026/01/Geely_2025_Dec-sales_EN_V3.pdf", "Geely Auto December 2025 sales", "product_brand_sales_unaudited"),
    },
    "wuling": {
        "listing": listing(False, "https://lu.sgmw.com.cn/portal/details.html?id=54256", "上汽通用五菱2025销量回顾", zh="五菱品牌及运营公司未单独上市。"),
    },
})

PATCH.update({
    "sinotruk": {
        "founded": founded(1930, "https://www.cnhtc.com.cn/sinotruk/gyzq/jtjj/index.html", "中国重汽集团简介", "group_lineage", zh="1930年为谱系起点；现集团于2001年重组。"),
        "listing": listing(False, "https://www.cnhtc.com.cn/sinotruk/gyzq/jtjj/index.html", "中国重汽集团简介", zh="中国重汽集团本体未单独上市；3808.HK属于上市子公司。"),
        "ownership_evidence": own("https://www.cnhtc.com.cn/sinotruk/gyzq/jtjj/index.html", "中国重汽集团简介"),
    },
    "king-long": {
        "founded": founded(1988, "https://www.king-long.com.cn/col46/637", "金龙客车公司简介", "current_company"),
        "listing": listing(False, "https://static.cninfo.com.cn/finalpage/2025-08-28/1224598131.PDF", "金龙汽车2025年半年度报告", zh="金龙客车是子公司；600686属于母公司金龙汽车。"),
    },
    "golden-dragon": {
        "founded": founded(1992, "https://www.goldendragonbus.com/about.html", "Golden Dragon company profile", "current_company"),
        "listing": listing(False, "https://static.cninfo.com.cn/finalpage/2025-08-28/1224598131.PDF", "金龙汽车2025年半年度报告", zh="金旅客车是子公司；600686属于母公司。"),
    },
    "yutong": {
        "listing": listing(True, "https://imgwww.yutong.com/imgone/investor/constitution/2010/06/23/D801D49DA2A608B511BC4896056455C5.pdf", "宇通客车年度财务报表附注", "SSE", "600066"),
    },
    "saic-vw": {
        "founded": founded(1985, "https://volkswagengroupchina.com.cn/volkswagengroupchina/chronology", "Volkswagen Group China chronology", "current_joint_venture"),
        "listing": listing(False, "https://volkswagengroupchina.com.cn/volkswagengroupchina/chronology", "Volkswagen Group China chronology", zh="合资公司未单独上市。"),
        "vehicle_sales": metric(1024000, 2025, SAIC_SALES_2025, "SAIC Motor 2025 vehicle sales", "joint_venture_wholesale"),
    },
    "baic-foton": {
        "founded": founded(1996, "https://van.foton.com.cn/van/about/details", "福田汽车公司简介", "current_listed_company"),
        "listing": listing(True, "https://big5.sse.com.cn/site/cht/www.sse.com.cn/disclosure/listedinfo/announcement/c/new/2026-04-25/600166_20260425_LT8U.pdf", "福田汽车2025年年度报告摘要", "SSE", "600166"),
    },
    "dongfeng-cv": {
        "listing": listing(False, "https://www.dfcv.com.cn/cn/xwxq?newsId=104", "东风商用车D600工厂报道", zh="东风商用车本体未单独上市。"),
    },
    "beijing-hyundai": {
        "founded": founded(2002, "https://www.beijing-hyundai.com.cn/about/factoryreserve/", "北京现代公司简介", "current_joint_venture"),
        "listing": listing(False, "https://www.beijing-hyundai.com.cn/about/factoryreserve/", "北京现代公司简介", zh="合资公司未单独上市。"),
    },
    "saic-gm": {
        "founded": founded(1997, "https://gdpg.apps.saic-gm.com/MainPage.html?id=1&pid=1", "上汽通用公司简介", "current_joint_venture"),
        "listing": listing(False, "https://gdpg.apps.saic-gm.com/MainPage.html?id=1&pid=1", "上汽通用公司简介", zh="合资公司未单独上市。"),
        "vehicle_sales": metric(535000, 2025, SAIC_SALES_2025, "SAIC Motor 2025 vehicle sales", "joint_venture_wholesale"),
    },
    "dongfeng-honda": {
        "founded": founded(2003, "https://en.honda.com.cn/news/20241011.html", "东风Honda新能源工厂正式投产", "current_joint_venture"),
        "listing": listing(False, "https://en.honda.com.cn/news/20241011.html", "东风Honda新能源工厂正式投产", zh="合资公司未单独上市。"),
        "vehicle_sales": metric(325798, 2025, HKEX_DFM_2025, "Dongfeng Motor Group December 2025 sales bulletin", "joint_venture_wholesale"),
    },
    "bmw-brilliance": {
        "founded": founded(2003, "https://www.bmw-brilliance.cn/cn/zh/pr/index.html", "华晨宝马公司概况", "current_joint_venture"),
        "listing": listing(False, "https://www.bmw-brilliance.cn/cn/zh/pr/index.html", "华晨宝马公司概况", zh="合资公司未单独上市。"),
        "ownership_evidence": own("https://www.bmw-brilliance.cn/cn/zh/pr/index.html", "华晨宝马公司概况"),
    },
    "saic-maxus": {
        "founded": founded(2011, "https://www.saicmaxus.com/disclosure/disclosure.shtml", "上汽大通企业信息公开", "current_legal_entity_lineage"),
        "listing": listing(False, "https://www.saicmaxus.com/disclosure/disclosure.shtml", "上汽大通企业信息公开", zh="上汽大通为上汽集团全资子公司，未单独上市。"),
        "vehicle_sales": metric(222286, 2025, SAIC_SALES_2025, "SAIC Motor 2025 vehicle sales", "company_wholesale"),
        "ownership_evidence": own("https://www.saicmaxus.com/disclosure/disclosure.shtml", "上汽大通企业信息公开"),
    },
    "dongfeng-nissan": {
        "founded": founded(2003, "https://www.dongfeng-nissan.com.cn/about/enterprise/introduction", "东风日产企业简介", "current_joint_venture"),
        "listing": listing(False, "https://www.dongfeng-nissan.com.cn/about/enterprise/introduction", "东风日产企业简介", zh="东风日产乘用车公司未单独上市。"),
        "vehicle_sales": metric(600006, 2025, HKEX_DFM_2025, "Dongfeng Motor Group December 2025 sales bulletin", "wholesale_including_Venucia_and_Infiniti"),
    },
    "leapmotor": {
        "founded": founded(2015, "https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0429/2026042905422.pdf", "Leapmotor 2025 annual report", "listed_group"),
        "listing": listing(True, "https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0429/2026042905422.pdf", "Leapmotor 2025 annual report", "HKEX", "9863"),
        "employees": metric(28785, 2025, "https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0429/2026042905436.pdf", "Leapmotor 2025 ESG report", "listed_group", unit="people"),
        "vehicle_sales": metric(596555, 2025, "https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0429/2026042905422.pdf", "Leapmotor 2025 annual report", "vehicle_deliveries"),
    },
    "neta": {
        "founded": founded(2014, "https://www.hozonauto.com/brand.html?eqid=e25a67e8001ecea60000000664854da3", "哪吒汽车公司概况", "Hozon_legal_entity", zh="合众新能源成立于2014年；哪吒品牌始于2018年。"),
        "listing": listing(False, "https://www.hozonauto.com/brand.html?eqid=e25a67e8001ecea60000000664854da3", "哪吒汽车公司概况", zh="合众新能源未单独上市。"),
    },
    "caeri": {
        "founded": founded(1965, "https://www.caeri.com.cn/zgqy/zjzgqy/gsjs/", "中国汽研公司介绍", "institution_lineage", zh="1965年为机构谱系起点；2010年整体变更为股份公司。"),
        "listing": listing(True, "https://www.caeri.com.cn/zgqy/zjzgqy/gsjs/", "中国汽研公司介绍", "SSE", "601965"),
        "ownership_evidence": own("https://www.caeri.com.cn/zgqy/zjzgqy/gsjs/", "中国汽研公司介绍"),
    },
    "catarc": {
        "founded": founded(1985, "https://www.catarc.ac.cn/mobile/zxjj", "中汽中心简介", "current_group_lineage"),
        "listing": listing(False, "https://www.catarc.ac.cn/mobile/zxjj", "中汽中心简介", zh="中汽中心本体未单独上市。"),
        "ownership_evidence": own("https://www.catarc.ac.cn/mobile/zxjj", "中汽中心简介"),
    },
})

PATCH.update({
    "xpeng": {
        "founded": founded(2018, "https://www.sec.gov/Archives/edgar/data/1810997/000119312526157849/R11.htm", "XPeng 2025 Form 20-F", "current_Cayman_listed_entity", zh="上市法人2018年注册；官方企业谱系采用2014年。"),
        "listing": listing(True, "https://ir.xiaopeng.com/", "XPENG investor relations", "NYSE", "XPEV", venues=[{"exchange": "NYSE", "ticker": "XPEV"}, {"exchange": "HKEX", "ticker": "9868"}]),
        "employees": metric(19884, 2025, "https://www.sec.gov/Archives/edgar/data/1810997/000119312526157849/d36361d20f.htm", "XPeng 2025 Form 20-F", "listed_group", unit="people"),
        "vehicle_sales": metric(429445, 2025, "https://ir.xiaopeng.com/zh-hant/news-releases/news-release-details/xpeng-announces-vehicle-delivery-results-december-and-full-year", "XPENG full-year 2025 delivery release", "global_deliveries"),
    },
    "faw-toyota": {
        "founded": founded(2003, "https://www.teda.gov.cn/contents/14/84725.html", "一汽丰田2025年供应商大会", "integrated_operating_system"),
        "listing": listing(False, "https://www.toyota-global.com/company/history_of_toyota/75years/data/automotive_business/production/production/overseas/overview/china.html", "Toyota overseas production affiliates: China", zh="一汽丰田合资运营主体未单独上市。"),
        "vehicle_sales": metric(805500, 2025, "https://wap.sasac.gov.cn/n16582853/n16582883/c35254492/content.html", "国务院国资委：中国一汽2025年销量", "FAW_Toyota_sales_scope_unspecified"),
    },
    "minth": {
        "founded": founded(2005, "https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0430/2026043000295.pdf", "Minth Group 2025 annual report", "current_Cayman_listed_entity"),
        "listing": listing(True, "https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0430/2026043000295.pdf", "Minth Group 2025 annual report", "HKEX", "0425"),
        "employees": metric(27367, 2025, "https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0430/2026043000295.pdf", "Minth Group 2025 annual report", "listed_group", unit="people"),
    },
    "huaxiang": {
        "entity_boundary_note_zh": "当前图谱主体为华翔集团股份有限公司；002048及其员工数属于不同主体宁波华翔电子股份有限公司，未转填。",
        "entity_boundary_note_en": "The atlas entity is Huaxiang Group Co., Ltd.; ticker 002048 and its workforce belong to the distinct Ningbo Huaxiang Electronic Co., Ltd. and were not transferred.",
    },
    "exeed": {
        "founded": founded(2018, "https://www.exeedcars.com/world/news/754059504681029.html", "星途品牌之夜", "brand_launch"),
        "listing": listing(False, "https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0402/2026040203392.pdf", "Chery Automobile 2025 annual report", zh="星途是奇瑞品牌，不是独立发行人。"),
        "vehicle_sales": metric(120369, 2025, "https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0101/2026010100573.pdf", "Chery December 2025 sales volume", "brand_sales_unaudited"),
    },
    "jetour": {
        "founded": founded(2018, "https://jetourglobal.com/about", "JETOUR brand", "brand_launch"),
        "listing": listing(False, "https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0402/2026040203392.pdf", "Chery Automobile 2025 annual report", zh="捷途是奇瑞品牌，不是独立发行人。"),
        "vehicle_sales": metric(622590, 2025, "https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0101/2026010100573.pdf", "Chery December 2025 sales volume", "brand_sales_unaudited"),
    },
    "icar": {
        "listing": listing(False, "https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0402/2026040203392.pdf", "Chery Automobile 2025 annual report", zh="iCAR是奇瑞品牌，不是独立发行人。"),
        "vehicle_sales": metric(96989, 2025, "https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0101/2026010100573.pdf", "Chery December 2025 sales volume", "brand_sales_unaudited"),
    },
})

INSTITUTION_FOUNDING = {
    "tsinghua": (1911, "https://www.tsinghua.edu.cn/info/1011/103375.htm", "清华大学学校沿革", "institution_lineage"),
    "bit": (1940, "https://www.bit.edu.cn/gbxxgk/xxjj_sjb/index.htm", "北京理工大学学校简介", "institution_lineage"),
    "tongji": (1907, "https://www.tongji.edu.cn/info/1109/45196.htm", "同济大学学校简介", "institution_lineage"),
    "sjtu": (1896, "https://www.sjtu.edu.cn/xxjj/index.html", "上海交通大学学校简介", "institution_lineage"),
    "jlu": (1946, "https://zcyfg.jlu.edu.cn/info/1068/1511.htm", "吉林大学章程", "institution_lineage"),
    "whut": (1898, "https://www.whut.edu.cn/tongzhigonggao/202105/P020210511405036288092.pdf", "武汉理工大学校史溯源材料", "institution_lineage"),
    "hfut": (1945, "https://www.hfut.edu.cn/xxgk.htm", "合肥工业大学学校概况", "institution_lineage"),
    "changan-univ": (1951, "https://www.chd.edu.cn/xxgk/lsyg.htm", "长安大学历史沿革", "institution_lineage"),
    "hnu": (976, "https://www.hnu.edu.cn/hdgk/xxjj.htm", "湖南大学学校简介", "continuous_educational_lineage"),
    "scut": (1918, "https://www.scut.edu.cn/new/9015/list.htm", "华南理工大学学校简介", "institution_lineage"),
    "cqu": (1929, "https://www.cqu.edu.cn/xqgk/xxjj.htm", "重庆大学学校简介", "institution_lineage"),
    "cqut": (1940, "https://fgc.cqut.edu.cn/__local/0/B1/56/9CA900F9979BAAADF7C251CA787_20B661EE_1D9E53.pdf?e=.pdf", "重庆理工大学章程", "institution_lineage"),
    "caam": (1987, "https://www.caam.org.cn/", "中国汽车工业协会介绍", "association_legal_person"),
    "sae-china": (1963, "https://www.sae-china.org/base/info.html", "中国汽车工程学会简介", "association_lineage"),
    "china-ev100": (2014, "https://www.chinaev100.com/focus/detail/3", "中国电动汽车百人会在京成立", "forum_foundation"),
}
for _id, (_year, _url, _title, _scope) in INSTITUTION_FOUNDING.items():
    _ownership = "public" if _id in {"tsinghua", "bit", "tongji", "sjtu", "jlu", "whut", "hfut", "changan-univ", "hnu", "scut", "cqu", "cqut"} else "nonprofit"
    PATCH.setdefault(_id, {}).update({
        "founded": founded(_year, _url, _title, _scope),
        "ownership": _ownership,
        "ownership_evidence": own(_url, _title),
    })

_institution_ids = set(INSTITUTION_FOUNDING) | {"cada"}
EMP_NOT_DISCLOSED.update(_institution_ids)
for _id in _institution_ids:
    STATUS_OVERRIDES.setdefault(_id, {}).update({"listing": "not_applicable", "plants": "not_applicable"})
PATCH.setdefault("cada", {}).update({
    "ownership": "nonprofit",
    "ownership_evidence": own("https://www.cada.cn/Content/ueditor/net/upload/file/20210902/6376619203189347668340433.pdf", "中国汽车流通协会章程", zh="官方材料对成立年份存在1990/1991冲突，保留待核。"),
})

MEDIA_FOUNDING = {
    "autohome": (2005, "https://ir.autohome.com.cn/static-files/c5e8f096-2976-479d-8b4a-9a2951dd4ec7", "Autohome 2023 ESG report", "media_company"),
    "gasgoo": (2007, "https://auto.gasgoo.com/about.shtml", "关于盖世汽车", "website_launch"),
    "garage42": (2018, "https://www.42how.com/article/961", "关于42号车库", "media_brand"),
    "pcauto": (2002, "https://corp.pcauto.com.cn/auto_index.html", "太平洋汽车网网站介绍", "website_launch"),
    "yiche": (2000, "https://corp.yiche.com/history/", "易车发展历程", "media_company"),
    "dongchedi": (2017, "https://www.dongchedi.com/article/7526817280676872767", "懂车帝官方平台介绍", "product_launch"),
    "xcar": (2002, "https://www.xcar.com.cn/about/contact/", "爱卡汽车联系我们", "website_launch"),
    "cheshi": (1999, "https://www.cheshi.com/webcenter/about.html", "网上车市关于我们", "website_launch"),
    "sohu-auto": (2000, "https://auto.sohu.com/s2010/2010saa/", "搜狐汽车十周年", "channel_launch"),
    "d1ev": (2010, "https://www.d1ev.com/about/aboutus", "第一电动网关于我们", "website_launch"),
    "auto-business-review": (2006, "https://inabr.com/news/20919", "关于汽车商业评论", "publication_launch"),
    "chexun": (2008, "https://www.chexun.com/about/", "车讯网关于我们", "media_company_and_platform"),
    "che168": (2004, "https://ir.autohome.com.cn/about-us/", "Autohome at a glance", "website_launch"),
}
for _id, (_year, _url, _title, _scope) in MEDIA_FOUNDING.items():
    PATCH.setdefault(_id, {})["founded"] = founded(_year, _url, _title, _scope)

MEDIA_LISTING_FALSE = {
    "pcauto": ("https://corp.pcauto.com.cn/auto_index.html", "太平洋汽车网网站介绍", "频道不得继承太平洋网络0543.HK。"),
    "yiche": ("https://corp.yiche.com/about", "易车公司关于易车", "易车2020年完成私有化，历史代码不作为当前上市状态。"),
    "xcar": ("https://www.xcar.com.cn/about/contact/", "爱卡汽车联系我们", "网站不得继承历任股东证券代码。"),
    "youjia": ("https://youjia.baidu.com/pages/my/privacy", "有驾隐私政策", "百度旗下产品不得继承BIDU/9888。"),
    "cheshi": ("https://www.cheshi.com/webcenter/regulations.html", "网上车市法律声明", "网站/运营主体未单独上市。"),
    "sohu-auto": ("https://auto.sohu.com/s2010/2010saa/", "搜狐汽车十周年", "汽车频道不得继承SOHU。"),
    "sina-auto": ("https://auto.sina.com.cn/", "新浪汽车", "汽车频道不得继承新浪历史证券状态。"),
    "ifeng-auto": ("https://www.ifeng.com/corp/privacy/", "凤凰网产品个人信息保护政策", "汽车频道不得继承FENG。"),
    "tencent-auto": ("https://auto.qq.com/", "腾讯汽车", "汽车频道不得继承腾讯控股0700。"),
    "netease-auto": ("https://auto.163.com/", "网易汽车", "汽车频道不得继承NTES/9999。"),
    "nbd-auto": ("https://www.nbd.com.cn/articles/2019-01-24/1294493.html", "每日经济新闻介绍", "每经汽车频道未单独上市。"),
    "yicai-auto": ("https://www.yicai.com/others/aboutus.html", "第一财经关于我们", "汽车频道未单独上市。"),
    "chexun": ("https://www.chexun.com/about/", "车讯网关于我们", "834327属于运营法人，不赋给车讯网品牌。"),
    "che168": ("https://ir.autohome.com.cn/static-files/76ccd427-1d96-41e9-af38-667f3632ac66", "Autohome 2025 Form 20-F", "che168网站不得继承ATHM/2518。"),
    "people-auto": ("https://auto.people.com.cn/n/2014/0421/c1005-24924231.html", "人民网汽车频道新版上线", "汽车频道不得继承人民网股份603000。"),
    "xinhua-auto": ("https://www.news.cn/linktous.htm", "新华网频道列表", "汽车频道未单独上市。"),
    "cctv-auto": ("https://auto.cctv.com/", "央视网汽车频道", "汽车频道不是独立证券发行人。"),
}
for _id, (_url, _title, _note) in MEDIA_LISTING_FALSE.items():
    PATCH.setdefault(_id, {})["listing"] = listing(False, _url, _title, zh=_note)

PATCH.setdefault("autohome", {}).update({
    "listing": listing(True, "https://ir.autohome.com.cn/about-us/", "Autohome at a glance", "NYSE", "ATHM", venues=[{"exchange": "NYSE", "ticker": "ATHM"}, {"exchange": "HKEX", "ticker": "2518"}]),
    "employees": metric(4242, 2025, "https://ir.autohome.com.cn/static-files/76ccd427-1d96-41e9-af38-667f3632ac66", "Autohome 2025 Form 20-F", "listed_group", unit="people"),
})
_media_audited = {
    "autohome", "gasgoo", "garage42", "xchuxing", "pcauto", "yiche", "dongchedi", "xcar", "youjia", "cheshi", "sohu-auto", "sina-auto", "ifeng-auto", "tencent-auto", "netease-auto", "d1ev", "chedongxi", "diandong", "china-auto-news", "auto-business-review", "auto-fan", "nbd-auto", "yicai-auto", "chexun", "che168", "people-auto", "xinhua-auto", "cctv-auto",
}
EMP_NOT_DISCLOSED.update(_media_audited - {"autohome"})

# Exact-entity ownership evidence. Listed status alone is never treated as an
# ownership classification; these records are based on controller/JV disclosures.
OWNERSHIP_FACTS = {
    "audi-faw-nev": ("jv", "https://www.audi-faw-nev.com.cn/content/OneWeb/nevco/zh/about_us/company_introduction.html", "奥迪一汽公司介绍", "奥迪55%、大众中国5%、一汽40%。"),
    "gwm": ("private", "https://www.hkexnews.hk/listedco/listconews/sehk/2025/0829/2025082901570.pdf", "Great Wall Motor Interim Report 2025", "监管披露列示民营控股股东及实际控制人。"),
    "king-long": ("soe", "https://static.cninfo.com.cn/finalpage/2025-08-28/1224598131.PDF", "金龙汽车2025年半年度报告", "国资控股上市公司体系内子公司。"),
    "golden-dragon": ("soe", "https://static.cninfo.com.cn/finalpage/2025-08-28/1224598131.PDF", "金龙汽车2025年半年度报告", "国资控股上市公司体系内子公司。"),
    "yutong": ("private", "https://www.sse.com.cn/disclosure/listedinfo/announcement/c/new/2024-04-02/600066_20240402_4L1J.pdf", "宇通客车2023年年度报告", "监管披露列示自然人实际控制人。"),
    "saic-vw": ("jv", "https://volkswagengroupchina.com.cn/en/volkswagengroupchina/chronology", "Volkswagen Group China chronology", "上汽50%、大众汽车40%、大众中国10%的中德合资公司。"),
    "baic-foton": ("soe", "https://big5.sse.com.cn/site/cht/www.sse.com.cn/disclosure/listedinfo/announcement/c/new/2025-07-09/600166_20250709_OYC7.pdf", "福田汽车关联交易公告", "监管披露列示北汽集团为控股股东。"),
    "dongfeng-cv": ("jv", "https://www.volvogroup.com/cn/news-and-media/news/2015/jan/news-149035.html", "沃尔沃完成东风商用车45%股权收购", "东风与沃尔沃持股55:45；修正旧有国企单一分类。"),
    "beijing-hyundai": ("jv", "https://www.beijing-hyundai.com.cn/about/factoryreserve/", "北京现代公司简介", "北汽投资与现代汽车各持股50%。"),
    "saic-gm": ("jv", "https://www.gm.com.cn/zh/home/company/operations.html", "通用汽车中国在华业务", "通用汽车与上汽集团各持股50%。"),
    "dongfeng-honda": ("jv", "https://www.honda.com.cn/news/20161208.html", "东风本田第三工厂项目", "东风50%、本田40%、本田中国10%。"),
    "leapmotor": ("private", "https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0429/2026042905422.pdf", "Leapmotor 2025 Annual Report", "监管披露列示民营创始人一致行动股东组为最大股东。"),
    "neta": ("private", "https://www1.hkexnews.hk/app/sehk/2024/106569/documents/sehk24062600062.pdf", "Hozon New Energy Automobile Application Proof", "按最后披露的股权控制分类；公司正处法院监督重整，未将日常重整控制等同为股权变更。"),
    "xpeng": ("private", "https://www.sec.gov/Archives/edgar/data/1810997/000119312525082001/d898600d20f.htm", "XPeng 2024 Form 20-F", "监管披露列示创始人拥有过半综合投票权。"),
    "faw-toyota": ("jv", "https://www.toyota-global.com/company/history_of_toyota/75years/data/automotive_business/production/production/overseas/overview/china.html", "Toyota overseas production affiliates: China", "丰田官方列示合资生产主体及50%（含关联方）权益。"),
    "volvo-cars-chengdu": ("private", "https://www.volvocars.com/en-ca/media/this-is-volvo-cars/", "This is Volvo Cars", "按沃尔沃汽车集团最终控制口径；官网同时列示成都生产基地。"),
    "saic-maxus": ("soe", "https://www.saicmaxus.com/disclosure/disclosure.shtml", "上汽大通企业信息公开", "上汽集团全资子公司。"),
    "bmw-brilliance": ("jv", "https://www.bmw-brilliance.cn/cn/en/pr/index.html", "BMW Brilliance Company Information", "宝马集团与华晨汽车集团合资公司。"),
    "xiaomi-auto": ("private", "https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0428/2026042800526.pdf", "Xiaomi 2025 Annual Report", "按小米智能电动车业务及集团控制口径；1810.HK不下沉为境内运营公司的证券代码。"),
    "li-auto": ("private", "https://www.sec.gov/Archives/edgar/data/1791706/000110465926041705/li-20251231x20f.htm", "Li Auto Inc. 2025 Form 20-F", "按Li Auto Inc.集团口径；仓库行名不是唯一境内法定主体。"),
    "saic": ("soe", SAIC_AR_2025, "上海汽车集团股份有限公司2025年年度报告", "上海市国资委经上汽总公司控制上市公司。"),
    "changan": ("soe", "https://dxzhgl.miit.gov.cn/dxxzsp/xkz/xkzgl/resource/qiyereport.jsp?num=a8be5f05-3676-4bcf-825c-dfe111186855&type=yreport", "工信部：重庆长安汽车股份有限公司2025年企业年报公示", "企业性质公示为国有控股企业。"),
    "seres": ("private", "https://static.cninfo.com.cn/finalpage/2026-03-31/1225053031.PDF", "赛力斯集团股份有限公司2025年年度报告", "最终控制方为自然人。"),
    "jac": ("soe", "https://static.cninfo.com.cn/finalpage/2025-07-10/1224120261.PDF", "安徽江淮汽车集团股份有限公司募集说明书", "安徽省国资委为实际控制人。"),
    "nio": ("private", "https://www.sec.gov/Archives/edgar/data/1736541/000110465926041765/nio-20251231x20f.htm", "NIO Inc. 2025 Form 20-F", "按NIO Inc.集团及投票权控制口径；仓库行名为集团/品牌名。"),
    "zhengzhou-nissan": ("jv", "https://www.zznissan.com/zh/global-services/", "郑州日产全球服务", "郑州日产是中日50:50合资体系的全资子公司，不表述为本体直接50:50。"),
    "guangxi-auto": ("soe", "https://www.wuling.com.cn/", "广西汽车集团有限公司", "官网称广西区属大型国有企业；按实际控制口径分类。"),
    "tesla-china": ("foreign", "https://ir.tesla.com/_flysystem/s3/sec/000156459019026445/tsla-10q_20190630.html", "Tesla 2019 Form 10-Q — Shanghai land grant contract", "特斯拉上海法定主体被列为外商独资企业；不下沉美国母公司上市状态。"),
    "byd": ("private", "https://disc.static.szse.cn/disc/disk03/finalpage/2026-03-28/f5cdbdbf-b138-4e83-8c6d-5a7eecb9e670.PDF", "比亚迪股份有限公司2025年年度报告全文", "控股股东性质为自然人控股。"),
    "gac": ("soe", "https://www.gz.gov.cn/zwgk/zdly/gqxx/jbxx/content/post_7796069.html", "广州市国资委：广州汽车集团股份有限公司基本信息", "广州市国资委称其为国有控股股份制企业集团。"),
    "gac-honda": ("jv", "https://global.honda/en/newsroom/news/2026/c260720eng.html", "Honda extends GAC Honda joint-venture term", "广汽50%、本田40%、本田中国10%。"),
    "gac-toyota": ("jv", "https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0429/2026042902580.pdf", "GAC Group Annual Report 2025", "广汽、丰田汽车与丰田中国共同控制的合资实体；广汽持股50%。"),
    "chery": ("mixed", "https://www.hkexnews.hk/listedco/listconews/sehk/2025/0917/2025091700013.pdf", "Chery Automobile Global Offering Prospectus", "现有22名分散股东并含部分国企；招股书明确并非国有、国有控股或国有实际控制企业。"),
    "geely": ("private", "https://www.geely.com/en/news/2026/geely-holding-group-sustainability-report-2025", "Geely Holding Releases 2025 Sustainability Report", "官方称浙江吉利控股集团为民营汽车科技集团；0175.HK不转填至本行。"),
}
QUALIFIED_OWNERSHIP = {"xiaomi-auto", "li-auto", "nio", "neta"}
for _id, (_classification, _url, _title, _note) in OWNERSHIP_FACTS.items():
    _evidence = own(_url, _title, zh=_note)
    if _id in QUALIFIED_OWNERSHIP:
        _evidence["scope_quality"] = "qualified"
    PATCH.setdefault(_id, {}).update({
        "ownership": _classification,
        "ownership_evidence": _evidence,
    })

# These source-bearing 2024 metrics predate this focused 2025 pass.  Keep them
# in a checked-in input rather than depending on values already present in the
# generated output, so a clean regeneration cannot silently lose evidence.
REVIEWED_METRIC_FACTS = json.loads(
    (Path(__file__).with_name("reviewed_metric_facts.json")).read_text(encoding="utf-8")
)
SECONDARY_METRICS = {
    ("arcfox", "vehicle_sales"), ("avatr", "vehicle_sales"),
    ("bestune", "vehicle_sales"), ("deepal", "vehicle_sales"),
    ("denza", "vehicle_sales"), ("eve-energy", "employees"),
    ("fangchengbao", "vehicle_sales"), ("faw-vw", "vehicle_sales"),
    ("gac", "employees"), ("gac-trumpchi", "vehicle_sales"),
    ("hongqi", "vehicle_sales"), ("qianli", "employees"),
    ("wuling", "vehicle_sales"),
}
for _id, _field in SECONDARY_METRICS:
    REVIEWED_METRIC_FACTS[_id][_field]["source_authority"] = "secondary"
for _id, _facts in REVIEWED_METRIC_FACTS.items():
    PATCH.setdefault(_id, {}).update(_facts)


if __name__ == "__main__":
    raise SystemExit(main())
