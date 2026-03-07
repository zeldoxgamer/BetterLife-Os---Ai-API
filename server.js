import express from "express"
import Redis from "ioredis"
import fetch from "node-fetch"

const app = express()

app.use(express.json())

/* REDIS CONNECTION */

const redis = new Redis(process.env.REDIS_URL,{
maxRetriesPerRequest:null,
enableReadyCheck:false
})

/* ROOT */

app.get("/",(req,res)=>{
res.send("BetterLife AI API running 🚀")
})

/* AI COACH */

app.post("/ai-coach",async(req,res)=>{

try{

const {
habitScore,
taskScore,
tasksCompleted,
bestDay,
habits,
habitProgress
} = req.body

/* TIME OF DAY */

const hour = new Date().getHours()

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

/* DAILY CACHE */

const day = new Date().getDate()

const cacheKey=`coach:${habitScore}:${taskScore}:${tasksCompleted}:${day}:${timeOfDay}`

const cached=await redis.get(cacheKey)

if(cached){

return res.json({
message:cached,
source:"cache"
})

}

/* PROMPT */

const prompt = `
You are an AI productivity coach.

Time of day: ${timeOfDay}

User data:

Habit score: ${habitScore}
Task score: ${taskScore}
Tasks completed: ${tasksCompleted}
Best day: ${bestDay}

Habits:
${habits.join("\n")}

Habit progress:
${habitProgress.join("\n")}

Rules:

- Message must be 2 or 3 short lines only.
- Use simple emojis.
- Do not use markdown symbols like ** or *.
- Keep the message motivational and clear.

Morning:
Motivate and help the user start the day.

Afternoon:
Encourage focus and productivity.

Night:
Give reflection and discipline advice.
`

/* GEMINI CALL */

const response = await fetch(
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

const data = await response.json()

let message=data.candidates[0].content.parts[0].text

/* CLEAN MARKDOWN */

message=message
.replace(/\*\*/g,"")
.replace(/\*/g,"")
.trim()

/* CACHE SAVE */

await redis.set(cacheKey,message,"EX",86400)

/* RESPONSE */

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

/* SERVER */

app.listen(8080,"0.0.0.0",()=>{
console.log("Server running on port 8080 🚀")
})
