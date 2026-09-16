<?php

namespace App\Http\Controllers;

use App\Exceptions\GeminiException;
use App\Services\GeminiService;
use Illuminate\Http\Request;

class GeminiProxyController extends Controller
{
    protected $geminiService;

    public function __construct(GeminiService $geminiService)
    {
        $this->geminiService = $geminiService;
    }

    /**
     * Generic proxy: frontend sends prompt + config, server resolves per-user key and calls Google.
     *
     * POST /api/ai/proxy
     * {
     *   "model": "gemini-3.5-flash",
     *   "prompt": "string" | [{"text":"..."} | {"inlineData":{...}}],
     *   "isJson": false,
     *   "maxTokens": 8192,
     *   "temperature": 0.7,
     *   "systemInstruction": "...",
     *   "apiKeyOverride": "..." (opsional, untuk tes key yang belum disimpan)
     * }
     */
    public function proxy(Request $request)
    {
        $validated = $request->validate([
            'model'             => 'nullable|string',
            'prompt'            => 'required',
            'isJson'            => 'nullable|boolean',
            'maxTokens'         => 'nullable|integer|min:1|max:65536',
            'temperature'       => 'nullable|numeric|min:0|max:2',
            'systemInstruction' => 'nullable|string|max:30000',
            'apiKeyOverride'    => 'nullable|string',
        ]);

        try {
            $contents = $this->normalizePrompt($validated['prompt']);

            $text = $this->geminiService->callGeminiApi(
                $contents,
                $validated['model'] ?? null,
                $validated['maxTokens'] ?? 4096,
                $validated['temperature'] ?? 0.7,
                $validated['systemInstruction'] ?? null,
                (bool) ($validated['isJson'] ?? false),
                $validated['apiKeyOverride'] ?? '',
            );

            return response()->json(['text' => $text]);
        } catch (GeminiException $e) {
            return response()->json(['message' => $e->getMessage()], 500);
        } catch (\Exception $e) {
            return response()->json(['message' => $e->getMessage()], 500);
        }
    }

    /**
     * Normalize frontend prompt into Gemini API contents format.
     *
     * String  → [{ role: 'user', parts: [{ text: '...' }] }]
     * Array   → [{ role: 'user', parts: [ ...normalized parts... ] }]
     */
    private function normalizePrompt(mixed $prompt): array
    {
        if (is_string($prompt)) {
            return [['role' => 'user', 'parts' => [['text' => $prompt]]]];
        }

        if (!is_array($prompt)) {
            return [['role' => 'user', 'parts' => [['text' => (string) $prompt]]]];
        }

        // Array of parts — each element is either string → {text} or object with inlineData
        $parts = [];
        foreach ($prompt as $item) {
            if (is_string($item)) {
                $parts[] = ['text' => $item];
            } elseif (is_array($item)) {
                // Already structured: {text:'...'} or {inlineData:{mimeType:'...', data:'...'}}
                $parts[] = $item;
            } else {
                $parts[] = ['text' => (string) $item];
            }
        }

        return [['role' => 'user', 'parts' => $parts]];
    }
}
