import json
d=json.load(open('resources/js/utils/bskap_2025_intel.json','r',encoding='utf-8'))
for g in ['7','8','9']:
    info=d['subjects']['SMP'][g]['Informatika']
    print(f'SMP {g}:')
    for sem in ['ganjil','genap']:
        s=info[sem]
        print(f'  {sem} elemen:', s['elemen'])
        for mi in s['materi_inti']:
            print(f'    {mi["materi"][:40]:40s} -> {mi["elemen"]}')
