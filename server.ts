import dotenv from "dotenv";
dotenv.config({ override: true });
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";

const PORT = 3000;

async function startServer() {
  const app = express();
  app.use(express.json());

  // AI Client for OpenRouter
  async function callOpenRouter(prompt: string, isJson: boolean = true) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("OPENROUTER_API_KEY is missing");

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "https://github.com/tanvir191030/to-do-app", // Optional
        "X-Title": "Do-It Task Manager", // Optional
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        "model": "google/gemini-2.0-flash-001", // You can change this model
        "messages": [
          { "role": "user", "content": prompt }
        ],
        "response_format": isJson ? { "type": "json_object" } : undefined
      })
    });

    const data: any = await response.json();
    if (data.error) throw new Error(data.error.message || "OpenRouter Error");
    
    let text = data.choices[0].message.content;
    return text.trim().replace(/```json/gi, '').replace(/```/g, '').trim();
  }

  // API Route for Task Parsing
  app.post("/api/parse-task", async (req, res) => {
    try {
      const { input } = req.body;
      if (!input) return res.status(400).json({ error: "No input provided" });

      const prompt = `
Extract task details from this sentence and output ONLY pure JSON:
Sentence: "${input}"

Format: {"title":"(short Title)", "date":"(YYYY-MM-DD, or empty if none)", "time":"(HH:MM in 24hr format, or empty)", "priority":"High, Med, or Low", "category":"Work, Personal, Shopping, or Health"}
Use today's date context if needed: ${new Date().toDateString()}
      `;
      
      const text = await callOpenRouter(prompt);
      const data = JSON.parse(text);
      res.json(data);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: "Failed to parse task", details: err?.message });
    }
  });

  // API Route for Subtask Generation
  app.post("/api/generate-subtasks", async (req, res) => {
    try {
      const { title } = req.body;
      if (!title) return res.status(400).json({ error: "No title provided" });

      const prompt = `
Generate 3-5 useful subtasks for this task: "${title}".
Return ONLY pure JSON array of strings.
Example: ["Write script", "Record video", "Edit"]
      `;
      
      const text = await callOpenRouter(prompt, false); // Some models struggle with json_object for simple arrays
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        // Fallback: try to extract array if model returned text
        const match = text.match(/\[.*\]/s);
        if (match) data = JSON.parse(match[0]);
        else throw e;
      }
      res.json(data);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: "Failed to generate subtasks", details: err?.message });
    }
  });

  // Vite middleware for development
  let vite: any;
  if (process.env.NODE_ENV !== "production") {
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  if (process.env.NODE_ENV === "production") {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
  }

  // Catch-all route to serve index.html
  app.get('*', async (req, res, next) => {
    const url = req.originalUrl;
    try {
      let html: string;
      if (process.env.NODE_ENV !== "production") {
        // In development, read and transform index.html via Vite
        const template = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
        html = await vite.transformIndexHtml(url, template);
      } else {
        // In production, serve from dist
        const distPath = path.join(process.cwd(), 'dist');
        html = fs.readFileSync(path.join(distPath, 'index.html'), 'utf-8');
      }

      // Manually replace placeholders if they still exist
      const sbUrl = (process.env.VITE_SUPABASE_URL || "").replace(/"/g, '').trim();
      const sbKey = (process.env.VITE_SUPABASE_ANON_KEY || "").replace(/"/g, '').trim();
      
      if (!sbUrl) console.warn("WARNING: VITE_SUPABASE_URL is missing in process.env");
      
      html = html.replace(/%VITE_SUPABASE_URL%/g, sbUrl);
      html = html.replace(/%VITE_SUPABASE_ANON_KEY%/g, sbKey);

      res.status(200).set({ 'Content-Type': 'text/html' }).send(html);
    } catch (e) {
      if (vite) vite.ssrFixStacktrace(e);
      next(e);
    }
  });


  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
