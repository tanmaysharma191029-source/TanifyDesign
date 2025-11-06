import express from "express";
import fs from "fs";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3002;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "T4n!fy#Adm1n$2025xR";

const ORDERS_FILE = path.join(__dirname, "orders.json");
if (!fs.existsSync(ORDERS_FILE)) fs.writeFileSync(ORDERS_FILE, JSON.stringify([]));

const readOrders = () => JSON.parse(fs.readFileSync(ORDERS_FILE, "utf8"));
const writeOrders = (d) => fs.writeFileSync(ORDERS_FILE, JSON.stringify(d, null, 2));

app.get("/", (_req, res) => res.json({ ok:true, msg:"Tanify backend working" }));

app.post("/api/order", (req, res) => {
  const arr = readOrders();
  const o = {
    id: "ORD" + Date.now(),
    plan: req.body.plan || "",
    category: req.body.category || "",
    topic: req.body.topic || "",
    notes: req.body.notes || "",
    amount: req.body.amount || 0,
    paymentConfirmed: false,
    stage: "placed",
    at: Date.now()
  };
  arr.push(o); writeOrders(arr);
  res.json({ ok:true, id:o.id });
});

app.get("/api/order/:id", (req, res) => {
  const o = readOrders().find(x=>x.id===req.params.id);
  if(!o) return res.json({ ok:false });
  res.json({ ok:true, order:o });
});

app.get("/api/orders", (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ","") || "";
  if(token !== ADMIN_TOKEN) return res.status(401).json({ ok:false, err:"invalid token" });
  res.json({ ok:true, orders: readOrders() });
});

app.listen(PORT, () => console.log("✅ Backend running on port:", PORT));
