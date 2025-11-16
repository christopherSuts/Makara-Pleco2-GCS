// components/ClientToastContainer.jsx
"use client";
import { ToastContainer } from "react-toastify";

export default function ClientToastContainer() {
  return (
    <ToastContainer
      position="bottom-right"
      newestOnTop
      autoClose={3000}
      closeOnClick
      pauseOnFocusLoss
      pauseOnHover
      theme="dark"
    />
  );
}
