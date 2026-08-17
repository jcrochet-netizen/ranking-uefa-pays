#!/usr/bin/env node
/**
 * Ranking UEFA par pays — générateur de données.
 * ---------------------------------------------------------------------------
 * Source : API SportMonks (même token que les autres widgets du réseau).
 *
 * Calcule le coefficient par association selon la méthodologie UEFA en vigueur
 * (règlement 2024/25 et suivants) :
 *
 *   • match gagné      2 pts   (1 pt en phase de qualification / barrages d'été)
 *   • match nul        1 pt    (0,5 pt en phase de qualification / barrages d'été)
 *   • défaite          0 pt
 *   • bonus de position finale en phase de ligue (barème UEFA, cf. POS_BONUS)
 *   • bonus de tour atteint (8es, quarts, demies, finale) :
 *       +1,5 par tour en C1, +1 en C3 (Europa), +0,5 en C4 (Conference)
 *   • coefficient = total des points / nombre de clubs engagés de l'association,
 *     tronqué à 3 décimales (et non arrondi — c'est la règle UEFA).
 *
 * Les tirs au but ne rapportent aucun point : le score retenu est celui de la
 * fin de la prolongation (champ `CURRENT` de SportMonks). En revanche, une
 * qualification obtenue aux tirs au but ouvre bien droit au bonus de tour.
 *
 * Les quatre saisons closes sont lues dans `history.json` (valeurs UEFA
 * définitives, elles ne bougeront plus). Seule la saison en cours est
 * recalculée depuis SportMonks à chaque exécution.
 *
 *   node fetch-data.js            → écrit ranking.json
 *   node fetch-data.js --verify   → recalcule aussi les saisons closes et
 *                                   affiche l'écart avec history.json
 */

const fs = require("fs");
const path = require("path");

function loadDotEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadDotEnv();

const API_TOKEN = process.env.SPORTMONKS_API_TOKEN;
if (!API_TOKEN) {
  console.error("✗ SPORTMONKS_API_TOKEN manquant (voir .env.example).");
  process.exit(1);
}

const BASE = "https://api.sportmonks.com/v3";
const VERIFY = process.argv.includes("--verify");

/* ── Compétitions et fenêtre de classement ──────────────────────────────── */

const LEAGUES = { UCL: 2, UEL: 5, UECL: 2286 };

// Le classement « année N » agrège les 5 saisons se terminant en N.
// Ex. classement 2027 = 2022/23 → 2026/27, il fixe les quotas de 2028/29.
const RANKING_YEAR = 2027;
const SEASON_LABELS = Array.from({ length: 5 }, (_, i) => {
  const end = RANKING_YEAR - 4 + i;
  return `${end - 1}/${String(end).slice(2)}`;
});
const LIVE_SEASON = SEASON_LABELS[SEASON_LABELS.length - 1];

/* ── Barèmes UEFA ───────────────────────────────────────────────────────── */

// Bonus selon le classement final de la phase de ligue (1 → 36).
function posBonus(comp, pos) {
  if (!pos) return 0;
  if (comp === "UCL") return pos <= 24 ? 12 - 0.25 * (pos - 1) : 6;
  if (comp === "UEL") return pos <= 24 ? 6 - 0.25 * (pos - 1) : 0;
  if (pos <= 9) return 4 - 0.25 * (pos - 1);
  if (pos <= 24) return 1.875 - 0.125 * (pos - 10);
  return 0;
}

// Plancher garanti dès la qualification pour la phase de ligue (= 36e place).
const POS_FLOOR = { UCL: 6, UEL: 0, UECL: 0 };

// Bonus par tour atteint parmi 8es / quarts / demies / finale.
const ROUND_BONUS = { UCL: 1.5, UEL: 1, UECL: 0.5 };
const BONUS_ROUNDS = ["R16", "QF", "SF", "F"];

/* ── Correctifs d'attribution ───────────────────────────────────────────── */

// SportMonks classe Monaco dans son propre pays ; l'UEFA le compte pour la France.
const COUNTRY_PATCH = { 75285: 17 };
// Derry City est basé en Irlande du Nord mais représente la République d'Irlande.
const TEAM_PATCH = { 1097: 455 };

// Matchs terminés : 5 = temps réglementaire, 7 = prolongation,
// 8 = tirs au but, 17 = match donné sur tapis vert (forfait).
const FINISHED = new Set([5, 7, 8, 17]);
const SCORE_CURRENT = 1525; // score final, prolongation incluse, tirs au but exclus
const SCORE_PENALTIES = 5; // séance de tirs au but, sert à départager une confrontation

/* ── Accès API ──────────────────────────────────────────────────────────── */

async function api(pathname, params = {}) {
  const url = new URL(BASE + pathname);
  url.searchParams.set("api_token", API_TOKEN);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} sur ${pathname}`);
  const json = await res.json();
  if (json.message && !json.data) throw new Error(`${json.message} sur ${pathname}`);
  return json;
}

/* ── Utilitaires de lecture du payload `schedules` ──────────────────────── */

// Les matchs sont dispersés entre `fixtures`, `aggregates[].fixtures`,
// `rounds[].fixtures` et `groups[].fixtures` selon le format du tour.
function fixturesOf(stage) {
  const seen = new Map();
  const push = (arr) => (arr || []).forEach((f) => seen.set(f.id, f));
  push(stage.fixtures);
  (stage.aggregates || []).forEach((a) => push(a.fixtures));
  (stage.rounds || []).forEach((r) => {
    push(r.fixtures);
    (r.aggregates || []).forEach((a) => push(a.fixtures));
  });
  (stage.groups || []).forEach((g) => {
    push(g.fixtures);
    (g.aggregates || []).forEach((a) => push(a.fixtures));
  });
  return [...seen.values()];
}

// Les libellés de tours changent d'une saison à l'autre
// (« Qualification Round 1 » / « 1st Qualifying Round », « League Stage » /
// « Group Stage », « 8th Finals » / « Round of 16 »…) : on normalise.
function canonRound(stage) {
  const n = (stage.name || "").toLowerCase();
  if (n.includes("knockout") && n.includes("play")) return "KRPO";
  if (n.includes("round of 16") || n.includes("8th final")) return "R16";
  if (n.includes("quarter")) return "QF";
  if (n.includes("semi") && !n.includes("preliminary")) return "SF";
  if (n.trim() === "final") return "F";
  if (n.includes("preliminary") || n.includes("qualif")) return "QUAL";
  if (n.includes("play-off") || n.includes("playoff")) return "QUAL";
  if (stage.type_id === 223) return "LEAGUE";
  return "OTHER";
}

/* ── Résolution des doubles confrontations ──────────────────────────────
 * Nécessaire pour savoir qui est encore en lice. On regroupe les matchs d'un
 * même tour par paire d'adversaires : deux manches pour une double
 * confrontation, une seule pour un match sec. Le tableau `aggregates` de
 * SportMonks donnerait directement le vainqueur mais il est parfois incomplet
 * (49 objets pour 50 confrontations en C4 Q2 2025/26), on recalcule donc.
 */
function resolveTies(fixtures) {
  const groups = new Map();
  for (const f of fixtures) {
    const ids = (f.participants || []).map((p) => p.id).sort((a, b) => a - b);
    if (ids.length !== 2) continue;
    const key = ids.join("-");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(f);
  }

  const out = new Map(); // teamId → { outcome: "won"|"lost"|"pending", date }
  for (const [, legs] of groups) {
    const date = legs.map((f) => f.starting_at || "").sort().pop() || "";
    const mark = (id, outcome) => out.set(id, { outcome, date });
    if (legs.some((f) => !FINISHED.has(f.state_id))) {
      for (const p of legs[0].participants) mark(p.id, "pending");
      continue;
    }
    // Les scores sont indexés par « home »/« away » : on les convertit en
    // identifiants d'équipe manche par manche, sinon l'ordre des manches
    // inverse la séance de tirs au but.
    const agg = {};
    let shootout = null;
    let usable = true;
    for (const f of legs) {
      const cur = {};
      const pens = {};
      for (const s of f.scores || []) {
        if (s.type_id === SCORE_CURRENT) cur[s.score.participant] = s.score.goals;
        if (s.type_id === SCORE_PENALTIES) pens[s.score.participant] = s.score.goals;
      }
      if (cur.home === undefined || cur.away === undefined) { usable = false; break; }
      for (const p of f.participants) {
        const loc = p.meta.location;
        agg[p.id] = (agg[p.id] || 0) + cur[loc];
        if (pens[loc] !== undefined) (shootout ||= {})[p.id] = pens[loc];
      }
    }
    const ids = Object.keys(agg).map(Number);
    if (!usable || ids.length !== 2) {
      for (const p of legs[0].participants) mark(p.id, "pending");
      continue;
    }
    const [a, b] = ids;
    let winner = agg[a] > agg[b] ? a : agg[b] > agg[a] ? b : null;
    if (winner === null && shootout && shootout[a] !== undefined && shootout[b] !== undefined) {
      winner = shootout[a] > shootout[b] ? a : shootout[b] > shootout[a] ? b : null;
    }
    if (winner === null) {
      mark(a, "pending");
      mark(b, "pending");
    } else {
      mark(winner, "won");
      mark(winner === a ? b : a, "lost");
    }
  }
  return out;
}

function assocOf(participant) {
  if (TEAM_PATCH[participant.id]) return TEAM_PATCH[participant.id];
  const c = participant.country_id;
  return COUNTRY_PATCH[c] ?? c;
}

function truncate3(x) {
  return Math.floor(x * 1000 + 1e-9) / 1000;
}

/* ── Résolution des identifiants de saison ──────────────────────────────── */

async function resolveSeasons() {
  const out = {};
  for (const [comp, leagueId] of Object.entries(LEAGUES)) {
    const { data } = await api(`/football/leagues/${leagueId}`, { include: "seasons" });
    for (const label of SEASON_LABELS) {
      const end = label.split("/")[0];
      const full = `${end}/${Number(end) + 1}`;
      const s = (data.seasons || []).find((x) => x.name === full);
      if (s) (out[label] ||= {})[comp] = s.id;
    }
  }
  for (const label of SEASON_LABELS) {
    const got = Object.keys(out[label] || {});
    if (got.length !== 3) {
      console.warn(`⚠ ${label} : seules les compétitions ${got.join(", ") || "(aucune)"} ont été trouvées.`);
    }
  }
  return out;
}

/* ── Calcul d'une saison ────────────────────────────────────────────────── */

async function computeSeason(label, comps) {
  const clubs = new Map(); // teamId → fiche club
  const lastTie = new Map(); // teamId → dernière confrontation, toutes compétitions
  const club = (p, comp) => {
    if (!clubs.has(p.id)) {
      clubs.set(p.id, {
        id: p.id,
        name: p.name,
        logo: p.image_path || null,
        assoc: assocOf(p),
        pts: 0,
        played: 0,
        comps: new Set(),
        matchPts: 0,
        posBonus: 0,
        roundBonus: 0,
        fixtures: 0,
        pending: 0,
        alive: false,
      });
    }
    const c = clubs.get(p.id);
    if (comp) c.comps.add(comp);
    return c;
  };

  for (const [comp, seasonId] of Object.entries(comps)) {
    const [{ data: stages }, standings, seasonTeams] = await Promise.all([
      api(`/football/schedules/seasons/${seasonId}`),
      api(`/football/standings/seasons/${seasonId}`).catch(() => ({ data: [] })),
      api(`/football/teams/seasons/${seasonId}`, { per_page: 100 }).catch(() => ({ data: [] })),
    ]);

    // Engagés connus de la compétition, y compris ceux qui n'ont pas encore joué.
    for (const t of seasonTeams.data || []) club(t, comp);

    // Classement de la phase de ligue : une seule table de 36 depuis 2024/25,
    // huit groupes de quatre auparavant (on n'exploite alors pas la position).
    const rows = standings.data || [];
    const buckets = new Set(rows.map((r) => `${r.stage_id}|${r.group_id}`));
    const singleTable = buckets.size === 1 && rows.length === 36;
    const position = new Map(rows.map((r) => [r.participant_id, r.position]));

    const reached = new Map(); // teamId → Set de tours atteints
    let leagueStageFixtures = 0;
    let leagueStageFinished = 0;

    for (const stage of stages) {
      const round = canonRound(stage);
      const stageFixtures = fixturesOf(stage);
      if (round !== "LEAGUE") {
        // On retient, pour chaque club, sa confrontation la plus récente toutes
        // compétitions confondues : c'est elle qui dit s'il est encore en lice.
        for (const [teamId, res] of resolveTies(stageFixtures)) {
          const prev = lastTie.get(teamId);
          if (!prev || res.date > prev.date) lastTie.set(teamId, { ...res, comp, round });
        }
      }
      // Points pleins partout sauf en qualifications et barrages d'été.
      // Le barrage d'accession aux 8es (février) fait partie de la phase à
      // élimination directe : il compte donc à taux plein.
      const half = round === "QUAL";
      const win = half ? 1 : 2;
      const draw = half ? 0.5 : 1;

      for (const f of stageFixtures) {
        for (const p of f.participants || []) {
          const c = club(p, comp);
          if (!reached.has(p.id)) reached.set(p.id, new Set());
          reached.get(p.id).add(round);
          c.fixtures++;
          if (!FINISHED.has(f.state_id)) c.pending++;
        }
        if (round === "LEAGUE") {
          leagueStageFixtures++;
          if (FINISHED.has(f.state_id)) leagueStageFinished++;
        }
        if (!FINISHED.has(f.state_id)) continue;

        const goals = {};
        for (const s of f.scores || []) {
          if (s.type_id === SCORE_CURRENT) goals[s.score.participant] = s.score.goals;
        }
        if (goals.home === undefined || goals.away === undefined) continue;

        for (const p of f.participants || []) {
          const c = club(p, comp);
          const loc = p.meta.location;
          const mine = goals[loc];
          const theirs = goals[loc === "home" ? "away" : "home"];
          const add = mine > theirs ? win : mine === theirs ? draw : 0;
          c.pts += add;
          c.matchPts += add;
          c.played++;
        }
      }
    }

    const leagueDone = leagueStageFixtures > 0 && leagueStageFinished === leagueStageFixtures;

    for (const [teamId, rs] of reached) {
      const c = clubs.get(teamId);
      if (!c) continue;
      if (rs.has("LEAGUE")) {
        // Tant que la phase de ligue n'est pas terminée, le classement final
        // n'existe pas : l'UEFA ne crédite que le minimum garanti.
        const b = leagueDone && singleTable ? posBonus(comp, position.get(teamId)) : POS_FLOOR[comp];
        c.pts += b;
        c.posBonus += b;
      }
      for (const r of BONUS_ROUNDS) {
        if (rs.has(r)) {
          c.pts += ROUND_BONUS[comp];
          c.roundBonus += ROUND_BONUS[comp];
        }
      }
    }

    // Phase de ligue : tant qu'elle n'est pas terminée tout le monde est en
    // course ; ensuite, depuis 2024/25, les 25e à 36e sont éliminés sans
    // reversement.
    for (const [teamId, rs] of reached) {
      const c = clubs.get(teamId);
      if (!c || c.alive || !rs.has("LEAGUE")) continue;
      if (!leagueDone) c.alive = true;
      else if (singleTable && (position.get(teamId) ?? 99) <= 24) c.alive = true;
    }

    // Avant le tirage de la phase de ligue, SportMonks ignore les clubs qui
    // entrent directement à ce stade. On complète avec la liste de secours.
    if (!leagueStageFixtures) applySeed(label, comp, clubs);
  }

  for (const c of clubs.values()) {
    // Un club qui n'est pas encore entré en lice, ou qui a un match programmé,
    // ne peut pas être éliminé.
    if (c.fixtures === 0 || c.pending > 0) c.alive = true;
    if (c.alive) continue;

    const t = lastTie.get(c.id);
    if (!t) continue;
    if (t.outcome === "pending") c.alive = true;
    // Confrontation gagnée : le club a passé le tour. Gagner la finale clôt en
    // revanche son parcours.
    else if (t.outcome === "won" && t.round !== "F") c.alive = true;
    // Perdre un tour de qualification de C1 ou de C3 n'élimine pas : le club
    // est reversé dans la compétition inférieure. SportMonks ne publie ces
    // matchs de reversement qu'après le tirage, d'où ce rattrapage.
    else if (t.outcome === "lost" && t.round === "QUAL" && t.comp !== "UECL") c.alive = true;
  }

  return clubs;
}

function applySeed(label, comp, clubs) {
  const file = path.join(__dirname, "entrants-current.json");
  if (!fs.existsSync(file)) return;
  const seed = JSON.parse(fs.readFileSync(file, "utf8"));
  if (seed.season !== label) return;
  let added = 0;
  for (const e of seed.clubs) {
    if (e.comp !== comp || clubs.has(e.team)) continue;
    clubs.set(e.team, {
      id: e.team,
      name: e.name,
      logo: null,
      assoc: e.assoc,
      pts: POS_FLOOR[comp],
      played: 0,
      comps: new Set([comp]),
      matchPts: 0,
      posBonus: POS_FLOOR[comp],
      roundBonus: 0,
      fixtures: 0,
      pending: 0,
      alive: true,
      seeded: true,
    });
    added++;
  }
  if (added) console.log(`   ↳ ${comp} : ${added} clubs ajoutés depuis entrants-current.json (tirage non publié)`);
}

/* ── Agrégation par association ─────────────────────────────────────────── */

function aggregate(clubs) {
  const out = new Map();
  for (const c of clubs.values()) {
    if (!out.has(c.assoc)) out.set(c.assoc, { pts: 0, clubs: [] });
    const a = out.get(c.assoc);
    a.pts += c.pts;
    a.clubs.push(c);
  }
  for (const a of out.values()) a.coef = a.clubs.length ? truncate3(a.pts / a.clubs.length) : 0;
  return out;
}

/* ── Programme principal ────────────────────────────────────────────────── */

(async () => {
  const associations = JSON.parse(fs.readFileSync(path.join(__dirname, "associations.json"), "utf8"));
  const history = JSON.parse(fs.readFileSync(path.join(__dirname, "history.json"), "utf8"));
  const byCountryId = new Map(associations.filter((a) => a.countryId).map((a) => [a.countryId, a]));

  console.log(`Classement UEFA ${RANKING_YEAR} — saisons ${SEASON_LABELS.join(", ")}`);
  const seasons = await resolveSeasons();

  console.log(`\nSaison en cours (${LIVE_SEASON})…`);
  const liveClubs = await computeSeason(LIVE_SEASON, seasons[LIVE_SEASON]);
  const live = aggregate(liveClubs);
  console.log(`   ${liveClubs.size} clubs engagés, ${live.size} associations représentées`);

  if (VERIFY) {
    console.log("\n--verify : recalcul des saisons closes avec le barème actuel");
    for (const label of SEASON_LABELS.slice(0, -1)) {
      // Le barème de bonus a changé en 2024/25 (phase de ligue à 36 au lieu
      // de groupes de 4). Recalculer une saison antérieure avec le barème
      // actuel produit donc des écarts normaux, ce n'est pas un test valide.
      const legacy = Number(label.slice(0, 4)) < 2024;
      const agg = aggregate(await computeSeason(label, seasons[label]));
      let ok = 0;
      const diffs = [];
      for (const a of associations) {
        const ref = history.coefficients[a.code]?.[label];
        if (ref === undefined || !a.countryId) continue;
        const mine = agg.get(a.countryId)?.coef ?? 0;
        if (Math.abs(mine - ref) < 0.0005) ok++;
        else diffs.push(`${a.code} ${mine.toFixed(3)}≠${ref.toFixed(3)}`);
      }
      if (legacy) {
        console.log(`   ${label} : ${ok}/54 — barème de bonus antérieur, écarts attendus (non comparable)`);
      } else {
        console.log(`   ${label} : ${ok}/54 identiques${diffs.length ? " — écarts : " + diffs.join(", ") : ""}`);
      }
    }
  }

  // Assemblage des lignes du classement.
  const rows = associations.map((a) => {
    const coefs = {};
    for (const label of SEASON_LABELS.slice(0, -1)) coefs[label] = history.coefficients[a.code]?.[label] ?? 0;

    const l = a.countryId ? live.get(a.countryId) : null;
    coefs[LIVE_SEASON] = l ? l.coef : 0;

    const clubList = (l ? l.clubs : [])
      .map((c) => ({
        name: c.name,
        logo: c.logo,
        // Ordre de reversement : un club éliminé en C1 bascule en C3 puis en C4.
        comp: ["UCL", "UEL", "UECL"].filter((k) => c.comps.has(k)).join("+"),
        pts: Math.round(c.pts * 1000) / 1000,
        played: c.played,
        alive: c.alive,
        matchPts: Math.round(c.matchPts * 1000) / 1000,
        bonus: Math.round((c.posBonus + c.roundBonus) * 1000) / 1000,
      }))
      .sort((x, y) => y.pts - x.pts || y.played - x.played);

    return {
      code: a.code,
      name: a.name,
      iso: a.iso,
      flag: a.flag,
      coefs,
      total: truncate3(Object.values(coefs).reduce((s, v) => s + v, 0)),
      clubs: clubList.length,
      clubsAlive: clubList.filter((c) => c.alive).length,
      detail: clubList,
    };
  });

  rows.sort((a, b) => b.total - a.total || b.coefs[LIVE_SEASON] - a.coefs[LIVE_SEASON] || a.name.localeCompare(b.name, "fr"));
  rows.forEach((r, i) => (r.rank = i + 1));

  const payload = {
    updated: new Date().toISOString(),
    rankingYear: RANKING_YEAR,
    allocationSeason: `${RANKING_YEAR + 1}/${String(RANKING_YEAR + 2).slice(2)}`,
    seasons: SEASON_LABELS,
    liveSeason: LIVE_SEASON,
    closedSeasons: SEASON_LABELS.slice(0, -1),
    rows,
  };

  const outPath = path.join(__dirname, "ranking.json");
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 1));
  console.log(`\n✓ ranking.json écrit (${rows.length} associations)`);
  console.log("\nTop 10 :");
  for (const r of rows.slice(0, 10)) {
    console.log(
      `   ${String(r.rank).padStart(2)}. ${r.name.padEnd(20)} ${r.total.toFixed(3).padStart(8)}` +
        `   ${LIVE_SEASON} ${r.coefs[LIVE_SEASON].toFixed(3).padStart(6)}  (${r.clubsAlive}/${r.clubs} clubs en lice)`
    );
  }
})().catch((e) => {
  console.error("✗", e.message);
  process.exit(1);
});
