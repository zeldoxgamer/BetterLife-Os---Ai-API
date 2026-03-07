import express from "express"
import Redis from "ioredis"
import fetch from "node-fetch"

const app = express()

app.use(express.json())

const redis = new Redis(process.env.REDIS_URL)

app.post("/ai-coach", async (req,res)=>{

const {habitScore,taskScore} = req.body

const key = `coach:${habitScore}:${taskScore}`

const cached = await redis.get(key)

if(cached){
return res.json({message:cached})
}

const prompt = `
Habit score ${habitScore}
Task score ${taskScore}

Give productivity advice with emoji.
`

const response = await fetch(
`https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${process.env.API_KEY}`,
{
method:"POST",
headers:{"Content-Type":"application/json"},
body:JSON.stringify({
contents:[{parts:[{text:prompt}]}]
})
})

const data = await response.json()

const text = data.candidates[0].content.parts[0].text

await redis.set(key,text)

res.json({message:text})

})

app.listen(3000)
