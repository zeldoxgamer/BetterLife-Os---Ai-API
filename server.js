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

/* FIND WEAKEST HABIT */

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

/* FALLBACK */

function fallbackMessages(){

return [

"<user>, small daily habits build powerful results 🚀",

"<user>, consistency beats motivation every time 💪",

"<user>, progress comes from repeating small actions 📈",

"<user>, discipline today creates freedom tomorrow 🔥"

]

}

/* GENERATE AI */

async function generateResponses(data,type){

let prompt

if(type==="daily"){

const weakestHabit =
findWeakestHabit(data.habits,data.habitCompletion)

prompt = `
You are a productivity coach.

Weak habit: ${weakestHabit}

Generate ${VARIATIONS} short coaching messages.

Rules:
- 2 lines max
- motivational
- natural tone
- use emojis
- include <user>

Return each message on a new line.
`

}

if(type==="monthly"){

prompt = `
You are a productivity analyst.

Habit score: ${data.habitScore}
Task score: ${data.taskScore}

User habits:
${data.habits}

Generate ${VARIATIONS} monthly insights.

Rules:
- short insight
- motivational
- use emojis
- include <user>

Return each message on a new line.
`

}

try{

const aiResponse = await fetch(
`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
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
.filter(t=>t.length>10)

if(responses.length===0){
responses = fallbackMessages()
}

return responses

}catch(e){

console.log("Gemini error:",e)

return fallbackMessages()

}

}

/* AI ROUTE */

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
"<user>, keep improving step by step 🚀"

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
"<user>, keep improving step by step 🚀"

res.json({message})

}catch(err){

console.log("SERVER ERROR:",err)

res.json({
message:"<user>, stay consistent. Small habits build powerful results 🚀"
})

}

})

/* START SERVER */

const PORT = process.env.PORT || 8080

app.listen(PORT,()=>{
console.log("BetterLife AI API running on port",PORT)
})
