import React, { useState, useEffect } from 'react';
import { 
  X, 
  Maximize2, 
  MoreHorizontal, 
  Share2, 
  Eye, 
  Lock, 
  Plus, 
  ChevronDown, 
  Settings, 
  Zap, 
  Check, 
  Clock, 
  User, 
  MessageSquare, 
  History, 
  FileText,
  Loader2,
  Send,
  Flag,
  Calendar,
  Hash
} from 'lucide-react';
import { Task, UserProfile, Comment, TaskStatus } from '../types';
import { useProject } from './ProjectProvider';
import { useAuth } from './AuthProvider';
import { cn } from '../lib/utils';
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  query, 
  orderBy, 
  onSnapshot, 
  updateDoc, 
  doc,
  deleteDoc,
  Timestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firebase-utils';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

interface IssueDetailViewProps {
  taskId: string;
  onClose: () => void;
}

export function IssueDetailView({ taskId, onClose }: IssueDetailViewProps) {
  const { activeProject, tasks, members } = useProject();
  const { profile } = useAuth();
  const task = tasks.find(t => t.id === taskId);
  
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [activeTab, setActiveTab] = useState<'comments' | 'history' | 'work-log'>('comments');
  const [isDetailsOpen, setIsDetailsOpen] = useState(true);

  useEffect(() => {
    if (!activeProject || !taskId) return;

    const commentsRef = collection(db, 'projects', activeProject.id, 'tasks', taskId, 'comments');
    const q = query(commentsRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const commentData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
      })) as Comment[];
      setComments(commentData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `projects/${activeProject.id}/tasks/${taskId}/comments`);
    });

    return () => unsubscribe();
  }, [activeProject, taskId]);

  if (!task || !activeProject) return null;

  const handleStatusChange = async (newStatus: TaskStatus) => {
    try {
      await updateDoc(doc(db, 'projects', activeProject.id, 'tasks', task.id), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `projects/${activeProject.id}/tasks/${task.id}`);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !profile || isSubmittingComment) return;

    setIsSubmittingComment(true);
    try {
      await addDoc(collection(db, 'projects', activeProject.id, 'tasks', task.id, 'comments'), {
        taskId: task.id,
        userId: profile.uid,
        userName: profile.displayName,
        userPhotoURL: profile.photoURL || null,
        content: newComment,
        createdAt: serverTimestamp(),
      });
      setNewComment('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `projects/${activeProject.id}/tasks/${task.id}/comments`);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const childTasks = tasks.filter(t => t.parentTaskId === task.id);
  const reporter = members.find(m => m.uid === activeProject.ownerId);
  const assignee = members.find(m => m.uid === task.assigneeId);

  const StatusIcon = ({ status }: { status: TaskStatus }) => {
    switch (status) {
      case 'Done': return <Check size={14} className="text-emerald-500" />;
      case 'Progress': return <Clock size={14} className="text-blue-500" />;
      default: return <div className="w-3 h-3 rounded-full border-2 border-slate-300" />;
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-white z-[60] flex flex-col overflow-hidden"
    >
      {/* Header */}
      <header className="h-14 border-b border-slate-100 flex items-center justify-between px-6 bg-white shrink-0">
        <div className="flex items-center gap-3">
          <Zap size={18} className="text-purple-600 fill-purple-600" />
          <span className="text-[11px] font-bold text-slate-400 tracking-widest uppercase">
            {activeProject.name.substring(0, 3).toUpperCase()}-{task.id.slice(-2)}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all">
            <Lock size={18} />
          </button>
          <button className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-100 transition-all">
            <Eye size={16} />
            <span>1</span>
          </button>
          <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all">
            <Share2 size={18} />
          </button>
          <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all">
            <MoreHorizontal size={18} />
          </button>
          <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all">
            <Maximize2 size={18} />
          </button>
          <div className="h-6 w-[1px] bg-slate-100 mx-1"></div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all"
          >
            <X size={20} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column - Scrollable */}
        <div className="flex-1 overflow-y-auto bg-white p-10 space-y-12">
          <div className="space-y-6">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{task.title}</h1>
            <button className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-50 transition-all">
              <Plus size={18} />
            </button>
          </div>

          {/* Key Details */}
          <section className="space-y-6">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Key details</h2>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Description</label>
                <div className="bg-slate-50 rounded-xl p-6 min-h-[160px] border border-slate-100">
                  {task.description ? (
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{task.description}</p>
                  ) : (
                    <p className="text-sm text-slate-400 italic">No description provided.</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-12 gap-y-6">
                <div className="flex items-center justify-between py-2 border-b border-slate-50">
                  <span className="text-sm font-medium text-slate-500">Time estimate</span>
                  <button className="text-sm font-bold text-slate-400 hover:text-blue-600">Add text</button>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-slate-50">
                  <span className="text-sm font-medium text-slate-500">List status</span>
                  <button className="text-sm font-bold text-slate-400 hover:text-blue-600">Add text</button>
                </div>
              </div>
            </div>
          </section>

          {/* Child Work Items */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">Child work items</h2>
              <div className="flex items-center gap-2">
                <button className="p-1.5 text-slate-400 hover:text-slate-600">
                  <MoreHorizontal size={16} />
                </button>
                <button className="p-1.5 text-slate-400 hover:text-slate-600">
                  <FileText size={16} />
                </button>
                <button className="p-1.5 text-slate-400 hover:text-slate-600">
                  <Plus size={16} />
                </button>
              </div>
            </div>
            
            <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-50">
                  <tr>
                    <th className="px-4 py-3 font-bold">Work</th>
                    <th className="px-4 py-3 font-bold">Pri...</th>
                    <th className="px-4 py-3 font-bold">Stor...</th>
                    <th className="px-4 py-3 font-bold">As...</th>
                    <th className="px-4 py-3 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {childTasks.map(child => {
                    const childAssignee = members.find(m => m.uid === child.assigneeId);
                    return (
                      <tr key={child.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <FileText size={14} className="text-blue-500" />
                            <span className="text-[10px] font-bold text-slate-400 uppercase">{activeProject.name.substring(0, 3)}-{child.id.slice(-2)}</span>
                            <span className="font-medium text-slate-700">{child.title}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3"><div className="w-4 h-0.5 bg-slate-200"></div></td>
                        <td className="px-4 py-3"><div className="w-4 h-0.5 bg-slate-200"></div></td>
                        <td className="px-4 py-3">
                          <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600">
                            {childAssignee?.displayName.charAt(0) || <User size={12} />}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                            child.status === 'Done' ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                          )}>
                            {child.status}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {childTasks.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-slate-400 text-xs italic">No child items found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Activity Section */}
          <section className="space-y-6 pt-6 border-t border-slate-100">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Activity</h2>
            <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl w-fit">
              <button 
                onClick={() => setActiveTab('comments')}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                  activeTab === 'comments' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                Comments
              </button>
              <button 
                onClick={() => setActiveTab('history')}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                  activeTab === 'history' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                History
              </button>
              <button 
                onClick={() => setActiveTab('work-log')}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                  activeTab === 'work-log' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                Work log
              </button>
            </div>

            <div className="space-y-8">
              {/* Comment Input */}
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {profile?.displayName?.charAt(0)}
                </div>
                <form onSubmit={handleAddComment} className="flex-1 space-y-3">
                  <div className="relative border border-slate-200 rounded-xl bg-white overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all">
                    <textarea 
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Add a comment..."
                      className="w-full p-4 text-sm focus:outline-none min-h-[100px] resize-none"
                    />
                    <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-t border-slate-100">
                      <div className="flex items-center gap-3 text-slate-400">
                        <span className="text-[10px] font-bold uppercase tracking-wider">Pro tip: press <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded text-slate-600">M</kbd> to comment</span>
                      </div>
                      <button 
                        type="submit"
                        disabled={isSubmittingComment || !newComment.trim()}
                        className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition-all disabled:opacity-50"
                      >
                        {isSubmittingComment ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                      </button>
                    </div>
                  </div>
                </form>
              </div>

              {/* Comment List */}
              <div className="space-y-6 pl-12">
                {comments.map(comment => (
                  <div key={comment.id} className="flex gap-4 group">
                    <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 text-xs font-bold shrink-0">
                      {comment.userPhotoURL ? (
                        <img src={comment.userPhotoURL} alt={comment.userName} className="w-full h-full rounded-full" />
                      ) : (
                        comment.userName.charAt(0)
                      )}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{comment.userName}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {format(comment.createdAt || new Date(), 'h:mm a')}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700 leading-relaxed">{comment.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* Right Sidebar - Sticky/Fixed Content */}
        <aside className="w-[360px] border-l border-slate-100 bg-white flex flex-col p-6 space-y-8 overflow-y-auto">
          {/* Status Buttons */}
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <button 
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all",
                  task.status === 'Done' ? "bg-emerald-100 text-emerald-700" :
                  task.status === 'Progress' ? "bg-blue-100 text-blue-700" :
                  "bg-slate-100 text-slate-700"
                )}
              >
                <span>{task.status}</span>
                <ChevronDown size={14} />
              </button>
            </div>
            <button className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-slate-100">
              <Plus size={18} />
            </button>
            <button className="flex items-center gap-2 px-3 py-2 bg-slate-50 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-100">
              <Check size={16} />
              <span>Done</span>
            </button>
            <button className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-slate-100">
              <Zap size={18} />
            </button>
          </div>

          {/* Details Accordion */}
          <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm">
            <button 
              onClick={() => setIsDetailsOpen(!isDetailsOpen)}
              className="w-full flex items-center justify-between p-4 bg-slate-50/50 hover:bg-slate-50 transition-all border-b border-slate-50"
            >
              <div className="flex items-center gap-2">
                <ChevronDown size={18} className={cn("text-slate-400 transition-transform", !isDetailsOpen && "-rotate-90")} />
                <span className="text-sm font-bold text-slate-900">Details</span>
              </div>
              <Settings size={16} className="text-slate-400" />
            </button>

            <AnimatePresence>
              {isDetailsOpen && (
                <motion.div 
                  initial={{ height: 0 }}
                  animate={{ height: 'auto' }}
                  exit={{ height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-6 space-y-6">
                    {/* Reporter */}
                    <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                      <span className="text-sm text-slate-500">Reporter</span>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center text-white text-[10px] font-bold">
                          {reporter?.displayName.charAt(0) || 'S'}
                        </div>
                        <span className="text-sm font-bold text-slate-900">{reporter?.displayName || 'Steven Wong'}</span>
                      </div>
                    </div>

                    {/* Priority */}
                    <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                      <span className="text-sm text-slate-500">Priority</span>
                      <div className="flex items-center gap-2">
                        <Flag size={14} className="text-amber-500" />
                        <span className="text-sm font-bold text-slate-900">P2 - High</span>
                      </div>
                    </div>

                    {/* Labels */}
                    <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                      <span className="text-sm text-slate-500">Labels</span>
                      <button className="text-sm font-bold text-slate-400 hover:text-blue-600 text-left">Add labels</button>
                    </div>

                    {/* Due date */}
                    <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                      <span className="text-sm text-slate-500">Due date</span>
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-slate-400" />
                        <input
                          type="date"
                          value={task.dueDate ? format(task.dueDate instanceof Date ? task.dueDate : (task.dueDate as any).toDate(), 'yyyy-MM-dd') : ''}
                          onChange={async (e) => {
                            try {
                              await updateDoc(doc(db, 'projects', activeProject.id, 'tasks', task.id), {
                                dueDate: e.target.value ? Timestamp.fromDate(new Date(e.target.value)) : null,
                                updatedAt: serverTimestamp(),
                              });
                            } catch (error) {
                              handleFirestoreError(error, OperationType.UPDATE, `projects/${activeProject.id}/tasks/${task.id}`);
                            }
                          }}
                          className="text-sm font-bold text-slate-400 bg-transparent border-none focus:ring-0 p-0 hover:text-blue-600"
                        />
                      </div>
                    </div>

                    {/* Assignee */}
                    <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                      <span className="text-sm text-slate-500">Assignee</span>
                      <select 
                        value={task.assigneeId || ''}
                        onChange={async (e) => {
                          try {
                            await updateDoc(doc(db, 'projects', activeProject.id, 'tasks', task.id), {
                              assigneeId: e.target.value || null,
                              updatedAt: serverTimestamp(),
                            });
                          } catch (error) {
                            handleFirestoreError(error, OperationType.UPDATE, `projects/${activeProject.id}/tasks/${task.id}`);
                          }
                        }}
                        className="text-sm font-bold text-slate-400 bg-transparent border-none focus:ring-0 p-0 hover:text-blue-600"
                      >
                        <option value="">Unassigned</option>
                        {members.map(m => (
                          <option key={m.uid} value={m.uid}>{m.displayName}</option>
                        ))}
                      </select>
                    </div>

                    {/* Time tracking */}
                    <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                      <span className="text-sm text-slate-500">Time tracking</span>
                      <span className="text-sm font-bold text-slate-400">No time logged</span>
                    </div>

                    {/* Sprint points */}
                    <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                      <span className="text-sm text-slate-500">Sprint points</span>
                      <button className="text-sm font-bold text-slate-400 hover:text-blue-600 text-left">Add number</button>
                    </div>

                    {/* Start date */}
                    <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                      <span className="text-sm text-slate-500">Start date</span>
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-slate-400" />
                        <input
                          type="date"
                          value={task.startDate ? format(task.startDate instanceof Date ? task.startDate : (task.startDate as any).toDate(), 'yyyy-MM-dd') : ''}
                          onChange={async (e) => {
                            try {
                              await updateDoc(doc(db, 'projects', activeProject.id, 'tasks', task.id), {
                                startDate: e.target.value ? Timestamp.fromDate(new Date(e.target.value)) : null,
                                updatedAt: serverTimestamp(),
                              });
                            } catch (error) {
                              handleFirestoreError(error, OperationType.UPDATE, `projects/${activeProject.id}/tasks/${task.id}`);
                            }
                          }}
                          className="text-sm font-bold text-slate-400 bg-transparent border-none focus:ring-0 p-0 hover:text-blue-600"
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </aside>
      </div>
    </motion.div>
  );
}
