import { useState, useEffect } from "preact/compat";
import { useRoute, useLocation } from "wouter";
import { api, getImageUrl } from "../services/api";
import Sidebar from "../components/Sidebar";

type SectionType = "hero" | "features" | "products" | "cta" | "footer" | "testimonials" | "faq" | "contact";

interface Section {
  type: SectionType;
  content: Record<string, string>;
}

const DEFAULT_SECTION: Record<string, Section> = {
  hero: { type: "hero", content: { headline: "عنوان الصفحة", subtext: "نص فرعي يصف العرض", buttonText: "تسوق الآن", buttonUrl: "/store?ref=", imageUrl: "" } },
  features: { type: "features", content: { title: "مميزاتنا", items: JSON.stringify(["جودة عالية", "سعر مناسب", "شحن سريع"]) } },
  products: { type: "products", content: { title: "منتجاتنا" } },
  cta: { type: "cta", content: { headline: "احصل على عرضك الآن", buttonText: "اطلب الآن", buttonUrl: "/store?ref=" } },
  footer: { type: "footer", content: { text: "جميع الحقوق محفوظة", socialLinks: "" } },
  testimonials: { type: "testimonials", content: { title: "آراء العملاء", items: JSON.stringify([{ name: "أحمد", text: "منتج رائع جداً", rating: "5" }, { name: "محمد", text: "خدمة ممتازة وسريعة", rating: "5" }]) } },
  faq: { type: "faq", content: { title: "الأسئلة الشائعة", items: JSON.stringify([{ q: "ما هي طرق الدفع؟", a: "الدفع عند الاستلام" }, { q: "كم مدة التوصيل؟", a: "3-5 أيام عمل" }]) } },
  contact: { type: "contact", content: { title: "اتصل بنا", phone: "", whatsapp: "", email: "", address: "" } },
};

export default function MerchantLandingEditor() {
  const [, params] = useRoute<{ id: string }>("/merchant/landing-pages/:id");
  const [, navigate] = useLocation();
  const [page, setPage] = useState<any>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [editingSection, setEditingSection] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  useEffect(() => {
    if (params?.id) {
      api.get<any>(`/merchant/landing-pages/${params.id}`)
        .then((p) => { setPage(p); setSections(p.sections || []); })
        .catch(() => navigate("/merchant/landing-pages"));
    }
  }, [params?.id]);

  const addSection = (type: SectionType) => {
    setSections([...sections, { ...DEFAULT_SECTION[type], content: { ...DEFAULT_SECTION[type].content } }]);
  };

  const removeSection = (idx: number) => {
    setSections(sections.filter((_, i) => i !== idx));
    setEditingSection(null);
  };

  const moveSection = (idx: number, dir: number) => {
    const newSections = [...sections];
    const target = idx + dir;
    if (target < 0 || target >= newSections.length) return;
    [newSections[idx], newSections[target]] = [newSections[target], newSections[idx]];
    setSections(newSections);
    setEditingSection(dir > 0 ? target : target);
  };

  const updateContent = (idx: number, key: string, value: string) => {
    const newSections = [...sections];
    newSections[idx] = { ...newSections[idx], content: { ...newSections[idx].content, [key]: value } };
    setSections(newSections);
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/merchant/landing-pages/${params!.id}`, { sections: JSON.stringify(sections) });
      showToast("تم حفظ الصفحة");
    } catch { showToast("حدث خطأ في الحفظ"); }
    finally { setSaving(false); }
  };

  if (!page) return (
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
        <header style={{ marginBottom: "24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "24px", fontWeight: 600, color: "#0F1111", margin: 0 }}>{page.name}</h2>
            <p style={{ fontSize: "14px", color: "#565959", margin: "4px 0 0" }}>/p/{page.slug}</p>
          </div>
          <div style={{ display: "flex", gap: "12px" }}>
            <button onClick={() => navigate("/merchant/landing-pages")} style={{ padding: "10px 20px", borderRadius: "8px", border: "1px solid #DDDDDD", background: "#fff", fontWeight: 600, cursor: "pointer" }}>رجوع</button>
            <button onClick={save} disabled={saving} style={{ padding: "10px 24px", borderRadius: "8px", border: "none", background: saving ? "#ccc" : "#FF9900", color: "#131921", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer" }}>
              {saving ? "جاري الحفظ..." : "حفظ"}
            </button>
          </div>
        </header>

        {toast && (
          <div style={{ position: "fixed", top: "80px", left: "50%", transform: "translateX(-50%)", zIndex: 1000, background: "#067D62", color: "#fff", padding: "12px 24px", borderRadius: "8px", fontWeight: 600, fontSize: "14px" }}>
            {toast}
          </div>
        )}

        <div style={{ display: "flex", gap: "12px", marginBottom: "24px", flexWrap: "wrap" }}>
          {(["hero", "features", "products", "cta", "footer", "testimonials", "faq", "contact"] as SectionType[]).map((type) => (
            <button key={type} onClick={() => addSection(type)}
              style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #DDDDDD", background: "#fff", fontWeight: 600, cursor: "pointer", fontSize: "13px", display: "flex", alignItems: "center", gap: "6px" }}>
              <span class="material-symbols-outlined" style={{ fontSize: "16px" }}>
                {type === "hero" ? "image" : type === "features" ? "grid_view" : type === "products" ? "inventory_2" : type === "cta" ? "call_to_action" : type === "footer" ? "bottom_panel_close" : type === "testimonials" ? "star" : type === "faq" ? "question_answer" : "contact_mail"}
              </span>
              {type === "hero" ? "غلاف" : type === "features" ? "مميزات" : type === "products" ? "منتجات" : type === "cta" ? "دعوة" : type === "footer" ? "تذييل" : type === "testimonials" ? "آراء" : type === "faq" ? "أسئلة" : "اتصال"}
            </button>
          ))}
        </div>

        <section style={{ flex: 1, background: "#fff", borderRadius: "8px", border: "1px solid #DDDDDD", padding: "24px", overflowY: "auto" }}>
          {sections.length === 0 && (
            <div style={{ textAlign: "center", padding: "48px", color: "#565959" }}>أضف أقساماً لبدء بناء الصفحة</div>
          )}
          {sections.map((sec, idx) => (
            <div key={idx} style={{ marginBottom: "16px", border: editingSection === idx ? "2px solid #FF9900" : "1px solid #DDDDDD", borderRadius: "8px", overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "#F6F8F8", borderBottom: "1px solid #DDDDDD" }}>
                <span style={{ fontWeight: 700, fontSize: "14px" }}>
                  {sec.type === "hero" ? "📷 غلاف" : sec.type === "features" ? "✨ مميزات" : sec.type === "products" ? "📦 منتجات" : sec.type === "cta" ? "🔘 دعوة للإجراء" : sec.type === "footer" ? "📋 تذييل" : sec.type === "testimonials" ? "⭐ آراء العملاء" : sec.type === "faq" ? "❓ أسئلة شائعة" : "📞 اتصال"}
                </span>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button onClick={() => moveSection(idx, -1)} disabled={idx === 0} style={{ background: "none", border: "none", cursor: idx === 0 ? "not-allowed" : "pointer", opacity: idx === 0 ? 0.3 : 1 }}>
                    <span class="material-symbols-outlined" style={{ fontSize: "16px" }}>arrow_upward</span>
                  </button>
                  <button onClick={() => moveSection(idx, 1)} disabled={idx === sections.length - 1} style={{ background: "none", border: "none", cursor: idx === sections.length - 1 ? "not-allowed" : "pointer", opacity: idx === sections.length - 1 ? 0.3 : 1 }}>
                    <span class="material-symbols-outlined" style={{ fontSize: "16px" }}>arrow_downward</span>
                  </button>
                  <button onClick={() => setEditingSection(editingSection === idx ? null : idx)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                    <span class="material-symbols-outlined" style={{ fontSize: "16px" }}>{editingSection === idx ? "expand_less" : "edit"}</span>
                  </button>
                  <button onClick={() => removeSection(idx)} style={{ background: "none", border: "none", cursor: "pointer", color: "#B12704" }}>
                    <span class="material-symbols-outlined" style={{ fontSize: "16px" }}>delete</span>
                  </button>
                </div>
              </div>
              {editingSection === idx && (
                <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                  {sec.type === "hero" && (
                    <>
                      <input type="text" className="amazon-input" placeholder="العنوان الرئيسي" value={sec.content.headline || ""}
                        onChange={(e) => updateContent(idx, "headline", (e.target as HTMLInputElement).value)} />
                      <input type="text" className="amazon-input" placeholder="النص الفرعي" value={sec.content.subtext || ""}
                        onChange={(e) => updateContent(idx, "subtext", (e.target as HTMLInputElement).value)} />
                      <input type="text" className="amazon-input" placeholder="نص الزر" value={sec.content.buttonText || ""}
                        onChange={(e) => updateContent(idx, "buttonText", (e.target as HTMLInputElement).value)} />
                      <input type="text" className="amazon-input" placeholder="رابط الزر" value={sec.content.buttonUrl || ""}
                        onChange={(e) => updateContent(idx, "buttonUrl", (e.target as HTMLInputElement).value)} />
                      <input type="text" className="amazon-input" placeholder="رابط الصورة" value={sec.content.imageUrl || ""}
                        onChange={(e) => updateContent(idx, "imageUrl", (e.target as HTMLInputElement).value)} />
                      {sec.content.imageUrl && <img src={getImageUrl(sec.content.imageUrl)} style={{ maxWidth: "200px", borderRadius: "4px" }} />}
                    </>
                  )}
                  {sec.type === "features" && (
                    <>
                      <input type="text" className="amazon-input" placeholder="عنوان قسم المميزات" value={sec.content.title || ""}
                        onChange={(e) => updateContent(idx, "title", (e.target as HTMLInputElement).value)} />
                      <textarea className="amazon-input" rows={4} placeholder="المميزات (واحد في كل سطر)" value={(sec.content.items || "").replace(/[\[\]"]/g, "").split(",").join("\n")}
                        onChange={(e) => updateContent(idx, "items", JSON.stringify((e.target as HTMLTextAreaElement).value.split("\n").filter(Boolean)))} />
                    </>
                  )}
                  {sec.type === "products" && (
                    <input type="text" className="amazon-input" placeholder="عنوان قسم المنتجات" value={sec.content.title || ""}
                      onChange={(e) => updateContent(idx, "title", (e.target as HTMLInputElement).value)} />
                  )}
                  {sec.type === "cta" && (
                    <>
                      <input type="text" className="amazon-input" placeholder="العنوان" value={sec.content.headline || ""}
                        onChange={(e) => updateContent(idx, "headline", (e.target as HTMLInputElement).value)} />
                      <input type="text" className="amazon-input" placeholder="نص الزر" value={sec.content.buttonText || ""}
                        onChange={(e) => updateContent(idx, "buttonText", (e.target as HTMLInputElement).value)} />
                      <input type="text" className="amazon-input" placeholder="رابط الزر" value={sec.content.buttonUrl || ""}
                        onChange={(e) => updateContent(idx, "buttonUrl", (e.target as HTMLInputElement).value)} />
                    </>
                  )}
                  {sec.type === "footer" && (
                    <>
                      <input type="text" className="amazon-input" placeholder="نص التذييل" value={sec.content.text || ""}
                        onChange={(e) => updateContent(idx, "text", (e.target as HTMLInputElement).value)} />
                    </>
                  )}
                  {sec.type === "testimonials" && (
                    <>
                      <input type="text" className="amazon-input" placeholder="عنوان القسم" value={sec.content.title || ""}
                        onChange={(e) => updateContent(idx, "title", (e.target as HTMLInputElement).value)} />
                      <div style={{ fontSize: "13px", color: "#565959", marginBottom: "4px" }}>{'الآراء (JSON: [{name, text, rating}])'}</div>
                      <textarea className="amazon-input" rows={6} placeholder='[{"name":"أحمد","text":"رائع","rating":"5"}]'
                        value={sec.content.items || ""}
                        onChange={(e) => updateContent(idx, "items", (e.target as HTMLTextAreaElement).value)} />
                    </>
                  )}
                  {sec.type === "faq" && (
                    <>
                      <input type="text" className="amazon-input" placeholder="عنوان القسم" value={sec.content.title || ""}
                        onChange={(e) => updateContent(idx, "title", (e.target as HTMLInputElement).value)} />
                      <div style={{ fontSize: "13px", color: "#565959", marginBottom: "4px" }}>{'الأسئلة (JSON: [{q, a}])'}</div>
                      <textarea className="amazon-input" rows={6} placeholder='[{"q":"سؤال؟","a":"إجابة"}]'
                        value={sec.content.items || ""}
                        onChange={(e) => updateContent(idx, "items", (e.target as HTMLTextAreaElement).value)} />
                    </>
                  )}
                  {sec.type === "contact" && (
                    <>
                      <input type="text" className="amazon-input" placeholder="عنوان القسم" value={sec.content.title || ""}
                        onChange={(e) => updateContent(idx, "title", (e.target as HTMLInputElement).value)} />
                      <input type="text" className="amazon-input" placeholder="رقم الهاتف" value={sec.content.phone || ""}
                        onChange={(e) => updateContent(idx, "phone", (e.target as HTMLInputElement).value)} />
                      <input type="text" className="amazon-input" placeholder="رقم واتساب" value={sec.content.whatsapp || ""}
                        onChange={(e) => updateContent(idx, "whatsapp", (e.target as HTMLInputElement).value)} />
                      <input type="email" className="amazon-input" placeholder="البريد الإلكتروني" value={sec.content.email || ""}
                        onChange={(e) => updateContent(idx, "email", (e.target as HTMLInputElement).value)} />
                      <input type="text" className="amazon-input" placeholder="العنوان" value={sec.content.address || ""}
                        onChange={(e) => updateContent(idx, "address", (e.target as HTMLInputElement).value)} />
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </section>

        <footer style={{ marginTop: "auto", padding: "16px 0 0", textAlign: "center" }}>
          <p style={{ fontSize: "14px", color: "#565959", opacity: 0.8, margin: 0 }}>© 2025 M&K Store. جميع الحقوق محفوظة.</p>
        </footer>
      </div>
    </div>
  );
}
