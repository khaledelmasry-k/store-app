import { useState, useEffect } from "preact/compat";
import { api, API_BASE, getImageUrl } from "../services/api";

interface StoreInfo { name: string; tagLine: string | null; logo: string | null; primaryColor: string | null; }

interface ProductItem {
  id: string; name: string; description: string; price: number; oldPrice: number | null;
  pricingTiers: Record<string, number>; variantStock: Record<string, Record<string, number>>;
  stock: number; images: Record<string, string>; colors: string[]; sizes: string[]; active: boolean;
}

type Page = "catalog" | "cart" | "checkout" | "done" | "tracking";

interface CartItem {
  productId: string; name: string; color: string; size: string; quantity: number;
  price: number; image: string;
}

function getTierPrice(qty: number, tiers: Record<string, number>): number {
  const def = { 1: 500, 2: 900, 3: 1200, 4: 1400 } as Record<string, number>;
  const t = Object.keys(tiers).length ? tiers : def;
  if (qty >= 4 && t[4]) return t[4] + (qty - 4) * Math.round(t[4] / 4);
  return t[qty] || qty * (t[1] || def[1]);
}

export default function CustomerStore() {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get("ref") || "";
  const sellerId = params.get("seller") || "";
  const landingPageId = params.get("landing") || "";
  const landingPageSlug = params.get("landingSlug") || "";
  const marketingLinkId = params.get("link") || "";
  const utmSource = params.get("utm_source") || "";
  const utmMedium = params.get("utm_medium") || "";
  const utmCampaign = params.get("utm_campaign") || "";

  const [store, setStore] = useState<StoreInfo | null>(null);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [page, setPage] = useState<Page>("catalog");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [trackingNum, setTrackingNum] = useState("");
  const [trackingData, setTrackingData] = useState<any>(null);

  // Form state
  const [form, setForm] = useState({ customerName: "", phone: "", governorate: "", city: "", address: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const [orderResult, setOrderResult] = useState<{ orderNumber: string; totalPrice: number } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<{ products: ProductItem[]; store: StoreInfo }>(`/orders/products?ref=${ref}`)
      .then((r) => { setProducts(r.products); setStore(r.store); })
      .catch(() => setError("المتجر غير موجود"));
  }, [ref]);

  const primaryColor = store?.primaryColor || "#FF9900";

  const addToCart = (product: ProductItem, color: string, size: string, qty: number) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id && i.color === color && i.size === size);
      if (existing) {
        return prev.map((i) => i === existing ? { ...i, quantity: i.quantity + qty } : i);
      }
      const tiers = Object.keys(product.pricingTiers).length ? product.pricingTiers : {};
      const price = getTierPrice(qty, tiers);
      return [...prev, {
        productId: product.id, name: product.name,
        color, size, quantity: qty, price,
        image: product.images[color] || Object.values(product.images)[0] || "",
      }];
    });
  };

  const removeFromCart = (idx: number) => setCart(cart.filter((_, i) => i !== idx));
  const updateQty = (idx: number, qty: number) => {
    if (qty <= 0) { removeFromCart(idx); return; }
    setCart(cart.map((item, i) => i === idx ? { ...item, quantity: qty } : item));
  };

  const cartTotal = cart.reduce((sum, item) => {
    const product = products.find((p) => p.id === item.productId);
    const tiers = product?.pricingTiers || {};
    return sum + getTierPrice(item.quantity, tiers);
  }, 0);

  const submitOrder = async () => {
    setSubmitting(true);
    setError("");
    try {
      const items = cart.map((item) => ({
        productId: item.productId, name: item.name, color: item.color, size: item.size, quantity: item.quantity,
      }));
      const body: any = { ...form, ref, items };
      if (sellerId) body.sellerId = sellerId;
      if (landingPageId) body.landingPageId = landingPageId;
      if (landingPageSlug) body.landingPageSlug = landingPageSlug;
      if (marketingLinkId) body.marketingLinkId = marketingLinkId;
      if (utmSource) body.utmSource = utmSource;
      if (utmMedium) body.utmMedium = utmMedium;
      if (utmCampaign) body.utmCampaign = utmCampaign;
      const res = await api.post<{ orderNumber: string; totalPrice: number }>("/orders", body);
      setOrderResult(res);
      setCart([]);
      setPage("done");
    } catch (err: any) {
      setError(err.message || "حدث خطأ");
    } finally { setSubmitting(false); }
  };

  const trackOrder = async () => {
    if (!trackingNum) return;
    setError("");
    try {
      const data = await api.get<any>(`/orders/track/${trackingNum}`);
      setTrackingData(data);
      setPage("tracking");
    } catch { setError("رقم الطلب غير صحيح"); }
  };

  const statusColors: Record<string, string> = {
    NEW: "#FF9900", CONTACTED: "#007185", PROCESSING: "#067D62",
    SHIPPED: "#067D62", DELIVERED: "#067D62", CANCELLED: "#B12704", RETURNED: "#B12704",
  };
  const statusLabels: Record<string, string> = {
    NEW: "جديد", CONTACTED: "تم التواصل", PROCESSING: "قيد التجهيز",
    SHIPPED: "تم الشحن", DELIVERED: "تم التوصيل", CANCELLED: "ملغي", RETURNED: "مرتجع",
  };

  if (error && !store) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "'Noto Sans Arabic', sans-serif" }}>
        <p style={{ fontSize: "18px", color: "#B12704" }}>{error}</p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'Noto Sans Arabic', sans-serif", background: "#EAEDED", minHeight: "100vh" }}>
      {/* Header */}
      <header style={{ background: "#131921", color: "#fff", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {store?.logo && <img src={getImageUrl(store.logo)} alt="" style={{ height: "32px", borderRadius: "4px" }} />}
          <div>
            <span style={{ fontWeight: 700, fontSize: "16px" }}>{store?.name || "المتجر"}</span>
            {store?.tagLine && <span style={{ fontSize: "11px", opacity: 0.7, display: "block" }}>{store.tagLine}</span>}
          </div>
        </div>
        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
          <button onClick={() => setPage("catalog")} style={{ background: "none", border: "none", color: page === "catalog" ? primaryColor : "#B0B8C1", cursor: "pointer", padding: "4px" }}>
            <span class="material-symbols-outlined">store</span>
          </button>
          <button onClick={() => setPage("cart")} style={{ background: "none", border: "none", color: "#B0B8C1", cursor: "pointer", padding: "4px", position: "relative" }}>
            <span class="material-symbols-outlined">shopping_cart</span>
            {cart.length > 0 && (
              <span style={{ position: "absolute", top: -4, right: -4, background: primaryColor, color: "#131921", borderRadius: "50%", width: "16px", height: "16px", fontSize: "10px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {cart.length}
              </span>
            )}
          </button>
          <div style={{ display: "flex", gap: "4px" }}>
            <input type="text" placeholder="رقم الطلب" value={trackingNum} onChange={(e) => setTrackingNum((e.target as HTMLInputElement).value)}
              style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid #555", background: "#1a2433", color: "#fff", fontSize: "12px", width: "100px", outline: "none" }} />
            <button onClick={trackOrder} style={{ padding: "6px 10px", borderRadius: "6px", border: "none", background: primaryColor, fontWeight: 700, fontSize: "12px", cursor: "pointer" }}>تتبع</button>
          </div>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div style={{ background: "#FEF2F2", color: "#B12704", padding: "12px 24px", textAlign: "center", fontSize: "13px", fontWeight: 600 }}>
          {error}
        </div>
      )}

      {/* Page: Tracking */}
      {page === "tracking" && trackingData && (
        <div style={{ maxWidth: "500px", margin: "40px auto", padding: "24px", background: "#fff", borderRadius: "12px", border: "1px solid #DDDDDD" }}>
          <h2 style={{ margin: "0 0 24px", fontWeight: 700, textAlign: "center" }}>تتبع الطلب</h2>
          <div style={{ textAlign: "center", marginBottom: "24px" }}>
            <div style={{ fontSize: "24px", fontWeight: 700, color: "#131921" }}>{trackingData.orderNumber}</div>
            <span style={{
              display: "inline-block", marginTop: "8px", padding: "6px 16px", borderRadius: "6px",
              fontWeight: 700, fontSize: "14px", background: `${statusColors[trackingData.status]}22`,
              color: statusColors[trackingData.status],
            }}>{statusLabels[trackingData.status] || trackingData.status}</span>
          </div>
          <div style={{ borderTop: "1px solid #EAEDED", paddingTop: "16px" }}>
            <div style={{ fontSize: "13px", color: "#565959", marginBottom: "4px" }}>العميل: <strong>{trackingData.customerName}</strong></div>
            <div style={{ fontSize: "13px", color: "#565959", marginBottom: "4px" }}>العنوان: {trackingData.governorate} - {trackingData.city}</div>
            <div style={{ fontSize: "13px", color: "#565959", marginBottom: "4px" }}>الإجمالي: <strong>{trackingData.totalPrice.toLocaleString()} ج.م</strong></div>
            <div style={{ fontSize: "13px", color: "#565959" }}>التاريخ: {new Date(trackingData.createdAt).toLocaleDateString("ar-EG")}</div>
            {trackingData.items && trackingData.items.length > 0 && (
              <div style={{ marginTop: "12px", borderTop: "1px solid #EAEDED", paddingTop: "12px" }}>
                <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: "8px" }}>المنتجات:</div>
                {trackingData.items.map((item: any, i: number) => (
                  <div key={i} style={{ fontSize: "13px", color: "#565959", padding: "4px 0", display: "flex", justifyContent: "space-between" }}>
                    <span>{item.name} ({item.color} / {item.size})</span>
                    <span>×{item.quantity}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => setPage("catalog")} style={{ width: "100%", marginTop: "24px", padding: "12px", borderRadius: "8px", border: "none", background: primaryColor, fontWeight: 700, cursor: "pointer" }}>
            العودة للمتجر
          </button>
        </div>
      )}

      {/* Page: Catalog */}
      {page === "catalog" && (
        <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "24px" }}>
          {store?.tagLine && <p style={{ textAlign: "center", color: "#565959", marginBottom: "24px" }}>{store.tagLine}</p>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "20px" }}>
            {products.map((p) => (
              <ProductCard key={p.id} product={p} primaryColor={primaryColor} onAdd={addToCart} />
            ))}
            {products.length === 0 && (
              <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "48px", color: "#565959" }}>
                لا توجد منتجات متاحة حالياً
              </div>
            )}
          </div>
        </div>
      )}

      {/* Page: Cart */}
      {page === "cart" && (
        <div style={{ maxWidth: "600px", margin: "0 auto", padding: "24px" }}>
          <h2 style={{ margin: "0 0 24px", fontWeight: 700 }}>سلة التسوق ({cart.length})</h2>
          {cart.length === 0 && (
            <div style={{ textAlign: "center", padding: "48px", color: "#565959" }}>السلة فارغة</div>
          )}
          {cart.map((item, idx) => (
            <div key={idx} style={{ background: "#fff", borderRadius: "8px", border: "1px solid #DDDDDD", padding: "16px", marginBottom: "12px", display: "flex", gap: "12px", alignItems: "center" }}>
              {item.image && <img src={getImageUrl(item.image)} alt="" style={{ width: "64px", height: "64px", borderRadius: "8px", objectFit: "cover" }} />}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: "14px" }}>{item.name}</div>
                <div style={{ fontSize: "12px", color: "#565959" }}>{item.color} / {item.size}</div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                  <button onClick={() => updateQty(idx, item.quantity - 1)} style={{ width: "28px", height: "28px", borderRadius: "4px", border: "1px solid #DDDDDD", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>-</button>
                  <span style={{ fontWeight: 700, fontSize: "14px" }}>{item.quantity}</span>
                  <button onClick={() => updateQty(idx, item.quantity + 1)} style={{ width: "28px", height: "28px", borderRadius: "4px", border: "1px solid #DDDDDD", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                </div>
              </div>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontWeight: 700, color: "#131921" }}>{item.price.toLocaleString()} ج.م</div>
                <button onClick={() => removeFromCart(idx)} style={{ background: "none", border: "none", color: "#B12704", cursor: "pointer", fontSize: "12px", marginTop: "4px" }}>إزالة</button>
              </div>
            </div>
          ))}
          {cart.length > 0 && (
            <div style={{ background: "#fff", borderRadius: "8px", border: "1px solid #DDDDDD", padding: "16px", marginTop: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <span style={{ fontWeight: 700, fontSize: "16px" }}>الإجمالي</span>
                <span style={{ fontWeight: 700, fontSize: "20px", color: primaryColor }}>{cartTotal.toLocaleString()} ج.م</span>
              </div>
              <button onClick={() => setPage("checkout")} style={{ width: "100%", padding: "14px", borderRadius: "8px", border: "none", background: primaryColor, fontWeight: 700, fontSize: "16px", cursor: "pointer" }}>
                إتمام الطلب
              </button>
            </div>
          )}
          <button onClick={() => setPage("catalog")} style={{ width: "100%", marginTop: "12px", padding: "12px", borderRadius: "8px", border: "1px solid #DDDDDD", background: "#fff", fontWeight: 600, cursor: "pointer" }}>
            متابعة التسوق
          </button>
        </div>
      )}

      {/* Page: Checkout */}
      {page === "checkout" && (
        <div style={{ maxWidth: "500px", margin: "0 auto", padding: "24px" }}>
          <h2 style={{ margin: "0 0 24px", fontWeight: 700 }}>معلومات التوصيل</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", background: "#fff", padding: "24px", borderRadius: "8px", border: "1px solid #DDDDDD" }}>
            <input type="text" className="amazon-input" placeholder="الاسم الكامل" value={form.customerName}
              onChange={(e) => setForm({ ...form, customerName: (e.target as HTMLInputElement).value })} />
            <input type="tel" className="amazon-input" placeholder="رقم الجوال" value={form.phone}
              onChange={(e) => setForm({ ...form, phone: (e.target as HTMLInputElement).value })} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <input type="text" className="amazon-input" placeholder="المحافظة" value={form.governorate}
                onChange={(e) => setForm({ ...form, governorate: (e.target as HTMLInputElement).value })} />
              <input type="text" className="amazon-input" placeholder="المدينة" value={form.city}
                onChange={(e) => setForm({ ...form, city: (e.target as HTMLInputElement).value })} />
            </div>
            <input type="text" className="amazon-input" placeholder="العنوان بالتفصيل" value={form.address}
              onChange={(e) => setForm({ ...form, address: (e.target as HTMLInputElement).value })} />
            <textarea className="amazon-input" rows={3} placeholder="ملاحظات (اختياري)" value={form.notes}
              onChange={(e) => setForm({ ...form, notes: (e.target as HTMLTextAreaElement).value })} />
            <div style={{ borderTop: "1px solid #EAEDED", paddingTop: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 700, fontSize: "16px" }}>الإجمالي</span>
              <span style={{ fontWeight: 700, fontSize: "20px", color: primaryColor }}>{cartTotal.toLocaleString()} ج.م</span>
            </div>
            <button onClick={submitOrder} disabled={submitting || !form.customerName || !form.phone || !form.governorate || !form.city || !form.address}
              style={{ padding: "14px", borderRadius: "8px", border: "none", background: (submitting || !form.customerName || !form.phone || !form.governorate || !form.city || !form.address) ? "#ccc" : primaryColor, fontWeight: 700, fontSize: "16px", cursor: (submitting || !form.customerName || !form.phone || !form.governorate || !form.city || !form.address) ? "not-allowed" : "pointer", color: "#131921" }}>
              {submitting ? "جاري إرسال الطلب..." : `تأكيد الطلب — ${cartTotal.toLocaleString()} ج.م`}
            </button>
          </div>
        </div>
      )}

      {/* Page: Done */}
      {page === "done" && orderResult && (
        <div style={{ maxWidth: "500px", margin: "40px auto", padding: "24px", background: "#fff", borderRadius: "12px", border: "1px solid #DDDDDD", textAlign: "center" }}>
          <span style={{ fontSize: "48px", color: "#067D62" }}>✅</span>
          <h2 style={{ margin: "16px 0 8px", fontWeight: 700 }}>تم استلام طلبك!</h2>
          <p style={{ color: "#565959", marginBottom: "24px" }}>رقم الطلب</p>
          <div style={{ fontSize: "28px", fontWeight: 700, color: "#131921", letterSpacing: "1px", fontFamily: "monospace" }}>{orderResult.orderNumber}</div>
          <p style={{ color: "#565959", marginTop: "24px" }}>سيتم التواصل معك قريباً لتأكيد الطلب</p>
          <div style={{ fontSize: "18px", fontWeight: 700, color: primaryColor, margin: "12px 0 24px" }}>{orderResult.totalPrice.toLocaleString()} ج.م</div>
          <button onClick={() => { setPage("catalog"); setOrderResult(null); }}
            style={{ width: "100%", padding: "14px", borderRadius: "8px", border: "none", background: primaryColor, fontWeight: 700, fontSize: "16px", cursor: "pointer" }}>
            العودة للمتجر
          </button>
        </div>
      )}
    </div>
  );
}

function ProductCard({ product, primaryColor, onAdd }: {
  product: ProductItem; primaryColor: string;
  onAdd: (product: ProductItem, color: string, size: string, qty: number) => void;
}) {
  const [selectedColor, setSelectedColor] = useState(product.colors[0] || "");
  const [selectedSize, setSelectedSize] = useState(product.sizes[0] || "");
  const [qty, setQty] = useState(1);

  const availableStock = product.variantStock[selectedColor]?.[selectedSize] ?? 0;
  const currentImage = product.images[selectedColor] || Object.values(product.images)[0] || "";
  const isOutOfStock = availableStock <= 0;

  return (
    <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #DDDDDD", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ aspectRatio: "1", background: "#F6F8F8", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        {currentImage ? <img src={getImageUrl(currentImage)} alt={product.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span class="material-symbols-outlined" style={{ fontSize: "48px", color: "#ccc" }}>image</span>}
      </div>
      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "8px", flex: 1 }}>
        <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0F1111" }}>{product.name}</h3>
        {product.description && <p style={{ margin: 0, fontSize: "12px", color: "#565959", lineHeight: 1.4 }}>{product.description}</p>}
        <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
          <span style={{ fontSize: "20px", fontWeight: 700, color: "#B12704" }}>{product.price.toLocaleString()} ج.م</span>
          {product.oldPrice && <span style={{ fontSize: "14px", color: "#565959", textDecoration: "line-through" }}>{product.oldPrice.toLocaleString()} ج.م</span>}
        </div>

        {product.colors.length > 0 && (
          <div>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#565959" }}>اللون: {selectedColor}</span>
            <div style={{ display: "flex", gap: "6px", marginTop: "4px", flexWrap: "wrap" }}>
              {product.colors.map((c) => (
                <button key={c} onClick={() => { setSelectedColor(c); setSelectedSize(product.sizes[0] || ""); }}
                  style={{ padding: "4px 12px", borderRadius: "4px", border: selectedColor === c ? `2px solid ${primaryColor}` : "1px solid #DDDDDD", background: selectedColor === c ? `${primaryColor}22` : "#fff", cursor: "pointer", fontSize: "12px", fontWeight: selectedColor === c ? 700 : 400 }}>
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}

        {product.sizes.length > 0 && (
          <div>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#565959" }}>المقاس: {selectedSize}</span>
            <div style={{ display: "flex", gap: "6px", marginTop: "4px", flexWrap: "wrap" }}>
              {product.sizes.map((s) => {
                const stock = product.variantStock[selectedColor]?.[s] ?? 0;
                return (
                  <button key={s} onClick={() => setSelectedSize(s)}
                    style={{ padding: "4px 12px", borderRadius: "4px", border: selectedSize === s ? `2px solid ${primaryColor}` : "1px solid #DDDDDD", background: selectedSize === s ? `${primaryColor}22` : "#fff", cursor: "pointer", fontSize: "12px", fontWeight: selectedSize === s ? 700 : 400, opacity: stock <= 0 ? 0.4 : 1 }}>
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {isOutOfStock ? (
          <div style={{ padding: "10px", background: "#FEF2F2", borderRadius: "6px", color: "#B12704", fontSize: "13px", fontWeight: 600, textAlign: "center" }}>غير متوفر</div>
        ) : (
          <div style={{ display: "flex", gap: "8px", marginTop: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "4px", border: "1px solid #DDDDDD", borderRadius: "6px", padding: "4px" }}>
              <button onClick={() => setQty(Math.max(1, qty - 1))} style={{ width: "28px", height: "28px", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>-</button>
              <span style={{ fontWeight: 700, minWidth: "20px", textAlign: "center" }}>{qty}</span>
              <button onClick={() => setQty(Math.min(availableStock, qty + 1))} style={{ width: "28px", height: "28px", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>+</button>
            </div>
            <button onClick={() => onAdd(product, selectedColor, selectedSize, qty)}
              style={{ flex: 1, padding: "8px", borderRadius: "6px", border: "none", background: primaryColor, fontWeight: 700, fontSize: "13px", cursor: "pointer" }}>
              أضف للسلة
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
