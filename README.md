# Classement UEFA par pays

Widget de classement des associations UEFA, calculé à partir des résultats de
leurs clubs en Ligue des champions, Ligue Europa et Ligue Conference.

Équivalent de [la page officielle UEFA](https://fr.uefa.com/nationalassociations/uefarankings/country/?year=2027),
avec le détail club par club de la saison en cours accessible au clic.

```bash
node fetch-data.js      # régénère ranking.json depuis SportMonks
node serve.js           # http://localhost:8777
```

## Fichiers

| Fichier | Rôle |
|---|---|
| `fetch-data.js` | Récupère les données SportMonks, applique le barème UEFA, écrit `ranking.json` |
| `index.html` | Le widget. Lit `ranking.json` côté client — le token n'est jamais exposé |
| `ranking.json` | Sortie : 55 associations, 5 saisons, détail club par club de la saison en cours |
| `associations.json` | Les 55 associations : code UEFA, nom français, drapeau, `country_id` SportMonks |
| `history.json` | Coefficients UEFA définitifs des quatre saisons closes |
| `entrants-current.json` | Clubs entrant directement en phase de ligue, en attente du tirage |
| `embed-wordpress.html` | Bloc d'integration a coller dans un article WordPress |
| `serve.js` | Serveur statique local |

## Méthodologie

Reprend le règlement UEFA en vigueur depuis 2024/25.

**Points de match**

| | Phase de ligue et tours à élimination directe | Qualifications et barrages d'été |
|---|---|---|
| Victoire | 2 | 1 |
| Match nul | 1 | 0,5 |
| Défaite | 0 | 0 |

Les barrages d'accession aux huitièmes (février) appartiennent à la phase à
élimination directe : ils comptent donc à taux plein. Seuls les tours d'été
(préliminaires, Q1 à Q3, barrages d'août) sont à demi-points.

**Bonus de classement en phase de ligue** — selon la position finale de 1 à 36 :
de 12,000 à 6,000 en C1, de 6,000 à 0 en C3, de 4,000 à 0 en C4
(voir `posBonus()` dans `fetch-data.js`).

Tant que la phase de ligue n'est pas terminée, le classement final n'existe pas
encore : seul le minimum garanti est crédité, soit 6,000 en C1 et 0 ailleurs.
C'est le comportement de l'UEFA en cours de saison.

**Bonus de tour atteint** — pour chacun des huitièmes, quarts, demies et
finale : +1,5 en C1, +1 en C3, +0,5 en C4. Un finaliste de C1 cumule donc 6
points de bonus de tour.

**Coefficient** = total des points de l'association ÷ nombre de clubs engagés,
**tronqué** à trois décimales (et non arrondi). Le total sur cinq ans est la
somme des cinq coefficients tronqués.

**Tirs au but** — ils ne rapportent aucun point : le résultat retenu est celui
de la fin de la prolongation. En revanche, la qualification obtenue aux tirs au
but ouvre bien droit au bonus de tour.

**Colonne Clubs** — clubs encore en lice sur clubs engagés, comme la colonne
« Teams » de l'UEFA. Un club compte comme présent jusqu'à son élimination
effective : perdre un tour de qualification de C1 ou de C3 ne l'élimine pas,
il est reversé dans la compétition inférieure. Seules éliminent une défaite en
qualification de C4, une défaite en phase à élimination directe, ou une place
de 25<sup>e</sup> à 36<sup>e</sup> en phase de ligue. Les 55 valeurs
correspondent à celles publiées par l'UEFA.

## Architecture des données

Les quatre saisons closes sont lues dans `history.json` — coefficients UEFA
définitifs, ils ne bougeront plus. Seule la saison en cours est recalculée
depuis SportMonks à chaque exécution.

Ce choix est délibéré. `node fetch-data.js --verify` recalcule les saisons
closes et compare : le moteur retrouve **48/54** associations au coefficient
exact sur 2024/25 et **51/54** sur 2025/26. Les écarts résiduels ne viennent
pas du barème mais de la source :

- quelques scores SportMonks divergents du procès-verbal UEFA (un match
  compté nul au lieu de gagné décale le coefficient de 0,5 ÷ nb de clubs) ;
- un club engagé mais n'ayant jamais joué : Drogheda United compte au
  dénominateur irlandais 2025/26 côté UEFA alors qu'il n'a aucun match dans
  l'API.

Figer les saisons closes garantit un affichage identique à l'UEFA, ligne à
ligne. Sur la saison en cours, la vérification donne **55/55** exactes
(coefficient de la saison et total sur cinq ans).

Les saisons antérieures à 2024/25 relevaient d'un barème de bonus différent
(phase de groupes à quatre) : `--verify` les signale comme non comparables.

## Détails d'implémentation

**Compétitions SportMonks** — `2` Champions League, `5` Europa League,
`2286` Europa Conference League. La couverture des tours préliminaires est
complète : Q1 à Q3 et barrages présents pour les trois compétitions, ainsi que
le tour préliminaire à quatre clubs des saisons où il existait (2022/23,
2023/24, supprimé depuis).

**Endpoint** — `GET /v3/football/schedules/seasons/{id}` renvoie en un appel
tous les tours, doubles confrontations, matchs, participants et scores.
Compter environ 15 appels par exécution complète, pour un quota de 3000/heure.

**Score retenu** — champ `CURRENT` (`type_id` 1525), c'est-à-dire le score
final prolongation incluse et tirs au but exclus. Les champs `result_info` et
`participants[].meta.winner` décrivent la double confrontation et non le match :
ils ne sont pas utilisés.

**États de match considérés comme joués** — `5` temps réglementaire, `7`
prolongation, `8` tirs au but, `17` match donné sur tapis vert. Oublier le `17`
fait perdre des clubs entiers : Dnipro-1, forfait deux fois contre Puskás en
2024/25, disparaissait du dénominateur ukrainien.

**Libellés de tours** — instables d'une saison à l'autre
(« Qualification Round 1 » / « 1st Qualifying Round », « League Stage » /
« Group Stage », « 8th Finals » / « Round of 16 »). La normalisation passe par
`canonRound()` et les `type_id` de stage : `225` qualifications, `223` phase de
ligue, `224` élimination directe.

**Tableau `aggregates`** — parfois incomplet (49 objets pour 50 doubles
confrontations en C4 Q2 2025/26). Les matchs, eux, sont tous présents : le
calcul part des fixtures, jamais des agrégats.

**Attribution des pays** — deux correctifs sont nécessaires. SportMonks classe
Monaco dans son propre pays alors que l'UEFA le compte pour la France ; Derry
City est basé en Irlande du Nord mais représente la République d'Irlande.

**Avant le tirage de la phase de ligue** — SportMonks n'expose pas encore les
clubs qui entrent directement à ce stade, alors que l'UEFA les compte déjà au
dénominateur. `entrants-current.json` les fournit en attendant ; le fichier est
ignoré automatiquement, compétition par compétition, dès que le tirage apparaît
dans l'API. À rafraîchir une fois par an, en juillet.

## Intégration WordPress

Le bloc prêt à coller se trouve dans [`embed-wordpress.html`](embed-wordpress.html) :
un bloc « HTML personnalisé » suffit, sans plugin ni dépendance.

Ce qui est prévu pour le référencement :

- La page embarquée porte `noindex, follow`. Sans cela l'URL nue du widget
  entrerait en concurrence avec l'article qui l'affiche, pour le même contenu.
- Le titre, le chapô et la légende sont du vrai HTML **hors** de l'iframe.
  Ce qui se trouve dans une iframe n'est pas attribué à la page hôte : sans ce
  texte, l'article n'aurait rien à faire indexer.
- L'iframe porte un `title` explicite (accessibilité et lecteurs d'écran),
  `loading="lazy"`, et une hauteur initiale qui réserve la place du tableau
  pour éviter que le contenu suivant ne saute au chargement.
- Un repli `<noscript>` renvoie vers la page du widget.

Le widget mesure sa propre hauteur et l'envoie à la page hôte par `postMessage` ;
le script fourni ajuste le cadre. Sans cela le tableau serait tronqué ou
enfermé dans une seconde barre de défilement. La page hôte ne retient que les
messages provenant de l'origine du widget.

Deux paramètres d'URL :

| Paramètre | Effet |
|---|---|
| `?theme=light` | force l'apparence claire |
| `?theme=dark` | force l'apparence sombre |
| *(aucun)* | suit les préférences d'affichage du visiteur |

## Passage à la saison suivante

Dans `fetch-data.js`, incrémenter `RANKING_YEAR`. Les identifiants de saison
SportMonks sont résolus dynamiquement par nom, il n'y a rien d'autre à changer.
Puis reporter dans `history.json` le coefficient définitif de la saison qui
vient de se clore, et regénérer `entrants-current.json`.
