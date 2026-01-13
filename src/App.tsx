import { createSignal, onMount, Show } from "solid-js";
import { Router, Route, useParams } from "@solidjs/router";
import { Home } from "~/pages/Home";
import { ShareView } from "~/pages/ShareView";
import { Dashboard } from "~/pages/Dashboard";
import { Header } from "~/components/Header";
import { setClerk, getClerk, appStore } from "~/stores";

// Clerk 公开密钥（从环境变量读取）
const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || "";

function SharePage() {
  const params = useParams();
  const token = params.token || "";
  return <ShareView token={token} />;
}

function DashboardPage() {
  const params = useParams();
  return <Dashboard />;
}

function AppRoutes() {
  const { isAuthenticated, setIsAuthenticated, user, setUser } = appStore;
  const [clerkLoaded, setClerkLoaded] = createSignal(false);

  // 初始化 Clerk（单例模式）
  onMount(async () => {
    if (!CLERK_PUBLISHABLE_KEY) {
      console.warn("[Clerk] 未配置 Clerk 密钥，登录功能不可用");
      return;
    }

    try {
      console.log("[Clerk] 初始化 Clerk...");
      const { Clerk } = await import("@clerk/clerk-js");
      const clerk = new Clerk(CLERK_PUBLISHABLE_KEY);

      // 保存 Clerk 实例到全局
      setClerk(clerk);

      await clerk.load();
      setClerkLoaded(true);
      console.log("[Clerk] 加载完成");

      // 同步初始状态
      if (clerk.user) {
        console.log("[Clerk] 用户已登录:", clerk.user.id);
        setIsAuthenticated(true);
        setUser({
          id: clerk.user.id,
          email: clerk.user.emailAddresses[0]?.emailAddress || "",
        });
      }

      // 监听登录状态变化
      clerk.addListener(({ user }) => {
        console.log("[Clerk] 登录状态变化:", user ? "已登录" : "未登录");
        if (user) {
          setIsAuthenticated(true);
          setUser({
            id: user.id,
            email: user.emailAddresses[0]?.emailAddress || "",
          });
        } else {
          setIsAuthenticated(false);
          setUser(null);
        }
      });
    } catch (err) {
      console.error("[Clerk] 初始化失败:", err);
    }
  });

  const handleLogin = () => {
    const clerk = getClerk();
    if (!clerk) {
      if (!CLERK_PUBLISHABLE_KEY) {
        alert("请配置 Clerk 密钥 (VITE_CLERK_PUBLISHABLE_KEY)");
      } else {
        alert("Clerk 尚未加载完成，请稍候");
      }
      return;
    }
    clerk.openSignIn();
  };

  const handleLogout = () => {
    const clerk = getClerk();
    if (clerk) {
      clerk.signOut();
    }
    setIsAuthenticated(false);
    setUser(null);
  };

  return (
    <>
      <Header
        isAuthenticated={isAuthenticated()}
        userEmail={user()?.email}
        onLogin={handleLogin}
        onLogout={handleLogout}
      />
      <main>
        <Router>
          <Route path="/" component={Home} />
          <Route path="/project/:id/dashboard" component={DashboardPage} />
          <Route path="/share/:token" component={SharePage} />
        </Router>
      </main>
    </>
  );
}

function App() {
  return (
    <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
      <AppRoutes />
    </div>
  );
}

export default App;
