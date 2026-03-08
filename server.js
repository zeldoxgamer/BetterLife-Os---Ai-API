import express from "express"
import Redis from "ioredis"
import fetch from "node-fetch"
import helmet from "helmet"
import morgan from "morgan"
import rateLimit from "express-rate-limit"
import _ from "lodash"

const app = express()

app.use(express.json())
app.use(helmet())
app.use(morgan("dev"))

/* RATE LIMIT */

const limiter = rateLimit({
windowMs:60000,
max:120
})

app.use(limiter)

/* ROOT ROUTE */

app.get("/",(req,res)=>{
res.send("BetterLife AI API running 🚀")
})

/* REDIS */

const redis = new Redis(process.env.REDIS_URL,{
maxRetriesPerRequest:null
})

redis.on("connect",()=>console.log("Redis connected"))
redis.on("error",(err)=>console.log("Redis error",err))

/* GEMINI */

const GEMINI_KEY = process.env.GEMINI_API_KEY

const VARIATIONS = 20
const EXPANSION_RATE = 0.15

function randomItem(arr){
return _.sample(arr)
}

/* FALLBACK */

function fallbackMessages(){

return [

"<user>, consistency today builds the life you want 🚀",

"<user>, small habits repeated daily create big results 💪",

"<user>, focus on improving just 1% today 📈",

"<user>, discipline today creates freedom tomorrow 🔥"

]

}

/* WEAKEST HABIT */

function findWeakestHabit(habits,completion){

if(!habits || !completion) return null

let min = 1
let weakest = habits[0]

for(let i=0;i<habits.length;i++){

if(completion[i] < min){

min = completion[i]
weakest = habits[i]

}

}

return weakest

}

/* MODEL MIX */

function chooseModel(type){

if(type === "monthly"){

return "gemini-2.5-pro"

}

/* 90% flash 10% pro */

if(Math.random() < 0.1){

return "gemini-2.5-pro"

}

return "gemini-2.5-flash"

}

/* GENERATE RESPONSES */

async function generateResponses(data,type){

let prompt

if(type === "daily"){

const weakestHabit =
findWeakestHabit(data.habits,data.habitCompletion)

prompt = `
You are a productivity life coach.

Weak habit:
${weakestHabit}

Generate ${VARIATIONS} short motivational messages.

Rules:
2 lines max
natural tone
use emojis
include <user>
`

}

if(type === "monthly"){

prompt = `
You are a productivity analyst.

Habit score: ${data.habitScore}
Task score: ${data.taskScore}

Habits:
${data.habits}

Generate ${VARIATIONS} insights.

Rules:
short analysis
motivational
include <user>
use emojis
`

}

try{

const model = chooseModel(type)

const aiResponse = await fetch(
`https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${GEMINI_KEY}`,
{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
contents:[
{
parts:[{text:prompt}]
}
]
})
}
)

const result = await aiResponse.json()

let text =
result?.candidates?.[0]?.content?.parts?.[0]?.text

if(!text){

return fallbackMessages()

}

let responses =
text
.split("\n")
.map(t=>t.trim())
.filter(t=>t.length > 10)

if(responses.length === 0){

responses = fallbackMessages()

}

return responses

}catch(e){

console.log("Gemini error:",e)

return fallbackMessages()

}

}

/* MAIN AI ROUTE */

app.post("/ai-coach", async (req,res)=>{

try{

console.log("REQUEST:",req.body)

const {type,habit,trend} = req.body

const key = `ai:${type}:${habit}:${trend}`

let cached = await redis.get(key)

/* CACHE HIT */

if(cached){

let responses = JSON.parse(cached)

const message =
randomItem(responses) ||
"<user>, stay consistent and keep improving 🚀"

/* DATASET EXPANSION */

if(Math.random() < EXPANSION_RATE){

const newResponses =
await generateResponses(req.body,type)

responses = _.uniq([...responses,...newResponses])

await redis.set(key,JSON.stringify(responses))

}

return res.json({message})

}

/* FIRST GENERATION */

const responses =
await generateResponses(req.body,type)

await redis.set(key,JSON.stringify(responses))

const message =
randomItem(responses) ||
"<user>, stay consistent and keep improving 🚀"

res.json({message})

}catch(err){

console.log("SERVER ERROR:",err)

res.json({

message:
"<user>, small habits today build powerful results 🚀"

})

}

})

/* START SERVER */

const PORT = process.env.PORT || 8080

app.listen(PORT,()=>{

console.log("BetterLife AI API running on port",PORT)

})
