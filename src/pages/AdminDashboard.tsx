import { useState, useEffect } from "preact/compat";
import { api } from "../services/api";
import type { DashboardStats, PersonStats } from "../types";
import Sidebar from "../components/Sidebar";

function PersonSection({ name, stats, bgColor, textColor }: { name: string; stats: PersonStats; bgColor: string; textColor: string }) {
  const cards = [
    { label: "إجمالي", value: stats.totalOrders, icon: "📋" },
    { label: "جديد", value: stats.newOrders, icon: "🆕" },
    { label: "تم التواصل", value: stats.contactedOrders, icon: "📞" },
    { label: "قيد المعالجة", value: stats.processingOrders, icon: "🔄" },
    { label: "تم الشحن", value: stats.shippedOrders, icon: "🚚" },
    { label: "تم التوصيل", value: stats.deliveredOrders, icon: "✅" },
    { label: "ملغى", value: stats.cancelledOrders, icon: "❌" },
  ];

  return (
    <div style={{ background: bgColor, borderRadius: "8px", padding: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
      <h3 style={{ fontSize: "16px", fontWeight: 600, margin: "0 0 12px", color: textColor }}>{name}</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: "8px", marginBottom: "12px" }}>
        {cards.map((c) => (
          <div key={c.label} style={{ background: "white", borderRadius: "6px", padding: "10px", textAlign: "center" }}>
            <div style={{ fontSize: "20px", marginBottom: "4px" }}>{c.icon}</div>
            <div style={{ fontSize: "20px", fontWeight: 700, color: textColor }}>{c.value}</div>
            <div style={{ fontSize: "11px", color: "#71717a" }}>{c.label}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: "8px", fontSize: "13px", flexWrap: "wrap" }}>
        <div style={{ background: "white", borderRadius: "6px", padding: "8px 12px", flex: "1 1 100px", textAlign: "center" }}>
          <span style={{ color: "#71717a" }}>متوقع: </span>
          <strong style={{ color: textColor }}>{stats.expectedRevenue.toLocaleString()} ج.م</strong>
        </div>
        <div style={{ background: "white", borderRadius: "6px", padding: "8px 12px", flex: "1 1 100px", textAlign: "center" }}>
          <span style={{ color: "#71717a" }}>مؤكد: </span>
          <strong style={{ color: textColor }}>{stats.confirmedRevenue.toLocaleString()} ج.م</strong>
        </div>
        <div style={{ background: "white", borderRadius: "6px", padding: "8px 12px", flex: "1 1 100px", textAlign: "center" }}>
          <span style={{ color: "#71717a" }}>بنطلونات: </span>
          <strong style={{ color: textColor }}>{stats.totalQuantity}</strong>
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    api.get<DashboardStats>("/admin/orders/dashboard").then(setStats);
  }, []);

  const cards = stats
    ? [
      { label: "إجمالي الطلبات", value: stats.totalOrders, icon: "📋", color: "#1a1b22" },
      { label: "إيرادات متوقعة", value: stats.expectedRevenue.toLocaleString() + " ج.م", icon: "💰", color: "#2563eb" },
      { label: "إيرادات مؤكدة", value: stats.confirmedRevenue.toLocaleString() + " ج.م", icon: "✅", color: "#006e2f" },
      { label: "جديد", value: stats.newOrders, icon: "🆕", color: "#006e2f" },
      { label: "تم التواصل", value: stats.contactedOrders, icon: "📞", color: "#2563eb" },
      { label: "قيد المعالجة", value: stats.processingOrders, icon: "🔄", color: "#d97706" },
      { label: "تم الشحن", value: stats.shippedOrders, icon: "🚚", color: "#7c3aed" },
      { label: "تم التوصيل", value: stats.deliveredOrders, icon: "✅", color: "#006e2f" },
      { label: "ملغى", value: stats.cancelledOrders, icon: "❌", color: "#ba1a1a" },
    ]
    : [];

  const vs = stats?.variantStock || {};
  const colors = Object.keys(vs);

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif", direction: "rtl", background: "#fbf8ff", minHeight: "100vh", display: "flex" }}>
      <Sidebar />
      <div className="admin-content" style={{ flex: 1, padding: "24px", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ width: "100%", maxWidth: "1000px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
            <div>
              <h1 style={{ fontSize: "24px", fontWeight: 600, margin: 0 }}>لوحة التحكم</h1>
              <p style={{ fontSize: "14px", color: "#71717a", margin: "4px 0 0" }}>نظرة عامة على أداء المتجر</p>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "16px", marginBottom: "24px" }}>
            {cards.map((card) => (
              <div key={card.label} style={{ background: "white", borderRadius: "8px", padding: "20px", textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                <div style={{ fontSize: "28px", marginBottom: "8px" }}>{card.icon}</div>
                <div style={{ fontSize: "32px", fontWeight: 700, color: card.color }}>{card.value}</div>
                <div style={{ fontSize: "14px", color: "#71717a", marginTop: "4px" }}>{card.label}</div>
              </div>
            ))}
          </div>

          {stats && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: "16px", marginBottom: "24px" }}>
              <PersonSection name="🧑‍💼 طلبات بنطلون الساحل" stats={stats.khaledStats} bgColor="#fff7ed" textColor="#c2410c" />
              <PersonSection name="🧑‍💼 طلبات مالك ستور" stats={stats.mahmoudStats} bgColor="#f0fdf4" textColor="#006e2f" />
            </div>
          )}

          <div style={{ background: "white", borderRadius: "8px", padding: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 600, margin: "0 0 16px" }}>📦 حالة المخزون</h3>
            <p style={{ fontSize: "14px", color: "#71717a", margin: "0 0 12px" }}>
              إجمالي المخزون: <strong style={{ color: "#006e2f" }}>{stats?.totalStock ?? 0}</strong> قطعة
            </p>
            {colors.length > 0 && (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                  <thead>
                    <tr>
                      <th style={{ padding: "8px 12px", textAlign: "right", borderBottom: "2px solid #e4e4e7", color: "#71717a", fontWeight: 500 }}>اللون</th>
                      {Object.keys(vs[colors[0]] || {}).map((s) => (
                        <th key={s} style={{ padding: "8px 12px", textAlign: "center", borderBottom: "2px solid #e4e4e7", color: "#71717a", fontWeight: 500 }}>{s}</th>
                      ))}
                      <th style={{ padding: "8px 12px", textAlign: "center", borderBottom: "2px solid #e4e4e7", color: "#71717a", fontWeight: 500 }}>المجموع</th>
                    </tr>
                  </thead>
                  <tbody>
                    {colors.map((c) => {
                      const sizes = vs[c];
                      const rowTotal = Object.values(sizes).reduce((a, b) => a + b, 0);
                      return (
                        <tr key={c}>
                          <td style={{ padding: "8px 12px", fontWeight: 600, borderBottom: "1px solid #f4f4f5" }}>{c}</td>
                          {Object.entries(sizes).map(([sz, qty]) => (
                            <td key={sz} style={{ padding: "8px 12px", textAlign: "center", borderBottom: "1px solid #f4f4f5", color: qty === 0 ? "#ba1a1a" : "inherit" }}>
                              {qty}{qty === 0 ? " (نفد)" : ""}
                            </td>
                          ))}
                          <td style={{ padding: "8px 12px", textAlign: "center", fontWeight: 600, borderBottom: "1px solid #f4f4f5" }}>{rowTotal}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
