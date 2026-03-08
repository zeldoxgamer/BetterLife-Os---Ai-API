import express from "express"
import fetch from "node-fetch"
import Redis from "ioredis"

const app = express()
app.use(express.json())

/* =========================
ENV
========================= */

const GEMINI_KEY = process.env.GEMINI_API_KEY
const REDIS_URL = process.env.REDIS_URL

/* =========================
REDIS
========================= */

let redis = null

if (REDIS_URL) {

  redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null
  })

  redis.on("connect", () => {
    console.log("Redis connected")
  })

}

/* =========================
MODEL SELECTION
========================= */

function chooseModel(type) {

  if (type === "monthly") {
    return "gemini-2.5-flash"
  }

  if (Math.random() < 0.7) {
    return "gemini-2.5-flash-lite"
  }

  return "gemini-2.5-flash"

}

/* =========================
WEAKEST HABIT
========================= */

function weakestHabit(habits, completion) {

  if (!habits || !completion) return ""

  let min = 1
  let index = 0

  completion.forEach((v, i) => {
    if (v < min) {
      min = v
      index = i
    }
  })

  return habits[index] || ""

}

/* =========================
GENERATE AI
========================= */

async function generateAI(data, type) {

  const weak = weakestHabit(data.habits, data.habitCompletion)

  const prompt = `
You are a productivity AI coach.

User data:
habit score: ${data.habitScore}
task score: ${data.taskScore}

habits:
${data.habits}

weak habit:
${weak}

Return ONLY JSON.

Format:

{
 "messages":[
  "message",
  "message",
  "message"
 ]
}

Rules:

short messages
max 2 lines
include <user>
use emojis
sometimes include motivation or quote
generate 20 messages
`

  const model = chooseModel(type)

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${GEMINI_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt }
            ]
          }
        ]
      })
    }
  )

  const raw = await response.json()

  console.log("GEMINI RAW:", JSON.stringify(raw))

  try {

    const text =
      raw.candidates[0]
        .content.parts[0]
        .text

    const parsed = JSON.parse(text)

    return parsed.messages

  } catch (e) {

    console.log("Parsing failed")

    return [
      "<user>, small habits daily build big success 🚀",
      "<user>, consistency today creates tomorrow’s results 💪",
      "<user>, focus on improving one habit today 📈",
      "<user>, progress comes from showing up every day 🔥"
    ]

  }

}

/* =========================
CACHE KEY
========================= */

function cacheKey(data, type) {
  return type + ":" + JSON.stringify(data)
}

/* =========================
AI ROUTE
========================= */

app.post("/ai-coach", async (req, res) => {

  console.log("REQUEST:", req.body)

  const data = req.body
  const type = data.type || "daily"

  const key = cacheKey(data, type)

  try {

    /* CACHE */

    if (redis) {

      const cached = await redis.get(key)

      if (cached) {

        const list = JSON.parse(cached)

        const message =
          list[Math.floor(Math.random() * list.length)]

        return res.json({ message })

      }

    }

    /* GENERATE */

    const messages = await generateAI(data, type)

    /* SAVE CACHE */

    if (redis) {

      await redis.set(
        key,
        JSON.stringify(messages)
      )

    }

    const message =
      messages[Math.floor(Math.random() * messages.length)]

    res.json({ message })

  } catch (err) {

    console.log("Server error:", err)

    res.json({
      message: "<user>, stay consistent and keep improving 🚀"
    })

  }

})

/* =========================
ROOT
========================= */

app.get("/", (req, res) => {
  res.send("BetterLife AI API running 🚀")
})

/* =========================
START SERVER
========================= */

const PORT = process.env.PORT || 8080

app.listen(PORT, () => {
  console.log("Server running on port", PORT)
})
