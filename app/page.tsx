import { headers } from "next/headers";
import { currentUserFromCookieHeader } from "../lib/account-auth";
import TaskDashboard from "../components/task-dashboard";
import AuthForm from "../components/auth-form";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await currentUserFromCookieHeader((await headers()).get("cookie"));
  if (user) return <TaskDashboard userName={user.username} />;

  return <main className="login-page">
    <header className="topbar login-topbar">
      <span className="brand">日笺<span className="brand-mark">.</span></span>
      <span className="login-header-note">写下今天，继续前行</span>
    </header>
    <div className="login-layout">
      <div className="login-rail"><span>DAILY NOTES</span><i /></div>
      <section className="login-content" aria-labelledby="login-title">
        <div className="section-kicker"><span className="kicker-line" /> 属于你的每日手记</div>
        <h1 id="login-title">每一天，<br />都有自己的页<span>。</span></h1>
        <p className="login-description">登录后记录今天的待办，也能回看过去未完成的事。每个人的清单单独保存。</p>
        <AuthForm />
      </section>
      <aside className="login-side" aria-hidden="true"><span className="login-side-date">日日<br />有笺</span><span className="login-side-rule" /><span className="login-side-caption">把想做的事，慢慢做完。</span></aside>
    </div>
  </main>;
}
