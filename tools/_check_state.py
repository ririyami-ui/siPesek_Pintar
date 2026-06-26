import json
with open('resources/js/utils/bskap_2025_intel.json', 'r', encoding='utf-8') as f:
    d = json.load(f)
for g in ['7','8','9']:
    info = d['subjects']['SMP'][g].get('Informatika')
    if info:
        print(f'SMP {g} ganjil elemen: {info["ganjil"]["elemen"]}')
        print(f'SMP {g} genap elemen: {info["genap"]["elemen"]}')
