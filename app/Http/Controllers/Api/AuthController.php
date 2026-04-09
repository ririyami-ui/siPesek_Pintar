<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Auth;

class AuthController extends Controller
{
    public function register(Request $request)
    {
        $validatedData = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:8',
            'role' => 'required|string|in:admin,teacher,staff',
            'nip' => 'nullable|string',
        ]);

        $user = User::create([
    'name' => $validatedData['name'],
    'email' => $validatedData['email'],
    'password' => Hash::make($validatedData['password']),
    'role' => $validatedData['role'],
    'nip' => $validatedData['nip'] ?? null,
]);

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'access_token' => $token,
            'token_type' => 'Bearer',
            'user' => $user,
        ]);
    }

    public function login(Request $request)
    {
        $input = $request->input('email');
        $password = $request->input('password');

        // Try as email
        $credentials = ['email' => $input, 'password' => $password];
        if (!Auth::attempt($credentials)) {
            // Try as username
            $credentials = ['username' => $input, 'password' => $password];
            if (!Auth::attempt($credentials)) {
                return response()->json([
                    'message' => 'Invalid login details. Please check your username/email and password.'
                ], 401);
            }
        }

        $user = Auth::user();
        
        // [DEVICE LOCK] Logic for students to bind account to 1 device
        if ($user->role === 'student') {
            $deviceId = $request->input('device_id');
            if ($deviceId) {
                if (!$user->device_id) {
                    // First time login - bind to this device
                    $user->device_id = $deviceId;
                    $user->save();
                } else if ($user->device_id !== $deviceId) {
                    // Already bound to another device
                    Auth::logout();
                    return response()->json([
                        'message' => 'Akun Anda sudah terikat ke perangkat lain. Silakan hubungi Admin untuk melakukan reset perangkat.'
                    ], 403);
                }
            }
        }

        // Update push subscription if provided
        if ($request->has('push_subscription')) {
            $user->push_subscription = $request->input('push_subscription');
            $user->save();
        }

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'access_token' => $token,
            'token_type' => 'Bearer',
            'user' => $user,
        ]);
    }

    public function me(Request $request)
    {
        return $request->user();
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Successfully logged out']);
    }

    /**
     * Save the Web Push subscription for the authenticated user.
     */
    public function savePushSubscription(Request $request)
    {
        $validated = $request->validate([
            'subscription' => 'required'
        ]);

        $user = auth()->user();
        $user->push_subscription = json_encode($request->input('subscription'));
        $user->save();

        return response()->json(['message' => 'Subscription saved successfully.']);
    }
}
