const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
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

// GET - Display all classes with their batches
router.get("/class", authMiddleware("admin"), (req, res) => {
    let q1 = "SELECT count(*) FROM classes";
    let q2 = `SELECT c.*, b.batch_id, b.batch_name 
              FROM classes c 
              LEFT JOIN batches b ON c.class_id = b.class_id 
              ORDER BY c.class_id ASC, b.batch_id ASC`;

    connection.query(q1, (err, countResult) => {
        if (err) {
            console.log(err);
            return res.send("Some error in database");
        }
        let count = countResult[0]["count(*)"];

        connection.query(q2, (err, results) => {
            if (err) {
                console.log(err);
                return res.send("Some error in database");
            }

            // Group batches by class
            const classesMap = {};
            results.forEach(row => {
                if (!classesMap[row.class_id]) {
                    classesMap[row.class_id] = {
                        class_id: row.class_id,
                        class_name: row.class_name,
                        batches: []
                    };
                }
                
                // Add batch if it exists
                if (row.batch_id) {
                    classesMap[row.class_id].batches.push({
                        batch_id: row.batch_id,
                        batch_name: row.batch_name
                    });
                }
            });

            const classes = Object.values(classesMap);
            res.render("admin/class.ejs", { count, classes });
        });
    });
});

// POST - Create new class with optional batches
router.post('/class/new', authMiddleware("admin"), (req, res) => {
    const { class_name, batch_names } = req.body;

    // Insert class first
    const insertClassQuery = "INSERT INTO classes (class_name) VALUES (?)";
    
    connection.query(insertClassQuery, [class_name], (err, result) => {
        if (err) {
            console.log(err);
            return res.send("Error creating class");
        }

        const class_id = result.insertId;

        // If there are batches, insert them
        if (batch_names && Array.isArray(batch_names) && batch_names.length > 0) {
            // Filter out empty batch names
            const validBatches = batch_names.filter(name => name && name.trim() !== '');
            
            if (validBatches.length > 0) {
                const batchValues = validBatches.map(batch_name => {
                    const batch_id = `${class_id}_${batch_name.trim().replace(/\s+/g, '_').toUpperCase()}`;
                    return [batch_id, class_id, batch_name.trim()];
                });

                const insertBatchesQuery = "INSERT INTO batches (batch_id, class_id, batch_name) VALUES ?";
                
                connection.query(insertBatchesQuery, [batchValues], (err) => {
                    if (err) {
                        console.log("Error inserting batches:", err);
                        // Class is created but batches failed - you might want to rollback
                    }
                    res.redirect('/admin/class');
                });
            } else {
                res.redirect('/admin/class');
            }
        } else {
            res.redirect('/admin/class');
        }
    });
});

// PATCH - Update class and its batches
router.patch("/class/:class_id", authMiddleware("admin"), (req, res) => {
    const { class_id } = req.params;
    const { class_name, batch_names, batch_ids } = req.body;

    // Update class name
    const updateClassQuery = "UPDATE classes SET class_name = ? WHERE class_id = ?";
    
    connection.query(updateClassQuery, [class_name, class_id], (err) => {
        if (err) {
            console.log(err);
            return res.send("Error updating class");
        }

        // Handle batches
        if (batch_names && Array.isArray(batch_names) && batch_names.length > 0) {
            // Filter out empty batch names
            const validBatches = batch_names.filter(name => name && name.trim() !== '');
            
            if (validBatches.length > 0) {
                // First, delete all existing batches for this class
                const deleteBatchesQuery = "DELETE FROM batches WHERE class_id = ?";
                
                connection.query(deleteBatchesQuery, [class_id], (err) => {
                    if (err) {
                        console.log("Error deleting old batches:", err);
                        return res.redirect('/admin/class');
                    }

                    // Insert new/updated batches
                    const batchValues = validBatches.map((batch_name, index) => {
                        // Use existing batch_id if available, otherwise create new one
                        let batch_id;
                        if (batch_ids && batch_ids[index]) {
                            batch_id = batch_ids[index];
                        } else {
                            batch_id = `${class_id}_${batch_name.trim().replace(/\s+/g, '_').toUpperCase()}`;
                        }
                        return [batch_id, class_id, batch_name.trim()];
                    });

                    const insertBatchesQuery = "INSERT INTO batches (batch_id, class_id, batch_name) VALUES ?";
                    
                    connection.query(insertBatchesQuery, [batchValues], (err) => {
                        if (err) {
                            console.log("Error inserting batches:", err);
                        }
                        res.redirect('/admin/class');
                    });
                });
            } else {
                // No valid batches - delete all existing batches
                const deleteBatchesQuery = "DELETE FROM batches WHERE class_id = ?";
                connection.query(deleteBatchesQuery, [class_id], () => {
                    res.redirect('/admin/class');
                });
            }
        } else {
            // No batches provided - delete all existing batches
            const deleteBatchesQuery = "DELETE FROM batches WHERE class_id = ?";
            connection.query(deleteBatchesQuery, [class_id], () => {
                res.redirect('/admin/class');
            });
        }
    });
});

// DELETE - Delete class and its batches (CASCADE should handle batches)
router.delete("/class/:class_id/delete", authMiddleware("admin"), (req, res) => {
    const { class_id } = req.params;
    
    // Delete batches first (if CASCADE is not set)
    const deleteBatchesQuery = "DELETE FROM batches WHERE class_id = ?";
    
    connection.query(deleteBatchesQuery, [class_id], (err) => {
        if (err) {
            console.log("Error deleting batches:", err);
            return res.send("Error deleting class batches");
        }

        // Then delete the class
        const deleteClassQuery = "DELETE FROM classes WHERE class_id = ?";
        
        connection.query(deleteClassQuery, [class_id], (err) => {
            if (err) {
                console.log(err);
                return res.send("Error deleting class");
            }
            res.redirect("/admin/class");
        });
    });
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
// GET - Display all subjects with batch information
router.get("/subject", authMiddleware("admin"), (req, res) => {
    let q1 = "SELECT count(DISTINCT subject_name, class_id) as count FROM subjects";
    let q2 = `
        SELECT s.*, c.class_name, b.batch_name
        FROM subjects s
        LEFT JOIN classes c ON s.class_id = c.class_id
        LEFT JOIN batches b ON s.batch_id = b.batch_id
        ORDER BY s.class_id, s.subject_name, s.batch_id
    `;
    let q3 = `
        SELECT c.class_id, c.class_name, b.batch_id, b.batch_name
        FROM classes c
        LEFT JOIN batches b ON c.class_id = b.class_id
        ORDER BY c.class_id, b.batch_name
    `;

    connection.query(q1, (err, countResult) => {
        if (err) {
            console.log(err);
            return res.send("Some error in database");
        }
        let count = countResult[0].count;

        connection.query(q2, (err, subjectsResult) => {
            if (err) {
                console.log(err);
                return res.send("Some error in database");
            }

            connection.query(q3, (err, classResults) => {
                if (err) {
                    console.error(err);
                    return res.send("Error fetching classes");
                }

                // Group classes with their batches
                const classesMap = {};
                classResults.forEach(row => {
                    if (!classesMap[row.class_id]) {
                        classesMap[row.class_id] = {
                            class_id: row.class_id,
                            class_name: row.class_name,
                            batches: []
                        };
                    }
                    if (row.batch_id) {
                        classesMap[row.class_id].batches.push({
                            batch_id: row.batch_id,
                            batch_name: row.batch_name
                        });
                    }
                });

                const classes = Object.values(classesMap);
                res.render("admin/subject.ejs", { 
                    count, 
                    subjects: subjectsResult, 
                    classes 
                });
            });
        });
    });
});

// POST - Create new subject (creates for all batches only if user checks the option)
router.post('/subject/new', authMiddleware("admin"), async (req, res) => {
    const { subject_name, max_allocations, class_id, duration, is_batch_specific } = req.body;

    try {
        // Check if user wants batch-specific subject
        if (is_batch_specific === 'on') {
            // Get batches for this class
            const batches = await new Promise((resolve, reject) => {
                connection.query(
                    "SELECT batch_id FROM batches WHERE class_id = ?",
                    [class_id],
                    (err, results) => {
                        if (err) reject(err);
                        else resolve(results);
                    }
                );
            });

            if (batches.length > 0) {
                // Create subject for each batch
                const insertPromises = batches.map(batch => {
                    return new Promise((resolve, reject) => {
                        connection.query(
                            "INSERT INTO subjects (subject_name, max_allocations, class_id, duration, batch_id) VALUES (?, ?, ?, ?, ?)",
                            [subject_name, max_allocations, class_id, duration, batch.batch_id],
                            (err, result) => {
                                if (err) reject(err);
                                else resolve(result);
                            }
                        );
                    });
                });

                await Promise.all(insertPromises);
                console.log(`Created batch-specific subject "${subject_name}" for ${batches.length} batches in class ${class_id}`);
            } else {
                // No batches found, create single subject
                await new Promise((resolve, reject) => {
                    connection.query(
                        "INSERT INTO subjects (subject_name, max_allocations, class_id, duration, batch_id) VALUES (?, ?, ?, ?, NULL)",
                        [subject_name, max_allocations, class_id, duration],
                        (err, result) => {
                            if (err) reject(err);
                            else resolve(result);
                        }
                    );
                });
                console.log(`Created subject "${subject_name}" for class ${class_id} (no batches found)`);
            }
        } else {
            // User doesn't want batch-specific - create single subject with batch_id = NULL
            await new Promise((resolve, reject) => {
                connection.query(
                    "INSERT INTO subjects (subject_name, max_allocations, class_id, duration, batch_id) VALUES (?, ?, ?, ?, NULL)",
                    [subject_name, max_allocations, class_id, duration],
                    (err, result) => {
                        if (err) reject(err);
                        else resolve(result);
                    }
                );
            });
            console.log(`Created class-wide subject "${subject_name}" for class ${class_id} (not batch-specific)`);
        }

        res.redirect('/admin/subject');
    } catch (err) {
        console.error("Error creating subject:", err);
        res.send("Error creating subject");
    }
});

// PATCH - Update single subject (for non-batch subjects)
router.patch("/subject/:subject_id", authMiddleware("admin"), (req, res) => {
    const { subject_id } = req.params;
    const { subject_name, max_allocations, class_id, duration } = req.body;

    const query = `
        UPDATE subjects 
        SET subject_name = ?, max_allocations = ?, class_id = ?, duration = ?
        WHERE subject_id = ?
    `;

    connection.query(
        query,
        [subject_name, max_allocations, class_id, duration, subject_id],
        (err, result) => {
            if (err) {
                console.log(err);
                return res.send("Error updating subject");
            }
            res.redirect("/admin/subject");
        }
    );
});

// PATCH - Update subject group (all batches at once)
router.patch("/subject/group/:subject_name/:class_id", authMiddleware("admin"), (req, res) => {
    const { subject_name: old_subject_name, class_id } = req.params;
    const { subject_name: new_subject_name, max_allocations, duration } = req.body;

    const query = `
        UPDATE subjects 
        SET subject_name = ?, max_allocations = ?, duration = ?
        WHERE subject_name = ? AND class_id = ? AND batch_id IS NOT NULL
    `;

    connection.query(
        query,
        [new_subject_name, max_allocations, duration, old_subject_name, class_id],
        (err, result) => {
            if (err) {
                console.log(err);
                return res.send("Error updating subject group");
            }
            console.log(`Updated ${result.affectedRows} subjects in group`);
            res.redirect("/admin/subject");
        }
    );
});

// DELETE - Delete single subject
router.delete("/subject/:subject_id/delete", authMiddleware("admin"), (req, res) => {
    const { subject_id } = req.params;
    
    connection.query(
        "DELETE FROM subjects WHERE subject_id = ?",
        [subject_id],
        (err, result) => {
            if (err) {
                console.log(err);
                return res.send("Error deleting subject");
            }
            res.redirect("/admin/subject");
        }
    );
});

// DELETE - Delete subject group (all batches)
router.delete("/subject/group/:subject_name/:class_id/delete", authMiddleware("admin"), (req, res) => {
    const { subject_name, class_id } = req.params;
    
    connection.query(
        "DELETE FROM subjects WHERE subject_name = ? AND class_id = ? AND batch_id IS NOT NULL",
        [subject_name, class_id],
        (err, result) => {
            if (err) {
                console.log(err);
                return res.send("Error deleting subject group");
            }
            console.log(`Deleted ${result.affectedRows} subjects from group`);
            res.redirect("/admin/subject");
        }
    );
});

router.get("/teacher", authMiddleware("admin"), (req, res) => {
    let q1 = "SELECT count(*) AS count FROM teachers";
    
    // Get all teachers with their subject details including batch info
    let q2 = `
        SELECT t.teacher_id, t.teacher_name, 
               ts.subject_id,
               s.subject_name, s.duration,
               c.class_name,
               b.batch_name
        FROM teachers t
        LEFT JOIN teacher_subjects ts ON t.teacher_id = ts.teacher_id
        LEFT JOIN subjects s ON ts.subject_id = s.subject_id
        LEFT JOIN classes c ON s.class_id = c.class_id
        LEFT JOIN batches b ON s.batch_id = b.batch_id
        ORDER BY t.teacher_id, c.class_name, s.subject_name
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

            // Group subjects by teacher
            const teachersMap = {};
            teachersResult.forEach(row => {
                if (!teachersMap[row.teacher_id]) {
                    teachersMap[row.teacher_id] = {
                        teacher_id: row.teacher_id,
                        teacher_name: row.teacher_name,
                        subject_details: []
                    };
                }
                
                // Add subject details if they exist
                if (row.subject_id) {
                    teachersMap[row.teacher_id].subject_details.push({
                        subject_id: row.subject_id,
                        subject_name: row.subject_name,
                        class_name: row.class_name,
                        batch_name: row.batch_name,
                        duration: row.duration
                    });
                }
            });

            const teachers = Object.values(teachersMap);

            // Get all subjects with class and batch info for dropdown
            let q3 = `
                SELECT s.subject_id, s.subject_name, s.duration,
                       c.class_name, 
                       b.batch_name
                FROM subjects s
                LEFT JOIN classes c ON s.class_id = c.class_id
                LEFT JOIN batches b ON s.batch_id = b.batch_id
                ORDER BY c.class_name, s.subject_name, b.batch_name
            `;
            
            connection.query(q3, (err, subjectResults) => {
                if (err) {
                    console.error(err);
                    return res.send("Error fetching subjects");
                }

                // Get all teacher names for dropdown
                let q4 = "SELECT DISTINCT teacher_name FROM teachers ORDER BY teacher_name";
                connection.query(q4, (err, teacherRes) => {
                    if (err) {
                        console.error(err);
                        return res.send("Error fetching teachers");
                    }
                    
                    res.render("admin/teacher.ejs", { 
                        count, 
                        teachers, 
                        subjects: subjectResults, 
                        teacherInfo: teacherRes 
                    });
                });
            });
        });
    });
});

// Function to insert into teacher_subjects
function insertTeacherSubject(teacherId, subjectId, res) {
    // Check if mapping already exists
    let checkQuery = "SELECT * FROM teacher_subjects WHERE teacher_id = ? AND subject_id = ?";
    connection.query(checkQuery, [teacherId, subjectId], (err, results) => {
        if (err) {
            console.error(err);
            return res.send("Some error in database");
        }
        
        if (results.length > 0) {
            // Mapping already exists
            return res.redirect('/admin/teacher');
        }
        
        // Insert new mapping
        let insertMappingQuery = "INSERT INTO teacher_subjects (teacher_id, subject_id) VALUES (?, ?)";
        connection.query(insertMappingQuery, [teacherId, subjectId], (err) => {
            if (err) {
                console.error(err);
                return res.send("Some error in database");
            }
            res.redirect('/admin/teacher');
        });
    });
}

router.post('/teacher/new', authMiddleware("admin"), async (req, res) => {
    let { teacher_name, subject_ids } = req.body;

    try {
        // Ensure subject_ids is an array
        if (!Array.isArray(subject_ids)) {
            subject_ids = [subject_ids];
        }

        // Check if the teacher already exists
        const teacherId = await new Promise((resolve, reject) => {
            let checkTeacherQuery = "SELECT teacher_id FROM teachers WHERE teacher_name = ?";
            connection.query(checkTeacherQuery, [teacher_name], (err, result) => {
                if (err) return reject(err);
                
                if (result.length > 0) {
                    // Teacher already exists
                    resolve(result[0].teacher_id);
                } else {
                    // Insert new teacher
                    let insertTeacherQuery = "INSERT INTO teachers (teacher_name) VALUES (?)";
                    connection.query(insertTeacherQuery, [teacher_name], (err, insertResult) => {
                        if (err) return reject(err);
                        resolve(insertResult.insertId);
                    });
                }
            });
        });

        // Insert all subject mappings
        let successCount = 0;
        let skipCount = 0;

        for (const subject_id of subject_ids) {
            // Check if mapping already exists
            const exists = await new Promise((resolve, reject) => {
                connection.query(
                    "SELECT * FROM teacher_subjects WHERE teacher_id = ? AND subject_id = ?",
                    [teacherId, subject_id],
                    (err, results) => {
                        if (err) return reject(err);
                        resolve(results.length > 0);
                    }
                );
            });

            if (exists) {
                skipCount++;
                continue;
            }

            // Insert mapping
            await new Promise((resolve, reject) => {
                connection.query(
                    "INSERT INTO teacher_subjects (teacher_id, subject_id) VALUES (?, ?)",
                    [teacherId, subject_id],
                    (err) => {
                        if (err) return reject(err);
                        successCount++;
                        resolve();
                    }
                );
            });
        }

        console.log(`Teacher assignment: ${successCount} subjects added, ${skipCount} already existed`);
        res.redirect('/admin/teacher');

    } catch (err) {
        console.error("Error creating teacher assignments:", err);
        res.send("Error creating teacher assignments");
    }
});

// Add subject to existing teacher
router.post("/teacher/:teacher_id/add-subject", authMiddleware("admin"), (req, res) => {
    const { teacher_id } = req.params;
    const { subject_id } = req.body;
    
    insertTeacherSubject(teacher_id, subject_id, res);
});

// Remove specific subject from teacher
router.delete("/teacher/remove-subject/:teacher_id/:subject_id", authMiddleware("admin"), (req, res) => {
    const { teacher_id, subject_id } = req.params;
    
    let deleteQuery = "DELETE FROM teacher_subjects WHERE teacher_id = ? AND subject_id = ?";
    connection.query(deleteQuery, [teacher_id, subject_id], (err) => {
        if (err) {
            console.error(err);
            return res.send("Some error in database");
        }
        res.redirect("/admin/teacher");
    });
});

router.patch("/teacher/:teacher_id", authMiddleware("admin"), (req, res) => {
    let { teacher_id } = req.params;
    let { teacher_name } = req.body;
    
    let query = "UPDATE teachers SET teacher_name = ? WHERE teacher_id = ?";
    connection.query(query, [teacher_name, teacher_id], (err, result) => {
        if (err) {
            console.log(err);
            return res.send("some error in database");
        }
        res.redirect("/admin/teacher");
    });
});

router.delete("/teacher/:teacher_id/delete", authMiddleware("admin"), (req, res) => {
    let { teacher_id } = req.params;

    // Delete all subject mappings for this teacher
    let deleteMappingQuery = "DELETE FROM teacher_subjects WHERE teacher_id = ?";
    
    connection.query(deleteMappingQuery, [teacher_id], (err) => {
        if (err) {
            console.error(err);
            return res.send("Some error in database");
        }
        
        // Optionally, also delete the teacher record
        let deleteTeacherQuery = "DELETE FROM teachers WHERE teacher_id = ?";
        connection.query(deleteTeacherQuery, [teacher_id], (err) => {
            if (err) {
                console.error(err);
                return res.send("Some error in database");
            }
            res.redirect("/admin/teacher");
        });
    });
});

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
    const getTeachers = `
        SELECT ts.subject_id, ts.teacher_id, t.teacher_name, ts.is_allotted
        FROM teacher_subjects ts
        JOIN teachers t ON t.teacher_id = ts.teacher_id
    `;
    const getRooms = 'SELECT * FROM rooms';
    const getBatches = 'SELECT * FROM batches';

    return new Promise((resolve, reject) => {
        connection.query(getSubjects, (err, subjects) => {
            if (err) return reject(err);
            connection.query(getTeachers, (err, teacherRows) => {
                if (err) return reject(err);
                connection.query(getRooms, (err, rooms) => {
                    if (err) return reject(err);
                    connection.query(getBatches, (err, batches) => {
                        if (err) return reject(err);

                        // Restructure teachers into subject->teacher list
                        const teachersForSubject = {};
                        teacherRows.forEach(r => {
                            if (!teachersForSubject[r.subject_id]) {
                                teachersForSubject[r.subject_id] = [];
                            }
                            teachersForSubject[r.subject_id].push({
                                teacher_id: r.teacher_id,
                                teacher_name: r.teacher_name,
                                is_allotted: r.is_allotted === 1
                            });
                        });

                        resolve({ subjects, teachersForSubject, rooms, batches });
                    });
                });
            });
        });
    });
};

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function isSlotAvailable(day, period, class_id, batch_id, teacher_id, room_id, timetable) {
    // 1. Prevent same class/batch from double booking
    if (timetable.some(e =>
        e.day_of_week === day &&
        e.period === period &&
        e.class_id === class_id &&
        (e.batch_id === batch_id || e.batch_id === null)
    )) {
        return false;
    }

    // 2. Prevent teacher conflict across all classes/batches
    if (timetable.some(e =>
        e.day_of_week === day &&
        e.period === period &&
        e.teacher_id === teacher_id
    )) {
        return false;
    }

    // 3. Prevent room conflict across all classes/batches
    if (timetable.some(e =>
        e.day_of_week === day &&
        e.period === period &&
        e.room_id === room_id
    )) {
        return false;
    }

    return true;
}

function generateTimetable({ subjects, teachersForSubject, rooms, batches }) {
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    const periodsPerDay = 6;
    const maxPeriods = 7;
    const timetable = [];
    const teacherAvailability = {};
    const roomAvailability = {};
    const unallocated = [];

    // Init availability
    for (const day of days) {
        teacherAvailability[day] = Array(maxPeriods).fill().map(() => new Set());
        roomAvailability[day] = Array(maxPeriods).fill().map(() => new Set());
    }

    // Separate labs & lectures
    let labs = subjects.filter(s => s.duration === 2);
    let lectures = subjects.filter(s => s.duration === 1);

    labs = shuffleArray(labs);
    lectures = shuffleArray(lectures);

    // Step 1: spread labs across week
    let labDayIndex = 0;
    for (const lab of labs) {
        lab.preferredDay = days[labDayIndex % days.length];
        labDayIndex++;
    }

    // Step 2: merge round robin
    const orderedSubjects = [];
    let dayIndex = 0;
    for (const subj of [...labs, ...lectures]) {
        subj.preferredDay = subj.preferredDay || days[dayIndex % days.length];
        orderedSubjects.push(subj);
        dayIndex++;
    }

    // Step 3: allocation function
    const tryAllocate = (subj, allow7th = false) => {
        let allocationsLeft = subj.remaining || subj.max_allocations;
        const duration = subj.duration;
        const subject_id = subj.subject_id;
        const class_id = subj.class_id;
        const batch_id = subj.batch_id || null;

        const shuffledDays = subj.preferredDay
            ? [subj.preferredDay, ...shuffleArray(days.filter(d => d !== subj.preferredDay))]
            : shuffleArray([...days]);

        for (const day of shuffledDays) {
            for (let p = 0; p < (allow7th ? maxPeriods : periodsPerDay) && allocationsLeft > 0; p++) {
                // labs (duration=2) must start at even slot (0,2,4) and have room for 2
                if (duration === 2 && (! [0, 2, 4].includes(p) || p + 1 >= maxPeriods)) continue;

                // ✅ Check exclusivity
                let canPlace = true;
                for (let i = 0; i < duration; i++) {
                    if (!batch_id) {
                        // Lecture → block whole class (all batches)
                        const conflict = timetable.find(t =>
                            t.class_id === class_id &&
                            t.day_of_week === day &&
                            t.period === p + i
                        );
                        if (conflict) { canPlace = false; break; }
                    } else {
                        // Batch lab → only blocked by class-level lecture
                        const lectureConflict = timetable.find(t =>
                            t.class_id === class_id &&
                            t.day_of_week === day &&
                            t.period === p + i &&
                            t.batch_id === null
                        );
                        if (lectureConflict) { canPlace = false; break; }
                    }
                }
                if (!canPlace) continue;

                // Avoid same subject twice in a day for same batch/class
                const alreadyToday = timetable.find(t =>
                    t.class_id === class_id &&
                    (t.batch_id || null) === batch_id &&
                    t.day_of_week === day &&
                    t.subject_id === subject_id
                );
                if (alreadyToday) continue;

                // Avoid consecutive duplicate lectures
                const prevSlot = timetable.find(t =>
                    t.class_id === class_id &&
                    (t.batch_id || null) === batch_id &&
                    t.day_of_week === day &&
                    t.period === p - 1
                );
                if (prevSlot && prevSlot.subject_id === subject_id && duration === 1) continue;

                // Pick teacher
                const candidates = teachersForSubject[subject_id] || [];
                const allotted = candidates.filter(t => t.is_allotted);
                const alternates = shuffleArray(candidates.filter(t => !t.is_allotted));
                const teacherChosen = allotted[0] || alternates[0];
                if (!teacherChosen) continue;

                // Pick room (labs require different rooms, lectures just one)
                const availableRooms = shuffleArray([...rooms]).filter(r =>
                    !roomAvailability[day][p].has(r.room_id)
                );
                const roomChosen = availableRooms[0];
                if (!roomChosen) continue;

                if(!isSlotAvailable(day, p, class_id, batch_id, teacherChosen.teacher_id, roomChosen.room_id, timetable)){
                    continue;
                }

                // Before allocation, check for existing allocation with same class+batch+day+period
                const duplicate = timetable.find(t =>
                    t.class_id === class_id &&
                    (t.batch_id || null) === (batch_id || null) &&
                    t.day_of_week === day &&
                    (t.period === p || (duration === 2 && [p, p+1].includes(t.period)))
                );
                if (duplicate) continue;

                // ✅ Allocate
                for (let i = 0; i < duration; i++) {
                    timetable.push({
                        class_id,
                        batch_id,
                        day_of_week: day,
                        period: p + i,
                        subject_id,
                        subject_name: subj.subject_name,
                        teacher_id: teacherChosen.teacher_id,
                        teacher_name: teacherChosen.teacher_name,
                        room_id: roomChosen.room_id,
                        room_name: roomChosen.room_name
                    });
                    teacherAvailability[day][p + i].add(teacherChosen.teacher_id);
                    roomAvailability[day][p + i].add(roomChosen.room_id);
                }

                allocationsLeft--;
                subj.remaining = allocationsLeft;
            }
        }
        return allocationsLeft;
    };

    // Step 4: first pass
    for (const subj of orderedSubjects) {
        subj.remaining = subj.max_allocations;
        let remaining = tryAllocate(subj, false);
        if (remaining > 0) {
            subj.remaining = remaining;
            unallocated.push(subj);
        }
    }

    // Step 5: retry unallocated in 7th slot
    const stillUnallocated = [];
    for (const subj of unallocated) {
        let remaining = tryAllocate(subj, true);
        if (remaining > 0) {
            subj.remaining = remaining;
            stillUnallocated.push(subj);
        }
    }

    return { timetable, unallocated: stillUnallocated };
}

const saveTimetableToDB = async (timetable) => {
    if (!timetable || timetable.length === 0) {
        console.log("⚠️ No timetable entries to save.");
        return;
    }

    const values = timetable.map(entry => [
        entry.class_id,
        entry.day_of_week,
        entry.period + 1, // +1 if you want periods 1–6 instead of 0–5
        entry.subject_id,
        entry.teacher_id,
        entry.room_id,
        entry.batch_id
    ]);

    const query = `
        INSERT INTO timetable (class_id, day_of_week, period, subject_id, teacher_id, room_id, batch_id)
        VALUES ?
    `;

    return new Promise((resolve, reject) => {
        connection.query(query, [values], (err, result) => {
            if (err) {
                console.error("❌ Failed to insert timetable:", err);
                reject(err);
            } else {
                console.log(`✅ Timetable inserted successfully! Rows: ${result.affectedRows}`);
                resolve(result);
            }
        });
    });
};

router.get("/timetable", authMiddleware("admin"), async (req, res) => {
    try {
        // clear old timetable
        await new Promise((resolve, reject) => {
            connection.query("TRUNCATE TABLE timetable", (err) => {
                if (err) return reject(err);
                console.log("✅ Old timetable cleared");
                resolve();
            });
        });

        // fetch inputs
        const inputData = await fetchInputData();

        // generate timetable
        const { timetable, unallocated } = generateTimetable(inputData);

        // save to DB
        await saveTimetableToDB(timetable);

        if (unallocated.length > 0) {
            console.warn("⚠️ Some subjects not allocated:", unallocated);
        }

        res.redirect("/admin/timetable/view");
    } catch (err) {
        console.error("❌ Error generating timetable:", err);
        res.status(500).send("Error generating timetable");
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
        SELECT 
            t.class_id, c.class_name, 
            t.day_of_week, t.period, 
            t.subject_id, s.subject_name, 
            t.teacher_id, te.teacher_name, 
            t.room_id, r.room_name,
            t.batch_id, b.batch_name
        FROM timetable t
        JOIN classes c ON t.class_id = c.class_id
        JOIN subjects s ON t.subject_id = s.subject_id
        JOIN teachers te ON t.teacher_id = te.teacher_id
        JOIN rooms r ON t.room_id = r.room_id
        LEFT JOIN batches b ON t.batch_id = b.batch_id
        ORDER BY t.class_id, 
                FIELD(t.day_of_week, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'), 
                t.period, t.batch_id;
    `;

    connection.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching timetable:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        //console.log("Fetched timetable entries:", results);

        const timetableByClass = {};
        results.forEach(entry => {
            const key = entry.class_id;

            if (!timetableByClass[key]) {
                timetableByClass[key] = {
                    class_name: entry.class_name,
                    timetable: {}
                };
            }

            if (!timetableByClass[key].timetable[entry.period]) {
                timetableByClass[key].timetable[entry.period] = {};
            }

            if (!timetableByClass[key].timetable[entry.period][entry.day_of_week]) {
                timetableByClass[key].timetable[entry.period][entry.day_of_week] = [];
            }

            timetableByClass[key].timetable[entry.period][entry.day_of_week].push({
                batch_name: entry.batch_name,
                subject_name: entry.subject_name,
                teacher_name: entry.teacher_name,
                room_name: entry.room_name
            });
        });

        const sql = "SELECT * FROM period_timings ORDER BY id";
        connection.query(sql, (err, periodTimings) => {
            if (err) throw err;
            res.render("admin/view_timetable.ejs", {
                timetableByClass,
                periodTimings,
                formatTime
            });
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
                timetable: parsedData.timetable ? parsedData.timetable : parsedData,
                class_name: parsedData.class_name || "Unknown Class",
                created_at: row.created_at
            };

        });
        let sql = "SELECT * FROM period_timings ORDER BY id";
        connection.query(sql, (err, periodTimings)=>{
            if(err) throw(err);
            //console.log(periodTimings);
            //console.log(JSON.stringify(savedTimetables, null, 2));
            res.render("admin/saved_timetables.ejs", { savedTimetables, periodTimings, formatTime});
        });
        //console.log("savedTimetables", savedTimetables[0].timetable);
        //res.render("admin/saved_timetables.ejs", { savedTimetables, periodTimings });
    });
});

router.post("/timetable/update", authMiddleware("admin"), (req, res) => {
    const { timetableId, formattedTimetable } = req.body;
    //console.log("formattedTimetable", formattedTimetable);

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
                //console.log(" Parsed Timetable:", timetableData);
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
        //console.log(created_at);
        if (!created_at) {
            return res.status(400).send("Created timestamp is required");
        }
        const formattedDate = formatDateToMySQL(created_at);
        //console.log("Formatted Date for SQL:", formattedDate);

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
        const savedTimetables = await fetchSavedTimetable();
        if (!savedTimetables.length) {
            console.warn("⚠️ No timetables found in the database.");
            return {};
        }

        let teacherTimetable = {}; // { teacher_name: { Monday: [ {period, class, subject, room} ], ... } }
        console.error("❌")

        savedTimetables.forEach(({ class_id, timetable, class_name }) => {
            let parsedTimetable;

            if (typeof timetable === "string") {
                try {
                    parsedTimetable = JSON.parse(timetable);
                } catch (error) {
                    console.error(`❌ Invalid JSON in timetable for class ${class_id}:`, error);
                    return;
                }
            } else {
                parsedTimetable = timetable;
            }

            // FIX: Access the nested `timetable` key
            const ttData = parsedTimetable.timetable || parsedTimetable;
            
            if (!ttData || Object.keys(ttData).length === 0) {
                console.warn(`⚠️ Skipping class ${class_id}: No timetable data found`);
                return;
            }

            // Process each period
            Object.entries(ttData).forEach(([period, days]) => {
                // Process each day
                Object.entries(days).forEach(([day, entries]) => {
                    // FIX: Handle array of entries (for batches or multiple subjects)
                    if (!Array.isArray(entries)) {
                        console.warn(`⚠️ Expected array for period ${period}, day ${day}, got:`, typeof entries);
                        return;
                    }

                    // Process each entry in the array
                    entries.forEach(details => {
                        const { subject_name, teacher_name, room_name, batch_name } = details;
                        
                        if (teacher_name) {
                            const normalizedTeacher = teacher_name.trim();
                            
                            // Initialize teacher's timetable if not exists
                            if (!teacherTimetable[normalizedTeacher]) {
                                teacherTimetable[normalizedTeacher] = {
                                    Monday: [], 
                                    Tuesday: [], 
                                    Wednesday: [],
                                    Thursday: [], 
                                    Friday: []
                                };
                            }

                            // Add entry to teacher's schedule
                            teacherTimetable[normalizedTeacher][day].push({
                                period: period,
                                class: class_name || class_id,
                                subject: subject_name,
                                room: room_name,
                                batch: batch_name || null
                            });
                        }
                    });
                });
            });
        });

        console.log("✅ Generated Teacher Timetable for", Object.keys(teacherTimetable).length, "teachers");
        
        // Store the generated teacher timetable in the database
        await saveTeacherTimetableToDB(teacherTimetable);
        
        return teacherTimetable;
    } catch (error) {
        console.error("❌ Error generating teacher timetable:", error);
        return {};
    }
}

async function saveTeacherTimetableToDB(teacherTimetable) {
    return new Promise((resolve, reject) => {
        connection.beginTransaction(async (err) => {
            if (err) {
                console.error("❌ Error starting transaction:", err);
                return reject(err);
            }

            try {
                // Step 1: Clear previous teacher timetables
                await new Promise((res, rej) => {
                    connection.query("DELETE FROM teacher_timetables", (err, result) => {
                        if (err) return rej(err);
                        console.log("🗑️ Cleared old teacher timetables");
                        res(result);
                    });
                });

                // Step 2: Prepare all inserts
                const insertPromises = [];

                for (const [teacher_name, timetable] of Object.entries(teacherTimetable)) {
                    const promise = new Promise((res, rej) => {
                        // Fetch teacher_id from teachers table
                        connection.query(
                            "SELECT teacher_id FROM teachers WHERE teacher_name = ?",
                            [teacher_name],
                            (err, rows) => {
                                if (err) return rej(err);
                                
                                if (rows.length === 0) {
                                    console.warn(`⚠️ No teacher found for name: ${teacher_name}, skipping entry.`);
                                    return res(null);
                                }

                                const teacher_id = rows[0].teacher_id;
                                const timetableJSON = JSON.stringify(timetable);

                                // Insert new timetable
                                connection.query(
                                    "INSERT INTO teacher_timetables (teacher_id, teacher_name, timetable) VALUES (?, ?, ?)",
                                    [teacher_id, teacher_name, timetableJSON],
                                    (err, result) => {
                                        if (err) return rej(err);
                                        console.log(`✅ Stored timetable for ${teacher_name} (ID: ${teacher_id})`);
                                        res(result);
                                    }
                                );
                            }
                        );
                    });

                    insertPromises.push(promise);
                }

                // Wait for all inserts to complete
                await Promise.all(insertPromises);

                // Step 3: Commit transaction
                connection.commit((err) => {
                    if (err) {
                        console.error("❌ Error committing transaction:", err);
                        return connection.rollback(() => {
                            reject(err);
                        });
                    }
                    console.log("✅ Teacher timetables saved successfully!");
                    resolve();
                });

            } catch (error) {
                console.error("❌ Error during transaction:", error);
                connection.rollback(() => {
                    reject(error);
                });
            }
        });
    });
}

router.get("/timetable/final", authMiddleware("admin"), async (req, res) => {
    await generateTeacherTimetable();
    res.redirect("/admin/timetable/saved");
});

router.get("/teacher-timetables", authMiddleware("admin"), (req, res) => {
    const query = "SELECT * FROM teacher_timetables ORDER BY teacher_id ASC";

    connection.query(query, (err, results) => {
        if (err) {
            console.error("❌ Error fetching teacher timetables:", err);
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
                parsedData = {};

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
                                room_name: entry.room,
                                batch_name: entry.batch || null
                            };
                        });
                    }
                }

            } catch (error) {
                console.error(`❌ Error processing timetable for teacher ID ${row.teacher_id}:`, error);
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
        connection.query(sql, (err, periodTimings) => {
            if (err) throw (err);
            res.render("admin/admin-teacher-timetable.ejs", { 
                teacherTimetables, 
                periodTimings, 
                formatTime 
            });
        });
    });
});

module.exports = router;