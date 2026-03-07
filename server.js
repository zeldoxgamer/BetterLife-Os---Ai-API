import express from "express";
import Redis from "ioredis";

const app = express();
app.use(express.json());

const redis = new Redis(process.env.REDIS_URL);

app.get("/", (req,res)=>{
res.send("Backend running");
});

app.post("/ai-coach", async (req,res)=>{

try{

const {habitScore,taskScore}=req.body;

console.log("Request received:",habitScore,taskScore);

const key=`coach:${habitScore}:${taskScore}`;

const cached=await redis.get(key);

if(cached){
return res.json({message:cached,source:"cache"});
}

const message=`🔥 Habit score ${habitScore}, Task score ${taskScore}`;

await redis.set(key,message);

res.json({message,source:"generated"});

}catch(err){

console.log("ERROR:",err);

res.status(500).json({
error:err.message
});

}

});

app.listen(8080,"0.0.0.0",()=>{
console.log("Server started");
});
