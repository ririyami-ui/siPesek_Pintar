<?php

namespace App\Http\Controllers;

use App\Models\UserProfile;
use Illuminate\Http\Request;

class UserProfileController extends Controller
{
    /**
     * Get the master admin ID (usually the first admin ever created)
     */
    private function getMasterAdminId()
    {
        return \App\Models\User::whereIn('role', ['admin', 'adminer'])
            ->orderBy('id', 'asc')
            ->value('id') ?? 1;
    }

    /**
     * Get public school settings for PWA and Welcome Screen
     */
    public function getPublicSettings()
    {
        $adminUserId = $this->getMasterAdminId();
        $profile = UserProfile::where('user_id', $adminUserId)->first();

        return response()->json([
            'school_name' => $profile->school_name ?? 'Sekolah',
            'logo_url' => ($profile && $profile->logo_path) ? url('storage/' . $profile->logo_path) : null,
        ]);
    }

    /**
     * Get PWA Manifest with dynamic logo
     */
    public function getPwaManifest()
    {
        $adminUserId = $this->getMasterAdminId();
        $profile = UserProfile::where('user_id', $adminUserId)->first();
        
        $schoolName = $profile->school_name ?? 'Si Pesek Pintar';
        $logoUrl = ($profile && $profile->logo_path) ? url('storage/' . $profile->logo_path) : url('Logo Smart Teaching Baru_.png');

        return response()->json([
            'name' => $schoolName . ' - Portal',
            'short_name' => 'Si Pesek',
            'start_url' => '/',
            'display' => 'standalone',
            'background_color' => '#065f46',
            'theme_color' => '#065f46',
            'description' => 'Portal Sekolah ' . $schoolName . ' - Pantau Belajar Realtime',
            'orientation' => 'portrait',
            'icons' => [
                [
                    'src' => $logoUrl,
                    'sizes' => '192x192',
                    'type' => 'image/png',
                    'purpose' => 'any maskable'
                ],
                [
                    'src' => $logoUrl,
                    'sizes' => '512x512',
                    'type' => 'image/png',
                    'purpose' => 'any maskable'
                ]
            ]
        ], 200, [
            'Content-Type' => 'application/manifest+json'
        ]);
    }

    /**
     * Get user profile
     */
    public function show(Request $request)
    {
        $user = $request->user();
        
        // Get the master admin profile for shared school data
        $adminUserId = $this->getMasterAdminId();
        $adminProfile = UserProfile::where('user_id', $adminUserId)->first();

        // For admins, we use the master admin profile as the main profile
        // For teachers/others, we use their own profile and merge school data
        $isAdmin = ($user->role === 'admin' || $user->role === 'adminer');
        
        if ($isAdmin) {
            // Admin always sees and edits the master admin profile
            $userProfile = UserProfile::firstOrCreate(
                ['user_id' => $adminUserId],
                [
                    'school_level' => 'SD',
                    'active_semester' => 'Ganjil',
                    'gemini_model' => 'gemini-3.1-flash-lite-preview',
                    'schedule_notifications_enabled' => true,
                    'school_days' => 6,
                ]
            );
            $mergedProfile = $userProfile;
        } else {
            // Non-admins have their own profile for AI settings
            $userProfile = UserProfile::firstOrCreate(
                ['user_id' => $user->id],
                [
                    'school_level' => $adminProfile->school_level ?? 'SD',
                    'active_semester' => $adminProfile->active_semester ?? 'Ganjil',
                    'gemini_model' => $adminProfile->gemini_model ?? 'gemini-3.1-flash-lite-preview',
                    'schedule_notifications_enabled' => true,
                ]
            );

            $mergedProfile = clone $userProfile;
            if ($adminProfile) {
                $mergedProfile->school_name = $adminProfile->school_name;
                $mergedProfile->school_level = $adminProfile->school_level;
                $mergedProfile->npsn = $adminProfile->npsn;
                $mergedProfile->nss = $adminProfile->nss;
                $mergedProfile->address = $adminProfile->address;
                $mergedProfile->principalName = $adminProfile->principalName;
                $mergedProfile->principalNip = $adminProfile->principalNip;
                $mergedProfile->active_semester = $adminProfile->active_semester;
                $mergedProfile->academic_year = $adminProfile->academic_year;
                $mergedProfile->logo_path = $adminProfile->logo_path;
                $mergedProfile->signature_path = $adminProfile->signature_path;
                $mergedProfile->school_days = $adminProfile->school_days;
                // Note: gemini_model and google_ai_api_key remain from $userProfile
            }
        }

        // Ensure teaching_time_slots is in the new multi-profile format
        if ($mergedProfile->teaching_time_slots) {
            $mergedProfile->teaching_time_slots = $this->formatTeachingTimeSlots($mergedProfile->teaching_time_slots);
        }

        // Mask API Key for security
        if ($mergedProfile->google_ai_api_key) {
            $key = $mergedProfile->google_ai_api_key;
            $len = strlen($key);
            if ($len > 8) {
                $mergedProfile->google_ai_api_key = substr($key, 0, 4) . '****' . substr($key, -4);
            } else {
                $mergedProfile->google_ai_api_key = '********';
            }
        }

        return response()->json([
            'profile' => $mergedProfile,
            'logo_url' => $mergedProfile->logo_path ? url('storage/' . $mergedProfile->logo_path) : null,
            'signature_url' => $mergedProfile->signature_path ? url('storage/' . $mergedProfile->signature_path) : null,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'username' => $user->username,
                'role' => $user->role,
                'nip' => $user->nip,
            ]
        ]);
    }

    /**
     * Ensure teaching_time_slots is in the multi-profile format
     */
    private function formatTeachingTimeSlots($data)
    {
        // If it's already in the new format { profiles: [...] }
        if (isset($data['profiles']) && is_array($data['profiles'])) {
            return $data;
        }

        // If it's the old format { "Senin": [...], ... }
        // Migrate to { profiles: [{ id: 'default', name: 'Default', is_active: true, slots: { ... } }] }
        return [
            'profiles' => [
                [
                    'id' => 'default',
                    'name' => 'Default',
                    'is_active' => true,
                    'slots' => $data
                ]
            ]
        ];
    }

    /**
     * Update user profile
     */
    public function update(Request $request)
    {
        \Illuminate\Support\Facades\Log::info('Profile update request matching: ', [
            'user_id' => $request->user()->id,
            'method' => $request->method(),
            'all' => $request->all(),
            'files' => array_keys($request->allFiles())
        ]);

        $user = $request->user();
        $isAdmin = ($user->role === 'admin' || $user->role === 'adminer');

        try {
            $rules = [
                'google_ai_api_key' => 'nullable|string|max:255',
                'gemini_model' => 'nullable|string|max:50',
                'schedule_notifications_enabled' => 'nullable',
                'audio_language' => 'nullable|string|max:20',
            ];

            // Only admin can update school data
            if ($isAdmin) {
                $rules = array_merge($rules, [
                    'school_name' => 'nullable|string|max:255',
                    'school_level' => 'nullable|in:SD,SMP,SMA,SMK',
                    'npsn' => 'nullable|string|max:50',
                    'nss' => 'nullable|string|max:50',
                    'address' => 'nullable|string',
                    'principalName' => 'nullable|string|max:255',
                    'principalNip' => 'nullable|string|max:50',
                    'logo' => 'nullable|image|mimes:jpeg,png,jpg,gif,webp|max:2048',
                    'signature' => 'nullable|image|mimes:jpeg,png,jpg,gif,webp|max:2048',
                    'academic_year' => 'nullable|string|max:20',
                    'active_semester' => 'nullable|in:Ganjil,Genap',
                    'school_days' => 'nullable|integer|in:5,6',
                    'teaching_time_slots' => 'nullable|array',
                ]);
            }

            $validated = $request->validate($rules);
        } catch (\Illuminate\Validation\ValidationException $e) {
            \Illuminate\Support\Facades\Log::error('Profile validation failed: ', [
                'user_id' => $user->id,
                'errors' => $e->errors(),
                'received' => $request->all()
            ]);
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $e->errors(),
            ], 422);
        }

        // Use shared profile for Admins school settings
$targetUserId = $isAdmin ? $this->getMasterAdminId() : $user->id;

        $profile = UserProfile::firstOrNew(['user_id' => $targetUserId]);

        // Use validated data instead of except() to ensure only allowed fields are saved
        $dataToSave = collect($validated)->forget(['logo', 'signature'])->toArray();
        
        // Explicitly handle boolean string from FormData
        if (isset($dataToSave['schedule_notifications_enabled'])) {
            $dataToSave['schedule_notifications_enabled'] = filter_var($dataToSave['schedule_notifications_enabled'], FILTER_VALIDATE_BOOLEAN);
        }

        // Ignore masked API Key in update
        if (isset($dataToSave['google_ai_api_key']) && str_contains($dataToSave['google_ai_api_key'], '****')) {
            unset($dataToSave['google_ai_api_key']);
        }

        // Handle logo upload AFTER collecting dataToSave
        if ($request->hasFile('logo')) {
            $file = $request->file('logo');
            \Illuminate\Support\Facades\Log::info('Logo detected in request: ' . $file->getClientOriginalName());
            
            if ($file->isValid()) {
                // Delete old logo if exists
                if ($profile->logo_path && \Illuminate\Support\Facades\Storage::disk('direct_public')->exists($profile->logo_path)) {
                    \Illuminate\Support\Facades\Storage::disk('direct_public')->delete($profile->logo_path);
                }
                
                // Store in school_logos folder inside public disk
                $path = $file->store('school_logos', 'direct_public');
                $profile->logo_path = $path;
                \Illuminate\Support\Facades\Log::info('Logo stored successfully at: ' . $path);
            } else {
                \Illuminate\Support\Facades\Log::error('Logo file is not valid: ' . $file->getErrorMessage());
            }
        }

        // Handle signature upload
        if ($request->hasFile('signature')) {
            $file = $request->file('signature');
            
            if ($file->isValid()) {
                // Delete old signature if exists
                if ($profile->signature_path && \Illuminate\Support\Facades\Storage::disk('direct_public')->exists($profile->signature_path)) {
                    \Illuminate\Support\Facades\Storage::disk('direct_public')->delete($profile->signature_path);
                }
                
                // Store in school_signatures folder
                $path = $file->store('school_signatures', 'direct_public');
                $profile->signature_path = $path;
                \Illuminate\Support\Facades\Log::info('Signature stored successfully at: ' . $path);
            }
        }

        \Illuminate\Support\Facades\Log::info('Saving profile data: ', [
            'target_user_id' => $targetUserId,
            'data' => $dataToSave,
            'logo_path_to_save' => $profile->logo_path
        ]);

        $profile->fill($dataToSave);
        // Ensure logo_path is NOT overwritten by fill if it was just updated by store()
        // but it's not in $dataToSave, so it should be fine.
        $saved = $profile->save();

        if ($saved) {
            \Illuminate\Support\Facades\Log::info('Profile saved successfully for user ' . $user->id . ' target ' . $targetUserId);
        } else {
            \Illuminate\Support\Facades\Log::error('Profile save FAILED for user ' . $user->id);
        }

        return response()->json([
            'message' => 'Profile updated successfully',
            'profile' => $profile,
            'logo_url' => $profile->logo_path ? url('storage/' . $profile->logo_path) : null,
            'signature_url' => $profile->signature_path ? url('storage/' . $profile->signature_path) : null,
        ]);
    }
}
