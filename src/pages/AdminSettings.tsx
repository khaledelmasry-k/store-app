import { useState, useEffect } from "preact/compat";
import { api } from "../services/api";
import type { Store } from "../types";
import Sidebar from "../components/Sidebar";

export default function AdminSettings() {
  const [tab, setTab] = useState<"stores" | "admins">("stores");
  const [stores, setStores] = useState<Store[]>([]);
  const [admins, setAdmins] = useState<{ id: string; username: string; email: string; role: string; createdAt: string }[]>([]);
  const [showStoreForm, setShowStoreForm] = useState(false);
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [storeForm, setStoreForm] = useState({ ref: "", name: "" });
  const [adminForm, setAdminForm] = useState({ username: "", email: "", password: "", role: "admin" });
  const [toastMsg, setToastMsg] = useState("");
  const [toastShow, setToastShow] = useState(false);
  const [loading, setLoading] = useState(true);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setToastShow(true);
    setTimeout(() => setToastShow(false), 3000);
  };

  const loadStores = () => api.get<Store[]>("/admin/settings/stores").then(setStores);
  const loadAdmins = () =>
    api.get<{ id: string; username: string; email: string; role: string; createdAt: string }[]>("/admin/settings/admins").then(setAdmins);

  useEffect(() => {
    Promise.all([loadStores(), loadAdmins()]).finally(() => setLoading(false));
  }, []);

  const copyLink = (ref: string) => {
    const url = `${window.location.origin}/store?ref=${ref}`;
    navigator.clipboard.writeText(url).then(() => showToast("تم نسخ الرابط"));
  };

  const addStore = async () => {
    try {
      await api.post("/admin/settings/stores", storeForm);
      setStoreForm({ ref: "", name: "" });
      setShowStoreForm(false);
      await loadStores();
      showToast("تم إضافة المتجر");
    } catch (e: any) {
      showToast(e.message || "حدث خطأ");
    }
  };

  const toggleStore = async (s: Store) => {
    await api.patch(`/admin/settings/stores/${s.id}`, { active: !s.active });
    await loadStores();
  };

  const deleteStore = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا المتجر؟")) return;
    await api.delete(`/admin/settings/stores/${id}`);
    await loadStores();
    showToast("تم حذف المتجر");
  };

  const addAdmin = async () => {
    try {
      await api.post("/admin/settings/admins", adminForm);
      setAdminForm({ username: "", email: "", password: "", role: "admin" });
      setShowAdminForm(false);
      await loadAdmins();
      showToast("تم إضافة المشرف");
    } catch (e: any) {
      showToast(e.message || "حدث خطأ");
    }
  };

  const deleteAdmin = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا المشرف؟")) return;
    await api.delete(`/admin/settings/admins/${id}`);
    await loadAdmins();
    showToast("تم حذف المشرف");
  };

  if (loading) return (
    <div style={{ background: "#EAEDED", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#565959" }}>جاري التحميل...</p>
    </div>
  );

  return (
    <div style={{ background: "#EAEDED", minHeight: "100vh", display: "flex" }}>
      <Sidebar />
      <div className="admin-content" style={{ flex: 1, padding: "24px", overflow: "auto" }}>
        <div className="amazon-toast amazon-toast-success" style={{ transform: toastShow ? "translateX(-50%) translateY(0)" : "translateX(-50%) translateY(-100px)" }}>
          <span class="material-symbols-outlined" style={{ fontSize: "18px" }}>check_circle</span>
          <span>{toastMsg}</span>
        </div>

        <header style={{ marginBottom: "24px" }}>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "24px", fontWeight: 700, color: "#0F1111", margin: "0 0 16px" }}>الإعدادات</h2>
          <div style={{ display: "flex", gap: "0" }}>
            <button onClick={() => setTab("stores")} style={{ padding: "10px 24px", background: tab === "stores" ? "#131921" : "#fff", color: tab === "stores" ? "#fff" : "#0F1111", border: "1px solid #DDDDDD", borderRadius: "8px 0 0 8px", cursor: "pointer", fontWeight: 600, fontSize: "14px" }}>
              المتاجر
            </button>
            <button onClick={() => setTab("admins")} style={{ padding: "10px 24px", background: tab === "admins" ? "#131921" : "#fff", color: tab === "admins" ? "#fff" : "#0F1111", border: "1px solid #DDDDDD", borderRadius: "0 8px 8px 0", borderRight: "none", cursor: "pointer", fontWeight: 600, fontSize: "14px" }}>
              المشرفين
            </button>
          </div>
        </header>

        {tab === "stores" && (
          <section style={{ background: "#fff", border: "1px solid #DDDDDD", borderRadius: "8px", padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "18px", fontWeight: 600, margin: 0 }}>المتاجر</h3>
              <button onClick={() => setShowStoreForm(true)} style={{ background: "#FF9900", color: "#0F1111", border: "none", borderRadius: "8px", padding: "8px 16px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>
                <span class="material-symbols-outlined" style={{ fontSize: "16px" }}>add</span> إضافة متجر
              </button>
            </div>

            {showStoreForm && (
              <div className="amazon-modal-overlay" onClick={() => setShowStoreForm(false)}>
                <div style={{ background: "#fff", padding: "24px", borderRadius: "12px", width: "400px", boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }} onClick={(e) => e.stopPropagation()}>
                  <h3 style={{ margin: "0 0 16px", fontSize: "18px" }}>إضافة متجر جديد</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <input className="amazon-input" placeholder="رقم المرجع (ref)" value={storeForm.ref} onChange={(e) => setStoreForm({ ...storeForm, ref: (e.target as HTMLInputElement).value })} />
                    <input className="amazon-input" placeholder="اسم المتجر" value={storeForm.name} onChange={(e) => setStoreForm({ ...storeForm, name: (e.target as HTMLInputElement).value })} />
                    <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "8px" }}>
                      <button onClick={() => setShowStoreForm(false)} style={{ background: "#fff", border: "1px solid #888C8C", borderRadius: "8px", padding: "8px 16px", cursor: "pointer" }}>إلغاء</button>
                      <button onClick={addStore} disabled={!storeForm.ref || !storeForm.name} style={{ background: "#FF9900", color: "#0F1111", border: "none", borderRadius: "8px", padding: "8px 16px", fontWeight: 600, cursor: "pointer", opacity: !storeForm.ref || !storeForm.name ? 0.6 : 1 }}>إضافة</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div style={{ overflowX: "auto" }}>
              <table className="order-table" style={{ width: "100%", fontSize: "14px" }}>
                <thead>
                  <tr>
                    <th>المرجع</th>
                    <th>اسم المتجر</th>
                    <th>الحالة</th>
                    <th>الرابط</th>
                    <th>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {stores.length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: "center", color: "#565959", padding: "32px" }}>لا توجد متاجر مضافة</td></tr>
                  )}
                  {stores.map((s) => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600 }}>{s.ref}</td>
                      <td>{s.name}</td>
                      <td>
                        <span onClick={() => toggleStore(s)} style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: s.active ? "#067D62" : "#888C8C", display: "inline-block" }} />
                          {s.active ? "نشط" : "غير نشط"}
                        </span>
                      </td>
                      <td>
                        <button onClick={() => copyLink(s.ref)} style={{ background: "none", border: "1px solid #888C8C", borderRadius: "6px", padding: "4px 8px", cursor: "pointer", fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" }}>
                          <span class="material-symbols-outlined" style={{ fontSize: "14px" }}>link</span> نسخ الرابط
                        </button>
                      </td>
                      <td>
                        <button onClick={() => deleteStore(s.id)} style={{ background: "none", border: "none", color: "#B12704", cursor: "pointer", fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" }}>
                          <span class="material-symbols-outlined" style={{ fontSize: "14px" }}>delete</span> حذف
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === "admins" && (
          <section style={{ background: "#fff", border: "1px solid #DDDDDD", borderRadius: "8px", padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "18px", fontWeight: 600, margin: 0 }}>المشرفين</h3>
              <button onClick={() => setShowAdminForm(true)} style={{ background: "#FF9900", color: "#0F1111", border: "none", borderRadius: "8px", padding: "8px 16px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>
                <span class="material-symbols-outlined" style={{ fontSize: "16px" }}>add</span> إضافة مشرف
              </button>
            </div>

            {showAdminForm && (
              <div className="amazon-modal-overlay" onClick={() => setShowAdminForm(false)}>
                <div style={{ background: "#fff", padding: "24px", borderRadius: "12px", width: "400px", boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }} onClick={(e) => e.stopPropagation()}>
                  <h3 style={{ margin: "0 0 16px", fontSize: "18px" }}>إضافة مشرف جديد</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <input className="amazon-input" placeholder="اسم المستخدم" value={adminForm.username} onChange={(e) => setAdminForm({ ...adminForm, username: (e.target as HTMLInputElement).value })} />
                    <input className="amazon-input" type="email" placeholder="البريد الإلكتروني" value={adminForm.email} onChange={(e) => setAdminForm({ ...adminForm, email: (e.target as HTMLInputElement).value })} />
                    <input className="amazon-input" type="password" placeholder="كلمة المرور" value={adminForm.password} onChange={(e) => setAdminForm({ ...adminForm, password: (e.target as HTMLInputElement).value })} />
                    <select className="amazon-input" value={adminForm.role} onChange={(e) => setAdminForm({ ...adminForm, role: (e.target as HTMLSelectElement).value })} style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #DDDDDD", fontSize: "14px" }}>
                      <option value="admin">مشرف عادي</option>
                      <option value="super_admin">مشرف عام</option>
                    </select>
                    <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "8px" }}>
                      <button onClick={() => setShowAdminForm(false)} style={{ background: "#fff", border: "1px solid #888C8C", borderRadius: "8px", padding: "8px 16px", cursor: "pointer" }}>إلغاء</button>
                      <button onClick={addAdmin} disabled={!adminForm.username || !adminForm.email || !adminForm.password} style={{ background: "#FF9900", color: "#0F1111", border: "none", borderRadius: "8px", padding: "8px 16px", fontWeight: 600, cursor: "pointer", opacity: !adminForm.username || !adminForm.email || !adminForm.password ? 0.6 : 1 }}>إضافة</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div style={{ overflowX: "auto" }}>
              <table className="order-table" style={{ width: "100%", fontSize: "14px" }}>
                <thead>
                  <tr>
                    <th>اسم المستخدم</th>
                    <th>البريد الإلكتروني</th>
                    <th>الصلاحية</th>
                    <th>تاريخ الإنشاء</th>
                    <th>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                    {admins.length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: "center", color: "#565959", padding: "32px" }}>لا يوجد مشرفين</td></tr>
                    )}
                    {admins.map((a) => (
                    <tr key={a.id}>
                      <td style={{ fontWeight: 600 }}>{a.username}</td>
                      <td>{a.email}</td>
                      <td>{a.role === "super_admin" ? "مشرف عام" : "مشرف"}</td>
                      <td style={{ color: "#565959" }}>{new Date(a.createdAt).toLocaleDateString("ar-EG")}</td>
                      <td>
                        <button onClick={() => deleteAdmin(a.id)} style={{ background: "none", border: "none", color: "#B12704", cursor: "pointer", fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" }}>
                          <span class="material-symbols-outlined" style={{ fontSize: "14px" }}>delete</span> حذف
                        </button>
                      </td>
                    </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <footer style={{ width: "100%", padding: "32px 0", marginTop: "48px", borderTop: "1px solid #DDDDDD", background: "#E0E3E3", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px" }}>
          <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "20px", fontWeight: 700, color: "#0F1111" }}>M&K Store</div>
          <div style={{ display: "flex", gap: "24px", fontSize: "12px" }}>
            <a href="#" style={{ color: "#565959", textDecoration: "none" }}>سياسة الخصوصية</a>
            <a href="#" style={{ color: "#565959", textDecoration: "none" }}>شروط الخدمة</a>
            <a href="#" style={{ color: "#565959", textDecoration: "none" }}>اتصل بنا</a>
          </div>
          <p style={{ fontSize: "14px", color: "#565959", opacity: 0.8, margin: 0 }}>© 2025 M&K Store. جميع الحقوق محفوظة.</p>
        </footer>
      </div>
    </div>
  );
}
