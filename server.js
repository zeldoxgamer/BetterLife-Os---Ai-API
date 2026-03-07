import express from "express";
import Redis from "ioredis";

const app = express();

/* middleware */

app.use(express.json());

/* connect redis */

const redis = new Redis(process.env.REDIS_URL);

/* test route */

app.get("/", (req,res)=>{
res.send("BetterLife AI API running");
});

/* AI coach endpoint */

app.post("/ai-coach", async (req,res)=>{

try{

const {habitScore,taskScore}=req.body;

/* create cache key */

const key=`coach:${habitScore}:${taskScore}`;

/* check cache */

const cached=await redis.get(key);

if(cached){

return res.json({
message:cached,
source:"cache"
});

}

/* generate response */

const message=`🔥 Habit score ${habitScore}, Task score ${taskScore}. Stay consistent and keep improving your daily habits.`;

/* save to cache */

await redis.set(key,message);

/* return response */

res.json({
message:message,
source:"generated"
});

}catch(err){

console.error(err);

res.status(500).json({
error:"Server error"
});

}

});

/* start server */

const PORT=8080;

app.listen(PORT,"0.0.0.0",()=>{

console.log("Server started on port "+PORT);

});
