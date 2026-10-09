"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- Full navigation avoids the current Vinext RSC prefetch failure on this Worker. */

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Save } from "lucide-react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Placeholder } from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import type { TaskDetails } from "../db/tasks";
import { DeleteSelectedBlocks } from "./delete-selected-blocks";

const MAX_DETAILS_LENGTH = 50_000;

function displayDay(day: string) {
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" })
    .format(new Date(day + "T12:00:00"));
}

export default function TaskDetailsEditor({ task }: { task: TaskDetails }) {
  const [content, setContent] = useState(task.detailsMd);
  const [savedContent, setSavedContent] = useState(task.detailsMd);
  const [updatedAt, setUpdatedAt] = useState(task.detailsUpdatedAt);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const dirty = content !== savedContent;

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      DeleteSelectedBlocks,
      StarterKit.configure({ link: { openOnClick: false, autolink: true } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Image,
      TableKit,
      Markdown,
      Placeholder.configure({ placeholder: "从这里开始写… 输入 # 加空格，可以立即创建标题。" }),
    ],
    content: task.detailsMd,
    contentType: "markdown",
    editorProps: { attributes: { "aria-label": "任务完成明细", spellcheck: "false" } },
    onUpdate: ({ editor: currentEditor }) => {
      setContent(currentEditor.getMarkdown());
      setError("");
    },
  });

  const save = useCallback(async () => {
    if (saving || content === savedContent || content.length > MAX_DETAILS_LENGTH) return;
    const submitted = content;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/tasks/" + encodeURIComponent(task.id) + "/details", {
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
        <div className="detail-workspace-heading"><div><h2 id="details-heading">完成明细</h2><p>写下完成过程、结果，或值得留存的细节。</p></div><div className="detail-save-area"><span className="detail-save-status" role="status">{saving ? "正在保存…" : dirty ? "尚未保存" : updatedAt ? "已保存" : "空白页面"}</span><button className="detail-save" type="button" disabled={!dirty || saving || content.length > MAX_DETAILS_LENGTH} onClick={() => void save()}><Save size={16} strokeWidth={1.8} />保存明细</button></div></div>
        {error && <p className="detail-error" role="alert">{error}</p>}
        <div className="detail-editor-bar"><span className="detail-editor-label">边写边排版</span><span className="detail-format">Markdown</span></div>
        <div className="detail-writing">
          <div className="detail-tools" aria-label="文字格式">
            <button type="button" title="标题二（也可输入 ## 后按空格）" aria-pressed={editor?.isActive("heading", { level: 2 }) ?? false} disabled={!editor} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>标题</button>
            <button type="button" title="加粗" aria-pressed={editor?.isActive("bold") ?? false} disabled={!editor} onClick={() => editor?.chain().focus().toggleBold().run()}>加粗</button>
            <button type="button" title="无序列表" aria-pressed={editor?.isActive("bulletList") ?? false} disabled={!editor} onClick={() => editor?.chain().focus().toggleBulletList().run()}>列表</button>
            <button type="button" title="待办清单" aria-pressed={editor?.isActive("taskList") ?? false} disabled={!editor} onClick={() => editor?.chain().focus().toggleTaskList().run()}>清单</button>
          </div>
          <EditorContent editor={editor} className="detail-rich-editor markdown-body" />
        </div>
        <div className="detail-editor-foot"><span className={content.length > MAX_DETAILS_LENGTH ? "detail-count-over" : ""}>{content.length.toLocaleString("zh-CN")} / 50,000 字{content.length > MAX_DETAILS_LENGTH ? " · 已超出上限" : ""}</span><span>选中整段后按删除键，可一次移除整块</span></div>
      </section>
    </main>
  </div>;
}
