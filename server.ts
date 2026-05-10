import dotenv from "dotenv";
dotenv.config({ override: true });
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { GoogleGenAI } from "@google/genai";

const PORT = 3000;

async function startServer() {
  const app = express();
  app.use(express.json());

  // Wait to initialize Gemini client so startup doesn't fail if the key is missing in other setups
  let ai: GoogleGenAI | null = null;
  function getAI() {
      if (!ai) {
          if (!process.env.GEMINI_API_KEY) {
              throw new Error("GEMINI_API_KEY is missing");
          }
          ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      }
      return ai;
  }

  // API Route for Task Parsing
  app.post("/api/parse-task", async (req, res) => {
    try {
      const { input } = req.body;
      if (!input) return res.status(400).json({ error: "No input provided" });

      const aiClient = getAI();
      const prompt = `
Extract task details from this sentence and output ONLY pure JSON (no markdown formatting or backticks around it):
Sentence: "${input}"

Format: {"title":"(short Title)", "date":"(YYYY-MM-DD, or empty if none)", "time":"(HH:MM in 24hr format, or empty)", "priority":"High, Med, or Low", "category":"Work, Personal, Shopping, or Health"}
Use today's date context if needed: ${new Date().toDateString()}
      `;
      const response = await aiClient.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
      });

      const text = response.text.trim().replace(/```json/gi, '').replace(/```/g, '').trim();
      const data = JSON.parse(text);
      res.json(data);
    } catch (err: any) {
      console.error(err);
      if (err?.message?.includes("quota") || err?.message?.includes("exceeded") || err?.message?.includes("429")) {
        // Simple fallback parsing when AI is rate limited
        let p = "Med";
        let lower = input.toLowerCase();
        if (lower.includes('urgent') || lower.includes('high')) p = 'High';
        return res.json({ title: input, priority: p, category: 'Personal' });
      }
      res.status(500).json({ error: "Failed to parse task", details: err?.message });
    }
  });

  // API Route for Subtask Generation
  app.post("/api/generate-subtasks", async (req, res) => {
    try {
      const { title } = req.body;
      if (!title) return res.status(400).json({ error: "No title provided" });

      const aiClient = getAI();
      const prompt = `
Generate 3-5 useful subtasks for this task: "${title}".
Return ONLY pure JSON array of strings (no markdown formatting, no backticks).
Example: ["Write script", "Record video", "Edit"]
      `;
      const response = await aiClient.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
      });

      const text = response.text.trim().replace(/```json/gi, '').replace(/```/g, '').trim();
      const data = JSON.parse(text);
      res.json(data);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: "Failed to generate subtasks", details: err?.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // We are in ESM, so derive __dirname loosely using process.cwd() is fine for typical apps
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
