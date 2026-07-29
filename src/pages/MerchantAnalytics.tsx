import { useState, useEffect } from "preact/compat";
import { api } from "../services/api";
import Sidebar from "../components/Sidebar";

interface Overview {
  totalOrders: number;
  confirmedOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
  topProducts: { name: string; count: number; revenue: number }[];
}

interface DailyPoint {
  date: string;
  orders: number;
  revenue: number;
}

interface Seller { id: string; name: string; }

interface Campaign {
  id: string;
  name: string;
  orders: number;
  revenue: number;
}

interface SellerPerformance {
  sellerName: string;
  orders: number;
  revenue: number;
}

interface TrafficSource {
  source: string;
  visits: number;
  orders: number;
}

function MiniBar({ value, max, color, height }: { value: number; max: number; color: string; height?: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ width: "100%", height: height || "100%", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ width: "70%", height: `${pct}%`, background: color, borderRadius: "4px 4px 0 0", minHeight: pct > 0 ? "4px" : "0", transition: "height 0.3s" }} />
    </div>
  );
}

function LineChart({ data, color }: { data: number[]; color: string }) {
  const w = 600, h = 160;
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => `${(i / (data.length - 1 || 1)) * w},${h - (v / max) * h}`).join(" ");
  const areaPts = `0,${h} ${pts} ${w},${h}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "100%" }}>
      <defs>
        <linearGradient id={`grad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color={color} stop-opacity="0.3" />
          <stop offset="100%" stop-color={color} stop-opacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={areaPts} fill={`url(#grad-${color.replace("#", "")})`} />
      <polyline points={pts} fill="none" stroke={color} stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
      {data.map((v, i) => (
        <circle key={i} cx={(i / (data.length - 1 || 1)) * w} cy={h - (v / max) * h} r="3" fill={color} />
      ))}
    </svg>
  );
}

export default function MerchantAnalytics() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [daily, setDaily] = useState<DailyPoint[]>([]);
  const [days, setDays] = useState(30);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [sellerPerformance, setSellerPerformance] = useState<SellerPerformance[]>([]);
  const [trafficSources, setTrafficSources] = useState<TrafficSource[]>([]);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sellerId, setSellerId] = useState("");
  const [utmCampaign, setUtmCampaign] = useState("");

  const [filtersApplied, setFiltersApplied] = useState(false);

  function buildParams(extra: Record<string, string> = {}) {
    const p = new URLSearchParams();
    if (sellerId) p.set("sellerId", sellerId);
    if (utmCampaign) p.set("utmCampaign", utmCampaign);
    if (dateFrom) p.set("dateFrom", dateFrom);
    if (dateTo) p.set("dateTo", dateTo);
    Object.entries(extra).forEach(([k, v]) => { if (v) p.set(k, v); });
    return p.toString();
  }

  function fetchAll() {
    const q = buildParams();
    api.get<Overview>(`/merchant/analytics/overview?${q}`).then(setOverview).catch(() => {});
    api.get<{ daily: DailyPoint[] }>(`/merchant/analytics/daily?days=${days}&${q}`)
      .then((r) => setDaily(r.daily)).catch(() => {});

    const sq = buildParams();
    api.get<SellerPerformance[]>(`/merchant/analytics/seller-performance?${sq}`)
      .then(setSellerPerformance).catch(() => {});
    api.get<Campaign[]>(`/merchant/analytics/campaigns?${sq}`)
      .then(setCampaigns).catch(() => {});
    api.get<TrafficSource[]>(`/merchant/analytics/traffic-sources?${sq}`)
      .then(setTrafficSources).catch(() => {});
    setFiltersApplied(true);
  }

  useEffect(() => {
    api.get<Seller[]>("/merchant/sellers").then(setSellers).catch(() => {});
    fetchAll();
  }, []);

  useEffect(() => {
    if (!filtersApplied) return;
    const q = buildParams();
    api.get<{ daily: DailyPoint[] }>(`/merchant/analytics/daily?days=${days}&${q}`)
      .then((r) => setDaily(r.daily)).catch(() => {});
  }, [days]);

  function applyFilters() {
    fetchAll();
  }

  function resetFilters() {
    setDateFrom("");
    setDateTo("");
    setSellerId("");
    setUtmCampaign("");
    setFiltersApplied(false);
    setDays(30);
  }

  useEffect(() => {
    if (!filtersApplied && !sellerId && !utmCampaign && !dateFrom && !dateTo) {
      fetchAll();
    }
  }, [filtersApplied]);

  const maxOrders = Math.max(...daily.map((d) => d.orders), 1);
  const maxRevenue = Math.max(...daily.map((d) => d.revenue), 1);

  const chartLabels = daily.length > 0
    ? daily.filter((_, i) => i % Math.max(1, Math.floor(daily.length / 6)) === 0 || i === daily.length - 1)
    : [];

  const maxCampaignOrders = Math.max(...campaigns.map((c) => c.orders), 1);
  const maxCampaignRevenue = Math.max(...campaigns.map((c) => c.revenue), 1);
  const maxTrafficVisits = Math.max(...trafficSources.map((t) => t.visits), 1);
  const maxTrafficOrders = Math.max(...trafficSources.map((t) => t.orders), 1);

  return (
    <div style={{ background: "#EAEDED", minHeight: "100vh", display: "flex" }}>
      <Sidebar />
      <div className="admin-content" style={{ flex: 1, padding: "24px", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <header style={{ marginBottom: "24px" }}>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "24px", fontWeight: 600, color: "#0F1111", margin: 0 }}>
            <span class="material-symbols-outlined" style={{ verticalAlign: "middle", marginLeft: "8px" }}>bar_chart</span>
            التقارير
          </h2>
          <p style={{ fontSize: "14px", color: "#595f68", margin: "4px 0 0" }}>تحليلات المتجر والأداء</p>
        </header>

        {/* Filter Bar */}
        <section style={{ background: "#fff", borderRadius: "8px", border: "1px solid #DDDDDD", padding: "20px", marginBottom: "24px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "flex-end" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: "160px" }}>
              <label style={{ fontSize: "12px", fontWeight: 600, color: "#565959" }}>من تاريخ</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom((e.target as HTMLInputElement).value)}
                style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid #DDDDDD", fontSize: "13px", background: "#fff", fontFamily: "inherit" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: "160px" }}>
              <label style={{ fontSize: "12px", fontWeight: 600, color: "#565959" }}>إلى تاريخ</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo((e.target as HTMLInputElement).value)}
                style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid #DDDDDD", fontSize: "13px", background: "#fff", fontFamily: "inherit" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: "180px" }}>
              <label style={{ fontSize: "12px", fontWeight: 600, color: "#565959" }}>البائع</label>
              <select value={sellerId} onChange={(e) => setSellerId((e.target as HTMLSelectElement).value)}
                style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid #DDDDDD", fontSize: "13px", background: "#fff" }}>
                <option value="">جميع البائعين</option>
                {sellers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: "180px" }}>
              <label style={{ fontSize: "12px", fontWeight: 600, color: "#565959" }}>الحملة</label>
              <select value={utmCampaign} onChange={(e) => setUtmCampaign((e.target as HTMLSelectElement).value)}
                style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid #DDDDDD", fontSize: "13px", background: "#fff" }}>
                <option value="">جميع الحملات</option>
                {campaigns.map((c) => <option key={c.id || c.name} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <button onClick={applyFilters}
              style={{ padding: "8px 20px", borderRadius: "6px", border: "none", background: "#FF9900", color: "#fff", fontSize: "13px", fontWeight: 700, cursor: "pointer", height: "fit-content" }}>
              تطبيق
            </button>
            <button onClick={resetFilters}
              style={{ padding: "8px 20px", borderRadius: "6px", border: "1px solid #DDDDDD", background: "#fff", color: "#565959", fontSize: "13px", fontWeight: 600, cursor: "pointer", height: "fit-content" }}>
              إعادة تعيين
            </button>
          </div>
        </section>

        {/* Summary Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "24px" }}>
          <div style={{ background: "#fff", padding: "20px", borderRadius: "8px", border: "1px solid #DDDDDD" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: "13px", color: "#565959", fontWeight: 500 }}>إجمالي الطلبات</div>
                <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "28px", fontWeight: 700, color: "#0F1111", marginTop: "4px" }}>
                  {overview?.totalOrders ?? "—"}
                </div>
              </div>
              <span class="material-symbols-outlined" style={{ color: "#FF9900", fontSize: "32px" }}>receipt_long</span>
            </div>
          </div>
          <div style={{ background: "#fff", padding: "20px", borderRadius: "8px", border: "1px solid #DDDDDD" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: "13px", color: "#565959", fontWeight: 500 }}>الطلبات المؤكدة</div>
                <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "28px", fontWeight: 700, color: "#007185", marginTop: "4px" }}>
                  {overview?.confirmedOrders ?? "—"}
                </div>
              </div>
              <span class="material-symbols-outlined" style={{ color: "#007185", fontSize: "32px" }}>check_circle</span>
            </div>
          </div>
          <div style={{ background: "#fff", padding: "20px", borderRadius: "8px", border: "1px solid #DDDDDD" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: "13px", color: "#565959", fontWeight: 500 }}>الإيرادات</div>
                <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "28px", fontWeight: 700, color: "#067D62", marginTop: "4px" }}>
                  {overview ? `${overview.totalRevenue.toLocaleString()} ج.م` : "—"}
                </div>
              </div>
              <span class="material-symbols-outlined" style={{ color: "#067D62", fontSize: "32px" }}>payments</span>
            </div>
          </div>
          <div style={{ background: "#fff", padding: "20px", borderRadius: "8px", border: "1px solid #DDDDDD" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: "13px", color: "#565959", fontWeight: 500 }}>متوسط الطلب</div>
                <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "28px", fontWeight: 700, color: "#9B59B6", marginTop: "4px" }}>
                  {overview ? `${overview.avgOrderValue.toLocaleString()} ج.م` : "—"}
                </div>
              </div>
              <span class="material-symbols-outlined" style={{ color: "#9B59B6", fontSize: "32px" }}>trending_up</span>
            </div>
          </div>
        </div>

        {/* Daily Chart */}
        <section style={{ background: "#fff", borderRadius: "8px", border: "1px solid #DDDDDD", padding: "24px", marginBottom: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}>الطلبات اليومية</h3>
            <select value={days} onChange={(e) => setDays(parseInt((e.target as HTMLSelectElement).value))}
              style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid #DDDDDD", fontSize: "13px", background: "#fff" }}>
              <option value={7}>آخر 7 أيام</option>
              <option value={30}>آخر 30 يوماً</option>
              <option value={90}>آخر 90 يوماً</option>
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
            <div>
              <div style={{ fontSize: "13px", color: "#565959", marginBottom: "8px" }}>عدد الطلبات</div>
              <div style={{ height: "160px", display: "flex", alignItems: "flex-end", gap: "2px" }}>
                {daily.map((d, i) => (
                  <MiniBar key={i} value={d.orders} max={maxOrders} color="#FF9900" />
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
                {chartLabels.map((d) => (
                  <span key={d.date} style={{ fontSize: "10px", color: "#565959" }}>{new Date(d.date).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}</span>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "13px", color: "#565959", marginBottom: "8px" }}>الإيرادات (ج.م)</div>
              <div style={{ height: "160px", display: "flex", alignItems: "flex-end", gap: "2px" }}>
                {daily.map((d, i) => (
                  <MiniBar key={i} value={d.revenue} max={maxRevenue} color="#067D62" />
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
                {chartLabels.map((d) => (
                  <span key={d.date} style={{ fontSize: "10px", color: "#565959" }}>{new Date(d.date).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}</span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
          <section style={{ background: "#fff", borderRadius: "8px", border: "1px solid #DDDDDD", padding: "24px" }}>
            <h3 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: 700 }}>اتجاه الطلبات</h3>
            <LineChart data={daily.map((d) => d.orders)} color="#FF9900" />
          </section>
          <section style={{ background: "#fff", borderRadius: "8px", border: "1px solid #DDDDDD", padding: "24px" }}>
            <h3 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: 700 }}>اتجاه الإيرادات</h3>
            <LineChart data={daily.map((d) => d.revenue)} color="#067D62" />
          </section>
        </div>

        {/* Top Products */}
        {overview?.topProducts && overview.topProducts.length > 0 && (
          <section style={{ background: "#fff", borderRadius: "8px", border: "1px solid #DDDDDD", padding: "24px", marginTop: "24px" }}>
            <h3 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: 700 }}>أفضل المنتجات</h3>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                <thead>
                  <tr style={{ background: "#f4f4f5", color: "#555", fontWeight: 600 }}>
                    <th style={{ padding: "12px 16px", textAlign: "right" }}>#</th>
                    <th style={{ padding: "12px 16px", textAlign: "right" }}>المنتج</th>
                    <th style={{ padding: "12px 16px", textAlign: "right" }}>عدد القطع</th>
                    <th style={{ padding: "12px 16px", textAlign: "right" }}>الإيرادات</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.topProducts.map((p, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #EAEDED" }}>
                      <td style={{ padding: "12px 16px", color: "#565959" }}>{i + 1}</td>
                      <td style={{ padding: "12px 16px", fontWeight: 700 }}>{p.name}</td>
                      <td style={{ padding: "12px 16px" }}>{p.count}</td>
                      <td style={{ padding: "12px 16px" }}>{p.revenue.toLocaleString()} ج.م</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Seller Performance */}
        {sellerPerformance.length > 0 && (
          <section style={{ background: "#fff", borderRadius: "8px", border: "1px solid #DDDDDD", padding: "24px", marginTop: "24px" }}>
            <h3 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: 700 }}>أداء البائعين</h3>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                <thead>
                  <tr style={{ background: "#f4f4f5", color: "#555", fontWeight: 600 }}>
                    <th style={{ padding: "12px 16px", textAlign: "right" }}>البائع</th>
                    <th style={{ padding: "12px 16px", textAlign: "right" }}>الطلبات</th>
                    <th style={{ padding: "12px 16px", textAlign: "right" }}>الإيرادات</th>
                  </tr>
                </thead>
                <tbody>
                  {sellerPerformance.map((sp, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #EAEDED" }}>
                      <td style={{ padding: "12px 16px", fontWeight: 700 }}>{sp.sellerName}</td>
                      <td style={{ padding: "12px 16px" }}>{sp.orders}</td>
                      <td style={{ padding: "12px 16px" }}>{sp.revenue.toLocaleString()} ج.م</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Campaign Performance */}
        {campaigns.length > 0 && (
          <section style={{ background: "#fff", borderRadius: "8px", border: "1px solid #DDDDDD", padding: "24px", marginTop: "24px" }}>
            <h3 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: 700 }}>أداء الحملات</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "16px" }}>
              <div>
                <div style={{ fontSize: "13px", color: "#565959", marginBottom: "8px" }}>الطلبات</div>
                <div style={{ height: "120px", display: "flex", alignItems: "flex-end", gap: "4px" }}>
                  {campaigns.map((c, i) => (
                    <MiniBar key={i} value={c.orders} max={maxCampaignOrders} color="#FF9900" />
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px", gap: "4px" }}>
                  {campaigns.map((c, i) => (
                    <span key={i} style={{ fontSize: "10px", color: "#565959", textAlign: "center", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "13px", color: "#565959", marginBottom: "8px" }}>الإيرادات</div>
                <div style={{ height: "120px", display: "flex", alignItems: "flex-end", gap: "4px" }}>
                  {campaigns.map((c, i) => (
                    <MiniBar key={i} value={c.revenue} max={maxCampaignRevenue} color="#067D62" />
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px", gap: "4px" }}>
                  {campaigns.map((c, i) => (
                    <span key={i} style={{ fontSize: "10px", color: "#565959", textAlign: "center", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Traffic Sources */}
        {trafficSources.length > 0 && (
          <section style={{ background: "#fff", borderRadius: "8px", border: "1px solid #DDDDDD", padding: "24px", marginTop: "24px" }}>
            <h3 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: 700 }}>مصادر الزيارات</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "16px" }}>
              <div>
                <div style={{ fontSize: "13px", color: "#565959", marginBottom: "8px" }}>الزيارات</div>
                <div style={{ height: "120px", display: "flex", alignItems: "flex-end", gap: "4px" }}>
                  {trafficSources.map((t, i) => (
                    <MiniBar key={i} value={t.visits} max={maxTrafficVisits} color="#007185" />
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px", gap: "4px" }}>
                  {trafficSources.map((t, i) => (
                    <span key={i} style={{ fontSize: "10px", color: "#565959", textAlign: "center", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.source}</span>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "13px", color: "#565959", marginBottom: "8px" }}>الطلبات</div>
                <div style={{ height: "120px", display: "flex", alignItems: "flex-end", gap: "4px" }}>
                  {trafficSources.map((t, i) => (
                    <MiniBar key={i} value={t.orders} max={maxTrafficOrders} color="#9B59B6" />
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px", gap: "4px" }}>
                  {trafficSources.map((t, i) => (
                    <span key={i} style={{ fontSize: "10px", color: "#565959", textAlign: "center", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.source}</span>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        <footer style={{ marginTop: "auto", padding: "16px 0 0", textAlign: "center" }}>
          <p style={{ fontSize: "14px", color: "#565959", opacity: 0.8, margin: 0 }}>© 2025 M&K Store. جميع الحقوق محفوظة.</p>
        </footer>
      </div>
    </div>
  );
}
