import type { TierPayant } from '@hpt/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { useMemo } from 'react';
import { useAuth } from '../auth';
import { createNativeCheckoutNavigateurPort } from './native-checkout-browser-port';
import { createSubscriptionApi } from './subscription-api';
import { lancerUpgrade, type UpgradeRésultat } from './upgrade-flow';

/**
 * Hooks `subscription` (lot 4.2) — état serveur via **TanStack Query** (Stack
 * §3.1), sur le client **authentifié** d'`auth-context`. Les requêtes ne sont
 * activées qu'une fois la session établie.
 *
 * Le **déverrouillage reste l'autorité serveur** : `useUpgrade` ne lit jamais le
 * retour du navigateur comme une élévation ; il **force la rotation du jeton**
 * (contrat 4.1) puis invalide l'entitlement et l'abonnement — l'écran lit
 * ensuite l'état déverrouillé / *pending*.
 */
const SUBSCRIPTION_KEY = ['subscription'] as const;

/** Deep link de retour de checkout (doit matcher le `redirectUrl` serveur). */
function retourUrl(): string {
  return Linking.createURL('upgrade-return');
}

function useSubscriptionApi() {
  const { client } = useAuth();
  return useMemo(() => createSubscriptionApi(client), [client]);
}

/** Offres tarifaires (premium/pro) — montants lus de la config serveur. */
export function useOffres() {
  const api = useSubscriptionApi();
  const { status } = useAuth();
  return useQuery({
    queryKey: [...SUBSCRIPTION_KEY, 'offres'],
    queryFn: () => api.getOffres(),
    enabled: status === 'authenticated',
    staleTime: 5 * 60_000,
  });
}

/** État d'abonnement du compte (statut + tier cible + URL de gestion Mollie). */
export function useAbonnement() {
  const api = useSubscriptionApi();
  const { status, account } = useAuth();
  return useQuery({
    queryKey: [...SUBSCRIPTION_KEY, 'abonnement', account?.id ?? null],
    queryFn: () => api.getStatut(),
    enabled: status === 'authenticated',
    staleTime: 30_000,
  });
}

/**
 * Lance l'upgrade in-app (checkout Mollie → retour → re-lecture). Au succès,
 * l'entitlement et l'abonnement sont invalidés : l'écran reflète le
 * déverrouillage (ou l'état *pending* si SEPA non confirmé).
 */
export function useUpgrade() {
  const api = useSubscriptionApi();
  const { refreshSession } = useAuth();
  const queryClient = useQueryClient();
  const navigateur = useMemo(() => createNativeCheckoutNavigateurPort(), []);

  return useMutation<UpgradeRésultat, Error, TierPayant>({
    mutationFn: (tierCible) =>
      lancerUpgrade(
        {
          api,
          navigateur,
          retourUrl: retourUrl(),
          rafraîchir: async () => {
            // Contrat 4.1 : rotation forcée du jeton pour que le claim `tier`
            // rejoigne l'entitlement, puis re-lecture (autorité serveur).
            await refreshSession();
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: ['entitlement'] }),
              queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_KEY }),
            ]);
          },
        },
        tierCible,
      ),
  });
}

/**
 * Lance le **changement de formule** premium→pro (MOD-001, « Passer à Pro » du
 * Profil). **Réutilise** l'orchestration `lancerUpgrade` (checkout → retour →
 * re-lecture), mais le « checkout » est l'endpoint **`changer-formule`** (paiement
 * pro sur le **mandat réutilisé** ; le serveur résilie le premium au webhook —
 * aucun doublon). Au retour : refresh forcé + invalidations → l'écran reflète
 * l'état *pending* honnête **au-dessus** de l'accès premium conservé (le tier ne
 * bascule qu'au **webhook** pro — autorité serveur).
 */
export function usePasserPro() {
  const api = useSubscriptionApi();
  const { refreshSession } = useAuth();
  const queryClient = useQueryClient();
  const navigateur = useMemo(() => createNativeCheckoutNavigateurPort(), []);

  return useMutation<UpgradeRésultat, Error, void>({
    mutationFn: () =>
      lancerUpgrade(
        {
          // Même orchestration que l'upgrade neuf ; seul le point d'entrée diffère
          // (changement de formule, endpoint dédié) — on ne duplique pas le flux.
          api: { createCheckout: () => api.changerFormule() },
          navigateur,
          retourUrl: retourUrl(),
          rafraîchir: async () => {
            await refreshSession();
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: ['entitlement'] }),
              queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_KEY }),
            ]);
          },
        },
        'pro',
      ),
  });
}

/** Re-lit l'état (force refresh + invalidations) — pour le bouton « Actualiser » du pending. */
export function useActualiserAbonnement() {
  const { refreshSession } = useAuth();
  const queryClient = useQueryClient();
  return useMutation<void, Error, void>({
    mutationFn: async () => {
      await refreshSession();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['entitlement'] }),
        queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_KEY }),
      ]);
    },
  });
}

/** Résilie l'abonnement courant ; invalide l'état au succès. */
export function useAnnulerAbonnement() {
  const api = useSubscriptionApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.annuler(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_KEY }),
  });
}

/** Ouvre l'espace de gestion Mollie (renvoi gérer/résilier, Spec §9.3). */
export async function ouvrirGestionMollie(url: string): Promise<void> {
  await Linking.openURL(url);
}
