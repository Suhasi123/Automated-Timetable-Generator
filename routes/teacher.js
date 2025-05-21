const express = require("express");
const router = express.Router();

const mysql = require("mysql2");
const connection = mysql.createConnection({
    host : 'localhost',
    user : 'root',
    database : 'CTG_DB',
    password : 'Suhasi@11'
});

function authMiddleware(role) {
    return (req, res, next) => {
        if (!req.session || !req.session.user) {
            return res.status(401).render('error.ejs', {
                message: 'Unauthorized access.'
            });
        }

        // Attach user to request object
        req.user = req.session.user;

        if (role && req.user.role !== role) {
            return res.status(403).render('error.ejs', {
                message: 'You do not have permission to view this page.'
            });
        }
        next();
    };
}

// let periodTimings = [
//     "8:15 AM - 9:15 AM",
//     "9:15 AM - 10:15 AM",
//     "10:15 AM - 10:30 AM (Break)", 
//     "10:30 AM - 11:30 AM",
//     "11:30 AM - 12:30 PM",
//     "12:30 PM - 1:15 PM (Break)",
//     "1:15 PM - 2:15 PM",
//     "2:15 PM - 3:15 PM",
// ];

router.get("/dashboard", authMiddleware("teacher"), (req, res) => {
    if (!req.session.user || req.session.user.role !== "teacher") {
        return res.status(403).json({ error: "Unauthorized access" });
    }

    const userId = req.session.user.id;
    const q = `SELECT teacher_id, teacher_name FROM teachers WHERE user_id = ?`;

    connection.query(q, [userId], (err, result) => {
        if (err) {
            console.error("Error fetching teacher ID:", err);
            return res.status(500).send("Internal Server Error");
        }

        if (result.length === 0) {
            return res.status(404).json({ error: "Teacher not found" });
        }

        const teacherId = result[0].teacher_id;
        const teacherName = result[0].teacher_name;

        const sql = "SELECT timetable FROM teacher_timetables WHERE teacher_id = ?";
        connection.query(sql, [teacherId], (err, results) => {
            if (err) {
                console.error("Error fetching teacher timetable:", err);
                return res.status(500).send("Internal Server Error");
            }

            let count = 0;
            if (results.length > 0) {
                let teacher_Timetable = results[0].timetable;

                if (typeof teacher_Timetable === "string") {
                    try {
                        teacher_Timetable = JSON.parse(teacher_Timetable);
                    } catch (parseError) {
                        console.error("JSON Parsing Error:", parseError);
                        return res.status(500).send("Invalid timetable data");
                    }
                }

                for (const day in teacher_Timetable) {
                    count += teacher_Timetable[day].length;
                }
            }
            let q2 = "SELECT COUNT(*) AS subject_count FROM teacher_subjects WHERE teacher_id = ?;";
            connection.query(q2, [teacherId], (err, cnt) => {
                if (err) {
                    console.error(err);
                    return res.send("Error fetching subjects");
                }
                let subCnt = cnt[0].subject_count;
                res.render("teacher/teacher-dashboard.ejs", {
                    teacherName,
                    lectureCount: count,
                    subCnt
                });
            });
        });
    });
});

function formatTime(time) {
    // Format from "13:00:00" → "1:00 PM"
    const [hour, minute] = time.split(':');
    let h = parseInt(hour), m = minute;
    const suffix = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m} ${suffix}`;
}

// router.get("/timetable", authMiddleware("teacher"), async (req, res) => {
//     try {
//         if (!req.session.user || req.session.user.role !== "teacher") {
//             return res.status(403).json({ error: "Unauthorized access" });
//         }

//         const userId = req.session.user.id;
//         let q = `SELECT teacher_id, teacher_name FROM teachers WHERE user_id = ?`; 
        
//         connection.query(q, [userId], (err, result) => {
//             if (err) {
//                 console.error(" Error fetching teacher ID:", err);
//                 return res.status(500).send("Internal Server Error");
//             }

//             if (result.length === 0) {
//                 return res.status(404).json({ error: "Teacher not found" });
//             }

//             const teacherId = result[0].teacher_id;
//             const teacherName = result[0].teacher_name;

//             const sql = "SELECT timetable FROM teacher_timetables WHERE teacher_id = ?";
//             connection.query(sql, [teacherId], (err, results) => {
//                 if (err) {
//                     console.error(" Error fetching teacher timetable:", err);
//                     return res.status(500).send("Internal Server Error");
//                 }

//                 if (results.length === 0) {
//                     return res.status(404).json({ message: "No timetable found for this teacher" });
//                 }
//                 let teacher_Timetable = results[0].timetable;

//                 // **Check if timetable is already an object**
//                 if (typeof teacher_Timetable === "string") {
//                     try {
//                         teacher_Timetable = JSON.parse(teacher_Timetable);
//                     } catch (parseError) {
//                         console.error(" JSON Parsing Error:", parseError);
//                         console.error(" Invalid JSON Data:", teacherTimetable);
//                         return res.status(500).send("Timetable data is corrupted or not in JSON format.");
//                     }
//                 }
                
//                 const teacherTimetable = {
//                     [teacherName]: teacher_Timetable // Key: teacher name, Value: timetable
//                 };
//                 console.log("Parsed Teacher Timetable:", teacherTimetable);
//                 let sql = "SELECT * FROM period_timings ORDER BY id";
//                 connection.query(sql, (err, periodTimings)=>{
//                     if(err) throw(err);
//                     //console.log(periodTimings);
//                     res.render("teacher/teacher-timetable.ejs", { teacherTimetable, periodTimings, formatTime});
//                 });
//                 //res.render("teacher/teacher-timetable.ejs", { teacherTimetable, periodTimings });
//             });
//         });

//     } catch (error) {
//         console.error(" Error fetching teacher timetable:", error);
//         res.status(500).send("Error fetching timetable");
//     }
// });

router.get("/timetable", authMiddleware("teacher"), async (req, res) => {
    try {
        const userId = req.session.user.id;
        let q = `SELECT teacher_id, teacher_name FROM teachers WHERE user_id = ?`; 
        
        connection.query(q, [userId], (err, result) => {
            if (err) {
                console.error(" Error fetching teacher ID:", err);
                return res.status(500).send("Internal Server Error");
            }

            if (result.length === 0) {
                return res.status(404).json({ error: "Teacher not found" });
            }

            const teacherId = result[0].teacher_id;
            const teacherName = result[0].teacher_name;

        const query = "SELECT * FROM teacher_timetables WHERE teacher_id = ?";
    
    connection.query(query, [teacherId], (err, rows) => {
        if (err) {
            console.error("Error fetching teacher timetables:", err);
            return res.status(500).json({ error: "Database error" });
        }
        
        const teacherTimetables = {};
        
        let row = rows[0];
            let parsedData = {};
            
            try {
                // Ensure we're parsing only if it's a string
                const rawTimetable = typeof row.timetable === "string" 
                    ? JSON.parse(row.timetable) 
                    : row.timetable;
                
                // Transform the data structure to match the template's expectations
                parsedData = {}; // Reset to empty object for transformed data
                
                // Process each day's schedule
                for (const day in rawTimetable) {
                    if (rawTimetable[day] && Array.isArray(rawTimetable[day])) {
                        // Process each period entry for this day
                        rawTimetable[day].forEach(entry => {
                            const periodNum = entry.period;
                            
                            // Initialize period object if it doesn't exist
                            if (!parsedData[periodNum]) {
                                parsedData[periodNum] = {};
                            }
                            
                            // Add this day's entry to the appropriate period
                            parsedData[periodNum][day] = {
                                subject_name: entry.subject,
                                class_name: entry.class,
                                room_name: entry.room
                            };
                        });
                    }
                }
                
            } catch (error) {
                console.error(`Error processing timetable for teacher ID ${row.teacher_id}:`, error);
                parsedData = {};
            }
            
            teacherTimetables[row.teacher_id] = {
                id: row.id,
                teacher_id: row.teacher_id,
                timetable: parsedData,
                teacher_name: row.teacher_name,
            };
        
        let sql = "SELECT * FROM period_timings ORDER BY id";
        connection.query(sql, (err, periodTimings)=>{
            if(err) throw(err);
            //console.log(teacherTimetables);
            res.render("teacher/teacher-timetable.ejs", { teacherTimetables, periodTimings, formatTime});
        });
        
    });
});
    } catch (error) {
        console.error(" Error fetching teacher timetable:", error);
        res.status(500).send("Error fetching timetable");
    }
});


module.exports = router;