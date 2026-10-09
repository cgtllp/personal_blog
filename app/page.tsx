import { chatGPTSignInPath, getChatGPTUser } from "./chatgpt-auth";
import TaskDashboard from "../components/task-dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getChatGPTUser();
  if (user) return <TaskDashboard userName={user.displayName} />;

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
        <a className="login-button" href={chatGPTSignInPath("/")} target="_top">使用 ChatGPT 账号登录</a>
        <p className="login-note">没有账号可在登录流程中注册。本站只使用账号标识和邮箱区分清单，不读取或保存密码。</p>
      </section>
      <aside className="login-side" aria-hidden="true"><span className="login-side-date">日日<br />有笺</span><span className="login-side-rule" /><span className="login-side-caption">把想做的事，慢慢做完。</span></aside>
    </div>
  </main>;
}
