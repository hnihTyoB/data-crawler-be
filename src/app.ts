import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";
import {
  errorMiddleware,
  notFoundMiddleware,
} from "./middlewares/error.middleware";
import routes from "./routes";
import swaggerDocument from "./docs/swagger.json";
import healthRoute from "./modules/health/health.route";
import { rateLimitMiddleware } from "./middlewares/rate-limit.middleware";
import { envConfig } from "./config/env.config";
import { parseTrustProxy } from "./common/helpers/proxy.helper";
import { AppError } from "./common/errors/app-error";
import { ERROR_CODE } from "./common/errors/error-code";

const app = express();

app.set("trust proxy", parseTrustProxy(envConfig.trustProxy));

app.use((req, res, next) => {
  if (req.path.startsWith("/api-docs")) {
    return helmet({ contentSecurityPolicy: false })(req, res, next);
  }
  return helmet()(req, res, next);
});

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (envConfig.cors.allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(
        new AppError(
          "Origin not allowed by CORS policy",
          403,
          ERROR_CODE.FORBIDDEN,
        ),
      );
    },
    credentials: true,
    maxAge: 86400,
  }),
);

morgan.token("safe-url", (req: express.Request) => {
  const url = req.originalUrl || req.url || "";
  return url.replace(
    /([?&](?:token|code|secret|apiKey)=)[^&]+/gi,
    "$1[REDACTED]",
  );
});

const morganFormat =
  envConfig.nodeEnv === "production"
    ? ':remote-addr - :remote-user [:date[clf]] ":method :safe-url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"'
    : ":method :safe-url :status :response-time ms - :res[content-length]";

app.use(morgan(morganFormat));
app.use(cookieParser());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

app.use("/health", healthRoute);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use("/api/v1", rateLimitMiddleware, routes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;
