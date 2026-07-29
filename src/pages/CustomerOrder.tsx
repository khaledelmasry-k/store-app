import { useState, useEffect } from "preact/compat";
import { api, getImageUrl } from "../services/api";
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
  Object.entries(tiers || {}).forEach(([k, v]) => { t[Number(k)] = v; });
  const active = Object.keys(t).length ? t : DEFAULT_TIERS;
  if (qty >= 4 && active[4]) return active[4] + (qty - 4) * Math.round(active[4] / 4);
  return active[qty] || qty * (active[1] || DEFAULT_TIERS[1]);
}

interface CartItem {
  color: string;
  size: string;
  quantity: number;
}

const FEATURES = [
  "كتان طبيعي 100% عالي الجودة",
  "مقاوم للتجعد وسهل الكي",
  "متوفر بمقاسات مختلفة وألوان جذابة",
  "شحن سريع خلال 48 ساعة",
];

export default function CustomerOrder() {
  const ref = new URLSearchParams(window.location.search).get("ref") || "";
  const [product, setProduct] = useState<Product | null>(null);
  const [cart, setCart] = useState<CartItem[]>([{ color: "", size: "", quantity: 1 }]);
  const [submitted, setSubmitted] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [totalPrice, setTotalPrice] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    customerName: "", phone: "", governorate: "", city: "", address: "", notes: "",
  });

  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref") || "";
    api.get<Product>(`/orders/product${ref ? `?ref=${ref}` : ""}`).then((p) => {
      setProduct(p);
      setCart([{ color: p.colors[0] || "", size: p.sizes[0] || "", quantity: 1 }]);
    }).catch(() => {});
  }, []);

  const colors = product?.colors || ["أسود", "بيج", "زيتي", "أبيض"];
  const sizes = product?.sizes || ["L", "XL", "XXL"];
  const vs = product?.variantStock || {};
  const pricingTiers = product?.pricingTiers || {};

const totalQty = cart.reduce((sum, i) => sum + i.quantity, 0);
const total = getTotalPrice(totalQty, pricingTiers);
const canSubmit = form.customerName && form.phone && form.governorate && form.city && form.address;

  const getAvailable = (color: string, size: string) => vs[color]?.[size] ?? 0;

  const updateItem = (idx: number, field: keyof CartItem, value: string | number) => {
    setCart((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value as never };
      if (field === "color" && !next[idx].size) next[idx].size = sizes[0] || "";
      return next;
    });
  };

  const addItem = () => setCart((prev) => [...prev, { color: colors[0] || "", size: sizes[0] || "", quantity: 1 }]);

  const handleSubmit = async () => {
    if (!form.customerName || !form.phone) return;
    setError("");
    setLoading(true);
    try {
      const result = await api.post<{ orderNumber: string; totalPrice: number }>("/orders", {
        ...form, ref,
        items: cart.map((item) => ({ color: item.color, size: item.size, quantity: item.quantity })),
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

  if (!product) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(255,255,255,0.9)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "16px" }}>
        <div style={{ width: "48px", height: "48px", border: "4px solid #FF9900", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }}></div>
        <p style={{ fontSize: "14px", color: "#595F68" }}>جاري تحميل المنتج...</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "#EAEDED", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
        <div style={{ background: "#fff", width: "100%", maxWidth: "400px", padding: "32px", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <span class="material-symbols-outlined" style={{ fontSize: "64px", color: "#067D62", marginBottom: "16px", fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "24px", fontWeight: 600, margin: "0 0 8px" }}>تم تقديم طلبك بنجاح!</h2>
          <p style={{ fontSize: "16px", color: "#595F68", margin: "0 0 24px" }}>شكراً لشرائك من M&K Store</p>
          <div style={{ width: "100%", borderTop: "1px solid #DDDDDD", borderBottom: "1px solid #DDDDDD", padding: "16px 0", marginBottom: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", fontWeight: 600 }}>
              <span>رقم الطلب:</span>
              <span style={{ color: "#0F1111" }}>#{orderNumber}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", fontWeight: 600, marginTop: "8px" }}>
              <span>الإجمالي:</span>
              <span style={{ color: "#FF9900", fontWeight: 700 }}>{totalPrice.toLocaleString()} ج.م</span>
            </div>
          </div>
          <button onClick={() => window.location.reload()}
            style={{ width: "100%", background: "#FF9900", height: "48px", borderRadius: "8px", fontWeight: 700, color: "#0F1111", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", fontSize: "16px" }}>
            العودة للمتجر
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "#EAEDED", color: "#0F1111", paddingBottom: "96px" }}>
      <header style={{ background: "#fff", height: "64px", display: "flex", alignItems: "center", padding: "0 16px", borderBottom: "1px solid #DDDDDD", position: "sticky", top: 0, zIndex: 40 }}>
        {(product as any)?.store?.logo && <img src={getImageUrl((product as any).store.logo)} alt="logo" style={{ height: "28px", marginLeft: "12px", borderRadius: "4px" }} />}
        <div>
          <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "20px", fontWeight: 700, color: (product as any)?.store?.primaryColor || "#FF9900", margin: 0 }}>{(product as any)?.store?.name || "M&K Store"}</h1>
          {(product as any)?.store?.tagLine && <span style={{ fontSize: "11px", color: "#565959", display: "block" }}>{(product as any).store.tagLine}</span>}
        </div>
      </header>

      <main style={{ display: "flex", flexDirection: "column", gap: "16px", paddingTop: "16px" }}>
        <section style={{ padding: "0 16px" }}>
          <div style={{ background: "#F4F4F5", borderRadius: "8px", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", height: "180px", position: "relative" }}>
            {product.images?.[cart[0]?.color] ? (
              <img src={getImageUrl(product.images[cart[0].color])} alt={cart[0].color} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <div style={{ fontSize: "64px", color: "#999" }}>👖</div>
            )}
            <div style={{ position: "absolute", bottom: "8px", right: "8px", background: "rgba(0,0,0,0.1)", padding: "4px 8px", borderRadius: "4px", fontSize: "12px" }}>👖</div>
          </div>
          <div style={{ background: "#fff", padding: "16px", marginTop: "8px", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "22px", lineHeight: 1.2, margin: "0 0 8px" }}>{product.name}</h2>
            <p style={{ fontSize: "14px", color: "#595F68", margin: 0 }}>{product.description}</p>
          </div>
        </section>

        <section style={{ padding: "0 16px" }}>
          <div style={{ background: "#fff", padding: "16px", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "20px", fontWeight: 600, margin: "0 0 16px", display: "flex", alignItems: "center", gap: "8px" }}>
              <span>💰</span> الأسعار
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {[1, 2, 3, 4].map((qty) => {
                const price = getTotalPrice(qty, pricingTiers);
                const isBest = qty === 4;
                const savings = qty === 4 ? getTotalPrice(1, pricingTiers) * 4 - price : 0;
                return (
                  <div key={qty} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "12px", border: `1px solid ${isBest ? "#FF9900" : "#DDDDDD"}`,
                    borderRadius: "8px", background: isBest ? "#FFF5E6" : "#fff",
                  }}>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontSize: "14px", fontWeight: isBest ? 700 : 400, color: isBest ? "#653A00" : "#0F1111" }}>
                        {qty} {qty === 1 ? "قطعة" : "قطع"}{isBest ? " (أفضل قيمة)" : ""}
                      </span>
                      {isBest && savings > 0 && <span style={{ fontSize: "10px", color: "#693C00" }}>وفر {savings.toLocaleString()} ج.م</span>}
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                      <span style={{ fontWeight: 700, fontSize: isBest ? "18px" : "16px", color: isBest ? "#FF9900" : "#0F1111" }}>
                        {price.toLocaleString()} ج.م
                      </span>
                      <span style={{ fontSize: "11px", color: "#999" }}>
                        ({(price / qty).toLocaleString()} ج.م/القطعة)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section style={{ padding: "0 16px" }}>
          <div style={{ background: "#fff", padding: "16px", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            {FEATURES.map((f, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px 0", borderBottom: i < FEATURES.length - 1 ? "1px solid #DDDDDD" : "none" }}>
                <span class="material-symbols-outlined" style={{ fontSize: "18px", color: "#067D62", fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                <span style={{ fontSize: "14px", fontWeight: 600 }}>{f}</span>
              </div>
            ))}
          </div>
        </section>

        <section style={{ padding: "0 16px" }}>
          <div style={{ background: "#fff", padding: "16px", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "20px", fontWeight: 600, margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                <span>🛒</span> المنتجات المطلوبة
              </h3>
              <button onClick={addItem} style={{ color: "#FF9900", fontSize: "14px", fontWeight: 600, border: "none", background: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", padding: "4px" }}>
                <span>➕</span> إضافة منتج
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {cart.map((item, idx) => {
                const avail = item.color && item.size ? getAvailable(item.color, item.size) : 0;
                const outOfStock = item.color && item.size && avail === 0;
                return (
                  <div key={idx} style={{ padding: "16px", border: `1px solid ${outOfStock ? "#B12704" : "#DDDDDD"}`, borderRadius: "8px", display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div className="cart-grid">
                      <div>
                        <label style={{ fontSize: "12px", color: "#595F68" }}>اللون</label>
                        <select class="amazon-select" value={item.color} onChange={(e) => updateItem(idx, "color", (e.target as HTMLSelectElement).value)}>
                          <option value="">اختر اللون</option>
                          {colors.map((c) => (
                            <option key={c} value={c} disabled={sizes.reduce((s, sz) => s + getAvailable(c, sz), 0) === 0}>{c}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: "12px", color: "#595F68" }}>المقاس</label>
                        <select class="amazon-select" value={item.size} onChange={(e) => updateItem(idx, "size", (e.target as HTMLSelectElement).value)}>
                          <option value="">اختر المقاس</option>
                          {sizes.map((s) => {
                            const sStock = getAvailable(item.color, s);
                            return (
                              <option key={s} value={s} disabled={sStock === 0}>{s}{sStock === 0 ? " (نفد)" : ""}</option>
                            );
                          })}
                        </select>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                        <label style={{ fontSize: "12px", color: "#595F68" }}>الكمية</label>
                        <div style={{ display: "flex", alignItems: "center", border: "1px solid #DDDDDD", borderRadius: "4px", overflow: "hidden" }}>
                          <button type="button" onClick={() => updateItem(idx, "quantity", Math.max(1, item.quantity - 1))}
                            style={{ padding: "4px 12px", background: "#F1F4F4", border: "none", cursor: "pointer", fontSize: "16px", minHeight: "32px" }}>-</button>
                          <input type="number" value={item.quantity} readOnly style={{ width: "40px", textAlign: "center", border: "none", fontWeight: 700, fontSize: "14px", padding: "4px 0" }} />
                          <button type="button" onClick={() => updateItem(idx, "quantity", Math.min(item.quantity + 1, avail || 99))}
                            style={{ padding: "4px 12px", background: "#F1F4F4", border: "none", cursor: "pointer", fontSize: "16px", minHeight: "32px" }}>+</button>
                        </div>
                      </div>
                      <span style={{ fontSize: "12px", color: outOfStock ? "#B12704" : "#067D62", fontWeight: 600 }}>
                        {outOfStock ? "غير متوفر" : avail > 0 ? `المتبقي: ${avail}` : "متوفر في المخزون"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid #DDDDDD" }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: "#595F68", fontSize: "14px", fontWeight: 600 }}>
                <span>إجمالي القطع:</span>
                <span>{totalQty} قطع</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
                <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "20px", fontWeight: 600 }}>إجمالي السعر:</span>
                <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "22px", fontWeight: 700, color: "#FF9900" }}>{total.toLocaleString()} ج.م</span>
              </div>
            </div>
          </div>
        </section>

        <section style={{ padding: "0 16px" }}>
          <div style={{ background: "#fff", padding: "16px", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "20px", fontWeight: 600, margin: "0 0 16px" }}>معلومات التوصيل</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ fontSize: "12px", color: "#595F68", display: "block", marginBottom: "4px" }}>الاسم بالكامل</label>
                <input class="amazon-input" placeholder="مثال: محمد أحمد" type="text" value={form.customerName} onChange={(e) => setForm({ ...form, customerName: (e.target as HTMLInputElement).value })} />
              </div>
              <div>
                <label style={{ fontSize: "12px", color: "#595F68", display: "block", marginBottom: "4px" }}>رقم الهاتف</label>
                <input class="amazon-input" dir="ltr" placeholder="01xxxxxxxxx" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: (e.target as HTMLInputElement).value })} />
              </div>
              <div className="delivery-grid">
                <div>
                  <label style={{ fontSize: "12px", color: "#595F68", display: "block", marginBottom: "4px" }}>المحافظة</label>
                  <select class="amazon-select" value={form.governorate} onChange={(e) => setForm({ ...form, governorate: (e.target as HTMLSelectElement).value, city: "" })}>
                    <option value="">اختر المحافظة</option>
                    {GOVERNORATES.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "12px", color: "#595F68", display: "block", marginBottom: "4px" }}>المدينة</label>
                  <select class="amazon-select" value={form.city} onChange={(e) => setForm({ ...form, city: (e.target as HTMLSelectElement).value })} disabled={!form.governorate}>
                    <option value="">اختر المدينة</option>
                    {(CITIES_BY_GOV[form.governorate] || []).map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: "12px", color: "#595F68", display: "block", marginBottom: "4px" }}>العنوان بالتفصيل</label>
                <input class="amazon-input" placeholder="رقم الشقة، الدور، اسم الشارع" type="text" value={form.address} onChange={(e) => setForm({ ...form, address: (e.target as HTMLInputElement).value })} />
              </div>
              <div>
                <label style={{ fontSize: "12px", color: "#595F68", display: "block", marginBottom: "4px" }}>ملاحظات إضافية</label>
                <textarea class="amazon-textarea" style={{ height: "80px", resize: "none" }} placeholder="أي تعليمات خاصة للمندوب" value={form.notes} onChange={(e) => setForm({ ...form, notes: (e.target as HTMLTextAreaElement).value })}></textarea>
              </div>
            </div>
          </div>
        </section>

        <section style={{ padding: "0 16px" }}>
          <div style={{ background: "#F0FAF8", padding: "16px", border: "1px solid #067D62", borderRadius: "8px", display: "flex", alignItems: "flex-start", gap: "12px" }}>
            <span class="material-symbols-outlined" style={{ fontSize: "20px", color: "#067D62", marginTop: "2px", fontVariationSettings: "'FILL' 1" }}>policy</span>
            <p style={{ fontSize: "14px", color: "#067D62", margin: 0 }}>سياسة الاسترجاع: يمكنك معاينة المنتج عند الاستلام، وفي حالة عدم المطابقة يمكنك رفض الاستلام مجاناً دون دفع أي تكاليف.</p>
          </div>
        </section>

        <section style={{ padding: "0 16px", paddingTop: "16px" }}>
          <button onClick={handleSubmit} disabled={loading || !canSubmit}
            style={{ width: "100%", background: "#FF9900", height: "48px", borderRadius: "8px", fontWeight: 700, color: "#0F1111", border: "none", cursor: "pointer", fontSize: "18px", boxShadow: "0 4px 6px rgba(0,0,0,0.15)", opacity: loading || !canSubmit ? 0.7 : 1 }}>
            {loading ? "جاري المعالجة..." : `اطلب الآن - ${total.toLocaleString()} ج.م`}
          </button>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", marginTop: "12px", color: "#595F68", fontSize: "14px", fontWeight: 600 }}>
            <span class="material-symbols-outlined" style={{ fontSize: "14px" }}>verified_user</span>
            <span>✓ دفع عند الاستلام</span>
          </div>
          <p style={{ textAlign: "center", fontSize: "13px", color: "#565959", marginTop: "8px" }}>يمكنك معاينة المنتج عند الاستلام - لك حق الإرجاع</p>
          {error && <p style={{ color: "#B12704", textAlign: "center", fontSize: "14px", marginTop: "8px" }}>{error}</p>}
        </section>

        <footer style={{ background: "#fff", padding: "32px 16px", marginTop: "32px", borderTop: "1px solid #DDDDDD", textAlign: "center" }}>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "16px", fontWeight: 700, color: "#565959", margin: "0 0 8px" }}>M&K Store</h2>
          <p style={{ fontSize: "12px", color: "#565959", margin: 0 }}>© 2025 جميع الحقوق محفوظة.</p>
        </footer>
      </main>
    </div>
  );
}
