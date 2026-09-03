#!/usr/bin/env python3
"""Merge reviewed external-source organization facts and explicit field states.

This file is intentionally hand-reviewed.  It keeps legal-entity, group and
brand scopes separate; an unavailable exact value is represented as a state,
never borrowed from a parent or rounded into a false precision.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "assets" / "data"
OUT = DATA / "org-enrichment.json"
AUDIT = Path(__file__).with_name("reviewed_entity_audit_2026_09.json")
LV = "2026-09"


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
    "上汽侧持股50%，大众汽车集团侧合计持股50%；不沿用已变化的集团内部40/10拆分。":
        "SAIC holds 50% and the Volkswagen Group side holds 50% in aggregate; the changed internal 40/10 split is not retained.",
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


def merge_patch_rows(rows: dict[str, dict]) -> None:
    """Overlay reviewed fields without discarding earlier facts for the entity."""
    for org_id, fields in rows.items():
        PATCH.setdefault(org_id, {}).update(fields)


merge_patch_rows({
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
        "founded": founded(1997, "https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0429/2026042902580.pdf", "GAC Group 2025 annual report", "current_listed_company"),
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
    "huawei-car", "calb", "dongfeng-nissan",
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
    "jiefang": {"employees"},
}

STATUS_OVERRIDES = {
    "huawei-car": {"listing": "not_applicable"},
    "qianli": {"plants": "unverified"},
    "baic": {"plants": "partial"},
    "arcfox": {"plants": "not_applicable"},
    "dongchedi": {"listing": "not_applicable"},
    "xcar": {"listing": "not_applicable"},
    "youjia": {"listing": "not_applicable"},
    "cheshi": {"listing": "not_applicable"},
    "sohu-auto": {"listing": "not_applicable"},
    "sina-auto": {"listing": "not_applicable"},
    "ifeng-auto": {"listing": "not_applicable"},
    "chedongxi": {"listing": "not_applicable"},
    "diandong": {"listing": "not_applicable"},
    # Exact brand/group boundaries from the September audit. Brand rows do not
    # inherit legal-employer headcount or factories from their parent groups.
    "gac": {"plants": "partial"},
    "gac-trumpchi": {"ownership": "not_applicable", "employees": "not_applicable", "plants": "not_applicable"},
    "hyptec": {"ownership": "not_applicable", "employees": "not_applicable", "plants": "not_applicable"},
    "im-motors": {"plants": "not_disclosed"},
    "rising-auto": {"employees": "not_applicable", "plants": "not_applicable"},
    "mg": {"employees": "not_applicable", "plants": "not_applicable"},
    "roewe": {"employees": "not_applicable", "plants": "not_applicable"},
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


def reviewed_scalar(field: str, value: object) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return int(value)
    if isinstance(value, str):
        match = re.search(r"(?:18|19|20)\d{2}", value) if field == "founded" else re.fullmatch(r"\s*(\d{1,9})\s*", value)
        return int(match.group(0 if field == "founded" else 1)) if match else None
    if not isinstance(value, dict):
        return None
    keys = {
        "founded": ("year", "approximate_year"),
        "employees": (
            "count", "people", "employees", "group_employees", "employees_lower_bound",
            "faculty_and_staff", "faculty_and_staff_lower_bound", "rd_team", "total_employees",
            "employees_total", "full_time_employees", "employees_approx", "minimum",
        ),
        "vehicle_sales": (
            "count", "vehicles", "units", "total", "deliveries", "global_deliveries", "sales_lower_bound",
            "approximate_vehicles", "special_purpose_vehicles",
        ),
    }[field]
    if field == "founded":
        for key in (
            "incorporated", "legal_entity_established", "issuer_incorporated",
            "current_group_established", "brand_launch_date", "date",
            "institutional_origin", "current_joint_stock_company",
        ):
            match = re.search(r"(?:18|19|20)\d{2}", str(value.get(key) or ""))
            if match:
                return int(match.group(0))
    for key in keys:
        candidate = value.get(key)
        if isinstance(candidate, (int, float)) and not isinstance(candidate, bool):
            return int(candidate)
    if field == "founded":
        for key in (
            "legal_entity_established_year", "joint_stock_company_established_year",
            "institutional_origin_year", "earliest_lineage_year", "academy_lineage_year",
            "legal_company_created_year", "brand_launch_year", "brand_reorganization_year",
        ):
            candidate = value.get(key)
            if isinstance(candidate, (int, float)) and not isinstance(candidate, bool):
                return int(candidate)
    return None


def reviewed_fact_year(value: object, as_of: object) -> int:
    if isinstance(value, dict) and isinstance(value.get("year"), int):
        return value["year"]
    match = re.search(r"(?:19|20)\d{2}", str(as_of or ""))
    return int(match.group(0)) if match else 2025


def reviewed_plant_count(value: object) -> int | None:
    """Return a deduplicated audited campus count when the receipt exposes one."""
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return int(value)
    if isinstance(value, list):
        return len(value)
    if not isinstance(value, dict):
        return None
    facility_ids = value.get("facility_ids")
    if isinstance(facility_ids, list):
        return len(set(str(item) for item in facility_ids if item))
    for key in (
        "count", "facility_count", "confirmed_facility_count",
        "physical_vehicle_campus_count", "official_whole_vehicle_plants",
        "active_physical_vehicle_campuses_in_six_city_scope",
        "confirmed_active_physical_vehicle_campuses_in_six_city_scope",
        "deduplicated_physical_vehicle_campuses",
    ):
        candidate = value.get(key)
        if isinstance(candidate, (int, float)) and not isinstance(candidate, bool):
            return int(candidate)
    return None


def normalized_exchange(value: object) -> str | None:
    text = str(value or "").strip().lower()
    if not text:
        return None
    if ("hong kong" in text or "hkex" in text or "香港" in text) and "rmb" in text:
        return "HKEX-RMB"
    if "hong kong" in text or "hkex" in text or "香港" in text:
        return "HKEX"
    if "shanghai" in text or text == "sse" or "上海" in text:
        return "SSE"
    if "shenzhen" in text or text == "szse" or "深圳" in text:
        return "SZSE"
    if "nasdaq" in text:
        return "NASDAQ"
    if "new york" in text or text == "nyse":
        return "NYSE"
    if "singapore" in text or text == "sgx":
        return "SGX"
    if "swiss" in text or text == "six" or "six swiss" in text:
        return "SIX"
    if "national equities" in text or "全国中小企业" in text or text == "neeq":
        return "NEEQ"
    return None


def clean_ticker(value: object) -> str | None:
    ticker = str(value or "").strip()
    if not ticker:
        return None
    return re.sub(r"\.(?:SH|SS|SZ|HK)$", "", ticker, flags=re.I)


def reviewed_listing_venues(value: object) -> list[dict]:
    """Normalize heterogeneous exchange receipts without borrowing tickers."""
    candidates: list[dict] = []
    if isinstance(value, list):
        candidates.extend(item for item in value if isinstance(item, dict))
    elif isinstance(value, dict):
        for key in ("venues", "exchanges", "listings", "securities"):
            rows = value.get(key)
            if isinstance(rows, list):
                candidates.extend(item for item in rows if isinstance(item, dict))
        if value.get("ticker") and value.get("exchange"):
            candidates.append(value)
        special = (
            ("A_share", "SZSE"),
            ("H_share", "HKEX"),
            ("GDR_symbol", normalized_exchange(value.get("GDR_exchange")) or "SIX"),
        )
        for key, exchange in special:
            if value.get(key):
                candidates.append({"exchange": exchange, "ticker": value[key]})
    venues = []
    seen = set()
    for candidate in candidates:
        raw_exchange = candidate.get("exchange") or candidate.get("market")
        exchange = normalized_exchange(raw_exchange)
        ticker = clean_ticker(
            candidate.get("ticker") or candidate.get("security_code") or candidate.get("symbol")
        )
        if not exchange and ticker:
            suffix = str(
                candidate.get("ticker") or candidate.get("security_code") or candidate.get("symbol")
            ).upper()
            exchange = "SZSE" if suffix.endswith(".SZ") else "SSE" if suffix.endswith((".SH", ".SS")) else "HKEX" if suffix.endswith(".HK") else None
        if not exchange or not ticker or exchange == "NEEQ":
            continue
        key = (exchange, ticker)
        if key in seen:
            continue
        seen.add(key)
        row = {"exchange": exchange, "ticker": ticker}
        if candidate.get("share_class"):
            row["share_class"] = candidate["share_class"]
        venues.append(row)
    return venues


def attach_field_reviews(
    enrichment: dict[str, dict], org_by_id: dict[str, dict], plant_counts: dict[str, int]
) -> None:
    """Project the compact, human-readable audit receipt into public rows.

    The reviewed ledger remains the lossless record.  The public projection
    keeps only the entity boundary, decision, caveat and first external source
    so a dash/status badge is explainable without shipping the full research
    workbench to browsers.
    """
    if not AUDIT.is_file():
        return
    audit = json.loads(AUDIT.read_text(encoding="utf-8"))
    rows = audit.get("organizations") or []
    audit_ids = {row.get("id") for row in rows if isinstance(row, dict)}
    org_ids = set(org_by_id)
    if audit_ids != org_ids:
        raise SystemExit(
            "reviewed audit/enrichment organization mismatch: "
            f"missing={sorted(org_ids - audit_ids)} extra={sorted(audit_ids - org_ids)}"
        )
    for audited in rows:
        org_id = audited["id"]
        compact_fields = {}
        for field, decision in (audited.get("fields") or {}).items():
            sources = decision.get("sources") or []
            accepted_sources = [
                item for item in sources
                if item.get("evidence_role") != "lead_only"
                and str(item.get("url") or "").startswith(("http://", "https://"))
            ]
            preferred_url = decision.get("preferred_source_url")
            source = next(
                (item for item in accepted_sources if item.get("url") == preferred_url),
                accepted_sources[0] if accepted_sources else {},
            )
            compact = {
                "status": decision.get("status"),
                "scope": decision.get("scope"),
                "as_of": decision.get("as_of"),
                "note_zh": decision.get("note_zh") or "",
                "note_en": decision.get("note_en") or "",
                "caveat_zh": decision.get("caveat_zh") or "",
                "caveat_en": decision.get("caveat_en") or "",
            }
            if source.get("url"):
                compact["source_url"] = source["url"]
                compact["source_title"] = source.get("title") or "Reviewed external source"
                compact["source_publisher"] = source.get("publisher") or ""
                compact["source_date"] = source.get("published_or_fact_date")
                compact["source_accessed_at"] = source.get("accessed_at")
            compact_fields[field] = compact
            if field == "plants":
                audited_count = reviewed_plant_count(decision.get("value"))
                mapped_count = int(plant_counts.get(org_id, 0))
                compact_fields[field]["value_count"] = mapped_count
                compact_fields[field]["mapped_value_count"] = mapped_count
                if audited_count is not None:
                    compact_fields[field]["audit_value_count"] = audited_count
        enrichment[org_id]["field_reviews"] = compact_fields
        enrichment[org_id]["audit_boundary_zh"] = audited.get("entity_boundary_zh") or ""
        enrichment[org_id]["audit_boundary_en"] = audited.get("entity_boundary_en") or ""
        enrichment[org_id]["audit_reviewed_at"] = audit.get("metadata", {}).get("reviewed_at")
        # The audit receipt is authoritative. Project only scalar shapes that
        # have an unambiguous public representation, while retaining every
        # qualifier and entity boundary in the field review.
        availability = enrichment[org_id].get("availability") or {}
        for field in ("founded", "employees"):
            decision = (audited.get("fields") or {}).get(field) or {}
            review = compact_fields[field]
            enrichment[org_id].pop(field, None)
            if review["status"] not in {"verified", "partial"} or not review.get("source_url"):
                continue
            scalar = reviewed_scalar(field, decision.get("value"))
            if scalar is None:
                continue
            note_zh = review["note_zh"] or "该值按审计记录中的实体与时间口径展示。"
            note_en = review["note_en"] or "The value follows the entity and time scope in the reviewed audit record."
            if review.get("scope"):
                note_zh = f"审计口径与实体边界详见字段审计记录。{note_zh}"
                note_en = f"Audit scope: {review['scope']}. {note_en}"
            if field == "founded":
                enrichment[org_id][field] = founded(
                    scalar, review["source_url"], review["source_title"] or "Reviewed first-party source",
                    "reviewed_exact_entity", zh=note_zh, en=note_en,
                )
            else:
                raw_value = decision.get("value")
                raw_qualifier = raw_value.get("qualifier") if isinstance(raw_value, dict) else None
                qualifier = {
                    "approximately": "approximately", "approximate": "approximately",
                    "more_than": "more_than", "over": "more_than",
                }.get(raw_qualifier)
                if isinstance(raw_value, dict) and (
                    "minimum" in raw_value or any(key.endswith("_lower_bound") for key in raw_value)
                ):
                    qualifier = "more_than"
                enrichment[org_id][field] = metric(
                    scalar, reviewed_fact_year(raw_value, decision.get("as_of")),
                    review["source_url"], review["source_title"] or "Reviewed first-party source",
                    "reviewed_exact_entity", zh=note_zh, en=note_en,
                    unit="people" if field == "employees" else "vehicles",
                    qualifier=qualifier,
                )
            availability[field] = review["status"]

        # Listing values and their citations come from the same reviewed
        # decision. This prevents an older patch source from becoming a
        # parallel provenance authority.
        listing_decision = (audited.get("fields") or {}).get("listing") or {}
        listing_review = compact_fields["listing"]
        enrichment[org_id].pop("listing", None)
        if listing_review.get("source_url") and listing_review["status"] in {
            "verified", "not_separately_listed"
        }:
            raw_listing = listing_decision.get("value")
            note_zh = listing_review["note_zh"] or listing_review["caveat_zh"]
            note_en = listing_review["note_en"] or listing_review["caveat_en"]
            if listing_review["status"] == "not_separately_listed":
                projected_listing = listing(
                    False, listing_review["source_url"], listing_review["source_title"],
                    zh=note_zh, en=note_en,
                )
                if isinstance(raw_listing, dict):
                    raw_status = str(raw_listing.get("status") or "").lower()
                    quotation_ticker = clean_ticker(
                        raw_listing.get("security_code") or raw_listing.get("ticker")
                    )
                    if quotation_ticker and (
                        "neeq" in raw_status
                        or normalized_exchange(raw_listing.get("market")) == "NEEQ"
                    ):
                        projected_listing["quotation"] = {
                            "exchange": "NEEQ", "ticker": quotation_ticker,
                        }
                    if raw_listing.get("former_listing"):
                        projected_listing["former_listing"] = raw_listing["former_listing"]
                enrichment[org_id]["listing"] = projected_listing
            else:
                venues = reviewed_listing_venues(raw_listing)
                if venues:
                    enrichment[org_id]["listing"] = listing(
                        True, listing_review["source_url"], listing_review["source_title"],
                        venues[0]["exchange"], venues[0]["ticker"],
                        zh=note_zh, en=note_en, venues=venues,
                    )

        # Exact reviewed sales values are projected. Partial values remain
        # audit-only unless independent review explicitly selected one scoped
        # primary measure while retaining an unreconciled alternate.
        sales_decision = (audited.get("fields") or {}).get("vehicle_sales") or {}
        sales_review = compact_fields["vehicle_sales"]
        enrichment[org_id].pop("vehicle_sales", None)
        sales_projection_allowed = (
            sales_review["status"] == "verified"
            or bool(sales_decision.get("public_projection_allowed"))
        )
        if sales_projection_allowed and sales_review.get("source_url"):
            scalar = reviewed_scalar("vehicle_sales", sales_decision.get("value"))
            if scalar is not None:
                note_zh = sales_review["note_zh"] or "该值按审计记录中的实体与销量口径展示。"
                note_en = sales_review["note_en"] or "The value follows the entity and sales scope in the reviewed audit record."
                projected_sales = metric(
                    scalar, reviewed_fact_year(sales_decision.get("value"), sales_decision.get("as_of")),
                    sales_review["source_url"], sales_review.get("source_title") or "Reviewed first-party source",
                    "reviewed_exact_entity",
                    zh=note_zh, en=note_en,
                )
                projected_sales["non_additive"] = True
                projected_sales["aggregation_level"] = (
                    "brand" if org_by_id[org_id].get("organization_type") == "brand"
                    else "reported_entity_scope"
                )
                enrichment[org_id]["vehicle_sales"] = projected_sales
                availability["vehicle_sales"] = sales_review["status"]
        ownership_decision = (audited.get("fields") or {}).get("ownership") or {}
        ownership_review = compact_fields["ownership"]
        if ownership_review["status"] in {"verified", "partial"} and ownership_review.get("source_url"):
            enrichment[org_id]["ownership_evidence"] = own(
                ownership_review["source_url"],
                ownership_review.get("source_title") or "Reviewed first-party source",
                zh=ownership_review["note_zh"], en=ownership_review["note_en"],
            )
            # Brands and editorial products have affiliation/control-chain
            # facts, not a standalone generic ownership category. Removing the
            # inherited scalar prevents a parent SOE/private label leaking in.
            if org_by_id[org_id].get("organization_type") in {"brand", "media_company"} or org_id == "calb":
                enrichment[org_id].pop("ownership", None)
        # The completed audit is authoritative for the current decision state,
        # including when an older scoped value remains visible for context.
        for field, review in compact_fields.items():
            availability[field] = review["status"]
            if review["status"] in {"not_applicable", "not_disclosed", "unverified"} and field == "ownership":
                enrichment[org_id].pop("ownership", None)
                enrichment[org_id].pop("ownership_evidence", None)
            elif review["status"] in {"not_applicable", "not_disclosed", "unverified"} and field in {
                "founded", "listing", "employees", "vehicle_sales"
            }:
                enrichment[org_id].pop(field, None)
        # A combined multi-brand clue or regional fragment must never replace a
        # standalone entity total, even when it is useful enough to retain as a
        # partial audit note.
        if org_id in {"denza", "fangchengbao", "yangwang", "mg"}:
            enrichment[org_id].pop("vehicle_sales", None)
        enrichment[org_id]["availability"] = availability


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
        explicit_city_org.add((facility["city_id"], org_id))
        if facility.get("status") in {"closed", "converted"}:
            continue
        plant_counts[org_id] = plant_counts.get(org_id, 0) + 1
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

    attach_field_reviews(enrichment, org_by_id, plant_counts)

    # A vehicle-sales row is an independently scoped disclosure, never a
    # component of a cross-row total. Keep this machine-readable on every
    # projected metric so the UI and tests cannot silently regress.
    for row in enrichment.values():
        sales = row.get("vehicle_sales")
        if isinstance(sales, dict):
            sales["non_additive"] = True
            sales.setdefault("aggregation_level", "reported_entity_scope")

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
merge_patch_rows({
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

merge_patch_rows({
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

merge_patch_rows({
    "hongqi": {
        "founded": founded(1958, "https://www.faw.com.cn/fawcn/373696/5133380/5133398/index.html", "红旗品牌", "brand_launch"),
        "listing": listing(False, "https://www.faw.com.cn/fawcn/373696/5133380/5133398/index.html", "红旗品牌", zh="红旗是品牌，不是独立发行人。"),
    },
    "jiefang": {
        "founded": founded(1956, "https://www.fawjiefang.com.cn/fawjiefang/gywm12/gsjj/hhlc/index.html", "一汽解放辉煌历程", "brand_birth"),
        "listing": listing(False, "https://disc.static.szse.cn/disc/disk03/finalpage/2026-03-28/892a44c3-cdab-403f-9d60-8fc183527dab.PDF", "一汽解放集团股份有限公司2025年年度报告", zh="000800属于一汽解放集团股份有限公司，不属于“解放”品牌行。", en="Ticker 000800 belongs to FAW Jiefang Group Co., Ltd., not the Jiefang brand row."),
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

merge_patch_rows({
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

merge_patch_rows({
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
    "autohome": ("private", "https://ir.autohome.com.cn/static-files/76ccd427-1d96-41e9-af38-667f3632ac66", "Autohome 2025 Form 20-F", "2025年股权交割后，海尔集团子公司CARTECH成为控股股东；年末持股43.4%。"),
    "yiche": ("private", "https://corp.yiche.com/history/", "易车发展历程", "易车2020年11月完成私有化，并在官方沿革中称成为腾讯大家庭一员；不沿用历史NYSE上市状态。"),
    "dongchedi": ("private", "https://open.dongchedi.com/draft/ies-hotsoon-draft/dcar_open_platform/e2fd2cfd-cf01-4ebc-a483-79fd1024c3c4.html", "懂车帝企业开放平台用户服务协议", "平台协议列北京空间变换科技有限公司为运营方；按字节跳动产品体系记录，不把母集团证券或员工下沉。"),
    "xcar": ("private", "https://www.xcar.com.cn/about/contact/", "爱卡汽车联系我们", "当前一手页脚由上海汉玄文化传播有限公司署名；北京总部归属仍待独立核验。"),
    "youjia": ("private", "https://youjia.baidu.com/yunying2/static/privacy.html", "有驾隐私政策", "有驾服务由北京百度网讯科技有限公司运营；产品行不继承百度证券代码或集团员工。"),
    "cheshi": ("private", "https://www.cheshi.com/webcenter/service.html", "网上车市网络服务协议及隐私权声明", "现行协议列枞树（北京）科技有限公司为运营方；媒体品牌不继承关联方证券或员工。"),
    "sohu-auto": ("private", "https://mobile.auto.sohu.com/policy/index.html", "搜狐汽车隐私政策", "搜狐汽车由北京搜狐互联网信息服务有限公司运营；频道行不继承SOHU证券或集团员工。"),
    "sina-auto": ("private", "https://corp.sina.com.cn/chn/sina_item.html", "新浪网络服务使用协议", "新浪汽车属于新浪网络内容体系；频道行不继承集团或历史上市状态。"),
    "ifeng-auto": ("private", "https://www.ifeng.com/corp/privacy/", "凤凰网产品个人信息保护政策", "凤凰网产品政策列北京天盈九州网络技术有限公司及关联方为服务方；频道行不继承FENG证券或集团员工。"),
    "d1ev": ("private", "https://www.d1ev.com/about/aboutus", "第一电动网关于我们", "官网列北京智电未来信息科技有限公司为运营方、庞义成为创始人；融资沿革不等同当前精确股权比例。"),
    "chedongxi": ("private", "https://chedongxi.com/about", "关于车东西", "车东西是北京智一科技有限公司运营的媒体品牌；不把公司外其他平台信息混入。"),
    "diandong": ("private", "https://m.diandong.com/stage/privacy.html", "电动邦隐私政策", "隐私政策列电动邦科技（北京）有限公司为运营方；最终受益所有权未由该页披露。"),
    "chexun": ("private", "https://www.neeq.com.cn/disclosure/2026/2026-08-20/3f8597ed612f4a199979a70629ac5799.pdf", "北京车讯互联网股份有限公司2026年半年度报告", "报告列綦琳为控股股东和实际控制人，持股66.06%；公司在全国股转系统挂牌。"),
    "dongfeng-nissan": ("jv", "https://www.nissan-global.com/EN/COMPANY/PROFILE/EN_ESTABLISHMENT/ASIA.html", "Nissan production sites in Asia", "东风日产乘用车公司是东风汽车有限公司体系内业务单元；其母体由东风与日产各持50%，不表述为业务单元本体直接50:50。"),
    "audi-faw-nev": ("jv", "https://www.audi-faw-nev.com.cn/content/OneWeb/nevco/zh/about_us/company_introduction.html", "奥迪一汽公司介绍", "奥迪55%、大众中国5%、一汽40%。"),
    "gwm": ("private", "https://www.hkexnews.hk/listedco/listconews/sehk/2025/0829/2025082901570.pdf", "Great Wall Motor Interim Report 2025", "监管披露列示民营控股股东及实际控制人。"),
    "king-long": ("soe", "https://static.cninfo.com.cn/finalpage/2025-08-28/1224598131.PDF", "金龙汽车2025年半年度报告", "国资控股上市公司体系内子公司。"),
    "golden-dragon": ("soe", "https://static.cninfo.com.cn/finalpage/2025-08-28/1224598131.PDF", "金龙汽车2025年半年度报告", "国资控股上市公司体系内子公司。"),
    "yutong": ("private", "https://www.sse.com.cn/disclosure/listedinfo/announcement/c/new/2024-04-02/600066_20240402_4L1J.pdf", "宇通客车2023年年度报告", "监管披露列示自然人实际控制人。"),
    "saic-vw": ("jv", "https://annualreport2025.volkswagen-group.com/notes/basis-of-presentation/basis-of-consolidation.html", "Volkswagen Group Annual Report 2025 — basis of consolidation", "上汽侧持股50%，大众汽车集团侧合计持股50%；不沿用已变化的集团内部40/10拆分。"),
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
OWNERSHIP_NOTE_EN = {
    "autohome": "After the 2025 share transfer, Haier subsidiary CARTECH became the controlling shareholder and held 43.4% at year-end.",
    "yiche": "Yiche completed privatization in November 2020 and its official history describes it as joining the Tencent family; the former NYSE status is not carried forward.",
    "dongchedi": "The platform agreement names Beijing Space Transformation Technology as operator; the row is a ByteDance-ecosystem product and does not inherit parent securities or employees.",
    "xcar": "The current first-party footer names Shanghai Hanxuan Culture Communication; the Beijing-headquarters assignment remains pending separate verification.",
    "youjia": "Youjia is operated by Beijing Baidu Netcom Science Technology; the product row does not inherit Baidu tickers or group headcount.",
    "cheshi": "The current agreement names Zongshu (Beijing) Technology as operator; the media brand does not inherit affiliate securities or employees.",
    "sohu-auto": "Sohu Auto is operated by Beijing Sohu Internet Information Service; the channel row does not inherit SOHU securities or group headcount.",
    "sina-auto": "Sina Auto belongs to Sina's content network; the channel row does not inherit group or historical listing status.",
    "ifeng-auto": "Phoenix's product policy names Beijing Tianying Jiuzhou Network Technology and affiliates as service providers; the channel row does not inherit FENG securities or group headcount.",
    "d1ev": "The official profile names Beijing Zhidian Future Information Technology as operator and Pang Yicheng as founder; financing history is not treated as a current exact ownership percentage.",
    "chedongxi": "Chedongxi is a media brand operated by Beijing Zhiyi Technology; unrelated platform information is excluded.",
    "diandong": "The privacy policy names Diandongbang Technology (Beijing) as operator; ultimate beneficial ownership is not disclosed by that page.",
    "chexun": "The filing identifies Qi Lin as controlling shareholder and ultimate controller with 66.06%; the company is quoted on NEEQ.",
    "dongfeng-nissan": "Dongfeng Nissan Passenger Vehicle Company is a business unit within Dongfeng Motor Co., Ltd.; its parent is held 50:50 by Dongfeng and Nissan, not the business unit itself directly.",
}
for _id, (_classification, _url, _title, _note) in OWNERSHIP_FACTS.items():
    _evidence = own(_url, _title, zh=_note, en=OWNERSHIP_NOTE_EN.get(_id, ""))
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
    ("bestune", "vehicle_sales"),
    ("faw-vw", "vehicle_sales"),
    ("gac-trumpchi", "vehicle_sales"),
    ("hongqi", "vehicle_sales"),
    ("wuling", "vehicle_sales"),
}
for _id, _field in SECONDARY_METRICS:
    REVIEWED_METRIC_FACTS[_id][_field]["source_authority"] = "secondary"
for _id, _facts in REVIEWED_METRIC_FACTS.items():
    PATCH.setdefault(_id, {}).update(_facts)

# September deep-audit refresh. These facts were independently rechecked at
# the exact row scope; newer annual disclosures supersede the retained 2024
# metrics above.
FOTON_AR_2025 = "https://static.cninfo.com.cn/finalpage/2026-04-25/1225194454.PDF"
BAIDU_20F_2025 = "https://ir.baidu.com/static-files/f655f8c4-bfaa-41c5-872c-005087bce94f"
_SEPTEMBER_FACTS = {
    "baic-foton": {
        "employees": metric(
            22724, 2025, FOTON_AR_2025, "BAIC Foton 2025 annual report",
            "listed_group", unit="people",
            zh="合并口径在职员工22,724人：母公司16,637人，主要子公司6,087人。",
            en="Consolidated headcount is 22,724: 16,637 at the parent and 6,087 at major subsidiaries.",
        ),
        "vehicle_sales": metric(
            650053, 2025, FOTON_AR_2025, "BAIC Foton 2025 annual report",
            "group_sales_including_reported_passenger_vehicles",
            zh="年报披露公司2025年总销量650,053辆，其中乘用车8,344辆。",
            en="The annual report discloses 650,053 total vehicle sales in 2025, including 8,344 passenger vehicles.",
        ),
        "ownership_evidence": own(
            FOTON_AR_2025, "BAIC Foton 2025 annual report",
            zh="年报披露北汽集团持股40.84%，实际控制人为北京市国资委；国有控股不等于100%国有。",
            en="The annual report identifies BAIC Group as a 40.84% shareholder and Beijing SASAC as ultimate controller; state control does not mean 100% state ownership.",
        ),
    },
    "beijing-benz": {
        "ownership": "jv",
        "ownership_evidence": own(
            "https://www.baicmotor.com/Uploads/file/20260527/20260527154414_79541.pdf",
            "BAIC Motor 2025 annual report",
            zh="北京汽车股份持51%，梅赛德斯-奔驰相关方合计持49%。",
            en="BAIC Motor holds 51%, while Mercedes-Benz-related parties hold 49% in aggregate.",
        ),
    },
    "beijing-hyundai": {
        "vehicle_sales": metric(
            125726, 2025,
            "https://www.hyundai.com/worldwide/en/newsroom/detail/0000001111",
            "Hyundai Motor 2025 global retail sales results",
            "joint_venture_retail_sales",
            zh="现代汽车官方结果将中国区口径明确列为北京现代零售125,726辆。",
            en="Hyundai Motor's official results explicitly report 125,726 China retail sales for Beijing Hyundai.",
        ),
    },
    "arcfox": {
        "ownership": "soe",
        "ownership_evidence": own(
            "https://www.bjev.com.cn/public/upload/file/20260429/f4387e48d7324adb774a2689ea7595b0.pdf",
            "BAIC BluePark 2025 annual report",
            zh="极狐运营主体为北汽蓝谷100%持有的子公司；分类按国资最终控制口径。",
            en="The Arcfox operating entity is wholly owned by BAIC BluePark; classification follows ultimate state control.",
        ),
        "vehicle_sales": metric(
            163000, 2025,
            "https://www.baicgroup.com.cn/baicgroup/News/NewsShort/2026/1/I1464293603709812736.html",
            "BAIC Group 2025 annual results",
            "brand_sales", qualifier="approximately",
            zh="北汽集团官方年度成绩单披露极狐2025年销量16.3万辆。",
            en="BAIC Group's official annual results disclose 163,000 Arcfox sales in 2025.",
        ),
    },
    "horizon-robotics": {
        "ownership": "private",
        "ownership_evidence": own(
            "https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0430/2026043001830.pdf",
            "Horizon Robotics 2025 annual report",
            zh="上市公司采用加权投票权架构，创始人余凯为加权投票权受益人；按非国有最终控制口径分类。",
            en="The listed company uses a weighted-voting-rights structure with founder Kai Yu as beneficiary; classification follows non-state ultimate control.",
        ),
    },
    "baidu": {
        "ownership": "private",
        "ownership_evidence": own(
            BAIDU_20F_2025, "Baidu 2025 Form 20-F",
            zh="百度是上市公众公司，同时通过双重股权架构保留创始人投票权影响；本字段按非国有最终控制口径分类。",
            en="Baidu is a publicly listed company with founder voting influence through a dual-class structure; this field classifies non-state ultimate control.",
        ),
    },
    "sae-china": {
        "employees": metric(
            140, 2026, "https://www.sae-china.org/base/info.html",
            "China SAE profile", "association_secretariat_staff", unit="people",
            qualifier="more_than",
            zh="官网披露秘书处在职人员140余人，不含个人会员与团体会员。",
            en="The official profile reports more than 140 active secretariat staff, excluding individual and institutional members.",
        ),
    },
    "bit": {
        "employees": metric(
            6041, 2025, "https://www.bit.edu.cn/gbxxgk/sjfb_sjb/index.htm",
            "Beijing Institute of Technology data dashboard",
            "university_staff_total", unit="people",
            zh="校方数据页披露教职工总数6,041人，其中全职专任教师2,508人；数据截至2025年9月。",
            en="The university dashboard reports 6,041 staff, including 2,508 full-time faculty, as of September 2025.",
        ),
    },
    "tsinghua": {
        "employees": metric(
            17382, 2025, "https://www.tsinghua.edu.cn/xxgk/tjzl.htm",
            "Tsinghua University statistics",
            "university_staff_total", unit="people",
            zh="教职工总数17,382人，含教师3,939人、其他职工9,989人和博士后3,454人；数据截至2025年12月31日。",
            en="Total staff is 17,382, including 3,939 teachers, 9,989 other staff and 3,454 postdoctoral researchers, as of December 31, 2025.",
        ),
    },
    "gac": {
        "employees": metric(
            82067, 2025,
            "https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0429/2026042902580.pdf",
            "GAC Group 2025 annual report",
            "group_extended_scope_including_jv_associates", unit="people",
            zh="年报员工表列集团层面334人、主要子公司81,733人，合计82,067人；表下注明统计包含合营及联营企业。",
            en="The annual-report employee table reports 334 group-level staff and 81,733 at major subsidiaries, totaling 82,067; its note says the scope includes joint ventures and associates.",
        ),
        "ownership_evidence": own(
            "https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0429/2026042902580.pdf",
            "GAC Group 2025 annual report",
            zh="控股股东广州汽车工业集团持有54.02%；按广州市国资最终控制口径分类，国有控股不等于全资国有。",
            en="Controlling shareholder Guangzhou Automobile Industry Group holds 54.02%; classification follows ultimate Guangzhou state control and does not imply full state ownership.",
        ),
    },
    "gac-honda": {
        "employees": metric(
            9500, 2024, "https://global.honda/en/newsroom/news/2024/c241223eng.html",
            "GAC Honda begins operation of new NEV production factory",
            "joint_venture_associates", unit="people", qualifier="approximately",
            zh="本田公司概览披露截至2024年12月广汽本田约9,500名员工；新能源厂约700人为其中子集，不重复相加。",
            en="Honda's company overview reports approximately 9,500 GAC Honda associates as of December 2024; about 700 at the NEV plant are a subset and are not added again.",
        ),
    },
    "gac-aion": {
        "founded": founded(
            2017, "https://sthjj.gz.gov.cn/attachment/7/7761/7761656/10116546.pdf",
            "GAC Aion battery-technology project environmental filing",
            "current_legal_entity", zh="监管文件记载广汽埃安成立于2017年7月28日。",
            en="The regulatory filing records GAC Aion's establishment on July 28, 2017.",
        ),
        "ownership": "mixed",
        "ownership_evidence": own(
            "https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0429/2026042902580.pdf",
            "GAC Group 2025 annual report",
            zh="广汽集团直接持有65%、经子公司间接持有12%，有效权益77%；按广汽控股的混合所有制公司记录。",
            en="GAC Group holds 65% directly and 12% indirectly, for a 77% effective interest; the row is classified as a GAC-controlled mixed-ownership company.",
        ),
    },
    "gac-trumpchi": {
        "founded": founded(
            2010, "https://www.gacgroup.com/cn/about/story", "GAC brand story",
            "brand_launch", zh="本行是传祺品牌，采用2010年首款传祺车下线的品牌诞生口径，不采用运营公司2008年成立日。",
            en="This row represents the Trumpchi brand and uses the 2010 first-vehicle milestone as its launch, not the operating company's 2008 incorporation.",
        ),
        "ownership_evidence": own(
            "https://www.gacgroup.com/cn/about/story", "GAC brand story",
            zh="传祺按广汽集团品牌边界记录；不把集团级员工或工厂直接复制到品牌行。",
            en="Trumpchi is recorded at the GAC Group brand boundary; group-level employees and plants are not copied into the brand row.",
        ),
    },
    "hyptec": {
        "founded": founded(
            2022, "https://www.gacgroup.com/cn/news/detail?baseid=18478",
            "GAC launches the Hyper premium line and Hyper SSR", "brand_launch",
            zh="以2022年9月15日Hyper高端序列正式发布为品牌起点；后续更名昊铂不另造成立年。",
            en="The brand lineage starts with the formal Hyper premium-line launch on September 15, 2022; the later Hyptec renaming does not create a new founding year.",
        ),
        "ownership_evidence": own(
            "https://www.gacgroup.com/cn/news/detail?baseid=18478",
            "GAC launches the Hyper premium line and Hyper SSR",
            zh="昊铂是广汽埃安旗下品牌；不继承母公司的员工、上市代码或工厂数。",
            en="Hyptec is a GAC Aion brand and does not inherit its parent's employees, ticker, or plant count.",
        ),
    },
    "pony-ai": {
        "listing": listing(
            True,
            "https://www.sec.gov/Archives/edgar/data/1969302/000110465926034888/tm269906d1_ex99-2.htm",
            "Pony AI 2025 annual results announcement", "NASDAQ", "PONY",
            venues=[{"exchange": "NASDAQ", "ticker": "PONY"}, {"exchange": "HKEX", "ticker": "2026"}],
        ),
        "ownership": "private",
        "ownership_evidence": own(
            "https://ir.pony.ai/static-files/c4d1947c-6b98-455b-979f-39063cd15e4d",
            "Pony AI 2025 Form 20-F",
            zh="截至2026年3月31日，两位创始人通过双层股权合计拥有69.7%投票权；分类表示非国有控制，并非未上市公司。",
            en="As of March 31, 2026, the two founders held 69.7% of voting power through the dual-class structure; the classification denotes non-state control, not an unlisted company.",
        ),
    },
    "weiride": {
        "listing": listing(
            True, "https://ir.weride.ai/node/8631/html", "WeRide 2025 annual report",
            "NASDAQ", "WRD", venues=[{"exchange": "NASDAQ", "ticker": "WRD"}, {"exchange": "HKEX", "ticker": "0800"}],
        ),
        "ownership": "private",
        "ownership_evidence": own(
            "https://www.sec.gov/Archives/edgar/data/1867729/000110465926047323/wrd-20251231x20f.htm",
            "WeRide 2025 Form 20-F",
            zh="两位创始人持有全部B类股，合计经济权益5.4%、投票权36.6%；记录为创始人具有重大投票影响的公众公司。",
            en="The two founders hold all Class B shares, with 5.4% combined economic interest and 36.6% voting power; this is recorded as a public company with material founder voting influence.",
        ),
        "employees": metric(
            3661, 2025, "https://ir.weride.ai/node/8631/html", "WeRide 2025 annual report",
            "listed_group_full_time_employees", unit="people",
            zh="年报披露3,661名全职员工；另有140名临时人员和实习生，因不属于同一员工口径不合并为3,801。",
            en="The annual report discloses 3,661 full-time employees plus 140 temporary workers and interns; the latter are not merged into the employee count.",
        ),
    },
    "saic-vw": {
        "founded": founded(
            1984, "https://www.shanghai.gov.cn/nw15343/20250725/9becfc0d9c8d4c54a690397bcf68cee9.html",
            "Jiading government profile of SAIC Volkswagen", "current_joint_venture",
            zh="嘉定区政府资料明确上汽大众汽车有限公司成立于1984年10月；修正原先1985年候选。",
            en="Jiading government material states that SAIC Volkswagen Automotive Co., Ltd. was established in October 1984, correcting the former 1985 candidate.",
        ),
    },
    "im-motors": {
        "founded": founded(
            2020, "https://www.shanghai.gov.cn/nw15343/20250409/82f5fcec94124a0fba6697d48e7f76f7.html",
            "Shanghai government profile of IM Motors", "current_legal_entity",
            zh="上海市政府资料记载智己汽车科技有限公司成立于2020年12月。",
            en="Shanghai government material records IM Motors Technology Co., Ltd. as established in December 2020.",
        ),
        "ownership": "mixed",
        "ownership_evidence": own(
            SAIC_AR_2025, "SAIC Motor 2025 annual report",
            zh="上汽直接持股7.75%、间接持股42.52%，合计控制50.27%；采用当前控制口径，不沿用初始股东宣传结构。",
            en="SAIC holds 7.75% directly and 42.52% indirectly, controlling 50.27% in aggregate; the current control basis supersedes the launch-era shareholder description.",
        ),
    },
    "rising-auto": {
        "founded": founded(
            2021, "https://www.saicmotor.com/m/xwzx/xwk/2021/56164.shtml",
            "SAIC announces Rising Auto", "brand_launch",
            zh="飞凡汽车品牌于2021年10月29日正式发布；运营公司投资公告日期另行区分。",
            en="The Rising Auto brand was formally launched on October 29, 2021; the operating-company investment announcement is a separate date.",
        ),
        "ownership": "soe",
        "ownership_evidence": own(
            SAIC_AR_2025, "SAIC Motor 2025 annual report",
            zh="年报列飞凡汽车科技有限公司为上汽集团100%持有子公司；品牌本身不继承法人级员工和工厂。",
            en="The annual report lists Rising Auto Technology Co., Ltd. as 100% held by SAIC; the brand itself does not inherit legal-entity employees or plants.",
        ),
    },
    "mg": {
        "ownership": "soe",
        "ownership_evidence": own(
            "https://www.saicmotor.com/chinese/history/r1.html", "SAIC Motor MG brand history",
            zh="上汽官网明确列示MG品牌归属上海汽车集团股份有限公司，并记录2007年上南合作后的品牌归属。",
            en="SAIC's official history identifies MG as a SAIC Motor brand and records its ownership after the 2007 SAIC–Nanjing Auto integration.",
        ),
    },
    "roewe": {
        "ownership": "soe",
        "ownership_evidence": own(
            "https://www.saicmotor.com/chinese/history/q1.html", "SAIC Motor Roewe brand history",
            zh="上汽官网明确列示荣威品牌归属上海汽车集团股份有限公司。",
            en="SAIC's official history explicitly identifies Roewe as a brand belonging to SAIC Motor.",
        ),
    },
    "sjtu": {
        "employees": metric(
            11620, 2026, "https://www.sjtu.edu.cn/xxjj/index.html",
            "Shanghai Jiao Tong University profile", "university_staff_total", unit="people",
            zh="当前学校简介列教职工11,620人，其中专任教师4,257人；页面未给单一统计截止日。",
            en="The current university profile lists 11,620 faculty and staff, including 4,257 full-time faculty; the page gives no single cutoff date.",
        ),
    },
    "tongji": {
        "employees": metric(
            5579, 2026, "https://www.tongji.edu.cn/xxgk1/tjgl.htm",
            "Tongji University statistics overview", "university_staff_total", unit="people",
            zh="统计概览列教职员工5,579人、专任教师3,206人；页面包含2025年度指标且学校简介称相关统计更新至2026年5月。",
            en="The statistics overview lists 5,579 faculty and staff, including 3,206 full-time faculty; it includes 2025 indicators and the profile says related statistics were updated through May 2026.",
        ),
    },
    "sina-auto": {
        "founded": founded(
            2000, "https://auto.sina.com.cn/beijingchezhan/2010/sinaauto/",
            "新浪汽车十年", "channel_launch",
            zh="新浪汽车官方十周年回顾将频道开通日期记为2000年4月6日。",
            en="Sina Auto's official tenth-anniversary retrospective dates the channel launch to April 6, 2000.",
        ),
    },
    "chexun": {
        "founded": founded(
            2008, "https://www.neeq.com.cn/disclosure/2026/2026-08-20/3f8597ed612f4a199979a70629ac5799.pdf",
            "Chexun Internet 2026 interim report", "current_legal_entity",
            zh="全国股转系统报告列北京车讯互联网股份有限公司成立于2008年4月18日。",
            en="The NEEQ filing records Beijing Chexun Internet Co., Ltd. as established on April 18, 2008.",
        ),
        "listing": listing(
            True,
            "https://www.neeq.com.cn/disclosure/2026/2026-08-20/3f8597ed612f4a199979a70629ac5799.pdf",
            "Chexun Internet 2026 interim report", "NEEQ", "834327",
            zh="北京车讯互联网股份有限公司在全国股转系统基础层挂牌；代码834327属于与本媒体行直接对应的运营法人。",
            en="Beijing Chexun Internet Co., Ltd. is quoted on the NEEQ base tier; ticker 834327 belongs to the operating legal entity directly represented by this media row.",
        ),
        "employees": metric(
            33, 2026,
            "https://www.neeq.com.cn/disclosure/2026/2026-08-20/3f8597ed612f4a199979a70629ac5799.pdf",
            "Chexun Internet 2026 interim report", "company_and_controlled_subsidiaries",
            unit="people",
            zh="报告披露公司及控股子公司截至2026年6月30日有33名员工；2025年末为34名。",
            en="The filing reports 33 employees at the company and controlled subsidiaries as of June 30, 2026; year-end 2025 headcount was 34.",
        ),
    },
}
for _id, _facts in _SEPTEMBER_FACTS.items():
    PATCH.setdefault(_id, {}).update(_facts)

# Shenzhen / Huizhou deep audit.  Product and brand rows keep their own
# perimeter: a parent-group ticker, payroll or plant portfolio is never copied
# down merely to fill a cell.
_SHENZHEN_HUIZHOU_FACTS = {
    "tencent-auto": {
        "ownership": "private",
        "ownership_evidence": own(
            "https://security.tencent.com/index.php/blog/msg/176?from_tab=announcement",
            "腾讯平台与内容事业群众测活动公告",
            zh="腾讯官方公告将auto.qq.com列入平台与内容事业群垂直资讯业务；这里只确认频道运营归属，不下沉腾讯控股股权表。",
            en="Tencent's official notice places auto.qq.com in the Platform and Content Group's vertical-information business; this confirms channel operation only, not Tencent Holdings' cap table.",
        ),
    },
    "xchuxing": {
        "founded": founded(
            2015, "https://www.xchuxing.com/ins/928511", "新出行十周年回顾",
            "platform_origin_approximate",
            zh="官方2025年文章称“10年前，新出行成立”，因此只记录约2015年的平台起点，不视为精确工商日期。",
            en="A 2025 first-party retrospective says Xchuxing was founded ten years earlier, supporting only an approximate 2015 platform origin rather than an exact incorporation date.",
        ),
        "ownership": "private",
        "ownership_evidence": own(
            "https://www.xchuxing.com/useragreement", "新出行用户协议",
            zh="用户协议列深圳市新出行科技有限公司为网站及App拥有和运营主体；未据此推断最终受益所有人。",
            en="The user agreement names Shenzhen Xchuxing Technology Co., Ltd. as owner and operator of the site and app; it does not establish ultimate beneficial ownership.",
        ),
    },
    "huawei-car": {
        "ownership": "private",
        "ownership_evidence": {
            **own(
                "https://www-file.huawei.com/admin/asset/v1/pro/view/3022d6c92652427fa0d7f72dcc72daa2.pdf",
                "华为2025年年度报告",
                zh="智能汽车解决方案相关技术、资产和人员已注入引望；现有一手材料只核实阿维塔10%交割，未形成完整当前股权表。",
                en="IAS-related technology, assets and staff were injected into Yinwang; first-party evidence verifies Avatr's 10% transfer but not a complete current cap table.",
            ),
            "scope_quality": "qualified",
        },
        "employees": metric(
            8000, 2025, "https://auto.huawei.com/cn/about-us", "华为乾崑关于我们",
            "rd_team_not_total", unit="people",
            zh="官网称研发团队规模超过8,000人；这是研发团队下限，不是引望或华为集团总员工数。",
            en="The official site says the R&D team exceeds 8,000 people; this is a lower bound for the R&D team, not total Yinwang or Huawei group headcount.",
            qualifier="more_than",
        ),
    },
    "denza": {
        "founded": founded(
            2010, "https://www.denza.com/cn/brand.html", "腾势品牌介绍", "brand_origin",
            zh="腾势官方品牌页将品牌起点追溯至2010年。",
            en="Denza's official brand page traces the marque to 2010.",
        ),
        "ownership": "private",
        "ownership_evidence": own(
            "https://www.denza.com/cn/brand.html", "腾势品牌介绍",
            zh="官方品牌页说明腾势自2024年起成为比亚迪全资品牌；不把比亚迪集团员工或证券代码下沉。",
            en="The official brand page says Denza became wholly owned by BYD in 2024; BYD group headcount and tickers are not copied to the brand row.",
        ),
    },
    "fangchengbao": {
        "ownership": "private",
        "ownership_evidence": own(
            "https://www.byd.com/cn/brand-center/industries-and-businesses", "比亚迪品牌中心",
            zh="比亚迪官方品牌中心列方程豹为集团汽车品牌；品牌行不继承集团证券和员工。",
            en="BYD's official brand centre identifies Fangchengbao as a group automotive brand; the brand row does not inherit group securities or employees.",
        ),
    },
    "yangwang": {
        "ownership": "private",
        "ownership_evidence": own(
            "https://www.byd.com/cn/brand-center/industries-and-businesses", "比亚迪品牌中心",
            zh="比亚迪官方品牌中心列仰望为集团汽车品牌；品牌行不继承集团证券和员工。",
            en="BYD's official brand centre identifies Yangwang as a group automotive brand; the brand row does not inherit group securities or employees.",
        ),
    },
    "eve-energy": {
        "ownership": "private",
        "ownership_evidence": own(
            "https://disc.static.szse.cn/disc/disk03/finalpage/2026-03-28/5c838bd3-422f-423d-a98c-d47ba58a06bf.PDF",
            "亿纬锂能2025年年度报告",
            zh="年报列西藏亿纬控股有限公司为控股股东，刘金成、骆锦红为实际控制人。",
            en="The annual report identifies Tibet EVE Holding as controlling shareholder and Liu Jincheng and Luo Jinhong as ultimate controllers.",
        ),
        "employees": metric(
            31213, 2025,
            "https://disc.static.szse.cn/disc/disk03/finalpage/2026-03-28/5c838bd3-422f-423d-a98c-d47ba58a06bf.PDF",
            "亿纬锂能2025年年度报告", "listed_group", unit="people",
            zh="2025年报披露集团员工31,213人，其中母公司7,348人、主要子公司23,865人。",
            en="The 2025 annual report lists 31,213 group employees: 7,348 at the parent and 23,865 at major subsidiaries.",
        ),
    },
    "desay-sv": {
        "ownership": "private",
        "ownership_evidence": own(
            "https://disc.static.szse.cn/disc/disk03/finalpage/2026-03-06/1a53e9d0-2e8a-437b-9c3f-0b1062834cf2.PDF",
            "德赛西威2025年年度报告",
            zh="年报披露公司自2024年2月起无控股股东、无实际控制人；不据历史国资背景沿用旧分类。",
            en="The annual report states that the company has had no controlling shareholder or ultimate controller since February 2024; historical state ownership is not carried forward.",
        ),
    },
    "holosonics": {
        "ownership": "private",
        "ownership_evidence": own(
            "https://disc.static.szse.cn/disc/disk03/finalpage/2026-03-28/5505667f-a2a3-4dd2-867c-fcd4a87713c8.PDF",
            "华阳集团2025年年度报告",
            zh="本行稳定ID对应惠州市华阳集团股份有限公司（Foryou），不是美国同名Holosonics；控制信息按华阳集团年报记录。",
            en="This stable ID represents Huizhou Foryou General Electronics Group, not the U.S. company Holosonics; control information follows Foryou's annual report.",
        ),
    },
}
for _id, _facts in _SHENZHEN_HUIZHOU_FACTS.items():
    PATCH.setdefault(_id, {}).update(_facts)

DROP_FIELDS.setdefault("denza", set()).add("vehicle_sales")
DROP_FIELDS.setdefault("fangchengbao", set()).add("vehicle_sales")
STATUS_OVERRIDES.update({
    "gaogong-ev": {"listing": "not_applicable", "employees": "not_applicable"},
    "tencent-auto": {"listing": "not_applicable", "employees": "not_applicable"},
    "xchuxing": {"founded": "partial", "listing": "not_applicable", "employees": "not_applicable"},
    "huawei-car": {"ownership": "partial", "listing": "not_applicable", "employees": "partial", "plants": "unverified"},
    "denza": {"listing": "not_applicable", "employees": "not_applicable", "vehicle_sales": "partial", "plants": "not_applicable"},
    "fangchengbao": {"listing": "not_applicable", "employees": "not_applicable", "vehicle_sales": "partial", "plants": "not_applicable"},
    "yangwang": {"listing": "not_applicable", "employees": "not_applicable", "vehicle_sales": "partial", "plants": "not_applicable"},
})

_BEIJING_MEDIA_B_FACTS = {
    "china-auto-news": {
        "founded": founded(
            1984, "https://paper.people.com.cn/zgcsb/html/2018-02/12/content_1836342.htm",
            "中国汽车报创刊沿革", "publication_launch",
            zh="人民日报体系一手回顾将《中国汽车报》创刊追溯至1984年。",
            en="A first-party retrospective in the People's Daily system dates China Automotive News to 1984.",
        ),
        "ownership": "soe",
        "ownership_evidence": own(
            "https://paper.people.com.cn/zgnyb/pc/content/202604/27/content_30154055.html",
            "中国能源报社媒体矩阵",
            zh="官方媒体矩阵将《中国汽车报》列于中国能源汽车传播集团、人民日报社体系；具体出版法人后缀仍不外推。",
            en="The official media matrix places China Automotive News within China Energy Auto Communication Group and the People's Daily system; the precise publisher legal suffix is not inferred.",
        ),
    },
    "auto-business-review": {
        "ownership": "private",
        "ownership_evidence": own(
            "https://www.inabr.com/aboutUs", "汽车商业评论关于我们",
            zh="官网版权/运营信息指向北京推动力广告有限公司；官网未披露最终股权。",
            en="The official site identifies Beijing Tuidongli Advertising Co., Ltd. in its copyright/operation information; ultimate equity is not disclosed.",
        ),
    },
    "auto-fan": {
        "founded": founded(
            1986, "https://www.sae-china.org/info/c210", "中国汽车工程学会：《汽车之友》",
            "publication_launch",
            zh="中国汽车工程学会官方介绍将《汽车之友》创刊追溯至1986年。",
            en="SAE-China's official profile dates Auto Fan's launch to 1986.",
        ),
        "ownership": "nonprofit",
        "ownership_evidence": own(
            "https://www.sae-china.org/info/c210", "中国汽车工程学会：《汽车之友》",
            zh="学会官方介绍列《汽车之友》杂志社有限公司由中国汽车工程学会出资并持续归属该学会；按媒体题名边界记录。",
            en="SAE-China's official profile says the magazine company was funded by and remains affiliated with the association; the row remains scoped to the media title.",
        ),
    },
    "che168": {
        "ownership": "private",
        "ownership_evidence": own(
            "https://app.che168.com/2sc/web/about/20200921/user-protocol.html", "二手车之家用户协议",
            zh="用户协议列北京盛拓鸿远信息技术有限公司为服务运营主体，汽车之家为集团品牌母体；品牌行不继承ATHM/2518或集团员工。",
            en="The user agreement names Beijing Shengtuo Hongyuan Information Technology as service operator within the Autohome brand group; ATHM/2518 and group headcount are not inherited.",
        ),
    },
    "people-auto": {
        "ownership": "public",
        "ownership_evidence": own(
            "https://sso.people.com.cn/resource/html/agreement.html", "人民网服务协议",
            zh="人民网协议确认网站运营主体；汽车频道不是独立法人，不继承人民网股份证券或员工。",
            en="People.cn's agreement confirms the website operator; its auto channel is not a separate legal entity and does not inherit the listed operator's ticker or staff.",
        ),
    },
    "xinhua-auto": {
        "ownership": "public",
        "ownership_evidence": own(
            "https://www.news.cn/company/", "新华网公司介绍",
            zh="新华网公司介绍及频道页确认汽车频道属于新华网/新华社体系；频道本身不是独立法人。",
            en="Xinhuanet's company profile and channel page establish the auto channel within Xinhuanet/Xinhua News Agency; the channel itself is not a legal entity.",
        ),
    },
    "cctv-auto": {
        "ownership": "public",
        "ownership_evidence": own(
            "https://www.cctv.com/special/guanyunew/fuwuxieyi/index.shtml", "央视网服务协议",
            zh="央视网服务协议列央视国际网络有限公司为服务运营主体；汽车频道归属中央广播电视总台网络体系。",
            en="CCTV.com's service agreement names CCTV International Network as operator; the auto channel belongs to China Media Group's online system.",
        ),
    },
    "chinanews-auto": {
        "ownership": "public",
        "ownership_evidence": own(
            "https://www.chinanews.com.cn/common/footer/intro-1.shtml", "中国新闻网简介",
            zh="中国新闻网官方简介确认其由中国新闻社主办；汽车频道不是独立法人。",
            en="China News Service's official profile identifies it as sponsor of Chinanews.com; the auto channel is not a separate legal entity.",
        ),
    },
    "caixin-auto": {
        "ownership": "private",
        "ownership_evidence": own(
            "https://corp.caixin.com/item/", "财新用户协议",
            zh="财新协议列财新传媒有限公司为平台服务主体；汽车频道不是独立法人。",
            en="Caixin's terms name Caixin Media Co., Ltd. as platform service provider; the auto vertical is not a separate legal entity.",
        ),
    },
    "eeo-auto": {
        "ownership": "private",
        "ownership_evidence": own(
            "https://www.eeo.com.cn/aboutus/aboutus.html", "经济观察网关于我们",
            zh="官网权利声明指向北京经观文化传媒有限公司；未从该页面外推最终股权。",
            en="The official rights notice points to Beijing Jingguan Culture Media Co., Ltd.; ultimate equity is not inferred from that page.",
        ),
    },
    "cheyun": {
        "founded": founded(
            2013, "https://m2.cheyun.com/about/index", "车云关于我们", "website_launch",
            zh="车云官方沿革从2013年4月15日开始，表中按年份展示为2013。",
            en="Cheyun's official history starts on April 15, 2013; the table displays the year 2013.",
        ),
        "ownership": "private",
        "ownership_evidence": own(
            "https://m2.cheyun.com/about/index", "车云关于我们",
            zh="官网列启程未来科技（北京）有限公司为运营/权利主体；最终股权未披露。",
            en="The official page identifies Qicheng Future Technology (Beijing) as operator/rights holder; ultimate equity is not disclosed.",
        ),
    },
    "auto-zongheng": {
        "ownership": "nonprofit",
        "ownership_evidence": own(
            "https://www.caam.org.cn/chn/5/cate_69/con_5236042.html", "中国汽车工业协会年度报告",
            zh="中汽协官方年度报告称《汽车纵横》为协会自有媒体；具体运营法人和员工仍待核。",
            en="CAAM's official annual report calls Auto Review an association-owned media title; its precise operator and workforce remain unverified.",
        ),
    },
    "motor-trend-china": {
        "ownership": "public",
        "ownership_evidence": own(
            "https://www.nppa.gov.cn/data/bzqk/202311/t20231120_812403.html", "国家新闻出版署期刊登记",
            zh="现行登记列《中国汽车报》社有限公司为主管、主办单位且期刊状态正常；当前海外品牌许可未另行推定。",
            en="The current NPPA registry lists China Automotive News Co., Ltd. as supervising and sponsoring unit with normal status; any current foreign-brand licence is not inferred.",
        ),
    },
}
for _id, _facts in _BEIJING_MEDIA_B_FACTS.items():
    PATCH.setdefault(_id, {}).update(_facts)

EMP_NOT_DISCLOSED.update({"chinanews-auto", "caixin-auto", "eeo-auto", "cheyun", "motor-trend-china"})
for _id in _BEIJING_MEDIA_B_FACTS:
    STATUS_OVERRIDES.setdefault(_id, {})["listing"] = "not_applicable"

_CHONGQING_CHENGDU_FACTS = {
    "changan": {
        "ownership": "soe",
        "ownership_evidence": own(
            "https://disc.static.szse.cn/disc/disk03/finalpage/2026-04-11/1b030296-baad-43f8-b1c6-fb69c790305a.PDF",
            "长安汽车2025年年度报告",
            zh="年报列辰致汽车科技集团为直接控股股东、中国长安为间接控股股东，国务院国资委为最终控制人。",
            en="The annual report identifies Chenzhi Auto Technology Group as direct controller, China Changan as indirect controller, and the State Council SASAC as ultimate controller.",
        ),
    },
    "seres": {
        "ownership": "private",
        "ownership_evidence": own(
            "https://static.cninfo.com.cn/finalpage/2026-03-31/1225053031.PDF",
            "赛力斯集团2025年年度报告",
            zh="年报列重庆小康控股为控股股东、张兴海为实际控制人。",
            en="The annual report identifies Chongqing Sokon Holding as controlling shareholder and Zhang Xinghai as ultimate controller.",
        ),
    },
    "aito": {
        "ownership": "private",
        "ownership_evidence": own(
            "https://big5.sse.com.cn/site/cht/www.sse.com.cn/disclosure/listedinfo/announcement/c/new/2024-07-04/601127_20240704_F914.pdf",
            "赛力斯问界商标交易公告",
            zh="问界品牌商标由赛力斯汽车持有，赛力斯与华为继续联合业务；联合打造不等于共同持股法人。",
            en="AITO trademarks are held by Seres Automobile while Seres and Huawei continue the joint business; joint creation does not imply a jointly owned legal entity.",
        ),
        "vehicle_sales": metric(
            426000, 2025, "https://www.seres.cn/company-news/1416.html", "赛力斯2025年度工作总结",
            "brand_deliveries", qualifier="approximately",
            zh="赛力斯官方总结披露问界2025年交付约42.6万辆；该数与赛力斯集团销量有包含关系，不可相加。",
            en="Seres' official annual review reports about 426,000 AITO deliveries in 2025; this overlaps with Seres group sales and must not be added to it.",
        ),
    },
    "avatr": {
        "founded": founded(
            2018, "https://static.cninfo.com.cn/finalpage/2024-12-18/1222048834.PDF",
            "阿维塔科技股权公告", "current_legal_entity",
            zh="当前法人前身成立于2018年7月10日；2021年品牌发布/更名不是新设法人。",
            en="The predecessor of the current legal entity was incorporated on July 10, 2018; the 2021 brand launch/rename did not create a new company.",
        ),
        "ownership": "jv",
        "ownership_evidence": own(
            "https://static.cninfo.com.cn/finalpage/2024-12-18/1222048834.PDF", "阿维塔科技股权公告",
            zh="披露列长安汽车为最大股东（40.99%）、宁德时代持9.17%；阿维塔为长安联营企业，华为技术合作不等于持股。",
            en="The filing lists Changan as largest shareholder at 40.99% and CATL at 9.17%; Avatr is a Changan associate, and Huawei's technology partnership is not equity ownership.",
        ),
        "vehicle_sales": metric(
            120000, 2025, "https://www.avatr.com/newscenter", "阿维塔官方年度销量回顾",
            "brand_sales", qualifier="more_than",
            zh="官网称2025年销量超过12万辆；只显示可证下限，不虚构个位精度。",
            en="The official site says 2025 sales exceeded 120,000; the display preserves the supported lower bound rather than inventing unit precision.",
        ),
    },
    "deepal": {
        "founded": founded(
            2018, "https://www.deepal.com.cn/202501161716/%E8%90%A5%E4%B8%9A%E6%89%A7%E7%85%A7.pdf",
            "深蓝汽车营业执照", "current_legal_entity",
            zh="营业执照列法人前身成立于2018年5月28日；品牌发布时间不替代法人成立日。",
            en="The business licence dates the legal predecessor to May 28, 2018; the brand launch does not replace the incorporation date.",
        ),
        "ownership": "soe",
        "ownership_evidence": own(
            "https://disc.static.szse.cn/disc/disk03/finalpage/2026-04-11/1b030296-baad-43f8-b1c6-fb69c790305a.PDF",
            "长安汽车2025年年度报告",
            zh="长安汽车持深蓝汽车51%并纳入合并范围；存在少数股东，不表述为国资全资。",
            en="Changan holds 51% of Deepal and consolidates it; minority shareholders remain, so it is not described as wholly state-owned.",
        ),
        "vehicle_sales": metric(
            330000, 2025, "https://www.deepal.com.cn/news", "深蓝汽车官方年度销量回顾",
            "brand_sales", qualifier="more_than",
            zh="官网称2025年全球销量超过33万辆，未进一步拆分批发、零售或交付。",
            en="The official site says 2025 global sales exceeded 330,000 without further separating wholesale, retail or deliveries.",
        ),
    },
    "caeri": {
        "ownership": "soe",
        "ownership_evidence": own(
            "https://dataclouds.cninfo.com.cn/shgonggao/hsomarket/2026/20260422/728cabd882ac467e93c7afeea9328701.PDF",
            "中国汽研2025年年度报告",
            zh="2023年重组后中国检验认证集团为控股股东，国务院国资委为最终控制人。",
            en="Following the 2023 reorganization, China Certification & Inspection Group is controlling shareholder and the State Council SASAC is ultimate controller.",
        ),
        "employees": metric(
            3453, 2025,
            "https://dataclouds.cninfo.com.cn/shgonggao/hsomarket/2026/20260422/728cabd882ac467e93c7afeea9328701.PDF",
            "中国汽研2025年年度报告", "listed_group", unit="people",
            zh="发行人及主要子公司员工3,453人，不是中国中检全集团人数。",
            en="The issuer and major subsidiaries report 3,453 employees; this is not the whole CCG workforce.",
        ),
        "vehicle_sales": metric(
            1054, 2025,
            "https://dataclouds.cninfo.com.cn/shgonggao/hsomarket/2026/20260422/728cabd882ac467e93c7afeea9328701.PDF",
            "中国汽研2025年年度报告", "special_purpose_vehicle_sales",
            zh="合并子公司专用车销量1,054辆（自卸253、物流724、环卫77）；不可与乘用车销量直接比较。",
            en="A consolidated subsidiary sold 1,054 special-purpose vehicles (253 dump, 724 logistics and 77 sanitation); this is not directly comparable with passenger-car sales.",
        ),
    },
    "qianli": {
        "founded": founded(
            1997, "https://static.cninfo.com.cn/finalpage/2015-05-26/1201061193.PDF",
            "力帆股份法人沿革公告", "current_legal_entity_lineage",
            zh="沿连续发行人法人记录1997年12月1日；2025年更名千里科技未新设法人。",
            en="The continuing issuer was incorporated on December 1, 1997; the 2025 rename to Qianli Technology did not create a new entity.",
        ),
        "ownership": "private",
        "ownership_evidence": own(
            "https://static.cninfo.com.cn/finalpage/2026-04-04/1225080707.PDF", "千里科技2025年年度报告",
            zh="年报列重庆满江红私募基金为控股股东（29.85%）、重庆满江红企业管理有限公司为实际控制人；不把吉利合作关系当作控制。",
            en="The annual report identifies Chongqing Manjianghong Private Equity Fund as controlling shareholder at 29.85% and Chongqing Manjianghong Enterprise Management as ultimate controller; Geely cooperation is not treated as control.",
        ),
        "employees": metric(
            6949, 2025, "https://static.cninfo.com.cn/finalpage/2026-04-04/1225080707.PDF",
            "千里科技2025年年度报告", "listed_group", unit="people",
            zh="发行人及主要子公司员工6,949人，不含吉利或合作生态员工。",
            en="The issuer and major subsidiaries report 6,949 employees, excluding Geely and partner-ecosystem staff.",
        ),
        "vehicle_sales": metric(
            106268, 2025, "https://static.cninfo.com.cn/finalpage/2026-04-04/1225080707.PDF",
            "千里科技2025年年度报告", "company_vehicle_sales_excluding_motorcycles",
            zh="按公司产销表合计汽车106,268辆，不含摩托车；不是终端上牌量。",
            en="The company's production-and-sales table totals 106,268 automobiles, excluding motorcycles; this is not registrations.",
        ),
    },
    "cqu": {
        "employees": metric(
            5100, 2026, "https://www.cqu.edu.cn/xqgk.htm", "重庆大学学校概况",
            "university_staff_total", unit="people", qualifier="more_than",
            zh="学校官网称在职教职工5,100余人；不是汽车学科单独人数，也未给严格统计日。",
            en="The university site reports more than 5,100 active staff; this is not automotive-discipline-only staff and no exact census date is given.",
        ),
    },
    "cqut": {
        "employees": metric(
            2400, 2025, "https://czj.cq.gov.cn/cslm/bmys_2025/zqsjywyh_485456/202502/P020250224539952628599.pdf",
            "重庆理工大学2025年预算公开", "university_staff_total", unit="people",
            qualifier="more_than",
            zh="官方预算材料称教职工2,400余人、专任教师2,000余人；不是车辆工程学院单独人数。",
            en="The official budget material reports more than 2,400 staff and more than 2,000 full-time faculty; this is not the vehicle-engineering school alone.",
        ),
    },
    "volvo-cars-chengdu": {
        "ownership": "private",
        "ownership_evidence": own(
            "https://investors.volvocars.com/~/media/Files/V/Volvo-Cars-IR-V2/AGM%202025%20ENG/VCG_AR_2024_ENG_250312.pdf",
            "Volvo Car Group 2024 annual report",
            zh="成都工厂运营法人中嘉汽车制造由沃尔沃亚太投资控股100%持有并纳入沃尔沃汽车集团；不借用集团上市和员工指标。",
            en="Chengdu operator Zhongjia Automobile Manufacturing is wholly held through Volvo Car Asia Pacific Investment Holding and consolidated in Volvo Car Group; group listing and workforce figures are not borrowed.",
        ),
        "employees": {
            **metric(
                3000, 2025, "https://scvtc.university-hr.com/index.php?act=view&join_id=6LrRgAkPO3kw&module=joinunits&sys=home",
                "中嘉汽车制造招聘档案", "current_legal_entity", unit="people",
                qualifier="more_than",
                zh="招聘档案称中嘉汽车制造员工3,000余人；这是概数，不是经审计的2025年末精确人数。",
                en="The recruitment profile says Zhongjia Automobile Manufacturing has more than 3,000 employees; this is approximate, not an audited exact year-end 2025 count.",
            ),
            "source_authority": "secondary",
        },
    },
    "nbd-auto": {
        "ownership": "public",
        "ownership_evidence": own(
            "https://www.nbd.com.cn/corp/2016products/index.html", "每日经济新闻产品与机构介绍",
            zh="每经汽车为每日经济新闻/每经网编辑频道，主管主办体系为成都传媒集团；频道不是独立法人。",
            en="NBD Auto is an editorial channel of National Business Daily/NBD.com under Chengdu Media Group's sponsoring system; the channel is not a legal entity.",
        ),
    },
}
for _id, _facts in _CHONGQING_CHENGDU_FACTS.items():
    PATCH.setdefault(_id, {}).update(_facts)

STATUS_OVERRIDES.update({
    "seres": {"plants": "verified"},
    "aito": {"listing": "not_applicable", "employees": "not_applicable", "plants": "not_applicable"},
    "avatr": {"listing": "not_applicable", "plants": "not_applicable"},
    "deepal": {"listing": "not_applicable", "plants": "not_applicable"},
    "caeri": {"plants": "verified"},
    "qianli": {"plants": "verified"},
    "volvo-cars-chengdu": {"listing": "not_applicable", "employees": "partial", "plants": "verified"},
    "nbd-auto": {"listing": "not_applicable"},
})

_BEIJING_MEDIA_C_OPERATORS = {
    "truck-home": (
        "https://www.360che.com/help/about/", "卡车之家关于我们",
        "官网确认北京卡车之家信息技术股份有限公司为网站运营法人；所核一手页未披露当前控股股东及实际控制人。",
        "The official site identifies Beijing 360che Information Technology as operator; the reviewed first-party pages do not disclose its current controller.",
    ),
    "chinabuses": (
        "https://m.chinabuses.com/about/aboutus/", "客车网关于我们",
        "官网称客车网由北京亚汽联信息技术有限公司投资运营；这只确认网站运营关系，不外推最终股权。",
        "The official site says Beijing Yaqilian Information Technology invests in and operates Chinabuses; this proves website operation, not ultimate ownership.",
    ),
    "chinaspv": (
        "https://www.chinaspv.com.cn/about/contactus.html", "专用汽车网联系我们",
        "官网称专用汽车网由北京亚汽联信息技术有限公司投资运营；这只确认网站运营关系，不外推最终股权。",
        "The official site says Beijing Yaqilian Information Technology invests in and operates Chinaspv; this proves website operation, not ultimate ownership.",
    ),
    "luobo-report": (
        "https://chejiahao.autohome.com.cn/Authors/275099408", "萝卜报告车家号",
        "车家号列北京格锐驰广告传媒有限公司为该账号运营主体；账号运营不等于完整品牌股权。",
        "Autohome identifies Beijing Geruichi Advertising Media as the account operator; account operation is not the brand's full equity ownership.",
    ),
    "laosiji": (
        "https://www.laosiji.com/", "老司机出品官网",
        "官网集团主体与车家号账号运营主体使用两个不同“锋巢”法人名称；保留运营边界，不合并或外推股权。",
        "The group site and Autohome account name two different Fengchao legal entities; the operating boundaries are preserved without inferring equity.",
    ),
    "review-38": (
        "https://chejiahao.autohome.com.cn/Authors/75554652", "38号车评中心车家号",
        "车家号列北京司空观能科技文化有限公司为当前账号运营主体；不外推为品牌全部权利。",
        "Autohome names Beijing Sikong Guanneng Technology Culture as current account operator; this is not extrapolated to all brand rights.",
    ),
    "li-laoshu": (
        "https://chejiahao.autohome.com.cn/Authors/23209446", "李老鼠说车车家号",
        "当前账号运营主体为北京吱车商贸有限公司；历史“吱道二手车”账号的北京吱道文化传媒有限公司是不同法人。",
        "The current account operator is Beijing Zhiche Trading; Beijing Zhidao Culture Media operates a different historical account and is a separate entity.",
    ),
    "tichebang": (
        "https://chejiahao.autohome.com.cn/Authors/36173435", "踢车帮车家号",
        "车家号列北京唯优沃德新媒体科技有限公司为账号运营主体；最终股权未披露。",
        "Autohome names Beijing Weiyou World New Media Technology as account operator; ultimate ownership is not disclosed.",
    ),
    "yan-chuang": (
        "https://chejiahao.autohome.com.cn/Authors/4262673", "闫闯说车车家号",
        "车家号列北京骏铜傲途生活信息技术有限公司为账号运营主体；平台合作不等于平台拥有品牌。",
        "Autohome names Beijing Juntong Aotu Life Information Technology as account operator; platform partnership does not mean platform ownership.",
    ),
    "che-ruo-chujian": (
        "https://chejiahao.autohome.com.cn/Authors/39484015", "车若初见车家号",
        "车家号列北京爱车新世界文化传播有限公司为账号运营主体；最终股权未披露。",
        "Autohome names Beijing Aiche New World Culture Communication as account operator; ultimate ownership is not disclosed.",
    ),
    "doudouche": (
        "https://chejiahao.autohome.com.cn/Authors/27166860", "逗斗车车家号",
        "车家号列北京笑忘车文化传播有限公司为账号运营主体；最终股权未披露。",
        "Autohome names Beijing Xiaowangche Culture Communication as account operator; ultimate ownership is not disclosed.",
    ),
    "dabiaoche": (
        "https://www.dabiaoche.com/", "大飙车官网",
        "官网与车家号均指向素美微尚国际信息咨询（北京）有限公司；拆解工位不是汽车制造厂。",
        "The official site and Autohome point to Sumei Weishang International Information Consulting (Beijing); teardown bays are not vehicle plants.",
    ),
    "cidi-wuyin": (
        "https://chejiahao.autohome.com.cn/Authors/27700609", "此地无垠车家号",
        "车家号列北京协成达技术开发有限公司为账号运营主体；不等同于创作者个人或其历史任职媒体。",
        "Autohome names Beijing Xiechengda Technology Development as account operator; it is not the creator personally or a former employer.",
    ),
}
for _id, (_url, _title, _zh, _en) in _BEIJING_MEDIA_C_OPERATORS.items():
    PATCH.setdefault(_id, {}).update({
        "ownership": "unknown",
        "ownership_evidence": {
            **own(_url, _title, zh=_zh, en=_en),
            "scope_quality": "qualified",
        },
    })

PATCH.setdefault("truck-home", {}).update({
    "founded": founded(
        2008, "https://static.cninfo.com.cn/finalpage/2025-07-10/1224129765.PDF",
        "卡车之家工商变更公告", "current_legal_entity",
        zh="营业执照所示法人设立日为2008年8月4日；网站上线时间另计。",
        en="The business licence dates the legal entity to August 4, 2008; the website launch is a separate date.",
    ),
    "listing": {
        "listed": False, "exchange": "none", "ticker": None,
        "quotation": {"exchange": "NEEQ", "ticker": "834063", "date": "2015-11-11"},
        "source_url": "https://www.neeq.com.cn/neeq_indices_news/200025802.html",
        "source_title": "全国股转系统三板服务指数样本公告",
        "note_zh": "834063为全国股转系统挂牌证券，不是证券交易所上市。",
        "note_en": "834063 is quoted on NEEQ; it is not an exchange listing.",
    },
})
PATCH.setdefault("chinabuses", {})["founded"] = founded(
    1999, "https://m.chinabuses.com/about/aboutus/", "客车网关于我们", "website_launch"
)
PATCH.setdefault("chinaspv", {})["founded"] = founded(
    2009, "https://www.chinaspv.com.cn/about/contactus.html", "专用汽车网联系我们", "website_launch"
)
PATCH.setdefault("luobo-report", {})["founded"] = founded(
    2014, "https://www.bilibili.com/video/BV1Qv4heeEL5/", "萝卜报告十周年官方视频", "brand_origin"
)

EMP_NOT_DISCLOSED.update(_BEIJING_MEDIA_C_OPERATORS)
for _id in _BEIJING_MEDIA_C_OPERATORS:
    STATUS_OVERRIDES.setdefault(_id, {}).update({"listing": "not_applicable"})
STATUS_OVERRIDES["truck-home"].update({"listing": "verified", "ownership": "not_disclosed"})

_SHANGHAI_MEDIA_OPERATORS = {
    "gasgoo": (
        "https://auto.gasgoo.com/about.shtml", "盖世汽车关于我们",
        "官网明确点名上海盖世网络技术有限公司为品牌运营主体；联系页所列其他盖世法人不自动并入，最终股权未披露。",
        "The official About page identifies Shanghai Gasgoo Network Technologies as brand operator; other Gasgoo entities on the contact page are not merged and ultimate equity is undisclosed.",
    ),
    "garage42": (
        "https://www.42how.com/article/3331", "42号车库隐私政策",
        "现行隐私政策列上海不慌科技有限公司为服务运营主体；不外推其最终股权。",
        "The current privacy policy identifies Shanghai Buhuang Technology as service operator; its ultimate equity is not inferred.",
    ),
    "yicai-auto": (
        "https://www.yicai.com/news/automobile/", "第一财经汽车栏目",
        "汽车是第一财经网专题栏目；母平台创办年、证券和员工不下沉为栏目自身事实。",
        "Auto is a topical section of Yicai.com; the parent platform's founding date, securities and staff are not assigned to the section.",
    ),
    "thepaper-auto": (
        "https://www.thepaper.cn/newsDetail_forward_32992080", "澎湃新闻汽车圈",
        "当前栏目名为“汽车圈”，属于澎湃新闻平台；上海东方报业有限公司的平台运营关系不等于栏目独立股权。",
        "The current section is Auto Circle within The Paper; Shanghai Oriental Press's platform operation does not make the section a separate equity entity.",
    ),
    "jiemian-auto": (
        "https://www.jiemian.com/article/7113560.html", "界面新闻官方说明",
        "界面汽车是界面新闻垂直栏目；当前平台运营与版权主体为上海界面财联社科技股份有限公司，栏目不是独立法人。",
        "Jiemian Auto is a vertical of Jiemian News; Shanghai Jiemian Cailianshe Technology is the platform operator and rights holder, while the section is not a legal entity.",
    ),
    "yanzhi-auto": (
        "https://www.3cst.cn/", "焉知科技官网",
        "当前网站扩展为焉知科技；上海焉知信息技术有限公司仅被一手材料确认为特定活动主办方，不外推为全部网站或IP所有者。",
        "The current site is branded Yanzhi Technology; first-party material identifies Shanghai Yanzhi Information Technology only as an event organizer, not owner of the whole site or IP.",
    ),
}
for _id, (_url, _title, _zh, _en) in _SHANGHAI_MEDIA_OPERATORS.items():
    PATCH.setdefault(_id, {}).update({
        "ownership": "unknown",
        "ownership_evidence": {
            **own(_url, _title, zh=_zh, en=_en),
            "scope_quality": "qualified",
        },
    })
    STATUS_OVERRIDES.setdefault(_id, {}).update({
        "ownership": "partial", "listing": "not_applicable",
    })

EMP_NOT_DISCLOSED.update(_SHANGHAI_MEDIA_OPERATORS)


# Wuhan / Zhengzhou / Shiyan exact-entity adjudication. These values replace
# stale brand-level or prior-year values only where the reviewed source closes
# the legal-entity and metric boundary.
DFM_LISTING_WITHDRAWAL = "https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0318/2026031800105.pdf"
VOYAH_LISTING_DOC = "https://www.hkexnews.hk/listedco/listconews/sehk/2026/0212/2026021201452.pdf"
YUTONG_AR_2025 = "https://static.cninfo.com.cn/finalpage/2026-03-31/1225050742.PDF"
ZZN_OWNERSHIP_2026 = "https://static.cninfo.com.cn/finalpage/2026-01-24/1224948944.PDF"
merge_patch_rows({
    "dongfeng": {
        "listing": listing(
            False, DFM_LISTING_WITHDRAWAL,
            "Withdrawal of listing of Dongfeng Motor Group Company Limited",
            zh="东风汽车集团有限公司本体未上市；原独立上市子公司东风汽车集团股份有限公司的0489.HK已于2026年3月18日撤销上市。",
            en="Dongfeng Motor Corporation itself is unlisted; former separately listed subsidiary Dongfeng Motor Group Company Limited withdrew 0489.HK on March 18, 2026.",
        ),
    },
    "dongfeng-honda": {
        "employees": metric(
            9400, 2026, "https://www.dongfeng-honda.com/company_profile.shtml",
            "东风本田公司简介", "current_company_profile_approximate", unit="people",
            qualifier="approximately",
            zh="公司简介披露员工约9,400人；这是当前约数，不表示精确年末人数。",
            en="The company profile reports approximately 9,400 employees; this is a current approximation, not an exact year-end count.",
        ),
    },
    "aeolus": {
        "founded": founded(
            2023, "https://www.dfmc.com.cn/news/company/news_20240411_1053.html",
            "东风奕派品牌重组沿革", "brand_reorganization",
            zh="2023年是奕派品牌重组形成节点；未把车型发布日冒充精确创立日。",
            en="2023 is the eπ/Yipai brand-reorganization milestone; a model launch date is not substituted as an exact founding date.",
        ),
        "listing": listing(
            False, VOYAH_LISTING_DOC, "VOYAH listing document",
            zh="东风奕派是品牌，不是独立证券发行人；不继承东风体系代码。",
            en="Dongfeng eπ is a brand, not a standalone issuer, and inherits no Dongfeng-group ticker.",
        ),
        "ownership_evidence": own(
            "https://www.dfmc.com.cn/news/company/news_20250811_1149.html",
            "东风奕派品牌及奕派科技运营平台",
            zh="奕派属于东风体系；奕派科技同时运营多个品牌，其合计数据不下沉给奕派。",
            en="eπ belongs to the Dongfeng system; Yipai Technology operates multiple brands, so its aggregate data is not assigned to eπ.",
        ),
    },
    "lotus": {
        "founded": founded(
            2021, "https://www.sec.gov/Archives/edgar/data/1962746/000110465926050310/lot-20251231x20f.htm",
            "Lotus Technology 2025 Form 20-F", "current_Cayman_listed_entity",
            zh="当前行限定为Lotus Technology Inc.；发行人于2021年设立，电动车业务起点2018年与品牌历史1948年另行保留在审计说明中。",
            en="This row is limited to Lotus Technology Inc.; the issuer was incorporated in 2021, while the 2018 EV-business start and 1948 marque history remain separate audit context.",
        ),
        "ownership_evidence": {
            **own(
                "https://www.sec.gov/Archives/edgar/data/1962746/000110465926050310/lot-20251231x20f.htm",
                "Lotus Technology 2025 Form 20-F",
                zh="上市文件确认其为受吉利控股关联股东控制的公司；未将动态股东表压缩成未经复核的单一比例。",
                en="The filing identifies it as controlled by Geely Holding-related shareholders; the changing cap table is not compressed into an unreviewed single percentage.",
            ),
            "scope_quality": "qualified",
        },
    },
    "mengshi": {
        "ownership_evidence": own(
            "https://www.dfmc.com.cn/news/company/news_20220829_1145.html",
            "东风发布猛士品牌",
            zh="猛士是东风体系品牌；武汉生产园区由独立分公司运营，品牌自身不继承该分公司资产或员工。",
            en="M-Hero is a Dongfeng-system brand; its Wuhan production park is run by a separate branch, whose assets and employees are not assigned to the brand.",
        ),
        "vehicle_sales": metric(
            10224, 2025, HKEX_DFM_2025,
            "Dongfeng Motor Group December 2025 sales bulletin", "brand_sales_unaudited",
            zh="采用产销快报中的猛士品牌独立销量行；不使用东风集团或运营分公司总量。",
            en="Uses the standalone M-Hero line in the sales flash; Dongfeng-group or branch totals are not substituted.",
        ),
    },
    "voyah": {
        "founded": founded(
            2021, VOYAH_LISTING_DOC, "VOYAH listing document", "current_listed_company",
            zh="采用岚图汽车科技法人2021年设立日口径；2025年股份制变更另见审计记录。",
            en="Uses the 2021 establishment of the VOYAH Automotive Technology legal entity; its 2025 joint-stock conversion remains separate audit context.",
        ),
        "listing": listing(
            True, VOYAH_LISTING_DOC, "VOYAH listing document", "HKEX", "07489",
            zh="07489.HK属于岚图汽车科技股份有限公司，2026年3月19日以介绍方式上市。",
            en="07489.HK belongs to VOYAH Automotive Technology, listed by introduction on March 19, 2026.",
        ),
        "employees": metric(
            8198, 2025, VOYAH_LISTING_DOC, "VOYAH listing document",
            "listed_group_full_time_employees", unit="people",
            zh="截至2025年末合并全职员工8,198人，其中研发人员3,073人已包含在总数内。",
            en="Consolidated full-time workforce was 8,198 at 2025 year-end; 3,073 R&D employees are included in that total.",
        ),
        "ownership_evidence": own(
            VOYAH_LISTING_DOC, "VOYAH listing document",
            zh="上市后东风汽车集团股份有限公司约控制69.47%投票权；该比例不改写为央企母公司直接持股。",
            en="After listing, Dongfeng Motor Group Company Limited controls about 69.47% of voting power; this is not relabeled as a direct stake of the central-SOE parent.",
        ),
        "vehicle_sales": metric(
            150169, 2025, HKEX_DFM_2025,
            "Dongfeng Motor Group December 2025 sales bulletin", "company_sales_unaudited",
            zh="岚图2025年销量150,169辆；与产量170,066辆分列。",
            en="VOYAH sold 150,169 vehicles in 2025; production of 170,066 is a separate measure.",
        ),
    },
    "yutong": {
        "founded": founded(
            1993, YUTONG_AR_2025, "宇通客车2025年年度报告", "current_listed_company",
            zh="采用现上市股份公司设立年份，不把宇通集团或更早客车厂历史移植到发行人。",
            en="Uses the establishment year of the current listed joint-stock company, not the group or an earlier bus-factory lineage.",
        ),
        "employees": metric(
            19575, 2025, YUTONG_AR_2025, "宇通客车2025年年度报告",
            "listed_group", unit="people",
            zh="合计19,575人，含母公司16,466人与主要子公司3,109人，分项不重复相加。",
            en="Total workforce was 19,575, comprising 16,466 at the parent and 3,109 at major subsidiaries; the components are not double-counted.",
        ),
        "vehicle_sales": metric(
            49518, 2025, YUTONG_AR_2025, "宇通客车2025年年度报告", "bus_sales",
            zh="2025年客车销量49,518辆；产量49,356辆是另一指标。",
            en="2025 bus sales were 49,518; production of 49,356 is a separate measure.",
        ),
        "ownership_evidence": own(
            YUTONG_AR_2025, "宇通客车2025年年度报告",
            zh="郑州宇通集团持股37.70%，最终控制人为汤玉祥；集团资产不下沉至上市公司。",
            en="Zhengzhou Yutong Group holds 37.70% and Tang Yuxiang is the ultimate controller; group assets are not assigned to the issuer.",
        ),
    },
    "zhengzhou-nissan": {
        "ownership_evidence": own(
            ZZN_OWNERSHIP_2026, "东风股份关于郑州日产股权结构的交易所公告",
            zh="郑州日产由东风汽车有限公司直接持有100%；上一层东风汽车有限公司由东风汽车集团股份有限公司与日产（中国）各持50%。",
            en="Zhengzhou Nissan is directly 100% owned by Dongfeng Motor Co., Ltd.; that parent is held 50:50 by Dongfeng Motor Group Company Limited and Nissan (China).",
        ),
    },
    "dongfeng-cv": {
        "founded": founded(
            2013, "https://www.volvogroup.com/en/news-and-media/news/2015/jan/news-149008.html",
            "Volvo Group and Dongfeng inaugurate strategic alliance", "current_joint_venture",
            zh="2013年为现法人/资产平台形成节点；2015年为沃尔沃入股完成后的战略合资节点。",
            en="2013 marks formation of the current legal/asset platform; 2015 is the strategic-JV milestone after Volvo's investment.",
        ),
        "vehicle_sales": metric(
            131125, 2025, HKEX_DFM_2025,
            "Dongfeng Motor Group December 2025 sales bulletin",
            "dongfeng_commercial_vehicle_company_sales",
            zh="采用东风商用车有限公司独立销量行，不混入东风股份、郑州日产或东风柳汽。",
            en="Uses the standalone Dongfeng Commercial Vehicle company line, excluding Dongfeng Automobile, Zhengzhou Nissan and Dongfeng Liuzhou.",
        ),
    },
})

# Northern-city review. Brand metrics stay on brand rows; issuer, employer and
# physical-campus boundaries are never inherited merely because names match.
FAW_2025_SALES = "https://wap.sasac.gov.cn/n16582853/n16582883/c35254492/content.html"
GWM_AR_2025 = "https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0327/2026032702376_c.pdf"
GWM_HISTORY = "https://www.gwm.com.cn/history.html"
merge_patch_rows({
    "faw": {
        "vehicle_sales": metric(
            3302000, 2025, FAW_2025_SALES, "中国一汽2025年销量突破330万辆",
            "group_sales", zh="集团总量包含品牌与合资公司分项，不与分项重复相加。",
            en="The group total includes its brand and joint-venture components and must not be added to them again.",
        ),
    },
    "hongqi": {
        "ownership_evidence": own(
            "https://www.faw.com.cn/fawcn/373696/5133380/5133398/index.html", "红旗品牌",
            zh="红旗是中国一汽旗下品牌；品牌本身不是雇佣或持厂法人。",
            en="Hongqi is a China FAW brand; the brand itself is neither an employing nor plant-owning legal entity.",
        ),
        "vehicle_sales": metric(460000, 2025, FAW_2025_SALES, "中国一汽2025年销量", "brand_sales"),
    },
    "jiefang": {
        "ownership_evidence": own(
            "https://www.faw.com.cn/fawcn/373696/ppzl/5426231/index.html", "解放品牌",
            zh="本行代表解放品牌，并与一汽解放集团股份有限公司这一发行人分开。",
            en="This row represents the Jiefang brand and is separate from issuer FAW Jiefang Group Co., Ltd.",
        ),
        "vehicle_sales": metric(280000, 2025, FAW_2025_SALES, "中国一汽2025年销量", "brand_sales_reported_in_ten_thousands", qualifier="approximately"),
    },
    "bestune": {
        "ownership_evidence": own(
            "https://www.faw.com.cn/fawcn/373696/5133380/index.html", "中国一汽品牌",
            zh="奔腾是中国一汽旗下品牌；品牌本身不是雇佣或持厂法人。",
            en="Bestune is a China FAW brand; the brand itself is neither an employing nor plant-owning legal entity.",
        ),
        "vehicle_sales": metric(200000, 2025, FAW_2025_SALES, "中国一汽2025年销量", "brand_sales_lower_bound", qualifier="more_than"),
    },
    "faw-vw": {
        "founded": founded(1991, "https://www.faw-vw.com/en/enterprise-introduction", "FAW-Volkswagen enterprise introduction", "current_joint_venture"),
        "ownership_evidence": own(
            "https://www.faw-vw.com/en/enterprise-introduction", "FAW-Volkswagen enterprise introduction",
            zh="中国一汽60%、大众汽车25%、大众中国10%、奥迪5%。",
            en="China FAW holds 60%, Volkswagen AG 25%, Volkswagen China 10%, and Audi 5%.",
        ),
        "vehicle_sales": metric(1587100, 2025, FAW_2025_SALES, "中国一汽2025年销量", "joint_venture_sales"),
    },
    "audi-faw-nev": {
        "founded": founded(2021, "https://fdi.mofcom.gov.cn/auto/content.html?id=6621", "奥迪一汽新能源汽车项目", "current_joint_venture"),
        "ownership_evidence": own(
            "https://fdi.mofcom.gov.cn/auto/content.html?id=6621", "奥迪一汽新能源汽车项目",
            zh="奥迪55%、中国一汽40%、大众中国5%。",
            en="Audi holds 55%, China FAW 40%, and Volkswagen China 5%.",
        ),
    },
    "bmw-brilliance": {
        "ownership_evidence": own(
            "https://www.press.bmwgroup.com/global/article/detail/T0367992EN/bmw-group-strengthens-partnership-in-china%3A-extension-of-joint-venture-contract-until-2040-enters-into-force?language=en",
            "BMW Group strengthens partnership in China",
            zh="宝马集团持股75%，华晨汽车集团间接持股25%。",
            en="BMW Group holds 75%; Brilliance Auto Group indirectly holds 25%.",
        ),
        "employees": metric(
            20000, 2026, "https://www.bmw-brilliance.cn/cn/zh/pr/bba.html", "华晨宝马公司概况",
            "current_workforce_lower_bound", unit="people", qualifier="more_than",
            zh="官网仅披露员工超过20,000人，不虚构精确年末人数。",
            en="The official profile reports more than 20,000 employees; no exact year-end count is invented.",
        ),
    },
    "gwm": {
        "founded": founded(2001, "https://www.hkexnews.hk/listedco/listconews/sehk/2020/1127/2020112700828_c.pdf", "长城汽车股份有限公司章程", "current_listed_company"),
        "ownership_evidence": own(
            GWM_AR_2025, "长城汽车股份有限公司2025年年度报告",
            zh="保定创新长城资产管理有限公司为控股股东，魏建军为实际控制人。",
            en="Baoding Innovation Great Wall Asset Management is the controlling shareholder and Wei Jianjun the ultimate controller.",
        ),
        "vehicle_sales": metric(1323672, 2025, GWM_HISTORY, "长城汽车发展历程", "group_sales"),
    },
    "haval": {"vehicle_sales": metric(761487, 2025, GWM_HISTORY, "长城汽车发展历程", "brand_sales")},
    "tank": {"vehicle_sales": metric(234442, 2025, GWM_HISTORY, "长城汽车发展历程", "brand_sales")},
    "ora": {"vehicle_sales": metric(48312, 2025, GWM_HISTORY, "长城汽车发展历程", "brand_sales")},
    "wey": {"vehicle_sales": metric(99617, 2025, GWM_HISTORY, "长城汽车发展历程", "brand_sales")},
    "faw-toyota": {
        "founded": founded(2000, "https://www.toyota.com.cn/about/profile/", "丰田在中国—公司简介", "joint_venture_system"),
        "ownership_evidence": own(
            "https://www.teda.gov.cn/bmztc/upload/files/2018/5/1791013818.pdf", "天津一汽丰田环境信息公开资料",
            zh="一汽侧与丰田侧各持50%；多个运营法人按合资体系合并展示。",
            en="The FAW and Toyota sides each hold 50%; multiple operating entities are shown as one joint-venture system.",
        ),
        "vehicle_sales": metric(805500, 2025, FAW_2025_SALES, "中国一汽2025年销量", "joint_venture_system_sales"),
    },
    "catarc": {
        "employees": metric(
            5000, 2026, "https://www.catarc.ac.cn/mobile/zxjj", "中汽中心简介",
            "current_group_workforce_lower_bound", unit="people", qualifier="more_than",
            zh="官网仅披露员工5,000余人；测试园区不计作整车制造工厂。",
            en="The official profile reports more than 5,000 employees; testing campuses are not vehicle plants.",
        ),
    },
    "sinotruk": {
        "ownership_evidence": {
            **own(
                "https://www.hkexnews.hk/listedco/listconews/sehk/2021/0305/2021030500027_c.pdf",
                "关于中国重汽集团股权无偿划转完成的公告",
                zh="山东重工控制集团，最终控制链归属山东省国资委；65%为最近可核读一手比例。",
                en="Shandong Heavy Industry controls the group within the Shandong SASAC chain; 65% is the latest readable primary-source percentage.",
            ),
            "scope_quality": "qualified",
        },
        "vehicle_sales": metric(
            300000, 2025, "https://wap.sasac.gov.cn/n2588025/n2588129/c35560134/content.html",
            "中国重汽2025年重卡销量突破30万辆", "heavy_truck_sales_lower_bound",
            qualifier="more_than", zh="仅为重卡销量超过30万辆，不冒充集团全车型精确销量。",
            en="This is a lower bound for heavy-truck sales only, not an exact all-model group total.",
        ),
    },
})

# Yangtze-region review. Rounded brand figures stay qualified; listed-issuer,
# parent-group and production-subsidiary scopes remain separate.
CALB_AR_2025 = "https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0429/2026042900019.pdf"
merge_patch_rows({
    "geely": {
        "employees": metric(
            140000, 2025, "https://global.geely.com/en/news/2026/geely-holding-group-sustainability-report-2025",
            "Geely Holding Group releases 2025 sustainability report",
            "holding_group_workforce_lower_bound", unit="people", qualifier="more_than",
            zh="官方仅披露集团员工超过14万人；不借用0175.HK发行人员工数。",
            en="The official release reports more than 140,000 group employees; the 0175.HK issuer workforce is not substituted.",
        ),
    },
    "zeekr": {
        "listing": listing(
            False, "https://www.sec.gov/Archives/edgar/data/1954042/000110465925123525/tm2534059d1_ex99-1.htm",
            "Geely completes privatization of ZEEKR",
            zh="极氪已于2025年12月22日完成私有化并停止NYSE交易；ZK仅为历史代码。",
            en="ZEEKR completed privatization and ceased NYSE trading on December 22, 2025; ZK is historical only.",
        ),
    },
    "vw-anhui": {
        "ownership_evidence": own(
            "https://www.volkswagengroupchina.com.cn/en/partner/volkswagenanhui", "Volkswagen Anhui",
            zh="大众汽车集团持股75%，江汽集团持股25%。",
            en="Volkswagen Group holds 75% and JAC Group holds 25%.",
        ),
        "employees": metric(
            2100, 2026, "https://www.volkswagengroupchina.com.cn/en/partner/volkswagenanhui",
            "Volkswagen Anhui", "current_company_workforce_lower_bound", unit="people",
            qualifier="more_than", zh="官网披露员工超过2,100人，不虚构精确年末数。",
            en="The official profile reports more than 2,100 employees; no exact year-end count is invented.",
        ),
    },
    "exeed": {
        "founded": founded(
            2017, "https://www.hkexnews.hk/listedco/listconews/sehk/2026/0318/2026031800323.pdf",
            "Chery Automobile 2025 annual results", "brand_launch",
            zh="采用发行人披露的2017年品牌起点。",
            en="Uses the issuer-disclosed 2017 brand origin.",
        ),
    },
    "icar": {
        "founded": founded(
            2023, "https://www.hkexnews.hk/listedco/listconews/sehk/2026/0318/2026031800323.pdf",
            "Chery Automobile 2025 annual results", "brand_launch",
        ),
    },
    "svolt": {
        "employees": metric(
            13000, 2026, "https://www.svolt.cn/about/profile", "蜂巢能源公司简介",
            "current_company_workforce_lower_bound", unit="people", qualifier="more_than",
            zh="官网披露员工13,000余人，按下限展示。",
            en="The official profile reports more than 13,000 employees, shown as a lower bound.",
        ),
    },
    "calb": {
        "ownership_evidence": {
            **own(
                CALB_AR_2025, "中创新航2025年年度报告",
                zh="年报披露无股东拥有30%以上投票权；不据此虚构单一控制人。",
                en="The annual report states that no shareholder holds more than 30% of voting rights; no single controller is invented.",
            ),
            "scope_quality": "qualified",
        },
        "employees": metric(14323, 2025, CALB_AR_2025, "中创新航2025年年度报告", "listed_group", unit="people"),
    },
})

STATUS_OVERRIDES.update({
    "dongfeng": {"employees": "partial", "plants": "unverified", "vehicle_sales": "unverified"},
    "dongfeng-honda": {"employees": "partial", "plants": "verified"},
    "aeolus": {
        "founded": "partial", "ownership": "verified", "listing": "not_applicable",
        "employees": "not_applicable", "vehicle_sales": "unverified", "plants": "not_applicable",
    },
    "lotus": {"ownership": "partial", "plants": "verified"},
    "mengshi": {"ownership": "verified", "listing": "not_applicable", "employees": "not_applicable", "plants": "not_applicable"},
    "voyah": {"founded": "verified", "ownership": "verified", "listing": "verified", "employees": "verified", "vehicle_sales": "verified", "plants": "verified"},
    "y-car-review": {"founded": "unverified", "ownership": "unverified", "listing": "unverified", "employees": "unverified", "vehicle_sales": "not_applicable", "plants": "not_applicable"},
    "hnu": {"employees": "partial"},
    "yutong": {"plants": "verified"},
    "zhengzhou-nissan": {"employees": "unverified", "plants": "verified"},
    "dongfeng-cv": {"employees": "unverified", "plants": "partial"},
    "faw": {"employees": "not_disclosed", "vehicle_sales": "verified", "plants": "partial"},
    "hongqi": {"listing": "not_applicable", "employees": "not_applicable", "vehicle_sales": "verified", "plants": "not_applicable"},
    "jiefang": {"listing": "not_applicable", "employees": "not_applicable", "vehicle_sales": "partial", "plants": "not_applicable"},
    "bestune": {"listing": "not_applicable", "employees": "not_applicable", "vehicle_sales": "partial", "plants": "not_applicable"},
    "faw-vw": {"employees": "not_disclosed", "vehicle_sales": "verified", "plants": "verified"},
    "audi-faw-nev": {"listing": "not_applicable", "employees": "not_disclosed", "vehicle_sales": "not_disclosed", "plants": "verified"},
    "jlu": {"listing": "not_applicable", "employees": "not_disclosed", "vehicle_sales": "not_applicable", "plants": "not_applicable"},
    "bmw-brilliance": {"listing": "not_applicable", "employees": "partial", "vehicle_sales": "not_disclosed", "plants": "verified"},
    "gwm": {"plants": "verified"},
    "haval": {"listing": "not_applicable", "employees": "not_applicable", "plants": "not_applicable"},
    "tank": {"listing": "not_applicable", "employees": "not_applicable", "plants": "not_applicable"},
    "ora": {"listing": "not_applicable", "employees": "not_applicable", "plants": "not_applicable"},
    "wey": {"listing": "not_applicable", "employees": "not_applicable", "plants": "not_applicable"},
    "faw-toyota": {"listing": "not_applicable", "employees": "not_disclosed", "plants": "verified"},
    "catarc": {"listing": "not_applicable", "employees": "partial", "vehicle_sales": "not_applicable", "plants": "not_applicable"},
    "changan-univ": {"listing": "not_applicable", "employees": "not_disclosed", "vehicle_sales": "not_applicable", "plants": "not_applicable"},
    "sinotruk": {"listing": "not_applicable", "employees": "not_disclosed", "vehicle_sales": "partial", "plants": "partial"},
    "geely": {"employees": "partial", "plants": "unverified"},
    "netease-auto": {"listing": "not_applicable", "employees": "not_applicable", "vehicle_sales": "not_applicable", "plants": "not_applicable"},
    "lynk-co": {"listing": "not_applicable", "employees": "not_applicable", "vehicle_sales": "partial", "plants": "not_applicable"},
    "zeekr": {"listing": "not_separately_listed", "employees": "unverified", "vehicle_sales": "partial", "plants": "not_applicable"},
    "geely-galaxy": {"listing": "not_applicable", "employees": "not_applicable", "vehicle_sales": "partial", "plants": "not_applicable"},
    "leapmotor": {"plants": "verified"},
    "neta": {"founded": "unverified", "ownership": "unverified", "listing": "unverified", "employees": "unverified", "vehicle_sales": "unverified", "plants": "unverified"},
    "jac": {"plants": "partial"},
    "vw-anhui": {"employees": "partial", "vehicle_sales": "unverified", "plants": "verified"},
    "gotion": {"vehicle_sales": "not_applicable", "plants": "partial"},
    "hfut": {"listing": "not_applicable", "employees": "partial", "vehicle_sales": "not_applicable", "plants": "not_applicable"},
    "chery": {"plants": "partial"},
    "exeed": {"listing": "not_applicable", "employees": "not_applicable", "plants": "not_applicable"},
    "jetour": {"listing": "not_applicable", "employees": "not_applicable", "plants": "not_applicable"},
    "icar": {"listing": "not_applicable", "employees": "not_applicable", "plants": "not_applicable"},
    "svolt": {"ownership": "unverified", "listing": "unverified", "employees": "partial", "vehicle_sales": "not_applicable", "plants": "partial"},
    "calb": {"founded": "partial", "ownership": "verified", "employees": "verified", "vehicle_sales": "not_applicable", "plants": "partial"},
    "catl": {"vehicle_sales": "not_applicable", "plants": "partial"},
})


if __name__ == "__main__":
    raise SystemExit(main())
