<?php

namespace App\Http\Controllers;

use App\Models\ClassAgreement;
use Illuminate\Http\Request;

class ClassAgreementController extends Controller
{
    public function show($classId)
    {
        $query = ClassAgreement::where('class_id', $classId);
        
        if (!auth()->user()->isAdmin()) {
            $query->where('user_id', auth()->id());
        }

        $agreement = $query->first();

        if (!$agreement) {
            // Return default values if not found, or 404?
            // Frontend expects defaults if not exists: 40, 60, 50, 50, ''
            return response()->json([
                'knowledge_weight' => 40,
                'practice_weight' => 60,
                'academic_weight' => 50,
                'attitude_weight' => 50,
                'agreements' => '',
            ]);
        }

        return response()->json($agreement);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'class_id' => 'required|exists:classes,id',
            'knowledge_weight' => 'required|integer|min:0|max:100',
            'practice_weight' => 'required|integer|min:0|max:100',
            'academic_weight' => 'required|integer|min:0|max:100',
            'attitude_weight' => 'required|integer|min:0|max:100',
            'agreements' => 'nullable|string',
        ]);

        $agreement = ClassAgreement::updateOrCreate(
            [
                'user_id' => auth()->id(),
                'class_id' => $validated['class_id'],
            ],
            [
                'knowledge_weight' => $validated['knowledge_weight'],
                'practice_weight' => $validated['practice_weight'],
                'academic_weight' => $validated['academic_weight'],
                'attitude_weight' => $validated['attitude_weight'],
                'agreements' => $validated['agreements'] ?? '',
            ]
        );

        return response()->json($agreement);
    }
}
