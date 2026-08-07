#!/usr/bin/env python3
"""Download unique per-event vibe thumbs and rewrite data.js thumbLibrary."""

from __future__ import annotations

import json
import re
import subprocess
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image

DEMO = Path(__file__).resolve().parents[1]
OUT = DEMO / "assets" / "img" / "events"
DATA_JS = DEMO / "assets" / "js" / "data.js"
UA = {
    "User-Agent": "QROST-PebbleGuide/1.0 (educational static guide; contact zc@curious-arc.com)"
}


def flickr_url(page: str) -> str:
    api = "https://www.flickr.com/services/oembed?" + urllib.parse.urlencode(
        {"url": page, "format": "json"}
    )
    req = urllib.request.Request(api, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as response:
        payload = json.load(response)
    url = payload.get("url") or payload.get("thumbnail_url")
    if not url:
        raise RuntimeError(f"no flickr media url for {page}")
    return url




def commons_url(title: str) -> tuple[str, str]:
    """Return (thumb_or_original_url, commons_page_url) for a File: title."""
    if not title.startswith('File:'):
        title = 'File:' + title
    api = 'https://commons.wikimedia.org/w/api.php?' + urllib.parse.urlencode({
        'action': 'query', 'format': 'json', 'titles': title,
        'prop': 'imageinfo', 'iiprop': 'url', 'iiurlwidth': 500,
    })
    req = urllib.request.Request(api, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as response:
        payload = json.load(response)
    page = next(iter(payload['query']['pages'].values()))
    info = (page.get('imageinfo') or [{}])[0]
    media = (info.get('thumburl') or info.get('url') or '').split('?')[0]
    if not media:
        raise RuntimeError(f'commons miss: {title} -> {page}')
    page_url = 'https://commons.wikimedia.org/wiki/' + urllib.parse.quote(title.replace(' ', '_'))
    return media, page_url

def download(url: str, dest: Path) -> None:
    req = urllib.request.Request(url, headers=UA)
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            dest.write_bytes(response.read())
            return
    except urllib.error.HTTPError as exc:
        # Commons now rejects some thumb widths; fall back to original file URL.
        if "upload.wikimedia.org" in url and "/thumb/" in url and "/500px-" in url:
            parts = url.split("/")
            # .../commons/thumb/a/ab/File.jpg/500px-File.jpg -> .../commons/a/ab/File.jpg
            try:
                idx = parts.index("thumb")
                original = "/".join(parts[:idx] + parts[idx + 1 : -1])
            except ValueError:
                raise exc
            req2 = urllib.request.Request(original, headers=UA)
            with urllib.request.urlopen(req2, timeout=60) as response:
                dest.write_bytes(response.read())
                return
        raise


def to_webp(src: Path, dest: Path) -> int:
    image = Image.open(src).convert("RGB")
    width, height = image.size
    ratio = 3 / 2
    if width / height > ratio:
        new_w = int(height * ratio)
        left = (width - new_w) // 2
        image = image.crop((left, 0, left + new_w, height))
    else:
        new_h = int(width / ratio)
        top = (height - new_h) // 2
        image = image.crop((0, top, width, top + new_h))
    image = image.resize((240, 160), Image.Resampling.LANCZOS)
    png = dest.with_suffix(".png")
    image.save(png, "PNG")
    subprocess.check_call(
        ["cwebp", "-q", "70", "-m", "6", str(png), "-o", str(dest)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    if dest.stat().st_size > 28000:
        subprocess.check_call(
            ["cwebp", "-q", "55", "-m", "6", str(png), "-o", str(dest)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    png.unlink(missing_ok=True)
    return dest.stat().st_size


def js_str(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("*.webp"):
        old.unlink()

    flickr_pages = {
        "kickoff": "https://www.flickr.com/photos/75264768@N00/48500910527",
        "kickoff_b": "https://www.flickr.com/photos/75264768@N00/48500910227",
        "prereunion-sat": "https://www.flickr.com/photos/48092258@N06/28715700533",
        "prereunion-sun": "https://www.flickr.com/photos/48092258@N06/28716119473",
        "legends": "https://www.flickr.com/photos/75264768@N00/52306559001",
        "legends_b": "https://www.flickr.com/photos/75264768@N00/51388880912",
        "legends_c": "https://www.flickr.com/photos/75264768@N00/52303735713",
        "little-car": "https://www.flickr.com/photos/66151780@N00/9513903138",
        "little-car_b": "https://www.flickr.com/photos/66151780@N00/9513911132",
        "lemons": "https://www.flickr.com/photos/34142240@N07/4893132850",
        "gooding-fri": "https://www.flickr.com/photos/27611545@N08/3835939138",
        "gooding-sat": "https://www.flickr.com/photos/27611545@N08/3835146417",
        "pg-rally": "https://www.flickr.com/photos/9998127@N06/5626165611",
        "werks": "https://www.flickr.com/photos/33385346@N08/45700549261",
        "cruise-in": "https://www.flickr.com/photos/31115420@N07/52298066874",
        "mmf": "https://www.flickr.com/photos/75264768@N00/51377439972",
    }
    flickr_urls = {key: flickr_url(page) for key, page in flickr_pages.items()}

    def commons(path640: str, page: str) -> tuple[str, str]:
        return path640, page

    C_TITLES = {
        "exotics": "File:Exotics_on_Broadway_2024.jpg",
        "concours": "File:1937_Delahaye_135_Roadster_at_Pebble_Beach_Concours_2023.jpg",
        "village-sun": "File:Lamborghini_Lanzador_at_Pebble_Beach_Concours_2023.jpg",
        "village-sat": "File:Ford_Mustang_GTD_at_Pebble_Beach_Concours_2023.jpg",
        "village-fri": "File:Pebble_Beach_Concours_2016-13.jpg",
        "forum-sat": "File:Pebble_Beach_Concours_2016-12.jpg",
        "tour": "File:Fiat_1953_8V_Supersonic_on_Pebble_Beach_Tour_d-Elegance_2011_-Moto@Club4AG.jpg",
        "motoring-classic": "File:Ferrari_375_MM_Pinin_Farina_Speciale_(1954).jpg",
        "rmmr-wed": "File:1976_Ferrari_312_T2_at_RMMR_2022.jpg",
        "rmmr-thu": "File:1956_Porsche_550_A_front_at_RMMR_2022.jpg",
        "rmmr-fri": "File:1974_Brabham_BT44_at_RMMR_2022.jpg",
        "rmmr-sat": "File:Ferrari_250_LM_5893_at_RMMR_2022.jpg",
        "gooding-thu": "File:1965_Lamborghini_350_GT_Interior.jpg",
        "quail": "File:Devin_C's_at_The_Quail_2017.jpg",
        "broad-arrow": "File:01-bonhams-ferrari-monterey-2014-1.jpg",
        "concorso": "File:Italian_Concours_Ferraris_(15004650995).jpg",
        "motorlux": "File:Gordon_McCall's_Motorworks_Reunion_at_Pebble_Beach_(14825764339).jpg",
        "porsche-seaside": "File:Gordon_McCall's_Motorworks_Reunion_at_Pebble_Beach_(14825962017).jpg",
        "ace-auction": "File:Gordon_McCall's_Motorworks_Reunion_at_Pebble_Beach_(14825872558).jpg",
        "forum-thu": "File:1958_MacMinn_Le_Mans_Coupe_at_Pebble_Beach_Concours_2023.jpg",
        "forum-fri": "File:1938_Phantom_Corsair_Pebble_Beach_Concours_dElegance_2007_03.jpg",
        "poker-rally": "File:Maserati_5000_GT_Scià_di_Persia_(1959)_at_Laguna_Seca_Historics_(2014)_05.jpg",
        "asilomar-day": "File:Entrance_to_the_Asilomar_Conference_Grounds.jpg",
        "electric-coast-mon": "File:Asilomar_State_Beach_-_2023-02-22_-_1.jpg",
        "electric-coast-tue": "File:Merrill_Hall_Asilomar_edit1.jpg",
        "stanton": "File:Custom_House_Monterey,_CA.jpg",
        "monterey-british": "File:MG_MGB_(2012_Hudson_British_Car_Show).JPG",
        "astons": "File:Morgan_Plus_8_(Hudson_British_Car_Show_'12).jpg",
        "ferrari-carmel": "File:Ferrari_2010_California_Left.jpg",
    }
    print('resolving commons titles...')
    C = {key: commons_url(title) for key, title in C_TITLES.items()}

    ORG = {
        "ace": (
            "https://automobiliacollectorsexpo.com/subscribers/47s8b6a364ff/uploaded_files/slider/79ab7b3eed04749a3efe10e4fe9f568b.jpg",
            "https://automobiliacollectorsexpo.com/",
        ),
        "village-thu": (
            "https://www.pebblebeachconcours.net/wp-content/uploads/2023/08/DSC1988_Kimballexp_web.jpg",
            "https://www.pebblebeachconcours.net/events/concours-village/",
        ),
        "paddock": (
            "https://cdn.uploads.webconnex.com/8366/image%20%283%29.png?1761703590705",
            "https://concorso.ticketspice.com/international-car-week",
        ),
        "woodies": (
            "https://assets.milestoneinternet.com/cdn-cgi/image/f=auto/aramark-parent/asilomar-hotel-and-conference-grounds-393348-2/images/woodies-in-the-woods.png?width=800",
            "https://www.visitasilomar.com/things-to-do/car-week",
        ),
        "barnyard-ferrari": (
            "https://static1.squarespace.com/static/5f36d4ac6fa9396eb851a7df/t/6864433c2298e56c57b15055/1751401276159/KrisEvered_Ferrari2022_13.jpg?format=1500w",
            "https://www.bigsurfoodandwine.org/popup-events/28th-annual-ferrari-event-at-the-barnyard",
        ),
    }

    final: dict[str, dict] = {}

    def put(eid: str, url: str, page: str, cz: str, ce: str, az: str, ae: str, lic: str) -> None:
        if eid in final:
            raise SystemExit(f"duplicate event mapping: {eid}")
        final[eid] = {
            "url": url,
            "page": page,
            "credit_zh": cz,
            "credit_en": ce,
            "alt_zh": az,
            "alt_en": ae,
            "license": lic,
        }

    put("kickoff", flickr_urls["kickoff"], flickr_pages["kickoff"], "smaedli / Flickr · CC BY 2.0", "smaedli / Flickr · CC BY 2.0", "2019 Monterey Car Week Kickoff", "2019 Monterey Car Week Kickoff", "wikimedia-cc")
    put("prereunion-sat", flickr_urls["prereunion-sat"], flickr_pages["prereunion-sat"], "United Autosports / Flickr · CC BY-SA 2.0", "United Autosports / Flickr · CC BY-SA 2.0", "2016 Monterey Pre-Reunion · Laguna Seca", "2016 Monterey Pre-Reunion at Laguna Seca", "wikimedia-cc")
    put("prereunion-sun", flickr_urls["prereunion-sun"], flickr_pages["prereunion-sun"], "United Autosports / Flickr · CC BY-SA 2.0", "United Autosports / Flickr · CC BY-SA 2.0", "2016 Monterey Pre-Reunion 另一组别", "2016 Monterey Pre-Reunion (another group)", "wikimedia-cc")
    put("legends", flickr_urls["legends"], flickr_pages["legends"], "smaedli / Flickr · CC BY 2.0", "smaedli / Flickr · CC BY 2.0", "2022 Legends of the Autobahn", "2022 Legends of the Autobahn", "wikimedia-cc")
    put("little-car", flickr_urls["little-car"], flickr_pages["little-car"], "jaycross / Flickr · CC BY 2.0", "jaycross / Flickr · CC BY 2.0", "Pacific Grove Little Car Show 往年", "Past Little Car Show in Pacific Grove", "wikimedia-cc")
    put("lemons", flickr_urls["lemons"], flickr_pages["lemons"], "SeeMonterey / Flickr · CC BY-NC-SA 2.0", "SeeMonterey / Flickr · CC BY-NC-SA 2.0", "2010 Concours d’LeMons Seaside", "2010 Concours d’LeMons in Seaside", "wikimedia-cc")
    put("gooding-fri", flickr_urls["gooding-fri"], flickr_pages["gooding-fri"], "PhotographyByPaul / Flickr · CC BY-NC 2.0", "PhotographyByPaul / Flickr · CC BY-NC 2.0", "2009 Gooding Pebble Beach 拍卖场", "2009 Gooding Pebble Beach auction", "wikimedia-cc")
    put("gooding-sat", flickr_urls["gooding-sat"], flickr_pages["gooding-sat"], "PhotographyByPaul / Flickr · CC BY-NC 2.0", "PhotographyByPaul / Flickr · CC BY-NC 2.0", "2009 Gooding Pebble Beach 另一视角", "2009 Gooding Pebble Beach (another view)", "wikimedia-cc")
    put("pg-rally", flickr_urls["pg-rally"], flickr_pages["pg-rally"], "wbaiv / Flickr · CC BY-SA 2.0", "wbaiv / Flickr · CC BY-SA 2.0", "Pacific Grove Rolling Concours / Auto Rally 往年", "Past Pacific Grove Rolling Concours / Auto Rally", "wikimedia-cc")
    put("werks", flickr_urls["werks"], flickr_pages["werks"], "J.Pitt / Flickr · CC BY-NC 2.0", "J.Pitt / Flickr · CC BY-NC 2.0", "Werks Reunion 相关往年 Porsche 展场", "Past Werks Reunion–related Porsche gathering", "wikimedia-cc")
    put("cruise-in", flickr_urls["cruise-in"], flickr_pages["cruise-in"], "rtilden / Flickr · CC BY 2.0", "rtilden / Flickr · CC BY 2.0", "Monterey Car Week 街头车头阵列", "Monterey Car Week street grill line-up", "wikimedia-cc")
    put("mmf", flickr_urls["mmf"], flickr_pages["mmf"], "smaedli / Flickr · CC BY 2.0", "smaedli / Flickr · CC BY 2.0", "2021 Monterey Car Week 周边车辆氛围", "2021 Monterey Car Week surrounding cars", "wikimedia-cc")
    put("night-rider", flickr_urls["legends_b"], flickr_pages["legends_b"], "smaedli / Flickr · CC BY 2.0", "smaedli / Flickr · CC BY 2.0", "Monterey Car Week 夜间车展氛围", "Monterey Car Week evening car-show atmosphere", "wikimedia-cc")
    put("luau", flickr_urls["legends_c"], flickr_pages["legends_c"], "smaedli / Flickr · CC BY 2.0", "smaedli / Flickr · CC BY 2.0", "Monterey Car Week 户外车聚氛围", "Monterey Car Week outdoor gathering atmosphere", "wikimedia-cc")
    put("concours-cause", flickr_urls["little-car_b"], flickr_pages["little-car_b"], "jaycross / Flickr · CC BY 2.0", "jaycross / Flickr · CC BY 2.0", "半岛街边经典车展氛围", "Peninsula street classic-car show atmosphere", "wikimedia-cc")
    put("cars-coffee", flickr_urls["kickoff_b"], flickr_pages["kickoff_b"], "smaedli / Flickr · CC BY 2.0", "smaedli / Flickr · CC BY 2.0", "Monterey Car Week 早场车辆氛围", "Monterey Car Week morning car atmosphere", "wikimedia-cc")

    put("exotics", *C["exotics"], "Woestee / CC0（Wikimedia）", "Woestee / CC0 (Wikimedia)", "2024 Exotics on Broadway · Seaside", "2024 Exotics on Broadway in Seaside", "public-domain")
    put("concours", *C["concours"], "Prova MO / CC BY-SA 4.0", "Prova MO / CC BY-SA 4.0", "2023 Pebble Beach Concours 展场", "2023 Pebble Beach Concours show field", "wikimedia-cc")
    put("tour", *C["tour"], "Moto Club4AG / CC BY 2.0", "Moto Club4AG / CC BY 2.0", "2011 Tour d’Elegance 巡游车辆", "2011 Tour d’Elegance participant", "wikimedia-cc")
    put("motoring-classic", *C["motoring-classic"], "Dale Simonson / CC BY-SA 2.0", "Dale Simonson / CC BY-SA 2.0", "2011 Pebble Beach Motoring Classic", "2011 Pebble Beach Motoring Classic", "wikimedia-cc")
    put("rmmr-wed", *C["rmmr-wed"], "Prova MO / CC BY-SA 4.0", "Prova MO / CC BY-SA 4.0", "2022 Rolex Monterey Motorsports Reunion", "2022 Rolex Monterey Motorsports Reunion", "wikimedia-cc")
    put("rmmr-thu", *C["rmmr-thu"], "Prova MO / CC BY-SA 4.0", "Prova MO / CC BY-SA 4.0", "2022 RMMR · Porsche 550", "2022 RMMR · Porsche 550", "wikimedia-cc")
    put("rmmr-fri", *C["rmmr-fri"], "Prova MO / CC BY-SA 4.0", "Prova MO / CC BY-SA 4.0", "2022 RMMR · Brabham BT44", "2022 RMMR · Brabham BT44", "wikimedia-cc")
    put("rmmr-sat", *C["rmmr-sat"], "Prova MO / CC BY-SA 4.0", "Prova MO / CC BY-SA 4.0", "2022 RMMR · Ferrari 250 LM", "2022 RMMR · Ferrari 250 LM", "wikimedia-cc")
    put("gooding-thu", *C["gooding-thu"], "Prova MO / CC BY-SA 4.0", "Prova MO / CC BY-SA 4.0", "2022 Gooding Pebble Beach 拍卖车辆", "2022 Gooding Pebble Beach auction car", "wikimedia-cc")
    put("quail", *C["quail"], "DuneSeaTrader / CC BY-SA 4.0", "DuneSeaTrader / CC BY-SA 4.0", "2017 The Quail Motorsports Gathering", "2017 The Quail, A Motorsports Gathering", "wikimedia-cc")
    put("broad-arrow", *C["broad-arrow"], "Aekkm / CC BY-SA 4.0", "Aekkm / CC BY-SA 4.0", "2014 Quail 校园拍卖场 Ferrari（Bonhams 时代）", "2014 Quail-campus auction Ferrari (Bonhams era)", "wikimedia-cc")
    put("concorso", *C["concorso"], "James Bond / Flickr · CC BY 2.0", "James Bond / Flickr · CC BY 2.0", "2014 Concorso Italiano", "2014 Concorso Italiano", "wikimedia-cc")
    put("motorlux", *C["motorlux"], "Moto Club4AG / CC BY 2.0", "Moto Club4AG / CC BY 2.0", "McCall’s Motorworks Reunion（Motorlux 前身）", "McCall’s Motorworks Reunion (Motorlux predecessor)", "wikimedia-cc")
    put("porsche-seaside", *C["porsche-seaside"], "Moto Club4AG / CC BY 2.0", "Moto Club4AG / CC BY 2.0", "Monterey 车周 Porsche 相关展场往年", "Past Monterey Car Week Porsche gathering", "wikimedia-cc")
    put("ace-auction", *C["ace-auction"], "Moto Club4AG / CC BY 2.0", "Moto Club4AG / CC BY 2.0", "Monterey 车周精品展/拍卖氛围往年", "Past Monterey Car Week collector/auction atmosphere", "wikimedia-cc")
    put("forum-thu", *C["forum-thu"], "Prova MO / CC BY-SA 4.0", "Prova MO / CC BY-SA 4.0", "Concours 会场经典车（论坛同期场地）", "Classic car on Concours grounds (Forum venue area)", "wikimedia-cc")
    put("forum-fri", *C["forum-fri"], "Rex Gray / CC BY 2.0", "Rex Gray / CC BY 2.0", "2007 Pebble Beach Concours 展车", "2007 Pebble Beach Concours exhibit", "wikimedia-cc")
    put("forum-sat", *C["forum-sat"], "Guy Kawasaki / CC BY-SA 2.0", "Guy Kawasaki / CC BY-SA 2.0", "2016 Pebble Beach Concours 另一视角", "2016 Pebble Beach Concours (another view)", "wikimedia-cc")
    put("village-fri", *C["village-fri"], "Guy Kawasaki / CC BY-SA 2.0", "Guy Kawasaki / CC BY-SA 2.0", "2016 Pebble Beach Concours 会场周边", "2016 Pebble Beach Concours grounds", "wikimedia-cc")
    put("village-sat", *C["village-sat"], "Prova MO / CC BY-SA 4.0", "Prova MO / CC BY-SA 4.0", "2023 Concours 会场展区", "2023 Concours grounds display", "wikimedia-cc")
    put("village-sun", *C["village-sun"], "Prova MO / CC BY-SA 4.0", "Prova MO / CC BY-SA 4.0", "2023 Concours 会场展车", "2023 Concours grounds display car", "wikimedia-cc")
    put("poker-rally", *C["poker-rally"], "Craig Howell / CC BY 2.0", "Craig Howell / CC BY 2.0", "半岛经典赛车聚会氛围", "Peninsula historic-car gathering atmosphere", "wikimedia-cc")
    put("asilomar-day", *C["asilomar-day"], "Ed Bierman / CC BY 2.0", "Ed Bierman / CC BY 2.0", "Asilomar Conference Grounds 入口", "Asilomar Conference Grounds entrance", "wikimedia-cc")
    put("electric-coast-mon", *C["electric-coast-mon"], "The wub / CC BY-SA 4.0", "The wub / CC BY-SA 4.0", "Asilomar 海岸（Electric Coast 会场周边）", "Asilomar coast near Electric Coast venue", "wikimedia-cc")
    put("electric-coast-tue", *C["electric-coast-tue"], "Wikimedia / CC BY-SA 3.0", "Wikimedia / CC BY-SA 3.0", "Asilomar Merrill Hall", "Merrill Hall at Asilomar", "wikimedia-cc")
    put("stanton", *C["stanton"], "Jsweida / CC BY-SA 3.0", "Jsweida / CC BY-SA 3.0", "Custom House Plaza（Stanton Center 所在地）", "Custom House Plaza (Stanton Center locale)", "wikimedia-cc")
    put("monterey-british", *C["monterey-british"], "Bull-Doser / Public domain", "Bull-Doser / Public domain", "英系经典车展 MG（同类型往年）", "British classic MG at a car show (same-genre past photo)", "public-domain")
    put("astons", *C["astons"], "Bull-Doser / Public domain", "Bull-Doser / Public domain", "英系跑车展场氛围（同类型往年）", "British sports-car show atmosphere (same-genre past photo)", "public-domain")
    put("ferrari-carmel", *C["ferrari-carmel"], "Tabercil / CC BY-SA 2.0", "Tabercil / CC BY-SA 2.0", "Ferrari California 展车（同品牌活动类型）", "Ferrari California display (same-marque event genre)", "wikimedia-cc")

    put("ace", *ORG["ace"], "Automobilia Collectors Expo 官网", "Automobilia Collectors Expo official site", "ACE 往年展场官方图", "Official past ACE expo image", "organizer-press")
    put("village-thu", *ORG["village-thu"], "Pebble Beach Concours 官网", "Pebble Beach Concours official", "Concours Village 往年现场", "Past Concours Village scene", "organizer-press")
    put("paddock", *ORG["paddock"], "The Paddock / International Car Week", "The Paddock / International Car Week", "The Paddock 官方活动图", "Official The Paddock event image", "organizer-press")
    put("woodies", *ORG["woodies"], "Asilomar / Visit Asilomar", "Asilomar / Visit Asilomar", "Woodies in the Woods 官方宣传图", "Official Woodies in the Woods image", "organizer-press")
    put("barnyard-ferrari", *ORG["barnyard-ferrari"], "Big Sur Food & Wine / Kris Evered", "Big Sur Food & Wine / Kris Evered", "2022 Barnyard Ferrari 活动", "2022 Ferrari Event at The Barnyard", "organizer-press")

    needed = [
        "kickoff", "asilomar-day", "prereunion-sat", "prereunion-sun", "electric-coast-mon",
        "monterey-british", "porsche-seaside", "ace", "poker-rally", "concours-cause",
        "ace-auction", "electric-coast-tue", "night-rider", "little-car", "astons",
        "motoring-classic", "rmmr-wed", "luau", "motorlux", "tour", "ferrari-carmel",
        "legends", "woodies", "village-thu", "rmmr-thu", "gooding-thu", "forum-thu",
        "werks", "paddock", "rmmr-fri", "village-fri", "forum-fri", "gooding-fri",
        "quail", "broad-arrow", "pg-rally", "lemons", "cars-coffee", "barnyard-ferrari",
        "exotics", "rmmr-sat", "concorso", "village-sat", "gooding-sat", "forum-sat",
        "mmf", "concours", "village-sun", "cruise-in", "stanton",
    ]
    missing = [eid for eid in needed if eid not in final]
    if missing:
        raise SystemExit(f"missing mappings: {missing}")
    urls = [item["url"] for item in final.values()]
    if len(set(urls)) != len(urls):
        raise SystemExit("duplicate image URLs in mapping")

    library_lines = ["  thumbLibrary: {"]
    for eid in needed:
        meta = final[eid]
        raw = Path(f"/tmp/pebble-ev-{eid}.src")
        webp = OUT / f"{eid}.webp"
        if webp.exists() and webp.stat().st_size > 1000:
            size = webp.stat().st_size
            print(f"skip {eid} ({size} bytes)")
        else:
            print(f"download {eid} ...")
            download(meta["url"], raw)
            size = to_webp(raw, webp)
            raw.unlink(missing_ok=True)
            print(f"  -> {size} bytes")
        library_lines.append(f"    '{eid}': {{")
        library_lines.append(
            f"      src: {js_str(f'assets/img/events/{eid}.webp')}, width: 240, height: 160, license: {js_str(meta['license'])},"
        )
        library_lines.append(
            f"      alt: {{ zh: {js_str(meta['alt_zh'])}, en: {js_str(meta['alt_en'])} }},"
        )
        library_lines.append(
            f"      credit: {{ zh: {js_str(meta['credit_zh'])}, en: {js_str(meta['credit_en'])} }},"
        )
        library_lines.append(f"      sourceUrl: {js_str(meta['page'])}")
        library_lines.append("    },")
    library_lines.append("  },")
    library_block = "\n".join(library_lines)

    text = DATA_JS.read_text()
    # Replace entire thumbLibrary object
    pattern = re.compile(r"  thumbLibrary: \{.*?\n  \},", re.S)
    if not pattern.search(text):
        raise SystemExit("thumbLibrary block not found")
    text = pattern.sub(library_block, text, count=1)

    # Force thumbId = event id
    text = re.sub(
        r"id: '([a-z0-9-]+)',\s*thumbId: '[a-z0-9-]+',",
        r"id: '\1', thumbId: '\1',",
        text,
    )

    DATA_JS.write_text(text)
    total = sum((OUT / f"{eid}.webp").stat().st_size for eid in needed)
    print(f"done: {len(needed)} unique thumbs, {total} bytes total")


if __name__ == "__main__":
    main()
