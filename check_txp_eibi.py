import urllib.request
import ssl
import csv
import io

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
req = urllib.request.Request("https://www.eibispace.de/dx/sked-a26.csv", headers={"User-Agent": "OndasCurtas/1.0"})
with urllib.request.urlopen(req, context=ctx) as resp:
    raw = resp.read().decode("latin-1")

txps = set()
reader = csv.reader(io.StringIO(raw), delimiter=";")
for i, row in enumerate(reader):
    if i > 0 and len(row) > 12:
        txp = row[12].strip()
        if txp:
            txps.add(txp)

print(f"Total unique TxPs in EiBi: {len(txps)}")
print(list(txps)[:20])
