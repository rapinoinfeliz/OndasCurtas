import json

with open('site/data/transmissoes.json', 'r') as f:
    data = json.load(f)

txs = [tx for tx in data['transmissoes'] if tx['freq_khz'] == 11780]
for tx in txs:
    print(f"ID: {tx['id']} | Est: {tx['estacao']} | Hora: {tx['hora_inicio_utc']}-{tx['hora_fim_utc']} | Dias: {tx['dias_semana']} | Idioma: {tx['idioma']} | Alvo: {tx['area_alvo']}")

