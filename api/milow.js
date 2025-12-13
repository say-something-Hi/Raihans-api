const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB Configuration
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://milowbaby:cmd@1233@milowbaby.dnkcxog.mongodb.net/?retryWrites=true&w=majority&appName=milowbaby";
const DB_NAME = 'milowbaby';
const COLLECTION_NAME = 'baby_messages';

// Format text helper
const formatText = (text) => {
  const fontMap = {
    'a': 'ᴀ', 'b': 'ʙ', 'c': 'ᴄ', 'd': 'ᴅ', 'e': 'ᴇ', 'f': 'ꜰ', 'g': 'ɢ', 'h': 'ʜ', 'i': 'ɪ', 'j': 'ᴊ', 'k': 'ᴋ', 'l': 'ʟ', 'm': 'ᴍ',
    'n': 'ɴ', 'o': 'ᴏ', 'p': 'ᴘ', 'q': 'ǫ', 'r': 'ʀ', 's': 'ꜱ', 't': 'ᴛ', 'u': 'ᴜ', 'v': 'ᴠ', 'w': 'ᴡ', 'x': 'x', 'y': 'ʏ', 'z': 'ᴢ',
    'A': 'ᴀ', 'B': 'ʙ', 'C': 'ᴄ', 'D': 'ᴅ', 'E': 'ᴇ', 'F': 'ꜰ', 'G': 'ɢ', 'H': 'ʜ', 'I': 'ɪ', 'J': 'ᴊ', 'K': 'ᴋ', 'L': 'ʟ', 'M': 'ᴍ',
    'N': 'ɴ', 'O': 'ᴏ', 'P': 'ᴘ', 'Q': 'ǫ', 'R': 'ʀ', 'S': 'ꜱ', 'T': 'ᴛ', 'U': 'ᴜ', 'V': 'ᴠ', 'W': 'ᴡ', 'X': 'x', 'Y': 'ʏ', 'Z': 'ᴢ'
  };
  
  if (typeof text !== 'string') return text;
  
  let formattedText = '';
  for (const char of text) {
    formattedText += fontMap[char] || char;
  }
  return formattedText;
};

// MongoDB connection helper
let dbClient = null;
let db = null;
let collection = null;

async function connectMongoDB() {
  try {
    if (!dbClient) {
      dbClient = new MongoClient(MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      
      await dbClient.connect();
      console.log('✅ MongoDB connected successfully');
      
      db = dbClient.db(DB_NAME);
      collection = db.collection(COLLECTION_NAME);
      
      // Create indexes
      await collection.createIndex({ message: 1 }, { unique: true });
      await collection.createIndex({ createdBy: 1 });
      await collection.createIndex({ createdAt: -1 });
      
      console.log('📊 MongoDB indexes created');
    }
    
    return { db, collection };
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    throw error;
  }
}

// Baby Bot API Module
module.exports = {
  meta: {
    name: "Baby Bot API",
    version: "7.0.0",
    description: "Advanced AI chatbot API for baby bot with MongoDB",
    author: "RaiHan",
    path: "/baby",
    method: "get",
    category: "chat"
  },
  
  onStart: async function({ req, res }) {
    const { text, senderID, teach, reply, remove, index, list, edit, replace, key, react, stats, search, random } = req.query;
    
    try {
      // Connect to MongoDB
      const { collection } = await connectMongoDB();
      
      // 1. TEACH COMMAND
      if (teach && reply) {
        const message = teach.toLowerCase().trim();
        const replies = reply.split(',').map(r => r.trim()).filter(r => r.length > 0);
        
        const existing = await collection.findOne({ message });
        
        if (existing) {
          const updatedReplies = [...existing.reply, ...replies];
          await collection.updateOne(
            { message },
            { 
              $set: { 
                reply: updatedReplies,
                updatedAt: new Date()
              },
              $addToSet: { teachers: senderID || 'unknown' }
            }
          );
        } else {
          await collection.insertOne({
            message,
            reply: replies,
            createdBy: senderID || 'unknown',
            teachers: [senderID || 'unknown'],
            createdAt: new Date(),
            updatedAt: new Date(),
            usageCount: 0
          });
        }
        
        return res.json({
          message: `✅ Successfully taught "${message}" with ${replies.length} reply(s)`,
          teacher: senderID || 'unknown',
          teachs: replies.length
        });
      }
      
      // 2. TEACH WITH KEY (intro)
      if (teach && key === 'intro') {
        const message = teach.toLowerCase().trim();
        const replies = reply.split(',').map(r => r.trim()).filter(r => r.length > 0);
        
        const existing = await collection.findOne({ message });
        
        if (existing) {
          const updatedReplies = [...existing.reply, ...replies];
          await collection.updateOne(
            { message },
            { 
              $set: { 
                reply: updatedReplies,
                key: 'intro',
                updatedAt: new Date()
              }
            }
          );
        } else {
          await collection.insertOne({
            message,
            reply: replies,
            createdBy: senderID || 'unknown',
            key: 'intro',
            createdAt: new Date(),
            updatedAt: new Date(),
            usageCount: 0
          });
        }
        
        return res.json({
          message: `✅ Successfully added intro reply for "${message}"`
        });
      }
      
      // 3. TEACH REACT
      if (teach && react) {
        const message = teach.toLowerCase().trim();
        const reactions = react.split(',').map(r => r.trim()).filter(r => r.length > 0);
        
        const existing = await collection.findOne({ message });
        
        if (existing) {
          const currentReactions = existing.react || [];
          const updatedReactions = [...currentReactions, ...reactions];
          await collection.updateOne(
            { message },
            { 
              $set: { 
                react: updatedReactions,
                updatedAt: new Date()
              }
            }
          );
        } else {
          await collection.insertOne({
            message,
            react: reactions,
            createdBy: senderID || 'unknown',
            createdAt: new Date(),
            updatedAt: new Date(),
            reply: []
          });
        }
        
        return res.json({
          message: `✅ Successfully added ${reactions.length} reaction(s) for "${message}"`
        });
      }
      
      // 4. STATS COMMAND
      if (stats === 'true') {
        const totalMessages = await collection.countDocuments();
        const allMessages = await collection.find({}).toArray();
        
        const statsData = {
          totalMessages,
          totalReplies: allMessages.reduce((sum, msg) => sum + (msg.reply ? msg.reply.length : 0), 0),
          totalReactions: allMessages.reduce((sum, msg) => sum + (msg.react ? msg.react.length : 0), 0),
          mostUsed: allMessages.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0)).slice(0, 10),
          lastUpdated: allMessages.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))[0]?.updatedAt
        };

        return res.json({
          status: true,
          stats: statsData,
          timestamp: new Date().toISOString()
        });
      }
      
      // 5. SEARCH COMMAND
      if (search) {
        const results = await collection.find({
          $or: [
            { message: { $regex: search, $options: 'i' } },
            { reply: { $regex: search, $options: 'i' } }
          ]
        }).limit(10).toArray();

        return res.json({
          status: true,
          count: results.length,
          results: results.map(item => ({
            message: item.message,
            replyCount: item.reply?.length || 0,
            usageCount: item.usageCount || 0
          }))
        });
      }
      
      // 6. RANDOM COMMAND
      if (random === 'true') {
        const allMessages = await collection.find({}).toArray();
        
        if (allMessages.length === 0) {
          return res.json({
            status: false,
            message: "No messages found"
          });
        }

        const randomMsg = allMessages[Math.floor(Math.random() * allMessages.length)];
        const randomReply = randomMsg.reply && randomMsg.reply.length > 0 
          ? randomMsg.reply[Math.floor(Math.random() * randomMsg.reply.length)]
          : "No reply available";

        return res.json({
          status: true,
          message: randomMsg.message,
          reply: randomReply,
          usageCount: randomMsg.usageCount || 0
        });
      }
      
      // 7. REMOVE COMMAND
      if (remove && !index) {
        const message = remove.toLowerCase().trim();
        
        const result = await collection.deleteOne({ message });
        
        if (result.deletedCount > 0) {
          return res.json({
            message: `✅ Successfully removed all replies for "${message}"`
          });
        } else {
          return res.json({
            message: `❌ No entries found for "${message}"`
          });
        }
      }
      
      // 8. REMOVE WITH INDEX
      if (remove && index) {
        const message = remove.toLowerCase().trim();
        const idx = parseInt(index) - 1;
        
        const item = await collection.findOne({ message });
        
        if (!item) {
          return res.json({
            message: `❌ No entries found for "${message}"`
          });
        }
        
        if (!item.reply || item.reply.length <= idx) {
          return res.json({
            message: `❌ Invalid index for "${message}"`
          });
        }
        
        item.reply.splice(idx, 1);
        
        if (item.reply.length === 0) {
          await collection.deleteOne({ message });
          return res.json({
            message: `✅ Removed reply ${parseInt(index)} and deleted message "${message}"`
          });
        } else {
          await collection.updateOne(
            { message },
            { $set: { reply: item.reply, updatedAt: new Date() } }
          );
          return res.json({
            message: `✅ Successfully removed reply ${parseInt(index)} for "${message}"`
          });
        }
      }
      
      // 9. EDIT COMMAND
      if (edit && replace) {
        const oldMessage = edit.toLowerCase().trim();
        const newMessage = replace.toLowerCase().trim();
        
        const result = await collection.updateOne(
          { message: oldMessage },
          { $set: { message: newMessage, updatedAt: new Date() } }
        );
        
        if (result.modifiedCount > 0) {
          return res.json({
            message: `✅ Successfully changed "${oldMessage}" to "${newMessage}"`
          });
        } else {
          return res.json({
            message: `❌ No entries found for "${oldMessage}"`
          });
        }
      }
      
      // 10. LIST COMMANDS
      if (list) {
        if (list === 'all') {
          const allData = await collection.find({}).toArray();
          
          const teacherStats = {};
          allData.forEach(item => {
            if (item.createdBy) {
              teacherStats[item.createdBy] = (teacherStats[item.createdBy] || 0) + 1;
            }
          });
          
          const teacherList = Object.entries(teacherStats).map(([id, count]) => ({ [id]: count }));
          
          const response = {
            data: allData,
            teacher: {
              teacherList: teacherList,
              counts: teacherStats
            },
            length: allData.length
          };
          
          return res.json(response);
        } else {
          const message = list.toLowerCase().trim();
          const item = await collection.findOne({ message });
          
          if (item) {
            return res.json({
              data: item.reply ? item.reply.length : 0
            });
          } else {
            return res.json({
              data: 0
            });
          }
        }
      }
      
      // 11. GET REPLY (Main functionality)
      if (text) {
        const message = text.toLowerCase().trim();
        
        let item = await collection.findOne({ message });
        
        // If no exact match, try partial match
        if (!item) {
          const allItems = await collection.find({}).toArray();
          item = allItems.find(i => 
            message.includes(i.message) || 
            i.message.includes(message)
          );
        }
        
        if (item && item.reply && item.reply.length > 0) {
          const randomIndex = Math.floor(Math.random() * item.reply.length);
          const replyText = item.reply[randomIndex];
          
          // Update usage count
          await collection.updateOne(
            { message: item.message },
            { $inc: { usageCount: 1 }, $set: { lastUsed: new Date() } }
          );
          
          return res.json({
            reply: formatText(replyText),
            found: true,
            reactions: item.react || []
          });
        } else {
          const defaultResponses = [
            "আমি বুঝতে পারিনি, আমাকে আরো শেখানোর চেষ্টা করুন! 😊",
            "I don't understand, try teaching me more! 😊",
            "এই বিষয়ে আমি জানি না, আপনি আমাকে শেখাতে পারেন!",
            "I don't know about this topic yet, you can teach me!"
          ];
          
          const randomResponse = defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
          
          return res.json({
            reply: formatText(randomResponse),
            found: false
          });
        }
      }
      
      // Default response
      const totalMessages = await collection.countDocuments();
      const allMessages = await collection.find({}).limit(10).toArray();
      const totalReplies = allMessages.reduce((sum, msg) => sum + (msg.reply ? msg.reply.length : 0), 0);
      
      res.json({
        status: true,
        message: "👶 Baby Bot API is running with MongoDB! 🚀",
        version: "7.0.0",
        author: "Raihan",
        database: "MongoDB Atlas",
        stats: {
          totalMessages,
          totalReplies
        },
        endpoints: {
          "GET /baby?text=[message]": "Get a response",
          "GET /baby?teach=[message]&reply=[response]": "Teach a new response",
          "GET /baby?remove=[message]": "Remove all responses for a message",
          "GET /baby?list=all": "Get all data",
          "GET /baby?stats=true": "Get statistics",
          "GET /baby?search=[query]": "Search messages",
          "GET /baby?random=true": "Get random message"
        },
        example: "Try: /baby?text=hello or /baby?teach=hi&reply=hello,hey"
      });
      
    } catch (error) {
      console.error('🚨 Baby Bot API Error:', error);
      
      res.status(500).json({
        status: false,
        error: "Internal server error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
};

// If this file is run directly, start the server
if (require.main === module) {
  const server = express();
  const babyBot = module.exports;
  
  server.use(cors());
  server.use(express.json());
  server.use(express.urlencoded({ extended: true }));
  
  // Health check endpoint
  server.get('/health', async (req, res) => {
    try {
      await connectMongoDB();
      res.json({
        status: 'healthy',
        service: 'Baby Bot API',
        version: babyBot.meta.version,
        database: 'MongoDB Connected',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // Baby Bot API endpoint
  server.get(babyBot.meta.path, babyBot.onStart);
  
  server.listen(PORT, () => {
    console.log(`🚀 Baby Bot Server running on port ${PORT}`);
    console.log(`📝 API Endpoint: http://localhost:${PORT}${babyBot.meta.path}`);
    console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
  });
}
