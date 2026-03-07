import express from "express";

const app = express();
app.use(express.json());

app.get("/", (req,res)=>{
  res.send("BetterLife AI API running");
});

app.post("/ai-coach",(req,res)=>{
  const {habitScore, taskScore} = req.body;

  const message = `🔥 Habit score: ${habitScore}, Task score: ${taskScore}. Keep improving your daily discipline!`;

  res.json({message});
});

const PORT = 8080;

app.listen(PORT,"0.0.0.0",()=>{
  console.log("Server started on port " + PORT);
});
