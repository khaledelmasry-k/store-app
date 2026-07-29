import { useState, useEffect } from "preact/compat";
import { api } from "../services/api";
import Sidebar from "../components/Sidebar";

interface StoreData {
  id: string; ref: string; name: string; active: boolean;
}

export default function AdminStoreLinks() {
  const [stores, setStores] = useState<StoreData[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    api.get<StoreData[]>("/admin/settings/stores").then(setStores).catch(() => {});
  }, []);

  const copyLink = (ref: string, name: string) => {
    const url = `${window.location.origin}/store?ref=${ref}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(name);
      setTimeout(() => setCopied(null), 2000);
    }).catch(() => {
      const el = document.createElement("textarea");
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(name);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  return (
    <div style={{ background: "#EAEDED", minHeight: "100vh", display: "flex" }}>
      <Sidebar />
      <div className="admin-content" style={{ flex: 1, padding: "24px", minHeight: "100vh" }}>
        <div style={{ marginBottom: "24px" }}>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "24px", fontWeight: 600, color: "#0F1111", margin: 0 }}>🔗 روابط المتاجر</h2>
          <p style={{ fontSize: "14px", color: "#595f68", margin: "4px 0 0" }}>شارك روابط المتاجر مع عملائك</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px" }}>
          {stores.filter((s) => s.active).map((store) => (
            <div key={store.id} style={{ background: "#fff", borderRadius: "12px", border: "1px solid #DDDDDD", padding: "24px", boxShadow: "0 2px 4px rgba(0,0,0,0.08)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "#131921", display: "flex", alignItems: "center", justifyContent: "center", color: "#FEBD69", fontSize: "24px", fontWeight: 800 }}>
                    {store.name[0]}
                  </div>
                  <div>
                    <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 4px" }}>{store.name}</h3>
                    <span style={{ fontSize: "12px", color: "#565959" }}>المرجع: {store.ref}</span>
                  </div>
                </div>
                <span style={{ background: "#067D62", color: "#fff", padding: "4px 12px", borderRadius: "9999px", fontSize: "11px", fontWeight: 600 }}>نشط</span>
              </div>

              <div style={{ background: "#F6F8F8", borderRadius: "8px", padding: "12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", border: "1px solid #EAEDED" }}>
                <span style={{ fontSize: "13px", color: "#565959", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }} dir="ltr">
                  {window.location.origin}/store?ref={store.ref}
                </span>
                <button onClick={() => copyLink(store.ref, store.name)} style={{ background: copied === store.name ? "#067D62" : "#FF9900", border: "none", color: copied === store.name ? "#fff" : "#131921", padding: "8px 16px", borderRadius: "8px", fontWeight: 700, fontSize: "13px", cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.2s" }}>
                  {copied === store.name ? "تم النسخ ✓" : "نسخ الرابط"}
                </button>
              </div>

              <div style={{ marginTop: "16px", display: "flex", gap: "12px" }}>
                <button onClick={() => {
                  const msg = encodeURIComponent(`تسوق من ${store.name} عبر الرابط التالي:\n${window.location.origin}/store?ref=${store.ref}`);
                  window.open(`https://wa.me/?text=${msg}`, "_blank");
                }} style={{ flex: 1, background: "#25D366", border: "none", color: "#fff", padding: "10px", borderRadius: "8px", fontWeight: 600, fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                  <span>📱</span> مشاركة عبر واتساب
                </button>
                <button onClick={() => {
                  const msg = encodeURIComponent(`تسوق من ${store.name}\n${window.location.origin}/store?ref=${store.ref}`);
                  window.open(`https://www.facebook.com/sharer/sharer.php?quote=${msg}`, "_blank");
                }} style={{ flex: 1, background: "#1877F2", border: "none", color: "#fff", padding: "10px", borderRadius: "8px", fontWeight: 600, fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                  <span>📘</span> مشاركة عبر فيسبوك
                </button>
              </div>
            </div>
          ))}
          {stores.filter((s) => s.active).length === 0 && (
            <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "48px", color: "#565959" }}>
              لا توجد متاجر نشطة. قم بإضافة متجر من صفحة الإعدادات.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
