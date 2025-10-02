const mysql = require("mysql2");
const express = require("express")
const app = express();
const path = require("path");
const methodOverride = require("method-override");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const ejsMate = require("ejs-mate");

const user = require("./routes/user.js");
const admin = require("./routes/admin.js");
const teacher = require("./routes/teacher.js");
const student = require("./routes/student.js");

app.use(express.urlencoded({extended: true}));
app.use(methodOverride('_method'));
app.use(express.json());

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "/views"));
app.use(express.static(path.join(__dirname, "/public")));
app.engine("ejs", ejsMate);

app.use(express.json());
app.use(session({
    secret: "timetable",
    resave: false,
    saveUninitialized: true
}));

app.use((req, res, next) => {
    res.locals.user = req.session.user || null; 
    next();
});

app.use("/", user);
app.use("/admin", admin);
app.use("/teacher", teacher);
app.use("/student", student);

app.listen("5000", ()=> {
    console.log("app is listening on port 5000");
});

