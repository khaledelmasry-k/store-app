import { useState, useEffect } from "preact/compat";
import { api } from "../services/api";
import type { DashboardStats } from "../types";
import Sidebar from "../components/Sidebar";

export default function AdminReports() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    api.get<DashboardStats>("/admin/orders/dashboard").then(setStats).catch(() => {});
  }, []);

  const rows = [
    { label: "إجمالي الطلبات", khaled: stats?.khaledStats.totalOrders ?? 0, mahmoud: stats?.mahmoudStats.totalOrders ?? 0 },
    { label: "جديد", khaled: stats?.khaledStats.newOrders ?? 0, mahmoud: stats?.mahmoudStats.newOrders ?? 0 },
    { label: "تم التواصل", khaled: stats?.khaledStats.contactedOrders ?? 0, mahmoud: stats?.mahmoudStats.contactedOrders ?? 0 },
    { label: "قيد التجهيز", khaled: stats?.khaledStats.processingOrders ?? 0, mahmoud: stats?.mahmoudStats.processingOrders ?? 0 },
    { label: "تم الشحن", khaled: stats?.khaledStats.shippedOrders ?? 0, mahmoud: stats?.mahmoudStats.shippedOrders ?? 0 },
    { label: "تم التوصيل", khaled: stats?.khaledStats.deliveredOrders ?? 0, mahmoud: stats?.mahmoudStats.deliveredOrders ?? 0 },
    { label: "ملغي", khaled: stats?.khaledStats.cancelledOrders ?? 0, mahmoud: stats?.mahmoudStats.cancelledOrders ?? 0 },
    { label: "مسترجع", khaled: stats?.khaledStats.returnedOrders ?? 0, mahmoud: stats?.mahmoudStats.returnedOrders ?? 0 },
    { label: "المتوقع (ج.م)", khaled: stats?.khaledStats.expectedRevenue ?? 0, mahmoud: stats?.mahmoudStats.expectedRevenue ?? 0 },
    { label: "المؤكد (ج.م)", khaled: stats?.khaledStats.confirmedRevenue ?? 0, mahmoud: stats?.mahmoudStats.confirmedRevenue ?? 0 },
    { label: "الكمية (قطع)", khaled: stats?.khaledStats.totalQuantity ?? 0, mahmoud: stats?.mahmoudStats.totalQuantity ?? 0 },
  ];

  return (
    <div style={{ background: "#EAEDED", minHeight: "100vh", display: "flex" }}>
      <Sidebar />
      <div className="admin-content" style={{ flex: 1, padding: "24px", minHeight: "100vh" }}>
        <div style={{ marginBottom: "24px" }}>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "24px", fontWeight: 600, color: "#0F1111", margin: 0 }}>📊 التقارير</h2>
          <p style={{ fontSize: "14px", color: "#595f68", margin: "4px 0 0" }}>مقارنة أداء المتاجر</p>
        </div>

        <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 2px 4px rgba(0,0,0,0.08)", border: "1px solid #DDDDDD", overflow: "hidden" }}>
          <div style={{ padding: "20px 24px", borderBottom: "1px solid #DDDDDD" }}>
            <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "18px", fontWeight: 600, margin: 0 }}>مقارنة أداء المتاجر</h3>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", textAlign: "right", borderCollapse: "collapse", fontSize: "14px" }}>
              <thead>
                <tr style={{ background: "#EBEEEE", color: "#565959", fontWeight: 600 }}>
                  <th style={{ padding: "16px", borderBottom: "1px solid #DDDDDD" }}>المؤشر</th>
                  <th style={{ padding: "16px", borderBottom: "1px solid #DDDDDD", color: "#FF9900" }}>بنطلون الساحل</th>
                  <th style={{ padding: "16px", borderBottom: "1px solid #DDDDDD", color: "#067D62" }}>مالك ستور</th>
                  <th style={{ padding: "16px", borderBottom: "1px solid #DDDDDD" }}>الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label} style={{ borderBottom: "1px solid #EAEDED" }}>
                    <td style={{ padding: "14px 16px", fontWeight: 600 }}>{r.label}</td>
                    <td style={{ padding: "14px 16px" }}>{typeof r.khaled === "number" ? Number(r.khaled).toLocaleString() : r.khaled}</td>
                    <td style={{ padding: "14px 16px" }}>{typeof r.mahmoud === "number" ? Number(r.mahmoud).toLocaleString() : r.mahmoud}</td>
                    <td style={{ padding: "14px 16px", fontWeight: 700, color: "#131921" }}>{typeof r.khaled === "number" && typeof r.mahmoud === "number" ? (r.khaled + r.mahmoud).toLocaleString() : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginTop: "24px" }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "24px", border: "1px solid #DDDDDD" }}>
            <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "16px", fontWeight: 600, margin: "0 0 16px" }}>🏪 بنطلون الساحل</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              {[{ label: "الإيرادات المتوقعة", value: `${Number(stats?.khaledStats.expectedRevenue || 0).toLocaleString()} ج.م`, color: "#007185" },
                { label: "الإيرادات المؤكدة", value: `${Number(stats?.khaledStats.confirmedRevenue || 0).toLocaleString()} ج.م`, color: "#067D62" },
                { label: "إجمالي الطلبات", value: `${stats?.khaledStats.totalOrders || 0}`, color: "#131921" },
                { label: "الكمية المباعة", value: `${stats?.khaledStats.totalQuantity || 0} قطعة`, color: "#C45500" },
              ].map((item) => (
                <div key={item.label} style={{ padding: "12px", borderRadius: "8px", background: "#F6F8F8" }}>
                  <div style={{ fontSize: "18px", fontWeight: 700, color: item.color }}>{item.value}</div>
                  <div style={{ fontSize: "12px", color: "#565959" }}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "24px", border: "1px solid #DDDDDD" }}>
            <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "16px", fontWeight: 600, margin: "0 0 16px" }}>👔 مالك ستور</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              {[{ label: "الإيرادات المتوقعة", value: `${Number(stats?.mahmoudStats.expectedRevenue || 0).toLocaleString()} ج.م`, color: "#007185" },
                { label: "الإيرادات المؤكدة", value: `${Number(stats?.mahmoudStats.confirmedRevenue || 0).toLocaleString()} ج.م`, color: "#067D62" },
                { label: "إجمالي الطلبات", value: `${stats?.mahmoudStats.totalOrders || 0}`, color: "#131921" },
                { label: "الكمية المباعة", value: `${stats?.mahmoudStats.totalQuantity || 0} قطعة`, color: "#C45500" },
              ].map((item) => (
                <div key={item.label} style={{ padding: "12px", borderRadius: "8px", background: "#F6F8F8" }}>
                  <div style={{ fontSize: "18px", fontWeight: 700, color: item.color }}>{item.value}</div>
                  <div style={{ fontSize: "12px", color: "#565959" }}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>
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
      </div>
    </div>
  );
}
