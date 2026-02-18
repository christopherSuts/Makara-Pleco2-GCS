# Makara-Pleco2-GCS

This repository contains the Ground Control Station (GCS) and middleware for the Makara-Pleco2 autonomous surface vehicle project.

## Project Structure

The project is divided into two main components:

- **`backend/`**: Contains the Python middleware that bridges MAVLink communication between the vehicle (or `mavlink-router`) and the frontend.
    - `middleware-Arch1.py`: Middleware for Architecture 1 (Ground-Based).
    - `middleware-Arch2.py`: Middleware for Architecture 2 (Edge-Based / Onboard).
- **`frontend/`**: A Next.js web application that serves as the operator interface.

## Prerequisites

- **Network Configuration**:
    - **GCS IP**: `10.10.10.2/24` (Static)
    - **Jetson (Vehicle) IP**: `10.10.10.3/24` (Static)
- **Software**:
    - **Python 3.8+** (for backend)
    - **Node.js 18+ & npm** (for frontend)
    - **mavlink-router** (installed on the Jetson for Architecture 1)
- **Jetson Orin NX Password**: AMVUIjuara1!

## Installation

### 1. Clone the Repository

Ensure you confirm which architecture branch/folder you are using, but generally:

```bash
git clone https://github.com/christopherSuts/Makara-Pleco2-GCS.git
cd Makara-Pleco2-GCS
```

### 2. Backend Setup

Navigate to the `backend` directory and set up the Python environment.

```bash
cd backend
# Create/Activate virtual environment if needed, or install deps globally
pip install fastapi uvicorn pymavlink
```

### 3. Frontend Setup

Navigate to the `frontend` directory and install Node.js dependencies.

```bash
cd frontend
npm install
```

---

## Running the System

There are two supported architectures. Choose the one corresponding to your deployment.

### Architecture 1: Ground-Based Middleware

In this setup, `mavlink-router` on the Jetson forwards MAVLink packets to the GCS, where the middleware runs locally on your laptop/PC.

**Terminal 1 (GCS - Middleware):**
```bash
cd backend
python3 middleware-Arch1.py
```

**Terminal 2 (GCS - Frontend):**
```bash
cd frontend
npm run dev:pymavlink
```

**Terminal 3 (SSH to Jetson - MAVLink Router):**
```bash
ssh amv-onboard@10.10.10.3
# Run mavlink-routerd (ensure config points to GCS IP 10.10.10.2:14555)
sudo mavlink-routerd -c /etc/mavlink-router/main.conf -v
```
*Note: You may want to run this in a `screen` session.*

---

### Architecture 2: Edge-Based Middleware

In this setup, the middleware runs directly on the Jetson (Edge), and the frontend connects to it.

**Terminal 1 (GCS - Frontend):**
```bash
cd frontend
npm run dev:pymavlink
```

**Terminal 2 (SSH to Jetson - Middleware):**
```bash
ssh amv-onboard@10.10.10.3
cd Makara-Pleco2-GCS/backend  # Adjust path to where you cloned the repo on Jetson
python3 middleware-Arch2.py
```
*Note: You may want to run this in a `screen` session.*

---

## Accessing the GCS

Open your web browser and navigate to:

[http://localhost:3000](http://localhost:3000)

## Notes

- **Logs**:
    - Architecture 1: Logs are generated where `middleware-Arch1.py` runs.
    - Architecture 2: Logs are generated on the Jetson in the `backend` directory.
- **Troubleshooting**:
    - If the frontend does not show data, check that the middleware is receiving MAVLink packets (it prints "MAVLink listener at..." and stats to the console).
    - Ensure firewalls allow UDP traffic on ports `14555` (Arch 1 mcast/udp) or the configured serial ports (Arch 2).
