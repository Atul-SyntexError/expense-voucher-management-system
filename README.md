# ExpenseFlow — Expense Voucher Management System

[![Live Demo](https://img.shields.io/badge/demo-live-2f7d4a?logo=render&logoColor=white)](https://expense-voucher-management-system-45gx.onrender.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=111)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

> A focused workflow for creating, reviewing, and tracking employee expense reimbursements.

**Live demo:** [expense-voucher-management-system-45gx.onrender.com](https://expense-voucher-management-system-45gx.onrender.com)

ExpenseFlow is a role-based expense voucher application for ABC Company. Employees create and track requests, the Director reviews them, and the Accounts team monitors approved expenses for reimbursement.

## Project highlights

- Clean role-based workflow from draft to reimbursement-ready approval
- Responsive dashboard designed for everyday finance operations
- Validation at both the interface and API layers
- Simple local setup that can be moved to PostgreSQL and object storage for production

## Features

- JWT login with Employee, Director, and Accounts roles
- Employee-only draft creation, editing, deletion, signature, and submission
- Director approval/rejection workflow with required signature or rejection reason
- Role-based voucher visibility and protected API routes
- Dashboard statistics, status badges, voucher detail views, and responsive layout
- Search-ready voucher API and signature upload endpoint
- JSON persistence for a zero-configuration local demo

## Setup

Requirements: Node.js 18 or newer.

```bash
npm install
npm run dev
```

The frontend opens at `http://localhost:5173` and the API runs at `http://localhost:4000`.

### Demo accounts

All demo accounts use the password `password`.

| Role | Email |
| --- | --- |
| Employee | employee@abc.com |
| Director | director@abc.com |
| Accounts | accounts@abc.com |

Set `JWT_SECRET` and `PORT` in a local `.env` file when deploying. `.env.example` contains the available settings.

## Data model

The demo uses `server/data.json` as a small local datastore. The `users` collection stores role and profile information. The `vouchers` collection stores the voucher number, expense fields, employee/director signatures, workflow status, rejection reason, and audit timestamps. In a production deployment this maps directly to `users` and `expense_vouchers` relational tables, with `employee_id` as a foreign key and an index on `status`.

## API

All protected endpoints expect `Authorization: Bearer <token>`.

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/auth/login` | Authenticate a user |
| GET | `/api/auth/me` | Return the current user |
| GET | `/api/vouchers` | List vouchers visible to the current role; supports `search`, `status`, `category`, `department` |
| GET | `/api/vouchers/:id` | View one voucher |
| POST | `/api/vouchers` | Create an employee draft |
| PUT | `/api/vouchers/:id` | Edit an employee draft |
| DELETE | `/api/vouchers/:id` | Delete an employee draft |
| POST | `/api/vouchers/:id/submit` | Submit a draft for approval |
| POST | `/api/vouchers/:id/approve` | Approve with `directorSignature` |
| POST | `/api/vouchers/:id/reject` | Reject with `rejectionReason` |
| POST | `/api/uploads` | Upload an image as `signature` multipart form data |

## Workflow assumptions

1. A new voucher is created as `Draft`; only the employee who created it can change it.
2. Submission requires an employee signature and moves the voucher to `Pending Approval`.
3. Only the Director can approve or reject pending vouchers.
4. Approval requires a Director signature; rejection requires a reason.
5. The Accounts role can view all vouchers but cannot change their workflow state.
6. The JSON store is intended for evaluation and local demonstration. A hosted deployment should use PostgreSQL, object storage for signatures, and a managed secret.
