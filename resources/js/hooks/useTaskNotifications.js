import { useEffect, useState } from 'react';
import api from '../lib/axios';
import moment from 'moment';
import { LocalNotifications } from '@capacitor/local-notifications';

const useTaskNotifications = (activeSemester, academicYear) => {
    const [tasks, setTasks] = useState([]);

    useEffect(() => {
        const fetchTasks = async () => {
            try {
                const res = await api.get('/student-tasks', {
                    params: {
                        status: 'Pending',
                        semester: activeSemester,
                        academic_year: academicYear
                    }
                });
                const taskList = res.data.data || res.data || [];
                setTasks(taskList.map(t => ({ id: String(t.id), ...t })));
            } catch (error) {
                console.error("Error fetching tasks for notifications:", error);
                setTasks([]);
            }
        };
        fetchTasks();
    }, [activeSemester, academicYear]);

    useEffect(() => {
        const scheduleTaskNotifications = async () => {
            let permStatus = await LocalNotifications.checkPermissions();
            if (permStatus.display !== 'granted') {
                permStatus = await LocalNotifications.requestPermissions();
                if (permStatus.display !== 'granted') return;
            }

            await LocalNotifications.removeAllDeliveredNotifications();

            const pending = await LocalNotifications.getPending();
            const taskNotificationsToCancel = pending.notifications.filter(n => n.id.toString().startsWith('9'));

            if (taskNotificationsToCancel.length > 0) {
                await LocalNotifications.cancel({ notifications: taskNotificationsToCancel });
            }

            if (tasks.length === 0) return;

            const notificationsToSchedule = [];
            const now = moment();

            tasks.forEach((task) => {
                if (!task.deadline) return;

                const deadline = moment(task.deadline).startOf('day').hour(8); // Remind at 8 AM

                if (deadline.isAfter(now)) {
                    let hash = 0;
                    const taskIdStr = String(task.id);
                    for (let i = 0; i < taskIdStr.length; i++) {
                        hash = ((hash << 5) - hash) + taskIdStr.charCodeAt(i);
                        hash |= 0;
                    }
                    const uniqueIdSuffix = Math.abs(hash) % 1000000;
                    const id = 90000000 + uniqueIdSuffix;

                    notificationsToSchedule.push({
                        id: id,
                        title: 'Batas Waktu Tugas Hari Ini!',
                        body: `Tugas "${task.title}" kelas ${task.className} berakhir hari ini.`,
                        schedule: { at: deadline.toDate() },
                        sound: null,
                        extra: { taskId: task.id, type: 'task' }
                    });
                }
            });

            if (notificationsToSchedule.length > 0) {
                await LocalNotifications.schedule({ notifications: notificationsToSchedule });
                console.log(`Scheduled ${notificationsToSchedule.length} task notifications.`);
            }
        };

        scheduleTaskNotifications();
    }, [tasks]);

    return null;
};

export default useTaskNotifications;
