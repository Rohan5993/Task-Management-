import React, { useState, useEffect } from 'react';
import { useProject } from './ProjectProvider';
import { useAuth } from './AuthProvider';
import { 
  UserPlus, 
  Mail, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  XCircle,
  Loader2,
  Shield,
  User
} from 'lucide-react';
import { Invitation, UserProfile } from '../types';
import { cn } from '../lib/utils';
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  query, 
  where, 
  onSnapshot, 
  deleteDoc, 
  doc, 
  updateDoc, 
  arrayRemove 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firebase-utils';

export function ProjectMembersView() {
  const { activeProject, members } = useProject();
  const { profile } = useAuth();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!activeProject) return;

    const invitationsRef = collection(db, 'invitations');
    const q = query(invitationsRef, where('projectId', '==', activeProject.id), where('status', '==', 'pending'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const inviteData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
      })) as Invitation[];
      setInvitations(inviteData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `projects/${activeProject.id}/invitations`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [activeProject]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject || !profile || !inviteEmail || isSubmitting) return;

    // Check if user is already a member
    if (members.some(m => m.email.toLowerCase() === inviteEmail.toLowerCase())) {
      alert('This user is already a member of the project.');
      return;
    }

    // Check if there's already a pending invitation
    if (invitations.some(i => i.email.toLowerCase() === inviteEmail.toLowerCase())) {
      alert('An invitation is already pending for this email.');
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'invitations'), {
        projectId: activeProject.id,
        projectName: activeProject.name,
        email: inviteEmail.toLowerCase(),
        inviterId: profile.uid,
        inviterName: profile.displayName,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      
      // Simulate "sending email" by showing a success message
      alert(`Invitation link (simulated) would be sent to ${inviteEmail}. In this prototype, the user will be added automatically when they login with this email.`);
      
      setInviteEmail('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `projects/${activeProject.id}/invitations`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!activeProject || !profile) return;
    if (userId === activeProject.ownerId) {
      alert('Cannot remove the project owner.');
      return;
    }
    if (!confirm('Are you sure you want to remove this member?')) return;

    try {
      await updateDoc(doc(db, 'projects', activeProject.id), {
        memberIds: arrayRemove(userId)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `projects/${activeProject.id}`);
    }
  };

  const handleCancelInvitation = async (inviteId: string) => {
    try {
      await deleteDoc(doc(db, 'invitations', inviteId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `invitations/${inviteId}`);
    }
  };

  if (!activeProject) return null;

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Project Members</h1>
          <p className="text-sm text-slate-500">Manage who has access to this project.</p>
        </div>

        <form onSubmit={handleInvite} className="flex gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="email"
              placeholder="Invite by email..."
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="pl-10 pr-4 py-2 w-full bg-transparent text-sm font-medium text-slate-600 focus:outline-none placeholder:text-slate-300"
              required
            />
          </div>
          <button 
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-blue-700 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
            Invite
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Active Members */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Active Members ({members.length})</h2>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm divide-y divide-slate-50">
            {members.map(member => (
              <div key={member.uid} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-bold shadow-sm">
                    {member.photoURL ? (
                      <img src={member.photoURL} alt={member.displayName} className="w-full h-full rounded-full" />
                    ) : (
                      member.displayName.charAt(0)
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-slate-900 tracking-tight">{member.displayName}</p>
                      {member.uid === activeProject.ownerId && (
                        <span className="flex items-center gap-1 text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded uppercase tracking-wider">
                          <Shield size={10} />
                          Owner
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">{member.email}</p>
                  </div>
                </div>
                {member.uid !== activeProject.ownerId && activeProject.ownerId === profile?.uid && (
                  <button 
                    onClick={() => handleRemoveMember(member.uid)}
                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    title="Remove Member"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Pending Invitations */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Pending Invitations ({invitations.length})</h2>
          </div>
          {invitations.length === 0 ? (
            <div className="bg-white border border-slate-200 border-dashed rounded-2xl p-8 text-center space-y-3">
              <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300">
                <Mail size={20} />
              </div>
              <p className="text-xs text-slate-400 font-medium tracking-tight">No pending invitations</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm divide-y divide-slate-50">
              {invitations.map(invite => (
                <div key={invite.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold shadow-inner">
                      <Clock size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900 tracking-tight">{invite.email}</p>
                      <p className="text-[10px] text-slate-400 font-medium tracking-tight uppercase">
                        Invited by {invite.inviterName}
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleCancelInvitation(invite.id)}
                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    title="Cancel Invitation"
                  >
                    <XCircle size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
