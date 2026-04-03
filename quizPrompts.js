export const getAdvancedQuizPrompt = ({ topic, context, gradeLevel, subject, batchNum, batches, allQuestions, batchInstructions, optionCount, optionLabel, difficulty }) => `
        LANDASAN REGULASI: **BSKAP No. 46 Tahun 2025** (Standar Nasional Kurikulum Merdeka).
        STANDAR PEDAGOGIS: **Buku Teks Utama Kemendikbudristek** (Mindful, Meaningful, Joyful).
        
        TUGAS: Buatlah ${batchInstructions.split('\n').length} butir soal untuk:
        - Mapel: ${subject} | Kelas: ${gradeLevel} | Topik: ${topic}
        - Konteks: "${context || 'INPUT MANUAL/MINIM'}" 
        ${!context ? '(WAJIB: Gunakan Database Internal Kurikulum Merdeka & BSKAP 46/2025 Anda untuk menentukan CP/Kompetensi yang relevan secara mandiri)' : '(WAJIB JADI SUMBER UTAMA)'}
        - HOTS Meter: ${difficulty}% (Proporsi tingkat kesulitan. ${difficulty}% dari total soal WAJIB berlevel kognitif HOTS yakni L4, L5, atau L6. Sisanya adalah LOTS/MOTS yakni L1, L2, atau L3.)
        - Status: Batch ${batchNum} dari ${batches.length}
        ${allQuestions.length > 0 ? `- TOPIK YANG SUDAH DICAKUP: [${allQuestions.map(q => q.pedagogical_materi).join(', ')}] (HINDARI pengulangan materi yang sama jika konteks masih luas)` : ''}

        TUGAS UTAMA: 
        1. Analisis SELURUH materi dalam "Konteks".
        2. Buatlah soal yang **BERIMBANG** dan mencakup berbagai sub-inti materi agar tidak menumpuk di satu bagian saja.
        ${batchInstructions}

        STRICT RULES:
        1. Gunakan Bahasa Indonesia akademis formal (PUEBI).
        2. **REFERENSI MATERI (STRICT)**: Gunakan isi dari "Konteks" atau "RINGKASAN MATERI" sebagai sumber utama soal. Abaikan instruksi teknis guru jika ada; fokuslah pada konsep, fakta, dan data materi.
        3. Soal harus berbasis data/stimulus (Tabel, Narasi Ilmiah, atau Studi Kasus). Dilarang soal hafalan definisi literal.
        4. **VARIASI POSISI JAWABAN (MANDATORY)**: Pastikan posisi jawaban benar (untuk PG/Complex) selalu berpindah-pindah. Khusus soal "matching" (menjodohkan), urutan pada array "right_side" WAJIB diacak agar tidak lurus sejajar dengan "left_side" (Contoh pasangan variatif, bukan A-1, B-2).
        5. **PRINSIP DEEP LEARNING (WAJIB)**:
           - **Kontekstual**: Hubungkan soal dengan kehidupan sehari-hari siswa agar bermakna.
           - **Reflektif**: Ajak siswa melihat kembali apa yang dipelajari dan proses belajarnya.
           - **Eksploratif**: Berikan ruang untuk berbagai kemungkinan jawaban atau solusi kreatif.
        6. Pilihan jawaban (untuk PG) wajib ${optionCount} opsi (${optionLabel}).
            - **indicator**: Indikator soal (Format: Disajikan [konteks/stimulus], siswa dapat [KKO] [materi]). Harus SINGKAT dan PADAT.
        7. **IMAGE HINT (OPTIONAL)**: Jika soal sangat membutuhkan dukungan visual (seperti diagram, grafik, peta, atau anatomi), sertakan field **"image_hint"** berisi instruksi spesifik untuk guru (Contoh: "[Sertakan gambar struktur sel hewan di sini]"). Jika tidak butuh gambar, kosongkan ("").
        8. **KEPATUHAN TIPE SOAL (CRITICAL)**: Field "type" pada JSON output **HARUS SAMA PERSIS** dengan instruksi tipe pada "TUGAS UTAMA". Dilarang keras menciptakan, menambah, atau membuang tipe soal yang ditentukan.
        9. **TIDAK ADA SUBSTITUSI TIPE (MANDATORY)**: Anda WAJIB menggunakan tepat kerangka/struktur JSON milik tipe soal yang bersangkutan sesuai panduan. JANGAN PERNAH mengubah tipe soal A menjadi tipe B dengan argumen kemiripan wujud/logika materi (Misal: merubah \`pg_matrix\` ke format \`true_false\`, \`essay\` ke \`short_answer\`, dsb). Konsekuensi struktural akan fatal jika ini dilanggar!
        
        STRUKTUR JSON PER TIPE (INPUT HARUS SESUAI):
        - **Wajib Ada di Setiap Soal**: 
          "pedagogical_materi": "Materi spesifik soal ini (max 5 kata)",
          "competency": "Intisari CP relevan (Singkat)", 
          "indicator": "Indikator operasional (Singkat)", 
          "cognitive_level": "L1/L2/L3/L4/L5/L6",
          "stimulus": "Teks stimulus/kasus untuk soal ini (jika ada)",
          "image_hint": "Instruksi gambar (Opsional, gunakan [] jika ada)"
        - **pg**: {"type": "pg", "pedagogical_materi": "...", "competency": "...", "indicator": "...", "cognitive_level": "...", "stimulus": "...", "question": "...", "options": ["A...", "B..."], "answer": "A...", "explanation": "..."}
        - **pg_complex**: {"type": "pg_complex", "pedagogical_materi": "...", "competency": "...", "indicator": "...", "cognitive_level": "...", "stimulus": "...", "question": "...", "options": ["1...", "2..."], "answer": ["1...", "3..."], "explanation": "..."}
         - **pg_matrix**: {"type": "pg_matrix", "pedagogical_materi": "...", "competency": "...", "indicator": "...", "cognitive_level": "...", "stimulus": "...", "question": "...", "rows": ["Pernyataan 1", "Pernyataan 2"], "columns": ["Kategori A", "Kategori B"], "answer": [{"row": "Pernyataan 1", "column": "Kategori A"}], "explanation": "..."}
         - **matching**: {"type": "matching", "pedagogical_materi": "...", "competency": "...", "indicator": "...", "cognitive_level": "...", "stimulus": "...", "question": "...", "left_side": ["Pernyataan A", "Pernyataan B"], "right_side": ["Jawaban 2", "Jawaban 1", "Jawaban 3"], "pairs": [{"left": "Pernyataan A", "right": "Jawaban 1"}], "explanation": "..."}
         - **true_false**: {"type": "true_false", "pedagogical_materi": "...", "competency": "...", "indicator": "...", "cognitive_level": "...", "stimulus": "...", "question": "...", "statements": [{"text": "S1", "isCorrect": true}], "explanation": "..."}
         - **short_answer**: {"type": "short_answer", "pedagogical_materi": "...", "competency": "...", "indicator": "...", "cognitive_level": "...", "stimulus": "...", "question": "...", "answer": "Kunci jawaban (Singkat 1-3 kata)", "explanation": "..."}
         - **sequencing**: {"type": "sequencing", "pedagogical_materi": "...", "competency": "...", "indicator": "...", "cognitive_level": "...", "stimulus": "...", "question": "...", "items": ["Langkah A", "Langkah B", "Langkah C"], "correct_order": ["Langkah B", "Langkah A", "Langkah C"], "explanation": "..."}
         - **essay/uraian**: {"type": "essay", "pedagogical_materi": "...", "competency": "...", "indicator": "...", "cognitive_level": "...", "stimulus": "...", "question": "...", "answer": "Kunci jawaban (WAJIB SINGKAT & PADAT)", "grading_guide": "Pedoman penskoran ringkas", "explanation": "Penjelasan singkat"}

        FORMAT OUTPUT TOTAL (JSON):
        {
          "title": "${topic}",
          "questions": [
             // Masukkan ${batchInstructions.split('\n').length} soal di sini sesuai tipe di atas
          ]
        }
      `;

export const getQuizFromImagePrompt = ({ count, gradeLevel, subject, topic, BSKAP_DATA }) => `
      Anda adalah "Ahli Visual Pendidikan" yang bekerja berdasarkan repositori **BSKAP_DATA**.
      
      **OFFICIAL KNOWLEDGE ENGINE (BSKAP_DATA):**
      - Regulasi Dasar: **${BSKAP_DATA.standards.regulation}**
      - Filosofi Operasional: **${BSKAP_DATA.standards.philosophy.name}**
      
      **TUGAS:**
      Analisis gambar/dokumen yang diberikan dan buatlah ${count} soal pilihan ganda yang **WAJIB** merujuk pada standar CP resmi dan kosakata resmi **Kemendikdasmen** untuk:
      - Jenjang/Kelas: ${gradeLevel}
      - Mata Pelajaran: ${subject}
      - Fokus Materi: ${topic}
      
      **INSTRUKSI PENTING (STRICT):**
      1. **SOURCE OF TRUTH**: Seluruh isi soal, stimulus, dan penjelasan harus selaras dengan buku teks resmi.
      2. **TERMINOLOGI**: Gunakan "Peserta Didik".
      3. **PRINSIP DEEP LEARNING**: Pastikan soal bermakna (Meaningful) dan tidak sekadar hafalan visual murni.
      
      INSTRUKSI TEKNIS:
      1.  Jika gambar adalah **Diagram/Anatomi**: Buat soal yang menunjuk bagian tertentu (misal: "Fungsi bagian yang ditunjuk huruf X adalah...").
      2.  Jika gambar adalah **Teks/Infografis**: Buat soal literasi informasi.
      3.  Jika gambar adalah **Pemandangan/Situasi**: Buat soal analisis situasi atau cerita.
      
      FORMAT OUTPUT (JSON ONLY):
      {
        "questions": [
           {
             "id": 1,
             "type": "pg",
             "pedagogical_materi": "Sub-materi spesifik dari gambar (max 5 kata)",
             "competency": "Kompetensi relevan (Singkat)",
             "indicator": "Indikator (Format: Disajikan gambar..., siswa dapat...)",
             "stimulus": "Penjelasan singkat tentang bagian gambar yang dirujuk",
             "question": "Berdasarkan gambar di atas, ...?",
             "options": ["A...", "B...", "C...", "D...", "E..."],
             "answer": "A...",
             "explanation": "..."
           }
        ]
      }
    `;
