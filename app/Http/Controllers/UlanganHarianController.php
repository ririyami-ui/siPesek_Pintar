<?php

namespace App\Http\Controllers;

use App\Models\UlanganHarianItem;
use App\Models\Grade;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class UlanganHarianController extends Controller
{
    /**
     * Menampilkan daftar ulangan harian milik guru (pola KktpAssessmentController::index).
     */
    public function index(Request $request)
    {
        $query = UlanganHarianItem::query()->with(['rpp', 'schoolClass', 'subject'])
            ->orderBy('date', 'desc');

        if (!Auth::user()->isAdmin()) {
            $query->where('user_id', Auth::id());
        }

        if ($request->has('rpp_id')) {
            $query->where('rpp_id', $request->rpp_id);
        }
        if ($request->has('class_id')) {
            $query->where('class_id', $request->class_id);
        }
        if ($request->has('subject_id')) {
            $query->where('subject_id', $request->subject_id);
        }

        return response()->json($query->paginate(20));
    }

    /**
     * Menyimpan ulangan harian: item_meta (butir: tipe PG/Esai, elemen, materi,
     * skor_maks, bobot) + scores (skor tiap butir tiap siswa).
     * Mengikuti pola KktpAssessmentController::store + syncToGrades.
     */
    public function store(Request $request)
    {
        $request->validate([
            'rpp_id' => 'nullable',
            'rpp_topic' => 'required',
            'class_id' => 'nullable',
            'class_name' => 'nullable',
            'subject_id' => 'nullable',
            'subject_name' => 'nullable',
            'date' => 'required|date',
            'item_meta' => 'required|array', // [{ no, tipe: 'PG'|'Esai', elemen, materi, skor_maks, bobot }]
            'scores' => 'required|array', // { studentId: { no: skor } }
            'remidi_scores' => 'nullable|array', // { studentId: nilai_akhir_setelah_perbaikan }
            'semester' => 'required',
            'academic_year' => 'required',
            'kktp_score' => 'nullable|numeric',
            'target_klasikal' => 'nullable|numeric|min:0|max:100',
          ]);

        try {
            DB::beginTransaction();

            $assessment = UlanganHarianItem::create([
                'user_id' => Auth::id(),
                'rpp_id' => $request->rpp_id,
                'rpp_topic' => $request->rpp_topic,
                'class_id' => $request->class_id,
                'class_name' => $request->class_name,
                'subject_id' => $request->subject_id,
                'subject_name' => $request->subject_name,
                'date' => $request->date,
                'item_meta' => $request->item_meta,
                'scores' => $request->scores,
                'remidi_scores' => $request->remidi_scores ?? [],
                'kktp_score' => $request->kktp_score,
                'target_klasikal' => $request->target_klasikal ?? 80.00,
                'semester' => $request->semester,
                'academic_year' => $request->academic_year,
            ]);

            if ($request->boolean('sync_to_grades')) {
                $this->syncToGrades($assessment, $request->input('assessment_type', 'Ulangan Harian'));
            }

            DB::commit();
            return response()->json(['message' => 'Ulangan harian berhasil disimpan', 'data' => $assessment], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error("Error saving Ulangan Harian: " . $e->getMessage());
            return response()->json(['error' => 'Gagal menyimpan ulangan harian'], 500);
        }
    }

    /**
     * Sinkron skor akhir ulangan ke tabel grades (type: berdasarkan pemanggil).
     * Mengikuti pola KktpAssessmentController::syncToGrades â€” updateOrCreate dengan
     * kunci unik (user/student/class/subject/date/topic/type/semester/academic_year).
     */
    protected function syncToGrades(UlanganHarianItem $assessment, $type)
    {
        $items = $assessment->item_meta; // [{ no, tipe, elemen, materi, skor_maks, bobot }]
        $scores = $assessment->scores; // { studentId: { no: skor } }
        $remidi = $assessment->remidi_scores ?? []; // { studentId: nilai 0-100 setelah perbaikan }

        // Hitung skor akhir per siswa: sum(skor Ã— bobot) / sum(skor_maks Ã— bobot) Ã— 100
        $totBobotXMax = 0;
        foreach ($items as $item) {
            $totBobotXMax += (float)($item['bobot'] ?? 1) * (float)($item['skor_maks'] ?? 1);
        }

        foreach ($scores as $studentId => $studentScores) {
            $weightedSum = 0;
            foreach ($items as $item) {
                $no = $item['no'];
                $skor = min((float)($studentScores[$no] ?? 0), (float)($item['skor_maks'] ?? 1));
                $weightedSum += $skor * (float)($item['bobot'] ?? 1);
            }
            $finalScore = $totBobotXMax > 0 ? round(($weightedSum / $totBobotXMax) * 100, 2) : 0;

            // Jika ada nilai remidi (perbaikan), gunakan nilai akhir setelah perbaikan
            if (isset($remidi[$studentId]) && is_numeric($remidi[$studentId]) && (float)$remidi[$studentId] > 0) {
                $finalScore = round((float)$remidi[$studentId], 2);
            }

            if ($finalScore > 0) {
                Grade::updateOrCreate(
                    [
                        'user_id' => Auth::id(),
                        'student_id' => $studentId,
                        'class_id' => $assessment->class_id,
                        'subject_id' => $assessment->subject_id,
                        'date' => $assessment->date,
                        'type' => $type,
                        'topic' => $assessment->rpp_topic,
                        'semester' => $assessment->semester,
                        'academic_year' => $assessment->academic_year,
                        'ulangan_harian_item_id' => $assessment->id
                    ],
                    [
                        'score' => $finalScore,
                        'notes' => 'Generated from Analisis Ulangan Harian'
                    ]
                );
            }
        }
    }

    public function show($id)
    {
        $query = UlanganHarianItem::query()->with(['rpp', 'schoolClass', 'subject']);
        if (!Auth::user()->isAdmin()) {
            $query->where('user_id', Auth::id());
        }
        $assessment = $query->findOrFail($id);
        return response()->json($assessment);
    }

    /**
     * Memperbarui ulangan harian (mengikuti pola store): item_meta + scores (+ nilai perbaikan).
     */
    public function update(Request $request, $id)
    {
        $query = UlanganHarianItem::query();
        if (!Auth::user()->isAdmin()) {
            $query->where('user_id', Auth::id());
        }
        $assessment = $query->findOrFail($id);

        $request->validate([
            'rpp_id' => 'nullable',
            'rpp_topic' => 'required',
            'class_id' => 'nullable',
            'class_name' => 'nullable',
            'subject_id' => 'nullable',
            'subject_name' => 'nullable',
            'date' => 'required|date',
            'item_meta' => 'required|array', // [{ no, tipe, elemen, materi, skor_maks, bobot }]
            'scores' => 'required|array', // { studentId: { no: skor } }
            'remidi_scores' => 'nullable|array', // { studentId: nilai_akhir_setelah_perbaikan }
            'semester' => 'required',
            'academic_year' => 'required',
            'kktp_score' => 'nullable|numeric',
            'target_klasikal' => 'nullable|numeric|min:0|max:100',
        ]);

        try {
            DB::beginTransaction();

            $assessment->update([
                'rpp_id' => $request->rpp_id,
                'rpp_topic' => $request->rpp_topic,
                'class_id' => $request->class_id,
                'class_name' => $request->class_name,
                'subject_id' => $request->subject_id,
                'subject_name' => $request->subject_name,
                'date' => $request->date,
                'item_meta' => $request->item_meta,
                'scores' => $request->scores,
                'kktp_score' => $request->kktp_score,
                'target_klasikal' => $request->target_klasikal ?? $assessment->target_klasikal ?? 80.00,
                'remidi_scores' => $request->remidi_scores ?? $assessment->remidi_scores,
                'semester' => $request->semester,
                'academic_year' => $request->academic_year,
            ]);

            // Perbarui relasi ke tabel grades (skor akhir menyesuaikan skor baru)
            Grade::where('ulangan_harian_item_id', $assessment->id)->delete();
            $this->syncToGrades($assessment, $request->input('assessment_type', 'Ulangan Harian'));

            DB::commit();
            return response()->json(['message' => 'Ulangan harian berhasil diperbarui', 'data' => $assessment]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error("Error updating Ulangan Harian: " . $e->getMessage());
            return response()->json(['error' => 'Gagal memperbarui ulangan harian'], 500);
        }
    }

    public function destroy($id)
    {
        $query = UlanganHarianItem::query();
        if (!Auth::user()->isAdmin()) {
            $query->where('user_id', Auth::id());
        }
        $assessment = $query->findOrFail($id);
        $assessment->delete(); // Cascades null to grades
        return response()->json(['message' => 'Ulangan harian dihapus']);
    }
}
