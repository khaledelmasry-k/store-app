import { useState, useEffect } from "preact/compat";
import { api } from "../services/api";
import Sidebar from "../components/Sidebar";
import type { DashboardStats } from "../types";

export default function SellerDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    api.get<DashboardStats>("/seller/dashboard").then(setStats).catch(() => {});
  }, []);

  const cards = [
    { icon: "📦", label: "إجمالي الطلبات", value: stats?.totalOrders?.toLocaleString() || "...", color: "#131921" },
    { icon: "💰", label: "الأرباح المتوقعة", value: stats?.expectedRevenue ? `${Number(stats.expectedRevenue).toLocaleString()} ج.م` : "...", color: "#007185" },
    { icon: "✅", label: "طلبات مؤكدة", value: stats?.confirmedOrders?.toLocaleString() || "...", color: "#067D62" },
    { icon: "✨", label: "طلبات جديدة", value: stats?.newOrders?.toLocaleString() || "...", color: "#067D62" },
    { icon: "📞", label: "تم التواصل", value: stats?.contactedOrders?.toLocaleString() || "...", color: "#007185" },
    { icon: "⚙️", label: "قيد التجهيز", value: stats?.processingOrders?.toLocaleString() || "...", color: "#C45500" },
    { icon: "🚚", label: "تم الشحن", value: stats?.shippedOrders?.toLocaleString() || "...", color: "#7C3AED" },
    { icon: "🏠", label: "تم التوصيل", value: stats?.deliveredOrders?.toLocaleString() || "...", color: "#067D62" },
    { icon: "❌", label: "طلبات ملغاة", value: stats?.cancelledOrders?.toLocaleString() || "...", color: "#B12704" },
    { icon: "🔄", label: "طلبات مسترجعة", value: stats?.returnedOrders?.toLocaleString() || "...", color: "#A855F7" },
  ];

  return (
    <div style={{ background: "#EAEDED", minHeight: "100vh", display: "flex" }}>
      <Sidebar />
      <div className="admin-content" style={{ flex: 1, padding: "24px", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "32px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
            <div>
              <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "24px", fontWeight: "600", color: "#0F1111", margin: 0 }}>لوحة التحكم - تاجر</h2>
              <p style={{ fontSize: "14px", color: "#595f68", margin: "4px 0 0" }}>نظرة عامة على أداء متجرك الخاص</p>
            </div>
            <button style={{ background: "#FF9900", color: "#131921", padding: "8px 24px", borderRadius: "8px", fontWeight: "700", border: "none", cursor: "pointer", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", fontSize: "14px", display: "flex", alignItems: "center", gap: "4px", minHeight: "40px" }} onClick={() => {}}>
              + إضافة منتج جديد
            </button>
          </div>
        </div>

        <div className="stats-grid">
          {cards.map((card, i) => (
            <div key={card.label} style={{ background: "#fff", padding: "16px", borderRadius: "8px", border: "1px solid #DDDDDD", display: "flex", flexDirection: "column", gap: "4px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", cursor: "default", borderRight: i === 5 ? "4px solid #C45500" : "1px solid #DDDDDD" }}>
              <span style={{ fontSize: "28px" }}>{card.icon}</span>
              <span className="stat-value" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "24px", fontWeight: "700", color: card.color }}>{card.value}</span>
              <span style={{ fontSize: "12px", color: "#565959" }}>{card.label}</span>
            </div>
          ))}
        </div>

        {stats && !stats.isSuperAdmin && stats.storeName && (
          <div style={{ background: "#fff", borderRadius: "8px", borderRight: "4px solid #FF9900", boxShadow: "0 2px 4px rgba(0,0,0,0.08)", padding: "16px 24px", marginBottom: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "24px" }}>🏪</span>
              <div>
                <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "20px", fontWeight: "600", margin: 0 }}>{stats.storeName}</h3>
                <p style={{ fontSize: "13px", color: "#565959", margin: "4px 0 0" }}>إجمالي القطع المباعة: {stats.totalQuantity || 0}</p>
              </div>
            </div>
          </div>
        )}

        <div className="person-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "24px", marginTop: "24px" }}></div>

        <section style={{ background: "#fff", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.08)", border: "1px solid #DDDDDD", marginBottom: "48px", marginTop: "24px" }}>
          <div style={{ padding: "24px", borderBottom: "1px solid #DDDDDD", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "20px", fontWeight: "600", margin: 0 }}>📦 حالة المخزون</h3>
              <span style={{ background: "#067D62", color: "#fff", fontSize: "12px", padding: "4px 12px", borderRadius: "9999px", fontWeight: "500" }}>إجمالي القطع: {stats?.totalStock || 0}</span>
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", textAlign: "right", borderCollapse: "collapse", fontSize: "14px" }}>
              <thead>
                <tr style={{ background: "#F1F4F4", color: "#565959", fontWeight: "600" }}>
                  <th style={{ padding: "16px", borderBottom: "1px solid #DDDDDD" }}>اللون</th>
                  {stats?.variantStock && Object.keys(stats.variantStock).length > 0 && Object.keys(Object.values(stats.variantStock)[0] || {}).map((size) => (
                    <th key={size} style={{ padding: "16px", borderBottom: "1px solid #DDDDDD" }}>{size}</th>
                  ))}
                  <th style={{ padding: "16px", borderBottom: "1px solid #DDDDDD" }}>الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {stats?.variantStock && Object.entries(stats.variantStock).map(([color, sizes]) => {
                  const rowTotal = Object.values(sizes).reduce((a: number, b: number) => a + b, 0);
                  return (
                    <tr key={color} style={{ borderBottom: "1px solid #DDDDDD" }}>
                      <td style={{ padding: "16px", borderBottom: "1px solid #DDDDDD", fontWeight: "700", display: "flex", alignItems: "center", gap: "8px" }}>
                        <div style={{ width: "16px", height: "16px", borderRadius: "50%", background: color.includes("أسود") ? "#000" : color.includes("رماد") ? "#36454F" : color.includes("بيج") ? "#C2B280" : color.includes("كح") ? "#000080" : "#888" }}></div>
                        {color}
                      </td>
                      {Object.entries(sizes).map(([size, qty]) => (
                        <td key={size} style={{ padding: "16px", borderBottom: "1px solid #DDDDDD", color: qty < 5 ? "#B12704" : "#0F1111", fontWeight: qty < 5 ? "700" : "400" }}>{qty}</td>
                      ))}
                      <td style={{ padding: "16px", borderBottom: "1px solid #DDDDDD", fontWeight: "700" }}>{rowTotal}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ padding: "16px", background: "#F1F4F4", textAlign: "center" }}>
            <button style={{ color: "#007185", fontWeight: "700", border: "none", background: "none", cursor: "pointer", fontSize: "14px" }}>تحميل تقرير المخزون الكامل (CSV)</button>
          </div>
        </section>

        <footer style={{ width: "100%", padding: "32px 0", marginTop: "auto", borderTop: "1px solid #DDDDDD", background: "#E0E3E3", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px" }}>
          <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "20px", fontWeight: "700", color: "#0F1111" }}>M&K Store</div>
          <div style={{ display: "flex", gap: "24px", fontSize: "12px" }}>
            <a href="#" style={{ color: "#565959", textDecoration: "none" }}>سياسة الخصوصية</a>
            <a href="#" style={{ color: "#565959", textDecoration: "none" }}>شروط الخدمة</a>
            <a href="#" style={{ color: "#565959", textDecoration: "none" }}>اتصل بنا</a>
          </div>
          <p style={{ fontSize: "14px", color: "#565959", opacity: "0.8", margin: 0 }}>© 2025 M&K Store. جميع الحقوق محفوظة.</p>
        </footer>
      </div>
    </div>
  );
}