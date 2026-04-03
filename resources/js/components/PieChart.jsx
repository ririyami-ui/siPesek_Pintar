import React from 'react';
import { PieChart as PieChartIcon, UserCheck, Stethoscope, DoorOpen, UserX } from 'lucide-react';

const PieChart = ({ data }) => {
  const categories = [
    { key: 'Hadir', label: 'Hadir', color: 'bg-green-500', barColor: '#22c55e', icon: <UserCheck size={14} className="text-white" /> },
    { key: 'Sakit', label: 'Sakit', color: 'bg-yellow-500', barColor: '#eab308', icon: <Stethoscope size={14} className="text-white" /> },
    { key: 'Ijin', label: 'Ijin', color: 'bg-blue-500', barColor: '#3b82f6', icon: <DoorOpen size={14} className="text-white" /> },
    { key: 'Alpha', label: 'Alpha', color: 'bg-red-500', barColor: '#ef4444', icon: <UserX size={14} className="text-white" /> },
  ];

  const total = categories.reduce((acc, cat) => acc + (data[cat.key] || 0), 0);
  const { schoolDays, studentCount } = data;

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 py-10 bg-gray-50 dark:bg-gray-900/20 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-800">
        <span className="text-sm font-medium">Tidak ada data kehadiran</span>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 h-full flex flex-col">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl text-blue-600">
          <PieChartIcon size={24} />
        </div>
        <div>
          <h2 className="text-lg sm:text-xl font-black text-gray-800 dark:text-white uppercase tracking-tight">Komposisi Kehadiran</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">Statistik presensi semester ini</p>
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-2xl border border-blue-100 dark:border-blue-800 mb-6">
        <div className="flex justify-between items-center text-[10px] font-black text-blue-700 dark:text-blue-300 uppercase tracking-widest">
          <span>Konteks Data</span>
          <span>{schoolDays || 0} Hari Efektif</span>
        </div>
        <div className="text-[10px] font-bold text-blue-600/70 dark:text-blue-400 mt-1">
          *Total Akumulasi = {studentCount || 0} Siswa x {schoolDays || 0} Hari
        </div>
      </div>

      <div className="space-y-5 flex-1">
        {categories.map((cat) => {
          const value = data[cat.key] || 0;
          const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
          const avgPerStudent = studentCount > 0 ? (value / studentCount).toFixed(1) : 0;

          return (
            <div key={cat.key} className="space-y-1.5">
              <div className="flex justify-between items-end">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-lg ${cat.color} shadow-sm flex items-center justify-center`}>
                    {cat.icon}
                  </div>
                  <div>
                    <span className="text-xs font-black text-gray-800 dark:text-gray-200 block leading-none mb-0.5">{cat.label}</span>
                    <span className="text-[10px] font-bold text-gray-400 block leading-none">Avg: {avgPerStudent} hr</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-black text-gray-900 dark:text-gray-100 mr-2">{value}</span>
                  <span className={`text-md font-black ${percentage > 10 ? 'text-gray-800 dark:text-white' : 'text-gray-400'}`}>{percentage}%</span>
                </div>
              </div>
              <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-full ${cat.color} rounded-full transition-all duration-1000 ease-out`}
                  style={{ width: `${percentage}%` }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="pt-4 mt-6 border-t border-dashed border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl">
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Log</span>
        <span className="text-lg font-black text-gray-800 dark:text-white">{total} <span className="text-[10px] font-bold text-gray-400">ENTRI</span></span>
      </div>
    </div>
  );
};

export default PieChart;
