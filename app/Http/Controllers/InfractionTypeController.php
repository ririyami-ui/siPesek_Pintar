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

        // If empty, return a default set but don't seed database yet (let frontend handle it or seed here)
        if ($types->isEmpty()) {
            $defaults = [
                ['name' => 'Tidur', 'points' => 5, 'sanction' => 'Teguran lisan'],
                ['name' => 'Mengganggu teman', 'points' => 10, 'sanction' => 'Teguran lisan & dicatat'],
                ['name' => 'Bertindak kurang sopan', 'points' => 15, 'sanction' => 'Teguran keras & pemanggilan orang tua'],
                ['name' => 'Ramai di kelas', 'points' => 5, 'sanction' => 'Teguran lisan'],
                ['name' => 'Tidak menghiraukan guru', 'points' => 10, 'sanction' => 'Teguran lisan & dicatat'],
                ['name' => 'Terlambat masuk kelas', 'points' => 5, 'sanction' => 'Teguran lisan'],
                ['name' => 'Sering ijin keluar', 'points' => 5, 'sanction' => 'Pembatasan ijin keluar'],
                ['name' => 'Bolos pelajaran', 'points' => 15, 'sanction' => 'Teguran keras & pemanggilan orang tua'],
                ['name' => 'Di luar kelas tanpa izin', 'points' => 5, 'sanction' => 'Teguran lisan'],
                ['name' => 'Membuang sampah sembarangan', 'points' => 5, 'sanction' => 'Teguran lisan'],
                ['name' => 'Mencontek', 'points' => 10, 'sanction' => 'Teguran lisan & dicatat'],
                ['name' => 'Berbohong', 'points' => 10, 'sanction' => 'Teguran lisan & dicatat'],
                ['name' => 'Perkelahian', 'points' => 20, 'sanction' => 'Pemanggilan orang tua & skorsing'],
                ['name' => 'Membawa barang terlarang', 'points' => 25, 'sanction' => 'Barang disita & pemanggilan orang tua'],
                ['name' => 'Membawa HP', 'points' => 10, 'sanction' => 'HP disita & teguran lisan'],
                ['name' => 'Merokok', 'points' => 20, 'sanction' => 'Pemanggilan orang tua & skorsing'],
                ['name' => 'Merusak fasilitas sekolah', 'points' => 25, 'sanction' => 'Ganti rugi & pemanggilan orang tua'],
            ];

            // Auto-seed for the current user if empty to ensure they see something
            foreach ($defaults as $d) {
                InfractionType::create([
                    'user_id' => Auth::id(),
                    'name' => $d['name'],
                    'points' => $d['points'],
                    'sanction' => $d['sanction'],
                ]);
            }
            $types = InfractionType::orderBy('name', 'asc')->get()->groupBy('name')->map->first()->values();
        }

        return response()->json($types);
    }

    /**
     * Store multiple infraction types at once.
     */
    public function bulkStore(Request $request)
    {
        $validated = $request->validate([
            'types' => 'required|array',
            'types.*.name' => 'required|string|max:255',
            'types.*.points' => 'required|integer',
            'types.*.sanction' => 'nullable|string',
        ]);

        $created = [];
        foreach ($validated['types'] as $typeData) {
            // Check if exists for this user to avoid duplicates
            $exists = InfractionType::where('user_id', Auth::id())
                ->where('name', $typeData['name'])
                ->exists();

            if (!$exists) {
                $created[] = InfractionType::create([
                    'user_id' => Auth::id(),
                    'name' => $typeData['name'],
                    'points' => $typeData['points'],
                    'sanction' => $typeData['sanction'] ?? 'Teguran sesuai aturan',
                ]);
            }
        }

        return response()->json([
            'message' => count($created) . ' types created.',
            'data' => $created
        ], 201);
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
        /** @var \App\Models\User $user */
        $user = Auth::user();
        if (!$user->isAdmin() && $infractionType->user_id !== Auth::id()) {
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
        /** @var \App\Models\User $user */
        $user = Auth::user();
        if (!$user->isAdmin() && $infractionType->user_id !== Auth::id()) {
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
        /** @var \App\Models\User $user */
        $user = Auth::user();
        if (!$user->isAdmin() && $infractionType->user_id !== Auth::id()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $infractionType->delete();
        return response()->json(['message' => 'Deleted successfully']);
    }
}
