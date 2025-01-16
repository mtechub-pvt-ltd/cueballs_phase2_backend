const { default: axios } = require("axios");
const { pool } = require("../../config/db.config");
const {
  email_note,
  getAccessToken,
  PaypalSandBoxUrlmV2,
} = require("../../paypal_keys");
// exports.createTransactionHistory = async (req, res) => {
//   const { user_id, amount, email } = req.body;
//   const client = await pool.connect();
//   try {
//     // Fetch user data
//     const userData = await pool.query("SELECT * FROM users WHERE user_id=$1", [
//       user_id,
//     ]);
//     if (userData.rows.length === 0) {
//       return res.json({ error: true, message: "User Not Found!" });
//     }

//     let user_email = userData.rows[0].email;

//     // Fetch user wallet data
//     const userWalletData = await pool.query("SELECT * FROM wallet WHERE user_id=$1", [user_id]);
//     if (userWalletData.rows.length === 0) {
//       return res.json({ error: true, message: "User wallet Not Found!" });
//     }

//     const userWalletBalance = userWalletData.rows[0].balance;
//     if (parseInt(userWalletBalance) < parseInt(amount)) {
//       return res.json({ error: true, message: "Insufficient balance!" });
//     }

//     // --------------------------- Payout
//     // Get PayPal Access Token
//     const accessToken = await getAccessToken();

//     const payoutResponse = await fetch(`${PaypalSandBoxUrlmV2}/payments/payouts`, {
//       method: "POST",
//       headers: {
//         Authorization: `Bearer ${accessToken}`,
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({
//         sender_batch_header: {
//           sender_batch_id: `batch_${Date.now()}`,
//           email_subject: "You have a payout!",
//           email_message: "You have received a payout! Thanks for using our service.",
//         },
//         items: [
//           {
//             recipient_type: "EMAIL",
//             amount: {
//               value: amount,
//               currency: "USD",
//             },
//             receiver: email,
//             note: `Payout to ${email}`,
//             sender_item_id: `item_${Date.now()}`,
//           },
//         ],
//       }),
//     });

//     // Handle potential errors with the response
//     if (!payoutResponse.ok) {
//       const errorText = await payoutResponse.text();
//       console.error("PayPal API Error:", errorText);
//       return res.json({ error: true, message: "Error processing payout", details: errorText });
//     }

//     // Parse JSON response from PayPal
//     const payoutData = await payoutResponse.json();
//     console.log("Payout Response:", payoutData);

//     // Proceed with transaction logging
//     // (Your transaction history logic here...)

//     res.json({
//       error: false,
//       message: "Transaction successfully processed",
//       data: payoutData,
//     });

//   } catch (error) {
//     console.error("Error in createTransactionHistory:", error.message);
//     res.status(500).json({ error: true, message: "Internal Server Error" });
//   } finally {
//     client.release();
//   }
// };

exports.createTransactionHistory = async (req, res) => {
  const { user_id, amount, email } = req.body;
  const client = await pool.connect();
  try {
    // const accessToken = await getAccessToken();
    // const payoutResponse = await fetch('https://api-m.sandbox.paypal.com/v1/payments/payouts', {
    //     method: 'POST',
    //     headers: {
    //         'Authorization': `Bearer ${accessToken}`,
    //         'Content-Type': 'application/json',
    //     },
    //     body: JSON.stringify({
    //         sender_batch_header: {
    //             sender_batch_id: `batch_${Date.now()}`,
    //             email_subject: 'You have a payout!',
    //             email_message: 'You have received a payout! Thanks for using our service.'
    //         },
    //         items: [{
    //             recipient_type: 'EMAIL',
    //             amount: {
    //                 value: amount,
    //                 currency: 'USD'
    //             },
    //             receiver: "sb-9b2qe31970612@personal.example.com",
    //             note: email_note,
    //             sender_item_id: `item_${Date.now()}`
    //         }]
    //     })
    // });

    // const payoutData = await payoutResponse.json();
    // const { batch_header, links } = payoutData;
    // const status = batch_header.batch_status;

    // console.log(batch_header);
    // console.log(status);
    // res.json({ PaypalWithdrawObject: batch_header, status_Payment: status, links: links });

    // check user id exist or not
    const userData = await pool.query("SELECT * FROM users WHERE user_id=$1", [
      user_id,
    ]);
    if (userData.rows.length === 0) {
      res.json({ error: true, message: "User Not Found!" });
    } else {
      // user email
      let user_email = userData.rows[0].email;
      // check balance from user wallet
      const userWalletData = await pool.query(
        "SELECT * FROM wallet WHERE user_id=$1 AND type=$2",

        [user_id, "withdrawl"]
      );
      if (userWalletData.rows.length === 0) {
        res.json({ error: true, message: "User wallet Not Found!" });
      } else {
        const userWalletBalance = userWalletData.rows[0].balance;
        if (parseInt(userWalletBalance) < parseInt(amount)) {
          res.json({ error: true, message: "Insufficient balance!" });
        } else {
          // ---------------------------Payout
          // Get an access token
          const accessToken = await getAccessToken();
          const payoutResponse = await fetch(
            `${PaypalSandBoxUrlmV2}/payments/payouts`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                sender_batch_header: {
                  sender_batch_id: `batch_${Date.now()}`,
                  email_subject: "You have a payout!",
                  email_message:
                    "You have received a payout! Thanks for using our service.",
                },
                items: [
                  {
                    recipient_type: "EMAIL",
                    amount: {
                      value: amount,
                      currency: "USD",
                    },
                    // receiver: user_email,
                    receiver: email,

                    note: email_note,
                    sender_item_id: `item_${Date.now()}`,
                  },
                ],
              }),
            }
          );

          const payoutData = await payoutResponse.json();
          const { batch_header, links } = payoutData;
          const status = batch_header.batch_status;

          console.log(batch_header);
          console.log(status);

          // ---------------------------Payout
          const type = "withdraw";
          const userDataTransaction = await pool.query(
            "INSERT INTO transaction_history(user_id,amount,type) VALUES($1,$2,$3) returning *",
            [user_id, amount, type]
          );
          if (userDataTransaction.rows.length > 0) {
            // update wallet
            const userWallet = await pool.query(
              "UPDATE wallet SET balance=$1 WHERE user_id=$2 AND type=$3 RETURNING *",
              [
                parseFloat(userWalletBalance) - parseFloat(amount),
                user_id,
                "withdrawl",
              ]
            );
            if (userWallet.rows.length > 0) {
              // res.json({ PaypalWithdrawObject: batch_header, status_Payment: status, links: links });

              res.status(200).json({
                PaypalWithdrawObject: batch_header,
                status_Payment: status,
                links: links,
                message: "Transaction history created successfully",
                data: userDataTransaction.rows[0],
              });
            } else {
              res
                .status(400)
                .json({ message: "Transaction history not created" });
            }
          } else {
            res
              .status(400)
              .json({ message: "Transaction history not created" });
          }
        }
      }
    }
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal server error" });
  } finally {
    client.release();
  }
};
// get all transactions by user id
exports.getAllTransactionsByUserId = async (req, res) => {
  const { user_id } = req.query;
  const client = await pool.connect();
  try {
    const query =
      "SELECT * FROM transaction_history WHERE user_id=$1 ORDER BY created_at DESC";
    const result = await pool.query(query, [user_id]);
    res.status(200).json({ message: "All transactions", data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  } finally {
    client.release();
  }
};
// get wallet value by user id
exports.getWalletValueByUserId = async (req, res) => {
  const { user_id } = req.query;
  const client = await pool.connect();
  try {
    const query = "SELECT * FROM wallet WHERE user_id=$1 AND type=$2";
    const result = await pool.query(query, [user_id, "deposit"]);
    // if user doesnot exist then return 0
    if (result?.rows?.length === 0) {
      res.status(200).json({
        message: "Wallet value",
        deposit_balance: 0,
        withdrawl_balance: 0,
        total_won_games: 0,
        total_played_games: 0,
        total_lose_games: 0,
      });
    } else {
      const queryw = "SELECT * FROM wallet WHERE user_id=$1 AND type=$2";
      const resultw = await pool.query(queryw, [user_id, "withdrawl"]);

      const query1 = "SELECT * FROM users WHERE user_id=$1";
      const result1 = await pool.query(query1, [user_id]);
      const total_played_games = result1?.rows[0]?.played_games;
      const total_won_games = result1?.rows[0]?.win_games;
      const total_lose_games =
        parseInt(total_played_games) - parseInt(total_won_games);

      res.status(200).json({
        message: "Wallet value",
        deposit_balance:
          Number(result?.rows[0]?.balance || 0) % 1 === 0
            ? Number(result?.rows[0]?.balance || 0)
            : Number(result?.rows[0]?.balance || 0).toFixed(2),
        withdrawl_balance:
          Number(resultw?.rows[1]?.balance || 0) % 1 === 0
            ? Number(resultw?.rows[1]?.balance || 0)
            : Number(resultw?.rows[1]?.balance || 0).toFixed(2),
        total_won_games: result1?.rows[0].win_games,
        total_played_games: result1.rows[0]?.played_games,
        total_lose_games: total_lose_games,
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  } finally {
    client.release();
  }
};
