"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameState = void 0;
var GameState;
(function (GameState) {
    GameState[GameState["JOIN"] = 0] = "JOIN";
    GameState[GameState["LOBBY"] = 1] = "LOBBY";
    GameState[GameState["ROUND_STARTING"] = 2] = "ROUND_STARTING";
    GameState[GameState["BRIEFING"] = 3] = "BRIEFING";
    GameState[GameState["PROMPTING"] = 4] = "PROMPTING";
    GameState[GameState["GENERATING"] = 5] = "GENERATING";
    GameState[GameState["SCORING"] = 6] = "SCORING";
    GameState[GameState["GALLERY"] = 7] = "GALLERY";
    GameState[GameState["REVEAL"] = 8] = "REVEAL";
    GameState[GameState["GAME_OVER"] = 9] = "GAME_OVER";
})(GameState || (exports.GameState = GameState = {}));
