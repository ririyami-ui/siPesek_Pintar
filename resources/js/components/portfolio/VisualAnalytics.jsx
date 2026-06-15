import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const VisualAnalytics = ({ data, chapterId }) => {
    if (!data || data.length === 0) return (
        <div className="h-40 flex items-center justify-center bg-gray-50 rounded-xl border border-dashed text-gray-400 text-xs">
            Belum ada data visual untuk Bab {chapterId}
        </div>
    );

    const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316'];

    return (
        <div className="h-64 w-full" id="chart-to-export">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis 
                        dataKey="subject" 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false}
                        tick={{fill: '#9ca3af'}}
                    />
                    <YAxis fontSize={10} tickLine={false} axisLine={false} tick={{fill: '#9ca3af'}} />
                    <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                        cursor={{fill: '#f3f4f6'}}
                    />
                    <Bar dataKey="score" radius={[4, 4, 0, 0]} barSize={40}>
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

export default VisualAnalytics;
