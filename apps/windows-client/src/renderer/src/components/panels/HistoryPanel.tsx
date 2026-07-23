import { useCallback, useEffect, useState } from "react";

import {
  api,
  type Board,
  type BoardVersionSummary,
  deviceName,
  setDeviceName,
} from "@whiteboard/api-client";

import { Icon } from "../ui/Icon";
import { useToast } from "../ui/Toast";

export function HistoryPanel({ board, onRestore }: { board: Board; onRestore: (b: Board) => void }) {
  const toast = useToast();
  const [versions, setVersions] = useState<BoardVersionSummary[]>([]);
  const [dev, setDev] = useState(deviceName());
  const [deviceInput, setDeviceInput] = useState(dev);
  const [editingDevice, setEditingDevice] = useState(false);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    try {
      setVersions(await api.listVersions(board.id));
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, [board.id, toast]);

  useEffect(() => {
    load();
  }, [load, board.updated_at]);

  async function saveVersion() {
    try {
      await api.saveVersion(board.id, note.trim() || undefined);
      setNote("");
      toast.success("Zapisano wersję.");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function restore(id: string) {
    try {
      const b = await api.restoreVersion(board.id, id);
      onRestore(b);
      toast.success("Przywrócono wersję (bieżący stan zapisano jako wersję).");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function commitDevice() {
    const name = deviceInput.trim();
    if (name) {
      setDeviceName(name);
      setDev(name);
    }
    setEditingDevice(false);
  }

  return (
    <div className="panel-body">
      <div className="panel-section">
        <div className="device-row">
          <span className="muted small">To urządzenie</span>
          {editingDevice ? (
            <div className="row tight">
              <input
                className="sm"
                value={deviceInput}
                onChange={(e) => setDeviceInput(e.target.value)}
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && commitDevice()}
              />
              <button className="ghost sm" onClick={commitDevice}>
                OK
              </button>
            </div>
          ) : (
            <div className="row tight">
              <code className="chip">{dev}</code>
              <button
                className="ghost sm"
                onClick={() => {
                  setDeviceInput(dev);
                  setEditingDevice(true);
                }}
              >
                Zmień
              </button>
            </div>
          )}
        </div>

        <div className="row tight" style={{ marginTop: 10 }}>
          <input
            className="sm grow"
            placeholder="notatka wersji (opcjonalnie)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveVersion()}
          />
          <button className="primary sm" onClick={saveVersion}>
            <Icon name="history" size={15} />
            <span>Zapisz wersję</span>
          </button>
        </div>
      </div>

      <div className="version-list">
        {versions.length === 0 && (
          <div className="muted small pad">Brak wersji — pojawią się po zapisach tablicy.</div>
        )}
        {versions.map((v) => (
          <div key={v.id} className="version-item">
            <div className="version-main">
              <div className="version-when">{new Date(v.created_at).toLocaleString()}</div>
              <div className="muted small">
                {v.created_by_name ?? "—"} · <code className="chip">{v.device ?? "—"}</code> · {v.node_count} obiektów
              </div>
              {v.note && <div className="version-note">„{v.note}"</div>}
            </div>
            <button className="ghost sm" title="Przywróć tę wersję" onClick={() => restore(v.id)}>
              <Icon name="restore" size={15} />
              <span>Przywróć</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
