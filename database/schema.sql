-- ============================================
-- Automated College Timetable Generator
-- Database Schema
-- ============================================

-- Create database
CREATE DATABASE IF NOT EXISTS CTG_DB;
USE CTG_DB;

-- Disable foreign key checks for clean setup
SET FOREIGN_KEY_CHECKS = 0;

-- Drop existing tables if they exist
DROP TABLE IF EXISTS teacher_timetables;
DROP TABLE IF EXISTS saved_timetables;
DROP TABLE IF EXISTS timetable;
DROP TABLE IF EXISTS teacher_subjects;
DROP TABLE IF EXISTS teachers;
DROP TABLE IF EXISTS subjects;
DROP TABLE IF EXISTS batches;
DROP TABLE IF EXISTS classes;
DROP TABLE IF EXISTS rooms;
DROP TABLE IF EXISTS period_timings;
DROP TABLE IF EXISTS users;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- ============================================
-- Core Tables
-- ============================================

-- Users table (authentication and roles)
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'teacher', 'student') NOT NULL,
    class_id INT NULL
)

-- Classes table
CREATE TABLE classes (
    class_id INT AUTO_INCREMENT PRIMARY KEY,
    class_name VARCHAR(255) UNIQUE NOT NULL
)

-- Batches table (for dividing classes into groups)
CREATE TABLE batches (
    batch_id VARCHAR(10) PRIMARY KEY,
    class_id INT NOT NULL,
    batch_name VARCHAR(50),
    FOREIGN KEY (class_id) REFERENCES classes(class_id) ON DELETE CASCADE
)

-- Subjects table
CREATE TABLE subjects (
    subject_id INT AUTO_INCREMENT PRIMARY KEY,
    subject_name VARCHAR(255) NOT NULL,
    max_allocations INT NOT NULL,
    class_id INT,
    duration INT DEFAULT 1,
    batch_id VARCHAR(10) DEFAULT NULL,
    FOREIGN KEY (class_id) REFERENCES classes(class_id) ON DELETE SET NULL,
    FOREIGN KEY (batch_id) REFERENCES batches(batch_id) ON DELETE CASCADE
) 

-- Teachers table
CREATE TABLE teachers (
    teacher_id INT AUTO_INCREMENT PRIMARY KEY,
    teacher_name VARCHAR(255) NOT NULL,
    UNIQUE KEY idx_teacher_name (teacher_name)
) 

-- Teacher-Subject mapping (many-to-many relationship)
CREATE TABLE teacher_subjects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    teacher_id INT NOT NULL,
    subject_id INT NOT NULL,
    is_allotted BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (teacher_id) REFERENCES teachers(teacher_id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(subject_id) ON DELETE CASCADE,
    UNIQUE KEY idx_teacher_subject (teacher_id, subject_id)
)

-- Rooms table
CREATE TABLE rooms (
    room_id INT AUTO_INCREMENT PRIMARY KEY,
    room_name VARCHAR(255) UNIQUE NOT NULL,
    capacity INT NOT NULL
)

-- Period timings table
CREATE TABLE period_timings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    period_number INT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_break BOOLEAN DEFAULT FALSE
)

-- ============================================
-- Timetable Tables
-- ============================================

-- Main timetable table (currently not in active use - using JSON storage instead)
CREATE TABLE timetable (
    timetable_id INT AUTO_INCREMENT PRIMARY KEY,
    class_id INT NOT NULL,
    day_of_week VARCHAR(20) NOT NULL,
    period INT NOT NULL,
    subject_id INT NOT NULL,
    teacher_id INT NOT NULL,
    room_id INT NOT NULL,
    batch_id VARCHAR(10) DEFAULT NULL,
    FOREIGN KEY (class_id) REFERENCES classes(class_id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(subject_id) ON DELETE CASCADE,
    FOREIGN KEY (teacher_id) REFERENCES teachers(teacher_id) ON DELETE CASCADE,
    FOREIGN KEY (room_id) REFERENCES rooms(room_id) ON DELETE CASCADE,
    FOREIGN KEY (batch_id) REFERENCES batches(batch_id) ON DELETE CASCADE,
    UNIQUE KEY idx_class_day_period_batch (class_id, day_of_week, period, batch_id)
) 

-- Saved timetables (JSON storage for generated timetables)
CREATE TABLE saved_timetables (
    id INT AUTO_INCREMENT PRIMARY KEY,
    class_id VARCHAR(50),
    timetable JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)

-- Teacher timetables (JSON storage for teacher-specific schedules)
CREATE TABLE teacher_timetables (
    id INT AUTO_INCREMENT PRIMARY KEY,
    teacher_id INT NOT NULL,
    teacher_name VARCHAR(255),
    timetable JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES teachers(teacher_id) ON DELETE CASCADE
)

-- ============================================
-- Initial Data Insertion
-- ============================================

-- Insert default admin user (password: admin123)
-- WARNING: Change this password in production!
INSERT INTO users (username, password, role, class_id) 
VALUES ('admin', 'admin123', 'admin', NULL);

-- Insert default period timings
INSERT INTO period_timings (period_number, start_time, end_time, is_break) VALUES
(1, '08:15:00', '09:15:00', FALSE),
(2, '09:15:00', '10:15:00', FALSE),
(3, '10:15:00', '10:30:00', TRUE),  -- Short break
(4, '10:30:00', '11:30:00', FALSE),
(5, '11:30:00', '12:30:00', FALSE),
(6, '12:30:00', '13:15:00', TRUE),  -- Lunch break
(7, '13:15:00', '14:15:00', FALSE),
(8, '14:15:00', '15:15:00', FALSE),
(9, '15:15:00', '16:15:00', FALSE);