import express from "express";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { apiRouter } from "./routes/api";

export async function startServer() {
  const app = express();
  const root = process.cwd();
  const webDir = path.join(root, "web");
  const outputsDir = path.join(root, "outputs");

  await mkdir(outputsDir, { recursive: true });

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  app.use("/outputs", express.static(outputsDir));
  app.use("/api", apiRouter);
  app.use(express.static(webDir));

  app.use((_req, res) => {
    res.sendFile(path.join(webDir, "index.html"));
  });

  const port = Number(process.env.PORT ?? 8787);
  await new Promise<void>((resolve) => {
    app.listen(port, () => {
      console.log(`Tshuabu web server running at http://localhost:${port}`);
      resolve();
    });
  });
}
