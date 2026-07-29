import { useState, useEffect } from "preact/compat";
import { api } from "../services/api";
import type { Order } from "../types";
import Sidebar from "../components/Sidebar";

export default function AdminCustomers() {
  const [customers, setCustomers] = useState<Map<string, { name: string; phone: string; orders: number; total: number; lastOrder: string }>>(new Map());
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.get<{ orders: Order[] }>("/admin/orders?limit=1000").then((res) => {
      const map = new Map<string, { name: string; phone: string; orders: number; total: number; lastOrder: string }>();
      for (const o of res.orders) {
        const key = o.phone;
        const existing = map.get(key);
        if (existing) {
          existing.orders++;
          existing.total += o.totalPrice;
          if (o.createdAt > existing.lastOrder) existing.lastOrder = o.createdAt;
        } else {
          map.set(key, { name: o.customerName, phone: o.phone, orders: 1, total: o.totalPrice, lastOrder: o.createdAt });
        }
      }
      setCustomers(map);
    }).catch(() => {});
  }, []);

  const filtered = Array.from(customers.values()).filter(
    (c) => c.name.includes(search) || c.phone.includes(search)
  );
  const totalCustomers = customers.size;
  const totalOrders = Array.from(customers.values()).reduce((a, c) => a + c.orders, 0);
  const totalRevenue = Array.from(customers.values()).reduce((a, c) => a + c.total, 0);

  return (
    <div style={{ background: "#EAEDED", minHeight: "100vh", display: "flex" }}>
      <Sidebar />
      <div className="admin-content" style={{ flex: 1, padding: "24px", minHeight: "100vh" }}>
        <div style={{ marginBottom: "24px" }}>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "24px", fontWeight: 600, color: "#0F1111", margin: 0 }}>👥 العملاء</h2>
          <p style={{ fontSize: "14px", color: "#595f68", margin: "4px 0 0" }}>قائمة العملاء ومشترياتهم</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "24px" }}>
          <div style={{ background: "#fff", padding: "20px", borderRadius: "8px", border: "1px solid #DDDDDD" }}>
            <span style={{ fontSize: "28px" }}>👥</span>
            <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "24px", fontWeight: 700, color: "#131921", marginTop: "4px" }}>{totalCustomers}</div>
            <div style={{ fontSize: "12px", color: "#565959" }}>إجمالي العملاء</div>
          </div>
          <div style={{ background: "#fff", padding: "20px", borderRadius: "8px", border: "1px solid #DDDDDD" }}>
            <span style={{ fontSize: "28px" }}>📦</span>
            <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "24px", fontWeight: 700, color: "#007185", marginTop: "4px" }}>{totalOrders}</div>
            <div style={{ fontSize: "12px", color: "#565959" }}>إجمالي الطلبات</div>
          </div>
          <div style={{ background: "#fff", padding: "20px", borderRadius: "8px", border: "1px solid #DDDDDD" }}>
            <span style={{ fontSize: "28px" }}>💰</span>
            <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "24px", fontWeight: 700, color: "#067D62", marginTop: "4px" }}>{totalRevenue.toLocaleString()} ج.م</div>
            <div style={{ fontSize: "12px", color: "#565959" }}>إجمالي المشتريات</div>
          </div>
        </div>

        <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 2px 4px rgba(0,0,0,0.08)", border: "1px solid #DDDDDD" }}>
          <div style={{ padding: "20px 24px", borderBottom: "1px solid #DDDDDD", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <input type="text" value={search} onInput={(e) => setSearch((e.target as HTMLInputElement).value)} placeholder="بحث باسم العميل أو رقم الهاتف..."
              style={{ padding: "10px 16px", borderRadius: "8px", border: "1px solid #DDDDDD", fontSize: "14px", minWidth: "280px", outline: "none" }} />
            <span style={{ fontSize: "13px", color: "#565959" }}>{filtered.length} عميل</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", textAlign: "right", borderCollapse: "collapse", fontSize: "14px" }}>
              <thead>
                <tr style={{ background: "#EBEEEE", color: "#565959", fontWeight: 600 }}>
                  <th style={{ padding: "16px", borderBottom: "1px solid #DDDDDD" }}>الاسم</th>
                  <th style={{ padding: "16px", borderBottom: "1px solid #DDDDDD" }}>رقم الهاتف</th>
                  <th style={{ padding: "16px", borderBottom: "1px solid #DDDDDD" }}>عدد الطلبات</th>
                  <th style={{ padding: "16px", borderBottom: "1px solid #DDDDDD" }}>إجمالي المشتريات</th>
                  <th style={{ padding: "16px", borderBottom: "1px solid #DDDDDD" }}>آخر طلب</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: "48px", textAlign: "center", color: "#565959" }}>لا يوجد عملاء</td></tr>
                )}
                {filtered.map((c) => (
                  <tr key={c.phone} style={{ borderBottom: "1px solid #DDDDDD" }}>
                    <td style={{ padding: "16px", fontWeight: 700 }}>{c.name}</td>
                    <td style={{ padding: "16px", color: "#007185" }}>{c.phone}</td>
                    <td style={{ padding: "16px" }}>{c.orders}</td>
                    <td style={{ padding: "16px", fontWeight: 600 }}>{c.total.toLocaleString()} ج.م</td>
                    <td style={{ padding: "16px", fontSize: "13px", color: "#565959" }}>{new Date(c.lastOrder).toLocaleDateString("ar-EG")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
