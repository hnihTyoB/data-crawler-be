import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import { errorMiddleware, notFoundMiddleware } from './middlewares/error.middleware';
import routes from './routes';
import swaggerDocument from './docs/swagger.json';
import { rateLimitMiddleware } from './middlewares/rate-limit.middleware';
import { envConfig } from './config/env.config';
import { parseTrustProxy } from './common/helpers/proxy.helper';

const app = express();

app.set('trust proxy', parseTrustProxy(envConfig.trustProxy));

app.use(
  helmet({
    contentSecurityPolicy: false, // Vô hiệu hóa CSP để Swagger UI load stylesheet bình thường
  }),
);
app.use(
  cors({
    origin: envConfig.mail.frontendUrl,
    credentials: true,
  }),
);
app.use(morgan('dev'));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use('/api/v1', rateLimitMiddleware, routes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;

