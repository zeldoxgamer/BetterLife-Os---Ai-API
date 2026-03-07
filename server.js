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

/* CACHE KEY */

const cacheKey = `coach:${habitScore}:${taskScore}:${tasksCompleted}`

/* CHECK CACHE */

const cached = await redis.get(cacheKey)

if(cached){

return res.json({
analysis:JSON.parse(cached),
source:"cache"
})

}

/* PROMPT */

const prompt = `
You are an AI productivity coach.

Analyze the user's productivity dashboard and give useful insights.

Habit score: ${habitScore}
Task score: ${taskScore}
Tasks completed: ${tasksCompleted}
Best day: ${bestDay}

Habits list:
${habits.join("\n")}

Habit progress:
${habitProgress.join("\n")}

Rules:
- Use emojis in messages.
- Messages must feel human and motivational.
- Mention weak habits if detected.
- Keep messages concise but insightful.

Return valid JSON with:

motivation
dailyFocus
weakHabit
weakHabitAdvice
weeklyInsight
productivityTrend
burnoutRisk
`

/* GEMINI CALL */

const response = await fetch(
`https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_KEY}`,
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

const text = data.candidates[0].content.parts[0].text

const analysis = JSON.parse(text)

/* SAVE CACHE */

await redis.set(cacheKey,JSON.stringify(analysis),"EX",3600)

/* RESPONSE */

res.json({
analysis,
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
