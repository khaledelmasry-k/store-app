import { useState, useEffect, useRef } from "preact/compat";
import { api, API_BASE, getImageUrl } from "../services/api";
import Sidebar from "../components/Sidebar";
import type { Product } from "../types";

interface ProductListResponse {
  products: Product[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

function parseJson<T>(val: string | undefined | null, fallback: T): T {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}

export default function MerchantProducts() {
  const [data, setData] = useState<ProductListResponse | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadingColor, setUploadingColor] = useState("");
  const limit = 10;

  const [form, setForm] = useState({
    name: "", description: "", price: 0, oldPrice: 0, sku: "", active: true,
    colors: [] as string[], sizes: [] as string[],
    variantStock: {} as Record<string, Record<string, number>>,
    pricingTiers: {} as Record<string, number>,
    images: {} as Record<string, string>,
  });
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([]);

  const [newColor, setNewColor] = useState("");
  const [newSize, setNewSize] = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const fetchProducts = () => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.set("search", search);
    api.get<ProductListResponse>(`/merchant/products?${params}`).then(setData).catch(() => {});
  };

  useEffect(() => { fetchProducts(); }, [page]);

  const handleSearch = (e: Event) => { e.preventDefault(); setPage(1); fetchProducts(); };

  const openNew = () => {
    setEditId(null);
    setForm({ name: "", description: "", price: 0, oldPrice: 0, sku: "", active: true, colors: [], sizes: [], variantStock: {}, pricingTiers: {}, images: {} });
    setShowForm(true);
  };

  const openEdit = (p: Product) => {
    setEditId(p.id);
    setForm({
      name: p.name, description: p.description, price: p.price, oldPrice: p.oldPrice || 0, sku: (p as any).sku || "", active: p.active,
      colors: parseJson<string[]>(p.colors as any, []),
      sizes: parseJson<string[]>(p.sizes as any, []),
      variantStock: parseJson<Record<string, Record<string, number>>>(p.variantStock as any, {}),
      pricingTiers: parseJson<Record<string, number>>(p.pricingTiers as any, {}),
      images: parseJson<Record<string, string>>(p.images as any, {}),
    });
    setShowForm(true);
  };

  const addColor = () => {
    if (newColor && !form.colors.includes(newColor)) {
      setForm({ ...form, colors: [...form.colors, newColor], variantStock: { ...form.variantStock, [newColor]: {} } });
      setNewColor("");
    }
  };

  const removeColor = (color: string) => {
    const { [color]: _, ...rest } = form.variantStock;
    setForm({ ...form, colors: form.colors.filter((c) => c !== color), variantStock: rest });
  };

  const addSize = () => {
    if (newSize && !form.sizes.includes(newSize)) {
      setForm({ ...form, sizes: [...form.sizes, newSize] });
      setNewSize("");
    }
  };

  const removeSize = (size: string) => {
    const newStock: Record<string, Record<string, number>> = {};
    for (const [color, sizes] of Object.entries(form.variantStock)) {
      const { [size]: _, ...rest } = sizes;
      newStock[color] = rest;
    }
    setForm({ ...form, sizes: form.sizes.filter((s) => s !== size), variantStock: newStock });
  };

  const updateStock = (color: string, size: string, val: number) => {
    setForm({ ...form, variantStock: { ...form.variantStock, [color]: { ...form.variantStock[color], [size]: val } } });
  };

  const uploadImage = async (color: string, file: File) => {
    setUploadingColor(color);
    const fd = new FormData();
    fd.append("image", file);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/admin/upload`, {
        method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body: fd,
      });
      if (!res.ok) throw new Error("Upload failed");
      const result = await res.json();
      setForm({ ...form, images: { ...form.images, [color]: result.url } });
      showToast("تم رفع الصورة");
    } catch { showToast("فشل رفع الصورة"); }
    finally { setUploadingColor(""); }
  };

  const save = async () => {
    const body = {
      name: form.name, description: form.description, price: form.price,
      oldPrice: form.oldPrice || null, sku: form.sku || null, active: form.active,
      colors: form.colors, sizes: form.sizes,
      variantStock: form.variantStock,
      pricingTiers: form.pricingTiers,
      images: form.images,
    };
    if (editId) {
      await api.put(`/merchant/products/${editId}`, body);
    } else {
      await api.post("/merchant/products", body);
    }
    setShowForm(false);
    fetchProducts();
  };

  const remove = async (id: string) => {
    if (!window.confirm("هل أنت متأكد من حذف هذا المنتج؟")) return;
    await api.delete(`/merchant/products/${id}`);
    fetchProducts();
  };

  const duplicate = async (id: string) => {
    await api.post(`/merchant/products/${id}/duplicate`, {});
    fetchProducts();
  };

  useEffect(() => {
    api.get<{ products: any[] }>("/merchant/products/low-stock?threshold=5")
      .then((r) => setLowStockProducts(r.products)).catch(() => {});
  }, [data]);

  const isLowStock = (stock: number, p: any) => stock > 0 && stock <= 5;
  const totalPages = data?.pagination?.totalPages || 1;

  return (
    <div style={{ background: "#EAEDED", minHeight: "100vh", display: "flex" }}>
      <Sidebar />
      <div className="admin-content" style={{ flex: 1, padding: "24px", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <header style={{ marginBottom: "24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "24px", fontWeight: 600, color: "#0F1111", margin: 0 }}>المنتجات</h2>
            <p style={{ fontSize: "14px", color: "#565959", margin: "4px 0 0" }}>{data?.pagination?.total || 0} منتج</p>
          </div>
          <button onClick={openNew} style={{ background: "#FF9900", border: "none", borderRadius: "8px", padding: "10px 20px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", fontSize: "14px" }}>
            <span class="material-symbols-outlined" style={{ fontSize: "20px" }}>add</span>
            إضافة منتج
          </button>
        </header>

        {toast && (
          <div style={{ position: "fixed", top: "80px", left: "50%", transform: "translateX(-50%)", zIndex: 1000, background: "#067D62", color: "#fff", padding: "12px 24px", borderRadius: "8px", fontWeight: 600, fontSize: "14px" }}>
            {toast}
          </div>
        )}

        {showForm && (
          <section style={{ background: "#fff", padding: "24px", borderRadius: "8px", border: "1px solid #DDDDDD", marginBottom: "24px" }}>
            <h3 style={{ margin: "0 0 16px", fontWeight: 700 }}>{editId ? "تعديل منتج" : "إضافة منتج جديد"}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "12px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "13px", fontWeight: 600 }}>اسم المنتج</label>
                  <input type="text" className="amazon-input" value={form.name} onChange={(e) => setForm({ ...form, name: (e.target as HTMLInputElement).value })} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "13px", fontWeight: 600 }}>السعر (ج.م)</label>
                  <input type="number" className="amazon-input" value={form.price} onChange={(e) => setForm({ ...form, price: parseFloat((e.target as HTMLInputElement).value) || 0 })} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "13px", fontWeight: 600 }}>السعر القديم (ج.م)</label>
                  <input type="number" className="amazon-input" value={form.oldPrice} onChange={(e) => setForm({ ...form, oldPrice: parseFloat((e.target as HTMLInputElement).value) || 0 })} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "13px", fontWeight: 600 }}>SKU (كود المنتج)</label>
                  <input type="text" className="amazon-input" value={form.sku} placeholder="اختياري" onChange={(e) => setForm({ ...form, sku: (e.target as HTMLInputElement).value })} />
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "13px", fontWeight: 600 }}>الوصف</label>
                <textarea className="amazon-input" value={form.description} onChange={(e) => setForm({ ...form, description: (e.target as HTMLTextAreaElement).value })} rows={3} />
              </div>

              <div>
                <label style={{ fontSize: "13px", fontWeight: 600, display: "block", marginBottom: "4px" }}>الألوان</label>
                <div style={{ display: "flex", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
                  {form.colors.map((c) => (
                    <span key={c} style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "4px 10px", background: "#F6F8F8", borderRadius: "4px", fontSize: "13px", border: "1px solid #DDDDDD" }}>
                      {c}
                      <span onClick={() => removeColor(c)} style={{ cursor: "pointer", color: "#B12704", fontSize: "14px" }}>&times;</span>
                    </span>
                  ))}
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input type="text" className="amazon-input" value={newColor} placeholder="إضافة لون" style={{ width: "150px" }}
                    onChange={(e) => setNewColor((e.target as HTMLInputElement).value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addColor(); } }} />
                  <button onClick={addColor} style={{ padding: "8px 16px", background: "#FF9900", border: "none", borderRadius: "6px", fontWeight: 600, cursor: "pointer", fontSize: "13px" }}>إضافة</button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: "13px", fontWeight: 600, display: "block", marginBottom: "4px" }}>المقاسات</label>
                <div style={{ display: "flex", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
                  {form.sizes.map((s) => (
                    <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "4px 10px", background: "#F6F8F8", borderRadius: "4px", fontSize: "13px", border: "1px solid #DDDDDD" }}>
                      {s}
                      <span onClick={() => removeSize(s)} style={{ cursor: "pointer", color: "#B12704", fontSize: "14px" }}>&times;</span>
                    </span>
                  ))}
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input type="text" className="amazon-input" value={newSize} placeholder="إضافة مقاس" style={{ width: "150px" }}
                    onChange={(e) => setNewSize((e.target as HTMLInputElement).value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSize(); } }} />
                  <button onClick={addSize} style={{ padding: "8px 16px", background: "#FF9900", border: "none", borderRadius: "6px", fontWeight: 600, cursor: "pointer", fontSize: "13px" }}>إضافة</button>
                </div>
              </div>

              {form.colors.length > 0 && form.sizes.length > 0 && (
                <div>
                  <label style={{ fontSize: "13px", fontWeight: 600, display: "block", marginBottom: "4px" }}>المخزون (اللون × المقاس)</label>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ borderCollapse: "collapse", fontSize: "13px" }}>
                      <thead>
                        <tr>
                          <th style={{ padding: "6px 12px", border: "1px solid #DDDDDD", background: "#F6F8F8" }}>اللون / المقاس</th>
                          {form.sizes.map((s) => <th key={s} style={{ padding: "6px 12px", border: "1px solid #DDDDDD", background: "#F6F8F8" }}>{s}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {form.colors.map((c) => (
                          <tr key={c}>
                            <td style={{ padding: "6px 12px", border: "1px solid #DDDDDD", fontWeight: 600 }}>{c}</td>
                            {form.sizes.map((s) => (
                              <td key={s} style={{ padding: "4px", border: "1px solid #DDDDDD" }}>
                                <input type="number" min="0" value={form.variantStock[c]?.[s] ?? 0}
                                  onChange={(e) => updateStock(c, s, parseInt((e.target as HTMLInputElement).value) || 0)}
                                  style={{ width: "60px", padding: "6px", border: "1px solid #DDDDDD", borderRadius: "4px", textAlign: "center" }} />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div>
                <label style={{ fontSize: "13px", fontWeight: 600, display: "block", marginBottom: "4px" }}>التسعير الكمي (الخصم عند الكمية)</label>
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                  {[1, 2, 3, 4].map((qty) => (
                    <div key={qty} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <span style={{ fontSize: "13px" }}>{qty} قطع:</span>
                      <input type="number" className="amazon-input" value={form.pricingTiers[qty] ?? ""} placeholder="500"
                        onChange={(e) => setForm({ ...form, pricingTiers: { ...form.pricingTiers, [qty]: parseFloat((e.target as HTMLInputElement).value) || 0 } })}
                        style={{ width: "80px" }} />
                    </div>
                  ))}
                </div>
              </div>

              {form.colors.length > 0 && (
                <div>
                  <label style={{ fontSize: "13px", fontWeight: 600, display: "block", marginBottom: "4px" }}>صور المنتج (حسب اللون)</label>
                  <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                    {form.colors.map((c) => (
                      <div key={c} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                        <div style={{ width: "80px", height: "80px", borderRadius: "8px", border: "1px solid #DDDDDD", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", background: "#F6F8F8" }}>
                          {form.images[c] ? <img src={getImageUrl(form.images[c])} alt={c} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: "11px", color: "#999" }}>{c}</span>}
                        </div>
                        <button onClick={() => { setUploadingColor(c); fileRef.current?.click(); }} disabled={!!uploadingColor}
                          style={{ padding: "4px 12px", background: uploadingColor === c ? "#ccc" : "#FF9900", border: "none", borderRadius: "4px", fontSize: "11px", fontWeight: 600, cursor: uploadingColor === c ? "not-allowed" : "pointer" }}>
                          {uploadingColor === c ? "..." : "رفع"}
                        </button>
                      </div>
                    ))}
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
                    onChange={(e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f && uploadingColor) { uploadImage(uploadingColor, f); (e.target as HTMLInputElement).value = ""; } }} />
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input type="checkbox" id="prod-active" checked={form.active} onChange={(e) => setForm({ ...form, active: (e.target as HTMLInputElement).checked })} />
                <label for="prod-active" style={{ fontSize: "13px" }}>المنتج نشط</label>
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

{lowStockProducts.length > 0 && (
  <div style={{ background: "#FEF3C7", borderRadius: "8px", padding: "16px", marginBottom: "16px", border: "1px solid #FBBF24", display: "flex", alignItems: "center", gap: "12px" }}>
    <span class="material-symbols-outlined" style={{ color: "#D97706" }}>inventory_2</span>
    <div>
      <span style={{ fontWeight: 700, fontSize: "14px", color: "#92400E" }}>مخزون منخفض: </span>
      <span style={{ fontSize: "13px", color: "#92400E" }}>{lowStockProducts.length} منتجات تحتاج لإعادة تموين</span>
    </div>
  </div>
)}

        <section style={{ background: "#fff", borderRadius: "8px", border: "1px solid #DDDDDD", overflow: "hidden", flex: 1 }}>
          <form onSubmit={handleSearch} style={{ padding: "16px", borderBottom: "1px solid #EAEDED", display: "flex", gap: "12px" }}>
            <input type="text" placeholder="بحث..." className="amazon-input" style={{ flex: 1 }}
              value={search} onChange={(e) => setSearch((e.target as HTMLInputElement).value)} />
            <button type="submit" style={{ background: "#FF9900", border: "none", borderRadius: "6px", padding: "8px 16px", fontWeight: 700, cursor: "pointer" }}>بحث</button>
          </form>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
              <thead>
                <tr style={{ background: "#f4f4f5", color: "#555", fontWeight: 600 }}>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>الاسم</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>SKU</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>السعر</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>المخزون</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>الحالة</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>آخر تحديث</th>
                  <th style={{ padding: "12px 16px", textAlign: "center" }}>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {data?.products.map((p) => (
                  <tr key={p.id} style={{ borderBottom: "1px solid #EAEDED" }}>
                    <td style={{ padding: "16px", fontWeight: 700 }}>{p.name}</td>
                    <td style={{ padding: "16px", fontSize: "12px", color: "#565959", fontFamily: "monospace" }}>{p.sku || "—"}</td>
                    <td style={{ padding: "16px" }}>{p.price.toLocaleString()} ج.م</td>
                    <td style={{ padding: "16px" }}>
                      {p.stock > 0 && p.stock <= 5 ? (
                        <span style={{ padding: "4px 8px", borderRadius: "4px", fontSize: "12px", fontWeight: 700, background: "#FEF3C7", color: "#92400E" }}>
                          {p.stock} (منخفض)
                        </span>
                      ) : (
                        <span>{p.stock}</span>
                      )}
                    </td>
                    <td style={{ padding: "16px" }}>
                      <span style={{
                        padding: "4px 10px", borderRadius: "4px", fontSize: "12px", fontWeight: 700,
                        background: p.active ? "#ECFDF5" : "#FEF2F2", color: p.active ? "#067D62" : "#B12704",
                      }}>{p.active ? "نشط" : "غير نشط"}</span>
                    </td>
                    <td style={{ padding: "16px", color: "#565959", fontSize: "13px" }}>{new Date(p.updatedAt).toLocaleDateString("en-CA")}</td>
                    <td style={{ padding: "16px", textAlign: "center" }}>
                      <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                        <button onClick={() => openEdit(p)} style={{ background: "none", border: "1px solid #DDDDDD", borderRadius: "6px", padding: "6px 10px", cursor: "pointer" }}>
                          <span class="material-symbols-outlined" style={{ fontSize: "16px", verticalAlign: "middle" }}>edit</span>
                        </button>
                        <button onClick={() => duplicate(p.id)} style={{ background: "none", border: "1px solid #DDDDDD", borderRadius: "6px", padding: "6px 10px", cursor: "pointer" }}>
                          <span class="material-symbols-outlined" style={{ fontSize: "16px", verticalAlign: "middle" }}>content_copy</span>
                        </button>
                        <button onClick={() => remove(p.id)} style={{ background: "none", border: "1px solid #B12704", borderRadius: "6px", padding: "6px 10px", cursor: "pointer", color: "#B12704" }}>
                          <span class="material-symbols-outlined" style={{ fontSize: "16px", verticalAlign: "middle" }}>delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {(!data?.products || data.products.length === 0) && (
                  <tr><td colSpan={7} style={{ padding: "48px", textAlign: "center", color: "#565959" }}>لا توجد منتجات</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div style={{ padding: "16px", display: "flex", justifyContent: "center", gap: "8px", borderTop: "1px solid #EAEDED" }}>
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} style={{ padding: "8px 16px", borderRadius: "6px", border: "1px solid #DDDDDD", background: "#fff", cursor: page <= 1 ? "not-allowed" : "pointer", opacity: page <= 1 ? 0.5 : 1 }}>
                السابق
              </button>
              <span style={{ padding: "8px 16px", fontSize: "14px", color: "#565959" }}>صفحة {page} من {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} style={{ padding: "8px 16px", borderRadius: "6px", border: "1px solid #DDDDDD", background: "#fff", cursor: page >= totalPages ? "not-allowed" : "pointer", opacity: page >= totalPages ? 0.5 : 1 }}>
                التالي
              </button>
            </div>
          )}
        </section>

        <footer style={{ marginTop: "auto", padding: "16px 0 0", textAlign: "center" }}>
          <p style={{ fontSize: "14px", color: "#565959", opacity: 0.8, margin: 0 }}>© 2025 M&K Store. جميع الحقوق محفوظة.</p>
        </footer>
      </div>
    </div>
  );
}
