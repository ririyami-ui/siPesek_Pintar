<?php

namespace App\Http\Controllers;

use App\Models\Announcement;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AnnouncementController extends Controller
{
    public function index(Request $request)
    {
        $user = auth()->user();
        $query = Announcement::query();

        if (!$user->isAdmin()) {
            $query->where(function ($q) use ($user) {
                $q->where('audience', 'all')
                    ->orWhere('audience', $user->role);
            });
        }

        if ($request->has('audience')) {
            $query->where('audience', $request->audience);
        }

        $query->orderBy('is_pinned', 'desc')
            ->orderBy('published_at', 'desc')
            ->orderBy('created_at', 'desc');

        return response()->json(['data' => $query->get()]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'content' => 'required|string',
            'audience' => 'required|in:all,admin,teacher,staff,student,parent',
            'is_pinned' => 'boolean',
            'published_at' => 'nullable|date',
        ]);

        $announcement = Announcement::create([
            ...$validated,
            'created_by' => Auth::id(),
            'is_pinned' => $validated['is_pinned'] ?? false,
            'published_at' => $validated['published_at'] ?? now(),
        ]);

        return response()->json(['data' => $announcement], 201);
    }

    public function update(Request $request, Announcement $announcement)
    {
        $validated = $request->validate([
            'title' => 'sometimes|required|string|max:255',
            'content' => 'sometimes|required|string',
            'audience' => 'sometimes|required|in:all,admin,teacher,staff,student,parent',
            'is_pinned' => 'boolean',
            'published_at' => 'nullable|date',
        ]);

        $announcement->update($validated);
        return response()->json(['data' => $announcement]);
    }

    public function destroy(Announcement $announcement)
    {
        $announcement->delete();
        return response()->json(null, 204);
    }
}