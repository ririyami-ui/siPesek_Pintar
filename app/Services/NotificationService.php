<?php

namespace App\Services;

use App\Models\SubstitutionRecommendation;
use App\Models\User;
use Illuminate\Support\Facades\Log;

class NotificationService
{
    /**
     * Send push notification to a specific user.
     *
     * @param User   $user
     * @param string $title
     * @param string $body
     * @param string $url
     */
    public function sendPush(User $user, string $title, string $body, string $url = '/'): void
    {
        if (!$user->push_subscription) {
            return;
        }

        try {
            $service = app(PushNotificationService::class);
            $service->send($user->push_subscription, [
                'title' => $title,
                'body'  => $body,
                'url'   => $url,
                'icon'  => '/Logo Smart Teaching Baru_.png',
            ]);
        } catch (\Throwable $e) {
            Log::error("Push notification failed for user {$user->id}: {$e->getMessage()}");
        }
    }

    /**
     * Notify substitute teacher about their new assignment.
     */
    public function notifySubstitution(SubstitutionRecommendation $rec): void
    {
        if (!$rec->substituteTeacher || !$rec->substituteTeacher->push_subscription) {
            return;
        }

        $subject = $rec->subject?->name ?? 'Mapel';
        $class   = $rec->class?->rombel ?? 'Kelas';
        $time    = $rec->start_time;

        $this->sendPush(
            $rec->substituteTeacher,
            "Tugas Menggantikan",
            "Anda ditugaskan menggantikan {$class} - {$subject} jam {$time}",
            '/'
        );
    }
}
