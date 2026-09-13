# Pont natif Classroom v1.1.1

Ce module Chrome accompagne le userscript `classroom-rich-publish.user.js` v1.3.0. Il conserve l’onglet Classroom ouvert après une réussite ou une erreur et permet de remplacer le texte d’une annonce existante avec le plan riche du formulaire. L’annonce est ciblée par son identifiant; son contenu est vérifié avant remplacement. Ses commentaires et pièces jointes restent attachés à la même annonce.

Il remplace définitivement les RPC internes de Classroom. Après un clic sur Groupe 31, Groupe 32 ou Groupe 51, il ouvre le cours exact, utilise l’éditeur officiel, déclenche un vrai collage clavier depuis le HTML placé dans le presse-papier par Tampermonkey, vérifie le gras, le soulignement et le contenu, puis clique sur le bouton Publier natif. Une publication n’est déclarée réussie qu’après sa présence dans le flux.

Protections intégrées :

- une seule tâche et un seul onglet peuvent réclamer la publication;
- une publication identique le même jour est détectée même si son numéro ou ses emojis ont changé;
- un nouveau cours avance le compteur; pour corriger une annonce, sélectionner « Publication à modifier » dans les options du cours;
- un verrou abandonné expire automatiquement après 90 secondes, disparaît immédiatement lors d’une mise à jour de l’extension et est remplacé dès qu’un nouvel essai confirme que l’ancien onglet ne répond plus;
- aucune RPC `n5NjMc` ou `F7Tqub` n’est utilisée;
- après une erreur, aucun second éditeur n’est ouvert automatiquement;
- le pont ne s’exécute que sur le générateur officiel et `classroom.google.com`.

## Installation locale

1. Ouvrir `chrome://extensions`.
2. Activer le mode développeur.
3. Cliquer sur **Charger l’extension non empaquetée**.
4. Choisir le dossier `chrome-classroom-native-bridge`.
5. Conserver le userscript « Plan de cours - Publication riche Classroom » v1.3.0 activé dans Tampermonkey.

## Mise à jour d’une installation existante

Remplacer les fichiers dans le dossier réellement chargé par Chrome avec ceux de l’archive v1.1.1, puis recharger l’extension dans `chrome://extensions`. Recharger une ancienne copie du dossier ne la met pas à jour. Le userscript reste en v1.3.0. Actualiser le générateur.

La modification utilise le contenu actuel du formulaire : réutiliser au besoin un cours enregistré, apporter les corrections, puis sélectionner l’annonce à remplacer. La sélection d’une annonce ne remplit pas automatiquement le formulaire.

La barre Chrome indiquant brièvement qu’une extension débogue l’onglet est normale : le pont se détache immédiatement après le vrai collage et après le clic Publier.
