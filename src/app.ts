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
      return callback(null, false);
    },
    credentials: true,
    maxAge: 86400,
  }),
);
app.use(morgan(envConfig.nodeEnv === "production" ? "combined" : "dev"));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/health", healthRoute);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use("/api/v1", rateLimitMiddleware, routes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;
