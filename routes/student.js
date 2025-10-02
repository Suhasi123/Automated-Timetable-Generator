const express = require("express");
const router = express.Router();

const mysql = require("mysql2");
const connection = mysql.createConnection({
    host : 'localhost',
    user : 'your_username',
    database : 'CTG_DB',
    password : 'your_password'
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

router.get("/dashboard", authMiddleware("student"), (req, res) => {
    const studentId = req.user.id;
    const studentClassId = req.user.class_id;

    if (!studentClassId) {
        return res.status(403).send("You are not assigned to any class.");
    }

    const q1 = "SELECT username FROM users WHERE id = ?;";
    connection.query(q1, [studentId], (err, result1) => {
        if (err) {
            console.error(err);
            return res.send("Error fetching username");
        }

        const stu_name = result1[0]?.username || "Student";

        const q2 = "SELECT class_name FROM classes WHERE class_id = ?;";
        connection.query(q2, [studentClassId], (err, result2) => {
            if (err) {
                console.error(err);
                return res.send("Error fetching class name");
            }

            const class_name = result2[0]?.class_name || "Unknown Class";

            const q3 = "SELECT * FROM saved_timetables WHERE class_id = ?";
            connection.query(q3, [studentClassId], (err, result3) => {
                if (err) {
                    console.error("Error fetching timetable:", err);
                    return res.status(500).send("Internal Server Error");
                }

                let lectureCount = 0;

                if (result3.length > 0) {
                    let timetableData = result3[0].timetable;

                    if (typeof timetableData === "string") {
                        try {
                            timetableData = JSON.parse(timetableData);
                        } catch (e) {
                            console.error("Error parsing timetable:", e);
                            return res.status(500).send("Invalid timetable format");
                        }
                    }

                    const actualTimetable = timetableData?.timetable;

                    if (actualTimetable && typeof actualTimetable === "object") {
                        for (const period in actualTimetable) {
                            const dailySchedule = actualTimetable[period];
                        
                            for (const day in dailySchedule) {
                                const lecture = dailySchedule[day];
                                if (lecture && typeof lecture === "object") {
                                    lectureCount += 1;
                                }
                            }
                        }
                        
                    }
                }

                res.render("student/student-dashboard.ejs", {
                    stu_name,
                    class_name,
                    lectureCount
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

router.get("/timetable", authMiddleware("student"), (req, res) => {
    const studentClassId = req.user.class_id; // Get logged-in student's class_id

    if (!studentClassId) {
        return res.status(403).send("You are not assigned to any class.");
    }

    const q = "SELECT * FROM saved_timetables WHERE class_id = ?";

    connection.query(q, [studentClassId], (err, results) => {
        if (err) {
            console.error("Error fetching student timetable:", err);
            return res.status(500).send("Internal Server Error");
        }

        if (results.length === 0) {
            return res.render("student/student-timetable.ejs", { classTimetables: [], periodTimings });
        }

        // Process the retrieved timetable
        const classTimetables = results.map(row => {
            try {
                let timetableObject = row.timetable;

                // If timetable is stored as a string, parse it
                if (typeof timetableObject === "string") {
                    timetableObject = JSON.parse(timetableObject);
                }

                return {
                    id: row.id,
                    class_id: row.class_id,
                    class_name: timetableObject.class_name || "Unknown Class",
                    timetable: timetableObject.timetable || {},
                    created_at: row.created_at
                };
            } catch (error) {
                console.error("Error processing row:", row, error);
                return null; // Skip invalid rows
            }
        }).filter(Boolean); // Remove null values from the array
        let sql = "SELECT * FROM period_timings ORDER BY id";
        connection.query(sql, (err, periodTimings)=>{
            if(err) throw(err);
            //console.log(classTimetables);
            res.render("student/student-timetable.ejs", { classTimetables, periodTimings, formatTime});
        });
        // res.render("student/student-timetable.ejs", { classTimetables, periodTimings });
    });
});

module.exports = router;