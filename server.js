
import express from "express";
import twilio from "twilio";
import bodyParser from "body-parser";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

const OpenAI_API = "https://api.openai.com/v1/chat/completions";

// Mock property database
const properties = {
  "123 main street": {
    price: "$450,000",
    beds: 3,
    baths: 2,
    sqft: 1800,
    extras: "2-car garage, fenced backyard"
  },
  "456 oak drive": {
    price: "$599,000",
    beds: 4,
    baths: 3,
    sqft: 2500,
    extras: "swimming pool, finished basement"
  }
};

// First call entry point
app.post("/voice", (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();
  const gather = twiml.gather({
    input: "speech",
    timeout: 5,
    speechTimeout: "auto",
    action: "/process-speech"
  });
  gather.say("Hi! Which property address would you like details about?");
  res.type("text/xml");
  res.send(twiml.toString());
});

// Process caller speech
app.post("/process-speech", async (req, res) => {
  const speech = req.body.SpeechResult?.toLowerCase() || "";

  let propertyMatch = Object.keys(properties).find((p) =>
    speech.includes(p)
  );

  let aiResponse;
  if (propertyMatch) {
    const data = properties[propertyMatch];
    aiResponse = `The property at ${propertyMatch} is listed at ${data.price}, has ${data.beds} bedrooms, ${data.baths} bathrooms, and ${data.sqft} square feet. It also features ${data.extras}. Would you like to schedule a viewing?`;
  } else {
    // Ask OpenAI to interpret the request and guide the conversation
    aiResponse = await queryOpenAI(speech);
  }

  const twiml = new twilio.twiml.VoiceResponse();
  const gather = twiml.gather({
    input: "speech",
    timeout: 5,
    speechTimeout: "auto",
    action: "/process-speech"
  });
  gather.say(aiResponse);
  res.type("text/xml");
  res.send(twiml.toString());
});

// OpenAI helper function
async function queryOpenAI(userSpeech) {
  const prompt = `
You are a friendly real estate voice assistant. 
If the user mentions an address, check if it matches one of these:
${Object.keys(properties).join(", ")}.
If no match, ask them to repeat or clarify the address.
`;

  const response = await fetch(OpenAI_API, {
    method: "POST",
    headers: {
      "Authorization": \`Bearer \${process.env.OPENAI_API_KEY}\`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: userSpeech }
      ]
    })
  });

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "Sorry, could you repeat that?";
}

app.listen(process.env.PORT || 3000, () =>
  console.log(\`Server running on port \${process.env.PORT || 3000}\`)
);
