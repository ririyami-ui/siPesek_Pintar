import json
import os

with open('resources/js/utils/bskap_2025_intel.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

smp7 = data['subjects']['SMP']['7']
semester_keys = []
chapters_keys = []
for k, v in smp7.items():
    if isinstance(v, dict) and 'ganjil' in v:
        semester_keys.append(k)
    elif isinstance(v, dict) and 'title' in v:
        chapters_keys.append(k)

print("Subjects with semester data:")
for s in sorted(semester_keys):
    gan = len(smp7[s]['ganjil']['materi_inti'])
    gen = len(smp7[s]['genap']['materi_inti'])
    print(f"  {s}: G={gan} E={gen}")

print()
print("Subjects with chapters list:")
for s in sorted(chapters_keys):
    title = smp7[s].get("title", "no title")
    nch = len(smp7[s].get("chapters", []))
    print(f"  {s}: {title} ({nch} chapters)")
