import { useCallback, useEffect, useState } from "react";

import { api, type User } from "@whiteboard/api-client";

import { Icon } from "./ui/Icon";
import { useToast } from "./ui/Toast";

export function UsersScreen({ isAdmin }: { isAdmin: boolean }) {
  const toast = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");

  const load = useCallback(async () => {
    try {
      setUsers(await api.listUsers());
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function create() {
    try {
      await api.createUser({ email, display_name: name, password });
      setEmail("");
      setName("");
      setPassword("");
      toast.success("Dodano użytkownika.");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function remove(id: string, label: string) {
    if (!window.confirm(`Usunąć użytkownika ${label}?`)) return;
    try {
      await api.deleteUser(id);
      toast.info("Usunięto użytkownika.");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="screen">
      <header className="screen-head">
        <h2>Użytkownicy</h2>
      </header>

      {isAdmin && (
        <div className="create-bar wrap">
          <input placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input placeholder="nazwa wyświetlana" value={name} onChange={(e) => setName(e.target.value)} />
          <input
            type="password"
            placeholder="hasło (min. 6)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="primary" onClick={create} disabled={!email || !name || password.length < 6}>
            <Icon name="plus" size={16} />
            <span>Dodaj użytkownika</span>
          </button>
        </div>
      )}

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Nazwa</th>
              <th>Email</th>
              <th>Rola</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.display_name}</td>
                <td className="muted">{u.email}</td>
                <td>{u.is_admin ? <span className="badge">admin</span> : "—"}</td>
                <td className="right">
                  {isAdmin && !u.is_admin && (
                    <button className="danger sm icon-btn" title="Usuń" onClick={() => remove(u.id, u.display_name)}>
                      <Icon name="trash" size={15} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  Brak użytkowników.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
