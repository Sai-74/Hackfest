import requests

candidates = [
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass.nchc.org.tw/api/interpreter",
    "https://overpass.openhistoricalmap.org/api/interpreter"
]
headers = {'User-Agent': 'CoolRoute-Pilot-Cuttack/1.0 (hackfest@pilot.edu)'}
query = '[out:json][timeout:10];way["highway"](20.459,85.892,20.467,85.899);out count;'

for c in candidates:
    try:
        r = requests.post(c, data={"data": query}, headers=headers, timeout=8)
        print(f"{c} -> {r.status_code}")
    except Exception as e:
        print(f"{c} -> error: {e}")

