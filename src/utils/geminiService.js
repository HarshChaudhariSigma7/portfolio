// Gemini API helper for client-side integration
const MOCK_CONTACTS_DATA = {
  contacts: [
    { name: "John Doe", company: "Stripe", role: "Tech Lead", notes: "Loves hiking, looking for a UI designer. Friends with Sarah Connor." },
    { name: "Sarah Connor", company: "Stripe", role: "Product Manager", notes: "John's coworker. Enthusiastic about AI safety. Works with Miles Dyson." },
    { name: "Miles Dyson", company: "Cyberdyne", role: "Director of Systems", notes: "Sarah's contact. Leading the neural net processor project." },
    { name: "Alice Smith", company: "Vercel", role: "DevRel", notes: "Met at JS Conf. Expert in frontend perf. Knows John Doe from college." }
  ],
  connections: [
    { from: "John Doe", to: "Sarah Connor", type: "Colleague" },
    { from: "Sarah Connor", to: "Miles Dyson", type: "Collaborator" },
    { from: "Alice Smith", to: "John Doe", type: "College Friend" }
  ]
};

const MOCK_SUGGESTIONS = [
  "John Doe at Stripe is looking for a UI designer. You should connect him with Alice Smith, who has a strong DevRel and frontend network.",
  "Sarah Connor and Miles Dyson are both working on systems-related projects. Ask Sarah how the collaboration with Miles at Cyberdyne is going.",
  "You haven't updated details about Miles Dyson recently. Find out if the neural net processor project has any new milestones."
];

// Helper to make the API call using standard fetch
async function callGemini(apiKey, prompt, systemInstruction = "", responseSchema = null) {
  const model = "gemini-2.5-flash"; // Standard fast model
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [
      {
        parts: [
          { text: prompt }
        ]
      }
    ]
  };

  if (systemInstruction) {
    requestBody.systemInstruction = {
      parts: [
        { text: systemInstruction }
      ]
    };
  }

  // Request JSON output if schema or instruction asks for JSON
  if (responseSchema) {
    requestBody.generationConfig = {
      responseMimeType: "application/json",
      responseSchema: responseSchema
    };
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error?.message || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!textResponse) {
      throw new Error("No response content from Gemini API.");
    }
    
    return textResponse;
  } catch (error) {
    console.error("Gemini API call failed:", error);
    throw error;
  }
}

/**
 * Parses new unstructured text and extracts contacts and connections.
 */
export async function parseUnstructuredText(apiKey, text, existingContacts = [], existingConnections = []) {
  if (!apiKey) {
    // Return mock integration response that appends a random sample if text matches mock triggers
    // or just parses some basic fields locally using regex to make mock mode feel alive
    return parseLocallyForMock(text);
  }

  const systemInstruction = `You are a high-fidelity contact parser. Your job is to analyze unstructured text logs and extract details about contacts and their relationships. 
Return a JSON object containing a "contacts" array and a "connections" array.
For contacts:
- name: The person's full name (Capitalized properly)
- company: The company they work for (or "Unknown" / empty)
- role: Their job title or role (or "Unknown" / empty)
- notes: Short summary of what was mentioned about them in the text.
For connections:
- from: Full name of contact 1
- to: Full name of contact 2
- type: A brief word describing their relationship (e.g., "Colleague", "Friend", "Client", "Introduced by", "Partner").

Deduplicate against the following list of existing contacts, matching names carefully:
${JSON.stringify(existingContacts.map(c => c.name))}
Ensure you output EXACTLY in the requested schema.`;

  const prompt = `Analyze the following note and extract contacts and connections:\n\n"${text}"`;

  const responseSchema = {
    type: "OBJECT",
    properties: {
      contacts: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            name: { type: "STRING" },
            company: { type: "STRING" },
            role: { type: "STRING" },
            notes: { type: "STRING" }
          },
          required: ["name"]
        }
      },
      connections: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            from: { type: "STRING" },
            to: { type: "STRING" },
            type: { type: "STRING" }
          },
          required: ["from", "to", "type"]
        }
      }
    },
    required: ["contacts", "connections"]
  };

  try {
    const jsonStr = await callGemini(apiKey, prompt, systemInstruction, responseSchema);
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Failed to parse text via Gemini, using local parsing fallback", error);
    return parseLocallyForMock(text);
  }
}

/**
 * Generates 3 proactive suggestions based on historical unstructured texts.
 */
export async function getProactiveSuggestions(apiKey, rawTexts) {
  if (!apiKey || rawTexts.length === 0) {
    return MOCK_SUGGESTIONS;
  }

  const contextText = rawTexts.map((t, idx) => `[Note #${idx+1} - ${new Date(t.timestamp).toLocaleDateString()}]: ${t.text}`).join("\n\n");

  const systemInstruction = `You are a proactive networking intelligence assistant.
Analyze the user's historical notes about their contacts and generate exactly 3 proactive suggestions or insights.
These suggestions could be:
- Strategic networking recommendations (e.g. connecting two contacts who have complementary skills/needs).
- Follow-up reminders (e.g. checking in on a project milestone or life event mentioned in notes).
- Relationship maintenance tips (e.g. catch up with someone they haven't spoken to in a while).
- Knowledge gaps to fill.

Keep suggestions practical, engaging, concise, and focused on maintaining high-quality relationships.
Return the suggestions as a JSON array of strings (exactly 3 items).`;

  const prompt = `Here are my historical contact logs:\n\n${contextText}\n\nProvide exactly 3 proactive suggestions based on these logs.`;

  const responseSchema = {
    type: "ARRAY",
    items: { type: "STRING" }
  };

  try {
    const jsonStr = await callGemini(apiKey, prompt, systemInstruction, responseSchema);
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Failed to get suggestions from Gemini, returning default suggestions", error);
    return MOCK_SUGGESTIONS;
  }
}

/**
 * Answers a user's question about their contacts using their history as context.
 */
export async function askQuestion(apiKey, question, rawTexts, contacts, connections) {
  if (!apiKey) {
    return "API Key is missing. I am running in Demo Mode. Here is a simulated response:\n\nBased on your mock contacts, Sarah Connor works at Stripe with John Doe, and Alice Smith knows John from college. If you configure a real Gemini API Key, I can analyze all your uploaded unstructured notes dynamically!";
  }

  const contextText = rawTexts.map((t, idx) => `[Note #${idx+1}]: ${t.text}`).join("\n\n");
  const contactsSummary = contacts.map(c => `- ${c.name} (${c.role} at ${c.company}): ${c.notes}`).join("\n");
  const connectionsSummary = connections.map(conn => `- ${conn.from} -> ${conn.to} (${conn.type})`).join("\n");

  const systemInstruction = `You are a helpful personal CRM assistant. 
Use the user's uploaded contact notes and parsed network graph to answer their questions.
Be concise, accurate, and direct. Do not speculate beyond the information provided in the context. If you don't know the answer or if the text doesn't contain the answer, say so.`;

  const prompt = `Here is my contact database context:

--- LOGS ---
${contextText}

--- PARSED CONTACTS ---
${contactsSummary}

--- CONNECTIONS ---
${connectionsSummary}

---
Question: ${question}`;

  try {
    return await callGemini(apiKey, prompt, systemInstruction);
  } catch (error) {
    return `Error calling Gemini: ${error.message}`;
  }
}

// Simple regex-based fallback parsing for offline/mock usage
function parseLocallyForMock(text) {
  // Look for common patterns like "Name (Company/Role)" or "Met X who works at Y"
  // This lets the mock mode feel surprisingly responsive when they type demo text
  const result = {
    contacts: [],
    connections: []
  };

  // Simple name extraction helper: Capitalized words
  const nameRegex = /\b([A-Z][a-z]+)\s([A-Z][a-z]+)\b/g;
  const names = [];
  let match;
  while ((match = nameRegex.exec(text)) !== null) {
    if (!names.includes(match[0])) {
      names.push(match[0]);
    }
  }

  // Company detection
  const companies = ["Stripe", "Google", "Vercel", "Apple", "Microsoft", "Meta", "Netflix", "Cyberdyne", "Skynet"];
  let detectedCompany = "";
  for (const comp of companies) {
    if (text.toLowerCase().includes(comp.toLowerCase())) {
      detectedCompany = comp;
      break;
    }
  }

  // Create nodes
  names.forEach(name => {
    result.contacts.push({
      name,
      company: detectedCompany || "Unknown Corp",
      role: text.toLowerCase().includes("lead") ? "Tech Lead" : text.toLowerCase().includes("product") ? "Product Manager" : "Professional Contact",
      notes: `Extracted from log: "${text.substring(0, 80)}..."`
    });
  });

  // If there are multiple names, create some connections
  if (result.contacts.length >= 2) {
    for (let i = 0; i < result.contacts.length - 1; i++) {
      result.connections.push({
        from: result.contacts[i].name,
        to: result.contacts[i+1].name,
        type: text.toLowerCase().includes("colleague") || text.toLowerCase().includes("work") ? "Colleague" : "Connected"
      });
    }
  }

  // If no names are found, create a generic one so the graph updates
  if (result.contacts.length === 0) {
    const defaultName = "New Contact " + Math.floor(Math.random() * 100);
    result.contacts.push({
      name: defaultName,
      company: detectedCompany || "Unspecified",
      role: "Contact",
      notes: text
    });
  }

  return result;
}
