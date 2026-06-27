/**
 * Configuration runtime de l'app. L'URL de l'API est lue depuis
 * `EXPO_PUBLIC_API_URL` (inlinée au build par Expo) avec repli sur l'API NestJS
 * locale de dev (docker-compose + `pnpm --filter @hpt/api dev`, port 3000).
 *
 * Le repli est une commodité de dev — jamais un secret. En prod, la variable
 * pointe vers le Serverless Container fr-par (Stack §3.5).
 */
const DEFAULT_API_BASE_URL = 'http://localhost:3000';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL?.trim() || DEFAULT_API_BASE_URL;
