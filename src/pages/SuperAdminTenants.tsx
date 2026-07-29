import { useState, useEffect } from "preact/compat";
import { api } from "../services/api";
import Sidebar from "../components/Sidebar";

interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  domain: string | null;
  email: string;
  phone: string | null;
  status: string;
  plan: string;
  createdAt: string;
  storeCount: number;
  orderCount: number;
  userCount: number;
  totalRevenue: number;
  confirmedRevenue: number;
}

const PLANS = ["FREE", "STARTER", "PRO", "BUSINESS", "ENTERPRISE"];

export default function SuperAdminTenants() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ status: "", plan: "" });

  useEffect(() => {
    api.get<Tenant[]>("/admin/tenants").then(setTenants).catch(() => {});
  }, []);

  const filtered = tenants.filter((t) => {
    if (search && !t.name.includes(search) && !t.email.includes(search) && !t.subdomain.includes(search)) return false;
    if (statusFilter && t.status !== statusFilter) return false;
    return true;
  });

  const updateTenant = async (id: string) => {
    const body: Record<string, string> = {};
    if (editData.status) body.status = editData.status;
    if (editData.plan) body.plan = editData.plan;
    if (!body.status && !body.plan) return;
    await api.patch(`/admin/tenants/${id}`, body);
    setTenants((prev) => prev.map((t) => (t.id === id ? { ...t, ...body } : t)));
    setEditingId(null);
  };

  return (
    <div style={{ background: "#EAEDED", minHeight: "100vh", display: "flex" }}>
      <Sidebar />
      <div className="admin-content" style={{ flex: 1, padding: "24px", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <header style={{ marginBottom: "24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "24px", fontWeight: 600, color: "#0F1111", margin: 0 }}>إدارة التجار</h2>
            <p style={{ fontSize: "14px", color: "#565959", margin: "4px 0 0" }}>{tenants.length} تاجر</p>
          </div>
        </header>

        <section style={{ background: "#fff", padding: "16px", borderRadius: "8px", border: "1px solid #DDDDDD", marginBottom: "24px", display: "flex", gap: "12px", alignItems: "center" }}>
          <input type="text" placeholder="بحث بالاسم أو البريد أو النطاق..." className="amazon-input" style={{ flex: 1 }}
            value={search} onChange={(e) => setSearch((e.target as HTMLInputElement).value)} />
          <select className="amazon-select" value={statusFilter} onChange={(e) => setStatusFilter((e.target as HTMLSelectElement).value)}>
            <option value="">كل الحالات</option>
            <option value="ACTIVE">نشط</option>
            <option value="SUSPENDED">موقوف</option>
          </select>
        </section>

        <section style={{ background: "#fff", borderRadius: "8px", border: "1px solid #DDDDDD", overflow: "hidden", flex: 1 }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
              <thead>
                <tr style={{ background: "#f4f4f5", color: "#555", fontWeight: 600 }}>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>التاجر</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>النطاق</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>الحالة</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>الباقة</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>المتاجر</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>الطلبات</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>الإيرادات</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>التاريخ</th>
                  <th style={{ padding: "12px 16px", textAlign: "center" }}>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => {
                  const isEditing = editingId === t.id;
                  return (
                    <tr key={t.id} style={{ borderBottom: "1px solid #EAEDED" }}>
                      <td style={{ padding: "16px" }}>
                        <div style={{ fontWeight: 700 }}>{t.name}</div>
                        <div style={{ fontSize: "12px", color: "#565959" }}>{t.email}</div>
                      </td>
                      <td style={{ padding: "16px", direction: "ltr", textAlign: "right" }}>{t.subdomain}.mkstore.com</td>
                      <td style={{ padding: "16px" }}>
                        {isEditing ? (
                          <select className="amazon-select" value={editData.status} onChange={(e) => setEditData({ ...editData, status: (e.target as HTMLSelectElement).value })}>
                            <option value="ACTIVE">نشط</option>
                            <option value="SUSPENDED">موقوف</option>
                          </select>
                        ) : (
                          <span style={{
                            padding: "4px 10px", borderRadius: "4px", fontSize: "12px", fontWeight: 700, display: "inline-block",
                            background: t.status === "ACTIVE" ? "#ECFDF5" : "#FEF2F2",
                            color: t.status === "ACTIVE" ? "#067D62" : "#B12704",
                          }}>
                            {t.status === "ACTIVE" ? "نشط" : "موقوف"}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "16px" }}>
                        {isEditing ? (
                          <select className="amazon-select" value={editData.plan} onChange={(e) => setEditData({ ...editData, plan: (e.target as HTMLSelectElement).value })}>
                            {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
                          </select>
                        ) : (
                          <span style={{
                            padding: "4px 10px", borderRadius: "4px", fontSize: "12px", fontWeight: 700, display: "inline-block",
                            background: "#F0F9FF", color: "#007185",
                          }}>{t.plan}</span>
                        )}
                      </td>
                      <td style={{ padding: "16px", fontWeight: 700 }}>{t.storeCount}</td>
                      <td style={{ padding: "16px", fontWeight: 700 }}>{t.orderCount}</td>
                      <td style={{ padding: "16px", fontWeight: 700 }}>{t.totalRevenue.toLocaleString()} ج.م</td>
                      <td style={{ padding: "16px", color: "#565959", fontSize: "13px" }}>{new Date(t.createdAt).toLocaleDateString("en-CA")}</td>
                      <td style={{ padding: "16px", textAlign: "center" }}>
                        {isEditing ? (
                          <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                            <button onClick={() => updateTenant(t.id)}
                              style={{ background: "#FF9900", border: "none", borderRadius: "6px", padding: "6px 12px", fontWeight: 700, cursor: "pointer", fontSize: "12px" }}>
                              حفظ
                            </button>
                            <button onClick={() => setEditingId(null)}
                              style={{ background: "#f4f4f5", border: "none", borderRadius: "6px", padding: "6px 12px", fontWeight: 600, cursor: "pointer", fontSize: "12px", color: "#565959" }}>
                              إلغاء
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => { setEditingId(t.id); setEditData({ status: t.status, plan: t.plan }); }}
                            style={{ background: "none", border: "1px solid #DDDDDD", borderRadius: "6px", padding: "6px 12px", cursor: "pointer", fontSize: "12px" }}>
                            <span class="material-symbols-outlined" style={{ fontSize: "16px", verticalAlign: "middle" }}>edit</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={9} style={{ padding: "48px", textAlign: "center", color: "#565959" }}>لا يوجد تجار</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <footer style={{ marginTop: "auto", padding: "16px 0 0", textAlign: "center" }}>
          <p style={{ fontSize: "14px", color: "#565959", opacity: 0.8, margin: 0 }}>© 2025 M&K Store. جميع الحقوق محفوظة.</p>
        </footer>
      </div>
    </div>
  );
}
