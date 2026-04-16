/**
 * seed-production-import.js — Production seed data (exported from existing database)
 * 
 * This file was auto-generated from your existing database.
 * It contains all your current collections, ready for production deployment.
 * 
 * Usage:  npm run seed:prod:import
 * 
 * WARNING: This file contains your actual data. Handle with care!
 *          - Do not commit sensitive information to version control
 *          - Use environment variables for MongoDB credentials
 *          - Change passwords after first login
 */

'use strict';

const path = require('path');
const dotenvPath = path.join(__dirname, '..', '.env');
require('dotenv').config({ path: dotenvPath });

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Models
const srcPath = path.join(__dirname, '..', 'src');
const User = require(path.join(srcPath, 'models', 'User'));
const Faculty = require(path.join(srcPath, 'models', 'Faculty'));
const Course = require(path.join(srcPath, 'models', 'Course'));
const Workload = require(path.join(srcPath, 'models', 'Workload'));
const Submission = require(path.join(srcPath, 'models', 'Submission'));
const CourseAllocation = require(path.join(srcPath, 'models', 'CourseAllocation'));
const Setting = require(path.join(srcPath, 'models', 'Setting'));
const AuditLog = require(path.join(srcPath, 'models', 'AuditLog'));
const { connect } = require(path.join(srcPath, 'db'));

// ────────────────────────────────────────────────────────────
// Exported Data from Existing Database (Exported: 2026-04-10T06:11:09.856Z)
// ────────────────────────────────────────────────────────────

const EXPORTED_USERS = [
  {
    "_id": "69d7828457495b0bcd5ec50a",
    "empId": "163",
    "name": "Prof. K.V.Krishna Kishore",
    "designation": "Professor & Dean, SOCI",
    "mobile": "9490647678",
    "email": "163@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": "10.22.160.195",
    "lastLoginAt": "2026-04-10T03:36:50.367Z"
  },
  {
    "_id": "69d7828457495b0bcd5ec50e",
    "empId": "675",
    "name": "Dr. S. V Phani Kumar",
    "designation": "Professor & HOD",
    "mobile": "9912514034",
    "email": "675@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY3NSIsInJvbGUiOiJhZG1pbiIsIm5hbWUiOiJEci4gUy4gViBQaGFuaSBLdW1hciIsImNhbkFjY2Vzc0FkbWluIjp0cnVlLCJpYXQiOjE3NzU3OTIyNTksImV4cCI6MTc3NTgyMTA1OX0.04WZI2wBdQrPqk_MBmh7yO_G4mPkD2A7b6zvGTocoaM",
    "sessionIssuedAt": "2026-04-10T03:37:39.297Z",
    "lastLoginIp": "10.18.196.196",
    "lastLoginAt": "2026-04-10T03:37:39.297Z"
  },
  {
    "_id": "69d7828457495b0bcd5ec512",
    "empId": "02342",
    "name": "Dr. M.Umadevi",
    "designation": "Associate Professor",
    "mobile": "9603329592",
    "email": "02342@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828457495b0bcd5ec516",
    "empId": "01429",
    "name": "Dr. P. Siva Prasad",
    "designation": "Associate Professor",
    "mobile": "9000443503",
    "email": "01429@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828557495b0bcd5ec51b",
    "empId": "189",
    "name": "Dr. S. Deva Kumar",
    "designation": "Associate Professor",
    "mobile": "9959949221",
    "email": "189@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 1,
    "lockUntil": null,
    "activeSessionToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjE4OSIsInJvbGUiOiJhZG1pbiIsIm5hbWUiOiJEci4gUy4gRGV2YSBLdW1hciIsImNhbkFjY2Vzc0FkbWluIjp0cnVlLCJpYXQiOjE3NzU3OTUwMTAsImV4cCI6MTc3NTgyMzgxMH0.ZR4wBupfm_IL-w51FVUkEacCSkKtLA9SJXdu5MbNiuE",
    "sessionIssuedAt": "2026-04-10T04:23:30.140Z",
    "lastLoginIp": "10.16.31.65",
    "lastLoginAt": "2026-04-10T04:23:30.140Z"
  },
  {
    "_id": "69d7828557495b0bcd5ec51f",
    "empId": "714",
    "name": "Dr. D. Yakobu",
    "designation": "Associate Professor",
    "mobile": "9912012626",
    "email": "714@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjcxNCIsInJvbGUiOiJmYWN1bHR5IiwibmFtZSI6IkRyLiBELiBZYWtvYnUiLCJjYW5BY2Nlc3NBZG1pbiI6ZmFsc2UsImlhdCI6MTc3NTc5NDY4OSwiZXhwIjoxNzc1ODIzNDg5fQ.2YZ912ELrpL4oAgVA5QKLeeN5v2PpVO4eVEiggoHs4M",
    "sessionIssuedAt": "2026-04-10T04:18:09.198Z",
    "lastLoginIp": "10.18.166.2",
    "lastLoginAt": "2026-04-10T04:18:09.198Z"
  },
  {
    "_id": "69d7828557495b0bcd5ec523",
    "empId": "02462",
    "name": "Dr. Prashant Upadhyay",
    "designation": "Associate Professor",
    "mobile": "9805406546",
    "email": "02462@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828557495b0bcd5ec527",
    "empId": "613",
    "name": "Dr. B. Suvarna",
    "designation": "Assistant Professor",
    "mobile": "7093171146",
    "email": "613@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828557495b0bcd5ec52b",
    "empId": "01702",
    "name": "Dr. Jhansi Lakshmi P",
    "designation": "Assistant Professor",
    "mobile": "8500719259",
    "email": "01702@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828557495b0bcd5ec52f",
    "empId": "00689",
    "name": "Dr. R. Prathap Kumar",
    "designation": "Assistant Professor",
    "mobile": "7569888963",
    "email": "00689@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828657495b0bcd5ec533",
    "empId": "30071",
    "name": "Dr. E. Deepak Chowdary",
    "designation": "Assistant Professor",
    "mobile": "9553147457",
    "email": "30071@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828657495b0bcd5ec537",
    "empId": "01905",
    "name": "Dr.Simhadiri  Chinna Gopi",
    "designation": "Assistant Professor",
    "mobile": "9700330708",
    "email": "01905@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828657495b0bcd5ec53b",
    "empId": "01989",
    "name": "Dr. T.R. Rajesh",
    "designation": "Assistant Professor",
    "mobile": "9676560542",
    "email": "01989@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828657495b0bcd5ec53f",
    "empId": "02396",
    "name": "Dr. Satish Kumar Satti",
    "designation": "Assistant Professor",
    "mobile": "9581236143",
    "email": "02396@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828657495b0bcd5ec543",
    "empId": "02433",
    "name": "Dr. Md. Oqail Ahmad",
    "designation": "Assistant Professor",
    "mobile": "8439243408",
    "email": "02433@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828657495b0bcd5ec547",
    "empId": "02468",
    "name": "Dr.M. Sunil Babu",
    "designation": "Assistant Professor",
    "mobile": "8333001991",
    "email": "02468@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828757495b0bcd5ec54b",
    "empId": "02472",
    "name": "Dr. Vinoj J",
    "designation": "Assistant Professor",
    "mobile": "9751489857",
    "email": "02472@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828757495b0bcd5ec54f",
    "empId": "02495",
    "name": "Dr. R. Renugadevi",
    "designation": "Assistant Professor",
    "mobile": "9342247173",
    "email": "02495@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828757495b0bcd5ec553",
    "empId": "02506",
    "name": "Dr. G. Saubhagya Ranjan Biswal",
    "designation": "Assistant Professor",
    "mobile": "9525588608",
    "email": "02506@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828757495b0bcd5ec557",
    "empId": "02745",
    "name": "Dr. V. S. R. Pavan Kumar Neeli",
    "designation": "Assistant Professor",
    "mobile": "9703988089",
    "email": "02745@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828757495b0bcd5ec55b",
    "empId": "02744",
    "name": "Dr. N. Sameera",
    "designation": "Assistant Professor",
    "mobile": "7989006859",
    "email": "02744@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828757495b0bcd5ec55f",
    "empId": "02770",
    "name": "Dr. O. Bhaskar",
    "designation": "Assistant Professor",
    "mobile": "9949786992",
    "email": "02770@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828857495b0bcd5ec563",
    "empId": "02961",
    "name": "Dr. Manoj Kumar Merugumal",
    "designation": "Assistant Professor",
    "mobile": "9985578967",
    "email": "02961@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828857495b0bcd5ec567",
    "empId": "02480",
    "name": "Dr. Rambabu Kusuma",
    "designation": "Assistant Professor",
    "mobile": "8919953093",
    "email": "02480@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828857495b0bcd5ec56b",
    "empId": "02181",
    "name": "Dr. G. Balu Narasimha Rao",
    "designation": "Assistant Professor",
    "mobile": "9701224847",
    "email": "02181@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828857495b0bcd5ec56f",
    "empId": "02829",
    "name": "Dr. G.Veera Bhadra Chary",
    "designation": "Assistant Professor",
    "mobile": "8978975688",
    "email": "02829@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828857495b0bcd5ec573",
    "empId": "02194",
    "name": "Dr. J. Veeranjaneyulu",
    "designation": "Assistant Professor",
    "mobile": "9492246551",
    "email": "02194@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828857495b0bcd5ec577",
    "empId": "03045",
    "name": "Dr. Krishna Reddy",
    "designation": "Assistant Professor",
    "mobile": "9492709921",
    "email": "03045@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828957495b0bcd5ec57b",
    "empId": "03055",
    "name": "Dr. J. Vijitha Ananthi",
    "designation": "Assistant Professor",
    "mobile": "9790628946",
    "email": "03055@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828957495b0bcd5ec57f",
    "empId": "03059",
    "name": "Dr. PHANINDRA THOTA",
    "designation": "Assistant Professor",
    "mobile": "8096465667",
    "email": "03059@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828957495b0bcd5ec583",
    "empId": "03096",
    "name": "Dr. M. Raja Rao",
    "designation": "Assistant Professor",
    "mobile": "8979803748",
    "email": "03096@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828957495b0bcd5ec587",
    "empId": "03102",
    "name": "Dr.James Deva Koresh H",
    "designation": "Assistant Professor",
    "mobile": "9994762822",
    "email": "03102@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828957495b0bcd5ec58b",
    "empId": "02493",
    "name": "Dr. M.Vijai Meyyapan",
    "designation": "Assistant Professor",
    "mobile": "8940506036",
    "email": "02493@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828957495b0bcd5ec58f",
    "empId": "03259",
    "name": "Dr. Gabbi Reddy Keerthi",
    "designation": "Assistant Professor",
    "mobile": "9491139513",
    "email": "03259@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828a57495b0bcd5ec593",
    "empId": "646",
    "name": "Mrs. G. Parimala",
    "designation": "Assistant Professor",
    "mobile": "9177649711",
    "email": "646@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828a57495b0bcd5ec597",
    "empId": "01201",
    "name": "Mrs. M. Bhargavi",
    "designation": "Assistant Professor",
    "mobile": "7095812130",
    "email": "01201@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": "10.16.31.65",
    "lastLoginAt": "2026-04-10T03:34:47.073Z"
  },
  {
    "_id": "69d7828a57495b0bcd5ec59b",
    "empId": "01238",
    "name": "Mrs. SD. Shareefunnisa",
    "designation": "Assistant Professor",
    "mobile": "8074308730",
    "email": "01238@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828a57495b0bcd5ec59f",
    "empId": "01350",
    "name": "Mr. K. Pavan Kumar",
    "designation": "Assistant Professor",
    "mobile": "9440781558",
    "email": "01350@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828a57495b0bcd5ec5a3",
    "empId": "01913",
    "name": "Mr. Kiran Kumar Kaveti",
    "designation": "Assistant Professor",
    "mobile": "8019419813",
    "email": "01913@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828a57495b0bcd5ec5a7",
    "empId": "01920",
    "name": "Mrs. V.Anusha",
    "designation": "Assistant Professor",
    "mobile": "9704754065",
    "email": "01920@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828a57495b0bcd5ec5ab",
    "empId": "01958",
    "name": "Mr. O.Gandhi",
    "designation": "Assistant Professor",
    "mobile": "9701463728",
    "email": "01958@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828b57495b0bcd5ec5af",
    "empId": "01976",
    "name": "Mr. P. Vijaya Babu",
    "designation": "Assistant Professor",
    "mobile": "9985333934",
    "email": "01976@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828b57495b0bcd5ec5b3",
    "empId": "01988",
    "name": "Mrs. Ch. Pushya",
    "designation": "Assistant Professor",
    "mobile": "7780112971",
    "email": "01988@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828b57495b0bcd5ec5b7",
    "empId": "01918",
    "name": "Mr. N. Uttej Kumar",
    "designation": "Assistant Professor",
    "mobile": "9573793892",
    "email": "01918@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828b57495b0bcd5ec5bb",
    "empId": "01919",
    "name": "MS. Sk.Sajida Sultana",
    "designation": "Assistant Professor",
    "mobile": "7981403193",
    "email": "01919@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828b57495b0bcd5ec5bf",
    "empId": "02172",
    "name": "Mr.Sk. Sikindar",
    "designation": "Assistant Professor",
    "mobile": "9581964409",
    "email": "02172@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828b57495b0bcd5ec5c3",
    "empId": "02209",
    "name": "Mr. Chavva Ravi Kishore Reddy",
    "designation": "Assistant Professor",
    "mobile": "8186906603",
    "email": "02209@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828c57495b0bcd5ec5c7",
    "empId": "02290",
    "name": "Mrs. G. Navya",
    "designation": "Assistant Professor",
    "mobile": "7794993678",
    "email": "02290@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828c57495b0bcd5ec5cb",
    "empId": "02318",
    "name": "Mr. Sourav Mondal",
    "designation": "Assistant Professor",
    "mobile": "9831422643",
    "email": "02318@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828c57495b0bcd5ec5cf",
    "empId": "02341",
    "name": "Mr.S.Jayasankar",
    "designation": "Assistant Professor",
    "mobile": "9025947978",
    "email": "02341@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828c57495b0bcd5ec5d3",
    "empId": "02394",
    "name": "Ms.K.Anusha",
    "designation": "Assistant Professor (Contract)",
    "mobile": "7799053996",
    "email": "02394@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828c57495b0bcd5ec5d7",
    "empId": "02395",
    "name": "Mr. D.Balakotaiah",
    "designation": "Assistant Professor (Contract)",
    "mobile": "9059093829",
    "email": "02395@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828c57495b0bcd5ec5db",
    "empId": "02451",
    "name": "Mr.S.Suresh Babu",
    "designation": "Assistant Professor (Contract)",
    "mobile": "9866684845",
    "email": "02451@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828c57495b0bcd5ec5df",
    "empId": "02507",
    "name": "Mr. P. Kiran Kumar Raja",
    "designation": "Assistant Professor",
    "mobile": "8333004429",
    "email": "02507@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828d57495b0bcd5ec5e3",
    "empId": "02516",
    "name": "Mr. T. Narasimha Rao",
    "designation": "Assistant Professor (Contract)",
    "mobile": "9441075258",
    "email": "02516@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828d57495b0bcd5ec5e7",
    "empId": "02683",
    "name": "Mrs. Magham Sumalatha",
    "designation": "Assistant Professor (Contract)",
    "mobile": "9553958115",
    "email": "02683@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828d57495b0bcd5ec5eb",
    "empId": "02691",
    "name": "Mr. P. Venkata Rajulu",
    "designation": "Assistant Professor (Contract)",
    "mobile": "9705021183",
    "email": "02691@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828d57495b0bcd5ec5ef",
    "empId": "02696",
    "name": "Mrs. Sai Spandana Verella",
    "designation": "Assistant Professor (Contract)",
    "mobile": "9948368555",
    "email": "02696@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828d57495b0bcd5ec5f3",
    "empId": "02722",
    "name": "Mr. Jani Shaik",
    "designation": "Assistant Professor (Contract)",
    "mobile": "8247840320",
    "email": "02722@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828d57495b0bcd5ec5f7",
    "empId": "02751",
    "name": "Mrs. V. Nandini",
    "designation": "CAP",
    "mobile": "9398978738",
    "email": "02751@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828d57495b0bcd5ec5fb",
    "empId": "02752",
    "name": "Mrs. Archana Nalluri",
    "designation": "CAP",
    "mobile": "8985716984",
    "email": "02752@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828e57495b0bcd5ec5ff",
    "empId": "02754",
    "name": "Mrs. K. Jyostna",
    "designation": "CAP",
    "mobile": "7337373032",
    "email": "02754@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828e57495b0bcd5ec603",
    "empId": "02804",
    "name": "Mrs. R. Lalitha",
    "designation": "Assistant Professor (Contract)",
    "mobile": "6302034022",
    "email": "02804@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828e57495b0bcd5ec607",
    "empId": "02843",
    "name": "Mr. N. Brahma Naidu",
    "designation": "Assistant Professor (Contract)",
    "mobile": "7036376240",
    "email": "02843@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828e57495b0bcd5ec60b",
    "empId": "02900",
    "name": "Mr. Kumar Devapogu",
    "designation": "Assistant Professor (Contract)",
    "mobile": "9704809093",
    "email": "02900@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828e57495b0bcd5ec60f",
    "empId": "02906",
    "name": "Mrs. Koganti Swathi",
    "designation": "CAP",
    "mobile": "9491664577",
    "email": "02906@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828e57495b0bcd5ec613",
    "empId": "02913",
    "name": "Mr. U. Venkateswara Rao",
    "designation": "Assistant Professor (Contract)",
    "mobile": "9966258482",
    "email": "02913@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828f57495b0bcd5ec617",
    "empId": "02941",
    "name": "Mr. Gujjula Murali",
    "designation": "Assistant Professor (Contract)",
    "mobile": "9553116627",
    "email": "02941@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828f57495b0bcd5ec61b",
    "empId": "02962",
    "name": "Mr. Ch. Amaresh",
    "designation": "Assistant Professor (Contract)",
    "mobile": "8106051848",
    "email": "02962@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828f57495b0bcd5ec61f",
    "empId": "03066",
    "name": "Ms. Shaik Reehana",
    "designation": "Assistant Professor (Contract)",
    "mobile": "6301094495",
    "email": "03066@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828f57495b0bcd5ec623",
    "empId": "03079",
    "name": "Ms. Jarugumalla Dayanika",
    "designation": "Assistant Professor (Contract)",
    "mobile": "7013447336",
    "email": "03079@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828f57495b0bcd5ec627",
    "empId": "03020",
    "name": "Mr. M. Mohana Venkateswara Rao",
    "designation": "Assistant Professor (Contract)",
    "mobile": "9494399849",
    "email": "03020@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828f57495b0bcd5ec62b",
    "empId": "03082",
    "name": "Mr. D. Senthil",
    "designation": "Assistant Professor (Contract)",
    "mobile": "8925096166",
    "email": "03082@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7828f57495b0bcd5ec62f",
    "empId": "30526",
    "name": "Mr. B. Anil Babu",
    "designation": "CAP",
    "mobile": "8688070939",
    "email": "30526@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7829057495b0bcd5ec633",
    "empId": "30564",
    "name": "Mrs. S. Anitha",
    "designation": "CAP",
    "mobile": "9505044559",
    "email": "30564@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7829057495b0bcd5ec637",
    "empId": "00760",
    "name": "Mrs. D. Tipura",
    "designation": "CAP",
    "mobile": "8977267707",
    "email": "00760@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7829057495b0bcd5ec63b",
    "empId": "02834",
    "name": "Mrs. Tanigundala Leelavathy",
    "designation": "Assistant Professor (Contract)",
    "mobile": "8919420637",
    "email": "02834@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7829057495b0bcd5ec63f",
    "empId": "02842",
    "name": "Mrs. Ch. Swarna Lalitha",
    "designation": "Assistant Professor (Contract)",
    "mobile": "6281716181",
    "email": "02842@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7829057495b0bcd5ec643",
    "empId": "03098",
    "name": "Ms. P. Anusha",
    "designation": "Assistant Professor (Contract)",
    "mobile": "8297353090",
    "email": "03098@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7829057495b0bcd5ec647",
    "empId": "03099",
    "name": "Mr. E.Akhil Babu",
    "designation": "Assistant Professor (Contract)",
    "mobile": "8465999059",
    "email": "03099@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7829057495b0bcd5ec64b",
    "empId": "03115",
    "name": "Mrs. N.Mounika",
    "designation": "CAP",
    "mobile": "9603741419",
    "email": "03115@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7829157495b0bcd5ec64f",
    "empId": "03112",
    "name": "Ms.N. Bhargavi",
    "designation": "Assistant Professor (Contract)",
    "mobile": "7995504921",
    "email": "03112@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7829157495b0bcd5ec653",
    "empId": "03135",
    "name": "Ms.Y. Sai Eswari",
    "designation": "CAP",
    "mobile": "8074131669",
    "email": "03135@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7829157495b0bcd5ec657",
    "empId": "03188",
    "name": "Mr. Badheli Krishnakanth",
    "designation": "Assistant Professor (Contract)",
    "mobile": "9491456208",
    "email": "03188@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7829157495b0bcd5ec65b",
    "empId": "03244",
    "name": "Mr. Kanna Hareesh",
    "designation": "CAP",
    "mobile": "9948723118",
    "email": "03244@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7829157495b0bcd5ec65f",
    "empId": "03261",
    "name": "Mr. Shyam Sundar Jannu Soloman",
    "designation": "Assistant Professor",
    "mobile": "7995624716",
    "email": "03261@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7829157495b0bcd5ec663",
    "empId": "03287",
    "name": "Ms. Gudipati Sravya",
    "designation": "Assistant Professor (Contract)",
    "mobile": "8897176559",
    "email": "03287@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7829257495b0bcd5ec667",
    "empId": "02478",
    "name": "Mr. K.Kiran Kumar",
    "designation": "Teaching Associate",
    "mobile": "9494965571",
    "email": "02478@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7829257495b0bcd5ec66b",
    "empId": "00103",
    "name": "Mr. Y. Ram Mohan",
    "designation": "Assistant Professor",
    "mobile": "9032959442",
    "email": "00103@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7829357495b0bcd5ec66f",
    "empId": "03171",
    "name": "Ms. Pavani Karra",
    "designation": "Assistant Professor",
    "mobile": "9100234298",
    "email": "03171@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7829357495b0bcd5ec673",
    "empId": "30869",
    "name": "Ms. Bhimavarapu Jyothika",
    "designation": "Teaching Associate",
    "mobile": "7989366515",
    "email": "30869@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7829457495b0bcd5ec677",
    "empId": "30870",
    "name": "Mr. Alla Pranav Sai Reddy",
    "designation": "Teaching Associate",
    "mobile": "9030760999",
    "email": "30870@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7829457495b0bcd5ec67b",
    "empId": "30871",
    "name": "Ms. Gaddam Tejaswi",
    "designation": "Teaching Associate",
    "mobile": "9398046056",
    "email": "30871@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7829457495b0bcd5ec67f",
    "empId": "30872",
    "name": "Ms. Yemineni Sravani",
    "designation": "Teaching Associate",
    "mobile": "7032293225",
    "email": "30872@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7829557495b0bcd5ec683",
    "empId": "30874",
    "name": "Mr. Munipalli Veerendra",
    "designation": "Teaching Associate",
    "mobile": "9573632919",
    "email": "30874@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7829557495b0bcd5ec687",
    "empId": "30896",
    "name": "Ms. Varagani Tejaswi",
    "designation": "Teaching Associate",
    "mobile": "6305179829",
    "email": "30896@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7829657495b0bcd5ec68b",
    "empId": "30910",
    "name": "Ms. Shaik Kareena Yashmin",
    "designation": "Teaching Associate",
    "mobile": "7801017820",
    "email": "30910@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7829657495b0bcd5ec68f",
    "empId": "30911",
    "name": "Ms. Vyshnavi Kagga",
    "designation": "Teaching Associate",
    "mobile": "9182743520",
    "email": "30911@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7829657495b0bcd5ec693",
    "empId": "30912",
    "name": "Ms. Shaik Nazeema",
    "designation": "Teaching Associate",
    "mobile": "9618896300",
    "email": "30912@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7829657495b0bcd5ec697",
    "empId": "31044",
    "name": "Ms. Kalluri Mercy Bhikshavathi",
    "designation": "Teaching Associate",
    "mobile": "9014592698",
    "email": "31044@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7829657495b0bcd5ec69b",
    "empId": "31074",
    "name": "Ms. Neeli Sarvani",
    "designation": "Teaching Associate",
    "mobile": "8790776273",
    "email": "31074@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7829757495b0bcd5ec69f",
    "empId": "31075",
    "name": "Mr. Syed Nafees Ahamed",
    "designation": "Teaching Associate",
    "mobile": "8790469105",
    "email": "31075@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7829757495b0bcd5ec6a3",
    "empId": "31076",
    "name": "Mr. Palavelli Vamsi Krishna",
    "designation": "Teaching Associate",
    "mobile": "6309663292",
    "email": "31076@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7829757495b0bcd5ec6a7",
    "empId": "31077",
    "name": "Ms. R. Nithya",
    "designation": "Teaching Associate",
    "mobile": "9585824518",
    "email": "31077@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7829757495b0bcd5ec6ab",
    "empId": "31087",
    "name": "Mr. Pathan Yaseen Khan",
    "designation": "Teaching Associate",
    "mobile": "9177459574",
    "email": "31087@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7829757495b0bcd5ec6af",
    "empId": "31088",
    "name": "Ms. Bhukya Maneesha",
    "designation": "Teaching Associate",
    "mobile": "7093125459",
    "email": "31088@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7829857495b0bcd5ec6b3",
    "empId": "31093",
    "name": "Mr. Shaik Dehtaj",
    "designation": "Teaching Associate",
    "mobile": "9010380116",
    "email": "31093@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7829857495b0bcd5ec6b7",
    "empId": "31094",
    "name": "Ms. Nese Bandhike Akhilandeswari",
    "designation": "Teaching Associate",
    "mobile": "9347927112",
    "email": "31094@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7829857495b0bcd5ec6bb",
    "empId": "31099",
    "name": "Mrs. P.S.V.V. Samhitha",
    "designation": "Teaching Associate",
    "mobile": "7337475699",
    "email": "31099@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7829857495b0bcd5ec6bf",
    "empId": "31101",
    "name": "Ms. A. Raja Kumari",
    "designation": "Teaching Associate",
    "mobile": "9014748637",
    "email": "31101@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7829857495b0bcd5ec6c3",
    "empId": "31102",
    "name": "Ms. Arumalla Gopya Sri",
    "designation": "Teaching Associate",
    "mobile": "8919398629",
    "email": "31102@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7829857495b0bcd5ec6c7",
    "empId": "31104",
    "name": "Mr. Rudru Gowtham",
    "designation": "Teaching Associate",
    "mobile": "8465057700",
    "email": "31104@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7829857495b0bcd5ec6cb",
    "empId": "31105",
    "name": "Mr. Madugula Anil",
    "designation": "Teaching Associate",
    "mobile": "9493322982",
    "email": "31105@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7829957495b0bcd5ec6cf",
    "empId": "31108",
    "name": "Ms. Talari Priya Bharathi",
    "designation": "Teaching Associate",
    "mobile": "7981730620",
    "email": "31108@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7829957495b0bcd5ec6d3",
    "empId": "31169",
    "name": "Mr. Adavi Aditya Venkateswara Kumar",
    "designation": "Teaching Associate",
    "mobile": "6301666022",
    "email": "31169@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7829957495b0bcd5ec6d7",
    "empId": "31170",
    "name": "Mr. Kudupudi Raj Kiran",
    "designation": "Teaching Associate",
    "mobile": "9542687850",
    "email": "31170@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7829957495b0bcd5ec6db",
    "empId": "31171",
    "name": "Ms. Kollabathula Nimnagasri",
    "designation": "Teaching Associate",
    "mobile": "7842481619",
    "email": "31171@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7829957495b0bcd5ec6df",
    "empId": "31172",
    "name": "Ms. Annam Durga Bhavani",
    "designation": "Teaching Associate",
    "mobile": "9398432522",
    "email": "31172@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7829957495b0bcd5ec6e3",
    "empId": "31178",
    "name": "Ms. Y. Sesha Naga Bindu Lalitha Sri",
    "designation": "Teaching Associate",
    "mobile": "8712269324",
    "email": "31178@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7829a57495b0bcd5ec6e7",
    "empId": "31179",
    "name": "Ms. G. Siva Naga Malleswari",
    "designation": "Teaching Associate",
    "mobile": "6300448477",
    "email": "31179@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7829a57495b0bcd5ec6eb",
    "empId": "31180",
    "name": "Mrs. G. Prasanthi",
    "designation": "Teaching Associate",
    "mobile": "7386542138",
    "email": "31180@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7829a57495b0bcd5ec6ef",
    "empId": "31181",
    "name": "Mr. Sk. Khadersha",
    "designation": "Teaching Associate",
    "mobile": "8309300881",
    "email": "31181@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7829a57495b0bcd5ec6f3",
    "empId": "31182",
    "name": "Ms. K. Divya",
    "designation": "Teaching Associate",
    "mobile": "8328282185",
    "email": "31182@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7829a57495b0bcd5ec6f7",
    "empId": "31203",
    "name": "Ms. Christiana Rose Elizabeth. Korrapati",
    "designation": "Teaching Associate",
    "mobile": "7816092857",
    "email": "31203@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7829a57495b0bcd5ec6fb",
    "empId": "31208",
    "name": "Ms. Upalanchi Vara Lakshmi",
    "designation": "Teaching Associate",
    "mobile": "8142214788",
    "email": "31208@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7829a57495b0bcd5ec6ff",
    "empId": "30715",
    "name": "Mr. T. Latesh Babu",
    "designation": "Teaching Associate",
    "mobile": "9550818722",
    "email": "30715@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7829b57495b0bcd5ec703",
    "empId": "31224",
    "name": "Mr. Akula Gopi",
    "designation": "Teaching Associate",
    "mobile": "7287058820",
    "email": "31224@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d7829b57495b0bcd5ec707",
    "empId": "31226",
    "name": "Ms. P. Deepthi Sowmya",
    "designation": "Teaching Associate",
    "mobile": "9100967181",
    "email": "31226@university.edu",
    "role": "faculty",
    "canAccessAdmin": false,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": null,
    "sessionIssuedAt": null,
    "lastLoginIp": null,
    "lastLoginAt": null
  },
  {
    "_id": "69d88f41871181b3851c0aa4",
    "empId": "231fa04860",
    "name": "Admin User",
    "designation": "Administrator",
    "mobile": "",
    "email": "231fa04860@institution.edu",
    "role": "admin",
    "canAccessAdmin": true,
    "failedLoginAttempts": 0,
    "lockUntil": null,
    "activeSessionToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjIzMWZhMDQ4NjAiLCJyb2xlIjoiYWRtaW4iLCJuYW1lIjoiQWRtaW4gVXNlciIsImNhbkFjY2Vzc0FkbWluIjp0cnVlLCJpYXQiOjE3NzU4MDAxNzIsImV4cCI6MTc3NTgyODk3Mn0.aARSTWiqFSkMS8DZ9HBjDTcu11u8cO2FSbuhMEAmG7c",
    "sessionIssuedAt": "2026-04-10T05:49:32.023Z",
    "lastLoginIp": "::1",
    "lastLoginAt": "2026-04-10T05:49:32.023Z"
  }
];

const EXPORTED_FACULTY = [
  {
    "_id": "69d7828457495b0bcd5ec508",
    "empId": "163",
    "name": "Prof. K.V.Krishna Kishore",
    "department": "CSE",
    "designation": "Professor & Dean, SOCI",
    "mobile": "9490647678",
    "email": "163@university.edu",
    "totalWorkingHours": 24,
    "slNo": 113
  },
  {
    "_id": "69d7828457495b0bcd5ec50c",
    "empId": "675",
    "name": "Dr. S. V Phani Kumar",
    "department": "CSE",
    "designation": "Professor & HOD",
    "mobile": "9912514034",
    "email": "675@university.edu",
    "totalWorkingHours": 24,
    "slNo": 96
  },
  {
    "_id": "69d7828457495b0bcd5ec510",
    "empId": "02342",
    "name": "Dr. M.Umadevi",
    "department": "CSE",
    "designation": "Associate Professor",
    "mobile": "9603329592",
    "email": "02342@university.edu",
    "totalWorkingHours": 24,
    "slNo": 95
  },
  {
    "_id": "69d7828457495b0bcd5ec514",
    "empId": "01429",
    "name": "Dr. P. Siva Prasad",
    "department": "CSE",
    "designation": "Associate Professor",
    "mobile": "9000443503",
    "email": "01429@university.edu",
    "totalWorkingHours": 24,
    "slNo": 94
  },
  {
    "_id": "69d7828557495b0bcd5ec519",
    "empId": "189",
    "name": "Dr. S. Deva Kumar",
    "department": "CSE",
    "designation": "Associate Professor",
    "mobile": "9959949221",
    "email": "189@vfstruniversity.edu",
    "totalWorkingHours": 24,
    "slNo": 93
  },
  {
    "_id": "69d7828557495b0bcd5ec51d",
    "empId": "714",
    "name": "Dr. D. Yakobu",
    "department": "CSE",
    "designation": "Associate Professor",
    "mobile": "9912012626",
    "email": "714@university.edu",
    "totalWorkingHours": 24,
    "slNo": 92
  },
  {
    "_id": "69d7828557495b0bcd5ec521",
    "empId": "02462",
    "name": "Dr. Prashant Upadhyay",
    "department": "CSE",
    "designation": "Associate Professor",
    "mobile": "9805406546",
    "email": "02462@university.edu",
    "totalWorkingHours": 24,
    "slNo": 91
  },
  {
    "_id": "69d7828557495b0bcd5ec525",
    "empId": "613",
    "name": "Dr. B. Suvarna",
    "department": "CSE",
    "designation": "Assistant Professor",
    "mobile": "7093171146",
    "email": "613@university.edu",
    "totalWorkingHours": 24,
    "slNo": 90
  },
  {
    "_id": "69d7828557495b0bcd5ec529",
    "empId": "01702",
    "name": "Dr. Jhansi Lakshmi P",
    "department": "CSE",
    "designation": "Assistant Professor",
    "mobile": "8500719259",
    "email": "01702@university.edu",
    "totalWorkingHours": 24,
    "slNo": 89
  },
  {
    "_id": "69d7828557495b0bcd5ec52d",
    "empId": "00689",
    "name": "Dr. R. Prathap Kumar",
    "department": "CSE",
    "designation": "Assistant Professor",
    "mobile": "7569888963",
    "email": "00689@university.edu",
    "totalWorkingHours": 24,
    "slNo": 88
  },
  {
    "_id": "69d7828557495b0bcd5ec531",
    "empId": "30071",
    "name": "Dr. E. Deepak Chowdary",
    "department": "CSE",
    "designation": "Assistant Professor",
    "mobile": "9553147457",
    "email": "30071@university.edu",
    "totalWorkingHours": 24,
    "slNo": 87
  },
  {
    "_id": "69d7828657495b0bcd5ec535",
    "empId": "01905",
    "name": "Dr.Simhadiri  Chinna Gopi",
    "department": "CSE",
    "designation": "Assistant Professor",
    "mobile": "9700330708",
    "email": "01905@university.edu",
    "totalWorkingHours": 24,
    "slNo": 86
  },
  {
    "_id": "69d7828657495b0bcd5ec539",
    "empId": "01989",
    "name": "Dr. T.R. Rajesh",
    "department": "CSE",
    "designation": "Assistant Professor",
    "mobile": "9676560542",
    "email": "01989@university.edu",
    "totalWorkingHours": 24,
    "slNo": 85
  },
  {
    "_id": "69d7828657495b0bcd5ec53d",
    "empId": "02396",
    "name": "Dr. Satish Kumar Satti",
    "department": "CSE",
    "designation": "Assistant Professor",
    "mobile": "9581236143",
    "email": "02396@university.edu",
    "totalWorkingHours": 24,
    "slNo": 84
  },
  {
    "_id": "69d7828657495b0bcd5ec541",
    "empId": "02433",
    "name": "Dr. Md. Oqail Ahmad",
    "department": "CSE",
    "designation": "Assistant Professor",
    "mobile": "8439243408",
    "email": "02433@university.edu",
    "totalWorkingHours": 24
  },
  {
    "_id": "69d7828657495b0bcd5ec545",
    "empId": "02468",
    "name": "Dr.M. Sunil Babu",
    "department": "CSE",
    "designation": "Assistant Professor",
    "mobile": "8333001991",
    "email": "02468@university.edu",
    "totalWorkingHours": 24,
    "slNo": 82
  },
  {
    "_id": "69d7828657495b0bcd5ec549",
    "empId": "02472",
    "name": "Dr. Vinoj J",
    "department": "CSE",
    "designation": "Assistant Professor",
    "mobile": "9751489857",
    "email": "02472@university.edu",
    "totalWorkingHours": 24
  },
  {
    "_id": "69d7828757495b0bcd5ec54d",
    "empId": "02495",
    "name": "Dr. R. Renugadevi",
    "department": "CSE",
    "designation": "Assistant Professor",
    "mobile": "9342247173",
    "email": "02495@university.edu",
    "totalWorkingHours": 24,
    "slNo": 80
  },
  {
    "_id": "69d7828757495b0bcd5ec551",
    "empId": "02506",
    "name": "Dr. G. Saubhagya Ranjan Biswal",
    "department": "CSE",
    "designation": "Assistant Professor",
    "mobile": "9525588608",
    "email": "02506@university.edu",
    "totalWorkingHours": 24,
    "slNo": 79
  },
  {
    "_id": "69d7828757495b0bcd5ec555",
    "empId": "02745",
    "name": "Dr. V. S. R. Pavan Kumar Neeli",
    "department": "CSE",
    "designation": "Assistant Professor",
    "mobile": "9703988089",
    "email": "02745@university.edu",
    "totalWorkingHours": 24,
    "slNo": 78
  },
  {
    "_id": "69d7828757495b0bcd5ec559",
    "empId": "02744",
    "name": "Dr. N. Sameera",
    "department": "CSE",
    "designation": "Assistant Professor",
    "mobile": "7989006859",
    "email": "02744@university.edu",
    "totalWorkingHours": 24,
    "slNo": 77
  },
  {
    "_id": "69d7828757495b0bcd5ec55d",
    "empId": "02770",
    "name": "Dr. O. Bhaskar",
    "department": "CSE",
    "designation": "Assistant Professor",
    "mobile": "9949786992",
    "email": "02770@university.edu",
    "totalWorkingHours": 24,
    "slNo": 76
  },
  {
    "_id": "69d7828757495b0bcd5ec561",
    "empId": "02961",
    "name": "Dr. Manoj Kumar Merugumal",
    "department": "CSE",
    "designation": "Assistant Professor",
    "mobile": "9985578967",
    "email": "02961@university.edu",
    "totalWorkingHours": 24,
    "slNo": 75
  },
  {
    "_id": "69d7828857495b0bcd5ec565",
    "empId": "02480",
    "name": "Dr. Rambabu Kusuma",
    "department": "CSE",
    "designation": "Assistant Professor",
    "mobile": "8919953093",
    "email": "02480@university.edu",
    "totalWorkingHours": 24,
    "slNo": 74
  },
  {
    "_id": "69d7828857495b0bcd5ec569",
    "empId": "02181",
    "name": "Dr. G. Balu Narasimha Rao",
    "department": "CSE",
    "designation": "Assistant Professor",
    "mobile": "9701224847",
    "email": "02181@university.edu",
    "totalWorkingHours": 24,
    "slNo": 73
  },
  {
    "_id": "69d7828857495b0bcd5ec56d",
    "empId": "02829",
    "name": "Dr. G.Veera Bhadra Chary",
    "department": "CSE",
    "designation": "Assistant Professor",
    "mobile": "8978975688",
    "email": "02829@university.edu",
    "totalWorkingHours": 24,
    "slNo": 72
  },
  {
    "_id": "69d7828857495b0bcd5ec571",
    "empId": "02194",
    "name": "Dr. J. Veeranjaneyulu",
    "department": "CSE",
    "designation": "Assistant Professor",
    "mobile": "9492246551",
    "email": "02194@university.edu",
    "totalWorkingHours": 24,
    "slNo": 71
  },
  {
    "_id": "69d7828857495b0bcd5ec575",
    "empId": "03045",
    "name": "Dr. Krishna Reddy",
    "department": "CSE",
    "designation": "Assistant Professor",
    "mobile": "9492709921",
    "email": "03045@university.edu",
    "totalWorkingHours": 24,
    "slNo": 70
  },
  {
    "_id": "69d7828957495b0bcd5ec579",
    "empId": "03055",
    "name": "Dr. J. Vijitha Ananthi",
    "department": "CSE",
    "designation": "Assistant Professor",
    "mobile": "9790628946",
    "email": "03055@university.edu",
    "totalWorkingHours": 24,
    "slNo": 69
  },
  {
    "_id": "69d7828957495b0bcd5ec57d",
    "empId": "03059",
    "name": "Dr. PHANINDRA THOTA",
    "department": "CSE",
    "designation": "Assistant Professor",
    "mobile": "8096465667",
    "email": "03059@university.edu",
    "totalWorkingHours": 24,
    "slNo": 68
  },
  {
    "_id": "69d7828957495b0bcd5ec581",
    "empId": "03096",
    "name": "Dr. M. Raja Rao",
    "department": "CSE",
    "designation": "Assistant Professor",
    "mobile": "8979803748",
    "email": "03096@university.edu",
    "totalWorkingHours": 24,
    "slNo": 67
  },
  {
    "_id": "69d7828957495b0bcd5ec585",
    "empId": "03102",
    "name": "Dr.James Deva Koresh H",
    "department": "CSE",
    "designation": "Assistant Professor",
    "mobile": "9994762822",
    "email": "03102@university.edu",
    "totalWorkingHours": 24,
    "slNo": 66
  },
  {
    "_id": "69d7828957495b0bcd5ec589",
    "empId": "02493",
    "name": "Dr. M.Vijai Meyyapan",
    "department": "CSE",
    "designation": "Assistant Professor",
    "mobile": "8940506036",
    "email": "02493@university.edu",
    "totalWorkingHours": 24,
    "slNo": 81
  },
  {
    "_id": "69d7828957495b0bcd5ec58d",
    "empId": "03259",
    "name": "Dr. Gabbi Reddy Keerthi",
    "department": "CSE",
    "designation": "Assistant Professor",
    "mobile": "9491139513",
    "email": "03259@university.edu",
    "totalWorkingHours": 24
  },
  {
    "_id": "69d7828957495b0bcd5ec591",
    "empId": "646",
    "name": "Mrs. G. Parimala",
    "department": "CSE",
    "designation": "Assistant Professor",
    "mobile": "9177649711",
    "email": "646@university.edu",
    "totalWorkingHours": 24,
    "slNo": 127
  },
  {
    "_id": "69d7828a57495b0bcd5ec595",
    "empId": "01201",
    "name": "Mrs. M. Bhargavi",
    "department": "CSE",
    "designation": "Assistant Professor",
    "mobile": "7095812130",
    "email": "01201@university.edu",
    "totalWorkingHours": 24,
    "slNo": 126
  },
  {
    "_id": "69d7828a57495b0bcd5ec599",
    "empId": "01238",
    "name": "Mrs. SD. Shareefunnisa",
    "department": "CSE",
    "designation": "Assistant Professor",
    "mobile": "8074308730",
    "email": "01238@university.edu",
    "totalWorkingHours": 24
  },
  {
    "_id": "69d7828a57495b0bcd5ec59d",
    "empId": "01350",
    "name": "Mr. K. Pavan Kumar",
    "department": "CSE",
    "designation": "Assistant Professor",
    "mobile": "9440781558",
    "email": "01350@university.edu",
    "totalWorkingHours": 24,
    "slNo": 124
  },
  {
    "_id": "69d7828a57495b0bcd5ec5a1",
    "empId": "01913",
    "name": "Mr. Kiran Kumar Kaveti",
    "department": "CSE",
    "designation": "Assistant Professor",
    "mobile": "8019419813",
    "email": "01913@university.edu",
    "totalWorkingHours": 24
  },
  {
    "_id": "69d7828a57495b0bcd5ec5a5",
    "empId": "01920",
    "name": "Mrs. V.Anusha",
    "department": "CSE",
    "designation": "Assistant Professor",
    "mobile": "9704754065",
    "email": "01920@university.edu",
    "totalWorkingHours": 24,
    "slNo": 122
  },
  {
    "_id": "69d7828a57495b0bcd5ec5a9",
    "empId": "01958",
    "name": "Mr. O.Gandhi",
    "department": "CSE",
    "designation": "Assistant Professor",
    "mobile": "9701463728",
    "email": "01958@university.edu",
    "totalWorkingHours": 24
  },
  {
    "_id": "69d7828a57495b0bcd5ec5ad",
    "empId": "01976",
    "name": "Mr. P. Vijaya Babu",
    "department": "CSE",
    "designation": "Assistant Professor",
    "mobile": "9985333934",
    "email": "01976@university.edu",
    "totalWorkingHours": 24,
    "slNo": 120
  },
  {
    "_id": "69d7828b57495b0bcd5ec5b1",
    "empId": "01988",
    "name": "Mrs. Ch. Pushya",
    "department": "CSE",
    "designation": "Assistant Professor",
    "mobile": "7780112971",
    "email": "01988@university.edu",
    "totalWorkingHours": 24,
    "slNo": 119
  },
  {
    "_id": "69d7828b57495b0bcd5ec5b5",
    "empId": "01918",
    "name": "Mr. N. Uttej Kumar",
    "department": "CSE",
    "designation": "Assistant Professor",
    "mobile": "9573793892",
    "email": "01918@university.edu",
    "totalWorkingHours": 24
  },
  {
    "_id": "69d7828b57495b0bcd5ec5b9",
    "empId": "01919",
    "name": "MS. Sk.Sajida Sultana",
    "department": "CSE",
    "designation": "Assistant Professor",
    "mobile": "7981403193",
    "email": "01919@university.edu",
    "totalWorkingHours": 24,
    "slNo": 117
  },
  {
    "_id": "69d7828b57495b0bcd5ec5bd",
    "empId": "02172",
    "name": "Mr.Sk. Sikindar",
    "department": "CSE",
    "designation": "Assistant Professor",
    "mobile": "9581964409",
    "email": "02172@university.edu",
    "totalWorkingHours": 24
  },
  {
    "_id": "69d7828b57495b0bcd5ec5c1",
    "empId": "02209",
    "name": "Mr. Chavva Ravi Kishore Reddy",
    "department": "CSE",
    "designation": "Assistant Professor",
    "mobile": "8186906603",
    "email": "02209@university.edu",
    "totalWorkingHours": 24,
    "slNo": 115
  },
  {
    "_id": "69d7828b57495b0bcd5ec5c5",
    "empId": "02290",
    "name": "Mrs. G. Navya",
    "department": "CSE",
    "designation": "Assistant Professor",
    "mobile": "7794993678",
    "email": "02290@university.edu",
    "totalWorkingHours": 24,
    "slNo": 114
  },
  {
    "_id": "69d7828c57495b0bcd5ec5c9",
    "empId": "02318",
    "name": "Mr. Sourav Mondal",
    "department": "CSE",
    "designation": "Assistant Professor",
    "mobile": "9831422643",
    "email": "02318@university.edu",
    "totalWorkingHours": 24,
    "slNo": 97
  },
  {
    "_id": "69d7828c57495b0bcd5ec5cd",
    "empId": "02341",
    "name": "Mr.S.Jayasankar",
    "department": "CSE",
    "designation": "Assistant Professor",
    "mobile": "9025947978",
    "email": "02341@university.edu",
    "totalWorkingHours": 24
  },
  {
    "_id": "69d7828c57495b0bcd5ec5d1",
    "empId": "02394",
    "name": "Ms.K.Anusha",
    "department": "CSE",
    "designation": "Assistant Professor (Contract)",
    "mobile": "7799053996",
    "email": "02394@university.edu",
    "totalWorkingHours": 24,
    "slNo": 111
  },
  {
    "_id": "69d7828c57495b0bcd5ec5d5",
    "empId": "02395",
    "name": "Mr. D.Balakotaiah",
    "department": "CSE",
    "designation": "Assistant Professor (Contract)",
    "mobile": "9059093829",
    "email": "02395@university.edu",
    "totalWorkingHours": 24
  },
  {
    "_id": "69d7828c57495b0bcd5ec5d9",
    "empId": "02451",
    "name": "Mr.S.Suresh Babu",
    "department": "CSE",
    "designation": "Assistant Professor (Contract)",
    "mobile": "9866684845",
    "email": "02451@university.edu",
    "totalWorkingHours": 24
  },
  {
    "_id": "69d7828c57495b0bcd5ec5dd",
    "empId": "02507",
    "name": "Mr. P. Kiran Kumar Raja",
    "department": "CSE",
    "designation": "Assistant Professor",
    "mobile": "8333004429",
    "email": "02507@university.edu",
    "totalWorkingHours": 24,
    "slNo": 108
  },
  {
    "_id": "69d7828c57495b0bcd5ec5e1",
    "empId": "02516",
    "name": "Mr. T. Narasimha Rao",
    "department": "CSE",
    "designation": "Assistant Professor (Contract)",
    "mobile": "9441075258",
    "email": "02516@university.edu",
    "totalWorkingHours": 24
  },
  {
    "_id": "69d7828d57495b0bcd5ec5e5",
    "empId": "02683",
    "name": "Mrs. Magham Sumalatha",
    "department": "CSE",
    "designation": "Assistant Professor (Contract)",
    "mobile": "9553958115",
    "email": "02683@university.edu",
    "totalWorkingHours": 24,
    "slNo": 106
  },
  {
    "_id": "69d7828d57495b0bcd5ec5e9",
    "empId": "02691",
    "name": "Mr. P. Venkata Rajulu",
    "department": "CSE",
    "designation": "Assistant Professor (Contract)",
    "mobile": "9705021183",
    "email": "02691@university.edu",
    "totalWorkingHours": 24
  },
  {
    "_id": "69d7828d57495b0bcd5ec5ed",
    "empId": "02696",
    "name": "Mrs. Sai Spandana Verella",
    "department": "CSE",
    "designation": "Assistant Professor (Contract)",
    "mobile": "9948368555",
    "email": "02696@university.edu",
    "totalWorkingHours": 24,
    "slNo": 104
  },
  {
    "_id": "69d7828d57495b0bcd5ec5f1",
    "empId": "02722",
    "name": "Mr. Jani Shaik",
    "department": "CSE",
    "designation": "Assistant Professor (Contract)",
    "mobile": "8247840320",
    "email": "02722@university.edu",
    "totalWorkingHours": 24,
    "slNo": 103
  },
  {
    "_id": "69d7828d57495b0bcd5ec5f5",
    "empId": "02751",
    "name": "Mrs. V. Nandini",
    "department": "CSE",
    "designation": "CAP",
    "mobile": "9398978738",
    "email": "02751@university.edu",
    "totalWorkingHours": 24,
    "slNo": 102
  },
  {
    "_id": "69d7828d57495b0bcd5ec5f9",
    "empId": "02752",
    "name": "Mrs. Archana Nalluri",
    "department": "CSE",
    "designation": "CAP",
    "mobile": "8985716984",
    "email": "02752@university.edu",
    "totalWorkingHours": 24
  },
  {
    "_id": "69d7828d57495b0bcd5ec5fd",
    "empId": "02754",
    "name": "Mrs. K. Jyostna",
    "department": "CSE",
    "designation": "CAP",
    "mobile": "7337373032",
    "email": "02754@university.edu",
    "totalWorkingHours": 24,
    "slNo": 100
  },
  {
    "_id": "69d7828e57495b0bcd5ec601",
    "empId": "02804",
    "name": "Mrs. R. Lalitha",
    "department": "CSE",
    "designation": "Assistant Professor (Contract)",
    "mobile": "6302034022",
    "email": "02804@university.edu",
    "totalWorkingHours": 24,
    "slNo": 99
  },
  {
    "_id": "69d7828e57495b0bcd5ec605",
    "empId": "02843",
    "name": "Mr. N. Brahma Naidu",
    "department": "CSE",
    "designation": "Assistant Professor (Contract)",
    "mobile": "7036376240",
    "email": "02843@university.edu",
    "totalWorkingHours": 24,
    "slNo": 98
  },
  {
    "_id": "69d7828e57495b0bcd5ec609",
    "empId": "02900",
    "name": "Mr. Kumar Devapogu",
    "department": "CSE",
    "designation": "Assistant Professor (Contract)",
    "mobile": "9704809093",
    "email": "02900@university.edu",
    "totalWorkingHours": 24,
    "slNo": 49
  },
  {
    "_id": "69d7828e57495b0bcd5ec60d",
    "empId": "02906",
    "name": "Mrs. Koganti Swathi",
    "department": "CSE",
    "designation": "CAP",
    "mobile": "9491664577",
    "email": "02906@university.edu",
    "totalWorkingHours": 24,
    "slNo": 32
  },
  {
    "_id": "69d7828e57495b0bcd5ec611",
    "empId": "02913",
    "name": "Mr. U. Venkateswara Rao",
    "department": "CSE",
    "designation": "Assistant Professor (Contract)",
    "mobile": "9966258482",
    "email": "02913@university.edu",
    "totalWorkingHours": 24,
    "slNo": 31
  },
  {
    "_id": "69d7828e57495b0bcd5ec615",
    "empId": "02941",
    "name": "Mr. Gujjula Murali",
    "department": "CSE",
    "designation": "Assistant Professor (Contract)",
    "mobile": "9553116627",
    "email": "02941@university.edu",
    "totalWorkingHours": 24,
    "slNo": 30
  },
  {
    "_id": "69d7828f57495b0bcd5ec619",
    "empId": "02962",
    "name": "Mr. Ch. Amaresh",
    "department": "CSE",
    "designation": "Assistant Professor (Contract)",
    "mobile": "8106051848",
    "email": "02962@university.edu",
    "totalWorkingHours": 24,
    "slNo": 29
  },
  {
    "_id": "69d7828f57495b0bcd5ec61d",
    "empId": "03066",
    "name": "Ms. Shaik Reehana",
    "department": "CSE",
    "designation": "Assistant Professor (Contract)",
    "mobile": "6301094495",
    "email": "03066@university.edu",
    "totalWorkingHours": 24,
    "slNo": 28
  },
  {
    "_id": "69d7828f57495b0bcd5ec621",
    "empId": "03079",
    "name": "Ms. Jarugumalla Dayanika",
    "department": "CSE",
    "designation": "Assistant Professor (Contract)",
    "mobile": "7013447336",
    "email": "03079@university.edu",
    "totalWorkingHours": 24
  },
  {
    "_id": "69d7828f57495b0bcd5ec625",
    "empId": "03020",
    "name": "Mr. M. Mohana Venkateswara Rao",
    "department": "CSE",
    "designation": "Assistant Professor (Contract)",
    "mobile": "9494399849",
    "email": "03020@university.edu",
    "totalWorkingHours": 24,
    "slNo": 26
  },
  {
    "_id": "69d7828f57495b0bcd5ec629",
    "empId": "03082",
    "name": "Mr. D. Senthil",
    "department": "CSE",
    "designation": "Assistant Professor (Contract)",
    "mobile": "8925096166",
    "email": "03082@university.edu",
    "totalWorkingHours": 24,
    "slNo": 25
  },
  {
    "_id": "69d7828f57495b0bcd5ec62d",
    "empId": "30526",
    "name": "Mr. B. Anil Babu",
    "department": "CSE",
    "designation": "CAP",
    "mobile": "8688070939",
    "email": "30526@university.edu",
    "totalWorkingHours": 24
  },
  {
    "_id": "69d7828f57495b0bcd5ec631",
    "empId": "30564",
    "name": "Mrs. S. Anitha",
    "department": "CSE",
    "designation": "CAP",
    "mobile": "9505044559",
    "email": "30564@university.edu",
    "totalWorkingHours": 24,
    "slNo": 23
  },
  {
    "_id": "69d7829057495b0bcd5ec635",
    "empId": "00760",
    "name": "Mrs. D. Tipura",
    "department": "CSE",
    "designation": "CAP",
    "mobile": "8977267707",
    "email": "00760@university.edu",
    "totalWorkingHours": 24,
    "slNo": 22
  },
  {
    "_id": "69d7829057495b0bcd5ec639",
    "empId": "02834",
    "name": "Mrs. Tanigundala Leelavathy",
    "department": "CSE",
    "designation": "Assistant Professor (Contract)",
    "mobile": "8919420637",
    "email": "02834@university.edu",
    "totalWorkingHours": 24
  },
  {
    "_id": "69d7829057495b0bcd5ec63d",
    "empId": "02842",
    "name": "Mrs. Ch. Swarna Lalitha",
    "department": "CSE",
    "designation": "Assistant Professor (Contract)",
    "mobile": "6281716181",
    "email": "02842@university.edu",
    "totalWorkingHours": 24,
    "slNo": 20
  },
  {
    "_id": "69d7829057495b0bcd5ec641",
    "empId": "03098",
    "name": "Ms. P. Anusha",
    "department": "CSE",
    "designation": "Assistant Professor (Contract)",
    "mobile": "8297353090",
    "email": "03098@university.edu",
    "totalWorkingHours": 24
  },
  {
    "_id": "69d7829057495b0bcd5ec645",
    "empId": "03099",
    "name": "Mr. E.Akhil Babu",
    "department": "CSE",
    "designation": "Assistant Professor (Contract)",
    "mobile": "8465999059",
    "email": "03099@university.edu",
    "totalWorkingHours": 24,
    "slNo": 18
  },
  {
    "_id": "69d7829057495b0bcd5ec649",
    "empId": "03115",
    "name": "Mrs. N.Mounika",
    "department": "CSE",
    "designation": "CAP",
    "mobile": "9603741419",
    "email": "03115@university.edu",
    "totalWorkingHours": 24,
    "slNo": 1
  },
  {
    "_id": "69d7829057495b0bcd5ec64d",
    "empId": "03112",
    "name": "Ms.N. Bhargavi",
    "department": "CSE",
    "designation": "Assistant Professor (Contract)",
    "mobile": "7995504921",
    "email": "03112@university.edu",
    "totalWorkingHours": 24,
    "slNo": 16
  },
  {
    "_id": "69d7829157495b0bcd5ec651",
    "empId": "03135",
    "name": "Ms.Y. Sai Eswari",
    "department": "CSE",
    "designation": "CAP",
    "mobile": "8074131669",
    "email": "03135@university.edu",
    "totalWorkingHours": 24,
    "slNo": 15
  },
  {
    "_id": "69d7829157495b0bcd5ec655",
    "empId": "03188",
    "name": "Mr. Badheli Krishnakanth",
    "department": "CSE",
    "designation": "Assistant Professor (Contract)",
    "mobile": "9491456208",
    "email": "03188@university.edu",
    "totalWorkingHours": 24,
    "slNo": 14
  },
  {
    "_id": "69d7829157495b0bcd5ec659",
    "empId": "03244",
    "name": "Mr. Kanna Hareesh",
    "department": "CSE",
    "designation": "CAP",
    "mobile": "9948723118",
    "email": "03244@university.edu",
    "totalWorkingHours": 24,
    "slNo": 13
  },
  {
    "_id": "69d7829157495b0bcd5ec65d",
    "empId": "03261",
    "name": "Mr. Shyam Sundar Jannu Soloman",
    "department": "CSE",
    "designation": "Assistant Professor",
    "mobile": "7995624716",
    "email": "03261@university.edu",
    "totalWorkingHours": 24,
    "slNo": 12
  },
  {
    "_id": "69d7829157495b0bcd5ec661",
    "empId": "03287",
    "name": "Ms. Gudipati Sravya",
    "department": "CSE",
    "designation": "Assistant Professor (Contract)",
    "mobile": "8897176559",
    "email": "03287@university.edu",
    "totalWorkingHours": 24,
    "slNo": 11
  },
  {
    "_id": "69d7829257495b0bcd5ec665",
    "empId": "02478",
    "name": "Mr. K.Kiran Kumar",
    "department": "CSE",
    "designation": "Teaching Associate",
    "mobile": "9494965571",
    "email": "02478@university.edu",
    "totalWorkingHours": 24,
    "slNo": 10
  },
  {
    "_id": "69d7829257495b0bcd5ec669",
    "empId": "00103",
    "name": "Mr. Y. Ram Mohan",
    "department": "CSE",
    "designation": "Assistant Professor",
    "mobile": "9032959442",
    "email": "00103@university.edu",
    "totalWorkingHours": 24,
    "slNo": 9
  },
  {
    "_id": "69d7829257495b0bcd5ec66d",
    "empId": "03171",
    "name": "Ms. Pavani Karra",
    "department": "CSE",
    "designation": "Assistant Professor",
    "mobile": "9100234298",
    "email": "03171@university.edu",
    "totalWorkingHours": 24,
    "slNo": 8
  },
  {
    "_id": "69d7829357495b0bcd5ec671",
    "empId": "30869",
    "name": "Ms. Bhimavarapu Jyothika",
    "department": "CSE",
    "designation": "Teaching Associate",
    "mobile": "7989366515",
    "email": "30869@university.edu",
    "totalWorkingHours": 24,
    "slNo": 7
  },
  {
    "_id": "69d7829357495b0bcd5ec675",
    "empId": "30870",
    "name": "Mr. Alla Pranav Sai Reddy",
    "department": "CSE",
    "designation": "Teaching Associate",
    "mobile": "9030760999",
    "email": "30870@university.edu",
    "totalWorkingHours": 24,
    "slNo": 6
  },
  {
    "_id": "69d7829457495b0bcd5ec679",
    "empId": "30871",
    "name": "Ms. Gaddam Tejaswi",
    "department": "CSE",
    "designation": "Teaching Associate",
    "mobile": "9398046056",
    "email": "30871@university.edu",
    "totalWorkingHours": 24,
    "slNo": 5
  },
  {
    "_id": "69d7829457495b0bcd5ec67d",
    "empId": "30872",
    "name": "Ms. Yemineni Sravani",
    "department": "CSE",
    "designation": "Teaching Associate",
    "mobile": "7032293225",
    "email": "30872@university.edu",
    "totalWorkingHours": 24,
    "slNo": 4
  },
  {
    "_id": "69d7829557495b0bcd5ec681",
    "empId": "30874",
    "name": "Mr. Munipalli Veerendra",
    "department": "CSE",
    "designation": "Teaching Associate",
    "mobile": "9573632919",
    "email": "30874@university.edu",
    "totalWorkingHours": 24,
    "slNo": 3
  },
  {
    "_id": "69d7829557495b0bcd5ec685",
    "empId": "30896",
    "name": "Ms. Varagani Tejaswi",
    "department": "CSE",
    "designation": "Teaching Associate",
    "mobile": "6305179829",
    "email": "30896@university.edu",
    "totalWorkingHours": 24,
    "slNo": 2
  },
  {
    "_id": "69d7829557495b0bcd5ec689",
    "empId": "30910",
    "name": "Ms. Shaik Kareena Yashmin",
    "department": "CSE",
    "designation": "Teaching Associate",
    "mobile": "7801017820",
    "email": "30910@university.edu",
    "totalWorkingHours": 24,
    "slNo": 17
  },
  {
    "_id": "69d7829657495b0bcd5ec68d",
    "empId": "30911",
    "name": "Ms. Vyshnavi Kagga",
    "department": "CSE",
    "designation": "Teaching Associate",
    "mobile": "9182743520",
    "email": "30911@university.edu",
    "totalWorkingHours": 24,
    "slNo": 64
  },
  {
    "_id": "69d7829657495b0bcd5ec691",
    "empId": "30912",
    "name": "Ms. Shaik Nazeema",
    "department": "CSE",
    "designation": "Teaching Associate",
    "mobile": "9618896300",
    "email": "30912@university.edu",
    "totalWorkingHours": 24,
    "slNo": 63
  },
  {
    "_id": "69d7829657495b0bcd5ec695",
    "empId": "31044",
    "name": "Ms. Kalluri Mercy Bhikshavathi",
    "department": "CSE",
    "designation": "Teaching Associate",
    "mobile": "9014592698",
    "email": "31044@university.edu",
    "totalWorkingHours": 24,
    "slNo": 62
  },
  {
    "_id": "69d7829657495b0bcd5ec699",
    "empId": "31074",
    "name": "Ms. Neeli Sarvani",
    "department": "CSE",
    "designation": "Teaching Associate",
    "mobile": "8790776273",
    "email": "31074@university.edu",
    "totalWorkingHours": 24,
    "slNo": 61
  },
  {
    "_id": "69d7829757495b0bcd5ec69d",
    "empId": "31075",
    "name": "Mr. Syed Nafees Ahamed",
    "department": "CSE",
    "designation": "Teaching Associate",
    "mobile": "8790469105",
    "email": "31075@university.edu",
    "totalWorkingHours": 24,
    "slNo": 60
  },
  {
    "_id": "69d7829757495b0bcd5ec6a1",
    "empId": "31076",
    "name": "Mr. Palavelli Vamsi Krishna",
    "department": "CSE",
    "designation": "Teaching Associate",
    "mobile": "6309663292",
    "email": "31076@university.edu",
    "totalWorkingHours": 24,
    "slNo": 59
  },
  {
    "_id": "69d7829757495b0bcd5ec6a5",
    "empId": "31077",
    "name": "Ms. R. Nithya",
    "department": "CSE",
    "designation": "Teaching Associate",
    "mobile": "9585824518",
    "email": "31077@university.edu",
    "totalWorkingHours": 24,
    "slNo": 58
  },
  {
    "_id": "69d7829757495b0bcd5ec6a9",
    "empId": "31087",
    "name": "Mr. Pathan Yaseen Khan",
    "department": "CSE",
    "designation": "Teaching Associate",
    "mobile": "9177459574",
    "email": "31087@university.edu",
    "totalWorkingHours": 24,
    "slNo": 57
  },
  {
    "_id": "69d7829757495b0bcd5ec6ad",
    "empId": "31088",
    "name": "Ms. Bhukya Maneesha",
    "department": "CSE",
    "designation": "Teaching Associate",
    "mobile": "7093125459",
    "email": "31088@university.edu",
    "totalWorkingHours": 24,
    "slNo": 56
  },
  {
    "_id": "69d7829757495b0bcd5ec6b1",
    "empId": "31093",
    "name": "Mr. Shaik Dehtaj",
    "department": "CSE",
    "designation": "Teaching Associate",
    "mobile": "9010380116",
    "email": "31093@university.edu",
    "totalWorkingHours": 24,
    "slNo": 55
  },
  {
    "_id": "69d7829857495b0bcd5ec6b5",
    "empId": "31094",
    "name": "Ms. Nese Bandhike Akhilandeswari",
    "department": "CSE",
    "designation": "Teaching Associate",
    "mobile": "9347927112",
    "email": "31094@university.edu",
    "totalWorkingHours": 24
  },
  {
    "_id": "69d7829857495b0bcd5ec6b9",
    "empId": "31099",
    "name": "Mrs. P.S.V.V. Samhitha",
    "department": "CSE",
    "designation": "Teaching Associate",
    "mobile": "7337475699",
    "email": "31099@university.edu",
    "totalWorkingHours": 24
  },
  {
    "_id": "69d7829857495b0bcd5ec6bd",
    "empId": "31101",
    "name": "Ms. A. Raja Kumari",
    "department": "CSE",
    "designation": "Teaching Associate",
    "mobile": "9014748637",
    "email": "31101@university.edu",
    "totalWorkingHours": 24,
    "slNo": 52
  },
  {
    "_id": "69d7829857495b0bcd5ec6c1",
    "empId": "31102",
    "name": "Ms. Arumalla Gopya Sri",
    "department": "CSE",
    "designation": "Teaching Associate",
    "mobile": "8919398629",
    "email": "31102@university.edu",
    "totalWorkingHours": 24,
    "slNo": 51
  },
  {
    "_id": "69d7829857495b0bcd5ec6c5",
    "empId": "31104",
    "name": "Mr. Rudru Gowtham",
    "department": "CSE",
    "designation": "Teaching Associate",
    "mobile": "8465057700",
    "email": "31104@university.edu",
    "totalWorkingHours": 24,
    "slNo": 50
  },
  {
    "_id": "69d7829857495b0bcd5ec6c9",
    "empId": "31105",
    "name": "Mr. Madugula Anil",
    "department": "CSE",
    "designation": "Teaching Associate",
    "mobile": "9493322982",
    "email": "31105@university.edu",
    "totalWorkingHours": 24,
    "slNo": 33
  },
  {
    "_id": "69d7829857495b0bcd5ec6cd",
    "empId": "31108",
    "name": "Ms. Talari Priya Bharathi",
    "department": "CSE",
    "designation": "Teaching Associate",
    "mobile": "7981730620",
    "email": "31108@university.edu",
    "totalWorkingHours": 24,
    "slNo": 48
  },
  {
    "_id": "69d7829957495b0bcd5ec6d1",
    "empId": "31169",
    "name": "Mr. Adavi Aditya Venkateswara Kumar",
    "department": "CSE",
    "designation": "Teaching Associate",
    "mobile": "6301666022",
    "email": "31169@university.edu",
    "totalWorkingHours": 24,
    "slNo": 47
  },
  {
    "_id": "69d7829957495b0bcd5ec6d5",
    "empId": "31170",
    "name": "Mr. Kudupudi Raj Kiran",
    "department": "CSE",
    "designation": "Teaching Associate",
    "mobile": "9542687850",
    "email": "31170@university.edu",
    "totalWorkingHours": 24,
    "slNo": 46
  },
  {
    "_id": "69d7829957495b0bcd5ec6d9",
    "empId": "31171",
    "name": "Ms. Kollabathula Nimnagasri",
    "department": "CSE",
    "designation": "Teaching Associate",
    "mobile": "7842481619",
    "email": "31171@university.edu",
    "totalWorkingHours": 24,
    "slNo": 45
  },
  {
    "_id": "69d7829957495b0bcd5ec6dd",
    "empId": "31172",
    "name": "Ms. Annam Durga Bhavani",
    "department": "CSE",
    "designation": "Teaching Associate",
    "mobile": "9398432522",
    "email": "31172@university.edu",
    "totalWorkingHours": 24,
    "slNo": 44
  },
  {
    "_id": "69d7829957495b0bcd5ec6e1",
    "empId": "31178",
    "name": "Ms. Y. Sesha Naga Bindu Lalitha Sri",
    "department": "CSE",
    "designation": "Teaching Associate",
    "mobile": "8712269324",
    "email": "31178@university.edu",
    "totalWorkingHours": 24,
    "slNo": 43
  },
  {
    "_id": "69d7829957495b0bcd5ec6e5",
    "empId": "31179",
    "name": "Ms. G. Siva Naga Malleswari",
    "department": "CSE",
    "designation": "Teaching Associate",
    "mobile": "6300448477",
    "email": "31179@university.edu",
    "totalWorkingHours": 24,
    "slNo": 42
  },
  {
    "_id": "69d7829a57495b0bcd5ec6e9",
    "empId": "31180",
    "name": "Mrs. G. Prasanthi",
    "department": "CSE",
    "designation": "Teaching Associate",
    "mobile": "7386542138",
    "email": "31180@university.edu",
    "totalWorkingHours": 24,
    "slNo": 41
  },
  {
    "_id": "69d7829a57495b0bcd5ec6ed",
    "empId": "31181",
    "name": "Mr. Sk. Khadersha",
    "department": "CSE",
    "designation": "Teaching Associate",
    "mobile": "8309300881",
    "email": "31181@university.edu",
    "totalWorkingHours": 24,
    "slNo": 40
  },
  {
    "_id": "69d7829a57495b0bcd5ec6f1",
    "empId": "31182",
    "name": "Ms. K. Divya",
    "department": "CSE",
    "designation": "Teaching Associate",
    "mobile": "8328282185",
    "email": "31182@university.edu",
    "totalWorkingHours": 24,
    "slNo": 39
  },
  {
    "_id": "69d7829a57495b0bcd5ec6f5",
    "empId": "31203",
    "name": "Ms. Christiana Rose Elizabeth. Korrapati",
    "department": "CSE",
    "designation": "Teaching Associate",
    "mobile": "7816092857",
    "email": "31203@university.edu",
    "totalWorkingHours": 24,
    "slNo": 38
  },
  {
    "_id": "69d7829a57495b0bcd5ec6f9",
    "empId": "31208",
    "name": "Ms. Upalanchi Vara Lakshmi",
    "department": "CSE",
    "designation": "Teaching Associate",
    "mobile": "8142214788",
    "email": "31208@university.edu",
    "totalWorkingHours": 24,
    "slNo": 37
  },
  {
    "_id": "69d7829a57495b0bcd5ec6fd",
    "empId": "30715",
    "name": "Mr. T. Latesh Babu",
    "department": "CSE",
    "designation": "Teaching Associate",
    "mobile": "9550818722",
    "email": "30715@university.edu",
    "totalWorkingHours": 24,
    "slNo": 36
  },
  {
    "_id": "69d7829a57495b0bcd5ec701",
    "empId": "31224",
    "name": "Mr. Akula Gopi",
    "department": "CSE",
    "designation": "Teaching Associate",
    "mobile": "7287058820",
    "email": "31224@university.edu",
    "totalWorkingHours": 24,
    "slNo": 35
  },
  {
    "_id": "69d7829b57495b0bcd5ec705",
    "empId": "31226",
    "name": "Ms. P. Deepthi Sowmya",
    "department": "CSE",
    "designation": "Teaching Associate",
    "mobile": "9100967181",
    "email": "31226@university.edu",
    "totalWorkingHours": 24,
    "slNo": 34
  }
];

const EXPORTED_COURSES = [
  {
    "_id": "69d7806078fd5ea69a98765f",
    "courseId": 1,
    "program": "B.Tech",
    "courseType": "Mandatory",
    "year": "I",
    "subjectCode": "25CS101",
    "subjectName": "Programming In C",
    "shortName": "PIC",
    "L": 2,
    "T": 0,
    "P": 4,
    "C": 4,
    "mainFacultyId": ""
  },
  {
    "_id": "69d7806078fd5ea69a987660",
    "courseId": 2,
    "program": "B.Tech",
    "courseType": "Mandatory",
    "year": "I",
    "subjectCode": "NEW1001",
    "subjectName": "Agentic Tools",
    "shortName": "AgenticTools",
    "L": 0,
    "T": 2,
    "P": 2,
    "C": 2,
    "mainFacultyId": ""
  },
  {
    "_id": "69d7806078fd5ea69a987661",
    "courseId": 3,
    "program": "B.Tech",
    "courseType": "Mandatory",
    "year": "II",
    "subjectCode": "25CS203",
    "subjectName": "Database Management Systems",
    "shortName": "DBMS",
    "L": 2,
    "T": 2,
    "P": 2,
    "C": 4,
    "mainFacultyId": ""
  },
  {
    "_id": "69d7806078fd5ea69a987662",
    "courseId": 4,
    "program": "B.Tech",
    "courseType": "Mandatory",
    "year": "II",
    "subjectCode": "25CS201",
    "subjectName": "Data Structures",
    "shortName": "DS",
    "L": 2,
    "T": 2,
    "P": 2,
    "C": 4,
    "mainFacultyId": ""
  },
  {
    "_id": "69d7806078fd5ea69a987663",
    "courseId": 5,
    "program": "B.Tech",
    "courseType": "Mandatory",
    "year": "II",
    "subjectCode": "25CS204",
    "subjectName": "Object Oriented Programming Through Java",
    "shortName": "OOPJ",
    "L": 2,
    "T": 0,
    "P": 2,
    "C": 3,
    "mainFacultyId": ""
  },
  {
    "_id": "69d7806078fd5ea69a987664",
    "courseId": 6,
    "program": "B.Tech",
    "courseType": "Mandatory",
    "year": "II",
    "subjectCode": "24CS302",
    "subjectName": "Artificial Intelligence",
    "shortName": "AI",
    "L": 2,
    "T": 0,
    "P": 0,
    "C": 2,
    "mainFacultyId": ""
  },
  {
    "_id": "69d7806078fd5ea69a987665",
    "courseId": 7,
    "program": "B.Tech",
    "courseType": "Mandatory",
    "year": "II",
    "subjectCode": "25CS202",
    "subjectName": "Data Wrangling and Visualization",
    "shortName": "DW",
    "L": 1,
    "T": 0,
    "P": 2,
    "C": 2,
    "mainFacultyId": ""
  },
  {
    "_id": "69d7806078fd5ea69a987666",
    "courseId": 8,
    "program": "B.Tech",
    "courseType": "Mandatory",
    "year": "III",
    "subjectCode": "24CS301",
    "subjectName": "Optimization Techniques",
    "shortName": "Opt Tech",
    "L": 3,
    "T": 1,
    "P": 0,
    "C": 4,
    "mainFacultyId": ""
  },
  {
    "_id": "69d7806078fd5ea69a987667",
    "courseId": 9,
    "program": "B.Tech",
    "courseType": "Mandatory",
    "year": "III",
    "subjectCode": "24CS306",
    "subjectName": "Machine Learning",
    "shortName": "ML",
    "L": 3,
    "T": 0,
    "P": 2,
    "C": 4,
    "mainFacultyId": ""
  },
  {
    "_id": "69d7806078fd5ea69a987668",
    "courseId": 10,
    "program": "B.Tech",
    "courseType": "Mandatory",
    "year": "III",
    "subjectCode": "24CS303",
    "subjectName": "Computer Networks",
    "shortName": "CN",
    "L": 3,
    "T": 1,
    "P": 0,
    "C": 4,
    "mainFacultyId": ""
  },
  {
    "_id": "69d7806078fd5ea69a987669",
    "courseId": 11,
    "program": "B.Tech",
    "courseType": "Mandatory",
    "year": "III",
    "subjectCode": "24CS305",
    "subjectName": "Computing Ethics",
    "shortName": "Ethics",
    "L": 2,
    "T": 0,
    "P": 0,
    "C": 2,
    "mainFacultyId": ""
  },
  {
    "_id": "69d7806078fd5ea69a98766a",
    "courseId": 12,
    "program": "B.Tech",
    "courseType": "Department Elective",
    "year": "III",
    "subjectCode": "NEW3001",
    "subjectName": "Computer Vision",
    "shortName": "CV",
    "L": 3,
    "T": 0,
    "P": 0,
    "C": 3,
    "mainFacultyId": ""
  },
  {
    "_id": "69d7806078fd5ea69a98766b",
    "courseId": 13,
    "program": "B.Tech",
    "courseType": "Department Elective",
    "year": "III",
    "subjectCode": "NEW3002",
    "subjectName": "Modern Front-End Frameworks",
    "shortName": "FrontEnd",
    "L": 3,
    "T": 0,
    "P": 0,
    "C": 3,
    "mainFacultyId": ""
  },
  {
    "_id": "69d7806078fd5ea69a98766c",
    "courseId": 14,
    "program": "B.Tech",
    "courseType": "Open Elective",
    "year": "III",
    "subjectCode": "22CS851",
    "subjectName": "Database Systems",
    "shortName": "DB Sys",
    "L": 3,
    "T": 0,
    "P": 0,
    "C": 3,
    "mainFacultyId": ""
  },
  {
    "_id": "69d7806078fd5ea69a98766d",
    "courseId": 15,
    "program": "B.Tech",
    "courseType": "Honours",
    "year": "III",
    "subjectCode": "NEW3003",
    "subjectName": "Data Analytics and Visualization",
    "shortName": "DA&V",
    "L": 3,
    "T": 0,
    "P": 0,
    "C": 3,
    "mainFacultyId": ""
  },
  {
    "_id": "69d7806078fd5ea69a98766e",
    "courseId": 16,
    "program": "B.Tech",
    "courseType": "Honours",
    "year": "III",
    "subjectCode": "NEW3004",
    "subjectName": "API Security and Authentication",
    "shortName": "API Sec",
    "L": 3,
    "T": 0,
    "P": 0,
    "C": 3,
    "mainFacultyId": ""
  },
  {
    "_id": "69d7806078fd5ea69a98766f",
    "courseId": 17,
    "program": "B.Tech",
    "courseType": "Minors",
    "year": "III",
    "subjectCode": "22CS903",
    "subjectName": "Database Management Systems",
    "shortName": "DBMS",
    "L": 3,
    "T": 0,
    "P": 0,
    "C": 3,
    "mainFacultyId": ""
  },
  {
    "_id": "69d7806078fd5ea69a987670",
    "courseId": 18,
    "program": "B.Tech",
    "courseType": "Mandatory",
    "year": "IV",
    "subjectCode": "22CS406",
    "subjectName": "Privacy Preserving and Intrusion Detection",
    "shortName": "Privacy",
    "L": 3,
    "T": 1,
    "P": 0,
    "C": 4,
    "mainFacultyId": ""
  },
  {
    "_id": "69d7806078fd5ea69a987671",
    "courseId": 19,
    "program": "B.Tech",
    "courseType": "Mandatory",
    "year": "IV",
    "subjectCode": "22CS402",
    "subjectName": "Big Data Analytics",
    "shortName": "BDA",
    "L": 3,
    "T": 0,
    "P": 2,
    "C": 4,
    "mainFacultyId": ""
  },
  {
    "_id": "69d7806078fd5ea69a987672",
    "courseId": 20,
    "program": "B.Tech",
    "courseType": "Mandatory",
    "year": "IV",
    "subjectCode": "22CS403",
    "subjectName": "Cloud Computing",
    "shortName": "Cloud",
    "L": 3,
    "T": 0,
    "P": 2,
    "C": 4,
    "mainFacultyId": ""
  },
  {
    "_id": "69d7806078fd5ea69a987673",
    "courseId": 21,
    "program": "B.Tech",
    "courseType": "Mandatory",
    "year": "IV",
    "subjectCode": "22CS310",
    "subjectName": "Computing Ethics",
    "shortName": "Ethics",
    "L": 2,
    "T": 0,
    "P": 0,
    "C": 2,
    "mainFacultyId": ""
  },
  {
    "_id": "69d7806078fd5ea69a987674",
    "courseId": 22,
    "program": "B.Tech",
    "courseType": "Department Elective",
    "year": "IV",
    "subjectCode": "NEW4001",
    "subjectName": "MLOps",
    "shortName": "MLOps",
    "L": 3,
    "T": 0,
    "P": 0,
    "C": 3,
    "mainFacultyId": ""
  },
  {
    "_id": "69d7806078fd5ea69a987675",
    "courseId": 23,
    "program": "B.Tech",
    "courseType": "Department Elective",
    "year": "IV",
    "subjectCode": "NEW4002",
    "subjectName": "Natural Language Processing",
    "shortName": "NLP",
    "L": 3,
    "T": 0,
    "P": 0,
    "C": 3,
    "mainFacultyId": ""
  },
  {
    "_id": "69d7806078fd5ea69a987676",
    "courseId": 24,
    "program": "B.Tech",
    "courseType": "Honours",
    "year": "IV",
    "subjectCode": "22CS959",
    "subjectName": "Agentic AI",
    "shortName": "AgentAI",
    "L": 3,
    "T": 0,
    "P": 0,
    "C": 3,
    "mainFacultyId": ""
  },
  {
    "_id": "69d7806078fd5ea69a987677",
    "courseId": 25,
    "program": "B.Tech",
    "courseType": "Minors",
    "year": "IV",
    "subjectCode": "22CS907",
    "subjectName": "Operating Systems and Shell Programming",
    "shortName": "OSSP",
    "L": 3,
    "T": 0,
    "P": 0,
    "C": 3,
    "mainFacultyId": ""
  }
];

const EXPORTED_WORKLOADS = [];

const EXPORTED_SUBMISSIONS = [];

const EXPORTED_ALLOCATIONS = [];

const EXPORTED_SETTINGS = [
  {
    "_id": "699f2192cc16e6df564e3698",
    "key": "form_enabled",
    "value": "true"
  },
  {
    "_id": "69a142fbcc16e6df564e43d6",
    "key": "edit_enabled",
    "value": "false"
  },
  {
    "_id": "69a66fa4cc16e6df564e638f",
    "key": "sections_config",
    "value": "{\"I\":[\"1\",\"2\",\"3\",\"4\",\"5\",\"6\",\"7\",\"8\",\"9\",\"10\",\"11\",\"12\",\"13\",\"14\",\"15\",\"16\",\"17\",\"18\",\"19\"],\"II\":[\"1\",\"2\",\"3\",\"4\",\"5\",\"6\",\"7\",\"8\",\"9\",\"10\",\"11\",\"12\",\"13\",\"14\",\"15\",\"16\",\"17\",\"18\",\"19\",\"20\",\"21\",\"22\"],\"III\":[\"1\",\"2\",\"3\",\"4\",\"5\",\"6\",\"7\",\"8\",\"9\",\"10\",\"11\",\"12\",\"13\",\"14\",\"15\",\"16\",\"17\",\"18\",\"19\"],\"IV\":[\"1\",\"2\",\"3\",\"4\",\"5\",\"6\",\"7\",\"8\",\"9\"],\"M.Tech\":[\"1\",\"2\"]}"
  }
];

const EXPORTED_AUDIT_LOGS = [
  {
    "_id": "69d8919405d00ed7d542c6dc",
    "actorEmpId": "231fa04860",
    "actorRole": "admin",
    "action": "submission.delete",
    "entity": "submission",
    "entityId": "69d86abe557664770bc6d172",
    "metadata": {
      "empId": "189"
    },
    "ip": "::1",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0"
  },
  {
    "_id": "69d890db05d00ed7d542c5cb",
    "actorEmpId": "231fa04860",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "02834",
    "metadata": {
      "fields": [
        "name",
        "designation",
        "mobile",
        "email",
        "department",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "::1",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0"
  },
  {
    "_id": "69d88f6c05d00ed7d542c4ab",
    "actorEmpId": "system",
    "actorRole": "system",
    "action": "auth.login.success",
    "entity": "user",
    "entityId": "231fa04860",
    "metadata": {
      "ip": "::1"
    },
    "ip": "::1",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0"
  },
  {
    "_id": "69d88ec705d00ed7d542c4a7",
    "actorEmpId": "system",
    "actorRole": "system",
    "action": "auth.login.failed",
    "entity": "user",
    "entityId": "231fa04860",
    "metadata": {
      "reason": "user-not-found"
    },
    "ip": "::1",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0"
  },
  {
    "_id": "69d88eac05d00ed7d542c4a4",
    "actorEmpId": "system",
    "actorRole": "system",
    "action": "auth.login.failed",
    "entity": "user",
    "entityId": "231FA04860",
    "metadata": {
      "reason": "user-not-found"
    },
    "ip": "::1",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0"
  },
  {
    "_id": "69d88e7dd680ccd4d4e58624",
    "actorEmpId": "system",
    "actorRole": "system",
    "action": "auth.login.failed",
    "entity": "user",
    "entityId": "231FA04860",
    "metadata": {
      "reason": "user-not-found"
    },
    "ip": "::1",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0"
  },
  {
    "_id": "69d88e77d680ccd4d4e58621",
    "actorEmpId": "system",
    "actorRole": "system",
    "action": "auth.login.failed",
    "entity": "user",
    "entityId": "231fa04860",
    "metadata": {
      "reason": "user-not-found"
    },
    "ip": "::1",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0"
  },
  {
    "_id": "69d88c68d680ccd4d4e5861e",
    "actorEmpId": "system",
    "actorRole": "system",
    "action": "auth.login.failed",
    "entity": "user",
    "entityId": "189",
    "metadata": {
      "reason": "invalid-password",
      "failedAttempts": 1,
      "lockUntil": null
    },
    "ip": "::1",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Edg/146.0.0.0"
  },
  {
    "_id": "69d88371f3910f07e3b9902b",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "01350",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.16.31.65",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d88371f3910f07e3b99029",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "02290",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.16.31.65",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d88371f3910f07e3b99025",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "02507",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.16.31.65",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d88370f3910f07e3b99022",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "02843",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.16.31.65",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d88370f3910f07e3b9901f",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "31179",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.16.31.65",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d88370f3910f07e3b9901d",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "01976",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.16.31.65",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836ff3910f07e3b9901a",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "01201",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.16.31.65",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836ff3910f07e3b99016",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "02804",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.18.196.196",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836ff3910f07e3b99014",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "02506",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.16.31.65",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836ff3910f07e3b99012",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "01429",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.18.196.196",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836ff3910f07e3b99010",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "03096",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.18.196.196",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836ff3910f07e3b9900e",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "02290",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.18.196.196",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836ff3910f07e3b9900c",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "163",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.18.196.196",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836ff3910f07e3b99006",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "646",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.16.31.65",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836ff3910f07e3b99002",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "01920",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.18.196.196",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836ff3910f07e3b99000",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "01350",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.16.31.65",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836ef3910f07e3b98ffe",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "01919",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.16.31.65",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836ef3910f07e3b98ffb",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "01988",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.18.196.196",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836ef3910f07e3b98ff9",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "02209",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.22.160.195",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836ef3910f07e3b98ff7",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "02394",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.16.31.65",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836ef3910f07e3b98ff5",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "02696",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.18.196.196",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836ef3910f07e3b98ff3",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "02683",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.22.160.195",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836ef3910f07e3b98ff1",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "02507",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.16.31.65",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836ef3910f07e3b98fed",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "02751",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.18.166.2",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836ef3910f07e3b98feb",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "02754",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.18.166.2",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836ef3910f07e3b98fe9",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "02722",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.16.31.65",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836df3910f07e3b98fdd",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "02318",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.18.166.2",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836df3910f07e3b98fdb",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "02342",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.16.31.65",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836df3910f07e3b98fd9",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "675",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.16.31.65",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836df3910f07e3b98fd7",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "189",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": true
    },
    "ip": "10.18.166.2",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836df3910f07e3b98fd5",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "02462",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.18.166.2",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836df3910f07e3b98fd3",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "714",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.22.160.195",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836df3910f07e3b98fd1",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "613",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.18.196.196",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836df3910f07e3b98fcf",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "01702",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.18.196.196",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836df3910f07e3b98fcd",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "00689",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.18.166.2",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836df3910f07e3b98fcb",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "30071",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.18.166.2",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836df3910f07e3b98fc9",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "01905",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.18.196.196",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836cf3910f07e3b98fc7",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "02493",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.22.160.195",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836cf3910f07e3b98fc5",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "02468",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.18.166.2",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836cf3910f07e3b98fc3",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "02495",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.18.166.2",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836cf3910f07e3b98fc1",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "02744",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.18.166.2",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836cf3910f07e3b98fbf",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "02770",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.18.196.196",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836cf3910f07e3b98fbd",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "02745",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.22.160.195",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836cf3910f07e3b98fbb",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "01989",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.18.196.196",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836cf3910f07e3b98fb9",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "02396",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.18.196.196",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836cf3910f07e3b98fb7",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "02480",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.18.196.196",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836cf3910f07e3b98fb5",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "02961",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.16.31.65",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836cf3910f07e3b98fb3",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "02181",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.16.31.65",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836cf3910f07e3b98fb1",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "02829",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.16.31.65",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836cf3910f07e3b98faf",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "03055",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.18.166.2",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836cf3910f07e3b98fad",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "03045",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.18.196.196",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836cf3910f07e3b98fab",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "02194",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.22.160.195",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836cf3910f07e3b98fa9",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "03102",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.18.166.2",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836cf3910f07e3b98fa7",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "03059",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.18.166.2",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836cf3910f07e3b98fa5",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "30912",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.18.166.2",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836cf3910f07e3b98fa3",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "30911",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.22.160.195",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836cf3910f07e3b98fa1",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "31044",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.18.196.196",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836bf3910f07e3b98f9f",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "31074",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.18.166.2",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836bf3910f07e3b98f9d",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "31076",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.18.196.196",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836bf3910f07e3b98f9b",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "31077",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.22.160.195",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836bf3910f07e3b98f99",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "31075",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.16.31.65",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836bf3910f07e3b98f97",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "31087",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.18.196.196",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836bf3910f07e3b98f95",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "31088",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.18.166.2",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836bf3910f07e3b98f93",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "31101",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.18.196.196",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836bf3910f07e3b98f91",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "31093",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.22.160.195",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836bf3910f07e3b98f8e",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "31104",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.18.166.2",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836bf3910f07e3b98f8b",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "31102",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.16.31.65",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836bf3910f07e3b98f87",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "02900",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.16.31.65",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836bf3910f07e3b98f85",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "31169",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.18.166.2",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836bf3910f07e3b98f83",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "31108",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.22.160.195",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836bf3910f07e3b98f7f",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "31170",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.22.160.195",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836bf3910f07e3b98f7c",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "31172",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.18.166.2",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836bf3910f07e3b98f7a",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "31181",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.22.160.195",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836bf3910f07e3b98f78",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "31203",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.18.166.2",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836bf3910f07e3b98f76",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "31224",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.16.31.65",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836bf3910f07e3b98f70",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "31226",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.22.160.195",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836bf3910f07e3b98f6e",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "02913",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.18.166.2",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836bf3910f07e3b98f6c",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "30564",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.22.160.195",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836af3910f07e3b98f6a",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "31171",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.18.196.196",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836af3910f07e3b98f68",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "03082",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.22.160.195",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836af3910f07e3b98f61",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "00760",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.22.160.195",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836af3910f07e3b98f5c",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "31182",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.22.160.195",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836af3910f07e3b98f5a",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "02842",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.22.160.195",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836af3910f07e3b98f58",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "31178",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.18.166.2",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836af3910f07e3b98f56",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "30910",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.18.196.196",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836af3910f07e3b98f54",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "03099",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.18.196.196",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836af3910f07e3b98f52",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "31180",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.18.166.2",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836af3910f07e3b98f4f",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "03135",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.22.160.195",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836af3910f07e3b98f4d",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "03188",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.16.31.65",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836af3910f07e3b98f4b",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "03244",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.18.196.196",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836af3910f07e3b98f48",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "03261",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.22.160.195",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  },
  {
    "_id": "69d8836af3910f07e3b98f46",
    "actorEmpId": "189",
    "actorRole": "admin",
    "action": "faculty.update",
    "entity": "faculty",
    "entityId": "31208",
    "metadata": {
      "fields": [
        "slNo",
        "updatedAt"
      ],
      "isSelfEdit": false
    },
    "ip": "10.22.160.195",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
  }
];

// ────────────────────────────────────────────────────────────
// Seed Function
// ────────────────────────────────────────────────────────────

const seedDatabase = async () => {
  try {
    console.log('🌱 Importing production data from exported collections...\n');

    // Connect to database
    await connect();
    console.log('✅ Connected to MongoDB\n');

    // ── USERS ──────────────────────────────────────────────
    console.log('👤 Importing users...');
    let usersCreated = 0;
    for (const user of EXPORTED_USERS) {
      const exists = await User.findOne({ empId: user.empId });
      if (!exists) {
        // Ensure password is hashed
        const passwordHash = user.passwordHash || bcrypt.hashSync('password123', 10);
        await User.create({
          ...user,
          passwordHash
        });
        usersCreated++;
      }
    }
    if (usersCreated > 0) {
      console.log(`   ✅ ${usersCreated} users imported\n`);
    } else {
      console.log('   ⏭️  All users already exist\n');
    }

    // ── FACULTY ────────────────────────────────────────────
    console.log('👥 Importing faculty...');
    let facultyCreated = 0;
    for (const fac of EXPORTED_FACULTY) {
      const exists = await Faculty.findOne({ empId: fac.empId });
      if (!exists) {
        await Faculty.create(fac);
        facultyCreated++;
      }
    }
    if (facultyCreated > 0) {
      console.log(`   ✅ ${facultyCreated} faculty records imported\n`);
    } else {
      console.log('   ⏭️  Faculty records already exist\n');
    }

    // ── COURSES ────────────────────────────────────────────
    console.log('📖 Importing courses...');
    let coursesCreated = 0;
    for (const course of EXPORTED_COURSES) {
      const exists = await Course.findOne({ courseId: course.courseId });
      if (!exists) {
        await Course.create(course);
        coursesCreated++;
      }
    }
    if (coursesCreated > 0) {
      console.log(`   ✅ ${coursesCreated} courses imported\n`);
    } else {
      console.log('   ⏭️  Courses already exist\n');
    }

    // ── WORKLOADS ──────────────────────────────────────────
    console.log('💼 Importing workloads...');
    let workloadsCreated = 0;
    for (const workload of EXPORTED_WORKLOADS) {
      const exists = await Workload.findOne({
        empId: workload.empId,
        academicYearStart: workload.academicYearStart,
        semester: workload.semester
      });
      if (!exists) {
        await Workload.create(workload);
        workloadsCreated++;
      }
    }
    if (workloadsCreated > 0) {
      console.log(`   ✅ ${workloadsCreated} workloads imported\n`);
    } else {
      console.log('   ⏭️  Workloads already exist\n');
    }

    // ── SUBMISSIONS ────────────────────────────────────────
    console.log('📤 Importing submissions...');
    let submissionsCreated = 0;
    for (const submission of EXPORTED_SUBMISSIONS) {
      const exists = await Submission.findOne({ _id: submission._id });
      if (!exists) {
        await Submission.create(submission);
        submissionsCreated++;
      }
    }
    if (submissionsCreated > 0) {
      console.log(`   ✅ ${submissionsCreated} submissions imported\n`);
    }

    // ── SETTINGS ───────────────────────────────────────────
    console.log('⚙️  Importing settings...');
    let settingsCreated = 0;
    for (const setting of EXPORTED_SETTINGS) {
      const exists = await Setting.findOne({ key: setting.key });
      if (!exists) {
        await Setting.create(setting);
        settingsCreated++;
      }
    }
    if (settingsCreated > 0) {
      console.log(`   ✅ ${settingsCreated} settings imported\n`);
    } else {
      console.log('   ⏭️  Settings already exist\n');
    }

    // ── ALLOCATIONS ────────────────────────────────────────
    if (EXPORTED_ALLOCATIONS && EXPORTED_ALLOCATIONS.length > 0) {
      console.log('📋 Importing allocations...');
      let allocationsCreated = 0;
      for (const allocation of EXPORTED_ALLOCATIONS) {
        const exists = await CourseAllocation.findById(allocation._id);
        if (!exists) {
          await CourseAllocation.create(allocation);
          allocationsCreated++;
        }
      }
      if (allocationsCreated > 0) {
        console.log(`   ✅ ${allocationsCreated} allocations imported\n`);
      }
    }

    // ── SUCCESS MESSAGE ────────────────────────────────────
    console.log('═'.repeat(60));
    console.log('🎉 Production data import completed!');
    console.log('═'.repeat(60));
    console.log('\n📊 Import Summary:');
    console.log(`   - Users: ${EXPORTED_USERS.length}`);
    console.log(`   - Faculty: ${EXPORTED_FACULTY.length}`);
    console.log(`   - Courses: ${EXPORTED_COURSES.length}`);
    console.log(`   - Workloads: ${EXPORTED_WORKLOADS.length}`);
    console.log(`   - Submissions: ${EXPORTED_SUBMISSIONS.length}`);
    console.log(`   - Settings: ${EXPORTED_SETTINGS.length}`);
    console.log(`   - Allocations: ${EXPORTED_ALLOCATIONS.length}`);
    console.log('\n🚀 Production ready for deployment!\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Import failed:', error.message);
    console.error(error);
    process.exit(1);
  }
};

// Run seed
seedDatabase();
