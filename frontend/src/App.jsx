import React from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";

function Home() {
  return (
    <div style={{ padding: "2rem" }}>
      <h1>Ride Dispatch Platform</h1>
      <p>System operational. Microservice dispatch and pooling platform.</p>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <nav style={{ padding: "1rem", backgroundColor: "#1f2937", color: "#ffffff" }}>
        <Link to="/" style={{ color: "#ffffff", textDecoration: "none", fontWeight: "bold" }}>
          Pool Dispatch
        </Link>
      </nav>
      <Routes>
        <Route path="/" element={<Home />} />
      </Routes>
    </BrowserRouter>
  );
}
