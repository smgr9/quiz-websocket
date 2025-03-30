require("dotenv").config();
const express = require("express");
const mysql = require("mysql2");
const WebSocket = require("ws");
const cors = require("cors");

const app = express();
const PORT = 3000;

// ✅ تحديد طريقة الاتصال
const isRailway = process.env.RAILWAY_ENVIRONMENT_NAME === "production";

const dbConfig = isRailway
  ? {
      host: "mysql.railway.internal", // ✅ استخدام الاتصال الداخلي داخل Railway
      user: "root",
      password: process.env.MYSQLPASSWORD,
      database: "railway",
      port: 3306,
    }
  : {
      host: "centerbeam.proxy.rlwy.net", // ✅ الاتصال العام لو السيرفر برة Railway
      user: "root",
      password: process.env.MYSQLPASSWORD,
      database: "railway",
      port: 56587,
    };

const db = mysql.createConnection(dbConfig);

db.connect((err) => {
  if (err) {
    console.error("❌ Database connection failed:", err);
    return;
  }
  console.log("✅ Database connected successfully!");
});

// ✅ باقي كود السيرفر هنا


const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

const wss = new WebSocket.Server({ server });


wss.on("connection", (ws) => {
  console.log("✅ Client connected");

  // 🟢 عند الاتصال، اجلب الأسئلة من قاعدة البيانات
  db.query("SELECT * FROM questions", (err, results) => {
    if (err) {
      console.error("❌ خطأ في جلب الأسئلة:", err);
      ws.send(JSON.stringify({ error: "خطأ في جلب الأسئلة!" }));
      return;
    }
    // إرسال الأسئلة للعميل
    ws.send(JSON.stringify({ questions: results }));
  });

  ws.on("message", (message) => {
    console.log(`📩 Received: ${message}`);
  });

  ws.on("close", () => console.log("❌ Client disconnected"));
});

// إعداد API
app.use(cors());
app.use(express.json());

// جلب الأسئلة من قاعدة البيانات
app.get("/questions", async (req, res) => {
  try {
    const [results] = await db.promise().query("SELECT * FROM questions");
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// إضافة سؤال جديد
app.post("/add-question", async (req, res) => {
  const { question_text, answer } = req.body;
  if (!question_text || !answer) {
    return res.status(400).json({ error: "❌ كل الحقول مطلوبة" });
  }

  try {
    const [result] = await db.promise().query(
      "INSERT INTO questions (question_text, answer) VALUES (?, ?)",
      [question_text, answer]
    );

    const newQuestion = { id: result.insertId, question_text, answer };

    // إرسال التحديث لكل المتصلين بالـ WebSocket
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(newQuestion));
      }
    });

    res.json({
      success: true,
      message: "✅ تم إضافة السؤال بنجاح",
      question: newQuestion,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/create-table", (req, res) => {
  const query = `
    CREATE TABLE IF NOT EXISTS questions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      question_text TEXT NOT NULL,
      answer TEXT NOT NULL
    )
  `;

  db.query(query, (err, result) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true, message: "✅ Table created successfully!" });
  });
});
