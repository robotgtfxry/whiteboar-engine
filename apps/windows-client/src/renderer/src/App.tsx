import { useEffect, useState } from "react";

import { api, hasToken, type User } from "@whiteboard/api-client";

import { BoardsScreen } from "./components/BoardsScreen";
import { BoardWorkspace } from "./components/BoardWorkspace";
import { ConvertScreen } from "./components/ConvertScreen";
import { LoginScreen } from "./components/LoginScreen";
import { SettingsScreen } from "./components/SettingsScreen";
import { Sidebar, type View } from "./components/Sidebar";
import { UsersScreen } from "./components/UsersScreen";

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("boards");
  const [openRoomId, setOpenRoomId] = useState<string | null>(null);

  useEffect(() => {
    if (!hasToken()) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then(setUser)
      .catch(() => api.logout())
      .finally(() => setLoading(false));
  }, []);

  // Most menu aplikacji → CustomEvent "wb:menu" (nasłuchiwany przez ekrany) + nawigacja App.
  useEffect(() => {
    const off = window.desktop?.onMenu((action) => {
      if (action === "menu:settings") {
        setOpenRoomId(null);
        setView("settings");
      } else if (action === "menu:new-board") {
        setOpenRoomId(null);
        setView("boards");
      }
      window.dispatchEvent(new CustomEvent("wb:menu", { detail: action }));
    });
    return off;
  }, []);

  function logout() {
    api.logout();
    setUser(null);
    setOpenRoomId(null);
    setView("boards");
  }

  if (loading) return <div className="app-loading">Ładowanie…</div>;
  if (!user) return <LoginScreen onLogin={setUser} />;
  if (openRoomId) {
    return <BoardWorkspace key={openRoomId} roomId={openRoomId} onClose={() => setOpenRoomId(null)} />;
  }

  return (
    <div className="app-shell">
      <Sidebar user={user} active={view} onNavigate={setView} onLogout={logout} />
      <main className="app-main">
        {view === "boards" && <BoardsScreen onOpen={setOpenRoomId} />}
        {view === "users" && <UsersScreen isAdmin={user.is_admin} />}
        {view === "convert" && <ConvertScreen />}
        {view === "settings" && <SettingsScreen />}
      </main>
    </div>
  );
}
