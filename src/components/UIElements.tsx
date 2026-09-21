import React from 'react';
import { Route } from 'lucide-react';

/**
 * The Goal Path brand mark.
 *
 * Lucide's "route" icon: a winding path running from where you are to where you
 * are going, which is what the app does with a goal. Lucide is MIT licensed and
 * already the icon set for the rest of the interface, so the brand mark and the
 * product speak the same visual language.
 */
export const GoalPathMark: React.FC<{ className?: string }> = ({ className = '' }) => (
  <Route className={className} strokeWidth={2.2} aria-hidden="true" />
);

export const GoalPathLogo: React.FC<{ size?: 'sm' | 'md' | 'lg'; showText?: boolean; className?: string }> = ({
  size = 'md',
  showText = true,
  className = '',
}) => {
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-8 h-8 sm:w-9 sm:h-9',
    lg: 'w-10 h-10 sm:w-11 sm:h-11',
  };

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      <div
        className={`${iconSizes[size]} rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white shadow-sm flex items-center justify-center flex-shrink-0 overflow-hidden`}
      >
        <GoalPathMark className="w-[62%] h-[62%]" />
      </div>

      {showText && (
        <div className="hidden min-[360px]:flex flex-col">
          <div className="flex items-center gap-1 font-extrabold text-slate-900 tracking-tight leading-none text-[15px] sm:text-lg">
            <span>Goal</span>
            <span className="text-emerald-600 font-black">Path</span>
          </div>
          <span className="text-[10px] text-slate-400 font-semibold tracking-wide uppercase leading-tight hidden xs:block">
            Milestones & Focus
          </span>
        </div>
      )}
    </div>
  );
};

export const PriorityBadge: React.FC<{ priority?: 'high' | 'medium' | 'low' | string }> = ({ priority }) => {
  const colors: Record<string, string> = {
    high: 'bg-rose-100 text-rose-950 border-rose-300 font-bold',
    medium: 'bg-amber-50 text-amber-900 border-amber-200 font-semibold',
    low: 'bg-slate-100 text-slate-700 border-slate-200 font-medium',
  };
  return (
    <span className={`text-[10px] uppercase px-2 py-0.5 rounded-md border ${colors[priority || 'medium'] || colors.medium}`}>
      {priority || 'medium'}
    </span>
  );
};

export const ProgressBar: React.FC<{ value?: number; height?: string; color?: string }> = ({
  value = 0,
  height = 'h-2',
  color = 'bg-emerald-600',
}) => (
  <div className={`neu-inset-sm w-full rounded-full overflow-hidden ${height}`}>
    <div
      className={`${color} bar-grow h-full rounded-full transition-all duration-300 ease-out`}
      style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
    />
  </div>
);

/**
 * Clean tactile neu clickable icon button with clear affordance.
 */
export const GlassIconButton: React.FC<{
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  title?: string;
  variant?: 'purple' | 'emerald' | 'rose' | 'slate' | 'amber' | 'blue';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  disabled?: boolean;
  active?: boolean;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
}> = ({
  children,
  onClick,
  title,
  variant = 'emerald',
  size = 'md',
  disabled = false,
  active = false,
  className = '',
  type = 'button',
}) => {
  const sizeClasses = {
    xs: 'w-6 h-6 p-1 text-[11px] rounded-lg',
    sm: 'w-7 h-7 p-1.5 text-xs rounded-lg',
    md: 'w-8 h-8 p-1.5 text-xs rounded-xl',
    lg: 'w-9 h-9 sm:w-10 sm:h-10 p-2 text-sm rounded-xl',
  };

  const variantClasses = {
    purple: active
      ? 'bg-purple-600 text-white border-purple-500 shadow-xs ring-2 ring-purple-400/30'
      : 'bg-purple-500/10 hover:bg-purple-500/20 active:bg-purple-500/30 text-purple-700 hover:text-purple-900 border border-purple-300/30 hover:border-purple-400/50 backdrop-blur-xs shadow-2xs hover:shadow-xs',
    emerald: active
      ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs ring-2 ring-emerald-400/30'
      : 'bg-emerald-500/10 hover:bg-emerald-500/20 active:bg-emerald-500/30 text-emerald-700 hover:text-emerald-900 border border-emerald-300/30 hover:border-emerald-400/50 backdrop-blur-xs shadow-2xs hover:shadow-xs',
    rose: active
      ? 'bg-rose-600 text-white border-rose-500 shadow-xs ring-2 ring-rose-400/30'
      : 'bg-rose-500/10 hover:bg-rose-500/20 active:bg-rose-500/30 text-rose-600 hover:text-rose-800 border border-rose-300/30 hover:border-rose-400/50 backdrop-blur-xs shadow-2xs hover:shadow-xs',
    slate: active
      ? 'bg-slate-800 text-white border-slate-700 shadow-xs'
      : 'bg-slate-200/60 hover:bg-slate-200 active:bg-slate-300 text-slate-700 hover:text-slate-900 border border-slate-300/40 backdrop-blur-xs shadow-2xs hover:shadow-xs',
    amber: active
      ? 'bg-amber-600 text-white border-amber-500 shadow-xs ring-2 ring-amber-400/30'
      : 'bg-amber-500/10 hover:bg-amber-500/20 active:bg-amber-500/30 text-amber-800 hover:text-amber-950 border border-amber-300/40 hover:border-amber-400/60 backdrop-blur-xs shadow-2xs hover:shadow-xs',
    // Used while a professional works inside someone else's workspace.
    blue: active
      ? 'bg-blue-600 text-white border-blue-500 shadow-xs ring-2 ring-blue-400/30'
      : 'bg-blue-500/10 hover:bg-blue-500/20 active:bg-blue-500/30 text-blue-700 hover:text-blue-900 border border-blue-300/40 hover:border-blue-400/60 backdrop-blur-xs shadow-2xs hover:shadow-xs',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center justify-center transition-all duration-150 cursor-pointer select-none active:scale-95 disabled:opacity-35 disabled:pointer-events-none disabled:active:scale-100 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

export const GlassBadge: React.FC<{
  children: React.ReactNode;
  variant?: 'purple' | 'emerald' | 'amber' | 'slate' | 'blue';
  className?: string;
}> = ({ children, variant = 'emerald', className = '' }) => {
  const styles = {
    purple: 'bg-purple-500/10 text-purple-800 border-purple-300/40',
    emerald: 'bg-emerald-500/10 text-emerald-800 border-emerald-300/40',
    amber: 'bg-amber-500/10 text-amber-800 border-amber-300/40',
    blue: 'bg-blue-500/10 text-blue-800 border-blue-300/40',
    slate: 'bg-slate-200/50 text-slate-700 border-slate-300/40',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border backdrop-blur-xs shadow-2xs ${styles[variant]} ${className}`}
    >
      {children}
    </span>
  );
};


