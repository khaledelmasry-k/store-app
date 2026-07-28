import { useState, useEffect } from "preact/compat";
import { api } from "../services/api";
import type { Order, PaginatedResponse, OrderStatus } from "../types";
import Sidebar from "../components/Sidebar";

const STATUSES: OrderStatus[] = ["NEW", "CONTACTED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];
const STATUS_LABELS: Record<OrderStatus, string> = {
  NEW: "جديد", CONTACTED: "تم التواصل", PROCESSING: "قيد المعالجة",
  SHIPPED: "تم الشحن", DELIVERED: "تم التوصيل", CANCELLED: "ملغي",
};
const STATUS_COLORS: Record<OrderStatus, string> = {
  NEW: "#006e2f", CONTACTED: "#2563eb", PROCESSING: "#d97706",
  SHIPPED: "#7c3aed", DELIVERED: "#006e2f", CANCELLED: "#ba1a1a",
};

export default function AdminOrders() {
  const [data, setData] = useState<PaginatedResponse<Order> | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [phone, setPhone] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const limit = 10;

  const fetchOrders = () => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.set("search", search);
    if (phone) params.set("phone", phone);
    if (statusFilter) params.set("status", statusFilter);
    api.get<PaginatedResponse<Order>>(`/admin/orders?${params}`).then(setData);
  };

  useEffect(() => { fetchOrders(); }, [page, statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchOrders();
  };

  const updateStatus = async (id: string, status: OrderStatus) => {
    await api.patch(`/admin/orders/${id}/status`, { status });
    fetchOrders();
  };

  const deleteOrder = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا الطلب؟")) return;
    await api.delete(`/admin/orders/${id}`);
    fetchOrders();
  };

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif", direction: "rtl", background: "#fbf8ff", minHeight: "100vh", display: "flex" }}>
      <Sidebar />
      <div className="admin-content" style={{ flex: 1, padding: "24px", overflow: "auto" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 600, margin: "0 0 24px" }}>إدارة الطلبات</h1>

        <div style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
          <form onSubmit={handleSearch} style={{ display: "flex", gap: "8px", flex: 1 }}>
            <input name="search_name" id="search_name" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="البحث باسم العميل" style={{ flex: 1, padding: "8px 12px", border: "1px solid #d4d4d8", borderRadius: "4px", fontSize: "14px" }} />
            <input name="search_phone" id="search_phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="البحث برقم الهاتف" style={{ flex: 1, padding: "8px 12px", border: "1px solid #d4d4d8", borderRadius: "4px", fontSize: "14px" }} />
            <button type="submit" style={{ background: "black", color: "white", border: "none", borderRadius: "4px", padding: "8px 16px", cursor: "pointer" }}>بحث</button>
          </form>

          <select name="status_filter" id="status_filter" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} style={{ padding: "8px", border: "1px solid #d4d4d8", borderRadius: "4px", fontSize: "14px", background: "white" }}>
            <option value="">كل الحالات</option>
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        </div>

        <div className="admin-table-wrap" style={{ background: "white", borderRadius: "8px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
            <thead>
              <tr style={{ background: "#f4f4f5", borderBottom: "1px solid #e4e4e7" }}>
                {["#", "اسم العميل", "رقم الهاتف", "المتجر", "المنتجات", "الإجمالي", "المحافظة", "الحالة", "التاريخ", "إجراءات"].map((h) => (
                  <th key={h} style={{ padding: "10px 12px", textAlign: "right", fontWeight: 500, color: "#71717a" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data?.orders.map((order) => (
                <tr key={order.id} style={{ borderBottom: "1px solid #f4f4f5" }}>
                  <td style={{ padding: "10px 12px", fontWeight: 600 }}>{order.orderNumber}</td>
                  <td style={{ padding: "10px 12px" }}>{order.customerName}</td>
                  <td style={{ padding: "10px 12px", direction: "ltr", textAlign: "right" }}>{order.phone}</td>
                  <td style={{ padding: "10px 12px", fontSize: "13px", color: order.createdBy === "1" ? "#c2410c" : "#006e2f", fontWeight: 600 }}>
                    {order.createdBy === "1" ? "بنطلون الساحل" : order.createdBy === "2" ? "مالك ستور" : order.createdBy}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    {order.items.map((item, i) => (
                      <div key={i} style={{ fontSize: "13px" }}>
                        {item.color} / {item.size} × {item.quantity}
                      </div>
                    ))}
                  </td>
                  <td style={{ padding: "10px 12px", fontWeight: 600 }}>{order.totalPrice.toLocaleString()} ج.م</td>
                  <td style={{ padding: "10px 12px" }}>{order.governorate}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <select value={order.status} onChange={(e) => updateStatus(order.id, e.target.value as OrderStatus)} style={{ padding: "4px 8px", borderRadius: "4px", border: `1px solid ${STATUS_COLORS[order.status]}`, color: STATUS_COLORS[order.status], background: "white", fontSize: "12px", fontWeight: 500 }}>
                      {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: "10px 12px", color: "#71717a", fontSize: "13px" }}>{new Date(order.createdAt).toLocaleDateString("ar-SA")}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ display: "flex", gap: "4px" }}>
                      <button onClick={() => setSelectedOrder(order)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "18px" }}>👁️</button>
                      <button onClick={() => deleteOrder(order.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "18px" }}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px", fontSize: "14px", color: "#71717a" }}>
            <span>عرض {(page - 1) * limit + 1} إلى {Math.min(page * limit, data.pagination.total)} من أصل {data.pagination.total} طلب</span>
            <div style={{ display: "flex", gap: "4px" }}>
              {Array.from({ length: data.pagination.totalPages }, (_, i) => i + 1).map((p) => (
                <button key={p} onClick={() => setPage(p)} style={{ width: "32px", height: "32px", borderRadius: "4px", border: p === page ? "2px solid black" : "1px solid #d4d4d8", background: p === page ? "black" : "white", color: p === page ? "white" : "black", cursor: "pointer", fontSize: "14px" }}>{p}</button>
              ))}
            </div>
          </div>
        )}

        {selectedOrder && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setSelectedOrder(null)}>
            <div style={{ background: "white", borderRadius: "8px", padding: "24px", maxWidth: "500px", width: "90%", maxHeight: "80vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
              <h2 style={{ margin: "0 0 16px", fontSize: "18px" }}>تفاصيل الطلب {selectedOrder.orderNumber}</h2>
              <div style={{ display: "grid", gap: "8px", fontSize: "14px" }}>
                {[
                  ["اسم العميل", selectedOrder.customerName],
                  ["رقم الهاتف", selectedOrder.phone],
                  ["المحافظة", selectedOrder.governorate],
                  ["المدينة", selectedOrder.city],
                  ["العنوان", selectedOrder.address],
                  ["المتجر", selectedOrder.createdBy === "1" ? "بنطلون الساحل" : selectedOrder.createdBy === "2" ? "مالك ستور" : selectedOrder.createdBy],
                  ["المنتجات", selectedOrder.items.map((i) => `${i.color} / ${i.size} × ${i.quantity}`).join("، ")],
                  ["الإجمالي", `${selectedOrder.totalPrice.toLocaleString()} ج.م`],
                  ["ملاحظات", selectedOrder.notes || "بدون"],
                  ["الحالة", STATUS_LABELS[selectedOrder.status]],
                  ["تاريخ الطلب", new Date(selectedOrder.createdAt).toLocaleString("ar-SA")],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f4f4f5" }}>
                    <span style={{ color: "#71717a" }}>{k}</span>
                    <span style={{ fontWeight: 500 }}>{v}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => setSelectedOrder(null)} style={{ width: "100%", marginTop: "16px", padding: "10px", background: "black", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>إغلاق</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
