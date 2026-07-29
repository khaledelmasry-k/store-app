import { useState, useEffect } from "preact/compat";
import { api } from "../services/api";
import Sidebar from "../components/Sidebar";

interface CustomerRow {
  name: string; phone: string; governorate: string; city: string;
  orderCount: number; totalSpent: number; lastOrder: string;
}

interface CustomersResponse {
  customers: CustomerRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

interface CustomerProfile {
  customer: { name: string; phone: string; governorate: string; city: string; address: string; orderCount: number; totalSpent: number };
  orders: Array<{ orderNumber: string; totalPrice: number; status: string; createdAt: string; items: any[]; sellerId: string | null; utmCampaign: string | null }>;
}

export default function MerchantCustomers() {
  const [data, setData] = useState<CustomersResponse | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("lastOrder");
  const [sortDir, setSortDir] = useState("desc");
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [noteInput, setNoteInput] = useState("");
  const limit = 20;

  const fetchCustomers = () => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit), sortBy, sortDir });
    if (search) params.set("search", search);
    api.get<CustomersResponse>(`/merchant/customers?${params}`).then(setData).catch(() => {});
  };

  useEffect(() => { fetchCustomers(); }, [page, sortBy, sortDir]);

  const handleSearch = (e: Event) => { e.preventDefault(); setPage(1); fetchCustomers(); };

  const viewProfile = async (phone: string) => {
    try {
      const res = await api.get<CustomerProfile>(`/merchant/customers/${encodeURIComponent(phone)}`);
      setProfile(res);
      setNoteInput("");
    } catch {}
  };

  const addNote = async () => {
    if (!noteInput || !profile) return;
    await api.post(`/merchant/customers/${encodeURIComponent(profile.customer.phone)}/notes`, { note: noteInput });
    setNoteInput("");
  };

  const totalPages = data?.pagination?.totalPages || 1;
  const toggleSort = (field: string) => {
    if (sortBy === field) setSortDir(sortDir === "desc" ? "asc" : "desc");
    else { setSortBy(field); setSortDir("desc"); }
    setPage(1);
  };

  const statusColors: Record<string, string> = { NEW: "#FF9900", CONTACTED: "#007185", PROCESSING: "#067D62", SHIPPED: "#067D62", DELIVERED: "#067D62", CANCELLED: "#B12704", RETURNED: "#B12704" };
  const statusLabels: Record<string, string> = { NEW: "جديد", CONTACTED: "تم التواصل", PROCESSING: "قيد التجهيز", SHIPPED: "تم الشحن", DELIVERED: "تم التوصيل", CANCELLED: "ملغي", RETURNED: "مرتجع" };

  return (
    <div style={{ background: "#EAEDED", minHeight: "100vh", display: "flex" }}>
      <Sidebar />
      <div className="admin-content" style={{ flex: 1, padding: "24px", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <header style={{ marginBottom: "24px" }}>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "24px", fontWeight: 600, color: "#0F1111", margin: 0 }}>
            <span class="material-symbols-outlined" style={{ verticalAlign: "middle", marginLeft: "8px" }}>people</span>
            العملاء
          </h2>
          <p style={{ fontSize: "14px", color: "#595f68", margin: "4px 0 0" }}>{data?.pagination?.total || 0} عميل</p>
        </header>

        {profile && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
            onClick={() => setProfile(null)}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: "12px", maxWidth: "600px", width: "100%", maxHeight: "80vh", overflow: "auto", padding: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <h3 style={{ margin: 0, fontWeight: 700 }}>{profile.customer.name}</h3>
                <button onClick={() => setProfile(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "20px", color: "#565959" }}>&times;</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px", padding: "16px", background: "#F6F8F8", borderRadius: "8px" }}>
                <div><span style={{ fontSize: "12px", color: "#565959" }}>الهاتف</span><div style={{ fontWeight: 600 }}>{profile.customer.phone}</div></div>
                <div><span style={{ fontSize: "12px", color: "#565959" }}>المحافظة</span><div style={{ fontWeight: 600 }}>{profile.customer.governorate}</div></div>
                <div><span style={{ fontSize: "12px", color: "#565959" }}>المدينة</span><div style={{ fontWeight: 600 }}>{profile.customer.city}</div></div>
                <div><span style={{ fontSize: "12px", color: "#565959" }}>العنوان</span><div style={{ fontWeight: 600 }}>{profile.customer.address}</div></div>
                <div><span style={{ fontSize: "12px", color: "#565959" }}>إجمالي الطلبات</span><div style={{ fontWeight: 600 }}>{profile.customer.orderCount}</div></div>
                <div><span style={{ fontSize: "12px", color: "#565959" }}>إجمالي المشتريات</span><div style={{ fontWeight: 600 }}>{profile.customer.totalSpent.toLocaleString()} ج.م</div></div>
              </div>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ fontSize: "13px", fontWeight: 600, display: "block", marginBottom: "4px" }}>إضافة ملاحظة</label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input type="text" className="amazon-input" style={{ flex: 1 }} value={noteInput} placeholder="ملاحظة..." onChange={(e) => setNoteInput((e.target as HTMLInputElement).value)} />
                  <button onClick={addNote} style={{ padding: "8px 16px", background: "#FF9900", border: "none", borderRadius: "6px", fontWeight: 700, cursor: "pointer" }}>إضافة</button>
                </div>
              </div>
              <h4 style={{ margin: "16px 0 12px", fontWeight: 700 }}>الطلبات ({profile.orders.length})</h4>
              {profile.orders.map((o) => (
                <div key={o.orderNumber} style={{ padding: "12px", border: "1px solid #EAEDED", borderRadius: "8px", marginBottom: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                    <span style={{ fontWeight: 700, fontSize: "14px", fontFamily: "monospace" }}>{o.orderNumber}</span>
                    <span style={{ padding: "2px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 700, background: `${statusColors[o.status] || "#ccc"}22`, color: statusColors[o.status] || "#565959" }}>
                      {statusLabels[o.status] || o.status}
                    </span>
                  </div>
                  <div style={{ fontSize: "12px", color: "#565959", display: "flex", gap: "16px" }}>
                    <span>{o.totalPrice.toLocaleString()} ج.م</span>
                    {o.items && <span>{o.items.length} منتج</span>}
                    {o.utmCampaign && <span>حملة: {o.utmCampaign}</span>}
                    <span>{new Date(o.createdAt).toLocaleDateString("en-CA")}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #DDDDDD", overflow: "hidden", flex: 1 }}>
          <form onSubmit={handleSearch} style={{ padding: "16px", borderBottom: "1px solid #EAEDED", display: "flex", gap: "12px" }}>
            <input type="text" placeholder="بحث باسم العميل أو رقم الهاتف..." className="amazon-input" style={{ flex: 1 }}
              value={search} onChange={(e) => setSearch((e.target as HTMLInputElement).value)} />
            <button type="submit" style={{ background: "#FF9900", border: "none", borderRadius: "6px", padding: "8px 16px", fontWeight: 700, cursor: "pointer" }}>بحث</button>
          </form>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
              <thead>
                <tr style={{ background: "#f4f4f5", color: "#555", fontWeight: 600 }}>
                  <th onClick={() => toggleSort("name")} style={{ padding: "12px 16px", textAlign: "right", cursor: "pointer", userSelect: "none" }}>
                    الاسم {sortBy === "name" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                  </th>
                  <th onClick={() => toggleSort("phone")} style={{ padding: "12px 16px", textAlign: "right", cursor: "pointer", userSelect: "none" }}>
                    الهاتف {sortBy === "phone" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                  </th>
                  <th onClick={() => toggleSort("orders")} style={{ padding: "12px 16px", textAlign: "right", cursor: "pointer", userSelect: "none" }}>
                    الطلبات {sortBy === "orders" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                  </th>
                  <th onClick={() => toggleSort("total")} style={{ padding: "12px 16px", textAlign: "right", cursor: "pointer", userSelect: "none" }}>
                    المشتريات {sortBy === "total" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>المدينة</th>
                  <th onClick={() => toggleSort("lastOrder")} style={{ padding: "12px 16px", textAlign: "right", cursor: "pointer", userSelect: "none" }}>
                    آخر طلب {sortBy === "lastOrder" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "center" }}></th>
                </tr>
              </thead>
              <tbody>
                {data?.customers.map((c) => (
                  <tr key={c.phone} style={{ borderBottom: "1px solid #EAEDED", cursor: "pointer" }} onClick={() => viewProfile(c.phone)}>
                    <td style={{ padding: "16px", fontWeight: 700 }}>{c.name}</td>
                    <td style={{ padding: "16px", color: "#007185" }}>{c.phone}</td>
                    <td style={{ padding: "16px" }}>{c.orderCount}</td>
                    <td style={{ padding: "16px", fontWeight: 600 }}>{c.totalSpent.toLocaleString()} ج.م</td>
                    <td style={{ padding: "16px", color: "#565959" }}>{c.governorate}{c.city ? ` - ${c.city}` : ""}</td>
                    <td style={{ padding: "16px", fontSize: "13px", color: "#565959" }}>{new Date(c.lastOrder).toLocaleDateString("en-CA")}</td>
                    <td style={{ padding: "16px", textAlign: "center" }}>
                      <span style={{ color: "#007185", fontSize: "13px" }}>عرض</span>
                    </td>
                  </tr>
                ))}
                {(!data?.customers || data.customers.length === 0) && (
                  <tr><td colSpan={7} style={{ padding: "48px", textAlign: "center", color: "#565959" }}>لا يوجد عملاء</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div style={{ padding: "16px", display: "flex", justifyContent: "center", gap: "8px", borderTop: "1px solid #EAEDED" }}>
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} style={{ padding: "8px 16px", borderRadius: "6px", border: "1px solid #DDDDDD", background: "#fff", cursor: page <= 1 ? "not-allowed" : "pointer", opacity: page <= 1 ? 0.5 : 1 }}>
                السابق
              </button>
              <span style={{ padding: "8px 16px", fontSize: "14px", color: "#565959" }}>صفحة {page} من {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} style={{ padding: "8px 16px", borderRadius: "6px", border: "1px solid #DDDDDD", background: "#fff", cursor: page >= totalPages ? "not-allowed" : "pointer", opacity: page >= totalPages ? 0.5 : 1 }}>
                التالي
              </button>
            </div>
          )}
        </div>

        <footer style={{ marginTop: "auto", padding: "16px 0 0", textAlign: "center" }}>
          <p style={{ fontSize: "14px", color: "#565959", opacity: 0.8, margin: 0 }}>© 2025 M&K Store. جميع الحقوق محفوظة.</p>
        </footer>
      </div>
    </div>
  );
}
