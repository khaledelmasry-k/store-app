import { useState, useEffect } from "preact/compat";
import { api } from "../services/api";
import type { DashboardStats } from "../types";
import Sidebar from "../components/Sidebar";

export default function AdminReports() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    api.get<DashboardStats>("/admin/orders/dashboard").then(setStats).catch(() => {});
  }, []);

  const storeStats = stats?.storesStats ?? [];

  const rows = storeStats.length > 0
    ? [
        { label: "إجمالي الطلبات", items: storeStats.map((s) => ({ name: s.name, value: s.totalOrders })) },
        { label: "جديد", items: storeStats.map((s) => ({ name: s.name, value: s.newOrders })) },
        { label: "تم التواصل", items: storeStats.map((s) => ({ name: s.name, value: s.contactedOrders })) },
        { label: "قيد التجهيز", items: storeStats.map((s) => ({ name: s.name, value: s.processingOrders })) },
        { label: "تم الشحن", items: storeStats.map((s) => ({ name: s.name, value: s.shippedOrders })) },
        { label: "تم التوصيل", items: storeStats.map((s) => ({ name: s.name, value: s.deliveredOrders })) },
        { label: "ملغي", items: storeStats.map((s) => ({ name: s.name, value: s.cancelledOrders })) },
        { label: "مسترجع", items: storeStats.map((s) => ({ name: s.name, value: s.returnedOrders })) },
        { label: "المتوقع (ج.م)", items: storeStats.map((s) => ({ name: s.name, value: s.expectedRevenue })) },
        { label: "المؤكد (ج.م)", items: storeStats.map((s) => ({ name: s.name, value: s.confirmedRevenue })) },
        { label: "الكمية (قطع)", items: storeStats.map((s) => ({ name: s.name, value: s.totalQuantity })) },
      ]
    : [];

  return (
    <div style={{ background: "#EAEDED", minHeight: "100vh", display: "flex" }}>
      <Sidebar />
      <div className="admin-content" style={{ flex: 1, padding: "24px", minHeight: "100vh" }}>
        <div style={{ marginBottom: "24px" }}>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "24px", fontWeight: 600, color: "#0F1111", margin: 0 }}>📊 التقارير</h2>
          <p style={{ fontSize: "14px", color: "#595f68", margin: "4px 0 0" }}>مقارنة أداء المتاجر</p>
        </div>

        {storeStats.length > 0 && (
          <>
            <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 2px 4px rgba(0,0,0,0.08)", border: "1px solid #DDDDDD", overflow: "hidden" }}>
              <div style={{ padding: "20px 24px", borderBottom: "1px solid #DDDDDD" }}>
                <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "18px", fontWeight: 600, margin: 0 }}>مقارنة أداء المتاجر</h3>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", textAlign: "right", borderCollapse: "collapse", fontSize: "14px" }}>
                  <thead>
                    <tr style={{ background: "#EBEEEE", color: "#565959", fontWeight: 600 }}>
                      <th style={{ padding: "16px", borderBottom: "1px solid #DDDDDD" }}>المؤشر</th>
                      {storeStats.map((s, i) => (
                        <th key={s.ref} style={{ padding: "16px", borderBottom: "1px solid #DDDDDD", color: i % 2 === 0 ? "#FF9900" : "#067D62" }}>{s.name}</th>
                      ))}
                      <th style={{ padding: "16px", borderBottom: "1px solid #DDDDDD" }}>الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.label} style={{ borderBottom: "1px solid #EAEDED" }}>
                        <td style={{ padding: "14px 16px", fontWeight: 600 }}>{r.label}</td>
                        {r.items.map((item) => (
                          <td key={item.name} style={{ padding: "14px 16px" }}>{Number(item.value).toLocaleString()}</td>
                        ))}
                        <td style={{ padding: "14px 16px", fontWeight: 700, color: "#131921" }}>{r.items.reduce((a, b) => a + Number(b.value), 0).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: `repeat(${storeStats.length}, 1fr)`, gap: "24px", marginTop: "24px" }}>
              {storeStats.map((s, i) => {
                const colors = ["#FF9900", "#067D62", "#007185", "#7C3AED"];
                return (
                  <div key={s.ref} style={{ background: "#fff", borderRadius: "12px", padding: "24px", border: "1px solid #DDDDDD" }}>
                    <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "16px", fontWeight: 600, margin: "0 0 16px" }}>{i % 2 === 0 ? "🏪" : "👔"} {s.name}</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                      {[
                        { label: "الإيرادات المتوقعة", value: `${Number(s.expectedRevenue || 0).toLocaleString()} ج.م`, color: colors[i % colors.length] },
                        { label: "الإيرادات المؤكدة", value: `${Number(s.confirmedRevenue || 0).toLocaleString()} ج.م`, color: "#067D62" },
                        { label: "إجمالي الطلبات", value: `${s.totalOrders || 0}`, color: "#131921" },
                        { label: "الكمية المباعة", value: `${s.totalQuantity || 0} قطعة`, color: "#C45500" },
                      ].map((item) => (
                        <div key={item.label} style={{ padding: "12px", borderRadius: "8px", background: "#F6F8F8" }}>
                          <div style={{ fontSize: "18px", fontWeight: 700, color: item.color }}>{item.value}</div>
                          <div style={{ fontSize: "12px", color: "#565959" }}>{item.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ background: "#fff", borderRadius: "12px", padding: "24px", border: "1px solid #DDDDDD", marginTop: "24px" }}>
              <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "16px", fontWeight: 600, margin: "0 0 16px" }}>📈 ملخص سريع</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}>
                {[
                  { label: "إجمالي الإيرادات المتوقعة", value: `${Number(stats?.expectedRevenue || 0).toLocaleString()} ج.م`, color: "#007185" },
                  { label: "إجمالي الإيرادات المؤكدة", value: `${Number(stats?.confirmedRevenue || 0).toLocaleString()} ج.م`, color: "#067D62" },
                  { label: "المخزون المتبقي", value: `${stats?.totalStock || 0} قطعة`, color: "#131921" },
                  { label: "التوصيل", value: `${stats?.deliveredOrders || 0} طلب`, color: "#067D62" },
                ].map((item) => (
                  <div key={item.label} style={{ textAlign: "center", padding: "16px", borderRadius: "8px", background: "#F6F8F8" }}>
                    <div style={{ fontSize: "22px", fontWeight: 700, color: item.color }}>{item.value}</div>
                    <div style={{ fontSize: "12px", color: "#565959", marginTop: "4px" }}>{item.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {storeStats.length === 0 && (
          <div style={{ background: "#fff", borderRadius: "12px", padding: "48px", textAlign: "center", border: "1px solid #DDDDDD" }}>
            <p style={{ color: "#565959", fontSize: "16px" }}>لا توجد بيانات متاحة. قم بإضافة متاجر لعرض التقارير.</p>
          </div>
        )}
      </div>
    </div>
  );
}
