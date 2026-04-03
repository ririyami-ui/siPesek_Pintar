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
}
