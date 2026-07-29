import { useState, useEffect } from "preact/compat";
import { api } from "../services/api";
import Sidebar from "../components/Sidebar";

interface Seller {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  commission: number;
  active: boolean;
  permissions: Record<string, string[]>;
  createdAt: string;
  totalOrders?: number;
  totalRevenue?: number;
  confirmedRevenue?: number;
}

const SELLER_RESOURCES = ["orders", "products", "store-links", "dashboard"];
const SELLER_ACTIONS = ["view", "create", "edit"];

export default function MerchantSellers() {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "", commission: 0, active: true });
  const [sellerPerms, setSellerPerms] = useState<Record<string, string[]>>({});
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const fetchSellers = () => {
    api.get<Seller[]>("/merchant/sellers").then(setSellers).catch(() => {});
  };

  useEffect(() => { fetchSellers(); }, []);

  const openNew = () => {
    setEditId(null);
    setForm({ name: "", phone: "", email: "", commission: 0, active: true });
    const perms: Record<string, string[]> = {};
    SELLER_RESOURCES.forEach((r) => { perms[r] = ["view"]; });
    setSellerPerms(perms);
    setShowForm(true);
  };

  const openEdit = (s: Seller) => {
    setEditId(s.id);
    setForm({ name: s.name, phone: s.phone || "", email: s.email || "", commission: s.commission, active: s.active });
    const perms: Record<string, string[]> = {};
    SELLER_RESOURCES.forEach((r) => { perms[r] = s.permissions?.[r] || ["view"]; });
    setSellerPerms(perms);
    setShowForm(true);
  };

  const toggleSellerPerm = (resource: string, action: string) => {
    setSellerPerms((prev) => {
      const current = prev[resource] || [];
      return {
        ...prev,
        [resource]: current.includes(action)
          ? current.filter((a) => a !== action)
          : [...current, action],
      };
    });
  };

  const save = async () => {
    const body: any = { name: form.name, commission: form.commission, active: form.active };
    if (form.phone) body.phone = form.phone;
    if (form.email) body.email = form.email;
    if (editId) {
      await api.patch(`/merchant/sellers/${editId}`, body);
      await api.patch(`/merchant/sellers/${editId}/permissions`, { permissions: sellerPerms });
    } else {
      await api.post("/merchant/sellers", body);
    }
    setShowForm(false);
    fetchSellers();
    showToast(editId ? "تم تحديث البائع" : "تم إضافة البائع");
  };

  const remove = async (id: string) => {
    if (!window.confirm("هل أنت متأكد من حذف هذا البائع؟")) return;
    await api.delete(`/merchant/sellers/${id}`);
    fetchSellers();
  };

  return (
    <div style={{ background: "#EAEDED", minHeight: "100vh", display: "flex" }}>
      <Sidebar />
      <div className="admin-content" style={{ flex: 1, padding: "24px", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        {toast && (
          <div style={{ position: "fixed", top: "80px", left: "50%", transform: "translateX(-50%)", zIndex: 1000, background: "#067D62", color: "#fff", padding: "12px 24px", borderRadius: "8px", fontWeight: 600, fontSize: "14px" }}>
            {toast}
          </div>
        )}
        <header style={{ marginBottom: "24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "24px", fontWeight: 600, color: "#0F1111", margin: 0 }}>إدارة البائعين</h2>
            <p style={{ fontSize: "14px", color: "#565959", margin: "4px 0 0" }}>{sellers.length} بائع</p>
          </div>
          <button onClick={openNew} style={{ background: "#FF9900", border: "none", borderRadius: "8px", padding: "10px 20px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", fontSize: "14px" }}>
            <span class="material-symbols-outlined" style={{ fontSize: "20px" }}>add</span>
            إضافة بائع
          </button>
        </header>

        {showForm && (
          <section style={{ background: "#fff", padding: "24px", borderRadius: "8px", border: "1px solid #DDDDDD", marginBottom: "24px" }}>
            <h3 style={{ margin: "0 0 16px", fontWeight: 700 }}>{editId ? "تعديل بائع" : "إضافة بائع جديد"}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxWidth: "400px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "13px", fontWeight: 600 }}>الاسم</label>
                <input type="text" className="amazon-input" value={form.name} onChange={(e) => setForm({ ...form, name: (e.target as HTMLInputElement).value })} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "13px", fontWeight: 600 }}>رقم الهاتف</label>
                <input type="tel" className="amazon-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: (e.target as HTMLInputElement).value })} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "13px", fontWeight: 600 }}>البريد الإلكتروني</label>
                <input type="email" className="amazon-input" value={form.email} onChange={(e) => setForm({ ...form, email: (e.target as HTMLInputElement).value })} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "13px", fontWeight: 600 }}>نسبة العمولة (%)</label>
                <input type="number" min="0" max="100" className="amazon-input" value={form.commission} onChange={(e) => setForm({ ...form, commission: parseInt((e.target as HTMLInputElement).value) || 0 })} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input type="checkbox" id="seller-active" checked={form.active} onChange={(e) => setForm({ ...form, active: (e.target as HTMLInputElement).checked })} />
                <label for="seller-active" style={{ fontSize: "13px" }}>نشط</label>
              </div>
              <div>
                <label style={{ fontSize: "13px", fontWeight: 600, display: "block", marginBottom: "4px" }}>الصلاحيات</label>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {SELLER_RESOURCES.map((r) => (
                    <div key={r} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
                      <span style={{ minWidth: "80px", fontWeight: 600 }}>{r === "orders" ? "الطلبات" : r === "products" ? "المنتجات" : r === "store-links" ? "الروابط" : "لوحة التحكم"}</span>
                      {SELLER_ACTIONS.map((a) => (
                        <label key={a} style={{ display: "flex", alignItems: "center", gap: "4px", cursor: "pointer", fontSize: "12px" }}>
                          <input type="checkbox" checked={(sellerPerms[r] || []).includes(a)}
                            onChange={() => toggleSellerPerm(r, a)} style={{ accentColor: "#FF9900" }} />
                          {a === "view" ? "عرض" : a === "create" ? "إنشاء" : "تعديل"}
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
                <button onClick={save} disabled={!form.name}
                  style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "none", background: form.name ? "#FF9900" : "#ccc", color: "#131921", fontWeight: 700, cursor: form.name ? "pointer" : "not-allowed" }}>
                  {editId ? "تحديث" : "إضافة"}
                </button>
                <button onClick={() => setShowForm(false)} style={{ padding: "10px 20px", borderRadius: "8px", border: "1px solid #DDDDDD", background: "#fff", fontWeight: 600, cursor: "pointer" }}>إلغاء</button>
              </div>
            </div>
          </section>
        )}

        <section style={{ background: "#fff", borderRadius: "8px", border: "1px solid #DDDDDD", overflow: "hidden", flex: 1 }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
              <thead>
                <tr style={{ background: "#f4f4f5", color: "#555", fontWeight: 600 }}>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>الاسم</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>رقم الهاتف</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>العمولة</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>الطلبات</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>الإيرادات</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>الحالة</th>
                  <th style={{ padding: "12px 16px", textAlign: "center" }}>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {sellers.map((s) => (
                  <tr key={s.id} style={{ borderBottom: "1px solid #EAEDED" }}>
                    <td style={{ padding: "16px", fontWeight: 700 }}>{s.name}</td>
                    <td style={{ padding: "16px", direction: "ltr", textAlign: "right" }}>{s.phone || "-"}</td>
                    <td style={{ padding: "16px" }}>{s.commission}%</td>
                    <td style={{ padding: "16px", fontWeight: 700 }}>{s.totalOrders || 0}</td>
                    <td style={{ padding: "16px", fontWeight: 700 }}>{(s.totalRevenue || 0).toLocaleString()} ج.م</td>
                    <td style={{ padding: "16px" }}>
                      <span style={{
                        padding: "4px 10px", borderRadius: "4px", fontSize: "12px", fontWeight: 700,
                        background: s.active ? "#ECFDF5" : "#FEF2F2", color: s.active ? "#067D62" : "#B12704",
                      }}>{s.active ? "نشط" : "غير نشط"}</span>
                    </td>
                    <td style={{ padding: "16px", textAlign: "center" }}>
                      <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                        <button onClick={() => openEdit(s)} style={{ background: "none", border: "1px solid #DDDDDD", borderRadius: "6px", padding: "6px 10px", cursor: "pointer" }}>
                          <span class="material-symbols-outlined" style={{ fontSize: "16px", verticalAlign: "middle" }}>edit</span>
                        </button>
                        <button onClick={() => remove(s.id)} style={{ background: "none", border: "1px solid #B12704", borderRadius: "6px", padding: "6px 10px", cursor: "pointer", color: "#B12704" }}>
                          <span class="material-symbols-outlined" style={{ fontSize: "16px", verticalAlign: "middle" }}>delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {sellers.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: "48px", textAlign: "center", color: "#565959" }}>لا يوجد بائعون</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <footer style={{ marginTop: "auto", padding: "16px 0 0", textAlign: "center" }}>
          <p style={{ fontSize: "14px", color: "#565959", opacity: 0.8, margin: 0 }}>© 2025 M&K Store. جميع الحقوق محفوظة.</p>
        </footer>
      </div>
    </div>
  );
}
