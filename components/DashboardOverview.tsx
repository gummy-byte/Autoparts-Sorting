import React from 'react';
import { Package, BarChart3, AlertCircle, Filter, LayoutDashboard } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { InventoryItem, CategoryStat } from '../types';
import StatCard from './StatCard';

interface DashboardOverviewProps {
  items: InventoryItem[];
  stats: CategoryStat[];
}

const COLORS = [
  '#ec4899', '#d946ef', '#f43f5e', '#fb7185', '#be185d', 
  '#9d174d', '#db2777', '#f472b6', '#fda4af', '#fce7f3'
];

const DashboardOverview: React.FC<DashboardOverviewProps> = ({ items, stats }) => {
  return (
    <div className="pb-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
        <StatCard title="Unique SKUs" value={items.length} icon={<Package />} color="pink" />
        <StatCard title="Total Inventory" value={items.reduce((a,b)=>a+b.qty, 0)} icon={<BarChart3 />} color="rose" />
        <StatCard title="Stock Alerts" value={items.filter(i=>i.qty<=0).length} icon={<AlertCircle />} color="fuchsia" subtitle="Low Qty" />
        <StatCard title="Segments" value={stats.length} icon={<Filter />} color="rose" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
        <div className="bg-white p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[2.5rem] border border-white shadow-xl">
          <h3 className="text-base sm:text-lg font-black text-slate-800 mb-6 sm:mb-8 flex items-center gap-3"><BarChart3 className="w-5 h-5 text-pink-500" />Top Categories</h3>
          <div className="h-64 sm:h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.slice(0, 8)} layout="vertical" margin={{ left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#fdf2f8" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: '#fff5f8' }} />
                <Bar dataKey="count" radius={[0, 14, 14, 0]} barSize={16}>
                  {stats.map((e, i) => <Cell key={`c-${i}`} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[2.5rem] border border-white shadow-xl">
          <h3 className="text-base sm:text-lg font-black text-slate-800 mb-6 sm:mb-8 flex items-center gap-3"><LayoutDashboard className="w-5 h-5 text-rose-500" />Distribution Mix</h3>
          <div className="h-64 sm:h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stats.slice(0, 6)} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={8} dataKey="count">
                  {stats.map((e, i) => <Cell key={`p-${i}`} fill={COLORS[i % COLORS.length]} stroke="white" strokeWidth={4} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardOverview;
