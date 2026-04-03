<?php

namespace App\Http\Controllers;

use App\Models\InfractionType;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class InfractionTypeController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        // Return all infraction types, grouped by name to ensure no duplicates in the global view
        $types = InfractionType::orderBy('name', 'asc')->get()->groupBy('name')->map->first()->values();
        return response()->json($types);
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        //
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255|unique:infraction_types,name,NULL,id,user_id,' . Auth::id(),
            'points' => 'required|integer',
            'sanction' => 'nullable|string',
        ]);

        $type = InfractionType::create([
            'user_id' => Auth::id(),
            ...$validated
        ]);

        return response()->json($type, 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(InfractionType $infractionType)
    {
        if (!Auth::user()->isAdmin() && $infractionType->user_id !== Auth::id()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        return response()->json($infractionType);
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(InfractionType $infractionType)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, InfractionType $infractionType)
    {
        if (!Auth::user()->isAdmin() && $infractionType->user_id !== Auth::id()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255|unique:infraction_types,name,' . $infractionType->id . ',id,user_id,' . Auth::id(),
            'points' => 'sometimes|required|integer',
            'sanction' => 'nullable|string',
        ]);

        $infractionType->update($validated);
        return response()->json($infractionType);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(InfractionType $infractionType)
    {
        if (!Auth::user()->isAdmin() && $infractionType->user_id !== Auth::id()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $infractionType->delete();
        return response()->json(['message' => 'Deleted successfully']);
    }
}
