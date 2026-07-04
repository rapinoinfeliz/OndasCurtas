import csv

# Parse HFCC site.txt
sites = {}
with open('hfcc_data/site.txt', 'r', encoding='latin-1') as f:
    for line in f:
        if line.startswith(';'): continue
        # --+------------------------------+---+-----+------
        # Co Site Name                      ADM Lati  Longi
        if len(line) >= 48:
            code = line[0:3].strip()
            if code:
                name = line[4:34].strip()
                adm = line[35:38].strip()
                lat = line[39:44].strip()
                lon = line[45:51].strip()
                sites[code] = {'name': name, 'lat': lat, 'lon': lon}

print(f"Loaded {len(sites)} sites from HFCC.")

# Assuming parse_eibi.py downloaded EiBi, let's just grep a few TxPs from a downloaded eibi csv
import urllib.request
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
req = urllib.request.Request("https://www.eibispace.de/dx/sked-a26.csv", headers={"User-Agent": "OndasCurtas/1.0"})
with urllib.request.urlopen(req, context=ctx) as resp:
    raw = resp.read().decode("latin-1")

found = 0
total = 0
import csv, io
reader = csv.reader(io.StringIO(raw), delimiter=";")
for row in reader:
    if len(row) > 12:
        txp = row[12].strip().upper()
        if txp:
            total += 1
            if txp in sites:
                found += 1
print(f"Matched {found}/{total} TxPs from EiBi to HFCC.")
