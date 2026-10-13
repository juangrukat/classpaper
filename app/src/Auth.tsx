import { ArrowRight, Check } from "lucide-react";
import { useState } from "react";
import { api, send } from "./api";
import { Brand, Button, ErrorBox } from "./common";
import type { User } from "./types";

export function Auth({
  setup,
  onLogin,
}: {
  setup: boolean;
  onLogin: (u: User) => void;
}) {
  const [register, setRegister] = useState(setup),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <Brand />
        <div className="eyebrow">A LITTLE LESS PAPERWORK</div>
        <h1>
          {register ? "Your next great test starts here." : "Welcome back."}
        </h1>
        <p className="muted">
          Make thoughtful tests. Print them beautifully.
          <br />
          Share them simply.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const d = await api<{ user: User }>(
                `/auth/${register ? "register" : "login"}`,
                send("POST", { name, email, password }),
              );
              onLogin(d.user);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {register && (
            <label>
              Your name
              <input
                required
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ms. Rivera"
              />
            </label>
          )}
          <label>
            Email
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@school.edu"
            />
          </label>
          <label>
            Password
            <input
              required
              minLength={register ? 10 : 1}
              type="password"
              autoComplete={register ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {register && <small>At least 10 characters.</small>}
          </label>
          <ErrorBox error={error} />
          <Button disabled={busy}>
            {busy
              ? "Opening…"
              : register
                ? "Create teacher account"
                : "Sign in"}
            <ArrowRight size={17} />
          </Button>
        </form>
        {!register && <p className="muted">Forgot your password? Ask your server administrator for a single-use recovery link.</p>}
        <button
          className="text-button"
          onClick={() => {
            setRegister(!register);
            setError("");
          }}
        >
          {register
            ? "Already have an account? Sign in"
            : "New here? Create an account"}
        </button>
      </div>
      <div className="auth-art">
        <div className="art-paper">
          <span>SCIENCE · YEAR 7</span>
          <h2>
            A little curiosity
            <br />
            goes a long way.
          </h2>
          <p>1. What makes a good question?</p>
          <div className="art-line" />
          <div className="art-line short" />
          <p>2. Leave room for discovery.</p>
          <div className="art-line" />
          <div className="art-check">
            <Check size={38} />
          </div>
        </div>
      </div>
    </div>
  );
}
