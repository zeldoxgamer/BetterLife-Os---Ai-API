import express from "express"
import fetch from "node-fetch"
import Redis from "ioredis"

const app = express()
app.use(express.json())

const GEMINI_KEY = process.env.GEMINI_API_KEY
const REDIS_URL = process.env.REDIS_URL

let redis = null

if (REDIS_URL) {

redis = new Redis(REDIS_URL,{ maxRetriesPerRequest:null })

redis.on("connect",()=>{
console.log("Redis connected")
})

}

/* =========================
MODEL
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
WEAK HABIT
========================= */

function weakestHabit(habits,completion){

let min=1
let index=0

completion.forEach((v,i)=>{
if(v<min){
min=v
index=i
}
})

return habits[index] || ""

}

/* =========================
STRONG HABIT
========================= */

function strongestHabit(habits,completion){

let max=0
let index=0

completion.forEach((v,i)=>{
if(v>max){
max=v
index=i
}
})

return habits[index] || ""

}

/* =========================
AI GENERATION
========================= */

async function generateAI(data,type){

const weak = weakestHabit(data.habits,data.habitCompletion)
const strong = strongestHabit(data.habits,data.habitCompletion)

const prompt = `
You are an AI productivity coach.

User stats:

Habit score: ${data.habitScore}
Task score: ${data.taskScore}

Habits:
${data.habits}

Strong habit:
${strong}

Weak habit:
${weak}

Analyze the productivity.

Return ONLY JSON:

{
 "messages":[
  "message",
  "message"
 ]
}

Rules:

short messages
include <user>
give advice
mention weak habit if relevant
mention strong habit if relevant
use emojis
generate 20 messages
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

const text =
raw.candidates[0]
.content.parts[0]
.text

const parsed = JSON.parse(text)

return parsed.messages

}catch(e){

console.log("Parse error")

return [
"<user>, consistency today builds tomorrow’s success 🚀",
"<user>, focus on improving your weakest habit 💪",
"<user>, small daily progress leads to big results 📈",
"<user>, discipline today creates freedom tomorrow 🔥"
]

}

}

/* =========================
CACHE
========================= */

function cacheKey(data,type){
return type+":"+JSON.stringify(data)
}

/* =========================
AI ROUTE
========================= */

app.post("/ai-coach",async(req,res)=>{

console.log("REQUEST:",req.body)

const data=req.body
const type=data.type || "daily"

const key=cacheKey(data,type)

try{

if(redis){

const cached=await redis.get(key)

if(cached){

const list=JSON.parse(cached)

const message=
list[Math.floor(Math.random()*list.length)]

return res.json({message})

}

}

const messages=await generateAI(data,type)

if(redis){
await redis.set(key,JSON.stringify(messages))
}

const message=
messages[Math.floor(Math.random()*messages.length)]

res.json({message})

}catch(e){

console.log("Server error:",e)

res.json({
message:"<user>, stay consistent and keep improving 🚀"
})

}

})

app.get("/",(req,res)=>{
res.send("BetterLife AI API running 🚀")
})

const PORT=process.env.PORT || 8080

app.listen(PORT,()=>{
console.log("Server running on port",PORT)
})
