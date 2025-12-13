const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const compression = require('compression');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security Middleware
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// MongoDB Configuration
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://milowbaby:cmd@1233@milowbaby.dnkcxog.mongodb.net/?appName=milowbaby&retryWrites=true&w=majority";
const DB_NAME = 'milowbaby';

// Collections
const COLLECTIONS = {
  MESSAGES: 'baby_messages',
  USERS: 'baby_users',
  TEACHERS: 'baby_teachers',
  ANALYTICS: 'baby_analytics',
  SETTINGS: 'baby_settings',
  LOGS: 'baby_logs'
};

let db, client;

// Connect to MongoDB
async function connectToMongoDB() {
  try {
    client = new MongoClient(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 50,
      wtimeoutMS: 2500,
      serverSelectionTimeoutMS: 5000
    });
    
    await client.connect();
    console.log('✅ Connected to MongoDB Atlas for Baby Bot');
    
    db = client.db(DB_NAME);
    
    // Create indexes
    await createIndexes();
    
    // Initialize collections
    await initializeCollections();
    
    console.log('🚀 Baby Bot database initialized successfully');
    
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    setTimeout(connectToMongoDB, 5000);
  }
}

async function createIndexes() {
  await db.collection(COLLECTIONS.MESSAGES).createIndex({ message: 1 }, { unique: true });
  await db.collection(COLLECTIONS.MESSAGES).createIndex({ createdBy: 1 });
  await db.collection(COLLECTIONS.MESSAGES).createIndex({ createdAt: -1 });
  await db.collection(COLLECTIONS.USERS).createIndex({ userId: 1 }, { unique: true });
  await db.collection(COLLECTIONS.TEACHERS).createIndex({ userId: 1 }, { unique: true });
  await db.collection(COLLECTIONS.TEACHERS).createIndex({ score: -1 });
  console.log('📊 Baby Bot indexes created');
}

async function initializeCollections() {
  const settingsExists = await db.collection(COLLECTIONS.SETTINGS).countDocuments();
  if (settingsExists === 0) {
    await db.collection(COLLECTIONS.SETTINGS).insertOne({
      botName: 'Baby Bot',
      version: '6.9.0',
      author: 'dipto',
      maintenance: false,
      maxRepliesPerMessage: 50,
      defaultLanguage: 'en',
      createdAt: new Date()
    });
  }
}

// Helper function to format text
const formatText = (text) => {
  const fontMap = {
    'a': 'ᴀ', 'b': 'ʙ', 'c': 'ᴄ', 'd': 'ᴅ', 'e': 'ᴇ', 'f': 'ꜰ', 'g': 'ɢ', 'h': 'ʜ', 'i': 'ɪ', 'j': 'ᴊ', 'k': 'ᴋ', 'l': 'ʟ', 'm': 'ᴍ',
    'n': 'ɴ', 'o': 'ᴏ', 'p': 'ᴘ', 'q': 'ǫ', 'r': 'ʀ', 's': 'ꜱ', 't': 'ᴛ', 'u': 'ᴜ', 'v': 'ᴠ', 'w': 'ᴡ', 'x': 'x', 'y': 'ʏ', 'z': 'ᴢ'
  };
  
  if (typeof text !== 'string') return text;
  
  let result = '';
  for (const char of text) {
    result += fontMap[char.toLowerCase()] || char;
  }
  return result;
};

// Log activity
async function logActivity(type, data, userId = null) {
  try {
    await db.collection(COLLECTIONS.LOGS).insertOne({
      type,
      data,
      userId,
      timestamp: new Date(),
      ip: data.ip || 'unknown'
    });
  } catch (error) {
    console.error('Logging error:', error);
  }
}

// Baby Bot API Routes

// GET - Chat with bot (Simple GET request)
app.get('/api/baby', async (req, res) => {
  try {
    const { text, senderID, teach, reply, remove, index, list, edit, replace, key, react } = req.query;
    const ip = req.ip;
    
    // 1. TEACH COMMAND
    if (teach && reply) {
      const message = teach.toLowerCase().trim();
      const replies = reply.split(',').map(r => r.trim()).filter(r => r.length > 0);
      
      const existing = await db.collection(COLLECTIONS.MESSAGES).findOne({ message });
      
      if (existing) {
        const updatedReplies = [...existing.reply, ...replies];
        await db.collection(COLLECTIONS.MESSAGES).updateOne(
          { message },
          { 
            $set: { 
              reply: updatedReplies,
              updatedAt: new Date()
            },
            $addToSet: { teachers: senderID }
          }
        );
        
        await db.collection(COLLECTIONS.TEACHERS).updateOne(
          { userId: senderID },
          {
            $inc: { teachCount: replies.length },
            $set: { lastTeach: new Date() },
            $setOnInsert: {
              userId: senderID,
              userName: req.query.userName || 'Unknown',
              joinedAt: new Date(),
              score: 0
            }
          },
          { upsert: true }
        );
        
        return res.json({
          message: `Successfully taught "${message}" with ${replies.length} reply(s)`,
          teacher: senderID,
          teachs: updatedReplies.length
        });
      } else {
        await db.collection(COLLECTIONS.MESSAGES).insertOne({
          message,
          reply: replies,
          createdBy: senderID,
          teachers: [senderID],
          createdAt: new Date(),
          updatedAt: new Date(),
          usageCount: 0,
          key: key || null
        });
        
        await db.collection(COLLECTIONS.TEACHERS).updateOne(
          { userId: senderID },
          {
            $inc: { teachCount: replies.length },
            $set: { lastTeach: new Date() },
            $setOnInsert: {
              userId: senderID,
              userName: req.query.userName || 'Unknown',
              joinedAt: new Date(),
              score: 0
            }
          },
          { upsert: true }
        );
        
        return res.json({
          message: `Successfully taught "${message}" with ${replies.length} reply(s)`,
          teacher: senderID,
          teachs: replies.length
        });
      }
    }
    
    // 2. TEACH WITH KEY (intro)
    if (teach && key === 'intro') {
      const message = teach.toLowerCase().trim();
      const replies = reply.split(',').map(r => r.trim()).filter(r => r.length > 0);
      
      const existing = await db.collection(COLLECTIONS.MESSAGES).findOne({ message });
      
      if (existing) {
        const updatedReplies = [...existing.reply, ...replies];
        await db.collection(COLLECTIONS.MESSAGES).updateOne(
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
        await db.collection(COLLECTIONS.MESSAGES).insertOne({
          message,
          reply: replies,
          createdBy: senderID,
          key: 'intro',
          createdAt: new Date(),
          updatedAt: new Date(),
          usageCount: 0
        });
      }
      
      return res.json({
        message: `Successfully added intro reply for "${message}"`
      });
    }
    
    // 3. TEACH REACT
    if (teach && react) {
      const message = teach.toLowerCase().trim();
      const reactions = react.split(',').map(r => r.trim()).filter(r => r.length > 0);
      
      const existing = await db.collection(COLLECTIONS.MESSAGES).findOne({ message });
      
      if (existing) {
        const currentReactions = existing.react || [];
        const updatedReactions = [...currentReactions, ...reactions];
        await db.collection(COLLECTIONS.MESSAGES).updateOne(
          { message },
          { 
            $set: { 
              react: updatedReactions,
              updatedAt: new Date()
            }
          }
        );
      } else {
        await db.collection(COLLECTIONS.MESSAGES).insertOne({
          message,
          react: reactions,
          createdBy: senderID,
          createdAt: new Date(),
          updatedAt: new Date(),
          reply: []
        });
      }
      
      return res.json({
        message: `Successfully added ${reactions.length} reaction(s) for "${message}"`
      });
    }
    
    // 4. REMOVE COMMAND
    if (remove && !index) {
      const message = remove.toLowerCase().trim();
      
      const result = await db.collection(COLLECTIONS.MESSAGES).deleteOne({ message });
      
      if (result.deletedCount > 0) {
        return res.json({
          message: `Successfully removed all replies for "${message}"`
        });
      } else {
        return res.json({
          message: `No entries found for "${message}"`
        });
      }
    }
    
    // 5. REMOVE WITH INDEX
    if (remove && index) {
      const message = remove.toLowerCase().trim();
      const idx = parseInt(index) - 1;
      
      const item = await db.collection(COLLECTIONS.MESSAGES).findOne({ message });
      
      if (!item) {
        return res.json({
          message: `No entries found for "${message}"`
        });
      }
      
      if (!item.reply || item.reply.length <= idx) {
        return res.json({
          message: `Invalid index for "${message}"`
        });
      }
      
      item.reply.splice(idx, 1);
      
      if (item.reply.length === 0) {
        await db.collection(COLLECTIONS.MESSAGES).deleteOne({ message });
        return res.json({
          message: `Removed reply ${parseInt(index)} and deleted message "${message}"`
        });
      } else {
        await db.collection(COLLECTIONS.MESSAGES).updateOne(
          { message },
          { $set: { reply: item.reply, updatedAt: new Date() } }
        );
        return res.json({
          message: `Successfully removed reply ${parseInt(index)} for "${message}"`
        });
      }
    }
    
    // 6. EDIT COMMAND
    if (edit && replace) {
      const oldMessage = edit.toLowerCase().trim();
      const newMessage = replace.toLowerCase().trim();
      
      const result = await db.collection(COLLECTIONS.MESSAGES).updateOne(
        { message: oldMessage },
        { $set: { message: newMessage, updatedAt: new Date() } }
      );
      
      if (result.modifiedCount > 0) {
        return res.json({
          message: `Successfully changed "${oldMessage}" to "${newMessage}"`
        });
      } else {
        return res.json({
          message: `No entries found for "${oldMessage}"`
        });
      }
    }
    
    // 7. LIST COMMANDS
    if (list) {
      if (list === 'all') {
        const allData = await db.collection(COLLECTIONS.MESSAGES).find({}).toArray();
        
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
        const item = await db.collection(COLLECTIONS.MESSAGES).findOne({ message });
        
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
    
    // 8. GET REPLY (Main functionality)
    if (text) {
      const message = text.toLowerCase().trim();
      
      let item = await db.collection(COLLECTIONS.MESSAGES).findOne({ message });
      
      if (!item) {
        const allItems = await db.collection(COLLECTIONS.MESSAGES).find({}).toArray();
        item = allItems.find(i => 
          message.includes(i.message) || 
          i.message.includes(message)
        );
      }
      
      if (item && item.reply && item.reply.length > 0) {
        const randomIndex = Math.floor(Math.random() * item.reply.length);
        const replyText = item.reply[randomIndex];
        
        await db.collection(COLLECTIONS.MESSAGES).updateOne(
          { message: item.message },
          { $inc: { usageCount: 1 }, $set: { lastUsed: new Date() } }
        );
        
        await db.collection(COLLECTIONS.USERS).updateOne(
          { userId: senderID },
          {
            $inc: { chatCount: 1 },
            $set: { lastActive: new Date(), name: req.query.userName || 'Unknown' },
            $setOnInsert: {
              userId: senderID,
              joinedAt: new Date(),
              role: 'user'
            }
          },
          { upsert: true }
        );
        
        return res.json({
          reply: formatText(replyText),
          found: true
        });
      } else {
        const defaultResponses = [
          "আমি বুঝতে পারিনি, আমাকে আরো শেখানোর চেষ্টা করুন! 😊",
          "এই বিষয়ে আমি জানি না, আপনি আমাকে শেখাতে পারেন!",
          "আমি এখনো সেই প্রশ্নের উত্তর শিখিনি।",
          "দুঃখিত, আমি এখনো এটা জানি না।",
          "আপনি আমাকে 'teach [message] - [reply]' লিখে শেখাতে পারেন।",
          "I don't understand, try teaching me more! 😊",
          "I don't know about this topic yet, you can teach me!",
          "I haven't learned the answer to that question yet.",
          "Sorry, I don't know that yet.",
          "You can teach me by typing 'teach [message] - [reply]'"
        ];
        
        const randomResponse = defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
        
        return res.json({
          reply: formatText(randomResponse),
          found: false
        });
      }
    }
    
    // Default response
    const totalMessages = await db.collection(COLLECTIONS.MESSAGES).countDocuments();
    const totalReplies = await db.collection(COLLECTIONS.MESSAGES).aggregate([
      { $group: { _id: null, total: { $sum: { $size: "$reply" } } } }
    ]).toArray().then(res => res[0]?.total || 0);
    
    res.json({
      message: "Baby Bot API is running with MongoDB! 🚀",
      version: "6.9.0",
      author: "dipto",
      database: "MongoDB Atlas",
      stats: {
        totalMessages,
        totalReplies
      },
      endpoints: {
        "GET /api/baby?text=[message]": "Get a response",
        "GET /api/baby?teach=[message]&reply=[response]": "Teach a new response",
        "GET /api/baby?remove=[message]": "Remove all responses for a message",
        "GET /api/baby?remove=[message]&index=[number]": "Remove specific reply",
        "GET /api/baby?edit=[old]&replace=[new]": "Edit message",
        "GET /api/baby?list=all": "Get all data"
      }
    });
    
  } catch (error) {
    console.error('Baby Bot API error:', error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message
    });
  }
});

// POST - Advanced teach endpoint
app.post('/api/baby/teach', async (req, res) => {
  try {
    const { message, reply, senderID, userName, language = 'en' } = req.body;
    const ip = req.ip;
    
    if (!message || !reply || !senderID) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['message', 'reply', 'senderID']
      });
    }
    
    const replies = Array.isArray(reply) ? reply : [reply];
    const msg = message.toLowerCase();
    
    const existing = await db.collection(COLLECTIONS.MESSAGES).findOne({
      message: msg,
      language
    });
    
    let result;
    
    if (existing) {
      const newReplies = [...new Set([...(existing.reply || []), ...replies])];
      
      if (newReplies.length > 50) {
        newReplies.splice(50);
      }
      
      result = await db.collection(COLLECTIONS.MESSAGES).updateOne(
        { _id: existing._id },
        { 
          $set: { 
            reply: newReplies,
            updatedAt: new Date()
          },
          $addToSet: { teachers: senderID }
        }
      );
    } else {
      result = await db.collection(COLLECTIONS.MESSAGES).insertOne({
        message: msg,
        reply: replies,
        createdBy: senderID,
        teachers: [senderID],
        language,
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastUsed: null
      });
    }
    
    await db.collection(COLLECTIONS.TEACHERS).updateOne(
      { userId: senderID },
      {
        $inc: { teachCount: replies.length },
        $set: { 
          userName: userName || 'Unknown',
          lastTeach: new Date()
        },
        $setOnInsert: {
          userId: senderID,
          joinedAt: new Date(),
          score: 0
        }
      },
      { upsert: true }
    );
    
    await logActivity('teach', { message, replyCount: replies.length, senderID, ip }, senderID);
    
    res.json({
      success: true,
      message: `Successfully taught "${message}" with ${replies.length} reply(s)`,
      data: {
        message: message,
        replyCount: replies.length,
        isUpdate: !!existing
      },
      teacher: {
        id: senderID,
        name: userName || 'Unknown',
        teachCount: replies.length
      }
    });
    
  } catch (error) {
    console.error('Teach error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// GET - Baby Bot stats
app.get('/api/baby/stats', async (req, res) => {
  try {
    const totalMessages = await db.collection(COLLECTIONS.MESSAGES).countDocuments();
    const totalReplies = await db.collection(COLLECTIONS.MESSAGES).aggregate([
      { $group: { _id: null, total: { $sum: { $size: "$reply" } } } }
    ]).toArray();
    
    const totalTeachers = await db.collection(COLLECTIONS.TEACHERS).countDocuments();
    const totalUsers = await db.collection(COLLECTIONS.USERS).countDocuments();
    
    const topTeachers = await db.collection(COLLECTIONS.TEACHERS)
      .find({})
      .sort({ teachCount: -1 })
      .limit(10)
      .toArray();
    
    res.json({
      success: true,
      stats: {
        totalMessages,
        totalReplies: totalReplies[0]?.total || 0,
        totalTeachers,
        totalUsers
      },
      topTeachers: topTeachers.map(teacher => ({
        userId: teacher.userId,
        userName: teacher.userName,
        teachCount: teacher.teachCount || 0,
        lastTeach: teacher.lastTeach
      })),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET - Baby Bot health check
app.get('/api/baby/health', async (req, res) => {
  try {
    const dbPing = await db.command({ ping: 1 });
    const totalMessages = await db.collection(COLLECTIONS.MESSAGES).countDocuments();
    const settings = await db.collection(COLLECTIONS.SETTINGS).findOne({});
    
    res.json({
      status: 'healthy',
      service: 'Baby Bot API',
      version: settings?.version || '6.9.0',
      author: settings?.author || 'dipto',
      database: {
        connected: !!dbPing,
        totalMessages
      },
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
    
  } catch (error) {
    res.json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// GET - Search messages
app.get('/api/baby/search', async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;
    
    if (!q || q.length < 2) {
      return res.status(400).json({
        error: 'Search query too short',
        minLength: 2
      });
    }
    
    const searchResults = await db.collection(COLLECTIONS.MESSAGES).find({
      $or: [
        { message: { $regex: q, $options: 'i' } },
        { reply: { $regex: q, $options: 'i' } }
      ]
    }).limit(parseInt(limit)).toArray();
    
    res.json({
      success: true,
      query: q,
      count: searchResults.length,
      results: searchResults.map(item => ({
        id: item._id,
        message: item.message,
        replyCount: item.reply.length,
        usageCount: item.usageCount || 0,
        createdBy: item.createdBy
      }))
    });
    
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start server
connectToMongoDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Milow API Server running on port ${PORT}`);
    console.log(`👶 Baby Bot API: http://localhost:${PORT}/api/baby`);
    console.log(`📊 Baby Stats: http://localhost:${PORT}/api/baby/stats`);
    console.log(`🏥 Health: http://localhost:${PORT}/api/baby/health`);
  });
}).catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

// Export for testing
module.exports = app;
