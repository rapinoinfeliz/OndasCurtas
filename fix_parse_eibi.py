import re

with open('scripts/parse_eibi.py', 'r') as f:
    content = f.read()

merge_func = """
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
"""

# Insert merge function before build_payload
content = content.replace("def build_payload(", merge_func + "\n\ndef build_payload(")

# Call merge in main()
content = content.replace("transmissoes = parse_eibi_csv(content)", "transmissoes = parse_eibi_csv(content)\n    transmissoes = merge_contiguous_transmissoes(transmissoes)")

with open('scripts/parse_eibi.py', 'w') as f:
    f.write(content)
