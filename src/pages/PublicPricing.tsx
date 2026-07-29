import { useState } from "preact/compat";
import { useLocation } from "wouter";
import { api } from "../services/api";

const plans = [
  { name: "ستارتر", price: "999", icon: "🌱", features: ["منتجات غير محدودة", "متجر واحد", "دعم عبر البريد", "تحديثات شهرية"], cta: "ابدأ مجاناً" },
  { name: "بروفيشنال", price: "1,999", icon: "⭐", popular: true, features: ["منتجات غير محدودة", "متاجر غير محدودة", "دعم فوري", "تقارير متقدمة", "استضافة مجانية"], cta: "ابدأ الآن", badge: "الأكثر طلباً" },
  { name: "إنتربرايز", price: "مخصص", icon: "🏢", features: ["كل ميزات بروفيشنال", "تكامل مخصص", "مدير حساب مخصص", "تدريب الفريق", "SLA مضمون"], cta: "اتصل بالمبيعات" },
];

export default function PublicPricing() {
  const [, navigate] = useLocation();
  const [form, setForm] = useState({ email: "", name: "", phone: "", plan: "", price: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setError("");
    if (!form.email || !form.name || !form.plan) {
      setError("يرجى ملء جميع الحقول المطلوبة");
      return;
    }
    setLoading(true);
    try {
      await api.post("/subscriptions/request", { ...form, price: Number(String(form.price).replace(/,/g, "")) });
      navigate("/login");
    } catch (err: any) {
      setError(err.message || "حدث خطأ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: "#F6F8F8", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div style={{ width: "100%", maxWidth: "600px" }}>
        <div style={{ marginBottom: "32px", textAlign: "center" }}>
          <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "36px", fontWeight: "800", color: "#0F1111", marginBottom: "16px" }}>خطط الاشتراك</h1>
          <p style={{ fontSize: "18px", color: "#565959", lineHeight: 1.8 }}>اختر الخطة المناسبة لاحتياجات متجرك</p>
        </div>

        <div style={{ marginBottom: "32px", background: "#fff", borderRadius: "16px", padding: "32px 24px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <form onSubmit={handleSubmit}>
            <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "24px", fontWeight: "700", color: "#0F1111", margin: "0 0 24px" }}>طلب الاشتراك</h2>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "14px", fontWeight: "500", color: "#0F1111", marginBottom: "4px" }}>البريد الإلكتروني</label>
                <input type="email" class="amazon-input" value={form.email} onChange={(e) => setForm({ ...form, email: (e.target as HTMLInputElement).value })} placeholder="example@domain.com" required />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "14px", fontWeight: "500", color: "#0F1111", marginBottom: "4px" }}>الاسم</label>
                <input type="text" class="amazon-input" value={form.name} onChange={(e) => setForm({ ...form, name: (e.target as HTMLInputElement).value })} placeholder="اسم التاجر أو الشركة" required />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "14px", fontWeight: "500", color: "#0F1111", marginBottom: "4px" }}>رقم الهاتف</label>
                <input type="tel" class="amazon-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: (e.target as HTMLInputElement).value })} placeholder="01xxxxxxxxx" />
              </div>

<div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ display: "block", fontSize: "14px", fontWeight: "500", color: "#0F1111", marginBottom: "4px" }}>الخطة</label>
                <select class="amazon-select" value={form.plan} onChange={(e) => {
                  const target = e.target as HTMLSelectElement;
                  const selectedPrice = target.selectedOptions[0].dataset.price;
                  setForm({ 
                    ...form, 
                    plan: target.value,
                    price: selectedPrice || "0" 
                  });
                }} required>
                  <option value="">اختر الخطة...</option>
                  {plans.map((p) => (
                    <option key={p.name} value={p.name} data-price={p.price === "مخصص" ? 0 : p.price}>{p.name} - {p.price === "مخصص" ? p.price : `${p.price} ج.م`}</option>
                  ))}
                </select>
              </div>

              {error && (
                <div style={{ color: "#B12704", fontSize: "14px", margin: "8px 0" }}>{error}</div>
              )}

              <button type="submit" disabled={loading} style={{ background: "#FF9900", color: "#0F1111", fontWeight: "700", padding: "16px 24px", borderRadius: "8px", border: "none", cursor: loading ? "not-allowed" : "pointer", fontSize: "16px", opacity: loading ? 0.7 : 1 }}>
                {loading ? "جاري..." : "إرسال طلب الاشتراك"}
              </button>
            </div>
          </form>
        </div>

        <div style={{ textAlign: "center", padding: "32px", background: "#fff", borderRadius: "12px", border: "1px solid #DDDDDD", boxShadow: "0 2px 4px rgba(0,0,0,0.04)" }}>
          <p style={{ margin: "0 0 16px", color: "#565959", fontSize: "16px" }}>أو تصفح الخطط الآن</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
            {plans.map((plan) => (
              <div key={plan.name} style={{ border: plan.popular ? "2px solid #FF9900" : "1px solid #DDDDDD", borderRadius: "12px", padding: "20px", background: plan.popular ? "#FFF5E6" : "#fff", boxShadow: plan.popular ? "0 4px 12px rgba(255,153,0,0.15)" : "0 2px 4px rgba(0,0,0,0.04)" }}>
                {plan.badge && (<div style={{ background: "#FF9900", color: "#131921", padding: "6px 16px", borderRadius: "9999px", fontSize: "12px", fontWeight: "800", marginBottom: "16px" }}>{plan.badge}</div>)}
                <h3 style={{ fontSize: "20px", fontWeight: "700", margin: "0 0 8px" }}>{plan.name}</h3>
                <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "28px", fontWeight: "800", color: "#0F1111", margin: "16px 0" }}>{plan.price === "مخصص" ? plan.price : `${plan.price} ج.م`}</div>
                <ul style={{ listStyle: "none", padding: 0, margin: "24px 0", textAlign: "right" }}>{plan.features.map((f) => (
                  <li key={f} style={{ display: "flex", alignItems: "center", gap: "8px", margin: "8px 0", fontSize: "14px", color: "#565959" }}>{f}</li>
                ))}</ul>
                <button onClick={() => { setForm(f => ({ ...f, plan: plan.name, price: plan.price === "مخصص" ? "0" : plan.price })); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  style={{ width: "100%", background: plan.popular ? "#FF9900" : "#131921", color: plan.popular ? "#131921" : "#fff", padding: "12px", borderRadius: "8px", border: "none", fontWeight: "700", cursor: "pointer", fontSize: "14px" }}>{plan.cta}</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}