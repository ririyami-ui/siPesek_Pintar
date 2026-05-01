<?php

namespace App\Http\Controllers;

use App\Models\Admin;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AdminController extends Controller
{
    public function index()
    {
        $query = Admin::with('authUser');
        
        // All admins see everything, others only see their own created admins
        if (!Auth::user()->isAdmin()) {
            $query->where('user_id', Auth::id());
        }

        $admins = $query->orderBy('name')->get();
        return response()->json(['data' => $admins]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'code' => 'nullable|string',
            'name' => 'required|string',
            'nip' => 'nullable|string',
            'username' => 'nullable|string',
            'password' => 'nullable|string',
            'role' => 'nullable|string|in:admin,librarian',
        ]);

        $authUser = null;
        if (!empty($validated['username'])) {
            $email = str_contains($validated['username'], '@') ? $validated['username'] : $validated['username'] . '@smartschool.id';
            
            // Check if user already exists
            $existingUser = \App\Models\User::where('email', $email)->orWhere('username', $validated['username'])->first();
            
            if ($existingUser) {
                $authUser = $existingUser;
                $authUser->update([
                    'name' => $validated['name'],
                    'username' => $validated['username'],
                    'nip' => $validated['nip'],
                    'role' => $validated['role'] ?? 'admin'
                ]);
                if (!empty($validated['password'])) {
                    $authUser->update(['password' => \Illuminate\Support\Facades\Hash::make($validated['password'])]);
                }
            } else {
                $authUser = \App\Models\User::create([
                    'name' => $validated['name'],
                    'username' => $validated['username'],
                    'password' => \Illuminate\Support\Facades\Hash::make($validated['password'] ?? 'password123'),
                    'role' => $validated['role'] ?? 'admin',
                    'nip' => $validated['nip'],
                    'email' => $email,
                ]);
            }
        }

        // Remove password and role from the data to be saved to the admins table
        $adminData = $validated;
        unset($adminData['password']);
        unset($adminData['role']);

        $admin = Admin::create(array_merge($adminData, [
            'user_id' => Auth::id(),
            'auth_user_id' => $authUser ? $authUser->id : null
        ]));

        return response()->json($admin, 201);
    }

    public function show(Admin $admin)
    {
        if (!Auth::user()->isAdmin() && $admin->user_id !== Auth::id()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        return response()->json($admin);
    }

    public function update(Request $request, Admin $admin)
    {
        if (!Auth::user()->isAdmin() && $admin->user_id !== Auth::id()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'code' => 'nullable|string',
            'name' => 'required|string',
            'nip' => 'nullable|string',
            'username' => 'nullable|string',
            'password' => 'nullable|string',
            'role' => 'nullable|string|in:admin,librarian',
        ]);

        $adminData = $validated;
        unset($adminData['password']);
        unset($adminData['role']);
        $admin->update($adminData);

        if (!empty($validated['username'])) {
            $authUser = null;
            if ($admin->auth_user_id) {
                $authUser = \App\Models\User::find($admin->auth_user_id);
            }

            if ($authUser) {
                $userData = [
                    'name' => $validated['name'],
                    'username' => $validated['username'],
                    'nip' => $validated['nip'],
                ];
                if (!empty($validated['role'])) {
                    $userData['role'] = $validated['role'];
                }
                if (!empty($validated['password'])) {
                    $userData['password'] = \Illuminate\Support\Facades\Hash::make($validated['password']);
                }
                $authUser->update($userData);
            } else {
                $email = str_contains($validated['username'], '@') ? $validated['username'] : $validated['username'] . '@smartschool.id';
                
                // Check if user already exists by email
                $existingUser = \App\Models\User::where('email', $email)->orWhere('username', $validated['username'])->first();
                
                if ($existingUser) {
                    $authUser = $existingUser;
                    $userData = [
                        'name' => $validated['name'],
                        'username' => $validated['username'],
                        'nip' => $validated['nip'],
                    ];
                    if (!empty($validated['role'])) {
                        $userData['role'] = $validated['role'];
                    }
                    if (!empty($validated['password'])) {
                        $userData['password'] = \Illuminate\Support\Facades\Hash::make($validated['password']);
                    }
                    $authUser->update($userData);
                } else {
                    $authUser = \App\Models\User::create([
                        'name' => $validated['name'],
                        'username' => $validated['username'],
                        'password' => \Illuminate\Support\Facades\Hash::make($validated['password'] ?? 'password123'),
                        'role' => $validated['role'] ?? 'admin',
                        'nip' => $validated['nip'],
                        'email' => $email,
                    ]);
                }
                $admin->update(['auth_user_id' => $authUser->id]);
            }
        }

        return response()->json($admin);
    }

    public function destroy(Admin $admin)
    {
        if (!Auth::user()->isAdmin() && $admin->user_id !== Auth::id()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // Prevent self-deletion
        if ($admin->auth_user_id === Auth::id()) {
            return response()->json(['message' => 'You cannot delete your own account'], 403);
        }

        if ($admin->auth_user_id) {
            \App\Models\User::find($admin->auth_user_id)?->delete();
        }

        $admin->delete();
        return response()->json(null, 204);
    }
}
