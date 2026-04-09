<?php

namespace App\Services;

use App\Models\Student;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Minishlink\WebPush\WebPush;
use Minishlink\WebPush\Subscription;

class PushNotificationService
{
    /**
     * Send a Web Push notification to the parent/guardian of a student.
     *
     * @param int|Student $student The student object or ID
     * @param string $title Notification title
     * @param string $body Notification body
     * @param string $url URL to open when clicked
     * @return bool True if successfully queued/sent, false otherwise
     */
    public static function sendToStudentParent($student, string $title, string $body, string $url = '/student/dashboard')
    {
        try {
            if (!$student instanceof Student) {
                $student = Student::find($student);
            }

            if (!$student || !$student->auth_user_id) {
                return false; // Student not found or has no linked parent account
            }

            $user = User::find($student->auth_user_id);
            if (!$user || empty($user->push_subscription)) {
                return false; // Parent user not found or hasn't subscribed to PWA Push
            }

            $subscriptionData = json_decode($user->push_subscription, true);
            if (!is_array($subscriptionData) || !isset($subscriptionData['endpoint'])) {
                return false;
            }

            $auth = [
                'VAPID' => [
                    'subject' => env('VAPID_SUBJECT'),
                    'publicKey' => env('VAPID_PUBLIC_KEY'),
                    'privateKey' => env('VAPID_PRIVATE_KEY'),
                ],
            ];

            $webPush = new WebPush($auth);
            
            $subscription = Subscription::create([
                'endpoint' => $subscriptionData['endpoint'],
                'publicKey' => $subscriptionData['keys']['p256dh'] ?? null,
                'authToken' => $subscriptionData['keys']['auth'] ?? null,
            ]);

            $payload = json_encode([
                'title' => $title,
                'body' => $body,
                'url' => $url,
            ]);

            $report = $webPush->sendOneNotification($subscription, $payload);
            
            return $report->isSuccess();
        } catch (\Exception $e) {
            Log::error('Failed to send Push Notification: ' . $e->getMessage());
            return false;
        }
    }
}
