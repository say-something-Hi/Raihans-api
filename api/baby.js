const axios = require('axios');
const { MongoClient } = require('mongodb');

const meta = {
  name: "baby",
  version: "7.0.0",
  description: "Advanced AI chat bot with MongoDB - Powerful features & error handling",
  author: "dipto",
  method: "get",
  category: "chatbot",
  path: "/baby"
};

async function onStart({ res, req }) {
  const { 
    text, 
    teach, 
    reply, 
    remove, 
    index, 
    list, 
    edit, 
    replace,
    react,
    key,
    type,
    category,
    search,
    random,
    count,
    export: exportData,
    import: importData,
    clear,
    backup,
    restore,
    stats,
    admin,
    password,
    mode,
    language,
    filter,
    sort,
    page,
    limit,
    senderID
  } = req.query;

  // MongoDB Configuration
  const MONGODB_URI = "mongodb+srv://milowbaby:cmd@1233@milowbaby.dnkcxog.mongodb.net/?retryWrites=true&w=majority&appName=milowbaby";
  const DB_NAME = 'milowbaby';
  const COLLECTION_NAME = 'baby_messages';
  
  // Admin password for protected operations
  const ADMIN_PASSWORD = "babyadmin123";

  let client;
  
  try {
    // Validate input
    const validateInput = (input, maxLength = 500) => {
      if (!input || typeof input !== 'string') return false;
      if (input.length > maxLength) return false;
      if (input.includes('<script>') || input.includes('javascript:')) return false;
      return true;
    };

    // Sanitize input
    const sanitize = (text) => {
      return String(text)
        .replace(/[<>]/g, '')
        .substring(0, 1000)
        .trim();
    };

    // Format text helper
    const formatText = (text) => {
      const fontMap = {
        'a': 'ᴀ', 'b': 'ʙ', 'c': 'ᴄ', 'd': 'ᴅ', 'e': 'ᴇ', 'f': 'ꜰ', 'g': 'ɢ', 'h': 'ʜ',
        'i': 'ɪ', 'j': 'ᴊ', 'k': 'ᴋ', 'l': 'ʟ', 'm': 'ᴍ', 'n': 'ɴ', 'o': 'ᴏ', 'p': 'ᴘ',
        'q': 'ǫ', 'r': 'ʀ', 's': 'ꜱ', 't': 'ᴛ', 'u': 'ᴜ', 'v': 'ᴠ', 'w': 'ᴡ', 'x': 'x',
        'y': 'ʏ', 'z': 'ᴢ', 'A': 'ᴀ', 'B': 'ʙ', 'C': 'ᴄ', 'D': 'ᴅ', 'E': 'ᴇ', 'F': 'ꜰ',
        'G': 'ɢ', 'H': 'ʜ', 'I': 'ɪ', 'J': 'ᴊ', 'K': 'ᴋ', 'L': 'ʟ', 'M': 'ᴍ', 'N': 'ɴ',
        'O': 'ᴏ', 'P': 'ᴘ', 'Q': 'ǫ', 'R': 'ʀ', 'S': 'ꜱ', 'T': 'ᴛ', 'U': 'ᴜ', 'V': 'ᴠ',
        'W': 'ᴡ', 'X': 'x', 'Y': 'ʏ', 'Z': 'ᴢ'
      };
      
      if (typeof text !== 'string') return String(text);
      
      let result = '';
      for (const char of text) {
        result += fontMap[char] || char;
      }
      return result;
    };

    // Connect to MongoDB
    const connectDB = async (retries = 3) => {
      for (let i = 0; i < retries; i++) {
        try {
          client = new MongoClient(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            connectTimeoutMS: 10000,
            socketTimeoutMS: 45000,
            maxPoolSize: 10
          });
          
          await client.connect();
          console.log('✅ MongoDB connected successfully');
          return client.db(DB_NAME);
        } catch (error) {
          if (i === retries - 1) throw error;
          console.log(`Retrying connection... (${i + 1}/${retries})`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    };

    const db = await connectDB();
    const collection = db.collection(COLLECTION_NAME);

    // Ensure indexes
    await collection.createIndex({ message: 1 }, { unique: true, sparse: true });
    await collection.createIndex({ category: 1 });
    await collection.createIndex({ type: 1 });
    await collection.createIndex({ usageCount: -1 });
    await collection.createIndex({ lastUsed: -1 });

    // ==================== ADMIN OPERATIONS ====================
    if (admin && password === ADMIN_PASSWORD) {
      if (clear === 'all') {
        const result = await collection.deleteMany({});
        return res.json({
          status: true,
          message: `🧹 Cleared ${result.deletedCount} messages`,
          deleted: result.deletedCount
        });
      }
      
      if (backup === 'true') {
        const allData = await collection.find({}).toArray();
        return res.json({
          status: true,
          backup: {
            timestamp: new Date().toISOString(),
            count: allData.length,
            data: allData
          }
        });
      }
    }

    // ==================== STATISTICS ====================
    if (stats === 'true') {
      const totalMessages = await collection.countDocuments();
      const allMessages = await collection.find({}).toArray();
      
      const statsData = {
        totalMessages,
        totalReplies: allMessages.reduce((sum, msg) => sum + (msg.reply ? msg.reply.length : 0), 0),
        totalReactions: allMessages.reduce((sum, msg) => sum + (msg.react ? msg.react.length : 0), 0),
        mostUsed: allMessages.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0)).slice(0, 10),
        categories: {},
        types: {},
        lastUpdated: allMessages.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))[0]?.updatedAt
      };

      allMessages.forEach(msg => {
        if (msg.category) statsData.categories[msg.category] = (statsData.categories[msg.category] || 0) + 1;
        if (msg.type) statsData.types[msg.type] = (statsData.types[msg.type] || 0) + 1;
      });

      return res.json({
        status: true,
        stats: statsData,
        timestamp: new Date().toISOString()
      });
    }

    // ==================== SEARCH ====================
    if (search) {
      if (!validateInput(search, 100)) {
        return res.status(400).json({
          status: false,
          error: "Invalid search query",
          message: "Search query must be between 1-100 characters"
        });
      }

      const searchQuery = search.toLowerCase().trim();
      const pageNum = parseInt(page) || 1;
      const limitNum = Math.min(parseInt(limit) || 20, 100);
      const skip = (pageNum - 1) * limitNum;

      let query = {
        $or: [
          { message: { $regex: searchQuery, $options: 'i' } },
          { reply: { $regex: searchQuery, $options: 'i' } }
        ]
      };

      if (category) query.category = category;
      if (type) query.type = type;

      const results = await collection.find(query)
        .skip(skip)
        .limit(limitNum)
        .sort(sort === 'newest' ? { createdAt: -1 } : { usageCount: -1 })
        .toArray();

      const total = await collection.countDocuments(query);

      return res.json({
        status: true,
        query: searchQuery,
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
        results: results.map(item => ({
          id: item._id,
          message: item.message,
          replyCount: item.reply?.length || 0,
          usageCount: item.usageCount || 0,
          category: item.category || 'general',
          type: item.type || 'text',
          lastUsed: item.lastUsed,
          createdAt: item.createdAt
        }))
      });
    }

    // ==================== RANDOM ====================
    if (random === 'true') {
      const allMessages = await collection.find({}).toArray();
      
      if (allMessages.length === 0) {
        return res.json({
          status: false,
          message: "No messages found in database"
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
        category: randomMsg.category || 'general',
        type: randomMsg.type || 'text',
        usageCount: randomMsg.usageCount || 0
      });
    }

    // ==================== LIST ====================
    if (list) {
      const pageNum = parseInt(page) || 1;
      const limitNum = Math.min(parseInt(limit) || 50, 200);
      const skip = (pageNum - 1) * limitNum;
      
      if (list === 'all') {
        let query = {};
        
        if (category) query.category = category;
        if (type) query.type = type;
        if (filter === 'mostUsed') query.usageCount = { $gt: 0 };
        if (filter === 'recent') query.createdAt = { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) };
        
        const total = await collection.countDocuments(query);
        const allData = await collection.find(query)
          .skip(skip)
          .limit(limitNum)
          .sort(sort === 'newest' ? { createdAt: -1 } : sort === 'popular' ? { usageCount: -1 } : { message: 1 })
          .toArray();
        
        const summary = {
          totalMessages: total,
          totalReplies: allData.reduce((sum, msg) => sum + (msg.reply ? msg.reply.length : 0), 0),
          categories: {},
          page: pageNum,
          totalPages: Math.ceil(total / limitNum)
        };
        
        allData.forEach(msg => {
          if (msg.category) {
            summary.categories[msg.category] = (summary.categories[msg.category] || 0) + 1;
          }
        });
        
        return res.json({
          status: true,
          summary,
          data: allData.map(item => ({
            id: item._id,
            message: item.message,
            reply: item.reply?.slice(0, 3) || [],
            replyCount: item.reply?.length || 0,
            category: item.category || 'general',
            type: item.type || 'text',
            usageCount: item.usageCount || 0,
            lastUsed: item.lastUsed,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt
          })),
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            hasNext: pageNum * limitNum < total,
            hasPrev: pageNum > 1
          }
        });
      } else {
        const message = sanitize(list).toLowerCase();
        const item = await collection.findOne({ message });
        
        if (item) {
          return res.json({
            status: true,
            data: {
              message: item.message,
              replies: item.reply || [],
              replyCount: item.reply?.length || 0,
              reactions: item.react || [],
              category: item.category || 'general',
              type: item.type || 'text',
              usageCount: item.usageCount || 0,
              lastUsed: item.lastUsed,
              createdAt: item.createdAt,
              updatedAt: item.updatedAt
            }
          });
        } else {
          return res.status(404).json({
            status: false,
            error: "Not found",
            message: `No message found for "${message}"`
          });
        }
      }
    }

    // ==================== TEACH ====================
    if (teach && reply) {
      if (!validateInput(teach) || !validateInput(reply)) {
        return res.status(400).json({
          status: false,
          error: "Invalid input",
          message: "Message and reply must be valid strings (max 500 chars)"
        });
      }

      const message = sanitize(teach).toLowerCase();
      const replies = sanitize(reply).split(',')
        .map(r => r.trim())
        .filter(r => r.length > 0 && r.length <= 500);
      
      if (replies.length === 0) {
        return res.status(400).json({
          status: false,
          error: "No valid replies provided",
          message: "Please provide at least one valid reply"
        });
      }

      if (replies.length > 50) {
        return res.status(400).json({
          status: false,
          error: "Too many replies",
          message: "Maximum 50 replies per message"
        });
      }

      const existing = await collection.findOne({ message });

      const messageData = {
        message,
        reply: replies,
        updatedAt: new Date(),
        usageCount: existing ? (existing.usageCount || 0) : 0,
        lastUsed: existing ? existing.lastUsed : null
      };

      if (category) messageData.category = sanitize(category);
      if (type) messageData.type = sanitize(type);
      if (key) messageData.key = sanitize(key);
      if (language) messageData.language = sanitize(language);
      if (!existing) messageData.createdAt = new Date();

      let result;
      if (existing) {
        const existingReplies = existing.reply || [];
        const allReplies = [...new Set([...existingReplies, ...replies])];
        messageData.reply = allReplies.slice(0, 100);
        
        result = await collection.updateOne(
          { message },
          { $set: messageData }
        );
      } else {
        result = await collection.insertOne(messageData);
      }

      // Handle reactions
      if (react) {
        const reactions = sanitize(react).split(',')
          .map(r => r.trim())
          .filter(r => r.length > 0);
        
        if (reactions.length > 0) {
          await collection.updateOne(
            { message },
            { $set: { react: reactions.slice(0, 20) } }
          );
        }
      }

      return res.json({
        status: true,
        message: `✅ Successfully taught "${message}" with ${replies.length} reply(s)`,
        data: {
          message: message,
          replyCount: messageData.reply.length,
          category: messageData.category || 'general',
          type: messageData.type || 'text',
          isUpdate: !!existing
        },
        stats: {
          totalReplies: messageData.reply.length,
          reactions: react ? react.split(',').length : 0
        }
      });
    }

    // ==================== TEACH INTRO ====================
    if (teach && key === 'intro') {
      const message = sanitize(teach).toLowerCase();
      const replies = reply ? reply.split(',').map(r => sanitize(r)).filter(r => r.length > 0) : [];
      
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
        status: true,
        message: `✅ Successfully added intro reply for "${message}"`
      });
    }

    // ==================== TEACH REACT ====================
    if (teach && react) {
      const message = sanitize(teach).toLowerCase();
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
        status: true,
        message: `✅ Successfully added ${reactions.length} reaction(s) for "${message}"`
      });
    }

    // ==================== REMOVE ====================
    if (remove) {
      const message = sanitize(remove).toLowerCase();
      
      if (!message || message.length < 1) {
        return res.status(400).json({
          status: false,
          error: "Invalid message",
          message: "Please provide a valid message to remove"
        });
      }

      if (index) {
        const idx = parseInt(index) - 1;
        
        if (isNaN(idx) || idx < 0) {
          return res.status(400).json({
            status: false,
            error: "Invalid index",
            message: "Index must be a positive number"
          });
        }

        const item = await collection.findOne({ message });
        
        if (!item) {
          return res.status(404).json({
            status: false,
            error: "Not found",
            message: `No message found for "${message}"`
          });
        }

        if (!item.reply || item.reply.length <= idx) {
          return res.status(400).json({
            status: false,
            error: "Index out of range",
            message: `Message has only ${item.reply?.length || 0} replies`
          });
        }

        item.reply.splice(idx, 1);
        
        let responseMessage;
        
        if (item.reply.length === 0) {
          await collection.deleteOne({ message });
          responseMessage = `✅ Removed reply ${index} and deleted message "${message}"`;
        } else {
          await collection.updateOne(
            { message },
            { $set: { reply: item.reply, updatedAt: new Date() } }
          );
          responseMessage = `✅ Successfully removed reply ${index} for "${message}"`;
        }

        return res.json({
          status: true,
          message: responseMessage,
          remainingReplies: item.reply.length
        });
      } else {
        const result = await collection.deleteOne({ message });
        
        if (result.deletedCount > 0) {
          return res.json({
            status: true,
            message: `✅ Successfully removed "${message}" and all its replies`,
            deleted: true
          });
        } else {
          return res.status(404).json({
            status: false,
            error: "Not found",
            message: `No message found for "${message}"`
          });
        }
      }
    }

    // ==================== EDIT ====================
    if (edit && replace) {
      const oldMessage = sanitize(edit).toLowerCase();
      const newMessage = sanitize(replace).toLowerCase();
      
      if (!validateInput(oldMessage) || !validateInput(newMessage)) {
        return res.status(400).json({
          status: false,
          error: "Invalid input",
          message: "Both old and new messages must be valid"
        });
      }

      if (oldMessage === newMessage) {
        return res.status(400).json({
          status: false,
          error: "Same message",
          message: "Old and new messages are identical"
        });
      }

      const existingNew = await collection.findOne({ message: newMessage });
      if (existingNew) {
        return res.status(409).json({
          status: false,
          error: "Duplicate",
          message: `Message "${newMessage}" already exists`
        });
      }

      const result = await collection.updateOne(
        { message: oldMessage },
        { 
          $set: { 
            message: newMessage, 
            updatedAt: new Date() 
          } 
        }
      );
      
      if (result.modifiedCount > 0) {
        return res.json({
          status: true,
          message: `✅ Successfully changed "${oldMessage}" to "${newMessage}"`,
          modified: true
        });
      } else {
        return res.status(404).json({
          status: false,
          error: "Not found",
          message: `No message found for "${oldMessage}"`
        });
      }
    }

    // ==================== CHAT ====================
    if (text) {
      if (!validateInput(text)) {
        return res.status(400).json({
          status: false,
          error: "Invalid input",
          message: "Message must be a valid string"
        });
      }

      const message = sanitize(text).toLowerCase();
      const lang = language || 'en';
      
      // Try exact match first
      let item = await collection.findOne({ message });
      
      // If no exact match, try partial match
      if (!item) {
        const allItems = await collection.find({}).toArray();
        
        item = allItems.find(i => {
          const msg = i.message.toLowerCase();
          return message.includes(msg) || msg.includes(message);
        });
        
        // If still no match, try keyword matching
        if (!item) {
          const words = message.split(' ').filter(w => w.length > 2);
          if (words.length > 0) {
            for (const word of words) {
              const keywordMatch = allItems.find(i => 
                i.message.toLowerCase().includes(word)
              );
              if (keywordMatch) {
                item = keywordMatch;
                break;
              }
            }
          }
        }
      }

      if (item && item.reply && item.reply.length > 0) {
        let replyText;
        if (mode === 'sequential') {
          const lastIndex = item.lastIndex || 0;
          const nextIndex = (lastIndex + 1) % item.reply.length;
          replyText = item.reply[nextIndex];
          
          await collection.updateOne(
            { message: item.message },
            { 
              $inc: { usageCount: 1 }, 
              $set: { 
                lastUsed: new Date(),
                lastIndex: nextIndex 
              } 
            }
          );
        } else {
          const randomIndex = Math.floor(Math.random() * item.reply.length);
          replyText = item.reply[randomIndex];
          
          await collection.updateOne(
            { message: item.message },
            { 
              $inc: { usageCount: 1 }, 
              $set: { lastUsed: new Date() } 
            }
          );
        }

        const formattedReply = formatText(replyText);
        
        const response = {
          status: true,
          reply: formattedReply,
          found: true,
          data: {
            message: item.message,
            replyCount: item.reply.length,
            usageCount: (item.usageCount || 0) + 1,
            category: item.category || 'general',
            type: item.type || 'text'
          }
        };

        if (item.react && item.react.length > 0) {
          response.reactions = item.react;
        }

        if (item.key) {
          response.key = item.key;
        }

        return res.json(response);
      } else {
        const defaultResponses = {
          en: [
            "I don't understand that yet. Teach me by using: teach=message&reply=response",
            "I'm still learning! Try teaching me something new.",
            "That's interesting! Tell me what response should I give for that?",
            "I don't know that one. Would you like to teach it to me?",
            "Sorry, I haven't learned that yet. Use teach command to educate me!"
          ],
          bn: [
            "এটা আমি এখনো বুঝিনি। আমাকে শেখাতে: teach=message&reply=response ব্যবহার করুন",
            "আমি এখনো শিখছি! আমাকে নতুন কিছু শেখানোর চেষ্টা করুন।",
            "এটা মজার! এর জন্য আমি কি উত্তর দিব তা আমাকে বলুন?",
            "এটা আমি জানি না। আপনি কি আমাকে শেখাতে চান?",
            "দুঃখিত, আমি এখনো এটি শিখিনি। আমাকে শেখাতে teach কমান্ড ব্যবহার করুন!"
          ]
        };

        const responses = defaultResponses[lang] || defaultResponses.en;
        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
        
        return res.json({
          status: false,
          reply: formatText(randomResponse),
          found: false,
          suggestion: "Try: /baby?teach=" + encodeURIComponent(message) + "&reply=your_response"
        });
      }
    }

    // ==================== DEFAULT RESPONSE ====================
    const totalMessages = await collection.countDocuments();
    const allMessages = await collection.find({}).limit(100).toArray();
    const totalReplies = allMessages.reduce((sum, msg) => sum + (msg.reply ? msg.reply.length : 0), 0);
    
    const categories = {};
    allMessages.forEach(msg => {
      if (msg.category) {
        categories[msg.category] = (categories[msg.category] || 0) + 1;
      }
    });

    return res.json({
      status: true,
      service: "Baby Bot Pro API",
      version: "7.0.0",
      author: "dipto",
      database: {
        connected: true,
        totalMessages,
        totalReplies,
        categories
      },
      endpoints: {
        "Chat": "/api/baby?text=your_message",
        "Teach": "/api/baby?teach=message&reply=response1,response2",
        "Teach with category": "/api/baby?teach=msg&reply=res&category=fun",
        "Remove": "/api/baby?remove=message",
        "Remove reply": "/api/baby?remove=message&index=1",
        "List all": "/api/baby?list=all",
        "Search": "/api/baby?search=query",
        "Random": "/api/baby?random=true",
        "Stats": "/api/baby?stats=true",
        "Edit": "/api/baby?edit=old&replace=new",
        "Export": "/api/baby?export=true"
      },
      features: [
        "Advanced text formatting",
        "Category & type support",
        "Reaction system",
        "Search functionality",
        "Pagination",
        "Sequential/Random reply modes",
        "Multi-language support",
        "Duplicate prevention",
        "Input sanitization",
        "MongoDB storage"
      ],
      example: "Try: /api/baby?text=hello or /api/baby?teach=good morning&reply=Morning!,Good day!"
    });

  } catch (error) {
    console.error('🚨 Baby Bot API Error:', error);
    
    let errorMessage = "Internal server error";
    let statusCode = 500;
    
    if (error.name === 'MongoNetworkError') {
      errorMessage = "Database connection failed";
      statusCode = 503;
    } else if (error.name === 'MongoError' && error.code === 11000) {
      errorMessage = "Duplicate message detected";
      statusCode = 409;
    } else if (error.name === 'ValidationError') {
      errorMessage = "Invalid input data";
      statusCode = 400;
    }
    
    return res.status(statusCode).json({
      status: false,
      error: errorMessage,
      message: error.message,
      timestamp: new Date().toISOString()
    });
  } finally {
    if (client) {
      try {
        await client.close();
      } catch (closeError) {
        console.error('Error closing MongoDB connection:', closeError);
      }
    }
  }
}

module.exports = { meta, onStart };
