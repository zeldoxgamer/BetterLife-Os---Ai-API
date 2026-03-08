import express from "express"
import Redis from "ioredis"
import fetch from "node-fetch"

const app = express()

app.use(express.json())

/* REDIS */

const redis = new Redis(process.env.REDIS_URL)

/* GEMINI */

const GEMINI_KEY = process.env.GEMINI_API_KEY

/* RANDOM */

function randomItem(arr){
return arr[Math.floor(Math.random()*arr.length)]
}

/* ROUTE */

app.post("/ai-coach", async (req,res)=>{

try{

const {habit,trend,habitScore,taskScore} = req.body

/* REDIS KEY */

const key = `habit:${habit}:trend:${trend}`

/* CHECK REDIS */

let cached = await redis.get(key)

if(cached){

const responses = JSON.parse(cached)

const message = randomItem(responses)

return res.json({message})

}

/* PROMPT */

const prompt = `

You are a motivational productivity coach.

Always address the user as <user>.

Habit: ${habit}
Trend: ${trend}
Habit score: ${habitScore}
Task score: ${taskScore}

Give:
short analysis
one practical advice
one motivational idea
sometimes a short quote

Rules:
2 or 3 lines
friendly tone
use emojis
natural language
never repeat the habit name literally

`

/* GEMINI CALL */

const response = await fetch(
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

const data = await response.json()

let message = data?.candidates?.[0]?.content?.parts?.[0]?.text

if(!message){
message = "Stay consistent. Small habits create big results. 🚀"
}

/* GENERATE VARIATIONS */

const responses = []

for(let i=0;i<10;i++){

responses.push(message)

}

/* SAVE REDIS */

await redis.set(key, JSON.stringify(responses))

/* RETURN */

res.json({message})

}

catch(err){

console.log(err)

res.json({
message:"Keep building strong habits every day. 🚀"
})

}

})

/* SERVER */

const PORT = process.env.PORT || 8080

app.listen(PORT,()=>{
console.log("AI Coach running on",PORT)
})
