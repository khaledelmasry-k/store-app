import { useState, useEffect } from "preact/compat";
import { api } from "../services/api";
import Sidebar from "../components/Sidebar";

interface TenantInvoice {
  id: string;
  name: string;
  email: string;
  plan: string;
  status: string;
  totalRevenue: number;
  confirmedRevenue: number;
  orderCount: number;
  createdAt: string;
}

export default function AdminBilling() {
  const [tenants, setTenants] = useState<TenantInvoice[]>([]);

  useEffect(() => {
    api.get<TenantInvoice[]>("/admin/tenants").then(setTenants).catch(() => {});
  }, []);

  const totalRevenue = tenants.reduce((s, t) => s + t.totalRevenue, 0);
  const confirmedRevenue = tenants.reduce((s, t) => s + t.confirmedRevenue, 0);

  return (
    <div style={{ background: "#EAEDED", minHeight: "100vh", display: "flex" }}>
      <Sidebar />
      <div className="admin-content" style={{ flex: 1, padding: "24px", minHeight: "100vh" }}>
        <div style={{ marginBottom: "32px" }}>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "24px", fontWeight: 600, color: "#0F1111", margin: 0 }}>الفواتير والإيرادات</h2>
          <p style={{ fontSize: "14px", color: "#595f68", margin: "4px 0 0" }}>سجل الفواتير والمدفوعات</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "32px" }}>
          <div style={{ background: "#fff", padding: "20px", borderRadius: "8px", border: "1px solid #DDDDDD" }}>
            <span style={{ fontSize: "28px" }}>💳</span>
            <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "24px", fontWeight: 700, color: "#131921", marginTop: "4px" }}>{tenants.length} تاجر</div>
            <div style={{ fontSize: "12px", color: "#565959" }}>إجمالي التجار</div>
          </div>
          <div style={{ background: "#fff", padding: "20px", borderRadius: "8px", border: "1px solid #DDDDDD" }}>
            <span style={{ fontSize: "28px" }}>📊</span>
            <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "24px", fontWeight: 700, color: "#131921", marginTop: "4px" }}>{totalRevenue.toLocaleString()} ج.م</div>
            <div style={{ fontSize: "12px", color: "#565959" }}>إجمالي الإيرادات</div>
          </div>
          <div style={{ background: "#fff", padding: "20px", borderRadius: "8px", border: "1px solid #DDDDDD" }}>
            <span style={{ fontSize: "28px" }}>✅</span>
            <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "24px", fontWeight: 700, color: "#067D62", marginTop: "4px" }}>{confirmedRevenue.toLocaleString()} ج.م</div>
            <div style={{ fontSize: "12px", color: "#565959" }}>الإيرادات المؤكدة</div>
          </div>
        </div>

        <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 2px 4px rgba(0,0,0,0.08)", border: "1px solid #DDDDDD" }}>
          <div style={{ padding: "20px 24px", borderBottom: "1px solid #DDDDDD" }}>
            <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "18px", fontWeight: 600, margin: 0 }}>إيرادات التجار</h3>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", textAlign: "right", borderCollapse: "collapse", fontSize: "14px" }}>
              <thead>
                <tr style={{ background: "#EBEEEE", color: "#565959", fontWeight: 600 }}>
                  <th style={{ padding: "16px", borderBottom: "1px solid #DDDDDD" }}>التاجر</th>
                  <th style={{ padding: "16px", borderBottom: "1px solid #DDDDDD" }}>الباقة</th>
                  <th style={{ padding: "16px", borderBottom: "1px solid #DDDDDD" }}>الحالة</th>
                  <th style={{ padding: "16px", borderBottom: "1px solid #DDDDDD" }}>الطلبات</th>
                  <th style={{ padding: "16px", borderBottom: "1px solid #DDDDDD" }}>الإيرادات</th>
                  <th style={{ padding: "16px", borderBottom: "1px solid #DDDDDD" }}>المؤكدة</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
                  <tr key={t.id} style={{ borderBottom: "1px solid #DDDDDD" }}>
                    <td style={{ padding: "16px" }}>
                      <div style={{ fontWeight: 700 }}>{t.name}</div>
                      <div style={{ fontSize: "12px", color: "#565959" }}>{t.email}</div>
                    </td>
                    <td style={{ padding: "16px", textTransform: "capitalize" }}>{t.plan}</td>
                    <td style={{ padding: "16px" }}>
                      <span style={{
                        padding: "4px 10px", borderRadius: "4px", fontSize: "12px", fontWeight: 700,
                        background: t.status === "ACTIVE" ? "#ECFDF5" : "#FEF2F2",
                        color: t.status === "ACTIVE" ? "#067D62" : "#B12704",
                      }}>{t.status === "ACTIVE" ? "نشط" : "موقوف"}</span>
                    </td>
                    <td style={{ padding: "16px", fontWeight: 600 }}>{t.orderCount}</td>
                    <td style={{ padding: "16px", fontWeight: 600 }}>{t.totalRevenue.toLocaleString()} ج.م</td>
                    <td style={{ padding: "16px", fontWeight: 600, color: "#067D62" }}>{t.confirmedRevenue.toLocaleString()} ج.م</td>
                  </tr>
                ))}
                {tenants.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: "48px", textAlign: "center", color: "#565959" }}>لا توجد بيانات</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
