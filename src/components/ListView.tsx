import React, { useState } from 'react';
import { useAuth } from './AuthProvider';
import { useProject } from './ProjectProvider';
import { 
  Plus, 
  Search, 
  MoreVertical, 
  ChevronRight, 
  ChevronDown,
  User,
  Calendar as CalendarIcon,
  Tag,
  Trash2
} from 'lucide-react';
import { Task, TaskStatus, UserProfile } from '../types';
import { cn } from '../lib/utils';
import { addDoc, collection, serverTimestamp, updateDoc, doc, getDocs, query, where, deleteDoc, Timestamp, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { format } from 'date-fns';
import { handleFirestoreError, OperationType } from '../lib/firebase-utils';
import { Loader2 } from 'lucide-react';
import { generateHierarchicalId } from '../lib/task-utils';

interface ListViewProps {
  onSelectTask?: (taskId: string) => void;
}

export function ListView({ onSelectTask }: ListViewProps) {
  const { profile } = useAuth();
  const { tasks, activeProject, members, error: projectError } = useProject();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddingTask, setIsAddingTask] = useState<boolean | string>(false); // string means parentTaskId
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<TaskStatus>('To Do');
  const [selectedAssignee, setSelectedAssignee] = useState<string>('');
  const [selectedSupporter, setSelectedSupporter] = useState<string>('');
  const [selectedStartDate, setSelectedStartDate] = useState('');
  const [selectedDueDate, setSelectedDueDate] = useState('');
  const [selectedPriority, setSelectedPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!activeProject) return null;

  const toggleTask = (taskId: string) => {
    const newExpanded = new Set(expandedTasks);
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId);
    } else {
      newExpanded.add(taskId);
    }
    setExpandedTasks(newExpanded);
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const parentId = typeof isAddingTask === 'string' ? isAddingTask : null;
      const parentTask = parentId ? tasks.find(t => t.id === parentId) || null : null;
      const siblings = tasks.filter(t => t.parentTaskId === (parentId || undefined));
      const hId = generateHierarchicalId(activeProject, parentTask, siblings);

      const tasksPath = `projects/${activeProject.id}/tasks`;
      await addDoc(collection(db, tasksPath), {
        title: newTaskTitle,
        description: newTaskDescription || null,
        status: selectedStatus,
        epicId: null,
        parentTaskId: parentId,
        hierarchicalId: hId,
        assigneeId: selectedAssignee || null,
        supporterId: selectedSupporter || null,
        startDate: selectedStartDate ? Timestamp.fromDate(new Date(selectedStartDate + 'T00:00:00')) : null,
        dueDate: selectedDueDate ? Timestamp.fromDate(new Date(selectedDueDate + 'T00:00:00')) : null,
        priority: selectedPriority,
        reporterId: profile?.uid || null,
        projectId: activeProject.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setNewTaskTitle('');
      setNewTaskDescription('');
      setSelectedAssignee('');
      setSelectedSupporter('');
      setSelectedStartDate('');
      setSelectedDueDate('');
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

  const handleDeleteTask = async (taskId: string) => {
    if (!activeProject || isDeleting) return;
    
    setIsDeleting(true);
    setErrorMessage(null);
    console.log('Delete started for task:', taskId);

    try {
      const batch = writeBatch(db);
      
      // 1. Find subtasks
      const subtasksRef = collection(db, 'projects', activeProject.id, 'tasks');
      const q = query(subtasksRef, where('parentTaskId', '==', taskId));
      const subtaskDocs = await getDocs(q);
      
      // 2. Add subtasks to batch
      for (const d of subtaskDocs.docs) {
        batch.delete(d.ref);
        
        // Try to find comments for subtasks (optional, non-blocking if limit hit)
        const subCommentsRef = collection(db, 'projects', activeProject.id, 'tasks', d.id, 'comments');
        const subComments = await getDocs(subCommentsRef);
        subComments.docs.forEach(cd => batch.delete(cd.ref));
      }

      // 3. Add parent task comments
      const parentCommentsRef = collection(db, 'projects', activeProject.id, 'tasks', taskId, 'comments');
      const parentComments = await getDocs(parentCommentsRef);
      parentComments.docs.forEach(cd => batch.delete(cd.ref));

      // 4. Add the task itself
      batch.delete(doc(db, 'projects', activeProject.id, 'tasks', taskId));

      // 5. Commit
      await batch.commit();
      console.log('Delete successful');
      setConfirmDeleteId(null);
    } catch (error) {
      console.error('Delete error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setErrorMessage(`Failed to delete task: ${errorMsg}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredTasks = tasks.filter(t => 
    t.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const mainTasks = filteredTasks.filter(t => !t.parentTaskId);
  const subtasks = filteredTasks.filter(t => t.parentTaskId);

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

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between animate-in slide-in-from-top-2">
          <p className="text-sm font-bold text-red-600 uppercase tracking-widest">{errorMessage}</p>
          <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-red-600 transition-all text-xs font-bold uppercase tracking-widest">Dismiss</button>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100 bg-slate-50/50">
              <th className="px-6 py-4 tracking-widest w-12"></th>
              <th className="px-6 py-4 tracking-widest">Issue</th>
              <th className="px-6 py-4 tracking-widest">Status</th>
              <th className="px-6 py-4 tracking-widest">Assignee</th>
              <th className="px-6 py-4 tracking-widest">Start Date</th>
              <th className="px-6 py-4 tracking-widest w-12"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {mainTasks.map(task => (
              <React.Fragment key={task.id}>
                <TaskRow 
                  task={task} 
                  members={members} 
                  onStatusChange={handleStatusChange} 
                  onDeleteTask={(id) => setConfirmDeleteId(id)}
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
                      onDeleteTask={(id) => setConfirmDeleteId(id)}
                      isSubtask 
                      onSelectTask={onSelectTask}
                    />
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
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  value={newTaskDescription}
                  onChange={(e) => setNewTaskDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px]"
                  placeholder="Add more details..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
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
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
                  <select 
                    value={selectedPriority}
                    onChange={(e) => setSelectedPriority(e.target.value as 'Low' | 'Medium' | 'High')}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={selectedStartDate}
                    onChange={(e) => setSelectedStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={selectedDueDate}
                    onChange={(e) => setSelectedDueDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
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
                  <label className="block text-sm font-medium text-slate-700 mb-1">Supporter</label>
                  <select 
                    value={selectedSupporter}
                    onChange={(e) => setSelectedSupporter(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">None</option>
                    {members.map(member => (
                      <option key={member.uid} value={member.uid}>{member.displayName}</option>
                    ))}
                  </select>
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
      {confirmDeleteId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 animate-in zoom-in-95 duration-200 border border-slate-100">
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-6 text-red-500">
              <Trash2 size={32} />
            </div>
            <h2 className="text-xl font-bold text-slate-900 text-center mb-2">Delete Issue?</h2>
            <p className="text-sm text-slate-500 text-center mb-8">
              This will permanently delete this issue and all its subtasks and comments. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                disabled={isDeleting}
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 px-4 py-3 text-xs font-bold uppercase tracking-widest text-slate-400 hover:bg-slate-50 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                disabled={isDeleting}
                onClick={() => handleDeleteTask(confirmDeleteId)}
                className="flex-1 px-4 py-3 text-xs font-bold uppercase tracking-widest text-white bg-red-600 hover:bg-red-700 rounded-xl transition-all shadow-lg shadow-red-100 flex items-center justify-center gap-2"
              >
                {isDeleting && <Loader2 size={14} className="animate-spin" />}
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
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
          <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mt-0.5">{task.hierarchicalId || `#${task.id.slice(-4)}`}</span>
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
