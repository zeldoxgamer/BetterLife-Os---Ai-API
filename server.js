import express from "express"
import Redis from "ioredis"
import fetch from "node-fetch"

const app = express()

app.use(express.json())

/* test route */

app.get("/", (req,res)=>{
res.send("Backend running")
})

/* redis */

const redis = new Redis(process.env.REDIS_URL)

/* AI route */

app.post("/ai-coach", async (req,res)=>{

try{

const {habitScore,taskScore}=req.body

const key=`coach:${habitScore}:${taskScore}`

const cached=await redis.get(key)

if(cached){
return res.json({message:cached})
}

const prompt=`
Habit score ${habitScore}
Task score ${taskScore}

Give productivity advice with emoji.
`

const response=await fetch(
`https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_KEY}`,
{
method:"POST",
headers:{"Content-Type":"application/json"},
body:JSON.stringify({
contents:[{parts:[{text:prompt}]}]
})
})

const data=await response.json()

const text=data.candidates[0].content.parts[0].text

await redis.set(key,text)

res.json({message:text})

}catch(err){

console.error(err)

res.status(500).json({error:"AI error"})

}

})

const PORT = process.env.PORT || 3000

app.listen(PORT, ()=>{
console.log("Server running on port " + PORT)
})
