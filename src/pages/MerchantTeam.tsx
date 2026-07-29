import { useState, useEffect } from "preact/compat";
import { api } from "../services/api";
import Sidebar from "../components/Sidebar";

interface TeamMember {
  id: string;
  adminId: string;
  username: string;
  email: string;
  role: string;
  adminRole: string;
  createdAt: string;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
}

export default function MerchantTeam() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("EDITOR");
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const fetchData = () => {
    api.get<{ members: TeamMember[] }>("/merchant/team").then((r) => setMembers(r.members)).catch(() => {});
    api.get<{ invitations: Invitation[] }>("/merchant/invitations").then((r) => setInvitations(r.invitations)).catch(() => {});
  };

  useEffect(() => { fetchData(); }, []);

  const removeMember = async (id: string, username: string) => {
    if (!window.confirm(`إزالة ${username} من فريق العمل؟`)) return;
    await api.delete(`/merchant/team/${id}`);
    fetchData();
    showToast("تم إزالة العضو");
  };

  const sendInvite = async () => {
    if (!inviteEmail) return;
    await api.post("/merchant/invitations", { email: inviteEmail, role: inviteRole });
    setShowInvite(false);
    setInviteEmail("");
    fetchData();
    showToast("تم إرسال الدعوة");
  };

  const cancelInvite = async (id: string) => {
    await api.delete(`/merchant/invitations/${id}`);
    fetchData();
    showToast("تم إلغاء الدعوة");
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
              <span class="material-symbols-outlined" style={{ verticalAlign: "middle", marginLeft: "8px" }}>group</span>
              فريق العمل
            </h2>
            <p style={{ fontSize: "14px", color: "#595f68", margin: "4px 0 0" }}>{members.length} عضو • {invitations.length} دعوة معلقة</p>
          </div>
          <button onClick={() => setShowInvite(true)}
            style={{ background: "#FF9900", border: "none", borderRadius: "8px", padding: "10px 20px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", fontSize: "14px" }}>
            <span class="material-symbols-outlined" style={{ fontSize: "20px" }}>person_add</span>
            دعوة عضو
          </button>
        </header>

        {showInvite && (
          <section style={{ background: "#fff", padding: "24px", borderRadius: "8px", border: "1px solid #DDDDDD", marginBottom: "24px" }}>
            <h3 style={{ margin: "0 0 16px", fontWeight: 700 }}>دعوة عضو جديد</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "13px", fontWeight: 600, display: "block", marginBottom: "4px" }}>البريد الإلكتروني</label>
                <input type="email" className="amazon-input" value={inviteEmail} onChange={(e) => setInviteEmail((e.target as HTMLInputElement).value)} placeholder="user@example.com" />
              </div>
              <div>
                <label style={{ fontSize: "13px", fontWeight: 600, display: "block", marginBottom: "4px" }}>الدور</label>
                <select className="amazon-input" value={inviteRole} onChange={(e) => setInviteRole((e.target as HTMLSelectElement).value)}>
                  <option value="ADMIN">مدير</option>
                  <option value="EDITOR">محرر</option>
                  <option value="VIEWER">مشاهد</option>
                </select>
              </div>
              <div style={{ display: "flex", gap: "12px" }}>
                <button onClick={sendInvite} disabled={!inviteEmail}
                  style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "none", background: inviteEmail ? "#FF9900" : "#ccc", fontWeight: 700, cursor: inviteEmail ? "pointer" : "not-allowed" }}>
                  إرسال الدعوة
                </button>
                <button onClick={() => setShowInvite(false)} style={{ padding: "10px 20px", borderRadius: "8px", border: "1px solid #DDDDDD", background: "#fff", fontWeight: 600, cursor: "pointer" }}>
                  إلغاء
                </button>
              </div>
            </div>
          </section>
        )}

        <section style={{ background: "#fff", borderRadius: "8px", border: "1px solid #DDDDDD", overflow: "hidden", marginBottom: "24px" }}>
          <div style={{ padding: "16px", borderBottom: "1px solid #EAEDED", fontWeight: 700, fontSize: "15px" }}>
            الأعضاء ({members.length})
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
              <thead>
                <tr style={{ background: "#f4f4f5", color: "#555", fontWeight: 600 }}>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>الاسم</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>البريد</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>الدور</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>تاريخ الانضمام</th>
                  <th style={{ padding: "12px 16px", textAlign: "center" }}></th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} style={{ borderBottom: "1px solid #EAEDED" }}>
                    <td style={{ padding: "16px", fontWeight: 700 }}>{m.username}</td>
                    <td style={{ padding: "16px", color: "#565959" }}>{m.email}</td>
                    <td style={{ padding: "16px" }}>
                      <span style={{
                        padding: "4px 10px", borderRadius: "4px", fontSize: "12px", fontWeight: 700,
                        background: m.role === "ADMIN" ? "#ECFDF5" : "#F0F4FF", color: m.role === "ADMIN" ? "#067D62" : "#007185",
                      }}>{m.role === "ADMIN" ? "مدير" : m.role === "EDITOR" ? "محرر" : "مشاهد"}</span>
                    </td>
                    <td style={{ padding: "16px", fontSize: "13px", color: "#565959" }}>{new Date(m.createdAt).toLocaleDateString("en-CA")}</td>
                    <td style={{ padding: "16px", textAlign: "center" }}>
                      <button onClick={() => removeMember(m.id, m.username)}
                        style={{ background: "none", border: "1px solid #B12704", borderRadius: "6px", padding: "6px 10px", cursor: "pointer", color: "#B12704", fontSize: "13px" }}>
                        إزالة
                      </button>
                    </td>
                  </tr>
                ))}
                {members.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: "48px", textAlign: "center", color: "#565959" }}>لا يوجد أعضاء</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {invitations.length > 0 && (
          <section style={{ background: "#fff", borderRadius: "8px", border: "1px solid #DDDDDD", overflow: "hidden" }}>
            <div style={{ padding: "16px", borderBottom: "1px solid #EAEDED", fontWeight: 700, fontSize: "15px" }}>
              الدعوات المعلقة ({invitations.length})
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                <thead>
                  <tr style={{ background: "#f4f4f5", color: "#555", fontWeight: 600 }}>
                    <th style={{ padding: "12px 16px", textAlign: "right" }}>البريد</th>
                    <th style={{ padding: "12px 16px", textAlign: "right" }}>الدور</th>
                    <th style={{ padding: "12px 16px", textAlign: "right" }}>تاريخ الإرسال</th>
                    <th style={{ padding: "12px 16px", textAlign: "right" }}>تنتهي في</th>
                    <th style={{ padding: "12px 16px", textAlign: "center" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {invitations.map((i) => (
                    <tr key={i.id} style={{ borderBottom: "1px solid #EAEDED" }}>
                      <td style={{ padding: "16px", fontWeight: 700 }}>{i.email}</td>
                      <td style={{ padding: "16px" }}>
                        <span style={{
                          padding: "4px 10px", borderRadius: "4px", fontSize: "12px", fontWeight: 700,
                          background: "#F0F4FF", color: "#007185",
                        }}>{i.role === "ADMIN" ? "مدير" : i.role === "EDITOR" ? "محرر" : "مشاهد"}</span>
                      </td>
                      <td style={{ padding: "16px", fontSize: "13px", color: "#565959" }}>{new Date(i.createdAt).toLocaleDateString("en-CA")}</td>
                      <td style={{ padding: "16px", fontSize: "13px", color: new Date(i.expiresAt) < new Date() ? "#B12704" : "#565959" }}>
                        {new Date(i.expiresAt).toLocaleDateString("en-CA")}
                      </td>
                      <td style={{ padding: "16px", textAlign: "center" }}>
                        <button onClick={() => cancelInvite(i.id)}
                          style={{ background: "none", border: "1px solid #DDDDDD", borderRadius: "6px", padding: "6px 10px", cursor: "pointer", fontSize: "13px" }}>
                          إلغاء
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
