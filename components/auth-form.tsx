"use client";

import { useState } from "react";
import type { FormEvent } from "react";

export default function AuthForm() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function changeMode(next: "login" | "register") {
    setMode(next);
    setPassword("");
    setConfirm("");
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (mode === "register" && password !== confirm) {
      setError("两次输入的密码不一致。");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ username, password }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "操作失败，请稍后重试。");
      window.location.replace("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "操作失败，请稍后重试。");
      setBusy(false);
    }
  }

  return <div className="auth-panel">
    <div className="auth-tabs" role="group" aria-label="登录或注册">
      <button type="button" className={mode === "login" ? "is-active" : ""} onClick={() => changeMode("login")} disabled={busy}>登录</button>
      <button type="button" className={mode === "register" ? "is-active" : ""} onClick={() => changeMode("register")} disabled={busy}>注册账号</button>
    </div>
    <form className="auth-form" onSubmit={(event) => void submit(event)}>
      <label htmlFor="auth-username">账号</label>
      <input id="auth-username" name="username" value={username} onChange={(event) => setUsername(event.target.value)}
        autoComplete="username" pattern="[A-Za-z0-9_]{3,32}" maxLength={32} required placeholder="3–32 位字母、数字或下划线" disabled={busy} />
      <label htmlFor="auth-password">密码</label>
      <input id="auth-password" name="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)}
        autoComplete={mode === "register" ? "new-password" : "current-password"} minLength={mode === "register" ? 15 : undefined}
        maxLength={128} required placeholder={mode === "register" ? "至少 15 位" : "输入密码"} disabled={busy} />
      {mode === "register" && <>
        <label htmlFor="auth-confirm">确认密码</label>
        <input id="auth-confirm" name="confirm" type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)}
          autoComplete="new-password" minLength={15} maxLength={128} required placeholder="再次输入密码" disabled={busy} />
      </>}
      {error && <p className="auth-error" role="alert">{error}</p>}
      <button className="login-button" type="submit" disabled={busy}>{busy ? "请稍候…" : mode === "login" ? "登录" : "创建账号"}</button>
    </form>
    <p className="login-note">账号和密码仅用于本站。请妥善保存密码；目前没有邮箱找回功能。</p>
  </div>;
}
