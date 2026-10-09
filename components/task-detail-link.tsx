import { ArrowUpRight } from "lucide-react";
import type { Task } from "../db/tasks";

export default function TaskDetailLink({ task, fromHistory = false }: { task: Task; fromHistory?: boolean }) {
  const label = task.hasDetails ? "查看明细" : "添加明细";
  const href = `/tasks/${encodeURIComponent(task.id)}${fromHistory ? "?from=history" : ""}`;

  return <span className="task-detail-trigger">
    <a className={`task-detail-link ${task.hasDetails ? "has-details" : ""}`} href={href}
      aria-label={`${label}：${task.title}`} aria-describedby={task.hasDetails ? `task-preview-${task.id}` : undefined}>
      {label} <ArrowUpRight size={14} strokeWidth={1.8} aria-hidden="true" />
    </a>
    {task.hasDetails && <span className="task-detail-preview" id={`task-preview-${task.id}`} role="tooltip">
      <span className="task-detail-preview-label">明细预览</span>
      <span className="task-detail-preview-text">{task.detailsPreview || "此明细暂无可预览的文字，点击查看全文。"}</span>
      <span className="task-detail-preview-more">点击查看全文 ↗</span>
    </span>}
  </span>;
}
