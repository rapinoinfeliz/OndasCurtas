import json

def merge_txs(txs):
    # Group by estacao, freq, dias, target (ignore lang and time for grouping)
    # Actually, let's group by estacao, freq, tuple(dias)
    groups = {}
    for tx in txs:
        key = (tx['estacao'], tx['freq_khz'], tuple(tx['dias_semana']))
        if key not in groups:
            groups[key] = []
        groups[key].append(tx)
    
    merged = []
    for key, group in groups.items():
        # Sort by start time
        group.sort(key=lambda x: x['hora_inicio_utc'])
        
        # Merge contiguous blocks
        current = group[0].copy()
        current['idiomas'] = {current['idioma']}
        current['alvos'] = {current['area_alvo']}
        
        for next_tx in group[1:]:
            # Check if contiguous or overlapping
            def t_to_min(t): 
                h, m = map(int, t.split(':'))
                return h*60+m
            c_end = t_to_min(current['hora_fim_utc'])
            n_start = t_to_min(next_tx['hora_inicio_utc'])
            n_end = t_to_min(next_tx['hora_fim_utc'])
            
            # Allow up to 10 min gap to consider "contiguous" for the same station?
            # Or strict exact match? Let's say exact match or overlap
            if n_start <= c_end: # overlap or exactly contiguous
                current['hora_fim_utc'] = max(current['hora_fim_utc'], next_tx['hora_fim_utc'], key=t_to_min)
                current['idiomas'].add(next_tx['idioma'])
                current['alvos'].add(next_tx['area_alvo'])
            else:
                current['idioma'] = " / ".join(sorted(current['idiomas']))
                current['area_alvo'] = " / ".join(sorted(current['alvos']))
                merged.append(current)
                current = next_tx.copy()
                current['idiomas'] = {current['idioma']}
                current['alvos'] = {current['area_alvo']}
                
        current['idioma'] = " / ".join(sorted(current['idiomas']))
        current['area_alvo'] = " / ".join(sorted(current['alvos']))
        merged.append(current)
        
    return merged

with open('site/data/transmissoes.json', 'r') as f:
    data = json.load(f)

txs = [tx for tx in data['transmissoes'] if tx['freq_khz'] == 11780]
for tx in merge_txs(txs):
    print(f"Est: {tx['estacao']} | Hora: {tx['hora_inicio_utc']}-{tx['hora_fim_utc']} | Idioma: {tx['idioma']}")

