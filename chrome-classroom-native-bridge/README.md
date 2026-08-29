# Pont natif Classroom v1.0.4

Ce module Chrome accompagne le userscript `classroom-rich-publish.user.js` à partir de la version 1.2.2. La v1.0.4 tente d’abord la publication dans un onglet d’arrière-plan. Si Classroom suspend son interface, le pont active temporairement cet onglet, termine le flux, revient au générateur et ferme automatiquement l’onglet technique. L’accusé de réception et le résultat vérifié passent aussi par le DOM afin de rester fiables malgré l’isolation de Tampermonkey.

Il remplace définitivement les RPC internes de Classroom. Après un clic sur Groupe 31, Groupe 32 ou Groupe 51, il ouvre le cours exact, utilise l’éditeur officiel, déclenche un vrai collage clavier depuis le HTML placé dans le presse-papier par Tampermonkey, vérifie le gras, le soulignement et le contenu, puis clique sur le bouton Publier natif. Une publication n’est déclarée réussie qu’après sa présence dans le flux.

Protections intégrées :

- une seule tâche et un seul onglet peuvent réclamer la publication;
- un plan déjà visible dans le cours est refusé avant l’ouverture de l’éditeur;
- aucune RPC `n5NjMc` ou `F7Tqub` n’est utilisée;
- après une erreur, aucun second éditeur n’est ouvert automatiquement;
- le pont ne s’exécute que sur le générateur officiel et `classroom.google.com`.

## Installation locale

1. Ouvrir `chrome://extensions`.
2. Activer le mode développeur.
3. Cliquer sur **Charger l’extension non empaquetée**.
4. Choisir le dossier `chrome-classroom-native-bridge`.
5. Conserver le userscript « Plan de cours - Publication riche Classroom » v1.2.2 activé dans Tampermonkey.

La barre Chrome indiquant brièvement qu’une extension débogue l’onglet est normale : le pont se détache immédiatement après le vrai collage et après le clic Publier.
