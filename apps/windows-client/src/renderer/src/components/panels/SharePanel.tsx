import { useCallback, useEffect, useState } from "react";

import {
  type AccessLevel,
  api,
  type Board,
  type Permission,
  type User,
} from "@whiteboard/api-client";

import { copyText } from "../../lib/clipboard";
import { openExternal } from "../../lib/desktopFiles";
import { roomLink } from "../../lib/settings";
import { Icon } from "../ui/Icon";
import { useToast } from "../ui/Toast";

const LEVELS: AccessLevel[] = ["read", "edit", "owner"];

export function SharePanel({ board }: { board: Board }) {
  const toast = useToast();
  const [perms, setPerms] = useState<Permission[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [userId, setUserId] = useState("");
  const [level, setLevel] = useState<AccessLevel>("read");
  const [showSecret, setShowSecret] = useState(false);

  const load = useCallback(async () => {
    try {
      setPerms(await api.listPermissions(board.id));
    } catch (e) {
      toast.error((e as Error).message);
    }
    // Lista użytkowników bywa dostępna tylko dla admina — brak nie blokuje panelu.
    try {
      setUsers(await api.listUsers());
    } catch {
      setUsers([]);
    }
  }, [board.id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const link = board.room_id ? roomLink(board.room_id) : null;

  function nameFor(id: string) {
    return users.find((u) => u.id === id)?.display_name ?? id;
  }

  async function copyLink() {
    if (!link) return;
    (await copyText(link)) ? toast.success("Skopiowano link do pokoju.") : toast.error("Nie udało się skopiować.");
  }

  async function copySecret() {
    if (!board.secret) return;
    (await copyText(board.secret)) ? toast.success("Skopiowano tajny klucz tablicy.") : toast.error("Nie udało się skopiować.");
  }

  async function grant() {
    if (!userId) return;
    try {
      await api.grantPermission(board.id, { user_id: userId, level });
      setUserId("");
      toast.success("Nadano dostęp.");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function revoke(uid: string) {
    try {
      await api.revokePermission(board.id, uid);
      toast.info("Odebrano dostęp.");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const grantable = users.filter((u) => !perms.some((p) => p.user_id === u.id));

  return (
    <div className="panel-body">
      {/* Klucze tablicy: publiczny link pokoju + prywatny sekret */}
      <div className="panel-section">
        <div className="section-title">
          <Icon name="key" size={15} />
          <span>Klucze tablicy</span>
        </div>

        <div className="key-field">
          <span className="muted small">Link pokoju (publiczny)</span>
          {link ? (
            <div className="row tight">
              <code className="chip grow ellipsis">{link}</code>
              <button className="ghost sm icon-btn" title="Kopiuj link" onClick={copyLink}>
                <Icon name="copy" size={15} />
              </button>
              <button
                className="ghost sm icon-btn"
                title="Otwórz w przeglądarce"
                onClick={() => link && openExternal(link)}
              >
                <Icon name="external" size={15} />
              </button>
            </div>
          ) : (
            <div className="muted small">Ta tablica nie ma jeszcze pokoju.</div>
          )}
        </div>

        <div className="key-field">
          <span className="muted small">Tajny klucz (prywatny, nie w linku)</span>
          {board.secret ? (
            <div className="row tight">
              <code className="chip grow ellipsis">
                {showSecret ? board.secret : `${board.secret.slice(0, 8)}${"•".repeat(12)}`}
              </code>
              <button
                className="ghost sm icon-btn"
                title={showSecret ? "Ukryj" : "Pokaż"}
                onClick={() => setShowSecret((s) => !s)}
              >
                <Icon name="eye" size={15} />
              </button>
              <button className="ghost sm icon-btn" title="Kopiuj klucz" onClick={copySecret}>
                <Icon name="copy" size={15} />
              </button>
            </div>
          ) : (
            <div className="muted small">—</div>
          )}
        </div>
      </div>

      {/* Współdzielenie: dostępy użytkowników */}
      <div className="panel-section">
        <div className="section-title">
          <Icon name="share" size={15} />
          <span>Współdzielenie (dostępy)</span>
        </div>

        <div className="row tight">
          <select className="sm grow" value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">— wybierz użytkownika —</option>
            {grantable.map((u) => (
              <option key={u.id} value={u.id}>
                {u.display_name} ({u.email})
              </option>
            ))}
          </select>
          <select className="sm" value={level} onChange={(e) => setLevel(e.target.value as AccessLevel)}>
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          <button className="primary sm" onClick={grant} disabled={!userId}>
            Nadaj
          </button>
        </div>

        <div className="perm-list">
          {perms.length === 0 && (
            <div className="muted small pad">
              Brak nadanych dostępów (właściciel i admin mają dostęp automatycznie).
            </div>
          )}
          {perms.map((p) => (
            <div key={p.id} className="perm-item">
              <span className="ellipsis">{nameFor(p.user_id)}</span>
              <span className="badge">{p.level}</span>
              <button className="danger sm icon-btn" title="Odbierz dostęp" onClick={() => revoke(p.user_id)}>
                <Icon name="trash" size={15} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
