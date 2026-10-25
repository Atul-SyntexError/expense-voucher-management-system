import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const API = `${import.meta.env.VITE_API_URL || ""}/api`;
const demoAccounts = [
  ["employee@abc.com", "Employee"],
  ["director@abc.com", "Director"],
  ["accounts@abc.com", "Accounts team"]
];
const money = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value || 0);
const formatDate = (value) => value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, { headers: { "Content-Type": "application/json", ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}) }, ...options });
  if (!response.ok) throw new Error((await response.json()).message || "Something went wrong.");
  return response.status === 204 ? null : response.json();
}

function Login({ onLogin }) {
  const [form, setForm] = useState({ email: "employee@abc.com", password: "password" });
  const [error, setError] = useState("");
  const submit = async (event) => { event.preventDefault(); try { const result = await request("/auth/login", { method: "POST", body: JSON.stringify(form) }); onLogin(result); } catch (err) { setError(err.message); } };
  return <main className="login-page"><section className="login-card"><div className="brand-mark">EV</div><p className="eyebrow">ABC COMPANY</p><h1>Expense vouchers,<br /><em>without the paperwork.</em></h1><p className="muted">Submit, approve and track employee expenses from one simple workspace.</p><form onSubmit={submit}><label>Email address<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label><label>Password<input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></label>{error && <div className="error">{error}</div>}<button className="primary wide">Sign in <span>→</span></button></form><div className="demo-box"><strong>Demo access</strong>{demoAccounts.map(([email, role]) => <button key={email} onClick={() => setForm({ email, password: "password" })}><span>{role}</span>{email}</button>)}</div></section><aside className="login-art"><div className="art-note">“A clearer view of every rupee spent.”</div><div className="art-shape shape-one" /><div className="art-shape shape-two" /><div className="art-grid" /></aside></main>;
}

function App() {
  const [session, setSession] = useState(() => JSON.parse(localStorage.getItem("ev-session") || "null"));
  if (!session) return <Login onLogin={(value) => { localStorage.setItem("ev-session", JSON.stringify(value)); setSession(value); }} />;
  return <Dashboard session={session} onLogout={() => { localStorage.removeItem("ev-session"); setSession(null); }} />;
}

function Dashboard({ session, onLogout }) {
  const { token, user } = session;
  const [vouchers, setVouchers] = useState([]);
  const [view, setView] = useState("overview");
  const [selected, setSelected] = useState(null);
  const [notice, setNotice] = useState("");
  const [filters, setFilters] = useState({ search: "", status: "all", category: "all" });
  const load = async () => { try { setVouchers(await request(`/vouchers?${new URLSearchParams(filters)}`, { token })); } catch (err) { setNotice(err.message); } };
  useEffect(() => { load(); }, [filters.search, filters.status, filters.category]);
  const stats = useMemo(() => ({
    total: vouchers.length, draft: vouchers.filter((v) => v.status === "Draft").length, pending: vouchers.filter((v) => v.status === "Pending Approval").length,
    approved: vouchers.filter((v) => v.status === "Approved").length, rejected: vouchers.filter((v) => v.status === "Rejected").length,
    amount: vouchers.reduce((sum, v) => sum + Number(v.amount), 0)
  }), [vouchers]);
  const title = user.role === "employee" ? "My workspace" : user.role === "director" ? "Approval desk" : "Accounts overview";
  return <div className="app-shell"><header className="topbar"><div className="wordmark"><span>EV</span><b>expense<span>flow</span></b></div><div className="top-actions"><span className="role-pill">{user.role}</span><span className="avatar">{user.name.split(" ").map((n) => n[0]).join("")}</span><button className="logout" onClick={onLogout}>Sign out</button></div></header><div className="body"><aside className="sidebar"><div className="profile"><span className="avatar large">{user.name.split(" ").map((n) => n[0]).join("")}</span><div><strong>{user.name}</strong><small>{user.role === "employee" ? user.department : "ABC Company"}</small></div></div><nav><button className={view === "overview" ? "active" : ""} onClick={() => setView("overview")}><span>◈</span> Overview</button><button className={view === "vouchers" ? "active" : ""} onClick={() => setView("vouchers")}><span>▤</span> {user.role === "employee" ? "My vouchers" : "All vouchers"}</button>{user.role === "employee" && <button className="new-voucher" onClick={() => { setSelected("new"); setView("form"); }}>＋ New voucher</button>}</nav><div className="sidebar-foot"> <span className="status-dot" /> System operational<br /><small>Last synced just now</small></div></aside><main className="content">{notice && <div className="notice">{notice}<button onClick={() => setNotice("")}>×</button></div>}{view === "form" ? <VoucherForm token={token} onDone={() => { setView("vouchers"); load(); }} onCancel={() => setView("vouchers")} /> : view === "detail" ? <VoucherDetail voucher={selected} user={user} token={token} onBack={() => setView("vouchers")} onDone={load} /> : <><div className="page-heading"><div><p className="eyebrow">MONDAY, {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long" }).toUpperCase()}</p><h1>{title}</h1><p className="muted">{user.role === "employee" ? "Keep an eye on your requests and reimbursement progress." : "Here is what needs your attention today."}</p></div>{user.role === "employee" && <button className="primary" onClick={() => { setSelected("new"); setView("form"); }}>＋ Create voucher</button>}</div><Stats stats={stats} role={user.role} /><section className="panel"><div className="panel-head"><div><h2>{user.role === "director" ? "Pending approvals" : user.role === "accounts" ? "Recent approved vouchers" : "Recent vouchers"}</h2><p className="muted">A quick look at your latest activity</p></div><button className="text-button" onClick={() => setView("vouchers")}>View all →</button></div><VoucherTable vouchers={(user.role === "director" ? vouchers.filter((v) => v.status === "Pending Approval") : user.role === "accounts" ? vouchers.filter((v) => v.status === "Approved") : vouchers).slice(0, 5)} onSelect={(v) => { setSelected(v); setView("detail"); }} /></section></>}</main></div></div>;
}

function Stats({ stats, role }) {
  const cards = role === "employee" ? [["Total vouchers", stats.total, "all"], ["Needs attention", stats.pending, "Pending Approval"], ["Approved", stats.approved, "Approved"], ["Total claimed", money(stats.amount), ""]]
    : role === "director" ? [["Pending approval", stats.pending, "Pending Approval"], ["Approved", stats.approved, "Approved"], ["Rejected", stats.rejected, "Rejected"], ["Pending amount", money(stats.amount), ""]]
    : [["Total vouchers", stats.total, "all"], ["Pending approval", stats.pending, "Pending Approval"], ["Approved", stats.approved, "Approved"], ["Approved value", money(stats.amount), ""]];
  return <div className="stats">{cards.map(([label, value, status], index) => <div className={`stat-card color-${index}`} key={label}><span>{label}</span><strong>{value}</strong>{status && <small>{status === "all" ? "Across your workspace" : "Current status"}</small>}</div>)}</div>;
}

function VoucherTable({ vouchers, onSelect }) {
  if (!vouchers.length) return <div className="empty"><div>◌</div><strong>No vouchers here yet</strong><p>Create a voucher to see it in this list.</p></div>;
  return <div className="table-wrap"><table><thead><tr><th>Voucher</th><th>{vouchers[0].employeeName ? "Employee" : "Title"}</th><th>Department</th><th>Amount</th><th>Status</th><th>Date</th><th /></tr></thead><tbody>{vouchers.map((v) => <tr key={v.id} onClick={() => onSelect(v)}><td><strong>{v.voucherNumber}</strong><small>{v.expenseCategory}</small></td><td>{v.employeeName}<small>{v.expenseTitle}</small></td><td>{v.department}</td><td><strong>{money(v.amount)}</strong></td><td><span className={`badge ${v.status.toLowerCase().replaceAll(" ", "-")}`}>{v.status}</span></td><td>{formatDate(v.updatedAt)}</td><td>›</td></tr>)}</tbody></table></div>;
}

function VoucherForm({ token, onDone, onCancel }) {
  const [form, setForm] = useState({ department: "Engineering", expenseTitle: "", expenseDate: new Date().toISOString().slice(0, 10), amount: "", expenseCategory: "Travel", expenseDescription: "", employeeSignature: "" });
  const [error, setError] = useState("");
  const submit = async (event) => { event.preventDefault(); try { await request("/vouchers", { method: "POST", token, body: JSON.stringify(form) }); onDone(); } catch (err) { setError(err.message); } };
  return <><div className="page-heading"><div><button className="back" onClick={onCancel}>← Back to vouchers</button><h1>New expense voucher</h1><p className="muted">Save a draft now, or submit it when all details are ready.</p></div></div><form className="form-card" onSubmit={submit}><div className="form-section"><h2>Expense details</h2><div className="form-grid"><label>Department<input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} required /></label><label>Expense title<input value={form.expenseTitle} onChange={(e) => setForm({ ...form, expenseTitle: e.target.value })} placeholder="e.g. Client meeting travel" required /></label><label>Expense date<input type="date" value={form.expenseDate} onChange={(e) => setForm({ ...form, expenseDate: e.target.value })} required /></label><label>Amount (INR)<input type="number" min="1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0" required /></label><label>Category<select value={form.expenseCategory} onChange={(e) => setForm({ ...form, expenseCategory: e.target.value })}><option>Travel</option><option>Meals</option><option>Office supplies</option><option>Accommodation</option><option>Other</option></select></label><label className="full">Description<textarea value={form.expenseDescription} onChange={(e) => setForm({ ...form, expenseDescription: e.target.value })} placeholder="Add context for the approver..." /></label></div></div><div className="form-section"><h2>Employee signature</h2><p className="muted">Type your name as a digital signature for this demo.</p><input className="signature-input" value={form.employeeSignature} onChange={(e) => setForm({ ...form, employeeSignature: e.target.value })} placeholder="Your full name" /><div className="signature-preview">{form.employeeSignature || "Signature preview"}</div></div>{error && <div className="error">{error}</div>}<div className="form-actions"><button type="button" className="secondary" onClick={onCancel}>Cancel</button><button className="primary">Save draft</button></div></form></>;
}

function VoucherDetail({ voucher, user, token, onBack, onDone }) {
  const [signature, setSignature] = useState(""); const [reason, setReason] = useState(""); const [error, setError] = useState("");
  const action = async (type) => { try { await request(`/vouchers/${voucher.id}/${type}`, { method: "POST", token, body: JSON.stringify(type === "approve" ? { directorSignature: signature } : { rejectionReason: reason }) }); onDone(); onBack(); } catch (err) { setError(err.message); } };
  return <><div className="page-heading"><div><button className="back" onClick={onBack}>← Back to vouchers</button><p className="eyebrow">{voucher.voucherNumber}</p><h1>{voucher.expenseTitle}</h1><p className="muted">Created {formatDate(voucher.createdAt)} by {voucher.employeeName}</p></div><span className={`badge large-badge ${voucher.status.toLowerCase().replaceAll(" ", "-")}`}>{voucher.status}</span></div><div className="detail-grid"><section className="panel detail-panel"><div className="panel-head"><h2>Voucher details</h2><strong className="amount">{money(voucher.amount)}</strong></div><dl><div><dt>Department</dt><dd>{voucher.department}</dd></div><div><dt>Expense date</dt><dd>{formatDate(voucher.expenseDate)}</dd></div><div><dt>Category</dt><dd>{voucher.expenseCategory}</dd></div><div className="full"><dt>Description</dt><dd>{voucher.expenseDescription || "No description provided."}</dd></div></dl><div className="signatures"><div><dt>Employee signature</dt><p className="signature">{voucher.employeeSignature || "Not added"}</p></div><div><dt>Director signature</dt><p className="signature">{voucher.directorSignature || "Pending approval"}</p></div></div>{voucher.rejectionReason && <div className="rejection"><strong>Reason for rejection</strong><p>{voucher.rejectionReason}</p></div>}</section>{user.role === "director" && voucher.status === "Pending Approval" && <section className="panel decision-panel"><h2>Review voucher</h2><p className="muted">Choose an action. The employee will be notified of your decision.</p><label>Director signature<input value={signature} onChange={(e) => setSignature(e.target.value)} placeholder="Your full name" /></label><button className="primary wide" onClick={() => action("approve")}>Approve voucher</button><hr /><label>Rejection reason<textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Explain what needs to be corrected..." /></label><button className="danger wide" onClick={() => action("reject")}>Reject voucher</button>{error && <div className="error">{error}</div>}</section>}</div></>;
}

createRoot(document.getElementById("root")).render(<App />);
