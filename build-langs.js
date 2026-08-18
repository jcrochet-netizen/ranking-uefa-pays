#!/usr/bin/env node
/**
 * Génère les variantes traduites du widget à partir du master FR (index.html) :
 *   index-en.html · index-it.html · index-pt.html
 *
 * Seule l'INTERFACE est traduite ici. Les noms d'associations viennent de
 * `ranking.json`, qui les porte dans les quatre langues (champ `names`).
 *
 * Relancer après toute modification du master :  node build-langs.js
 */
const fs = require("fs");
const path = require("path");

const MASTER = path.join(__dirname, "index.html");
const master = fs.readFileSync(MASTER, "utf8");

const LANGS = {
  en: {
    locale: "en-GB",
    repl: [
      ['<html lang="fr">', '<html lang="en">'],
      ['<title>Classement UEFA par pays</title>', '<title>UEFA country coefficients</title>'],
      ["Classement UEFA des associations sur cinq saisons, calcule depuis les resultats des clubs en Ligue des champions, Ligue Europa et Ligue Conference.",
       "UEFA association coefficients over five seasons, computed from club results in the Champions League, Europa League and Conference League."],
      ['1<sup>er</sup>', '1<sup>st</sup>'],
      ["Saison en cours, recalculée en direct", "Current season, recalculated live"],
      ['label: "Association"', 'label: "Association"'],
      ['label: "Clubs"', 'label: "Clubs"'],
      ['`Total ${span}`', '`Total ${span}`'],
      ['title: "Clubs encore en lice sur clubs engagés"', 'title: "Clubs still in the competition out of clubs entered"'],
      ['"Trier de Z à A" : "Trier de A à Z"', '"Sort Z to A" : "Sort A to Z"'],
      ['"Trier du plus petit au plus grand" : "Trier du plus grand au plus petit"', '"Sort lowest first" : "Sort highest first"'],
      ["Aucun club engagé cette saison.", "No club entered this season."],
      ['? "encore qualifié"', '? "still in"'],
      ["` · bonus ${bonus}`", "` · bonus ${bonus}`"],
      ['<span class="tag out">éliminé</span>', '<span class="tag out">out</span>'],
      ['<span class="waiting">encore qualifié</span>', '<span class="waiting">still in</span>'],
      ["Aucune association ne correspond à cette recherche.", "No association matches this search."],
      ["<h3>Détail <span>", "<h3>Breakdown <span>"],
      ["<th>Club</th>", "<th>Club</th>"],
      ['<th class="c-matches">Matches</th>', '<th class="c-matches">Played</th>'],
      ['<th class="c-mpts">Pts matches</th>', '<th class="c-mpts">Match pts</th>'],
      ['<th class="c-bonus">Bonus</th>', '<th class="c-bonus">Bonus</th>'],
      ["<span>Total des points : <b>", "<span>Total points: <b>"],
      ["<span>Clubs engagés : <b>", "<span>Clubs entered: <b>"],
      ["<span>Coefficient ${FR(DATA.liveSeason)} : <b>", "<span>${FR(DATA.liveSeason)} coefficient: <b>"],
      ["`<b>Calcul :</b> 2 points par victoire et 1 par match nul (moitié en phase de qualification et en barrages d'été), ` +\n    `plus les bonus UEFA de classement en phase de ligue et de tour atteint à partir des huitièmes. ` +\n    `Le total est divisé par le nombre de clubs engagés, puis tronqué à trois décimales. ` +\n    `Les tirs au but ne rapportent aucun point, mais la qualification qu'ils procurent ouvre droit au bonus de tour.<br>`",
       "`<b>How it works:</b> 2 points per win and 1 per draw (halved in the qualifying rounds and summer play-offs), ` +\n    `plus the UEFA bonuses for league phase position and for each knockout round reached from the round of 16. ` +\n    `The total is divided by the number of clubs entered, then truncated to three decimals. ` +\n    `Penalty shoot-outs award no points, but the qualification they produce does earn the round bonus.<br>`"],
      ["`<b>Données :</b> SportMonks. Les quatre saisons closes reprennent les coefficients définitifs de l'UEFA ; ` +\n    `la saison ${FR(DATA.liveSeason)} est recalculée à chaque mise à jour. Cliquez sur une ligne pour le détail club par club. ` +\n    `Données arrêtées au ${stamp}.`",
       "`<b>Data:</b> SportMonks. The four completed seasons use UEFA's final coefficients; ` +\n    `the ${FR(DATA.liveSeason)} season is recalculated on every update. Click a row for the club-by-club breakdown. ` +\n    `Data as of ${stamp}.`"],
      ['" à " + d.toLocaleTimeString', '" at " + d.toLocaleTimeString'],
      ["Données indisponibles. Lancez <code>node fetch-data.js</code> pour générer ranking.json.",
       "Data unavailable. Run <code>node fetch-data.js</code> to generate ranking.json."],
    ],
  },
  it: {
    locale: "it-IT",
    repl: [
      ['<html lang="fr">', '<html lang="it">'],
      ['<title>Classement UEFA par pays</title>', '<title>Ranking UEFA per nazione</title>'],
      ["Classement UEFA des associations sur cinq saisons, calcule depuis les resultats des clubs en Ligue des champions, Ligue Europa et Ligue Conference.",
       "Ranking UEFA delle federazioni su cinque stagioni, calcolato dai risultati dei club in Champions League, Europa League e Conference League."],
      ['1<sup>er</sup>', '1<sup>a</sup>'],
      ["Saison en cours, recalculée en direct", "Stagione in corso, ricalcolata in tempo reale"],
      ['label: "Association"', 'label: "Federazione"'],
      ['label: "Clubs"', 'label: "Club"'],
      ['title: "Clubs encore en lice sur clubs engagés"', 'title: "Club ancora in corsa sui club iscritti"'],
      ['"Trier de Z à A" : "Trier de A à Z"', '"Ordina dalla Z alla A" : "Ordina dalla A alla Z"'],
      ['"Trier du plus petit au plus grand" : "Trier du plus grand au plus petit"', '"Ordina dal più piccolo al più grande" : "Ordina dal più grande al più piccolo"'],
      ["Aucun club engagé cette saison.", "Nessun club iscritto in questa stagione."],
      ['? "encore qualifié"', '? "ancora in corsa"'],
      ['<span class="tag out">éliminé</span>', '<span class="tag out">eliminato</span>'],
      ['<span class="waiting">encore qualifié</span>', '<span class="waiting">ancora in corsa</span>'],
      ["Aucune association ne correspond à cette recherche.", "Nessuna federazione corrisponde alla ricerca."],
      ["<h3>Détail <span>", "<h3>Dettaglio <span>"],
      ["`Total ${span}`", "`Totale ${span}`"],
      ["<th>Total</th>", "<th>Totale</th>"],
      ['<th class="c-matches">Matches</th>', '<th class="c-matches">Partite</th>'],
      ['<th class="c-mpts">Pts matches</th>', '<th class="c-mpts">Punti partite</th>'],
      ["<span>Total des points : <b>", "<span>Punti totali: <b>"],
      ["<span>Clubs engagés : <b>", "<span>Club iscritti: <b>"],
      ["<span>Coefficient ${FR(DATA.liveSeason)} : <b>", "<span>Coefficiente ${FR(DATA.liveSeason)}: <b>"],
      ["`<b>Calcul :</b> 2 points par victoire et 1 par match nul (moitié en phase de qualification et en barrages d'été), ` +\n    `plus les bonus UEFA de classement en phase de ligue et de tour atteint à partir des huitièmes. ` +\n    `Le total est divisé par le nombre de clubs engagés, puis tronqué à trois décimales. ` +\n    `Les tirs au but ne rapportent aucun point, mais la qualification qu'ils procurent ouvre droit au bonus de tour.<br>`",
       "`<b>Come si calcola:</b> 2 punti per vittoria e 1 per pareggio (dimezzati nei turni preliminari e negli spareggi estivi), ` +\n    `più i bonus UEFA per la posizione nella fase campionato e per ogni turno raggiunto dagli ottavi in poi. ` +\n    `Il totale è diviso per il numero di club iscritti, poi troncato a tre decimali. ` +\n    `I calci di rigore non assegnano punti, ma la qualificazione che producono dà diritto al bonus di turno.<br>`"],
      ["`<b>Données :</b> SportMonks. Les quatre saisons closes reprennent les coefficients définitifs de l'UEFA ; ` +\n    `la saison ${FR(DATA.liveSeason)} est recalculée à chaque mise à jour. Cliquez sur une ligne pour le détail club par club. ` +\n    `Données arrêtées au ${stamp}.`",
       "`<b>Dati:</b> SportMonks. Le quattro stagioni concluse riprendono i coefficienti definitivi UEFA; ` +\n    `la stagione ${FR(DATA.liveSeason)} è ricalcolata a ogni aggiornamento. Clicca su una riga per il dettaglio club per club. ` +\n    `Dati aggiornati al ${stamp}.`"],
      ['" à " + d.toLocaleTimeString', '" alle " + d.toLocaleTimeString'],
      ["Données indisponibles. Lancez <code>node fetch-data.js</code> pour générer ranking.json.",
       "Dati non disponibili. Esegui <code>node fetch-data.js</code> per generare ranking.json."],
    ],
  },
  pt: {
    locale: "pt-BR",
    repl: [
      ['<html lang="fr">', '<html lang="pt-BR">'],
      ['<title>Classement UEFA par pays</title>', '<title>Ranking da UEFA por país</title>'],
      ["Classement UEFA des associations sur cinq saisons, calcule depuis les resultats des clubs en Ligue des champions, Ligue Europa et Ligue Conference.",
       "Ranking da UEFA por federação em cinco temporadas, calculado a partir dos resultados dos clubes na Champions League, Europa League e Conference League."],
      ['1<sup>er</sup>', '1<sup>o</sup>'],
      ["Saison en cours, recalculée en direct", "Temporada em curso, recalculada ao vivo"],
      ['label: "Association"', 'label: "Federação"'],
      ['label: "Clubs"', 'label: "Clubes"'],
      ['title: "Clubs encore en lice sur clubs engagés"', 'title: "Clubes ainda na disputa sobre clubes inscritos"'],
      ['"Trier de Z à A" : "Trier de A à Z"', '"Ordenar de Z a A" : "Ordenar de A a Z"'],
      ['"Trier du plus petit au plus grand" : "Trier du plus grand au plus petit"', '"Ordenar do menor para o maior" : "Ordenar do maior para o menor"'],
      ["Aucun club engagé cette saison.", "Nenhum clube inscrito nesta temporada."],
      ['? "encore qualifié"', '? "ainda na disputa"'],
      ['<span class="tag out">éliminé</span>', '<span class="tag out">eliminado</span>'],
      ['<span class="waiting">encore qualifié</span>', '<span class="waiting">ainda na disputa</span>'],
      ["Aucune association ne correspond à cette recherche.", "Nenhuma federação corresponde a esta busca."],
      ["<h3>Détail <span>", "<h3>Detalhe <span>"],
      ["<th>Club</th>", "<th>Clube</th>"],
      ['<th class="c-matches">Matches</th>', '<th class="c-matches">Jogos</th>'],
      ['<th class="c-mpts">Pts matches</th>', '<th class="c-mpts">Pts de jogo</th>'],
      ["<span>Total des points : <b>", "<span>Total de pontos: <b>"],
      ["<span>Clubs engagés : <b>", "<span>Clubes inscritos: <b>"],
      ["<span>Coefficient ${FR(DATA.liveSeason)} : <b>", "<span>Coeficiente ${FR(DATA.liveSeason)}: <b>"],
      ["`<b>Calcul :</b> 2 points par victoire et 1 par match nul (moitié en phase de qualification et en barrages d'été), ` +\n    `plus les bonus UEFA de classement en phase de ligue et de tour atteint à partir des huitièmes. ` +\n    `Le total est divisé par le nombre de clubs engagés, puis tronqué à trois décimales. ` +\n    `Les tirs au but ne rapportent aucun point, mais la qualification qu'ils procurent ouvre droit au bonus de tour.<br>`",
       "`<b>Como é calculado:</b> 2 pontos por vitória e 1 por empate (metade nas fases de qualificação e nos playoffs de verão), ` +\n    `mais os bônus da UEFA pela posição na fase de liga e por cada fase alcançada a partir das oitavas. ` +\n    `O total é dividido pelo número de clubes inscritos e truncado em três casas decimais. ` +\n    `Os pênaltis não dão pontos, mas a classificação que eles garantem dá direito ao bônus de fase.<br>`"],
      ["`<b>Données :</b> SportMonks. Les quatre saisons closes reprennent les coefficients définitifs de l'UEFA ; ` +\n    `la saison ${FR(DATA.liveSeason)} est recalculée à chaque mise à jour. Cliquez sur une ligne pour le détail club par club. ` +\n    `Données arrêtées au ${stamp}.`",
       "`<b>Dados:</b> SportMonks. As quatro temporadas encerradas usam os coeficientes definitivos da UEFA; ` +\n    `a temporada ${FR(DATA.liveSeason)} é recalculada a cada atualização. Clique em uma linha para o detalhe clube a clube. ` +\n    `Dados atualizados em ${stamp}.`"],
      ['" à " + d.toLocaleTimeString', '" às " + d.toLocaleTimeString'],
      ["Données indisponibles. Lancez <code>node fetch-data.js</code> pour générer ranking.json.",
       "Dados indisponíveis. Execute <code>node fetch-data.js</code> para gerar ranking.json."],
    ],
  },
};

let failures = 0;
for (const [lang, cfg] of Object.entries(LANGS)) {
  let out = master;
  out = out.replace('const LANG = "fr";', `const LANG = "${lang}";`);
  out = out.replace('const LOCALE = "fr-FR";', `const LOCALE = "${cfg.locale}";`);
  for (const [from, to] of cfg.repl) {
    if (!out.includes(from)) {
      console.warn(`⚠ ${lang} : motif absent du master → ${from.slice(0, 70)}…`);
      failures++;
      continue;
    }
    out = out.split(from).join(to);
  }
  const file = path.join(__dirname, `index-${lang}.html`);
  fs.writeFileSync(file, out);
  console.log(`✓ index-${lang}.html`);
}
if (failures) {
  console.error(`\n✗ ${failures} motif(s) introuvable(s) : le master a changé, mettre à jour build-langs.js.`);
  process.exit(1);
}
console.log("\nLes noms d'associations viennent de ranking.json (champ `names`).");
