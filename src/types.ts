export type TaskStatus = 'To Do' | 'Progress' | 'Review' | 'Done';
export type EpicStatus = 'To Do' | 'In Progress' | 'Done';

export interface Project {
  id: string;
  name: string;
  description?: string;
  memberIds: string[];
  ownerId: string;
  createdAt: Date;
}

export interface Epic {
  id: string;
  projectId: string;
  name: string;
  status: EpicStatus;
  createdAt: Date;
}

export interface Task {
  id: string;
  projectId: string;
  epicId?: string;
  parentTaskId?: string; // For subtasks
  title: string;
  description?: string;
  status: TaskStatus;
  assigneeId?: string;
  supporterId?: string;
  startDate?: Date;
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
}

export interface Invitation {
  id: string;
  projectId: string;
  projectName: string;
  email: string;
  inviterId: string;
  inviterName: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: Date;
}

export interface Comment {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  userPhotoURL?: string;
  content: string;
  createdAt: Date;
}
