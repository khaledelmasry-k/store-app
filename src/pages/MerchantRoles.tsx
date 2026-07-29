import { useState, useEffect } from "preact/compat";
import { api } from "../services/api";
import Sidebar from "../components/Sidebar";

interface Permission {
  id: string;
  resource: string;
  action: string;
}

interface Role {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  permissions: Permission[];
  createdAt: string;
  updatedAt: string;
}

const RESOURCE_LABELS: Record<string, string> = {
  products: "المنتجات", orders: "الطلبات", customers: "العملاء",
  reports: "التقارير", settings: "الإعدادات", team: "فريق العمل",
  sellers: "البائعين", "landing-pages": "صفحات الهبوط", "store-links": "الروابط التسويقية",
};
const ACTION_LABELS: Record<string, string> = {
  view: "عرض", create: "إضافة", edit: "تعديل", delete: "حذف",
};

export default function MerchantRoles() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [resources, setResources] = useState<string[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [editRole, setEditRole] = useState<Role | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formPerms, setFormPerms] = useState<Record<string, string[]>>({});
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  useEffect(() => {
    api.get<{ roles: Role[] }>("/merchant/roles").then((r) => setRoles(r.roles)).catch(() => {});
    api.get<{ resources: string[]; actions: string[] }>("/merchant/roles/resources").then((r) => {
      setResources(r.resources);
      setActions(r.actions);
    }).catch(() => {});
  }, []);

  const openNew = () => {
    setEditRole(null);
    setFormName("");
    setFormDesc("");
    const perms: Record<string, string[]> = {};
    resources.forEach((r) => { perms[r] = []; });
    setFormPerms(perms);
    setShowForm(true);
  };

  const openEdit = (role: Role) => {
    setEditRole(role);
    setFormName(role.name);
    setFormDesc(role.description || "");
    const perms: Record<string, string[]> = {};
    resources.forEach((r) => { perms[r] = []; });
    role.permissions.forEach((p) => {
      if (!perms[p.resource]) perms[p.resource] = [];
      if (!perms[p.resource].includes(p.action)) perms[p.resource].push(p.action);
    });
    setFormPerms(perms);
    setShowForm(true);
  };

  const togglePerm = (resource: string, action: string) => {
    setFormPerms((prev) => {
      const current = prev[resource] || [];
      return {
        ...prev,
        [resource]: current.includes(action)
          ? current.filter((a) => a !== action)
          : [...current, action],
      };
    });
  };

  const save = async () => {
    const permissions = Object.entries(formPerms).flatMap(([resource, acts]) =>
      acts.map((action) => ({ resource, action }))
    );
    const body = { name: formName, description: formDesc, permissions };
    if (editRole) {
      await api.put(`/merchant/roles/${editRole.id}`, body);
    } else {
      await api.post("/merchant/roles", body);
    }
    setShowForm(false);
    const r = await api.get<{ roles: Role[] }>("/merchant/roles");
    setRoles(r.roles);
    showToast(editRole ? "تم تحديث الدور" : "تم إنشاء الدور");
  };

  const remove = async (id: string, name: string) => {
    if (!window.confirm(`حذف دور "${name}"؟`)) return;
    await api.delete(`/merchant/roles/${id}`);
    setRoles((prev) => prev.filter((r) => r.id !== id));
    showToast("تم حذف الدور");
  };

  return (
    <div style={{ background: "#EAEDED", minHeight: "100vh", display: "flex" }}>
      <Sidebar />
      <div className="admin-content" style={{ flex: 1, padding: "24px", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        {toast && (
          <div style={{ position: "fixed", top: "80px", left: "50%", transform: "translateX(-50%)", zIndex: 1000, background: "#067D62", color: "#fff", padding: "12px 24px", borderRadius: "8px", fontWeight: 600, fontSize: "14px" }}>
            {toast}
          </div>
        )}

        <header style={{ marginBottom: "24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "24px", fontWeight: 600, color: "#0F1111", margin: 0 }}>
              <span class="material-symbols-outlined" style={{ verticalAlign: "middle", marginLeft: "8px" }}>manage_accounts</span>
              الأدوار والصلاحيات
            </h2>
            <p style={{ fontSize: "14px", color: "#595f68", margin: "4px 0 0" }}>{roles.length} دور</p>
          </div>
          <button onClick={openNew}
            style={{ background: "#FF9900", border: "none", borderRadius: "8px", padding: "10px 20px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", fontSize: "14px" }}>
            <span class="material-symbols-outlined" style={{ fontSize: "20px" }}>add</span>
            دور جديد
          </button>
        </header>

        {showForm && (
          <section style={{ background: "#fff", padding: "24px", borderRadius: "8px", border: "1px solid #DDDDDD", marginBottom: "24px" }}>
            <h3 style={{ margin: "0 0 16px", fontWeight: 700 }}>{editRole ? "تعديل الدور" : "دور جديد"}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "13px", fontWeight: 600, display: "block", marginBottom: "4px" }}>اسم الدور</label>
                  <input type="text" className="amazon-input" value={formName} onChange={(e) => setFormName((e.target as HTMLInputElement).value)} />
                </div>
                <div>
                  <label style={{ fontSize: "13px", fontWeight: 600, display: "block", marginBottom: "4px" }}>الوصف</label>
                  <input type="text" className="amazon-input" value={formDesc} onChange={(e) => setFormDesc((e.target as HTMLInputElement).value)} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: "13px", fontWeight: 600, display: "block", marginBottom: "8px" }}>الصلاحيات</label>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                    <thead>
                      <tr style={{ background: "#f4f4f5" }}>
                        <th style={{ padding: "8px 12px", border: "1px solid #DDDDDD", textAlign: "right" }}>الموارد</th>
                        {actions.map((a) => (
                          <th key={a} style={{ padding: "8px 12px", border: "1px solid #DDDDDD", textAlign: "center", fontWeight: 600 }}>
                            {ACTION_LABELS[a] || a}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {resources.map((r) => (
                        <tr key={r}>
                          <td style={{ padding: "8px 12px", border: "1px solid #DDDDDD", fontWeight: 600 }}>
                            {RESOURCE_LABELS[r] || r}
                          </td>
                          {actions.map((a) => (
                            <td key={a} style={{ padding: "8px 12px", border: "1px solid #DDDDDD", textAlign: "center" }}>
                              <input type="checkbox"
                                checked={(formPerms[r] || []).includes(a)}
                                onChange={() => togglePerm(r, a)}
                                style={{ accentColor: "#FF9900", width: "16px", height: "16px", cursor: "pointer" }} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ display: "flex", gap: "12px" }}>
                <button onClick={save} disabled={!formName}
                  style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "none", background: formName ? "#FF9900" : "#ccc", fontWeight: 700, cursor: formName ? "pointer" : "not-allowed" }}>
                  {editRole ? "تحديث" : "إنشاء"}
                </button>
                <button onClick={() => setShowForm(false)} style={{ padding: "10px 20px", borderRadius: "8px", border: "1px solid #DDDDDD", background: "#fff", fontWeight: 600, cursor: "pointer" }}>
                  إلغاء
                </button>
              </div>
            </div>
          </section>
        )}

        <section style={{ background: "#fff", borderRadius: "8px", border: "1px solid #DDDDDD", overflow: "hidden", flex: 1 }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
              <thead>
                <tr style={{ background: "#f4f4f5", color: "#555", fontWeight: 600 }}>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>الدور</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>الوصف</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>الصلاحيات</th>
                  <th style={{ padding: "12px 16px", textAlign: "center" }}>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((r) => (
                  <tr key={r.id} style={{ borderBottom: "1px solid #EAEDED" }}>
                    <td style={{ padding: "16px", fontWeight: 700 }}>{r.name}</td>
                    <td style={{ padding: "16px", color: "#565959", fontSize: "13px" }}>{r.description || "—"}</td>
                    <td style={{ padding: "16px" }}>
                      <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                        {r.permissions.slice(0, 4).map((p) => (
                          <span key={p.id} style={{ padding: "2px 8px", background: "#F0F4FF", borderRadius: "4px", fontSize: "11px", color: "#007185" }}>
                            {RESOURCE_LABELS[p.resource] || p.resource}: {ACTION_LABELS[p.action] || p.action}
                          </span>
                        ))}
                        {r.permissions.length > 4 && (
                          <span style={{ fontSize: "11px", color: "#565959" }}>+{r.permissions.length - 4}</span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: "16px", textAlign: "center" }}>
                      <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                        <button onClick={() => openEdit(r)}
                          style={{ background: "none", border: "1px solid #DDDDDD", borderRadius: "6px", padding: "6px 10px", cursor: "pointer" }}>
                          <span class="material-symbols-outlined" style={{ fontSize: "16px", verticalAlign: "middle" }}>edit</span>
                        </button>
                        <button onClick={() => remove(r.id, r.name)}
                          style={{ background: "none", border: "1px solid #B12704", borderRadius: "6px", padding: "6px 10px", cursor: "pointer", color: "#B12704" }}>
                          <span class="material-symbols-outlined" style={{ fontSize: "16px", verticalAlign: "middle" }}>delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {roles.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: "48px", textAlign: "center", color: "#565959" }}>لا توجد أدوار</td></tr>
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
