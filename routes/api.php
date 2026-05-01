<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\GeminiController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\SchoolClassController;
use App\Http\Controllers\StudentController;
use App\Http\Controllers\SubjectController;
use App\Http\Controllers\ScheduleController;
use App\Http\Controllers\Api\StudentDashboardController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:5,1'); // Limit login attempts to 5 per minute

// Public Settings Route for PWA and Welcome Screen
Route::get('/public-settings', [App\Http\Controllers\UserProfileController::class, 'getPublicSettings']);

// Secure Backup Download via Ticket (Outside Sanctum to allow direct browser download)
Route::get('/admin/database/backup/download', [App\Http\Controllers\Admin\DatabaseManagementController::class, 'downloadBackup']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/save-push-subscription', [AuthController::class, 'savePushSubscription']);
    
    Route::apiResource('classes', SchoolClassController::class);
    Route::apiResource('subjects', SubjectController::class);
    Route::apiResource('teachers', App\Http\Controllers\TeacherController::class);
    Route::get('/assignments', [App\Http\Controllers\TeacherController::class, 'getAllAssignments']);
    Route::post('/teachers/bulk-clear', [App\Http\Controllers\TeacherController::class, 'bulkClear']);
    Route::post('/teachers/{teacher}/sync-assignments', [App\Http\Controllers\TeacherController::class, 'syncAssignments']);

    Route::middleware('admin')->group(function () {
        Route::post('/register', [AuthController::class, 'register']);
        Route::apiResource('admins', App\Http\Controllers\AdminController::class);
        Route::get('/admin/dashboard/monitoring', [App\Http\Controllers\DashboardController::class, 'getMonitoringData']);
        Route::get('/admin/grades/monitoring', [App\Http\Controllers\DashboardController::class, 'getGradeMonitoringData']);
        
        // Database Management
        Route::get('/admin/database/tables', [App\Http\Controllers\Admin\DatabaseManagementController::class, 'getTables']);
        Route::post('/admin/database/truncate', [App\Http\Controllers\Admin\DatabaseManagementController::class, 'truncateTable']);
        Route::get('/admin/database/backup', [App\Http\Controllers\Admin\DatabaseManagementController::class, 'backupDatabase']);
        Route::post('/admin/database/wipe', [App\Http\Controllers\Admin\DatabaseManagementController::class, 'wipeDatabase']);
        Route::post('/admin/database/restore', [App\Http\Controllers\Admin\DatabaseManagementController::class, 'restoreDatabase']);
        Route::post('/admin/database/clean-logs', [App\Http\Controllers\Admin\DatabaseManagementController::class, 'cleanSystemLogs']);
        
        // Student Photo Upload
        Route::post('/admin/students/upload-photos', [App\Http\Controllers\StudentPhotoController::class, 'uploadZip']);

        // Device Management
        Route::post('/admin/students/{student}/reset-device', [App\Http\Controllers\StudentController::class, 'resetDevice']);
    });

    // Student Portal Routes (Accessible by Students)
    // Note: Full student routes defined below in the prefix('student') group

    Route::apiResource('students', StudentController::class);
    Route::get('/schedules/sync-analysis', [ScheduleController::class, 'getSyncAnalysis']);
    Route::get('/schedules/allocation-audit', [ScheduleController::class, 'getAllocationAudit']);
    Route::get('/schedules/teacher-workload', [ScheduleController::class, 'getTeacherWorkloadAudit']);
    Route::get('/schedules/export/csv', [ScheduleController::class, 'exportCsv']);
    Route::apiResource('schedules', ScheduleController::class);
    Route::post('/schedules/sync-template', [ScheduleController::class, 'syncWithTemplate']);
    Route::post('/schedules/auto-generate', [ScheduleController::class, 'autoGenerate']);
    Route::post('/schedules/bulk-store', [ScheduleController::class, 'bulkStore']);

    // Class Agreement Routes
    Route::get('/class-agreements/{classId}', [App\Http\Controllers\ClassAgreementController::class, 'show']);
    Route::post('/class-agreements', [App\Http\Controllers\ClassAgreementController::class, 'store']);

    // Attendance Routes
    Route::get('/attendances/missing', [App\Http\Controllers\AttendanceController::class, 'missing']);
    Route::post('/admin/attendances/reset-missing', [App\Http\Controllers\AttendanceController::class, 'resetMissing']);
    Route::get('/attendances', [App\Http\Controllers\AttendanceController::class, 'index']);
    Route::post('/attendances/bulk', [App\Http\Controllers\AttendanceController::class, 'storeBulk']);
    Route::get('/attendances/summary', [App\Http\Controllers\AttendanceController::class, 'summary']);
    Route::get('/wali/my-class', [App\Http\Controllers\SchoolClassController::class, 'myClass']);

    // Teaching Journals
    Route::apiResource('journals', App\Http\Controllers\JournalController::class);

    // User Profile
    Route::get('/profile', [App\Http\Controllers\UserProfileController::class, 'show']);
    Route::match(['PUT', 'POST'], '/profile', [App\Http\Controllers\UserProfileController::class, 'update']);

    // Dashboard & Analytics Routes
    Route::apiResource('holidays', App\Http\Controllers\HolidayController::class);
    Route::apiResource('infractions', App\Http\Controllers\InfractionController::class);
    Route::post('/grades/batch', [App\Http\Controllers\GradeController::class, 'storeBatch']);
    Route::delete('/grades/batch', [App\Http\Controllers\GradeController::class, 'destroyBatch']);
    Route::get('/grades/materials', [App\Http\Controllers\GradeController::class, 'getMaterials']);
    Route::get('/grades/summary/{student_id}', [App\Http\Controllers\GradeController::class, 'getSummary']);
    Route::apiResource('grades', App\Http\Controllers\GradeController::class);
    Route::apiResource('kktp-assessments', App\Http\Controllers\KktpAssessmentController::class);
    Route::apiResource('teaching-programs', App\Http\Controllers\TeachingProgramController::class);
    Route::apiResource('student-tasks', App\Http\Controllers\StudentTaskController::class);
    Route::apiResource('student-notes', App\Http\Controllers\StudentNoteController::class);
    Route::post('/infraction-types/bulk', [App\Http\Controllers\InfractionTypeController::class, 'bulkStore']);
    Route::apiResource('infraction-types', App\Http\Controllers\InfractionTypeController::class);

    // AI Services
    Route::group(['prefix' => 'ai'], function () {
        Route::post('/analyze-journal', [GeminiController::class, 'analyzeJournal']);
        Route::post('/generate-lesson-plan', [App\Http\Controllers\AiFeaturesController::class, 'generateRpp']);
        Route::post('/save-rpp', [App\Http\Controllers\AiFeaturesController::class, 'saveRpp']);
        Route::get('/rpp-history', [App\Http\Controllers\AiFeaturesController::class, 'getRppHistory']);
        Route::delete('/rpp-history/{id}', [App\Http\Controllers\AiFeaturesController::class, 'deleteRpp']);
        
        Route::post('/generate-quiz', [App\Http\Controllers\AiFeaturesController::class, 'generateQuiz']);
        Route::post('/save-quiz', [App\Http\Controllers\AiFeaturesController::class, 'saveQuiz']);
        Route::get('/quiz-history', [App\Http\Controllers\AiFeaturesController::class, 'getQuizHistory']);
        Route::delete('/quiz-history/{id}', [App\Http\Controllers\AiFeaturesController::class, 'deleteQuiz']);
        
        Route::post('/generate-handout', [App\Http\Controllers\AiFeaturesController::class, 'generateHandout']);
        Route::post('/save-handout', [App\Http\Controllers\AiFeaturesController::class, 'saveHandout']);
        Route::get('/handout-history', [App\Http\Controllers\AiFeaturesController::class, 'getHandoutHistory']);
        Route::delete('/handout-history/{id}', [App\Http\Controllers\AiFeaturesController::class, 'deleteHandout']);
        
        Route::post('/analyze-student', [GeminiController::class, 'analyzeStudent']);
        Route::post('/analyze-class', [App\Http\Controllers\AiFeaturesController::class, 'analyzeClass']);
        Route::post('/chat', [GeminiController::class, 'chat']);
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Student (Parent) Dashboard Routes
    // Accessible only by users with role = 'student'
    // ──────────────────────────────────────────────────────────────────────────
    Route::prefix('student')->group(function () {
        Route::get('/realtime',    [StudentDashboardController::class, 'getRealtimeLearning']);
        Route::get('/schedule',    [StudentDashboardController::class, 'getWeeklySchedule']);
        Route::get('/attendance',  [StudentDashboardController::class, 'getAttendanceRecap']);
        Route::get('/grades',      [StudentDashboardController::class, 'getGrades']);
        Route::get('/tasks',       [StudentDashboardController::class, 'getMissingTasks']);
        Route::get('/infractions', [StudentDashboardController::class, 'getInfractions']);
        Route::post('/chat',       [\App\Http\Controllers\Api\StudentChatController::class, 'chat'])->middleware('throttle:10,1');
    });

    // Library Module
    Route::group(['prefix' => 'library', 'middleware' => ['librarian']], function () {
        Route::get('/books/lookup/{isbn}', [App\Http\Controllers\BookController::class, 'lookup']);
        Route::apiResource('books', App\Http\Controllers\BookController::class);
        
        Route::get('/loans/stats', [App\Http\Controllers\LibraryLoanController::class, 'stats']);
        Route::post('/loans/{loan}/return', [App\Http\Controllers\LibraryLoanController::class, 'returnBook']);
        Route::apiResource('loans', App\Http\Controllers\LibraryLoanController::class);
    });
});
