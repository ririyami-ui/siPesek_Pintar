import { GoogleGenerativeAI } from "@google/generative-ai";
import BSKAP_DATA from './bskap_2025_intel.json';
import VERBATIM_BSKAP_DATA from './bskap_2025_intel.json';
import api from '../lib/axios';
// HMR Trigger Comment

// --- SI PINTAR BRAIN (Knowledge Base) ---
// --- SI PINTAR BRAIN (Knowledge Base) ---
const SIPINTAR_BRAIN = `
Anda adalah **Si Pintar**, asisten AI profesional tapi **super santai & akrab** buat aplikasi **Si Pesek Pintar** (Sistem Pengelolaan Sekolah Pintar).
Anggap diri Anda sebagai rekan guru yang asik diajak ngobrol, solutif, dan nggak kaku.
Pencipta Anda: **Bapak Ririyami, S.Kom** (Guru SMPN 7 Bondowoso & Ahli AI). Kalau ditanya siapa yang bikin, jawab dengan bangga ya!

### 1. Gaya Bicara (TONE & STYLE) - WAJIB!
- **Santai & Akrab**: Jangan pakai bahasa robot kayak "Saya adalah AI" atau "Tentu saja". Ganti sama "Oke Pak/Bu!", "Siap!", "Beres!", "Gini loh...", "Waduh", "Mantap".
- **To The Point**: Jangan bertele-tele. Langsung ke inti masalah. Guru itu sibuk, butuh jawaban cepat.
- **Sapaan**: Panggil user dengan "Bapak/Ibu" atau "Pak/Bu".
- **Emoji**: Pakai emoji secukupnya biar luwes (😊, 👍, ✅, 🚀).

### 2. Batasan (Guardrails)
- **Fokus Pendidikan**: Kalau ditanya soal politik, SARA, atau curhat di luar konteks sekolah, tolak dengan halus & bercanda. Contoh: "Waduh, kalau itu di luar keahlian saya nih Pak/Bu. Kita balik bahas RPP atau nilai siswa aja yuk? 😄"
- **Privasi**: Jangan pernah bocorin data siswa ke pihak luar.

### 3. Pengetahuan Aplikasi (Fitur Jagoan)
- **Analisis Siswa**: Deteksi siswa yang nilainya < 65, sering bolos, atau banyak poin pelanggaran.
- **Kesepakatan Kelas**: Bobot nilai (Pengetahuan vs Keterampilan) & Sikap bisa diatur fleksibel lewat fitur ini. Outputnya PDF.
- **Profil Lulusan (BSKAP 2025)**: Ada 8 dimensi (Keimanan, Kewargaan, Nalar Kritis, Kreativitas, Kolaborasi, Mandiri, Kesehatan, Komunikasi). Visualisasinya pakai Radar Chart.
- **Rapor**: Hitung Nilai Akhir otomatis. Bisa bedain nilai Harian, Sumatif, Proyek, dll.

### 4. Cara Jawab Masalah ("Siswa X nilainya anjlok")
1. **Cek Dulu**: "Coba kita lihat, dia lemah di semua mapel atau cuma satu?"
2. **Analisis Santai**: "Mungkin gaya belajarnya beda kali ya? Atau lagi ada masalah di rumah?"
3. **Solusi Praktis**: "Coba kasih remedial khusus atau peer teaching deh."
4. **Tawaran**: "Mau saya buatin soal remedialnya sekarang?"

Intinya: **Jadilah teman diskusi yang cerdas, praktis, dan menyenangkan!**
`;
// --- END SI PINTAR BRAIN ---

// Helper to shuffle array (Fisher-Yates)
const shuffleArray = (array) => {
  if (!array || !Array.isArray(array)) return array;
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};



/**
 * Gets the current Gemini API Key from localStorage or environment variables.
 * @returns {string} The API Key.
 */
const getApiKey = () => {
  const cachedKey = localStorage.getItem('GEMINI_API_KEY');
  return cachedKey || import.meta.env.VITE_GEMINI_API_KEY;
};

/**
 * Initializes or re-initializes the Generative AI model with the latest API key.
 * @returns {Object} The initialized model.
 */
const getModel = (modelName, isJson = false) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("API_KEY_MISSING");
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  
  // Model priority:
  // 1. Parameter modelName (passed from specific call)
  // 2. localStorage GEMINI_MODEL (synced from User Profile in SettingsContext)
  // 3. Fallback default
  const profileModel = localStorage.getItem('GEMINI_MODEL');
  const selectedModel = modelName || profileModel || "gemini-3.1-flash-lite-preview";

  const generationConfig = {
    maxOutputTokens: 8192,
    temperature: 0.7,
  };

  if (isJson) {
    generationConfig.responseMimeType = "application/json";
  }

  return genAI.getGenerativeModel({
    model: selectedModel,
    systemInstruction: SIPINTAR_BRAIN,
    generationConfig
  });
};

/**
 * Helper to handle generation with automatic fallback for experimental models.
 */
const generateContentWithFallback = async (modelName, generateFn) => {
  try {
    const model = getModel(modelName);
    return await retryWithBackoff(() => generateFn(model));
  } catch (error) {
    const errorMsg = error.message || "";
    // If request failed and we were using the unstable preview model
    if ((errorMsg.includes("503") || errorMsg.includes("429") || errorMsg.toLowerCase().includes("overloaded")) &&
      modelName === "gemini-3-pro-preview") {

      console.warn("Gemini 3.0 Pro Preview overloaded. Falling back to Gemini 3.1 Flash Lite.");
      const fallbackModelName = "gemini-3.1-flash-lite-preview";
      const fallbackModel = getModel(fallbackModelName);

      // Retry once with the fallback model
      return await retryWithBackoff(() => generateFn(fallbackModel), 1);
    }
    throw error;
  }
};


// --- Caching variables for analyzeTeachingJournals ---
let lastAnalyzedJournalsString = null;
let lastAnalysisResultCache = null;
// --- End Caching variables ---

// --- Caching variables for generateClassAnalysisReport ---
let lastAnalyzedClassDataString = null;
let lastClassAnalysisReportCache = null;
// --- End Caching variables ---

// --- Caching variables for generateConciseClassAnalysisReport ---
let lastAnalyzedConciseClassDataString = null;
let lastConciseClassAnalysisReportCache = null;
// --- End Caching variables ---

// --- Caching variables for generateStudentNarrative ---
let lastNarrativeInputString = null;
let lastNarrativeResultCache = null;
// --- End Caching variables ---

/**
 * A helper function to retry a function with exponential backoff.
 * @param {Function} fn The function to retry.
 * @param {number} retries The number of retries.
 * @param {number} delay The initial delay in milliseconds.
 * @returns {Promise<any>} The result of the function.
 */
const retryWithBackoff = async (fn, retries = 3, delay = 1000) => {
  try {
    return await fn();
  } catch (error) {
    const errorMsg = error.message || "";
    const isQuotaError = errorMsg.includes("429") || errorMsg.toLowerCase().includes("quota");
    const isRetriable = errorMsg.includes("503") || isQuotaError;

    if (retries > 0 && isRetriable) {
      // Try to parse wait time from error message if it's a quota error
      let waitTime = delay;
      if (isQuotaError) {
        const retryMatch = errorMsg.match(/retry in ([\d\.]+)s/);
        if (retryMatch && retryMatch[1]) {
          waitTime = (parseFloat(retryMatch[1]) + 1) * 1000; // Add 1s buffer
        } else {
          waitTime = delay * 5; // Much longer wait for quota
        }
      }

      console.log(`Retrying after ${waitTime}ms due to: ${errorMsg} `);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return retryWithBackoff(fn, retries - 1, isQuotaError ? waitTime : delay * 2);
    } else {
      throw error;
    }
  }
};

/**
 * Common error handler for Gemini API calls.
 */
const handleGeminiError = (error, context) => {
  console.error(`Error in ${context}: `, error);
  const errorMsg = error.message || "";

  if (errorMsg.includes("429") || errorMsg.toLowerCase().includes("quota")) {
    return "Server AI sibuk atau Kuota Harian habis. Mohon tunggu 1 menit, atau GANTI API KEY di pengaturan jika masalah berlanjut.";
  }
  if (errorMsg.includes("503")) {
    return "Server AI sedang sibuk (overloaded). Silakan coba lagi dalam beberapa detik.";
  }
  if (errorMsg.includes("API_KEY_INVALID") || errorMsg.includes("invalid api key")) {
    return "API Key Gemini tidak valid. Silakan periksa kembali di menu Master Data.";
  }
  if (errorMsg === "API_KEY_MISSING") {
    return "API Key Gemini belum diatur. Silakan atur di menu Master Data.";
  }
  return "Maaf, terjadi kendala saat menghubungkan ke AI. Silakan coba beberapa saat lagi.";
};

/**
 * Extracts and parses a JSON object or array from a string, handling optional markdown or surrounding text.
 */
const extractJSON = (text) => {
  if (!text) throw new Error("Output AI kosong.");

  let cleanText = text.trim();

  // 1. Remove markdown code blocks if present
  cleanText = cleanText.replace(/^```(json)?\s*/i, '').replace(/```\s*$/, '').trim();

  // 2. Pre-sanitize for common AI output issues
  // Remove possible preamble or postamble text
  const firstOpenBrace = cleanText.indexOf('{');
  const firstOpenBracket = cleanText.indexOf('[');

  let startIdx = -1;
  let endIdx = -1;

  // Determine if it looks like an Object or Array based on which comes first
  if (firstOpenBrace !== -1 && (firstOpenBracket === -1 || firstOpenBrace < firstOpenBracket)) {
    startIdx = firstOpenBrace;
    endIdx = cleanText.lastIndexOf('}');
  } else if (firstOpenBracket !== -1 && (firstOpenBrace === -1 || firstOpenBracket < firstOpenBrace)) {
    startIdx = firstOpenBracket;
    endIdx = cleanText.lastIndexOf(']');
  }

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    cleanText = cleanText.substring(startIdx, endIdx + 1);
  }

  // Handle common unescaped characters in JSON strings that break parsing
  // This is a common issue when AI puts quotes inside a JSON string without escaping
  // We'll try a basic fix for unescaped newlines inside strings if any
  // cleanText = cleanText.replace(/(?<=: \".*)\n(?=.*\"(,|\}|\]))/g, "\\n");

  try {
    return JSON.parse(cleanText);
  } catch (e) {
    console.warn("Initial JSON parse failed, attempting recovery...", e.message);

    // Recovery: Try to fix common trailing commas
    let recovered = cleanText.replace(/,\s*([}\]])/g, '$1');

    try {
      return JSON.parse(recovered);
    } catch (e2) {
      // Aggressive recovery: find the last valid object/array end
      const openCurly = (cleanText.match(/\{/g) || []).length;
      const closeCurly = (cleanText.match(/\}/g) || []).length;
      const openBracket = (cleanText.match(/\[/g) || []).length;
      const closeBracket = (cleanText.match(/\]/g) || []).length;

      if (openCurly > closeCurly) cleanText += '}'.repeat(openCurly - closeCurly);
      if (openBracket > closeBracket) cleanText += ']'.repeat(openBracket - closeBracket);

      try {
        return JSON.parse(cleanText);
      } catch (e3) {
        throw new Error("Format output AI tidak valid dan tidak dapat diperbaiki otomatis.");
      }
    }
  }
};
/**
 * Helper to determine level (SD, SMP, SMA) from gradeLevel string/number.
 */
const getLevel = (grade) => {
  const g = parseInt(grade);
  if (isNaN(g)) {
    // If it's a phase or string like "X", try to map
    const s = String(grade).toUpperCase();
    if (['1', '2', '3', '4', '5', '6'].includes(s)) return 'SD';
    if (['7', '8', '9', 'VII', 'VIII', 'IX'].includes(s)) return 'SMP';
    if (['10', '11', '12', 'X', 'XI', 'XII'].includes(s)) return 'SMA';
    return 'SMA'; // Default fallback
  }
  if (g >= 1 && g <= 6) return 'SD';
  if (g >= 7 && g <= 9) return 'SMP';
  if (g >= 10 && g <= 12) return 'SMA';
  return 'SMA';
};

/**
 * Normalizes semester input to 'ganjil' or 'genap' key used in BSKAP_DATA.
 */
const getSemesterKey = (semester) => {
  if (!semester) return 'ganjil';
  const s = String(semester).toLowerCase().trim();
  // Handle numeric, roman, and Indonesian/English labels
  if (s === '1' || s === 'i' || s === 'ganjil' || s === 'odd' || s.includes('semester 1')) return 'ganjil';
  if (s === '2' || s === 'ii' || s === 'genap' || s === 'even' || s.includes('semester 2')) return 'genap';
  return 'ganjil'; // Default fallback
};

/**
 * Detects regional language from subject name (e.g., "Bahasa Daerah (Jawa)" -> "Jawa").
 * @param {string} subject - The subject name.
 * @returns {string|null} The regional language name or null.
 */
function getRegionalLanguage(subject) {
  if (!subject) return null;
  const match = subject.match(/bahasa daerah\s*\(([^)]+)\)/i);
  return match ? match[1] : null;
}

/**
 * Normalizes subject name to key used in BSKAP_DATA.
 * Handles "Bahasa Daerah (Region)" -> "Bahasa Daerah" mapping.
 */
const getSubjectKey = (subject) => {
  if (!subject) return "";
  if (subject.startsWith("Bahasa Daerah")) return "Bahasa Daerah";
  return subject;
};

/**
 * Gets a human-readable label for the semester.
 */
const getSemesterLabel = (semester) => {
  return getSemesterKey(semester) === 'ganjil' ? 'Ganjil' : 'Genap';
};

/**
 * Creates a system instruction prompt for the AI.
 * @param {Object} userProfile - The user's profile data.
 * @param {Object} liveContext - Optional real-time class data stats.
 * @returns {Object} The system instruction object for the model.
 */
const createSystemInstruction = (userProfile, liveContext = null) => {
  let userName = "Guru"; // Default name
  let userTitle = "Bpk/Ibu"; // Default title
  let schoolName = userProfile?.school || "Sekolah";
  let schoolLevel = userProfile?.schoolLevel || "SD/SMP/SMA";

  if (userProfile) {
    userName = userProfile.name || (userProfile.email ? userProfile.email.split('@')[0] : "Guru");
    userTitle = userProfile.title || "Bpk/Ibu";

    // Fallback if title is just "Bapak/Ibu" (neutral)
    if (userTitle === "Bapak/Ibu") userTitle = "Bpk/Ibu";
  }

  // Format live context if available
  let contextSnippet = "";
  if (liveContext) {
    contextSnippet = `
    **6. DATA REAL-TIME KELAS ANDA (DATA-DRIVEN):**
    Saat ini, Anda memiliki akses ke ringkasan kondisi kelas asuhan ${userTitle} ${userName}:
    - Rata-rata Kehadiran: ${liveContext.avgAttendance}%
    - Rata-rata Nilai: ${liveContext.avgGrade}
    - Tantangan Terbaru di Jurnal: ${liveContext.recentChallenges?.length > 0 ? liveContext.recentChallenges.join(', ') : 'Belum ada catatan tantangan.'}
    - Update Terakhir: ${liveContext.lastUpdate}

    Gunakan data ini untuk memberikan saran yang LEBIH SPESIFIK. Jika kehadiran rendah, sarankan pendekatan ke orang tua. Jika nilai rendah, sarankan remedial atau perubahan metode.
    `;
  }

  const instruction = `
    Anda adalah **Si Pintar**, asisten AI yang cerdas, hangat, dan sangat suportif untuk para guru di aplikasi **Si Pesek Pintar** (Sistem Pengelolaan Sekolah Pintar).
    Anda diciptakan oleh **Bapak Ririyami, S.Kom** (Pakar Pendidikan & AI) untuk menjadi "Rekan Sejawat Digital" (Co-Teacher) terbaik bagi guru.

    **DATA PENGGUNA SAAT INI:**
    - Nama: ${userTitle} ${userName}
    - Sekolah: ${schoolName}
    - Jenjang: ${schoolLevel}

    **1. FILOSOFI UTAMA: DEEP LEARNING (KEPKA BSKAP 046/2025)**
    Jiwai 3 pilar utama ini dalam SETIAP saran pedagogis Anda (RPP, Masalah Siswa, Strategi Mengajar):
    *   **Mindful (Berkesadaran)**: Guru harus hadir utuh. Saran Anda harus membantu guru membangun koneksi emosional dan kesadaran diri siswa (bukan sekadar transfer materi).
    *   **Meaningful (Bermakna)**: Pembelajaran HARUS relevan dengan kehidupan nyata. Selalu kaitkan materi dengan isu kontekstual/lingkungan siswa.
    *   **Joyful (Menyenangkan)**: Belajar harus menumbuhkan rasa ingin tahu, bukan ketakutan. Sarankan *ice breaking* atau metode gamifikasi.

    **2. STRATEGI UTAMA: PEMBELAJARAN BERDIFERENSIASI**
    Setiap kelas itu unik. Jangan berikan solusi "Satu Ukuran untuk Semua". Selalu pertimbangkan:
    *   **Diferensiasi Konten**: Materi untuk siswa mahir vs butuh bimbingan.
    *   **Diferensiasi Proses**: Cara belajar (Visual, Auditori, Kinestetik).
    *   **Diferensiasi Produk**: Luaran hasil belajar yang beragam (Poster, Video, Laporan).

    **3. KEAHLIAN MATA PELAJARAN (DATA-DRIVEN):**
    Anda memiliki akses ke database **BSKAP_DATA**. Gunakan prinsip ini:
    - **STEM (Matematika/IPA)**: Fokus pada *Inquiry* dan *Problem Solving*. **WAJIB** gunakan **LaTeX** untuk SEMUA rumus matematika (Contoh: $x^2 + 2x$).
    - **Bahasa/Sastra**: Fokus pada *Literasi* dan *Ekspresi Diri*.
    - **Seni/Olahraga**: Fokus pada *Kreativitas* dan *Kesehatan Mental/Fisik*.

    **4. PANDUAN MASALAH (PROBLEM SOLVER):**
    - **Siswa Bermasalah (Akademik/Perilaku)**: Jangan menghakimi. Lakukan pendekatan persuasif dan restitusi. Cek data (Nilai/Absen) sebelum memberi saran.
    - **Administrasi Guru**: Ingatkan guru bahwa RPP/ATP di aplikasi ini sudah otomatis sesuai BSKAP 046/2025.
    - **Kelelahan Guru**: Berikan semangat dan empati (Teacher Wellbeing).

    **5. ATURAN RESPONS (STRICT):**
    - **Sapaan**: Gunakan "${userTitle}" atau "Pak/Bu".
    - **Gaya Bahasa**: Gunakan bahasa Indonesia yang familiar, akrab, dan natural (seperti guru ngobrol di ruang guru). **JANGAN** gunakan frasa kaku AI seperti "Sebagai model bahasa saya tidak punya...", "Penting untuk diingat bahwa...". Langsung saja ke intinya dengan nada bersahabat.
    - **Terminologi**: WAJIB gunakan kata **"Peserta Didik"** (bukan siswa/murid) dalam konteks formal Kurikulum Merdeka.
    - **Matematika**: WAJIB format LaTeX untuk rumus.
      *   Inline: $...$
      *   Block: $$...$$
    - **Tone**: Akrab, Bersahabat, Empatik, dan Solutif.
    - **Guardrails**: Jika topik menyimpang ke isu SARA, politik, atau topik non-pendidikan, arahkan kembali dengan halus ke topik pendidikan.
    - **Actionable**: Akhiri dengan 1 pertanyaan pemantik atau tawaran bantuan konkret.

    ${contextSnippet}

    **SUMBER KEBENARAN (BSKAP_DATA):**
    - Regulasi: ${BSKAP_DATA.standards?.regulation}
    - 3 Pilar: ${BSKAP_DATA.standards?.philosophy?.name} (${BSKAP_DATA.standards?.philosophy?.pillars?.map(p => p.name).join(', ')})
    - Profil Lulusan (8 Dimensi): ${JSON.stringify(BSKAP_DATA.standards?.profile_lulusan_2025?.map(p => p.dimensi) || [])}
    - Kompetensi Masa Depan: ${JSON.stringify(BSKAP_DATA.standards?.industry_competencies_2025_2026?.map(c => c.name) || [])}
    
    **REFERENSI BUKU RESMI (DATABASE):**
    ${JSON.stringify(BSKAP_DATA.textbooks || {})}
  `;

  return { parts: [{ text: instruction }] };
};


/**
 * Generates a response for a conversational chat using the backend AI service.
 * @param {Array<Object>} history - The conversation history.
 * @param {string} newMessage - The new message from the user.
 * @param {Object} userProfile - The user's profile data.
 * @param {string} modelName - The model name.
 * @param {string|null} imageData - Optional base64 image data.
 * @param {Object} liveContext - Optional real-time class data stats.
 * @returns {Promise<string>} The generated response text.
 */
export async function generateChatResponse(history, newMessage, userProfile, modelName, imageData = null, liveContext = null) {
  try {
    // Send to backend instead of direct Google SDK call
    const response = await api.post('/ai/chat', {
      message: newMessage,
      history: history.slice(0, -1), // History excluding the latest message which is sent separately
      context: {
        liveContext,
      },
      modelName,
      imageData
    });

    return response.data.content || response.data.response || "Maaf, Si Pintar tidak bisa merespons saat ini.";
  } catch (error) {
    console.error("Error in generateChatResponse (Backend):", error);
    return handleGeminiError(error, "generateChatResponse");
  }
}


/**
 * Analyzes teaching journals to provide a summary and sentiment analysis.
 * Implements caching: returns cached result if journals data has not changed.
 * @param {Array<Object>} journals - The list of journal objects.
 * @param {string} modelName - The Gemini model to use (from user settings).
 * @returns {Promise<Object>} An object containing the summary and sentiment.
 */
export async function analyzeTeachingJournals(journals, modelName) {
  if (!journals || journals.length === 0) {
    lastAnalyzedJournalsString = null;
    lastAnalysisResultCache = null;
    return { summary: "Tidak ada jurnal untuk dianalisis.", sentiment: { percentage: 0, explanation: "" } };
  }

  const currentJournalsString = JSON.stringify(journals);

  if (currentJournalsString === lastAnalyzedJournalsString && lastAnalysisResultCache !== null) {
    console.log("Returning cached analysis result for teaching journals.");
    return lastAnalysisResultCache;
  }

  const modelForAnalysis = getModel(modelName);

  const journalTexts = journals.map(journal => `
    Tanggal: ${journal.date}
    Kelas: ${journal.className}
    Mata Pelajaran: ${journal.subjectName}
    Materi: ${journal.material}
    Tujuan Pembelajaran: ${journal.learningObjectives}
    Kegiatan Pembelajaran: ${journal.learningActivities}
    Refleksi: ${journal.reflection || 'Tidak ada'}
    Hambatan: ${journal.challenges || 'Tidak ada'}
    Tindak Lanjut: ${journal.followUp || 'Tidak ada'}
    ---
  `).join('\n');

  const prompt = `
    Anda adalah seorang asisten analisis data untuk guru. Berdasarkan beberapa entri jurnal mengajar berikut:
    ${journalTexts}

    Berikan analisis dalam format yang ketat and ringkas:
    1.  **Ringkasan**: Ringkasan singkat dan padat (1-2 kalimat) mengenai kegiatan, tantangan, dan refleksi utama.
    2.  **Analisis Sentimen**: Analisis sentimen keseluruhan dari refleksi dan hambatan dalam bentuk persentase positif (misal: 75%) dan penjelasan singkat mengapa sentimen tersebut muncul.

    Format output Anda HARUS seperti ini, dan tidak ada teks lain di luar format ini:
    RINGKASAN: [Ringkasan Anda]
    SENTIMEN_PERSENTASE: [Persentase positif, misal 75]
    SENTIMEN_PENJELASAN: [Penjelasan singkat sentimen]
  `;

  try {
    const result = await retryWithBackoff(() => modelForAnalysis.generateContent(prompt));
    const response = await result.response;
    const text = response.text();

    let summary = "Tidak dapat menghasilkan ringkasan.";
    let sentimentPercentage = 0;
    let sentimentExplanation = "Tidak dapat menganalisis sentimen.";

    const summaryMatch = text.match(/RINGKASAN: (.*)/);
    if (summaryMatch && summaryMatch[1]) {
      summary = summaryMatch[1].trim();
    }

    const sentimentPercentageMatch = text.match(/SENTIMEN_PERSENTASE: (\d+)/);
    if (sentimentPercentageMatch && sentimentPercentageMatch[1]) {
      sentimentPercentage = parseInt(sentimentPercentageMatch[1], 10);
    }

    const sentimentExplanationMatch = text.match(/SENTIMEN_PENJELASAN: (.*)/);
    if (sentimentExplanationMatch && sentimentExplanationMatch[1]) {
      sentimentExplanation = sentimentExplanationMatch[1].trim();
    }

    const analysisResult = {
      summary,
      sentiment: {
        percentage: sentimentPercentage,
        explanation: sentimentExplanation,
      },
    };

    lastAnalyzedJournalsString = currentJournalsString;
    lastAnalysisResultCache = analysisResult;

    return analysisResult;
  } catch (error) {
    const errorMsg = handleGeminiError(error, "analyzeTeachingJournals");
    lastAnalyzedJournalsString = null;
    lastAnalysisResultCache = null;
    return { summary: errorMsg, sentiment: { percentage: 0, explanation: errorMsg } };
  }
}


/**
 * Analyzes teaching journals to find mentions of specific students and identify potential issues.
 * @param {Array<Object>} journals - The list of all journal objects.
 * @param {Array<string>} studentNames - The list of student names to look for.
 * @returns {Promise<Object>} An object where keys are student IDs and values are arrays of warning strings.
 */
export async function analyzeJournalsForStudentWarnings(journals, students, modelName) {
  if (!journals || journals.length === 0 || !students || students.length === 0) {
    return {};
  }

  const studentNames = students.map(s => s.name);
  const studentMap = students.reduce((acc, student) => {
    acc[student.name] = student.id;
    return acc;
  }, {});

  const modelForWarnings = getModel(modelName);

  const journalTexts = journals.map(j => `
    --- JURNAL BARU ---
    Tanggal: ${j.date}
    Kelas: ${j.className}
    Materi: ${j.material}
    Refleksi: ${j.reflection || '-'}
    Hambatan: ${j.challenges || '-'}
    ---
  `).join('\n');

  const prompt = `
    Anda adalah AI asisten guru yang cerdas. Tugas Anda adalah membaca kumpulan jurnal mengajar berikut dan mengidentifikasi catatan negatif atau kekhawatiran tentang siswa tertentu.

    Jurnal Mengajar:
    ${journalTexts}

    Daftar Nama Siswa untuk Dipindai:
    ${studentNames.join(', ')}

    Analisis setiap jurnal dan identifikasi jika ada siswa dari daftar di atas yang disebutkan dalam konteks negatif, seperti "sulit fokus", "tidak mengerjakan tugas", "mengganggu kelas", "sering melamun", "terlihat sedih", "kurang berpartisipasi", atau masalah lainnya.

    Hasilkan output dalam format JSON yang ketat. Kunci JSON adalah nama siswa, dan nilainya adalah array string yang berisi ringkasan singkat dari setiap masalah yang ditemukan untuk siswa tersebut. 
    
    Contoh output:
    {
      "Budi Santoso": ["Disebutkan mengalami kesulitan fokus saat pelajaran matematika.", "Ada catatan bahwa Budi tidak mengerjakan PR."],
      "Ani Lestari": ["Terlihat kurang aktif dan sering melamun di kelas."]
    }

    Jika tidak ada siswa yang disebutkan atau tidak ada catatan negatif yang ditemukan untuk siswa mana pun, kembalikan objek JSON kosong {}.
  `;

  try {
    const result = await retryWithBackoff(() => modelForWarnings.generateContent(prompt));
    const response = await result.response;
    let text = response.text();

    const jsonMatch = text.match(/\{.*\}/s);
    if (!jsonMatch) {
      console.error("AI response is not in the expected JSON format:", text);
      return {};
    }

    const parsedResult = JSON.parse(jsonMatch[0]);

    const warningsByStudentId = {};
    for (const name in parsedResult) {
      const studentId = studentMap[name];
      if (studentId) {
        warningsByStudentId[studentId] = parsedResult[name];
      }
    }

    return warningsByStudentId;

  } catch (error) {
    const errorMsg = handleGeminiError(error, "analyzeJournalsForStudentWarnings");
    return { error: errorMsg };
  }
}


/**
 * Generates a comprehensive analysis report for a class using the backend AI service.
 * @param {Object} classData - Data for the class.
 * @param {string} modelName - The model name.
 * @returns {Promise<string>} The generated report in Markdown format.
 */
export async function generateClassAnalysisReport(classData, modelName) {
  try {
    const response = await api.post('/ai/analyze-class', {
      className: classData.className,
      students: classData.students,
      attendanceSummary: classData.attendance,
      gradesSummary: classData.grades,
      infractionsSummary: classData.infractions,
      journalsSummary: classData.journals,
      isConcise: false,
      modelName
    });

    return response.data.content || "Gagal membuat laporan analisis kelas.";
  } catch (error) {
    console.error("Error in generateClassAnalysisReport (Backend):", error);
    return handleGeminiError(error, "generateClassAnalysisReport");
  }
}

/**
 * Generates a concise analysis report for a class using the backend AI service.
 * @param {Object} classData - Data for the class.
 * @param {string} modelName - The model name.
 * @returns {Promise<string>} The generated concise report in Markdown format.
 */
export async function generateConciseClassAnalysisReport(classData, modelName) {
  try {
    const response = await api.post('/ai/analyze-class', {
      className: classData.className,
      students: classData.students,
      attendanceSummary: classData.attendance,
      gradesSummary: classData.grades,
      infractionsSummary: classData.infractions,
      journalsSummary: classData.journals,
      isConcise: true,
      modelName
    });

    return response.data.content || "Gagal membuat laporan analisis ringkas.";
  } catch (error) {
    console.error("Error in generateConciseClassAnalysisReport (Backend):", error);
    return handleGeminiError(error, "generateConciseClassAnalysisReport");
  }
}

/**
 * Generates a concise analysis of students who need special attention using the backend AI service.
 * @param {Array<Object>} studentDataForPrompt - The data for each student.
 * @param {string} rombel - The name of the class.
 * @returns {Promise<string>} The generated recommendation in Markdown format.
 */
export async function generateRombelAnalysis(studentDataForPrompt, rombel, modelName) {
  try {
    const response = await api.post('/ai/analyze-class', {
      className: rombel,
      students: studentDataForPrompt.map(s => ({ name: s.studentName })),
      attendanceSummary: studentDataForPrompt.map(s => ({ studentName: s.studentName, attendance: s.attendance })),
      gradesSummary: studentDataForPrompt.map(s => ({ studentName: s.studentName, avg: s.academicAvg })),
      infractionsSummary: [], // Not available in this compact format
      isConcise: true,
      modelName
    });

    return response.data.content || "Gagal membuat laporan analisis rombel.";
  } catch (error) {
    console.error("Error in generateRombelAnalysis (Backend):", error);
    return handleGeminiError(error, "generateRombelAnalysis");
  }
}

/**
 * Generates an analysis report for a single student.
 * @param {string} prompt - The fully constructed prompt with student data.
 * @returns {Promise<string>} The generated report in Markdown format.
 */
/**
 * Polishes raw text (e.g., from voice input) into a professional teaching journal entry.
 * @param {string} rawText - The raw notes or spoken text.
 * @param {string} modelName - The name of the model to use.
 * @returns {Promise<string>} The polished professional text.
 */
export async function polishJournalText(rawText, modelName) {
  if (!rawText || rawText.trim().length === 0) return "";

  const prompt = `
    Anda adalah asisten guru yang ahli. Ubahlah catatan mentah atau hasil rekaman suara guru berikut menjadi draf jurnal mengajar yang profesional, terstruktur, dan formal dalam Bahasa Indonesia yang baik dan benar.
    
    Catatan Mentah:
    "${rawText}"
    
    Tugas Anda:
    - Perbaiki tata bahasa dan ejaan.
    - Gunakan kosakata kependidikan yang tepat.
    - Pastikan kalimatnya mengalir dan profesional.
    - Jangan menambah informasi yang tidak ada di catatan mentah.
    - Berikan hasil akhir saja tanpa komentar tambahan.
  `;

  try {
    const model = getModel(modelName);
    const result = await retryWithBackoff(() => model.generateContent(prompt));
    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    console.error("Error polishing journal text:", error);
    return rawText; // Fallback to raw text on error
  }
}

/**
 * Generates an analysis report for a single student.
 * @param {string} prompt - The fully constructed prompt with student data.
 * @returns {Promise<string>} The generated report in Markdown format.
 */
/**
 * Generates an advanced quiz based on RPP/Promes context and specific configurations.
 * @param {Object} params - Tool parameters
 * @param {string} params.topic - The main topic or KD.
 * @param {string} params.context - The content of the RPP or Promes for context.
 * @param {string} params.gradeLevel - Class/Grade level.
 * @param {string} params.subject - Subject name.
 * @param {Object} params.typeCounts - Object with question type keys and count values, e.g., { pg: 10, true_false: 5 }
 * @param {number} params.difficulty - 0 to 100 slider value (LOTS to HOTS).
 * @returns {Promise<Object>} - The generated quiz object with stimulus and items.
 */
const BATCH_SIZE = 3;

/**
 * Generates an advanced quiz based on RPP/Promes context and specific configurations.
 * Multi-stage/Batching implementation to ensure quality and reliability.
 */
export async function generateAdvancedQuiz({ topic, context, gradeLevel, subject, typeCounts, difficulty, modelName, onProgress = () => { } }) {
  try {
    onProgress({ stage: 'preparing', message: 'Mempersiapkan parameter kuis & landasan BSKAP 46/2025...', percentage: 5 });

    // 1. Calculate batches
    const flattenedRequests = [];
    Object.entries(typeCounts).forEach(([type, count]) => {
      for (let i = 0; i < count; i++) {
        flattenedRequests.push(type);
      }
    });

    const totalQuestions = flattenedRequests.length;
    const batches = [];
    for (let i = 0; i < totalQuestions; i += BATCH_SIZE) {
      batches.push(flattenedRequests.slice(i, i + BATCH_SIZE));
    }

    onProgress({ stage: 'preparing', message: `Membagi ${totalQuestions} soal ke dalam ${batches.length} batch...`, percentage: 10 });

    let allQuestions = [];
    let quizTitle = "";

    // 2. Generate each batch
    for (let i = 0; i < batches.length; i++) {
      const currentBatch = batches[i];
      const batchNum = i + 1;
      const progressBase = 10 + (batchNum / batches.length) * 80;

      onProgress({
        stage: 'generating',
        message: `Batch ${batchNum}/${batches.length}: Membuat ${currentBatch.length} soal...`,
        percentage: Math.round(progressBase)
      });

      const batchSummary = currentBatch.reduce((acc, t) => {
        acc[t] = (acc[t] || 0) + 1;
        return acc;
      }, {});
      const batchTypeDetails = Object.entries(batchSummary).map(([t, c]) => `${t}: ${c} soal`).join(', ');

      const model = getModel(modelName, true);

      // Determine Option Count based on Grade Level
      let optionCount = 5;
      let optionLabel = "A-E";
      const lowerGrade = String(gradeLevel || '').toLowerCase();
      if (lowerGrade.includes('sd') || lowerGrade.includes('mi') || lowerGrade.match(/\b(1|2|3|4|5|6|i|ii|iii|iv|v|vi)\b/i)) {
        optionCount = 3; optionLabel = "A-C";
      } else if (lowerGrade.includes('smp') || lowerGrade.includes('mts') || lowerGrade.match(/\b(7|8|9|vii|viii|ix)\b/i)) {
        optionCount = 4; optionLabel = "A-D";
      }

      const batchInstructions = currentBatch.map((type, idx) => `- Soal No ${allQuestions.length + idx + 1}: WAJIB Tipe **${type}**`).join('\n');

      const prompt = `
        LANDASAN REGULASI: **BSKAP No. 46 Tahun 2025** (Standar Nasional Kurikulum Merdeka).
        STANDAR PEDAGOGIS: **Buku Teks Utama Kemendikbudristek** (Mindful, Meaningful, Joyful).
        
        TUGAS: Buatlah ${currentBatch.length} butir soal untuk:
        - Mapel: ${subject} | Kelas: ${gradeLevel} | Topik: ${topic}
        - Konteks: "${context || 'INPUT MANUAL/MINIM'}" 
        ${!context ? '(WAJIB: Gunakan Database Internal Kurikulum Merdeka & BSKAP 46/2025 Anda untuk menentukan CP/Kompetensi yang relevan secara mandiri)' : '(WAJIB JADI SUMBER UTAMA)'}
        - HOTS Meter: ${difficulty}%
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
        4. **VARIASI POSISI JAWABAN (MANDATORY)**: Pastikan posisi jawaban benar (untuk PG/Complex) selalu berpindah-pindah dan tidak mengikuti pola tertentu.
        5. **PRINSIP DEEP LEARNING (WAJIB)**:
           - **Kontekstual**: Hubungkan soal dengan kehidupan sehari-hari siswa agar bermakna.
           - **Reflektif**: Ajak siswa melihat kembali apa yang dipelajari dan proses belajarnya.
           - **Eksploratif**: Berikan ruang untuk berbagai kemungkinan jawaban atau solusi kreatif.
        5. Pilihan jawaban (untuk PG) wajib ${optionCount} opsi (${optionLabel}).
            - **indicator**: Indikator soal (Format: Disajikan [konteks/stimulus], siswa dapat [KKO] [materi]). Harus SINGKAT dan PADAT.
         7. **IMAGE HINT (OPTIONAL)**: Jika soal sangat membutuhkan dukungan visual (seperti diagram, grafik, peta, atau anatomi), sertakan field **"image_hint"** berisi instruksi spesifik untuk guru (Contoh: "[Sertakan gambar struktur sel hewan di sini]"). Jika tidak butuh gambar, kosongkan ("").
        
        STRUKTUR JSON PER TIPE (INPUT HARUS SESUAI):
        - **Wajib Ada di Setiap Soal**: 
          "pedagogical_materi": "Materi spesifik soal ini (max 5 kata)",
          "competency": "Intisari CP relevan (Singkat)", 
          "indicator": "Indikator operasional (Singkat)", 
          "cognitive_level": "L1/L2/L3",
          "stimulus": "Teks stimulus/kasus untuk soal ini (jika ada)",
          "image_hint": "Instruksi gambar (Opsional, gunakan [] jika ada)"
        - **pg**: {"type": "pg", "pedagogical_materi": "...", "competency": "...", "indicator": "...", "cognitive_level": "...", "stimulus": "...", "question": "...", "options": ["A...", "B..."], "answer": "A...", "explanation": "..."}
        - **pg_complex**: {"type": "pg_complex", "pedagogical_materi": "...", "competency": "...", "indicator": "...", "cognitive_level": "...", "stimulus": "...", "question": "...", "options": ["1...", "2..."], "answer": ["1...", "3..."], "explanation": "..."}
         - **pg_matrix**: {"type": "pg_matrix", "pedagogical_materi": "...", "competency": "...", "indicator": "...", "cognitive_level": "...", "stimulus": "...", "question": "...", "rows": ["Pernyataan 1", "Pernyataan 2"], "columns": ["Kategori A", "Kategori B"], "answer": [{"row": "Pernyataan 1", "column": "Kategori A"}], "explanation": "..."}
         - **matching**: {"type": "matching", "pedagogical_materi": "...", "competency": "...", "indicator": "...", "cognitive_level": "...", "stimulus": "...", "question": "...", "left_side": ["A", "B"], "right_side": ["1", "2", "3"], "pairs": [{"left": "A", "right": "1"}], "explanation": "..."}
         - **true_false**: {"type": "true_false", "pedagogical_materi": "...", "competency": "...", "indicator": "...", "cognitive_level": "...", "stimulus": "...", "question": "...", "statements": [{"text": "S1", "isCorrect": true}], "explanation": "..."}
         - **short_answer**: {"type": "short_answer", "pedagogical_materi": "...", "competency": "...", "indicator": "...", "cognitive_level": "...", "stimulus": "...", "question": "...", "answer": "Kunci jawaban (Singkat 1-3 kata)", "explanation": "..."}
         - **sequencing**: {"type": "sequencing", "pedagogical_materi": "...", "competency": "...", "indicator": "...", "cognitive_level": "...", "stimulus": "...", "question": "...", "items": ["Langkah A", "Langkah B", "Langkah C"], "correct_order": ["Langkah B", "Langkah A", "Langkah C"], "explanation": "..."}
         - **essay/uraian**: {"type": "essay", "pedagogical_materi": "...", "competency": "...", "indicator": "...", "cognitive_level": "...", "stimulus": "...", "question": "...", "answer": "Kunci jawaban (WAJIB SINGKAT & PADAT)", "grading_guide": "Pedoman penskoran ringkas", "explanation": "Penjelasan singkat"}

        FORMAT OUTPUT TOTAL (JSON):
        {
          "title": "${topic}",
          "questions": [
             // Masukkan ${currentBatch.length} soal di sini sesuai tipe di atas
          ]
        }
      `;

      const result = await retryWithBackoff(() => model.generateContent(prompt));
      const response = await result.response;
      const parsed = extractJSON(response.text());

      if (parsed.questions && Array.isArray(parsed.questions)) {
        const processedQuestions = parsed.questions.map(q => {
          // Shuffling logic for objective types to maximize randomization
          if (q.type === 'pg' && Array.isArray(q.options)) {
            return { ...q, options: shuffleArray(q.options) };
          }
          if (q.type === 'pg_complex' && Array.isArray(q.options)) {
            return { ...q, options: shuffleArray(q.options) };
          }
          if (q.type === 'matching' && Array.isArray(q.right_side)) {
            return { ...q, right_side: shuffleArray(q.right_side) };
          }
          if (q.type === 'sequencing' && Array.isArray(q.items)) {
            return { ...q, items: shuffleArray(q.items) };
          }
          if (q.type === 'true_false' && Array.isArray(q.statements)) {
            return { ...q, statements: shuffleArray(q.statements) };
          }
          if (q.type === 'pg_matrix' && Array.isArray(q.rows)) {
            return { ...q, rows: shuffleArray(q.rows) };
          }
          return q;
        });
        allQuestions = [...allQuestions, ...processedQuestions];
        if (!quizTitle) quizTitle = parsed.title;
      }
    }

    onProgress({ stage: 'complete', message: 'Semua batch berhasil digabungkan!', percentage: 100 });

    return {
      title: quizTitle || topic,
      questions: allQuestions
    };

  } catch (error) {
    throw new Error(handleGeminiError(error, "generateAdvancedQuiz rebuild"));
  }
}

/**
 * Generates quiz questions based on an uploaded image.

 * @param {string} imageBase64 - Base64 string of the image.
 * @param {string} topic - Additional topic context.
 * @param {string} gradeLevel - Class level.
 * @param {string} subject - Subject name.
 * @param {number} count - Number of questions.
 * @returns {Promise<Object>} - Quiz object.
 */
export async function generateQuizFromImage({ imageBase64, topic, gradeLevel, subject, count, modelName, onProgress = () => { } }) {
  try {
    onProgress({ stage: 'preparing', message: 'Menganalisis gambar...', percentage: 20 });
    const model = getModel(modelName);

    const prompt = `
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

    const imagePart = {
      inlineData: {
        data: imageBase64.split(',')[1],
        mimeType: "image/jpeg"
      },
    };

    onProgress({ stage: 'generating', message: 'Mengekstrak data kognitif dari gambar...', percentage: 50 });
    const result = await retryWithBackoff(() => model.generateContent([prompt, imagePart]));
    const response = await result.response;

    onProgress({ stage: 'parsing', message: 'Memformat hasil analisis...', percentage: 85 });
    const text = response.text();
    const parsed = extractJSON(text);

    // Shuffle matching if exists (Question from image usually outputs PG but for future proofing)
    if (parsed.questions && Array.isArray(parsed.questions)) {
      parsed.questions = parsed.questions.map(q => {
        if (q.type === 'matching' && Array.isArray(q.right_side)) {
          return { ...q, right_side: shuffleArray(q.right_side) };
        }
        return q;
      });
    }

    onProgress({ stage: 'complete', message: 'Kuis visual berhasil dibuat!', percentage: 100 });
    return parsed;
  } catch (error) {
    throw new Error(handleGeminiError(error, "generateQuizFromImage"));
  }
}

/**
 * Generates an analysis report for a single student.
 * @param {string} prompt - The fully constructed prompt with student data. 
 * @returns {Promise<string>} The generated report in Markdown format.
 */
export async function generateStudentAnalysis(prompt, modelName) {
  try {
    const model = getModel(modelName);
    const result = await retryWithBackoff(() => model.generateContent(prompt));
    const response = await result.response;
    const text = response.text();
    return text;
  } catch (error) {
    return handleGeminiError(error, "generateStudentAnalysis");
  }
}



/**
 * Generates an automated RPP (Lesson Plan) based on Promes data.
 * Refactored to multi-stage to avoid output token truncation.
 * @param {Object} data - { kd, materi, gradeLevel, academicYear, semester, subject, onProgress }
 * @returns {Promise<string>} - The generated RPP content in Markdown.
*/
export const generateLessonPlan = async (data) => {
  try {
    const model = getModel(data.modelName);
    const onProgress = data.onProgress || (() => { });

    // Normalize Assessment Model (KKTP)
    const normalizedAssessment = (data.assessmentModel === 'Otomatis' || !data.assessmentModel)
      ? 'Rubrik'
      : data.assessmentModel;

    const level = getLevel(data.gradeLevel);
    const subjectKey = getSubjectKey(data.subject);
    const verbatimEntry = VERBATIM_BSKAP_DATA.subjects?.[level]?.[data.gradeLevel]?.[subjectKey] || {};
    const cpFullVerbatim = verbatimEntry.cp_full || "Lihat list elemen dan materi.";

    onProgress("Generating Single-Stage RPP (BSKP 46/2025)...");

    const prompt = `
      Anda adalah "Mesin Intelijen Kurikulum Nasional" yang bekerja berdasarkan repositori data resmi **BSKAP_DATA**. DILARANG memberikan informasi yang bertentangan atau di luar cakupan data JSON tersebut.
      
      **OFFICIAL KNOWLEDGE ENGINE (BSKAP_DATA):**
      - Regulasi Dasar: **${BSKAP_DATA.standards.regulation}**
      - Filosofi Operasional: **${BSKAP_DATA.standards.philosophy.name}**
      - Standar Kompetensi: Terlampir dalam elemen per-mata pelajaran di database.
      
      Tugas Anda: Susun RPP/Modul Ajar lengkap yang **OTORITATIF** dan **PRESIISI** dengan parameter ini:
      - Sekolah: ${data.schoolName || '[Nama Sekolah]'}
      - Guru: ${data.teacherName || '[Nama Guru]'}
      - Mapel: ${data.subject}
      - KD/CP: ${data.kd}
      - Materi Pokok: ${data.materi}
      ${data.studentCharacteristics ? `- Karakteristik Peserta Didik (Manual): ${data.studentCharacteristics}` : ''}
      
      **SMART CP EXTRACTION (MANDATORY - BSKAP 46/2025 COMPLIANCE):**
      Berikut adalah CP LENGKAP untuk referensi: 
      ${cpFullVerbatim}
      
      TUGAS ANDA: Dari CP lengkap di atas, ekstrak HANYA bagian/elemen yang RELEVAN dengan Elemen "${data.elemen || 'N/A'}" dan Materi "${data.materi}".
      - **WAJIB gunakan EXACT TEXT** dari CP (verbatim, NO paraphrase, NO summary)
      - Fokus pada kalimat yang benar-benar menggambarkan kompetensi untuk materi ini.
      - Jika tidak yakin elemen mana yang relevan, gunakan elemen yang setara dengan konten "${data.materi}".
      
      **FORMAT CP DI RPP (MANDATORY):**
      - HAPUS nomor elemen (mis. "2.1.", "2.2.", "3.1.") dari teks CP
      - MULAI dengan konteks Fase: "Pada akhir Fase [X], peserta didik mampu..."
      - Gunakan exact text CP tanpa nomor elemen
      - Jika multiple elemen, gabungkan menjadi paragraf natural dengan konektor yang sesuai
      
      Contoh Format yang BENAR:
      "Pada akhir Fase B, peserta didik mampu mengidentifikasi makna sila-sila Pancasila dan penerapannya dalam kehidupan sehari-hari."
      
      Contoh Format yang SALAH:
      "2.1. Pancasila Mengidentifikasi makna sila-sila Pancasila..."
      ${data.profilLulusan ? `
      - **PROFIL LULUSAN (MANDATORY)**: Dimensi yang HARUS digunakan: **${data.profilLulusan}**. DILARANG KERAS berimprovisasi, menambah, atau mengurangi dimensi ini. Gunakan PERSIS seperti tertulis.` : ''}
      ${data.sourceType === 'atp' ? `- **SUMBER UTAMA (ATP)**: RPP ini HARUS diturunkan secara spesifik dari butir Tujuan Pembelajaran (TP) yang tercantum di Alur Tujuan Pembelajaran (ATP). Gunakan Elemen ${data.elemen} sebagai jangkar kompetensi.` : ''}
      
      ${getRegionalLanguage(data.subject) ? `
      **INSTRUKSI BAHASA DAERAH (${getRegionalLanguage(data.subject)})**:
      - Karena mata pelajaran ini adalah Bahasa Daerah, Anda **WAJIB** menggunakan **Bahasa ${getRegionalLanguage(data.subject)}** untuk seluruh isi konten pembelajaran (Tujuan Pembelajaran, Langkah Kegiatan, Materi Ajar, dsb).
      - Gunakan tingkatan bahasa yang sesuai (misal: Ngoko/Kromo untuk Jawa sesuai konteks materi).
      ${(getRegionalLanguage(data.subject).toLowerCase().includes('jawa') || getRegionalLanguage(data.subject).toLowerCase().includes('madura')) ? `- Sertakan penggunaan **Aksara Hanacaraka (Aksara Jawa/Madura)** pada bagian yang relevan (terutama di bagian Materi Ajar Mendetail dan Latihan LKPD).` : ''}
      - Tetap gunakan Bahasa Indonesia HANYA untuk instruksi struktural dan label header dokumen.
      ` : ''}
      
      **INTELIGENSI SEMESTER (WAJIB):**
      - Semester Aktif: **${getSemesterLabel(data.semester)}**
      - Fokus: **${BSKAP_DATA.standards.semester_logic[getSemesterKey(data.semester)].focus}**

      **KOMPETENSI MASA DEPAN (STRATEGIS 2026):**
      Integrasikan butir-butir kompetensi industri berikut ke dalam Langkah Pembelajaran atau Asesmen jika relevan:
      ${(BSKAP_DATA.standards.industry_competencies_2025_2026 || []).map(c => `- ${c.name}: ${c.description}`).join('\n      ')}

      **PRINSIP PENYUSUNAN:**
      1. **KESELARASAN KOGNITIF:** Pastikan level KKO (Kata Kerja Operasional) konsisten dari TP hingga KKTP.
      2. **FOKUS MATERI:** Pembahasan harus terpusat pada "${data.materi}" tanpa melebar.
      3. **KESESUAIAN JENJANG:** Sesuaikan bahasa, contoh, dan kegiatan dengan tingkat perkembangan Kelas ${data.gradeLevel}.
      4. **INDIKATOR OPERASIONAL:** Turunkan TP menjadi beberapa IKTP yang spesifik dan terukur.

      **PENTING - OPERASIONALISASI TUJUAN (IKTP):**
      Anda **WAJIB** menurunkan Tujuan Pembelajaran (TP) yang luas menjadi beberapa **Indikator Tujuan Pembelajaran (IKTP)** yang spesifik, operasional, dan terukur untuk kegiatan ini.
      - Cantumkan label **"Indikator Tujuan Pembelajaran"** secara eksplisit di bawah bagian Tujuan Pembelajaran.
      - IKTP harus menunjukkan langkah-langkah pencapaian kompetensi secara bertahap (misal: dari mengidentifikasi -> mengklasifikasi -> mensimulasikan).

      **PENTING - KESESUAIAN JENJANG KELAS:**
      Anda HARUS menyesuaikan seluruh konten RPP dengan jenjang kelas "${data.gradeLevel}". Perhatikan hal-hal berikut:

      **Untuk Kelas SD (1-6):**
      - Gunakan bahasa yang sangat sederhana, konkret, dan mudah dipahami anak usia 6-12 tahun.
      - Fokus pada pembelajaran berbasis permainan, cerita, dan pengalaman langsung.
      - Contoh dan ilustrasi harus dari kehidupan sehari-hari anak (keluarga, sekolah, lingkungan sekitar).
      - Kegiatan harus melibatkan gerakan fisik, visual, and hands-on activities.
      - Durasi fokus: 15-20 menit per aktivitas untuk kelas rendah (1-3), 25-30 menit untuk kelas tinggi (4-6).
      - Hindari konsep abstrak yang terlalu kompleks; gunakan pendekatan konkret-visual.

      **Untuk Kelas SMP (7-9):**
      - Gunakan bahasa yang jelas namun mulai memperkenalkan istilah akademis.
      - Fokus pada pengembangan berpikir kritis dan analitis awal.
      - Contoh dari kehidupan remaja, isu sosial sederhana, dan fenomena yang dapat diamati.
      - Kegiatan berbasis diskusi kelompok, eksperimen sederhana, dan proyek kolaboratif.
      - Mulai memperkenalkan konsep abstrak dengan jembatan dari konkret.
      - Dorong kemandirian dan tanggung jawab dalam belajar.

      **Untuk Kelas SMA/SMK (10-12):**
      - Gunakan bahasa akademis yang tepat dan istilah teknis sesuai bidang.
      - Fokus pada berpikir tingkat tinggi: analisis, evaluasi, kreasi.
      - Contoh dari isu kontemporer, kasus nyata, penelitian, dan aplikasi profesional.
      - Kegiatan berbasis riset, debat, presentasi, dan proyek kompleks.
      - Integrasikan konsep lintas disiplin dan aplikasi dunia nyata.
      - Persiapkan peserta didik untuk pendidikan tinggi atau dunia kerja.

      **PENTING - KEPATUHAN KETAT CAPAIAN PEMBELAJARAN (CP) BERDASARKAN KEPUTUSAN KEPALA BSKAP NO. 046/H/KR/2025:**
      1. **SUMBER KEBENARAN TUNGGAL**: Data berikut adalah EKSTRAKSI RESMI dari **${BSKAP_DATA.standards.regulation}** untuk **${getSemesterLabel(data.semester)}**.
      2. **VERBATIM CP (HARGA MATI)**: Pada bagian "Capaian Pembelajaran (CP)" di hasil RPP, Anda **WAJIB** menyalin teks hasil ekstraksi yang RELEVAN (dari langkah "SMART CP EXTRACTION") secara **VERBATIM (KATA PER KATA)**. 
      3. **DILARANG KERAS**: Melakukan parafrase, meringkas, atau mengubah satu kata pun dari isi CP yang telah diekstrak tersebut. Redaksi harus sesuai aslinya.
      4. **STRUKTUR DATA RESMI (SEMESTER ${getSemesterLabel(data.semester).toUpperCase()}):**
      ${JSON.stringify(
      (BSKAP_DATA.subjects[level]?.[data.gradeLevel]?.[subjectKey] ||
        BSKAP_DATA.subjects[level]?.[subjectKey])?.[getSemesterKey(data.semester)] ||
      BSKAP_DATA.subjects["SMA"]?.["10"]?.["Informatika"]?.["ganjil"] || {}
    )}
      5. **AKURASI FASE**: Gunakan pemetaan Fase: ${(BSKAP_DATA.standards.phases || []).map(p => `Fase ${p.phase} (Kelas ${p.grades.join('-')} ${p.level})`).join(', ')}.
      6. **FORMAT**: Gunakan format Markdown standar (* atau -).

      **PENTING - REFERENSI BUKU PEMERINTAH (WAJIB):**
      
      Anda WAJIB mereferensikan buku teks resmi yang diterbitkan oleh **Kemendikdasmen (Kementerian Pendidikan Dasar dan Menengah)** sesuai dengan jenjang dan mata pelajaran. Berikut panduan lengkapnya:
      
      **WAJIB HUKUMNYA**: Seluruh konten RPP, materi, dan instrumen harus merujuk pada buku dan pedoman dari Kemendikdasmen.

      **1. SUMBER BUKU RESMI PEMERINTAH:**
      - **Platform Resmi**: Buku Sekolah Elektronik (BSE) - buku.kemdikbud.go.id (Sekarang dikelola Kemendikdasmen)
      - **Penerbit Resmi**: Pusat Kurikulum dan Perbukuan (Puskurbuk) Kemendikdasmen
      - **Status**: Buku yang telah dinilai dan ditetapkan oleh Kemendikbudristek

      **2. IDENTIFIKASI BUKU YANG TEPAT:**
      
      Untuk **${data.subject}** Kelas **${data.gradeLevel}**, Anda harus:
      
      a) **Tentukan Jenjang dengan Benar:**
         - SD/MI: Kelas 1-6
         - SMP/MTs: Kelas 7-9
         - SMA/MA: Kelas 10-12
         - SMK/MAK: Kelas 10-12 (sesuai program keahlian)
      
      **PENTING - PROFIL LULUSAN (8 DIMENSI RESMI):**
      DILARANG KERAS memasukkan "Literasi AI", "Adaptabilitas", atau "EQ" ke dalam daftar Profil Lulusan. Mereka adalah Kompetensi Industri, bukan Dimensi Profil Lulusan.
      ${data.sourceType === 'atp' && data.profilLulusan ? `
      **WAJIB GUNAKAN DIMENSI INI (DARI ATP):**
      Karena RPP ini diturunkan dari ATP, Anda **HARUS** menggunakan dimensi Profil Lulusan yang sama dengan ATP: **${data.profilLulusan}**
      Pastikan TIDAK ADA unsur "Literasi AI" atau "Adaptabilitas" di sini.
      ` : `
      Dalam bagian Profil Lulusan / Karakter, Anda **WAJIB** memilih **minimal 1 dan MAKSIMAL 3 dimensi** paling relevan dari daftar        - **PROFIL LULUSAN (8 DIMENSI 2025):**
          *   **Keimanan & Ketakwaan**: Beriman, bertakwa kepada Tuhan YME, dan berakhlak mulia. (Termasuk: Integritas akademik, rasa syukur atas keteraturan alam/ilmu, etika profesi, dan tanggung jawab moral).
${(BSKAP_DATA.standards?.profile_lulusan_2025 || []).filter(d => d.id !== 1).map(d => `          *   **${d.dimensi}**: ${d.deskripsi}`).join('\n')}
      `}

      b) **Identifikasi Kurikulum:**
         - **Kurikulum Merdeka** (prioritas utama untuk tahun 2025/2026)
         - Kurikulum 2013 (jika sekolah masih menggunakan)
      
      c) **Nama Buku yang Akurat:**
         - Format: "[Nama Mata Pelajaran] untuk [Jenjang] Kelas [X]"
         - Contoh: "Matematika untuk SMP Kelas VII", "Bahasa Indonesia untuk SD Kelas 4"
         - Untuk Kurikulum Merdeka: Sebutkan "Buku Siswa" atau "Buku Guru"
      
      d) **Penulis dan Tahun Terbit:**
         - Sebutkan nama penulis jika memungkinkan
         - Tahun terbit (prioritas: 2022-2025 untuk Kurikulum Merdeka)
         - Contoh: "Tim Penulis Kemendikdasmen, 2022"

      **3. PANDUAN REFERENSI PER MATA PELAJARAN:**
      
      **Untuk Jenjang SD:**
      - **Mata Pelajaran**: Pendidikan Agama dan Budi Pekerti, Pendidikan Pancasila, Bahasa Indonesia, Matematika, IPAS (Ilmu Pengetahuan Alam dan Sosial - dimulai Kelas III), PJOK, Seni dan Budaya (Musik, Rupa, Teater, atau Tari), Bahasa Inggris (pilihan/mulok).
      
      **Untuk Jenjang SMP:**
      - **Mata Pelajaran Wajib**: Pendidikan Agama, Pendidikan Pancasila, Bahasa Indonesia, Matematika, IPA, IPS, Bahasa Inggris, PJOK, Seni, dan **Informatika** (WAJIB).
      - **Muatan Lokal**: Sesuai potensi daerah.

      **Untuk Jenjang SMA:**
      - **Kelas X (Fase E)**: Mapel umum serupa SMP sebagai fondasi.
      - **Kelas XI & XII (Fase F)**: **TIDAK ADA penjurusan** (IPA, IPS, Bahasa). Siswa memilih mapel pilihan (seperti Biologi, Fisika, Ekonomi, Geografi, dsb) sesuai minat dan rencana karier.

      **Identifikasi Buku yang Tepat:**
      - Gunakan format: "[Nama Mata Pelajaran] untuk [Jenjang] Kelas [X] Kurikulum Merdeka"
      - Contoh SD: "IPAS untuk SD Kelas 4 Kurikulum Merdeka"
      - Contoh SMA: "Fisika untuk SMA Kelas XI Kurikulum Merdeka"

      **4. CARA MENGGUNAKAN REFERENSI DALAM RPP:**
      
      a) **Di Bagian "Buku Sumber" (Kartu Soal/RPP):**
         - Tulis nama lengkap buku
         - Format: "Buku Siswa [Mapel] Kelas [X], Kemendikbudristek, [Tahun]"
         - Contoh: "Buku Siswa Matematika Kelas VII, Kemendikbudristek, 2022"
      
      b) **Di Bagian "Daftar Pustaka":**
         - Format APA atau format standar Indonesia
         - Contoh: Kemendikdasmen. (2022). Buku Siswa Matematika untuk SMP Kelas VII Kurikulum Merdeka. Jakarta: Pusat Kurikulum dan Perbukuan.
      
       c) **Di Bagian "Materi Ajar Mendetail":**
          - Rujuk halaman spesifik jika memungkinkan
          - Contoh: "Sesuai Buku Siswa [Mapel] Kemendikdasmen Halaman..."
       
       **5. VALIDASI KESESUAIAN MATERI:**
       
       Pastikan materi yang Anda ambil:
       - ✅ Sesuai dengan CP yang tercantum di BSKAP 046/2025
       - ✅ Sesuai dengan fase pembelajaran (A-F)
       - ✅ Sesuai dengan tingkat kognitif peserta didik
       - ✅ Menggunakan terminologi yang sama dengan buku teks pemerintah Kemendikdasmen
       - ✅ Tidak bertentangan dengan nilai-nilai Pancasila dan UUD 1945
 
       **6. JIKA BUKU SPESIFIK TIDAK TERSEDIA:**
       
       Jika Anda tidak memiliki akses ke buku spesifik:
       - Gunakan referensi umum: "Buku Siswa [Mapel] Kelas [X] Kurikulum Merdeka, Kemendikdasmen"
       - Tambahkan catatan: "Guru dapat menyesuaikan dengan buku teks yang digunakan di sekolah (Kemendikdasmen)"
       - JANGAN membuat referensi fiktif atau tidak resmi
       - Tetap gunakan materi yang akurat sesuai CP dan standar nasional Kemendikdasmen
 
       **7. CONTOH PENERAPAN LENGKAP:**
       
       Untuk Matematika Kelas 7, materi "Bilangan Bulat":
       Buku Sumber:
     - Buku Siswa Matematika untuk SMP Kelas VII Kurikulum Merdeka, Kemendikdasmen, 2022
       - Buku Guru Matematika untuk SMP Kelas VII Kurikulum Merdeka, Kemendikdasmen, 2022
       
       Materi Ajar Mendetail:
       Berdasarkan Buku Siswa Matematika Kelas VII(Bab 2: Bilangan Bulat, hal. 45 - 68):
     [Isi materi yang diambil dari buku tersebut sesuai standar Kemendikdasmen]
       
       Daftar Pustaka:
     Kemendikdasmen. (2022). Buku Siswa Matematika untuk SMP Kelas VII Kurikulum Merdeka.
       Jakarta: Pusat Kurikulum dan Perbukuan, Badan Standar, Kurikulum, dan Asesmen Pendidikan.

      **CATATAN SANGAT PENTING (KONTROL KUALITAS MATERI):**
      - **CEK KESESUAIAN KELAS:** Anda **WAJIB** memastikan materi dan KD yang dikembangkan **SANGAT SESUAI** dengan tingkat kelas **${data.gradeLevel}** Kurikulum Merdeka/K13 resmi.
      - **JANGAN SALAH LEVEL:** Jangan memasukkan materi yang terlalu sulit (milik kelas lebih tinggi) atau terlalu mudah (milik kelas lebih rendah).
      - **RUJUKAN RESMI:** Seluruh pengembangan materi, definisi, dan langkah pembelajaran **HARUS MENGACU PADA BUKU TEKS PELAJARAN RESMI KEMDIKBUD** untuk mapel ${data.subject} Kelas ${data.gradeLevel} yang beredar saat ini.
      - **KOREKSI OTOMATIS:** Jika input KD/Materi dari user terasa "kurang pas" dengan kelasnya, **SESUAIKAN** kedalaman dan cakupannya agar cocok untuk siswa kelas ${data.gradeLevel}.
      
      - Referensi buku pemerintah ini WAJIB dicantumkan di bagian "Media Belajar" dan "Daftar Pustaka"
      - Materi yang diambil harus akurat dan tidak menyimpang dari buku sumber
      - Jika ada perbedaan antara buku lama dan CP 2025, prioritaskan CP 2025

      **OFFICIAL TEXTBOOK REFERENCE (INTERNAL ONLY - DO NOT SHOW IN RPP OUTPUT):**
      Berdasarkan database BSKAP_DATA, berikut adalah buku yang relevan untuk materi "${data.materi}":
      - **Buku**: ${BSKAP_DATA.textbooks?.[getLevel(data.gradeLevel)]?.[data.gradeLevel]?.[getSubjectKey(data.subject)]?.title || `Buku Siswa ${data.subject} Kelas ${data.gradeLevel} Kurikulum Merdeka`}
      - **Penerbit**: ${BSKAP_DATA.textbooks?.[getLevel(data.gradeLevel)]?.[data.gradeLevel]?.[getSubjectKey(data.subject)]?.publisher || 'Kemendikbudristek'}
      - **Peta Bab Resmi**: ${JSON.stringify(BSKAP_DATA.textbooks?.[getLevel(data.gradeLevel)]?.[data.gradeLevel]?.[getSubjectKey(data.subject)]?.chapters || [])}

      **INSTRUKSI**: 
      1. Jika materi "${data.materi}" cocok dengan salah satu bab di atas, Anda **WAJIB** menyebutkan nama bab tersebut secara spesifik di bagian "Buku Sumber".
      2. Gunakan urutan logika dari buku tersebut untuk menyusun langkah pembelajaran.

      **STRUKTUR RPP YANG HARUS DIHASILKAN (Gunakan Format Markdown Ini):**

      # MODUL AJAR DEEP LEARNING (STANDARD 2026)

      ## IDENTIFIKASI PEMBELAJARAN
      | Komponen | Detail Informasi |
      | :--- | :--- |
      | **Satuan Pendidikan** | ${data.schoolName || '-'} |
      | **Mata Pelajaran** | ${data.subject} |
      | **Elemen** | ${data.elemen || '-'} |
      | **Kelas / Semester** | ${data.gradeLevel} / ${getSemesterLabel(data.semester)} |
      | **Materi Pokok** | ${data.materi} |
      | **Alokasi Waktu** | ${data.jp || '-'} JP (Total: .... menit) (${data.distribution ? data.distribution.length : 1} x tatap muka) |
      ${data.distribution && data.distribution.length > 1 ? `| **Rincian Pertemuan** | ${data.distribution.map((j, i) => `P${i + 1}: ${j} JP`).join(', ')} |` : ''}
      | **Sarana & Prasarana** | [Sebutkan alat, bahan, dan sumber belajar spesifik yang digunakan] |
      | **Model Pembelajaran** | [PILIH MODEL SPESIFIK: PBL/PJBL/DLL] |
      | **Tahun Ajaran** | ${data.academicYear || '-'} |
      | **Guru Pengampu** | ${data.teacherName || '-'} |
      | **NIP Guru** | ${data.teacherNip || '-'} |

      ## I. KOMPETENSI INTI (CP & TP)
      **1. Capaian Pembelajaran (CP):**
      (Tuliskan kompetensi utama yang harus dicapai peserta didik sesuai dengan fase and materi pokok ini).

      **2. Tujuan Pembelajaran (TP):**
      **WAJIB: Buatlah maksimal 3 (tiga) poin Tujuan Pembelajaran yang esensial.**
      DILARANG membuat terlalu banyak TP agar tidak memberatkan "tagihan nilai" (asesmen) di rapor. Fokuslah pada kompetensi utama yang ingin dicapai dalam seluruh rangkaian pertemuan ini.
      **WAJIB MENGGUNAKAN FORMULA A-B-C-D (Audience, Behavior, Condition, Degree)**
      Setiap poin tujuan pembelajaran HARUS memuat 4 unsur ini secara eksplisit namun mengalir.
      
      **INSTRUKSI VARIASI KALIMAT (PENTING: JANGAN TULIS LABEL HURUFNYA):** 
      Gunakan variasi kalimat di bawah ini, tapi **JANGAN** menampilkan tanda (A), (B), (C), atau (D) di hasil akhir. Biarkan mengalir sebagai kalimat narasi yang utuh.

      - **Variasi 1 (Format C-A-B-D):** "Melalui diskusi kelompok, peserta didik mampu menganalisis penyebab banjir dengan kritis."
      - **Variasi 2 (Format A-B-C-D):** "Peserta didik dapat menyusun laporan melalui observasi lapangan secara sistematis."
      - **Variasi 3 (Format A-B-D-C):** "Peserta didik mampu mendemonstrasikan gerakan tari dengan luwes setelah mengamati video contoh."

      **Pastikan 4 unsur (A, B, C, D) selalu ada dalam kalimat, namun TERSEMBUNYI (implisit).**

      **JANGAN GUNAKAN FORMAT INI (SALAH):**
      *❌ "Menyimpulkan sifat-sifat magnet." (Tidak ada Condition, Audience, dan Degree)*

      **3. Kesiapan Peserta Didik:**
      ${data.studentCharacteristics
        ? `(PENTING: Gunakan data manual ini sebagai basis utama: "${data.studentCharacteristics}". Rangkai kata-kata tersebut menjadi narasi yang profesional tentang kesiapan peserta didik. Anda WAJIB menyesuaikan seluruh strategi, level tantangan, dan langkah pembelajaran di RPP ini agar selaras dengan kondisi peserta didik tersebut.)`
        : `(Analisis secara otomatis pengetahuan awal, minat, latar belakang, dan motivasi peserta didik terkait materi ini sesuai dengan jenjang kelas dan mata pelajarannya).`
      }

      **4. Karakteristik Materi:**
      (Jenis pengetahuan, relevansi dengan kehidupan, struktur materi, serta integrasi nilai & karakter).

      **5. Dimensi Profil Lulusan (8 Dimensi):**
      Tuliskan Dimensi Profil Lulusan yang relevan dan **BERIKAN DESKRIPSI DETAIL** bagaimana dimensi tersebut diwujudkan dalam aktivitas pembelajaran ini.
      
      ${data.profilLulusan ? `
      **WAJIB GUNAKAN DIMENSI INI (SESUAI PERENCANAAN):**
      ${data.profilLulusan}
      
      (Instruksi: Jelaskan penerapan konkret untuk setiap dimensi di atas dalam konteks materi ${data.materi}).
      ` : `
      Pilihlah minimal 1, maksimal 3 dimensi yang paling relevan dari standar berikut dan jelaskan penerapannya:
      - **Keimanan & Ketakwaan**: (Contoh: Menumbuhkan rasa syukur, integritas akademik, atau etika).
      - **Kewargaan**: (Contoh: Memahami peran sebagai warga negara atau nilai Pancasila).
      - **Penalaran Kritis**: (Contoh: Menganalisis masalah, mengevaluasi data, atau berpikir logis).
      - **Kreativitas**: (Contoh: Membuat karya orisinal, mencari solusi alternatif, atau berinovasi).
      - **Kolaborasi**: (Contoh: Kerja kelompok, diskusi aktif, atau gotong royong).
      - **Kemandirian**: (Contoh: Inisiatif belajar, manajemen waktu, atau kemandirian berpikir).
      - **Kesehatan**: (Contoh: Menjaga well-being, keseimbangan diri, atau kesehatan fisik).
      - **Komunikasi**: (Contoh: Menyampaikan ide secara efektif atau membangun relasi).
      `}
      
      **FORMAT OUTPUT PROFIL LULUSAN:**
      - [Nama Dimensi]: [Penjelasan mendetail mengenai bagaimana peserta didik melatih dimensi ini melalui aktivitas spesifik di RPP ini].

      
      ## II. LANGKAH-LANGKAH PEMBELAJARAN
      **PENTING - ALOKASI WAKTU:**
      Durasi total menit wajib dicantumkan dalam tabel Identifikasi. Standar Durasi:
${Object.entries(BSKAP_DATA.standards.duration_per_jp || {}).map(([lvl, min]) => `      - ${lvl}: 1 JP = ${min} Menit`).join('\n')}
      
      HITUNGLAH durasi total menit dengan mengalikan total JP (${data.jp}) sesuai jenjang Kelas ${data.gradeLevel}.

      **STRUKTUR PER PERTEMUAN:**
      Setiap pertemuan **WAJIB** memiliki rincian durasi yang jika dijumlahkan HASILNYA HARUS SAMA dengan alokasi JP per pertemuan tersebut.

      ${data.distribution && data.distribution.length > 1
        ? `Materi ini telah dialokasikan dalam Progam Semester (Promes) menjadi **${data.distribution.length} pertemuan** dengan rincian JP per pertemuan: [${data.distribution.join(', ')}]. Anda WAJIB menyusun langkah pembelajaran sesuai dengan jumlah pertemuan dan alokasi JP tersebut.`
        : `Materi ini disusun untuk **1 pertemuan** dengan total ${data.jp} JP.`}

      **PRINSIP UTAMA - DEEP LEARNING & DIFERENSIASI:**
      Setiap fase pembelajaran (Pendahuluan, Inti, Penutup) HARUS mengintegrasikan ketiga prinsip Deep Learning:
      - **Mindful (Berkesadaran)**: Peserta didik hadir secara utuh, sadar akan tujuan belajarnya.
      - **Meaningful (Bermakna)**: Materi memiliki relevansi dunia nyata dan kedalaman pemahaman.
      - **Joyful (Menggembirakan)**: Suasana positif yang menumbuhkan rasa ingin tahu.

      **STRATEGI DIFERENSIASI (WAJIB TERAPKAN):**
${(BSKAP_DATA.pedagogis.differentiation_strategies || []).map(s => `      - **${s.aspect}**: ${s.method}`).join('\n')}
      Uraikan secara spesifik dalam langkah pembelajaran bagaimana Anda melakukan diferensiasi ini untuk melayani keberagaman peserta didik.

      Setiap pertemuan **WAJIB** memiliki struktur lengkap berikut:

      **ALOKASI PERTEMUAN (WAJIB IKUTI PROMES):**
      ${data.distribution && data.distribution.length > 0
        ? `Berdasarkan data Program Semester (Promes), materi ini telah dijadwalkan untuk **${data.distribution.length} KALI PERTEMUAN**. Anda **WAJIB** membuat rincian untuk **${data.distribution.length} pertemuan** tersebut. Jangan kurang, jangan lebih.`
        : `Jika materi ini sangat luas dan JP mencukupi, Anda boleh membaginya menjadi maksimal 2 pertemuan. Jika tidak, cukup 1 pertemuan.`}
      
      ### PERTEMUAN [X] (Topik Spesifik: ...)
      *(Catatan: Anda WAJIB mengulangi struktur di bawah ini untuk SETIAP pertemuan yang dijadwalkan)*
      
      **1. Pendahuluan (Mindful Connection) - [10 menit]:**
      *   **Ritual Pembuka (Mindful):** Salam pembuka, **Berdoa bersama**, **Presensi/Mengabsen peserta didik**, dan Menanyakan Kabar untuk membangun koneksi awal yang hangat, rasa syukur, and kesadaran penuh.
      *   **Apersepsi (Meaningful):** Hubungkan materi baru dengan pengalaman atau pengetahuan siswa yang relevan dengan kehidupan nyata mereka.
      *   **Motivasi & Tujuan (Mindful + Joyful):** Sampaikan tujuan pembelajaran dengan cara yang memotivasi and membuat siswa antusias. Jelaskan MENGAPA materi ini penting untuk mereka.
      *   **Pemantik (Hook - Joyful):** Berikan pemicu rasa ingin tahu seperti video menarik, pertanyaan tantangan, cerita pendek, atau fenomena mengejutkan yang membuat siswa excited untuk belajar.

      **2. Kegiatan Inti (Penerapan Model & Deep Learning):**
      
      *PENTING (MODEL PEMBELAJARAN):* 
      - Jika input Model Pembelajaran adalah "Otomatis", Anda **WAJIB MEMILIH** dari standar preferred_models: ${JSON.stringify((BSKAP_DATA.pedagogis.preferred_models || []).map(m => m.name))}.
      - **DILARANG KERAS** menggunakan istilah di luar standar tersebut atau menulis kata "Otomatis". Gunakan sintaks spesifik sebagaimana didefinisikan dalam pedagogis operasional.
      
      **INSTRUKSI SANGAT PENTING (NARATIF & MENDALAM):** 
      - Bagian kegiatan inti per pertemuan harus **TEBAL, NARATIF, and MENDETAIL**. 
      - **KERANGKA PROGRESIVITAS (WAJIB UNTUK 2+ PERTEMUAN):**
        - **Pertemuan 1 (Fondasi)**: Fokus pada pengenalan konsep, pemahaman dasar, dan koneksi awal (Conceptual).
        - **Pertemuan 2 (Aplikasi/Praktik)**: Fokus pada prosedur, eksperimen, latihan terbimbing, atau pengembangan keterampilan (Procedural).
        - **Pertemuan 3+ (Ekspansi/Evaluasi)**: Fokus pada proyek kompleks, pemecahan masalah nyata, presentasi karya, atau asesmen sumatif (Creative/Evaluation).
      - Anda **WAJIB** memastikan setiap pertemuan memiliki sub-topik yang spesifik dan aktivitas yang **BERBEDA** secara signifikan. Jangan mengulang aktivitas yang sama di pertemuan yang berbeda.
      - Uraikan langkah pembelajaran menjadi skenario nyata langkah-per-langkah (step-by-step).
      - Bedakan jelas aktivitas **GURU** and aktivitas **PESERTA DIDIK**.
      - Pastikan urutannya logis sesuai sintaks model pembelajaran.

      Jalin sintaks/tahapan model tersebut secara harmonis ke dalam 3 level Deep Learning berikut untuk setiap pertemuan:
      
      *   **Memahami (Understanding - Mindful + Meaningful):** 
          - Tuliskan langkah-langkah fase awal model (seperti Orientasi pada masalah, Pemberian Stimulus, atau Identifikasi Masalah).
          - **Contoh Detail:** "Guru menampilkan slide berisi gambar pencemaran lingkungan. Peserta didik secara bergiliran memberikan pendapat satu kata tentang gambar tersebut. Guru mencatat kata kunci di papan tulis."
          - Sertakan estimasi waktu untuk setiap langkah, misal: "Orientasi Masalah [15 menit]".
          
      *   **Mengaplikasi (Applying - Meaningful + Joyful) - (BAGIAN TERPANJANG):** 
          - Tuliskan langkah-langkah fase aksi model (seperti Penyelidikan Mandiri/Kelompok, Pengumpulan Data, atau Pembuatan Produk/Karya).
          - **Wajib Detil:** Jelaskan bagaimana pembagian kelompok dilakukan, apa instruksi spesifik LKPD, bagaimana guru memonitor, and bagaimana siswa berkolaborasi.
          - Sertakan estimasi waktu untuk setiap langkah, misal: "Penyelidikan Kelompok [40 menit]".
          - Aktivitas harus menantang (Joyful) and memiliki dampak nyata (Meaningful).
          
      *   **Merefleksi (Reflecting - Mindful + Meaningful):** 
          - Tuliskan langkah-langkah fase akhir model (seperti Pembuktian, Presentasi hasil, atau Menarik Kesimpulan).
          - Jelaskan mekanisme presentasi (misal: "Gallery Walk" atau "Presentasi Panel").
          - Sertakan estimasi waktu untuk setiap langkah, misal: "Presentasi Hasil [15 menit]".

      **3. Penutup (Creative Closure - Mindful + Meaningful + Joyful) - [10 menit]:**
      *   **Rangkuman & Refleksi (Mindful + Meaningful):** Siswa and guru merangkum pembelajaran and melakukan refleksi mendalam tentang makna pembelajaran hari ini.
      *   **Apresiasi & Motivasi (Joyful):** Berikan apresiasi positif atas partisipasi siswa and motivasi untuk terus belajar.
      *   **Preview:** Berikan gambaran menarik tentang materi pertemuan berikutnya.
      *   **Ritual Penutup (Mindful):** WAJIB diakhiri dengan **Doa Syukur** and **Salam Penutup** sebagai tanda syukur atas kelancaran proses belajar.

      **4. Integrasi 6C & Deep Learning (PRINSIP HUTANG BAYAR):**
      - **PRINSIP HUTANG BAYAR**: Setiap Dimensi Profil Lulusan yang Anda pilih di Bagian I **WAJIB** memiliki aktivitas nyata di langkah-langkah pembelajaran ini. DILARANG mencantumkan Dimensi yang tidak diajarkan.
      - Pastikan seluruh langkah di pertemuan ini secara eksplisit mengintegrasikan: Character, Citizenship, Collaboration, Communication, Creativity, Critical Thinking.
      - **CEK KONSISTENSI TP**: Setiap Tujuan Pembelajaran (TP) yang Anda tulis di atas **HARUS** memiliki aktivitas nyata di langkah-langkah ini. Jangan ada TP yang "terlupakan" atau tidak diajarkan.


      **CATATAN PENTING TENTANG KEDALAMAN KONTEN (TARGET: 7-12 HALAMAN):**
      - **TARGET HALAMAN (STRICT - JANGAN IMPROVISASI):**
        - **1 Pertemuan:** Target ~7-9 Halaman.
        - **2+ Pertemuan:** Target ~9-12 Halaman (Maksimal).
      - **TARGET TOTAL DOKUMEN:** Jaga kedalaman materi and langkah pembelajaran agar tetap padat and berisi tanpa berlebihan.
      - **EFISIENSI:** Meskipun jumlah pertemuan bertambah, pastikan narasi tetap fokus, efisien, and tidak bertele-tele. Hindari pengulangan yang tidak perlu.
      - **FOKUS PADA KUALITAS NARASI:**
        - Setiap langkah pembelajaran harus **DETAIL** (minimal 1 paragraf utuh per langkah).
        - Tetap tuliskan skenario/dialog guru-siswa, tapi pastikan **EFISIEN** and tidak bertele-tele.
        - Hindari pengulangan kata yang tidak perlu.
      - **Pastikan Lampiran (LKPD & Instrumen Penilaian) tetap lengkap.**
      
      ## III. MEDIA BELAJAR
      (Sebutkan secara spesifik media yang akan digunakan: nama video/platform, jenis infografis, alat peraga konkret, dll. Jangan hanya menulis "video interaktif" tapi sebutkan topik/judulnya).

      ## IV. LAMPIRAN
      
      ### 1. LKPD (LEMBAR KERJA PESERTA DIDIK)
      
      **LKPD - ${data.materi} (KONSISTENSI TP)**
      **PENTING UNTUK AI:** Soal-soal di bawah ini **HARUS** merupakan turunan langsung dari Tujuan Pembelajaran (TP). Setiap aktivitas LKPD adalah sarana latihan untuk mencapai TP.

      
      ---
      
      **Identitas Peserta Didik:**
      | Komponen | Keterangan |
      | :--- | :--- |
      | Nama | : _________________________________ |
      | Kelas | : _________________________________ |
      | Tanggal | : _________________________________ |
      
      **Tujuan Pembelajaran:**
      (Tuliskan maksimal 3 tujuan pembelajaran yang akan dicapai peserta didik melalui LKPD ini, harus konsisten dengan bagian I di atas, menggunakan bahasa yang mudah dipahami peserta didik).
      
      **Petunjuk Penggunaan:**
      1. Bacalah setiap instruksi dengan cermat sebelum mengerjakan.
      2. Kerjakan secara mandiri atau berkelompok sesuai arahan guru.
      3. Tuliskan jawaban dengan jelas dan lengkap.
      4. Tanyakan kepada guru jika ada yang kurang jelas.
      
      ---
      
      **KEGIATAN 1: MENGAMATI & MEMAHAMI**
      (Berikan stimulus berupa gambar, teks pendek, video, atau fenomena yang relevan dengan materi. Ajukan 3-4 pertanyaan pemantik yang mendorong peserta didik untuk mengamati and memahami konsep dasar).
      
      **Ruang Jawaban:**
      
      ___________________________________________________________________________
      ___________________________________________________________________________
      ___________________________________________________________________________
      
      ---
      
      **KEGIATAN 2: MENGANALISIS & BERDISKUSI**
      (Berikan kasus, masalah, atau data yang perlu dianalisis peserta didik. Ajukan pertanyaan yang mendorong berpikir kritis and diskusi kelompok).
      
      **Ruang Jawaban:**
      
      ___________________________________________________________________________
      ___________________________________________________________________________
      ___________________________________________________________________________
      
      ---
      
      **KEGIATAN 3: MENCOBA & BERKREASI**
      (Berikan tugas praktik, eksperimen sederhana, atau proyek kreatif yang memungkinkan peserta didik menerapkan pemahaman mereka).
      
      **Ruang Jawaban/Hasil Karya:**
      
      ___________________________________________________________________________
      ___________________________________________________________________________
      ___________________________________________________________________________
      
      ---
      
      **REFLEKSI PEMBELAJARAN & PENILAIAN DIRI**
      
      1. Apa hal paling menarik yang kamu pelajari hari ini?
         ___________________________________________________________________________
      2. Apa yang masih sulit kamu pahami?
         ___________________________________________________________________________
      
      **Penilaian Diri:**
      | Aspek | Sudah Paham | Cukup Paham | Perlu Bimbingan |
      | :--- | :---: | :---: | :---: |
      | Saya memahami tujuan pembelajaran | ☐ | ☐ | ☐ |
      | Saya dapat menjelaskan konsep utama | ☐ | ☐ | ☐ |
      | Saya aktif dalam kegiatan | ☐ | ☐ | ☐ |
      
      ---

      ### 2. INSTRUMEN PENILAIAN (ASESMEN & KKTP)
      
      **A. ASESMEN DIAGNOSTIK (ASESMEN AWAL)**
      (Buatlah minimal 3-5 pertanyaan singkat atau aktivitas sederhana untuk memetakan kemampuan awal peserta didik terkait materi ini. Tujuannya untuk mengetahui kesiapan belajar).
      
      **B. KRITERIA KETERCAPAIAN TUJUAN PEMBELAJARAN (KKTP)**
      *Pendekatan yang digunakan: ${data.assessmentModel || 'Rubrik'}*
      
      > **Catatan:** Penentuan kriteria ketercapaian tujuan pembelajaran dalam modul ini merujuk pada standar penilaian dalam **Permendikbudristek No. 21 Th 2022** dan kompetensi pada **Keputusan Kepala BSKAP No. 046/H/KR/2025**.

      **ATURAN WAJIB KORELASI:** 
      Indikator/Kriteria di bawah ini **HARUS** merupakan turunan langsung dari **Tujuan Pembelajaran (TP)** yang Anda tulis di Bagian I. Jangan membuat indikator yang tidak ada di TP.

      ${data.assessmentModel === 'Deskripsi Kriteria' ? `
      **B.1. DESKRIPSI KRITERIA (Checklist)**
      Guru menetapkan kriteria ketuntasan yang spesifik. Peserta didik dianggap mencapai tujuan pembelajaran jika memenuhi minimal jumlah kriteria tertentu (misal 3 dari 4).

      | Kriteria (Indikator Ketercapaian) | Sudah Muncul (✔) | Belum Muncul (❌) |
      | :--- | :---: | :---: |
      | 1. [Indikator 1 - turunan TP] | | |
      | 2. [Indikator 2 - turunan TP] | | |
      | 3. [Indikator 3 - turunan TP] | | |
      | 4. [Indikator 4 - turunan TP] | | |
      | **Kesimpulan:** | Tuntas (jika ... kriteria muncul) / Belum Tuntas | |
      ` : data.assessmentModel === 'Interval Nilai' ? `
      **B.1. INTERVAL NILAI**
      Guru menggunakan rentang nilai untuk menentukan tindak lanjut.

      | Rentang Nilai | Keterangan & Tindak Lanjut |
      | :--- | :--- |
      | **0 - 40%** | **Belum Mencapai Ketuntasan (Remedial Seluruh Bagian)** <br> Siswa belum memahami konsep dasar and memerlukan bimbingan intensif dari awal. |
      | **41 - 65%** | **Belum Mencapai Ketuntasan (Remedial Bagian Tertentu)** <br> Siswa sudah memahami sebagian konsep namun masih kesulitan di bagian [Sebutkan bagian sulit]. Perlu remedial pada indikator yang belum tuntas. |
      | **66 - 85%** | **Sudah Mencapai Ketuntasan (Tidak Perlu Remedial)** <br> Siswa sudah menguasai materi dengan baik. Dapat diberikan latihan pemantapan. |
      | **86 - 100%** | **Sudah Mencapai Ketuntasan (Pengayaan)** <br> Siswa sangat mahir. Berikan tantangan lebih kompleks atau menjadi tutor sebaya. |
      ` : data.assessmentModel === 'Rubrik' ? `
      **B.1. RUBRIK PENILAIAN (LEVELING)**
      Guru menyusun tingkatan pencapaian untuk setiap indikator.

      | Aspek / Indikator | Baru Berkembang (1) | Layak (2) | Cakap (3) | Mahir (4) |
      | :--- | :--- | :--- | :--- | :--- |
      | **[Aspek 1 - e.g. Pemahaman]** | Belum mampu menjelaskan [konsep] secara mandiri. | Mampu menjelaskan konsep namun masih kurang tepat/lengkap. | Mampu menjelaskan konsep dengan benar and menggunakan bahasa sendiri. | Mampu menjelaskan konsep dengan sangat detail, logis, and memberikan contoh relevan. |
      | **[Aspek 2 - e.g. Keterampilan]** | Belum bisa menerapkan [prosedur]. | Bisa menerapkan prosedur tapi butuh bimbingan. | Bisa menerapkan prosedur dengan benar secara mandiri. | Bisa menerapkan prosedur dengan sangat lancar, efisien, and kreatif. |
      | **[Aspek 3 - e.g. Sikap]** | Kurang aktif dlm diskusi. | Cukup aktif tapi jarang berpendapat. | Aktif berdiskusi and menghargai pendapat teman. | Sangat aktif, menjadi inisiator diskusi, and memimpin kelompok dengan baik. |
      ` : `
      **B.1. PENDEKATAN KKTP (OTOMATIS PILIHAN AI)**
      *(Karena Anda memilih mode Otomatis, AI telah menentukan metode penilaian yang paling efektif untuk materi ini)*:

      **Pilihan Metode: [Sebutkan nama metode: Rubrik/Deskripsi/Interval]**

      [TULISKAN ISI PENILAIAN SECARA LENGKAP & SPESIFIK DI SINI. Jika memilih Rubrik, buat tabel rubrik minimal 3 aspek. Jika Deskripsi, buat checklist minimal 4 kriteria. Jika Interval, buat panduan tindak lanjut yang disesuaikan dengan materi ini].
      `}

      ---
      
      **C. ASESMEN FORMATIF & SUMATIF (INSTRUMEN)**
      **C.1. Asesmen Formatif (Selama Proses)**
      | Komponen | Teknik Penilaian | Instrumen |
      | :--- | :--- | :--- |
      | **Observasi 6C** | Pengamatan aktif | Lembar Observasi (Character, Citizenship, Collaboration, Communication, Creativity, Critical Thinking) |
      | **Refleksi Diri** | Self Assessment | Menilai pemahaman mandiri menggunakan kartu refleksi |
      | **Feedback** | Peer Feedback | Memberikan masukan konstruktif antar teman |

      **C.2. Asesmen Sumatif (Akhir Materi)**
      *(Sediakan minimal 2-3 contoh soal objektif atau instruksi tugas akhir yang mengukur Tujuan Pembelajaran secara utuh)*

      | Kriteria Ketuntasan | Perlu Bimbingan (1) | Cukup (2) | Baik (3) | Sangat Baik (4) |
      | :--- | :--- | :--- | :--- | :--- |
      | **Pemahaman Konten** | Mengalami miskonsepsi | Paham sebagian | Paham secara utuh | Paham & mampu mengembangkan |
      | **Aplikasi/Analisis** | Belum bisa menerapkan | Bisa menerapkan dengan bantuan | Bisa menerapkan mandiri | Bisa menganalisis & berinovasi |

      ### 3. MATERI AJAR MENDETAIL (KONSISTENSI TP)
      **WAJIB DIISI DENGAN KONTEN LENGKAP & RELEVAN!**
      - **CEK KONSISTENSI:** Pastikan materi yang ditulis di sini **MENJAWAB** seluruh Tujuan Pembelajaran (TP). Jika TP menuntut "Menganalisis", maka materi harus memberikan landasan teori untuk analisis tersebut.
      - Minimal 3-5 paragraf substantif yang mencakup konsep, teori, contoh konkret, and aplikasi nyata materi ini.

      ### 4. GLOSARIUM
      **WAJIB DIISI!** Daftar minimal 5-10 istilah penting and definisinya.
      - **[Istilah]**: Definisi...

      ### 5. DAFTAR PUSTAKA
      **WAJIB DIISI!** Minimal 3-5 referensi kredibel (Buku, Jurnal, Sumber Digital).

      &nbsp;
      &nbsp;



      ---
      **CATATAN PENTING UNTUK AI:**
      - **WAJIB** ada baris kosong setelah tag pembuka div and sebelum tag penutup div agar tabel Markdown tampil sempurna.
      - **JANGAN** ada baris kosong di antara baris tabel. Tabel harus rapat.
      - Gunakan bahasa Indonesia yang **Inspiratif, Profesional, and Terstruktur**.
      - Pastikan bagian **Materi Ajar Mendetail** benar-benar berisi konten akademis yang kuat.
      - **WAJIB** gunakan istilah **"Peserta Didik"** pengganti kata "Siswa" di seluruh dokumen.
      - **JANGAN** membuat bagian Tanda Tangan (Mengetahui Kepala Sekolah/Guru). Bagian ini akan ditambahkan otomatis oleh sistem.
      - **JANGAN** menggunakan placeholder seperti "NIP. ....................".
      - **PRINSIP HUTANG BAYAR (AUDIT KONSISTENSI)**: Periksa kembali hasil akhir Anda. Jika Anda mencantumkan "Penalaran Kritis" di Profil Lulusan, pastikan ada kegiatan diskusi atau analisis mendalam di langkah pembelajaran. Jika Anda mencantumkan "Kemampuan Komunikasi", pastikan ada kegiatan presentasi atau berbagi ide. RPP adalah janji yang harus "dibayar" dalam kegiatan nyata.

      - Output harus **langsung dalam format Markdown** tanpa komentar pembuka atau penutup dari asisten.
    `;

    return await retryWithBackoff(async () => {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    });
  } catch (error) {
    throw new Error(handleGeminiError(error, "generateLessonPlan"));
  }
};




/**
 * Generates a student-friendly Handout/Module using AI.
 * @param {Object} data - Input data for the handout.
 * @returns {Promise<string>} The generated markdown content.
 */
export const generateHandout = async (data) => {
  const model = getModel(data.modelName || 'gemini-3.1-flash-lite-preview');

  const prompt = `
    Anda adalah "Mesin Intelijen Kurikulum Nasional" yang bertugas menyusun **Bahan Ajar (Handout/Modul)** yang inovatif, mendalam, dan selaras dengan administrasi guru.
    
    **OFFICIAL KNOWLEDGE ENGINE (BSKAP_DATA):**
    - Regulasi Dasar: **${BSKAP_DATA.standards.regulation}**
    - Filosofi Operasional: **${BSKAP_DATA.standards.philosophy.name} (Mindful, Meaningful, Joyful)**
    - Standar Referensi Alat: **Kemendikdasmen**
    
    Tugas Anda: Susun Bahan Ajar (Handout) yang **OTORITATIF** dan **MENYENANGKAN** berdasarkan parameter ini:
    - Mapel: ${data.subject}
    - Jenjang/Kelas: ${data.gradeLevel}
    - Materi Pokok: ${data.materi}
    ${data.kd ? `- **KONSTRUKSI TP/KD**: ${data.kd}` : ''}
    ${data.elemen ? `- **ELEMEN KURIKULUM**: ${data.elemen}` : ''}
    - Guru: ${data.teacherTitle} ${data.teacherName}

    ${data.rppContent ? `
    **SINKRONISASI RPP (WAJIB)**:
    - Berikut adalah konten RPP yang telah disusun untuk materi ini:
    --- START RPP ---
    ${data.rppContent}
    --- END RPP ---
    - Anda **WAJIB** memastikan isi Handout ini selaras dengan langkah-langkah pembelajaran, media, dan istilah yang digunakan dalam RPP di atas. Handout adalah "pendamping" siswa saat menjalankan aktivitas di RPP tersebut.` : ''}

    ${getRegionalLanguage(data.subject) ? `
    **INSTRUKSI BAHASA DAERAH (${getRegionalLanguage(data.subject)})**:
    - Karena mata pelajaran ini adalah Bahasa Daerah, Anda **WAJIB** menggunakan **Bahasa ${getRegionalLanguage(data.subject)}** untuk seluruh isi materi edukasi, sapaan, dan tantangan dalam handout ini.
    - Gunakan tingkatan bahasa yang sesuai.
    ${(getRegionalLanguage(data.subject).toLowerCase().includes('jawa') || getRegionalLanguage(data.subject).toLowerCase().includes('madura')) ? `- Sertakan penggunaan **Aksara Hanacaraka (Aksara Jawa/Madura)** pada bagian yang relevan (misal: pengenalan aksara, kutipan, atau latihan membaca).` : ''}
    - Tetap gunakan Bahasa Indonesia HANYA untuk instruksi struktural.
    ` : ''}

    **PRINSIP DEEP LEARNING (WAJIB):**
    Bahan ajar ini harus dirancang agar peserta didik mengalami:
    1. **Mindful**: Pembuka yang membangun kesadaran dan kehadiran utuh.
    2. **Meaningful**: Konten yang menjelaskan "Mengapa ini penting?" bagi kehidupan nyata.
    3. **Joyful**: Bahasa yang memotivasi, inspiratif, dan tidak kaku.

    **STRUKTUR MODUL (WAJIB IKUTI FORMAT INI):**

    # 📘 MODUL BELAJAR: [JUDUL MATERI DI SINI]
    
    > "Belajar itu bukan tentang menjadi pintar, tapi tentang peka terhadap sekitarmu." - Si Pesek Pintar
    
    ---

    ## 🎯 TARGET BELAJAR KITA HARI INI
    Di akhir modul ini, kamu bakal jago dalam:
    - [Tujuan 1 bahasa siswa]
    - [Tujuan 2 bahasa siswa]
    - [Tujuan 3 bahasa siswa]
    
    ---

    ## 🗺️ PETA KONSEP (MIND MAP)
    (Gunakan format Mermaid Diagram tipe \`graph TD\`. Agar tampil **UNIK, MEWAH & RAPI (HINDARI TUMPANG TINDIH)**, ikuti aturan ini:
    1. Gunakan \`graph TD\`.
    2. Gunakan bentuk **Pill (Kapsul)**: \`ID(["Isi Teks"])\`.
    3. **UNIK & RAPI**: Gunakan \`subgraph\` HANYA untuk kelompok besar. Berikan jarak antar subgraph.
    4. **KOMPAK & BERSIH**: Jangan menumpuk subgraph di dalam subgraph. Buat alur mengalir dari ATAS ke BAWAH secara konsisten.
    
    Contoh Sintaks Mewah & Rapi:
    \`\`\`mermaid
    graph TD
      subgraph Utama ["🎯 Materi Pokok"]
        A(["📘 Topik Utama"])
      end
      
      subgraph Detail ["🔍 Pembahasan"]
        B(["💡 Konsep 1"])
        C(["🚀 Konsep 2"])
      end
      
      A --> B
      A --> C
      
      style A fill:#6366f1,stroke:#4338ca,color:#ffffff,stroke-width:4px
      style B fill:#f8fafc,stroke:#6366f1,color:#1e293b
      style C fill:#f8fafc,stroke:#6366f1,color:#1e293b
      style Utama fill:#f1f5f9,stroke:#e2e8f0,stroke-dasharray: 5 5
      style Detail fill:#ffffff,stroke:#e2e8f0
    \`\`\`
    PENTING: Pastikan tidak ada elemen yang saling menumpuk. Gunakan alur linier yang bersih).
    
    ---

    ## 🚀 APERSEPSI: TAHUKAH KAMU?
    (Berikan paragraf pembuka yang menarik. Bisa berupa fakta unik dunia nyata, sejarah singkat penemuan, atau fenomena sehari-hari yang *relate* dengan materi ini. Tujuannya agar siswa berkata "Wah, ternyata ini berguna ya!". Panjang minimal 1 paragraf).

    ---

    ## 📚 MATERI INTI (DAGINGNYA!)
    *(Bagian ini harus menjadi bagian TERPANJANG. Jangan hanya poin-poin. Jelaskan konsep selengkap-lengkapnya layaknya Anda mengajar di depan kelas).*
    
    ### 1. [Sub-Bab 1]
    - **Definisi dan Konsep:** Jelaskan definisi dengan bahasa buku KEMUDIAN jelaskan ulang dengan bahasa sederhana/analogis.
    - **Penjelasan Mendalam:** Uraikan konsepnya secara naratif. Bagaimana cara kerjanya? Mengapa itu terjadi?
    - **Contoh Nyata:** Berikan minimal 2 contoh penerapan di kehidupan nyata yang *relatable*.
    - **Analogi:** "Bayangkan materi ini seperti [Benda Sehari-hari]..."

    ### 2. [Sub-Bab 2]
    - (Uraikan detail seperti di atas. Sertakan tabel perbandingan jika ada dua konsep yang mirip).
    - Gunakan **Bold** untuk istilah penting.
    - Sertakan Rumus/Dalil jika pelajaran eksakta, lalu bedah rumusnya satu per satu variabelnya.

    ### 3. [Sub-Bab 3 dst...]
    
    > **💡 TIPS JITU:**
    > (Masukkan tips cara memahami konsep ini dengan mudah atau "cheat sheet" cerdas).

    ### 🔦 STUDI KASUS / POJOK LITERASI
    (Tambahkan satu cerita pendek atau kasus nyata yang berkaitan dengan materi untuk meningkatkan literasi siswa).

    ---

    ## 🧪 CONTOH SOAL & BEDAH JAWABAN (WAJIB)
    *(Berikan minimal 2 contoh soal dengan tingkat kesulitan berbeda: Mudah & Sedang).*

    **Contoh 1:**
    [Soal]
    **Bedah Jawaban:**
    1.  **Analisis:** Apa yang diketahui? Apa yang ditanya?
    2.  **Strategi:** Rumus/Konsep apa yang dipakai?
    3.  **Eksekusi:** [Langkah pengerjaan detail]
    **Kesimpulan:** Jadi jawabannya adalah...

    **Contoh 2:**
    [Soal]
    **Bedah Jawaban:**
    [Langkah pengerjaan detail]

    ---

    ## 📝 TANTANGAN MINIMU (LATIHAN) - WAJIB MUNCUL
    *(Berikan tepat 5 soal latihan bervariasi).*
    1. [Soal C1 - Pemahaman Dasar]
    2. [Soal C2 - Penerapan]
    3. [Soal C4 - Analisis (HOTS)]
    4. [Soal C5 - Evaluasi/Kreativitas]
    5. [Soal Refleksi Diri]

    ---

    ## 📖 KAMUS MINI (GLOSARIUM) - WAJIB MUNCUL
    *(Berikan minimal 5-10 istilah penting yang muncul dalam materi).*
    - **[Istilah]**: [Penjelasan singkat dan jelas]
    - **[Istilah]**: [Penjelasan singkat dan jelas]
    - (Lanjutkan hingga minimal 5 istilah)
    
    ---
    *Disusun dengan semangat belajar oleh ${data.teacherTitle} ${data.teacherName}*
    
    **SIKAP KERJA & VERIFIKASI AKHIR (WAJIB):**
    1. **KOMPLITNYA STRUKTUR**: Jangan berhenti sebelum bagian "KAMUS MINI" selesai ditulis. Jika materi inti terlalu panjang, ringkas sedikit agar semua bagian (Apersepsi hingga Kamus Mini) MUNCUL UTUH.
    2. **KEDALAMAN MATERI**: Penjelasan harus mengalir (narrative) dan sangat mendetail.
    3. **AKURASI**: Patuh pada CP BSKAP No. 046/H/KR/2025 dan buku resmi Kemendikdasmen.
    4. **FORMAT**: Langsung format Markdown tanpa komentar basa-basi.
  `;

  try {
    return await retryWithBackoff(async () => {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    });
  } catch (error) {
    throw new Error(handleGeminiError(error, "generateHandout"));
  }
};

export async function generateDailyBriefing(contextData, modelName) {
  const { teacherName, date, schedules, tasks, missingJournalsCount } = contextData;

  const scheduleSummary = schedules.length > 0
    ? schedules.map(s => `${s.subject} di kelas ${s.class} pukul ${s.startTime}`).join(', ')
    : "Tidak ada jadwal mengajar hari ini.";

  const taskSummary = tasks.length > 0
    ? `Ada ${tasks.length} tugas siswa yang perlu diperiksa.`
    : "Tidak ada tugas mendesak yang perlu diperiksa.";

  const journalWarning = missingJournalsCount > 0
    ? `Peringatan, ada ${missingJournalsCount} jurnal mengajar yang belum diisi dalam seminggu terakhir. Mohon segera dilengkapi.`
    : "Administrasi jurnal Anda sudah lengkap impian.";

  const prompt = `
    Anda adalah asisten pribadi guru yang cerdas, hangat, dan sangat suportif bernama "Smarty".
    Buatlah naskah briefing pagi yang sangat natural, mengalir, dan tidak kaku (seperti asisten manusia yang sedang berbicara langsung).
    
    Data Guru:
    - Nama: ${teacherName}
    - Sekolah: ${contextData.schoolName || 'Sekolah'}
    - Mata Pelajaran Utama: ${contextData.mainSubject || 'Umum'}
    - Tanggal: ${date}
    - Jadwal Hari Ini: ${scheduleSummary}
    - Status Tugas: ${taskSummary}
    - Status Jurnal: ${journalWarning}

    Prinsip Penulisan (Script Writing):
    1. **Sapaan Hangat**: Awali dengan menyapa "${teacherName}" dengan nada ceria.
    2. **Alur Alami**: Gunakan kata penghubung alami seperti "Nah", "Oh iya", "Untuk hari ini", atau "Terus".
    3. **Artikulasi TTS**: Gunakan tanda koma (,) dan titik (.) secara strategis untuk memberikan jeda nafas bagi mesin suara. Gunakan huruf kapital di awal kalimat agar intonasi lebih tegas.
    4. **Informatif & Proaktif**: Jangan hanya baca data. Jika ada jadwal, beri semangat spesifik. Jika ada jurnal bolong, sampaikan dengan nada mengingatkan yang sopan tapi penting.
    5. **Struktur**:
       - Pembukaan: Sapaan + Ucapan selamat pagi + Tanggal.
       - Isi: Rangkuman jadwal yang paling penting + Update tugas/jurnal.
       - Penutup: Berikan satu "Pesan Motivasi" atau "Tips Singkat" yang relevan dengan kesibukan hari ini.
    
    ATURAN KETAT:
    - JANGAN gunakan format markdown, bullet points, atau simbol aneh.
    - Maksimal 5 kalimat padat dan bermakna.
    - Hindari kata-kata yang terlalu formal/kaku seperti "Demikian briefing hari ini".
    - Gunakan Bahasa Indonesia yang sangat akrab tapi tetap sopan.
  `;

  try {
    const model = getModel(modelName);
    const result = await retryWithBackoff(() => model.generateContent(prompt));
    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    console.error("Error generating daily briefing:", error);
    return `Selamat pagi Bpk/Ibu ${teacherName}. Hari ini tanggal ${date}. ${schedules.length > 0 ? `Anda memiliki ${schedules.length} jadwal mengajar.` : 'Anda tidak memiliki jadwal mengajar hari ini.'} Tetap semangat dan selamat beraktivitas!`;
  }
}
/**
 * Generates an automatic narrative summary for a student's portfolio.
 * @param {Object} data - Student data including grades, attendance, and infractions.
 * @param {Object} userProfile - The teacher's profile.
 * @param {string} modelName - The Gemini model to use.
 * @returns {Promise<string>} The generated narrative.
 */
export async function generateStudentNarrative(data, userProfile, modelName) {
  const { studentName, grades, attendance, infractions, stats } = data;

  // Create a fingerprint of the data to avoid redundant API calls
  const currentInputString = JSON.stringify({
    studentName,
    grades: grades.map(g => ({ date: g.date, score: g.score })),
    attendance: stats.attendance,
    infractions: infractions.map(i => ({ date: i.date, type: i.infractionType })),
    stats: { academicAvg: stats.academicAvg, attitudeScore: stats.attitudeScore }
  });

  if (currentInputString === lastNarrativeInputString && lastNarrativeResultCache !== null) {
    console.log(`Returning cached narrative for ${studentName}.`);
    return lastNarrativeResultCache;
  }

  const prompt = `
    Anda adalah seorang asisten guru yang ahli dalam memberikan umpan balik edukatif yang konstruktif dan memotivasi.
    Tugas Anda adalah membuat narasi laporan perkembangan (Catatan Wali Murid/Guru) untuk peserta didik berikut:
    
    Data Peserta Didik:
    - Nama: ${studentName}
    - Rata-rata Akademik: ${stats.academicAvg} (dari ${grades.length} penilaian)
    - Nilai Sikap: ${stats.attitudeScore} (${stats.attitudePredicate})
    - Kehadiran: Hadir ${stats.attendance.Hadir} hari, Sakit ${stats.attendance.Sakit}, Ijin ${stats.attendance.Ijin}, Alpha ${stats.attendance.Alpha}
    
    Detail Catatan Pelanggaran (Jika ada):
    ${infractions.length > 0 ? infractions.map(i => `- ${i.date}: ${i.infractionType} (${i.description || 'Tanpa keterangan'})`).join('\n') : 'Tidak ada catatan pelanggaran (Sikap Sangat Baik).'}

    Instruksi:
    - Gunakan Bahasa Indonesia yang formal namun hangat dan memotivasi.
    - Sebutkan nama peserta didik dengan ramah.
    - Berikan ulasan singkat yang mencakup aspek akademik, sikap, dan kehadiran dalam SATU PARAGRAF SAJA.
    - Fokus pada poin paling penting dan berikan pesan motivasi yang kuat.
    - Batasi narasi dalam MAKSIMAL 60-80 KATA.
    - JANGAN gunakan format markdown seperti bold atau bullet points di dalam teks narasi, tulis sebagai teks mengalir biasa.
  `;

  try {
    const model = getModel(modelName);
    const result = await retryWithBackoff(() => model.generateContent(prompt));
    const response = await result.response;
    const text = response.text().trim();

    // Update Cache
    lastNarrativeInputString = currentInputString;
    lastNarrativeResultCache = text;

    return text;
  } catch (error) {
    console.error("Error generating student narrative:", error);
    lastNarrativeInputString = null;
    lastNarrativeResultCache = null;
    return handleGeminiError(error, "generateStudentNarrative");
  }
}

/**
 * Generates a professional WhatsApp message for parents based on student performance.
 * @param {Object} data - Student data and narrative.
 * @param {string} modelName - The Gemini model to use.
 * @returns {Promise<string>} The generated message.
 */
export async function generateParentMessage(data, modelName) {
  const { studentName, narrativeNote, stats, teacherName } = data;

  const prompt = `
    Anda adalah seorang guru yang sangat profesional, ramah, dan empatik.
    Tugas Anda adalah merangkum perkembangan peserta didik bernama ${studentName} menjadi pesan WhatsApp yang sopan untuk orang tua.

    Data Pendukung:
    - Rata-rata Akademik: ${stats.academicAvg}
    - Nilai Sikap: ${stats.attitudeScore} (${stats.attitudePredicate})
    - Kehadiran: Hadir ${stats.attendance.Hadir}, Sakit ${stats.attendance.Sakit}, Ijin ${stats.attendance.Ijin}, Alpha ${stats.attendance.Alpha}
    - Narasi Perkembangan: ${narrativeNote}
    - Nama Guru: ${teacherName}

    Aturan Penulisan Pesan:
    1. Mulailah dengan salam pembuka yang hangat (contoh: Assalamualaikum Wr. Wb. / Selamat pagi Bapak/Ibu...).
    2. Isi pesan harus merangkum pencapaian akademik dan sikap.
    3. Jika ada nilai yang kurang atau banyak absen Alpha, sampaikan dengan bahasa yang suportif dan mengajak kerjasama, bukan menghakimi.
    4. Sampaikan pesan motivasi di akhir.
    5. Gunakan bahasa Indonesia yang santun namun tetap komunikatif (tidak kaku seperti robot).
    6. Maksimal 3-4 paragraf pendek.
    7. Berikan "space" untuk tanda tangan guru di akhir.
    
    TULIS HANYA ISI PESANNYA SAJA.
  `;

  try {
    const model = getModel(modelName);
    const result = await retryWithBackoff(() => model.generateContent(prompt));
    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    console.error("Error generating parent message:", error);
    return handleGeminiError(error, "generateParentMessage");
  }
}

/**
 * Generates a Student Worksheet (LKPD - Lembar Kerja Peserta Didik) based on an existing RPP.
 * @param {string} rppContent - The full Markdown content of the RPP.
 * @param {string} assessmentModel - The KKTP Assessment Model (Rubrik, Interval, etc.)
 * @param {string} modelName - The Gemini model to use.
 * @param {Array<string>} [studentNames] - Optional list of student names to include in the grading table.
 * @returns {Promise<string>} The generated LKPD content in Markdown.
 */
export async function generateLKPDFromRPP(rppContent, assessmentModel = 'Rubrik', modelName, studentNames = []) {
  const studentListText = studentNames.length > 0
    ? `Berikut adalah daftar nama peserta didik yang HARUS dimasukkan ke dalam tabel penilaian: \n${studentNames.join(', ')}`
    : 'Buatlah satu baris kosong (...................) untuk nama peserta didik.';

  const prompt = `
    Anda adalah "Mesin Intelijen Kurikulum Nasional" spesialis penyusunan **Lembar Kerja Peserta Didik (LKPD)** yang presisi.
    
    **OFFICIAL KNOWLEDGE ENGINE (BSKAP_DATA):**
    - Regulasi Dasar: **${BSKAP_DATA.standards.regulation}**
    - Filosofi Operasional: **${BSKAP_DATA.standards.philosophy.name}**
    - Standar Asesmen: Metode **${assessmentModel}** (Logika: ${BSKAP_DATA.kktp_standards.methods.find(m => m.type === assessmentModel)?.logic || 'Rubrikasi'})
    
    Tugas Anda: Turunkan materi dari RPP terlampir menjadi LKPD yang **OTORITATIF** dan **BERDIFERENSIASI**.
    
    **DATA RPP SUMBER:**
    ${rppContent.substring(0, 15000)}

    **DAFTAR PESERTA DIDIK:**
    ${studentListText}

    **ATURAN MAIN (WAJIB):**
    1. **SOURCE OF TRUTH**: DILARANG keras menambah materi di luar RPP kecuali untuk stimulus yang relevan.
    2. **TERMINOLOGI**: Gunakan istilah "Peserta Didik", bukan "Siswa".
    3. **GAMIFIKASI & PERAN:** Mulailah dengan **PENGANTAR YANG MENARIK**. Ajak peserta didik bermain peran (Role Playing).
       - Contoh: "Selamat datang Detektif Sains!", "Kalian adalah Insinyur Muda...", "Misi rahasia hari ini..."
       - Gunakan bahasa yang "Seru" dan "Menantang" sesuai usia siswa. 
    2. **AKTIVITAS BERBASIS TABEL & KASUS:**
       - JANGAN hanya memberikan soal tanya-jawab biasa.
       - Sajikan **KASUS NYATA** atau **DATA** untuk dianalisis.
       - Gunakan **TABEL KOSONG** untuk ruang jawab siswa agar terstruktur.
       - *Contoh:* Tabel pengamatan, Tabel analisis sebab-akibat, atau Tabel identifikasi ciri-ciri.
    3. **KONEKSI KE KEHIDUPAN NYATA:**
       - Materi harus dikaitkan dengan masalah sehari-hari yang relevan dengan siswa.
    4. **STRUKTUR RUANG JAWAB:**
       - Sediakan tempat titik-titik (...................) atau kotak kosong yang cukup untuk siswa menulis.
    5. **EKSPLISIT:**
       - Turunkan aktivitas langsung dari Tujuan Pembelajaran di RPP.

    **PENTING: FORMAT PENILAIAN / KKTP (Tabel Utuh):**
    Di bagian paling akhir LKPD, Anda WAJIB menyertakan **TABEL UTAMA ASESMEN KKTP**.
    1. Berikan penjelasan singkat tentang kriteria penilaian yang diambil dari RPP.
    2. Buatlah **Tabel Penilaian Lengkap** dengan format Markdown.
    3. Tabel HARUS memuat kolom: **No**, **Nama Peserta Didik**, dan **Kriteria Penilaian** (turunkan minimal 2 kriteria spesifik dari RPP, misal: Ketajaman Analisis, Kreativitas Produk, Keaktifan, dll), serta kolom **Nilai Akhir**.
    4. Jika daftar nama peserta didik diberikan di atas, masukkan SEMUA nama tersebut ke dalam baris tabel secara urut.
    5. Gunakan format model KKTP: **${assessmentModel}** (Jika Rubrik, jelaskan deskripsi per levelnya di bawah tabel).

    Gunakan bahasa yang memotivasi siswa ("Yuk kita coba...", "Tantangan Keren!").
    
    **CONSTRAINT:**
    - Output harus **LANGSUNG START** dari Judul LKPD (Markdown).
    - **JANGAN** ada kalimat pembuka seperti "Berikut adalah LKPD..." atau "Tentu, ini hasil...".
  `;

  try {
    const model = getModel(modelName);
    const result = await retryWithBackoff(() => model.generateContent(prompt));
    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    return handleGeminiError(error, "generateLKPDFromRPP");
  }
}

/**
 * Generates an ATP (Alur Tujuan Pembelajaran) structure from CP.
 * @param {Object} data - { subject, gradeLevel, semester, academicYear, effectiveWeeks, totalJP, modelName, userProfile, existingRPPs }
 * @returns {Promise<Array>} JSON Array of TPs
 */
export async function generateATP(data) {
  const modelName = data.modelName;
  const userProfile = data.userProfile;
  const semester = data.semester;
  const subject = data.subject;
  const onProgress = data.onProgress || (() => { }); // Progress callback

  const level = getLevel(data.gradeLevel);
  const levelData = BSKAP_DATA.subjects[level];
  const gradeData = levelData?.[data.gradeLevel];
  const subjectKey = getSubjectKey(subject);
  const subjectData = (gradeData && gradeData[subjectKey])
    || levelData?.[subjectKey];

  const verbatimEntry = VERBATIM_BSKAP_DATA.subjects?.[level]?.[data.gradeLevel]?.[subjectKey] || {};
  const cpFullVerbatim = verbatimEntry.cp_full || "Lihat list elemen dan materi.";

  onProgress({ stage: 'analyzing', message: 'Menganalisis Capaian Pembelajaran (CP) & Karakteristik Sekolah...', percentage: 20 });

  const prompt = `
    Anda adalah **Sistem Pakar Kurikulum Nasional & Auditor Administrasi Guru** dari Kemendikdasmen RI yang sangat canggih.
    Tugas Anda: Menyusun **Alur Tujuan Pembelajaran (ATP)** yang memiliki kecerdasan analisa tinggi dan presisi matematis 100%.
    
    **PARAMETER SEMESTER & ELEMEN:**
    - Jenjang: **${level}** (Kelas ${data.gradeLevel})
    - Semester: **${getSemesterLabel(semester)}**
    - Fokus Fase: **${BSKAP_DATA.standards.semester_logic[getSemesterKey(semester)].focus}**
    - Peta Elemen Resmi: ${JSON.stringify(subjectData?.[getSemesterKey(semester)]?.elemen || [])}
    - **LINGKUP MATERI RESMI (MANDATORY)**: ${JSON.stringify(subjectData?.[getSemesterKey(semester)]?.materi_inti || [])}
    
    **📚 REFERENSI BUKU TEKS UTAMA (MANDATORY):**
    - **Buku**: ${BSKAP_DATA.textbooks?.[getLevel(data.gradeLevel)]?.[data.gradeLevel]?.[getSubjectKey(data.subject)]?.title || `Buku Siswa ${data.subject} Kelas ${data.gradeLevel} Kurikulum Merdeka`}
    - **Peta Bab Resmi**: ${JSON.stringify(BSKAP_DATA.textbooks?.[getLevel(data.gradeLevel)]?.[data.gradeLevel]?.[getSubjectKey(data.subject)]?.chapters || [])}
    
    **INSTRUKSI**: Anda HARUS menyesuaikan urutan TP (Tujuan Pembelajaran) agar selaras dengan urutan Bab/Topik dalam buku teks resmi di atas.
    
    **SMART CP FOR ATP CONTEXT (BSKAP 46/2025 COMPLIANCE):**
    Berikut adalah CP LENGKAP untuk referensi konteks: 
    ${cpFullVerbatim}
    
    INSTRUKSI: CP di atas adalah referensi umum untuk Fase ini. Saat menyusun TP (Tujuan Pembelajaran) untuk setiap baris ATP:
    - Pastikan TP turunan dari CP yang relevan dengan elemen/materi di baris tersebut
    - Gunakan exact text dari CP saat diperlukan (verbatim, NO paraphrase)
    
    **FORMAT CP DI ATP (MANDATORY):**
    - Jika mengutip CP, HAPUS nomor elemen (mis. "2.1.", "2.2.")
    - Gunakan format narasi natural: "Pada akhir Fase [X], peserta didik mampu..."
    - Gabungkan elemen terkait menjadi satu paragraf yang koheren
    
    **🚨 CRITICAL SEMESTER CONSTRAINT (ABSOLUTE RULE):**
    ✅ **ANDA HANYA BOLEH** menggunakan elemen dari: ${JSON.stringify(subjectData?.[getSemesterKey(semester)]?.elemen || [])}
    ✅ **ANDA HANYA BOLEH** menggunakan materi yang MERUJUK pada: ${JSON.stringify(subjectData?.[getSemesterKey(semester)]?.materi_inti || [])}
    ❌ **DILARANG KERAS** menggunakan materi dari semester ${getSemesterLabel(semester) === 'Ganjil' ? 'Genap' : 'Ganjil'}
    ❌ **DILARANG** menambah elemen atau materi di luar list resmi semester ${getSemesterLabel(semester)} di atas
    🎯 **FOKUS WAJIB**: Semester **${getSemesterLabel(semester)}** dengan filosofi **${BSKAP_DATA.standards.semester_logic[getSemesterKey(semester)].focus}**
    
    **📚 CRITICAL GRADE-LEVEL TEXTBOOK CONSTRAINT (ABSOLUTE RULE):**
    🎯 **REFERENSI WAJIB**: Anda HARUS menggunakan pengetahuan Anda tentang **Buku Teks Resmi Kemendikdasmen / Kemendikbudristek untuk Kelas ${data.gradeLevel}** sebagai panduan utama.
    ✅ **MANDATORY**: Setiap materi yang Anda pilih dari "LINGKUP MATERI RESMI" di atas HARUS dipetakan ke **urutan bab/topik yang sesuai dengan Buku Pemerintah (Kemendikdasmen/Kemendikbudristek) Kelas ${data.gradeLevel}**.
    ❌ **DILARANG KERAS**: Mengambil materi yang ada di Buku Teks Kelas ${parseInt(data.gradeLevel) - 1} (kelas di bawahnya) atau Kelas ${parseInt(data.gradeLevel) + 1} (kelas di atasnya).
    🔍 **VERIFICATION MANDATORY**: Sebelum memilih suatu materi dari list, tanyakan pada diri sendiri: "Apakah topik ini ada di Buku ${data.subject} Kelas ${data.gradeLevel} Kemendikdasmen / Kemendikbudristek?"
    
    **CONTOH SPIRAL CURRICULUM (REFERENSI):**
    - Matematika SMP: Kelas 7 (Bilangan Bulat, Pecahan, Himpunan) → Kelas 8 (Koordinat Kartesius, Teorema Pythagoras, SPLDV) → Kelas 9 (Perpangkatan, Barisan, Fungsi Kuadrat)
    - Gunakan pengetahuan serupa untuk mata pelajaran ${data.subject} Kelas ${data.gradeLevel}
    
    **INSTRUKSI PENYUSUNAN (STRICT):**
    1. **MANDATORY SEMESTER LOCK**: Gunakan HANYA elemen dan materi dari "PETA ELEMEN RESMI" dan "LINGKUP MATERI RESMI" di atas.
    2. **DEEP LEARNING PHILOSOPHY (BSKAP 046/H/KR/2025)**: Fokus pada kedalaman pemahaman (Deep Learning), bukan hanya keluasan materi.
    3. **UNIQUE MATERIAL TITLES (NO REPETITION)**: Kolom 'materi' bertindak sebagai Judul Sub-Topik/Bab Kecil.
       - ❌ **DILARANG KERAS** mengulang Judul Materi yang sama di baris berbeda.
       - ✅ **WAJIB**: Jika "LINGKUP MATERI RESMI" hanya berisi sedikit item, Anda **HARUS** memecahnya menjadi sub-topik spesifik yang sekuensial (misal: "Pengenalan Topic X", "Analisis Detail Topic X", "Implementasi Topic X", "Evaluasi Topic X").
       - Setiap baris harus menggambarkan progres pembelajaran yang unik.
    4. **MATHEMATICAL PRECISION & STRUCTURE (STRICT)**:
       - **JUMLAH BARIS**: Anda **WAJIB** menghasilkan antara **10 hingga 15 baris**.
       - **PROSEDUR HITUNG (MANDATORY)**:
         1. Cari TotalMinggu = ${data.totalJP} / ${data.jpPerWeek}.
         2. Berikan durasi 1, 2, atau 3 Minggu untuk setiap baris.
         3. JP per Baris = Durasi (Minggu) * ${data.jpPerWeek}.
         4. **SUM CHECK**: Total seluruh 'jp' MUST EXACTLY EQUAL ${data.totalJP}.
    5. **CHRONOLOGICAL TIMELINE ENFORCER (LINEARITY)**:
       - Penempatan 'Elemen' dan 'Lingkup Materi' **WAJIB** mengikuti urutan logis/linier sesuai alur buku teks atau urutan yang diberikan pada parameter input.
       - DILARANG melompat-lompat elemen (Elemen harus berkelompok secara berurutan).
    6. **STRICT PROFIL LULUSAN (8 DIMENSI)**: 
       - Gunakan HANYA list resmi: ${BSKAP_DATA.standards.profile_lulusan_2025.map(p => p.dimensi).join(', ')}.
    7. **TP DESCRIPTIVE**: Narasi Tujuan Pembelajaran (TP) harus unik dan mencerminkan sub-topik yang ditulis di kolom materi.
    
    **PARAMETER OPERASIONAL:**
    - Target Total: **${data.totalJP} JP**
    - Jam/Minggu: **${data.jpPerWeek} JP**
    - Jenjang: **${level} (Kelas ${data.gradeLevel})**
    
    **DATA PROFIL:**
    - Guru: ${userProfile?.title || 'Bapak/Ibu'} ${userProfile?.name || ''}
    - Mata Pelajaran: ${data.subject}
    - RPP Existing: ${data.existingRPPs?.join(', ') || 'Belum ada'}

    ${getRegionalLanguage(data.subject) ? `
    **INSTRUKSI BAHASA DAERAH (${getRegionalLanguage(data.subject)})**:
    - Karena mata pelajaran ini adalah Bahasa Daerah, susunlah narasi Tujuan Pembelajaran (TP) dalam **Bahasa ${getRegionalLanguage(data.subject)}**.
    - Tetap gunakan Bahasa Indonesia untuk field JSON dan label elemen.
    ` : ''}

    **PEMETAAN PROFIL LULUSAN (8 DIMENSI 2025):**
    Setiap TP HARUS dipetakan ke salah satu atau beberapa dimensi Profil Lulusan berikut:
    ${BSKAP_DATA.standards.profile_lulusan_2025.map(p => `- ${p.dimensi}${p.dimensi === 'Keimanan & Ketakwaan' ? ' (Gunakan jika TP mengandung unsur: Integritas/kejujuran, etika profesi/digital, rasa syukur atas keteraturan ilmu/alam, atau tanggung jawab moral/sosial).' : ''}`).join('\n    ')}
    
    **KOMPETENSI INDUSTRI (STRATEGIS 2026):**
    Perkaya narasi TP (Tujuan Pembelajaran) jika relevan dengan nilai kompetensi industri berikut:
    ${BSKAP_DATA.standards.industry_competencies_2025_2026.map(c => `- ${c.name}: ${c.description}`).join('\n    ')}

    Gunakan nama dimensi/kompetensi yang relevan dengan TP tersebut.

    **STRUKTUR OUTPUT (JSON ARRAY):**
    ⚠️ PENTING: Field 'elemen' harus HANYA dari list: ${JSON.stringify(subjectData?.[getSemesterKey(semester)]?.elemen || [])}
    ⚠️ PENTING: Field 'materi' harus MERUJUK materi dalam list: ${JSON.stringify(subjectData?.[getSemesterKey(semester)]?.materi_inti || [])}
    [
      { "no": 1, "elemen": "ELEMEN_TUNGGAL", "materi": "JUDUL_UNIK_SPESIFIK", "tp": "TP_DESKRIPTIF_PROYEK/TEORI", "jp": ${data.jpPerWeek}, "profilLulusan": "DIMENSI_8" }
    ]

    **VERIFIKASI AKHIR AUDITOR (WAJIB DICEK SEBELUM OUTPUT):**
    - "Apakah kedalaman materi sudah sesuai taksonomi Bloom untuk Kelas ${data.gradeLevel}?"
    - "Hitung ulang: Apakah total JP tepat ${data.totalJP} JP? (WAJIB SINKRON)."
    - "🚨 CRITICAL: Apakah SEMUA elemen yang saya pilih ADA dalam list semester ${getSemesterLabel(semester)}: ${JSON.stringify(subjectData?.[getSemesterKey(semester)]?.elemen || [])}?"
    - "🚨 CRITICAL: Apakah SEMUA materi yang saya buat MERUJUK pada lingkup materi semester ${getSemesterLabel(semester)}: ${JSON.stringify(subjectData?.[getSemesterKey(semester)]?.materi_inti || [])}?"
    - "🚨 Apakah saya TIDAK menggunakan materi dari semester ${getSemesterLabel(semester) === 'Ganjil' ? 'Genap' : 'Ganjil'}?"
    - "📚 CRITICAL: Apakah SETIAP materi yang saya pilih SESUAI dengan urutan topik/bab di Buku Teks ${data.subject} Kelas ${data.gradeLevel} Kemendikdasmen / Kemendikbudristek?"
    - "📚 CRITICAL: Apakah saya TIDAK mengambil topik yang seharusnya ada di Buku Kelas ${parseInt(data.gradeLevel) - 1} atau Kelas ${parseInt(data.gradeLevel) + 1}?"
    - "UNIQUE TITLES: Apakah setiap materi memiliki judul yang unik dan mendalam (Deep Learning)?"
    
    **FINAL OUTPUT INSTRUCTION:**
    - **OUTPUT ONLY RAW JSON**.
    - **NO MARKDOWN** (No \`\`\`json ... \`\`\`).
    - **NO INTRO/OUTRO TEXT**.
    - START WITH \`[\` AND END WITH \`]\`.
    `;

  onProgress({ stage: 'drafting', message: 'Mulai menyusun kerangka Alur Tujuan Pembelajaran (ATP)...', percentage: 40 });

  try {
    const model = getModel(modelName);
    const result = await retryWithBackoff(() => model.generateContent(prompt));
    const response = await result.response;

    onProgress({ stage: 'finalizing', message: 'Memvalidasi total JP dan menyelaraskan dengan Buku Teks...', percentage: 80 });

    const output = extractJSON(response.text());

    if (output && Array.isArray(output)) {
      onProgress({ stage: 'completed', message: 'ATP berhasil disusun!', percentage: 100 });
      return output;
    } else {
      throw new Error("Format output AI tidak valid: JSON yang diharapkan tidak ditemukan.");
    }

  } catch (error) {
    console.error("Error generating ATP:", error);
    onProgress({ stage: 'error', message: 'Terjadi kesalahan saat menyusun ATP.', percentage: 0 });
    throw new Error(handleGeminiError(error, "generateATP"));
  }
}
