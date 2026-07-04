import re

with open("../scripts/parse_eibi.py", "r") as f:
    content = f.read()

new_itu = {
    "ALS": "Alaska", "B": "Brazil", "CLA": "Clandestine", "COG": "Congo", "CTI": "Cote d'Ivoire",
    "EQA": "Ecuador", "HKG": "Hong Kong", "HOL": "Netherlands", "I": "Italy", "INS": "Indonesia",
    "KRE": "North Korea", "LBR": "Liberia", "MLA": "Malaysia", "MYA": "Myanmar", "POL": "Poland",
    "S": "Sweden", "SLM": "Solomon Islands", "SUI": "Switzerland", "SVK": "Slovakia",
    "TCD": "Chad", "UN": "United Nations", "VUT": "Vanuatu", "XUU": "Clandestine",
    "PRK": "North Korea", "KOR": "South Korea", "TWN": "Taiwan", "GUM": "Guam"
}

new_lang = {
    "I": "Italian", "J": "Japanese", "K": "Korean", "P": "Portuguese",
    "R": "Russian", "S": "Spanish", "T": "Turkish", "M": "Mandarin",
    "C-M": "Mandarin", "C-A": "Amoy", "Q": "Quechua", "Q,S": "Quechua/Spanish",
    "S,Q": "Spanish/Quechua", "PO": "Polish", "KOR": "Korean", "TAG": "Tagalog",
    "TAM": "Tamil", "IN": "Indonesian", "FS": "Farsi", "HB": "Hebrew",
    "VN": "Vietnamese", "E,R": "English/Russian", "D,E": "German/English",
    "DU": "Dutch", "ROH": "Rohingya", "RUM": "Romanian", "SUD": "Sudanese",
    "SUN": "Sundanese", "TL": "Tagalog", "UM": "Umbundu", "WA": "Wa",
    "WAO": "Wa", "YAO": "Yao", "TGR": "Tigre", "TU": "Turkish",
    "SM": "Samoan", "SUA": "Suahili", "SLM": "Solomon", "SD": "Sindhi",
    "RAK": "Rakhine", "OR": "Odia", "NU": "Nuer", "NLA": "Nyanja",
    "MGO": "Mongo", "MAN": "Mandinka", "MAD": "Madurese", "LTO": "Luo",
    "LIS": "Lisu", "LB": "Lebanese", "LAH": "Lahnda", "KZ": "Kazakh",
    "KUN": "Kunama", "KT": "Kutchi", "KNU": "Karen", "KNK": "Kanak",
    "KH": "Khmer", "KG": "Kyrgyz", "KEN": "Kenyang", "KC": "Kachin",
    "KBO": "Kabo", "KAM": "Kamba", "KAD": "Kadazan", "K-P": "Korean/Pashto",
    "JV": "Javanese", "JU": "Jula", "IG": "Igbo", "IB": "Iban",
    "HUI": "Hui", "HMW": "Hmong", "HMQ": "Hmong", "HMB": "Hmong",
    "HK": "Hakka", "GZ": "Gujarati", "GE": "Georgian", "FUR": "Fur",
    "FU": "Fulani", "DR": "Dari", "D-P": "Dari/Pashto", "CR": "Creole",
    "COK": "Chokwe", "COF": "Cofan", "BY": "Buryat", "BU": "Burmese",
    "BT": "Batak", "BSL": "Bislama", "BR": "Breton", "BM": "Bambara",
    "BC": "Baluchi",
}

def dict_to_str(d):
    return ", ".join(f'"{k}": "{v}"' for k, v in d.items())

itu_str = dict_to_str(new_itu)
lang_str = dict_to_str(new_lang)

content = content.replace("    \"YEM\": \"Yemen\",\n}", f"    \"YEM\": \"Yemen\",\n    {itu_str}\n}}")
content = content.replace("    \"CRE\": \"Creole\",\n}", f"    \"CRE\": \"Creole\",\n    {lang_str}\n}}")

with open("../scripts/parse_eibi.py", "w") as f:
    f.write(content)

print("Updated parse_eibi.py")
