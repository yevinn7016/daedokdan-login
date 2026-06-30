import express from "express";
import cors from "cors";
import { config } from "./core/config";
import authRouter from "./routes/auth";
import internalRouter from "./routes/internal";
import { testDBConnection } from "./core/db";


const app = express();

app.use(cors());
app.use(express.json());

// 라우트 연결
app.use("/api/auth", authRouter);
app.use("/api/internal", internalRouter);

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    adultVerificationDev: config.adultVerificationDev,
  });
});

const PORT = config.port;

async function bootstrap() {
  await testDBConnection();
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    console.log(`Email from: ${config.emailFrom}`);
    console.log(
      `Adult verification dev mode: ${config.adultVerificationDev ? "ON" : "OFF"}`,
    );
  });
}

bootstrap().catch((err) => {
  console.error("Failed to start server:", err);
});

