import React from 'react';
import { LayoutDashboard, ListTodo, Calendar, GanttChart, Plus, LogOut, FolderKanban, User, Trash2 } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { useProject } from './ProjectProvider';
import { cn } from '../lib/utils';
import { collection, addDoc, serverTimestamp, arrayUnion, updateDoc, doc, deleteDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firebase-utils';

interface SidebarProps {
  activeView: string;
  setActiveView: (view: string) => void;
}

export function Sidebar({ activeView, setActiveView }: SidebarProps) {
  const { profile, logout } = useAuth();
  const { projects, activeProject, setActiveProject } = useProject();
  const [isAddingProject, setIsAddingProject] = React.useState(false);
  const [newProjectName, setNewProjectName] = React.useState('');
  const [newProjectKey, setNewProjectKey] = React.useState('');

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName || !profile) return;

    try {
      const docRef = await addDoc(collection(db, 'projects'), {
        name: newProjectName,
        key: newProjectKey.toUpperCase() || newProjectName.substring(0, 3).toUpperCase(),
        ownerId: profile.uid,
        memberIds: [profile.uid],
        createdAt: serverTimestamp(),
      });
      // Reset form
      setNewProjectName('');
      setNewProjectKey('');
      setIsAddingProject(false);
      // We don't manually setActiveProject here because the ProjectProvider's 
      // snapshot listener will catch the new project and auto-select it 
      // if none was active, thanks to the fixed ref-based logic.
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'projects');
      setIsAddingProject(false);
    }
  };

  const handleDeleteProject = async (projectId: string, projectName: string) => {
    if (!profile || !window.confirm(`Are you sure you want to delete the project "${projectName}"? This will delete all tasks and cannot be undone.`)) return;

    try {
      // 1. Delete all tasks in the project
      const tasksRef = collection(db, 'projects', projectId, 'tasks');
      const taskDocs = await getDocs(tasksRef);
      const deleteTaskPromises = taskDocs.docs.map(d => deleteDoc(d.ref));
      await Promise.all(deleteTaskPromises);

      // 2. Delete the project document
      await deleteDoc(doc(db, 'projects', projectId));

      // 3. Clear active project if deleted
      if (activeProject?.id === projectId) {
        setActiveProject(null);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `projects/${projectId}`);
    }
  };

  const navItems = [
    { id: 'summary', label: 'Summary', icon: LayoutDashboard },
    { id: 'list', label: 'List View', icon: ListTodo },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'members', label: 'Project Members', icon: User },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 h-screen flex flex-col sticky top-0 shrink-0">
      <div className="p-6 border-b border-slate-100 flex items-center gap-3">
        <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white font-bold shadow-sm shadow-blue-200">
          T
        </div>
        <span className="font-semibold tracking-tight text-lg text-slate-900">TaskManagement</span>
      </div>

      <div className="flex-1 overflow-y-auto py-6">
        <div className="px-4 mb-8">
          <div className="flex items-center justify-between mb-3 px-2">
            <h2 className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Projects</h2>
            <button 
              onClick={() => setIsAddingProject(!isAddingProject)}
              className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors"
            >
              <Plus size={14} />
            </button>
          </div>
          
          {isAddingProject && (
            <form onSubmit={handleCreateProject} className="mb-6 px-2 space-y-2 animate-in slide-in-from-top-2 duration-300">
              <input
                autoFocus
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="Project name..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 font-medium"
              />
              <input
                type="text"
                value={newProjectKey}
                onChange={(e) => setNewProjectKey(e.target.value.toUpperCase())}
                placeholder="Key (e.g. FX)"
                maxLength={5}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 font-medium"
              />
              <div className="flex gap-2">
                <button 
                  type="submit"
                  className="flex-1 bg-slate-900 text-white py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-[0.98]"
                >
                  Create
                </button>
                <button 
                  type="button"
                  onClick={() => setIsAddingProject(false)}
                  className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div className="space-y-1">
            {projects.map((project) => (
              <div key={project.id} className="group relative">
                <button
                  onClick={() => setActiveProject(project)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-200 pr-10",
                    activeProject?.id === project.id 
                      ? "bg-blue-50 text-blue-700 font-semibold" 
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  {project.name}
                </button>
                {project.ownerId === profile?.uid && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteProject(project.id, project.name);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-md opacity-0 group-hover:opacity-100 transition-all"
                    title="Delete Project"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {activeProject && (
          <div className="px-4">
            <h2 className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-3 px-2">Views</h2>
            <nav className="space-y-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200",
                    activeView === item.id 
                      ? "bg-slate-100 text-slate-900 font-semibold shadow-sm" 
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  <item.icon size={18} className={cn(activeView === item.id ? "text-blue-600" : "text-slate-400")} />
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-100 bg-white">
        <div className="flex items-center gap-3 mb-4 px-2">
          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs uppercase shadow-inner">
            {profile?.displayName?.charAt(0) || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-900 truncate tracking-tight">{profile?.displayName}</p>
            <p className="text-[10px] text-slate-400 truncate tracking-wider uppercase">{profile?.email.split('@')[0]}</p>
          </div>
        </div>
        <button 
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
        >
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
