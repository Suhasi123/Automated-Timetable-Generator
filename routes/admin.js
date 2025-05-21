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

router.get("/dashboard", authMiddleware("admin"), (req, res) => {
    const q1 = "SELECT count(*) FROM classes";
    connection.query(q1, (err, result1) => {
        if (err) {
            console.error(" Database error:", err);
            return res.status(500).send("Internal Server Error");
        }
        let classCnt = result1[0]["count(*)"];
        let q2 = "SELECT count(*) FROM teachers;";
        connection.query(q2, (err, result2) => {
            if (err) {
                console.error(err);
                return res.send("Error fetching subjects");
            }
            let teacherCnt = result2[0]["count(*)"];
            
            res.render("admin/admin-dashboard.ejs", { classCnt, teacherCnt});
        });
        
    });
});

router.get("/users", authMiddleware("admin"), (req, res) => {
    const sql = `
        SELECT u.id, u.username, u.role, u.class_id, 
               t.teacher_name, c.class_name
        FROM users u
        LEFT JOIN teachers t ON u.id = t.user_id  -- Fetch teacher name for teachers
        LEFT JOIN classes c ON u.class_id = c.class_id  -- Fetch class name for students
    `;

    connection.query(sql, (err, results) => {
        if (err) {
            console.error("Database error:", err);
            return res.status(500).send("Internal Server Error");
        }

        let q = "SELECT class_id, class_name FROM classes ORDER BY class_id";
        connection.query(q, (err, classResults) => {
            if (err) {
                console.error(err);
                return res.send("Error fetching class data");
            }

            res.render("admin/users.ejs", { users: results, classes: classResults });
        });
    });
});

router.post("/add-user", authMiddleware("admin"), async (req, res) => {
    const { username, password, role, class_id, teacher_name } = req.body;

    if (!username || !password || !role) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const sql1 = "INSERT INTO users (username, password, role, class_id) VALUES (?, ?, ?, ?)";

        connection.query(sql1, [username, hashedPassword, role, role === "student" ? class_id : null], (err, result) => {
            if (err) {
                console.error(" Database error:", err);
                return res.status(500).json({ error: "Database error" });
            }

            const userId = result.insertId; // Get the newly inserted user ID

            if (role === "teacher") {
                if (!teacher_name) {
                    return res.status(400).json({ error: "Teacher name is required for teachers" });
                }

                const sql2 = "INSERT INTO teachers (teacher_name, user_id) VALUES (?, ?)";

                connection.query(sql2, [teacher_name, userId], (err) => {
                    if (err) {
                        console.error(" Error inserting into teachers:", err);
                        return res.status(500).json({ error: "Database error" });
                    }

                    res.redirect("/admin/users"); // Redirect after successful insertion
                });
            } else {
                res.redirect("/admin/users"); // Redirect if not a teacher
            }
        });

    } catch (error) {
        console.error(" Error hashing password:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

router.post("/edit-user/:id", authMiddleware("admin"), (req, res) => {
    const userId = req.params.id;
    const { username, class_id, teacher_name } = req.body; // No role field here!

    // Fetch current user role
    const getUserRoleQuery = "SELECT role FROM users WHERE id = ?";
    
    connection.query(getUserRoleQuery, [userId], (err, result) => {
        if (err || result.length === 0) {
            console.error(" Error fetching user role:", err);
            return res.status(500).send("Internal Server Error");
        }

        const role = result[0].role; // Keep the existing role

        const classValue = role === "student" ? class_id : null;

        // Update `users` table (excluding role)
        const updateUserQuery = "UPDATE users SET username = ?, class_id = ? WHERE id = ?";

        connection.query(updateUserQuery, [username, classValue, userId], (err, result) => {
            if (err) {
                console.error(" Error updating user:", err);
                return res.status(500).send("Internal Server Error");
            }

            // If the user is a teacher, update `teachers` table
            if (role === "teacher") {
                const updateTeacherQuery = "UPDATE teachers SET teacher_name = ? WHERE user_id = ?";

                connection.query(updateTeacherQuery, [teacher_name, userId], (err, result) => {
                    if (err) {
                        console.error(" Error updating teacher name:", err);
                        return res.status(500).send("Internal Server Error");
                    }
                    res.redirect("/admin/users"); // Redirect after updating both tables
                });
            } else {
                res.redirect("/admin/users");
            }
        });
    });
});

router.delete("/delete-user/:id", authMiddleware("admin"), (req, res) => {
    const sql = "DELETE FROM users WHERE id = ?";
    
    connection.query(sql, [req.params.id], (err, result) => {
        if (err) {
            console.error(" Database error:", err);
            return res.status(500).json({ error: "Database error" });
        }
        // res.json({ message: " User deleted successfully!" });
        res.redirect("/admin/users");
    });
});

router.get("/class", authMiddleware("admin"), (req, res) => {
    let q1 = "SELECT count(*) FROM classes";
    let q2 = "SELECT * FROM classes ORDER BY class_id ASC";

    connection.query(q1, (err, countResult) => {
        if (err) {
            console.log(err);
            return res.send("Some error in database");
        }
        let count = countResult[0]["count(*)"];

        connection.query(q2, (err, classesResult) => {
            if (err) {
                console.log(err);
                return res.send("Some error in database");
            }
            res.render("admin/class.ejs", { count, classes: classesResult });
        });
    });
});

router.post('/class/new', authMiddleware("admin"), (req,res)=>{
    let {class_name} = req.body; 
    let q=`INSERT INTO classes (class_name) VALUES ('${class_name}')`;
    try{
        connection.query(q, (err, result) => {
            if(err) throw err;
            res.redirect('/admin/class');
        });
    }catch{
        console.log(err);
        res.send("some error in database");
    }
});

router.patch("/class/:class_id", authMiddleware("admin"), (req, res)=>{
    let {class_id} = req.params;
    let {class_name: new_class_name} = req.body;
    let q = `UPDATE classes SET class_name='${new_class_name}' WHERE class_id=${class_id}`;
    try{
        connection.query(q, (err, result)=>{
            if(err) throw(err);
            res.redirect("/admin/class");
        });
    }catch{
        console.log(err);
        res.send("some error in database");
    }
});

router.delete("/class/:class_id/delete", authMiddleware("admin"), (req, res)=>{
    let {class_id} = req.params;
    let q = `DELETE FROM classes WHERE class_id='${class_id}'`;
    try{
        connection.query(q, (err, result) => {
            if(err) throw err;
            res.redirect("/admin/class");
        }); 
    }catch{
        console.log(err);
        res.send("some error in database");
    }
});

router.get("/room", authMiddleware("admin"), (req, res) => {
    let q1 = "SELECT count(*) FROM rooms";
    let q2 = "SELECT * FROM rooms";

    connection.query(q1, (err, countResult) => {
        if (err) {
            console.log(err);
            return res.send("Some error in database");
        }
        let count = countResult[0]["count(*)"];

        connection.query(q2, (err, roomsResult) => {
            if (err) {
                console.log(err);
                return res.send("Some error in database");
            }
            res.render("admin/room.ejs", { count, rooms: roomsResult });
        });
    });
});

router.post('/room/new', authMiddleware("admin"), (req,res)=>{
    let {room_name, capacity} = req.body; 
    let q=`INSERT INTO rooms (room_name, capacity) VALUES ('${room_name}', '${capacity}')`;
    try{
        connection.query(q, (err, result) => {
            if(err) throw err;
            res.redirect('/admin/room');
        });
    }catch{
        console.log(err);
        res.send("some error in database");
    }
});

router.patch("/room/:room_id", authMiddleware("admin"), (req, res)=>{
    let {room_id} = req.params;
    let {room_name: new_room_name, capacity: new_capacity} = req.body;
    let q = `UPDATE rooms SET room_name='${new_room_name}', capacity='${new_capacity}' WHERE room_id=${room_id}`;
    try{
        connection.query(q, (err, result)=>{
            if(err) throw(err);
            res.redirect("/admin/room");
        });
    }catch{
        console.log(err);
        res.send("some error in database");
    }
});

router.delete("/room/:room_id/delete", authMiddleware("admin"), (req, res)=>{
    let {room_id} = req.params;
    let q = `DELETE FROM rooms WHERE room_id='${room_id}'`;
    try{
        connection.query(q, (err, result) => {
            if(err) throw err;
            res.redirect("/admin/room");
        }); 
    }catch{
        console.log(err);
        res.send("some error in database");
    }
});

router.get("/subject", authMiddleware("admin"), (req, res) => {
    let q1 = "SELECT count(*) FROM subjects";
    let q2 = `
        SELECT s.*, c.class_name 
        FROM subjects s
        LEFT JOIN classes c ON s.class_id = c.class_id
        ORDER BY s.subject_id
    `;
    let q3 = "SELECT class_id, class_name FROM classes ORDER BY class_id"

    connection.query(q1, (err, countResult) => {
        if (err) {
            console.log(err);
            return res.send("Some error in database");
        }
        let count = countResult[0]["count(*)"];

        connection.query(q2, (err, subjectsResult) => {
            if (err) {
                console.log(err);
                return res.send("Some error in database");
            }
            connection.query(q3, (err, results) => {
                if (err) {
                    console.error(err);
                    return res.send("Error fetching subjects");
                }
                res.render("admin/subject.ejs", { count, subjects: subjectsResult,classes: results });
            });
        });
    });
});

router.post('/subject/new', authMiddleware("admin"), (req,res)=>{
    let {subject_name, max_allocations, class_id, duration} = req.body; 
    let q=`INSERT INTO subjects (subject_name, max_allocations, class_id, duration) VALUES ('${subject_name}', ${max_allocations}, ${class_id}, ${duration})`;
    try{
        connection.query(q, (err, result) => {
            if(err) throw err;
            res.redirect('/admin/subject');
        });
    }catch{
        console.log(err);
        res.send("some error in database");
    }
});

router.patch("/subject/:subject_id", authMiddleware("admin"), (req, res)=>{
    let {subject_id} = req.params;
    let {subject_name: new_subject_name, max_allocations: new_max_allocations, class_id: new_class_id, duration: new_duration} = req.body;
    let q = `UPDATE subjects SET subject_name='${new_subject_name}', max_allocations='${new_max_allocations}', class_id='${new_class_id}', duration='${new_duration}' WHERE subject_id=${subject_id}`;
    try{
        connection.query(q, (err, result)=>{
            if(err) throw(err);
            res.redirect("/admin/subject");
        });
    }catch{
        console.log(err);
        res.send("some error in database");
    }
});

router.delete("/subject/:subject_id/delete", authMiddleware("admin"), (req, res)=>{
    let {subject_id} = req.params;
    //let q1 = `DELETE FROM teachers WHERE subject_id='${subject_id}'`;
    let q2 = `DELETE FROM subjects WHERE subject_id='${subject_id}'`;
    try{
        connection.query(q2, (err, result) => {
            if(err) throw err;
            res.redirect("/admin/subject");
        }); 
    }catch{
        console.log(err);
        res.send("some error in database");
    }
});

router.get("/teacher", authMiddleware("admin"), (req, res) => {
    let q1 = "SELECT count(*) AS count FROM teachers";
    let q2 = `
        SELECT t.teacher_id, t.teacher_name, 
               GROUP_CONCAT(s.subject_name ORDER BY s.subject_id SEPARATOR ', ') AS subjects
        FROM teachers t
        LEFT JOIN teacher_subjects ts ON t.teacher_id = ts.teacher_id
        LEFT JOIN subjects s ON ts.subject_id = s.subject_id
        GROUP BY t.teacher_id, t.teacher_name
        HAVING subjects IS NOT NULL
    `;

    connection.query(q1, (err, countResult) => {
        if (err) {
            console.log(err);
            return res.send("Some error in database");
        }
        let count = countResult[0].count;

        connection.query(q2, (err, teachersResult) => {
            if (err) {
                console.log(err);
                return res.send("Some error in database");
            }
            let q3 = "SELECT subject_id, subject_name, class_id FROM subjects ORDER BY subject_id";
            connection.query(q3, (err, subjectResults) => {
                if (err) {
                    console.error(err);
                    return res.send("Error fetching subjects");
                }
                let q4 = "SELECT teacher_name FROM teachers";
                connection.query(q4, (err, teacherRes) => {
                    if (err) {
                        console.error(err);
                        return res.send("Error fetching teachers");
                    }
                    res.render("admin/teacher.ejs", { count, teachers: teachersResult, subjects: subjectResults, teacherInfo: teacherRes });
                });
                
            });
        });
    });
});

// Function to insert into teacher_subjects
function insertTeacherSubject(teacherId, subjectId, res) {
    let insertMappingQuery = "INSERT INTO teacher_subjects (teacher_id, subject_id) VALUES (?, ?)";
    connection.query(insertMappingQuery, [teacherId, subjectId], (err) => {
        if (err) {
            console.error(err);
            return res.send("Some error in database");
        }
        res.redirect('/admin/teacher');
    });
}

router.post('/teacher/new', authMiddleware("admin"), (req, res) => {
    let { teacher_name, subject_id } = req.body;

    // Check if the teacher already exists
    let checkTeacherQuery = "SELECT teacher_id FROM teachers WHERE teacher_name = ?";
    connection.query(checkTeacherQuery, [teacher_name], (err, result) => {
        if (err) {
            console.error(err);
            return res.send("Some error in database");
        }

        let teacherId;
        if (result.length > 0) {
            // Teacher already exists, use the existing ID
            teacherId = result[0].teacher_id;
        } else {
            // Insert new teacher
            let insertTeacherQuery = "INSERT INTO teachers (teacher_name) VALUES (?)";
            connection.query(insertTeacherQuery, [teacher_name], (err, insertResult) => {
                if (err) {
                    console.error(err);
                    return res.send("Some error in database");
                }
                teacherId = insertResult.insertId; // Get new teacher ID
                insertTeacherSubject(teacherId, subject_id, res);
            });
            return;
        }
        // If teacher exists, directly insert subject mapping
        insertTeacherSubject(teacherId, subject_id, res);
    });
});

router.patch("/teacher/:teacher_id", authMiddleware("admin"), (req, res)=>{
    let {teacher_id} = req.params;
    let {teacher_name: new_teacher_name} = req.body;
    let q = `UPDATE teachers SET teacher_name='${new_teacher_name}' WHERE teacher_id=${teacher_id}`;
    try{
        connection.query(q, (err, result)=>{
            if(err) throw(err);
            res.redirect("/admin/teacher");
        });
    }catch{
        console.log(err);
        res.send("some error in database");
    }
});

router.delete("/teacher/:teacher_id/delete", authMiddleware("admin"), (req, res) => {
    let { teacher_id } = req.params;

    let deleteMappingQuery = "DELETE FROM teacher_subjects WHERE teacher_id = ?";
    // let deleteTeacherQuery = "DELETE FROM teachers WHERE teacher_id = ?";

    connection.query(deleteMappingQuery, [teacher_id], (err) => {
        if (err) {
            console.error(err);
            return res.send("Some error in database");
        }
        res.redirect("/admin/teacher");
    });
});

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

// router.get("/timing", authMiddleware("admin"), (req, res)=>{
//     let sql = "SELECT * FROM period_timings ORDER BY id";
//     connection.query(sql, (err, periodTimings)=>{
//         if(err) throw(err);
//         res.render("admin/timing.ejs", {periodTimings});
//     });
//     //res.render("admin/timing.ejs", {periodTimings});
// });

// router.post("/timing", authMiddleware("admin"), (req, res)=>{
//     let {period1, period2, break1, period3, period4, break2, period5, period6} = req.body;
//     periodTimings = [
//         period1, period2, break1, period3, period4, break2, period5, period6
//     ];
//     res.redirect("/admin/timing");
// });

// GET route to fetch and render timings
router.get("/timing", authMiddleware("admin"), (req, res) => {
    const sql = "SELECT * FROM period_timings ORDER BY id";
    connection.query(sql, (err, periodTimings) => {
        if (err) throw err;
        //console.log(periodTimings);
        res.render("admin/timing.ejs", { periodTimings });
    });
});


// POST route to update all period timings
router.post("/timing", authMiddleware("admin"), (req, res) => {
    const timings = req.body; // { period_1: '08:15:00 - 09:15:00', break_3: '10:15:00 - 10:30:00', ... }
    //console.log(timings);

    const entries = Object.entries(timings); // [[label, time], ...]

    const updatePromises = entries.map(([label, time]) => {
        return new Promise((resolve, reject) => {
            const [type, number] = label.split("_"); // 'period_1' -> ['period', '1']
            const [start_time, end_time] = time.split(" - ");
            const period_number = parseInt(number);
            const is_break = type === "break" ? 1 : 0;

            const sql = "UPDATE period_timings SET start_time = ?, end_time = ? WHERE period_number = ? AND is_break = ?";
            const values = [start_time.trim(), end_time.trim(), period_number, is_break];

            connection.query(sql, values, (err, result) => {
                if (err) return reject(err);
                resolve(result);
            });
        });
    });

    Promise.all(updatePromises)
        .then(() => res.redirect("/admin/timing?saved=true"))
        .catch((err) => {
            console.error(err);
            res.send("Error updating timings");
        });
});

const fetchInputData = async () => {
    const getSubjects = 'SELECT * FROM subjects';
    const getTeachers = `SELECT t.teacher_id, t.teacher_name, ts.subject_id FROM teachers t 
                         JOIN teacher_subjects ts ON t.teacher_id = ts.teacher_id`;
    const getRooms = 'SELECT * FROM rooms';

    return new Promise((resolve, reject) => {
        connection.query(getSubjects, (err, subjects) => {
            if (err) return reject(err);
            connection.query(getTeachers, (err, teachers) => {
                if (err) return reject(err);
                connection.query(getRooms, (err, rooms) => {
                    if (err) return reject(err);
                    resolve({ subjects, teachers, rooms });
                });
            });
        });
    });
};


const generateTimetable = async () => {
    const { subjects, teachers, rooms } = await fetchInputData();
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    const periodsPerDay = 6;

    if (rooms.length === 0) {
        console.error("No rooms available! Please check your database.");
        return;
    }

    let classSchedules = {};  
    let teacherAvailability = {};  
    let roomAvailability = {};  

    // Initialize tracking for teacher and room availability
    days.forEach(day => {
        teacherAvailability[day] = {};  
        roomAvailability[day] = {};  
        for (let period = 0; period < periodsPerDay; period++) {
            teacherAvailability[day][period] = new Set();  
            roomAvailability[day][period] = new Set();  
        }
    });

    // Initialize schedule structure for each class
    subjects.forEach(subject => {
        if (!classSchedules[subject.class_id]) {
            classSchedules[subject.class_id] = Array.from({ length: 5 }, () => Array(6).fill(null));
        }
    });

    // **Sort Subjects: Prioritize Labs First (duration = 2)**
    subjects.sort((a, b) => b.duration - a.duration || b.max_allocations - a.max_allocations);

    let unallocatedSubjects = [];

    // **Allocate Subjects**
    subjects.forEach(subject => {
        let teacher = teachers.find(t => t.subject_id === subject.subject_id);
        if (!teacher) {
            console.error(`No teacher assigned for subject: ${subject.subject_name}. Skipping...`);
            return;
        }

        let allocations = subject.max_allocations;
        let schedule = classSchedules[subject.class_id];
        let duration = subject.duration;
        let availableSlots = [];

        // **Collect only valid slots**
        for (let dayIndex = 0; dayIndex < 5; dayIndex++) {
            for (let periodIndex = 0; periodIndex < periodsPerDay; periodIndex++) {
                if (duration === 1) {
                    // For normal lectures, collect any free slot
                    if (!schedule[dayIndex][periodIndex]) {
                        availableSlots.push({ dayIndex, periodIndex });
                    }
                } else if (duration === 2 && periodIndex % 2 === 0 && periodIndex < 5) {
                    // For labs (2 periods), collect only (0-1), (2-3), (4-5)
                    if (!schedule[dayIndex][periodIndex] && !schedule[dayIndex][periodIndex + 1]) {
                        availableSlots.push({ dayIndex, periodIndex });
                    }
                }
            }
        }

        // **Shuffle available slots**
        availableSlots.sort(() => Math.random() - 0.5);

        // **Try allocating the subject**
        let failedAttempts = 0;

        while (allocations > 0 && availableSlots.length > 0) {
            let { dayIndex, periodIndex } = availableSlots.pop();
            let day = days[dayIndex];

            // **Check if teacher is available for the entire duration**
            let teacherUnavailable = false;
            for (let i = 0; i < duration; i++) {
                if (teacherAvailability[day][periodIndex + i].has(teacher.teacher_id)) {
                    teacherUnavailable = true;
                    break;
                }
            }
            if (teacherUnavailable) {
                failedAttempts++;
                continue;
            }

            // **Find an available room**
            let availableRooms = rooms.filter(r => {
                for (let i = 0; i < duration; i++) {
                    if (roomAvailability[day][periodIndex + i].has(r.room_id)) {
                        return false;
                    }
                }
                return true;
            });

            if (availableRooms.length === 0) {
                failedAttempts++;
                continue;
            }

            let room = availableRooms[Math.floor(Math.random() * availableRooms.length)];

            // **Ensure no subject is scheduled twice in a day**
            if (schedule[dayIndex].some(slot => slot && slot.subject_id === subject.subject_id)) {
                failedAttempts++;
                continue;
            }

            // **Assign the class schedule**
            for (let i = 0; i < duration; i++) {
                schedule[dayIndex][periodIndex + i] = {
                    subject_id: subject.subject_id,
                    subject_name: subject.subject_name,
                    teacher_id: teacher.teacher_id,
                    teacher_name: teacher.teacher_name,
                    room_id: room.room_id,
                    room_name: room.room_name
                };

                // **Mark teacher and room as occupied**
                teacherAvailability[day][periodIndex + i].add(teacher.teacher_id);
                roomAvailability[day][periodIndex + i].add(room.room_id);
            }

            allocations--;
            failedAttempts = 0;
        }

        // **Retry for Unallocated Subjects**
        if (allocations > 0) {
            unallocatedSubjects.push({ subject, remaining: allocations });
        }
    });

    // **Emergency Filling for Unallocated Subjects**
    unallocatedSubjects.forEach(({ subject, remaining }) => {
        console.warn(`Retrying allocation for ${subject.subject_name} (Missing: ${remaining} slots)`);

        let teacher = teachers.find(t => t.subject_id === subject.subject_id);
        let schedule = classSchedules[subject.class_id];

        for (let dayIndex = 0; dayIndex < 5; dayIndex++) {
            for (let periodIndex = 0; periodIndex < 6; periodIndex++) {
                if (remaining === 0) break;

                let day = days[dayIndex];

                // Skip if already occupied
                if (schedule[dayIndex][periodIndex]) continue;

                // Check teacher availability
                if (teacherAvailability[day][periodIndex].has(teacher.teacher_id)) continue;

                // Find an available room
                let availableRooms = rooms.filter(r => !roomAvailability[day][periodIndex].has(r.room_id));
                if (availableRooms.length === 0) continue;
                let room = availableRooms[Math.floor(Math.random() * availableRooms.length)];

                // **Force Assign the class schedule**
                schedule[dayIndex][periodIndex] = {
                    subject_id: subject.subject_id,
                    subject_name: subject.subject_name,
                    teacher_id: teacher.teacher_id,
                    teacher_name: teacher.teacher_name,
                    room_id: room.room_id,
                    room_name: room.room_name
                };

                // Mark teacher and room as occupied
                teacherAvailability[day][periodIndex].add(teacher.teacher_id);
                roomAvailability[day][periodIndex].add(room.room_id);

                remaining--;
            }
        }

        if (remaining > 0) {
            console.error(`Unable to allocate ${subject.subject_name}: ${remaining} slots missing.`);
        }
    });

    // **Save to Database**
    await saveTimetableToDB(classSchedules);
};

const saveTimetableToDB = async (classSchedules) => {
    const insertTimetable = 'INSERT INTO timetable (class_id, day_of_week, period, subject_id, teacher_id, room_id) VALUES ?';
    let timetableData = [];

    Object.keys(classSchedules).forEach(classId => {
        classSchedules[classId].forEach((day, dayIndex) => {
            day.forEach((period, periodIndex) => {
                if (period) {
                    timetableData.push([
                        classId, ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"][dayIndex],
                        periodIndex + 1, period.subject_id, period.teacher_id, period.room_id
                    ]);
                }
            });
        });
    });

    return new Promise((resolve, reject) => {
        connection.query(insertTimetable, [timetableData], (err, result) => {
            if (err) return reject(err);
            console.log('Timetable generated and saved successfully!');
            resolve(result);
        });
    });
};

router.get("/timetable", authMiddleware("admin"), (req, res)=>{
    let q = `TRUNCATE TABLE timetable`;
    try{
        connection.query(q, (err, result) => {
        if(err) throw err;
            generateTimetable();
            //res.render("generate.ejs");
            res.redirect("/admin/timetable/view");
        }); 
    }catch{
        console.log(err);
        res.send("some error in database");
    }
    
});

function formatTime(time) {
    // Format from "13:00:00" → "1:00 PM"
    const [hour, minute] = time.split(':');
    let h = parseInt(hour), m = minute;
    const suffix = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m} ${suffix}`;
}

router.get("/timetable/view", authMiddleware("admin"), (req, res) => {
    const query = `
        SELECT t.class_id, c.class_name, 
               t.day_of_week, t.period, 
               t.subject_id, s.subject_name, 
               t.teacher_id, te.teacher_name, 
               t.room_id, r.room_name
        FROM timetable t
        JOIN classes c ON t.class_id = c.class_id
        JOIN subjects s ON t.subject_id = s.subject_id
        JOIN teachers te ON t.teacher_id = te.teacher_id
        JOIN rooms r ON t.room_id = r.room_id
        ORDER BY t.class_id, 
                 FIELD(t.day_of_week, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'), 
                 t.period;
    `;

    connection.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching timetable:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        const timetableByClass = {};
        results.forEach(entry => {
            if (!timetableByClass[entry.class_id]) {
                timetableByClass[entry.class_id] = {
                    class_name: entry.class_name,
                    timetable: {}
                };
            }
            if (!timetableByClass[entry.class_id].timetable[entry.period]) {
                timetableByClass[entry.class_id].timetable[entry.period] = {};
            }
            timetableByClass[entry.class_id].timetable[entry.period][entry.day_of_week] = {
                subject_name: entry.subject_name,
                teacher_name: entry.teacher_name,
                room_name: entry.room_name
            };
        });
        let sql = "SELECT * FROM period_timings ORDER BY id";
        connection.query(sql, (err, periodTimings)=>{
            if(err) throw(err);
            res.render("admin/view_timetable.ejs", { timetableByClass, periodTimings, formatTime});
        });
        
    });
});

router.post("/timetable/save", authMiddleware("admin"), (req, res) => {
    const timetableData = req.body;

    if (!timetableData || Object.keys(timetableData).length === 0) {
        return res.json({ success: false, message: "No timetable data received" });
    }

    const query = "INSERT INTO saved_timetables (class_id, timetable) VALUES ?";

    const values = Object.entries(timetableData).map(([classId, data]) => [
        classId,
        JSON.stringify({ 
            class_name: data.class_name || "Unknown Class",
            timetable: cleanTimetable(data.timetable)
        })
    ]);

    connection.query(query, [values], (err, result) => {
        if (err) {
            console.error(" Error saving timetable:", err);
            return res.json({ success: false, message: "Database error" });
        }
        //generateTeacherTimetable();
        console.log("Teacher Timetable generated!");
        res.json({ success: true, message: "Timetable saved successfully!" });
    });
});

router.get("/timetable/final", authMiddleware("admin"), (req, res) => {
    generateTeacherTimetable();
            res.redirect("/admin/timetable/saved");
});

// Fetch saved timetables
router.get("/timetable/saved", authMiddleware("admin"), (req, res) => {
    const query = "SELECT * FROM saved_timetables ORDER BY created_at DESC";

    connection.query(query, (err, results) => {
        if (err) {
            console.error(" Error fetching saved timetables:", err);
            return res.status(500).json({ error: "Database error" });
        }

        const savedTimetables = results.map(row => {
            let parsedData = {};

            try {
                parsedData = typeof row.timetable === "string" ? JSON.parse(row.timetable) : row.timetable;
            } catch (error) {
                console.error(" Error parsing timetable JSON:", error);
                parsedData = {};
            } 

            return {
                id: row.id,
                class_id: row.class_id,
                timetable: parsedData.timetable || {},
                class_name: parsedData.class_name || "Unknown Class",
                created_at: row.created_at
            };
        });
        let sql = "SELECT * FROM period_timings ORDER BY id";
        connection.query(sql, (err, periodTimings)=>{
            if(err) throw(err);
            //console.log(periodTimings);
            res.render("admin/saved_timetables.ejs", { savedTimetables, periodTimings, formatTime});
        });
        //console.log("savedTimetables", savedTimetables[0].timetable);
        //res.render("admin/saved_timetables.ejs", { savedTimetables, periodTimings });
    });
});

router.post("/timetable/update", authMiddleware("admin"), (req, res) => {
    const { timetableId, formattedTimetable } = req.body;
    console.log("formattedTimetable", formattedTimetable);

    if (!timetableId || !formattedTimetable || typeof formattedTimetable !== "object") {
        return res.status(400).json({ success: false, message: "Invalid data format" });
    }

    const querySelect = "SELECT timetable FROM saved_timetables WHERE id = ?";
    connection.query(querySelect, [timetableId], (err, results) => {
        if (err) {
            console.error(" Database Error Fetching Timetable:", err);
            return res.status(500).json({ success: false, message: "Database error" });
        }

        if (results.length === 0) {
            return res.status(404).json({ success: false, message: "Timetable not found" });
        }

        let timetableData = results[0].timetable;

        // Check if timetableData is already an object
        if (typeof timetableData === "object") {
            // If it's already an object, no need to parse
            console.log(" Timetable is already an object:", timetableData);
        } else if (typeof timetableData === "string") {
            // If it's a string, parse it
            try {
                timetableData = JSON.parse(timetableData);
                console.log(" Parsed Timetable:", timetableData);
            } catch (parseError) {
                console.error(" Error Parsing JSON from DB:", parseError);
                return res.status(500).json({ success: false, message: "Error parsing timetable data" });
            }
        } else {
            console.error(" Invalid timetable format in DB:", timetableData);
            return res.status(500).json({ success: false, message: "Invalid timetable format in database" });
        }

        timetableData.timetable = formattedTimetable.timetable;

        //console.log(" Updated Timetable:", timetableData);

        // Save updated timetable back to the database
        const queryUpdate = "UPDATE saved_timetables SET timetable = ? WHERE id = ?";
        connection.query(queryUpdate, [JSON.stringify(timetableData), timetableId], (updateErr, updateResult) => {
            if (updateErr) {
                console.error(" Database Error Updating Timetable:", updateErr);
                return res.status(500).json({ success: false, message: "Database error while updating timetable" });
            }
            generateTeacherTimetable();
            //console.log(" Timetable Successfully Updated in DB:", updateResult);
            res.json({ success: true, message: "Timetable updated successfully" });
        });
    });
});


// Function to clean up undefined values from timetable JSON
function cleanTimetable(timetable) {
    if (!timetable || typeof timetable !== "object") {
        return {};
    }

    const cleaned = {};
    for (const period in timetable) {
        if (timetable[period] && typeof timetable[period] === "object") {
            cleaned[period] = {};
            for (const day in timetable[period]) {
                if (timetable[period][day] && typeof timetable[period][day] === "object") {
                    cleaned[period][day] = timetable[period][day];
                }
            }
        }
    }
    return cleaned;
}

function formatDateToMySQL(dateString) {
    const date = new Date(dateString);
    
    // Adjust for local timezone (IST or whatever the user is in)
    const offset = date.getTimezoneOffset() * 60000; // Convert minutes to milliseconds
    const localDate = new Date(date.getTime() - offset);

    return localDate.toISOString().slice(0, 19).replace("T", " "); 
}

router.delete("/timetable/delete/:created_at", authMiddleware("admin"), async (req, res) => {
    try {
        const { created_at } = req.params;
        console.log(created_at);
        if (!created_at) {
            return res.status(400).send("Created timestamp is required");
        }
        const formattedDate = formatDateToMySQL(created_at);
        console.log("Formatted Date for SQL:", formattedDate);

        let q = `DELETE FROM saved_timetables WHERE created_at = ?`;
        connection.query(q, [formattedDate], (err, results)=>{
            if(err){
                console.error("Delete Timetable Error");
            }
            res.redirect("/admin/timetable/saved");
        });

    } catch (error) {
        console.error("Error deleting timetables:", error);
        res.status(500).send("Internal Server Error");
    }
});

function checkDuplicateTimetables() {
    return new Promise((resolve, reject) => {
        const q = `
            SELECT class_id, COUNT(*) as timetable_count
            FROM saved_timetables
            GROUP BY class_id
            HAVING COUNT(*) > 1;
        `;

        connection.query(q, (err, results) => {
            if (err) {
                console.error("Error checking duplicate timetables:", err);
                return reject(err);
            }

            resolve(results.length > 0); // Returns true if duplicates exist
        });
    });
}

async function fetchSavedTimetable() {
    return new Promise((resolve, reject) => {
        const q = `
            SELECT class_id, timetable 
            FROM saved_timetables 
            ORDER BY created_at DESC;
        `;

        connection.query(q, (err, results) => {
            if (err) {
                console.error(" Error fetching timetable:", err);
                return reject(err);
            }

            resolve(results);
        });
    });
}

async function generateTeacherTimetable() {
    try {
        const hasDuplicates = await checkDuplicateTimetables();
        if (hasDuplicates) {
            console.log(" Cannot generate teacher timetable due to duplicate class timetables.");
            return {};
        }

        const savedTimetables = await fetchSavedTimetable();
        if (!savedTimetables.length) {
            console.warn(" No timetables found in the database.");
            return {};
        }

        //console.log("Raw timetable data:", savedTimetables);
        let teacherTimetable = {}; // { teacher_name: { Monday: [ {class, room} ], ... } }

        savedTimetables.forEach(({ class_id, timetable }) => {
            let parsedTimetable;
            
            if (typeof timetable === "string") {
                try {
                    parsedTimetable = JSON.parse(timetable);
                } catch (error) {
                    console.error(` Invalid JSON in timetable for class ${class_id}:`, error);
                    return;
                }
            } else {
                parsedTimetable = timetable; // If it's already an object
            }

            // FIX: Access the nested `timetable` key
            if (!parsedTimetable.timetable) {
                console.warn(` Skipping class ${class_id}: No timetable data found`);
                return;
            }

            //console.log(` Processing timetable for class ${class_id}:`, parsedTimetable.timetable);

            Object.entries(parsedTimetable.timetable).forEach(([period, days]) => {
                Object.entries(days).forEach(([day, details]) => {
                    const { subject_name, teacher_name, room_name } = details;

                    if (teacher_name) {
                        //const normalizedTeacher = teacher_name.toLowerCase();
                        const normalizedTeacher = teacher_name;

                        if (!teacherTimetable[normalizedTeacher]) {
                            teacherTimetable[normalizedTeacher] = {
                                Monday: [], Tuesday: [], Wednesday: [],
                                Thursday: [], Friday: []
                            };
                        }

                        teacherTimetable[normalizedTeacher][day].push({
                            period, class: class_id, subject: subject_name, room: room_name
                        });
                    }
                });
            });
        });
        //console.log(" Final Generated Teacher Timetable:", teacherTimetable);

        // Store the generated teacher timetable in the database
        await saveTeacherTimetableToDB(teacherTimetable);
        return teacherTimetable;

    } catch (error) {
        console.error(" Error generating teacher timetable:", error);
        return {};
    }
}

async function saveTeacherTimetableToDB(teacherTimetable) {
    try {
        connection.beginTransaction();

        // Clear previous teacher timetables
        connection.query("DELETE FROM teacher_timetables", (err, result) => {
            if (err) {
                console.error(" Error deleting old records:", err);
                connection.rollback();
                return;
            }
        });

        for (const [teacher_name, timetable] of Object.entries(teacherTimetable)) {
            // Fetch teacher_id from teachers table
            connection.query("SELECT teacher_id FROM teachers WHERE teacher_name = ?", [teacher_name], (err, rows) => {
                if (err) {
                    console.error(` Error fetching teacher ID for ${teacher_name}:`, err);
                    connection.rollback();
                    return;
                }

                if (rows.length === 0) {
                    console.warn(` No teacher found for name: ${teacher_name}, skipping entry.`);
                    return;
                }
                const teacher_id = rows[0].teacher_id
                const timetableJSON = JSON.stringify(timetable);

                // Insert new timetable
                connection.query(
                    "INSERT INTO teacher_timetables (teacher_id, teacher_name, timetable) VALUES (?, ?, ?)",
                    [teacher_id, teacher_name, timetableJSON],
                    (err, result) => {
                        if (err) {
                            console.error(` Error inserting timetable for ${teacher_name}:`, err);
                            connection.rollback();
                            return;
                        }
                        // console.log(`Stored timetable for ${teacher_name} (ID: ${teacher_id})`);
                    }
                );
            });
        }

        connection.commit((err) => {
            if (err) {
                console.error(" Error committing transaction:", err);
                connection.rollback();
                return;
            }
            console.log("Teacher timetables saved successfully!");
        });

    } catch (error) {
        console.error(" Error saving teacher timetable to DB:", error);
        connection.rollback();
    }
}

router.get("/teacher-timetables", authMiddleware("admin"), (req, res) => {
    const query = "SELECT * FROM teacher_timetables ORDER BY teacher_id ASC";
    
    connection.query(query, (err, results) => {
        if (err) {
            console.error("Error fetching teacher timetables:", err);
            return res.status(500).json({ error: "Database error" });
        }
        
        const teacherTimetables = {};
        
        results.forEach(row => {
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
        });
        let sql = "SELECT * FROM period_timings ORDER BY id";
        connection.query(sql, (err, periodTimings)=>{
            if(err) throw(err);
            console.log(teacherTimetables);
            res.render("admin/admin-teacher-timetable.ejs", { teacherTimetables, periodTimings, formatTime});
        });
        //res.render("admin/admin-teacher-timetable.ejs", { teacherTimetables, periodTimings });
    });
});

module.exports = router;