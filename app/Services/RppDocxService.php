<?php

/**
 * RppDocxService - Generate DOCX from RPP HTML content with native Word equations (OMML)
 * 
 * Flow:
 *   HTML (KaTeX spans) → MathML → OMML (Office Math) → docx library → Binary DOCX
 * 
 * @package App\Services
 */

namespace App\Services;

use Illuminate\Support\Facades\Log;
use App\Models\LessonPlan;
use League\CommonMark\GithubFlavoredMarkdownConverter;

class RppDocxService
{
    private string $nodeScriptPath;

    public function __construct()
    {
        $this->nodeScriptPath = base_path('convert-rpp-to-docx.js');
    }

    /**
     * Generate DOCX from RPP HTML content.
     *
     * @param string $htmlContent HTML content containing KaTeX rendered spans
     * @param array $metadata Subject, grade, topic for filename
     * @return \Symfony\Component\HttpFoundation\BinaryFileResponse
     */
    public function generateDocx(string $htmlContent, array $metadata = [])
    {
        // Sanitize filename
        $subjectName = $metadata['subject'] ?? 'RPP';
        $gradeLevel = $metadata['gradeLevel'] ?? 'X';
        $topic = $metadata['topic'] ?? 'Materi';
        
        $safeSubject = preg_replace('/[\/\\\\?%*:|"<>]/', '-', $subjectName);
        $safeTopic = preg_replace('/[\/\\\\?%*:|"<>]/', '-', substr($topic, 0, 30));
        $safeGrade = strval($gradeLevel);
        $fileName = "RPP_{$safeSubject}_{$safeGrade}_{$safeTopic}.docx";
        
        // Write temp HTML file for Node.js
        $tempDir = storage_path('app/temp-rpp');
        if (!is_dir($tempDir)) {
            mkdir($tempDir, 0755, true);
        }
        
        $htmlFile = $tempDir . '/' . uniqid('rpp_') . '.html';
        $outputFile = $tempDir . '/' . uniqid('output_') . '.docx';
        
        // RPP content is stored/generated as Markdown; convert to HTML before wrapping
        $htmlContent = $this->markdownToHtml($htmlContent);
        
        // Wrap HTML in full document with styling
        $fullHtml = $this->wrapHtml($htmlContent, $metadata);
        file_put_contents($htmlFile, $fullHtml);
        
        // Execute Node.js converter
        $nodePath = env('NODE_PATH', 'node');
        $command = sprintf(
            '%s "%s" "%s" "%s" 2>&1',
            $nodePath,
            $this->nodeScriptPath,
            escapeshellarg($htmlFile),
            escapeshellarg($outputFile)
        );
        
        Log::info("RppDocxService: Executing command: " . $command);
        
        $output = shell_exec($command);
        Log::info("RppDocxService: Node output: " . $output);
        
        // Check if output file was created
        if (!file_exists($outputFile)) {
            Log::error("RppDocxService: DOCX file was not created. Node output: " . $output);
            throw new \Exception("Gagal membuat file DOCX. Pastikan Node.js terinstall. Error: " . $output);
        }
        
        // Clean up temp HTML
        @unlink($htmlFile);
        
        return response()->download($outputFile, $fileName, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ])->deleteFileAfterSend(true);
    }

    /**
     * Generate DOCX from saved LessonPlan model.
     *
     * @param LessonPlan $lessonPlan
     * @return \Symfony\Component\HttpFoundation\BinaryFileResponse
     */
    public function generateFromModel(LessonPlan $lessonPlan)
    {
        return $this->generateDocx($lessonPlan->content, [
            'subject' => $lessonPlan->subject,
            'gradeLevel' => $lessonPlan->grade_level,
            'topic' => $lessonPlan->topic,
        ]);
    }

    /**
     * Convert Markdown content (GFM, incl. tables) to HTML for DOCX conversion.
     */
    private function markdownToHtml(string $markdown): string
    {
        $converter = new GithubFlavoredMarkdownConverter();
        return (string) $converter->convert($markdown);
    }

    /**
     * Wrap HTML content in full document with DOCX-friendly styling.
     */
    private function wrapHtml(string $content, array $metadata): string
    {
        $userName = $metadata['userName'] ?? '';
        $userNip = $metadata['userNip'] ?? '';
        $principalName = $metadata['principalName'] ?? '';
        $principalNip = $metadata['principalNip'] ?? '';
        $signingLocation = $metadata['signingLocation'] ?? 'Jakarta';
        $date = date('d F Y');
        $subjectName = $metadata['subject'] ?? '';
        $gradeLevel = $metadata['gradeLevel'] ?? '';
        $topic = $metadata['topic'] ?? '';

        return <<<HTML
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: 'Times New Roman', Arial, sans-serif;
            font-size: 11pt;
            line-height: 1.5;
            color: #000;
            margin: 2cm;
        }
        h1 { text-align: center; text-transform: uppercase; font-size: 14pt; border-bottom: 3px double #000; padding-bottom: 5px; }
        h2 { text-transform: uppercase; border-bottom: 2px solid #000; padding-bottom: 3px; font-size: 12pt; margin-top: 20px; }
        h3 { border-bottom: 1px solid #ccc; padding-bottom: 2px; font-size: 11pt; margin-top: 15px; }
        table { border-collapse: collapse; width: 100%; margin: 15px 0; }
        th, td { border: 1px solid black; padding: 8px; font-size: 11pt; color: #000; }
        th { background-color: #f0f0f0; font-weight: bold; }
        p { margin-bottom: 10px; text-align: justify; }
        ol, ul { padding-left: 30px; }
        li { margin-bottom: 5px; }
        .signature-table td, .signature-table th { border: none !important; }
        .mermaid, svg, [data-mermaid] { display: none; }
        .katex, .katex-display { display: inline; }
    </style>
</head>
<body>
    {$content}
    
    <table class="signature-table" style="border: none; margin-top: 50px; width: 100%;">
        <tr style="border: none;">
            <td align="center" style="border: none; width: 50%; vertical-align: top;">
                Mengetahui,<br/>
                Kepala Sekolah<br/><br/><br/><br/>
                <strong>{$principalName}</strong><br/>
                NIP. {$principalNip}
            </td>
            <td align="center" style="border: none; width: 50%; vertical-align: top;">
                {$signingLocation}, {$date}<br/>
                Guru Mata Pelajaran<br/><br/><br/><br/>
                <strong>{$userName}</strong><br/>
                NIP. {$userNip}
            </td>
        </tr>
    </table>
</body>
</html>
HTML;
    }
}
