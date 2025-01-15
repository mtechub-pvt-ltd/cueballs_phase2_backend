const { pool, getBallImages } = require("../../config/db.config");
const crypto = require("crypto");
const express = require("express");
const io = require("../../../server");

// const {
//     white_ball,
//     ball_1,
//     ball_2,
//     ball_3,
//     ball_4,
//     ball_5,
//     ball_6,
//     ball_7,
//     ball_8,
//     ball_9,
//     ball_10,
//     ball_11,
//     ball_12,
//     ball_13,
//     ball_14,
//     ball_15
// } = require("../../socialIcons");
const fetchBallImages = require("../../utils/ball_images_urls");
// make an api call to get the ball images and it would be used in below apis
// const ballImageUrls = getBallImages();
// const ballImageUrls =  fetchBallImages();

// const ballImageUrls = {
//     0: white_ball,
//     1: ball_1,
//     2: ball_2,
//     3: ball_3,
//     4: ball_4,
//     5: ball_5,
//     6: ball_6,
//     7: ball_7,
//     8: ball_8,
//     9: ball_9,
//     10: ball_10,
//     11: ball_11,
//     12: ball_12,
//     13: ball_13,
//     14: ball_14,
//     15: ball_15
// };
// Game

async function generateUniqueGameId() {
  let game_id;
  let isUnique = false;

  // Loop until a unique game_id is found
  while (!isUnique) {
    // Generate a random game_id between 10000 and 99999
    game_id = Math.floor(Math.random() * 90000) + 10000;

    // Check if the generated game_id already exists in the database
    const gameIdCheck = await pool.query(
      "SELECT game_id FROM games WHERE game_id = $1",
      [game_id]
    );
    console.log("duplicated game id ..  ");

    // If no rows are returned, the game_id is unique
    if (gameIdCheck.rows.length === 0) {
      console.log("Uniq game id found ");
      isUnique = true; // game_id is unique, exit the loop
    }
  }

  return game_id; // Return the unique game_id
}
exports.createGame = async (req, res, next) => {
  const client = await pool.connect();
  try {
    // io.emit("game-created", { gameId: "game_id_data", status: "scheduled" });

    const { entry_fee, commission } = req.body;
    if (entry_fee === null || entry_fee === "" || entry_fee === undefined) {
      res.json({ error: true, message: "Please Provide Entry Fee" });
    } else {
      const game_status = "scheduled";
      // const game_id = Math.floor(Math.random() * 90000) + 10000;
      const game_id = await generateUniqueGameId();
      const userData = await pool.query(
        "INSERT INTO games(game_id,entry_fee,commission,game_status,restarted_round) VALUES($1,$2,$3,$4,$5) returning *",
        [game_id, entry_fee, commission, game_status, 0]
      );
      if (userData.rows.length === 0) {
        res.json({ error: true, data: [], message: "Can't Create Game" });
      } else {
        const game_id_data = userData.rows[0].games_id;
        // insery into game_rounds the game id and round 0
        const game_rounds = await pool.query(
          "INSERT INTO game_rounds(game_id,round_no) VALUES($1,$2) returning *",
          [game_id, 0]
        );
        // socket call
        // Emit the socket event
        res.json({
          error: false,
          data: userData.rows[0],
          message: "Game Created Successfully",
        });
      }
    }
  } catch (err) {
    console.log(err);
    res.json({ error: true, data: [], message: "Catch eror" });
  } finally {
    client.release();
  }
};
// change status
// exports.changeStatus = async (req, res, next) => {
//   const client = await pool.connect();
//   try {
//     const { game_id, game_status, restarted } = req.body;
//     console.log("sdfhgsfghsf")
//     console.log("restarted", restarted);
//     let query = "UPDATE games SET game_status = $1";
//     let params = [game_status];

//     if (typeof restarted !== 'undefined') {
//       query += ", restarted = $2";
//       params.push(restarted);
//     }

//     // Add the WHERE clause and the game_id parameter
//     query += " WHERE game_id = $" + (params.length + 1) + " RETURNING *";
//     params.push(game_id);

//     const userData = await pool.query(query, params);

//     if (userData.rows.length === 0) {
//       res.json({ error: true, data: [], message: "Can't Update Game Status" });
//     } else {
//       res.json({
//         error: false,
//         data: userData.rows[0],
//         message: "Game Status Updated Successfully",
//       });
//     }
//   } catch (err) {
//     console.log(err)
//     res.json({ error: true, data: [], message: "Catch error" });
//   } finally {
//     client.release();
//   }
// };
exports.changeStatus = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { game_id, game_status, restarted } = req.body;
    let query = "UPDATE games SET game_status = $1";
    let params = [game_status];
    let restartedRoundQuery = "";

    if (typeof restarted !== "undefined") {
      query += ", restarted = $2";
      params.push(restarted);

      if (restarted === true && game_status === "scheduled") {
        // Fetch the current value of restarted_round
        const restartedRoundData = await pool.query(
          "SELECT restarted_round FROM games WHERE game_id = $1",
          [game_id]
        );

        let restarted_round = restartedRoundData.rows[0]?.restarted_round;

        if (restarted_round === null || restarted_round === undefined) {
          restarted_round = 1; // Initialize if null or undefined
        } else {
          restarted_round = parseInt(restarted_round) + 1; // Increment the current value
        }

        restartedRoundQuery = ", restarted_round = $" + (params.length + 1);
        params.push(restarted_round);
      }
    }

    // Add the WHERE clause and the game_id parameter
    query +=
      restartedRoundQuery +
      " WHERE game_id = $" +
      (params.length + 1) +
      " RETURNING *";
    params.push(game_id);

    const userData = await pool.query(query, params);

    if (userData.rows.length === 0) {
      res.json({ error: true, data: [], message: "Can't Update Game Status" });
    } else {
      res.json({
        error: false,
        data: userData.rows[0],
        message: "Game Status Updated Successfully",
      });
    }
  } catch (err) {
    console.log(err);
    res.json({ error: true, data: [], message: "Catch error" });
  } finally {
    client.release();
  }
};

// delete game
exports.deleteGame = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { game_id } = req.body;
    const userData = await pool.query(
      "DELETE FROM games WHERE game_id = $1 returning *",
      [game_id]
    );
    if (userData.rows.length === 0) {
      res.json({ error: true, data: [], message: "Can't Delete Game" });
    } else {
      res.json({
        error: false,
        data: userData.rows[0],
        message: "Game Deleted Successfully",
      });
    }
  } catch (err) {
    res.json({ error: true, data: [], message: "Catch eror" });
  } finally {
    client.release();
  }
};
// get All Games
// exports.getAllGames = async (req, res, next) => {
//   const client = await pool.connect();
//   try {
//     const userData = await pool.query(
//       "SELECT * FROM games ORDER BY created_at DESC"
//     );
//     if (userData.rows.length === 0) {
//       res.json({
//         error: true,
//         data: [],
//         message: "Can't Get Games or Games data Empty",
//       });
//     } else {
//       const total_games = userData.rows.length;
//       let resulting_data = [];
//       // console.log("total_games", userData.rows)
//       for (let i = 0; i < total_games; i++) {
//         const game_id = userData.rows[i].game_id;
//         const winners = userData.rows[i].winners;
//         const winning_amount = userData.rows[i].winning_amount;
//         const winning_amount_single = userData.rows[i].winning_amount_single;

//         const game_users = await pool.query(
//           "SELECT * FROM game_users WHERE game_id=$1",
//           [game_id]
//         );
//         const total_participants = game_users.rows.length;
//         const game_details = {
//           game_id: game_id,
//           entry_fee: userData.rows[i].entry_fee,
//           commission: userData.rows[i].commission,
//           game_status: userData.rows[i].game_status,
//           total_participants: total_participants,
//           winners: winners === null ? 0 : winners,
//           winning_amount:
//             winning_amount === null ? 0 : parseFloat(winning_amount).toFixed(2),
//           winning_amount_single:
//             winning_amount_single === null
//               ? 0
//               : parseFloat(winning_amount_single).toFixed(2),
//         };
//         resulting_data.push(game_details);
//         // console.log(resulting_data);
//       }
//       res.json({
//         error: false,
//         data: resulting_data,
//         message: "Games Get Successfully",
//       });
//     }
//   } catch (err) {
//     console.log(err);
//     res.json({ error: true, data: [], message: "Catch error" });
//   } finally {
//     client.release();
//   }
// };
// get All Games
exports.getAllGames = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const userData = await pool.query(
      "SELECT * FROM games ORDER BY created_at DESC"
    );
    if (userData.rows.length === 0) {
      res.json({
        error: true,
        data: [],
        message: "Can't Get Games or Games data Empty",
      });
    } else {
      const total_games = userData.rows.length;
      let resulting_data = [];
      for (let i = 0; i < total_games; i++) {
        const game_id = userData.rows[i].game_id;
        const winners = userData.rows[i].winners;
        const winning_amount = userData.rows[i].winning_amount;
        const winning_amount_single = userData.rows[i].winning_amount_single;

        // Query to count distinct user_ids for the game
        const game_users = await pool.query(
          "SELECT COUNT(DISTINCT user_id) AS total_participants FROM game_users WHERE game_id=$1",
          [game_id]
        );
        const total_participants = game_users.rows[0].total_participants;

        const game_details = {
          game_id: game_id,
          entry_fee: userData.rows[i].entry_fee,
          commission: userData.rows[i].commission,
          game_status: userData.rows[i].game_status,
          total_participants: total_participants,
          winners: winners === null ? 0 : winners,
          winning_amount:
            winning_amount === null ? 0 : parseFloat(winning_amount).toFixed(2),
          winning_amount_single:
            winning_amount_single === null
              ? 0
              : parseFloat(winning_amount_single).toFixed(2),
        };
        resulting_data.push(game_details);
      }
      res.json({
        error: false,
        data: resulting_data,
        message: "Games Get Successfully",
      });
    }
  } catch (err) {
    console.log(err);
    res.json({ error: true, data: [], message: "Catch error" });
  } finally {
    client.release();
  }
};
// paginatyed get all
// exports.getAllGames = async (req, res, next) => {
//   const client = await pool.connect();
//   try {
//     // Get page and limit from query parameters, or set default values
//     const page = parseInt(req.body.page) || 1;
//     const limit = parseInt(req.body.limit) || 10;
//     const offset = (page - 1) * limit;

//     // Query to count total games for pagination calculation
//     const totalGamesResult = await pool.query("SELECT COUNT(*) FROM games");
//     const totalGames = parseInt(totalGamesResult.rows[0].count);

//     // Query with limit and offset for pagination
//     const userData = await pool.query(
//       "SELECT * FROM games ORDER BY created_at DESC LIMIT $1 OFFSET $2",
//       [limit, offset]
//     );

//     if (userData.rows.length === 0) {
//       res.json({
//         error: true,
//         data: [],
//         message: "Can't Get Games or Games data Empty",
//       });
//     } else {
//       let resulting_data = [];
//       for (let i = 0; i < userData.rows.length; i++) {
//         const game_id = userData.rows[i].game_id;
//         const winners = userData.rows[i].winners;
//         const winning_amount = userData.rows[i].winning_amount;
//         const winning_amount_single = userData.rows[i].winning_amount_single;

//         // Query to count distinct user_ids for the game
//         const game_users = await pool.query(
//           "SELECT COUNT(DISTINCT user_id) AS total_participants FROM game_users WHERE game_id=$1",
//           [game_id]
//         );
//         const total_participants = game_users.rows[0].total_participants;

//         const game_details = {
//           game_id: game_id,
//           entry_fee: userData.rows[i].entry_fee,
//           commission: userData.rows[i].commission,
//           game_status: userData.rows[i].game_status,
//           total_participants: total_participants,
//           winners: winners === null ? 0 : winners,
//           winning_amount:
//             winning_amount === null ? 0 : parseFloat(winning_amount).toFixed(2),
//           winning_amount_single:
//             winning_amount_single === null
//               ? 0
//               : parseFloat(winning_amount_single).toFixed(2),
//         };
//         resulting_data.push(game_details);
//       }

//       // Response with pagination info
//       res.json({
//         error: false,
//         data: resulting_data,
//         totalGames, // For frontend to calculate total pages
//         totalPages: Math.ceil(totalGames / limit), // Total pages
//         currentPage: page,
//         message: "Games Get Successfully",
//       });
//     }
//   } catch (err) {
//     console.log(err);
//     res.json({ error: true, data: [], message: "Catch error" });
//   } finally {
//     client.release();
//   }
// };
// _______________
// comment initial scenario
// } else if (parseInt(winning_ball) === parseInt(8)) {
//   // get all game users with winning ball 0
//   const gameUsers1 = await pool.query(
//     "SELECT * FROM game_users WHERE game_id=$1 ",
//     [game_id, [1, 2, 3, 4, 5, 6, 7, 8]]
//   );
//   console.log("Prev winners", gameUsers1.rows);
//   // amount deduct
//   const gameUsersWinners = await pool.query(
//     "SELECT DISTINCT user_id FROM game_users WHERE game_id = $1 AND CAST(winning_ball AS INTEGER) = ANY($2::INT[])",
//     [game_id.toString(), [1, 2, 3, 4, 5, 6, 7, 8]]
//   );
//   console.log(gameUsersWinners.rows);

//   let participated_usersWinner = gameUsersWinners.rows.length;
//   let actual_users_game_balls = gameUsers1.rows.length;
//   // No record then no winner
//   if (parseInt(participated_usersWinner) === parseInt(0)) {
//     console.log("dshjdsh");
//     return res.json({
//       error: true,
//       // game_details: game_details,
//       again_start_game: true,
//       message: "No User Winner",
//     });
//   } else {
//     console.log("else ");
//     // const participated_usersWinner = gameUsersWinners.rows.length;
//     console.log("participated_usersWinner", participated_usersWinner);
//     // console.log("participated_usersWinner", participated_users);

//     // get jackpot
//     jackpot = parseFloat(entry_fee) * parseFloat(actual_users_game_balls);
//     // deduct commision from jackpot
//     const commission_amount =
//       parseFloat(jackpot) * (parseFloat(commisssion) / 100);
//     // deduct commission from jackpot
//     jackpot = jackpot - commission_amount;

//     const winning_amount_single =
//       parseFloat(jackpot) / parseFloat(participated_usersWinner);

//     for (let i = 0; i < parseInt(participated_usersWinner); i++) {
//       const user_id = gameUsersWinners.rows[i].user_id;

//       // Fetch user's current wallet balance in a single query
//       const userWallet = await client.query(
//         "SELECT balance FROM wallet WHERE user_id=$1 FOR UPDATE", // Lock the row
//         [user_id]
//       );

//       if (userWallet.rows.length === 0) {
//         console.log(`User ${user_id} wallet not found`);
//         continue; // Skip to the next user if wallet is not found
//       }

//       // Calculate new balance
//       const newBalance =
//         parseFloat(userWallet.rows[0].balance) -
//         parseFloat(winning_amount_single);

//       // Check if the user has enough balance to deduct
//       if (newBalance < 0) {
//         console.log(`User ${user_id} does not have enough balance`);
//         continue; // Skip this user if they don't have sufficient balance
//       }

//       // Update the user's wallet balance
//       const updatedWallet = await client.query(
//         "UPDATE wallet SET balance=$1 WHERE user_id=$2 RETURNING *",
//         [newBalance, user_id]
//       );

//       console.log(
//         `Wallet updated for user ${user_id}:`,
//         updatedWallet.rows[0]
//       );
//       // remove won game
//       const winGames = await pool.query(
//         "SELECT * FROM users WHERE user_id=$1",
//         [user_id]
//       );
//       if (winGames.rows.length > 0) {
//         const winGame = await pool.query(
//           "UPDATE users SET win_games=$1 WHERE user_id=$2 RETURNING *",
//           [parseInt(winGames.rows[0].win_games) - parseInt(1), user_id]
//         );
//       }
//       // Insert transaction into transaction history
//       const transaction = await client.query(
//         "INSERT INTO transaction_history (user_id, amount, type, game_id) VALUES ($1, $2, $3, $4) RETURNING *",
//         [user_id, winning_amount_single, "diverted", game_id]
//       );

//       console.log(
//         `Transaction recorded for user ${user_id}:`,
//         transaction.rows[0]
//       );
//     }
//   }
// } else if (parseInt(winning_ball) === parseInt(9)) {
//   // get all game users with winning ball 0
//   const gameUsers1 = await pool.query(
//     "SELECT * FROM game_users WHERE game_id=$1 ",
//     [game_id]
//   );
//   console.log("Prev winners", gameUsers1.rows);
//   // amount deduct
//   const gameUsersWinners = await pool.query(
//     "SELECT DISTINCT user_id FROM game_users WHERE game_id = $1 AND CAST(winning_ball AS INTEGER) = ANY($2::INT[])",
//     [game_id.toString(), [9, 10, 11, 12, 13, 14, 15]]
//   );
//   console.log(gameUsersWinners.rows);

//   let participated_usersWinner = gameUsersWinners.rows.length;
//   let actual_users_game_balls = gameUsers1.rows.length;
//   // No record then no winner
//   if (parseInt(participated_usersWinner) === parseInt(0)) {
//     console.log("dshjdsh");
//     return res.json({
//       error: true,
//       // game_details: game_details,
//       again_start_game: true,
//       message: "No User Winner",
//     });
//   } else {
//     console.log("else ");
//     // const participated_usersWinner = gameUsersWinners.rows.length;
//     console.log("participated_usersWinner", participated_usersWinner);
//     // console.log("participated_usersWinner", participated_users);

//     // get jackpot
//     jackpot = parseFloat(entry_fee) * parseFloat(actual_users_game_balls);
//     // deduct commision from jackpot
//     const commission_amount =
//       parseFloat(jackpot) * (parseFloat(commisssion) / 100);
//     // deduct commission from jackpot
//     jackpot = jackpot - commission_amount;

//     const winning_amount_single =
//       parseFloat(jackpot) / parseFloat(participated_usersWinner);

//     for (let i = 0; i < parseInt(participated_usersWinner); i++) {
//       const user_id = gameUsersWinners.rows[i].user_id;

//       // Fetch user's current wallet balance in a single query
//       const userWallet = await client.query(
//         "SELECT balance FROM wallet WHERE user_id=$1 FOR UPDATE", // Lock the row
//         [user_id]
//       );

//       if (userWallet.rows.length === 0) {
//         console.log(`User ${user_id} wallet not found`);
//         continue; // Skip to the next user if wallet is not found
//       }

//       // Calculate new balance
//       const newBalance =
//         parseFloat(userWallet.rows[0].balance) -
//         parseFloat(winning_amount_single);

//       // Check if the user has enough balance to deduct
//       if (newBalance < 0) {
//         console.log(`User ${user_id} does not have enough balance`);
//         continue; // Skip this user if they don't have sufficient balance
//       }

//       // Update the user's wallet balance
//       const updatedWallet = await client.query(
//         "UPDATE wallet SET balance=$1 WHERE user_id=$2 RETURNING *",
//         [newBalance, user_id]
//       );
//       // remove won game
//       const winGames = await pool.query(
//         "SELECT * FROM users WHERE user_id=$1",
//         [user_id]
//       );
//       if (winGames.rows.length > 0) {
//         const winGame = await pool.query(
//           "UPDATE users SET win_games=$1 WHERE user_id=$2 RETURNING *",
//           [parseInt(winGames.rows[0].win_games) - parseInt(1), user_id]
//         );
//       }
//       console.log(
//         `Wallet updated for user ${user_id}:`,
//         updatedWallet.rows[0]
//       );

//       // Insert transaction into transaction history
//       const transaction = await client.query(
//         "INSERT INTO transaction_history (user_id, amount, type, game_id) VALUES ($1, $2, $3, $4) RETURNING *",
//         [user_id, winning_amount_single, "diverted", game_id]
//       );

//       console.log(
//         `Transaction recorded for user ${user_id}:`,
//         transaction.rows[0]
//       );
//     }
//   }
// }
// ______
// comment nect update winner
// else if (parseInt(reset_winner_ball) === parseInt(8)) {
//   const gameUsersWinners1 = await pool.query(
//     "SELECT DISTINCT user_id FROM game_users WHERE game_id = $1 AND CAST(winning_ball AS INTEGER) = ANY($2::INT[])",
//     [game_id.toString(), [1, 2, 3, 4, 5, 6, 7, 8]]
//   );
//   console.log(gameUsersWinners1.rows);

//   let participated_usersWinner1 = gameUsersWinners1.rows.length;
//   let actual_users_game_balls1 = gameUsers.rows.length;
//   // No record then no winner
//   if (parseInt(participated_usersWinner1) === parseInt(0)) {
//     console.log("dshjdsh");
//     return res.json({
//       error: true,
//       game_details: game_details,
//       again_start_game: true,
//       message: "No User Winner",
//     });
//   } else {
//     console.log("else ");
//     // const participated_usersWinner1 = gameUsersWinners1.rows.length;
//     console.log("participated_usersWinner1", participated_usersWinner1);
//     // console.log("participated_usersWinner1", participated_users);

//     // get jackpot
//     jackpot = parseFloat(entry_fee) * parseFloat(actual_users_game_balls1);
//     // deduct commision from jackpot
//     const commission_amount =
//       parseFloat(jackpot) * (parseFloat(commisssion) / 100);
//     // deduct commission from jackpot
//     jackpot = jackpot - commission_amount;

//     winning_amount_single1 =
//       parseFloat(jackpot) / parseFloat(participated_usersWinner1);

//     for (let i = 0; i < parseInt(participated_usersWinner1); i++) {
//       const user_id = gameUsersWinners1.rows[i].user_id;

//       // Fetch user's current wallet balance in a single query
//       const userWallet = await client.query(
//         "SELECT balance FROM wallet WHERE user_id=$1 FOR UPDATE", // Lock the row
//         [user_id]
//       );

//       if (userWallet.rows.length === 0) {
//         console.log(`User ${user_id} wallet not found`);
//         continue; // Skip to the next user if wallet is not found
//       }

//       // Calculate new balance
//       const newBalance =
//         parseFloat(userWallet.rows[0].balance) +
//         parseFloat(winning_amount_single1);

//       // Check if the user has enough balance to deduct
//       if (newBalance < 0) {
//         console.log(`User ${user_id} does not have enough balance`);
//         continue; // Skip this user if they don't have sufficient balance
//       }

//       // Update the user's wallet balance
//       const updatedWallet = await client.query(
//         "UPDATE wallet SET balance=$1 WHERE user_id=$2 RETURNING *",
//         [newBalance, user_id]
//       );

//       console.log(
//         `Wallet updated for user ${user_id}:`,
//         updatedWallet.rows[0]
//       );
//       const winGames = await pool.query(
//         "SELECT * FROM users WHERE user_id=$1",
//         [user_id]
//       );
//       if (winGames.rows.length > 0) {
//         const winGame = await pool.query(
//           "UPDATE users SET win_games=$1 WHERE user_id=$2 RETURNING *",
//           [parseInt(winGames.rows[0].win_games) + parseInt(1), user_id]
//         );
//       }
//       // Insert transaction into transaction history
//       const transaction = await client.query(
//         "INSERT INTO transaction_history (user_id, amount, type, game_id) VALUES ($1, $2, $3, $4) RETURNING *",
//         [user_id, winning_amount_single, "added to wallet", game_id]
//       );

//       console.log(
//         `Transaction recorded for user ${user_id}:`,
//         transaction.rows[0]
//       );
//     }
//   }
//   const gameUserWinnerReset = await pool.query(
//     "UPDATE games SET winner_ball=$1,winning_amount=$2,commision_winning_amount=$3,participants=$4,winners=$5,winning_amount_single=$6 WHERE game_id=$7 RETURNING *",
//     [
//       reset_winner_ball,
//       jackpot,
//       commission_amount,
//       participated_users,
//       participated_usersWinner1,
//       winning_amount_single1,
//       game_id,
//     ]
//   );
//   if (gameUserWinnerReset.rows.length > 0) {
//     res.json({
//       error: false,
//       winner_ball_image_url: ballImageUrls[reset_winner_ball], // Add the URL of the winner ball

//       game_details: gameUserWinnerReset.rows[0],
//       participated_users: participated_users,
//       winners: participated_usersWinner1,
//       message: "Winner Reset Successfully",
//     });
//   } else {
//     res.json({
//       error: true,
//       again_start_game: true,
//       message: "Cant Reset Winner Ball Right Now !",
//     });
//   }
// } else if (parseInt(reset_winner_ball) === parseInt(9)) {
//   const gameUsersWinners1 = await pool.query(
//     "SELECT DISTINCT user_id FROM game_users WHERE game_id = $1 AND CAST(winning_ball AS INTEGER) = ANY($2::INT[])",
//     [game_id.toString(), [9, 10, 11, 12, 13, 14, 15]]
//   );
//   console.log(gameUsersWinners1.rows);

//   let participated_usersWinner1 = gameUsersWinners1.rows.length;
//   let actual_users_game_balls1 = gameUsers.rows.length;
//   // No record then no winner
//   if (parseInt(participated_usersWinner1) === parseInt(0)) {
//     console.log("dshjdsh");
//     return res.json({
//       error: true,
//       game_details: game_details,
//       again_start_game: true,
//       message: "No User Winner",
//     });
//   } else {
//     console.log("else ");
//     // const participated_usersWinner1 = gameUsersWinners1.rows.length;
//     console.log("participated_usersWinner1", participated_usersWinner1);
//     // console.log("participated_usersWinner1", participated_users);

//     // get jackpot
//     jackpot = parseFloat(entry_fee) * parseFloat(actual_users_game_balls1);
//     // deduct commision from jackpot
//     const commission_amount =
//       parseFloat(jackpot) * (parseFloat(commisssion) / 100);
//     // deduct commission from jackpot
//     jackpot = jackpot - commission_amount;

//     winning_amount_single1 =
//       parseFloat(jackpot) / parseFloat(participated_usersWinner1);

//     for (let i = 0; i < parseInt(participated_usersWinner1); i++) {
//       const user_id = gameUsersWinners1.rows[i].user_id;

//       // Fetch user's current wallet balance in a single query
//       const userWallet = await client.query(
//         "SELECT balance FROM wallet WHERE user_id=$1 FOR UPDATE", // Lock the row
//         [user_id]
//       );

//       if (userWallet.rows.length === 0) {
//         console.log(`User ${user_id} wallet not found`);
//         continue; // Skip to the next user if wallet is not found
//       }

//       // Calculate new balance
//       const newBalance =
//         parseFloat(userWallet.rows[0].balance) +
//         parseFloat(winning_amount_single1);

//       // Check if the user has enough balance to deduct
//       if (newBalance < 0) {
//         console.log(`User ${user_id} does not have enough balance`);
//         continue; // Skip this user if they don't have sufficient balance
//       }
//       const winGames = await pool.query(
//         "SELECT * FROM users WHERE user_id=$1",
//         [user_id]
//       );
//       if (winGames.rows.length > 0) {
//         const winGame = await pool.query(
//           "UPDATE users SET win_games=$1 WHERE user_id=$2 RETURNING *",
//           [parseInt(winGames.rows[0].win_games) + parseInt(1), user_id]
//         );
//       }
//       // Update the user's wallet balance
//       const updatedWallet = await client.query(
//         "UPDATE wallet SET balance=$1 WHERE user_id=$2 RETURNING *",
//         [newBalance, user_id]
//       );

//       console.log(
//         `Wallet updated for user ${user_id}:`,
//         updatedWallet.rows[0]
//       );

//       // Insert transaction into transaction history
//       const transaction = await client.query(
//         "INSERT INTO transaction_history (user_id, amount, type, game_id) VALUES ($1, $2, $3, $4) RETURNING *",
//         [user_id, winning_amount_single, "added to wallet", game_id]
//       );

//       console.log(
//         `Transaction recorded for user ${user_id}:`,
//         transaction.rows[0]
//       );
//     }
//   }
//   const gameUserWinnerReset = await pool.query(
//     "UPDATE games SET winner_ball=$1,winning_amount=$2,commision_winning_amount=$3,participants=$4,winners=$5,winning_amount_single=$6 WHERE game_id=$7 RETURNING *",
//     [
//       reset_winner_ball,
//       jackpot,
//       commission_amount,
//       participated_users,
//       participated_usersWinner1,
//       winning_amount_single1,
//       game_id,
//     ]
//   );
//   if (gameUserWinnerReset.rows.length > 0) {
//     res.json({
//       error: false,
//       winner_ball_image_url: ballImageUrls[reset_winner_ball], // Add the URL of the winner ball

//       game_details: gameUserWinnerReset.rows[0],
//       participated_users: participated_users,
//       winners: participated_usersWinner1,
//       message: "Winner Reset Successfully",
//     });
//   } else {
//     res.json({
//       error: true,
//       again_start_game: true,
//       message: "Cant Reset Winner Ball Right Now !",
//     });
//   }
// }
exports.resetCall = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { game_id, reset_winner_ball } = req.body;
    // get game by game id
    let winning_amount_single1 = 0;
    const ballImageUrls = await fetchBallImages();

    const gameData = await pool.query("SELECT * FROM games WHERE game_id=$1", [
      game_id,
    ]);
    let game_details = gameData.rows[0];
    if (gameData.rows.length === 0) {
      return res.json({
        error: true,
        data: [],
        message: "Can't Get Games or Games data Empty",
      });
    }

    const gameUsersAll = await pool.query(
      "SELECT COUNT(DISTINCT user_id) AS total_participants FROM game_users WHERE game_id=$1",
      [game_id]
    );
    const participated_users = gameUsersAll.rows[0].total_participants;
    let winning_ball = gameData.rows[0].winner_ball;
    let entry_fee = gameData.rows[0].entry_fee;
    let commisssion = gameData.rows[0].commission;
    let commission_amount = gameData.rows[0].commission;

    let winning_amount_single = gameData.rows[0].winning_amount_single;

    console.log("gamedata");

    // const game_winners = gameData.rows[0].winners;
    // if (parseInt(game_winners) === parseInt(0)) {
    //  return res.json({
    //     error: true,
    //     data: [],
    //     message: "No Winners Found",
    //   });
    // }

    // get game users by game id
    let gameUsers = await pool.query(
      "SELECT * FROM game_users WHERE game_id=$1",
      [game_id]
    );
    if (gameUsers.rows.length === 0) {
      return res.json({
        error: true,
        data: [],
        message: "Can't Get Games or Games data Empty",
      });
    }
    // Check for reset_winner_ball conditions
    let gameUsers2;

    // if (parseInt(reset_winner_ball) === 8) {
    //   // If reset_winner_ball is 8, check for winning_ball between 1-8
    //   gameUsers2 = await pool.query(
    //     "SELECT * FROM game_users WHERE game_id=$1 AND winning_ball BETWEEN 1 AND 8",
    //     [game_id]
    //   );
    //   console.log("New winners", gameUsers2.rows);

    //   // If no users found, return an error
    //   if (gameUsers2.rows.length === 0) {
    //     return res.json({
    //       error: true,
    //       data: [],
    //       message: "No Winners Found for the specified winning ball range.",
    //     });
    //   }
    // } else if (parseInt(reset_winner_ball) === 9) {
    //   // If reset_winner_ball is 9, check for winning_ball between 9-15
    //   gameUsers2 = await pool.query(
    //     "SELECT * FROM game_users WHERE game_id=$1 AND winning_ball BETWEEN 9 AND 15",
    //     [game_id]
    //   );
    //   console.log("New winners", gameUsers2.rows);

    //   // If no users found, return an error
    //   if (gameUsers2.rows.length === 0) {
    //     return res.json({
    //       error: true,
    //       data: [],
    //       message: "No Winners Found for the specified winning ball range.",
    //     });
    //   }
    // } else if (parseInt(reset_winner_ball) === 0) {
    //   // If reset_winner_ball is 0, do nothing or handle this case if needed
    // } else {
    //   // For any other reset_winner_ball, fetch users with exact match
    //   gameUsers2 = await pool.query(
    //     "SELECT * FROM game_users WHERE game_id=$1 AND winning_ball = $2",
    //     [game_id, reset_winner_ball]
    //   );
    //   console.log("New winners", gameUsers2.rows);

    //   // If no users found, return an error
    //   if (gameUsers2.rows.length === 0) {
    //     return res.json({
    //       error: true,
    //       data: [],
    //       message: "No Winners Found for the specified winning ball range.",
    //     });
    //   }
    // }

    // const gameUsers2 = await pool.query(
    //     "SELECT * FROM game_users WHERE game_id=$1 AND winning_ball = $2",
    //     [game_id, reset_winner_ball]
    //   );
    //   console.log("New winners", gameUsers2.rows);
    //   // amount deduct
    //   if (gameUsers2.rows.length === 0) {
    //     return res.json({
    //       error: true,
    //       data: [],
    //       message: "No Winners Found",
    //     });
    //   }
    console.log("gameUsers", gameUsers.rows);
    console.log("winning_ball", winning_ball);
    console.log("winning_amount_single", winning_amount_single);
    if (parseInt(winning_ball) === parseInt(0)) {
      console.log("no winning ball prev");
    } else if (parseInt(winning_ball) === parseInt(8)) {
      console.log(winning_ball);
      const gameUsersWinnersPW = await pool.query(
        "SELECT user_id FROM game_users WHERE game_id = $1 AND CAST(winning_ball AS INTEGER) = ANY($2::INT[])",
        [game_id.toString(), [1, 2, 3, 4, 5, 6, 7, 8]]
      );
      //         console.log("GAMEUSERWINNERS");
      let gameUsersWinnersPartWin = gameUsersWinnersPW.rows.length;
      let userIdsArray = gameUsersWinnersPW.rows.map((row) => ({
        user_id: row.user_id,
      }));
      console.log("ids user ");
      console.log(userIdsArray);

      const totalGameUsers = await pool.query(
        "SELECT COUNT(*) AS total FROM game_users WHERE game_id = $1",
        [game_id]
      );
      console.log("Total Game User Entries:", totalGameUsers.rows[0].total);

      let participated_usersWinner = totalGameUsers.rows[0].total;

      if (
        parseInt(gameUsersWinnersPartWin) === parseInt(0) ||
        parseInt(gameUsersWinnersPartWin) === null ||
        parseInt(gameUsersWinnersPartWin) === "null"
      ) {
        console.log("dshjdsh");
        return res.json({
          error: true,
          game_details: game_details,
          again_start_game: true,
          message: "No User Winner",
        });
      } else {
        console.log("else ");
        // const participated_usersWinner = gameUsersWinners.rows.length;
        console.log("participated_usersWinner", participated_usersWinner);
        // console.log("participated_usersWinner", participated_users);

        // get jackpot
        jackpot = parseFloat(entry_fee) * parseFloat(participated_usersWinner);
        // deduct commision from jackpot
        const commission_amount =
          parseFloat(jackpot) * (parseFloat(commisssion) / 100);
        // deduct commission from jackpot
        jackpot = jackpot - commission_amount;

        const winning_amount_single =
          parseFloat(jackpot) / parseFloat(gameUsersWinnersPartWin);

        // Create a map to track the count of wins for each user
        const userWinCounts = userIdsArray.reduce((acc, { user_id }) => {
          acc[user_id] = (acc[user_id] || 0) + 1;
          return acc;
        }, {});
        for (const userId in userWinCounts) {
          const winCount = userWinCounts[userId];
          const totalWinningAmount = winCount * winning_amount_single;

          // const user_id = gameUsersWinners.rows[i].user_id;

          // Fetch user's current wallet balance in a single query
          const userWallet = await client.query(
            "SELECT balance FROM wallet WHERE user_id=$1 FOR UPDATE", // Lock the row
            [userId]
          );

          if (userWallet.rows.length === 0) {
            console.log(`User ${userId} wallet not found`);
            continue; // Skip to the next user if wallet is not found
          }

          // Calculate new balance
          const newBalance =
            parseFloat(userWallet.rows[0].balance) -
            parseFloat(totalWinningAmount);
          // remove won game
          const winGames = await pool.query(
            "SELECT * FROM users WHERE user_id=$1",
            [userId]
          );
          if (winGames.rows.length > 0) {
            const winGame = await pool.query(
              "UPDATE users SET win_games=$1 WHERE user_id=$2 RETURNING *",
              [parseInt(winGames.rows[0].win_games) - parseInt(1), userId]
            );
          }

          // Check if the user has enough balance to deduct
          if (newBalance < 0) {
            console.log(`User ${userId} does not have enough balance`);
            continue; // Skip this user if they don't have sufficient balance
          }

          // Update the user's wallet balance
          const updatedWallet = await client.query(
            "UPDATE wallet SET balance=$1 WHERE user_id=$2 RETURNING *",
            [newBalance, userId]
          );

          console.log(
            `Wallet updated for user ${userId}:`,
            updatedWallet.rows[0]
          );

          // Insert transaction into transaction history
          const transaction = await client.query(
            "INSERT INTO transaction_history (user_id, amount, type, game_id) VALUES ($1, $2, $3, $4) RETURNING *",
            [userId, totalWinningAmount, "diverted", game_id]
          );

          console.log(
            `Transaction recorded for user ${userId}:`,
            transaction.rows[0]
          );
        }
      }
      // UPADTE NEW USERS
      //-------------------------------------
      // ADDD
    } else if (parseInt(winning_ball) === parseInt(9)) {
      console.log(winning_ball);
      const gameUsersWinnersPW = await pool.query(
        "SELECT user_id FROM game_users WHERE game_id = $1 AND CAST(winning_ball AS INTEGER) = ANY($2::INT[])",
        [game_id.toString(), [9, 10, 11, 12, 13, 14, 15]]
      );
      //         console.log("GAMEUSERWINNERS");
      let gameUsersWinnersPartWin = gameUsersWinnersPW.rows.length;
      let userIdsArray = gameUsersWinnersPW.rows.map((row) => ({
        user_id: row.user_id,
      }));
      console.log("ids user ");
      console.log(userIdsArray);

      const totalGameUsers = await pool.query(
        "SELECT COUNT(*) AS total FROM game_users WHERE game_id = $1",
        [game_id]
      );
      console.log("Total Game User Entries:", totalGameUsers.rows[0].total);

      let participated_usersWinner = totalGameUsers.rows[0].total;

      if (
        parseInt(gameUsersWinnersPartWin) === parseInt(0) ||
        parseInt(gameUsersWinnersPartWin) === null ||
        parseInt(gameUsersWinnersPartWin) === "null"
      ) {
        console.log("dshjdsh");
        return res.json({
          error: true,
          game_details: game_details,
          again_start_game: true,
          message: "No User Winner",
        });
      } else {
        console.log("else ");
        // const participated_usersWinner = gameUsersWinners.rows.length;
        console.log("participated_usersWinner", participated_usersWinner);
        // console.log("participated_usersWinner", participated_users);

        // get jackpot
        jackpot = parseFloat(entry_fee) * parseFloat(participated_usersWinner);
        // deduct commision from jackpot
        const commission_amount =
          parseFloat(jackpot) * (parseFloat(commisssion) / 100);
        // deduct commission from jackpot
        jackpot = jackpot - commission_amount;

        const winning_amount_single =
          parseFloat(jackpot) / parseFloat(gameUsersWinnersPartWin);

        // Create a map to track the count of wins for each user
        const userWinCounts = userIdsArray.reduce((acc, { user_id }) => {
          acc[user_id] = (acc[user_id] || 0) + 1;
          return acc;
        }, {});
        for (const userId in userWinCounts) {
          const winCount = userWinCounts[userId];
          const totalWinningAmount = winCount * winning_amount_single;

          // const user_id = gameUsersWinners.rows[i].user_id;

          // Fetch user's current wallet balance in a single query
          const userWallet = await client.query(
            "SELECT balance FROM wallet WHERE user_id=$1 FOR UPDATE", // Lock the row
            [userId]
          );

          if (userWallet.rows.length === 0) {
            console.log(`User ${userId} wallet not found`);
            continue; // Skip to the next user if wallet is not found
          }

          // Calculate new balance
          const newBalance =
            parseFloat(userWallet.rows[0].balance) -
            parseFloat(totalWinningAmount);
          // remove won game
          const winGames = await pool.query(
            "SELECT * FROM users WHERE user_id=$1",
            [userId]
          );
          if (winGames.rows.length > 0) {
            const winGame = await pool.query(
              "UPDATE users SET win_games=$1 WHERE user_id=$2 RETURNING *",
              [parseInt(winGames.rows[0].win_games) - parseInt(1), userId]
            );
          }

          // Check if the user has enough balance to deduct
          if (newBalance < 0) {
            console.log(`User ${userId} does not have enough balance`);
            continue; // Skip this user if they don't have sufficient balance
          }

          // Update the user's wallet balance
          const updatedWallet = await client.query(
            "UPDATE wallet SET balance=$1 WHERE user_id=$2 RETURNING *",
            [newBalance, userId]
          );

          console.log(
            `Wallet updated for user ${userId}:`,
            updatedWallet.rows[0]
          );

          // Insert transaction into transaction history
          const transaction = await client.query(
            "INSERT INTO transaction_history (user_id, amount, type, game_id) VALUES ($1, $2, $3, $4) RETURNING *",
            [userId, totalWinningAmount, "diverted", game_id]
          );

          console.log(
            `Transaction recorded for user ${userId}:`,
            transaction.rows[0]
          );
        }
      }
      // UPADTE NEW USERS
      //-------------------------------------
      // ADDD
    } else {
      console.log(winning_ball);
      const gameUsersWinnersPW = await pool.query(
        "SELECT DISTINCT user_id FROM game_users WHERE game_id = $1 AND winning_ball = $2",
        [game_id.toString(), winning_ball.toString()]
      );
      //         console.log("GAMEUSERWINNERS");
      let gameUsersWinnersPartWin = gameUsersWinnersPW.rows.length;
      let userIdsArray = gameUsersWinnersPW.rows.map((row) => ({
        user_id: row.user_id,
      }));
      console.log("ids user ");
      console.log(userIdsArray);

      const totalGameUsers = await pool.query(
        "SELECT COUNT(*) AS total FROM game_users WHERE game_id = $1",
        [game_id]
      );
      console.log("Total Game User Entries:", totalGameUsers.rows[0].total);

      let participated_usersWinner = totalGameUsers.rows[0].total;

      if (
        parseInt(gameUsersWinnersPartWin) === parseInt(0) ||
        parseInt(gameUsersWinnersPartWin) === null ||
        parseInt(gameUsersWinnersPartWin) === "null"
      ) {
        console.log("dshjdsh");
        return res.json({
          error: true,
          game_details: game_details,
          again_start_game: true,
          message: "No User Winner",
        });
      } else {
        console.log("else ");
        // const participated_usersWinner = gameUsersWinners.rows.length;
        console.log("participated_usersWinner", participated_usersWinner);
        // console.log("participated_usersWinner", participated_users);

        // get jackpot
        jackpot = parseFloat(entry_fee) * parseFloat(participated_usersWinner);
        // deduct commision from jackpot
        const commission_amount =
          parseFloat(jackpot) * (parseFloat(commisssion) / 100);
        // deduct commission from jackpot
        jackpot = jackpot - commission_amount;

        const winning_amount_single =
          parseFloat(jackpot) / parseFloat(gameUsersWinnersPartWin);

        // Create a map to track the count of wins for each user
        const userWinCounts = userIdsArray.reduce((acc, { user_id }) => {
          acc[user_id] = (acc[user_id] || 0) + 1;
          return acc;
        }, {});
        for (const userId in userWinCounts) {
          const winCount = userWinCounts[userId];
          const totalWinningAmount = winCount * winning_amount_single;

          // const user_id = gameUsersWinners.rows[i].user_id;

          // Fetch user's current wallet balance in a single query
          const userWallet = await client.query(
            "SELECT balance FROM wallet WHERE user_id=$1 FOR UPDATE", // Lock the row
            [userId]
          );

          if (userWallet.rows.length === 0) {
            console.log(`User ${userId} wallet not found`);
            continue; // Skip to the next user if wallet is not found
          }

          // Calculate new balance
          const newBalance =
            parseFloat(userWallet.rows[0].balance) -
            parseFloat(totalWinningAmount);
          // remove won game
          const winGames = await pool.query(
            "SELECT * FROM users WHERE user_id=$1",
            [userId]
          );
          if (winGames.rows.length > 0) {
            const winGame = await pool.query(
              "UPDATE users SET win_games=$1 WHERE user_id=$2 RETURNING *",
              [parseInt(winGames.rows[0].win_games) - parseInt(1), userId]
            );
          }

          // Check if the user has enough balance to deduct
          if (newBalance < 0) {
            console.log(`User ${userId} does not have enough balance`);
            continue; // Skip this user if they don't have sufficient balance
          }

          // Update the user's wallet balance
          const updatedWallet = await client.query(
            "UPDATE wallet SET balance=$1 WHERE user_id=$2 RETURNING *",
            [newBalance, userId]
          );

          console.log(
            `Wallet updated for user ${userId}:`,
            updatedWallet.rows[0]
          );

          // Insert transaction into transaction history
          const transaction = await client.query(
            "INSERT INTO transaction_history (user_id, amount, type, game_id) VALUES ($1, $2, $3, $4) RETURNING *",
            [userId, totalWinningAmount, "diverted", game_id]
          );

          console.log(
            `Transaction recorded for user ${userId}:`,
            transaction.rows[0]
          );
        }
      }
      // UPADTE NEW USERS
      //-------------------------------------
      // ADDD
    }
    console.log("new Winners data");
    // New users updatyed wallet
    // _________
    // ____
    // get all game users with winning ball 0
    const gameUsersWinnersNew = await pool.query(
      "SELECT * FROM game_users WHERE game_id=$1 AND winning_ball = $2",
      [game_id, reset_winner_ball]
    );
    console.log("Prev winners", gameUsersWinnersNew.rows);
    // amount deduct
    if (parseInt(reset_winner_ball) === parseInt(0)) {
      console.log("HOUSE WINS");

      const gameUserWinnerReset = await pool.query(
        "UPDATE games SET winner_ball=$1,winning_amount=$2,commision_winning_amount=$3,participants=$4,winners=$5,winning_amount_single=$6 WHERE game_id=$7 RETURNING *",
        [
          reset_winner_ball,
          jackpot,
          commission_amount,
          participated_users,
          0,
          0,
          game_id,
        ]
      );
      if (gameUserWinnerReset.rows.length > 0) {
        res.json({
          error: false,
          winner_ball_image_url: ballImageUrls[reset_winner_ball], // Add the URL of the winner ball

          game_details: gameUserWinnerReset.rows[0],
          participated_users: participated_users,
          winners: 0,
          message: "Winner Reset Successfully",
        });
      } else {
        res.json({
          error: true,
          again_start_game: true,
          message: "Cant Reset Winner Ball Right Now !",
        });
      }
    } else if (parseInt(reset_winner_ball) === parseInt(8)) {
      // reset_winner_ball
      const gameUsersWinnersP = await pool.query(
        "SELECT DISTINCT user_id FROM game_users WHERE game_id = $1",
        [game_id.toString()]
      );
      //         console.log("GAMEUSERWINNERS");
      let gameUsersWinnersPart = gameUsersWinnersP.rows.length;
      const gameUsersWinnersPW = await pool.query(
        "SELECT user_id FROM game_users WHERE game_id = $1 AND CAST(winning_ball AS INTEGER) = ANY($2::INT[])",
        [game_id.toString(), [1, 2, 3, 4, 5, 6, 7, 8]]
      );
      //         console.log("GAMEUSERWINNERS");
      let gameUsersWinnersPartWin = gameUsersWinnersPW.rows.length;
      let userIdsArray = gameUsersWinnersPW.rows.map((row) => ({
        user_id: row.user_id,
      }));
      console.log("ids user ");
      console.log(userIdsArray);

      const totalGameUsers = await pool.query(
        "SELECT COUNT(*) AS total FROM game_users WHERE game_id = $1",
        [game_id]
      );
      console.log("Total Game User Entries:", totalGameUsers.rows[0].total);

      // Step 2: Use a CTE to identify winning users and count all their entries
      //       const countQuery = `
      // WITH winning_users AS (
      //   SELECT DISTINCT user_id
      //   FROM game_users
      //   WHERE game_id = $1 AND winning_ball = $2
      // )
      // SELECT COUNT(*) AS winning_entries, ARRAY_AGG(user_id) AS winning_user_ids
      // FROM game_users
      // WHERE game_id = $1
      //   AND user_id IN (SELECT user_id FROM winning_users)
      // `;

      //       const countParams = [game_id.toString(), reset_winner_ball.toString()];

      //       const gameUsersCountResult = await pool.query(countQuery, countParams);

      //       console.log(
      //         "Winning Users Count (All Their Entries):",
      //         gameUsersCountResult.rows[0].winning_entries
      //       );
      //       let winningUsersCount = gameUsersCountResult.rows[0].winning_entries;
      //       const winningUserIds = gameUsersCountResult.rows[0].winning_user_ids;
      //       console.log("GAMEUSERWINNERS 1");
      //       console.log(winningUserIds);

      let participated_usersWinner1 = totalGameUsers.rows[0].total;
      // let actual_users_game_balls1 = winningUsersCount;
      // const gameUsersWinners1 = await pool.query(
      //   "SELECT DISTINCT user_id FROM game_users WHERE game_id = $1 AND winning_ball = $2",
      //   [game_id.toString(), reset_winner_ball.toString()]
      // );
      // console.log(gameUsersWinners1.rows);

      // let participated_usersWinner1 = gameUsersWinners1.rows.length;
      // let actual_users_game_balls1 = gameUsers.rows.length;
      // No record then no winner
      if (
        parseInt(gameUsersWinnersPartWin) === parseInt(0) ||
        parseInt(gameUsersWinnersPartWin) === null ||
        parseInt(gameUsersWinnersPartWin) === "null"
      ) {
        console.log("dshjdsh");
        return res.json({
          error: true,
          game_details: game_details,
          again_start_game: true,
          message: "No User Winner",
        });
      } else {
        console.log("else ");
        // const participated_usersWinner1 = gameUsersWinners1.rows.length;
        console.log("participated_usersWinner1", participated_usersWinner1);
        // console.log("participated_usersWinner1", participated_users);

        // get jackpot
        jackpot = parseFloat(entry_fee) * parseFloat(participated_usersWinner1);
        // deduct commision from jackpot
        const commission_amount =
          parseFloat(jackpot) * (parseFloat(commisssion) / 100);
        // deduct commission from jackpot
        jackpot = jackpot - commission_amount;

        winning_amount_single1 =
          parseFloat(jackpot) / parseFloat(gameUsersWinnersPartWin);
        const userWinCounts = userIdsArray.reduce((acc, { user_id }) => {
          acc[user_id] = (acc[user_id] || 0) + 1;
          return acc;
        }, {});

        for (const userId in userWinCounts) {
          // const user_id = gameUsersWinners1.rows[i].user_id;
          const winCount = userWinCounts[userId];
          const totalWinningAmount = winCount * winning_amount_single1;

          // Fetch user's current wallet balance in a single query
          const userWallet = await client.query(
            "SELECT balance FROM wallet WHERE user_id=$1 FOR UPDATE", // Lock the row
            [userId]
          );

          if (userWallet.rows.length === 0) {
            console.log(`User ${userId} wallet not found`);
            continue; // Skip to the next user if wallet is not found
          }

          // Calculate new balance
          const newBalance =
            parseFloat(userWallet.rows[0].balance) +
            parseFloat(totalWinningAmount);

          // Check if the user has enough balance to deduct
          if (newBalance < 0) {
            console.log(`User ${userId} does not have enough balance`);
            continue; // Skip this user if they don't have sufficient balance
          }
          // remove won game
          const winGames = await pool.query(
            "SELECT * FROM users WHERE user_id=$1",
            [userId]
          );
          if (winGames.rows.length > 0) {
            const winGame = await pool.query(
              "UPDATE users SET win_games=$1 WHERE user_id=$2 RETURNING *",
              [parseInt(winGames.rows[0].win_games) + parseInt(1), userId]
            );
          }
          // Update the user's wallet balance
          const updatedWallet = await client.query(
            "UPDATE wallet SET balance=$1 WHERE user_id=$2 RETURNING *",
            [newBalance, userId]
          );

          console.log(
            `Wallet updated for user ${userId}:`,
            updatedWallet.rows[0]
          );

          // Insert transaction into transaction history
          const transaction = await client.query(
            "INSERT INTO transaction_history (user_id, amount, type, game_id) VALUES ($1, $2, $3, $4) RETURNING *",
            [userId, totalWinningAmount, "added to wallet", game_id]
          );

          console.log(
            `Transaction recorded for user ${userId}:`,
            transaction.rows[0]
          );
        }
      }

      const gameUserWinnerReset = await pool.query(
        "UPDATE games SET winner_ball=$1,winning_amount=$2,commision_winning_amount=$3,participants=$4,winners=$5,winning_amount_single=$6 WHERE game_id=$7 RETURNING *",
        [
          reset_winner_ball,
          jackpot,
          commission_amount,
          participated_users,
          participated_usersWinner1,
          winning_amount_single1,
          game_id,
        ]
      );
      if (gameUserWinnerReset.rows.length > 0) {
        res.json({
          error: false,
          winner_ball_image_url: ballImageUrls[reset_winner_ball], // Add the URL of the winner ball

          game_details: gameUserWinnerReset.rows[0],
          participated_users: participated_users,
          winners: participated_usersWinner1,
          message: "Winner Reset Successfully",
        });
      } else {
        res.json({
          error: true,
          again_start_game: true,
          message: "Cant Reset Winner Ball Right Now !",
        });
      }
    } else if (parseInt(reset_winner_ball) === parseInt(9)) {
      // reset_winner_ball
      const gameUsersWinnersP = await pool.query(
        "SELECT DISTINCT user_id FROM game_users WHERE game_id = $1",
        [game_id.toString()]
      );
      //         console.log("GAMEUSERWINNERS");
      let gameUsersWinnersPart = gameUsersWinnersP.rows.length;
      const gameUsersWinnersPW = await pool.query(
        "SELECT user_id FROM game_users WHERE game_id = $1 AND CAST(winning_ball AS INTEGER) = ANY($2::INT[])",
        [game_id.toString(), [9, 10, 11, 12, 13, 14, 15]]
      );
      //         console.log("GAMEUSERWINNERS");
      let gameUsersWinnersPartWin = gameUsersWinnersPW.rows.length;
      let userIdsArray = gameUsersWinnersPW.rows.map((row) => ({
        user_id: row.user_id,
      }));
      console.log("ids user ");
      console.log(userIdsArray);

      const totalGameUsers = await pool.query(
        "SELECT COUNT(*) AS total FROM game_users WHERE game_id = $1",
        [game_id]
      );
      console.log("Total Game User Entries:", totalGameUsers.rows[0].total);

      // Step 2: Use a CTE to identify winning users and count all their entries
      //       const countQuery = `
      // WITH winning_users AS (
      //   SELECT DISTINCT user_id
      //   FROM game_users
      //   WHERE game_id = $1 AND winning_ball = $2
      // )
      // SELECT COUNT(*) AS winning_entries, ARRAY_AGG(user_id) AS winning_user_ids
      // FROM game_users
      // WHERE game_id = $1
      //   AND user_id IN (SELECT user_id FROM winning_users)
      // `;

      //       const countParams = [game_id.toString(), reset_winner_ball.toString()];

      //       const gameUsersCountResult = await pool.query(countQuery, countParams);

      //       console.log(
      //         "Winning Users Count (All Their Entries):",
      //         gameUsersCountResult.rows[0].winning_entries
      //       );
      //       let winningUsersCount = gameUsersCountResult.rows[0].winning_entries;
      //       const winningUserIds = gameUsersCountResult.rows[0].winning_user_ids;
      //       console.log("GAMEUSERWINNERS 1");
      //       console.log(winningUserIds);

      let participated_usersWinner1 = totalGameUsers.rows[0].total;
      // let actual_users_game_balls1 = winningUsersCount;
      // const gameUsersWinners1 = await pool.query(
      //   "SELECT DISTINCT user_id FROM game_users WHERE game_id = $1 AND winning_ball = $2",
      //   [game_id.toString(), reset_winner_ball.toString()]
      // );
      // console.log(gameUsersWinners1.rows);

      // let participated_usersWinner1 = gameUsersWinners1.rows.length;
      // let actual_users_game_balls1 = gameUsers.rows.length;
      // No record then no winner
      if (
        parseInt(gameUsersWinnersPartWin) === parseInt(0) ||
        parseInt(gameUsersWinnersPartWin) === null ||
        parseInt(gameUsersWinnersPartWin) === "null"
      ) {
        console.log("dshjdsh");
        return res.json({
          error: true,
          game_details: game_details,
          again_start_game: true,
          message: "No User Winner",
        });
      } else {
        console.log("else ");
        // const participated_usersWinner1 = gameUsersWinners1.rows.length;
        console.log("participated_usersWinner1", participated_usersWinner1);
        // console.log("participated_usersWinner1", participated_users);

        // get jackpot
        jackpot = parseFloat(entry_fee) * parseFloat(participated_usersWinner1);
        // deduct commision from jackpot
        const commission_amount =
          parseFloat(jackpot) * (parseFloat(commisssion) / 100);
        // deduct commission from jackpot
        jackpot = jackpot - commission_amount;

        winning_amount_single1 =
          parseFloat(jackpot) / parseFloat(gameUsersWinnersPartWin);
        const userWinCounts = userIdsArray.reduce((acc, { user_id }) => {
          acc[user_id] = (acc[user_id] || 0) + 1;
          return acc;
        }, {});

        for (const userId in userWinCounts) {
          // const user_id = gameUsersWinners1.rows[i].user_id;
          const winCount = userWinCounts[userId];
          const totalWinningAmount = winCount * winning_amount_single1;

          // Fetch user's current wallet balance in a single query
          const userWallet = await client.query(
            "SELECT balance FROM wallet WHERE user_id=$1 FOR UPDATE", // Lock the row
            [userId]
          );

          if (userWallet.rows.length === 0) {
            console.log(`User ${userId} wallet not found`);
            continue; // Skip to the next user if wallet is not found
          }

          // Calculate new balance
          const newBalance =
            parseFloat(userWallet.rows[0].balance) +
            parseFloat(totalWinningAmount);

          // Check if the user has enough balance to deduct
          if (newBalance < 0) {
            console.log(`User ${userId} does not have enough balance`);
            continue; // Skip this user if they don't have sufficient balance
          }
          // remove won game
          const winGames = await pool.query(
            "SELECT * FROM users WHERE user_id=$1",
            [userId]
          );
          if (winGames.rows.length > 0) {
            const winGame = await pool.query(
              "UPDATE users SET win_games=$1 WHERE user_id=$2 RETURNING *",
              [parseInt(winGames.rows[0].win_games) + parseInt(1), userId]
            );
          }
          // Update the user's wallet balance
          const updatedWallet = await client.query(
            "UPDATE wallet SET balance=$1 WHERE user_id=$2 RETURNING *",
            [newBalance, userId]
          );

          console.log(
            `Wallet updated for user ${userId}:`,
            updatedWallet.rows[0]
          );

          // Insert transaction into transaction history
          const transaction = await client.query(
            "INSERT INTO transaction_history (user_id, amount, type, game_id) VALUES ($1, $2, $3, $4) RETURNING *",
            [userId, totalWinningAmount, "added to wallet", game_id]
          );

          console.log(
            `Transaction recorded for user ${userId}:`,
            transaction.rows[0]
          );
        }
      }

      const gameUserWinnerReset = await pool.query(
        "UPDATE games SET winner_ball=$1,winning_amount=$2,commision_winning_amount=$3,participants=$4,winners=$5,winning_amount_single=$6 WHERE game_id=$7 RETURNING *",
        [
          reset_winner_ball,
          jackpot,
          commission_amount,
          participated_users,
          participated_usersWinner1,
          winning_amount_single1,
          game_id,
        ]
      );
      if (gameUserWinnerReset.rows.length > 0) {
        res.json({
          error: false,
          winner_ball_image_url: ballImageUrls[reset_winner_ball], // Add the URL of the winner ball

          game_details: gameUserWinnerReset.rows[0],
          participated_users: participated_users,
          winners: participated_usersWinner1,
          message: "Winner Reset Successfully",
        });
      } else {
        res.json({
          error: true,
          again_start_game: true,
          message: "Cant Reset Winner Ball Right Now !",
        });
      }
    } else {
      // reset_winner_ball
      const gameUsersWinnersP = await pool.query(
        "SELECT DISTINCT user_id FROM game_users WHERE game_id = $1",
        [game_id.toString()]
      );
      //         console.log("GAMEUSERWINNERS");
      let gameUsersWinnersPart = gameUsersWinnersP.rows.length;
      const gameUsersWinnersPW = await pool.query(
        "SELECT DISTINCT user_id FROM game_users WHERE game_id = $1 AND winning_ball = $2",
        [game_id.toString(), reset_winner_ball.toString()]
      );
      //         console.log("GAMEUSERWINNERS");
      let gameUsersWinnersPartWin = gameUsersWinnersPW.rows.length;
      let userIdsArray = gameUsersWinnersPW.rows.map((row) => ({
        user_id: row.user_id,
      }));
      console.log("ids user ");
      console.log(userIdsArray);

      const totalGameUsers = await pool.query(
        "SELECT COUNT(*) AS total FROM game_users WHERE game_id = $1",
        [game_id]
      );
      console.log("Total Game User Entries:", totalGameUsers.rows[0].total);

      // Step 2: Use a CTE to identify winning users and count all their entries
      //       const countQuery = `
      // WITH winning_users AS (
      //   SELECT DISTINCT user_id
      //   FROM game_users
      //   WHERE game_id = $1 AND winning_ball = $2
      // )
      // SELECT COUNT(*) AS winning_entries, ARRAY_AGG(user_id) AS winning_user_ids
      // FROM game_users
      // WHERE game_id = $1
      //   AND user_id IN (SELECT user_id FROM winning_users)
      // `;

      //       const countParams = [game_id.toString(), reset_winner_ball.toString()];

      //       const gameUsersCountResult = await pool.query(countQuery, countParams);

      //       console.log(
      //         "Winning Users Count (All Their Entries):",
      //         gameUsersCountResult.rows[0].winning_entries
      //       );
      //       let winningUsersCount = gameUsersCountResult.rows[0].winning_entries;
      //       const winningUserIds = gameUsersCountResult.rows[0].winning_user_ids;
      //       console.log("GAMEUSERWINNERS 1");
      //       console.log(winningUserIds);

      let participated_usersWinner1 = totalGameUsers.rows[0].total;
      // let actual_users_game_balls1 = winningUsersCount;
      // const gameUsersWinners1 = await pool.query(
      //   "SELECT DISTINCT user_id FROM game_users WHERE game_id = $1 AND winning_ball = $2",
      //   [game_id.toString(), reset_winner_ball.toString()]
      // );
      // console.log(gameUsersWinners1.rows);

      // let participated_usersWinner1 = gameUsersWinners1.rows.length;
      // let actual_users_game_balls1 = gameUsers.rows.length;
      // No record then no winner
      if (
        parseInt(gameUsersWinnersPartWin) === parseInt(0) ||
        parseInt(gameUsersWinnersPartWin) === null ||
        parseInt(gameUsersWinnersPartWin) === "null"
      ) {
        console.log("dshjdsh");
        return res.json({
          error: true,
          game_details: game_details,
          again_start_game: true,
          message: "No User Winner",
        });
      } else {
        console.log("else ");
        // const participated_usersWinner1 = gameUsersWinners1.rows.length;
        console.log("participated_usersWinner1", participated_usersWinner1);
        // console.log("participated_usersWinner1", participated_users);

        // get jackpot
        jackpot = parseFloat(entry_fee) * parseFloat(participated_usersWinner1);
        // deduct commision from jackpot
        const commission_amount =
          parseFloat(jackpot) * (parseFloat(commisssion) / 100);
        // deduct commission from jackpot
        jackpot = jackpot - commission_amount;

        winning_amount_single1 =
          parseFloat(jackpot) / parseFloat(gameUsersWinnersPartWin);
        const userWinCounts = userIdsArray.reduce((acc, { user_id }) => {
          acc[user_id] = (acc[user_id] || 0) + 1;
          return acc;
        }, {});

        for (const userId in userWinCounts) {
          // const user_id = gameUsersWinners1.rows[i].user_id;
          const winCount = userWinCounts[userId];
          const totalWinningAmount = winCount * winning_amount_single1;

          // Fetch user's current wallet balance in a single query
          const userWallet = await client.query(
            "SELECT balance FROM wallet WHERE user_id=$1 FOR UPDATE", // Lock the row
            [userId]
          );

          if (userWallet.rows.length === 0) {
            console.log(`User ${userId} wallet not found`);
            continue; // Skip to the next user if wallet is not found
          }

          // Calculate new balance
          const newBalance =
            parseFloat(userWallet.rows[0].balance) +
            parseFloat(totalWinningAmount);

          // Check if the user has enough balance to deduct
          if (newBalance < 0) {
            console.log(`User ${userId} does not have enough balance`);
            continue; // Skip this user if they don't have sufficient balance
          }
          // remove won game
          const winGames = await pool.query(
            "SELECT * FROM users WHERE user_id=$1",
            [userId]
          );
          if (winGames.rows.length > 0) {
            const winGame = await pool.query(
              "UPDATE users SET win_games=$1 WHERE user_id=$2 RETURNING *",
              [parseInt(winGames.rows[0].win_games) + parseInt(1), userId]
            );
          }
          // Update the user's wallet balance
          const updatedWallet = await client.query(
            "UPDATE wallet SET balance=$1 WHERE user_id=$2 RETURNING *",
            [newBalance, userId]
          );

          console.log(
            `Wallet updated for user ${userId}:`,
            updatedWallet.rows[0]
          );

          // Insert transaction into transaction history
          const transaction = await client.query(
            "INSERT INTO transaction_history (user_id, amount, type, game_id) VALUES ($1, $2, $3, $4) RETURNING *",
            [userId, totalWinningAmount, "added to wallet", game_id]
          );

          console.log(
            `Transaction recorded for user ${userId}:`,
            transaction.rows[0]
          );
        }
      }

      const gameUserWinnerReset = await pool.query(
        "UPDATE games SET winner_ball=$1,winning_amount=$2,commision_winning_amount=$3,participants=$4,winners=$5,winning_amount_single=$6 WHERE game_id=$7 RETURNING *",
        [
          reset_winner_ball,
          jackpot,
          commission_amount,
          participated_users,
          participated_usersWinner1,
          winning_amount_single1,
          game_id,
        ]
      );
      if (gameUserWinnerReset.rows.length > 0) {
        res.json({
          error: false,
          winner_ball_image_url: ballImageUrls[reset_winner_ball], // Add the URL of the winner ball

          game_details: gameUserWinnerReset.rows[0],
          participated_users: participated_users,
          winners: participated_usersWinner1,
          message: "Winner Reset Successfully",
        });
      } else {
        res.json({
          error: true,
          again_start_game: true,
          message: "Cant Reset Winner Ball Right Now !",
        });
      }
    }
  } catch (err) {
    console.log(err);
    res.json({ error: true, data: [], message: "Catch error" });
  } finally {
    client.release();
  }
};
//get all user games in which user participated

exports.getGameUserByGameId = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const ballImageUrls = await fetchBallImages();
    const { user_id } = req.query;
    const userData = await pool.query(
      "SELECT * FROM game_users WHERE user_id=$1",
      [user_id]
    );
    if (userData.rows.length === 0) {
      res.json({
        error: true,
        data: [],
        message: "Can't Get Games or Games data Empty",
      });
    } else {
      // Store game data with multiple user selections
      const gameMap = {};

      for (const userGame of userData.rows) {
        const user_selected_winning_ball = userGame.winning_ball;
        const game_id = userGame.game_id;

        if (!user_selected_winning_ball) {
          continue;
        }

        // Fetch game details only once for each game_id
        if (!gameMap[game_id]) {
          const game_details = await pool.query(
            "SELECT * FROM games WHERE game_id=$1",
            [game_id]
          );
          if (game_details.rows.length === 0) {
            console.log(`Game with id ${game_id} doesn't exist`);
            continue;
          }

          // Get game status and other data
          const game_statusData = game_details.rows[0].game_status;
          const winner_ball = game_details.rows[0].winner_ball;
          const played_at = game_details.rows[0].played_at;
          const winning_amount =
            Number(game_details.rows[0].winning_amount) % 1 === 0
              ? Number(game_details.rows[0].winning_amount)
              : Number(game_details.rows[0].winning_amount).toFixed(2);
          const winning_amount_single =
            Number(game_details.rows[0].winning_amount_single) % 1 === 0
              ? Number(game_details.rows[0].winning_amount_single)
              : Number(game_details.rows[0].winning_amount_single).toFixed(2);

          const game_users = await pool.query(
            "SELECT * FROM game_users WHERE game_id=$1",
            [game_id]
          );
          const total_participants = game_users.rows.length;

          gameMap[game_id] = {
            game_id,
            entry_fee: game_details.rows[0].entry_fee,
            commission: game_details.rows[0].commission,
            game_status: game_statusData,
            total_participants,
            winner_ball,
            winner_ball_image_url: ballImageUrls[winner_ball],
            played_at,
            winning_amount,
            winning_amount_single,
            user_selections: [],
            game_status_final: "Lost", // Default status
          };
        }

        // Determine user's status based on winning ball
        let UserStatus = "Lost";
        if (
          parseInt(user_selected_winning_ball) ===
          parseInt(gameMap[game_id].winner_ball)
        ) {
          UserStatus = "Win";
          gameMap[game_id].game_status_final = "Win"; // If any user wins, set the game status to Win
        } else if (parseInt(gameMap[game_id].winner_ball) === 0) {
          UserStatus = "House Wins";
          gameMap[game_id].game_status_final = "House Wins"; // If House Wins, override the status
        } else if (
          parseInt(gameMap[game_id].winner_ball) === 8 &&
          parseInt(user_selected_winning_ball) >= 1 &&
          parseInt(user_selected_winning_ball) <= 8
        ) {
          UserStatus = "Win";
          gameMap[game_id].game_status_final = "Win"; // If user wins, set to Win
        } else if (
          parseInt(gameMap[game_id].winner_ball) === 9 &&
          parseInt(user_selected_winning_ball) >= 9 &&
          parseInt(user_selected_winning_ball) <= 15
        ) {
          UserStatus = "Win";
          gameMap[game_id].game_status_final = "Win"; // Set to Win if user wins
        }

        // Add user selection for this game
        gameMap[game_id].user_selections.push({
          user_selected_winning_ball,
          user_selected_ball_image_url:
            ballImageUrls[user_selected_winning_ball],
          UserStatus,
        });
      }

      // Convert gameMap to an array
      const resulting_data = Object.values(gameMap)
        .map((game) => {
          // If the game_status_final is still "Lost" and there was no "Win" or "House Wins", it's "Lost"
          if (
            game.game_status_final !== "Win" &&
            game.game_status_final !== "House Wins"
          ) {
            game.game_status_final = "Lost";
          }

          return {
            ...game,
            game_status: game.game_status_final, // Set the final game status
          };
        })
        .sort((a, b) => new Date(b.played_at) - new Date(a.played_at));

      res.json({
        error: false,
        data: resulting_data,
        message: "Games Get Successfully",
      });
    }
  } catch (err) {
    console.log(err);
    res.json({ error: true, data: [], message: "Catch error" });
  } finally {
    client.release();
  }
};

// get game whose status is scheduled
exports.getScheduledGames = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const ballImageUrls = await fetchBallImages();
    const user_id = req.query.user_id;
    const userData = await pool.query(
      "SELECT * FROM games WHERE game_status != 'completed' ORDER BY game_id DESC LIMIT 1"
    );
    if (userData.rows.length === 0) {
      res.json({
        error: true,
        winnerScreen: true,
        data: [],
        message: "No Current game ",
      });
    } else {
      const restartedStatus = userData.rows[0].restarted;
      const restartedRound = userData.rows[0].restarted_round;
      const total_games = userData.rows.length;
      const game_status = userData.rows[0].game_status;
      let resulting_data = [];
      for (let i = 0; i < total_games; i++) {
        const game_id = userData.rows[i].game_id;
        const game_users = await pool.query(
          "SELECT * FROM game_users WHERE game_id=$1",
          [game_id]
        );
        const game_users1 = await pool.query(
          "SELECT COUNT(DISTINCT user_id) AS total_participants FROM game_users WHERE game_id=$1",
          [game_id]
        );
        const total_participants = game_users.rows.length;
        const actual_participants = game_users1.rows[0].total_participants;
        console.log("actual_participants", actual_participants);
        let jackpot = 0;
        if (game_status === "scheduled") {
          jackpot =
            parseFloat(userData.rows[i].entry_fee) *
            parseFloat(total_participants);
        } else {
          // substract commision amount from jackpot
          const commisssion = userData.rows[i].commission;
          const entry_fee = userData.rows[i].entry_fee;
          jackpot = parseFloat(entry_fee) * parseFloat(total_participants);
          const commission_amount =
            parseFloat(jackpot) * (parseFloat(commisssion) / 100);
          // deduct commission from jackpot
          jackpot = jackpot - commission_amount;
        }
        // Query to get the count of each winning_ball selected
        const ball_counts_result = await pool.query(
          "SELECT winning_ball, COUNT(*) FROM game_users WHERE game_id=$1 GROUP BY winning_ball",
          [game_id]
        );

        // Initialize ball_counts object with keys from 1 to 15, each set to 0
        let ball_counts = {};
        for (let j = 1; j <= 15; j++) {
          // ball_counts[j] = 0;
          // console.log(ballImageUrls[j]);
          ball_counts[j] = {
            count: 0,
            imageUrl: ballImageUrls[j], // Get the URL from the mapping
          };
        }

        // Update ball_counts with the actual counts
        for (let row of ball_counts_result.rows) {
          ball_counts[row.winning_ball] = {
            count: parseInt(row.count),
            imageUrl: ballImageUrls[row.winning_ball], // Get the URL from the mapping}
          };
        }

        const game_user_current = await pool.query(
          "SELECT * FROM game_users WHERE game_id=$1 AND user_id=$2",
          [game_id, user_id]
        );
        let user_participated = false;
        // let user_selcted_ball = 0;
        // let user_selcted_ball = [];
        let user_selected_ball_details = [];

        if (game_user_current.rows.length > 0) {
          user_participated = true;
          user_selected_ball_details = game_user_current.rows.map((row) => ({
            selected_ball: row.winning_ball,
            game_user_id: row.game_users_id,
            ball_image: ballImageUrls[row.winning_ball],
            round: row.round_no,
          }));
          // user_selcted_ball = game_user_current.rows[0].winning_ball;

          // user_selceted_ball_image_url =
          //   ballImageUrls[game_user_current.rows[0].winning_ball];
          // user_selcted_ball_game_user_id =
          //   game_user_current.rows[0].game_users_id;
        }

        const game_details = {
          game_id: game_id,
          entry_fee: userData.rows[i].entry_fee,
          commission: userData.rows[i].commission,
          game_status: userData.rows[i].game_status,
          total_participants: actual_participants,
          ball_counts_participants: ball_counts,
          user_participated: user_participated,
          user_selected_ball_details: user_selected_ball_details,
          restartedStatus: restartedStatus,
          restartedRound: restartedRound,
          // user_selcted_ball: user_selcted_ball,
          // user_selceted_ball_image_url: user_selceted_ball_image_url,
          // user_selcted_ball_game_user_id: user_selcted_ball_game_user_id,

          jackpot:
            Number(jackpot) % 1 === 0
              ? Number(jackpot)
              : Number(jackpot).toFixed(2),
        };
        resulting_data.push(game_details);
      }
      res.json({
        error: false,
        data: resulting_data,
        message: "Games Get Successfully",
      });
    }
  } catch (err) {
    console.log(err);
    res.json({ error: true, data: [], message: "Catch error" });
  } finally {
    client.release();
  }
};
// version 2 schedule game
exports.getScheduledGamesv2 = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const ballImageUrls = await fetchBallImages(); // Assuming a function that fetches ball image URLs
    const user_id = req.query.user_id;

    // Fetch all games with the required statuses
    const userData = await pool.query(
      "SELECT * FROM games WHERE game_status IN ('scheduled', 'waiting', 'started') ORDER BY game_id DESC"
    );

    if (userData.rows.length === 0) {
      return res.json({
        error: true,
        winnerScreen: true,
        data: [],
        message: "No current games available",
      });
    }

    let resulting_data = [];
    for (let game of userData.rows) {
      const game_id = game.game_id;
      const game_status = game.game_status;
      const restartedStatus = game.restarted;
      const restartedRound = game.restarted_round;

      // Fetch game users for the current game
      const game_users = await pool.query(
        "SELECT * FROM game_users WHERE game_id=$1",
        [game_id]
      );

      // Count total participants
      const total_participants_query = await pool.query(
        "SELECT COUNT(DISTINCT user_id) AS total_participants FROM game_users WHERE game_id=$1",
        [game_id]
      );
      const actual_participants = total_participants_query.rows[0]
        ? total_participants_query.rows[0].total_participants
        : 0;

      // Calculate jackpot
      let jackpot = 0;
      const entry_fee = parseFloat(game.entry_fee);
      const commission = parseFloat(game.commission);
      if (game_status === "scheduled") {
        jackpot = entry_fee * actual_participants;
      } else {
        const raw_jackpot = entry_fee * actual_participants;
        const commission_amount = raw_jackpot * (commission / 100);
        jackpot = raw_jackpot - commission_amount;
      }

      // Get ball counts for the game
      const ball_counts_result = await pool.query(
        "SELECT winning_ball, COUNT(*) AS count FROM game_users WHERE game_id=$1 GROUP BY winning_ball",
        [game_id]
      );

      let ball_counts = {};
      for (let i = 1; i <= 15; i++) {
        ball_counts[i] = {
          count: 0,
          imageUrl: ballImageUrls[i],
        };
      }
      for (let row of ball_counts_result.rows) {
        ball_counts[row.winning_ball] = {
          count: parseInt(row.count),
          imageUrl: ballImageUrls[row.winning_ball],
        };
      }

      // Check if the user participated in this game
      const game_user_current = await pool.query(
        "SELECT * FROM game_users WHERE game_id=$1 AND user_id=$2",
        [game_id, user_id]
      );

      let user_participated = false;
      let user_selected_ball_details = [];
      if (game_user_current.rows.length > 0) {
        user_participated = true;
        user_selected_ball_details = game_user_current.rows.map((row) => ({
          selected_ball: row.winning_ball,
          game_user_id: row.game_users_id,
          ball_image: ballImageUrls[row.winning_ball],
          round: row.round_no,
        }));
      }

      // Construct game details
      const game_details = {
        game_id: game_id,
        entry_fee: game.entry_fee,
        commission: game.commission,
        game_status: game_status,
        total_participants: actual_participants,
        ball_counts_participants: ball_counts,
        user_participated: user_participated,
        user_selected_ball_details: user_selected_ball_details,
        restartedStatus: restartedStatus,
        restartedRound: restartedRound,
        jackpot:
          Number(jackpot) % 1 === 0
            ? Number(jackpot)
            : Number(jackpot).toFixed(2),
      };

      resulting_data.push(game_details);
    }

    res.json({
      error: false,
      data: resulting_data,
      message: "Games fetched successfully",
    });
  } catch (err) {
    console.error("Error fetching games:", err);
    res.json({ error: true, data: [], message: "An error occurred" });
  } finally {
    client.release();
  }
};

// get latest game details if its completed by user id
// exports.getCompletedGameLatestByUserId = async (req, res, next) => {
//   const client = await pool.connect();
//   try {
//     const ballImageUrls = await fetchBallImages();
//     const { user_id } = req.query;
//     const userData = await pool.query(
//       "SELECT * FROM game_users WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1",
//       [user_id]
//     );
//     console.log(userData.rows)
//     if (userData.rows.length === 0) {
//       res.json({
//         error: true,
//         data: [],
//         message: "Can't Get Games or Games data Empty",
//       });
//     } else {
//       // get games with game game_details
//       const total_games = userData.rows.length;
//       console.log(userData.rows);
//       let resulting_data = [];
//       for (let i = 0; i < total_games; i++) {
//         let user_selected_winning_ball = userData.rows[0].winning_ball;

//         console.log(user_selected_winning_ball);

//         const game_id = userData.rows[0].game_id;
//         const game_details = await pool.query(
//           "SELECT * FROM games WHERE game_id=$1",
//           [game_id]
//         );
//         console.log(game_details.rows[0]);
//         let winners = game_details?.rows[0]?.winners;
//         const game_statusData = game_details.rows[0].game_status;
//         const winner_ball = game_details.rows[0].winner_ball;
//         const played_at = game_details.rows[0].played_at;
//         const winning_amount = game_details.rows[0].winning_amount;
//         const winning_amount_single =
//           game_details.rows[0].winning_amount_single;
//         let UserStatus = "Win";
//         if (parseInt(user_selected_winning_ball) === parseInt(winner_ball)) {
//           UserStatus = "Win";
//         } else if (parseInt(winner_ball) === parseInt(0)) {
//           UserStatus = "House Wins";
//         } else if (parseInt(winner_ball) === parseInt(8)) {
//           // if user selected winning ball is in 1 to 8 then user win
//           if (
//             parseInt(user_selected_winning_ball) >= parseInt(1) &&
//             parseInt(user_selected_winning_ball) <= parseInt(8)
//           ) {
//             UserStatus = "Win";
//           } else {
//             UserStatus = "Lost";
//           }
//         } else if (parseInt(winner_ball) === parseInt(9)) {
//           //  if user selected winning ball is in 9 to 15 then user win
//           if (
//             parseInt(user_selected_winning_ball) >= parseInt(9) &&
//             parseInt(user_selected_winning_ball) <= parseInt(15)
//           ) {
//             UserStatus = "Win";
//           } else {
//             UserStatus = "Lost";
//           }
//         } else {
//           UserStatus = "Lost";
//         }
//         // get total participants
//         const game_users = await pool.query(
//           "SELECT * FROM game_users WHERE game_id=$1",
//           [game_id]
//         );
//         const total_participants = game_users.rows.length;

//         if (game_statusData === "completed") {
//           const game_details_data = game_details.rows[0];
//           console.log("game_details_data", game_details_data);
//           const game_details_final = {
//             game_id: game_id,
//             entry_fee: game_details_data.entry_fee,
//             commission: game_details_data.commission,
//             game_status: UserStatus,
//             total_participants: total_participants,
//             winner_ball: winner_ball,
//             winner_ball_image_url: ballImageUrls[winner_ball], // Add the URL of the winner ball
//             user_selected_winning_ball: winners,
//             user_selected_ball_image_url:
//               ballImageUrls[user_selected_winning_ball], // Add the URL of the user selected ball
//             played_at: played_at,
//             winning_amount:
//               Number(winning_amount) % 1 === 0
//                 ? Number(winning_amount)
//                 : Number(winning_amount).toFixed(2),
//             winning_amount_single:
//               Number(winning_amount_single) % 1 === 0
//                 ? Number(winning_amount_single)
//                 : Number(winning_amount_single).toFixed(2),
//           };
//           resulting_data.push(game_details_final);
//         }
//       }
//       res.json({
//         error: false,
//         data: resulting_data,
//         message: "Games Get Successfully",
//       });
//     }
//   } catch (err) {
//     console.log(err);
//     res.json({ error: true, data: [], message: "Catch error" });
//   } finally {
//     client.release();
//   }
// };
exports.getCompletedGameLatestByUserId = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const ballImageUrls = await fetchBallImages();
    const { user_id } = req.query;
    const userData = await pool.query(
      "SELECT * FROM game_users WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1",
      [user_id]
    );
    console.log(userData.rows);
    if (userData.rows.length === 0) {
      res.json({
        error: true,
        data: [],
        message: "Can't Get Games or Games data Empty",
      });
    } else {
      let game_last_played_id = userData.rows[0].game_id;
      // get games with game game_details
      // get all user selected balls by game id and user id
      let user_selected_balls = await pool.query(
        "SELECT * FROM game_users WHERE user_id=$1 AND game_id=$2",
        [user_id, game_last_played_id]
      );
      console.log("user_selected_balls.rows");

      console.log(user_selected_balls.rows);
      // Query to count the unique game_id for the specified user_id
      const result = await pool.query(
        "SELECT COUNT(DISTINCT game_id) AS total_played_games FROM game_users WHERE user_id = $1",
        [user_id]
      );

      const totalPlayedGames = result.rows[0]?.total_played_games || 0;
      console.log("totalPlayedGames", totalPlayedGames);
      // const total_games = userData.rows.length;
      // console.log(userData.rows);
      // let resulting_data = [];
      // for (let i = 0; i < total_games; i++) {
      //   let user_selected_winning_ball = userData.rows[0].winning_ball;

      //   console.log(user_selected_winning_ball);

      //   const game_id = userData.rows[0].game_id;
      let game_details = await pool.query(
        "SELECT * FROM games WHERE game_id=$1",
        [game_last_played_id]
      );
      console.log(game_details.rows[0]);
      let winners = game_details?.rows[0]?.winners;
      const game_statusData = game_details.rows[0].game_status;
      let winner_ball = game_details.rows[0].winner_ball;
      let played_at = game_details.rows[0].played_at;
      let winning_amount = game_details.rows[0].winning_amount;
      let participants = game_details.rows[0].participants;
      let winning_amount_single = game_details.rows[0].winning_amount_single;
      // let UserStatus = "Win";

      // Extract all selected winning balls into an array
      const userSelectedBalls = user_selected_balls.rows.map((ball) =>
        parseInt(ball.winning_ball)
      );
      console.log("User selected balls:", userSelectedBalls);

      // Check the winner ball
      let userStatus = "Lost"; // Default to lost
      // const winnerBall = parseInt(gameDetails.rows[0].winner_ball); // Assuming you have `gameDetails`
      let matchingBalls = null;
      if (winner_ball === 0) {
        // If winner ball is 0, it's house wins
        userStatus = "House Wins";
      } else if (parseInt(winner_ball) === 8) {
        const winningRange = [1, 2, 3, 4, 5, 6, 7, 8];

        // Filter the user's selected balls to see which are in the winning range
        const matchingBalls1 = userSelectedBalls.filter((ball) =>
          winningRange.includes(ball)
        );

        if (matchingBalls1.length > 0) {
          userStatus = "Win";
          console.log(matchingBalls1.length);
          console.log("matchingBalls.length");
          matchingBalls = matchingBalls1.length;
          // Calculate winning amount based on the number of matching balls

          // console.log(`Winning amount for user: ${winningAmountForUser}`);
          // If winner ball is 8, check if any selected ball is between 1-8
          // if (userSelectedBalls.some((ball) => ball >= 1 && ball <= 8)) {
          //   userStatus = "Win";
          // }
        }
      } else if (parseInt(winner_ball) === 9) {
        const winningRange = [9, 10, 11, 12, 13, 14, 15];

        // Filter the user's selected balls to see which are in the winning range
        const matchingBalls1 = userSelectedBalls.filter((ball) =>
          winningRange.includes(ball)
        );

        if (matchingBalls1.length > 0) {
          userStatus = "Win";
          // Calculate winning amount based on the number of matching balls
          matchingBalls = matchingBalls1.length;

          // console.log(`Winning amount for user: ${winningAmountForUser}`);
          // If winner ball is 8, check if any selected ball is between 1-8
          // if (userSelectedBalls.some((ball) => ball >= 1 && ball <= 8)) {
          //   userStatus = "Win";
          // }
          // If winner ball is 9, check if any selected ball is between 9-14
          // if (userSelectedBalls.some((ball) => ball >= 9 && ball <= 14)) {
          //   userStatus = "Win";
        }
      } else {
        // Check if winner ball matches any selected ball
        if (userSelectedBalls.includes(parseInt(winner_ball))) {
          userStatus = "Win";
          matchingBalls = 1;
        }
      }

      console.log("User status:", userStatus);

      console.log(user_selected_balls);
      const userSelectedBallsArray = user_selected_balls.rows.map((ball) => {
        return {
          game_users_id: ball.game_users_id,
          game_id: ball.game_id,
          user_id: ball.user_id,
          winning_ball: ball.winning_ball,
          ball_image_url: ballImageUrls[ball.winning_ball], // Add ball image URL
          round_no: ball.round_no,
          created_at: ball.created_at,
          updated_at: ball.updated_at,
        };
      });

      console.log("User Selected Balls Array:", userSelectedBallsArray);
      user_selected_balls;
      const winning_amount_updated =
        parseFloat(winning_amount_single) * parseFloat(matchingBalls);
      const game_details_final = [
        {
          game_id: game_details.rows[0].game_id,
          entry_fee: game_details.rows[0].entry_fee,
          commission: game_details.rows[0].commission,
          game_status: userStatus, // Win, Lost, or House Wins
          total_participants: participants,
          winner_ball: winner_ball,
          winner_ball_image_url: ballImageUrls[winner_ball], // URL of the winner ball image
          user_selected_balls: userSelectedBallsArray, // Array of user selected ball objects
          played_at: played_at,
          winning_amount:
            Number(winning_amount) % 1 === 0
              ? Number(winning_amount)
              : Number(winning_amount).toFixed(2),
          winning_amount_single:
            Number(winning_amount_updated) % 1 === 0
              ? Number(winning_amount_updated)
              : Number(winning_amount_updated).toFixed(2),
        },
      ];

      console.log("Final Game Details:", game_details_final);
      // }
      // }
      res.json({
        error: false,
        data: game_details_final,
        message: "Games Get Successfully",
      });
    }
  } catch (err) {
    console.log(err);
    res.json({ error: true, data: [], message: "Catch error" });
  } finally {
    client.release();
  }
};

// get all games pagination
exports.getAllGamesPagination = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const ballImageUrls = await fetchBallImages();
    const { page, limit } = req.query;
    const offset = (page - 1) * limit;
    const userData = await pool.query(
      "SELECT * FROM games ORDER BY game_id ASC LIMIT $1 OFFSET $2",
      [limit, offset]
    );
    if (userData.rows.length === 0) {
      res.json({
        error: true,
        data: [],
        message: "Can't Get Games or Games data Empty",
      });
    } else {
      const total_games = userData.rows.length;
      let resulting_data = [];
      for (let i = 0; i < total_games; i++) {
        const game_id = userData.rows[i].game_id;
        const game_users = await pool.query(
          "SELECT * FROM game_users WHERE game_id=$1",
          [game_id]
        );
        const total_participants = game_users.rows.length;
        const game_details = {
          game_id: game_id,
          entry_fee: userData.rows[i].entry_fee,
          commission: userData.rows[i].commission,
          game_status: userData.rows[i].game_status,
          total_participants: total_participants,
        };
        resulting_data.push(game_details);
      }
      const Total_games = await pool.query("SELECT * FROM games");

      res.json({
        error: false,
        total_games: Total_games.rows.length,
        data: resulting_data,
        page_no: page,
        limit: limit,
        message: "Games Get Successfully",
      });
    }
  } catch (err) {
    res.json({ error: true, data: [], message: "Catch error" });
  } finally {
    client.release();
  }
};
// anounce result
// exapme
// else if (parseInt(winning_ball) === parseInt(8)) {
//   // if winning ball is 8
//   const gameUsersWinners1 = await pool.query(
//     "SELECT * FROM game_users WHERE game_id=$1 ",
//     [game_id]
//   );
//   // const gameUsersWinners = await pool.query(
//   //   "SELECT COUNT(DISTINCT user_id) AS unique_winners FROM game_users WHERE game_id=$1 AND CAST(winning_ball AS INTEGER) = ANY($2::INT[])",
//   //   [game_id, [1, 2, 3, 4, 5, 6, 7, 8]]
//   // );
//   const gameUsersWinners = await pool.query(
//     "SELECT DISTINCT user_id FROM game_users WHERE game_id = $1  AND CAST(winning_ball AS INTEGER) = ANY($2::INT[])",
//     [game_id.toString(), [1, 2, 3, 4, 5, 6, 7, 8]]
//   );
//   // No record then no winner
//   let participated_usersWinner = gameUsersWinners.rows.length;
//   let actual_users_game_balls = gameUsersWinners1.rows.length;

//   // if (gameUsersWinners.rows.length === 0) {
//   if (parseInt(participated_usersWinner) === parseInt(0)) {
//     return res.json({
//       error: true,
//       game_details: game_details,
//       again_start_game: true,
//       message: "No User Winner",
//     });
//   } else {
//     // const participated_usersWinner = gameUsersWinners.rows.length;
//     // get jackpot
//     jackpot = parseFloat(entry_fee) * parseFloat(actual_users_game_balls);
//     // deduct commision from jackpot
//     const commission_amount =
//       parseFloat(jackpot) * (parseFloat(commisssion) / 100);
//     // deduct commission from jackpot
//     jackpot = jackpot - commission_amount;
//     let winning_amount_single =
//       parseFloat(jackpot) / parseFloat(participated_usersWinner);
//     // add winning_amount_single to user wallet
//     for (let i = 0; i < participated_usersWinner; i++) {
//       const user_id = gameUsersWinners.rows[i].user_id;
//       const userWinGames = await pool.query(
//         "SELECT * FROM users WHERE user_id=$1",
//         [user_id]
//       );
//       if (userWinGames.rows.length > 0) {
//         const playedGame = await pool.query(
//           "UPDATE users SET win_games=$1 WHERE user_id=$2 RETURNING *",
//           [
//             parseFloat(userWinGames.rows[0].win_games) + parseFloat(1),
//             user_id,
//           ]
//         );
//         // add winning_amount_single to user wallet
//         const userWallet = await pool.query(
//           "SELECT * FROM wallet WHERE user_id=$1",
//           [user_id]
//         );
//         if (userWallet.rows.length > 0) {
//           const wallet = await pool.query(
//             "UPDATE wallet SET balance=$1 WHERE user_id=$2 RETURNING *",
//             [
//               parseFloat(userWallet.rows[0].balance) +
//                 parseFloat(winning_amount_single),
//               user_id,
//             ]
//           );
//           if (wallet.rows.length > 0) {
//             console.log("wallet updated");
//             const gameTransactions = await pool.query(
//               "INSERT INTO transaction_history (user_id, amount,type,game_id) VALUES ($1, $2,$3,$4) RETURNING *",
//               [user_id, winning_amount_single, "added to wallet", game_id]
//             );
//             console.log(gameTransactions.rows);
//           }
//         }
//         // end
//       }
//     }

//     // Update the game lastly
//     const played_at = new Date();
//     const gameUserWinner = await pool.query(
//       "UPDATE games SET winner_ball=$1, game_status=$2,winning_amount=$3,commision_winning_amount=$4,participants=$5,winners=$6,played_at=$7,winning_amount_single=$8 WHERE game_id=$9 RETURNING *",
//       [
//         winning_ball,
//         game_statusData,
//         jackpot,
//         commission_amount,
//         participated_users,
//         participated_usersWinner,
//         played_at,
//         winning_amount_single,
//         game_id,
//       ]
//     );
//     if (gameUserWinner.rows.length > 0) {
//       res.json({
//         error: false,
//         winner_ball_image_url: ballImageUrls[winning_ball], // Add the URL of the winner ball

//         game_details: gameUserWinner.rows[0],
//         participated_users: participated_users,
//         winners: participated_usersWinner,
//         message: "Result Announced Successfully",
//       });
//     } else {
//       res.json({
//         error: true,
//         message: "Cant Announce Winner Ball Right Now !",
//       });
//     }
//   }
// } else if (parseInt(winning_ball) === parseInt(9)) {
//   console.log("winning_ball23", winning_ball);
//   // if winning ball is 9
//   const gameUsersWinners1 = await pool.query(
//     "SELECT * FROM game_users WHERE game_id=$1",
//     [game_id]
//   );
//   // const gameUsersWinners = await pool.query(
//   //   "SELECT COUNT(DISTINCT user_id) AS unique_winners FROM game_users WHERE game_id=$1 AND CAST(winning_ball AS INTEGER) = ANY($2::INT[])",
//   //   [game_id, [9, 10, 11, 12, 13, 14, 15]]
//   // );
//   const gameUsersWinners = await pool.query(
//     "SELECT DISTINCT user_id FROM game_users WHERE game_id = $1  AND CAST(winning_ball AS INTEGER) = ANY($2::INT[])",
//     [game_id.toString(), [9, 10, 11, 12, 13, 14, 15]]
//   );
//   let participated_usersWinner = gameUsersWinners.rows.length;
//   console.log(participated_usersWinner);
//   let actual_users_game_balls = gameUsersWinners1.rows.length;
//   // No record then no winner
//   if (parseInt(participated_usersWinner) === parseInt(0)) {
//     return res.json({
//       error: true,
//       game_details: game_details,
//       again_start_game: true,
//       message: "No User Winner",
//     });
//   } else {
//     // const participated_usersWinner = gameUsersWinners.rows.length;
//     // get jackpot
//     jackpot = parseFloat(entry_fee) * parseFloat(actual_users_game_balls);
//     // deduct commision from jackpot
//     const commission_amount =
//       parseFloat(jackpot) * (parseFloat(commisssion) / 100);
//     // deduct commission from jackpot
//     jackpot = jackpot - commission_amount;
//     let winning_amount_single =
//       parseFloat(jackpot) / parseFloat(participated_usersWinner);

//     // add winning_amount_single to user wallet
//     for (let i = 0; i < parseInt(participated_usersWinner); i++) {
//       const user_id = gameUsersWinners.rows[i].user_id;
//       const userWinGames = await pool.query(
//         "SELECT * FROM users WHERE user_id=$1",
//         [user_id]
//       );
//       if (userWinGames.rows.length > 0) {
//         const playedGame = await pool.query(
//           "UPDATE users SET win_games=$1 WHERE user_id=$2 RETURNING *",
//           [
//             parseFloat(userWinGames.rows[0].win_games) + parseFloat(1),
//             user_id,
//           ]
//         );
//         // add winning_amount_single to user wallet
//         const userWallet = await pool.query(
//           "SELECT * FROM wallet WHERE user_id=$1",
//           [user_id]
//         );
//         if (userWallet.rows.length > 0) {
//           const wallet = await pool.query(
//             "UPDATE wallet SET balance=$1 WHERE user_id=$2 RETURNING *",
//             [
//               parseFloat(userWallet.rows[0].balance) +
//                 parseFloat(winning_amount_single),
//               user_id,
//             ]
//           );
//           if (wallet.rows.length > 0) {
//             console.log("wallet updated");
//             const gameTransactions = await pool.query(
//               "INSERT INTO transaction_history (user_id, amount,type,game_id) VALUES ($1, $2,$3,$4) RETURNING *",
//               [user_id, winning_amount_single, "added to wallet", game_id]
//             );
//             console.log(gameTransactions.rows);
//           }
//         }
//       }
//       // end
//     }

//     // end

//     // Update the game lastly
//     const played_at = new Date();
//     const gameUserWinner = await pool.query(
//       "UPDATE games SET winner_ball=$1, game_status=$2,winning_amount=$3,commision_winning_amount=$4,participants=$5,winners=$6,played_at=$7,winning_amount_single=$8 WHERE game_id=$9 RETURNING *",
//       [
//         winning_ball,
//         game_statusData,
//         jackpot,
//         commission_amount,
//         participated_users,
//         participated_usersWinner,
//         played_at,
//         winning_amount_single,
//         game_id,
//       ]
//     );
//     if (gameUserWinner.rows.length > 0) {
//       console.log("image", ballImageUrls[winning_ball]);

//       res.json({
//         error: false,
//         winner_ball_image_url: ballImageUrls[winning_ball], // Add the URL of the winner ball

//         game_details: gameUserWinner.rows[0],
//         participated_users: participated_users,
//         winners: participated_usersWinner,
//         message: "Result Announced Successfully",
//       });
//     } else {
//       res.json({
//         error: true,
//         message: "Cant Announce Winner Ball Right Now !",
//       });
//     }
//   }
// }
// end
exports.announceResultv2 = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { game_id, winning_balls, number_of_winners } = req.body;

    const gameData = await pool.query("SELECT * FROM games WHERE game_id=$1 ", [
      game_id,
    ]);

    if (gameData.rows.length === 0) {
      return res.json({ error: true, message: "Game not found" });
    }

    const gameDetails = gameData.rows[0];
    const entry_fee = parseFloat(gameDetails.entry_fee);
    const commission = parseFloat(gameDetails.commission);

    // Calculate total jackpot
    const totalParticipantsQuery = await pool.query(
      "SELECT COUNT(DISTINCT user_id) AS total_participants FROM game_users WHERE game_id=$1",
      [game_id]
    );
    let totalParticipants = totalParticipantsQuery.rows[0].total_participants;
    console.log("totalParticipants", totalParticipants);
    console.log("entry_fee", entry_fee);
    let jackpot = entry_fee * totalParticipants;
    console.log("jackpot", jackpot);
    const commissionAmount = jackpot * (commission / 100);
    console.log("commissionAmount", commissionAmount);
    jackpot -= commissionAmount;
    console.log("jackpot", jackpot);

    // Predefined distribution percentages
    const distribution = {
      1: [100],
      2: [60, 40],
      3: [50, 30, 20],
    };

    // // Check if the number of winners is valid
    if (!distribution[number_of_winners]) {
      return res.json({
        error: true,
        message: "Invalid number of winners. Allowed values are 1, 2, or 3.",
      });
    }

    // // Fetch winners
    const winners = [];
    for (let i = 0; i < number_of_winners; i++) {
      const ball = winning_balls[i];
      if (ball === 0) {
        winners.push({
          user_id: "house",
          ball,
          percentage: distribution[number_of_winners][i],
        });
      } else {
        const winnerQuery = await pool.query(
          "SELECT DISTINCT user_id FROM game_users WHERE game_id=$1 AND winning_ball=$2",
          [game_id, ball]
        );
        console.log("winnerQuery", winnerQuery.rows);
        if (winnerQuery.rows.length > 0) {
          winners.push({
            user_id: winnerQuery.rows[0].user_id,
            ball,
            percentage: distribution[number_of_winners][i],
          });
        } else {
          // winners.push({
          //   user_id: null,
          //   ball,
          //   percentage: distribution[number_of_winners][i],
          // });
        }
      }
    }
    console.log("winners", winners);

    // // // Allocate winnings
    for (const winner of winners) {
      const winningAmount = (jackpot * winner.percentage) / 100;

      if (winner.user_id === "house") {
        console.log(`House cut: ${winningAmount}`);
        // Save the house cut somewhere if needed
      } else if (winner.user_id) {
        // Update wallet for the winner
        const userWallet = await pool.query(
          "SELECT * FROM wallet WHERE user_id=$1",
          [winner.user_id]
        );
        if (userWallet.rows.length > 0) {
          const updatedBalance =
            parseFloat(userWallet.rows[0].balance) + winningAmount;

          await pool.query("UPDATE wallet SET balance=$1 WHERE user_id=$2", [
            updatedBalance,
            winner.user_id,
          ]);

          // Log transaction
          await pool.query(
            "INSERT INTO transaction_history (user_id, amount, type, game_id) VALUES ($1, $2, $3, $4)",
            [winner.user_id, winningAmount, "added to wallet", game_id]
          );
        }
      }
    }

    // // Update game details
    const winner_details = JSON.stringify(winners);
    const played_at = new Date();
    await pool.query(
      "UPDATE games SET game_status=$1, winning_amount=$2, number_of_winners=$3,winner_details=$6,participants=$7,winners=$8,winner_ball=$9, played_at=$4 WHERE game_id=$5",
      [
        "completed",
        jackpot,
        number_of_winners,
        played_at,
        game_id,
        winner_details,
        totalParticipants,
        winners.length,
        winning_balls,
      ]
    );

    res.json({
      error: false,
      message: "Result announced successfully",
      winners,
      jackpot,
    });
  } catch (err) {
    console.error(err);
    res.json({ error: true, message: "An error occurred" });
  } finally {
    client.release();
  }
};
exports.announceResult = async (req, res, next) => {
  // function calling
  // Example user data: Replace this with actual data from your database or API
  // const userSelections = [
  //   { userId: 1, username: "User1", selectedBall: 2 },
  //   { userId: 2, username: "User2", selectedBall: 3 },
  //   { userId: 3, username: "User3", selectedBall: 2 },
  //   { userId: 4, username: "User4", selectedBall: 15 },
  // ];

  // // Function to fetch users who selected a specific ball
  // function getUsersForBall(ball) {
  //   // Filter users based on their selected ball
  //   return userSelections.filter((user) => user.selectedBall === ball);
  // }

  // // Example usage
  // const selectedBall = 2; // Admin-selected ball
  // const usersForBall = getUsersForBall(selectedBall);

  // console.log(`Users for ball ${selectedBall}:`, usersForBall);
  // end
  // new logic
  // function distributeJackpot(entry_fee, participated_users, commission, winners) {
  //   // Calculate the initial jackpot
  //   let jackpot = parseFloat(entry_fee) * parseFloat(participated_users);

  //   // Deduct commission from jackpot
  //   const commission_amount = parseFloat(jackpot) * (parseFloat(commission) / 100);
  //   jackpot -= commission_amount;

  //   // Validate admin selection
  //   if (!winners || winners.length === 0 || winners.length > 3) {
  //     throw new Error("Admin must select between 1 and 3 winners.");
  //   }

  //   // Ensure unique and valid ball numbers
  //   const validBalls = winners.every(
  //     (ball) => ball >= 1 && ball <= 15 && winners.filter((b) => b === ball).length === 1
  //   );
  //   if (!validBalls) {
  //     throw new Error("Invalid or duplicate ball selection. Choose unique balls between 1 and 15.");
  //   }

  //   // Define distribution ratios
  //   const distributionRatios = {
  //     1: [1],
  //     2: [0.6, 0.4],
  //     3: [0.5, 0.3, 0.2],
  //   };

  //   const selectedRatios = distributionRatios[winners.length];
  //   let totalDistributed = 0;

  //   // Calculate amounts for each winner
  //   const winnerAmounts = winners.map((ball, index) => {
  //     const ratio = selectedRatios[index];
  //     const amount = jackpot * ratio;

  //     // Fetch users for this ball
  //     const usersForBall = getUsersForBall(ball); // Implement this function
  //     const numUsers = usersForBall.length;

  //     if (numUsers === 0) {
  //       console.warn(`No users selected ball ${ball}. Skipping distribution.`);
  //       return { ball, amount: 0, users: [] };
  //     }

  //     // Distribute amount equally among users of this ball
  //     const perUserAmount = amount / numUsers;
  //     totalDistributed += amount;

  //     return {
  //       ball,
  //       amount,
  //       users: usersForBall.map((user) => ({
  //         user,
  //         amount: perUserAmount,
  //       })),
  //     };
  //   });

  //   // Ensure total distribution matches the jackpot
  //   if (Math.abs(totalDistributed - jackpot) > 0.01) {
  //     throw new Error("Distribution error: Total does not match jackpot.");
  //   }

  //   return {
  //     jackpot,
  //     commission_amount,
  //     winnerAmounts,
  //   };
  // }

  // // Example usage:
  // const entry_fee = 10; // Example entry fee
  // const participated_users = 100; // Example number of participants
  // const commission = 10; // 10% commission
  // const winners = [2, 3, 15]; // Admin selected balls

  // try {
  //   const distribution = distributeJackpot(entry_fee, participated_users, commission, winners);
  //   console.log(distribution);
  // } catch (error) {
  //   console.error(error.message);
  // }

  // // Helper function to fetch users who selected a specific ball
  // function getUsersForBall(ball) {
  //   // Replace with actual logic to fetch users based on the selected ball
  //   return [
  //     { id: 1, name: "User1" },
  //     { id: 2, name: "User2" },
  //   ]; // Example users
  // }

  // end logic
  const client = await pool.connect();
  try {
    const ballImageUrls = await fetchBallImages();
    const { game_id, winning_ball } = req.body;
    const gameUser = await pool.query("SELECT * FROM games WHERE game_id=$1", [
      game_id,
    ]);
    console.log("winning_ball", winning_ball);
    if (gameUser.rows.length > 0) {
      // save game details
      let game_details = gameUser.rows[0];
      let entry_fee = gameUser.rows[0].entry_fee;
      let commisssion = gameUser.rows[0].commission;
      let game_statusData = "completed";
      let jackpot = 0;
      let commision_winning_amount = 0;
      // get all users count participated in this game
      const gameUsersAll = await pool.query(
        "SELECT COUNT(DISTINCT user_id) AS total_participants FROM game_users WHERE game_id=$1",
        [game_id]
      );
      const participated_users = gameUsersAll.rows[0].total_participants;
      // conballImageUrlsst gameUsersAll = await pool.query(
      //   "SELECT * FROM game_users WHERE game_id=$1",
      //   [game_id]
      // );
      // let participated_users = gameUsersAll.rows.length;
      console.log("users ");
      // console.log(gameUsersAll)

      // if winning_ball is 0
      if (parseInt(winning_ball) === parseInt(0)) {
        const gameUsersWinners1 = await pool.query(
          "SELECT * FROM game_users WHERE game_id=$1",
          [game_id]
        );
        const gameP = gameUsersWinners1.rows.length;
        jackpot = 0;
        commision_winning_amount = parseFloat(entry_fee) * parseInt(gameP);

        const played_at = new Date();
        const gameUserWinner = await pool.query(
          "UPDATE games SET winner_ball=$1, game_status=$2,winning_amount=$3,commision_winning_amount=$4,participants=$5,winners=$6,played_at=$7 WHERE game_id=$8 RETURNING *",
          [
            winning_ball,
            game_statusData,
            jackpot,
            commision_winning_amount,
            participated_users,
            0,
            played_at,
            game_id,
          ]
        );
        if (gameUserWinner.rows.length > 0) {
          res.json({
            error: false,
            winner_ball_image_url: ballImageUrls[winning_ball], // Add the URL of the winner ball
            game_details: gameUserWinner.rows[0],
            participated_users: participated_users,
            winners: 0,
            message: "Result Announced Successfully",
          });
        } else {
          res.json({
            error: true,
            again_start_game: true,
            message: "Cant Announce Winner Ball Right Now !",
          });
        }
      } else {
        // if winning ball is other than 9,8 and white 0
        console.log(winning_ball);

        const gameUsersWinnersP = await pool.query(
          "SELECT DISTINCT user_id FROM game_users WHERE game_id = $1",
          [game_id.toString()]
        );
        //         console.log("GAMEUSERWINNERS");
        let gameUsersWinnersPart = gameUsersWinnersP.rows.length;
        const gameUsersWinnersPW = await pool.query(
          "SELECT DISTINCT user_id FROM game_users WHERE game_id = $1 AND winning_ball = $2",
          [game_id.toString(), winning_ball.toString()]
        );
        //         console.log("GAMEUSERWINNERS");
        let gameUsersWinnersPartWin = gameUsersWinnersPW.rows.length;
        let userIdsArray = gameUsersWinnersPW.rows.map((row) => ({
          user_id: row.user_id,
        }));
        console.log("ids user ");
        console.log(userIdsArray);

        const totalGameUsers = await pool.query(
          "SELECT COUNT(*) AS total FROM game_users WHERE game_id = $1",
          [game_id]
        );
        console.log("Total Game User Entries:", totalGameUsers.rows[0].total);

        let participated_usersWinner = totalGameUsers.rows[0].total;
        // let actual_users_game_balls = winningUsersCount;

        console.log(gameUsersWinnersPartWin);
        // console.log("actual_users_game_balls");
        // console.log(actual_users_game_balls);
        console.log("participated_usersWinner");
        console.log(participated_usersWinner);

        if (
          parseInt(gameUsersWinnersPartWin) === parseInt(0) ||
          parseInt(gameUsersWinnersPartWin) === null ||
          parseInt(gameUsersWinnersPartWin) === "null"
        ) {
          console.log("dshjdsh");
          return res.json({
            error: true,
            game_details: game_details,
            again_start_game: true,
            message: "No User Winner",
          });
        } else {
          console.log("else ");
          // const participated_usersWinner = gameUsersWinners.rows.length;
          console.log("participated_usersWinner", participated_usersWinner);
          // console.log("participated_usersWinner", participated_users);

          // get jackpot
          jackpot =
            parseFloat(entry_fee) * parseFloat(participated_usersWinner);
          // deduct commision from jackpot
          const commission_amount =
            parseFloat(jackpot) * (parseFloat(commisssion) / 100);
          // deduct commission from jackpot
          jackpot = jackpot - commission_amount;

          const winning_amount_single =
            parseFloat(jackpot) / parseFloat(gameUsersWinnersPartWin);
          // update user win games of participated_usersWinners
          console.log(winning_amount_single);
          console.log(jackpot);

          // Create a map to track the count of wins for each user
          // const userWinCounts = winningUserIds.reduce((acc, userId) => {
          //   acc[userId] = (acc[userId] || 0) + 1;
          //   return acc;
          // }, {});
          const userWinCounts = userIdsArray.reduce((acc, { user_id }) => {
            acc[user_id] = (acc[user_id] || 0) + 1;
            return acc;
          }, {});

          for (const userId in userWinCounts) {
            const winCount = userWinCounts[userId];
            const totalWinningAmount = winCount * winning_amount_single;

            // const user_id = gameUsersWinners.rows[i].user_id;
            const userWinGames = await pool.query(
              "SELECT * FROM users WHERE user_id=$1",
              [userId]
            );
            if (userWinGames.rows.length > 0) {
              const playedGame = await pool.query(
                "UPDATE users SET win_games=$1 WHERE user_id=$2 RETURNING *",
                [
                  parseFloat(userWinGames.rows[0].win_games) + parseFloat(1),
                  userId,
                ]
              );
              // add winning_amount_single to user wallet
              const userWallet = await pool.query(
                "SELECT * FROM wallet WHERE user_id=$1",
                [userId]
              );
              if (userWallet.rows.length > 0) {
                console.log(
                  parseFloat(userWallet.rows[0].balance) +
                    parseFloat(totalWinningAmount)
                );
                console.log("AAAAAAAA");

                const wallet = await pool.query(
                  "UPDATE wallet SET balance=$1 WHERE user_id=$2 RETURNING *",
                  [
                    parseFloat(userWallet.rows[0].balance) +
                      parseFloat(totalWinningAmount),
                    userId,
                  ]
                );
                if (wallet.rows.length > 0) {
                  console.log("wallet updated");
                  const gameTransactions = await pool.query(
                    "INSERT INTO transaction_history (user_id, amount,type,game_id) VALUES ($1, $2,$3,$4) RETURNING *",
                    [userId, totalWinningAmount, "added to wallet", game_id]
                  );
                  console.log(gameTransactions.rows);
                }
              }
              // end
            }
          }

          // // Update the game lastly
          const played_at = new Date();
          const gameUserWinner = await pool.query(
            "UPDATE games SET winner_ball=$1, game_status=$2,winning_amount=$3,commision_winning_amount=$4,participants=$5,winners=$6,played_at=$7,winning_amount_single=$8 WHERE game_id=$9 RETURNING *",
            [
              winning_ball,
              game_statusData,
              jackpot,
              commission_amount,
              // participated_users,
              gameUsersWinnersPart,
              gameUsersWinnersPartWin,
              played_at,
              winning_amount_single,
              game_id,
            ]
          );
          if (gameUserWinner.rows.length > 0) {
            res.json({
              error: false,
              winner_ball_image_url: ballImageUrls[winning_ball], // Add the URL of the winner ball

              game_details: gameUserWinner.rows[0],
              participated_users: gameUsersWinnersPart,
              winners: gameUsersWinnersPartWin,
              message: "Result Announced Successfully",
            });
          } else {
            res.json({
              error: true,
              again_start_game: true,
              message: "Cant Announce Winner Ball Right Now !",
            });
          }
        }
      }
    } else {
      res.json({
        error: true,
        again_start_game: true,
        message: "Game Not Found",
      });
    }
  } catch (err) {
    console.log(err);
    res.json({ error: true, data: [], message: "Catch error" });
  } finally {
    client.release();
  }
};

// get games by year
exports.getGamesByYear = async (req, res) => {
  const client = await pool.connect();
  try {
    const ballImageUrls = await fetchBallImages();
    const year = req.query.year; // assuming the year is passed as a URL parameter
    const query = `
            SELECT EXTRACT(MONTH FROM created_at) AS month, COUNT(*) AS count
            FROM games
            WHERE EXTRACT(YEAR FROM created_at) = $1
            GROUP BY month
            ORDER BY month ASC
        `;
    const result = await pool.query(query, [year]);
    const counts = Array(12).fill(0); // initialize an array with 12 zeros
    for (const row of result.rows) {
      counts[row.month - 1] = row.count; // subtract 1 because months are 1-indexed
    }
    res.json({
      error: false,
      data: {
        January: counts[0],
        February: counts[1],
        March: counts[2],
        April: counts[3],
        May: counts[4],
        June: counts[5],
        July: counts[6],
        August: counts[7],
        September: counts[8],
        October: counts[9],
        November: counts[10],
        December: counts[11],
      },
      message: "Games Found",
    });
  } catch (err) {
    res.json({ error: true, data: [], message: "Catch error" });
  } finally {
    client.release();
  }
};
