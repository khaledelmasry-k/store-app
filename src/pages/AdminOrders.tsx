import { useState, useEffect, useCallback, FormEvent } from "preact/compat";
import { api } from "../services/api";
import type { Order, PaginatedResponse, OrderStatus, Store } from "../types";
import Sidebar from "../components/Sidebar";

const STATUSES: OrderStatus[] = ["NEW", "CONTACTED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED"];
const STATUS_LABELS: Record<string, string> = {
  NEW: "جديد", CONTACTED: "تم الاتصال", PROCESSING: "قيد التنفيذ",
  SHIPPED: "تم الشحن", DELIVERED: "تم التوصيل", CANCELLED: "ملغي", RETURNED: "مرتجع",
};
const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  NEW: { bg: "#ECFDF5", text: "#067D62", dot: "#067D62" },
  CONTACTED: { bg: "#F0F9FF", text: "#007185", dot: "#007185" },
  PROCESSING: { bg: "#FFF7ED", text: "#C45500", dot: "#C45500" },
  SHIPPED: { bg: "#F5F3FF", text: "#7C3AED", dot: "#7C3AED" },
  DELIVERED: { bg: "#ECFDF5", text: "#067D62", dot: "#067D62" },
  CANCELLED: { bg: "#FEF2F2", text: "#B12704", dot: "#B12704" },
  RETURNED: { bg: "#F5F3FF", text: "#A855F7", dot: "#A855F7" },
};

const STORE_COLORS = [
  { bg: "#FFF8E1", text: "#A855F7", border: "#FFECB3" },
  { bg: "#F0FDF4", text: "#166534", border: "#DCFCE7" },
  { bg: "#EFF6FF", text: "#1D4ED8", border: "#DBEAFE" },
  { bg: "#FEF2F2", text: "#B91C1C", border: "#FEE2E2" },
  { bg: "#F5F3FF", text: "#7C3AED", border: "#EDE9FE" },
  { bg: "#FFF7ED", text: "#C2410C", border: "#FFEDD5" },
];

export default function AdminOrders() {
  const [data, setData] = useState<PaginatedResponse<Order> | null>(null);
  const [page, setPage] = useState(1);
  const [nameFilter, setNameFilter] = useState("");
  const [phoneFilter, setPhoneFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [storeFilter, setStoreFilter] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [storeNames, setStoreNames] = useState<Record<string, string>>({});
  const limit = 20;

  useEffect(() => {
    api.get<Store[]>("/admin/settings/stores").then(stores => {
      const map: Record<string, string> = {};
      stores.forEach(s => { map[s.ref] = s.name; });
      setStoreNames(map);
    }).catch(() => {});
  }, []);

  const fetchOrders = useCallback(() => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (nameFilter) params.set("search", nameFilter);
    if (phoneFilter) params.set("phone", phoneFilter);
    if (statusFilter) params.set("status", statusFilter);
    if (storeFilter) params.set("ref", storeFilter);
    api.get<PaginatedResponse<Order>>(`/admin/orders?${params}`).then(setData);
  }, [page, nameFilter, phoneFilter, statusFilter, storeFilter]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchOrders();
  };

  const updateStatus = async (id: string, status: OrderStatus) => {
    await api.patch(`/admin/orders/${id}/status`, { status });
    fetchOrders();
  };

  const deleteOrder = async () => {
    if (!deleteId) return;
    try { await api.delete(`/admin/orders/${deleteId}`); setDeleteId(null); fetchOrders(); } catch {}
  };

  const storeBadge = (ref: string) => {
    const names = Object.values(storeNames);
    const idx = Math.max(0, names.indexOf(storeNames[ref] || ""));
    const c = STORE_COLORS[idx % STORE_COLORS.length];
    return { ...c, label: storeNames[ref] || ref };
  };

  const totalPages = data?.pagination?.totalPages || 1;
  const totalOrders = data?.pagination?.total || 0;

  return (
    <div style={{ background: "#EAEDED", minHeight: "100vh", display: "flex" }}>
      <Sidebar />
      <div className="admin-content" style={{ flex: 1, padding: "24px", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <header style={{ marginBottom: "32px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "24px", fontWeight: 600, color: "#0F1111", margin: 0 }}>إدارة الطلبات</h2>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "14px", color: "#565959" }}>إجمالي الطلبات: {totalOrders.toLocaleString()}</span>
            <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "#E0E3E3", display: "flex", alignItems: "center", justifyContent: "center", color: "#232F3E" }}>
              <span class="material-symbols-outlined" style={{ fontSize: "24px" }}>account_circle</span>
            </div>
          </div>
        </header>

        <section style={{ background: "#fff", padding: "24px", borderRadius: "8px", border: "1px solid #DDDDDD", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", marginBottom: "24px" }}>
          <form onSubmit={handleSearch} className="filter-grid">
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "12px", color: "#565959" }}>البحث بالاسم</label>
              <input type="text" placeholder="اسم العميل..." className="amazon-input" value={nameFilter} onChange={(e) => setNameFilter((e.target as HTMLInputElement).value)} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "12px", color: "#565959" }}>رقم الهاتف</label>
              <input type="tel" placeholder="01xxxxxxxxx" className="amazon-input" value={phoneFilter} onChange={(e) => setPhoneFilter((e.target as HTMLInputElement).value)} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "12px", color: "#565959" }}>حالة الطلب</label>
              <select className="amazon-select" value={statusFilter} onChange={(e) => { setStatusFilter((e.target as HTMLSelectElement).value); setPage(1); }}>
                <option value="">الكل</option>
                {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "12px", color: "#565959" }}>المتجر</label>
              <select className="amazon-select" value={storeFilter} onChange={(e) => { setStoreFilter((e.target as HTMLSelectElement).value); setPage(1); }}>
                <option value="">كل المتاجر</option>
                {Object.entries(storeNames).map(([ref, name]) => (
                  <option key={ref} value={ref}>{name}</option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button type="submit" style={{ width: "100%", background: "#FF9900", color: "#0F1111", fontWeight: 700, padding: "10px 16px", borderRadius: "8px", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", fontSize: "14px", minHeight: "40px" }}>
                <span class="material-symbols-outlined" style={{ fontSize: "20px" }}>search</span>
                <span>بحث</span>
              </button>
            </div>
          </form>
        </section>

        <section style={{ background: "#fff", borderRadius: "8px", border: "1px solid #DDDDDD", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", overflow: "hidden", flex: 1 }}>
          <div style={{ overflowX: "auto" }}>
            <table className="order-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
              <thead>
                <tr style={{ background: "#f4f4f5", color: "#555", fontWeight: 600 }}>
                  <th style={{ padding: "12px 16px", textAlign: "right", width: "48px" }}>#</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>الاسم</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>الهاتف</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>المتجر</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>المنتجات</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>الإجمالي</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>المحافظة</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>الحالة</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>التاريخ</th>
                  <th style={{ padding: "12px 16px", textAlign: "center" }}>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {data?.orders.map((order) => {
                  const badge = storeBadge(order.createdBy);
                  const sp = STATUS_STYLES[order.status] || STATUS_STYLES.NEW;
                  return (
                    <tr key={order.id} style={{ borderBottom: "1px solid #DDDDDD" }}>
                      <td style={{ padding: "16px", fontWeight: 700, color: "#565959" }}>{order.orderNumber}</td>
                      <td style={{ padding: "16px" }}>{order.customerName}</td>
                      <td style={{ padding: "16px", direction: "ltr", textAlign: "right" }}>{order.phone}</td>
                      <td style={{ padding: "16px" }}>
                        <span style={{ background: badge.bg, color: badge.text, padding: "4px 12px", borderRadius: "4px", fontSize: "12px", fontWeight: 700, border: `1px solid ${badge.border}`, display: "inline-block" }}>{badge.label}</span>
                      </td>
                      <td style={{ padding: "16px" }}>
                        {order.items.map((item, i) => (
                          <div key={i} style={{ fontSize: "13px" }}>{item.color} / {item.size} × {item.quantity}{i < order.items.length - 1 ? ", " : ""}</div>
                        ))}
                      </td>
                      <td style={{ padding: "16px", fontWeight: 700 }}>{order.totalPrice.toLocaleString()} ج.م</td>
                      <td style={{ padding: "16px" }}>{order.governorate}</td>
                      <td style={{ padding: "16px" }}>
                        <select value={order.status} onChange={(e) => updateStatus(order.id, (e.target as HTMLSelectElement).value as OrderStatus)}
                          className="status-pill" style={{ background: sp.bg, color: sp.text, border: `1px solid ${sp.text}`, cursor: "pointer" }}>
                          {STATUSES.map((s) => (
                            <option key={s} value={s} style={{ background: "#fff", color: "#0F1111" }}>{STATUS_LABELS[s]}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding: "16px", color: "#565959", fontSize: "13px" }}>{new Date(order.createdAt).toLocaleDateString("en-CA")}</td>
                      <td style={{ padding: "16px", textAlign: "center" }}>
                        <div style={{ display: "flex", justifyContent: "center", gap: "8px" }}>
                          <button onClick={() => setSelectedOrder(order)} style={{ padding: "8px", background: "none", border: "none", cursor: "pointer", borderRadius: "50%", color: "#007185" }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#F1F4F4"; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                            <span class="material-symbols-outlined" style={{ fontSize: "20px" }}>visibility</span>
                          </button>
                          <button onClick={() => setDeleteId(order.id)} style={{ padding: "8px", background: "none", border: "none", cursor: "pointer", borderRadius: "50%", color: "#B12704" }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#FFDAD6"; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                            <span class="material-symbols-outlined" style={{ fontSize: "20px" }}>delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: "16px", borderTop: "1px solid #DDDDDD", gap: "16px" }}>
            <p style={{ fontSize: "12px", color: "#565959", margin: 0 }}>
              {totalOrders > 0 ? `عرض ${(page - 1) * limit + 1} إلى ${Math.min(page * limit, totalOrders)} من إجمالي ${totalOrders.toLocaleString()} طلب` : "لا توجد طلبات"}
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1}
                style={{ width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "4px", border: "1px solid #DDDDDD", background: "#fff", cursor: page <= 1 ? "not-allowed" : "pointer", color: page <= 1 ? "#ccc" : "#0F1111" }}>
                <span class="material-symbols-outlined" style={{ fontSize: "14px" }}>chevron_right</span>
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const p = i + 1;
                return (
                  <button key={p} onClick={() => setPage(p)}
                    style={{ width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "4px", border: p === page ? "none" : "1px solid #DDDDDD", background: p === page ? "#FF9900" : "#fff", color: p === page ? "#0F1111" : "#0F1111", fontWeight: p === page ? 700 : 400, cursor: "pointer" }}>
                    {p}
                  </button>
                );
              })}
              {totalPages > 5 && <span style={{ padding: "0 8px", color: "#565959" }}>...</span>}
              {totalPages > 5 && (
                <button onClick={() => setPage(totalPages)}
                  style={{ width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "4px", border: "1px solid #DDDDDD", background: "#fff", cursor: "pointer" }}>
                  {totalPages}
                </button>
              )}
              <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages}
                style={{ width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "4px", border: "1px solid #DDDDDD", background: "#fff", cursor: page >= totalPages ? "not-allowed" : "pointer", color: page >= totalPages ? "#ccc" : "#0F1111" }}>
                <span class="material-symbols-outlined" style={{ fontSize: "14px" }}>chevron_left</span>
              </button>
            </div>
          </div>
        </section>

        {selectedOrder && (
          <div className="amazon-modal-overlay" onClick={() => setSelectedOrder(null)}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", width: "100%", maxWidth: "500px", borderRadius: "8px", boxShadow: "0 25px 50px rgba(0,0,0,0.25)", position: "relative", zIndex: 10, overflow: "hidden", animation: "scaleIn 0.2s" }}>
              <div style={{ padding: "24px", borderBottom: "1px solid #DDDDDD", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "20px", fontWeight: 600, color: "#0F1111", margin: 0 }}>تفاصيل الطلب <span style={{ color: "#565959" }}>#{selectedOrder.orderNumber}</span></h3>
                <button onClick={() => setSelectedOrder(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#565959", padding: "4px" }}>
                  <span class="material-symbols-outlined" style={{ fontSize: "24px" }}>close</span>
                </button>
              </div>
              <div style={{ padding: "24px", overflowY: "auto", maxHeight: "70vh" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 24px" }}>
                  <div><p style={{ fontSize: "12px", color: "#565959", margin: "0 0 4px" }}>اسم العميل</p><p style={{ fontWeight: 700, margin: 0 }}>{selectedOrder.customerName}</p></div>
                  <div><p style={{ fontSize: "12px", color: "#565959", margin: "0 0 4px" }}>رقم الهاتف</p><p style={{ margin: 0, direction: "ltr" }}>{selectedOrder.phone}</p></div>
                  <div style={{ gridColumn: "span 2" }}><p style={{ fontSize: "12px", color: "#565959", margin: "0 0 4px" }}>العنوان بالتفصيل</p><p style={{ margin: 0 }}>{selectedOrder.address}</p></div>
                  <div><p style={{ fontSize: "12px", color: "#565959", margin: "0 0 4px" }}>المحافظة</p><p style={{ margin: 0 }}>{selectedOrder.governorate}</p></div>
                  <div><p style={{ fontSize: "12px", color: "#565959", margin: "0 0 4px" }}>المتجر</p><p style={{ margin: 0, fontWeight: 700, color: "#C45500" }}>{storeBadge(selectedOrder.createdBy).label}</p></div>
                  <div style={{ gridColumn: "span 2", padding: "16px", background: "#EBEEEE", borderRadius: "8px" }}>
                    <p style={{ fontSize: "12px", color: "#565959", marginBottom: "8px", borderBottom: "1px solid #DDDDDD", paddingBottom: "4px" }}>المنتجات المطلوبة</p>
                    {selectedOrder.items.map((item, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "14px", marginBottom: "4px" }}>
                        <span>{item.quantity}x {item.color}{item.size ? ` - ${item.size}` : ""}</span>
                      </div>
                    ))}
                  </div>
                  {selectedOrder.notes && (
                    <div style={{ gridColumn: "span 2" }}><p style={{ fontSize: "12px", color: "#565959", margin: "0 0 4px" }}>ملاحظات العميل</p><p style={{ margin: 0, fontStyle: "italic", color: "#565959" }}>{selectedOrder.notes}</p></div>
                  )}
                </div>
              </div>
              <div style={{ padding: "24px", background: "#F1F4F4", borderTop: "1px solid #DDDDDD", display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                <button onClick={() => setSelectedOrder(null)} style={{ padding: "8px 24px", border: "1px solid #888C8C", background: "#fff", borderRadius: "4px", fontWeight: 700, cursor: "pointer" }}>إغلاق</button>
              </div>
            </div>
          </div>
        )}

        {deleteId && (
          <div className="amazon-modal-overlay" onClick={() => setDeleteId(null)}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", width: "100%", maxWidth: "360px", borderRadius: "8px", boxShadow: "0 25px 50px rgba(0,0,0,0.25)", padding: "24px", textAlign: "center" }}>
              <div style={{ fontSize: "48px", marginBottom: "12px" }}>🗑️</div>
              <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "18px", fontWeight: 700, margin: "0 0 8px" }}>تأكيد الحذف</h3>
              <p style={{ fontSize: "14px", color: "#565959", margin: "0 0 24px" }}>هل أنت متأكد من حذف هذا الطلب؟ لا يمكن التراجع عن هذا الإجراء.</p>
              <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
                <button onClick={() => setDeleteId(null)} style={{ padding: "10px 24px", border: "1px solid #888C8C", background: "#fff", borderRadius: "8px", fontWeight: 700, cursor: "pointer" }}>تراجع</button>
                <button onClick={deleteOrder} style={{ padding: "10px 24px", background: "#B12704", color: "#fff", borderRadius: "8px", fontWeight: 700, border: "none", cursor: "pointer" }}>حذف</button>
              </div>
            </div>
          </div>
        )}

        <footer style={{ width: "100%", padding: "32px 0", marginTop: "48px", borderTop: "1px solid #DDDDDD", background: "#E0E3E3", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px" }}>
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
