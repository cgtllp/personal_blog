"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- Full navigation avoids the current Vinext RSC prefetch failure on this Worker. */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Task } from "../db/tasks";
import TaskDetailLink from "./task-detail-link";

type Filter = "all" | "done" | "open";

function localDay() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function displayDate(day: string) {
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" })
    .format(new Date(`${day}T12:00:00`));
}

export default function TaskHistory({ userName }: { userName: string }) {
  const [today, setToday] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/tasks", { cache: "no-store" });
      const data = await response.json() as { tasks?: Task[]; error?: string };
      if (!response.ok || !data.tasks) throw new Error(data.error || "暂时无法读取往日计划。");
      setTasks(data.tasks);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "暂时无法读取往日计划。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => { setToday(localDay()); void load(); }, 0);
    const timer = window.setInterval(() => setToday(localDay()), 60_000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [load]);

  async function toggleTask(task: Task) {
    if (busy) return;
    const completed = !task.completed;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: task.id, completed }),
        cache: "no-store",
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "更新失败，请重试。");
      setTasks((current) => current.map((item) => item.id === task.id ? { ...item, completed } : item));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "更新失败，请重试。");
    } finally {
      setBusy(false);
    }
  }

  const past = useMemo(() => tasks.filter((task) => task.day < today), [tasks, today]);
  const doneCount = past.filter((task) => task.completed).length;
  const openCount = past.length - doneCount;
  const visible = useMemo(() => past.filter((task) => filter === "all" || task.completed === (filter === "done")), [past, filter]);
  const groups = useMemo(() => {
    const byDay = new Map<string, Task[]>();
    for (const task of visible) byDay.set(task.day, [...(byDay.get(task.day) ?? []), task]);
    return [...byDay.entries()];
  }, [visible]);

  return <div className="site-shell archive-shell">
    <header className="topbar">
      <a className="brand" href="/" aria-label="日笺，返回今日计划">日笺<span className="brand-mark">.</span></a>
      <nav aria-label="页面导航"><a href="/">今日计划</a><a href="/history" aria-current="page">往日计划</a><a href="/#unfinished">往日未完成 <span className="nav-count">{openCount}</span></a></nav>
      <div className="topbar-account"><span title={userName}>{userName}</span><form method="post" action="/api/auth/logout"><button type="submit">退出登录</button></form></div>
    </header>

    <main className="archive-main">
      <div className="archive-hero">
        <div className="section-kicker"><span className="kicker-line" /> 回望 · 计划档案</div>
        <h1>往日计划<span className="title-period">。</span></h1>
        <p>做过的事、还没做完的事，都留在这里。</p>
        <div className="archive-summary" aria-label="往日计划统计">
          <div><strong>{loading ? "—" : past.length}</strong><span>件往日计划</span></div>
          <div><strong>{loading ? "—" : doneCount}</strong><span>已完成</span></div>
          <div><strong>{loading ? "—" : openCount}</strong><span>未完成</span></div>
        </div>
      </div>

      <section className="archive-section" aria-labelledby="archive-list-title">
        <div className="archive-toolbar">
          <h2 id="archive-list-title">按日期回看</h2>
          <div className="archive-filters" role="group" aria-label="筛选往日计划">
            <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>全部</button>
            <button type="button" aria-pressed={filter === "done"} onClick={() => setFilter("done")}>已完成</button>
            <button type="button" aria-pressed={filter === "open"} onClick={() => setFilter("open")}>未完成</button>
          </div>
        </div>
        {error && <div className="error-banner" role="alert">{error}<button type="button" onClick={() => void load()}>重试读取</button></div>}
        {loading ? <div className="loading-lines" aria-label="正在读取往日计划"><span /><span /><span /></div>
          : groups.length ? <div className="archive-groups">{groups.map(([day, entries]) =>
            <section className="archive-group" key={day} aria-label={displayDate(day)}>
              <div className="archive-day"><h3><time dateTime={day}>{displayDate(day)}</time></h3><span>{entries.length} 件</span></div>
              <ul className="archive-task-list">{entries.map((task) => <li className={`archive-task ${task.completed ? "is-done" : ""}`} key={task.id}>
                <button className="archive-task-mark" type="button"
                  aria-label={task.completed ? `标记未完成：${task.title}` : `完成：${task.title}`}
                  aria-pressed={task.completed} disabled={busy} onClick={() => void toggleTask(task)}>
                  {task.completed ? "✓" : ""}
                </button>
                <div className="archive-task-copy"><span className="archive-task-title">{task.title}</span><div className="archive-task-meta"><span>{task.completed ? "已完成" : "未完成"}</span><TaskDetailLink task={task} fromHistory /></div></div>
              </li>)}</ul>
            </section>)}</div>
          : <div className="archive-empty"><span className="empty-glyph">✳</span><p>{past.length ? "这个筛选下还没有计划。" : "还没有往日计划。明天再来回看今天。"}</p></div>}
      </section>
    </main>
    <footer className="footer"><span>日笺 · 给每一天留一页</span><a href="/">返回今日计划 ↗</a></footer>
  </div>;
}
