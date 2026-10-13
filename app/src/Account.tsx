import { useEffect, useState } from "react";
import { api, send } from "./api";
import { Brand, Button, ErrorBox } from "./common";
export function ResetPassword() {
  const [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [done, setDone] = useState(false),
    [busy, setBusy] = useState(false);
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <Brand />
        <h1>Set a new password.</h1>
        {done ? (
          <>
            <p>Your password was updated and old sessions were signed out.</p>
            <a href="/">Return to sign in</a>
          </>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await api(
                  "/auth/reset",
                  send("POST", {
                    token: new URLSearchParams(location.search).get("token"),
                    password,
                  }),
                );
                history.replaceState({}, "", "/reset");
                setDone(true);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              New password
              <input
                required
                type="password"
                minLength={10}
                maxLength={200}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <ErrorBox error={error} />
            <Button disabled={busy}>Save password</Button>
          </form>
        )}
      </div>
    </div>
  );
}
export function AccountAdmin() {
  const [users, setUsers] = useState<
      {
        id: string;
        name: string;
        email: string;
        disabled: boolean;
        admin: boolean;
      }[]
    >([]),
    [error, setError] = useState(""),
    [link, setLink] = useState("");
  const load = () =>
    api<typeof users>("/admin/users")
      .then(setUsers)
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);
  return (
    <div className="page">
      <h1>Teacher accounts</h1>
      <p>
        Recovery links are single-use and expire in 30 minutes. Share privately
        after confirming the teacher’s identity.
      </p>
      <ErrorBox error={error} />
      {link && (
        <label>
          Recovery link
          <input readOnly value={link} onFocus={(e) => e.target.select()} />
        </label>
      )}
      {users.map((u) => (
        <section className="grade-review" key={u.id}>
          <strong>{u.name}</strong>
          <p>
            {u.email} ·{" "}
            {u.admin ? "Administrator" : u.disabled ? "Disabled" : "Active"}
          </p>
          <div className="actions">
            <Button
              secondary
              disabled={u.disabled}
              onClick={async () => {
                try {
                  const r = await api<{ token: string }>(
                    `/admin/users/${u.id}/recovery`,
                    send("POST"),
                  );
                  setLink(`${location.origin}/reset?token=${r.token}`);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Create recovery link
            </Button>
            {!u.admin && (
              <Button
                secondary
                onClick={async () => {
                  try {
                    await api(
                      `/admin/users/${u.id}`,
                      send("PUT", { disabled: !u.disabled }),
                    );
                    load();
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                {u.disabled ? "Enable account" : "Disable account"}
              </Button>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
