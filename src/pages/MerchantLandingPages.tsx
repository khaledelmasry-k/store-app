import { useState, useEffect } from "preact/compat";
import { useLocation } from "wouter";
import { api } from "../services/api";
import Sidebar from "../components/Sidebar";

interface LandingPage {
  id: string; name: string; slug: string; published: boolean; createdAt: string; updatedAt: string;
}

export default function MerchantLandingPages() {
  const [, navigate] = useLocation();
  const [pages, setPages] = useState<LandingPage[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "" });

  const fetchPages = () => {
    api.get<LandingPage[]>("/merchant/landing-pages").then(setPages).catch(() => {});
  };

  useEffect(() => { fetchPages(); }, []);

  const create = async () => {
    await api.post("/merchant/landing-pages", form);
    setShowCreate(false);
    setForm({ name: "", slug: "" });
    fetchPages();
  };

  const togglePublish = async (id: string) => {
    await api.post(`/merchant/landing-pages/${id}/publish`, {});
    fetchPages();
  };

  const remove = async (id: string) => {
    if (!window.confirm("هل أنت متأكد من حذف هذه الصفحة؟")) return;
    await api.delete(`/merchant/landing-pages/${id}`);
    fetchPages();
  };

  return (
    <div style={{ background: "#EAEDED", minHeight: "100vh", display: "flex" }}>
      <Sidebar />
      <div className="admin-content" style={{ flex: 1, padding: "24px", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <header style={{ marginBottom: "24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "24px", fontWeight: 600, color: "#0F1111", margin: 0 }}>صفحات الهبوط</h2>
            <p style={{ fontSize: "14px", color: "#565959", margin: "4px 0 0" }}>إنشاء وتحرير صفحات الهبوط التسويقية</p>
          </div>
          <button onClick={() => setShowCreate(true)} style={{ background: "#FF9900", border: "none", borderRadius: "8px", padding: "10px 20px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", fontSize: "14px" }}>
            <span class="material-symbols-outlined" style={{ fontSize: "20px" }}>add</span>
            صفحة جديدة
          </button>
        </header>

        {showCreate && (
          <section style={{ background: "#fff", padding: "24px", borderRadius: "8px", border: "1px solid #DDDDDD", marginBottom: "24px", maxWidth: "400px" }}>
            <h3 style={{ margin: "0 0 16px", fontWeight: 700 }}>صفحة هبوط جديدة</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <input type="text" className="amazon-input" placeholder="اسم الصفحة" value={form.name}
                onChange={(e) => setForm({ ...form, name: (e.target as HTMLInputElement).value })} />
              <input type="text" className="amazon-input" placeholder="الرابط المختصر (slug)" value={form.slug} dir="ltr"
                onChange={(e) => setForm({ ...form, slug: (e.target as HTMLInputElement).value })} />
              <div style={{ display: "flex", gap: "12px" }}>
                <button onClick={create} disabled={!form.name || !form.slug}
                  style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "none", background: form.name && form.slug ? "#FF9900" : "#ccc", color: "#131921", fontWeight: 700, cursor: form.name && form.slug ? "pointer" : "not-allowed" }}>
                  إنشاء
                </button>
                <button onClick={() => setShowCreate(false)} style={{ padding: "10px 20px", borderRadius: "8px", border: "1px solid #DDDDDD", background: "#fff", fontWeight: 600, cursor: "pointer" }}>إلغاء</button>
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
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>الرابط</th>
                  <th style={{ padding: "12px 16px", textAlign: "center" }}>الحالة</th>
                  <th style={{ padding: "12px 16px", textAlign: "center" }}>تاريخ الإنشاء</th>
                  <th style={{ padding: "12px 16px", textAlign: "center" }}>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {pages.map((p) => (
                  <tr key={p.id} style={{ borderBottom: "1px solid #EAEDED" }}>
                    <td style={{ padding: "16px", fontWeight: 700 }}>{p.name}</td>
                    <td style={{ padding: "16px", direction: "ltr", textAlign: "right", color: "#007185" }}>/{p.slug}</td>
                    <td style={{ padding: "16px", textAlign: "center" }}>
                      <span onClick={() => togglePublish(p.id)} style={{
                        padding: "4px 10px", borderRadius: "4px", fontSize: "12px", fontWeight: 700, cursor: "pointer",
                        background: p.published ? "#ECFDF5" : "#FEF2F2", color: p.published ? "#067D62" : "#B12704",
                      }}>{p.published ? "منشور" : "مسودة"}</span>
                    </td>
                    <td style={{ padding: "16px", textAlign: "center", fontSize: "13px", color: "#565959" }}>{new Date(p.createdAt).toLocaleDateString("ar-EG")}</td>
                    <td style={{ padding: "16px", textAlign: "center" }}>
                      <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                        <button onClick={() => navigate(`/merchant/landing-pages/${p.id}`)} style={{ background: "none", border: "1px solid #DDDDDD", borderRadius: "6px", padding: "6px 10px", cursor: "pointer" }} title="تحرير">
                          <span class="material-symbols-outlined" style={{ fontSize: "16px", verticalAlign: "middle" }}>edit</span>
                        </button>
                        {p.published && <a href={`/p/${p.slug}`} target="_blank" rel="noopener" style={{ background: "none", border: "1px solid #DDDDDD", borderRadius: "6px", padding: "6px 10px", cursor: "pointer", textDecoration: "none", color: "inherit", display: "inline-flex", alignItems: "center" }} title="عرض">
                          <span class="material-symbols-outlined" style={{ fontSize: "16px", verticalAlign: "middle" }}>open_in_new</span>
                        </a>}
                        <button onClick={() => remove(p.id)} style={{ background: "none", border: "1px solid #B12704", borderRadius: "6px", padding: "6px 10px", cursor: "pointer", color: "#B12704" }} title="حذف">
                          <span class="material-symbols-outlined" style={{ fontSize: "16px", verticalAlign: "middle" }}>delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {pages.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: "48px", textAlign: "center", color: "#565959" }}>لا توجد صفحات هبوط</td></tr>
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
