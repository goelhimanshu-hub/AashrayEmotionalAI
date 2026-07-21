function toOpenAIMessages(contents, systemPrompt) {
  return [
    { role: "system", content: systemPrompt },
    ...contents.map(c => ({
      role: c.role === "model" ? "assistant" : "user",
      content: c.parts.map(p => p.text).join("")
    }))
  ];
}

const PROVIDERS = [
  {
    name: "gemini",
    call: async (contents, systemPrompt) => {
      const res = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": process.env.GEMINI_API_KEY
          },
          body: JSON.stringify({
            contents,
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: { maxOutputTokens: 1000 }
          })
        }
      );
      if (!res.ok) throw new Error(`Gemini failed: ${res.status}`);
      const data = await res.json();
      const reply = data.candidates?.[0]?.content?.parts?.map(p => p.text).join("");
      if (!reply) throw new Error("Gemini empty reply");
      return reply;
    }
  },
  {
    name: "groq",
    call: async (contents, systemPrompt) => {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: toOpenAIMessages(contents, systemPrompt),
          max_tokens: 1000
        })
      });
      if (!res.ok) throw new Error(`Groq failed: ${res.status}`);
      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content;
      if (!reply) throw new Error("Groq empty reply");
      return reply;
    }
  },
  {
    name: "openai",
    call: async (contents, systemPrompt) => {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: toOpenAIMessages(contents, systemPrompt),
          max_tokens: 1000
        })
      });
      if (!res.ok) throw new Error(`OpenAI failed: ${res.status}`);
      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content;
      if (!reply) throw new Error("OpenAI empty reply");
      return reply;
    }
  },
  {
    name: "openrouter",
    call: async (contents, systemPrompt) => {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "HTTP-Referer": "https://your-site.netlify.app",
          "X-Title": "Aashray"
        },
        body: JSON.stringify({
          model: "meta-llama/llama-3.3-70b-instruct:free",
          messages: toOpenAIMessages(contents, systemPrompt),
          max_tokens: 1000
        })
      });
      if (!res.ok) throw new Error(`OpenRouter failed: ${res.status}`);
      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content;
      if (!reply) throw new Error("OpenRouter empty reply");
      return reply;
    }
  }
];

exports.handler = async (event) => {
  try {
    const { contents, systemPrompt } = JSON.parse(event.body || "{}");

    if (!contents || !systemPrompt) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Missing contents or systemPrompt" })
      };
    }

    let lastErr;
    for (const provider of PROVIDERS) {
      try {
        const reply = await provider.call(contents, systemPrompt);
        return {
          statusCode: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            candidates: [{ content: { parts: [{ text: reply }] } }],
            _provider: provider.name
          })
        };
      } catch (e) {
        console.error(`[${provider.name}] failed:`, e.message);
        lastErr = e;
      }
    }

    throw lastErr || new Error("All providers failed");
  } catch (e) {
    console.error("Aashray function error:", e.message);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: e.message })
    };
  }
};
