<?php

namespace App\Http\Controllers;

use App\Services\AiGeneratorService;
use App\Models\LessonPlan;
use App\Models\Quiz;
use App\Models\Handout;
use App\Models\Worksheet;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class AiFeaturesController extends Controller
{
    protected $aiService;

    public function __construct(AiGeneratorService $aiService)
    {
        $this->aiService = $aiService;
    }

    public function generateRpp(Request $request)
    {
        $request->validate([
            'subject' => 'required|string',
            'gradeLevel' => 'required',
            'topic' => 'required|string', // materi
        ]);

        try {
            $data = $request->all();
            
            // Map frontend keys to backend expectations
            $data['kd'] = $request->input('kd');
            $data['materi'] = $request->input('topic') ?? $request->input('materi');
            $data['jp'] = $request->input('jp');
            $data['distribution'] = $request->input('distribution');
            $data['modelName'] = $request->input('modelName');
            $data['studentCharacteristics'] = $request->input('studentCharacteristics');
            $data['profilLulusan'] = $request->input('profilLulusan');
            $data['elemen'] = $request->input('elemen');
            $data['semester'] = $request->input('semester');
            $data['academicYear'] = $request->input('academicYear');
            
            // Add user info from Profile (SSOT)
            $user = Auth::user();
            $profile = \App\Models\UserProfile::where('user_id', $user->id)->first();
            
            // Fallback to Admin Profile if needed for school data
            if ($user->role === 'teacher') {
                $primaryAdminId = \App\Models\User::whereIn('role', ['admin', 'adminer'])->orderBy('id', 'asc')->value('id');
                $adminProfile = \App\Models\UserProfile::where('user_id', $primaryAdminId)->first();
                
                if (empty($data['schoolName'])) $data['schoolName'] = $adminProfile->school_name ?? 'Sekolah';
            } else {
                if (empty($data['schoolName'])) $data['schoolName'] = $profile->school_name ?? 'Sekolah';
            }

            if (empty($data['teacherName'])) $data['teacherName'] = $user->name;
            if (empty($data['academicYear'])) $data['academicYear'] = $profile->academic_year ?? '-';
            if (empty($data['semester'])) $data['semester'] = $profile->active_semester ?? 'Ganjil';

            $result = $this->aiService->generateLessonPlan($data);

            return response()->json(['content' => $result]);

        } catch (\Exception $e) {
            Log::error("Error generating RPP: " . $e->getMessage());
            return response()->json(['error' => 'Gagal menyusun RPP: ' . $e->getMessage()], 500);
        }
    }

    public function saveRpp(Request $request)
    {
         $request->validate([
            'subject' => 'required|string',
            'gradeLevel' => 'required',
            'topic' => 'required|string',
            'content' => 'required|string',
        ]);

        try {
            $lessonPlan = LessonPlan::create([
                'user_id' => Auth::id(),
                'subject_id' => $request->input('subjectId'),
                'subject' => $request->input('subject'),
                'grade_level' => $request->input('gradeLevel'),
                'topic' => $request->input('topic'),
                'kd' => $request->input('kd'),
                'student_characteristics' => $request->input('studentCharacteristics'),
                'content' => $request->input('content'),
                'assessment_model' => $request->input('assessmentModel'),
                'academic_year' => $request->input('academicYear'),
                'semester' => $request->input('semester'),
                'visualization' => $request->input('visualization'),
            ]);

            return response()->json(['message' => 'RPP berhasil disimpan', 'data' => $lessonPlan], 201);

        } catch (\Exception $e) {
            Log::error("Error saving RPP: " . $e->getMessage());
             return response()->json(['error' => 'Gagal menyimpan RPP'], 500);
        }
    }

    public function getRppHistory(Request $request)
    {
        try {
            $limit = (int) $request->input('limit', 50);
            $gradeLevel = $request->input('grade_level') ?? $request->input('gradeLevel');
            $subjectId = $request->input('subject_id') ?? $request->input('subjectId');
            
            $query = LessonPlan::query();
            
            if (Auth::user() && !Auth::user()->isAdmin()) {
                $query->where('user_id', Auth::id());
            }

            if (!empty($gradeLevel)) {
                $query->where('grade_level', $gradeLevel);
            }

            if (!empty($subjectId)) {
                $query->where('subject_id', $subjectId);
            }
            
            $plans = $query->latest()->take($limit)->get();
            
            return response()->json($plans);
        } catch (\Exception $e) {
            Log::error("Error fetching RPP history: " . $e->getMessage());
            return response()->json(['error' => 'Gagal mengambil riwayat RPP: ' . $e->getMessage()], 500);
        }
    }
    
    public function deleteRpp($id) 
    {
        $query = LessonPlan::query();
        if (!Auth::user()->isAdmin()) {
            $query->where('user_id', Auth::id());
        }
        $plan = $query->where('id', $id)->first();
        if ($plan) {
            $plan->delete();
            return response()->json(['message' => 'RPP dihapus']);
        }
        return response()->json(['error' => 'RPP tidak ditemukan'], 404);
    }

    // --- QUIZ FEATURES ---

    public function generateQuiz(Request $request)
    {
        $request->validate([
             'topic' => 'required|string',
             'gradeLevel' => 'required',
             'subject' => 'required',
         ]);

         try {
             $data = $request->all();
             $result = $this->aiService->generateQuiz($data);
             
             if (empty($result)) {
                 throw new \Exception("AI gagal menghasilkan format JSON yang valid. Silakan coba lagi.");
             }

             return response()->json($result);
         } catch (\Exception $e) {
             Log::error("Error generating Quiz: " . $e->getMessage());
             return response()->json(['error' => 'Gagal membuat Kuis: ' . $e->getMessage()], 500);
         }
    }

    public function saveQuiz(Request $request)
    {
        $request->validate([
            'gradeLevel' => 'required',
            'subject' => 'required',
            'topic' => 'required',
            'quizData' => 'required_without:quiz', 
            'quiz' => 'required_without:quizData',
        ]);

        try {
            $quiz = Quiz::create([
                'user_id' => Auth::id(),
                'subject' => $request->subject,
                'grade_level' => $request->gradeLevel,
                'topic' => $request->topic,
                'quiz_data' => $request->quizData ?? $request->quiz,
                'academic_year' => $request->academicYear,
                'semester' => $request->semester,
                'is_saved' => true
            ]);

            return response()->json(['message' => 'Kuis berhasil disimpan', 'data' => $quiz]);
        } catch (\Exception $e) {
            Log::error("Error saving Quiz: " . $e->getMessage());
            return response()->json(['error' => 'Gagal menyimpan Kuis'], 500);
        }
    }

    public function getQuizHistory()
    {
        try {
            $query = Quiz::query();
            if (Auth::user() && !Auth::user()->isAdmin()) {
                $query->where('user_id', Auth::id());
            }
            $quizzes = $query->latest()->get();
            return response()->json($quizzes);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Gagal memuat riwayat'], 500);
        }
    }

    public function deleteQuiz($id)
    {
        try {
            $query = Quiz::query();
            if (Auth::user() && !Auth::user()->isAdmin()) {
                $query->where('user_id', Auth::id());
            }
            $quiz = $query->where('id', $id)->firstOrFail();
            $quiz->delete();
            return response()->json(['message' => 'Kuis dihapus']);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Gagal menghapus kuis'], 500);
        }
    }

    // --- HANDOUT FEATURES ---

    public function generateHandout(Request $request)
    {
        $validator = Validator::make($request->all(), [
             'gradeLevel' => 'required',
             'subject' => 'required',
        ]);

        if ($validator->fails()) {
            return response()->json(['error' => 'Data tidak lengkap: ' . implode(', ', $validator->errors()->all())], 422);
        }

        try {
            $data = $request->all();
            $materi = $request->input('materi') ?? $request->input('topic');
            if (empty($materi)) {
                return response()->json(['error' => 'Topik atau materi harus diisi'], 422);
            }
            $data['materi'] = $materi;

            $result = $this->aiService->generateHandout($data);
            return response()->json(['content' => $result]);
        } catch (\Exception $e) {
            Log::error("Error generating Handout: " . $e->getMessage());
            return response()->json(['error' => 'Gagal membuat Bahan Ajar: ' . $e->getMessage()], 500);
        }
    }

    public function saveHandout(Request $request)
    {
         $request->validate([
            'topic' => 'required',
            'subject' => 'required',
            'gradeLevel' => 'required',
            'content' => 'required',
        ]);

        try {
            $handout = Handout::create([
                'user_id' => Auth::id(),
                'topic' => $request->topic,
                'subject_id' => $request->subjectId,
                'subject' => $request->subject,
                'grade_level' => $request->gradeLevel,
                'content' => $request->content,
                'teacher_name' => $request->teacherName,
                'teacher_title' => $request->teacherTitle,
                'school' => $request->school
            ]);

            return response()->json(['message' => 'Bahan Ajar berhasil disimpan', 'data' => $handout]);
        } catch (\Exception $e) {
             Log::error("Error saving Handout: " . $e->getMessage());
             return response()->json(['error' => 'Gagal menyimpan Bahan Ajar'], 500);
        }
    }

    public function getHandoutHistory()
    {
        try {
            $query = Handout::query();
            if (Auth::user() && !Auth::user()->isAdmin()) {
                $query->where('user_id', Auth::id());
            }
            $handouts = $query->latest()->get();
            return response()->json($handouts);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Gagal memuat riwayat'], 500);
        }
    }

    public function deleteHandout($id)
    {
        try {
            $query = Handout::query();
            if (Auth::user() && !Auth::user()->isAdmin()) {
                $query->where('user_id', Auth::id());
            }
            $handout = $query->where('id', $id)->firstOrFail();
            $handout->delete();
            return response()->json(['message' => 'Bahan Ajar dihapus']);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Gagal menghapus bahan ajar'], 500);
        }
    }

    public function chat(Request $request)
    {
        $request->validate([
            'message' => 'required|string',
            'history' => 'nullable|array',
            'context' => 'nullable|array',
        ]);

        try {
            $message = $request->input('message');
            $history = $request->input('history', []);
            $context = $request->input('context', []);
            
            $context['user'] = Auth::user();
            $context['modelName'] = $request->input('modelName');
            $context['imageData'] = $request->input('imageData');

            $result = $this->aiService->chat($message, $history, $context);

            return response()->json(['content' => $result]);
        } catch (\Exception $e) {
            Log::error("Error in Smartty Chat: " . $e->getMessage());
            return response()->json(['error' => 'Gagal mengobrol dengan Smartty: ' . $e->getMessage()], 500);
        }
    }

    public function analyzeClass(Request $request)
    {
        $request->validate([
            'className' => 'required|string',
            'students' => 'nullable|array',
        ]);

        try {
            $data = $request->all();
            $result = $this->aiService->analyzeClass($data);
            return response()->json(['content' => $result]);
        } catch (\Exception $e) {
            Log::error("Error in Class Analysis AI: " . $e->getMessage());
            return response()->json(['error' => 'Gagal menganalisis kelas: ' . $e->getMessage()], 500);
        }
    }

    public function generateWorksheet(Request $request)
    {
         $request->validate([
             'rppContent' => 'required_without:topic', 
             'gradeLevel' => 'required',
         ]);

         try {
             $data = $request->all();
             $result = $this->aiService->generateWorksheet($data);
             return response()->json(['content' => $result]);
         } catch (\Exception $e) {
             Log::error("Error generating Worksheet: " . $e->getMessage());
             return response()->json(['error' => 'Gagal membuat LKPD: ' . $e->getMessage()], 500);
         }
    }

    public function generateAtp(Request $request)
    {
        $request->validate([
            'subject' => 'required',
            'gradeLevel' => 'required',
            'totalJP' => 'required|numeric',
            'jpPerWeek' => 'required|numeric',
        ]);

        try {
            $data = $request->all();
            $result = $this->aiService->generateATP($data);
            return response()->json($result);
        } catch (\Exception $e) {
            Log::error("Error generating ATP: " . $e->getMessage());
            return response()->json(['error' => 'Gagal menyusun ATP: ' . $e->getMessage()], 500);
        }
    }

    public function saveWorksheet(Request $request)
    {
        $request->validate([
            'rppTopic' => 'required',
            'subject' => 'required',
            'gradeLevel' => 'required',
            'classRoom' => 'required',
            'content' => 'required',
        ]);

        try {
            $worksheet = Worksheet::create([
                'user_id' => Auth::id(),
                'rpp_id' => $request->rppId,
                'rpp_topic' => $request->rppTopic,
                'subject' => $request->subject,
                'grade_level' => $request->gradeLevel,
                'class_id' => $request->classId,
                'class_room' => $request->classRoom,
                'content' => $request->content,
            ]);

            return response()->json(['message' => 'LKPD berhasil disimpan', 'data' => $worksheet]);
        } catch (\Exception $e) {
            Log::error("Error saving worksheet: " . $e->getMessage());
            return response()->json(['error' => 'Gagal menyimpan LKPD'], 500);
        }
    }

    public function getWorksheetHistory()
    {
        try {
            $query = Worksheet::query();
            if (Auth::user() && !Auth::user()->isAdmin()) {
                $query->where('user_id', Auth::id());
            }
            $worksheets = $query->latest()->get();
            return response()->json($worksheets);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Gagal memuat riwayat LKPD'], 500);
        }
    }

    public function deleteWorksheet($id)
    {
        try {
            $query = Worksheet::query();
            if (Auth::user() && !Auth::user()->isAdmin()) {
                $query->where('user_id', Auth::id());
            }
            $worksheet = $query->where('id', $id)->firstOrFail();
            $worksheet->delete();
            return response()->json(['message' => 'LKPD dihapus']);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Gagal menghapus LKPD'], 500);
        }
    }
}
