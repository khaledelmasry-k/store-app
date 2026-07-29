import { useState } from "preact/compat";
import { useLocation } from "wouter";

const PLANS = [
  { id: "FREE", name: "مجاني", price: "0 ج.م", features: ["منتج واحد", "متجر واحد", "رابط تسويق واحد"] },
  { id: "STARTER", name: "ستارتر", price: "999 ج.م", features: ["منتجات غير محدودة", "متجر واحد", "روابط تسويق غير محدودة", "دعم عبر البريد"] },
  { id: "PRO", name: "احترافي", price: "1,999 ج.م", features: ["منتجات غير محدودة", "متاجر غير محدودة", "روابط تسويق غير محدودة", "تقارير متقدمة", "دعم فوري"], popular: true },
];

export default function Onboarding() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    email: "", password: "", name: "", companyName: "", storeName: "", subdomain: "", plan: "FREE",
  });

  const update = (field: string, value: string) => setForm({ ...form, [field]: value });

  const register = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err.error || "حدث خطأ");
        setLoading(false);
        return;
      }
      const data = await res.json();
      localStorage.setItem("token", data.token);
      localStorage.setItem("admin", JSON.stringify(data.admin));
      setStep(5);
    } catch {
      setError("تعذر الاتصال بالخادم");
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1: return (
        <div>
          <h3 style={{ fontSize: "20px", fontWeight: 700, margin: "0 0 4px" }}>اختر الباقة</h3>
          <p style={{ fontSize: "14px", color: "#565959", margin: "0 0 24px" }}>اختر الباقة المناسبة لمتجرك</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
            {PLANS.map((p) => (
              <div key={p.id} onClick={() => { update("plan", p.id); setStep(2); }}
                style={{
                  background: form.plan === p.id ? "#FFF8E1" : "#fff", borderRadius: "12px", padding: "24px", cursor: "pointer", border: form.plan === p.id ? "2px solid #FF9900" : "1px solid #DDDDDD", position: "relative", transition: "all 0.15s",
                }}>
                {p.popular && <div style={{ position: "absolute", top: "-10px", left: "50%", transform: "translateX(-50%)", background: "#FF9900", color: "#131921", padding: "2px 16px", borderRadius: "9999px", fontSize: "11px", fontWeight: 800 }}>الأكثر طلباً</div>}
                <div style={{ fontSize: "18px", fontWeight: 700, marginBottom: "8px", textTransform: "capitalize" }}>{p.name}</div>
                <div style={{ fontSize: "24px", fontWeight: 800, color: "#131921", marginBottom: "16px" }}>{p.price}</div>
                {p.features.map((f) => (
                  <div key={f} style={{ fontSize: "13px", color: "#565959", padding: "4px 0", display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ color: "#067D62" }}>✓</span> {f}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      );

      case 2: return (
        <div>
          <h3 style={{ fontSize: "20px", fontWeight: 700, margin: "0 0 4px" }}>معلومات الحساب</h3>
          <p style={{ fontSize: "14px", color: "#565959", margin: "0 0 24px" }}>أنشئ حسابك الجديد</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "400px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "13px", fontWeight: 600 }}>الاسم الكامل</label>
              <input type="text" className="amazon-input" value={form.name} onChange={(e) => update("name", (e.target as HTMLInputElement).value)} placeholder="محمد أحمد" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "13px", fontWeight: 600 }}>البريد الإلكتروني</label>
              <input type="email" className="amazon-input" value={form.email} onChange={(e) => update("email", (e.target as HTMLInputElement).value)} placeholder="me@example.com" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "13px", fontWeight: 600 }}>كلمة المرور</label>
              <input type="password" className="amazon-input" value={form.password} onChange={(e) => update("password", (e.target as HTMLInputElement).value)} placeholder="أقل 6 أحرف" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "13px", fontWeight: 600 }}>اسم الشركة</label>
              <input type="text" className="amazon-input" value={form.companyName} onChange={(e) => update("companyName", (e.target as HTMLInputElement).value)} placeholder="متجر..." />
            </div>
            <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
              <button onClick={() => setStep(1)} style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "1px solid #DDDDDD", background: "#fff", fontWeight: 600, cursor: "pointer" }}>رجوع</button>
              <button onClick={() => setStep(3)} disabled={!form.name || !form.email || !form.password || !form.companyName}
                style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "none", background: (!form.name || !form.email || !form.password || !form.companyName) ? "#ccc" : "#FF9900", color: "#131921", fontWeight: 700, cursor: (!form.name || !form.email || !form.password || !form.companyName) ? "not-allowed" : "pointer" }}>
                التالي
              </button>
            </div>
          </div>
        </div>
      );

      case 3: return (
        <div>
          <h3 style={{ fontSize: "20px", fontWeight: 700, margin: "0 0 4px" }}>إعداد المتجر</h3>
          <p style={{ fontSize: "14px", color: "#565959", margin: "0 0 24px" }}>اختر اسم ونطاق متجرك</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "400px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "13px", fontWeight: 600 }}>اسم المتجر</label>
              <input type="text" className="amazon-input" value={form.storeName} onChange={(e) => update("storeName", (e.target as HTMLInputElement).value)} placeholder="متجر..." />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "13px", fontWeight: 600 }}>النطاق الفرعي</label>
              <div style={{ display: "flex", alignItems: "center", border: "1px solid #DDDDDD", borderRadius: "8px", overflow: "hidden" }}>
                <input type="text" className="amazon-input" value={form.subdomain} onChange={(e) => update("subdomain", (e.target as HTMLInputElement).value.replace(/[^a-z0-9-]/g, ""))} placeholder="my-store"
                  style={{ border: "none", borderRadius: "8px 0 0 8px", flex: 1 }} />
                <span style={{ padding: "10px 12px", background: "#f4f4f5", fontSize: "13px", color: "#565959", borderLeft: "1px solid #DDDDDD" }}>.mkstore.com</span>
              </div>
              <p style={{ fontSize: "11px", color: "#565959", margin: "4px 0 0" }}>حروف وأرقام فقط، بدون مسافات</p>
            </div>
            {error && <p style={{ color: "#B12704", fontSize: "13px", margin: 0 }}>{error}</p>}
            <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
              <button onClick={() => setStep(2)} style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "1px solid #DDDDDD", background: "#fff", fontWeight: 600, cursor: "pointer" }}>رجوع</button>
              <button onClick={register} disabled={loading || !form.storeName || !form.subdomain}
                style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "none", background: (loading || !form.storeName || !form.subdomain) ? "#ccc" : "#FF9900", color: "#131921", fontWeight: 700, cursor: (loading || !form.storeName || !form.subdomain) ? "not-allowed" : "pointer" }}>
                {loading ? "جارٍ الإنشاء..." : "إنشاء المتجر"}
              </button>
            </div>
          </div>
        </div>
      );

      case 5: return (
        <div style={{ textAlign: "center", padding: "48px 0" }}>
          <div style={{ fontSize: "64px", marginBottom: "16px" }}>🎉</div>
          <h3 style={{ fontSize: "24px", fontWeight: 700, margin: "0 0 8px" }}>تم إنشاء متجرك بنجاح!</h3>
          <p style={{ fontSize: "14px", color: "#565959", margin: "0 0 32px" }}>متجر <strong>{form.storeName}</strong> جاهز لاستقبال الطلبات</p>
          <button onClick={() => navigate("/merchant")}
            style={{ padding: "14px 32px", borderRadius: "8px", border: "none", background: "#FF9900", color: "#131921", fontWeight: 700, fontSize: "16px", cursor: "pointer" }}>
            دخول لوحة التحكم
          </button>
        </div>
      );
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#fbf8ff", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div style={{ background: "#fff", borderRadius: "16px", boxShadow: "0 4px 24px rgba(0,0,0,0.08)", padding: "40px", maxWidth: "640px", width: "100%" }}>
        <div style={{ marginBottom: "32px", textAlign: "center" }}>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "28px", fontWeight: 700, color: "#131921", margin: "0 0 4px" }}>M&K Store</h2>
          <p style={{ fontSize: "14px", color: "#565959", margin: 0 }}>أنشئ متجرك الإلكتروني الآن</p>
        </div>
        {step < 5 && (
          <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginBottom: "32px" }}>
            {[1, 2, 3].map((s) => (
              <div key={s} style={{
                width: "32px", height: "32px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                background: step >= s ? "#FF9900" : "#EAEDED", color: step >= s ? "#131921" : "#565959", fontWeight: 700, fontSize: "14px",
              }}>{s}</div>
            ))}
            <div style={{ flex: 1, display: "flex", alignItems: "center", margin: "0 4px" }}>
              <div style={{ height: "2px", flex: 1, background: step > 1 ? "#FF9900" : "#EAEDED", borderRadius: "1px" }} />
            </div>
            <div style={{
              width: "32px", height: "32px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
              background: step >= 5 ? "#FF9900" : "#EAEDED", color: step >= 5 ? "#131921" : "#565959", fontWeight: 700, fontSize: "14px",
            }}>✓</div>
          </div>
        )}
        {renderStep()}
      </div>
    </div>
  );
}
