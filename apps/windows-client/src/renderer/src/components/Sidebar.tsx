import { type User } from "@whiteboard/api-client";

import { Icon, type IconName } from "./ui/Icon";

export type View = "boards" | "users" | "convert" | "settings";

const NAV: { view: View; label: string; icon: IconName; adminOnly?: boolean }[] = [
  { view: "boards", label: "Tablice", icon: "boards" },
  { view: "users", label: "Użytkownicy", icon: "users" },
  { view: "convert", label: "Konwersja", icon: "convert" },
  { view: "settings", label: "Ustawienia", icon: "settings" },
];

export function Sidebar({
  user,
  active,
  onNavigate,
  onLogout,
}: {
  user: User;
  active: View;
  onNavigate: (v: View) => void;
  onLogout: () => void;
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="login-logo">◇</span>
        <span>Whiteboard</span>
      </div>

      <nav className="sidebar-nav">
        {NAV.map((n) => (
          <button
            key={n.view}
            className={"nav-item" + (active === n.view ? " active" : "")}
            onClick={() => onNavigate(n.view)}
          >
            <Icon name={n.icon} />
            <span>{n.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-foot">
        <div className="sidebar-user">
          <div className="avatar">{user.display_name.slice(0, 1).toUpperCase()}</div>
          <div className="sidebar-user-info">
            <div className="ellipsis">{user.display_name}</div>
            <div className="muted small ellipsis">{user.is_admin ? "administrator" : user.email}</div>
          </div>
        </div>
        <button className="ghost block" onClick={onLogout}>
          <Icon name="logout" size={16} />
          <span>Wyloguj</span>
        </button>
      </div>
    </aside>
  );
}
