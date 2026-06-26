import json

with open('resources/js/utils/bskap_2025_intel.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

for tingkat in ['7','8','9']:
    info = data['subjects']['SMP'][tingkat].get('Informatika')
    if info:
        print(f'=== INFORMATIKA SMP {tingkat} ===')
        print('Ganjil elemen:', info['ganjil']['elemen'])
        print('Ganjil materi:')
        for m in info['ganjil']['materi_inti']:
            print(f'  - {m["materi"]} ({m["elemen"]})')
        print()
        print('Genap elemen:', info['genap']['elemen'])
        print('Genap materi:')
        for m in info['genap']['materi_inti']:
            print(f'  - {m["materi"]} ({m["elemen"]})')
        print()
