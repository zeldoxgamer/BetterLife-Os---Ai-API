import express from "express"
import Redis from "ioredis"
import fetch from "node-fetch"

const app = express()

app.use(express.json())

const redis = new Redis(process.env.REDIS_URL,{
maxRetriesPerRequest:null,
enableReadyCheck:false
})

app.get("/",(req,res)=>{
res.send("BetterLife AI API running 🚀")
})

app.post("/ai-coach",async(req,res)=>{

try{

const {
habitScore=0,
taskScore=0,
tasksCompleted=0,
bestDay="",
habits=[],
habitProgress=[],
bestHabit="",
worstHabit=""
}=req.body

/* TIME */

const hour=new Date().getHours()

let timeOfDay="day"

if(hour<12){
timeOfDay="morning"
}
else if(hour<18){
timeOfDay="afternoon"
}
else{
timeOfDay="night"
}

/* RANDOM */

const random=Math.floor(Math.random()*5)+1

const key=`coach:${habitScore}:${taskScore}:${timeOfDay}:${random}`

const cached=await redis.get(key)

if(cached){

await redis.incr(`${key}:count`)

return res.json({
message:cached,
source:"cache"
})

}

/* PROMPT */

const prompt=`
You are an AI productivity coach.

Time: ${timeOfDay}

Habit score: ${habitScore}
Task score: ${taskScore}

Best habit: ${bestHabit}
Weak habit: ${worstHabit}

Rules:

- 2 or 3 short lines only
- Use emojis
- No markdown
`

/* GEMINI */

const response=await fetch(
`https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash-lite:generateContent?key=${process.env.GEMINI_KEY}`,
{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
contents:[{
parts:[{text:prompt}]
}]
})
}
)

const data=await response.json()

let message=data.candidates[0].content.parts[0].text

message=message
.replace(/\*\*/g,"")
.replace(/\*/g,"")
.trim()

/* SAVE */

await redis.set(key,message)

await redis.set(`${key}:count`,1)

res.json({
message,
source:"ai"
})

}catch(err){

console.log(err)

res.status(500).json({
error:err.message
})

}

})

app.listen(8080,"0.0.0.0",()=>{
console.log("Server running 🚀")
})
