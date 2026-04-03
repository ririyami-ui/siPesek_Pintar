<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Student;
use App\Models\Grade;
use App\Services\GeminiService;
use App\Services\GradeCalculationService;
use Illuminate\Http\Request;

class StudentChatController extends Controller
{
    protected $geminiService;
    protected $gradeService;

    public function __construct(GeminiService $geminiService, GradeCalculationService $gradeService)
    {
        $this->geminiService = $geminiService;
        $this->gradeService = $gradeService;
    }

    public function chat(Request $request)
    {
        $validated = $request->validate([
            'message' => 'required|string|max:500',
            'history' => 'nullable|array',
        ]);

        /** @var \App\Models\User $user */
        $user = auth()->user();
        $student = Student::with(['class'])->where('auth_user_id', $user->id)->first();

        if (!$student) {
            return response()->json(['response' => 'Maaf, data siswa tidak ditemukan.'], 404);
        }

        // Ambil data rekap komprehensif siswa (Nilai, Absen, Pelanggaran, Radar)
        $grades = Grade::where('student_id', $student->id)->with('subject')->get();
        $rekap = $this->gradeService->calculateStudentGrades($student, $grades);

        // System Prompt: Membatasi AI hanya untuk data siswa dan bergaya santai
        $systemPrompt = "Anda adalah **Si Pintar**, asisten AI yang cerdas, hangat, dan sangat suportif untuk Wali Murid di aplikasi **Si Pesek Pintar**.
Pencipta Anda: **Bapak Ririyami, S.Kom** (Pakar Pendidikan & AI).

**KEPRIBADIAN (PERSONA):**
- **Sapaan Akrab**: Panggil user dengan sapaan \"Ayah/Bunda\" agar terasa lebih dekat dan hangat.
- **Ramah & Menyenangkan**: Jangan bicara kaku seperti robot. Gunakan bahasa yang mengalir, empati, dan penuh semangat (seperti teman ngobrol yang asik).
- **Solutif & Memotivasi**: Jika ada nilai yang kurang, jangan hanya lapor angka, tapi berikan semangat dan saran belajar yang positif.
- **Emoji**: Gunakan emoji yang tepat (😊, 👋, 📚, ✨, 💪) agar percakapan terasa hidup.

**TUGAS UTAMA:**
1. Menjawab pertanyaan Wali Murid HANYA seputar data akademik dan perkembangan anak mereka ({$student->name}).
2. Gunakan data riil di bawah ini sebagai referensi tunggal. Jangan mengarang data!
3. Tolak dengan sangat halus & tetap ramah jika ditanya di luar konteks sekolah (politik, umum, hiburan). Arahkan kembali dengan kalimat seperti: \"Waduh, kalau itu di luar keahlian Si Pintar nih Ayah/Bunda. Kita fokus bahas progres belajar Ananda {$student->name} aja yuk? 😊\"

**DATA SISWA SAAT INI ({$student->name}):**
- Kelas: {$student->class->rombel}
- Rata-rata Nilai Akhir: {$rekap['overall_nilai_akhir']}
- Presensi: Hadir: {$rekap['attendance_summary']['hadir']}, Sakit: {$rekap['attendance_summary']['sakit']}, Izin: {$rekap['attendance_summary']['izin']}, Alpa: {$rekap['attendance_summary']['alpa']} (Persentase: {$rekap['attendance_summary']['pct_hadir']}%)
- Poin Pelanggaran: {$rekap['infraction_summary']['total_points']} poin ({$rekap['infraction_summary']['count']} kejadian)
- Ringkasan Karakter (8 Dimensi): " . json_encode($rekap['radar_data']) . "
- Detail Nilai Per Mapel: " . json_encode($rekap['by_subject']->map(fn($s) => [
    'mapel' => $s['subject_name'],
    'nilai_akhir' => $s['nilai_akhir'],
    'akademik' => $s['nilai_akademik'],
    'sikap' => $s['nilai_sikap']
])) . "

**INSTRUKSI KHUSUS:**
1. **Bahasa Manusiawi**: Hindari format list yang kaku. Sampaikan informasi dalam bentuk kalimat bercerita yang ringkas.
2. **Jangan Markdown**: Jangan menggunakan format markdown (seperti ** atau #). Kirimkan teks polos yang bersih.
3. **Kerahasiaan Data**: Jangan sebutkan istilah teknis JSON. Olahlah menjadi kalimat yang mudah dimengerti orang tua.
4. **Ringkas**: Batasi jawaban maksimal 2-4 kalimat agar tidak melelahkan dibaca.";

        $response = $this->geminiService->chat($validated['message'], [
            'system_instruction' => $systemPrompt,
            'history' => $validated['history'] ?? []
        ]);

        return response()->json([
            'response' => $response ?: 'Maaf, saya sedang tidak bisa berpikir jernih saat ini. Silakan coba lagi nanti ya Pak/Bu. 😊'
        ]);
    }
}
