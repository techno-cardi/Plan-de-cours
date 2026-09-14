# Pont natif Classroom v1.2.0

Ce module Chrome accompagne le userscript `classroom-rich-publish.user.js` v1.4.0. Il conserve l’onglet Classroom ouvert après une réussite ou une erreur, publie les plans riches depuis le Générateur de plan de cours ou Agenda, et permet toujours de remplacer le texte d’une annonce existante depuis le générateur.

Il remplace définitivement les RPC internes de Classroom. Lors d’une publication, il ouvre le cours exact, utilise l’éditeur officiel, déclenche un vrai collage clavier depuis le HTML placé dans le presse-papier par Tampermonkey, vérifie le contenu, puis clique sur le bouton Publier natif. Une publication n’est déclarée réussie qu’après sa présence dans le flux.

## Intégration Agenda

Le pont accepte maintenant aussi `https://techno-cardi.github.io/Portail-Cardinal-Roy/agendakevin/`.

Quand le Générateur de plan de cours est ouvert et que la liste des cours Classroom est chargée, le userscript repère automatiquement les groupes 31, 32 et 51 et transmet leur correspondance au pont. Cette correspondance est conservée dans `chrome.storage.local`. Agenda peut ensuite publier directement vers le bon groupe sans redemander le cours.

Si Agenda indique qu’un groupe n’est pas lié, ouvrir simplement le Générateur de plan de cours, attendre que les cours Classroom soient chargés, puis revenir dans Agenda.

Protections intégrées :

- seules les pages officielles du Générateur et d’Agenda peuvent lancer une publication;
- une seule tâche et un seul onglet peuvent réclamer la publication;
- un verrou abandonné expire automatiquement après 90 secondes;
- aucune RPC privée de Classroom n’est utilisée;
- après une erreur, aucun second éditeur n’est ouvert automatiquement;
- le pont ne s’exécute que sur les pages autorisées de `techno-cardi.github.io` et `classroom.google.com`.

## Installation locale

1. Ouvrir `chrome://extensions`.
2. Activer le mode développeur.
3. Cliquer sur **Charger l’extension non empaquetée**.
4. Choisir le dossier `chrome-classroom-native-bridge`.
5. Conserver le userscript « Plan de cours - Publication riche Classroom » v1.4.0 activé dans Tampermonkey.

## Mise à jour d’une installation existante

Remplacer les fichiers dans le dossier réellement chargé par Chrome avec les fichiers v1.2.0 du dossier `chrome-classroom-native-bridge`, puis cliquer sur **Recharger** dans `chrome://extensions`.

Dans Tampermonkey, vérifier les mises à jour du userscript pour obtenir la version 1.4.0, puis actualiser le Générateur et Agenda.

Ouvrir ensuite une fois le Générateur de plan de cours et attendre que les cours Classroom soient chargés. Le pont enregistrera automatiquement les correspondances des groupes 31, 32 et 51.

La barre Chrome indiquant brièvement qu’une extension débogue l’onglet est normale : le pont se détache immédiatement après le vrai collage et après le clic Publier.
