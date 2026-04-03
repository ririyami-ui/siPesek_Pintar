import React, { useMemo } from 'react';
import { BookOpen, AlertCircle, CheckCircle2, HelpCircle } from 'lucide-react';

const TopicMasteryHeatmap = ({ grades = [] }) => {
    // 1. Group grades by Material/Topic
    const topicStats = useMemo(() => {
        const stats = {};

        grades.forEach(grade => {
            // Use 'material' or 'topic' field, fallback to 'Unknown Topic'
            // Clean up the topic string to handle slight variations if necessary
            const topic = grade.material || grade.topic || 'Materi Umum';

            if (!stats[topic]) {
                stats[topic] = {
                    name: topic,
                    totalScore: 0,
                    count: 0,
                    passedCount: 0, // Score >= 75 (KKTP assumption)
                    scores: []
                };
            }

            const score = parseFloat(grade.score);
            if (!isNaN(score)) {
                stats[topic].totalScore += score;
                stats[topic].count += 1;
                stats[topic].scores.push(score);
                if (score >= 75) {
                    stats[topic].passedCount += 1;
                }
            }
        });

        // 2. Calculate Averages and Mastery Levels
        return Object.values(stats).map(item => {
            const avg = item.count > 0 ? item.totalScore / item.count : 0;
            const masteryRate = item.count > 0 ? (item.passedCount / item.count) * 100 : 0;

            let status = 'mastered';
            let colorClass = 'bg-green-100 border-green-200 text-green-800 dark:bg-green-900/30 dark:border-green-800 dark:text-green-200';
            let icon = <CheckCircle2 size={18} className="text-green-600 dark:text-green-400" />;

            if (avg < 70) {
                status = 'critical';
                colorClass = 'bg-red-100 border-red-200 text-red-800 dark:bg-red-900/30 dark:border-red-800 dark:text-red-200';
                icon = <AlertCircle size={18} className="text-red-600 dark:text-red-400" />;
            } else if (avg < 80) {
                status = 'warning';
                colorClass = 'bg-yellow-100 border-yellow-200 text-yellow-800 dark:bg-yellow-900/30 dark:border-yellow-800 dark:text-yellow-200';
                icon = <HelpCircle size={18} className="text-yellow-600 dark:text-yellow-400" />;
            }

            return {
                ...item,
                avg: avg.toFixed(1),
                masteryRate: masteryRate.toFixed(0),
                status,
                colorClass,
                icon
            };
        }).sort((a, b) => parseFloat(a.avg) - parseFloat(b.avg)); // Sort Lowest to Highest (Critical first)
    }, [grades]);

    if (grades.length === 0) return null;

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 h-full flex flex-col">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-xl text-purple-600">
                    <BookOpen size={24} />
                </div>
                <div>
                    <h2 className="text-lg sm:text-xl font-black text-gray-800 dark:text-white uppercase tracking-tight">Peta Sebaran Kompetensi</h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Analisis penguasaan materi per topik</p>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-5">
                {topicStats.map((topic, idx) => (
                    <div key={idx} className="space-y-1.5">
                        <div className="flex justify-between items-end">
                            <div className="flex items-center gap-2 max-w-[70%]">
                                <div className={`w-8 h-8 shrink-0 rounded-lg ${topic.colorClass.split(' ')[0]} flex items-center justify-center`}>
                                    {topic.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <span className="text-xs font-black text-gray-800 dark:text-gray-200 block leading-tight truncate" title={topic.name}>
                                        {topic.name}
                                    </span>
                                    <span className="text-[10px] font-bold text-gray-400 block leading-none mt-0.5 whitespace-nowrap">
                                        Ketuntasan: {topic.masteryRate}% ({topic.passedCount}/{topic.count})
                                    </span>
                                </div>
                            </div>
                            <div className="text-right shrink-0">
                                <span className={`text-md font-black ${topic.status === 'critical' ? 'text-red-500' : topic.status === 'warning' ? 'text-yellow-600' : 'text-green-600'}`}>
                                    {topic.avg}
                                </span>
                                <span className="text-[10px] font-bold text-gray-400 block leading-none">RATA-RATA</span>
                            </div>
                        </div>
                        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                            <div
                                className={`h-full ${topic.status === 'critical' ? 'bg-red-500' : topic.status === 'warning' ? 'bg-yellow-500' : 'bg-green-500'} rounded-full transition-all duration-1000 ease-out`}
                                style={{ width: `${Math.min(topic.avg, 100)}%` }}
                            ></div>
                        </div>
                        {topic.status === 'critical' && (
                            <p className="text-[9px] font-bold text-red-500 italic mt-0.5 pl-10">*Perlu Remedial Klasikal</p>
                        )}
                    </div>
                ))}
            </div>

            <div className="pt-4 mt-6 border-t border-dashed border-gray-200 dark:border-gray-700 flex flex-wrap gap-4 justify-center text-[10px] uppercase font-bold text-gray-400">
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-red-500"></div> &lt;70 (Kurang)
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-yellow-500"></div> 70-80 (Cukup)
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div> &gt;80 (Baik)
                </div>
            </div>
        </div>
    );
};

export default TopicMasteryHeatmap;
