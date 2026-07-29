import { useState, useEffect } from "preact/compat";
import { api } from "../services/api";
import Sidebar from "../components/Sidebar";

interface StoreData {
  id: string; ref: string; name: string; active: boolean;
}

export default function AdminSuperAdmin() {
  const [stores, setStores] = useState<StoreData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<StoreData[]>("/admin/settings/stores").then((d) => { setStores(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  return (
    <div style={{ background: "#EAEDED", minHeight: "100vh", display: "flex" }}>
      <Sidebar />
      <div className="admin-content" style={{ flex: 1, padding: "24px", minHeight: "100vh" }}>
        <div style={{ marginBottom: "32px" }}>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "24px", fontWeight: 600, color: "#0F1111", margin: 0 }}>المشرف العام</h2>
          <p style={{ fontSize: "14px", color: "#595f68", margin: "4px 0 0" }}>إدارة المتاجر والمستخدمين من مكان واحد</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px", marginBottom: "32px" }}>
          <div style={{ background: "#fff", padding: "24px", borderRadius: "12px", border: "1px solid #DDDDDD", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
            <span style={{ fontSize: "32px" }}>🏪</span>
            <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "28px", fontWeight: 700, color: "#131921", marginTop: "8px" }}>{loading ? "..." : stores.length}</div>
            <div style={{ fontSize: "13px", color: "#565959" }}>إجمالي المتاجر</div>
          </div>
          <div style={{ background: "#fff", padding: "24px", borderRadius: "12px", border: "1px solid #DDDDDD", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
            <span style={{ fontSize: "32px" }}>✅</span>
            <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "28px", fontWeight: 700, color: "#067D62", marginTop: "8px" }}>{loading ? "..." : stores.filter((s) => s.active).length}</div>
            <div style={{ fontSize: "13px", color: "#565959" }}>المتاجر النشطة</div>
          </div>
          <div style={{ background: "#fff", padding: "24px", borderRadius: "12px", border: "1px solid #DDDDDD", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
            <span style={{ fontSize: "32px" }}>👤</span>
            <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "28px", fontWeight: 700, color: "#007185", marginTop: "8px" }}>1</div>
            <div style={{ fontSize: "13px", color: "#565959" }}>المستخدمين</div>
          </div>
          <div style={{ background: "#fff", padding: "24px", borderRadius: "12px", border: "1px solid #DDDDDD", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
            <span style={{ fontSize: "32px" }}>📦</span>
            <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "28px", fontWeight: 700, color: "#C45500", marginTop: "8px" }}>1</div>
            <div style={{ fontSize: "13px", color: "#565959" }}>المنتجات</div>
          </div>
        </div>

        <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 2px 4px rgba(0,0,0,0.08)", border: "1px solid #DDDDDD" }}>
          <div style={{ padding: "20px 24px", borderBottom: "1px solid #DDDDDD", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "18px", fontWeight: 600, margin: 0 }}>📋 المتاجر</h3>
            <button style={{ background: "#131921", color: "#fff", border: "none", padding: "8px 20px", borderRadius: "8px", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}>+ إضافة متجر</button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", textAlign: "right", borderCollapse: "collapse", fontSize: "14px" }}>
              <thead>
                <tr style={{ background: "#EBEEEE", color: "#565959", fontWeight: 600 }}>
                  <th style={{ padding: "16px", borderBottom: "1px solid #DDDDDD" }}>الاسم</th>
                  <th style={{ padding: "16px", borderBottom: "1px solid #DDDDDD" }}>المرجع</th>
                  <th style={{ padding: "16px", borderBottom: "1px solid #DDDDDD" }}>الحالة</th>
                  <th style={{ padding: "16px", borderBottom: "1px solid #DDDDDD" }}>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {stores.map((store) => (
                  <tr key={store.id} style={{ borderBottom: "1px solid #DDDDDD" }}>
                    <td style={{ padding: "16px", fontWeight: 700 }}>{store.name}</td>
                    <td style={{ padding: "16px", color: "#565959" }}>{store.ref}</td>
                    <td style={{ padding: "16px" }}>
                      <span style={{ background: store.active ? "#067D62" : "#565959", color: "#fff", padding: "4px 12px", borderRadius: "9999px", fontSize: "12px", fontWeight: 600 }}>{store.active ? "نشط" : "موقف"}</span>
                    </td>
                    <td style={{ padding: "16px" }}>
                      <button style={{ background: "none", border: "none", color: "#007185", cursor: "pointer", fontWeight: 600, fontSize: "13px" }}>تعديل</button>
                    </td>
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
