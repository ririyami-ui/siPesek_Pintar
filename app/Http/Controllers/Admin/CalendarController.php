<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\CalendarService;
use Illuminate\Http\Request;

class CalendarController extends Controller
{
    protected $calendarService;

    public function __construct(CalendarService $calendarService)
    {
        $this->calendarService = $calendarService;
    }

    public function getEffectiveWeeks(Request $request)
    {
        $request->validate([
            'academic_year' => 'required|string',
            'semester' => 'required|in:Ganjil,Genap',
        ]);

        $data = $this->calendarService->getEffectiveWeeks(
            $request->academic_year,
            $request->semester
        );

        return response()->json($data);
    }
}
