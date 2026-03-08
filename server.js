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
WEAKEST HABIT
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

const weak=weakestHabit(data.habits,data.habitCompletion)
const strong=strongestHabit(data.habits,data.habitCompletion)

const prompt=`
You are a productivity AI coach.

Habit score: ${data.habitScore}
Task score: ${data.taskScore}

Habits:
${data.habits}

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

generate 40 different messages
each message unique
short messages
include <user>
give advice
mention weak habit when relevant
mention strong habit when relevant
use emojis
`

const model=chooseModel(type)

const response=await fetch(
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

const raw=await response.json()

console.log("GEMINI RAW:",JSON.stringify(raw))

try{

let text=
raw.candidates?.[0]?.content?.parts?.[0]?.text || ""

let clean=text
.replace(/```json/g,"")
.replace(/```/g,"")
.trim()

const parsed=JSON.parse(clean)

return parsed.messages

}catch(e){

console.log("Parse error:",e)

return[
"<user>, consistency today builds tomorrow’s success 🚀",
"<user>, focus on improving your weakest habit 💪",
"<user>, small daily progress leads to big results 📈",
"<user>, discipline today creates freedom tomorrow 🔥"
]

}

}

/* =========================
CACHE KEY
========================= */

function cacheKey(data,type){

return "v2:" + type+ ":" + JSON.stringify({
habitScore:data.habitScore,
taskScore:data.taskScore,
habits:data.habits
})

}

/* =========================
AI ROUTE
========================= */

app.post("/ai-coach",async(req,res)=>{

const data=req.body
const type=data.type || "daily"

console.log("REQUEST:",data)

const key=cacheKey(data,type)

try{

if(redis){

let cached=await redis.get(key)

if(cached){

let list=JSON.parse(cached)

console.log("POOL SIZE:",list.length)

/* REFRESH POOL 5% */

if(Math.random()<0.05){

console.log("Refreshing pool")

const newMessages=
await generateAI(data,type)

list=[...list,...newMessages]

/* LIMIT */

list=list.slice(-100)

await redis.set(key,JSON.stringify(list))

}

/* RANDOM MESSAGE */

const message=
list[Math.floor(Math.random()*list.length)]

return res.json({message})

}

}

/* GENERATE FIRST TIME */

const messages=
await generateAI(data,type)

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

/* =========================
ROOT
========================= */

app.get("/",(req,res)=>{
res.send("BetterLife AI API running 🚀")
})

/* =========================
START
========================= */

const PORT=process.env.PORT || 8080

app.listen(PORT,()=>{
console.log("Server running on port",PORT)
})
