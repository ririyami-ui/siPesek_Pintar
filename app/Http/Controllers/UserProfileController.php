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
                $mergedProfile->school_days = $adminProfile->school_days;
                // Note: gemini_model and google_ai_api_key remain from $userProfile
            }
        }

        return response()->json([
            'profile' => $mergedProfile,
            'logo_url' => $mergedProfile->logo_path ? asset('storage/' . $mergedProfile->logo_path) : null,
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
            ];

            // Only admin can update school data
            if ($isAdmin) {
                $rules = array_merge($rules, [
                    'school_name' => 'nullable|string|max:255',
                    'school_level' => 'nullable|in:SD,SMP,SMA,SMK',
                    'npsn' => 'nullable|string|max:50',
                    'nss' => 'nullable|string|max:50',
                    'address' => 'nullable|string',
                    'logo' => 'nullable|image|mimes:jpeg,png,jpg,gif|max:2048',
                    'principalName' => 'nullable|string|max:255',
                    'principalNip' => 'nullable|string|max:50',
                    'academic_year' => 'nullable|string|max:20',
                    'active_semester' => 'nullable|in:Ganjil,Genap',
                    'school_days' => 'nullable|integer|in:5,6',
                ]);
            }

            $validated = $request->validate($rules);
        } catch (\Illuminate\Validation\ValidationException $e) {
            \Illuminate\Support\Facades\Log::warning('Profile validation failed: ', [
                'user_id' => $request->user()->id,
                'errors' => $e->errors(),
                'received' => $request->all()
            ]);
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $e->errors(),
                'received' => $request->all()
            ], 422);
        }

        // Use shared profile for Admins school settings
        $targetUserId = $isAdmin ? $this->getMasterAdminId() : $user->id;

        $profile = UserProfile::firstOrNew(['user_id' => $targetUserId]);

        // Handle logo upload
        if ($request->hasFile('logo')) {
            // Delete old logo if exists
            if ($profile->logo_path && \Illuminate\Support\Facades\Storage::disk('public')->exists($profile->logo_path)) {
                \Illuminate\Support\Facades\Storage::disk('public')->delete($profile->logo_path);
            }
            
            $path = $request->file('logo')->store('school_logos', 'public');
            $profile->logo_path = $path;
            \Illuminate\Support\Facades\Log::info('Logo uploaded: ' . $path);
        }

        // Use validated data instead of except() to ensure only allowed fields are saved
        $dataToSave = collect($validated)->except(['logo'])->toArray();
        
        // Explicitly handle boolean string from FormData
        if (isset($dataToSave['schedule_notifications_enabled'])) {
            $dataToSave['schedule_notifications_enabled'] = filter_var($dataToSave['schedule_notifications_enabled'], FILTER_VALIDATE_BOOLEAN);
        }

        \Illuminate\Support\Facades\Log::info('Saving profile data: ', [
            'target_user_id' => $targetUserId,
            'data' => $dataToSave
        ]);

        $profile->fill($dataToSave);
        $saved = $profile->save();

        if ($saved) {
            \Illuminate\Support\Facades\Log::info('Profile saved successfully for user ' . $user->id . ' target ' . $targetUserId);
        } else {
            \Illuminate\Support\Facades\Log::error('Profile save FAILED for user ' . $user->id);
        }

        return response()->json([
            'message' => 'Profile updated successfully',
            'profile' => $profile,
            'logo_url' => $profile->logo_path ? asset('storage/' . $profile->logo_path) : null,
        ]);
    }
}
