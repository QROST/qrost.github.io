#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { pinyin } = require('pinyin');

const ROOT = path.resolve(__dirname, '..');
const s = { window: {} };
vm.createContext(s);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'assets/data/listings.js'), 'utf8'), s);
const L = s.window.HOUSING_LISTINGS;
const dists = [...new Set(L.map((d) => d.dist).filter(Boolean))].sort();

const PROVINCE_EN = {
  北京: 'Beijing', 天津: 'Tianjin', 上海: 'Shanghai', 重庆: 'Chongqing',
  黑龙江: 'Heilongjiang', 吉林: 'Jilin', 辽宁: 'Liaoning', 河北: 'Hebei',
  河南: 'Henan', 山东: 'Shandong', 安徽: 'Anhui', 江苏: 'Jiangsu',
  浙江: 'Zhejiang', 湖北: 'Hubei', 广东: 'Guangdong', 广西: 'Guangxi',
  福建: 'Fujian', 海南: 'Hainan', 四川: 'Sichuan', 贵州: 'Guizhou',
  云南: 'Yunnan', 甘肃: 'Gansu',
};

const CITY_EN = {
  七台河市: 'Qitaihe', 上海市: 'Shanghai', 丰都县: 'Fengdu', 临沧市: 'Lincang',
  亳州市: "Bozhou", 伊春市: 'Yichun', 佳木斯市: 'Jiamusi', 保山市: 'Baoshan',
  儋州市: 'Danzhou', 六安市: "Lu'an", 六盘水市: 'Liupanshui', 北京市: 'Beijing',
  北海市: 'Beihai', 南京市: 'Nanjing', 南通市: 'Nantong', 南阳市: 'Nanyang',
  双鸭山: 'Shuangyashan', 合肥市: 'Hefei', 四平市: 'Siping',
  大兴安岭地区: "Daxing'anling", 大庆市: 'Daqing', 天津市: 'Tianjin',
  威海市: 'Weihai', '威海市-乳山市': 'Weihai-Rushan', '威海市-荣成市': 'Weihai-Rongcheng',
  宁波市: 'Ningbo', 安庆市: 'Anqing', 安顺市: 'Anshun', 宜宾市: 'Yibin',
  宜昌市: 'Yichang', 崇明区: 'Chongming', 广元市: 'Guangyuan', 广州市: 'Guangzhou',
  廊坊市: 'Langfang', '延边州-图们市': 'Yanbian-Tumen', '延边州-延吉市': 'Yanbian-Yanji',
  '延边州-珲春市': 'Yanbian-Hunchun', '延边州-龙井市': 'Yanbian-Longjing',
  张掖市: 'Zhangye', 德阳市: 'Deyang', 惠州市: 'Huizhou', 招远市: 'Zhaoyuan',
  攀枝花市: 'Panzhihua', 新乡市: 'Xinxiang', 日照市: 'Rizhao', 昆明市: 'Kunming',
  '昆明市-安宁市': 'Kunming-Anning', 昭通市: 'Zhaotong', 普洱市: "Pu'er",
  曲靖市: 'Qujing', '曲靖市-宣威市': 'Qujing-Xuanwei', 杭州市: 'Hangzhou',
  松原市: 'Songyuan', 楚雄州: 'Chuxiong', '楚雄州-楚雄市': 'Chuxiong-Chuxiong',
  泉州市: 'Quanzhou', 泰安市: "Tai'an", '泰安市-肥城市': "Tai'an-Feicheng",
  洛阳市: 'Luoyang', 淄博市: 'Zibo', 淮南市: 'Huainan', 深圳市: 'Shenzhen',
  清远市: 'Qingyuan', 湖州市: 'Huzhou', 湛江市: 'Zhanjiang', 滁州市: 'Chuzhou',
  漳州市: 'Zhangzhou', 澄迈县: 'Chengmai', 烟台市: 'Yantai',
  '烟台市-海阳市': 'Yantai-Haiyang', '烟台市-龙口市': 'Yantai-Longkou',
  牡丹江市: 'Mudanjiang', 玉溪市: 'Yuxi', 白山市: 'Baishan', 百色市: 'Baise',
  石家庄: 'Shijiazhuang', 石家庄市: 'Shijiazhuang',
  '红河州-个旧市': 'Honghe-Gejiu', '红河州-开远市': 'Honghe-Kaiyuan',
  '红河州-弥勒市': 'Honghe-Mile', '红河州-蒙自市': 'Honghe-Mengzi',
  绥化市: 'Suihua', 肇庆市: 'Zhaoqing', 自贡市: 'Zigong', 芜湖市: 'Wuhu',
  苏州市: 'Suzhou', 茂名市: 'Maoming', 荣昌区: 'Rongchang', 营口市: 'Yingkou',
  葫芦岛市: 'Huludao', 西双版纳州: 'Xishuangbanna', 贵阳市: 'Guiyang',
  辽源市: 'Liaoyuan', 辽阳市: 'Liaoyang', 连云港市: 'Lianyungang',
  遵义市: 'Zunyi', '遵义市-赤水市': 'Zunyi-Chishui', 郑州市: 'Zhengzhou',
  '郑州市-中牟县': 'Zhengzhou-Zhongmou', '郑州市-荥阳市': 'Zhengzhou-Xingyang',
  鄂州市: 'Ezhou', 酒泉市: 'Jiuquan', 重庆市: 'Chongqing', 钦州市: 'Qinzhou',
  铁岭市: 'Tieling', 铜仁市: 'Tongren', 锦州市: 'Jinzhou', 镇江市: 'Zhenjiang',
  '镇江市-句容市': 'Zhenjiang-Jurong', 长寿: 'Changshou',
  '长春市-公主岭市': 'Changchun-Gongzhuling', 阜新市: 'Fuxin', 防城港市: 'Fangchenggang',
  阳江市: 'Yangjiang', 青岛市: 'Qingdao', 马鞍山市: "Ma'anshan", 鸡西市: 'Jixi',
  鹤壁市: 'Hebi', 鹤岗: 'Hegang', 黑河市: 'Heihe', 黔东南州: 'Qiandongnan',
  黔南州: 'Qiannan', '黔西南州-兴义市': "Qianxinan-Xingyi", 齐齐哈尔市: 'Qiqihar',
};

const SUF = [
  ['街道', ' St'], ['度假区', ' Resort'], ['新区', ' New Area'], ['城区', ' urban'],
  ['周边', ' outskirts'], ['片区', ' Area'], ['区', ' District'], ['县', ' County'],
  ['市', ' City'], ['镇', ' Town'],
];

function titleCaseSyllables(str) {
  return pinyin(str, { style: pinyin.STYLE_NORMAL })
    .map((a) => {
      const w = a[0] || '';
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(' ');
}

function romanize(name) {
  if (CITY_EN[name]) return CITY_EN[name];
  let base = name;
  let suf = '';
  for (const [k, v] of SUF) {
    if (base.endsWith(k)) { suf = v; base = base.slice(0, -k.length); break; }
  }
  base = base.replace(/[·/\-]/g, ' ').trim();
  return (titleCaseSyllables(base) + suf).replace(/\s+/g, ' ').trim();
}

const DISTRICT_EN = {};
dists.forEach((d) => { DISTRICT_EN[d] = romanize(d); });

const zhRe = /[\u4e00-\u9fff]/;
const bad = Object.entries(DISTRICT_EN).filter(([, v]) => zhRe.test(v));
if (bad.length) {
  console.error('Districts still contain CJK:', bad.slice(0, 10));
  process.exit(1);
}

const out = `/** Geographic English / romanized labels for EN UI. GENERATED — do not hand-edit. */
window.HOUSING_GEO_EN = {
  province: ${JSON.stringify(PROVINCE_EN, null, 2)},
  city: ${JSON.stringify(CITY_EN, null, 2)},
  district: ${JSON.stringify(DISTRICT_EN, null, 2)},
};
`;
fs.writeFileSync(path.join(ROOT, 'assets/data/geo-en.js'), out);
console.log('OK ·', dists.length, 'districts');
