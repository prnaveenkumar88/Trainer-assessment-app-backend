# Trainer Assessment App – Backend

This repository contains the backend for the Trainer Assessment App.  
The backend handles authentication, role-based access control, and the complete trainer assessment workflow in a secure and scalable manner.

---

## 1. Project Overview

The Trainer Assessment App backend is responsible for managing users, enforcing role-based permissions, and handling trainer assessments using a structured scorecard system.

It supports multiple user roles and ensures that all sensitive operations are secured at the server level.

---

## 2. Tech Stack

- Node.js
- Express.js
- MySQL
- JSON Web Tokens (JWT)
- bcryptjs
- dotenv
- cors

---

## 3. Features

- Secure user login using JWT authentication
- Role-Based Access Control (RBAC)
  - Admin (view-only access)
  - Assessor (create and update assessments)
  - Trainer (view own assessments)
- Structured assessment workflow with Attempt 1, Attempt 2, and Attempt 3
- Automatic total score calculation
- Assessment status handling (PENDING / COMPLETED)
- Locking of completed assessments
- Secure and validated REST APIs

---

## 4. Roles & Permissions

| Role     | Access Level |
|----------|--------------|
| Admin    | View all assessments (read-only) |
| Assessor | Create and update assessments |
| Trainer  | View only their own assessments |

All permissions are strictly enforced at the backend.

---

## 5. Folder Structure


---

## 6. Environment Configuration

Create a `.env` file inside the backend folder with the following variables:

```env
PORT=5000
JWT_SECRET=your_jwt_secret_here

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=trainer_assessment_db


## 7. How to Run the Backend

Follow these steps to start the backend server:

cd backend
npm install
npm run dev

The server will start on:

http://localhost:5000

##8. API Overview

    Authentication
    POST /api/auth/login
    Assessments
    POST /api/assessments               (Assessor only)
    GET  /api/assessments               (Role-based access)
    PATCH /api/assessments/:id/attempt  (Assessor only)


## 9. Security Notes

Passwords are securely hashed using bcrypt

JWT is used for authentication and authorization

Role checks are implemented using middleware

Backend enforces all access control rules

Sensitive configuration values are stored in environment variables



##10. Current Status & Notes

Backend development is complete

Authentication and role-based access are fully implemented

Assessment workflow is stable and tested

Backend is ready for frontend integration and further enhancements
