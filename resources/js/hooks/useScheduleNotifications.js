import { useEffect, useState } from 'react';
import api from '../lib/axios';
import moment from 'moment';
import { LocalNotifications } from '@capacitor/local-notifications';
import { useSettings } from '../utils/SettingsContext';

const useScheduleNotifications = () => {
  const { scheduleNotificationsEnabled } = useSettings();
  const [schedules, setSchedules] = useState([]);
  const [permissionGranted, setPermissionGranted] = useState(null);

  // Fetch schedules
  useEffect(() => {
    const fetchSchedules = async () => {
      try {
        const res = await api.get('/schedules');
        const scheduleList = res.data.data || res.data || [];
        setSchedules(scheduleList.map(s => ({ ...s, id: String(s.id) })));
      } catch (error) {
        console.error("Error fetching schedules for notifications:", error);
        setSchedules([]);
      }
    };
    fetchSchedules();
  }, []);

  // Check permissions once
  useEffect(() => {
    const checkPerms = async () => {
      if (!scheduleNotificationsEnabled) return;
      try {
        const permStatus = await LocalNotifications.checkPermissions();
        if (permStatus.display === 'granted') {
          setPermissionGranted(true);
        } else {
          const requestStatus = await LocalNotifications.requestPermissions();
          setPermissionGranted(requestStatus.display === 'granted');
        }
      } catch (e) {
        console.error("Error checking notification permissions:", e);
        setPermissionGranted(false);
      }
    };
    checkPerms();
  }, [scheduleNotificationsEnabled]);

  useEffect(() => {
    const scheduleNotifications = async () => {
      if (!scheduleNotificationsEnabled) {
        const pending = await LocalNotifications.getPending();
        const scheduleNotificationsToCancel = pending.notifications.filter(n => n.id.toString().startsWith('1'));

        if (scheduleNotificationsToCancel.length > 0) {
          await LocalNotifications.cancel({ notifications: scheduleNotificationsToCancel });
          console.log(`Cancelled ${scheduleNotificationsToCancel.length} disabled schedule notifications.`);
        }
        return;
      }

      if (permissionGranted !== true) return;

      await LocalNotifications.removeAllDeliveredNotifications();

      const pending = await LocalNotifications.getPending();
      const scheduleNotificationsToCancel = pending.notifications.filter(n => n.id.toString().startsWith('1'));

      if (scheduleNotificationsToCancel.length > 0) {
        await LocalNotifications.cancel({ notifications: scheduleNotificationsToCancel });
      }

      const notificationsToSchedule = [];
      const daysMap = {
        'Senin': 1, 'Selasa': 2, 'Rabu': 3, 'Kamis': 4, 'Jumat': 5, 'Sabtu': 6, 'Minggu': 0
      };

      schedules.forEach((schedule, index) => {
        const dayOfWeek = daysMap[schedule.day];
        if (dayOfWeek === undefined) return;

        if (!schedule.startTime || typeof schedule.startTime !== 'string' || !schedule.startTime.includes(':')) {
          return;
        }

        let [startHour, startMinute] = schedule.startTime.split(':').map(Number);
        startMinute -= 5;
        if (startMinute < 0) {
          startMinute += 60;
          startHour -= 1;
        }
        if (startHour < 0) startHour += 24;

        if (isNaN(startHour) || isNaN(startMinute)) {
          return;
        }

        const displayClass = typeof schedule.class === 'object' && schedule.class !== null
          ? schedule.class.rombel
          : schedule.class;

        const idString = `1${dayOfWeek}${startHour.toString().padStart(2, '0')}${startMinute.toString().padStart(2, '0')}${index.toString().padStart(2, '0')}`;

        notificationsToSchedule.push({
          id: parseInt(idString.substring(0, 9)),
          title: 'Jadwal Mengajar Segera Dimulai!',
          body: `${schedule.subject} di Kelas ${displayClass} akan dimulai dalam 5 menit.`,
          schedule: {
            on: {
              weekday: dayOfWeek,
              hour: startHour,
              minute: startMinute
            },
            repeats: true,
            allowWhileIdle: true
          },
          sound: null,
          extra: {
            scheduleId: schedule.id,
            subject: schedule.subject,
            class: displayClass,
            type: 'schedule'
          },
        });
      });

      if (notificationsToSchedule.length > 0) {
        await LocalNotifications.schedule({ notifications: notificationsToSchedule });
        console.log(`Re-scheduled ${notificationsToSchedule.length} class notifications.`);
      }
    };

    scheduleNotifications();

    const interval = setInterval(scheduleNotifications, 24 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [schedules, scheduleNotificationsEnabled]);

  return null;
};

export default useScheduleNotifications;
