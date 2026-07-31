import { useState, useEffect } from "preact/compat";
import { api } from "../services/api";
import Sidebar from "../components/Sidebar";

interface StoreData {
  id: string; ref: string; name: string; active: boolean;
}

export default function AdminSuperAdmin() {
  const [stores, setStores] = useState<StoreData[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<null | { id: string | null; ref: string; name: string }>(null);
  const [form, setForm] = useState({ ref: "", name: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { loadStores(); }, []);

  const loadStores = () => {
    api.get<StoreData[]>("/admin/settings/stores").then((d) => { setStores(d); setLoading(false); }).catch(() => setLoading(false));
  };

  const openCreate = () => {
    setForm({ ref: "", name: "" });
    setError("");
    setModal({ id: null, ref: "", name: "" });
  };

  const openEdit = (store: StoreData) => {
    setForm({ ref: store.ref, name: store.name });
    setError("");
    setModal({ id: store.id, ref: store.ref, name: store.name });
  };

  const saveStore = async () => {
    if (!form.name.trim() || !form.ref.trim()) { setError("الاسم والمرجع مطلوبان"); return; }
    setSaving(true);
    setError("");
    try {
      if (modal?.id) {
        await api.patch(`/admin/settings/stores/${modal.id}`, form);
      } else {
        await api.post("/admin/settings/stores", form);
      }
      setModal(null);
      loadStores();
    } catch (e: any) {
      setError(e?.message || e?.error || "حدث خطأ");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (store: StoreData) => {
    try {
      await api.patch(`/admin/settings/stores/${store.id}`, { active: !store.active });
      loadStores();
    } catch (e: any) {
      setError(e?.message || e?.error || "حدث خطأ");
    }
  };

  return (
    <div style={{ background: "#EAEDED", minHeight: "100vh", display: "flex" }}>
      <Sidebar />
      <div className="admin-content" style={{ flex: 1, padding: "24px", minHeight: "100vh" }}>
        <div style={{ marginBottom: "32px" }}>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "24px", fontWeight: 600, color: "#0F1111", margin: 0 }}>المشرف العام</h2>
          <p style={{ fontSize: "14px", color: "#595f68", margin: "4px 0 0" }}>إدارة المتاجر والمستخدمين من مكان واحد</p>
        </div>

        {error && <div style={{ background: "#FDECEA", color: "#B12704", padding: "12px 16px", borderRadius: "8px", marginBottom: "16px", fontSize: "14px" }}>{error}</div>}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px", marginBottom: "32px" }}>
          <div style={{ background: "#fff", padding: "24px", borderRadius: "12px", border: "1px solid #DDDDDD", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
            <span style={{ fontSize: "32px" }}>🏪</span>
            <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "28px", fontWeight: 700, color: "#131921", marginTop: "8px" }}>{loading ? "..." : stores.length}</div>
            <div style={{ fontSize: "13px", color: "#565959" }}>إجمالي المتاجر</div>
          </div>
          <div style={{ background: "#fff", padding: "24px", borderRadius: "12px", border: "1px solid #DDDDDD", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
            <span style={{ fontSize: "32px" }}>✅</span>
            <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "28px", fontWeight: 700, color: "#067D62", marginTop: "8px" }}>{loading ? "..." : stores.filter((s) => s.active).length}</div>
            <div style={{ fontSize: "13px", color: "#565959" }}>المتاجر النشطة</div>
          </div>
          <div style={{ background: "#fff", padding: "24px", borderRadius: "12px", border: "1px solid #DDDDDD", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
            <span style={{ fontSize: "32px" }}>👤</span>
            <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "28px", fontWeight: 700, color: "#007185", marginTop: "8px" }}>1</div>
            <div style={{ fontSize: "13px", color: "#565959" }}>المستخدمين</div>
          </div>
          <div style={{ background: "#fff", padding: "24px", borderRadius: "12px", border: "1px solid #DDDDDD", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
            <span style={{ fontSize: "32px" }}>📦</span>
            <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "28px", fontWeight: 700, color: "#C45500", marginTop: "8px" }}>1</div>
            <div style={{ fontSize: "13px", color: "#565959" }}>المنتجات</div>
          </div>
        </div>

        <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 2px 4px rgba(0,0,0,0.08)", border: "1px solid #DDDDDD" }}>
          <div style={{ padding: "20px 24px", borderBottom: "1px solid #DDDDDD", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "18px", fontWeight: 600, margin: 0 }}>📋 المتاجر</h3>
            <button onClick={openCreate} style={{ background: "#131921", color: "#fff", border: "none", padding: "8px 20px", borderRadius: "8px", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}>+ إضافة متجر</button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", textAlign: "right", borderCollapse: "collapse", fontSize: "14px" }}>
              <thead>
                <tr style={{ background: "#EBEEEE", color: "#565959", fontWeight: 600 }}>
                  <th style={{ padding: "16px", borderBottom: "1px solid #DDDDDD" }}>الاسم</th>
                  <th style={{ padding: "16px", borderBottom: "1px solid #DDDDDD" }}>المرجع</th>
                  <th style={{ padding: "16px", borderBottom: "1px solid #DDDDDD" }}>الحالة</th>
                  <th style={{ padding: "16px", borderBottom: "1px solid #DDDDDD" }}>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {stores.map((store) => (
                  <tr key={store.id} style={{ borderBottom: "1px solid #DDDDDD" }}>
                    <td style={{ padding: "16px", fontWeight: 700 }}>{store.name}</td>
                    <td style={{ padding: "16px", color: "#565959" }}>{store.ref}</td>
                    <td style={{ padding: "16px" }}>
                      <button onClick={() => toggleActive(store)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }} title={store.active ? "إيقاف المتجر" : "تفعيل المتجر"}>
                        <span style={{ background: store.active ? "#067D62" : "#565959", color: "#fff", padding: "4px 12px", borderRadius: "9999px", fontSize: "12px", fontWeight: 600 }}>{store.active ? "نشط" : "موقف"}</span>
                      </button>
                    </td>
                    <td style={{ padding: "16px" }}>
                      <button onClick={() => openEdit(store)} style={{ background: "none", border: "none", color: "#007185", cursor: "pointer", fontWeight: 600, fontSize: "13px" }}>تعديل</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {modal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => !saving && setModal(null)}>
            <div style={{ background: "#fff", borderRadius: "12px", padding: "24px", width: "100%", maxWidth: "400px" }} onClick={(e) => e.stopPropagation()}>
              <h3 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 16px" }}>{modal.id ? "تعديل المتجر" : "إضافة متجر جديد"}</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "13px", fontWeight: 600 }}>اسم المتجر</label>
                  <input type="text" className="amazon-input" value={form.name} onChange={(e) => setForm({ ...form, name: (e.target as HTMLInputElement).value })} placeholder="اسم المتجر" />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "13px", fontWeight: 600 }}>المرجع (ref)</label>
                  <input type="text" className="amazon-input" value={form.ref} onChange={(e) => setForm({ ...form, ref: (e.target as HTMLInputElement).value })} placeholder="my-store" disabled={!!modal.id} />
                </div>
                <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
                  <button onClick={() => setModal(null)} disabled={saving} style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "1px solid #DDDDDD", background: "#fff", fontWeight: 600, cursor: "pointer" }}>إلغاء</button>
                  <button onClick={saveStore} disabled={saving} style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "none", background: saving ? "#ccc" : "#FF9900", color: "#131921", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer" }}>
                    {saving ? "جارٍ الحفظ..." : "حفظ"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
