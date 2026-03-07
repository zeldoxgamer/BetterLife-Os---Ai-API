import express from "express"
import Redis from "ioredis"
import fetch from "node-fetch"

const app = express()

app.use(express.json())

/* REDIS */

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

const cacheKey=`coach:${habitScore}:${taskScore}:${tasksCompleted}`

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

Analyze the user's productivity dashboard.

Habit score: ${habitScore}
Task score: ${taskScore}
Tasks completed: ${tasksCompleted}
Best day: ${bestDay}

Habits:
${habits.join("\n")}

Habit progress:
${habitProgress.join("\n")}

Instructions:

- Detect weak habits
- Mention strong habits
- Give advice
- Use emojis
- Return ONE short motivational message
`

/* GEMINI */

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

const data=await response.json()

const message=data.candidates[0].content.parts[0].text

/* CACHE */

await redis.set(cacheKey,message,"EX",3600)

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
console.log("Server running 🚀")
})
