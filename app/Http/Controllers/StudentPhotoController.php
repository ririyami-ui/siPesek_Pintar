<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use ZipArchive;

class StudentPhotoController extends Controller
{
    /**
     * Upload and extract student photos from a ZIP file
     */
    public function uploadZip(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:zip|max:51200', // Max 50MB ZIP
        ]);

        $file = $request->file('file');
        $zip = new ZipArchive;
        
        if ($zip->open($file->getRealPath()) === TRUE) {
            $extractedCount = 0;
            $skippedCount = 0;
            $errors = [];

            // Temporary extraction path
            $tempPath = storage_path('app/temp_photos_' . time());
            if (!is_dir($tempPath)) mkdir($tempPath, 0777, true);

            for ($i = 0; $i < $zip->numFiles; $i++) {
                $filename = $zip->getNameIndex($i);
                $fileInfo = pathinfo($filename);
                
                // Only process image files (png, jpg, jpeg)
                $extension = strtolower($fileInfo['extension'] ?? '');
                if (!in_array($extension, ['png', 'jpg', 'jpeg'])) {
                    continue;
                }

                // Get file content to check size
                $content = $zip->getFromIndex($i);
                $sizeInKb = strlen($content) / 1024;

                if ($sizeInKb > 300) {
                    $skippedCount++;
                    $errors[] = "File {$filename} dilewati karena ukuran > 300KB ({$sizeInKb} KB)";
                    continue;
                }

                // Save to public storage
                $newFilename = $fileInfo['basename']; // Keep original name (nisn.ext)
                Storage::disk('public')->put('student_photos/' . $newFilename, $content);
                $extractedCount++;
            }

            $zip->close();
            
            // Clean up temp
            if (is_dir($tempPath)) {
                $this->deleteDirectory($tempPath);
            }

            return response()->json([
                'message' => 'Proses ekstraksi selesai',
                'extracted' => $extractedCount,
                'skipped' => $skippedCount,
                'details' => $errors
            ]);
        } else {
            return response()->json(['message' => 'Gagal membuka file ZIP'], 422);
        }
    }

    /**
     * Delete directory helper
     */
    private function deleteDirectory($dir) {
        if (!file_exists($dir)) return true;
        if (!is_dir($dir)) return unlink($dir);
        foreach (scandir($dir) as $item) {
            if ($item == '.' || $item == '..') continue;
            if (!$this->deleteDirectory($dir . DIRECTORY_SEPARATOR . $item)) return false;
        }
        return rmdir($dir);
    }
}
