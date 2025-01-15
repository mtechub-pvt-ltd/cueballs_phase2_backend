const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv')
const bodyParser = require("body-parser");
const pool = require("./app/config/dbconfig")
const app = express();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
// const waveform = require('waveform-node');
const port = 5021;
const socketIo = require('socket.io');
const http = require('http');
const admin = require('firebase-admin');
const serviceAccount = require('./firebase.json');

// initialzie firebase admin
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});
// set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);
// redis working 

const redis = require('redis');
const redisClient = redis.createClient();

redisClient.on('connect', () => {
    console.log('Connected to Redis');
});

redisClient.on('error', (err) => {
    console.error('Redis error:', err);
});

// Connect to Redis
redisClient.connect();


dotenv.config();

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(cors({
    methods: ['GET', 'POST', 'DELETE', 'UPDATE', 'PUT', 'PATCH'],
}));

app.use(express.json())

app.use("/user", require("./app/routes/users/userRoutes"))
app.use("/questions", require("./app/routes/questions/questionRoutes"))
app.use("/answers", require("./app/routes/answers/answersRoutes"))
app.use("/images", require("./app/routes/images/imageRoutes"))
app.use("/user/log", require("./app/routes/usercardlog/userCardLogRoutes"))
app.use("/calls", require("./app/routes/calling/callRoutes"))
app.use("/connections", require("./app/routes/connections/connectionRoutes"))
app.use("/chats", require("./app/routes/chats/chatRoutes"))
app.use("/users", require("./app/routes/reports/reportRoutes"))
app.use("/notifications", require("./app/routes/notifications/notificationRoutes"))
app.use("/user", require("./app/routes/disqualifyuser/disqualifyUserRoutes"))
app.use("/chat", require("./app/routes/chatreview/chatReviewRoutes"))
app.use("/joker", require("./app/routes/sendjoker/sendJokerRoutes"))
app.use("/advertisement", require("./app/routes/advertisement/advertizementRoutes"))
app.use("/subscription", require("./app/routes/subscription/subscriptionRoutes"))
app.use("/session", require("./app/routes/aicoach/aiCoachSessionRoutes"))

app.get('/', (req, res) => {
    res.json({ message: 'Fate!' });
});

app.post('/waveform', async (req, res) => {
    const { cloudinaryUrl } = req.body;

    if (!cloudinaryUrl) {
        return res.status(400).send({ error: 'Cloudinary URL is required' });
    }

    try {
        // Step 1: Download the audio file
        const tempFilePath = path.join(__dirname, 'temp_audio.mp3');
        const writer = fs.createWriteStream(tempFilePath);
        const response = await axios.get(cloudinaryUrl, { responseType: 'stream' });

        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        // Step 2: Generate waveform as PNG
        const waveformImagePath = path.join(__dirname, 'waveform.png');

        ffmpeg(tempFilePath)
            .complexFilter('showwavespic=s=640x120:colors=blue')
            .on('end', () => {
                console.log('Waveform image generated successfully');
                const imageBuffer = fs.readFileSync(waveformImagePath);

                // Cleanup temporary files
                fs.unlinkSync(tempFilePath);
                fs.unlinkSync(waveformImagePath);

                // Send the image buffer as a base64 string
                const base64Image = imageBuffer.toString('base64');
                res.status(200).json({ waveformImage: `data:image/png;base64,${base64Image}` });
            })
            .on('error', (err) => {
                console.error('FFMPEG Error:', err);
                res.status(500).send({ error: 'Error generating waveform image' });
            })
            .save(waveformImagePath);
    } catch (error) {
        console.error('Error processing request:', error);
        res.status(500).send({ error: 'Internal server error' });
    }
});




app.get('/messages/v1/getAll', async (req, res) => {
    // WHERE deleted_from = false
    try {
        const result = await pool.query('SELECT * FROM chats  WHERE deleted_from = false');
        res.json({ msg: "All messges fetched", error: false, count: result.rows.length, data: result.rows });
    } catch (error) {
        console.error('Error fetching messages from the database:', error);
        res.status(500).json({ error: true, msg: 'Internal Server Error' });
    }
});

app.get('/messages/v1/getByUser/:senderId', async (req, res) => {
    const senderId = req.params.senderId;

    try {
        const result = await pool.query(
            `SELECT 
              u.id as receiver_id,
              u.name as receiver_name,
              u.email as receiver_email,
              u.profile_image as receiver_profile_image,
              MAX(c.message) as last_message,
              MAX(c.created_at) as created_at,
              COUNT(CASE WHEN c.read_status = FALSE THEN 1 END) as unread_status
          FROM 
              users u
          LEFT JOIN chats c ON u.id = c.receiver_id
          WHERE 
              c.sender_id = $1
          GROUP BY 
              u.id, u.name, u.email, u.profile_image
          ORDER BY 
              MAX(c.created_at) DESC`,
            [senderId]
        );

        if (result.rows.length > 0) {
            res.json({ error: false, data: result.rows });
        } else {
            res.status(404).json({ error: true, msg: 'No contacts found for the sender' });
        }
    } catch (error) {
        console.error('Error fetching sender contacts:', error);
        res.status(500).json({ error: true, msg: 'Internal server error' });
    }
});

app.put('/messages/v1/updateReadStatus', async (req, res) => {
    const { senderId, receiverId } = req.body;

    try {
        // Update the read status
        const result = await pool.query(
            'UPDATE chats SET read_status = TRUE WHERE sender_id = $1 AND receiver_id = $2',
            [senderId, receiverId]
        );

        if (result.rowCount > 0) {
            // Fetch sender details
            const senderResult = await pool.query('SELECT * FROM users WHERE id = $1', [senderId]);
            const sender = senderResult.rows[0];

            // Fetch receiver details
            const receiverResult = await pool.query('SELECT * FROM users WHERE id = $1', [receiverId]);
            const receiver = receiverResult.rows[0];

            // Construct response object
            const data = {
                sender: sender,
                receiver: receiver
            };

            res.json({ error: false, msg: 'Read status updated successfully', data: data });
        } else {
            res.status(404).json({ error: true, msg: 'No messages found with the given sender and receiver' });
        }
    } catch (error) {
        console.error('Error updating read status:', error);
        res.status(500).json({ error: true, msg: 'Internal server error' });
    }
});

app.get('/messages/v1/getByUsers/:senderId/:receiverId', async (req, res) => {
    const { senderId, receiverId } = req.params;

    try {
        const result = await pool.query(
            'SELECT * FROM chats WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1) AND deleted_from = false ORDER BY created_at ASC',
            [senderId, receiverId]
        );

        if (result.rowCount === 0) {
            // No matching records found or all matching records have deleted_from as true
            res.status(404).json({ error: true, msg: 'Chat not found' });
        } else {
            res.json({ msg: "Messages fetched for the sender and receiver", error: false, data: result.rows });
        }
    } catch (error) {
        console.error('Error fetching messages for the sender and receiver from the database:', error);
        res.status(500).json({ error: true, msg: 'Internal Server Error' });
    }
});

app.delete('/messages/v1/deleteChat/:senderId/:receiverId', async (req, res) => {
    const { senderId, receiverId } = req.params;

    try {
        const result = await pool.query(
            'UPDATE chats SET deleted_from = true WHERE sender_id = $1 AND receiver_id = $2 RETURNING *',
            [senderId, receiverId]
        );

        if (result.rowCount === 0) {
            // No matching records found
            res.status(404).json({ error: true, msg: 'No matching records found for the given sender and receiver IDs' });
        } else {
            res.json({ msg: 'Messages marked as deleted for the sender and receiver', error: false, data: result.rows });
        }
    } catch (error) {
        console.error('Error updating deleted_from status in the database:', error);
        res.status(500).json({ error: true, msg: 'Internal Server Error' });
    }
});
app.put('/messages/v1/markAsRead', async (req, res) => {
    const { senderId, receiverId } = req.body;

    try {
        const result = await pool.query(
            'UPDATE messages SET read_status = true,status=$1 WHERE sender_id = $2 AND receiver_id = $3 AND read_status = false',
            ['read', senderId, receiverId]
        );

        if (result.rowCount > 0) {
            res.json({ error: false, msg: 'Messages marked as read' });
        } else {
            res.status(404).json({ error: true, msg: 'No unread messages found' });
        }
    } catch (error) {
        console.error('Error updating read status:', error);
        res.status(500).json({ error: true, msg: 'Internal server error' });
    }
});


// firebase api 

app.post('/send-notification', async (req, res) => {
    const { title, body, imageUrl, data } = req.body;
    // const token = "fh1AgtTylk5jiayvkifOTo:APA91bEHCoM65vvG9PK66PUc1_HwxXIr8FxA-gM_NRakgeQbzfMmi6jhBAWjXz_MhEPVXde0thGW7jlxKPblhC0Afosd9x00hJGp0BTi2ymbT7v4hvlL5DWOQKB_tkdi2ZfP1RM-ymHP";
    const token = "cFMdmmlaj0gFrJSP-fwzoy:APA91bGe7ZPtXU0teXo5idct9LyDCI5ukO3OCnho1TO575cuPbtJGe9bPrDtOpioDpyVd2ZljQo0fV-zYlKZJZV6AwEPI-QISlQqdIS4vxUzd7tpAoaW0pfzOkKL8RIF0b_rh5HKdPQ2";
    const message = {
        notification: {
            title,
            body,
            imageUrl,
        },
        token, // Device token
        data, // Optional: if you want to send additional data
    };

    try {
        const response = await admin.messaging().send(message);

        res.status(200).json({ message: 'Notification sent successfully', response });

    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

const getUserFcmToken = async (userId) => {
    const query = 'SELECT * FROM users WHERE id = $1';
    const { rows } = await pool.query(query, [userId]);

    const newData = rows[0];
    return newData;
};
const getCallerDetail = async (userId) => {
    const query = 'SELECT * FROM users WHERE id = $1';
    const { rows } = await pool.query(query, [userId]);

    const newData = rows[0];
    return newData;
};


app.post('/initiate-call', async (req, res) => {
    const { callerId, receiverId, callType } = req.body;

    // Logic to fetch the receiver's FCM token from the database
    const token = await getUserFcmToken(receiverId);
    const caller = await getCallerDetail(callerId);

    const message = {
        notification: {
            title: 'Incoming Call',
            body: `You have an incoming ${callType.toLowerCase()} call from ${caller?.name} , Tap to answer`,
        },
        token: token.device_id,
        data: {
            // to string
            callerId: callerId?.toString() ? callerId?.toString() : 'null',
            callType: callType?.toString() ? callType?.toString() : 'null',
            receiverId: receiverId?.toString() ? receiverId?.toString() : 'null',
            callerName: caller.name?.toString() ? caller.name?.toString() : 'null',
            callerImage: caller.profile_image?.toString(),
        },
    };

    try {
        const response = await admin.messaging().send(message);
        res.status(200).json({ success: true, response });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});
app.post('/initiate-rullet-call', async (req, res) => {
    const { callerId, receiverId, callType } = req.body;

    // Logic to fetch the receiver's FCM token from the database
    const token = await getUserFcmToken(receiverId);
    const caller = await getCallerDetail(callerId);

    const message = {
        notification: {
            title: 'Incoming Rullet Call',
            body: `You have an incoming Rullet call from ${caller?.name} , Tap to answer`,
        },
        token: token.device_id,
        data: {
            // to string
            callerId: callerId?.toString() ? callerId?.toString() : 'null',
            callType: callType?.toString() ? callType?.toString() : 'null',
            receiverId: receiverId?.toString() ? receiverId?.toString() : 'null',
            callerName: caller.name?.toString() ? caller.name?.toString() : 'null',
            callerImage: caller.profile_image?.toString(),
        },
    };

    try {
        const response = await admin.messaging().send(message);
        res.status(200).json({ success: true, response });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});
app.post('/declineVideo-call', async (req, res) => {
    const { callerId, receiverId, callType } = req.body;

    // Logic to fetch the receiver's FCM token from the database
    const token = await getUserFcmToken(callerId);
    const caller = await getCallerDetail(receiverId);

    const message = {
        notification: {
            title: 'call declined',
            body: `You have declined ${callType.toLowerCase()}`,
        },
        token: token.device_id,
        data: {
            // to string
            callerId: callerId?.toString() ? callerId?.toString() : 'null',
            callType: callType?.toString() ? callType?.toString() : 'null',
            receiverId: receiverId?.toString() ? receiverId?.toString() : 'null',
            callerName: caller.name,
        },
    };

    try {
        const response = await admin.messaging().send(message);
        res.status(200).json({ success: true, response });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});
app.post('/declineRullet-call', async (req, res) => {
    const { callerId, receiverId, callType } = req.body;

    // Logic to fetch the receiver's FCM token from the database
    const token = await getUserFcmToken(callerId);
    const caller = await getCallerDetail(receiverId);

    const message = {
        notification: {
            title: 'Rullet call declined',
            body: `Your Rullet call has been declined`,
        },
        token: token.device_id,
        data: {
            // to string
            callerId: callerId?.toString() ? callerId?.toString() : 'null',
            callType: callType?.toString() ? callType?.toString() : 'null',
            receiverId: receiverId?.toString() ? receiverId?.toString() : 'null',
            callerName: caller.name,
        },
    };

    try {
        const response = await admin.messaging().send(message);
        res.status(200).json({ success: true, response });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});







// ######################################




// socker io implementation
const server = http.createServer(app);
const io = socketIo(server);


// add in db

const saveMessage = async (roomId, senderId, receiverId, content, timestamp1, read_status, status) => {
    console.log("timestamp1", timestamp1)
    const query = 'INSERT INTO messages (chat_room_id, sender_id, receiver_id, content,timestamp1,read_status,status) VALUES ($1, $2, $3, $4, $5, $6,$7) returning *';
    return await pool.query(query, [roomId, senderId, receiverId, content, timestamp1, read_status, status]);
};

const getMessagesByRoom = async (roomId) => {
    // mark all messages as read
    const updateQuery = 'UPDATE messages SET read_status = true ,status=$1 WHERE chat_room_id = $2';
    await pool.query(updateQuery, ['read', roomId]);

    const query = 'SELECT * FROM messages WHERE chat_room_id = $1 ORDER BY created_at ASC';
    const { rows } = await pool.query(query, [roomId]);
    return rows;
};

// Create room name from user IDs
const createRoomName = (userId1, userId2) => {
    const userIds = [userId1, userId2].sort();
    return `room_${userIds[0]}_${userIds[1]}`;
};





// ! rullet new working 

app.get('/getFateRulletUsersMatchFromWaitingPool', async (req, res) => {
    try {
        const { user_id } = req.query; // The ID of the user initiating the match
        console.log("Starting fate roulette matching for call with user:", user_id);

        // Fetch the initiating user's details
        const userQuery = `SELECT * FROM users WHERE id = $1`;
        const userResult = await pool.query(userQuery, [user_id]);
        const user = userResult.rows[0];

        if (!user) {
            return res.status(404).json({
                error: true,
                msg: "User not found.",
            });
        }

        const { alo_level: userElo, age, prefered_gender: gender } = user;
        const minElo = userElo - 45;
        const maxElo = userElo + 45;

        // Get all user IDs in the waiting pool from Redis
        const waitingPoolIds = await redisClient.sMembers('waitingPool');
        console.log("Waiting pool IDs:", waitingPoolIds);

        const potentialMatches = [];

        for (const id of waitingPoolIds) {
            if (id === user_id.toString()) continue; // Skip the initiating user

            // Fetch potential match's details
            const matchQuery = `SELECT id, alo_level, age, gender FROM users WHERE id = $1`;
            const matchResult = await pool.query(matchQuery, [id]);
            const potentialMatch = matchResult.rows[0];

            if (
                potentialMatch &&
                potentialMatch.alo_level >= minElo &&
                potentialMatch.alo_level <= maxElo &&
                potentialMatch.id !== user_id.toString() // Ensure the current user is not matched
            ) {
                potentialMatches.push(potentialMatch);
            }
        }

        // Select a random match from potentialMatches
        if (potentialMatches.length > 0) {
            const randomIndex = Math.floor(Math.random() * potentialMatches.length);
            const selectedMatch = potentialMatches[randomIndex];

            console.log(`Random Match found: ${selectedMatch?.id}`);

            // Emit socket events to both users to join the call room if they are in waitingPoolSocketMap
            // const initiatorSocketId = waitingPoolSocketMap[user_id];
            // const matchSocketId = waitingPoolSocketMap[selectedMatch.id];

            // if (initiatorSocketId) {
            //   // get user detail of match
            //   const selectedMatchdetail = await getCallerDetail(selectedMatch.id);
            //   io.to(initiatorSocketId).emit('matchFound', { 
            //     // currnet user 
            //     match: selectedMatchdetail });
            // }

            // if (matchSocketId) {
            //   // get user detail of match
            //   const userDetail = await getCallerDetail(user_id);
            //   io.to(matchSocketId).emit('matchFound', { match: userDetail });
            // }

            // ** Remove both users from the Redis waiting pool 
            await redisClient.sRem('waitingPool', user_id.toString());
            await redisClient.sRem('waitingPool', selectedMatch.id.toString());
            console.log(`Removed user ${user_id} and ${selectedMatch.id} from waiting pool`);

            // send notification to selectedMatch
            // get user detail 
            const selectedMatchDetail = await getCallerDetail(selectedMatch.id);
            const message = {
                notification: {
                    title: 'Rullet call',
                    body: `You have an incoming Rullet call from ${user.name} , Tap to answer`,
                },
                token: selectedMatchDetail.device_id,
                data: {
                    // to string
                    callerId: user_id?.toString() ? user_id?.toString() : 'null',
                    callType: 'RULLET-MATCH-ALERT',
                    receiverId: selectedMatch.id?.toString() ? selectedMatch.id?.toString() : 'null',
                    callerName: user.name?.toString() ? user.name?.toString() : 'null',
                    callerImage: user.profile_image?.toString(),
                },
            };

            admin.messaging()
                .send(message)
                .then(response => console.log("Notification sent to the selected match:", response))
                .catch(error => console.error('Error sending message:', error));

            return res.status(200).json({
                error: false,
                msg: "Match found for the call",
                matchedUser: selectedMatchDetail,
            });
        }

        // No match found
        return res.status(404).json({
            error: true,
            msg: "No suitable matches found.",
        });
    } catch (error) {
        console.error("Error in fateRulletUserForCall:", error);
        res.status(500).json({
            error: true,
            msg: "Internal server error",
            details: error.message,
        });
    }
});









const waitingPoolSocketMap = {};

// Connection event
io.on('connection', (socket) => {
    console.log(`New connection: ${socket.id}`);


    // redis coode : 

    // Listen for when a user joins the Roulette waiting pool
    socket.on('joinRulletWaitingPool', async (userId) => {
        try {
            if (typeof userId === 'string' || typeof userId === 'number') {
                await redisClient.sAdd('waitingPool', userId.toString());
                waitingPoolSocketMap[userId] = socket.id; // Store the socket ID only for waiting pool users
                console.log(`User ${userId} added to waiting pool with socket ID ${socket.id}`);
            } else {
                console.error('Invalid userId type for joining waiting pool:', userId);
            }
        } catch (err) {
            console.error('Error adding user to waiting pool:', err);
        }
    });

    // Listen for when a user leaves the Roulette waiting pool
    socket.on('leaveRulletWaitingPool', async (userId) => {
        try {
            if (typeof userId === 'string' || typeof userId === 'number') {
                await redisClient.sRem('waitingPool', userId.toString());
                delete waitingPoolSocketMap[userId]; // Remove the socket ID when the user leaves the pool
                console.log(`User ${userId} removed from waiting pool and socket ID deleted`);
            } else {
                console.error('Invalid userId type for leaving waiting pool:', userId);
            }
        } catch (err) {
            console.error('Error removing user from waiting pool:', err);
        }
    });









    // Event for joining a chat room
    socket.on('joinChat', async ({ user1Id, user2Id }) => {
        const roomName = createRoomName(user1Id, user2Id);

        try {
            // Check if the room already exists and get the ID
            let roomQuery = 'SELECT id FROM chat_rooms WHERE room_name = $1';
            let res = await pool.query(roomQuery, [roomName]);

            let roomId;
            if (res.rows.length > 0) {
                roomId = res.rows[0].id;
            } else {
                // If not, create a new room and get the ID
                roomQuery = 'INSERT INTO chat_rooms (room_name) VALUES ($1) RETURNING id';
                res = await pool.query(roomQuery, [roomName]);
                roomId = res.rows[0].id;
            }

            socket.join(roomName); // Join the room in Socket.io

            const messages = await getMessagesByRoom(roomId);
            socket.emit('message history', messages); // Send message history to the user
        } catch (error) {
            console.error('Error handling joinChat event:', error);
            // Handle the error, possibly by sending an error message back to the client
        }
    });

    // Event for a user sending a message to the chat room
    socket.on('sendMessage', async ({ room, message, senderId, receiverId, timestamp1, read_status, status }) => {
        // Get the roomId from the database
        const roomQuery = 'SELECT id FROM chat_rooms WHERE room_name = $1';
        const res = await pool.query(roomQuery, [room]);
        const roomId = res.rows[0].id;

        // Save the message to the database
        const newData = await saveMessage(roomId, senderId, receiverId, message, timestamp1, read_status, status);

        // Emit the message to the room
        io.to(room).emit('message', { content: message, senderId: senderId, status: status, newData: newData?.rows[0] });

        // Note: The actual 'message' event payload should include the message ID and timestamp if needed
    });

    // WebRTC signaling events
    socket.on('joinVideoCall', async ({ user1Id, user2Id }) => {
        const roomName = createRoomName(user1Id, user2Id);

        try {
            // Check if the room already exists and get the ID
            let roomQuery = 'SELECT id FROM video_call_rooms WHERE room_name = $1';
            let res = await pool.query(roomQuery, [roomName]);

            let roomId;
            if (res.rows.length > 0) {
                roomId = res.rows[0].id;
            } else {
                // If not, create a new room and get the ID
                roomQuery = 'INSERT INTO video_call_rooms (room_name) VALUES ($1) RETURNING id';
                res = await pool.query(roomQuery, [roomName]);
                roomId = res.rows[0].id;
            }

            socket.join(roomName); // Join the room in Socket.io
            // Emit the user-joined event to other users in the room
            socket.to(roomName).emit('user-joined', { userId: socket.id, room: roomName });

            socket.emit('joinedVideoCall', { room: roomName }); // Send confirmation to the user
        } catch (error) {
            console.error('Error handling joinVideoCall event:', error);
            // Handle the error, possibly by sending an error message back to the client
        }
    });
    socket.on('offer', ({ room, offer }) => {
        console.log(`Received offer for room: ${room}`);
        socket.to(room).emit('offer', { offer });
    });

    socket.on('answer', ({ room, answer }) => {
        console.log(`Received answer for room: ${room}`);
        socket.to(room).emit('answer', { answer });
    });

    socket.on('ice-candidate', ({ room, candidate }) => {
        console.log(`Received ICE candidate for room: ${room}`);
        socket.to(room).emit('ice-candidate', { candidate });
    });
    socket.on('end-Videocall', ({ room }) => {
        socket.to(room).emit('end-Videocall', { room });
    });

    // AUDIO CALL

    socket.on('joinAudioCall', async ({ user1Id, user2Id }) => {
        const roomName = createRoomName(user1Id, user2Id);

        try {
            // Check if the room already exists and get the ID
            let roomQuery = 'SELECT id FROM video_call_rooms WHERE room_name = $1';
            let res = await pool.query(roomQuery, [roomName]);

            let roomId;
            if (res.rows.length > 0) {
                roomId = res.rows[0].id;
            } else {
                // If not, create a new room and get the ID
                roomQuery = 'INSERT INTO video_call_rooms (room_name) VALUES ($1) RETURNING id';
                res = await pool.query(roomQuery, [roomName]);
                roomId = res.rows[0].id;
            }

            socket.join(roomName); // Join the room in Socket.io
            // Emit the user-joined event to other users in the room
            socket.to(roomName).emit('user-audio-joined', { userId: socket.id, room: roomName });

            socket.emit('joinedAudioCall', { room: roomName }); // Send confirmation to the user
        } catch (error) {
            console.error('Error handling joinAudioCall event:', error);
            // Handle the error, possibly by sending an error message back to the client
        }
    });
    socket.on('offer-audio', ({ room, offer }) => {
        console.log(`Received audio offer for room: ${room}`);
        socket.to(room).emit('offer-audio', { offer });
    });

    socket.on('answer-audio', ({ room, answer }) => {
        console.log(`Received answer for room: ${room}`);
        socket.to(room).emit('answer-audio', { answer });
    });

    socket.on('ice-audio-candidate', ({ room, candidate }) => {
        console.log(`Received ICE audio candidate for room: ${room}`);
        socket.to(room).emit('ice-audio-candidate', { candidate });
    });
    socket.on('end-Audiocall', ({ room }) => {
        socket.to(room).emit('end-Audiocall', { room });
    });
    socket.on('end-rullet-Audiocall', async ({ room, endType }) => {

        // extract room ids form room name room_end room_205_209
        const roomIds = room.split('_');
        const user_id = roomIds[1];
        const otherUser = roomIds[2];
        console.log("room_end", roomIds, user_id, otherUser)

        const updateQuery = `DELETE FROM call_waiting_pool 
     WHERE user_id = $1 AND locked_with_user_id=$2
     `;
        await pool.query(updateQuery, [user_id, otherUser]);
        const updateQuery2 = `DELETE FROM call_waiting_pool 
     WHERE user_id = $1 AND locked_with_user_id=$2
     `;
        await pool.query(updateQuery2, [otherUser, user_id]);

        socket.to(room).emit('end-rullet-Audiocall', {
            room,
            endType
        });
    });



    // Handle disconnection
    socket.on('disconnect', async () => {
        console.log(`Socket ${socket.id} disconnected`);

        const userId = Object.keys(waitingPoolSocketMap).find(key => waitingPoolSocketMap[key] === socket.id);
        if (userId) {
            delete waitingPoolSocketMap[userId];

            // Also remove the user from the Redis waiting pool on disconnect
            await redisClient.sRem('waitingPool', userId.toString());
            console.log(`User ${userId} removed from waiting pool upon disconnection of socket ${socket.id}`);
        }
    });




});



server.listen(port, () => {
    console.log(`Fate is running on port ${port}.`);
});


module.exports = io;
