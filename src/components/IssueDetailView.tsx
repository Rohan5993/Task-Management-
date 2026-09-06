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
  Hash,
  Trash2
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
  getDocs,
  where,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firebase-utils';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { generateHierarchicalId } from '../lib/task-utils';

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
  const [isCreatingSubtask, setIsCreatingSubtask] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');

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

  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  const handleDelete = async () => {
    if (!activeProject || isDeleting) return;
    
    setIsDeleting(true);
    setErrorMessage(null);
    console.log('Delete started for task:', task.id);

    try {
      const batch = writeBatch(db);
      
      // 1. Find subtasks
      const subtasksRef = collection(db, 'projects', activeProject.id, 'tasks');
      const q = query(subtasksRef, where('parentTaskId', '==', task.id));
      const subtaskDocs = await getDocs(q);
      
      // 2. Add subtasks and their comments to batch
      for (const d of subtaskDocs.docs) {
        batch.delete(d.ref);
        const subCommentsRef = collection(db, 'projects', activeProject.id, 'tasks', d.id, 'comments');
        const subComments = await getDocs(subCommentsRef);
        subComments.docs.forEach(cd => batch.delete(cd.ref));
      }

      // 3. Add parent task comments
      const parentCommentsRef = collection(db, 'projects', activeProject.id, 'tasks', task.id, 'comments');
      const parentComments = await getDocs(parentCommentsRef);
      parentComments.docs.forEach(cd => batch.delete(cd.ref));

      // 4. Add the task itself
      batch.delete(doc(db, 'projects', activeProject.id, 'tasks', task.id));

      // 5. Commit
      await batch.commit();
      console.log('Delete successful');
      onClose();
    } catch (error) {
      console.error('Delete error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setErrorMessage(`Failed to delete issue: ${errorMsg}`);
    } finally {
      setIsDeleting(false);
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

  const handleCreateSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim() || !activeProject || !profile) return;

    try {
      const siblings = tasks.filter(t => t.parentTaskId === task.id);
      const hId = generateHierarchicalId(activeProject, task, siblings);

      await addDoc(collection(db, 'projects', activeProject.id, 'tasks'), {
        title: newSubtaskTitle,
        description: null,
        status: 'To Do',
        hierarchicalId: hId,
        parentTaskId: task.id,
        projectId: activeProject.id,
        reporterId: profile.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setNewSubtaskTitle('');
      setIsCreatingSubtask(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `projects/${activeProject.id}/tasks`);
    }
  };

  const handleCommentChange = (val: string) => {
    setNewComment(val);
    const lastAt = val.lastIndexOf('@');
    if (lastAt !== -1 && (lastAt === 0 || val[lastAt - 1] === ' ')) {
      const filter = val.substring(lastAt + 1);
      if (!filter.includes(' ')) {
        setMentionFilter(filter);
        setShowMentions(true);
        return;
      }
    }
    setShowMentions(false);
  };

  const insertMention = (user: UserProfile) => {
    const lastAt = newComment.lastIndexOf('@');
    const newVal = newComment.substring(0, lastAt) + '@' + user.displayName + ' ';
    setNewComment(newVal);
    setShowMentions(false);
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!activeProject) return;
    try {
      await deleteDoc(doc(db, 'projects', activeProject.id, 'tasks', task.id, 'comments', commentId));
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setErrorMessage(`Failed to delete comment: ${errorMsg}`);
    }
  };

  const handleDeleteSubtask = async (subtaskId: string) => {
    if (!activeProject) return;
    try {
      await deleteDoc(doc(db, 'projects', activeProject.id, 'tasks', subtaskId));
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setErrorMessage(`Failed to delete subtask: ${errorMsg}`);
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
          <FileText size={18} className="text-blue-600" />
          <span className="text-[11px] font-bold text-slate-400 tracking-widest uppercase">
            {task.hierarchicalId || `${activeProject.name.substring(0, 3).toUpperCase()}-${task.id.slice(-2)}`}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-100 transition-all">
            <Eye size={16} />
            <span>1</span>
          </button>
          <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all">
            <MoreHorizontal size={18} />
          </button>
          <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all">
            <Maximize2 size={18} />
          </button>
          <button 
            onClick={() => setShowDeleteConfirm(true)}
            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
            title="Delete Issue"
          >
            <Trash2 size={18} />
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
        <div className="flex-1 overflow-y-auto bg-white flex flex-col min-w-0">
          {/* Error Banner */}
          {errorMessage && (
            <div className="mx-8 mt-4 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between animate-in slide-in-from-top-2">
              <p className="text-sm font-bold text-red-600 uppercase tracking-widest">{errorMessage}</p>
              <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-red-600 transition-all text-xs font-bold uppercase tracking-widest">Dismiss</button>
            </div>
          )}

          <div className="flex-1 p-10 space-y-12 overflow-y-auto">
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
                <div className="relative group">
                  <textarea
                    value={task.description || ''}
                    onChange={async (e) => {
                      try {
                        await updateDoc(doc(db, 'projects', activeProject.id, 'tasks', task.id), {
                          description: e.target.value || null,
                          updatedAt: serverTimestamp(),
                        });
                      } catch (error) {
                        handleFirestoreError(error, OperationType.UPDATE, `projects/${activeProject.id}/tasks/${task.id}`);
                      }
                    }}
                    placeholder="Add more details..."
                    className="w-full bg-slate-50 rounded-xl p-6 min-h-[160px] border border-slate-100 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all resize-none"
                  />
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
                <button 
                  onClick={() => setIsCreatingSubtask(true)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
            
            {isCreatingSubtask && (
              <form onSubmit={handleCreateSubtask} className="mb-4 flex gap-2 animate-in slide-in-from-top-2">
                <input 
                  autoFocus
                  type="text"
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  placeholder="What needs to be done?"
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
                <button 
                  type="submit"
                  disabled={!newSubtaskTitle.trim()}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Create
                </button>
                <button 
                  type="button"
                  onClick={() => setIsCreatingSubtask(false)}
                  className="px-4 py-2 text-slate-600 text-sm font-bold hover:bg-slate-50 rounded-lg"
                >
                  Cancel
                </button>
              </form>
            )}
            
            <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-50">
                  <tr>
                    <th className="px-4 py-3 font-bold">Work</th>
                    <th className="px-4 py-3 font-bold text-center">Pri</th>
                    <th className="px-4 py-3 font-bold text-center">As</th>
                    <th className="px-4 py-3 font-bold">Status</th>
                    <th className="px-4 py-3 font-bold w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {childTasks.map(child => {
                    const childAssignee = members.find(m => m.uid === child.assigneeId);
                    return (
                      <tr key={child.id} className="hover:bg-slate-50 transition-colors group/row">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <FileText size={14} className="text-blue-500" />
                            <span className="text-[10px] font-bold text-slate-400 uppercase">{child.hierarchicalId || child.id.slice(-2)}</span>
                            <span className="font-medium text-slate-700">{child.title}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-center">
                            <Flag size={12} className={cn(
                              child.priority === 'High' ? "text-red-500" :
                              child.priority === 'Medium' ? "text-amber-500" :
                              "text-blue-500"
                            )} />
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-center">
                            <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600">
                              {childAssignee?.displayName.charAt(0) || <User size={12} className="text-slate-300" />}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                            child.status === 'Done' ? "bg-emerald-100 text-emerald-700" : 
                            child.status === 'Progress' ? "bg-blue-100 text-blue-700" :
                            "bg-slate-100 text-slate-500"
                          )}>
                            {child.status}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button 
                            onClick={() => handleDeleteSubtask(child.id)}
                            className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover/row:opacity-100 transition-all"
                            title="Delete Subtask"
                          >
                            <Trash2 size={12} />
                          </button>
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
              <div className="flex gap-4 relative">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {profile?.displayName?.charAt(0)}
                </div>
                <form onSubmit={handleAddComment} className="flex-1 space-y-3">
                  <div className="relative border border-slate-200 rounded-xl bg-white overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all">
                    <textarea 
                      value={newComment}
                      onChange={(e) => handleCommentChange(e.target.value)}
                      placeholder="Add a comment... (use @ to mention)"
                      className="w-full p-4 text-sm focus:outline-none min-h-[100px] resize-none"
                    />
                    
                    {showMentions && (
                      <div className="absolute bottom-full left-0 w-48 bg-white border border-slate-200 rounded-lg shadow-xl z-10 py-1 mb-2 animate-in fade-in zoom-in-95">
                        <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-50">Mention user</div>
                        <div className="max-h-40 overflow-y-auto">
                          {members.filter(m => m.displayName.toLowerCase().includes(mentionFilter.toLowerCase())).map(member => (
                            <button
                              key={member.uid}
                              type="button"
                              onClick={() => insertMention(member)}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                            >
                              <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600">
                                {member.displayName.charAt(0)}
                              </div>
                              <span className="font-medium text-slate-700">{member.displayName}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

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
                        {comment.userId === profile?.uid && (
                          <button 
                            onClick={() => handleDeleteComment(comment.id)}
                            className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
                            title="Delete Comment"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-slate-700 leading-relaxed">{comment.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Right Sidebar - Sticky/Fixed Content */}
        <aside className="w-[360px] border-l border-slate-100 bg-white flex flex-col p-6 space-y-8 overflow-y-auto">
          {/* Status Buttons */}
          <div className="flex flex-wrap gap-2">
            <div className="relative group">
              <button 
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all",
                  task.status === 'Done' ? "bg-emerald-100 text-emerald-700" :
                  task.status === 'Progress' ? "bg-blue-100 text-blue-700" :
                  task.status === 'Review' ? "bg-amber-100 text-amber-700" :
                  "bg-slate-100 text-slate-700"
                )}
              >
                <span>{task.status}</span>
                <ChevronDown size={14} />
              </button>
              
              <div className="absolute left-0 top-full mt-1 w-40 bg-white border border-slate-200 rounded-xl shadow-xl z-20 py-1 hidden group-hover:block">
                {(['To Do', 'Progress', 'Review', 'Done'] as TaskStatus[]).map(s => (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    className={cn(
                      "w-full px-4 py-2 text-left text-sm font-medium hover:bg-slate-50",
                      task.status === s ? "text-blue-600" : "text-slate-600"
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
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
                          {reporter?.displayName?.charAt(0) || 'A'}
                        </div>
                        <span className="text-sm font-bold text-slate-900">{reporter?.displayName || 'Anonymous'}</span>
                      </div>
                    </div>

                    {/* Priority */}
                    <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                      <span className="text-sm text-slate-500">Priority</span>
                      <div className="flex items-center gap-2">
                        <Flag size={14} className={cn(
                          task.priority === 'High' ? "text-red-500" :
                          task.priority === 'Medium' ? "text-amber-500" :
                          "text-blue-500"
                        )} />
                        <select 
                          value={task.priority || 'Medium'}
                          onChange={async (e) => {
                            try {
                              await updateDoc(doc(db, 'projects', activeProject.id, 'tasks', task.id), {
                                priority: e.target.value,
                                updatedAt: serverTimestamp(),
                              });
                            } catch (error) {
                              handleFirestoreError(error, OperationType.UPDATE, `projects/${activeProject.id}/tasks/${task.id}`);
                            }
                          }}
                          className="text-sm font-bold text-slate-900 bg-transparent border-none focus:ring-0 p-0 hover:text-blue-600 cursor-pointer"
                        >
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                        </select>
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

                    {/* Supporter */}
                    <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                      <span className="text-sm text-slate-500">Supporter</span>
                      <select 
                        value={task.supporterId || ''}
                        onChange={async (e) => {
                          try {
                            await updateDoc(doc(db, 'projects', activeProject.id, 'tasks', task.id), {
                              supporterId: e.target.value || null,
                              updatedAt: serverTimestamp(),
                            });
                          } catch (error) {
                            handleFirestoreError(error, OperationType.UPDATE, `projects/${activeProject.id}/tasks/${task.id}`);
                          }
                        }}
                        className="text-sm font-bold text-slate-400 bg-transparent border-none focus:ring-0 p-0 hover:text-blue-600"
                      >
                        <option value="">None</option>
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
      {/* Deletion Confirmation Modal */}
      {showDeleteConfirm && (
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
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-3 text-xs font-bold uppercase tracking-widest text-slate-400 hover:bg-slate-50 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                disabled={isDeleting}
                onClick={handleDelete}
                className="flex-1 px-4 py-3 text-xs font-bold uppercase tracking-widest text-white bg-red-600 hover:bg-red-700 rounded-xl transition-all shadow-lg shadow-red-100 flex items-center justify-center gap-2"
              >
                {isDeleting && <Loader2 size={14} className="animate-spin" />}
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
