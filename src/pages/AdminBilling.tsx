import Sidebar from "../components/Sidebar";

const invoices = [
  { date: "2024-07-01", plan: "ستارتر", amount: 0, status: "مدفوع" },
];

export default function AdminBilling() {
  return (
    <div style={{ background: "#EAEDED", minHeight: "100vh", display: "flex" }}>
      <Sidebar />
      <div className="admin-content" style={{ flex: 1, padding: "24px", minHeight: "100vh" }}>
        <div style={{ marginBottom: "32px" }}>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "24px", fontWeight: 600, color: "#0F1111", margin: 0 }}>💰 الفواتير</h2>
          <p style={{ fontSize: "14px", color: "#595f68", margin: "4px 0 0" }}>سجل الفواتير والمدفوعات</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "32px" }}>
          <div style={{ background: "#fff", padding: "20px", borderRadius: "8px", border: "1px solid #DDDDDD" }}>
            <span style={{ fontSize: "28px" }}>💳</span>
            <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "24px", fontWeight: 700, color: "#131921", marginTop: "4px" }}>مجاني</div>
            <div style={{ fontSize: "12px", color: "#565959" }}>الاشتراك الحالي</div>
          </div>
          <div style={{ background: "#fff", padding: "20px", borderRadius: "8px", border: "1px solid #DDDDDD" }}>
            <span style={{ fontSize: "28px" }}>📄</span>
            <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "24px", fontWeight: 700, color: "#067D62", marginTop: "4px" }}>{invoices.length}</div>
            <div style={{ fontSize: "12px", color: "#565959" }}>إجمالي الفواتير</div>
          </div>
          <div style={{ background: "#fff", padding: "20px", borderRadius: "8px", border: "1px solid #DDDDDD" }}>
            <span style={{ fontSize: "28px" }}>✅</span>
            <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "24px", fontWeight: 700, color: "#007185", marginTop: "4px" }}>{invoices.filter((i) => i.status === "مدفوع").length}</div>
            <div style={{ fontSize: "12px", color: "#565959" }}>فواتير مدفوعة</div>
          </div>
        </div>

        <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 2px 4px rgba(0,0,0,0.08)", border: "1px solid #DDDDDD" }}>
          <div style={{ padding: "20px 24px", borderBottom: "1px solid #DDDDDD" }}>
            <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "18px", fontWeight: 600, margin: 0 }}>📋 سجل الفواتير</h3>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", textAlign: "right", borderCollapse: "collapse", fontSize: "14px" }}>
              <thead>
                <tr style={{ background: "#EBEEEE", color: "#565959", fontWeight: 600 }}>
                  <th style={{ padding: "16px", borderBottom: "1px solid #DDDDDD" }}>التاريخ</th>
                  <th style={{ padding: "16px", borderBottom: "1px solid #DDDDDD" }}>الباقة</th>
                  <th style={{ padding: "16px", borderBottom: "1px solid #DDDDDD" }}>المبلغ</th>
                  <th style={{ padding: "16px", borderBottom: "1px solid #DDDDDD" }}>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #DDDDDD" }}>
                    <td style={{ padding: "16px" }}>{new Date(inv.date).toLocaleDateString("ar-EG")}</td>
                    <td style={{ padding: "16px" }}>{inv.plan}</td>
                    <td style={{ padding: "16px", fontWeight: 600 }}>{inv.amount === 0 ? "مجاني" : `${inv.amount} ج.م`}</td>
                    <td style={{ padding: "16px" }}>
                      <span style={{ background: "#067D62", color: "#fff", padding: "4px 12px", borderRadius: "9999px", fontSize: "12px", fontWeight: 600 }}>{inv.status}</span>
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
