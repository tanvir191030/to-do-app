import dotenv from "dotenv";
dotenv.config({ override: true });
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";

const PORT = 3000;

const app = express();
app.use(express.json());

// AI Client for OpenRouter
async function callOpenRouter(prompt: string, isJson: boolean = true) {
  const apiKey = (process.env.OPENROUTER_API_KEY || "").replace(/"/g, '').trim();
  if (!apiKey) {
    console.error("CRITICAL: OPENROUTER_API_KEY is missing");
    throw new Error("AI Configuration Error: API Key missing");
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "https://github.com/tanvir191030/to-do-app",
        "X-Title": "Do-It Task Manager",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        "model": "google/gemini-2.0-flash-001",
        "messages": [{ "role": "user", "content": prompt }],
        ...(isJson ? { "response_format": { "type": "json_object" } } : {})
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API Error ${response.status}`);
    }

    const data: any = await response.json();
    let text = data.choices[0].message.content;
    return text.trim().replace(/```json/gi, '').replace(/```/g, '').trim();
  } catch (e: any) {
    console.error("AI call failed:", e.message);
    throw e;
  }
}

// API Routes
app.post("/api/parse-task", async (req, res) => {
  try {
    const { input } = req.body;
    const prompt = `Extract task details from this sentence and output ONLY pure JSON:\nSentence: "${input}"\nFormat: {"title":"(short Title)", "date":"(YYYY-MM-DD)", "time":"(HH:MM)", "priority":"High, Med, or Low", "category":"Work, Personal, Shopping, or Health"}\nToday: ${new Date().toDateString()}`;
    const text = await callOpenRouter(prompt);
    res.json(JSON.parse(text));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/generate-subtasks", async (req, res) => {
  try {
    const { title } = req.body;
    const prompt = `Generate 3-5 useful subtasks for: "${title}". Return ONLY pure JSON array of strings. Example: ["Step 1", "Step 2"]`;
    const text = await callOpenRouter(prompt, false);
    let data;
    try { data = JSON.parse(text); } catch (e) {
      const match = text.match(/\[.*\]/s);
      data = match ? JSON.parse(match[0]) : [];
    }
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Vite/Static Setup
let vite: any;
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) app.use(express.static(distPath));
  }
}
setupVite();

app.get('*', async (req, res) => {
  try {
    let html: string;
    if (process.env.NODE_ENV !== "production" && vite) {
      const template = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
      html = await vite.transformIndexHtml(req.originalUrl, template);
    } else {
      const p = path.join(process.cwd(), fs.existsSync(path.join(process.cwd(), 'dist')) ? 'dist/index.html' : 'index.html');
      html = fs.readFileSync(p, 'utf-8');
    }
    
    // Inject Env Vars
    const sbUrl = (process.env.VITE_SUPABASE_URL || "").replace(/"/g, '').trim();
    const sbKey = (process.env.VITE_SUPABASE_ANON_KEY || "").replace(/"/g, '').trim();
    html = html.replace(/%VITE_SUPABASE_URL%/g, sbUrl).replace(/%VITE_SUPABASE_ANON_KEY%/g, sbKey);
    
    res.status(200).set({ 'Content-Type': 'text/html' }).send(html);
  } catch (e: any) {
    res.status(500).send(e.message);
  }
});

// For local dev
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => console.log(`Dev server: http://localhost:${PORT}`));
}

// Export for Vercel
export default app;
