import { useState, useEffect } from "preact/compat";
import { api, API_BASE, getImageUrl } from "../services/api";
import Sidebar from "../components/Sidebar";

type Tab = "store" | "shipping" | "payment" | "whatsapp" | "pixel" | "seo" | "social" | "domain";

interface StoreData {
  id: string; name: string; tagLine: string | null; logo: string | null;
  primaryColor: string | null; ref: string; active: boolean;
}

interface Settings {
  shipping: { governorates: Array<{ name: string; price: number }>; freeShippingMin: number };
  payment: { cod: boolean; bankTransfer: boolean; bankAccount: string };
  whatsapp: { number: string; message: string };
  pixel: { facebookPixelId: string; googleAnalyticsId: string };
  seo: { title: string; description: string; keywords: string };
  social: { facebook: string; instagram: string; tiktok: string };
  domain: { customDomain: string; sslEnabled: boolean };
}

const defaultSettings: Settings = {
  shipping: { governorates: [], freeShippingMin: 0 },
  payment: { cod: true, bankTransfer: false, bankAccount: "" },
  whatsapp: { number: "", message: "" },
  pixel: { facebookPixelId: "", googleAnalyticsId: "" },
  seo: { title: "", description: "", keywords: "" },
  social: { facebook: "", instagram: "", tiktok: "" },
  domain: { customDomain: "", sslEnabled: false },
};

export default function MerchantSettings() {
  const [tab, setTab] = useState<Tab>("store");
  const [store, setStore] = useState<StoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  const [form, setForm] = useState({ name: "", tagLine: "", primaryColor: "#FF9900" });
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [govInput, setGovInput] = useState({ name: "", price: "" });

  useEffect(() => {
    api.get<{ store: StoreData; tenant: unknown }>("/merchant/settings").then((res) => {
      setStore(res.store);
      const s = (res.store as any).settings;
      if (s) setSettings({ ...defaultSettings, ...s });
      setForm({ name: res.store.name, tagLine: res.store.tagLine || "", primaryColor: res.store.primaryColor || "#FF9900" });
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const saveStore = async () => {
    setSaving("store");
    try {
      const updated = await api.put<StoreData>("/merchant/settings/store", {
        name: form.name, tagLine: form.tagLine || null, primaryColor: form.primaryColor || null,
      });
      setStore(updated);
      showToast("تم حفظ إعدادات المتجر");
    } catch { showToast("حدث خطأ في الحفظ"); }
    finally { setSaving(null); }
  };

  const saveSection = async (section: keyof Settings) => {
    setSaving(section);
    try {
      await api.put("/merchant/settings", { [section]: settings[section] });
      showToast("تم حفظ الإعدادات");
    } catch { showToast("حدث خطأ في الحفظ"); }
    finally { setSaving(null); }
  };

  const uploadLogo = async (file: File) => {
    const fd = new FormData();
    fd.append("image", file);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/admin/upload`, {
        method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body: fd,
      });
      if (!res.ok) throw new Error("Upload failed");
      const result = await res.json();
      await api.put("/merchant/settings/store", { logo: result.url });
      setStore((prev) => prev ? { ...prev, logo: result.url } : null);
      showToast("تم رفع الشعار");
    } catch { showToast("فشل رفع الشعار"); }
  };

  const addGovernorate = () => {
    const name = govInput.name.trim();
    const price = parseFloat(govInput.price);
    if (!name || isNaN(price)) return;
    setSettings({
      ...settings,
      shipping: {
        ...settings.shipping,
        governorates: [...settings.shipping.governorates, { name, price }],
      },
    });
    setGovInput({ name: "", price: "" });
  };

  const removeGovernorate = (index: number) => {
    setSettings({
      ...settings,
      shipping: {
        ...settings.shipping,
        governorates: settings.shipping.governorates.filter((_, i) => i !== index),
      },
    });
  };

  const updateGov = (index: number, field: "name" | "price", value: string) => {
    const list = [...settings.shipping.governorates];
    list[index] = { ...list[index], [field]: field === "price" ? parseFloat(value) || 0 : value };
    setSettings({ ...settings, shipping: { ...settings.shipping, governorates: list } });
  };

  const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
    <button onClick={() => onChange(!value)} type="button"
      style={{
        width: "44px", height: "24px", borderRadius: "12px", padding: 0,
        background: value ? "#FF9900" : "#DDDDDD",
        border: "none", cursor: "pointer", position: "relative", flexShrink: 0,
      }}>
      <span style={{
        width: "20px", height: "20px", borderRadius: "50%", background: "#fff",
        position: "absolute", top: "2px",
        left: value ? "22px" : "2px",
        transition: "left 0.2s",
        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
      }} />
    </button>
  );

  const tabs = [
    { key: "store" as Tab, label: "المتجر", icon: "store" },
    { key: "shipping" as Tab, label: "الشحن", icon: "local_shipping" },
    { key: "payment" as Tab, label: "الدفع", icon: "payments" },
    { key: "whatsapp" as Tab, label: "واتساب", icon: "chat" },
    { key: "pixel" as Tab, label: "بيكسل", icon: "ads_click" },
    { key: "seo" as Tab, label: "تحسين محركات البحث", icon: "travel_explore" },
    { key: "social" as Tab, label: "السوشيال ميديا", icon: "share" },
    { key: "domain" as Tab, label: "النطاق", icon: "language" },
  ];

  if (loading) return (
    <div style={{ background: "#EAEDED", minHeight: "100vh", display: "flex" }}>
      <Sidebar />
      <div style={{ flex: 1, padding: "24px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#565959" }}>جاري التحميل...</p>
      </div>
    </div>
  );

  return (
    <div style={{ background: "#EAEDED", minHeight: "100vh", display: "flex" }}>
      <Sidebar />
      <div className="admin-content" style={{ flex: 1, padding: "24px", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <header style={{ marginBottom: "24px" }}>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "24px", fontWeight: 600, color: "#0F1111", margin: 0 }}>الإعدادات</h2>
          <p style={{ fontSize: "14px", color: "#595f68", margin: "4px 0 0" }}>إعدادات المتجر والشحن والدفع والتكامل</p>
        </header>

        {toast && (
          <div style={{ position: "fixed", top: "80px", left: "50%", transform: "translateX(-50%)", zIndex: 1000, background: "#067D62", color: "#fff", padding: "12px 24px", borderRadius: "8px", fontWeight: 600, fontSize: "14px", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>
            {toast}
          </div>
        )}

        <section style={{ background: "#fff", borderRadius: "8px", border: "1px solid #DDDDDD", overflow: "hidden", marginBottom: "24px" }}>
          <div style={{ display: "flex", borderBottom: "1px solid #DDDDDD", flexWrap: "wrap" }}>
            {tabs.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                style={{
                  padding: "14px 16px", border: "none", background: tab === t.key ? "#fff" : "#F6F8F8",
                  color: tab === t.key ? "#131921" : "#565959", fontWeight: tab === t.key ? 700 : 400,
                  borderBottom: tab === t.key ? "3px solid #FF9900" : "3px solid transparent",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", fontSize: "13px", whiteSpace: "nowrap",
                }}>
                <span class="material-symbols-outlined" style={{ fontSize: "18px" }}>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>

          <div style={{ padding: "24px" }}>
            {tab === "store" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px", maxWidth: "500px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>اسم المتجر</label>
                  <input type="text" className="amazon-input" value={form.name}
                    onChange={(e) => setForm({ ...form, name: (e.target as HTMLInputElement).value })} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>الشعار (URL)</label>
                  <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    {store?.logo && <img src={getImageUrl(store.logo)} alt="logo" style={{ width: "48px", height: "48px", borderRadius: "8px", objectFit: "cover", border: "1px solid #DDDDDD" }} />}
                    <label style={{ padding: "8px 16px", background: "#FF9900", borderRadius: "6px", fontWeight: 600, fontSize: "13px", cursor: "pointer", border: "none" }}>
                      رفع شعار
                      <input type="file" accept="image/*" style={{ display: "none" }}
                        onChange={(e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) uploadLogo(f); }} />
                    </label>
                  </div>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>شعار المتجر</label>
                  <input type="text" className="amazon-input" value={form.tagLine}
                    placeholder="وصف قصير لمتجرك"
                    onChange={(e) => setForm({ ...form, tagLine: (e.target as HTMLInputElement).value })} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>اللون الأساسي</label>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <input type="color" value={form.primaryColor}
                      onChange={(e) => setForm({ ...form, primaryColor: (e.target as HTMLInputElement).value })}
                      style={{ width: "48px", height: "40px", padding: "2px", border: "1px solid #DDDDDD", borderRadius: "6px", cursor: "pointer" }} />
                    <span style={{ fontSize: "13px", color: "#565959", fontFamily: "monospace" }}>{form.primaryColor}</span>
                  </div>
                </div>
                <div>
                  <button onClick={saveStore} disabled={saving === "store"}
                    style={{ padding: "10px 32px", background: saving === "store" ? "#ccc" : "#FF9900", color: "#131921", border: "none", borderRadius: "8px", fontWeight: 700, fontSize: "14px", cursor: saving === "store" ? "not-allowed" : "pointer" }}>
                    {saving === "store" ? "جاري الحفظ..." : "حفظ الإعدادات"}
                  </button>
                </div>
              </div>
            )}

            {tab === "shipping" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px", maxWidth: "600px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "8px" }}>المحافظات</label>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
                    {settings.shipping.governorates.map((g, i) => (
                      <div key={i} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <input type="text" className="amazon-input" value={g.name} placeholder="اسم المحافظة"
                          onChange={(e) => updateGov(i, "name", (e.target as HTMLInputElement).value)}
                          style={{ flex: 1 }} />
                        <input type="number" className="amazon-input" value={g.price} placeholder="السعر"
                          onChange={(e) => updateGov(i, "price", (e.target as HTMLInputElement).value)}
                          style={{ width: "120px" }} />
                        <button onClick={() => removeGovernorate(i)} type="button"
                          style={{ padding: "8px 12px", background: "#FAE1E1", color: "#C41E3A", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: 600, fontSize: "13px" }}>
                          إزالة
                        </button>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <input type="text" className="amazon-input" value={govInput.name} placeholder="اسم المحافظة"
                      onChange={(e) => setGovInput({ ...govInput, name: (e.target as HTMLInputElement).value })}
                      style={{ flex: 1 }} />
                    <input type="number" className="amazon-input" value={govInput.price} placeholder="السعر"
                      onChange={(e) => setGovInput({ ...govInput, price: (e.target as HTMLInputElement).value })}
                      style={{ width: "120px" }} />
                    <button onClick={addGovernorate} type="button"
                      style={{ padding: "8px 16px", background: "#FF9900", color: "#131921", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: 600, fontSize: "13px", whiteSpace: "nowrap" }}>
                      + إضافة
                    </button>
                  </div>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>الشحن المجاني (أقل مبلغ للطلب)</label>
                  <input type="number" className="amazon-input" value={settings.shipping.freeShippingMin}
                    onChange={(e) => setSettings({ ...settings, shipping: { ...settings.shipping, freeShippingMin: parseFloat((e.target as HTMLInputElement).value) || 0 } })}
                    style={{ width: "200px" }} />
                </div>
                <div>
                  <button onClick={() => saveSection("shipping")} disabled={saving === "shipping"}
                    style={{ padding: "10px 32px", background: saving === "shipping" ? "#ccc" : "#FF9900", color: "#131921", border: "none", borderRadius: "8px", fontWeight: 700, fontSize: "14px", cursor: saving === "shipping" ? "not-allowed" : "pointer" }}>
                    {saving === "shipping" ? "جاري الحفظ..." : "حفظ إعدادات الشحن"}
                  </button>
                </div>
              </div>
            )}

            {tab === "payment" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px", maxWidth: "500px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <label style={{ fontSize: "13px", fontWeight: 600 }}>الدفع عند الاستلام (COD)</label>
                  <Toggle value={settings.payment.cod} onChange={(v) => setSettings({ ...settings, payment: { ...settings.payment, cod: v } })} />
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <label style={{ fontSize: "13px", fontWeight: 600 }}>التحويل البنكي</label>
                  <Toggle value={settings.payment.bankTransfer} onChange={(v) => setSettings({ ...settings, payment: { ...settings.payment, bankTransfer: v } })} />
                </div>
                {settings.payment.bankTransfer && (
                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>رقم الحساب البنكي</label>
                    <input type="text" className="amazon-input" value={settings.payment.bankAccount} placeholder="رقم الحساب"
                      onChange={(e) => setSettings({ ...settings, payment: { ...settings.payment, bankAccount: (e.target as HTMLInputElement).value } })} />
                  </div>
                )}
                <div>
                  <button onClick={() => saveSection("payment")} disabled={saving === "payment"}
                    style={{ padding: "10px 32px", background: saving === "payment" ? "#ccc" : "#FF9900", color: "#131921", border: "none", borderRadius: "8px", fontWeight: 700, fontSize: "14px", cursor: saving === "payment" ? "not-allowed" : "pointer" }}>
                    {saving === "payment" ? "جاري الحفظ..." : "حفظ إعدادات الدفع"}
                  </button>
                </div>
              </div>
            )}

            {tab === "whatsapp" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px", maxWidth: "500px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>رقم واتساب</label>
                  <input type="text" className="amazon-input" value={settings.whatsapp.number} placeholder="مثال: 966501234567"
                    onChange={(e) => setSettings({ ...settings, whatsapp: { ...settings.whatsapp, number: (e.target as HTMLInputElement).value } })} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>نص الرسالة الافتراضي</label>
                  <textarea className="amazon-input" value={settings.whatsapp.message} placeholder="مرحباً، أود الاستفسار عن..."
                    onChange={(e) => setSettings({ ...settings, whatsapp: { ...settings.whatsapp, message: (e.target as HTMLTextAreaElement).value } })}
                    style={{ width: "100%", minHeight: "80px", resize: "vertical", fontFamily: "inherit" }} />
                </div>
                <div>
                  <button onClick={() => saveSection("whatsapp")} disabled={saving === "whatsapp"}
                    style={{ padding: "10px 32px", background: saving === "whatsapp" ? "#ccc" : "#FF9900", color: "#131921", border: "none", borderRadius: "8px", fontWeight: 700, fontSize: "14px", cursor: saving === "whatsapp" ? "not-allowed" : "pointer" }}>
                    {saving === "whatsapp" ? "جاري الحفظ..." : "حفظ إعدادات واتساب"}
                  </button>
                </div>
              </div>
            )}

            {tab === "pixel" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px", maxWidth: "500px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>معرف فيسبوك بيكسل (Facebook Pixel ID)</label>
                  <input type="text" className="amazon-input" value={settings.pixel.facebookPixelId} placeholder="مثال: 123456789012345"
                    onChange={(e) => setSettings({ ...settings, pixel: { ...settings.pixel, facebookPixelId: (e.target as HTMLInputElement).value } })} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>معرف جوجل أناليتكس (Google Analytics ID)</label>
                  <input type="text" className="amazon-input" value={settings.pixel.googleAnalyticsId} placeholder="مثال: G-XXXXXXXXXX"
                    onChange={(e) => setSettings({ ...settings, pixel: { ...settings.pixel, googleAnalyticsId: (e.target as HTMLInputElement).value } })} />
                </div>
                <div>
                  <button onClick={() => saveSection("pixel")} disabled={saving === "pixel"}
                    style={{ padding: "10px 32px", background: saving === "pixel" ? "#ccc" : "#FF9900", color: "#131921", border: "none", borderRadius: "8px", fontWeight: 700, fontSize: "14px", cursor: saving === "pixel" ? "not-allowed" : "pointer" }}>
                    {saving === "pixel" ? "جاري الحفظ..." : "حفظ إعدادات التتبع"}
                  </button>
                </div>
              </div>
            )}

            {tab === "seo" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px", maxWidth: "500px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>عنوان الميتا (Meta Title)</label>
                  <input type="text" className="amazon-input" value={settings.seo.title} placeholder="عنوان المتجر في محركات البحث"
                    onChange={(e) => setSettings({ ...settings, seo: { ...settings.seo, title: (e.target as HTMLInputElement).value } })} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>وصف الميتا (Meta Description)</label>
                  <textarea className="amazon-input" value={settings.seo.description} placeholder="وصف المتجر في محركات البحث"
                    onChange={(e) => setSettings({ ...settings, seo: { ...settings.seo, description: (e.target as HTMLTextAreaElement).value } })}
                    style={{ width: "100%", minHeight: "80px", resize: "vertical", fontFamily: "inherit" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>الكلمات المفتاحية (Keywords)</label>
                  <input type="text" className="amazon-input" value={settings.seo.keywords} placeholder="متجر, ملابس, إلكترونيات, ..."
                    onChange={(e) => setSettings({ ...settings, seo: { ...settings.seo, keywords: (e.target as HTMLInputElement).value } })} />
                </div>
                <div>
                  <button onClick={() => saveSection("seo")} disabled={saving === "seo"}
                    style={{ padding: "10px 32px", background: saving === "seo" ? "#ccc" : "#FF9900", color: "#131921", border: "none", borderRadius: "8px", fontWeight: 700, fontSize: "14px", cursor: saving === "seo" ? "not-allowed" : "pointer" }}>
                    {saving === "seo" ? "جاري الحفظ..." : "حفظ إعدادات SEO"}
                  </button>
                </div>
              </div>
            )}

            {tab === "social" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px", maxWidth: "500px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>رابط فيسبوك (Facebook)</label>
                  <input type="text" className="amazon-input" value={settings.social.facebook} placeholder="https://facebook.com/..."
                    onChange={(e) => setSettings({ ...settings, social: { ...settings.social, facebook: (e.target as HTMLInputElement).value } })} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>رابط إنستغرام (Instagram)</label>
                  <input type="text" className="amazon-input" value={settings.social.instagram} placeholder="https://instagram.com/..."
                    onChange={(e) => setSettings({ ...settings, social: { ...settings.social, instagram: (e.target as HTMLInputElement).value } })} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>رابط تيك توك (TikTok)</label>
                  <input type="text" className="amazon-input" value={settings.social.tiktok} placeholder="https://tiktok.com/@..."
                    onChange={(e) => setSettings({ ...settings, social: { ...settings.social, tiktok: (e.target as HTMLInputElement).value } })} />
                </div>
                <div>
                  <button onClick={() => saveSection("social")} disabled={saving === "social"}
                    style={{ padding: "10px 32px", background: saving === "social" ? "#ccc" : "#FF9900", color: "#131921", border: "none", borderRadius: "8px", fontWeight: 700, fontSize: "14px", cursor: saving === "social" ? "not-allowed" : "pointer" }}>
                    {saving === "social" ? "جاري الحفظ..." : "حفظ الروابط الاجتماعية"}
                  </button>
                </div>
              </div>
            )}

            {tab === "domain" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px", maxWidth: "500px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>النطاق المخصص (Custom Domain)</label>
                  <input type="text" className="amazon-input" value={settings.domain.customDomain} placeholder="example.com"
                    onChange={(e) => setSettings({ ...settings, domain: { ...settings.domain, customDomain: (e.target as HTMLInputElement).value } })} />
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <label style={{ fontSize: "13px", fontWeight: 600 }}>تفعيل SSL</label>
                  <Toggle value={settings.domain.sslEnabled} onChange={(v) => setSettings({ ...settings, domain: { ...settings.domain, sslEnabled: v } })} />
                </div>
                <div>
                  <button onClick={() => saveSection("domain")} disabled={saving === "domain"}
                    style={{ padding: "10px 32px", background: saving === "domain" ? "#ccc" : "#FF9900", color: "#131921", border: "none", borderRadius: "8px", fontWeight: 700, fontSize: "14px", cursor: saving === "domain" ? "not-allowed" : "pointer" }}>
                    {saving === "domain" ? "جاري الحفظ..." : "حفظ إعدادات النطاق"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        <footer style={{ marginTop: "auto", padding: "16px 0 0", textAlign: "center" }}>
          <p style={{ fontSize: "14px", color: "#565959", opacity: 0.8, margin: 0 }}>© 2025 M&K Store. جميع الحقوق محفوظة.</p>
        </footer>
      </div>
    </div>
  );
}
