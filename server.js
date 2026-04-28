const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const nodemailer = require("nodemailer");
const app = express();

const path = require("path");
const fs = require("fs");


const otpStore = {};
// app.use(cors());
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT"],
  }),
);
app.use(express.json());
const uploadPath = path.join(__dirname, "uploads");


// 📁 Agar folder exist nahi karta to create karo
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath);
}
// 📁 Static serve
app.use("/uploads", express.static(uploadPath));

// 📦 Multer setup
const multer = require("multer");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadPath); // ✅ yaha bhi same path use karo
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

const db = new sqlite3.Database(
  "E:/NextRead Book App/NextRead App Backend/database.db",
  sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
  (err) => {
    if (err) {
      console.log(err.message);
    } else {
      console.log("Database Connected");
    }
  },
);



db.run(`
  CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    message TEXT,
    screenshot TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Database connection ke turant baad ye likhein
db.serialize(() => {
  db.run(
    `
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      book_id INTEGER NOT NULL,
      rating INTEGER NOT NULL,
      comment TEXT NOT NULL,
      user_name TEXT,
      date DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `,
    (err) => {
      if (err) console.error("Error creating table:", err.message);
      else console.log("Reviews table ready!");
    },
  );
});

// ✅ Add this
db.configure("busyTimeout", 5000);

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "nikkusahu61@gmail.com",
    pass: "mexs gyam tkbm ebsa",
  },
});

app.get("/", (req, res) => {
  res.send("Backend Running");
});

// -----test otp

app.get("/test-mail", (req, res) => {
  transporter.sendMail(
    {
      from: "nikkusahu61@gmail.com",
      to: "YOUR_TEST_EMAIL@gmail.com", // apna dusra email likho
      subject: "Test Mail",
      text: "Hello OTP test",
    },
    (err, info) => {
      if (err) {
        console.log("MAIL ERROR:", err);
        return res.send("Error sending mail");
      }

      console.log("MAIL SENT:", info.response);
      res.send("Mail Sent Successfully");
    },
  );
});

app.post("/send-otp", (req, res) => {
  const { name, email, password } = req.body;

  const otp = Math.floor(100000 + Math.random() * 900000);

  // 👉 Store in memory
  otpStore[email] = {
    otp,
    name,
    password,
    time: Date.now(),
  };

  const mailOptions = {
    from: "nikkusahu61@gmail.com",
    to: email,
    subject: "Your OTP Code",
    text: `Your OTP is ${otp}`,
  };

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) {
      console.log(err);
      return res.json("Email send failed");
    }
    res.json("OTP Sent Successfully");
  });
});

app.post("/verify-otp", (req, res) => {
  const { email, otp } = req.body;

  const stored = otpStore[email];

  if (!stored) return res.json("OTP expired");
  if (stored.otp != otp) return res.json("Invalid OTP");

  db.serialize(() => {
    db.run(
      "INSERT INTO users(name,email,password) VALUES(?,?,?)",
      [stored.name, email, stored.password],
      function (err) {
        if (err) {
          console.log(err);
          return res.json("DB Error");
        }

        delete otpStore[email];
        res.json("Verified & Registered Successfully");
      },
    );
  });
});

// Forgot PAssword
app.post("/forgot-password", (req, res) => {
  const { email } = req.body;

  const otp = Math.floor(100000 + Math.random() * 900000);

  db.get("SELECT * FROM users WHERE email=?", [email], (err, user) => {
    if (!user) {
      return res.json("Email not found");
    }

    otpStore[email] = { otp, time: Date.now() };

    const mailOptions = {
      from: "nikkusahu61@gmail.com",
      to: email,
      subject: "Reset Password OTP",
      text: `Your OTP is ${otp}`,
    };

    transporter.sendMail(mailOptions, (err) => {
      if (err) return res.json("Email send failed");
      res.json("OTP Sent");
    });
  });
});

// Verify and Reset Pass
app.post("/reset-password", (req, res) => {
  const { email, otp, newPassword } = req.body;

  const stored = otpStore[email];

  if (!stored) return res.json("OTP expired");

  if (stored.otp != otp) return res.json("Invalid OTP");

  db.run(
    "UPDATE users SET password=? WHERE email=?",
    [newPassword, email],
    function (err) {
      if (err) return res.json("DB Error");

      delete otpStore[email];
      res.json("Password Reset Successfully");
    },
  );
});

// users
// app.get("/user/:email", (req, res) => {
//   const email = req.params.email;

//   db.get(
//     "SELECT id, name, email, mobile, profile_pic FROM users WHERE email=?",
//     [email],
//     (err, row) => {
//       if (err) return res.json(err.message);
//       res.json(row);
//     },
//   );
// });

// Naya - about add karo
app.get("/user/:email", (req, res) => {
  const email = req.params.email;
  db.get(
    "SELECT id, name, email, mobile, profile_pic, about FROM users WHERE email=?",
    [email],
    (err, row) => {
      if (err) return res.json(err.message);
      res.json(row);
    },
  );
});


// app.post("/update-profile", (req, res) => {
//   const { name, mobile, profile_pic, email } = req.body;

//   // Basic Validation
//   if (!email) {
//     return res.status(400).json("Email is required to update profile");
//   }

//   const sql =
//     "UPDATE users SET name = ?, mobile = ?, profile_pic = ? WHERE email = ?";
//   const params = [name, mobile, profile_pic, email];

//   db.run(sql, params, function (err) {
//     if (err) {
//       console.error(err.message);
//       return res.status(500).json("Update Failed");
//     }

//     // Check agar koi row update hui ya nahi (changes property SQLite me hoti hai)
//     if (this.changes === 0) {
//       return res.status(404).json("User not found or no changes made");
//     }

//     res.json("Profile Updated Successfully");
//   });
// });

app.post("/update-profile", (req, res) => {
  const { name, mobile, profile_pic, email, about } = req.body;

  if (!email) {
    return res.status(400).json("Email is required to update profile");
  }

  const sql =
    "UPDATE users SET name = ?, mobile = ?, profile_pic = ?, about = ? WHERE email = ?";

  const params = [name, mobile, profile_pic, about, email];

  db.run(sql, params, function (err) {
    if (err) {
      console.error(err.message);
      return res.status(500).json("Update Failed");
    }

    if (this.changes === 0) {
      return res.status(404).json("User not found or no changes made");
    }

    res.json("Profile Updated Successfully");
  });
});

// Login API update
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  db.get(
    "SELECT * FROM users WHERE email=? AND password=?",
    [email, password],
    (err, row) => {
      if (err) return res.json(err.message);

      if (!row) {
        return res.json("Account not found");
      }

      if (row.is_verified === 0) {
        return res.json("Please verify your email first");
      }

      // ❌ Purana: res.json("Login Success");

      // ✅ Naya: Poora data bhejein taaki Frontend me 'id' mil sake
      res.json({
        message: "Login Success",
        id: row.id,
        email: row.email,
        name: row.name,
      });
    },
  );
});

// Admin Login-----------------
app.post("/admin-login", (req, res) => {
  const { email, password } = req.body;

  // Maan lijiye aapke pas users table mein 'role' column hai
  db.get(
    "SELECT * FROM users WHERE email=? AND password=? AND role='admin'",
    [email, password],
    (err, row) => {
      if (err) return res.status(500).json(err.message);

      if (row) {
        res.json({
          message: "Admin Login Success",
          id: row.id,
          name: row.name,
          role: row.role,
        });
      } else {
        res.status(401).json("Invalid Admin Credentials");
      }
    },
  );
});

// Favourites Book
app.post("/favorite", (req, res) => {
  const { user_id, book_id } = req.body;

  db.run(
    "INSERT INTO favorites(user_id,book_id) VALUES(?,?)",
    [user_id, book_id],
    function (err) {
      res.json("Added to Favorites");
    },
  );
});

// Get user favorite books
app.get("/favorites/:user_id", (req, res) => {
  const user_id = req.params.user_id;

  db.all(
    `SELECT books.* FROM books
     JOIN favorites ON books.id = favorites.book_id
     WHERE favorites.user_id = ?`,
    [user_id],
    (err, rows) => {
      if (err) return res.json(err.message);
      res.json(rows);
    },
  );
});

app.post("/like", (req, res) => {
  const { user_id, book_id } = req.body;

  // Safety Check: Agar book_id ya user_id gayab hai toh error bhej do
  if (!user_id || !book_id) {
    return res.status(400).json("Error: User ID or Book ID is missing");
  }

  db.get(
    "SELECT * FROM favorites WHERE user_id = ? AND book_id = ?",
    [user_id, book_id],
    (err, row) => {
      if (err) return res.json(err.message);

      if (row) {
        db.run(
          "DELETE FROM favorites WHERE user_id = ? AND book_id = ?",
          [user_id, book_id],
          (err) => {
            if (err) return res.json(err.message);
            res.json("Removed from Favorites");
          },
        );
      } else {
        db.run(
          "INSERT INTO favorites(user_id, book_id) VALUES(?,?)",
          [user_id, book_id],
          (err) => {
            if (err) return res.json(err.message);
            res.json("Added to Favorites");
          },
        );
      }
    },
  );
});

app.get("/categories", (req, res) => {
  db.all("SELECT * FROM categories", [], (err, rows) => {
    if (err) {
      return res.json(err.message);
    }
    res.json(rows);
  });
});

app.get("/books", (req, res) => {
  db.all(
    `SELECT books.*, categories.name as category_name
     FROM books
     JOIN categories ON books.category_id = categories.id`,
    [],
    (err, rows) => {
      if (err) return res.json(err.message);
      res.json(rows);
    },
  );
});

app.post("/add-book", (req, res) => {
  const { title, author, category_id, image, content } = req.body;

  db.run(
    "INSERT INTO books (title, author, category_id, image, content) VALUES (?,?,?,?,?)",
    [title, author, category_id, image, content],
  );
});

// Categories Wise Books
app.get("/books/:category_id", (req, res) => {
  db.all(
    "SELECT * FROM books WHERE category_id=?",
    [req.params.category_id],
    (err, rows) => {
      res.json(rows);
    },
  );
});

app.get("/book/:id", (req, res) => {
  db.get("SELECT * FROM books WHERE id=?", [req.params.id], (err, row) => {
    if (err) return res.json(err.message);
    res.json(row);
  });
});

app.post("/add-review", (req, res) => {
  const { user_id, book_id, rating, comment, user_name } = req.body;

  if (!user_id || !book_id || !comment) {
    return res.status(400).json("Error: Missing required fields");
  }

  // Humne 'date' column bhi add kar diya hai query mein
  const query = `INSERT INTO reviews (user_id, book_id, rating, comment, user_name, date) VALUES (?,?,?,?,?,?)`;
  const values = [
    user_id,
    book_id,
    rating,
    comment,
    user_name,
    new Date().toISOString(),
  ];

  db.run(query, values, function (err) {
    if (err) {
      console.error("DB INSERT ERROR:", err.message);
      return res.status(500).json("Database Error: " + err.message);
    }
    res.status(200).json({
      status: "Success",
      message: "Review added!",
      id: this.lastID,
    });
  });
});

// Get Reviews with Likes and Replies count
app.get("/reviews/:book_id", (req, res) => {
  const bookId = req.params.book_id;

  // 1. Pehle saare reviews fetch karein (with profile pic join)
  const reviewQuery = `
    SELECT r.*, 
    (SELECT COUNT(*) FROM review_likes WHERE review_id = r.id) as likesCount,
    u.profile_pic as user_avatar
    FROM reviews r 
    LEFT JOIN users u ON r.user_id = u.id
    WHERE r.book_id = ? 
    ORDER BY r.date DESC`;

  db.all(reviewQuery, [bookId], (err, reviews) => {
    if (err) return res.status(500).json([]);

    if (reviews.length === 0) return res.json([]);

    // 2. Ab saare replies fetch karein jo in reviews se jude hain
    const reviewIds = reviews.map((r) => r.id);
    const placeholders = reviewIds.map(() => "?").join(",");

    const replyQuery = `SELECT * FROM review_replies WHERE review_id IN (${placeholders}) ORDER BY date ASC`;

    db.all(replyQuery, reviewIds, (err, replies) => {
      if (err) return res.json(reviews); // Error ho toh bina replies ke bhej dein

      // 3. Replies ko unke sahi review ke saath attach karein
      const reviewsWithReplies = reviews.map((review) => {
        return {
          ...review,
          replies: replies.filter((reply) => reply.review_id === review.id),
        };
      });

      res.json(reviewsWithReplies);
    });
  });
});

// 1. LIKE REVIEW API
app.post("/like-review", (req, res) => {
  const { review_id, user_id } = req.body; // sender_name ki zaroorat nahi hai yahan

  db.get(
    "SELECT id, user_id FROM reviews WHERE id = ?",
    [review_id],
    (err, review) => {
      if (!review) return res.status(404).json("Review not found");

      db.get(
        "SELECT id FROM review_likes WHERE review_id = ? AND user_id = ?",
        [review_id, user_id],
        (err, row) => {
          if (row) {
            // Unlike Logic
            db.run("DELETE FROM review_likes WHERE id = ?", [row.id], () =>
              res.json({ status: "unliked" }),
            );
          } else {
            // Like Logic
            db.run(
              "INSERT INTO review_likes (review_id, user_id) VALUES (?, ?)",
              [review_id, user_id],
              () => {
                if (review.user_id !== user_id) {
                  // FIX: Yahan 'like' type aur simple message rakhein
                  const msg = `liked your review!`;
                  db.run(
                    "INSERT INTO notifications (user_id, sender_id, type, message, book_id) VALUES (?, ?, 'like', ?, ?)",
                    [review.user_id, user_id, msg, review.book_id], // review.book_id ko select query me add karna padega
                  );
                }
                res.json({ status: "liked" });
              },
            );
          }
        },
      );
    },
  );
});

// 2. ADD REPLY API
app.post("/add-reply", (req, res) => {
  const { review_id, user_id, user_name, reply_text } = req.body;

  db.run(
    "INSERT INTO review_replies (review_id, user_id, user_name, reply_text, date) VALUES (?,?,?,?,?)",
    [review_id, user_id, user_name, reply_text, new Date().toISOString()],
    function (err) {
      if (err) return res.status(500).send(err);

      db.get(
        "SELECT user_id FROM reviews WHERE id = ?",
        [review_id],
        (err, review) => {
          if (review && review.user_id !== user_id) {
            // FIX: Message se user_name hata dein taaki frontend use bold kar sake
            // Saath hi substring check karein taaki text ho toh hi kate
            const previewText = reply_text ? reply_text.substring(0, 15) : "";
            const msg = `replied: "${reply_text.substring(0, 15)}..."`;
            db.run(
              "INSERT INTO notifications (user_id, sender_id, type, message, book_id) VALUES (?, ?, 'reply', ?, ?)",
              [review.user_id, user_id, msg, review_id], // Yahan aap review_id ya book_id bhej sakte hain
            );
          }
        },
      );
      res.status(200).send("Reply added");
    },
  );
});

app.post("/history", (req, res) => {
  const { user_id, book_id } = req.body;
  console.log("Backend Received:", req.body);
  console.log("History hit for User:", user_id, "Book:", book_id); // Ye line add karein
  // ... baaki code

  // Check if already exists
  db.get(
    "SELECT * FROM history WHERE user_id=? AND book_id=?",
    [user_id, book_id],
    (err, row) => {
      if (row) {
        // 👉 Update time
        db.run(
          "UPDATE history SET viewed_at=CURRENT_TIMESTAMP WHERE user_id=? AND book_id=?",
          [user_id, book_id],
          function (err) {
            if (err) return res.json(err.message);
            res.json("History Updated");
          },
        );
      } else {
        // 👉 Insert new
        db.run(
          // "INSERT INTO history(user_id, book_id) VALUES(?,?)",
          "INSERT INTO history(user_id, book_id, viewed_at) VALUES(?,?, CURRENT_TIMESTAMP)",
          [user_id, book_id],
          function (err) {
            if (err) return res.json(err.message);
            res.json("History Saved");
          },
        );
      }
    },
  );
});

app.get("/history/:user_id", (req, res) => {
  const user_id = req.params.user_id;

  const query = `
    SELECT 
        books.id, 
        books.title, 
        books.image, 
        categories.name as category_name
    FROM history 
    INNER JOIN books ON history.book_id = books.id 
    LEFT JOIN categories ON books.category_id = categories.id 
    WHERE history.user_id = ? 
    ORDER BY history.viewed_at DESC 
    LIMIT 10`;

  db.all(query, [user_id], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json([]);
    }
    res.json(rows);
  });
});


// app.post("/history", (req, res) => {
//   const { user_id, book_id } = req.body;

//   if (!user_id || !book_id) {
//     return res.status(400).json("Missing user_id or book_id");
//   }
//   db.run(
//     `INSERT INTO history(user_id, book_id, viewed_at) 
//      VALUES(?, ?, CURRENT_TIMESTAMP)
//      ON CONFLICT(user_id, book_id) 
//      DO UPDATE SET viewed_at = CURRENT_TIMESTAMP`,
//     [user_id, book_id],
//     function (err) {
//       if (err) {
//         console.error("History error:", err.message);
//         return res.status(500).json(err.message);
//       }
//       res.json("History Saved");
//     },
//   );
// });

// app.get("/history/:user_id", (req, res) => {
//   const user_id = req.params.user_id;

//   const query = `
//     SELECT 
//         books.id, 
//         books.title, 
//         books.image, 
//         categories.name as category_name
//     FROM history 
//     INNER JOIN books ON history.book_id = books.id 
//     LEFT JOIN categories ON books.category_id = categories.id 
//     WHERE history.user_id = ? 
//     ORDER BY history.viewed_at DESC 
//     LIMIT 10`;

//   db.all(query, [user_id], (err, rows) => {
//     if (err) {
//       console.error(err);
//       return res.status(500).json([]);
//     }
//     res.json(rows);
//   });
// });

// Nottifications

app.get("/notifications/:user_id", (req, res) => {
  const query = `
    SELECT 
      n.*, 
      u.profile_pic AS sender_avatar, -- Yahan AS lagane se frontend ko sahi naam milega
      u.name AS sender_name 
    FROM notifications n
    LEFT JOIN users u ON n.sender_id = u.id
    WHERE n.user_id = ? 
    ORDER BY n.created_at DESC`;

  db.all(query, [req.params.user_id], (err, rows) => {
    if (err) return res.status(500).json([]);
    res.json(rows);
  });
});

// Mark single notification as read
app.put("/notifications/read/:id", (req, res) => {
  db.run(
    "UPDATE notifications SET is_read = 1 WHERE id = ?",
    [req.params.id],
    (err) => {
      if (err) return res.status(500).json(err.message);
      res.json("Marked as read");
    },
  );
});

// Google Login Function
app.post("/google-login", (req, res) => {
  const { email, name, picture } = req.body;

  db.get("SELECT * FROM users WHERE email=?", [email], (err, user) => {
    if (user) {
      return res.json("Login Success");
    }

    db.run(
      "INSERT INTO users(name,email,profile_pic,is_verified) VALUES(?,?,?,1)",
      [name, email, picture],
      function (err) {
        if (err) return res.json("DB Error");
        res.json("User Created");
      },
    );
  });
});

// Admin Side Control Section ------------------**********************-------------------
app.post("/add-book", (req, res) => {
  const { title, author, category_id, image } = req.body;

  db.run(
    "INSERT INTO books (title, author, category_id, image) VALUES (?,?,?,?)",
    [title, author, category_id, image],
    function (err) {
      if (err) return res.status(500).json(err.message);

      const bookId = this.lastID;
      const msg = `New Book Added: ${title}`;

      // Sabhi users ko notify karein (Warning: Badi apps mein iska tarika alag hota hai,
      // par beginner level par ye thik hai)
      db.all("SELECT id FROM users", (err, users) => {
        if (!err) {
          users.forEach((user) => {
            db.run(
              "INSERT INTO notifications (user_id, type, message) VALUES (?, 'new_book', ?)",
              [user.id, msg],
            );
          });
        }
      });

      res.json({ message: "Book added and users notified!", id: bookId });
    },
  );
});

// Reading Process API
app.post("/reading-progress", (req, res) => {
  const { user_id, book_id, last_page, total_pages } = req.body;

  if (!user_id || !book_id) {
    return res.status(400).json("Missing data");
  }

  const progress = total_pages ? (last_page / total_pages) * 100 : 0;

  const query = `
    INSERT INTO reading_history (user_id, book_id, last_page, total_pages, progress)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id, book_id)
    DO UPDATE SET 
      last_page = excluded.last_page,
      total_pages = excluded.total_pages,
      progress = excluded.progress,
      updated_at = CURRENT_TIMESTAMP
  `;

  db.run(
    query,
    [user_id, book_id, last_page, total_pages, progress],
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).json("DB Error");
      }
      res.json("Progress Saved");
    },
  );
});


app.get("/reading-history/:user_id", (req, res) => {
  const user_id = req.params.user_id;

  const query = `
    SELECT 
      books.*, 
      reading_history.last_page,
      reading_history.progress,
      reading_history.updated_at
    FROM reading_history
    JOIN books ON books.id = reading_history.book_id
    WHERE reading_history.user_id = ?
    ORDER BY reading_history.updated_at DESC
  `;

  db.all(query, [user_id], (err, rows) => {
    if (err) return res.status(500).json([]);
    res.json(rows);
  });
});

// ✅ SEND FEEDBACK API
app.post("/send-feedback", upload.single("screenshot"), (req, res) => {
  console.log("BODY:", req.body);
  console.log("FILE:", req.file);

  const { user_id, message } = req.body;
  const screenshot = req.file ? req.file.filename : null;

  if (!message) {
    return res.status(400).json("Message required");
  }

  db.run(
    "INSERT INTO feedback(user_id, message, screenshot) VALUES(?,?,?)",
    [user_id, message, screenshot],
    function (err) {
      if (err) {
        console.error("Feedback Error:", err.message);
        return res.status(500).json("Database Error");
      }

      res.json("Feedback submitted successfully");
    },
  );
});

app.post("/report", (req, res) => {
  const { user_id, reason, details } = req.body;

  db.run(
    "INSERT INTO reports(user_id, reason, details) VALUES(?,?,?)",
    [user_id, reason, details],
    function (err) {
      if (err) return res.status(500).json(err.message);
      res.json("Report Submitted");
    },
  );
});


app.listen(5000, () => {
  console.log("Server Running on Port 5000");
});
