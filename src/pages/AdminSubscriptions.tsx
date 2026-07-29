import { useState, useEffect } from "preact/compat";
import { api } from "../services/api";
import Sidebar from "../components/Sidebar";

interface Plan {
  name: string;
  price: number;
  features: string[];
  popular?: boolean;
  custom?: boolean;
}

interface SubscriptionRequest {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  plan: string;
  price: number;
  status: string;
  createdAt: string;
}

export default function AdminSubscriptions() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [requests, setRequests] = useState<SubscriptionRequest[]>([]);

  useEffect(() => {
    api.get<Plan[]>("/subscriptions/plans").then(setPlans).catch(() => {});
    api.get<SubscriptionRequest[]>("/subscriptions/admin/requests").then(setRequests).catch(() => {});
  }, []);

  const approveRequest = async (id: string) => {
    await api.patch(`/subscriptions/admin/requests/${id}`, { status: "APPROVED" });
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: "APPROVED" } : r)));
  };

  const declineRequest = async (id: string) => {
    await api.patch(`/subscriptions/admin/requests/${id}`, { status: "DECLINED" });
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: "DECLINED" } : r)));
  };

  return (
    <div style={{ background: "#EAEDED", minHeight: "100vh", display: "flex" }}>
      <Sidebar />
      <div className="admin-content" style={{ flex: 1, padding: "24px", minHeight: "100vh" }}>
        <div style={{ marginBottom: "32px" }}>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "24px", fontWeight: 600, color: "#0F1111", margin: 0 }}>الباقات والاشتراكات</h2>
          <p style={{ fontSize: "14px", color: "#595f68", margin: "4px 0 0" }}>اختر الباقة المناسبة لاحتياجات متجرك</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "24px" }}>
          {plans.map((plan) => (
            <div key={plan.name} style={{ background: "#fff", borderRadius: "16px", border: plan.popular ? "2px solid #FF9900" : "1px solid #DDDDDD", padding: "32px 24px", position: "relative", boxShadow: plan.popular ? "0 8px 24px rgba(255,153,0,0.15)" : "0 2px 8px rgba(0,0,0,0.04)" }}>
              {plan.popular && <div style={{ position: "absolute", top: "-12px", left: "50%", transform: "translateX(-50%)", background: "#FF9900", color: "#131921", padding: "4px 20px", borderRadius: "9999px", fontSize: "11px", fontWeight: 800 }}>الأكثر طلباً</div>}
              <h3 style={{ fontSize: "20px", fontWeight: 700, margin: "0 0 4px", textTransform: "capitalize" }}>{plan.name}</h3>
              <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "32px", fontWeight: 800, color: "#131921", margin: "16px 0" }}>
                {plan.custom ? "مخصص" : `${plan.price.toLocaleString()} ج.م`}
              </div>
              {!plan.custom && <p style={{ fontSize: "13px", color: "#565959", margin: "-8px 0 24px" }}>/ شهرياً</p>}
              <div style={{ marginBottom: "24px" }}>
                {plan.features.map((f) => (
                  <div key={f} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 0", fontSize: "13px", color: "#565959" }}>
                    <span style={{ color: "#067D62" }}>✓</span> {f}
                  </div>
                ))}
              </div>
              <button style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "none", background: plan.popular ? "#FF9900" : "#131921", color: plan.popular ? "#131921" : "#fff", fontWeight: 700, fontSize: "14px", cursor: "pointer" }}>
                {plan.custom ? "اتصل بنا" : "ابدأ الاشتراك"}
              </button>
            </div>
          ))}
        </div>

        <div style={{ marginTop: "32px", background: "#fff", borderRadius: "12px", border: "1px solid #DDDDDD", padding: "24px" }}>
          <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "16px", fontWeight: 600, margin: "0 0 12px" }}>طلبات الاشتراك</h3>
          {requests.length === 0 ? (
            <p style={{ color: "#565959", fontSize: "14px" }}>لا توجد طلبات اشتراك</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                <thead>
                  <tr style={{ background: "#f4f4f5", color: "#555", fontWeight: 600 }}>
                    <th style={{ padding: "12px 16px", textAlign: "right" }}>الاسم</th>
                    <th style={{ padding: "12px 16px", textAlign: "right" }}>البريد</th>
                    <th style={{ padding: "12px 16px", textAlign: "right" }}>الباقة</th>
                    <th style={{ padding: "12px 16px", textAlign: "right" }}>الحالة</th>
                    <th style={{ padding: "12px 16px", textAlign: "right" }}>التاريخ</th>
                    <th style={{ padding: "12px 16px", textAlign: "center" }}>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.id} style={{ borderBottom: "1px solid #EAEDED" }}>
                      <td style={{ padding: "16px", fontWeight: 700 }}>{r.name}</td>
                      <td style={{ padding: "16px" }}>{r.email}</td>
                      <td style={{ padding: "16px", textTransform: "capitalize" }}>{r.plan}</td>
                      <td style={{ padding: "16px" }}>
                        <span style={{
                          padding: "4px 10px", borderRadius: "4px", fontSize: "12px", fontWeight: 700,
                          background: r.status === "PENDING" ? "#FFF7ED" : r.status === "APPROVED" ? "#ECFDF5" : "#FEF2F2",
                          color: r.status === "PENDING" ? "#C45500" : r.status === "APPROVED" ? "#067D62" : "#B12704",
                        }}>
                          {r.status === "PENDING" ? "قيد المراجعة" : r.status === "APPROVED" ? "تم الموافقة" : "مرفوض"}
                        </span>
                      </td>
                      <td style={{ padding: "16px", color: "#565959", fontSize: "13px" }}>{new Date(r.createdAt).toLocaleDateString("en-CA")}</td>
                      <td style={{ padding: "16px", textAlign: "center" }}>
                        {r.status === "PENDING" && (
                          <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                            <button onClick={() => approveRequest(r.id)}
                              style={{ background: "#067D62", color: "#fff", border: "none", borderRadius: "6px", padding: "6px 12px", fontWeight: 700, cursor: "pointer", fontSize: "12px" }}>
                              موافقة
                            </button>
                            <button onClick={() => declineRequest(r.id)}
                              style={{ background: "#B12704", color: "#fff", border: "none", borderRadius: "6px", padding: "6px 12px", fontWeight: 700, cursor: "pointer", fontSize: "12px" }}>
                              رفض
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ marginTop: "32px", background: "#fff", borderRadius: "12px", border: "1px solid #DDDDDD", padding: "24px" }}>
          <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "16px", fontWeight: 600, margin: "0 0 12px" }}>الاشتراك الحالي</h3>
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
