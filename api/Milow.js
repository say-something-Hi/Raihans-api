const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Baby Bot API in that style
module.exports = {
  meta: {
    name: "Baby Bot API",
    version: "6.9.0",
    description: "AI chatbot API for baby bot",
    author: "RaiHan",
    path: "/baby",
    method: "get",
    category: "chat"
  },
  
  onStart: async function({ req, res }) {
    const { text, senderID, teach, reply, remove, index, list, edit, replace, key, react } = req.query;
    
    // Database file path
    const DATA_FILE = path.join(__dirname, 'babyData.json');
    
    // Initialize data file if it doesn't exist
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify({
        data: [],
        teacher: {
          teacherList: [],
          counts: {}
        }
      }, null, 2));
    }
    
    // Helper functions
    const readData = () => {
      try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(data);
      } catch (error) {
        return { data: [], teacher: { teacherList: [], counts: {} } };
      }
    };
    
    const writeData = (data) => {
      try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
        return true;
      } catch (error) {
        return false;
      }
    };
    
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
    
    try {
      const data = readData();
      
      // 1. TEACH COMMAND
      if (teach && reply) {
        const message = teach.toLowerCase().trim();
        const replies = reply.split(',').map(r => r.trim()).filter(r => r.length > 0);
        
        let existing = data.data.find(item => item.message === message);
        
        if (existing) {
          existing.reply.push(...replies);
        } else {
          data.data.push({
            message,
            reply: replies,
            createdBy: senderID,
            createdAt: new Date().toISOString()
          });
        }
        
        // Update teacher stats
        if (senderID) {
          const teacherIndex = data.teacher.teacherList.findIndex(t => t[senderID]);
          if (teacherIndex !== -1) {
            data.teacher.teacherList[teacherIndex][senderID] += replies.length;
          } else {
            const newTeacher = {};
            newTeacher[senderID] = replies.length;
            data.teacher.teacherList.push(newTeacher);
          }
        }
        
        writeData(data);
        
        const teachCount = existing ? existing.reply.length : replies.length;
        return res.json({
          message: `Successfully taught "${message}" with ${replies.length} reply(s)`,
          teacher: senderID,
          teachs: teachCount
        });
      }
      
      // 2. TEACH WITH KEY (intro)
      if (teach && key === 'intro') {
        const message = teach.toLowerCase().trim();
        const replies = reply.split(',').map(r => r.trim()).filter(r => r.length > 0);
        
        let existing = data.data.find(item => item.message === message);
        
        if (existing) {
          existing.reply.push(...replies);
        } else {
          data.data.push({
            message,
            reply: replies,
            createdBy: senderID,
            createdAt: new Date().toISOString(),
            key: 'intro'
          });
        }
        
        writeData(data);
        return res.json({
          message: `Successfully added intro reply for "${message}"`
        });
      }
      
      // 3. TEACH REACT
      if (teach && react) {
        const message = teach.toLowerCase().trim();
        const reactions = react.split(',').map(r => r.trim()).filter(r => r.length > 0);
        
        let existing = data.data.find(item => item.message === message);
        
        if (existing) {
          if (!existing.react) existing.react = [];
          existing.react.push(...reactions);
        } else {
          data.data.push({
            message,
            react: reactions,
            createdBy: senderID,
            createdAt: new Date().toISOString()
          });
        }
        
        writeData(data);
        return res.json({
          message: `Successfully added ${reactions.length} reaction(s) for "${message}"`
        });
      }
      
      // 4. REMOVE COMMAND
      if (remove && !index) {
        const message = remove.toLowerCase().trim();
        const initialLength = data.data.length;
        
        data.data = data.data.filter(item => item.message !== message);
        
        if (data.data.length < initialLength) {
          writeData(data);
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
        
        const itemIndex = data.data.findIndex(item => item.message === message);
        
        if (itemIndex !== -1) {
          const item = data.data[itemIndex];
          if (item.reply && item.reply.length > idx) {
            item.reply.splice(idx, 1);
            
            // If no replies left, remove the entire entry
            if (item.reply.length === 0) {
              data.data.splice(itemIndex, 1);
            }
            
            writeData(data);
            return res.json({
              message: `Successfully removed reply ${parseInt(index)} for "${message}"`
            });
          } else {
            return res.json({
              message: `Invalid index for "${message}"`
            });
          }
        } else {
          return res.json({
            message: `No entries found for "${message}"`
          });
        }
      }
      
      // 6. EDIT COMMAND
      if (edit && replace) {
        const oldMessage = edit.toLowerCase().trim();
        const newMessage = replace.toLowerCase().trim();
        
        const itemIndex = data.data.findIndex(item => item.message === oldMessage);
        
        if (itemIndex !== -1) {
          data.data[itemIndex].message = newMessage;
          writeData(data);
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
          return res.json(data);
        } else {
          const message = list.toLowerCase().trim();
          const item = data.data.find(item => item.message === message);
          
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
        
        // Check for exact match first
        let item = data.data.find(item => item.message === message);
        
        // If no exact match, check for partial match
        if (!item) {
          item = data.data.find(item => message.includes(item.message) || item.message.includes(message));
        }
        
        if (item && item.reply && item.reply.length > 0) {
          const randomIndex = Math.floor(Math.random() * item.reply.length);
          const replyText = item.reply[randomIndex];
          
          return res.json({
            reply: formatText(replyText),
            found: true
          });
        } else {
          // Default responses if no match found
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
      res.json({
        message: "Baby Bot API is running! 🚀",
        version: "6.9.0",
        author: "Raihan",
        endpoints: {
          "GET /baby?text=[message]": "Get a response",
          "GET /baby?teach=[message]&reply=[response]": "Teach a new response",
          "GET /baby?remove=[message]": "Remove all responses for a message",
          "GET /baby?list=all": "Get all data"
        }
      });
      
    } catch (error) {
      console.error('Error in Baby Bot API:', error);
      res.status(500).json({
        error: "Internal server error",
        message: error.message
      });
    }
  }
};

// If this file is run directly, start the server
if (require.main === module) {
  const server = express();
  const babyBot = require('./' + __filename);
  
  server.use(cors());
  server.use(express.json());
  server.use(express.urlencoded({ extended: true }));
  
  server.get(babyBot.meta.path, babyBot.onStart);
  
  // Health check endpoint
  server.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      service: 'Baby Bot API',
      version: babyBot.meta.version,
      timestamp: new Date().toISOString()
    });
  });
  
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`🚀 Baby Bot Server running on port ${PORT}`);
    console.log(`📝 API Endpoint: http://localhost:${PORT}${babyBot.meta.path}`);
  });
}
