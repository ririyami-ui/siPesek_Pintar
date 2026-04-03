import React, { useState, useEffect } from 'react';
import api from '../lib/axios';
import moment from 'moment';
import { Calendar } from 'lucide-react';

const HolidayWidget = () => {
    const [upcomingHolidays, setUpcomingHolidays] = useState([]);
    const [loading, setLoading] = useState(true);
    const [nearestHoliday, setNearestHoliday] = useState(null);
    const [countdown, setCountdown] = useState('');

    useEffect(() => {
        const fetchHolidays = async () => {
            try {
                const response = await api.get('/holidays');
                const holidayList = response.data.data || response.data || [];
                const today = moment().startOf('day');

                const futureHolidays = holidayList
                    .map(h => {
                        const date = h.start_date || h.date;
                        const endDate = h.end_date ? moment(h.end_date) : moment(h.date);
                        return { ...h, sortDate: moment(date), endDate: endDate, name: h.title }; // Map title to name if needed
                    })
                    .filter(h => h.endDate.isAfter(today, 'day'))
                    .sort((a, b) => a.sortDate.diff(b.sortDate));

                setUpcomingHolidays(futureHolidays.slice(0, 5));

                if (futureHolidays.length > 0) {
                    setNearestHoliday(futureHolidays[0]);
                }
            } catch (error) {
                console.error("Error fetching holidays for widget:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchHolidays();
    }, []);

    useEffect(() => {
        if (nearestHoliday) {
            const updateCountdown = () => {
                const now = moment();
                const holidayDate = nearestHoliday.sortDate.clone().startOf('day');
                const duration = moment.duration(holidayDate.diff(now));
                const days = Math.ceil(duration.asDays());

                if (days === 0) {
                    setCountdown('Hari Ini!');
                } else if (days === 1) {
                    setCountdown('Besok!');
                } else {
                    setCountdown(`${days} Hari Lagi`);
                }
            };

            updateCountdown();
            const timer = setInterval(updateCountdown, 60000);
            return () => clearInterval(timer);
        }
    }, [nearestHoliday]);

    if (loading) return <div className="animate-pulse h-48 bg-gray-200 rounded-2xl"></div>;

    return (
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white p-6 rounded-2xl shadow-lg h-full flex flex-col relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                <Calendar size={120} />
            </div>

            <div className="flex items-center gap-2 mb-4 relative z-10">
                <Calendar size={24} className="text-white/90" />
                <h2 className="text-lg font-bold">Agenda Sekolah</h2>
            </div>

            {upcomingHolidays.length === 0 ? (
                <div className="flex flex-col items-center justify-center flex-1 text-white/80">
                    <p>Belum ada jadwal libur.</p>
                </div>
            ) : (
                <>
                    {nearestHoliday && (
                        <div className="mb-6 relative z-10">
                            <p className="text-sm text-indigo-100 mb-1">Libur Terdekat:</p>
                            <h3 className="text-2xl font-bold leading-tight">{nearestHoliday.name || nearestHoliday.title}</h3>
                            <div className="flex items-center gap-2 mt-2">
                                <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-sm">
                                    {nearestHoliday.start_date && nearestHoliday.end_date
                                        ? `${moment(nearestHoliday.start_date).format('DD MMM')} - ${moment(nearestHoliday.end_date).format('DD MMM')}`
                                        : moment(nearestHoliday.date).format('dddd, DD MMMM')}
                                </span>
                                <span className="bg-yellow-400 text-indigo-900 px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                                    {countdown}
                                </span>
                            </div>
                        </div>
                    )}

                    <div className="flex-1 overflow-y-auto space-y-3 relative z-10 pr-2 custom-scrollbar">
                        {upcomingHolidays.slice(1).map((h, index) => (
                            <div key={h.id} className={`flex items-center justify-between bg-white/10 p-2 rounded-lg backdrop-blur-sm border border-white/5 hover:bg-white/20 transition-colors ${index > 0 ? 'hidden md:flex' : 'flex'}`}>
                                <div>
                                    <p className="font-semibold text-sm truncate w-32 md:w-40">{h.name || h.title}</p>
                                    <p className="text-xs text-indigo-100">
                                        {h.start_date && h.end_date
                                            ? `${moment(h.start_date).format('DD MMM')} - ${moment(h.end_date).format('DD MMM')}`
                                            : moment(h.date).format('DD MMM YYYY')}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default HolidayWidget;
