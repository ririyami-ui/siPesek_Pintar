import React from 'react';
import { Line, Bar, Scatter, Pie, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const PRESET_COLORS = [
  'rgba(54, 162, 235, 0.8)',
  'rgba(255, 99, 132, 0.8)',
  'rgba(255, 206, 86, 0.8)',
  'rgba(75, 192, 192, 0.8)',
  'rgba(153, 102, 255, 0.8)',
  'rgba(255, 159, 64, 0.8)',
  'rgba(74, 222, 128, 0.8)',
];

const PRESET_BORDERS = [
  'rgb(54, 162, 235)',
  'rgb(255, 99, 132)',
  'rgb(255, 206, 86)',
  'rgb(75, 192, 192)',
  'rgb(153, 102, 255)',
  'rgb(255, 159, 64)',
  'rgb(74, 222, 128)',
];

const ChartRenderer = ({ config }) => {
  if (!config || !config.type) return null;

  const isPieOrDoughnut = config.type === 'pie' || config.type === 'doughnut';
  const safeData = Array.isArray(config.data) ? config.data : [];

  const chartData = {
    labels: safeData.map(d => d.x),
    datasets: [{
      label: config.title || 'Data',
      data: safeData.map(d => d.y),
      backgroundColor: isPieOrDoughnut ? PRESET_COLORS : PRESET_COLORS[0],
      borderColor: isPieOrDoughnut ? PRESET_BORDERS : PRESET_BORDERS[0],
      borderWidth: 1,
    }]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' },
      title: { display: !!config.title, text: config.title }
    },
    scales: isPieOrDoughnut ? {} : {
      y: { beginAtZero: true }
    }
  };

  return (
    <div className="chart-container" style={{ height: '300px', marginBottom: '1.5rem' }}>
      <div className="flex flex-col gap-4">
        <div style={{ height: '250px' }}>
          {config.type === 'line' && <Line data={chartData} options={chartOptions} />}
          {config.type === 'bar' && <Bar data={chartData} options={chartOptions} />}
          {config.type === 'scatter' && <Scatter data={chartData} options={chartOptions} />}
          {config.type === 'pie' && <Pie data={chartData} options={chartOptions} />}
          {config.type === 'doughnut' && <Doughnut data={chartData} options={chartOptions} />}
        </div>
        
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-xs border border-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 py-1 border">{config.xLabel || 'X'}</th>
                <th className="px-2 py-1 border">{config.yLabel || 'Y'}</th>
              </tr>
            </thead>
            <tbody>
              {safeData.map((row, idx) => (
                <tr key={idx}>
                  <td className="px-2 py-1 border font-medium">{row.x}</td>
                  <td className="px-2 py-1 border">{row.y}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ChartRenderer;
