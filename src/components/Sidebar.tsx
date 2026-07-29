import { useState, useEffect } from "preact/compat";
import { useLocation } from "wouter";
import { api } from "../services/api";
import NotificationBell from "./NotificationBell";

const MERCHANT_NAV = [
  { path: "/merchant", label: "لوحة التحكم", icon: "dashboard" },
  { path: "/merchant/orders", label: "الطلبات", icon: "receipt_long" },
  { path: "/merchant/products", label: "المنتجات", icon: "inventory_2" },
  { path: "/merchant/customers", label: "العملاء", icon: "people" },
  { path: "/merchant/sellers", label: "البائعين", icon: "groups" },
  { path: "/merchant/store-links", label: "روابط تسويقية", icon: "link" },
  { path: "/merchant/analytics", label: "التحليلات", icon: "bar_chart" },
  { path: "/merchant/reports", label: "التقارير", icon: "assessment" },
  { path: "/merchant/landing-pages", label: "صفحات هبوط", icon: "web" },
  { path: "/merchant/team", label: "فريق العمل", icon: "group" },
  { path: "/merchant/roles", label: "الأدوار", icon: "manage_accounts" },
  { path: "/merchant/settings", label: "الإعدادات", icon: "settings" },
];

const SUPER_ADMIN_NAV = [
  { path: "/merchant", label: "لوحة التحكم", icon: "dashboard" },
  { path: "/super-admin/orders", label: "الطلبات", icon: "receipt_long" },
  { path: "/super-admin/product", label: "المنتجات", icon: "inventory_2" },
  { path: "/super-admin/customers", label: "العملاء", icon: "people" },
  { path: "/super-admin/reports", label: "التقارير", icon: "bar_chart" },
  { path: "/super-admin/stores", label: "المتاجر", icon: "store" },
  { path: "/super-admin/store-links", label: "روابط المتاجر", icon: "link" },
  { path: "/super-admin/tenants", label: "التجار", icon: "groups" },
  { path: "/super-admin/subscriptions", label: "الباقات", icon: "subscriptions" },
  { path: "/super-admin/billing", label: "الفواتير", icon: "receipt" },
  { path: "/super-admin/settings", label: "الإعدادات", icon: "settings" },
];

interface StoreData {
  id: string;
  ref: string;
  name: string;
  active: boolean;
}

export default function Sidebar() {
  const [loc, navigate] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [stores, setStores] = useState<StoreData[]>([]);

  const isSuperAdmin = () => {
    const adminStr = localStorage.getItem("admin");
    if (!adminStr) return false;
    return JSON.parse(adminStr).role === "super_admin";
  };

  useEffect(() => {
    api.get<StoreData[]>("/admin/settings/stores").then(setStores).catch(() => {});
  }, []);

  const isActive = (path: string) => loc === path;

  const toggleMenu = (open: boolean) => {
    setMenuOpen(open);
    document.body.classList.toggle("menu-open", open);
  };

  const handleNav = (path: string) => {
    navigate(path);
    toggleMenu(false);
  };

  const copyLink = (ref: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/store?ref=${ref}`);
    const el = document.createElement("div");
    el.className = "amazon-toast amazon-toast-success show";
    el.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px">check</span> تم نسخ الرابط';
    document.body.appendChild(el);
    setTimeout(() => { el.classList.remove("show"); setTimeout(() => el.remove(), 400); }, 2000);
  };

  const nav = isSuperAdmin() ? SUPER_ADMIN_NAV : MERCHANT_NAV;

  return (
    <>
      <div className="sb-mobile" style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, height: "56px", background: "#131921", borderBottom: "1px solid rgba(255,255,255,0.1)", padding: "12px 16px", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button onClick={() => toggleMenu(!menuOpen)} style={{ background: "none", border: "none", cursor: "pointer", padding: "8px", color: "#fff", display: "flex", alignItems: "center" }}>
            <span class="material-symbols-outlined" style={{ fontSize: "24px" }}>menu</span>
          </button>
          <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "20px", fontWeight: 700, color: "#FEBD69" }}>M&K Store</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <NotificationBell />
          <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "#FEBD69", color: "#131921", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "14px" }}>M</div>
        </div>
      </div>

      {menuOpen && (
        <div onClick={() => toggleMenu(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ position: "fixed", top: 0, right: 0, width: "256px", height: "100dvh", background: "#131921", boxShadow: "-4px 0 12px rgba(0,0,0,0.3)", display: "flex", flexDirection: "column" }}>
            <SidebarInner nav={nav} isActive={isActive} handleNav={handleNav} copyLink={copyLink} navigate={navigate} stores={stores} isSuperAdmin={isSuperAdmin()} />
          </div>
        </div>
      )}

      <aside className="sb-desktop" style={{ width: "256px", background: "#131921", borderLeft: "1px solid rgba(255,255,255,0.1)", minHeight: "100vh", flexShrink: 0, flexDirection: "column", position: "relative", zIndex: 40, boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}>
        <SidebarInner nav={nav} isActive={isActive} handleNav={handleNav} copyLink={copyLink} navigate={navigate} stores={stores} isSuperAdmin={isSuperAdmin()} />
      </aside>
    </>
  );
}

function SidebarInner({ nav, isActive, handleNav, copyLink, navigate, stores, isSuperAdmin }: {
  nav: { path: string; label: string; icon: string }[];
  isActive: (p: string) => boolean;
  handleNav: (p: string) => void;
  copyLink: (r: string) => void;
  navigate: (p: string) => void;
  stores: StoreData[];
  isSuperAdmin: boolean;
}) {
  return (
    <div style={{ padding: "20px", display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "36px", fontWeight: 700, letterSpacing: "-0.02em", color: "#FEBD69", margin: "0 0 8px", padding: "0 16px", lineHeight: "44px" }}>
          M&K Store
        </h1>
        <p style={{ padding: "0 16px", fontSize: "12px", fontWeight: 500, color: "#693c00", margin: 0, opacity: 0.7 }}>إدارة المتجر الذكي</p>
      </div>
      <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
        {nav.map((item) => (
          <a key={item.path} onClick={() => handleNav(item.path)}
            style={{
              display: "flex", alignItems: "center", gap: "12px",
              margin: "0 8px", padding: "12px 16px", borderRadius: "8px", cursor: "pointer",
              background: isActive(item.path) ? "#232F3E" : "transparent",
              color: isActive(item.path) ? "#FEBD69" : "#B0B8C1",
              fontWeight: isActive(item.path) ? 700 : 400,
              fontSize: "14px", textDecoration: "none", transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { if (!isActive(item.path)) { (e.currentTarget as HTMLElement).style.background = "#232F3E"; (e.currentTarget as HTMLElement).style.color = "#fff"; } }}
            onMouseLeave={(e) => { if (!isActive(item.path)) { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "#B0B8C1"; } }}>
            <span class="material-symbols-outlined" style={{ fontSize: "20px" }}>{item.icon}</span>
            <span>{item.label}</span>
          </a>
        ))}
      </nav>
      <div style={{ marginTop: "auto", paddingTop: "16px", borderTop: "1px solid rgba(255,255,255,0.1)", display: "flex", flexDirection: "column", gap: "8px" }}>
        {stores.filter((s: StoreData) => s.active).map((s: StoreData) => (
          <a key={s.ref} onClick={() => copyLink(s.ref)}
            style={{ display: "flex", alignItems: "center", gap: "12px", margin: "0 8px", padding: "12px 16px", borderRadius: "8px", cursor: "pointer", color: "#FF9900", fontSize: "14px", textDecoration: "none" }}>
            <span class="material-symbols-outlined" style={{ fontSize: "20px" }}>link</span>
            <span>نسخ رابط {s.name}</span>
          </a>
        ))}
        {isSuperAdmin && <a onClick={() => handleNav("/super-admin/tenants")}
          style={{ display: "flex", alignItems: "center", gap: "12px", margin: "0 8px", padding: "12px 16px", borderRadius: "8px", cursor: "pointer", color: isActive("/super-admin/tenants") ? "#FEBD69" : "#B0B8C1", fontSize: "14px", textDecoration: "none" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#232F3E"; (e.currentTarget as HTMLElement).style.color = "#fff"; }}
          onMouseLeave={(e) => { if (!isActive("/super-admin/tenants")) { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "#B0B8C1"; } }}>
          <span class="material-symbols-outlined" style={{ fontSize: "20px" }}>admin_panel_settings</span>
          <span>المشرف العام</span>
        </a>}
        <a onClick={() => {}}
          style={{ display: "flex", alignItems: "center", gap: "12px", margin: "0 8px", padding: "12px 16px", borderRadius: "8px", cursor: "pointer", color: "#B0B8C1", fontSize: "14px", textDecoration: "none" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#232F3E"; (e.currentTarget as HTMLElement).style.color = "#fff"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "#B0B8C1"; }}>
          <span class="material-symbols-outlined" style={{ fontSize: "20px" }}>help</span>
          <span>الدعم</span>
        </a>
        <a onClick={() => { localStorage.removeItem("token"); localStorage.removeItem("admin"); navigate("/login"); }}
          style={{ display: "flex", alignItems: "center", gap: "12px", margin: "0 8px", padding: "12px 16px", borderRadius: "8px", cursor: "pointer", color: "#B12704", fontSize: "14px", textDecoration: "none" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(177,39,4,0.1)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
          <span class="material-symbols-outlined" style={{ fontSize: "20px" }}>logout</span>
          <span>تسجيل الخروج</span>
        </a>
      </div>
    </div>
  );
}
