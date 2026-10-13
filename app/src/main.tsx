import { AccountAdmin, ResetPassword } from "./Account";
import {
  BarChart3,
  FileText,
  LayoutDashboard,
  Library,
  LogOut,
} from "lucide-react";
import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createRoot } from "react-dom/client";
import { api, send } from "./api";
const Auth = lazy(() => import("./Auth").then((m) => ({ default: m.Auth })));
const Bank = lazy(() => import("./Bank").then((m) => ({ default: m.Bank })));
import { Brand, Button, ErrorBox } from "./common";
const Dashboard = lazy(() =>
  import("./Dashboard").then((m) => ({ default: m.Dashboard })),
);
const Editor = lazy(() =>
  import("./Editor").then((m) => ({ default: m.Editor })),
);
const PrintPage = lazy(() =>
  import("./PrintPage").then((m) => ({ default: m.PrintPage })),
);
const Results = lazy(() =>
  import("./Results").then((m) => ({ default: m.Results })),
);
const Student = lazy(() =>
  import("./Student").then((m) => ({ default: m.Student })),
);
import "./style.css";
import type { User } from "./types";

export function App() {
  const [auth, setAuth] = useState<{
      user: User | null;
      setup: boolean;
    } | null>(null),
    [view, setView] = useState<"tests" | "bank" | "results" | "accounts">(
      "tests",
    ),
    [testId, setTestId] = useState<string | null>(null),
    [error, setError] = useState("");
  const path = window.location.pathname;
  useEffect(() => {
    if (!path.startsWith("/take/"))
      api<{ user: User | null; setup: boolean }>("/auth/me")
        .then(setAuth)
        .catch((e) => setError(e.message));
  }, []);
  if (path === "/reset") return <ResetPassword />;
  if (path.startsWith("/take/")) return <Student code={path.split("/")[2]} />;
  if (error)
    return (
      <div className="auth-wrap">
        <ErrorBox error={error} />
        <Button onClick={() => location.reload()}>Try again</Button>
      </div>
    );
  if (!auth)
    return (
      <div className="loading">
        <Brand />
        <p>Opening your workspace…</p>
      </div>
    );
  if (!auth.user)
    return (
      <Auth
        setup={auth.setup}
        onLogin={(u) => setAuth({ user: u, setup: false })}
      />
    );
  if (path.startsWith("/print/")) return <PrintPage id={path.split("/")[2]} />;
  return (
    <div className="app">
      <aside className="sidebar">
        <Brand />
        <div className="workspace-label">TEACHER WORKSPACE</div>
        <nav>
          {(
            [
              ["tests", "My tests", LayoutDashboard],
              ["bank", "Question bank", Library],
              ["results", "Results", BarChart3],
            ] as const
          ).map(([v, label, Icon]) => (
            <button
              key={v}
              className={view === v ? "active" : ""}
              onClick={() => {
                setView(v);
                setTestId(null);
              }}
            >
              <Icon size={19} />
              {label}
              {view === v && <span className="nav-dot" />}
            </button>
          ))}
          {auth.user.admin && (
            <button
              onClick={() => {
                setView("accounts");
                setTestId(null);
              }}
            >
              Teacher accounts
            </button>
          )}
        </nav>
        <div className="sidebar-note">
          <span className="tiny-label">LESS ADMIN. MORE TEACHING.</span>
          <p>
            A good test starts with
            <br />a good question.
          </p>
          <div className="paper-stack">
            <FileText size={43} />
          </div>
        </div>
        <div className="profile">
          <span className="avatar">
            {auth.user.name.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <strong>{auth.user.name}</strong>
            <small>Teacher</small>
          </div>
          <button
            className="icon"
            aria-label="Sign out"
            onClick={() =>
              api("/auth/logout", send("POST")).then(() =>
                setAuth({ user: null, setup: false }),
              )
            }
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <main className="main">
        {testId ? (
          <Editor id={testId} onBack={() => setTestId(null)} user={auth.user} />
        ) : view === "tests" ? (
          <Dashboard user={auth.user} open={setTestId} />
        ) : view === "bank" ? (
          <Bank />
        ) : view === "accounts" ? (
          <AccountAdmin />
        ) : (
          <Results />
        )}
      </main>
    </div>
  );
}
class AppBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="auth-wrap">
        <div className="auth-card">
          <Brand />
          <h1>Let’s reopen your workspace.</h1>
          <p>
            The app may have been updated. Reload to continue with your saved
            work.
          </p>
          <Button onClick={() => location.reload()}>Reload Classpaper</Button>
        </div>
      </div>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")!).render(
  <AppBoundary>
    <Suspense
      fallback={
        <div className="loading">
          <Brand />
          <p>Opening…</p>
        </div>
      }
    >
      <App />
    </Suspense>
  </AppBoundary>,
);
