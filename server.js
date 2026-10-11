require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "development_only_change_this_secret";
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(uploadDir));
app.use(express.static(path.join(__dirname, "public")));

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["student", "admin", "staff"], default: "student" }
}, { timestamps: true });

const complaintSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  category: { type: String, required: true },
  location: { type: String, required: true },
  priority: { type: String, enum: ["Low", "Medium", "High"], default: "Medium" },
  image: { type: String, default: "" },
  status: { type: String, enum: ["Submitted", "Assigned", "In Progress", "Resolved", "Rejected"], default: "Submitted" },
  student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  assignedStaff: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  updates: [{ message: String, status: String, at: { type: Date, default: Date.now } }]
}, { timestamps: true });

const User = mongoose.model("User", userSchema);
const Complaint = mongoose.model("Complaint", complaintSchema);
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, Date.now() + "-" + file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_"))
});
const upload = multer({
  storage,
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed."));
  }
});

function auth(req, res, next) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ message: "Please log in first." });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (_err) {
    return res.status(401).json({ message: "Session expired. Please log in again." });
  }
}
function allow(...roles) {
  return (req, res, next) => roles.includes(req.user.role)
    ? next() : res.status(403).json({ message: "You do not have permission for this action." });
}
function safeUser(user) {
  return { id: user._id, name: user.name, email: user.email, role: user.role };
}

app.get("/api/health", (_req, res) => res.json({ message: "Smart Campus API is running." }));

app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: "Name, email and password are required." });
    if (password.length < 6) return res.status(400).json({ message: "Password must contain at least 6 characters." });
    if (await User.findOne({ email: email.toLowerCase().trim() })) return res.status(409).json({ message: "Email already registered. Please log in." });
    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashed, role: "student" });
    const token = jwt.sign({ id: user._id.toString(), name: user.name, role: user.role }, JWT_SECRET, { expiresIn: "1d" });
    res.status(201).json({ token, user: safeUser(user) });
  } catch (err) { res.status(500).json({ message: "Registration failed.", detail: err.message }); }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: String(email || "").toLowerCase().trim() });
    if (!user || !(await bcrypt.compare(password || "", user.password))) return res.status(401).json({ message: "Incorrect email or password." });
    const token = jwt.sign({ id: user._id.toString(), name: user.name, role: user.role }, JWT_SECRET, { expiresIn: "1d" });
    res.json({ token, user: safeUser(user) });
  } catch (err) { res.status(500).json({ message: "Login failed.", detail: err.message }); }
});

// For a classroom demo only: create the first admin/staff accounts through this protected-by-setup route.
// Set SETUP_KEY in .env and send it in the x-setup-key header; remove/disable this route for production.
app.post("/api/setup/create-role-user", async (req, res) => {
  try {
    if (!process.env.SETUP_KEY || req.headers["x-setup-key"] !== process.env.SETUP_KEY) {
      return res.status(403).json({ message: "Set SETUP_KEY in .env and send the matching x-setup-key header." });
    }
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !["admin", "staff"].includes(role)) return res.status(400).json({ message: "Provide name, email, password and role (admin or staff)." });
    if (password.length < 6) return res.status(400).json({ message: "Password must contain at least 6 characters." });
    if (await User.findOne({ email: email.toLowerCase().trim() })) return res.status(409).json({ message: "Email already exists." });
    const user = await User.create({ name, email, password: await bcrypt.hash(password, 10), role });
    res.status(201).json({ user: safeUser(user) });
  } catch (err) { res.status(500).json({ message: "Could not create role account.", detail: err.message }); }
});

app.get("/api/users/staff", auth, allow("admin"), async (_req, res) => {
  const staff = await User.find({ role: "staff" }).select("name email");
  res.json(staff);
});

app.post("/api/complaints", auth, allow("student"), upload.single("image"), async (req, res) => {
  try {
    const { title, description, category, location, priority } = req.body;
    if (!title || !description || !category || !location) return res.status(400).json({ message: "Please fill in all required fields." });
    const complaint = await Complaint.create({
      title, description, category, location,
      priority: ["Low", "Medium", "High"].includes(priority) ? priority : "Medium",
      image: req.file ? "/uploads/" + req.file.filename : "",
      student: req.user.id,
      updates: [{ message: "Complaint submitted successfully.", status: "Submitted" }]
    });
    res.status(201).json({ message: "Complaint submitted.", complaint });
  } catch (err) { res.status(500).json({ message: "Could not submit complaint.", detail: err.message }); }
});

app.get("/api/complaints", auth, async (req, res) => {
  try {
    let filter = {};
    if (req.user.role === "student") filter.student = req.user.id;
    if (req.user.role === "staff") filter.assignedStaff = req.user.id;
    const complaints = await Complaint.find(filter)
      .populate("student", "name email")
      .populate("assignedStaff", "name email")
      .sort({ createdAt: -1 });
    res.json(complaints);
  } catch (err) { res.status(500).json({ message: "Could not load complaints.", detail: err.message }); }
});

app.patch("/api/complaints/:id/assign", auth, allow("admin"), async (req, res) => {
  try {
    const staff = await User.findOne({ _id: req.body.staffId, role: "staff" });
    if (!staff) return res.status(400).json({ message: "Choose a valid staff member." });
    const complaint = await Complaint.findByIdAndUpdate(req.params.id, {
      assignedStaff: staff._id, status: "Assigned",
      $push: { updates: { message: "Assigned to " + staff.name + ".", status: "Assigned" } }
    }, { new: true }).populate("student", "name email").populate("assignedStaff", "name email");
    if (!complaint) return res.status(404).json({ message: "Complaint not found." });
    res.json({ message: "Staff assigned.", complaint });
  } catch (err) { res.status(500).json({ message: "Could not assign staff.", detail: err.message }); }
});

app.patch("/api/complaints/:id/status", auth, allow("admin", "staff"), async (req, res) => {
  try {
    const { status, message } = req.body;
    const allowed = ["Assigned", "In Progress", "Resolved", "Rejected"];
    if (!allowed.includes(status)) return res.status(400).json({ message: "Invalid status." });
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ message: "Complaint not found." });
    if (req.user.role === "staff" && String(complaint.assignedStaff) !== req.user.id) return res.status(403).json({ message: "This complaint is not assigned to you." });
    complaint.status = status;
    complaint.updates.push({ message: message || "Status changed to " + status + ".", status });
    await complaint.save();
    res.json({ message: "Status updated.", complaint });
  } catch (err) { res.status(500).json({ message: "Could not update status.", detail: err.message }); }
});

app.get("/api/analytics", auth, allow("admin"), async (_req, res) => {
  try {
    const [total, open, resolved, byCategory, byStatus] = await Promise.all([
      Complaint.countDocuments(),
      Complaint.countDocuments({ status: { $nin: ["Resolved", "Rejected"] } }),
      Complaint.countDocuments({ status: "Resolved" }),
      Complaint.aggregate([{ $group: { _id: "$category", count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      Complaint.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }, { $sort: { count: -1 } }])
    ]);
    res.json({ total, open, resolved, byCategory, byStatus });
  } catch (err) { res.status(500).json({ message: "Could not load analytics.", detail: err.message }); }
});

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) return res.status(400).json({ message: err.code === "LIMIT_FILE_SIZE" ? "Image must be 4 MB or smaller." : err.message });
  res.status(400).json({ message: err.message || "Request failed." });
});

mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/smart_campus")
  .then(() => {
    console.log("MongoDB connected.");
    app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
  })
  .catch(err => {
    console.error("MongoDB connection failed:", err.message);
    console.error("Check that MongoDB is running and MONGODB_URI in .env is correct.");
    process.exit(1);
  });
