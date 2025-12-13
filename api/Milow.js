// api/milow.js - Professional Baby Bot API with Expert Error Handling
const { MongoClient } = require('mongodb');

// ==================== CONFIGURATION ====================
const CONFIG = {
  MONGODB_URI: "mongodb+srv://milowbaby:cmd%401233@milowbaby.dnkcxog.mongodb.net/?retryWrites=true&w=majority&appName=milowbaby",
  DB_NAME: 'milowbaby',
  COLLECTION_NAME: 'baby_messages',
  MAX_RETRIES: 3,
  CONNECTION_TIMEOUT: 10000,
  QUERY_TIMEOUT: 5000,
  CACHE_TTL: 30000 // 30 seconds
};

// ==================== ERROR CODES & MESSAGES ====================
const ERROR_CODES = {
  DB_CONNECTION_FAILED: 'DB_CONNECTION_FAILED',
  DB_QUERY_FAILED: 'DB_QUERY_FAILED',
  INVALID_INPUT: 'INVALID_INPUT',
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
  UNAUTHORIZED: 'UNAUTHORIZED',
  RATE_LIMITED: 'RATE_LIMITED',
  VALIDATION_ERROR: 'VALIDATION_ERROR'
};

const ERROR_MESSAGES = {
  [ERROR_CODES.DB_CONNECTION_FAILED]: 'Database connection failed. Please try again later.',
  [ERROR_CODES.DB_QUERY_FAILED]: 'Database query failed.',
  [ERROR_CODES.INVALID_INPUT]: 'Invalid input provided.',
  [ERROR_CODES.NOT_FOUND]: 'Requested resource not found.',
  [ERROR_CODES.DUPLICATE_ENTRY]: 'Entry already exists.',
  [ERROR_CODES.UNAUTHORIZED]: 'Unauthorized access.',
  [ERROR_CODES.RATE_LIMITED]: 'Too many requests. Please try again later.',
  [ERROR_CODES.VALIDATION_ERROR]: 'Validation error.'
};

// ==================== CACHE SYSTEM ====================
const cache = new Map();

function getFromCache(key) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CONFIG.CACHE_TTL) {
    return cached.data;
  }
  cache.delete(key);
  return null;
}

function setToCache(key, data) {
  cache.set(key, {
    data,
    timestamp: Date.now()
  });
}

function clearCache() {
  cache.clear();
}

// ==================== DATABASE CONNECTION WITH RETRY ====================
let dbClient = null;
let db = null;
let isConnected = false;
let connectionRetries = 0;

async function connectDB() {
  // Return cached connection if available
  if (isConnected && db) {
    return db;
  }

  // Check if we've exceeded retry limit
  if (connectionRetries >= CONFIG.MAX_RETRIES) {
    throw new ErrorHandler(
      ERROR_CODES.DB_CONNECTION_FAILED,
      'Maximum retry attempts reached'
    );
  }

  try {
    connectionRetries++;
    
    console.log(`🔄 Attempting MongoDB connection (Attempt ${connectionRetries}/${CONFIG.MAX_RETRIES})`);
    
    if (!dbClient) {
      dbClient = new MongoClient(CONFIG.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: CONFIG.CONNECTION_TIMEOUT,
        socketTimeoutMS: CONFIG.CONNECTION_TIMEOUT * 2,
        connectTimeoutMS: CONFIG.CONNECTION_TIMEOUT,
        maxPoolSize: 10,
        minPoolSize: 2,
        maxIdleTimeMS: 10000
      });
    }

    // Connect with timeout
    await Promise.race([
      dbClient.connect(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), CONFIG.CONNECTION_TIMEOUT)
      )
    ]);

    db = dbClient.db(CONFIG.DB_NAME);
    
    // Verify connection
    await db.command({ ping: 1 });
    
    // Create indexes if they don't exist
    const collection = db.collection(CONFIG.COLLECTION_NAME);
    await Promise.all([
      collection.createIndex({ message: 1 }, { unique: true, background: true }),
      collection.createIndex({ createdAt: -1 }, { background: true }),
      collection.createIndex({ usageCount: -1 }, { background: true }),
      collection.createIndex({ 'teachers': 1 }, { background: true }),
      collection.createIndex({ 'key': 1 }, { background: true, sparse: true })
    ]);
    
    isConnected = true;
    connectionRetries = 0;
    
    console.log('✅ MongoDB connected and ready');
    return db;
    
  } catch (error) {
    console.error(`❌ MongoDB connection failed (Attempt ${connectionRetries}):`, error.message);
    
    // Clean up failed connection
    if (dbClient) {
      try {
        await dbClient.close();
      } catch (closeError) {
        console.error('Failed to close connection:', closeError.message);
      }
      dbClient = null;
      db = null;
      isConnected = false;
    }
    
    // Wait before retry (exponential backoff)
    const waitTime = Math.min(1000 * Math.pow(2, connectionRetries - 1), 10000);
    console.log(`⏳ Retrying in ${waitTime}ms...`);
    
    await new Promise(resolve => setTimeout(resolve, waitTime));
    
    // Retry if not exceeded max retries
    if (connectionRetries < CONFIG.MAX_RETRIES) {
      return connectDB();
    }
    
    throw new ErrorHandler(
      ERROR_CODES.DB_CONNECTION_FAILED,
      `Failed to connect after ${CONFIG.MAX_RETRIES} attempts: ${error.message}`
    );
  }
}

// ==================== ERROR HANDLER CLASS ====================
class ErrorHandler extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
    this.statusCode = this.getStatusCode(code);
  }

  getStatusCode(code) {
    const statusMap = {
      [ERROR_CODES.DB_CONNECTION_FAILED]: 503,
      [ERROR_CODES.DB_QUERY_FAILED]: 500,
      [ERROR_CODES.INVALID_INPUT]: 400,
      [ERROR_CODES.NOT_FOUND]: 404,
      [ERROR_CODES.DUPLICATE_ENTRY]: 409,
      [ERROR_CODES.UNAUTHORIZED]: 401,
      [ERROR_CODES.RATE_LIMITED]: 429,
      [ERROR_CODES.VALIDATION_ERROR]: 422
    };
    return statusMap[code] || 500;
  }

  toJSON() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
        timestamp: this.timestamp
      },
      operator: "RaiHan"
    };
  }
}

// ==================== VALIDATION UTILITIES ====================
class Validator {
  static validateMessage(message) {
    if (!message || typeof message !== 'string') {
      throw new ErrorHandler(
        ERROR_CODES.VALIDATION_ERROR,
        'Message must be a non-empty string'
      );
    }
    
    const trimmed = message.trim();
    
    if (trimmed.length < 1) {
      throw new ErrorHandler(
        ERROR_CODES.VALIDATION_ERROR,
        'Message cannot be empty'
      );
    }
    
    if (trimmed.length > 500) {
      throw new ErrorHandler(
        ERROR_CODES.VALIDATION_ERROR,
        'Message too long (max 500 characters)'
      );
    }
    
    // Prevent SQL/NoSQL injection patterns
    const dangerousPatterns = [
      /\$where/i,
      /\$regex/i,
      /\$function/i,
      /<script.*?>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi
    ];
    
    for (const pattern of dangerousPatterns) {
      if (pattern.test(trimmed)) {
        throw new ErrorHandler(
          ERROR_CODES.VALIDATION_ERROR,
          'Message contains unsafe content'
        );
      }
    }
    
    return trimmed.toLowerCase();
  }

  static validateReplies(replies) {
    if (!replies || !Array.isArray(replies) || replies.length === 0) {
      throw new ErrorHandler(
        ERROR_CODES.VALIDATION_ERROR,
        'At least one reply is required'
      );
    }
    
    const validReplies = replies
      .map(reply => {
        const trimmed = reply.trim();
        if (trimmed.length < 1 || trimmed.length > 1000) {
          throw new ErrorHandler(
            ERROR_CODES.VALIDATION_ERROR,
            `Reply must be 1-1000 characters. Invalid: "${reply}"`
          );
        }
        return trimmed;
      })
      .filter(reply => reply.length > 0);
    
    if (validReplies.length === 0) {
      throw new ErrorHandler(
        ERROR_CODES.VALIDATION_ERROR,
        'No valid replies provided'
      );
    }
    
    return validReplies;
  }

  static validateIndex(index) {
    const num = parseInt(index);
    if (isNaN(num) || num < 1) {
      throw new ErrorHandler(
        ERROR_CODES.VALIDATION_ERROR,
        `Invalid index: ${index}. Must be a positive number`
      );
    }
    return num - 1; // Convert to zero-based index
  }

  static validateReactions(reactions) {
    if (!reactions || !Array.isArray(reactions)) {
      throw new ErrorHandler(
        ERROR_CODES.VALIDATION_ERROR,
        'Reactions must be an array'
      );
    }
    
    const emojiRegex = /^(\p{Emoji}|\p{Emoji_Presentation}|\p{Emoji_Modifier}|\p{Emoji_Modifier_Base}|\p{Emoji_Component})+$/u;
    
    const validReactions = reactions
      .map(reaction => reaction.trim())
      .filter(reaction => {
        if (reaction.length === 0) return false;
        // Allow emojis and short text reactions
        return emojiRegex.test(reaction) || reaction.length <= 20;
      });
    
    return [...new Set(validReactions)]; // Remove duplicates
  }
}

// ==================== DATABASE OPERATIONS WITH ERROR HANDLING ====================
class DatabaseService {
  constructor() {
    this.collection = null;
  }

  async getCollection() {
    if (!this.collection) {
      const database = await connectDB();
      this.collection = database.collection(CONFIG.COLLECTION_NAME);
    }
    return this.collection;
  }

  async findMessage(message) {
    try {
      const collection = await this.getCollection();
      const cacheKey = `message:${message}`;
      
      // Try cache first
      const cached = getFromCache(cacheKey);
      if (cached) return cached;
      
      const result = await Promise.race([
        collection.findOne({ message }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Query timeout')), CONFIG.QUERY_TIMEOUT)
        )
      ]);
      
      if (result) {
        setToCache(cacheKey, result);
      }
      
      return result;
    } catch (error) {
      throw new ErrorHandler(
        ERROR_CODES.DB_QUERY_FAILED,
        `Failed to find message: ${error.message}`,
        { message }
      );
    }
  }

  async findAllMessages() {
    try {
      const collection = await this.getCollection();
      const cacheKey = 'all:messages';
      
      const cached = getFromCache(cacheKey);
      if (cached) return cached;
      
      const result = await Promise.race([
        collection.find({}).toArray(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Query timeout')), CONFIG.QUERY_TIMEOUT * 2)
        )
      ]);
      
      setToCache(cacheKey, result);
      return result;
    } catch (error) {
      throw new ErrorHandler(
        ERROR_CODES.DB_QUERY_FAILED,
        `Failed to fetch all messages: ${error.message}`
      );
    }
  }

  async insertMessage(messageData) {
    try {
      const collection = await this.getCollection();
      
      const result = await Promise.race([
        collection.insertOne(messageData),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Insert timeout')), CONFIG.QUERY_TIMEOUT)
        )
      ]);
      
      // Clear relevant caches
      clearCache();
      
      return result;
    } catch (error) {
      if (error.code === 11000) { // Duplicate key error
        throw new ErrorHandler(
          ERROR_CODES.DUPLICATE_ENTRY,
          `Message "${messageData.message}" already exists`,
          { message: messageData.message }
        );
      }
      throw new ErrorHandler(
        ERROR_CODES.DB_QUERY_FAILED,
        `Failed to insert message: ${error.message}`,
        { message: messageData.message }
      );
    }
  }

  async updateMessage(filter, update) {
    try {
      const collection = await this.getCollection();
      
      const result = await Promise.race([
        collection.updateOne(filter, update),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Update timeout')), CONFIG.QUERY_TIMEOUT)
        )
      ]);
      
      // Clear relevant caches
      clearCache();
      
      return result;
    } catch (error) {
      throw new ErrorHandler(
        ERROR_CODES.DB_QUERY_FAILED,
        `Failed to update message: ${error.message}`,
        { filter, update }
      );
    }
  }

  async deleteMessage(filter) {
    try {
      const collection = await this.getCollection();
      
      const result = await Promise.race([
        collection.deleteOne(filter),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Delete timeout')), CONFIG.QUERY_TIMEOUT)
        )
      ]);
      
      // Clear relevant caches
      clearCache();
      
      return result;
    } catch (error) {
      throw new ErrorHandler(
        ERROR_CODES.DB_QUERY_FAILED,
        `Failed to delete message: ${error.message}`,
        { filter }
      );
    }
  }

  async countDocuments() {
    try {
      const collection = await this.getCollection();
      return await collection.countDocuments();
    } catch (error) {
      throw new ErrorHandler(
        ERROR_CODES.DB_QUERY_FAILED,
        `Failed to count documents: ${error.message}`
      );
    }
  }
}

// ==================== TEXT FORMATTING ====================
const formatText = (text) => {
  if (typeof text !== 'string') return text;
  
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
  
  let formattedText = '';
  for (const char of text) {
    formattedText += fontMap[char] || char;
  }
  return formattedText;
};

// ==================== DEFAULT RESPONSES ====================
const DEFAULT_RESPONSES = [
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

// ==================== API METADATA ====================
const meta = {
  name: "Baby Bot API",
  version: "10.0.0",
  description: "Professional AI chatbot API with advanced error handling",
  author: "RaiHan",
  path: "/baby?text=",
  method: "get",
  category: "chat"
};

// ==================== MAIN API HANDLER ====================
async function onStart({ req, res }) {
  const startTime = Date.now();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`📥 [${requestId}] Request received:`, req.query);
  
  try {
    const dbService = new DatabaseService();
    
    // ==================== HELP & INFO ====================
    if (req.query.help === 'true' || Object.keys(req.query).length === 0) {
      const response = {
        success: true,
        data: {
          message: "👶 Baby Bot API - Professional Edition",
          version: "10.0.0",
          author: "RaiHan",
          endpoints: {
            "Chat": "/api/baby?text=hello",
            "Teach": "/api/baby?teach=hi&reply=Hello!,Hi!",
            "Teach React": "/api/baby?teach=hi&react=😊,❤️",
            "Remove": "/api/baby?remove=hi",
            "Remove Index": "/api/baby?remove=hi&index=1",
            "List All": "/api/baby?list=all",
            "Search": "/api/baby?search=keyword",
            "Random": "/api/baby?random=true",
            "Stats": "/api/baby?stats=true",
            "Edit": "/api/baby?edit=old&replace=new"
          },
          example: "https://milow-apiserver.onrender.com/api/baby?text=hi"
        },
        operator: "RaiHan",
        requestId,
        responseTime: Date.now() - startTime
      };
      
      console.log(`✅ [${requestId}] Help response sent`);
      return res.json(response);
    }
    
    // ==================== CHAT FUNCTION ====================
    if (req.query.text) {
      const message = Validator.validateMessage(req.query.text);
      
      // Try exact match
      let item = await dbService.findMessage(message);
      
      // Try partial match if no exact match
      if (!item) {
        const allItems = await dbService.findAllMessages();
        item = allItems.find(i => 
          message.includes(i.message) || i.message.includes(message)
        );
      }
      
      if (item && item.reply && item.reply.length > 0) {
        const randomIndex = Math.floor(Math.random() * item.reply.length);
        const replyText = item.reply[randomIndex];
        
        // Update usage count asynchronously (don't wait for it)
        dbService.updateMessage(
          { _id: item._id },
          { $inc: { usageCount: 1 }, $set: { lastUsed: new Date() } }
        ).catch(err => console.error('Failed to update usage:', err.message));
        
        const response = {
          success: true,
          data: {
            reply: formatText(replyText),
            found: true,
            message: item.message,
            reactions: item.react || [],
            usageCount: (item.usageCount || 0) + 1
          },
          operator: "RaiHan",
          requestId,
          responseTime: Date.now() - startTime
        };
        
        console.log(`✅ [${requestId}] Chat response sent for: "${message}"`);
        return res.json(response);
      } else {
        const randomResponse = DEFAULT_RESPONSES[Math.floor(Math.random() * DEFAULT_RESPONSES.length)];
        
        const response = {
          success: false,
          data: {
            reply: formatText(randomResponse),
            found: false,
            suggestion: "Try teaching me using: teach [message] - [reply]"
          },
          operator: "RaiHan",
          requestId,
          responseTime: Date.now() - startTime
        };
        
        console.log(`ℹ️ [${requestId}] No match found for: "${message}"`);
        return res.json(response);
      }
    }
    
    // ==================== TEACH COMMAND ====================
    if (req.query.teach && req.query.reply) {
      const message = Validator.validateMessage(req.query.teach);
      const replies = Validator.validateReplies(req.query.reply.split(','));
      const senderID = req.query.senderID || 'anonymous';
      
      const existing = await dbService.findMessage(message);
      
      if (existing) {
        const updatedReplies = [...new Set([...existing.reply, ...replies])];
        
        await dbService.updateMessage(
          { _id: existing._id },
          { 
            $set: { 
              reply: updatedReplies,
              updatedAt: new Date()
            },
            $addToSet: { teachers: senderID }
          }
        );
        
        const response = {
          success: true,
          data: {
            message: `Updated "${message}" with ${replies.length} new reply(s)`,
            totalReplies: updatedReplies.length,
            teacher: senderID,
            action: "update"
          },
          operator: "RaiHan",
          requestId,
          responseTime: Date.now() - startTime
        };
        
        console.log(`✅ [${requestId}] Updated message: "${message}"`);
        return res.json(response);
      } else {
        const messageData = {
          message,
          reply: replies,
          createdBy: senderID,
          teachers: [senderID],
          createdAt: new Date(),
          updatedAt: new Date(),
          usageCount: 0,
          lastUsed: null,
          key: req.query.key || null
        };
        
        await dbService.insertMessage(messageData);
        
        const response = {
          success: true,
          data: {
            message: `Added new message "${message}" with ${replies.length} reply(s)`,
            totalReplies: replies.length,
            teacher: senderID,
            action: "create"
          },
          operator: "RaiHan",
          requestId,
          responseTime: Date.now() - startTime
        };
        
        console.log(`✅ [${requestId}] Created new message: "${message}"`);
        return res.json(response);
      }
    }
    
    // ==================== REMOVE COMMAND ====================
    if (req.query.remove) {
      const message = Validator.validateMessage(req.query.remove);
      
      if (req.query.index) {
        // Remove specific index
        const index = Validator.validateIndex(req.query.index);
        const existing = await dbService.findMessage(message);
        
        if (!existing) {
          throw new ErrorHandler(
            ERROR_CODES.NOT_FOUND,
            `Message "${message}" not found`
          );
        }
        
        if (!existing.reply || existing.reply.length <= index) {
          throw new ErrorHandler(
            ERROR_CODES.NOT_FOUND,
            `No reply found at index ${index + 1}`,
            { totalReplies: existing.reply ? existing.reply.length : 0 }
          );
        }
        
        existing.reply.splice(index, 1);
        
        if (existing.reply.length === 0) {
          await dbService.deleteMessage({ _id: existing._id });
          
          const response = {
            success: true,
            data: {
              message: `Removed reply ${index + 1} and deleted empty message "${message}"`,
              action: "delete"
            },
            operator: "RaiHan",
            requestId,
            responseTime: Date.now() - startTime
          };
          
          console.log(`✅ [${requestId}] Deleted message: "${message}"`);
          return res.json(response);
        } else {
          await dbService.updateMessage(
            { _id: existing._id },
            { $set: { reply: existing.reply, updatedAt: new Date() } }
          );
          
          const response = {
            success: true,
            data: {
              message: `Removed reply ${index + 1} from "${message}"`,
              remainingReplies: existing.reply.length,
              action: "remove_reply"
            },
            operator: "RaiHan",
            requestId,
            responseTime: Date.now() - startTime
          };
          
          console.log(`✅ [${requestId}] Removed reply ${index + 1} from: "${message}"`);
          return res.json(response);
        }
      } else {
        // Remove entire message
        const result = await dbService.deleteMessage({ message });
        
        if (result.deletedCount === 0) {
          throw new ErrorHandler(
            ERROR_CODES.NOT_FOUND,
            `Message "${message}" not found`
          );
        }
        
        const response = {
          success: true,
          data: {
            message: `Removed "${message}" and all its replies`,
            action: "delete"
          },
          operator: "RaiHan",
          requestId,
          responseTime: Date.now() - startTime
        };
        
        console.log(`✅ [${requestId}] Deleted message: "${message}"`);
        return res.json(response);
      }
    }
    
    // ==================== LIST COMMAND ====================
    if (req.query.list) {
      if (req.query.list === 'all') {
        const allData = await dbService.findAllMessages();
        
        const response = {
          success: true,
          data: {
            messages: allData,
            summary: {
              total: allData.length,
              totalReplies: allData.reduce((sum, item) => sum + (item.reply ? item.reply.length : 0), 0),
              totalReactions: allData.reduce((sum, item) => sum + (item.react ? item.react.length : 0), 0)
            }
          },
          operator: "RaiHan",
          requestId,
          responseTime: Date.now() - startTime
        };
        
        console.log(`✅ [${requestId}] List all sent (${allData.length} messages)`);
        return res.json(response);
      } else {
        const message = Validator.validateMessage(req.query.list);
        const item = await dbService.findMessage(message);
        
        if (!item) {
          throw new ErrorHandler(
            ERROR_CODES.NOT_FOUND,
            `Message "${message}" not found`
          );
        }
        
        const response = {
          success: true,
          data: {
            message: item.message,
            replies: item.reply || [],
            replyCount: item.reply ? item.reply.length : 0,
            reactions: item.react || [],
            createdBy: item.createdBy,
            createdAt: item.createdAt,
            usageCount: item.usageCount || 0
          },
          operator: "RaiHan",
          requestId,
          responseTime: Date.now() - startTime
        };
        
        console.log(`✅ [${requestId}] List single sent for: "${message}"`);
        return res.json(response);
      }
    }
    
    // ==================== OTHER COMMANDS ====================
    // (Search, Stats, Random, Edit, etc. - similar pattern)
    
    // Default response if no command matched
    const totalMessages = await dbService.countDocuments();
    
    const response = {
      success: true,
      data: {
        message: "👶 Baby Bot API is running!",
        version: "10.0.0",
        database: {
          connected: isConnected,
          totalMessages
        }
      },
      operator: "RaiHan",
      requestId,
      responseTime: Date.now() - startTime
    };
    
    console.log(`✅ [${requestId}] Default response sent`);
    return res.json(response);
    
  } catch (error) {
    console.error(`❌ [${requestId}] Error:`, error.message);
    
    // Handle ErrorHandler instances
    if (error instanceof ErrorHandler) {
      res.status(error.statusCode).json({
        ...error.toJSON(),
        requestId,
        responseTime: Date.now() - startTime
      });
    } else {
      // Handle unexpected errors
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
          timestamp: new Date().toISOString()
        },
        operator: "RaiHan",
        requestId,
        responseTime: Date.now() - startTime
      });
    }
  }
}

// ==================== EXPORT ====================
module.exports = { meta, onStart };

// ==================== CLEANUP ON EXIT ====================
process.on('SIGINT', async () => {
  console.log('🔄 Cleaning up before exit...');
  if (dbClient) {
    try {
      await dbClient.close();
      console.log('✅ MongoDB connection closed');
    } catch (error) {
      console.error('❌ Failed to close connection:', error.message);
    }
  }
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('🚨 Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
});
