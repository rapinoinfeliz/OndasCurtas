#!/usr/bin/env python3
"""
parse_eibi.py — Parser EiBi → transmissoes.json

Baixa o CSV da temporada vigente do EiBi (eibispace.de) e gera
site/data/transmissoes.json compatível com o front-end OndasCurtas.

Uso:
    python scripts/parse_eibi.py
    python scripts/parse_eibi.py --local eibi.csv
    python scripts/parse_eibi.py --out site/data/transmissoes.json
    python scripts/parse_eibi.py --dry-run
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import math
import re
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

# ---------------------------------------------------------------------------
# Configuração
# ---------------------------------------------------------------------------

# EiBi publica dois CSV por temporada: sked.csv (completo) e sked_b.csv (inverno)
# O nome no site segue o padrão: sked[a|b][YY].csv  ex: skeda26.csv, skedb25.csv
EIBI_BASE_URL = "https://www.eibispace.de/dx/"

# Sufixo do arquivo EiBi: sked-a26.csv (com hífen, descoberto na página principal)
EIBI_FILE_PATTERN = "sked-{season}{yy}.csv"

# Campos do CSV EiBi (delimitado por ';'), conforme documentação em eibispace.de/dx/README.TXT
# frq;TIME;DAYS;ITU;STAT;Lang;Target;Remarks;P;Start;Stop;Persist;TxP;Antenna;Remarks2;IRR;
# frq = frequência em kHz (decimal, vírgula como separador de milhar)
# TIME = HHMM-HHMM UTC
# DAYS = string de dias (1234567 = seg-dom, vazio = todos)
# ITU = código de país ITU do transmissor (código 3 letras)
# STAT = nome/sigla da estação
# Lang = código de idioma
# Target = área alvo
# P = potência kW
EIBI_FIELDS = [
    "frq", "TIME", "DAYS", "ITU", "STAT", "Lang", "Target",
    "Remarks", "P", "Start", "Stop", "Persist", "TxP", "Antenna", "Remarks2", "IRR"
]

# Mapeamento código ITU → nome do país (subconjunto mais comum em SW)
ITU_TO_COUNTRY: dict[str, str] = {
    "AFS": "South Africa", "ALB": "Albania", "ALG": "Algeria",
    "ARG": "Argentina", "ARM": "Armenia", "AUS": "Australia",
    "AUT": "Austria", "AZE": "Azerbaijan", "BEL": "Belgium",
    "BGD": "Bangladesh", "BGR": "Bulgaria", "BHR": "Bahrain",
    "BLR": "Belarus", "BOL": "Bolivia", "BRA": "Brazil",
    "CAN": "Canada", "CHN": "China", "CHL": "Chile",
    "CLM": "Colombia", "CME": "Cameroon", "CUB": "Cuba",
    "CVA": "Vatican", "CZE": "Czech Republic", "D": "Germany",
    "DEU": "Germany", "DNK": "Denmark", "E": "Spain",
    "EGY": "Egypt", "ERI": "Eritrea", "ESP": "Spain",
    "ETH": "Ethiopia", "F": "France", "FIN": "Finland",
    "FRA": "France", "G": "United Kingdom", "GBR": "United Kingdom",
    "GRC": "Greece", "GUM": "Guam", "HNG": "Hungary",
    "HRV": "Croatia", "IND": "India", "IRL": "Ireland",
    "IRN": "Iran", "IRQ": "Iraq", "ISR": "Israel",
    "ITA": "Italy", "J": "Japan", "JPN": "Japan",
    "KAZ": "Kazakhstan", "KOR": "South Korea", "KWT": "Kuwait",
    "LBN": "Lebanon", "LBY": "Libya", "LTU": "Lithuania",
    "MAR": "Morocco", "MDA": "Moldova", "MDG": "Madagascar",
    "MEX": "Mexico", "MLI": "Mali", "MNG": "Mongolia",
    "MRT": "Mauritania", "NCG": "Nicaragua", "NIG": "Niger",
    "NOR": "Norway", "NPL": "Nepal", "NZL": "New Zealand",
    "OMN": "Oman", "PAK": "Pakistan", "PHL": "Philippines",
    "POR": "Portugal", "PRU": "Peru", "QAT": "Qatar",
    "ROU": "Romania", "RUS": "Russia", "SAU": "Saudi Arabia",
    "SDN": "Sudan", "SNG": "Singapore", "SOM": "Somalia",
    "SRB": "Serbia", "SWZ": "Swaziland", "SYR": "Syria",
    "THA": "Thailand", "TJK": "Tajikistan", "TUN": "Tunisia",
    "TUR": "Turkey", "TWN": "Taiwan", "UAE": "UAE",
    "UKR": "Ukraine", "URG": "Uruguay", "USA": "USA",
    "UZB": "Uzbekistan", "VEN": "Venezuela", "VTN": "Vietnam",
    "YEM": "Yemen",
    "ALS": "Alaska", "B": "Brazil", "CLA": "Clandestine", "COG": "Congo", "CTI": "Cote d'Ivoire", "EQA": "Ecuador", "HKG": "Hong Kong", "HOL": "Netherlands", "I": "Italy", "INS": "Indonesia", "KRE": "North Korea", "LBR": "Liberia", "MLA": "Malaysia", "MYA": "Myanmar", "POL": "Poland", "S": "Sweden", "SLM": "Solomon Islands", "SUI": "Switzerland", "SVK": "Slovakia", "TCD": "Chad", "UN": "United Nations", "VUT": "Vanuatu", "XUU": "Clandestine", "PRK": "North Korea", "KOR": "South Korea", "TWN": "Taiwan", "GUM": "Guam"
}

# Mapeamento código idioma EiBi → nome legível (subconjunto)
LANG_TO_NAME: dict[str, str] = {
    # --- EiBi-specific codes ---
    "AFA": "Afar", "AFG": "Pashto/Dari", "AH": "Amharic",
    "AIO": "Aio", "AKL": "Aklanon", "AKU": "Akan",
    "AL": "Albanian", "AMD": "Hausa/Bambara", "ARO": "Arabic/Other",
    "ASS": "Assamese", "AW": "Awar/Avar",
    "BAI": "Bai", "BAJ": "Bajau", "BAK": "Bakweri",
    "BAL": "Balochi", "BAN": "Bandi", "BAO": "Baoule",
    "BAS": "Bassa", "BAT": "Bati", "BAU": "Baudde",
    "BCN": "Bine/Kuni", "BED": "Bedik",
    "BEM": "Bemba", "BEN": "Bende",
    "BIL": "Bilaan", "BIS": "Bislama", "BIW": "Biwat",
    "BJS": "Bajan Creole", "BLT": "Balti",
    "BNG": "Bongo", "BOK": "Bokyi", "BON": "Bontoc",
    "BOR": "Bora", "BRU": "Bru",
    "BUG": "Bugis", "BUK": "Bukat", "BUL": "Bulung",
    "BUN": "Bunu",
    # --- ISO codes (standard) ---
    "A": "Arabic", "AB": "Abkhaz",
    "AF": "Afrikaans", "AM": "Amharic", "AR": "Arabic",
    "AZ": "Azerbaijani", "B": "Burmese", "BA": "Bashkir",
    "BE": "Belarusian", "BG": "Bulgarian", "BN": "Bengali",
    "BS": "Bosnian", "C": "Chinese (Mandarin)", "CA": "Catalan",
    "CS": "Czech", "CZ": "Czech", "D": "German", "DA": "Danish",
    "DE": "German", "DZ": "Dzongkha", "E": "English",
    "EL": "Greek", "EN": "English", "EO": "Esperanto",
    "ES": "Spanish", "ET": "Estonian", "EU": "Basque",
    "F": "French", "FA": "Persian/Farsi", "FI": "Finnish",
    "FR": "French", "GA": "Irish", "GU": "Gujarati",
    "HA": "Hausa", "HE": "Hebrew", "HI": "Hindi",
    "HR": "Croatian", "HU": "Hungarian", "HY": "Armenian",
    "I": "Italian", "ID": "Indonesian", "IT": "Italian",
    "J": "Japanese", "JA": "Japanese", "JP": "Japanese",
    "K": "Korean", "KA": "Georgian", "KK": "Kazakh",
    "KM": "Khmer", "KN": "Kannada", "KO": "Korean",
    "KU": "Kurdish", "KY": "Kyrgyz", "L": "Lao", "LO": "Lao",
    "LT": "Lithuanian", "LV": "Latvian", "MK": "Macedonian",
    "ML": "Malayalam", "MN": "Mongolian", "MR": "Marathi",
    "MS": "Malay", "MY": "Burmese", "NE": "Nepali",
    "NL": "Dutch", "NO": "Norwegian", "P": "Portuguese", "PA": "Punjabi",
    "PL": "Polish", "PS": "Pashto", "PT": "Portuguese",
    "R": "Russian", "RO": "Romanian", "RU": "Russian", "SI": "Sinhala",
    "S": "Spanish", "SK": "Slovak", "SL": "Slovenian", "SO": "Somali",
    "SQ": "Albanian", "SR": "Serbian", "SV": "Swedish",
    "SW": "Swahili", "T": "Thai", "TA": "Tamil", "TE": "Telugu",
    "TG": "Tajik", "TH": "Thai", "TI": "Tigrinya",
    "TK": "Turkmen", "TR": "Turkish", "TT": "Tatar",
    "U": "Urdu", "UG": "Uyghur", "UK": "Ukrainian", "UR": "Urdu",
    "UZ": "Uzbek", "V": "Vietnamese", "VI": "Vietnamese", "YI": "Yiddish",
    "YO": "Yoruba", "ZH": "Chinese", "ZU": "Zulu",
    # --- mais EiBi específicos ---
    "CAN": "Cantonese", "CHN": "Cantonese", "WU": "Wu Chinese",
    "MIN": "Min Nan Chinese", "HAK": "Hakka Chinese",
    "KIR": "Kirghiz", "KAB": "Kabyle", "SHO": "Shona",
    "NDE": "Ndebele", "TSO": "Tsonga", "TSW": "Tswana",
    "SOT": "Sotho", "ZUL": "Zulu", "XHO": "Xhosa",
    "VEN": "Venda", "PED": "Pedi", "SWA": "Swati",
    "FUL": "Fulani", "TWI": "Twi", "EWE": "Ewe",
    "GAN": "Gan Chinese", "ORO": "Oromo", "SOM": "Somali",
    "TIG": "Tigre", "AFR": "Afrikaans", "SAN": "Sanskrit",
    "MAR": "Marathi", "GUJ": "Gujarati", "ORI": "Odia",
    "MAL": "Malayalam", "KAN": "Kannada", "TEL": "Telugu",
    "PUN": "Punjabi", "SIN": "Sinhala", "NEP": "Nepali",
    "BUR": "Burmese", "LAO": "Lao", "KHM": "Khmer",
    "MON": "Mongolian", "TIB": "Tibetan", "UYG": "Uyghur",
    "KAZ": "Kazakh", "TAJ": "Tajik", "TUR": "Turkmen",
    "UZB": "Uzbek", "AZE": "Azerbaijani", "ARM": "Armenian",
    "GEO": "Georgian", "ALB": "Albanian", "MAC": "Macedonian",
    "BOS": "Bosnian", "SER": "Serbian", "CRO": "Croatian",
    "SLO": "Slovak", "SLV": "Slovenian", "BUL": "Bulgarian",
    "ROM": "Romanian", "HUN": "Hungarian", "POL": "Polish",
    "CZE": "Czech", "LIT": "Lithuanian", "LAT": "Latvian",
    "EST": "Estonian", "FIN": "Finnish", "SWE": "Swedish",
    "DAN": "Danish", "NOR": "Norwegian", "DUT": "Dutch",
    "ITA": "Italian", "POR": "Portuguese", "SPA": "Spanish",
    "CAT": "Catalan", "GER": "German", "FRE": "French",
    "GRE": "Greek", "RUS": "Russian", "UKR": "Ukrainian",
    "BEL": "Belarusian", "ENG": "English", "ARA": "Arabic",
    "HEB": "Hebrew", "PER": "Persian/Farsi", "KUR": "Kurdish",
    "TUR2": "Turkish", "SWA2": "Swahili", "HAU": "Hausa",
    "YOR": "Yoruba", "IBO": "Igbo", "AMH": "Amharic",
    "ORO2": "Oromo", "SOM2": "Somali", "TIG2": "Tigrinya",
    "AFA2": "Afar", "BEJ": "Beja", "NUE": "Nuer",
    "DIN": "Dinka", "LUG": "Luganda", "LIN": "Lingala",
    "KON": "Kongo", "CHE": "Chechen", "ING": "Ingush",
    "OSS": "Ossetian", "DAR": "Dargwa", "AVA": "Avar",
    "LEZ": "Lezgin", "BAL2": "Baluchi", "BRA": "Braj",
    "AWA": "Awadhi", "MAI": "Maithili", "BOJ": "Bhojpuri",
    "RAJ": "Rajasthani", "DOG": "Dogri", "KON2": "Konkani",
    "KAS": "Kashmiri", "BLO": "Balochi", "WAZ": "Waziri",
    "CHA": "Chaozhou", "TEO": "Teochew", "CLAS": "Classical",
    "VER": "Vernacular", "FRA2": "Francophone",
    "PID": "Pidgin", "CRE": "Creole",
}

# ---------------------------------------------------------------------------
# Utilitários
# ---------------------------------------------------------------------------

def current_season() -> tuple[str, str]:
    """Retorna (letra_temporada, ano_2dig). Ex: ('a', '26') ou ('b', '25')."""
    now = datetime.now(timezone.utc)
    year = now.year
    month = now.month
    # Temporada A: ~março–outubro; temporada B: ~outubro–março
    if 3 <= month <= 9:
        return "a", str(year)[-2:]
    else:
        # Nov-Dez = temporada B do ano corrente; Jan-Fev = B do ano anterior
        if month >= 10:
            return "b", str(year)[-2:]
        else:
            return "b", str(year - 1)[-2:]


def build_eibi_url() -> str:
    season, yy = current_season()
    return f"{EIBI_BASE_URL}sked-{season}{yy}.csv"


def freq_to_banda(freq_khz: float) -> str:
    """
    Converte frequência kHz para designação de banda padrão ITU em metros.
    Referência: ITU Radio Regulations, Appendix 26 (SW broadcasting bands).
    """
    if freq_khz <= 0:
        return "?"
    # Bandas ITU de radiodifusão SW (em kHz): (lo, hi, label)
    SW_BANDS = [
        (2_300,  2_495,  "120m"),
        (3_200,  3_400,  "90m"),
        (3_900,  4_000,  "75m"),
        (4_750,  5_060,  "60m"),
        (5_900,  6_200,  "49m"),
        (7_200,  7_450,  "41m"),
        (9_400,  9_900,  "31m"),
        (11_600, 12_100, "25m"),
        (13_570, 13_870, "22m"),
        (15_100, 15_800, "19m"),
        (17_480, 17_900, "16m"),
        (18_900, 19_020, "15m"),
        (21_450, 21_850, "13m"),
        (25_600, 26_100, "11m"),
    ]
    for lo, hi, label in SW_BANDS:
        if lo <= freq_khz <= hi:
            return label
    # Fora das bandas ITU: retorna designação genérica por comprimento de onda
    m = round(300_000 / freq_khz)
    return f"~{m}m"


def parse_time_range(time_str: str) -> tuple[str, str]:
    """Converte '1200-1300' → ('12:00', '13:00'). Retorna ('','') se inválido."""
    m = re.match(r"(\d{4})-(\d{4})", time_str.strip())
    if not m:
        return ("", "")
    start_raw, end_raw = m.group(1), m.group(2)
    def fmt(t: str) -> str:
        return f"{t[:2]}:{t[2:]}"
    return fmt(start_raw), fmt(end_raw)


def parse_days(days_str: str) -> list[int]:
    """
    Converte string de dias EiBi para lista [0..6] (0=segunda, 6=domingo).
    EiBi usa: 1=segunda, 2=terça, ..., 7=domingo (ISO).
    Vazio = todos os dias.
    """
    s = days_str.strip()
    if not s or s == "1234567":
        return list(range(7))
    result = []
    for ch in s:
        if ch.isdigit():
            d = int(ch)
            if 1 <= d <= 7:
                result.append(d - 1)  # 0=segunda
    return sorted(set(result)) if result else list(range(7))


def parse_freq(frq_str: str) -> float | None:
    """Converte string de frequência EiBi para float kHz. Ex: '5985' → 5985.0"""
    s = frq_str.strip().replace(",", "").replace(".", "")
    try:
        return float(s)
    except ValueError:
        return None


def make_id(estacao: str, freq_khz: float, hora_inicio: str, dias: list[int]) -> str:
    """Cria ID único para a transmissão."""
    raw = f"{estacao}|{freq_khz}|{hora_inicio}|{''.join(str(d) for d in dias)}"
    return hashlib.md5(raw.encode()).hexdigest()[:12]


def lookup_country(itu: str) -> str:
    return ITU_TO_COUNTRY.get(itu.upper(), itu)


def lookup_lang(code: str) -> str:
    code = code.strip()
    # Separadores comuns no EiBi
    if ',' in code:
        parts = [LANG_TO_NAME.get(p.strip(), p.strip()) for p in code.split(',')]
        return ' / '.join(parts)
    if '/' in code:
        parts = [LANG_TO_NAME.get(p.strip(), p.strip()) for p in code.split('/')]
        return ' / '.join(parts)
    return LANG_TO_NAME.get(code, code)


def normalize_station(stat: str) -> str:
    """Normaliza nome de estação removendo lixo."""
    s = stat.strip()
    # Remove asteriscos e caracteres de controle
    s = re.sub(r"[*\x00-\x1f]", "", s)
    return s or "Unknown"


# ---------------------------------------------------------------------------
# Parser principal
# ---------------------------------------------------------------------------

def parse_eibi_csv(content: str) -> list[dict]:
    """Parseia o conteúdo CSV EiBi e retorna lista de transmissões normalizadas."""
    transmissoes: list[dict] = []
    seen_ids: set[str] = set()
    skipped = 0

    reader = csv.reader(io.StringIO(content), delimiter=";")
    for row_num, row in enumerate(reader, 1):
        # Pula linhas de cabeçalho/comentário/vazias
        if not row or not row[0].strip():
            continue
        first = row[0].strip()
        # Pula cabeçalho ("kHz:75;..." ou "frq" ou comentários)
        if first.startswith("#") or first.lower() in ("frq", "khz") or ":" in first[:10]:
            continue
        # Garante colunas suficientes
        while len(row) < len(EIBI_FIELDS):
            row.append("")

        frq_str = row[0]
        time_str = row[1]
        days_str = row[2]
        itu = row[3].strip().upper()
        stat = row[4]
        lang = row[5].strip()
        target = row[6].strip()
        potencia_str = row[8].strip()

        freq_khz = parse_freq(frq_str)
        if freq_khz is None or freq_khz < 2300:
            # Ignora MW/LW — foco em SW (banda de 120m começa em ~2300 kHz)
            skipped += 1
            continue

        banda = freq_to_banda(freq_khz)
        # Filtra apenas bandas ITU de radiodifusão (sem utilitários/militares/etc.)
        if banda.startswith("~"):
            skipped += 1
            continue

        hora_inicio, hora_fim = parse_time_range(time_str)
        if not hora_inicio:
            skipped += 1
            continue

        dias = parse_days(days_str)
        estacao = normalize_station(stat)
        pais = lookup_country(itu)
        # Se não encontrou no dicionário, usa o código ITU em maiúsculas como label
        if pais == itu and len(itu) <= 4 and itu.isalpha():
            pais = itu  # mantém o código (melhor que vazio)
        idioma = lookup_lang(lang)
        # Ignora códigos que não são idiomas (ex: '-CW', '-TX')
        if not idioma or idioma.startswith('-') or lang.strip().startswith('-'):
            skipped += 1
            continue

        try:
            potencia_kw = float(potencia_str) if potencia_str else 0.0
        except ValueError:
            potencia_kw = 0.0

        tx_id = make_id(estacao, freq_khz, hora_inicio, dias)
        # Deduplica
        if tx_id in seen_ids:
            continue
        seen_ids.add(tx_id)

        tx = {
            "id": tx_id,
            "estacao": estacao,
            "pais_origem": pais,
            "pais_itu": itu,
            "freq_khz": freq_khz,
            "banda_metros": banda,
            "hora_inicio_utc": hora_inicio,
            "hora_fim_utc": hora_fim,
            "dias_semana": dias,
            "idioma": idioma,
            "idioma_code": lang,
            "area_alvo": target,
            "potencia_kw": potencia_kw,
        }
        transmissoes.append(tx)

    print(f"[parse_eibi] Parseadas: {len(transmissoes)}, Ignoradas: {skipped}", file=sys.stderr)
    return transmissoes



def merge_contiguous_transmissoes(transmissoes: list[dict]) -> list[dict]:
    groups = {}
    for tx in transmissoes:
        # Tuple days for hashability
        dias = tuple(sorted(tx["dias_semana"]))
        key = (tx["estacao"], tx["freq_khz"], dias)
        if key not in groups:
            groups[key] = []
        groups[key].append(tx)

    def t_to_min(t: str) -> int:
        try:
            h, m = map(int, t.split(':'))
            return h * 60 + m
        except:
            return 0

    merged = []
    for key, group in groups.items():
        group.sort(key=lambda x: x["hora_inicio_utc"])
        
        current = group[0].copy()
        current["idiomas"] = {current["idioma"]} if current["idioma"] else set()
        current["alvos"] = {current["area_alvo"]} if current["area_alvo"] else set()
        
        for next_tx in group[1:]:
            c_end = t_to_min(current["hora_fim_utc"])
            n_start = t_to_min(next_tx["hora_inicio_utc"])
            
            # Allow overlap or exact contiguous
            if n_start <= c_end:
                c_end_val = t_to_min(current["hora_fim_utc"])
                n_end_val = t_to_min(next_tx["hora_fim_utc"])
                if n_end_val > c_end_val:
                    current["hora_fim_utc"] = next_tx["hora_fim_utc"]
                if next_tx["idioma"]: current["idiomas"].add(next_tx["idioma"])
                if next_tx["area_alvo"]: current["alvos"].add(next_tx["area_alvo"])
            else:
                current["idioma"] = " / ".join(sorted(current["idiomas"]))
                current["area_alvo"] = " / ".join(sorted(current["alvos"]))
                del current["idiomas"]
                del current["alvos"]
                merged.append(current)
                
                current = next_tx.copy()
                current["idiomas"] = {current["idioma"]} if current["idioma"] else set()
                current["alvos"] = {current["area_alvo"]} if current["area_alvo"] else set()
                
        current["idioma"] = " / ".join(sorted(current["idiomas"]))
        current["area_alvo"] = " / ".join(sorted(current["alvos"]))
        del current["idiomas"]
        del current["alvos"]
        merged.append(current)

    return merged


def build_payload(transmissoes: list[dict], season_label: str) -> dict:
    """Monta o envelope JSON final."""
    bandas = sorted({tx["banda_metros"] for tx in transmissoes})
    idiomas = sorted({tx["idioma"] for tx in transmissoes if tx["idioma"]})
    paises = sorted({tx["pais_origem"] for tx in transmissoes if tx["pais_origem"]})
    estacoes = sorted({tx["estacao"] for tx in transmissoes if tx["estacao"]})

    counts_by_banda: dict[str, int] = {}
    for tx in transmissoes:
        b = tx["banda_metros"]
        counts_by_banda[b] = counts_by_banda.get(b, 0) + 1

    counts_by_pais: dict[str, int] = {}
    for tx in transmissoes:
        p = tx["pais_origem"]
        counts_by_pais[p] = counts_by_pais.get(p, 0) + 1

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "temporada": season_label,
        "total": len(transmissoes),
        "bandas": bandas,
        "idiomas": idiomas,
        "paises_origem": paises,
        "estacoes": estacoes,
        "counts_by_banda": counts_by_banda,
        "counts_by_pais": counts_by_pais,
        "transmissoes": transmissoes,
    }


# ---------------------------------------------------------------------------
# Download
# ---------------------------------------------------------------------------

def download_eibi(url: str, timeout: int = 30) -> str:
    """Baixa o CSV EiBi e retorna o conteúdo como string."""
    import ssl
    print(f"[parse_eibi] Baixando: {url}", file=sys.stderr)
    # EiBi tem certificado com hostname mismatch — bypass necessário
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "OndasCurtas/1.0 (shortwave-calendar; educational)"},
    )
    with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
        raw = resp.read()
    # EiBi usa latin-1
    for enc in ("utf-8", "latin-1", "cp1252"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("latin-1", errors="replace")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    ap = argparse.ArgumentParser(description="Parser EiBi → transmissoes.json")
    ap.add_argument("--local", metavar="FILE", help="Usar CSV local em vez de baixar")
    ap.add_argument(
        "--out",
        default="site/data/transmissoes.json",
        help="Arquivo JSON de saída (default: site/data/transmissoes.json)",
    )
    ap.add_argument("--dry-run", action="store_true", help="Parseia mas não grava o JSON")
    ap.add_argument("--url", help="URL personalizada do CSV EiBi (sobrescreve detecção automática)")
    return ap.parse_args()


def main() -> None:
    args = parse_args()

    # Determina temporada
    season_letter, season_yy = current_season()
    season_label = f"{season_letter.upper()}{season_yy}"
    url = args.url or build_eibi_url()

    # Obtém conteúdo CSV
    if args.local:
        local_path = Path(args.local)
        if not local_path.exists():
            print(f"[parse_eibi] ERRO: arquivo local não encontrado: {local_path}", file=sys.stderr)
            sys.exit(1)
        content = local_path.read_text(encoding="latin-1", errors="replace")
        print(f"[parse_eibi] Usando arquivo local: {local_path}", file=sys.stderr)
    else:
        try:
            content = download_eibi(url)
        except Exception as exc:
            print(f"[parse_eibi] ERRO ao baixar {url}: {exc}", file=sys.stderr)
            sys.exit(1)

    transmissoes = parse_eibi_csv(content)
    transmissoes = merge_contiguous_transmissoes(transmissoes)
    if not transmissoes:
        print("[parse_eibi] AVISO: nenhuma transmissão parseada.", file=sys.stderr)

    payload = build_payload(transmissoes, season_label)

    if args.dry_run:
        print(f"[parse_eibi] dry-run: {payload['total']} transmissões, {len(payload['bandas'])} bandas")
        print(f"  Bandas: {', '.join(payload['bandas'])}")
        print(f"  Idiomas: {len(payload['idiomas'])}")
        print(f"  Países: {len(payload['paises_origem'])}")
        return

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"[parse_eibi] JSON gravado: {out_path}")
    print(f"[parse_eibi] Transmissões: {payload['total']}")
    print(f"[parse_eibi] Temporada: {season_label}")
    print(f"[parse_eibi] Bandas: {', '.join(payload['bandas'])}")


if __name__ == "__main__":
    main()
