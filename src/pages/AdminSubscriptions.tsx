import Sidebar from "../components/Sidebar";

const plans = [
  { name: "ستارتر", price: "999", icon: "🌱", features: ["منتجات غير محدودة", "متجر واحد", "دعم عبر البريد", "تحديثات شهرية"] },
  { name: "بروفيشنال", price: "1,999", icon: "⭐", popular: true, features: ["منتجات غير محدودة", "متاجر غير محدودة", "دعم فوري", "تقارير متقدمة", "استضافة مجانية"] },
  { name: "إنتربرايز", price: "مخصص", icon: "🏢", features: ["كل ميزات بروفيشنال", "تكامل مخصص", "مدير حساب", "تدريب الفريق", "SLA مضمون"] },
];

export default function AdminSubscriptions() {
  return (
    <div style={{ background: "#EAEDED", minHeight: "100vh", display: "flex" }}>
      <Sidebar />
      <div className="admin-content" style={{ flex: 1, padding: "24px", minHeight: "100vh" }}>
        <div style={{ marginBottom: "32px" }}>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "24px", fontWeight: 600, color: "#0F1111", margin: 0 }}>📋 الباقات والاشتراكات</h2>
          <p style={{ fontSize: "14px", color: "#595f68", margin: "4px 0 0" }}>اختر الباقة المناسبة لاحتياجات متجرك</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "24px" }}>
          {plans.map((plan) => (
            <div key={plan.name} style={{ background: "#fff", borderRadius: "16px", border: plan.popular ? "2px solid #FF9900" : "1px solid #DDDDDD", padding: "32px 24px", position: "relative", boxShadow: plan.popular ? "0 8px 24px rgba(255,153,0,0.15)" : "0 2px 8px rgba(0,0,0,0.04)" }}>
              {plan.popular && <div style={{ position: "absolute", top: "-12px", left: "50%", transform: "translateX(-50%)", background: "#FF9900", color: "#131921", padding: "4px 20px", borderRadius: "9999px", fontSize: "11px", fontWeight: 800 }}>الأكثر طلباً</div>}
              <div style={{ fontSize: "40px", marginBottom: "12px" }}>{plan.icon}</div>
              <h3 style={{ fontSize: "20px", fontWeight: 700, margin: "0 0 4px" }}>{plan.name}</h3>
              <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "32px", fontWeight: 800, color: "#131921", margin: "16px 0" }}>
                {plan.price === "مخصص" ? plan.price : `${plan.price} ج.م`}
              </div>
              {plan.price !== "مخصص" && <p style={{ fontSize: "13px", color: "#565959", margin: "-8px 0 24px" }}>/ شهرياً</p>}
              <div style={{ marginBottom: "24px" }}>
                {plan.features.map((f) => (
                  <div key={f} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 0", fontSize: "13px", color: "#565959" }}>
                    <span style={{ color: "#067D62" }}>✓</span> {f}
                  </div>
                ))}
              </div>
              <button style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "none", background: plan.popular ? "#FF9900" : "#131921", color: plan.popular ? "#131921" : "#fff", fontWeight: 700, fontSize: "14px", cursor: "pointer" }}>
                {plan.price === "مخصص" ? "اتصل بنا" : "ابدأ الاشتراك"}
              </button>
            </div>
          ))}
        </div>

        <div style={{ marginTop: "32px", background: "#fff", borderRadius: "12px", border: "1px solid #DDDDDD", padding: "24px" }}>
          <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "16px", fontWeight: 600, margin: "0 0 12px" }}>ℹ️ الاشتراك الحالي</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
            <div style={{ padding: "16px", borderRadius: "8px", background: "#F6F8F8" }}>
              <div style={{ fontSize: "12px", color: "#565959" }}>الباقة الحالية</div>
              <div style={{ fontWeight: 700, fontSize: "16px", marginTop: "4px" }}>ستارتر (مجاني)</div>
            </div>
            <div style={{ padding: "16px", borderRadius: "8px", background: "#F6F8F8" }}>
              <div style={{ fontSize: "12px", color: "#565959" }}>الحالة</div>
              <div style={{ fontWeight: 700, fontSize: "16px", marginTop: "4px", color: "#067D62" }}>نشط</div>
            </div>
            <div style={{ padding: "16px", borderRadius: "8px", background: "#F6F8F8" }}>
              <div style={{ fontSize: "12px", color: "#565959" }}>تاريخ البدء</div>
              <div style={{ fontWeight: 700, fontSize: "16px", marginTop: "4px" }}>{new Date().toLocaleDateString("ar-EG")}</div>
            </div>
            <div style={{ padding: "16px", borderRadius: "8px", background: "#F6F8F8" }}>
              <div style={{ fontSize: "12px", color: "#565959" }}>تاريخ التجديد</div>
              <div style={{ fontWeight: 700, fontSize: "16px", marginTop: "4px" }}>--</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
