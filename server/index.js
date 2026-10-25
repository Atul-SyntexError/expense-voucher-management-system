const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { v4: uuid } = require("uuid");

const app = express();
const PORT = process.env.PORT || 4000;
const SECRET = process.env.JWT_SECRET || "expense-voucher-demo-secret";
const dataPath = path.join(__dirname, "data.json");
const uploadDir = path.join(__dirname, "uploads");
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir, limits: { fileSize: 2 * 1024 * 1024 } });
const readData = () => JSON.parse(fs.readFileSync(dataPath, "utf8"));
const writeData = (data) => fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
const publicUser = ({ password, ...user }) => user;
const auth = (req, res, next) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  try { req.user = jwt.verify(token, SECRET); next(); }
  catch { res.status(401).json({ message: "Your session has expired. Please log in again." }); }
};
const roles = (...allowed) => (req, res, next) => allowed.includes(req.user.role)
  ? next() : res.status(403).json({ message: "You do not have permission for this action." });
const canSee = (user, voucher) => user.role !== "employee" || voucher.employeeId === user.id;

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(uploadDir));
app.use(express.static(path.join(__dirname, "..", "dist")));

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const data = readData();
  const user = data.users.find((item) => item.email.toLowerCase() === String(email || "").toLowerCase());
  if (!user || !(await bcrypt.compare(password || "", user.password))) return res.status(401).json({ message: "Invalid email or password." });
  res.json({ token: jwt.sign({ id: user.id, role: user.role, name: user.name }, SECRET, { expiresIn: "8h" }), user: publicUser(user) });
});
app.get("/api/auth/me", auth, (req, res) => {
  const user = readData().users.find((item) => item.id === req.user.id);
  res.json({ user: publicUser(user) });
});

app.get("/api/vouchers", auth, (req, res) => {
  const { search, status, category, department } = req.query;
  let vouchers = readData().vouchers.filter((voucher) => canSee(req.user, voucher));
  if (search) vouchers = vouchers.filter((v) => [v.voucherNumber, v.employeeName, v.expenseTitle].some((value) => value.toLowerCase().includes(search.toLowerCase())));
  if (status && status !== "all") vouchers = vouchers.filter((v) => v.status === status);
  if (category && category !== "all") vouchers = vouchers.filter((v) => v.expenseCategory === category);
  if (department && department !== "all") vouchers = vouchers.filter((v) => v.department === department);
  res.json(vouchers.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)));
});
app.get("/api/vouchers/:id", auth, (req, res) => {
  const voucher = readData().vouchers.find((item) => item.id === req.params.id);
  if (!voucher || !canSee(req.user, voucher)) return res.status(404).json({ message: "Voucher not found." });
  res.json(voucher);
});
app.post("/api/vouchers", auth, roles("employee"), (req, res) => {
  const { department, expenseTitle, expenseDate, amount, expenseCategory, expenseDescription, employeeSignature } = req.body;
  if (!department || !expenseTitle || !expenseDate || !amount || Number(amount) <= 0) return res.status(400).json({ message: "Department, title, expense date, and a positive amount are required." });
  const data = readData();
  const user = data.users.find((item) => item.id === req.user.id);
  const now = new Date().toISOString();
  const voucher = { id: uuid(), voucherNumber: `EV-${new Date().getFullYear()}-${String(data.vouchers.length + 1).padStart(4, "0")}`, voucherDate: now.slice(0, 10), expenseDate, department, expenseTitle, expenseCategory: expenseCategory || "Other", expenseDescription: expenseDescription || "", amount: Number(amount), employeeId: user.id, employeeName: user.name, employeeCode: user.employeeId || "", employeeSignature: employeeSignature || "", directorSignature: "", status: "Draft", rejectionReason: "", approvalDate: "", createdAt: now, updatedAt: now };
  data.vouchers.push(voucher); writeData(data); res.status(201).json(voucher);
});
app.put("/api/vouchers/:id", auth, roles("employee"), (req, res) => {
  const data = readData(); const voucher = data.vouchers.find((item) => item.id === req.params.id);
  if (!voucher || voucher.employeeId !== req.user.id) return res.status(404).json({ message: "Voucher not found." });
  if (voucher.status !== "Draft") return res.status(400).json({ message: "Only draft vouchers can be edited." });
  Object.assign(voucher, req.body, { amount: Number(req.body.amount), updatedAt: new Date().toISOString() });
  writeData(data); res.json(voucher);
});
app.delete("/api/vouchers/:id", auth, roles("employee"), (req, res) => {
  const data = readData(); const voucher = data.vouchers.find((item) => item.id === req.params.id);
  if (!voucher || voucher.employeeId !== req.user.id || voucher.status !== "Draft") return res.status(400).json({ message: "Only your draft vouchers can be deleted." });
  data.vouchers = data.vouchers.filter((item) => item.id !== req.params.id); writeData(data); res.status(204).end();
});
app.post("/api/vouchers/:id/submit", auth, roles("employee"), (req, res) => {
  const data = readData(); const voucher = data.vouchers.find((item) => item.id === req.params.id);
  if (!voucher || voucher.employeeId !== req.user.id || voucher.status !== "Draft") return res.status(400).json({ message: "Only your draft vouchers can be submitted." });
  if (!voucher.employeeSignature) return res.status(400).json({ message: "Please add your signature before submitting." });
  voucher.status = "Pending Approval"; voucher.updatedAt = new Date().toISOString(); writeData(data); res.json(voucher);
});
app.post("/api/vouchers/:id/approve", auth, roles("director"), (req, res) => {
  const data = readData(); const voucher = data.vouchers.find((item) => item.id === req.params.id);
  if (!voucher || voucher.status !== "Pending Approval") return res.status(400).json({ message: "Only pending vouchers can be approved." });
  if (!req.body.directorSignature) return res.status(400).json({ message: "Director signature is required." });
  Object.assign(voucher, { status: "Approved", directorSignature: req.body.directorSignature, approvalDate: new Date().toISOString(), updatedAt: new Date().toISOString() }); writeData(data); res.json(voucher);
});
app.post("/api/vouchers/:id/reject", auth, roles("director"), (req, res) => {
  const data = readData(); const voucher = data.vouchers.find((item) => item.id === req.params.id);
  if (!voucher || voucher.status !== "Pending Approval" || !req.body.rejectionReason?.trim()) return res.status(400).json({ message: "A rejection reason is required." });
  voucher.status = "Rejected"; voucher.rejectionReason = req.body.rejectionReason.trim(); voucher.updatedAt = new Date().toISOString(); writeData(data); res.json(voucher);
});
app.post("/api/uploads", auth, upload.single("signature"), (req, res) => {
  if (!req.file) return res.status(400).json({ message: "Please select an image." });
  res.json({ url: `/uploads/${req.file.filename}` });
});
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/") || req.path.startsWith("/uploads/")) return next();
  res.sendFile(path.join(__dirname, "..", "dist", "index.html"));
});

app.listen(PORT, () => console.log(`Expense Voucher API running on port ${PORT}`));
