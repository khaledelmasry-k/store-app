import { useState, useEffect, FormEvent, useRef } from "preact/compat";
import { api } from "../services/api";
import type { Product } from "../types";
import Sidebar from "../components/Sidebar";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

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
  const [message, setMessage] = useState("");
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
    setMessage("");
    try {
      const updated = await api.put<Product>("/admin/product", form);
      setProduct(updated);
      setMessage("تم حفظ التغييرات بنجاح");
    } catch (err: any) {
      setMessage(err.message || "حدث خطأ");
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
      if (data.url) setForm({ ...form, images: { ...form.images, [color]: data.url } });
    } catch {
      alert("فشل رفع الصورة");
    } finally {
      setUploading(null);
    }
  };

  const addColor = () => {
    if (newColor.trim() && !form.colors.includes(newColor.trim())) {
      setForm({ ...form, colors: [...form.colors, newColor.trim()] });
      setNewColor("");
    }
  };

  const addSize = () => {
    if (newSize.trim() && !form.sizes.includes(newSize.trim())) {
      setForm({ ...form, sizes: [...form.sizes, newSize.trim()] });
      setNewSize("");
    }
  };

  if (!product) return (
    <div style={{ fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif", direction: "rtl", background: "#fbf8ff", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p>جاري التحميل...</p>
    </div>
  );

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif", direction: "rtl", background: "#fbf8ff", minHeight: "100vh", display: "flex" }}>
      <Sidebar />
      <div className="admin-content" style={{ flex: 1, padding: "24px", overflow: "auto", width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <div>
            <h1 style={{ fontSize: "24px", fontWeight: 600, margin: 0 }}>إدارة المنتج</h1>
            <p style={{ fontSize: "14px", color: "#71717a", margin: "4px 0 0" }}>المنتجات / {form.name}</p>
          </div>
        </div>

        {product && (
          <div style={{ background: "#f0fdf4", borderRadius: "8px", padding: "12px 16px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px", fontSize: "14px" }}>
            <span>🟢</span>
            <span>المنتج {form.active ? "نشط الآن" : "غير نشط"}</span>
            <span style={{ color: "#71717a", marginRight: "auto" }}>آخر تحديث: {new Date(product.updatedAt).toLocaleString("ar-SA")}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ background: "white", borderRadius: "8px", padding: "16px", marginBottom: "16px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 600, margin: "0 0 16px" }}>ℹ️ المعلومات الأساسية</h3>

            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontSize: "14px", fontWeight: 500, marginBottom: "6px" }}>اسم المنتج</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required style={{ width: "100%", padding: "10px 12px", border: "1px solid #d4d4d8", borderRadius: "4px", fontSize: "14px", boxSizing: "border-box" }} />
            </div>

            <div style={{ display: "flex", gap: "12px", marginBottom: "12px" }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: "14px", fontWeight: 500, marginBottom: "6px" }}>السعر الحالي (ج.م)</label>
                <input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })} required min="0" style={{ width: "100%", padding: "10px 12px", border: "1px solid #d4d4d8", borderRadius: "4px", fontSize: "14px", boxSizing: "border-box" }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: "14px", fontWeight: 500, marginBottom: "6px" }}>السعر السابق (اختياري)</label>
                <input type="number" value={form.oldPrice || ""} onChange={(e) => setForm({ ...form, oldPrice: parseFloat(e.target.value) || 0 })} min="0" style={{ width: "100%", padding: "10px 12px", border: "1px solid #d4d4d8", borderRadius: "4px", fontSize: "14px", boxSizing: "border-box" }} />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "14px", fontWeight: 500, marginBottom: "6px" }}>وصف المنتج</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} style={{ width: "100%", padding: "10px 12px", border: "1px solid #d4d4d8", borderRadius: "4px", fontSize: "14px", resize: "vertical", boxSizing: "border-box" }} />
            </div>
          </div>

          <div style={{ background: "white", borderRadius: "8px", padding: "16px", marginBottom: "16px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 600, margin: "0 0 16px" }}>💰 أسعار الكمية (شامل الشحن)</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px" }}>
              {[1, 2, 3, 4].map((qty) => (
                <div key={qty}>
                  <label style={{ display: "block", fontSize: "14px", fontWeight: 500, marginBottom: "6px" }}>{qty} قطعة (ج.م)</label>
                  <input type="number" value={form.pricingTiers[qty] ?? ""} onChange={(e) => setForm({ ...form, pricingTiers: { ...form.pricingTiers, [qty]: parseFloat(e.target.value) || 0 } })} min="0" style={{ width: "100%", padding: "10px 12px", border: "1px solid #d4d4d8", borderRadius: "4px", fontSize: "14px", boxSizing: "border-box" }} />
                </div>
              ))}
            </div>
            <p style={{ fontSize: "12px", color: "#71717a", margin: "8px 0 0" }}>الأسعار تشمل الشحن. للكميات الأكبر من 4، يحسب سعر القطعة بـ 350 ج.م.</p>
          </div>

          <div style={{ background: "white", borderRadius: "8px", padding: "16px", marginBottom: "16px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 600, margin: "0 0 16px" }}>📦 المخزون (حسب اللون × المقاس)</h3>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                <thead>
                  <tr>
                    <th style={{ padding: "8px 12px", textAlign: "right", borderBottom: "2px solid #e4e4e7", color: "#71717a", fontWeight: 500 }}>اللون \ المقاس</th>
                    {form.sizes.map((s) => (
                      <th key={s} style={{ padding: "8px 12px", textAlign: "center", borderBottom: "2px solid #e4e4e7", color: "#71717a", fontWeight: 500 }}>{s}</th>
                    ))}
                    <th style={{ padding: "8px 12px", textAlign: "center", borderBottom: "2px solid #e4e4e7", color: "#71717a", fontWeight: 500 }}>المجموع</th>
                  </tr>
                </thead>
                <tbody>
                  {form.colors.map((c) => {
                    const rowTotal = form.sizes.reduce((sum, s) => sum + ((form.variantStock[c]?.[s]) ?? 0), 0);
                    return (
                      <tr key={c}>
                        <td style={{ padding: "8px 12px", fontWeight: 600, borderBottom: "1px solid #f4f4f5" }}>{c}</td>
                        {form.sizes.map((s) => (
                          <td key={s} style={{ padding: "4px 6px", textAlign: "center", borderBottom: "1px solid #f4f4f5" }}>
                            <input type="number" value={form.variantStock[c]?.[s] ?? 0} onChange={(e) => setVariant(c, s, parseInt(e.target.value) || 0)} min="0" style={{ width: "60px", padding: "6px 8px", border: "1px solid #d4d4d8", borderRadius: "4px", fontSize: "13px", textAlign: "center" }} />
                          </td>
                        ))}
                        <td style={{ padding: "8px 12px", textAlign: "center", fontWeight: 600, borderBottom: "1px solid #f4f4f5" }}>{rowTotal}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p style={{ fontSize: "14px", fontWeight: 600, margin: "12px 0 0", textAlign: "left" }}>
              إجمالي المخزون الكلي: <span style={{ color: "#006e2f" }}>{totalStock}</span> قطعة
            </p>
            <div style={{ marginTop: "12px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", fontWeight: 500, cursor: "pointer" }}>
                <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                يظهر المنتج للعملاء
              </label>
            </div>
          </div>

          <div style={{ background: "white", borderRadius: "8px", padding: "16px", marginBottom: "16px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 600, margin: "0 0 16px" }}>🖼️ صور المنتج حسب اللون</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {form.colors.map((c) => (
                <div key={c} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px", border: "1px solid #e4e4e7", borderRadius: "6px" }}>
                  <div style={{ width: "80px", height: "80px", borderRadius: "6px", background: "#f4f4f5", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                    {form.images[c] ? (
                      <img src={form.images[c]} alt={c} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <span style={{ color: "#71717a", fontSize: "12px" }}>لا توجد</span>
                    )}
                  </div>
                  <span style={{ fontWeight: 600, minWidth: "60px" }}>{c}</span>
                  <button type="button" onClick={() => { setUploadTargetColor(c); fileRef.current?.click(); }} disabled={uploading === c} style={{ padding: "6px 12px", background: "black", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "13px" }}>
                    {uploading === c ? "جاري الرفع..." : "رفع صورة"}
                  </button>
                  {form.images[c] && (
                    <button type="button" onClick={() => { const imgs = { ...form.images }; delete imgs[c]; setForm({ ...form, images: imgs }); }} style={{ padding: "6px 12px", background: "#ba1a1a", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "13px" }}>
                      حذف
                    </button>
                  )}
                </div>
              ))}
              {form.colors.length === 0 && <p style={{ color: "#71717a", fontSize: "14px" }}>أضف ألواناً أولاً</p>}
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f && uploadTargetColor) uploadImage(uploadTargetColor, f); e.target.value = ""; }} />
          </div>

          <div style={{ background: "white", borderRadius: "8px", padding: "16px", marginBottom: "16px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 600, margin: "0 0 16px" }}>🎨 خيارات المنتج (المتغيرات)</h3>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "14px", fontWeight: 500, marginBottom: "6px" }}>الألوان المتاحة</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "8px" }}>
                {form.colors.map((c) => (
                  <span key={c} style={{ display: "flex", alignItems: "center", gap: "4px", background: "#f4f4f5", borderRadius: "20px", padding: "4px 12px", fontSize: "13px" }}>
                    {c}
                    <button type="button" onClick={() => {
                      const imgs = { ...form.images }; delete imgs[c];
                      const vs = { ...form.variantStock }; delete vs[c];
                      setForm({ ...form, colors: form.colors.filter((x) => x !== c), images: imgs, variantStock: vs });
                    }} style={{ background: "none", border: "none", cursor: "pointer", color: "#ba1a1a", fontSize: "14px" }}>×</button>
                  </span>
                ))}
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <input value={newColor} onChange={(e) => setNewColor(e.target.value)} placeholder="إضافة لون" style={{ flex: 1, padding: "8px 12px", border: "1px solid #d4d4d8", borderRadius: "4px", fontSize: "14px" }} />
                <button type="button" onClick={addColor} style={{ background: "black", color: "white", border: "none", borderRadius: "4px", padding: "8px 16px", cursor: "pointer" }}>إضافة</button>
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "14px", fontWeight: 500, marginBottom: "6px" }}>المقاسات المتاحة</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "8px" }}>
                {form.sizes.map((s) => (
                  <span key={s} style={{ display: "flex", alignItems: "center", gap: "4px", background: "#f4f4f5", borderRadius: "20px", padding: "4px 12px", fontSize: "13px" }}>
                    {s}
                    <button type="button" onClick={() => {
                      const vs = { ...form.variantStock };
                      for (const c of Object.keys(vs)) {
                        const sizes = { ...vs[c] }; delete sizes[s]; vs[c] = sizes;
                      }
                      setForm({ ...form, sizes: form.sizes.filter((x) => x !== s), variantStock: vs });
                    }} style={{ background: "none", border: "none", cursor: "pointer", color: "#ba1a1a", fontSize: "14px" }}>×</button>
                  </span>
                ))}
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <input value={newSize} onChange={(e) => setNewSize(e.target.value)} placeholder="إضافة مقاس" style={{ flex: 1, padding: "8px 12px", border: "1px solid #d4d4d8", borderRadius: "4px", fontSize: "14px" }} />
                <button type="button" onClick={addSize} style={{ background: "black", color: "white", border: "none", borderRadius: "4px", padding: "8px 16px", cursor: "pointer" }}>إضافة</button>
              </div>
            </div>
          </div>

          {message && <p style={{ textAlign: "center", color: message.includes("نجاح") ? "#006e2f" : "#ba1a1a", fontSize: "14px", margin: "0 0 16px" }}>{message}</p>}

          <button type="submit" disabled={saving} style={{ width: "100%", padding: "12px", background: "black", color: "white", border: "none", borderRadius: "4px", fontSize: "16px", fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
            {saving ? "جاري الحفظ..." : "💾 حفظ التغييرات"}
          </button>
        </form>
      </div>
    </div>
  );
}
