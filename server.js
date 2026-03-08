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
windowMs: 60000,
max: 120
})

app.use(limiter)

/* REDIS */

const redis = new Redis(process.env.REDIS_URL)

/* GEMINI */

const GEMINI_KEY = process.env.GEMINI_API_KEY

/* CONFIG */

const VARIATIONS = 20
const EXPANSION_RATE = 0.15

/* RANDOM */

function randomItem(arr){
return _.sample(arr)
}

/* FIND WEAKEST HABIT */

function findWeakestHabit(habits,completion){

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

/* AI GENERATION */

async function generateResponses(data,type){

let prompt

/* DAILY */

if(type==="daily"){

const weakestHabit =
findWeakestHabit(data.habits,data.habitCompletion)

prompt = `

Role: AI productivity coach

HabitScore: ${data.habitScore}
TaskScore: ${data.taskScore}

Weak habit detected:
${weakestHabit}

Generate ${VARIATIONS} coaching messages.

Rules:
- natural tone
- 2 lines max
- motivational
- include <user>
- use emojis
- avoid repeating structure

Return JSON array only.

`

}

/* MONTHLY */

if(type==="monthly"){

prompt = `

Role: AI productivity analyst

HabitScore: ${data.habitScore}
TaskScore: ${data.taskScore}

User habits:
${data.habits}

Analyze the monthly performance.

Detect possible weak habits.

Generate ${VARIATIONS} monthly insights.

Rules:
- short insight
- coaching advice
- include <user>
- use emojis

Return JSON array only.

`

}

/* GEMINI CALL */

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
parts:[
{text:prompt}
]
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

}

/* ROUTE */

app.post("/ai-coach", async (req,res)=>{

try{

const {type,habit,trend} = req.body

const key = `ai:${type}:${habit}:${trend}`

let cached = await redis.get(key)

/* CACHE HIT */

if(cached){

let responses = JSON.parse(cached)

const message = randomItem(responses)

/* DATASET EXPANSION */

if(Math.random() < EXPANSION_RATE){

const newResponses =
await generateResponses(req.body,type)

responses = _.uniq([...responses,...newResponses])

await redis.set(key, JSON.stringify(responses))

}

return res.json({message})

}

/* FIRST GENERATION */

const responses =
await generateResponses(req.body,type)

await redis.set(key, JSON.stringify(responses))

const message = randomItem(responses)

res.json({message})

}

catch(err){

console.log(err)

res.json({
message:"<user>, stay consistent. Small habits create powerful results 🚀"
})

}

})

/* SERVER */

const PORT = process.env.PORT || 8080

app.listen(PORT,()=>{
console.log("BetterLife AI API running on",PORT)
})
