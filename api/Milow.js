// api/milow.js - Correct endpoint format
const { MongoClient } = require('mongodb');

// MongoDB Configuration
const MONGODB_URI = "mongodb+srv://milowbaby:cmd%401233@milowbaby.dnkcxog.mongodb.net/?retryWrites=true&w=majority&appName=milowbaby";
const DB_NAME = 'milowbaby';
const COLLECTION_NAME = 'baby_messages';

// MongoDB Connection (shared across requests)
let dbClient = null;
let db = null;

async function connectDB() {
  try {
    if (!dbClient) {
      dbClient = new MongoClient(MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
      });
      
      await dbClient.connect();
      db = dbClient.db(DB_NAME);
      
      // Create indexes
      const collection = db.collection(COLLECTION_NAME);
      await collection.createIndex({ message: 1 }, { unique: true });
      await collection.createIndex({ createdAt: -1 });
      await collection.createIndex({ createdBy: 1 });
    }
    
    return db;
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    throw error;
  }
}

// Helper function
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
  
  let formattedText = '';
  for (const char of text) {
    formattedText += fontMap[char] || char;
  }
  return formattedText;
};

// API Metadata
const meta = {
  name: "Baby Bot API",
  version: "7.0.0",
  description: "AI chatbot API for baby bot with MongoDB",
  author: "RaiHan",
  path: "/baby",
  method: "get",
  category: "chat"
};

// Main API Handler
async function onStart({ req, res }) {
  const { text, senderID, teach, reply, remove, index, list, edit, replace, key, react } = req.query;
  
  try {
    // Connect to MongoDB
    const db = await connectDB();
    const collection = db.collection(COLLECTION_NAME);
    
    // 1. TEACH COMMAND
    if (teach && reply) {
      const message = teach.toLowerCase().trim();
      const replies = reply.split(',').map(r => r.trim()).filter(r => r.length > 0);
      
      let existing = await collection.findOne({ message });
      
      if (existing) {
        const updatedReplies = [...new Set([...existing.reply, ...replies])];
        await collection.updateOne(
          { _id: existing._id },
          { 
            $set: { 
              reply: updatedReplies,
              updatedAt: new Date()
            },
            $addToSet: { 
              teachers: senderID || 'unknown'
            }
          }
        );
        
        return res.json({
          message: `✅ "${message}" এর জন্য ${replies.length} টি রিপ্লাই যোগ করা হয়েছে`,
          teacher: senderID || 'unknown',
          teachs: updatedReplies.length
        });
      } else {
        await collection.insertOne({
          message,
          reply: replies,
          createdBy: senderID || 'unknown',
          teachers: [senderID || 'unknown'],
          createdAt: new Date(),
          updatedAt: new Date(),
          usageCount: 0,
          lastUsed: null
        });
        
        return res.json({
          message: `✅ নতুন মেসেজ "${message}" এর জন্য ${replies.length} টি রিপ্লাই যোগ করা হয়েছে`,
          teacher: senderID || 'unknown',
          teachs: replies.length
        });
      }
    }
    
    // 2. TEACH WITH KEY (intro)
    if (teach && key === 'intro') {
      const message = teach.toLowerCase().trim();
      const replies = reply.split(',').map(r => r.trim()).filter(r => r.length > 0);
      
      let existing = await collection.findOne({ message });
      
      if (existing) {
        const updatedReplies = [...new Set([...existing.reply, ...replies])];
        await collection.updateOne(
          { _id: existing._id },
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
          teachers: [senderID || 'unknown'],
          key: 'intro',
          createdAt: new Date(),
          updatedAt: new Date(),
          usageCount: 0,
          lastUsed: null
        });
      }
      
      return res.json({
        message: `✅ "${message}" এর জন্য ইন্ট্রো রিপ্লাই যোগ করা হয়েছে`
      });
    }
    
    // 3. TEACH REACT
    if (teach && react) {
      const message = teach.toLowerCase().trim();
      const reactions = react.split(',').map(r => r.trim()).filter(r => r.length > 0);
      
      let existing = await collection.findOne({ message });
      
      if (existing) {
        const updatedReacts = existing.react ? 
          [...new Set([...existing.react, ...reactions])] : 
          reactions;
        
        await collection.updateOne(
          { _id: existing._id },
          { 
            $set: { 
              react: updatedReacts,
              updatedAt: new Date()
            }
          }
        );
      } else {
        await collection.insertOne({
          message,
          react: reactions,
          createdBy: senderID || 'unknown',
          teachers: [senderID || 'unknown'],
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
      
      return res.json({
        message: `✅ "${message}" এর জন্য ${reactions.length} টি রিঅ্যাকশন যোগ করা হয়েছে`
      });
    }
    
    // 4. REMOVE COMMAND
    if (remove && !index) {
      const message = remove.toLowerCase().trim();
      
      const result = await collection.deleteOne({ message });
      
      if (result.deletedCount > 0) {
        return res.json({
          message: `✅ "${message}" এর সব রিপ্লাই ডিলিট করা হয়েছে`
        });
      } else {
        return res.json({
          message: `❌ "${message}" নামে কোনো এন্ট্রি পাওয়া যায়নি`
        });
      }
    }
    
    // 5. REMOVE WITH INDEX
    if (remove && index) {
      const message = remove.toLowerCase().trim();
      const idx = parseInt(index) - 1;
      
      const existing = await collection.findOne({ message });
      
      if (existing) {
        if (existing.reply && existing.reply.length > idx) {
          existing.reply.splice(idx, 1);
          
          if (existing.reply.length === 0) {
            await collection.deleteOne({ _id: existing._id });
            return res.json({
              message: `✅ "${message}" এর সব রিপ্লাই ডিলিট করা হয়েছে`
            });
          } else {
            await collection.updateOne(
              { _id: existing._id },
              { 
                $set: { 
                  reply: existing.reply,
                  updatedAt: new Date()
                }
              }
            );
            
            return res.json({
              message: `✅ "${message}" এর ${index} নং রিপ্লাই ডিলিট করা হয়েছে`
            });
          }
        } else {
          return res.json({
            message: `❌ "${message}" এর জন্য ${index} নং ইনভ্যালিড`
          });
        }
      } else {
        return res.json({
          message: `❌ "${message}" নামে কোনো এন্ট্রি পাওয়া যায়নি`
        });
      }
    }
    
    // 6. EDIT COMMAND
    if (edit && replace) {
      const oldMessage = edit.toLowerCase().trim();
      const newMessage = replace.toLowerCase().trim();
      
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
          message: `✅ "${oldMessage}" কে "${newMessage}" তে পরিবর্তন করা হয়েছে`
        });
      } else {
        return res.json({
          message: `❌ "${oldMessage}" নামে কোনো এন্ট্রি পাওয়া যায়নি`
        });
      }
    }
    
    // 7. LIST COMMANDS
    if (list) {
      if (list === 'all') {
        const allData = await collection.find({}).toArray();
        
        const teacherStats = {};
        allData.forEach(item => {
          if (item.teachers) {
            item.teachers.forEach(teacher => {
              teacherStats[teacher] = (teacherStats[teacher] || 0) + 1;
            });
          }
        });
        
        const teacherList = Object.keys(teacherStats).map(teacher => ({
          [teacher]: teacherStats[teacher]
        }));
        
        return res.json({
          data: allData,
          teacher: {
            teacherList: teacherList,
            counts: teacherStats
          }
        });
      } else {
        const message = list.toLowerCase().trim();
        const item = await collection.findOne({ message });
        
        if (item && item.reply) {
          return res.json({
            data: item.reply.length
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
      
      let item = await collection.findOne({ message });
      
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
        
        await collection.updateOne(
          { _id: item._id },
          { 
            $inc: { usageCount: 1 }, 
            $set: { lastUsed: new Date() }
          }
        );
        
        const response = {
          reply: formatText(replyText),
          found: true
        };
        
        if (item.react && item.react.length > 0) {
          response.reactions = item.react;
        }
        
        return res.json(response);
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
    
    // Default response if no valid query
    const totalMessages = await collection.countDocuments();
    
    res.json({
      message: "👶 Baby Bot API চলছে! 🚀",
      version: "7.0.0",
      author: "Raihan",
      database: {
        connected: true,
        totalMessages: totalMessages
      },
      endpoints: {
        "GET /baby?text=[message]": "Get a response",
        "GET /baby?teach=[message]&reply=[response]": "Teach a new response",
        "GET /baby?remove=[message]": "Remove all responses for a message",
        "GET /baby?list=all": "Get all data",
        "GET /baby?teach=[message]&react=[emojis]": "Add reactions to message"
      }
    });
    
  } catch (error) {
    console.error('🚨 Baby Bot API তে সমস্যা:', error);
    res.status(500).json({
      error: "ইন্টারনাল সার্ভার এরর",
      message: error.message
    });
  }
}

// Export as Wataru API endpoint module
module.exports = { meta, onStart };
