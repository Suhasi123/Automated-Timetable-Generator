const express = require("express");
const router = express.Router();

const bcrypt = require("bcryptjs");

const mysql = require("mysql2");
const connection = mysql.createConnection({
    host : 'localhost',
    user : 'root',
    database : 'CTG_DB',
    password : 'Suhasi@11'
});

// connection.connect(err => {
//     if (err) throw err;
//     console.log(" Connected to MySQL database.");
// });


router.get("/ctg", (req, res)=>{
    res.render("home.ejs");
});

// async function insertAdmin() {
//     const username = "admin123";
//     const password = await bcrypt.hash("admin", 10); 
//     const role = "admin";

//     const sql = "INSERT INTO users (username, password, role) VALUES (?, ?, ?)";

//     connection.query(sql, [username, password, role], (err, result) => {
//         if (err) {
//             console.error(" Error inserting admin:", err);
//         } else {
//             console.log(" Admin account created");
//         }
//     });
// }
// insertAdmin();

router.get("/login", (req, res) =>{
    res.render("login.ejs");
});

router.post("/login", (req, res) => {
    const { username, password, role } = req.body;

    const sql = "SELECT * FROM users WHERE username = ?";
    connection.query(sql, [username], async (err, results) => {
        if (err) return res.status(500).send("Database error");

        if (results.length === 0) {
            return res.status(401).send(" Invalid username or password");
        }

        const user = results[0];
        // Check if the role matches
        if (user.role !== role) {
            return res.status(401).send("Invalid username, password, or role");
        }

        // Check password
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(401).send(" Invalid username or password");
        }

        // Store user in session
        req.session.user = { id: user.id, username: user.username, role: user.role, class_id: user.class_id };
        console.log(` ${user.role} logged in:`, user.username);

        if (user.role === "admin") return res.redirect("/admin/dashboard");
        if (user.role === "teacher") return res.redirect("/teacher/dashboard");
        if (user.role === "student") return res.redirect("/student/dashboard");
    });
});

router.get("/logout", (req, res) => {
    req.session.destroy(() => {
        res.redirect("/ctg");
    });
});

router.get("/profile", (req, res)=>{

    if (!req.session.user) {
        return res.redirect('/login');
    }

    if (req.session.user.role === 'student') {
        let q = "SELECT class_name FROM classes WHERE class_id = ?";
        connection.query(q, [req.session.user.class_id], (err, results) => {
            if (err) {
                console.error("Class Name Fetch Error:", err);
                return res.status(500).send("Server Error");
            }

            const className = results[0]?.class_name || "N/A";
            res.render("profile.ejs", { user: req.session.user, className });
        });
    } else {
        res.render("profile.ejs", { user: req.session.user, className: null });
    }
});

// POST Change Password
router.post('/profile/change-password', async (req, res) => {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (newPassword !== confirmPassword) {
        return res.send('New passwords do not match');
    }

    // Get user from DB
    let q = "SELECT * FROM users WHERE username = ?";
    connection.query(q, [req.session.user.username], (err, rows) => {
        if (err) {
            console.error("user Fetch Error:", err);
            return res.status(500).send("Server Error");
        }
            
        const dbUser = rows[0];
        bcrypt.compare(currentPassword, dbUser.password, (err, match) => {
            if (err) {
                console.error("Password compare error:", err);
                return res.status(500).send("Server Error");
            }
    
            if (!match) {
                return res.send('Current password is incorrect');
            }
    
            // Hash new password
            bcrypt.hash(newPassword, 10, (err, hashedPassword) => {
                if (err) {
                    console.error("Password hash error:", err);
                    return res.status(500).send("Server Error");
                }

                let updateQuery = "UPDATE users SET password = ? WHERE username = ?";
                connection.query(updateQuery, [hashedPassword, req.session.user.username], (err, result) => {
                    if (err) {
                        console.error("Password update error:", err);
                        return res.status(500).send("Server Error");
                    }
                    console.log("Password updated successfully!");
                    res.redirect("/login");
                });
            });
        });
    });
});

module.exports = router;