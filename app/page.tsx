"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import type { Task } from "../db/tasks";

function localDay() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function displayDate(day: string, options: Intl.DateTimeFormatOptions = { month: "long", day: "numeric", weekday: "long" }) {
  return new Intl.DateTimeFormat("zh-CN", options).format(new Date(`${day}T12:00:00`));
}

async function api(path: string, init?: RequestInit) {
  const response = await fetch(path, { ...init, cache: "no-store" });
  const data = await response.json() as { error?: string; tasks: Task[]; task: Task };
  if (!response.ok) throw new Error(data.error || "操作失败，请重试。");
  return data;
}

export default function Home() {
  const [today, setToday] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await api("/api/tasks");
      setTasks(data.tasks);
      setError("");
    } catch (err) { setError(err instanceof Error ? err.message : "暂时无法读取事项。"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    setToday(localDay());
    void load();
    const timer = window.setInterval(() => setToday(localDay()), 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const todayTasks = useMemo(() => tasks.filter((task) => task.day === today), [tasks, today]);
  const openToday = todayTasks.filter((task) => !task.completed).length;
  const overdue = useMemo(() => tasks.filter((task) => task.day < today && !task.completed), [tasks, today]);
  const groups = useMemo(() => {
    const byDay = new Map<string, Task[]>();
    for (const task of overdue) byDay.set(task.day, [...(byDay.get(task.day) ?? []), task]);
    return [...byDay.entries()];
  }, [overdue]);

  async function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = draft.trim();
    if (!title || !today || busy) return;
    setBusy(true); setError("");
    try {
      const data = await api("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ day: today, title }) });
      setTasks((current) => [...current, data.task]); setDraft("");
    } catch (err) { setError(err instanceof Error ? err.message : "保存失败，请重试。"); }
    finally { setBusy(false); }
  }

  async function toggleTask(task: Task) {
    if (busy) return;
    setBusy(true); setError("");
    try {
      await api("/api/tasks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: task.id, completed: !task.completed }) });
      setTasks((current) => current.map((item) => item.id === task.id ? { ...item, completed: !item.completed } : item));
    } catch (err) { setError(err instanceof Error ? err.message : "更新失败，请重试。"); }
    finally { setBusy(false); }
  }

  async function deleteTask(task: Task) {
    if (busy || !window.confirm(`删除「${task.title}」？`)) return;
    setBusy(true); setError("");
    try {
      await api(`/api/tasks?id=${encodeURIComponent(task.id)}`, { method: "DELETE" });
      setTasks((current) => current.filter((item) => item.id !== task.id));
    } catch (err) { setError(err instanceof Error ? err.message : "删除失败，请重试。"); }
    finally { setBusy(false); }
  }

  function taskRow(task: Task) {
    return <li className={`task-row ${task.completed ? "is-done" : ""}`} key={task.id}>
      <button className="task-check" type="button" aria-label={task.completed ? `标记未完成：${task.title}` : `完成：${task.title}`}
        aria-pressed={task.completed} disabled={busy} onClick={() => void toggleTask(task)}>
        {task.completed && <Check size={15} strokeWidth={2} />}
      </button>
      <span className="task-title">{task.title}</span>
      <button className="task-delete" type="button" aria-label={`删除：${task.title}`} disabled={busy} onClick={() => void deleteTask(task)}>
        <Trash2 size={17} strokeWidth={1.7} />
      </button>
    </li>;
  }

  return <div className="site-shell">
    <header className="topbar">
      <a className="brand" href="#today" aria-label="日笺，返回今天">日笺<span className="brand-mark">.</span></a>
      <nav aria-label="页面导航"><a href="#today">今日计划</a><a href="#unfinished">往日未完成 <span className="nav-count">{overdue.length}</span></a></nav>
      <span className="topbar-end">写下今天，继续前行</span>
    </header>

    <main className="page-layout">
      <aside className="date-rail" aria-label="日期"><div className="rail-content"><span className="rail-label">DAILY NOTES</span><span className="rail-rule" /><span className="rail-year">{today.slice(0, 4)}</span></div><span className="rail-bottom">让每件小事有处可归</span></aside>

      <section className="today-section" id="today" aria-labelledby="today-title">
        <div className="section-kicker"><span className="kicker-line" /> 今天 · {today ? displayDate(today, { weekday: "long" }) : ""}</div>
        <div className="today-heading"><div><h1 id="today-title">今天，想做些什么<span className="title-period">。</span></h1><p className="section-intro">把脑海里的计划放在这里，一件一件完成。</p></div><div className="large-date" aria-hidden="true">{today ? today.slice(8) : "--"}</div></div>

        <form className="add-form" onSubmit={(event) => void addTask(event)}>
          <label htmlFor="task-input">新待办</label>
          <div className="input-line"><input id="task-input" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="写下今天要完成的事…" maxLength={200} disabled={busy || !today} autoComplete="off" /><button type="submit" disabled={!draft.trim() || busy || !today} aria-label="添加待办"><Plus size={20} strokeWidth={1.8} /></button></div>
          <p className="form-hint">按 Enter 添加，完成后点选左侧方框。</p>
        </form>

        {error && <div className="error-banner" role="alert">{error}<button type="button" onClick={() => void load()}>重试读取</button></div>}
        <div className="list-header"><h2>今日清单</h2><span>{loading ? "读取中" : `${openToday} 件待完成`}</span></div>
        {loading ? <div className="loading-lines" aria-label="正在读取事项"><span /><span /><span /></div> : todayTasks.length ? <ul className="task-list">{todayTasks.map(taskRow)}</ul> : <div className="empty-today"><span className="empty-glyph">✳</span><p>新的一页，等你写下第一件事。</p></div>}
      </section>

      <aside className="history-panel" id="unfinished" aria-labelledby="history-title">
        <div className="history-top"><span>回望</span><span className="history-count">{overdue.length.toString().padStart(2, "0")}</span></div>
        <h2 id="history-title">未完成的<br />那些事<span>。</span></h2>
        <p className="history-intro">过去的计划仍在这里。完成一件，就让它从清单中离开。</p>
        <div className="history-divider" />
        {loading ? <div className="loading-lines" aria-label="正在读取往日事项"><span /><span /></div> : groups.length ? <div className="history-groups">{groups.map(([day, entries]) => <section className="history-group" key={day} aria-label={displayDate(day)}><h3><span>{displayDate(day, { month: "long", day: "numeric" })}</span><small>{displayDate(day, { weekday: "long" })}</small></h3><ul className="task-list history-list">{entries.map(taskRow)}</ul></section>)}</div> : <div className="empty-history"><span className="empty-glyph">✳</span><p>过去没有遗留事项。<br />轻装开始今天。</p></div>}
      </aside>
    </main>
    <footer className="footer"><span>日笺 · 给每一天留一页</span><span>{today ? displayDate(today, { year: "numeric", month: "long", day: "numeric" }) : ""}</span></footer>
  </div>;
}
