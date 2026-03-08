import express from "express"
import fetch from "node-fetch"
import Redis from "ioredis"

const app = express()
app.use(express.json())

const GEMINI_KEY = process.env.GEMINI_API_KEY
const REDIS_URL = process.env.REDIS_URL

/* =========================
REDIS
========================= */

let redis = null

if (REDIS_URL) {

redis = new Redis(REDIS_URL,{maxRetriesPerRequest:null})

redis.on("connect",()=>{
console.log("Redis connected")
})

}

/* =========================
MODEL SELECTION
========================= */

function chooseModel(type){

if(type==="monthly"){
return "gemini-2.5-flash"
}

if(Math.random()<0.7){
return "gemini-2.5-flash-lite"
}

return "gemini-2.5-flash"

}

/* =========================
STRONGEST HABIT
========================= */

function strongestHabit(habits,completion){

let max = 0
let strong = ""

habits.slice(0,10).forEach((h,i)=>{

const c = completion[i] ?? 0

if(c > max){
max = c
strong = h
}

})

return strong

}

/* =========================
WEAKEST HABIT
========================= */

function weakestHabit(habits,completion){

let min = 1
let weak = ""

habits.slice(0,10).forEach((h,i)=>{

const c = completion[i] ?? 1

if(c < min){
min = c
weak = h
}

})

return weak

}

/* =========================
CACHE KEY (V3)
========================= */

function cacheKey(data,type){

const habitsKey = (data.habits || [])
.slice(0,10)
.join("-")

const scoreKey =
"hs"+Math.round(data.habitScore) +
"_ts"+Math.round(data.taskScore)

return "ai:v4:"+type+":"+habitsKey+":"+scoreKey

}

/* =========================
AI GENERATION
========================= */

async function generateAI(data,type){

const weak = weakestHabit(data.habits,data.habitCompletion)
const strong = strongestHabit(data.habits,data.habitCompletion)

const prompt = `
You are a friendly productivity AI coach.

User statistics:

Habit score: ${data.habitScore}
Task score: ${data.taskScore}

Tasks completed: ${data.tasksCompleted}
Best day: ${data.bestDay}

Habits (max 10):
${data.habits.slice(0,10)}

Strong habit:
${strong}

Weak habit:
${weak}

Return ONLY JSON:

{
 "messages":[
  "message"
 ]
}

Rules:

Generate 40 different messages.

Each message must feel natural and different.

Sometimes give motivation.
Sometimes give a quote.
Sometimes analyze productivity.
Sometimes mention the weak habit.
Sometimes encourage the strong habit.

Do NOT always talk about scores.

Examples of topics:

• improving weak habits  
• celebrating strong habits  
• discipline and consistency  
• motivation and mindset  
• productivity advice  
• short inspiring quotes  

Messages must:

- include <user>
- be short (1-2 sentences)
- feel human and friendly
- include emojis
`

const model = chooseModel(type)

const response = await fetch(
`https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${GEMINI_KEY}`,
{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
contents:[
{
parts:[
{ text:prompt }
]
}
]
})
}
)

const raw = await response.json()

console.log("GEMINI RAW:",JSON.stringify(raw))

try{

let text =
raw.candidates?.[0]?.content?.parts?.[0]?.text || ""

let clean = text
.replace(/```json/g,"")
.replace(/```/g,"")
.trim()

const parsed = JSON.parse(clean)

return parsed.messages

}catch(e){

console.log("Parse error:",e)

return [
"<user>, stay consistent and keep improving 🚀",
"<user>, focus on your weakest habit today 💪",
"<user>, small progress every day builds success 📈",
"<user>, discipline today creates freedom tomorrow 🔥"
]

}

}

/* =========================
AI ROUTE
========================= */

app.post("/ai-coach",async(req,res)=>{

const data = req.body

/* ===== FORCE HABIT LIMIT ===== */

if(Array.isArray(data.habits)){
data.habits = data.habits.slice(0,10)
}

if(Array.isArray(data.habitCompletion)){
data.habitCompletion = data.habitCompletion.slice(0,10)
}

console.log("HABITS RECEIVED:",data.habits)
console.log("HABIT COUNT:",data.habits.length)

/* ===== FIX GOOGLE SHEETS PERCENT ===== */

if(data.habitScore <= 1){
data.habitScore = Math.round(data.habitScore * 100)
}

if(data.taskScore <= 1){
data.taskScore = Math.round(data.taskScore * 100)
}

const type = data.type || "daily"

console.log("REQUEST:",data)

const key = cacheKey(data,type)

try{

if(redis){

let cached = await redis.get(key)

if(cached){

let list = JSON.parse(cached)

console.log("POOL SIZE:",list.length)

/* refresh pool sometimes */

if(Math.random() < 0.05){

const newMessages = await generateAI(data,type)

list = [...list,...newMessages]

list = list.slice(-100)

await redis.set(key,JSON.stringify(list))

}

/* random message */

const message =
list[Math.floor(Math.random()*list.length)]

return res.json({message})

}

}

/* first generation */

const messages = await generateAI(data,type)

if(redis){
await redis.set(key,JSON.stringify(messages))
}

const message =
messages[Math.floor(Math.random()*messages.length)]

res.json({message})

}catch(e){

console.log("Server error:",e)

res.json({
message:"<user>, stay consistent and keep improving 🚀"
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
START SERVER
========================= */

const PORT = process.env.PORT || 8080

app.listen(PORT,()=>{
console.log("Server running on port",PORT)
})
