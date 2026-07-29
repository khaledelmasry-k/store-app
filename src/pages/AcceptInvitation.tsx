import { useState, useEffect } from "preact/compat";
import { api, API_BASE } from "../services/api";

export default function AcceptInvitation() {
  const token = window.location.pathname.split("/").pop() || "";
  const [valid, setValid] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<{ valid: boolean; email?: string; role?: string; error?: string }>(`/merchant/invitations/accept/${token}`)
      .then((r) => {
        if (r.valid) {
          setValid(true);
          setEmail(r.email || "");
          setRole(r.role || "");
        } else {
          setValid(false);
          setError(r.error || "الدعوة غير صالحة");
        }
      })
      .catch(() => { setValid(false); setError("الدعوة غير صالحة"); });
  }, [token]);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch(`${API_BASE}/merchant/invitations/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, username, password }),
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err.error || "حدث خطأ");
        return;
      }
      setDone(true);
    } catch { setError("حدث خطأ في الاتصال"); }
  };

  if (valid === null) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#EAEDED" }}>
        <p style={{ color: "#565959" }}>جاري التحقق من الدعوة...</p>
      </div>
    );
  }

  if (done) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#EAEDED" }}>
        <div style={{ background: "#fff", padding: "40px", borderRadius: "12px", border: "1px solid #DDDDDD", textAlign: "center", maxWidth: "400px", width: "100%" }}>
          <span style={{ fontSize: "48px", color: "#067D62" }}>✅</span>
          <h2 style={{ margin: "16px 0", fontWeight: 700 }}>تم إنشاء الحساب بنجاح!</h2>
          <p style={{ color: "#565959", marginBottom: "24px" }}>يمكنك الآن تسجيل الدخول باستخدام اسم المستخدم وكلمة المرور.</p>
          <a href="/login" style={{ display: "inline-block", padding: "12px 24px", background: "#FF9900", borderRadius: "8px", fontWeight: 700, textDecoration: "none", color: "#131921" }}>
            تسجيل الدخول
          </a>
        </div>
      </div>
    );
  }

  if (!valid) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#EAEDED" }}>
        <div style={{ background: "#fff", padding: "40px", borderRadius: "12px", border: "1px solid #DDDDDD", textAlign: "center", maxWidth: "400px", width: "100%" }}>
          <span style={{ fontSize: "48px", color: "#B12704" }}>❌</span>
          <h2 style={{ margin: "16px 0", fontWeight: 700 }}>الدعوة غير صالحة</h2>
          <p style={{ color: "#565959" }}>{error || "قد تكون الدعوة منتهية الصلاحية أو تم استخدامها مسبقاً."}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#EAEDED" }}>
      <div style={{ background: "#fff", padding: "40px", borderRadius: "12px", border: "1px solid #DDDDDD", maxWidth: "400px", width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "28px", fontWeight: 700, color: "#131921", margin: 0 }}>M&K Store</h1>
          <p style={{ fontSize: "14px", color: "#565959", marginTop: "8px" }}>تمت دعوتك للانضمام كـ <strong>{role === "ADMIN" ? "مدير" : role === "EDITOR" ? "محرر" : "مشاهد"}</strong></p>
        </div>
        {error && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "8px", padding: "12px", marginBottom: "16px", color: "#B12704", fontSize: "13px" }}>
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ fontSize: "13px", fontWeight: 600, display: "block", marginBottom: "4px" }}>البريد الإلكتروني</label>
            <input type="email" className="amazon-input" value={email} disabled style={{ background: "#f4f4f5" }} />
          </div>
          <div>
            <label style={{ fontSize: "13px", fontWeight: 600, display: "block", marginBottom: "4px" }}>اسم المستخدم</label>
            <input type="text" className="amazon-input" value={username} onChange={(e) => setUsername((e.target as HTMLInputElement).value)} required minLength={3} placeholder="اختر اسم مستخدم" />
          </div>
          <div>
            <label style={{ fontSize: "13px", fontWeight: 600, display: "block", marginBottom: "4px" }}>كلمة المرور</label>
            <input type="password" className="amazon-input" value={password} onChange={(e) => setPassword((e.target as HTMLInputElement).value)} required minLength={6} placeholder="كلمة المرور (6 أحرف على الأقل)" />
          </div>
          <button type="submit" disabled={!username || !password}
            style={{ padding: "12px", borderRadius: "8px", border: "none", background: username && password ? "#FF9900" : "#ccc", fontWeight: 700, cursor: username && password ? "pointer" : "not-allowed", fontSize: "14px" }}>
            إنشاء الحساب
          </button>
        </form>
      </div>
    </div>
  );
}
