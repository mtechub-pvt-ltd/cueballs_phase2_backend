const express = require("express");
const router = express.Router();
const controller = require("../../controllers/GAMES/gamesController");

// games
router.post("/create_game", controller.createGame);

router.put("/change_game_status", controller.changeStatus);
router.delete("/delete_game", controller.deleteGame);
router.get("/get_all_games", controller.getAllGames);
router.post("/reset_game", controller.resetCall);
router.get("/get_all_games_pagination", controller.getAllGamesPagination);
router.post("/announce_result", controller.announceResult);
router.post("/announce_resultv2", controller.announceResultv2);

router.get("/get_game_details_by_user_id", controller.getGameUserByGameId);
router.get("/get_games_by_year", controller.getGamesByYear);
router.get("/get_scheduled_games", controller.getScheduledGames);
router.get("/get_scheduled_gamesv2", controller.getScheduledGamesv2);
router.get("/get_scheduled_gamesv2_mine", controller.getScheduledGamesv2Mine);

// getCompletedGameLatestByUserId
router.get(
  "/get_completed_games_latest_by_user_id",
  controller.getCompletedGameLatestByUserId
);

module.exports = router;
