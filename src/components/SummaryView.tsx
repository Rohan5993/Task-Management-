import React from 'react';
import { useProject } from './ProjectProvider';
import { cn } from '../lib/utils';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { startOfWeek, endOfWeek, isWithinInterval, isSameWeek } from 'date-fns';
import { CheckCircle2, Clock, ListTodo, AlertCircle } from 'lucide-react';

export function SummaryView() {
  const { tasks, activeProject, epics } = useProject();

  if (!activeProject) return null;

  const now = new Date();
  const weekStart = startOfWeek(now);
  const weekEnd = endOfWeek(now);

  const completedThisWeek = tasks.filter(t => 
    t.status === 'Done' && t.updatedAt && isSameWeek(t.updatedAt, now)
  ).length;

  const inProgress = tasks.filter(t => t.status === 'Progress').length;
  const todo = tasks.filter(t => t.status === 'To Do').length;
  const review = tasks.filter(t => t.status === 'Review').length;

  const statusData = [
    { name: 'To Do', value: todo, color: '#94a3b8' },
    { name: 'In Progress', value: inProgress, color: '#3b82f6' },
    { name: 'Review', value: review, color: '#f59e0b' },
    { name: 'Done', value: tasks.filter(t => t.status === 'Done').length, color: '#10b981' },
  ];

  const stats = [
    { label: 'Completed this week', value: completedThisWeek, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'In Progress', value: inProgress, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Pending Review', value: review, icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Total Tasks', value: tasks.length, icon: ListTodo, color: 'text-slate-600', bg: 'bg-slate-50' },
  ];

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
              <stat.icon className={stat.color} size={16} />
            </div>
            <h3 className={cn("text-3xl font-bold mt-1", stat.color.includes('emerald') ? "text-emerald-600" : stat.color.includes('blue') ? "text-blue-600" : stat.color.includes('amber') ? "text-amber-600" : "text-slate-900")}>
              {stat.value}
            </h3>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Status Distribution</h3>
            <div className="flex gap-2">
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500"></span><span className="text-[10px] text-slate-500 font-bold uppercase">Active</span></div>
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500"></span><span className="text-[10px] text-slate-500 font-bold uppercase">Done</span></div>
            </div>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)', fontSize: '12px' }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Active Epics</h3>
            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded tracking-wider">ROADMAP</span>
          </div>
          <div className="space-y-6 flex-1 overflow-y-auto pr-2 custom-scrollbar">
            {epics.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50 grayscale">
                <ListTodo size={40} className="text-slate-300 mb-2" />
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No epics active</p>
              </div>
            ) : (
              epics.map(epic => {
                const epicTasks = tasks.filter(t => t.epicId === epic.id);
                const epicCompleted = epicTasks.filter(t => t.status === 'Done').length;
                const progress = epicTasks.length > 0 ? (epicCompleted / epicTasks.length) * 100 : 0;
                
                return (
                  <div key={epic.id} className="space-y-3 p-4 rounded-xl bg-slate-50 border border-slate-100 transition-all hover:bg-white hover:border-slate-200 hover:shadow-sm group">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                        <span className="text-xs font-bold text-slate-700 tracking-tight">{epic.name}</span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400">{epicCompleted}/{epicTasks.length} ISSUES</span>
                    </div>
                    <div className="w-full bg-slate-200/50 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className="bg-blue-600 h-full rounded-full transition-all duration-700 ease-out shadow-[0_0_8px_rgba(37,99,235,0.3)]" 
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
