<?php

namespace App\Services;

use Minishlink\WebPush\WebPush;
use Minishlink\WebPush\Subscription;
use Illuminate\Support\Facades\Log;

/**
 * Service wrapper around minishlink/web-push.
 * Requires composer package `minishlink/web-push` and VAPID keys in .env
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
 */
class PushNotificationService
{
    /** @var WebPush */
    protected $webPush;

    public function __construct()
    {
        $vapid = [
            'VAPID' => [
                'subject' => env('VAPID_SUBJECT', 'mailto:admin@smartschool.id'),
                'publicKey' => env('VAPID_PUBLIC_KEY'),
                'privateKey' => env('VAPID_PRIVATE_KEY'),
            ],
        ];
        $this->webPush = new WebPush($vapid);
    }

    /**
     * Send a notification to a stored subscription JSON.
     *
     * @param string $subscriptionJson JSON string stored in users.push_subscription
     * @param array  $payload          ['title'=>..,'body'=>..,'url'=>..,'icon'=>..]
     */
    public function send(string $subscriptionJson, array $payload): void
    {
        try {
            $subscription = Subscription::create(json_decode($subscriptionJson, true));
            $this->webPush->sendOneNotification($subscription, json_encode($payload));
            // Flush queue – ensure delivery (or log failures)
            foreach ($this->webPush->flush() as $report) {
                if ($report->isSuccess()) {
                    Log::info('Push sent to endpoint: ' . $report->getRequest()->getUri()->__toString());
                } else {
                    Log::warning('Push failed: ' . $report->getReason());
                }
            }
        } catch (\Throwable $e) {
            Log::error('Push notification error: ' . $e->getMessage());
        }
    }

    /**
     * Send push notification to a student's auth user account.
     *
     * @param int    $studentId
     * @param string $title
     * @param string $body
     * @param string $url
     */
    public static function sendToStudentParent(int $studentId, string $title, string $body, string $url = '/'): void
    {
        try {
            $student = \App\Models\Student::with('user')->find($studentId);
            if (!$student || !$student->user || !$student->user->push_subscription) {
                return;
            }

            $name = $student->name ?? 'Ananda';
            $fullName = 'Ananda ' . $name;

            $service = new self();
            $service->send($student->user->push_subscription, [
                'title' => $title,
                'body'  => $fullName . ' — ' . $body,
                'url'   => $url,
                'icon'  => '/Logo Smart Teaching Baru_.png',
            ]);
        } catch (\Throwable $e) {
            Log::error("sendToStudentParent failed for student {$studentId}: {$e->getMessage()}");
        }
    }
}
?>
