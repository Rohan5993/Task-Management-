import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthProvider';
import { Project, Task, UserProfile } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firebase-utils';

interface ProjectContextType {
  projects: Project[];
  activeProject: Project | null;
  setActiveProject: (project: Project | null) => void;
  tasks: Task[];
  members: UserProfile[];
  loading: boolean;
  error: string | null;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const activeProjectRef = useRef<Project | null>(null);
  activeProjectRef.current = activeProject;

  // Fetch projects user is a member of
  useEffect(() => {
    if (!user) {
      setProjects([]);
      setActiveProject(null);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'projects'),
      where('memberIds', 'array-contains', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const projectsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      })) as Project[];
      
      setProjects(projectsData);
      
      if (projectsData.length > 0 && !activeProjectRef.current) {
        setActiveProject(projectsData[0]);
      }
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'projects');
      setError('Failed to load projects');
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  // Fetch project-specific data
  useEffect(() => {
    if (!activeProject) {
      setTasks([]);
      setMembers([]);
      return;
    }

    const tasksRef = collection(db, 'projects', activeProject.id, 'tasks');

    const unsubTasks = onSnapshot(query(tasksRef, orderBy('createdAt', 'desc')), (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(), 
        dueDate: doc.data().dueDate?.toDate(),
        startDate: doc.data().startDate?.toDate(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      })) as Task[]);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, `projects/${activeProject.id}/tasks`);
    });

    // Fetch members using onSnapshot for real-time updates
    const usersRef = collection(db, 'users');
    const memberIds = activeProject.memberIds;
    
    // Firestore 'in' query supports up to 30 values
    const unsubUsers = onSnapshot(query(usersRef, where('uid', 'in', memberIds.slice(0, 30))), (snapshot) => {
        setMembers(snapshot.docs.map(doc => doc.data() as UserProfile));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'users');
    });

    return () => {
      unsubTasks();
      unsubUsers();
    };
  }, [activeProject]);

  return (
    <ProjectContext.Provider value={{ projects, activeProject, setActiveProject, tasks, members, loading, error }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}
