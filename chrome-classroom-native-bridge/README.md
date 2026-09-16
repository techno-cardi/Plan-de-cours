# Pont natif Classroom v1.2.3

Ce module Chrome accompagne le userscript `classroom-rich-publish.user.js` v1.4.1. Il conserve l’onglet Classroom ouvert après une réussite ou une erreur, publie les plans riches depuis le Générateur de plan de cours ou Agenda, et permet toujours de remplacer le texte d’une annonce existante depuis le générateur.

Il remplace les anciens appels internes de Classroom. Lors d’une publication, il ouvre le cours exact, utilise l’éditeur officiel, déclenche un vrai collage clavier depuis le HTML placé dans le presse-papier par Tampermonkey, vérifie le contenu, puis clique sur le bouton Publier natif.

## Intégration Agenda

Le pont accepte Agenda avec ou sans barre oblique finale :

- `https://techno-cardi.github.io/Portail-Cardinal-Roy/agendakevin`
- `https://techno-cardi.github.io/Portail-Cardinal-Roy/agendakevin/`

Quand le Générateur de plan de cours est ouvert et que la liste des cours Classroom est chargée, le userscript repère automatiquement les groupes 31, 32 et 51 et transmet leur correspondance au pont. Cette correspondance est conservée dans `chrome.storage.local`. Agenda peut ensuite publier directement vers le bon groupe sans redemander le cours.

Si Agenda indique qu’un groupe n’est pas lié, ouvrir simplement le Générateur de plan de cours, attendre que les cours Classroom soient chargés, puis revenir dans Agenda.

## Installation locale

1. Décompresser le dossier du pont dans un emplacement permanent. Éviter un dossier temporaire ou un emplacement qui sera supprimé.
2. Ouvrir `chrome://extensions`.
3. Activer le mode développeur.
4. Cliquer sur **Charger l’extension non empaquetée**.
5. Choisir le dossier `chrome-classroom-native-bridge`, celui qui contient directement `manifest.json`.
6. Conserver le userscript « Plan de cours - Publication riche Classroom » v1.4.1 activé dans Tampermonkey.

## Mise à jour d’une installation existante

Remplacer les fichiers dans le dossier réellement chargé par Chrome avec les fichiers de cette version, puis cliquer sur **Recharger** dans `chrome://extensions`.

Dans Tampermonkey, vérifier les mises à jour du userscript pour obtenir la version 1.4.1, puis actualiser le Générateur et Agenda.

Ouvrir ensuite une fois le Générateur de plan de cours et attendre que les cours Classroom soient chargés. Le pont enregistrera automatiquement les correspondances des groupes 31, 32 et 51.

La barre Chrome indiquant brièvement qu’une extension débogue l’onglet est normale : le pont se détache immédiatement après le collage et après le clic Publier.

## Chrome géré

Sur un navigateur géré par une organisation, une politique Chrome peut interdire ou retirer une extension locale. Si le pont disparaît de `chrome://extensions` après avoir été réinstallé puis après un redémarrage ou un rafraîchissement des politiques, vérifier `chrome://policy`, particulièrement les politiques liées aux extensions. Dans ce cas, le correctif durable doit être autorisé par l’administrateur Chrome.
