import { Game } from "./Game.js";

const game = new Game();
game.start().catch((err) => {
  console.error("[SamuraiJam] Failed to start:", err);
  document.body.innerHTML = `<div style="color:white;padding:40px;font-family:sans-serif;">
    <h1>Erreur de connexion</h1>
    <p>Impossible de se connecter au serveur. Verifie que le serveur est lance avec <code>npm run server</code>.</p>
    <p style="color:#888">${err.message}</p>
  </div>`;
});
