import React from 'react';

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  subtitle?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color, subtitle }) => {
  const map: any = { pink: 'bg-pink-50 text-pink-600 border-pink-100', rose: 'bg-rose-50 text-rose-600 border-rose-100', fuchsia: 'bg-fuchsia-50 text-fuchsia-600 border-fuchsia-100' };
  return (
    <div className="bg-white p-5 sm:p-8 rounded-[1.5rem] sm:rounded-[2.5rem] border border-white shadow-xl hover:-translate-y-1.5 transition-all duration-500 group">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl ${map[color] || map.pink} border transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6`}>
           {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { className: 'w-5 sm:w-7 h-5 sm:h-7' }) : icon}
        </div>
        {subtitle && <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.1em] sm:tracking-[0.2em] text-pink-300">{subtitle}</span>}
      </div>
      <p className="text-slate-400 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.1em] sm:tracking-[0.2em] mb-1 sm:mb-2">{title}</p>
      <p className="text-2xl sm:text-4xl font-black text-slate-800 tracking-tighter">{value.toLocaleString()}</p>
    </div>
  );
};

export default StatCard;
