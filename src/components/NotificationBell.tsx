import { useState, useEffect, useRef } from "preact/compat";
import { api } from "../services/api";
import { useLocation } from "wouter";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get<{ notifications: Notification[]; unread: number }>("/merchant/notifications?limit=10")
      .then((r) => { setNotifications(r.notifications); setUnread(r.unread); }).catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markRead = async (id: string) => {
    await api.patch(`/merchant/notifications/${id}/read`, {});
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnread((prev) => Math.max(0, prev - 1));
  };

  const markAllRead = async () => {
    await api.patch("/merchant/notifications/read-all", {});
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen(!open)} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", color: "#fff", position: "relative" }}>
        <span class="material-symbols-outlined" style={{ fontSize: "24px" }}>notifications</span>
        {unread > 0 && (
          <span style={{
            position: "absolute", top: -2, right: -2, background: "#B12704", color: "#fff",
            borderRadius: "50%", width: "18px", height: "18px", fontSize: "11px",
            display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700,
          }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "100%", left: "0", width: "320px", background: "#fff",
          borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.15)", zIndex: 1000,
          maxHeight: "400px", overflowY: "auto", marginTop: "8px", direction: "rtl",
        }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #EAEDED", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 700, fontSize: "14px", color: "#0F1111" }}>الإشعارات</span>
            {unread > 0 && (
              <button onClick={markAllRead} style={{ background: "none", border: "none", color: "#007185", cursor: "pointer", fontSize: "12px", fontWeight: 600 }}>
                تحديد الكل كمقروء
              </button>
            )}
          </div>
          {notifications.length === 0 && (
            <div style={{ padding: "24px", textAlign: "center", color: "#565959", fontSize: "13px" }}>
              لا توجد إشعارات
            </div>
          )}
          {notifications.map((n) => (
            <div key={n.id} onClick={() => !n.read && markRead(n.id)}
              style={{
                padding: "12px 16px", borderBottom: "1px solid #EAEDED", cursor: "pointer",
                background: n.read ? "#fff" : "#F0F7FF", transition: "background 0.15s",
              }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <span style={{ fontWeight: 600, fontSize: "13px", color: "#0F1111" }}>{n.title}</span>
                {!n.read && <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#FF9900", flexShrink: 0 }} />}
              </div>
              <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#565959", lineHeight: 1.3 }}>{n.message}</p>
              <span style={{ fontSize: "10px", color: "#999", marginTop: "4px", display: "block" }}>
                {new Date(n.createdAt).toLocaleDateString("ar-EG", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
