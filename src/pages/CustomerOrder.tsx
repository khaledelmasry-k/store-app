import { useState, useEffect, FormEvent } from "preact/compat";
import { api } from "../services/api";
import type { Product } from "../types";

const GOVERNORATES = [
  "القاهرة", "الجيزة", "الإسكندرية", "الدقهلية", "الشرقية",
  "القليوبية", "الغربية", "المنوفية", "البحيرة", "كفر الشيخ",
  "دمياط", "بورسعيد", "الإسماعيلية", "السويس", "شمال سيناء",
  "جنوب سيناء", "بني سويف", "الفيوم", "المنيا", "أسيوط",
  "سوهاج", "قنا", "الأقصر", "أسوان", "البحر الأحمر",
  "الوادي الجديد", "مطروح",
];

const CITIES_BY_GOV: Record<string, string[]> = {
  "القاهرة": ["العباسية", "مدينة نصر", "المعادي", "المهندسين", "الزمالك", "مصر الجديدة", "شبرا", "روض الفرج", "المرج", "حلوان"],
  "الجيزة": ["الدقي", "العجوزة", "الهرم", "فيصل", "مدينة 6 أكتوبر", "الشيخ زايد", "أمبابة", "بولاق الدكرور", "الوراق"],
  "الإسكندرية": ["سيدي بشر", "محرم بك", "المنتزه", "العصافرة", "السيوف", "كفر عبده", "ستانلي", "الأنفوشي", "ميامي"],
  "الدقهلية": ["المنصورة", "طلخا", "ميت غمر", "دكرنس", "السنبلاوين", "بلقاس", "نبروه", "منية النصر"],
  "الشرقية": ["الزقازيق", "العاشر من رمضان", "بلبيس", "أبو كبير", "فاقوس", "منيا القمح", "ههيا", "الإبراهيمية"],
  "القليوبية": ["شبرا الخيمة", "بنها", "قليوب", "طوخ", "الخانكة", "القناطر الخيرية", "كفر شكر"],
  "الغربية": ["طنطا", "المحلة الكبرى", "كفر الزيات", "زفتى", "السنطة", "بسيون", "سمنود"],
  "المنوفية": ["شبين الكوم", "منوف", "أشمون", "الباجور", "قويسنا", "بركة السبع", "تلا", "الشهداء"],
  "البحيرة": ["دمنهور", "كفر الدوار", "رشيد", "إدكو", "أبو المطامير", "وادي النطرون", "حوش عيسى", "الدلنجات"],
  "كفر الشيخ": ["كفر الشيخ", "دسوق", "بيلا", "قلين", "الرياض", "سيدي سالم", "الحامول", "مطوبس"],
  "دمياط": ["دمياط", "رأس البر", "فارسكور", "الزرقا", "كفر سعد", "دمياط الجديدة"],
  "بورسعيد": ["بورسعيد", "بورفؤاد", "الضواحي", "جنوب بورسعيد"],
  "الإسماعيلية": ["الإسماعيلية", "فايد", "القصاصين", "التل الكبير", "أبو صوير", "القنطرة شرق"],
  "السويس": ["السويس", "عتاقة", "فيصل", "الأربعين", "الجناين"],
  "شمال سيناء": ["العريش", "رفح", "الشيخ زويد", "بئر العبد", "نخل"],
  "جنوب سيناء": ["شرم الشيخ", "دهب", "نويبع", "طور سيناء", "سانت كاترين", "طابا"],
  "بني سويف": ["بني سويف", "الواسطى", "ناصر", "الفشن", "سمسطا", "ببا", "اهناسيا"],
  "الفيوم": ["الفيوم", "سنورس", "طامية", "إطسا", "أبشواي", "يوسف الصديق"],
  "المنيا": ["المنيا", "مغاغة", "بني مزار", "مطاي", "سمالوط", "أبو قرقاص", "ملوي", "دير مواس"],
  "أسيوط": ["أسيوط", "منفلوط", "القوصية", "ديروط", "أبو تيج", "صدفا", "الغنايم", "ساحل سليم"],
  "سوهاج": ["سوهاج", "أخميم", "طهطا", "جرجا", "البلينا", "دار السلام", "المراغة", "ساقلتة"],
  "قنا": ["قنا", "نجع حمادي", "قوص", "دشنا", "أبو تشت", "فرشوط", "نقادة"],
  "الأقصر": ["الأقصر", "البياضية", "الطود", "الزينية", "أرمنت", "إسنا"],
  "أسوان": ["أسوان", "دراو", "كوم أمبو", "إدفو", "نصر النوبة", "سبعة"],
  "البحر الأحمر": ["الغردقة", "سفاجا", "القصير", "مرسى علم", "الشلاتين", "رأس غارب"],
  "الوادي الجديد": ["الخارجة", "الداخلة", "باريس", "بلاط", "الفرافرة"],
  "مطروح": ["مرسى مطروح", "الضبعة", "العلمين", "الحمام", "سيوة", "النجيلة", "براني"],
};

function getTotalPrice(qty: number, tiers: Record<string, number>): number {
  const DEFAULT_TIERS: Record<number, number> = { 1: 500, 2: 900, 3: 1200, 4: 1400 };
  const t: Record<number, number> = {};
  Object.entries(tiers).forEach(([k, v]) => { t[Number(k)] = v; });
  const active = Object.keys(t).length ? t : DEFAULT_TIERS;
  if (qty >= 4 && active[4]) return active[4] + (qty - 4) * Math.round(active[4] / 4);
  return active[qty] || qty * (active[1] || DEFAULT_TIERS[1]);
}

interface CartItem {
  color: string;
  size: string;
  quantity: number;
}

export default function CustomerOrder() {
  const [product, setProduct] = useState<Product | null>(null);
  const [cart, setCart] = useState<CartItem[]>([{ color: "", size: "", quantity: 1 }]);
  const [submitted, setSubmitted] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [totalPrice, setTotalPrice] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    customerName: "",
    phone: "",
    governorate: "",
    city: "",
    address: "",
    notes: "",
  });

  const ref = new URLSearchParams(window.location.search).get("ref") || "";
  const refName = ref === "1" ? "بنطلون الساحل" : ref === "2" ? "مالك ستور" : ref ? `المتجر ${ref}` : "";

  useEffect(() => {
    api.get<Product>("/orders/product").then((p) => {
      setProduct(p);
      setCart([{ color: p.colors[0] || "", size: p.sizes[0] || "", quantity: 1 }]);
    }).catch(() => {});
  }, []);

  const colors = product?.colors || ["أسود", "بيج", "زيتي", "أبيض"];
  const sizes = product?.sizes || ["L", "XL", "XXL"];
  const vs = product?.variantStock || {};

  const totalQty = cart.reduce((sum, i) => sum + i.quantity, 0);
  const total = getTotalPrice(totalQty, product?.pricingTiers || {});

  const getAvailable = (color: string, size: string) => vs[color]?.[size] ?? 0;

  const updateItem = (idx: number, field: keyof CartItem, value: string | number) => {
    setCart((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value as never };
      if (field === "color" && !next[idx].size) next[idx].size = sizes[0] || "";
      return next;
    });
  };

  const addItem = () => {
    setCart((prev) => [...prev, { color: colors[0] || "", size: sizes[0] || "", quantity: 1 }]);
  };

  const removeItem = (idx: number) => {
    setCart((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await api.post<{ orderNumber: string; totalPrice: number }>("/orders", {
        ...form,
        ref,
        items: cart.map((item) => ({
          color: item.color,
          size: item.size,
          quantity: item.quantity,
        })),
      });
      setOrderNumber(result.orderNumber);
      setTotalPrice(result.totalPrice);
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || "حدث خطأ");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div style={{ fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif", direction: "rtl", background: "#fbf8ff", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
        <div style={{ textAlign: "center", background: "white", padding: "40px 24px", borderRadius: "8px", maxWidth: "400px", width: "100%", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.05)" }}>
          <div style={{ color: "#006e2f", fontSize: "48px", marginBottom: "16px" }}>✓</div>
          <h2 style={{ margin: "0 0 12px", fontSize: "24px", fontWeight: 600 }}>تم استلام طلبك بنجاح!</h2>
          <p style={{ color: "#4c4546", fontSize: "16px", lineHeight: 1.6, margin: "0 0 16px" }}>
            شكرًا لثقتك بنا. سيتم التواصل معك من قبل فريق التوصيل خلال الساعات القادمة. عند استلام المنتج، لك حق معاينته؛ إذا أعجبك تستلمه مجاناً، وإن رفضت تدفع قيمة الشحن فقط.
          </p>
          <p style={{ fontSize: "18px", fontWeight: 600, margin: "0" }}>رقم الطلب: {orderNumber}</p>
          <p style={{ fontSize: "16px", color: "#006e2f", fontWeight: 600, margin: "8px 0 24px" }}>الإجمالي: {totalPrice.toLocaleString()} ج.م</p>
          {ref && <p style={{ fontSize: "13px", color: "#71717a", margin: "0 0 16px" }}>المتجر: {refName}</p>}
          <button onClick={() => window.location.reload()} style={{ background: "black", color: "white", border: "none", borderRadius: "4px", padding: "12px 32px", fontSize: "16px", fontWeight: 600, cursor: "pointer" }}>
            العودة للمتجر
          </button>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div style={{ fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif", direction: "rtl", background: "#fbf8ff", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p>جاري تحميل المنتج...</p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif", direction: "rtl", background: "#fbf8ff", minHeight: "100vh" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px", background: "white", borderBottom: "1px solid #e4e4e7" }}>
        <h1 style={{ fontSize: "18px", fontWeight: 600, margin: 0 }}>{product.name}</h1>
      </header>

      <main style={{ maxWidth: "520px", margin: "0 auto", padding: "16px" }}>
        <div style={{ background: "white", borderRadius: "8px", overflow: "hidden", marginBottom: "16px" }}>
          <div className="product-image-wrap" style={{ background: "#f4f4f5", height: "240px", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            {product.images?.[cart[0]?.color] ? (
              <img src={product.images[cart[0].color]} alt={cart[0].color} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span style={{ fontSize: "48px" }}>👖</span>
            )}
          </div>
          <div style={{ padding: "16px" }}>
            <h2 style={{ fontSize: "22px", fontWeight: 600, margin: "0 0 8px" }}>{product.name}</h2>
            <p style={{ color: "#4c4546", fontSize: "14px", lineHeight: 1.6, margin: 0 }}>{product.description}</p>
          </div>
        </div>

        <div style={{ background: "white", borderRadius: "8px", padding: "16px", marginBottom: "16px" }}>
          <h3 style={{ fontSize: "16px", fontWeight: 600, margin: "0 0 12px" }}>💰 الأسعار (شامل الشحن)</h3>
          {[1, 2, 3, 4].map((qty) => (
            <div key={qty} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "10px 12px", marginBottom: "8px", borderRadius: "6px",
              border: "1px solid #e4e4e7",
            }}>
              <span style={{ fontSize: "14px" }}>{qty} {qty === 1 ? "قطعة" : "قطع"}</span>
              <span style={{ fontWeight: 700, fontSize: "16px" }}>
                {getTotalPrice(qty, product?.pricingTiers || {}).toLocaleString()} ج.م
                <span style={{ fontWeight: 400, fontSize: "12px", color: "#71717a", marginRight: "8px" }}>
                  ({Math.round(getTotalPrice(qty, product?.pricingTiers || {}) / qty)} ج.م/القطعة)
                </span>
              </span>
            </div>
          ))}
        </div>

        <div style={{ background: "white", borderRadius: "8px", padding: "16px", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 0", borderBottom: "1px solid #f4f4f5" }}>
            <span style={{ color: "#006e2f" }}>✓</span>
            <span style={{ fontSize: "14px" }}>اقمشة فرنساوي طبيعي 100%</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 0", borderBottom: "1px solid #f4f4f5" }}>
            <span style={{ color: "#006e2f" }}>✓</span>
            <span style={{ fontSize: "14px" }}>خامة فاخرة تتحمل الاستخدام اليومي</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 0", borderBottom: "1px solid #f4f4f5" }}>
            <span style={{ color: "#006e2f" }}>✓</span>
            <span style={{ fontSize: "14px" }}>قصة عصرية عالية الخصر مع كسرات أمامية أنيقة</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 0" }}>
            <span style={{ color: "#006e2f" }}>✓</span>
            <span style={{ fontSize: "14px" }}>معاينة المنتج عند الاستلام - لك حق الإرجاع</span>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ background: "white", borderRadius: "8px", padding: "16px", marginBottom: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 600, margin: 0 }}>🛒 المنتجات المطلوبة</h3>
              <button type="button" onClick={addItem} style={{ background: "black", color: "white", border: "none", borderRadius: "4px", padding: "6px 14px", fontSize: "13px", cursor: "pointer" }}>
                + إضافة منتج
              </button>
            </div>

            {cart.map((item, idx) => {
              const avail = item.color && item.size ? getAvailable(item.color, item.size) : 0;
              const outOfStock = avail === 0;
              return (
                <div key={idx} style={{
                  padding: "12px", marginBottom: "10px", border: "1px solid #e4e4e7", borderRadius: "6px",
                  opacity: outOfStock ? 0.6 : 1,
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                    <span style={{ fontSize: "13px", color: "#71717a" }}>المنتج {idx + 1}</span>
                    {cart.length > 1 && (
                      <button type="button" onClick={() => removeItem(idx)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ba1a1a", fontSize: "18px" }}>×</button>
                    )}
                  </div>
                  <div className="cart-item-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 80px", gap: "8px", alignItems: "center" }}>
                    <select value={item.color} onChange={(e) => updateItem(idx, "color", e.target.value)} style={{ padding: "8px", border: "1px solid #d4d4d8", borderRadius: "4px", fontSize: "13px", background: "white" }}>
                      <option value="">اختر اللون</option>
                      {colors.map((c) => {
                        const cStock = sizes.reduce((s, sz) => s + (getAvailable(c, sz)), 0);
                        return (
                          <option key={c} value={c} disabled={cStock === 0}>{c}{cStock === 0 ? " (نفد)" : ""}</option>
                        );
                      })}
                    </select>
                    <select value={item.size} onChange={(e) => updateItem(idx, "size", e.target.value)} style={{ padding: "8px", border: "1px solid #d4d4d8", borderRadius: "4px", fontSize: "13px", background: "white" }}>
                      <option value="">اختر المقاس</option>
                      {sizes.map((s) => {
                        const sStock = getAvailable(item.color, s);
                        return (
                          <option key={s} value={s} disabled={sStock === 0}>{s}{sStock === 0 ? " (نفد)" : ""}</option>
                        );
                      })}
                    </select>
                    <input type="number" value={item.quantity} onChange={(e) => {
                      const val = Math.max(1, parseInt(e.target.value) || 1);
                      const max = getAvailable(item.color, item.size);
                      updateItem(idx, "quantity", max > 0 ? Math.min(val, max) : 1);
                    }} min={1} max={avail || 1} style={{ width: "100%", padding: "8px", border: "1px solid #d4d4d8", borderRadius: "4px", fontSize: "13px", textAlign: "center", boxSizing: "border-box" }} />
                  </div>
                  {item.color && item.size && (
                    <div style={{ fontSize: "12px", color: outOfStock ? "#ba1a1a" : "#006e2f", marginTop: "6px" }}>
                      {outOfStock ? "غير متوفر في المخزون" : `المتبقي: ${avail} قطعة`}
                    </div>
                  )}
                </div>
              );
            })}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderTop: "1px solid #e4e4e7" }}>
              <span style={{ fontWeight: 600, fontSize: "14px" }}>إجمالي القطع: {totalQty}</span>
              <span style={{ fontSize: "22px", fontWeight: 700, color: "#006e2f" }}>{total.toLocaleString()} ج.م</span>
            </div>
          </div>

          <div style={{ background: "white", borderRadius: "8px", padding: "16px", marginBottom: "16px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 600, margin: "0 0 12px" }}>معلومات التوصيل</h3>

            {(["customerName", "phone", "address"] as const).map((field) => (
              <div key={field} style={{ marginBottom: "12px" }}>
                <label htmlFor={field} style={{ display: "block", fontSize: "14px", fontWeight: 500, marginBottom: "6px" }}>
                  {field === "customerName" ? "الاسم الكامل" : field === "phone" ? "رقم الجوال" : "العنوان الكامل"}
                </label>
                <input id={field} name={field} type={field === "phone" ? "tel" : "text"} value={form[field]} onChange={(e) => setForm({ ...form, [field]: e.target.value })} required style={{ width: "100%", padding: "10px 12px", border: "1px solid #d4d4d8", borderRadius: "4px", fontSize: "14px", boxSizing: "border-box" }} />
              </div>
            ))}

            <div style={{ marginBottom: "12px" }}>
              <label htmlFor="governorate" style={{ display: "block", fontSize: "14px", fontWeight: 500, marginBottom: "6px" }}>المحافظة</label>
              <select id="governorate" name="governorate" value={form.governorate} onChange={(e) => setForm({ ...form, governorate: e.target.value, city: "" })} required style={{ width: "100%", padding: "10px 12px", border: "1px solid #d4d4d8", borderRadius: "4px", fontSize: "14px", background: "white", boxSizing: "border-box" }}>
                <option value="">اختر المحافظة</option>
                {GOVERNORATES.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label htmlFor="city" style={{ display: "block", fontSize: "14px", fontWeight: 500, marginBottom: "6px" }}>المدينة</label>
              <select id="city" name="city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required disabled={!form.governorate} style={{ width: "100%", padding: "10px 12px", border: "1px solid #d4d4d8", borderRadius: "4px", fontSize: "14px", background: "white", boxSizing: "border-box", opacity: form.governorate ? 1 : 0.5 }}>
                <option value="">اختر المدينة</option>
                {(CITIES_BY_GOV[form.governorate] || []).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label htmlFor="notes" style={{ display: "block", fontSize: "14px", fontWeight: 500, marginBottom: "6px" }}>ملاحظات إضافية (اختياري)</label>
              <textarea id="notes" name="notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} style={{ width: "100%", padding: "10px 12px", border: "1px solid #d4d4d8", borderRadius: "4px", fontSize: "14px", resize: "vertical", boxSizing: "border-box" }} />
            </div>
          </div>

          <div style={{ background: "#f0fdf4", borderRadius: "8px", padding: "12px 16px", marginBottom: "16px" }}>
            <p style={{ margin: 0, fontSize: "13px", lineHeight: 1.6 }}>
              <strong>سياسة الاستلام:</strong> عند وصول المنتج، لك الحق في معاينته. إذا أعجبك تستلمه مجاناً (الشحن علينا). إذا رفضت، تدفع قيمة الشحن فقط.
            </p>
          </div>

          {error && <p style={{ color: "#ba1a1a", textAlign: "center", fontSize: "14px" }}>{error}</p>}

          <button type="submit" disabled={loading} style={{ width: "100%", padding: "14px", background: "#006e2f", color: "white", border: "none", borderRadius: "4px", fontSize: "16px", fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}>
            {loading ? "جاري المعالجة..." : `تأكيد الطلب - ${total.toLocaleString()} ج.م`}
          </button>

          <p style={{ textAlign: "center", fontSize: "13px", color: "#71717a", marginTop: "8px" }}>
            ✓ دفع عند الاستلام مع إمكانية المعاينة
          </p>
        </form>
      </main>
    </div>
  );
}
