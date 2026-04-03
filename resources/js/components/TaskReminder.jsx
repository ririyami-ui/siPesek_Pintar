import React, { useState, useEffect } from 'react';
import api from '../lib/axios';
import { ClipboardList, AlertCircle, Clock, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import moment from 'moment';

const TaskReminder = ({ activeSemester, academicYear }) => {
    const [taskStats, setTaskStats] = useState({
        overdue: [],
        upcoming: [],
        total: 0
    });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const checkTasks = async () => {
            setIsLoading(true);
            try {
                const response = await api.get('/student-tasks', {
                    params: {
                        status: 'Pending',
                        semester: activeSemester,
                        academic_year: academicYear
                    }
                });
                const allPending = response.data.data || response.data || [];

                const today = moment().startOf('day');
                const overdue = [];
                const upcoming = [];

                allPending.forEach(task => {
                    const deadline = moment(task.deadline).startOf('day');
                    if (deadline.isBefore(today)) {
                        overdue.push(task);
                    } else if (deadline.diff(today, 'days') <= 2) {
                        upcoming.push(task);
                    }
                });

                setTaskStats({
                    overdue,
                    upcoming,
                    total: allPending.length
                });

            } catch (error) {
                console.error("Error checking student tasks:", error);
            } finally {
                setIsLoading(false);
            }
        };

        checkTasks();
    }, [activeSemester, academicYear]);

    if (isLoading || (taskStats.overdue.length === 0 && taskStats.upcoming.length === 0)) return null;

    const hasOverdue = taskStats.overdue.length > 0;

    return (
        <div className={`rounded-2xl p-5 mb-6 animate-in slide-in-from-top-4 duration-500 border ${hasOverdue
            ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
            : 'bg-indigo-50 dark:bg-indigo-900/10 border-indigo-200 dark:border-indigo-800'
            }`}>
            <div className="flex items-start justify-between">
                <div className="flex gap-4">
                    <div className={`p-3 rounded-xl shrink-0 ${hasOverdue
                        ? 'bg-red-100 dark:bg-red-800/30 text-red-600 dark:text-red-400'
                        : 'bg-indigo-100 dark:bg-indigo-800/30 text-indigo-600 dark:text-indigo-400'
                        }`}>
                        {hasOverdue ? <AlertCircle size={24} /> : <ClipboardList size={24} />}
                    </div>
                    <div>
                        <h3 className={`text-lg font-bold mb-1 ${hasOverdue ? 'text-red-800 dark:text-red-100' : 'text-indigo-800 dark:text-indigo-100'
                            }`}>
                            {hasOverdue
                                ? `Ada ${taskStats.overdue.length} Tugas Siswa Terlewat Deadline!`
                                : `Ada ${taskStats.upcoming.length} Tugas Siswa Mendekati Batas Waktu!`}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                            {hasOverdue
                                ? 'Pastikan untuk meninjau tugas yang terlambat dikumpulkan agar penilaian tetap berjalan lancar.'
                                : 'Ingatkan siswa untuk segera menyelesaikan tugas sebelum batas waktu berakhir.'}
                        </p>

                        <div className="space-y-2">
                            {[...taskStats.overdue, ...taskStats.upcoming].slice(0, 3).map((task, idx) => {
                                const isOverdue = moment(task.deadline).isBefore(moment(), 'day');
                                return (
                                    <div key={task.id} className="flex items-center gap-2 text-sm font-medium bg-white/50 dark:bg-black/20 px-3 py-2 rounded-lg border border-white/50 dark:border-white/5">
                                        <Clock size={14} className={isOverdue ? 'text-red-500' : 'text-indigo-500'} />
                                        <span className={`font-bold ${isOverdue ? 'text-red-700 dark:text-red-300' : 'text-indigo-700 dark:text-indigo-300'}`}>
                                            {moment(task.deadline).format('DD MMM')}
                                        </span>
                                        <span className="opacity-50 md:inline hidden">•</span>
                                        <span className="bg-gray-200/50 dark:bg-gray-700/50 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider">{task.class_name || task.className}</span>
                                        <span className="truncate max-w-[150px]">{task.title}</span>
                                    </div>
                                );
                            })}
                            {(taskStats.overdue.length + taskStats.upcoming.length) > 3 && (
                                <p className="text-xs font-bold text-gray-500 dark:text-gray-500 pl-1 italic">
                                    ...dan {(taskStats.overdue.length + taskStats.upcoming.length) - 3} tugas lainnya.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
                <Link
                    to="/penugasan"
                    className={`hidden sm:flex items-center gap-1 text-sm font-bold mt-1 ${hasOverdue ? 'text-red-700 hover:text-red-800' : 'text-indigo-700 hover:text-indigo-800'
                        } hover:underline`}
                >
                    Kelola Tugas <ChevronRight size={16} />
                </Link>
            </div>
            <Link
                to="/penugasan"
                className={`sm:hidden flex w-full justify-center items-center gap-2 mt-4 py-2 rounded-lg font-bold text-sm shadow-md active:scale-95 transition-transform ${hasOverdue ? 'bg-red-500 text-white' : 'bg-indigo-500 text-white'
                    }`}
            >
                Kelola Tugas <ChevronRight size={16} />
            </Link>
        </div>
    );
};

export default TaskReminder;
