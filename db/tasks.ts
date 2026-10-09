import { env } from "cloudflare:workers";

export type Task = {
  id: string;
  day: string;
  title: string;
  completed: boolean;
  createdAt: string;
};

function database() {
  if (!env.DB) throw new Error("Database unavailable");
  return env.DB;
}

type TaskRow = {
  id: string;
  day: string;
  title: string;
  completed: number;
  created_at: string;
};

function fromRow(row: TaskRow): Task {
  return { id: row.id, day: row.day, title: row.title, completed: row.completed === 1, createdAt: row.created_at };
}

export async function listTasks(ownerId: string): Promise<Task[]> {
  const rows = await database().prepare(
    "SELECT id, day, title, completed, created_at FROM tasks WHERE owner_id = ? ORDER BY day DESC, created_at ASC"
  ).bind(ownerId).all<TaskRow>();
  return rows.results.map(fromRow);
}

export async function createTask(ownerId: string, day: string, title: string): Promise<Task> {
  const task: Task = { id: crypto.randomUUID(), day, title, completed: false, createdAt: new Date().toISOString() };
  await database().prepare(
    "INSERT INTO tasks (id, owner_id, day, title, completed, created_at) VALUES (?, ?, ?, ?, 0, ?)"
  ).bind(task.id, ownerId, day, title, task.createdAt).run();
  return task;
}

export async function setTaskCompleted(ownerId: string, id: string, completed: boolean): Promise<boolean> {
  const result = await database().prepare(
    "UPDATE tasks SET completed = ? WHERE id = ? AND owner_id = ?"
  ).bind(completed ? 1 : 0, id, ownerId).run();
  return result.meta.changes > 0;
}

export async function removeTask(ownerId: string, id: string): Promise<boolean> {
  const result = await database().prepare("DELETE FROM tasks WHERE id = ? AND owner_id = ?")
    .bind(id, ownerId).run();
  return result.meta.changes > 0;
}
