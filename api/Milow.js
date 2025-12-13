const mongoose = require('mongoose');

// ==================== MONGODB CONNECTION ====================
const MONGODB_URI = "mongodb+srv://milowbaby:cmd%401233@milowbaby.dnkcxog.mongodb.net/milowbaby?retryWrites=true&w=majority&appName=milowbaby";

// MongoDB Schema
const messageSchema = new mongoose.Schema({
  message: { type: String, required: true, unique: true, lowercase: true },
  reply: [{ type: String, required: true }],
  react: [String],
  key: { type: String, default: null },
  createdBy: { type: String, default: 'unknown' },
  teachers: [String],
  usageCount: { type: Number, default: 0 },
  lastUsed: Date
}, { timestamps: true });

const Message = mongoose.models.Message || mongoose.model('Message', messageSchema);

// ==================== DATABASE SERVICE ====================
class DatabaseService {
  constructor() {
    this.isConnected = false;
  }

  async connect() {
    if (this.isConnected) return;
    
    try {
      await mongoose.connect(MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });
      this.isConnected = true;
      console.log('✅ MongoDB connected successfully');
    } catch (error) {
      console.error('❌ MongoDB connection failed:', error.message);
      throw error;
    }
  }

  async findMessage(message) {
    await this.connect();
    return await Message.findOne({ message });
  }

  async createMessage(data) {
    await this.connect();
    return await Message.create(data);
  }

  async updateMessage(query, update) {
    await this.connect();
    return await Message.updateOne(query, update);
  }

  async deleteMessage(query) {
    await this.connect();
    return await Message.deleteOne(query);
  }

  async findAll() {
    await this.connect();
    return await Message.find({});
  }

  async countMessages() {
    await this.connect();
    return await Message.countDocuments();
  }

  async searchMessages(keyword) {
    await this.connect();
    return await Message.find({
      $or: [
        { message: { $regex: keyword, $options: 'i' } },
        { reply: { $elemMatch: { $regex: keyword, $options: 'i' } } }
      ]
    });
  }

  async getRandomMessage() {
    await this.connect();
    const count = await Message.countDocuments();
    const random = Math.floor(Math.random() * count);
    return await Message.findOne().skip(random);
  }

  async getStats() {
    await this.connect();
    const totalMessages = await Message.countDocuments();
    const allMessages = await Message.find({});
    
    const totalReplies = allMessages.reduce((sum, msg) => sum + msg.reply.length, 0);
    const totalReactions = allMessages.reduce((sum, msg) => sum + (msg.react?.length || 0), 0);
    const totalTeachers = new Set(allMessages.flatMap(msg => msg.teachers || [])).size;
    
    const mostUsed = [...allMessages]
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 5)
      .map(msg => ({ message: msg.message, usageCount: msg.usageCount }));
    
    return { totalMessages, totalReplies, totalReactions, totalTeachers, mostUsed };
  }
}

// ==================== API METADATA ====================
const meta = {
  name: "Baby Bot API",
  version: "4.0.0",
  description: "All-in-One Baby Bot API with MongoDB",
  author: "RaiHan",
  path: "/baby",
  method: "get",
  category: "chat"
};

// ==================== TEXT FORMATTER ====================
const formatText = (text) => {
  const fontMap = {
    'a': 'ᴀ', 'b': 'ʙ', 'c': 'ᴄ', 'd': 'ᴅ', 'e': 'ᴇ', 'f': 'ꜰ', 'g': 'ɢ', 'h': 'ʜ',
    'i': 'ɪ', 'j': 'ᴊ', 'k': 'ᴋ', 'l': 'ʟ', 'm': 'ᴍ', 'n': 'ɴ', 'o': 'ᴏ', 'p': 'ᴘ',
    'q': 'ǫ', 'r': 'ʀ', 's': 'ꜱ', 't': 'ᴛ', 'u': 'ᴜ', 'v': 'ᴠ', 'w': 'ᴡ', 'x': 'x',
    'y': 'ʏ', 'z': 'ᴢ',
    'A': 'ᴀ', 'B': 'ʙ', 'C': 'ᴄ', 'D': 'ᴅ', 'E': 'ᴇ', 'F': 'ꜰ', 'G': 'ɢ', 'H': 'ʜ',
    'I': 'ɪ', 'J': 'ᴊ', 'K': 'ᴋ', 'L': 'ʟ', 'M': 'ᴍ', 'N': 'ɴ', 'O': 'ᴏ', 'P': 'ᴘ',
    'Q': 'ǫ', 'R': 'ʀ', 'S': 'ꜱ', 'T': 'ᴛ', 'U': 'ᴜ', 'V': 'ᴠ', 'W': 'ᴡ', 'X': 'x',
    'Y': 'ʏ', 'Z': 'ᴢ'
  };
  
  if (typeof text !== 'string') return text;
  
  let formatted = '';
  for (const char of text) {
    formatted += fontMap[char] || char;
  }
  return formatted;
};

// ==================== DEFAULT RESPONSES ====================
const DEFAULT_RESPONSES = [
  "আমি বুঝতে পারিনি, আমাকে আরো শেখানোর চেষ্টা করুন! 😊",
  "এই বিষয়ে আমি জানি না, আপনি আমাকে শেখাতে পারেন!",
  "আমি এখনো সেই প্রশ্নের উত্তর শিখিনি।",
  "দুঃখিত, আমি এখনো এটা জানি না।",
  "আপনি আমাকে 'teach [message] - [reply]' লিখে শেখাতে পারেন।"
];

// ==================== MAIN API HANDLER ====================
async function onStart({ req, res }) {
  const db = new DatabaseService();
  const { 
    text, senderID, teach, reply, remove, index, list, edit, replace, 
    key, react, search, random, stats, help 
  } = req.query;
  
  try {
    // ==================== HELP COMMAND ====================
    if (help || (!text && !teach && !remove && !list && !edit && !search && !random && !stats)) {
      return res.json({
        status: true,
        message: "👶 All-in-One Baby Bot API",
        version: "4.0.0",
        author: "RaiHan",
        database: "MongoDB",
        endpoints: {
          "Chat": "/api/baby?text=hello",
          "Teach": "/api/baby?teach=hi&reply=Hello,Hi there",
          "Teach React": "/api/baby?teach=hi&react=😊,❤️",
          "Remove": "/api/baby?remove=hi",
          "Remove Index": "/api/baby?remove=hi&index=1",
          "List All": "/api/baby?list=all",
          "List One": "/api/baby?list=hi",
          "Edit": "/api/baby?edit=old&replace=new",
          "Search": "/api/baby?search=hello",
          "Random": "/api/baby?random=true",
          "Stats": "/api/baby?stats=true"
        }
      });
    }
    
    // ==================== CHAT FUNCTION ====================
    if (text) {
      const message = text.toLowerCase().trim();
      let item = await db.findMessage(message);
      
      if (!item) {
        const allItems = await db.findAll();
        item = allItems.find(i => 
          message.includes(i.message) || i.message.includes(message)
        );
      }
      
      if (item && item.reply.length > 0) {
        const randomIndex = Math.floor(Math.random() * item.reply.length);
        const replyText = item.reply[randomIndex];
        
        await db.updateMessage(
          { _id: item._id },
          { $inc: { usageCount: 1 }, $set: { lastUsed: new Date() } }
        );
        
        return res.json({
          status: true,
          reply: formatText(replyText),
          found: true,
          reactions: item.react || [],
          usageCount: item.usageCount + 1
        });
      } else {
        const randomResponse = DEFAULT_RESPONSES[Math.floor(Math.random() * DEFAULT_RESPONSES.length)];
        return res.json({
          status: false,
          reply: formatText(randomResponse),
          found: false
        });
      }
    }
    
    // ==================== TEACH COMMAND ====================
    if (teach && reply) {
      const message = teach.toLowerCase().trim();
      const replies = reply.split(',').map(r => r.trim()).filter(r => r.length > 0);
      
      const existing = await db.findMessage(message);
      
      if (existing) {
        const updatedReplies = [...new Set([...existing.reply, ...replies])];
        await db.updateMessage(
          { _id: existing._id },
          { 
            $set: { reply: updatedReplies },
            $addToSet: { teachers: senderID || 'unknown' }
          }
        );
        
        return res.json({
          status: true,
          message: `✅ Updated "${message}" with ${replies.length} new reply(s)`,
          totalReplies: updatedReplies.length,
          teacher: senderID || 'unknown'
        });
      } else {
        await db.createMessage({
          message,
          reply: replies,
          createdBy: senderID || 'unknown',
          teachers: [senderID || 'unknown'],
          key: key || null
        });
        
        return res.json({
          status: true,
          message: `✅ Added new message "${message}" with ${replies.length} reply(s)`,
          totalReplies: replies.length,
          teacher: senderID || 'unknown'
        });
      }
    }
    
    // ==================== TEACH REACT ====================
    if (teach && react) {
      const message = teach.toLowerCase().trim();
      const reactions = react.split(',').map(r => r.trim()).filter(r => r.length > 0);
      
      const existing = await db.findMessage(message);
      
      if (existing) {
        const updatedReacts = existing.react 
          ? [...new Set([...existing.react, ...reactions])]
          : reactions;
        
        await db.updateMessage(
          { _id: existing._id },
          { $set: { react: updatedReacts } }
        );
        
        return res.json({
          status: true,
          message: `✅ Added ${reactions.length} reaction(s) to "${message}"`
        });
      } else {
        await db.createMessage({
          message,
          react: reactions,
          createdBy: senderID || 'unknown',
          teachers: [senderID || 'unknown']
        });
        
        return res.json({
          status: true,
          message: `✅ Created "${message}" with ${reactions.length} reaction(s)`
        });
      }
    }
    
    // ==================== REMOVE COMMAND ====================
    if (remove) {
      const message = remove.toLowerCase().trim();
      
      if (index) {
        const idx = parseInt(index) - 1;
        const existing = await db.findMessage(message);
        
        if (!existing) {
          return res.json({
            status: false,
            message: `❌ "${message}" not found`
          });
        }
        
        if (existing.reply.length <= idx) {
          return res.json({
            status: false,
            message: `❌ No reply at index ${index}`,
            totalReplies: existing.reply.length
          });
        }
        
        existing.reply.splice(idx, 1);
        
        if (existing.reply.length === 0) {
          await db.deleteMessage({ _id: existing._id });
          return res.json({
            status: true,
            message: `✅ Removed reply ${index} and deleted empty message "${message}"`
          });
        } else {
          await db.updateMessage(
            { _id: existing._id },
            { $set: { reply: existing.reply } }
          );
          
          return res.json({
            status: true,
            message: `✅ Removed reply ${index} from "${message}"`,
            remainingReplies: existing.reply.length
          });
        }
      } else {
        const result = await db.deleteMessage({ message });
        
        if (result.deletedCount > 0) {
          return res.json({
            status: true,
            message: `✅ Removed "${message}" and all its replies`
          });
        } else {
          return res.json({
            status: false,
            message: `❌ "${message}" not found`
          });
        }
      }
    }
    
    // ==================== LIST COMMAND ====================
    if (list) {
      if (list === 'all') {
        const allData = await db.findAll();
        
        const teacherStats = {};
        allData.forEach(item => {
          if (item.teachers) {
            item.teachers.forEach(teacher => {
              teacherStats[teacher] = (teacherStats[teacher] || 0) + 1;
            });
          }
        });
        
        return res.json({
          status: true,
          data: allData,
          teacher: {
            teacherList: Object.entries(teacherStats).map(([k, v]) => ({ [k]: v })),
            counts: teacherStats
          }
        });
      } else {
        const message = list.toLowerCase().trim();
        const item = await db.findMessage(message);
        
        if (item) {
          return res.json({
            status: true,
            message: item.message,
            replyCount: item.reply.length,
            replies: item.reply,
            reactions: item.react || [],
            createdBy: item.createdBy,
            usageCount: item.usageCount
          });
        } else {
          return res.json({
            status: false,
            message: `"${message}" not found`
          });
        }
      }
    }
    
    // ==================== EDIT COMMAND ====================
    if (edit && replace) {
      const oldMessage = edit.toLowerCase().trim();
      const newMessage = replace.toLowerCase().trim();
      
      const existing = await db.findMessage(newMessage);
      if (existing) {
        return res.json({
          status: false,
          message: `"${newMessage}" already exists`
        });
      }
      
      const result = await db.updateMessage(
        { message: oldMessage },
        { $set: { message: newMessage } }
      );
      
      if (result.modifiedCount > 0) {
        return res.json({
          status: true,
          message: `✅ Changed "${oldMessage}" to "${newMessage}"`
        });
      } else {
        return res.json({
          status: false,
          message: `"${oldMessage}" not found`
        });
      }
    }
    
    // ==================== SEARCH COMMAND ====================
    if (search) {
      const results = await db.searchMessages(search);
      
      return res.json({
        status: true,
        search: search,
        results: results.map(r => ({
          message: r.message,
          replyCount: r.reply.length,
          usageCount: r.usageCount
        })),
        totalFound: results.length
      });
    }
    
    // ==================== RANDOM COMMAND ====================
    if (random === 'true') {
      const randomItem = await db.getRandomMessage();
      
      if (randomItem) {
        const randomReply = randomItem.reply.length > 0
          ? randomItem.reply[Math.floor(Math.random() * randomItem.reply.length)]
          : "No reply available";
        
        return res.json({
          status: true,
          random: {
            message: randomItem.message,
            reply: randomReply,
            replies: randomItem.reply.length,
            createdBy: randomItem.createdBy
          }
        });
      } else {
        return res.json({
          status: false,
          message: "No messages in database"
        });
      }
    }
    
    // ==================== STATS COMMAND ====================
    if (stats === 'true') {
      const statsData = await db.getStats();
      
      return res.json({
        status: true,
        stats: statsData,
        timestamp: new Date().toISOString()
      });
    }
    
    // ==================== DEFAULT RESPONSE ====================
    const totalMessages = await db.countMessages();
    
    return res.json({
      status: true,
      message: "👶 Baby Bot API is running!",
      version: "4.0.0",
      author: "RaiHan",
      database: {
        connected: true,
        totalMessages: totalMessages
      }
    });
    
  } catch (error) {
    console.error('API Error:', error);
    
    return res.status(500).json({
      status: false,
      error: "Internal server error",
      message: error.message
    });
  }
}

// ==================== EXPORT ====================
module.exports = { meta, onStart };

// ==================== INITIALIZE ON LOAD ====================
console.log('✅ Baby Bot API loaded with MongoDB');
