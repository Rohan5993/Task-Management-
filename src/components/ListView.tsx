import React, { useState } from 'react';
import { useProject } from './ProjectProvider';
import { 
  Plus, 
  Search, 
  MoreVertical, 
  ChevronRight, 
  ChevronDown,
  User,
  Calendar as CalendarIcon,
  Tag
} from 'lucide-react';
import { Task, TaskStatus, UserProfile } from '../types';
import { cn } from '../lib/utils';
import { addDoc, collection, serverTimestamp, updateDoc, doc, getDocs, query, where, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { format } from 'date-fns';
import { handleFirestoreError, OperationType } from '../lib/firebase-utils';
import { Loader2 } from 'lucide-react';

interface ListViewProps {
  onSelectTask?: (taskId: string) => void;
}

export function ListView({ onSelectTask }: ListViewProps) {
  const { tasks, epics, activeProject, members, error: projectError } = useProject();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddingTask, setIsAddingTask] = useState<boolean | string>(false); // string means parentTaskId
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<TaskStatus>('To Do');
  const [selectedEpic, setSelectedEpic] = useState<string>('');
  const [selectedAssignee, setSelectedAssignee] = useState<string>('');
  const [selectedStartDate, setSelectedStartDate] = useState('');
  const [expandedEpics, setExpandedEpics] = useState<Set<string>>(new Set());
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  if (!activeProject) return null;

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const tasksPath = `projects/${activeProject.id}/tasks`;
      await addDoc(collection(db, tasksPath), {
        title: newTaskTitle,
        status: selectedStatus,
        epicId: selectedEpic || null,
        parentTaskId: typeof isAddingTask === 'string' ? isAddingTask : null,
        assigneeId: selectedAssignee || null,
        startDate: selectedStartDate ? Timestamp.fromDate(new Date(selectedStartDate)) : null,
        projectId: activeProject.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setNewTaskTitle('');
      setSelectedEpic('');
      setSelectedAssignee('');
      setSelectedStartDate('');
      setIsAddingTask(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `projects/${activeProject.id}/tasks`);
      setErrorMessage('Failed to create task. Please check your permissions.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    try {
      await updateDoc(doc(db, 'projects', activeProject.id, 'tasks', taskId), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `projects/${activeProject.id}/tasks/${taskId}`);
    }
  };

  const toggleEpic = (epicId: string) => {
    const next = new Set(expandedEpics);
    if (next.has(epicId)) next.delete(epicId);
    else next.add(epicId);
    setExpandedEpics(next);
  };

  const toggleTask = (taskId: string) => {
    const next = new Set(expandedTasks);
    if (next.has(taskId)) next.delete(taskId);
    else next.add(taskId);
    setExpandedTasks(next);
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!activeProject || !window.confirm('Are you sure you want to delete this task?')) return;
    try {
      await deleteDoc(doc(db, 'projects', activeProject.id, 'tasks', taskId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `projects/${activeProject.id}/tasks/${taskId}`);
    }
  };

  const filteredTasks = tasks.filter(t => 
    t.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const mainTasks = filteredTasks.filter(t => !t.parentTaskId);
  const subtasks = filteredTasks.filter(t => t.parentTaskId);

  const tasksByEpic = epics.reduce((acc, epic) => {
    acc[epic.id] = mainTasks.filter(t => t.epicId === epic.id);
    return acc;
  }, {} as Record<string, Task[]>);

  const noEpicTasks = mainTasks.filter(t => !t.epicId);

  const StatusBadge = ({ status }: { status: TaskStatus }) => {
    const colors = {
      'To Do': 'bg-slate-100 text-slate-700',
      'Progress': 'bg-blue-100 text-blue-700',
      'Review': 'bg-amber-100 text-amber-700',
      'Done': 'bg-emerald-100 text-emerald-700',
    };
    return (
      <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-medium", colors[status])}>
        {status}
      </span>
    );
  };

  return (
    <div className="p-8 space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
          <button 
            onClick={() => setIsAddingTask(true)}
            className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-[0.98]"
          >
            <Plus size={14} />
            Create Issue
          </button>
          <div className="h-4 w-[1px] bg-slate-200 mx-2"></div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Search issues..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-1.5 bg-transparent text-[11px] font-bold text-slate-600 focus:outline-none w-48 placeholder:text-slate-300"
            />
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100 bg-slate-50/50">
              <th className="px-6 py-4 tracking-widest w-12"></th>
              <th className="px-6 py-4 tracking-widest">Issue / Epic</th>
              <th className="px-6 py-4 tracking-widest">Status</th>
              <th className="px-6 py-4 tracking-widest">Assignee</th>
              <th className="px-6 py-4 tracking-widest">Start Date</th>
              <th className="px-6 py-4 tracking-widest w-12"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {/* Epics Sections */}
            {epics.map(epic => (
              <React.Fragment key={epic.id}>
                <tr className="bg-slate-50/30 hover:bg-slate-50 transition-colors cursor-pointer group" onClick={() => toggleEpic(epic.id)}>
                  <td className="px-6 py-4">
                    {expandedEpics.has(epic.id) ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                  </td>
                  <td className="px-6 py-4 flex items-center gap-2" colSpan={4}>
                    <div className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.4)]"></div>
                    <span className="text-[11px] font-bold text-slate-700 uppercase tracking-tight">{epic.name}</span>
                    <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded tracking-wider ml-2">EPIC</span>
                  </td>
                  <td className="px-6 py-4"></td>
                </tr>
                {expandedEpics.has(epic.id) && tasksByEpic[epic.id].map(task => (
                  <React.Fragment key={task.id}>
                    <TaskRow 
                      task={task} 
                      members={members} 
                      onStatusChange={handleStatusChange} 
                      onDeleteTask={handleDeleteTask}
                      hasSubtasks={subtasks.some(s => s.parentTaskId === task.id)}
                      isExpanded={expandedTasks.has(task.id)}
                      onToggle={() => toggleTask(task.id)}
                      onAddSubtask={() => setIsAddingTask(task.id)}
                      onSelectTask={onSelectTask}
                    />
                    {expandedTasks.has(task.id) && subtasks.filter(s => s.parentTaskId === task.id).map(sub => (
                      <React.Fragment key={sub.id}>
                        <TaskRow 
                          task={sub} 
                          members={members} 
                          onStatusChange={handleStatusChange} 
                          onDeleteTask={handleDeleteTask}
                          isSubtask 
                          onSelectTask={onSelectTask}
                        />
                      </React.Fragment>
                    ))}
                  </React.Fragment>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {isAddingTask && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 animate-in zoom-in duration-200">
            <h2 className="text-xl font-bold mb-4">{typeof isAddingTask === 'string' ? 'Add Subtask' : 'Create New Task'}</h2>
            <form onSubmit={handleAddTask} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                <input
                  autoFocus
                  type="text"
                  required
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="What needs to be done?"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select 
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value as TaskStatus)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="To Do">To Do</option>
                  <option value="Progress">In Progress</option>
                  <option value="Review">Review</option>
                  <option value="Done">Done</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Epic</label>
                  <select 
                    value={selectedEpic}
                    onChange={(e) => setSelectedEpic(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={typeof isAddingTask === 'string'}
                  >
                    <option value="">No Epic</option>
                    {epics.map(epic => (
                      <option key={epic.id} value={epic.id}>{epic.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Assignee</label>
                  <select 
                    value={selectedAssignee}
                    onChange={(e) => setSelectedAssignee(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Unassigned</option>
                    {members.map(member => (
                      <option key={member.uid} value={member.uid}>{member.displayName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={selectedStartDate}
                    onChange={(e) => setSelectedStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsAddingTask(false)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                  {isSubmitting ? 'Creating...' : 'Create Task'}
                </button>
              </div>
              {errorMessage && (
                <p className="mt-3 text-xs font-bold text-red-500 uppercase tracking-widest text-center animate-in fade-in slide-in-from-top-1">
                  {errorMessage}
                </p>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function TaskRow({ 
  task, 
  members, 
  onStatusChange, 
  isSubtask, 
  hasSubtasks, 
  isExpanded, 
  onToggle,
  onAddSubtask,
  onSelectTask,
  onDeleteTask
}: { 
  task: Task; 
  members: UserProfile[]; 
  onStatusChange: (taskId: string, newStatus: TaskStatus) => Promise<void>; 
  isSubtask?: boolean;
  hasSubtasks?: boolean;
  isExpanded?: boolean;
  onToggle?: () => void;
  onAddSubtask?: () => void;
  onSelectTask?: (taskId: string) => void;
  onDeleteTask?: (taskId: string) => Promise<void>;
}) {
  const assignee = members.find(m => m.uid === task.assigneeId);
  const [showMenu, setShowMenu] = useState(false);

  return (
    <tr className={cn(
      "hover:bg-slate-50/80 transition-all group border-b border-slate-50 last:border-0",
      isSubtask && "bg-slate-50/20"
    )}>
      <td className="px-6 py-4">
        {hasSubtasks ? (
          <button onClick={onToggle} className="p-1 hover:bg-slate-100 rounded text-slate-400">
            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        ) : isSubtask && (
          <div className="w-1.5 h-1.5 rounded-full bg-slate-300 ml-2"></div>
        )}
      </td>
      <td className="px-6 py-4">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span 
              onClick={() => onSelectTask?.(task.id)}
              className={cn(
                "text-sm font-bold text-slate-700 group-hover:text-blue-600 transition-colors tracking-tight cursor-pointer",
                isSubtask && "text-slate-500 font-medium"
              )}
            >
              {task.title}
            </span>
            {!isSubtask && (
              <button 
                onClick={onAddSubtask}
                className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all"
                title="Add Subtask"
              >
                <Plus size={10} />
              </button>
            )}
          </div>
          <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mt-0.5">#{task.id.slice(-4)}</span>
        </div>
      </td>
      <td className="px-6 py-4">
        <select 
          value={task.status}
          onChange={(e) => onStatusChange(task.id, e.target.value as TaskStatus)}
          className={cn(
            "text-[10px] font-bold uppercase px-3 py-1 rounded-full border-none focus:ring-0 cursor-pointer transition-all",
            task.status === 'To Do' && "bg-slate-100 text-slate-500",
            task.status === 'Progress' && "bg-blue-100 text-blue-700",
            task.status === 'Review' && "bg-amber-100 text-amber-700",
            task.status === 'Done' && "bg-emerald-100 text-emerald-700"
          )}
        >
          <option value="To Do">To Do</option>
          <option value="Progress">Progress</option>
          <option value="Review">Review</option>
          <option value="Done">Done</option>
        </select>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          {assignee ? (
            <div title={`Assignee: ${assignee.displayName}`} className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 text-[10px] font-bold shadow-sm">
              {assignee.displayName.charAt(0)}
            </div>
          ) : (
            <div className="w-6 h-6 rounded-full border border-slate-200 border-dashed bg-transparent flex items-center justify-center text-slate-300">
              <User size={10} />
            </div>
          )}
          
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight truncate max-w-[80px]">
            {assignee?.displayName || 'Unassigned'}
          </span>
        </div>
      </td>
      <td className="px-6 py-4">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
          {task.startDate ? format(task.startDate instanceof Date ? task.startDate : (task.startDate as any).toDate(), 'MMM d, yyyy') : '-'}
        </span>
      </td>
      <td className="px-6 py-4 text-right relative">
        <button 
          onClick={() => setShowMenu(!showMenu)}
          className="text-slate-300 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-all p-1 hover:bg-slate-100 rounded"
        >
          <MoreVertical size={14} />
        </button>
        {showMenu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)}></div>
            <div className="absolute right-6 top-10 w-32 bg-white border border-slate-200 rounded-lg shadow-xl z-20 py-1 animate-in fade-in zoom-in-95 duration-100">
              <button 
                onClick={() => {
                  setShowMenu(false);
                  onSelectTask?.(task.id);
                }}
                className="w-full px-4 py-2 text-left text-[11px] font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2"
              >
                Edit Issue
              </button>
              <button 
                onClick={() => {
                  setShowMenu(false);
                  onDeleteTask?.(task.id);
                }}
                className="w-full px-4 py-2 text-left text-[11px] font-bold text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                Delete Issue
              </button>
            </div>
          </>
        )}
      </td>
    </tr>
  );
}
