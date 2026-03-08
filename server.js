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

if(REDIS_URL){

redis = new Redis(REDIS_URL,{
maxRetriesPerRequest:null
})

redis.on("connect",()=>{
console.log("Redis connected")
})

}

/* =========================
MODEL SELECTION
========================= */

function chooseModel(type){

if(type === "monthly"){
return "gemini-2.5-flash"
}

if(Math.random() < 0.7){
return "gemini-2.5-flash-lite"
}

return "gemini-2.5-flash"

}

/* =========================
FIND WEAKEST HABIT
========================= */

function findWeakestHabit(habits,completion){

if(!habits || !completion) return ""

let min = 1
let index = 0

completion.forEach((v,i)=>{
if(v < min){
min = v
index = i
}
})

return habits[index] || ""

}

/* =========================
GENERATE AI RESPONSES
========================= */

async function generateResponses(data,type){

let prompt = ""

if(type === "daily"){

const weakestHabit =
findWeakestHabit(data.habits,data.habitCompletion)

prompt = `
You are a smart productivity coach.

User habits:
${data.habits}

Weak habit:
${weakestHabit}

Generate 20 different coaching messages.

Rules:
2 lines max
friendly tone
include <user>
include emojis
short advice
sometimes motivational quote
each message on new line
`

}

if(type === "monthly"){

prompt = `
You are a productivity AI analyst.

Habit score: ${data.habitScore}
Task score: ${data.taskScore}

Habits:
${data.habits}

Generate 20 different insights.

Rules:
short analysis
include <user>
motivational
use emojis
each message on new line
`

}

try{

const model = chooseModel(type)

const aiResponse = await fetch(
`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`,
{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
contents:[
{
role:"user",
parts:[
{ text:prompt }
]
}
],
generationConfig:{
temperature:0.9,
topK:40,
topP:0.95,
maxOutputTokens:300
}
})
}
)

const result = await aiResponse.json()

console.log("GEMINI RESPONSE:",JSON.stringify(result))

/* =========================
SAFE PARSING
========================= */

let text = ""

if(result && result.candidates){

const parts = result.candidates[0]?.content?.parts

if(parts && parts.length){

text = parts
.map(p=>p.text || "")
.join("\n")

}

}

console.log("AI RAW:",text)

let responses = text
.split("\n")
.map(t=>t.replace(/^[0-9\-\.\•]+\s*/,"").trim())
.filter(t=>t.length > 10)

if(responses.length){
return responses
}

/* fallback */

return [

"<user>, small daily actions build powerful results 🚀",

"<user>, consistency today creates success tomorrow 💪",

"<user>, discipline beats motivation 📈",

"<user>, focus on improving one habit today 🔥"

]

}catch(e){

console.log("Gemini error:",e)

return [

"<user>, keep improving step by step 🚀",

"<user>, progress comes from consistency 💪",

"<user>, show up today even if motivation is low 📈"

]

}

}

/* =========================
CACHE KEY
========================= */

function cacheKey(data,type){

return type + ":" + JSON.stringify(data)

}

/* =========================
AI COACH ROUTE
========================= */

app.post("/ai-coach",async(req,res)=>{

console.log("REQUEST:",req.body)

const data = req.body
const type = data.type || "daily"

const key = cacheKey(data,type)

try{

/* =========================
REDIS CACHE
========================= */

if(redis){

const cached = await redis.get(key)

if(cached){

const list = JSON.parse(cached)
const message =
list[Math.floor(Math.random()*list.length)]

return res.json({message})

}

}

/* =========================
GENERATE AI
========================= */

const responses =
await generateResponses(data,type)

if(redis){

await redis.set(
key,
JSON.stringify(responses)
)

}

/* RANDOM MESSAGE */

const message =
responses[Math.floor(Math.random()*responses.length)]

res.json({message})

}catch(e){

console.log("Server error:",e)

res.json({
message:"<user>, stay consistent and keep moving forward 🚀"
})

}

})

/* =========================
ROOT
========================= */

app.get("/",(req,res)=>{
res.send("BetterLife AI API running 🚀")
})

/* =========================
START
========================= */

const PORT = process.env.PORT || 8080

app.listen(PORT,()=>{
console.log("Server running on port",PORT)
})
