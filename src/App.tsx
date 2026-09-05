import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './components/AuthProvider';
import { ProjectProvider, useProject } from './components/ProjectProvider';
import { Sidebar } from './components/Sidebar';
import { SummaryView } from './components/SummaryView';
import { ListView } from './components/ListView';
import { CalendarView } from './components/CalendarView';
import { ProjectMembersView } from './components/ProjectMembersView';
import { IssueDetailView } from './components/IssueDetailView';
import { LogIn, Loader2 } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { collection, query, where, getDocs, updateDoc, doc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { db } from './lib/firebase';
import { handleFirestoreError, OperationType } from './lib/firebase-utils';
import { Invitation } from './types';

function MainApp() {
  const { user, profile, loading: authLoading, signIn } = useAuth();
  const { activeProject, setActiveProject, loading: projectLoading } = useProject();
  const [activeView, setActiveView] = useState('summary');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Auto-accept invitations
  useEffect(() => {
    if (!user?.email || authLoading) return;

    const checkInvitations = async () => {
      const invitationsRef = collection(db, 'invitations');
      const q = query(invitationsRef, where('email', '==', user.email.toLowerCase()), where('status', '==', 'pending'));
      
      try {
        const snapshot = await getDocs(q);
        if (snapshot.empty) return;

        for (const invitationDoc of snapshot.docs) {
          const invite = { id: invitationDoc.id, ...invitationDoc.data() } as Invitation;
          
          // Add user to project
          const projectRef = doc(db, 'projects', invite.projectId);
          await updateDoc(projectRef, {
            memberIds: arrayUnion(user.uid)
          });

          // Mark invitation as accepted
          await updateDoc(doc(db, 'invitations', invite.id), {
            status: 'accepted',
            updatedAt: serverTimestamp()
          });

          console.log(`Auto-accepted invitation for project: ${invite.projectName}`);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'invitations/auto-accept');
      }
    };

    checkInvitations();
  }, [user, authLoading]);

  if (authLoading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50">
        <Loader2 className="text-blue-600 animate-spin mb-4" size={48} />
        <p className="text-slate-600 font-medium animate-pulse">Initializing your workspace...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white p-12 rounded-3xl shadow-xl border border-slate-200 max-w-md w-full text-center space-y-8 animate-in fade-in zoom-in duration-500">
          <div className="space-y-2">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-blue-200 mb-4">
              <LogIn className="text-white" size={32} />
            </div>
            <h1 className="text-3xl font-bold text-slate-900">Welcome to TaskManagement</h1>
            <p className="text-slate-500">The most intuitive way to manage your project's lifecycle, epics, and tasks.</p>
          </div>
          
          <button 
            onClick={signIn}
            className="w-full flex items-center justify-center gap-3 bg-slate-900 text-white py-4 rounded-xl font-semibold hover:bg-slate-800 transition-all hover:shadow-lg active:scale-[0.98]"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" />
            Continue with Google
          </button>
          
          <p className="text-xs text-slate-400">By continuing, you agree to our terms of service.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar activeView={activeView} setActiveView={setActiveView} />
      
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {activeProject && (
          <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
            <div className="flex items-center gap-4">
              <span className="text-slate-400 text-sm">Projects</span>
              <span className="text-slate-300">/</span>
              <span className="font-semibold text-sm">{activeProject.name}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-white border border-slate-200 px-3 py-1.5 rounded-md flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                <span className="text-xs font-medium">Project Active</span>
              </div>
            </div>
          </header>
        )}

        <div className="flex-1 overflow-y-auto">
          {!activeProject ? (
            <div className="h-full flex items-center justify-center p-8 text-center">
              <div className="max-w-sm space-y-4">
                <div className="w-20 h-20 bg-white rounded-3xl shadow-sm border border-slate-200 flex items-center justify-center mx-auto text-slate-400">
                  <LogIn size={40} />
                </div>
                <h2 className="text-xl font-bold text-slate-900">No project selected</h2>
                <p className="text-slate-500">Select a project from the sidebar or create a new one to start tracking your tasks.</p>
              </div>
            </div>
          ) : (
            <div className="animate-in fade-in duration-500">
              {activeView === 'summary' && <SummaryView />}
              {activeView === 'list' && <ListView onSelectTask={setSelectedTaskId} />}
              {activeView === 'calendar' && <CalendarView />}
              {activeView === 'members' && <ProjectMembersView />}
            </div>
          )}
        </div>
      </main>

      <AnimatePresence>
        {selectedTaskId && (
          <IssueDetailView 
            taskId={selectedTaskId} 
            onClose={() => setSelectedTaskId(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ProjectProvider>
        <MainApp />
      </ProjectProvider>
    </AuthProvider>
  );
}
