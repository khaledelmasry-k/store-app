import { useState, useEffect } from "preact/compat";
import { api } from "../services/api";
import { useLocation } from "wouter";
import type { DashboardStats, SellerStats } from "../types";
import Sidebar from "../components/Sidebar";

const STATUS_BADGES: Record<string, { bg: string; color: string; label: string }> = {
  NEW: { bg: "#FEF3C7", color: "#92400E", label: "جديد" },
  CONTACTED: { bg: "#DBEAFE", color: "#1E40AF", label: "تم التواصل" },
  PROCESSING: { bg: "#FED7AA", color: "#9A3412", label: "قيد التجهيز" },
  SHIPPED: { bg: "#EDE9FE", color: "#5B21B6", label: "تم الشحن" },
  DELIVERED: { bg: "#D1FAE5", color: "#065F46", label: "تم التوصيل" },
  CANCELLED: { bg: "#FEE2E2", color: "#991B1B", label: "ملغي" },
  RETURNED: { bg: "#FCE7F3", color: "#9D174D", label: "مسترجع" },
};

export default function AdminDashboard() {
  const [, navigate] = useLocation();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [sellerStats, setSellerStats] = useState<SellerStats[]>([]);

  useEffect(() => {
    api.get<DashboardStats>("/admin/orders/dashboard").then(setStats).catch(() => {});
    api.get<SellerStats[]>("/admin/orders/seller-stats").then(setSellerStats).catch(() => {});
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

  const isSuperAdmin = stats?.isSuperAdmin ?? false;
  const storeSections = (stats?.storesStats || []).map((s, i) => ({
    ...s,
    icon: i % 2 === 0 ? "🏪" : "👔",
    border: i % 2 === 0 ? "#FF9900" : "#067D62",
    badgeBg: i % 2 === 0 ? "rgba(255,153,0,0.1)" : "rgba(6,125,98,0.1)",
    badgeText: i % 2 === 0 ? "#693c00" : "#067D62",
  }));

  return (
    <div style={{ background: "#EAEDED", minHeight: "100vh", display: "flex" }}>
      <Sidebar />
      <div className="admin-content" style={{ flex: 1, padding: "24px", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "32px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
            <div>
              <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "24px", fontWeight: 600, color: "#0F1111", margin: 0 }}>لوحة التحكم</h2>
              <p style={{ fontSize: "14px", color: "#595f68", margin: "4px 0 0" }}>نظرة عامة على أداء المتجر والطلبات اليومية</p>
            </div>
            <button onClick={() => navigate("/merchant/products/new")}
              style={{ background: "#FF9900", color: "#131921", padding: "8px 24px", borderRadius: "8px", fontWeight: 700, border: "none", cursor: "pointer", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", fontSize: "14px", display: "flex", alignItems: "center", gap: "4px", minHeight: "40px" }}>
              + إضافة منتج جديد
            </button>
          </div>
        </div>

        <div className="stats-grid">
          {cards.map((card, i) => (
            <div key={card.label} style={{ background: "#fff", padding: "16px", borderRadius: "8px", border: "1px solid #DDDDDD", display: "flex", flexDirection: "column", gap: "4px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", cursor: "default", borderRight: i === 5 ? "4px solid #C45500" : "1px solid #DDDDDD" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#FF9900"; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = i === 5 ? "#C45500" : "#DDDDDD"; (e.currentTarget as HTMLElement).style.transform = ""; }}>
              <span style={{ fontSize: "28px" }}>{card.icon}</span>
              <span className="stat-value" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "24px", fontWeight: 700, color: card.color }}>{card.value}</span>
              <span style={{ fontSize: "12px", color: "#565959" }}>{card.label}</span>
            </div>
          ))}
        </div>

        {stats && !isSuperAdmin && stats.storeName && (
          <div style={{ background: "#fff", borderRadius: "8px", borderRight: "4px solid #FF9900", boxShadow: "0 2px 4px rgba(0,0,0,0.08)", padding: "16px 24px", margin: "24px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "24px" }}>🏪</span>
              <div>
                <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "20px", fontWeight: 600, margin: 0 }}>{stats.storeName}</h3>
                <p style={{ fontSize: "13px", color: "#565959", margin: "4px 0 0" }}>إجمالي القطع المباعة: {stats.totalQuantity || 0}</p>
              </div>
            </div>
          </div>
        )}

        {stats && isSuperAdmin && storeSections.length > 0 && (
          <div className="person-grid" style={{ marginTop: "24px" }}>
            {storeSections.map((section) => (
              <div key={section.ref} style={{ background: "#fff", borderRadius: "8px", borderRight: `4px solid ${section.border}`, boxShadow: "0 2px 4px rgba(0,0,0,0.08)", padding: "24px", overflow: "hidden", position: "relative" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                  <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "20px", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px", margin: 0 }}>
                    <span>{section.icon}</span>
                    {section.name}
                  </h3>
                  <span style={{ background: section.badgeBg, color: section.badgeText, padding: "4px 12px", borderRadius: "9999px", fontSize: "12px", fontWeight: 700 }}>نشط</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "24px" }}>
                  {[
                    { label: "جديد", value: section.newOrders },
                    { label: "تواصل", value: section.contactedOrders },
                    { label: "تجهيز", value: section.processingOrders },
                    { label: "شحن", value: section.shippedOrders },
                    { label: "وصل", value: section.deliveredOrders },
                    { label: "لغى", value: section.cancelledOrders },
                    { label: "رجع", value: section.returnedOrders },
                    { label: "إجمالي", value: section.totalOrders },
                  ].map((mc) => (
                    <div key={mc.label} style={{ background: "#ebeeee", padding: "8px", borderRadius: "4px", display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <span style={{ fontSize: "12px", opacity: 0.6 }}>{mc.label}</span>
                      <span style={{ fontWeight: 700 }}>{mc.value}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "16px", borderTop: "1px solid #DDDDDD", fontSize: "14px" }}>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: "12px", color: "#565959" }}>المتوقع</span>
                    <span style={{ fontWeight: 700, color: "#007185" }}>{Number(section.expectedRevenue || 0).toLocaleString()} ج.م</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: "12px", color: "#565959" }}>المؤكد</span>
                    <span style={{ fontWeight: 700, color: "#067D62" }}>{Number(section.confirmedRevenue || 0).toLocaleString()} ج.م</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: "12px", color: "#565959" }}>القطع</span>
                    <span style={{ fontWeight: 700 }}>{section.totalQuantity || 0} قطعة</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!isSuperAdmin && sellerStats.length > 0 && (
          <div style={{ margin: "24px 0" }}>
            <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "18px", fontWeight: 600, margin: "0 0 16px" }}>إحصائيات البائعين</h3>
            <div className="person-grid">
              {sellerStats.map((s) => (
                <div key={s.id} style={{ background: "#fff", borderRadius: "8px", borderRight: "4px solid #FF9900", boxShadow: "0 2px 4px rgba(0,0,0,0.08)", padding: "20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                    <h4 style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}>{s.name}</h4>
                    <span style={{ fontSize: "13px", color: "#565959" }}>عمولة: {s.commission}%</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", marginBottom: "12px" }}>
                    {[
                      { label: "جديد", value: s.newOrders },
                      { label: "تواصل", value: s.contactedOrders },
                      { label: "تجهيز", value: s.processingOrders },
                      { label: "شحن", value: s.shippedOrders },
                      { label: "وصل", value: s.deliveredOrders },
                      { label: "لغى", value: s.cancelledOrders },
                      { label: "رجع", value: s.returnedOrders },
                      { label: "الإجمالي", value: s.totalOrders },
                    ].map((mc) => (
                      <div key={mc.label} style={{ background: "#ebeeee", padding: "6px", borderRadius: "4px", textAlign: "center" }}>
                        <span style={{ fontSize: "11px", opacity: 0.6, display: "block" }}>{mc.label}</span>
                        <span style={{ fontWeight: 700, fontSize: "15px" }}>{mc.value}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "12px", borderTop: "1px solid #DDDDDD", fontSize: "13px" }}>
                    <span>المتوقع: <strong>{s.totalRevenue.toLocaleString()} ج.م</strong></span>
                    <span>المؤكد: <strong style={{ color: "#067D62" }}>{s.confirmedRevenue.toLocaleString()} ج.م</strong></span>
                    <span>القطع: <strong>{s.totalQuantity}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {stats?.recentOrders && stats.recentOrders.length > 0 && (
          <section style={{ background: "#fff", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.08)", border: "1px solid #DDDDDD", marginBottom: "24px" }}>
            <div style={{ padding: "24px", borderBottom: "1px solid #DDDDDD", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "18px", fontWeight: 600, margin: 0 }}>🕐 آخر الطلبات</h3>
              <a onClick={() => navigate(isSuperAdmin ? "/super-admin/orders" : "/merchant/orders")} style={{ color: "#007185", fontSize: "13px", fontWeight: 600, cursor: "pointer", textDecoration: "none" }}>عرض الكل →</a>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                <thead>
                  <tr style={{ background: "#f4f4f5", color: "#555", fontWeight: 600 }}>
                    <th style={{ padding: "12px 16px", textAlign: "right" }}>رقم الطلب</th>
                    <th style={{ padding: "12px 16px", textAlign: "right" }}>العميل</th>
                    <th style={{ padding: "12px 16px", textAlign: "right" }}>رقم الهاتف</th>
                    <th style={{ padding: "12px 16px", textAlign: "right" }}>المبلغ</th>
                    <th style={{ padding: "12px 16px", textAlign: "center" }}>الحالة</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", direction: "ltr" }}>التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentOrders.map((o) => {
                    const badge = STATUS_BADGES[o.status] || { bg: "#F3F4F6", color: "#374151", label: o.status };
                    return (
                      <tr key={o.id} style={{ borderBottom: "1px solid #EAEDED" }}>
                        <td style={{ padding: "12px 16px", direction: "ltr", textAlign: "right", fontWeight: 600 }}>#{o.orderNumber}</td>
                        <td style={{ padding: "12px 16px" }}>{o.customerName}</td>
                        <td style={{ padding: "12px 16px", direction: "ltr", textAlign: "right" }}>{o.phone}</td>
                        <td style={{ padding: "12px 16px", fontWeight: 600 }}>{o.totalPrice.toLocaleString()} ج.م</td>
                        <td style={{ padding: "12px 16px", textAlign: "center" }}>
                          <span style={{ padding: "2px 8px", borderRadius: "4px", fontSize: "12px", fontWeight: 700, background: badge.bg, color: badge.color }}>{badge.label}</span>
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: "12px", color: "#565959", textAlign: "left", direction: "ltr" }}>{new Date(o.createdAt).toLocaleDateString("ar-EG")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section style={{ background: "#fff", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.08)", border: "1px solid #DDDDDD", marginBottom: "48px" }}>
          <div style={{ padding: "24px", borderBottom: "1px solid #DDDDDD", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "20px", fontWeight: 600, margin: 0 }}>📦 حالة المخزون</h3>
              <span style={{ background: "#067D62", color: "#fff", fontSize: "12px", padding: "4px 12px", borderRadius: "9999px", fontWeight: 500 }}>إجمالي القطع: {stats?.totalStock || 0}</span>
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", textAlign: "right", borderCollapse: "collapse", fontSize: "14px" }}>
              <thead>
                <tr style={{ background: "#EBEEEE", color: "#565959", fontWeight: 600 }}>
                  <th style={{ padding: "16px", borderBottom: "1px solid #DDDDDD" }}>اللون</th>
                  {stats?.variantStock && Object.keys(stats.variantStock).length > 0 && Object.keys(Object.values(stats.variantStock)[0] || {}).map((size: string) => (
                    <th key={size} style={{ padding: "16px", borderBottom: "1px solid #DDDDDD" }}>{size}</th>
                  ))}
                  <th style={{ padding: "16px", borderBottom: "1px solid #DDDDDD" }}>الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {stats?.variantStock && Object.entries(stats.variantStock).map(([color, sizes]) => {
                  const rowTotal = Object.values(sizes).reduce((a: number, b: number) => a + b, 0);
                  return (
                    <tr key={color} style={{ borderBottom: "1px solid #DDDDDD" }} className="hover:bg-surface-container-low transition-colors">
                      <td style={{ padding: "16px", borderBottom: "1px solid #DDDDDD", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
                        <div style={{ width: "16px", height: "16px", borderRadius: "50%", background: color.includes("أسود") ? "#000" : color.includes("رماد") ? "#36454F" : color.includes("بيج") ? "#C2B280" : color.includes("كح") ? "#000080" : "#888" }}></div>
                        {color}
                      </td>
                      {Object.entries(sizes as Record<string, number>).map(([size, qty]) => (
                        <td key={size} style={{ padding: "16px", borderBottom: "1px solid #DDDDDD", color: qty < 5 ? "#B12704" : "#0F1111", fontWeight: qty < 5 ? 700 : 400 }}>
                          {qty}
                        </td>
                      ))}
                      <td style={{ padding: "16px", borderBottom: "1px solid #DDDDDD", fontWeight: 700 }}>{rowTotal}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ padding: "16px", background: "#F1F4F4", textAlign: "center" }}>
            <button style={{ color: "#007185", fontWeight: 700, border: "none", background: "none", cursor: "pointer", fontSize: "14px" }}>تحميل تقرير المخزون الكامل (CSV)</button>
          </div>
        </section>

        <footer style={{ width: "100%", padding: "32px 0", marginTop: "auto", borderTop: "1px solid #DDDDDD", background: "#E0E3E3", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px" }}>
          <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "20px", fontWeight: 700, color: "#0F1111" }}>M&K Store</div>
          <div style={{ display: "flex", gap: "24px", fontSize: "12px" }}>
            <a href="#" style={{ color: "#565959", textDecoration: "none" }}>سياسة الخصوصية</a>
            <a href="#" style={{ color: "#565959", textDecoration: "none" }}>شروط الخدمة</a>
            <a href="#" style={{ color: "#565959", textDecoration: "none" }}>اتصل بنا</a>
          </div>
          <p style={{ fontSize: "14px", color: "#565959", opacity: 0.8, margin: 0 }}>© 2025 M&K Store. جميع الحقوق محفوظة.</p>
        </footer>
      </div>
    </div>
  );
}
