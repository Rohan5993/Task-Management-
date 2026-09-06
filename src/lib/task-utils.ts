import { Task, Project } from '../types';

export function getProjectKey(project: Project): string {
  if (project.key) return project.key.toUpperCase();
  // Derive key from name: first 2-3 letters
  const name = project.name.trim();
  const parts = name.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 3).toUpperCase();
}

export function generateHierarchicalId(
  project: Project,
  parentTask: Task | null,
  siblings: Task[]
): string {
  const key = getProjectKey(project);
  const prefix = parentTask ? parentTask.hierarchicalId : key;
  
  // For siblings, we need to find the next number
  // Hierarchical IDs are like FRA-01, FRA-01.1, FRA-01.1.1
  let nextNum = 1;
  if (siblings.length > 0) {
    const suffixRegex = parentTask ? /\.(\d+)$/ : /-(\d+)$/;
    const nums = siblings
      .map(s => {
        const match = s.hierarchicalId?.match(suffixRegex);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(n => !isNaN(n));
    
    if (nums.length > 0) {
      nextNum = Math.max(...nums) + 1;
    }
  }

  if (!parentTask) {
    // Root task: FX-01
    return `${key}-${nextNum.toString().padStart(2, '0')}`;
  } else {
    // Subtask: FX-01.1
    return `${parentTask.hierarchicalId}.${nextNum}`;
  }
}
