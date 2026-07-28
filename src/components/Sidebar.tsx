import { useState } from "preact/compat";
import { useLocation } from "wouter";

const NAV_ITEMS = [
  { path: "/admin", label: "لوحة التحكم", icon: "📊" },
  { path: "/admin/product", label: "المنتجات", icon: "📦" },
  { path: "/admin/orders", label: "الطلبات", icon: "🛒" },
];

export default function Sidebar() {
  const [loc, navigate] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const origin = window.location.origin;

  const isActive = (path: string) => loc === path;

  const toggleMenu = (open: boolean) => {
    setMenuOpen(open);
    document.body.classList.toggle("menu-open", open);
  };

  const handleNav = (path: string) => {
    navigate(path);
    toggleMenu(false);
  };

  const linkBtns = [
    { ref: "1", label: "نسخ رابط بنطلون الساحل", color: "#c2410c" },
    { ref: "2", label: "نسخ رابط مالك ستور", color: "#006e2f" },
  ];

  return (
    <>
      <style>{`
        .sb-desk { display: flex; flex-direction: column; }
        .sb-top { display: none; }
        .sb-overlay { display: none; }
        @media (max-width: 767px) {
          .sb-desk { display: none !important; }
          .sb-top { display: flex !important; position: fixed; top: 0; left: 0; right: 0; z-index: 100; }
          .sb-overlay.open { display: block !important; }
        }
      `}</style>

      <div className="sb-top" style={{ background: "white", borderBottom: "1px solid #e4e4e7", padding: "10px 16px", alignItems: "center", gap: "12px" }}>
        <button onClick={() => toggleMenu(!menuOpen)} style={{ background: "none", border: "none", fontSize: "22px", cursor: "pointer", padding: "4px", color: "#1a1b22" }}>
          {menuOpen ? "✕" : "☰"}
        </button>
        <div style={{ flex: 1, textAlign: "center" }}>
          <span style={{ fontSize: "15px", fontWeight: 600 }}>المتجر الفاخر</span>
        </div>
      </div>

      <div className={"sb-overlay" + (menuOpen ? " open" : "")} onClick={() => toggleMenu(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200, top: 0 }}>
        <div onClick={(e) => e.stopPropagation()} style={{
          position: "fixed", top: 0, right: 0, width: "260px", height: "100dvh",
          background: "white", boxShadow: "-4px 0 12px rgba(0,0,0,0.15)",
          display: "flex", flexDirection: "column",
        }}>
          <div style={{ padding: "16px", borderBottom: "1px solid #e4e4e7", textAlign: "center" }}>
            <span style={{ fontSize: "15px", fontWeight: 600 }}>المتجر الفاخر</span>
          </div>
          <nav style={{ padding: "8px", flex: 1 }}>
            {NAV_ITEMS.map((item) => (
              <button key={item.path} onClick={() => handleNav(item.path)} style={{
                display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "10px 12px",
                border: "none", borderRadius: "6px", background: isActive(item.path) ? "#f4f4f5" : "transparent",
                color: isActive(item.path) ? "black" : "#4c4546", fontWeight: isActive(item.path) ? 600 : 400,
                cursor: "pointer", fontSize: "14px", textAlign: "right", marginBottom: "2px",
              }}>
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
          <div style={{ padding: "8px", borderTop: "1px solid #e4e4e7" }}>
            {linkBtns.map((b) => (
              <button key={b.ref} onClick={() => { navigator.clipboard.writeText(`${origin}/store?ref=${b.ref}`); alert(b.ref === "1" ? "تم نسخ رابط بنطلون الساحل" : "تم نسخ رابط مالك ستور"); }}
                style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "10px 12px", border: "none", borderRadius: "6px", background: "transparent", color: b.color, cursor: "pointer", fontSize: "14px", marginBottom: "2px" }}>
                <span>🔗</span>
                <span>{b.label}</span>
              </button>
            ))}
            <button onClick={() => { localStorage.removeItem("token"); navigate("/admin/login"); }}
              style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "10px 12px", border: "none", borderRadius: "6px", background: "transparent", color: "#ba1a1a", cursor: "pointer", fontSize: "14px" }}>
              <span>🚪</span>
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </div>
      </div>

      <aside className="sb-desk" style={{
        width: "220px", background: "white", borderLeft: "1px solid #e4e4e7",
        minHeight: "100vh", flexShrink: 0,
      }}>
        <div style={{ padding: "20px 16px", borderBottom: "1px solid #e4e4e7" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 600, margin: 0 }}>المتجر الفاخر</h2>
        </div>
        <nav style={{ padding: "8px", flex: 1 }}>
          {NAV_ITEMS.map((item) => (
            <button key={item.path} onClick={() => navigate(item.path)} style={{
              display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "10px 12px",
              border: "none", borderRadius: "6px", background: isActive(item.path) ? "#f4f4f5" : "transparent",
              color: isActive(item.path) ? "black" : "#4c4546", fontWeight: isActive(item.path) ? 600 : 400,
              cursor: "pointer", fontSize: "14px", textAlign: "right", marginBottom: "2px",
            }}>
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div style={{ padding: "8px", borderTop: "1px solid #e4e4e7" }}>
          {linkBtns.map((b) => (
            <button key={b.ref} onClick={() => { navigator.clipboard.writeText(`${origin}/store?ref=${b.ref}`); alert(b.ref === "1" ? "تم نسخ رابط بنطلون الساحل" : "تم نسخ رابط مالك ستور"); }}
              style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "10px 12px", border: "none", borderRadius: "6px", background: "transparent", color: b.color, cursor: "pointer", fontSize: "14px", marginBottom: "2px" }}>
              <span>🔗</span>
              <span>{b.label}</span>
            </button>
          ))}
          <button onClick={() => { localStorage.removeItem("token"); navigate("/admin/login"); }}
            style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "10px 12px", border: "none", borderRadius: "6px", background: "transparent", color: "#ba1a1a", cursor: "pointer", fontSize: "14px" }}>
            <span>🚪</span>
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>
    </>
  );
}
