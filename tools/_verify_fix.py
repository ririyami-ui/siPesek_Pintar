import json
with open('resources/js/utils/bskap_2025_intel.json', encoding='utf-8') as f:
    data = json.load(f)
for g in ['7','8','9']:
    info = data['subjects']['SMP'][g]['Informatika']
    print(f'SMP {g} ganjil elemen: {info["ganjil"]["elemen"]}')
    print(f'SMP {g} genap  elemen: {info["genap"]["elemen"]}')
    print(f'SMP {g} ganjil materi_inti[0] elemen: {info["ganjil"]["materi_inti"][0]["elemen"]}')
    print(f'SMP {g} genap  materi_inti[0] elemen: {info["genap"]["materi_inti"][0]["elemen"]}')
    print()
