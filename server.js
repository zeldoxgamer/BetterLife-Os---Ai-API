import express from "express";
import Redis from "ioredis";

const app = express();

app.use(express.json());

/* redis connection */

const redis = new Redis(process.env.REDIS_URL,{
maxRetriesPerRequest:null,
enableReadyCheck:false
});

/* test route */

app.get("/", (req,res)=>{
res.send("BetterLife AI API running");
});

/* ai endpoint */

app.post("/ai-coach", async (req,res)=>{

try{

const {habitScore,taskScore}=req.body;

const key=`coach:${habitScore}:${taskScore}`;

const cached=await redis.get(key);

if(cached){
return res.json({message:cached,source:"cache"});
}

const message=`🔥 Habit score ${habitScore}, Task score ${taskScore}. Stay consistent and keep improving your daily habits.`;

/* save cache */

await redis.set(key,message);

res.json({message,source:"generated"});

}catch(err){

console.log(err);

res.status(500).json({error:err.message});

}

});

/* start server */

app.listen(8080,"0.0.0.0",()=>{
console.log("Server started on port 8080");
});
