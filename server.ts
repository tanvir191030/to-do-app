import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config({ override: true });

const app = express();
const port = 3000;

app.use(express.json());

// Helper to clean AI response
function cleanJSON(text: string) {
  return text.replace(/```json/gi, '').replace(/```/g, '').trim();
}

async function callAI(prompt: string) {
  const apiKey = (process.env.OPENROUTER_API_KEY || "").replace(/"/g, '').trim();
  // EXACT model name as per user request
  const model = "google/gemini-2.0-flash-001";

  console.log(`--- AI Request [${model}] ---`);
  
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
        model: model,
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data: any = await response.json();
    
    if (!response.ok) {
      console.error("OpenRouter Error:", JSON.stringify(data));
      throw new Error(data.error?.message || "API Error");
    }

    const content = data.choices[0].message.content;
    console.log("AI Response:", content);
    return cleanJSON(content);
  } catch (err: any) {
    console.error("AI call failed:", err.message);
    throw err;
  }
}

app.post("/api/parse-task", async (req, res) => {
  try {
    const { input } = req.body;
    const prompt = `Extract task details from: "${input}". 
    Return ONLY JSON: { "title": string, "date": "YYYY-MM-DD", "time": "HH:MM", "priority": "High/Med/Low", "category": "Work/Personal/Health/Shopping" }. 
    Today is ${new Date().toISOString().split('T')[0]}. No extra text.`;

    const result = await callAI(prompt);
    res.json(JSON.parse(result));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/generate-subtasks", async (req, res) => {
  try {
    const { title } = req.body;
    const prompt = `Generate 3 subtasks for: "${title}". Return ONLY a JSON array of strings.`;
    const result = await callAI(prompt);
    res.json(JSON.parse(result));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("*", (req, res) => {
  const indexPath = path.join(process.cwd(), "index.html");
  let html = fs.readFileSync(indexPath, "utf8");
  const sbUrl = (process.env.VITE_SUPABASE_URL || "").replace(/"/g, '').trim();
  const sbKey = (process.env.VITE_SUPABASE_ANON_KEY || "").replace(/"/g, '').trim();
  html = html.replace(/%VITE_SUPABASE_URL%/g, sbUrl).replace(/%VITE_SUPABASE_ANON_KEY%/g, sbKey);
  res.send(html);
});

app.listen(port, () => console.log(`Server running on port ${port}`));
