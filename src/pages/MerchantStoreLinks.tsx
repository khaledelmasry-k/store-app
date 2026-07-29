import { useState, useEffect } from "preact/compat";
import { api } from "../services/api";
import Sidebar from "../components/Sidebar";

interface Seller { id: string; name: string; }

interface StoreLink {
  id: string;
  slug: string;
  customTitle: string | null;
  customLogo: string;
  customColor: string;
  productIds: string;
  sellerId: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  clicks: number;
  createdAt: string;
  seller?: Seller | null;
}

interface Product { id: string; name: string; }

const defaultForm = {
  slug: "", customTitle: "", productIds: "", customLogo: "", customColor: "#000000",
  sellerId: "", utmSource: "", utmMedium: "", utmCampaign: "",
};

export default function MerchantStoreLinks() {
  const [links, setLinks] = useState<StoreLink[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [copied, setCopied] = useState<string | null>(null);

  const fetchAll = () => {
    api.get<StoreLink[]>("/seller/store-links").then(setLinks).catch(() => {});
    api.get<Seller[]>("/merchant/sellers").then(setSellers).catch(() => {});
    api.get<Product[]>("/merchant/products").then(setProducts).catch(() => {});
  };

  useEffect(() => { fetchAll(); }, []);

  const openNew = () => { setEditId(null); setForm(defaultForm); setShowForm(true); };

  const openEdit = (l: StoreLink) => {
    setEditId(l.id);
    setForm({
      slug: l.slug, customTitle: l.customTitle || "", productIds: l.productIds,
      customLogo: l.customLogo || "", customColor: l.customColor || "#000000",
      sellerId: l.sellerId || "", utmSource: l.utmSource || "",
      utmMedium: l.utmMedium || "", utmCampaign: l.utmCampaign || "",
    });
    setShowForm(true);
  };

  const save = async () => {
    const body: Record<string, any> = {
      slug: form.slug, productIds: form.productIds,
      customTitle: form.customTitle || undefined,
      customLogo: form.customLogo || undefined,
      customColor: form.customColor || "#000000",
      sellerId: form.sellerId || null,
      utmSource: form.utmSource || null,
      utmMedium: form.utmMedium || null,
      utmCampaign: form.utmCampaign || null,
    };
    if (editId) {
      await api.patch(`/seller/store-links/${editId}`, body);
    } else {
      await api.post("/seller/store-links", body);
    }
    setShowForm(false);
    fetchAll();
  };

  const remove = async (id: string) => {
    if (!window.confirm("هل أنت متأكد من حذف هذا الرابط؟")) return;
    await api.delete(`/seller/store-links/${id}`);
    fetchAll();
  };

  const getUrl = (slug: string) => `${window.location.origin}/store/${slug}`;

  const copyLink = (slug: string) => {
    const url = getUrl(slug);
    navigator.clipboard.writeText(url).then(() => { setCopied(slug); setTimeout(() => setCopied(null), 2000); }).catch(() => {});
  };

  const shareWA = (slug: string, title: string) => {
    const msg = encodeURIComponent(`تسوق من ${title} عبر الرابط التالي:\n${getUrl(slug)}`);
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };

  const trackClick = async (id: string) => {
    try { await api.patch(`/seller/store-links/${id}/click`, {}); } catch {}
  };

  return (
    <div style={{ background: "#EAEDED", minHeight: "100vh", display: "flex" }}>
      <Sidebar />
      <div className="admin-content" style={{ flex: 1, padding: "24px", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <header style={{ marginBottom: "24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "24px", fontWeight: 600, color: "#0F1111", margin: 0 }}>روابط التسويق</h2>
            <p style={{ fontSize: "14px", color: "#565959", margin: "4px 0 0" }}>إنشاء وإدارة روابط تسويقية مع تتبع UTM</p>
          </div>
          <button onClick={openNew} style={{ background: "#FF9900", border: "none", borderRadius: "8px", padding: "10px 20px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", fontSize: "14px" }}>
            <span class="material-symbols-outlined" style={{ fontSize: "20px" }}>add</span>
            رابط جديد
          </button>
        </header>

        {showForm && (
          <section style={{ background: "#fff", padding: "24px", borderRadius: "8px", border: "1px solid #DDDDDD", marginBottom: "24px" }}>
            <h3 style={{ margin: "0 0 16px", fontWeight: 700 }}>{editId ? "تعديل الرابط" : "رابط تسويقي جديد"}</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "12px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "13px", fontWeight: 600 }}>الاسم المختصر (Slug) *</label>
                <input type="text" className="amazon-input" value={form.slug} onChange={(e) => setForm({ ...form, slug: (e.target as HTMLInputElement).value })} dir="ltr" />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "13px", fontWeight: 600 }}>العنوان المخصص</label>
                <input type="text" className="amazon-input" value={form.customTitle} onChange={(e) => setForm({ ...form, customTitle: (e.target as HTMLInputElement).value })} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "13px", fontWeight: 600 }}>المنتجات (معرفات مفصولة بفواصل) *</label>
                <input type="text" className="amazon-input" value={form.productIds} onChange={(e) => setForm({ ...form, productIds: (e.target as HTMLInputElement).value })} dir="ltr" />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "13px", fontWeight: 600 }}>البائع</label>
                <select className="amazon-input" value={form.sellerId} onChange={(e) => setForm({ ...form, sellerId: (e.target as HTMLSelectElement).value })}>
                  <option value="">بدون بائع</option>
                  {sellers.filter((s) => s).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "13px", fontWeight: 600 }}>UTM المصدر (Source)</label>
                <input type="text" className="amazon-input" value={form.utmSource} onChange={(e) => setForm({ ...form, utmSource: (e.target as HTMLInputElement).value })} placeholder="facebook, instagram, google..." />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "13px", fontWeight: 600 }}>UTM الوسيط (Medium)</label>
                <input type="text" className="amazon-input" value={form.utmMedium} onChange={(e) => setForm({ ...form, utmMedium: (e.target as HTMLInputElement).value })} placeholder="social, email, cpc..." />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "13px", fontWeight: 600 }}>UTM الحملة (Campaign)</label>
                <input type="text" className="amazon-input" value={form.utmCampaign} onChange={(e) => setForm({ ...form, utmCampaign: (e.target as HTMLInputElement).value })} placeholder="رمضان_2025, صيف_2025..." />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "13px", fontWeight: 600 }}>اللون المخصص</label>
                <input type="color" className="amazon-input" value={form.customColor} onChange={(e) => setForm({ ...form, customColor: (e.target as HTMLInputElement).value })} style={{ padding: "4px", height: "40px" }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
              <button onClick={save} disabled={!form.slug || !form.productIds}
                style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "none", background: form.slug && form.productIds ? "#FF9900" : "#ccc", color: "#131921", fontWeight: 700, cursor: form.slug && form.productIds ? "pointer" : "not-allowed" }}>
                {editId ? "تحديث" : "إضافة"}
              </button>
              <button onClick={() => setShowForm(false)} style={{ padding: "10px 20px", borderRadius: "8px", border: "1px solid #DDDDDD", background: "#fff", fontWeight: 600, cursor: "pointer" }}>إلغاء</button>
            </div>
          </section>
        )}

        <section style={{ background: "#fff", borderRadius: "8px", border: "1px solid #DDDDDD", overflow: "hidden", flex: 1 }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
              <thead>
                <tr style={{ background: "#f4f4f5", color: "#555", fontWeight: 600 }}>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>الرابط</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>العنوان</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>البائع</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>UTM</th>
                  <th style={{ padding: "12px 16px", textAlign: "center" }}>النقرات</th>
                  <th style={{ padding: "12px 16px", textAlign: "center" }}>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {links.map((l) => (
                  <tr key={l.id} style={{ borderBottom: "1px solid #EAEDED" }}>
                    <td style={{ padding: "16px", direction: "ltr", textAlign: "right" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <a href={getUrl(l.slug)} target="_blank" rel="noopener" style={{ color: "#007185", textDecoration: "none", fontSize: "13px" }}>/{l.slug}</a>
                        <button onClick={() => copyLink(l.slug)} style={{ background: "none", border: "none", cursor: "pointer", color: copied === l.slug ? "#067D62" : "#565959", fontSize: "18px", display: "flex", alignItems: "center" }} title="نسخ الرابط">
                          <span class="material-symbols-outlined" style={{ fontSize: "16px" }}>{copied === l.slug ? "check" : "content_copy"}</span>
                        </button>
                      </div>
                    </td>
                    <td style={{ padding: "16px", fontWeight: 700 }}>{l.customTitle || "-"}</td>
                    <td style={{ padding: "16px" }}>{l.seller?.name || "-"}</td>
                    <td style={{ padding: "16px", fontSize: "12px" }}>
                      {l.utmSource || l.utmMedium || l.utmCampaign ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px", color: "#565959" }}>
                          {l.utmSource && <span>المصدر: {l.utmSource}</span>}
                          {l.utmMedium && <span>الوسيط: {l.utmMedium}</span>}
                          {l.utmCampaign && <span>الحملة: {l.utmCampaign}</span>}
                        </div>
                      ) : "-"}
                    </td>
                    <td style={{ padding: "16px", textAlign: "center", fontWeight: 700 }}>{l.clicks}</td>
                    <td style={{ padding: "16px", textAlign: "center" }}>
                      <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                        <button onClick={() => { window.open(getUrl(l.slug), "_blank"); trackClick(l.id); }} style={{ background: "none", border: "1px solid #DDDDDD", borderRadius: "6px", padding: "6px 10px", cursor: "pointer" }} title="فتح الرابط">
                          <span class="material-symbols-outlined" style={{ fontSize: "16px", verticalAlign: "middle" }}>open_in_new</span>
                        </button>
                        <button onClick={() => shareWA(l.slug, l.customTitle || l.slug)} style={{ background: "none", border: "1px solid #25D366", borderRadius: "6px", padding: "6px 10px", cursor: "pointer", color: "#25D366" }} title="مشاركة عبر واتساب">
                          <span class="material-symbols-outlined" style={{ fontSize: "16px", verticalAlign: "middle" }}>chat</span>
                        </button>
                        <button onClick={() => openEdit(l)} style={{ background: "none", border: "1px solid #DDDDDD", borderRadius: "6px", padding: "6px 10px", cursor: "pointer" }}>
                          <span class="material-symbols-outlined" style={{ fontSize: "16px", verticalAlign: "middle" }}>edit</span>
                        </button>
                        <button onClick={() => remove(l.id)} style={{ background: "none", border: "1px solid #B12704", borderRadius: "6px", padding: "6px 10px", cursor: "pointer", color: "#B12704" }}>
                          <span class="material-symbols-outlined" style={{ fontSize: "16px", verticalAlign: "middle" }}>delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {links.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: "48px", textAlign: "center", color: "#565959" }}>لا توجد روابط تسويقية</td></tr>
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
