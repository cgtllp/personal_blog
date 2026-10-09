import { env } from "cloudflare:workers";

export type Task = {
  id: string;
  day: string;
  title: string;
  completed: boolean;
  createdAt: string;
  hasDetails: boolean;
  detailsPreview: string;
};

export type TaskDetails = Task & { detailsMd: string; detailsUpdatedAt: string | null };

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
  has_details?: number;
  details_md?: string;
  details_preview_md?: string;
  details_updated_at?: string | null;
};

const previewEntities: Record<string, string> = {
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
};

function decodePreviewEntities(text: string): string {
  const decodeOnce = (value: string) => value.replace(/&(#(?:x[0-9a-f]+|[0-9]+)|[a-z]+);/gi, (match, entity: string) => {
    if (!entity.startsWith("#")) return previewEntities[entity.toLowerCase()] ?? match;
    const codePoint = entity[1]?.toLowerCase() === "x"
      ? Number.parseInt(entity.slice(2), 16)
      : Number.parseInt(entity.slice(1), 10);
    if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return match;
    const character = String.fromCodePoint(codePoint);
    return /^\s$/u.test(character) ? " " : character;
  });
  return decodeOnce(decodeOnce(text));
}

function previewFromMarkdown(markdown: string): string {
  const plain = decodePreviewEntities(markdown
    .replace(/\r\n?/g, "\n")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, ""))
    .replace(/^\s{0,3}(?:[-*+]\s+)?\[[ xX]\]\s+/gm, "")
    .replace(/^\s{0,3}(?:#{1,6}\s+|>\s*|[-*+]\s+|\d+[.)]\s+)/gm, "")
    .replace(/[`*_~|]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return plain.length > 220 ? `${plain.slice(0, 220).trimEnd()}…` : plain;
}

function fromRow(row: TaskRow): Task {
  const previewMarkdown = row.details_preview_md ?? row.details_md ?? "";
  return {
    id: row.id,
    day: row.day,
    title: row.title,
    completed: row.completed === 1,
    createdAt: row.created_at,
    hasDetails: row.has_details === 1 || (row.has_details === undefined && Boolean(row.details_md?.trim())),
    detailsPreview: previewFromMarkdown(previewMarkdown),
  };
}

export async function getTaskDetails(ownerId: string, id: string): Promise<TaskDetails | null> {
  const row = await database().prepare(
    "SELECT id, day, title, completed, created_at, details_md, details_updated_at FROM tasks WHERE id = ? AND owner_id = ? LIMIT 1"
  ).bind(id, ownerId).first<TaskRow>();
  return row ? { ...fromRow(row), detailsMd: row.details_md ?? "", detailsUpdatedAt: row.details_updated_at ?? null } : null;
}

export async function saveTaskDetails(ownerId: string, id: string, detailsMd: string): Promise<string | null> {
  const updatedAt = new Date().toISOString();
  const result = await database().prepare(
    "UPDATE tasks SET details_md = ?, details_updated_at = ? WHERE id = ? AND owner_id = ?"
  ).bind(detailsMd, updatedAt, id, ownerId).run();
  return result.meta.changes > 0 ? updatedAt : null;
}

export async function listTasks(ownerId: string): Promise<Task[]> {
  const rows = await database().prepare(
    "SELECT id, day, title, completed, created_at, substr(details_md, 1, 2000) AS details_preview_md, " +
    "length(trim(details_md, char(9) || char(10) || char(13) || ' ')) > 0 AS has_details " +
    "FROM tasks WHERE owner_id = ? ORDER BY day DESC, created_at ASC"
  ).bind(ownerId).all<TaskRow>();
  return rows.results.map(fromRow);
}

export async function createTask(ownerId: string, day: string, title: string): Promise<Task> {
  const task: Task = { id: crypto.randomUUID(), day, title, completed: false, createdAt: new Date().toISOString(), hasDetails: false, detailsPreview: "" };
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
