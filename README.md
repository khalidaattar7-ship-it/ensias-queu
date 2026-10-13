# ENSIAS Founders — file d'attente des stands

Projet **séparé** du site d'inscription : autre repo, autre projet Supabase, autre projet Vercel.

- `/c/[cellule]` — étudiant : prendre un numéro, voir le numéro appelé et sa position (rafraîchi toutes les 4 s).
- `/c/[cellule]/responsable` — responsable : PIN à 4 chiffres, « Appeler le suivant », remise à zéro.
- `/qr` — un QR par cellule, à imprimer (Ctrl+P).

## Mise en place
1. Supabase (projet dédié) → SQL Editor : exécuter `supabase/schema.sql`, puis `supabase/pins.local.sql` (non versionné).
2. Variables d'environnement (Vercel et `.env.local`) : voir `.env.example`.
3. Changer un PIN : relancer la ligne correspondante de `pins.local.sql` avec un nouveau PIN.
