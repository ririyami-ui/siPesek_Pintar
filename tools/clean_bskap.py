"""clean_bskap.py – create cleaned version of bskap_extracted.txt

Replace newline characters that split sentences mid‑word. We join a newline when the next character is a lowercase Latin letter (a‑z). This yields readable paragraphs while preserving line breaks that start new headings (uppercase or numbers).
"""
import re
import pathlib

SRC = pathlib.Path("bskap_extracted.txt")
DST = pathlib.Path("bskap_clean.txt")

if not SRC.exists():
    raise FileNotFoundError(f"Source {SRC} not found")

text = SRC.read_text(encoding="utf-8")
# Join newline when next char is a lowercase latin letter
cleaned = re.sub(r"\r?\n(?=[a-z])", " ", text)
DST.write_text(cleaned, encoding="utf-8")
print(f"Cleaned file written to {DST}")
