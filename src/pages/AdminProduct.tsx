import { useState, useEffect, FormEvent, useRef } from "preact/compat";
import { api, API_BASE, getImageUrl } from "../services/api";
import type { Product } from "../types";
import Sidebar from "../components/Sidebar";

export default function AdminProduct() {
  const [product, setProduct] = useState<Product | null>(null);
  const [form, setForm] = useState({
    name: "", description: "", price: 0, oldPrice: 0,
    pricingTiers: {} as Record<string, number>,
    variantStock: {} as Record<string, Record<string, number>>,
    active: true, images: {} as Record<string, string>,
    colors: [] as string[], sizes: [] as string[],
  });
  const [newColor, setNewColor] = useState("");
  const [newSize, setNewSize] = useState("");
  const [uploading, setUploading] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [toastShow, setToastShow] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadTargetColor, setUploadTargetColor] = useState("");

  useEffect(() => {
    api.get<Product>("/admin/product").then((p) => {
      setProduct(p);
      setForm({
        name: p.name, description: p.description, price: p.price,
        oldPrice: p.oldPrice || 0, active: p.active,
        pricingTiers: p.pricingTiers || {},
        variantStock: p.variantStock || {},
        images: p.images || {}, colors: p.colors, sizes: p.sizes,
      });
    });
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setToastShow(true);
    setTimeout(() => setToastShow(false), 3000);
  };

  const totalStock = Object.values(form.variantStock).reduce(
    (sum, sizes) => sum + Object.values(sizes).reduce((a, b) => a + b, 0), 0,
  );

  const setVariant = (color: string, size: string, val: number) => {
    const vs = { ...form.variantStock };
    if (!vs[color]) vs[color] = {};
    vs[color] = { ...vs[color], [size]: val };
    setForm({ ...form, variantStock: vs });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await api.put<Product>("/admin/product", form);
      setProduct(updated);
      showToast("تم حفظ التغييرات بنجاح");
    } catch (err: any) {
      showToast(err.message || "حدث خطأ");
    } finally {
      setSaving(false);
    }
  };

  const uploadImage = async (color: string, file: File) => {
    setUploading(color);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/admin/upload`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل رفع الصورة");
      if (data.url) setForm({ ...form, images: { ...form.images, [color]: data.url } });
    } catch {
      showToast("فشل رفع الصورة");
    } finally {
      setUploading(null);
    }
  };

  if (!product) return (
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
          <span>{toastMsg || "تم حفظ التغييرات بنجاح"}</span>
        </div>

        <header style={{ marginBottom: "24px" }}>
          <nav style={{ display: "flex", alignItems: "center", gap: "8px", color: "#565959", fontSize: "12px", marginBottom: "8px" }}>
            <a href="#" style={{ color: "#007185", textDecoration: "none" }}>المنتجات</a>
            <span class="material-symbols-outlined" style={{ fontSize: "14px" }}>chevron_left</span>
            <span style={{ color: "#0F1111" }}>{form.name}</span>
          </nav>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "24px", fontWeight: 700, color: "#0F1111", margin: 0 }}>إدارة المنتج</h2>
        </header>

        <div style={{ background: "#F0FAF8", borderRight: "4px solid #067D62", padding: "16px", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "14px" }}>🟢 المنتج {form.active ? "نشط الآن" : "غير نشط"}</span>
            <span style={{ width: "1px", height: "16px", background: "#DBC2AD", opacity: 0.3 }}></span>
            <span style={{ color: "#565959", fontSize: "14px" }}>آخر تحديث: {new Date(product.updatedAt).toLocaleString("ar-EG")}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="prod-grid">
            <div style={{ gridColumn: "span 8" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                <section style={{ background: "#fff", border: "1px solid #DDDDDD", borderRadius: "8px", padding: "24px" }}>
                  <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "20px", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px", margin: "0 0 24px" }}>
                    <span>ℹ️</span> المعلومات الأساسية
                  </h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div>
                      <label className="amazon-label">اسم المنتج</label>
                      <input className="amazon-input" type="text" value={form.name} onChange={(e) => setForm({ ...form, name: (e.target as HTMLInputElement).value })} required />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                      <div>
                        <label className="amazon-label">السعر الحالي (EGP)</label>
                        <input className="amazon-input" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: parseFloat((e.target as HTMLInputElement).value) || 0 })} required min="0" />
                      </div>
                      <div>
                        <label className="amazon-label">السعر الأصلي (EGP)</label>
                        <input className="amazon-input" type="number" value={form.oldPrice || ""} onChange={(e) => setForm({ ...form, oldPrice: parseFloat((e.target as HTMLInputElement).value) || 0 })} min="0" style={{ color: "#565959" }} />
                      </div>
                    </div>
                    <div>
                      <label className="amazon-label">وصف المنتج</label>
                      <textarea className="amazon-textarea" style={{ height: "128px" }} placeholder="أدخل وصفاً تفصيلياً للمنتج..." value={form.description} onChange={(e) => setForm({ ...form, description: (e.target as HTMLTextAreaElement).value })} />
                    </div>
                  </div>
                </section>

                <section style={{ background: "#fff", border: "1px solid #DDDDDD", borderRadius: "8px", padding: "24px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                    <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "20px", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px", margin: 0 }}>
                      <span>📦</span> المخزون
                    </h3>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "14px", color: "#565959" }}>إجمالي المخزون:</span>
                      <span style={{ color: "#067D62", fontWeight: 700, fontSize: "20px" }}>{totalStock}</span>
                    </div>
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", textAlign: "right", borderCollapse: "collapse", fontSize: "14px" }}>
                      <thead>
                        <tr style={{ background: "#F1F4F4", borderBottom: "1px solid #DDDDDD" }}>
                          <th style={{ padding: "12px", fontWeight: 600 }}>اللون \ المقاس</th>
                          {form.sizes.map((s) => (
                            <th key={s} style={{ padding: "12px", textAlign: "center", fontWeight: 600 }}>{s}</th>
                          ))}
                          <th style={{ padding: "12px", textAlign: "center", fontWeight: 600 }}>المجموع</th>
                        </tr>
                      </thead>
                      <tbody>
                        {form.colors.map((c) => {
                          const rowTotal = form.sizes.reduce((sum, s) => sum + ((form.variantStock[c]?.[s]) ?? 0), 0);
                          return (
                            <tr key={c} style={{ borderBottom: "1px solid #DDDDDD" }}>
                              <td style={{ padding: "12px", fontWeight: 600 }}>{c}</td>
                              {form.sizes.map((s) => (
                                <td key={s} style={{ padding: "4px 8px", textAlign: "center" }}>
                                  <input type="number" value={form.variantStock[c]?.[s] ?? 0} onChange={(e) => setVariant(c, s, parseInt((e.target as HTMLInputElement).value) || 0)} min="0" style={{ width: "60px", padding: "6px 8px", border: "1px solid #888C8C", borderRadius: "4px", fontSize: "13px", textAlign: "center" }} />
                                </td>
                              ))}
                              <td style={{ padding: "12px", textAlign: "center", fontWeight: 600 }}>{rowTotal}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ marginTop: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                    <input type="checkbox" id="activeToggle" checked={form.active} onChange={(e) => setForm({ ...form, active: (e.target as HTMLInputElement).checked })} style={{ borderRadius: "4px", borderColor: "#888C8C", accentColor: "#007185" }} />
                    <label htmlFor="activeToggle" style={{ fontSize: "14px", userSelect: "none" }}>عرض الكمية المتبقية للعملاء (عندما تكون أقل من 10 قطع)</label>
                  </div>
                </section>

                <section style={{ background: "#fff", border: "1px solid #DDDDDD", borderRadius: "8px", padding: "24px" }}>
                  <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "20px", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px", margin: "0 0 24px" }}>
                    <span>🎨</span> خيارات المنتج
                  </h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                    <div>
                      <label className="amazon-label" style={{ marginBottom: "8px" }}>الألوان المتاحة</label>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
                        {form.colors.map((c) => (
                          <span key={c} className="amazon-pill">
                            {c}
                            <span onClick={() => {
                              const imgs = { ...form.images }; delete imgs[c];
                              const vs = { ...form.variantStock }; delete vs[c];
                              setForm({ ...form, colors: form.colors.filter((x) => x !== c), images: imgs, variantStock: vs });
                            }} class="material-symbols-outlined" style={{ fontSize: "16px", cursor: "pointer", color: "#B12704" }}>close</span>
                          </span>
                        ))}
                      </div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <input className="amazon-input" style={{ maxWidth: "200px" }} placeholder="إضافة لون جديد..." type="text" value={newColor} onChange={(e) => setNewColor((e.target as HTMLInputElement).value)} />
                        <button type="button" onClick={() => { if (newColor.trim() && !form.colors.includes(newColor.trim())) { setForm({ ...form, colors: [...form.colors, newColor.trim()] }); setNewColor(""); } }}
                          style={{ background: "#fff", border: "1px solid #888C8C", borderRadius: "8px", padding: "8px 16px", fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>
                          <span class="material-symbols-outlined" style={{ fontSize: "16px" }}>add</span> إضافة
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="amazon-label" style={{ marginBottom: "8px" }}>المقاسات</label>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
                        {form.sizes.map((s) => (
                          <span key={s} className="amazon-pill">
                            {s}
                            <span onClick={() => {
                              const vs = { ...form.variantStock };
                              for (const c of Object.keys(vs)) { const sizes = { ...vs[c] }; delete sizes[s]; vs[c] = sizes; }
                              setForm({ ...form, sizes: form.sizes.filter((x) => x !== s), variantStock: vs });
                            }} class="material-symbols-outlined" style={{ fontSize: "16px", cursor: "pointer", color: "#B12704" }}>close</span>
                          </span>
                        ))}
                      </div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <input className="amazon-input" style={{ maxWidth: "200px" }} placeholder="إضافة مقاس..." type="text" value={newSize} onChange={(e) => setNewSize((e.target as HTMLInputElement).value)} />
                        <button type="button" onClick={() => { if (newSize.trim() && !form.sizes.includes(newSize.trim())) { setForm({ ...form, sizes: [...form.sizes, newSize.trim()] }); setNewSize(""); } }}
                          style={{ background: "#fff", border: "1px solid #888C8C", borderRadius: "8px", padding: "8px 16px", fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>
                          <span class="material-symbols-outlined" style={{ fontSize: "16px" }}>add</span> إضافة
                        </button>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>

            <div style={{ gridColumn: "span 4" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                <section style={{ background: "#fff", border: "1px solid #DDDDDD", borderRadius: "8px", padding: "24px" }}>
                  <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "20px", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px", margin: "0 0 16px" }}>
                    <span>💰</span> أسعار الكمية
                  </h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    {[1, 2, 3, 4].map((qty) => (
                      <div key={qty}>
                        <label style={{ fontSize: "12px", display: "block", marginBottom: "4px", color: "#565959" }}>{qty} {qty === 1 ? "قطعة" : "قطع"}</label>
                        <input className="amazon-input" type="number" value={form.pricingTiers[qty] ?? ""} onChange={(e) => setForm({ ...form, pricingTiers: { ...form.pricingTiers, [qty]: parseFloat((e.target as HTMLInputElement).value) || 0 } })} min="0" />
                      </div>
                    ))}
                  </div>
                  <p style={{ color: "#565959", fontSize: "12px", marginTop: "16px", lineHeight: 1.3 }}>* سيتم تطبيق هذه الخصومات تلقائياً عند إضافة الكمية المحددة لسلة التسوق.</p>
                </section>

                <section style={{ background: "#fff", border: "1px solid #DDDDDD", borderRadius: "8px", padding: "24px" }}>
                  <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "20px", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px", margin: "0 0 24px" }}>
                    <span>🖼️</span> صور المنتج حسب اللون
                  </h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                    {form.colors.map((c) => (
                      <div key={c}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                          <span style={{ fontSize: "14px", fontWeight: 700 }}>{c}</span>
                          <span style={{ fontSize: "12px", color: "#565959" }}>{form.images[c] ? "1 صورة" : "لا توجد صور"}</span>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
                          {form.images[c] ? (
                            <div style={{ aspectRatio: "1", borderRadius: "8px", border: "1px solid #DDDDDD", background: "#F0F2F2", overflow: "hidden", position: "relative" }}
                              onMouseEnter={(e) => { (e.currentTarget.querySelector(".del-overlay") as HTMLElement).style.opacity = "1"; }}
                              onMouseLeave={(e) => { (e.currentTarget.querySelector(".del-overlay") as HTMLElement).style.opacity = "0"; }}>
                              <img src={getImageUrl(form.images[c])} alt={c} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              <div className="del-overlay" style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)", opacity: 0, display: "flex", alignItems: "center", justifyContent: "center", transition: "opacity 0.2s" }}>
                                <button type="button" onClick={() => { const imgs = { ...form.images }; delete imgs[c]; setForm({ ...form, images: imgs }); }} style={{ color: "#fff", background: "none", border: "none", cursor: "pointer", padding: "4px" }}>
                                  <span class="material-symbols-outlined">delete</span>
                                </button>
                              </div>
                            </div>
                          ) : null}
                          <button type="button" onClick={() => { setUploadTargetColor(c); fileRef.current?.click(); }} disabled={uploading === c}
                            style={{ aspectRatio: "1", borderRadius: "8px", border: "2px dashed #888C8C", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "none", cursor: "pointer" }}>
                            <span class="material-symbols-outlined" style={{ color: "#007185" }}>upload</span>
                            <span style={{ fontSize: "10px", marginTop: "4px", fontWeight: 700 }}>{uploading === c ? "..." : "رفع"}</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f && uploadTargetColor) uploadImage(uploadTargetColor, f); (e.target as HTMLInputElement).value = ""; }} />
                  <button type="button" style={{ width: "100%", background: "#fff", border: "1px solid #888C8C", borderRadius: "8px", padding: "8px 16px", marginTop: "24px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", cursor: "pointer", fontWeight: 500 }}
                    onClick={() => { if (form.colors.length > 0) { setUploadTargetColor(form.colors[0]); fileRef.current?.click(); } }}>
                    <span class="material-symbols-outlined" style={{ fontSize: "16px" }}>add_photo_alternate</span> إضافة صورة
                  </button>
                </section>

                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <button type="submit" disabled={saving}
                    style={{ width: "100%", background: "#FF9900", color: "#0F1111", fontWeight: 700, borderRadius: "8px", height: "48px", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer", fontSize: "16px", boxShadow: "0 2px 5px 0 rgba(213,217,217,0.5)", opacity: saving ? 0.7 : 1 }}>
                    {saving ? "جاري الحفظ..." : "حفظ التغييرات"}
                  </button>
                  <button type="button" style={{ width: "100%", background: "#fff", border: "1px solid #888C8C", borderRadius: "8px", padding: "8px 16px", color: "#B12704", fontWeight: 500, cursor: "pointer" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#FFDAD6"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#fff"; }}
                    onClick={async () => {
                      if (!window.confirm("هل أنت متأكد من حذف هذا المنتج؟")) return;
                      await api.delete("/admin/product");
                      window.location.href = "/admin";
                    }}>
                    حذف المنتج نهائياً
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>

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
