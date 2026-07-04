import json
with open('site/data/country_coords.json', 'r') as f:
    itu_coords = json.load(f)

itu_coords.update({
    "POL": [51.9194, 19.1451], "ALS": [64.2008, -149.4937], "VUT": [-15.3767, 166.9592], 
    "HKG": [22.3193, 114.1694], "XUU": [0, 0], "CLA": [0, 0], "MYA": [21.9162, 95.9560], 
    "EQA": [-1.8312, -78.1834], "TCD": [15.4542, 18.7322], "CTI": [7.5400, -5.5471], 
    "INS": [-0.7893, 113.9213], "COG": [-0.2280, 15.8277], "SUI": [46.8182, 8.2275], 
    "SLM": [-9.6457, 160.1562], "LBR": [6.4281, -9.4295], "SVK": [48.6690, 19.6990], 
    "HOL": [52.1326, 5.2913], "MLA": [4.2105, 101.9758]
})
with open('site/data/country_coords.json', 'w') as f:
    json.dump(itu_coords, f)
