require("dotenv").config();
const express = require("express");
const mysql = require("mysql2");
const WebSocket = require("ws");
const cors = require("cors");

const app = express();
const PORT = 3000;

// ✅ تحديد طريقة الاتصال بقاعدة البيانات
const dbConfig = {
  host: process.env.MYSQLHOST || "localhost",
  user: process.env.MYSQLUSER || "root",
  password: process.env.MYSQLPASSWORD || "password", // ضع كلمة مرورك هنا
  database: process.env.MYSQLDATABASE || "railway",
  port: process.env.MYSQLPORT || 3306,
};

const db = mysql.createConnection(dbConfig);

db.connect((err) => {
  if (err) {
    console.error("❌ Database connection failed:", err);
    return;
  }
  console.log("✅ Database connected successfully!");
});

// إعداد Express
app.use(cors());
app.use(express.json());

// إنشاء WebSocket Server
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
  console.log("✅ Client connected");

  // عند الاتصال، اجلب الأسئلة من قاعدة البيانات
  db.query("SELECT * FROM questions", (err, results) => {
    if (err) {
      console.error("❌ خطأ في جلب الأسئلة:", err);
      ws.send(JSON.stringify({ error: "خطأ في جلب الأسئلة!" }));
      return;
    }
    ws.send(JSON.stringify({ questions: results }));
  });

  ws.on("message", (message) => {
    console.log(`📩 Received: ${message}`);
  });

  ws.on("close", () => console.log("❌ Client disconnected"));
});

// جلب جميع الأسئلة من قاعدة البيانات
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

// إنشاء جدول الأسئلة في قاعدة البيانات
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
