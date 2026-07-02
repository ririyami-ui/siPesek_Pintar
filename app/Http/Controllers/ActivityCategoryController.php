<?php

namespace App\Http\Controllers;

use App\Models\ActivityCategory;
use Illuminate\Http\Request;

class ActivityCategoryController extends Controller
{
    public function index()
    {
        $categories = ActivityCategory::where('is_active', true)->orderBy('name')->get();
        return response()->json(['data' => $categories]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255|unique:activity_categories,name',
            'default_point' => 'integer|min:1|max:99',
            'icon' => 'nullable|string|max:50',
            'is_active' => 'boolean',
        ]);

        $category = ActivityCategory::create($validated);
        return response()->json(['data' => $category], 201);
    }

    public function update(Request $request, ActivityCategory $activityCategory)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255|unique:activity_categories,name,' . $activityCategory->id,
            'default_point' => 'integer|min:1|max:99',
            'icon' => 'nullable|string|max:50',
            'is_active' => 'boolean',
        ]);

        $activityCategory->update($validated);
        return response()->json(['data' => $activityCategory]);
    }

    public function destroy(ActivityCategory $activityCategory)
    {
        $activityCategory->delete();
        return response()->json(['message' => 'Kategori berhasil dihapus.']);
    }
}
