#!/usr/bin/env node
/* ══════════════════════════════════════
   SERVEUR LOCAL DE LA BORNE DE PRIX — DSM Librairie
   Tourne sur la borne Windows. Deux rôles :
     1. servir l'application web exportée (dist/)
     2. relayer les appels /web/... vers le serveur Odoo
   Le navigateur ne voit donc qu'une seule origine (http://localhost:8080) :
   pas de blocage CORS, et le cookie de session Odoo est accepté.
   Aucune dépendance : Node.js seul suffit.

   Usage :  node serveur-borne.js
   Réglages : variables d'environnement (voir demarrer-borne.bat)
     ODOO_CIBLE   serveur Odoo        (défaut http://94.130.90.253:9069)
     PORT         port local d'écoute (défaut 8080)
     RACINE       dossier de l'export web (défaut ../dist)
══════════════════════════════════════ */

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const ODOO_CIBLE = process.env.ODOO_CIBLE || "http://94.130.90.253:9069";
const PORT = Number(process.env.PORT || 8080);
const RACINE = path.resolve(process.env.RACINE || path.join(__dirname, "..", "dist"));

/* Chemins relayés vers Odoo */
const PREFIXES_ODOO = ["/web/", "/jsonrpc", "/longpolling/", "/websocket", "/mail/"];

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json; charset=utf-8",
};

const cible = new URL(ODOO_CIBLE);
const transport = cible.protocol === "https:" ? https : http;

function journal(...args) {
  console.log(new Date().toLocaleString("fr-FR"), ...args);
}

/* ── Relais vers Odoo ── */
function relayer(req, res) {
  const options = {
    protocol: cible.protocol,
    hostname: cible.hostname,
    port: cible.port || (cible.protocol === "https:" ? 443 : 80),
    method: req.method,
    path: req.url,
    headers: { ...req.headers, host: cible.host },
  };

  const amont = transport.request(options, reponse => {
    res.writeHead(reponse.statusCode || 502, reponse.headers);
    reponse.pipe(res);
  });

  amont.on("error", err => {
    journal("Odoo injoignable :", err.message);
    res.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: { message: "Serveur Odoo injoignable" } }));
  });

  req.pipe(amont);
}

/* ── Fichiers de l'application ── */
function servirFichier(res, fichier, code = 200) {
  fs.readFile(fichier, (err, contenu) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Fichier introuvable");
      return;
    }
    res.writeHead(code, {
      "Content-Type": TYPES[path.extname(fichier).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    res.end(contenu);
  });
}

function servirApplication(req, res) {
  const chemin = decodeURIComponent(new URL(req.url, "http://localhost").pathname);

  /* La borne démarre directement sur l'écran de prix */
  if (chemin === "/" || chemin === "/borne" || chemin === "/borne/") {
    return servirFichier(res, path.join(RACINE, "borne.html"));
  }

  const fichier = path.join(RACINE, chemin);
  /* Refus de toute sortie du dossier servi */
  if (!fichier.startsWith(RACINE)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Accès refusé");
    return;
  }

  fs.stat(fichier, (err, infos) => {
    if (!err && infos.isFile()) return servirFichier(res, fichier);
    /* Route inconnue : on retombe sur l'écran de la borne */
    servirFichier(res, path.join(RACINE, "borne.html"));
  });
}

const serveur = http.createServer((req, res) => {
  if (PREFIXES_ODOO.some(p => req.url.startsWith(p))) return relayer(req, res);
  servirApplication(req, res);
});

serveur.listen(PORT, "127.0.0.1", () => {
  journal(`Borne de prix : http://localhost:${PORT}/borne`);
  journal(`Application   : ${RACINE}`);
  journal(`Odoo relayé   : ${ODOO_CIBLE}`);
  if (!fs.existsSync(path.join(RACINE, "borne.html"))) {
    journal("ATTENTION : borne.html est absent. Lancez d'abord :");
    journal("  npx expo export --platform web --output-dir dist");
  }
});
