"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- Full navigation avoids the current Vinext RSC prefetch failure on this Worker. */

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Eye, PenLine, Save } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { TaskDetails } from "../db/tasks";

function displayDay(day: string) {
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" })
    .format(new Date(`${day}T12:00:00`));
}

export default function TaskDetailsEditor({ task }: { task: TaskDetails }) {
  const [content, setContent] = useState(task.detailsMd);
  const [savedContent, setSavedContent] = useState(task.detailsMd);
  const [updatedAt, setUpdatedAt] = useState(task.detailsUpdatedAt);
  const [view, setView] = useState<"write" | "preview">("write");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const dirty = content !== savedContent;

  const save = useCallback(async () => {
    if (saving || content === savedContent) return;
    const submitted = content;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/tasks/${encodeURIComponent(task.id)}/details`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ detailsMd: submitted }),
        cache: "no-store",
      });
      const data = await response.json() as { updatedAt?: string; error?: string };
      if (!response.ok || !data.updatedAt) throw new Error(data.error || "保存失败，请重试。");
      setSavedContent(submitted);
      setUpdatedAt(data.updatedAt);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "保存失败，请重试。");
    } finally {
      setSaving(false);
    }
  }, [content, savedContent, saving, task.id]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [save]);

  function insertSnippet(before: string, after = "", fallback = "") {
    const editor = editorRef.current;
    if (!editor) return;
    const { selectionStart: start, selectionEnd: end } = editor;
    const selection = content.slice(start, end) || fallback;
    const next = content.slice(0, start) + before + selection + after + content.slice(end);
    setContent(next);
    setError("");
    requestAnimationFrame(() => {
      editor.focus();
      editor.setSelectionRange(start + before.length, start + before.length + selection.length);
    });
  }

  function insertLine(prefix: string, fallback = "") {
    const editor = editorRef.current;
    if (!editor) return;
    const separator = editor.selectionStart > 0 && content[editor.selectionStart - 1] !== "\n" ? "\n" : "";
    insertSnippet(`${separator}${prefix}`, "", fallback);
  }

  return <div className="detail-shell">
    <header className="detail-topbar">
      <a className="brand" href="/" onClick={(event) => { if (dirty && !window.confirm("明细尚未保存，确定返回清单吗？")) event.preventDefault(); }}>日笺<span className="brand-mark">.</span></a>
      <a className="detail-back" href="/" onClick={(event) => { if (dirty && !window.confirm("明细尚未保存，确定返回清单吗？")) event.preventDefault(); }}><ArrowLeft size={17} strokeWidth={1.8} />返回清单</a>
    </header>

    <main className="detail-main">
      <div className="detail-intro">
        <div className="section-kicker"><span className="kicker-line" /> 一件事的记录</div>
        <h1>{task.title}</h1>
        <div className="detail-meta"><span>{displayDay(task.day)}</span><span className="detail-meta-separator" aria-hidden="true" /><span className={task.completed ? "detail-complete" : ""}>{task.completed ? "已完成" : "待完成"}</span></div>
      </div>

      <section className="detail-workspace" aria-labelledby="details-heading">
        <div className="detail-workspace-heading"><div><h2 id="details-heading">完成明细</h2><p>写下完成过程、结果，或值得留存的细节。</p></div><div className="detail-save-area"><span className="detail-save-status" role="status">{saving ? "正在保存…" : dirty ? "尚未保存" : updatedAt ? "已保存" : "空白页面"}</span><button className="detail-save" type="button" disabled={!dirty || saving} onClick={() => void save()}><Save size={16} strokeWidth={1.8} />保存明细</button></div></div>
        {error && <p className="detail-error" role="alert">{error}</p>}
        <div className="detail-editor-bar">
          <div className="detail-tabs" role="tablist" aria-label="明细视图"><button type="button" role="tab" aria-selected={view === "write"} onClick={() => setView("write")}><PenLine size={15} strokeWidth={1.8} />编辑</button><button type="button" role="tab" aria-selected={view === "preview"} onClick={() => setView("preview")}><Eye size={16} strokeWidth={1.8} />预览</button></div>
          <span className="detail-format">Markdown</span>
        </div>
        {view === "write" ? <div className="detail-writing" role="tabpanel" aria-label="Markdown 编辑">
          <div className="detail-tools" aria-label="Markdown 快捷格式"><button type="button" onClick={() => insertLine("## ", "小标题")}>标题</button><button type="button" onClick={() => insertSnippet("**", "**", "重点")}>加粗</button><button type="button" onClick={() => insertLine("- ", "列表项")}>列表</button><button type="button" onClick={() => insertLine("- [ ] ", "待完成项")}>清单</button></div>
          <textarea ref={editorRef} aria-label="任务完成明细 Markdown" value={content} maxLength={50_000} onChange={(event) => { setContent(event.target.value); setError(""); }} placeholder={"从这里开始写…\n\n例如：\n## 完成过程\n- 做了什么\n- 得到了什么结果"} spellCheck={false} />
        </div> : <div className="detail-preview markdown-body" role="tabpanel" aria-label="Markdown 预览">{content.trim() ? <Markdown remarkPlugins={[remarkGfm]} components={{ a: ({ ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" /> }}>{content}</Markdown> : <p className="detail-preview-empty">还没有写入内容。切回编辑，开始记录这件事。</p>}</div>}
        <div className="detail-editor-foot"><span>{content.length.toLocaleString("zh-CN")} / 50,000 字</span><span>{view === "write" ? "支持标题、列表、链接与待办清单" : <><Check size={14} strokeWidth={1.8} />预览按 Markdown 排版</>}</span></div>
      </section>
    </main>
  </div>;
}
