# Cardinal - publication Classroom depuis ChatGPT

## Installer le module utilisable immédiatement

Lien d'installation Tampermonkey :

https://raw.githubusercontent.com/techno-cardi/Plan-de-cours/main/cardinal-chatgpt-classroom.user.js

Ce module est **distinct du userscript de publication existant** et ne remplace ni la correction Formative, ni la publication de l'Agenda. Son code est limité à ChatGPT et au relais Agenda.

## Mode d'emploi

1. Installer le nouveau userscript dans Tampermonkey, sans désactiver « Plan de cours - Publication riche Classroom » v1.4.1.
2. Ouvrir l'Agenda Cardinal une fois : il détecte les liaisons Classroom des groupes. Si besoin, ouvrir le Générateur de plan de cours pour rafraîchir les liaisons.
3. Actualiser ChatGPT. Une commande **Cardinal → Classroom** apparaît en bas à droite.
4. Cliquer sur la commande, puis vérifier le dernier bloc de rédaction trouvé. Pour utiliser une autre partie de la réponse, sélectionner d'abord le texte voulu.
5. Modifier au besoin le titre et le message, puis **Copier HTML** ou choisir le groupe et **Publier dans Classroom**.
6. La publication ouvre l'Agenda comme relais. Le pont natif déjà en place colle le HTML dans l'éditeur de Classroom et vérifie le résultat. Aucun cours non lié n'est créé automatiquement.

## Espacement

Les textes envoyés par le module placent des sauts explicites `<br><br>` entre les paragraphes. Contrairement à la simple succession de `<p>`, ces sauts survivent au nettoyeur HTML du userscript principal. Leur rendu final dans Google Classroom doit être contrôlé lors d'une publication réelle.

## Sécurité

- Pas de lecture des messages en arrière-plan. L'utilisateur déclenche la récupération et peut modifier le contenu.
- Pas de publication automatique sans confirmation du groupe choisi.
- Aucune permission générique `<all_urls>`.
- Le relais temporaire vers Agenda est conservé pendant au maximum cinq minutes dans le stockage privé Tampermonkey.
- Les résultats de publication réutilisent les signaux du pont déjà installé.

## Cardinal AIO

L'intégration du même compositeur au popup de Cardinal AIO est préparée dans `techno-cardi/Cardinal-AIO/Cardinal/AIO/classroom-composer.js`, et branchée au constructeur prudent de l'AIO. Elle n'est **pas installée sur le navigateur** sans nouveau ZIP AIO validé. Le constructeur de cette branche exige toujours la baseline originale autorisée, qui manque aux sources persistantes du dépôt; ne pas utiliser une reconstruction expérimentale comme remplacement.

## Vérifications

- `node tests/cardinal-chatgpt-classroom.test.cjs`
- `node --check cardinal-chatgpt-classroom.user.js`
- Tests CI `Fiabilite du collage Classroom`
