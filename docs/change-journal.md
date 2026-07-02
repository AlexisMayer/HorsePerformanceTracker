# Journal des modifications — Horse Performance Tracker

> **Journal vivant des modifications** (post-construction, phases 0→5 livrées).
> Append-only : chaque intervention de maintenance/amélioration y ajoute une
> entrée `MOD-NNN` (numérotation séquentielle). Distinct de `build-journal.md`
> (archive **gelée**, lecture seule, mémoire de la construction). On **lit** le
> build-journal pour comprendre l'existant ; on **écrit** ici à la livraison.

---

## MOD-001 · 2026-07-02 · **amélioration** — Upgrade premium → pro

**Déclencheur.** Un compte **premium** pouvait **résilier** mais n'avait **aucun
moyen de passer à pro** de façon proactive. On ouvre cette conversion — la plus
rentable (le pro cible les coachs, tier de revenu principal) : depuis le
**Profil**, un premium déclenche un **changement de formule** vers pro ; après
confirmation par **webhook Mollie**, son tier passe à pro ; il n'est **jamais
doublement facturé** et **ne perd jamais son accès** pendant la bascule.

**Diagnostic (cause racine).** Le lot 4.2 n'a construit et prouvé que la
**souscription neuve** (gratuit→payant) : création d'un abonnement Mollie + mandat
SEPA. Aucun chemin ne route un compte **déjà abonné** vers un **changement de
formule** ; son point ouvert le disait explicitement (« gestion fine de la
résiliation/proration côté Mollie … reste à brancher »). Un premium atteignant le
choix « Pro » via le chemin de souscription neuve (`POST /me/subscription/checkout`)
**créait un second abonnement Mollie → double prélèvement**. Le manque réel
n'était donc pas « un bouton » mais **le flux serveur de changement de formule**.

**Décision tranchée + rationale.**
- **Chemin dédié, distinct de la souscription neuve.** Nouvel endpoint
  `POST /me/subscription/changer-formule` (réservé aux **premium**, garde serveur
  sur le tier du principal) → `SubscriptionsService.changerFormule`. La souscription
  neuve (`créerCheckout`) reste **inchangée** pour gratuit→premium/pro.
- **Résiliation premium + création pro, mandat réutilisé, sans proration.** Le
  mandat SEPA vit sur le **client** Mollie (pas sur l'abonnement) : le changement
  crée le paiement pro **sur ce mandat existant** (`sequenceType: recurring`, aucun
  nouveau client/mandat) puis, **au webhook**, crée l'abonnement pro sur ce mandat
  et **résilie** le premium. **Sans proration** (tarif plat mono-tier, Stack §6).
- **Le webhook reste la SEULE autorité du tier** (décision figée 4.2, non rouverte).
  `changerFormule` ne flippe pas le tier ; il pose une ligne pro `en_attente` liée au
  premium via `remplace_abonnement_id`. `réconcilier` (webhook) fait le swap atomique :
  premium `annulé` + pro `actif` + `compte.tier`→pro. Le retour client ne fait que
  **re-lire** l'entitlement (état *pending* honnête).
- **Aucune perte d'accès.** Tant que le pro n'est pas confirmé, `compte.tier` **reste
  premium** → l'entitlement effectif reste premium (jamais gratuit/verrouillé
  transitoire). L'UI affiche le *pending* **au-dessus** de l'accès premium conservé.
- **Anti double-facturation, aussi côté serveur.** En miroir du chemin dédié,
  `créerCheckout` **refuse** (409) un compte ayant déjà un abonnement `actif`/`en_attente`
  → ferme le trou même si un premium tapait « Pro » via un autre client (ex. paywall).
- **Point d'entrée = Profil.** CTA **« Passer à Pro »** dans la carte Abonnement,
  **premium uniquement** (prédicat pur `peutPasserPro`), **réutilisant** le flux de
  checkout/refresh de 4.2 (`lancerUpgrade`) — pas de duplication d'écran.

**Surface impactée.**
- **Schéma** : `api/src/db/schema/abonnement.ts` (+ colonne self-lien
  `remplace_abonnement_id`, `ON DELETE SET NULL`) ; migration additive
  `api/drizzle/0009_zippy_rogue.sql` (+ snapshot). Table `abonnement` déjà hors
  Modèle métier (technique, comme `refresh_token`).
- **API `entitlements`** : `mollie/mollie.port.ts` (+ `créerPaiementChangement`),
  `mollie/fake-mollie.ts` (impl + journaux d'appels + préservation du mandat réutilisé),
  `mollie/mollie-http.client.ts` (impl réelle, `sequenceType: recurring` sur mandat
  existant), `entitlements.errors.ts` (+ `ChangementFormuleInvalideError` 403,
  `AbonnementDéjàEnCoursError` 409), `subscriptions.service.ts` (+ `changerFormule`,
  gardes `assertPasDéjàAbonné`/`résilierRemplacé`, `réconcilier` étendu au swap +
  fallback mandat réutilisé), `subscriptions.controller.ts`
  (+ `POST /me/subscription/changer-formule`).
- **App** : `subscription/subscription-api.ts` (+ `changerFormule`),
  `subscription/upgrade-flow.ts` (+ prédicat pur `peutPasserPro`),
  `subscription/use-subscription.ts` (+ `usePasserPro`, réutilise `lancerUpgrade`),
  `subscription/index.ts` (exports), `app/(tabs)/profil.tsx` (CTA « Passer à Pro » +
  message *pending* conscient de l'upgrade). Aucun DTO neuf : réutilise `CheckoutSortie`
  de `shared` (Zod au bord).

**Tests ajoutés/modifiés.**
- **e2e** `api/test/db/subscription.spec.ts` (**+7**, 12→19) : mandat réutilisé +
  premium résilié + **un seul abonnement actif** + webhook autorité ; paiement pro
  **pending** (SEPA) → **accès premium conservé** (jamais gratuit) ; **garde** gratuit
  **403** ; **garde** déjà-pro **403** ; **anti-doublon** premium→checkout **409** ;
  **croisement** résiliation-programmée × upgrade cohérent ; **401** sans jeton.
  (+ journaux `abonnementsCréés`/`abonnementsAnnulés` du fake pour prouver mandat/
  résiliation.)
- **unit app** `subscription-api.test.ts` (**+1** : `changerFormule` → POST) ;
  `upgrade-flow.test.ts` (**+3** : `peutPasserPro` — premium vrai / gratuit·pro·null
  faux / pending faux → **rendu conditionnel du CTA**).
- **Preuve live** (mode fake) : parcours premium → `changer-formule` → *pending*
  (tier premium conservé) → webhook pro → tier pro ; en base, premium `annulé` + pro
  `actif` **partageant le même mandat/customer**, un seul `actif` ; checkout d'un
  déjà-abonné → **409**.

**Régressions vérifiées.** Souscriptions **neuves 4.2 intactes** : le chemin
`créerCheckout`/`réconcilier` neuf est inchangé (branche `remplace_abonnement_id`
nulle ignorée) ; les 12 e2e d'origine restent verts. `pnpm lint` ✓, `pnpm typecheck`
✓, `pnpm test` ✓ (**shared 217 · api 55 · app 220**), `pnpm build` ✓,
`db:verify` **178/178** (subscription 19). Garde/quotas/matrice (4.1) et paywall
§6.8 **non refaits**.

**Écarts vs cadrage + docs mises à jour.**
- **Schéma ajouté** (`remplace_abonnement_id`, migration 0009) — anticipé par la
  mission ; **back-documenté** dans **Modèle §3** (tables techniques).
- **Spec §9.3** (changement de formule premium→pro depuis le Profil) et **UI/UX
  §5/§6.8** (CTA « Passer à Pro » ; distinction souscription neuve vs changement de
  formule) mises à jour dans le même lot.
- **Écart assumé** : durcissement de `créerCheckout` (refus 409 d'un compte déjà
  abonné). Au-delà du strict « ajouter un chemin », mais **nécessaire** pour tenir
  « jamais doublement facturé » (ferme le trou côté serveur). Les flux gratuit→X
  restent **à l'identique** (un gratuit n'a pas d'abonnement en cours).

**Points laissés ouverts.**
- **Downgrade pro→premium** : **hors périmètre** (asymétrie assumée : on n'ouvre que
  l'upgrade). Non construit.
- **Croisement résiliation-programmée × upgrade** : **traité** (premium reste `annulé`,
  pro `actif`, tier pro ; aucune double résiliation Mollie). Documenté et testé.
- **Paywall §6.8** : un premium y tapant « Pro » (chemin neuf) est **refusé** côté
  serveur (409) mais **non routé** vers le changement de formule — hors périmètre (le
  point d'entrée de cette mission est le **Profil**). À router si l'on veut une UX
  fluide depuis le paywall.
- **Validation Mollie réelle** du `sequenceType: recurring` sur mandat existant :
  couverte par `tsc` + fake ; un test contre l'API **test** Mollie reste hors sandbox
  (même posture que 4.2).
- **Alignement de période / proration** : intentionnellement **non calculé** (tarif
  plat mono-tier, Stack §6).
