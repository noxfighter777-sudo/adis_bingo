import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "../server/src/routes";
import path from "path";

const app = express();

// Add CORS headers for proper browser communication
app.use((req: any, res: any, next: any) => {
  const allowedOrigin = process.env.NODE_ENV === 'production' ? false : req.headers.origin || '*';
  res.header('Access-Control-Allow-Origin', allowedOrigin);
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS,PATCH');
  res.header('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,Authorization,Cache-Control,Pragma,Set-Cookie,Cookie');
  res.header('Access-Control-Expose-Headers', 'Set-Cookie');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: process.env.JSON_LIMIT || '10mb' }));
app.use(express.urlencoded({ extended: false, limit: process.env.JSON_LIMIT || '10mb' }));

// Serve static audio files with proper MIME types
const publicPath = path.resolve(process.cwd(), "public");
app.use(express.static(publicPath, {
  setHeaders: (res: any, filePath: any) => {
    if (filePath.endsWith('.mp3')) {
      res.setHeader('Content-Type', 'audio/mpeg');
    }
  }
}));

app.use((req: any, res: any, next: any) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson: any, ...args: any) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += " :: " + JSON.stringify(capturedJsonResponse);
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      console.log(logLine);
    }
  });

  next();
});

// Register all routes
registerRoutes(app).then(() => {
  console.log("Routes registered successfully");
}).catch((error) => {
  console.error("Error registering routes:", error);
});

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ message });
});

// Export for Vercel serverless
module.exports = app;
