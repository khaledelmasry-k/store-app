import { useState, useEffect } from "preact/compat";
import { api, API_BASE } from "../services/api";
import Sidebar from "../components/Sidebar";

interface Summary {
  totalOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
  byStatus: Record<string, number>;
}

interface PeriodRow {
  date: string;
  orders: number;
  revenue: number;
}

interface PeriodResponse {
  period: string;
  data: PeriodRow[];
}

type Period = "daily" | "weekly" | "monthly";

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function thirtyDaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const exportCSV = () => {
  const token = localStorage.getItem("token");
  window.open(`${API_BASE}/merchant/reports/export-csv?token=${token}`, "_blank");
};

export default function MerchantReports() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [period, setPeriod] = useState<Period>("daily");
  const [dateFrom, setDateFrom] = useState(thirtyDaysAgo);
  const [dateTo, setDateTo] = useState(todayISO);
  const [rows, setRows] = useState<PeriodRow[]>([]);

  const fetchSummary = () => {
    api.get<Summary>(`/merchant/reports/summary?dateFrom=${dateFrom}&dateTo=${dateTo}`)
      .then(setSummary).catch(() => {});
  };

  const fetchPeriod = () => {
    api.get<PeriodResponse>(`/merchant/reports/period?period=${period}&dateFrom=${dateFrom}&dateTo=${dateTo}`)
      .then((r) => setRows(r.data)).catch(() => {});
  };

  useEffect(() => { fetchSummary(); }, [dateFrom, dateTo]);
  useEffect(() => { fetchPeriod(); }, [period, dateFrom, dateTo]);

  return (
    <div style={{ background: "#EAEDED", minHeight: "100vh", display: "flex" }}>
      <Sidebar />
      <div className="admin-content" style={{ flex: 1, padding: "24px", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <header style={{ marginBottom: "24px" }}>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "24px", fontWeight: 600, color: "#0F1111", margin: 0 }}>
            <span class="material-symbols-outlined" style={{ verticalAlign: "middle", marginLeft: "8px" }}>assessment</span>
            التقارير
          </h2>
          <p style={{ fontSize: "14px", color: "#595f68", margin: "4px 0 0" }}>تقارير المبيعات والأداء</p>
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "24px" }}>
          <div style={{ background: "#fff", padding: "20px", borderRadius: "8px", border: "1px solid #DDDDDD" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: "13px", color: "#565959", fontWeight: 500 }}>إجمالي الطلبات</div>
                <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "28px", fontWeight: 700, color: "#0F1111", marginTop: "4px" }}>
                  {summary?.totalOrders ?? "—"}
                </div>
              </div>
              <span class="material-symbols-outlined" style={{ color: "#FF9900", fontSize: "32px" }}>receipt_long</span>
            </div>
          </div>
          <div style={{ background: "#fff", padding: "20px", borderRadius: "8px", border: "1px solid #DDDDDD" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: "13px", color: "#565959", fontWeight: 500 }}>إجمالي الإيرادات</div>
                <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "28px", fontWeight: 700, color: "#067D62", marginTop: "4px" }}>
                  {summary ? `${summary.totalRevenue.toLocaleString()} ج.م` : "—"}
                </div>
              </div>
              <span class="material-symbols-outlined" style={{ color: "#067D62", fontSize: "32px" }}>payments</span>
            </div>
          </div>
          <div style={{ background: "#fff", padding: "20px", borderRadius: "8px", border: "1px solid #DDDDDD" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: "13px", color: "#565959", fontWeight: 500 }}>متوسط قيمة الطلب</div>
                <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "28px", fontWeight: 700, color: "#9B59B6", marginTop: "4px" }}>
                  {summary ? `${summary.avgOrderValue.toLocaleString()} ج.م` : "—"}
                </div>
              </div>
              <span class="material-symbols-outlined" style={{ color: "#9B59B6", fontSize: "32px" }}>trending_up</span>
            </div>
          </div>
        </div>

        <div style={{ background: "#fff", borderRadius: "8px", border: "1px solid #DDDDDD", padding: "24px", marginBottom: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
            <div style={{ display: "flex", gap: "8px" }}>
              {(["daily", "weekly", "monthly"] as Period[]).map((p) => (
                <button key={p} onClick={() => setPeriod(p)}
                  style={{
                    padding: "8px 16px", borderRadius: "6px", border: "1px solid #DDDDDD", cursor: "pointer",
                    background: period === p ? "#FF9900" : "#fff",
                    color: period === p ? "#fff" : "#0F1111",
                    fontWeight: period === p ? 700 : 500,
                    fontSize: "13px",
                  }}>
                  {p === "daily" ? "يومي" : p === "weekly" ? "أسبوعي" : "شهري"}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <label style={{ fontSize: "13px", color: "#565959" }}>
                من
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom((e.target as HTMLInputElement).value)}
                  style={{ marginRight: "4px", padding: "6px 10px", borderRadius: "6px", border: "1px solid #DDDDDD", fontSize: "13px" }} />
              </label>
              <label style={{ fontSize: "13px", color: "#565959" }}>
                إلى
                <input type="date" value={dateTo} onChange={(e) => setDateTo((e.target as HTMLInputElement).value)}
                  style={{ marginRight: "4px", padding: "6px 10px", borderRadius: "6px", border: "1px solid #DDDDDD", fontSize: "13px" }} />
              </label>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
              <thead>
                <tr style={{ background: "#f4f4f5", color: "#555", fontWeight: 600 }}>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>التاريخ</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>الطلبات</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>الإيرادات</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.date} style={{ borderBottom: "1px solid #EAEDED" }}>
                    <td style={{ padding: "12px 16px", fontWeight: 700 }}>{r.date}</td>
                    <td style={{ padding: "12px 16px" }}>{r.orders}</td>
                    <td style={{ padding: "12px 16px", fontWeight: 600 }}>{r.revenue.toLocaleString()} ج.م</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={3} style={{ padding: "48px", textAlign: "center", color: "#565959" }}>لا توجد بيانات</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "24px" }}>
          <button onClick={exportCSV}
            style={{
              background: "#067D62", color: "#fff", border: "none", borderRadius: "6px",
              padding: "10px 24px", fontWeight: 700, fontSize: "14px", cursor: "pointer",
              display: "flex", alignItems: "center", gap: "8px",
            }}>
            <span class="material-symbols-outlined" style={{ fontSize: "18px" }}>download</span>
            تصدير CSV
          </button>
        </div>

        <footer style={{ marginTop: "auto", padding: "16px 0 0", textAlign: "center" }}>
          <p style={{ fontSize: "14px", color: "#565959", opacity: 0.8, margin: 0 }}>© 2025 M&K Store. جميع الحقوق محفوظة.</p>
        </footer>
      </div>
    </div>
  );
}
