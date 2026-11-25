// Progress is counted on top-level tasks only: a bar's percentage and its "4 av 9 klara" caption always come from the same two numbers.
// Subtasks show their own count inside their task.

export const topLevel = (tasks) => tasks.filter((t) => !t.parent_id);
export const subtasksOf = (tasks, id) => tasks.filter((t) => t.parent_id === id).sort((a, b) => a.priority - b.priority);

export function count(tasks) {
  const total = tasks.length, done = tasks.filter((t) => t.done).length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

export const areaProgress = (tasks, areaId) => count(topLevel(tasks).filter((t) => t.area_id === areaId));

export function phaseProgress(tasks, areas, phase) {
  const ids = new Set(areas.filter((a) => a.phase === phase).map((a) => a.id));
  return count(topLevel(tasks).filter((t) => ids.has(t.area_id)));
}

/** Open top-level tasks, most important first. */
export const openByPriority = (tasks) => topLevel(tasks).filter((t) => !t.done).sort((a, b) => a.priority - b.priority || a.created_at.localeCompare(b.created_at));
