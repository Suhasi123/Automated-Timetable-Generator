# Automated College Timetable Generator

An intelligent web-based system that automates the creation and management of college timetables, eliminating manual scheduling conflicts and optimizing resource allocation.

## Table of Contents
- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Installation](#installation)
- [Database Setup](#database-setup)
- [Usage](#usage)
- [User Roles](#user-roles)
- [Screenshots](#screenshots)
- [API Routes](#api-routes)
- [Future Enhancements](#future-enhancements)

## Overview

This project addresses the time-consuming and error-prone process of manual timetable creation in educational institutions. The system automatically generates conflict-free timetables while respecting constraints such as:

- Teacher availability and workload
- Room capacity and availability
- Lab sessions requiring consecutive periods
- Break times (short breaks and lunch breaks)
- Subject duration (single or double periods)
- Batch-specific classes for practical sessions

## Features

### Core Functionality
- **Intelligent Timetable Generation**: Automatically creates weekly schedules using constraint-based algorithms
- **Conflict Detection & Prevention**: Ensures no teacher/room double-booking
- **Batch Management**: Supports dividing classes into batches for lab sessions
- **Flexible Scheduling**: Handles both single-period lectures and double-period labs
- **Break Integration**: Automatically schedules short breaks and lunch breaks
- **Real-time Editing**: Modify generated timetables with instant validation
- **PDF Export**: Download timetables in PDF format

### Role-Based Access
- **Admin Dashboard**: Full CRUD operations on classes, subjects, teachers, rooms, and timetables
- **Teacher Portal**: Personalized timetable view with all assigned classes
- **Student Portal**: Class-specific timetable view

### Data Management
- **Persistent Storage**: Save multiple timetable versions with timestamps
- **Historical Records**: View previously generated timetables
- **Bulk Operations**: Manage multiple subjects/batches simultaneously
- **Teacher-Subject Mapping**: Assign multiple subjects to teachers in one go

## Tech Stack

**Frontend:**
- EJS (Embedded JavaScript Templates)
- Bootstrap 5
- Vanilla JavaScript
- Custom CSS

**Backend:**
- Node.js
- Express.js
- MySQL (Database)

**Additional Libraries:**
- jsPDF & jsPDF-AutoTable (PDF generation)
- Method-Override (RESTful routing)
- Express-Session (Authentication)
- Body-Parser (Request parsing)

## Architecture

```
project-root/
├── routes/
│   ├── admin.js          # Admin dashboard routes
│   ├── student.js        # Student portal routes
│   ├── teacher.js        # Teacher portal routes
│   └── user.js           # Authentication routes
├── views/
│   ├── admin/            # Admin EJS templates
│   ├── student/          # Student EJS templates
│   ├── teacher/          # Teacher EJS templates
│   ├── layouts/          # Layout templates
│   └── includes/         # Reusable components (sidebar, navbar)
├── public/
│   ├── css/              # Stylesheets
│   └── js/               # Client-side scripts
├── database/
│   └── schema.sql        # Database structure
├── app.js                # Main application file
└── package.json          # Dependencies
```

## Installation

### Prerequisites
- Node.js (v14 or higher)
- MySQL (v8 or higher)
- npm or yarn

### Steps

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/timetable-generator.git
cd timetable-generator
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure database connection**
Update database credentials in `app.js`:
```javascript
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'your_username',
    password: 'your_password',
    database: 'timetable_db'
});
```

4. **Set up the database**

5. **Start the server**
```bash
node app.js
```

6. **Access the application**
Open your browser and navigate to:
```
http://localhost:5000
```

## Database Setup

### Key Tables

**Users & Authentication:**
- `users` - Stores user credentials and roles
- `roles` - Defines user roles (Admin, Teacher, Student)

**Academic Structure:**
- `classes` - Class information (CS SY-A, CS TY-B, etc.)
- `batches` - Batch divisions within classes
- `subjects` - Subject details with duration and allocations
- `teachers` - Teacher information
- `rooms` - Available rooms/labs

**Scheduling:**
- `period_timings` - Period start/end times and breaks
- `saved_timetables` - Generated timetable storage
- `teacher_timetables` - Teacher-specific schedules
- `teacher_subjects` - Many-to-many relationship between teachers and subjects

### Sample Data Insertion

```sql
-- Create a class
INSERT INTO classes (class_name) VALUES ('CS SY-A');

-- Add batches
INSERT INTO batches (batch_id, class_id, batch_name) 
VALUES ('1_A1', 1, 'Batch A1');

-- Add subject
INSERT INTO subjects (subject_name, max_allocations, class_id, duration, batch_id) 
VALUES ('JAVA LAB', 5, 1, 2, '1_A1');

-- Add teacher
INSERT INTO teachers (teacher_name) VALUES ('Prof. John Doe');
```

## Usage

### For Administrators

1. **Initial Setup**
   - Log in with admin credentials
   - Add classes, subjects, teachers, and rooms
   - Configure period timings and breaks

2. **Generate Timetable**
   - Navigate to "Generate Timetable"
   - System automatically creates conflict-free schedules
   - Review generated timetables

3. **Edit & Save**
   - Click "Edit Timetable" to modify manually
   - Save timetables for future reference
   - Finalize to generate teacher-specific views

4. **Manage Resources**
   - Update teacher assignments
   - Modify room allocations
   - Adjust batch configurations

### For Teachers

1. Log in with provided credentials
2. View personalized timetable with:
   - Assigned classes and batches
   - Room numbers
   - Time slots
3. Download timetable as PDF

### For Students

1. Log in with class credentials
2. View class timetable with:
   - All subjects
   - Teacher names
   - Room locations
   - Time slots
3. Download timetable as PDF

## User Roles

| Role | Permissions |
|------|------------|
| **Admin** | Full access: CRUD operations, timetable generation, system configuration |
| **Teacher** | View personal timetable, download PDF |
| **Student** | View class timetable, download PDF |

## API Routes

### Authentication
- `POST /login` - User login
- `POST /logout` - User logout

### Admin Routes
- `GET /admin/dashboard` - Admin dashboard
- `GET /admin/class` - Manage classes
- `POST /admin/class/new` - Add new class
- `GET /admin/subject` - Manage subjects
- `GET /admin/teacher` - Manage teachers
- `GET /admin/timetable` - Generate timetable
- `POST /admin/timetable/save` - Save generated timetable
- `GET /admin/timetable/saved` - View saved timetables
- `POST /admin/timetable/update` - Edit timetable
- `GET /admin/timetable/final` - Finalize & generate teacher timetables

### Teacher Routes
- `GET /teacher/dashboard` - Teacher dashboard
- `GET /teacher/timetable` - View personal timetable

### Student Routes
- `GET /student/dashboard` - Student dashboard
- `GET /student/timetable` - View class timetable

## Future Enhancements

- [ ] JWT-based authentication for enhanced security
- [ ] Real-time notifications for timetable updates
- [ ] Teacher workload analytics and reports
- [ ] Automated email distribution of timetables
- [ ] Mobile-responsive Progressive Web App (PWA)
- [ ] Export to Excel/Google Sheets
- [ ] Calendar integration (Google Calendar, Outlook)
- [ ] Constraint customization interface
- [ ] Multi-semester support
- [ ] Cloud deployment with backup functionality
- [ ] Modern UI with React/Next.js and Tailwind CSS
- [ ] API endpoints for third-party integrations
