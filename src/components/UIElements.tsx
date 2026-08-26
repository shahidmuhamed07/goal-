import React from 'react';

export const PriorityBadge: React.FC<{ priority?: 'high' | 'medium' | 'low' | string }> = ({ priority }) => {
  const colors: Record<string, string> = {
    high: 'bg-rose-50 text-rose-700 border-rose-200',
    medium: 'bg-amber-50 text-amber-700 border-amber-200',
    low: 'bg-slate-100 text-slate-600 border-slate-200',
  };
  return (
    <span className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded-md border ${colors[priority || 'medium'] || colors.medium}`}>
      {priority || 'medium'}
    </span>
  );
};

export const ProgressBar: React.FC<{ value?: number; height?: string }> = ({ value = 0, height = 'h-2' }) => (
  <div className={`w-full bg-slate-100 rounded-full overflow-hidden ${height}`}>
    <div
      className="bg-emerald-600 h-full rounded-full transition-all duration-300 ease-out"
      style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
    />
  </div>
);
