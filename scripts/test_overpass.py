import requests

headers = {'User-Agent': 'CoolRoute-Pilot-Cuttack/1.0 (hackathon@pilot.edu)'}
query = '[out:json][timeout:15];way["highway"](20.459,85.892,20.467,85.899);out count;'
endpoints = [
    "https://overpass.openstreetmap.fr/api/interpreter",
    "https://overpass.osm.ch/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass-api.de/api/interpreter"
]

for ep in endpoints:
    try:
        r = requests.post(ep, data={"data": query}, headers=headers, timeout=12)
        print(f"{ep}: {r.status_code}, data={r.text[:80]}", flush=True)
    except Exception as e:
        print(f"{ep}: failed {e}", flush=True)
