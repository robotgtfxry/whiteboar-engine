import { useState } from "react";

import { deviceName, setDeviceName } from "@whiteboard/api-client";

import { DEFAULTS, getApiUrl, getShareBase, setApiUrl, setShareBase } from "../lib/settings";
import { Icon } from "./ui/Icon";
import { useToast } from "./ui/Toast";

export function SettingsScreen() {
  const toast = useToast();
  const [apiUrl, setApiUrlState] = useState(getApiUrl());
  const [shareBase, setShareBaseState] = useState(getShareBase());
  const [device, setDeviceState] = useState(deviceName());

  function save() {
    const normalizedApi = apiUrl.trim().replace(/\/+$/, "");
    const apiChanged = normalizedApi !== getApiUrl();

    setApiUrl(apiUrl);
    setShareBase(shareBase);
    const d = device.trim();
    if (d) setDeviceName(d);

    toast.success("Zapisano ustawienia.");
    if (apiChanged) {
      toast.info("Zmieniono serwer API — przeładowanie okna…");
      window.setTimeout(() => window.location.reload(), 800);
    }
  }

  function resetDefaults() {
    setApiUrlState(DEFAULTS.apiUrl);
    setShareBaseState(DEFAULTS.shareBase);
  }

  return (
    <div className="screen">
      <header className="screen-head">
        <h2>Ustawienia</h2>
      </header>

      <div className="card settings-card">
        <label className="field">
          <span>Adres serwera API</span>
          <input value={apiUrl} onChange={(e) => setApiUrlState(e.target.value)} placeholder={DEFAULTS.apiUrl} />
          <small className="muted">
            Backend, z którym łączy się klient (np. <code>{DEFAULTS.apiUrl}</code>). Zmiana wymaga przeładowania okna.
          </small>
        </label>

        <label className="field">
          <span>Bazowy adres linków pokoju</span>
          <input value={shareBase} onChange={(e) => setShareBaseState(e.target.value)} placeholder={DEFAULTS.shareBase} />
          <small className="muted">
            Publiczny klient web, z którego budowany jest udostępniany link: <code>{shareBase || DEFAULTS.shareBase}/room/&lt;id&gt;</code>.
          </small>
        </label>

        <label className="field">
          <span>Nazwa tego urządzenia</span>
          <input value={device} onChange={(e) => setDeviceState(e.target.value)} />
          <small className="muted">Widoczna w historii wersji tablic (audyt „na jakim urządzeniu").</small>
        </label>

        <div className="row tight">
          <button className="primary" onClick={save}>
            <Icon name="save" size={16} />
            <span>Zapisz ustawienia</span>
          </button>
          <button className="ghost" onClick={resetDefaults}>
            Przywróć domyślne
          </button>
        </div>
      </div>
    </div>
  );
}
