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

/* REDIS */

const redis = new Redis(process.env.REDIS_URL,{
maxRetriesPerRequest:null
})

redis.on("connect",()=>console.log("Redis connected"))
redis.on("error",(err)=>console.log("Redis error",err))

/* GEMINI */

const GEMINI_KEY = process.env.GEMINI_API_KEY

/* CONFIG */

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

/* GENERATE AI */

async function generateResponses(data,type){

let prompt

if(type==="daily"){

const weakestHabit =
findWeakestHabit(data.habits,data.habitCompletion)

prompt = `

Role: AI productivity coach

HabitScore:${data.habitScore}
TaskScore:${data.taskScore}

Weak habit detected:
${weakestHabit}

Generate ${VARIATIONS} short coaching messages.

Rules:
2 lines max
motivational
natural tone
use emojis
include <user>

Return JSON array only

`

}

if(type==="monthly"){

prompt = `

Role: AI productivity analyst

HabitScore:${data.habitScore}
TaskScore:${data.taskScore}

User habits:
${data.habits}

Analyze monthly productivity.

Generate ${VARIATIONS} insights.

Rules:
short insight
coaching advice
include <user>
use emojis

Return JSON array only

`

}

/* GEMINI REQUEST */

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

let text = result?.candidates?.[0]?.content?.parts?.[0]?.text

let responses

try{
responses = JSON.parse(text)
}catch{
responses = [text]
}

return responses

}catch(e){

console.log("Gemini error",e)

return [
"<user>, small daily habits can transform your life 🚀",
"<user>, consistency beats intensity every time 💪",
"<user>, keep moving forward one habit at a time 📈"
]

}

}

/* ROUTE */

app.post("/ai-coach", async (req,res)=>{

try{

const {type,habit,trend} = req.body

const key = `ai:${type}:${habit}:${trend}`

let cached = await redis.get(key)

if(cached){

let responses = JSON.parse(cached)

const message = randomItem(responses)

/* EXPANSION */

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

const message = randomItem(responses)

res.json({message})

}catch(err){

console.log(err)

res.json({
message:"<user>, stay consistent. Small habits build powerful results 🚀"
})

}

})

/* SERVER */

const PORT = process.env.PORT || 8080

app.listen(PORT,()=>{
console.log("BetterLife AI API running on",PORT)
})
