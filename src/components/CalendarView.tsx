import React, { useState } from 'react';
import { useProject } from './ProjectProvider';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths,
  isToday
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';

export function CalendarView() {
  const { tasks, activeProject } = useProject();
  const [currentMonth, setCurrentMonth] = useState(new Date());

  if (!activeProject) return null;

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  return (
    <div className="p-8 h-full flex flex-col space-y-6 animate-in fade-in duration-500 overflow-hidden">
      <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white font-bold text-xs uppercase tracking-tighter shadow-sm shadow-slate-300">C</div>
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-tight">{format(currentMonth, 'MMMM yyyy')}</h2>
        </div>
        <div className="flex bg-slate-50 border border-slate-100 rounded-lg overflow-hidden p-0.5">
          <button onClick={prevMonth} className="p-1.5 hover:bg-white hover:shadow-sm rounded-md text-slate-400 hover:text-slate-900 transition-all">
            <ChevronLeft size={16} />
          </button>
          <button onClick={nextMonth} className="p-1.5 hover:bg-white hover:shadow-sm rounded-md text-slate-400 hover:text-slate-900 transition-all">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
        <div className="grid grid-cols-7 bg-slate-50/50 border-b border-slate-100">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="px-4 py-3 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {day}
            </div>
          ))}
        </div>
        
        <div className="flex-1 grid grid-cols-7 auto-rows-fr overflow-y-auto custom-scrollbar">
          {days.map((day, i) => {
            const dayTasks = tasks.filter(t => t.dueDate && isSameDay(t.dueDate, day));
            const isCurrentMonth = isSameMonth(day, monthStart);
            
            return (
              <div 
                key={day.toString()} 
                className={cn(
                  "min-h-[120px] p-3 border-r border-b border-slate-50 flex flex-col gap-2 transition-all hover:bg-slate-50/50 group",
                  !isCurrentMonth && "bg-slate-50/30 opacity-40 grayscale",
                  i % 7 === 6 && "border-r-0"
                )}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className={cn(
                    "text-[11px] font-bold w-6 h-6 flex items-center justify-center rounded-full transition-all",
                    isToday(day) ? "bg-blue-600 text-white shadow-[0_2px_8px_rgba(59,130,246,0.3)] scale-110" : isCurrentMonth ? "text-slate-400 group-hover:text-slate-900" : "text-slate-200"
                  )}>
                    {format(day, 'd')}
                  </span>
                </div>
                <div className="space-y-1.5 overflow-y-auto pr-1">
                  {dayTasks.map(task => (
                    <div 
                      key={task.id}
                      className={cn(
                        "px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-tight truncate border transition-all hover:scale-[1.02]",
                        task.status === 'Done' ? "bg-emerald-50 text-emerald-700 border-emerald-100/50" :
                        task.status === 'Progress' ? "bg-blue-50 text-blue-700 border-blue-100/50" :
                        task.status === 'Review' ? "bg-amber-50 text-amber-700 border-amber-100/50" :
                        "bg-white text-slate-400 border-slate-100"
                      )}
                      title={task.title}
                    >
                      {task.title}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
