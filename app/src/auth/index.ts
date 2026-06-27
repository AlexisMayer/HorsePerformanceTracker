/**
 * Module d'auth de l'app — câblage sur l'API du lot 1.1. Surface React :
 * `AuthProvider` + `useAuth`. La logique testable (token store, interceptor 401)
 * vit dans `token-store.ts` / `api-client.ts` et est couverte par des tests
 * Vitest qui n'importent pas ce barrel (pour rester hors de React Native).
 */
export { ApiError } from './api-client';
export { type AuthContextValue, AuthProvider, type AuthStatus, useAuth } from './auth-context';
export { authErrorMessage } from './error-messages';
