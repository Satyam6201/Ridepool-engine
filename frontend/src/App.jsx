import React from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";

function Home() {
  return (
    <main style={{ padding: "1.5rem" }}>
      <h2>Ride Dispatch</h2>
      <p>Pool dispatch service running.</p>
    </main>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <header style={{ padding: "1rem", background: "#111827", color: "#fff" }}>
        <Link to="/" style={{ color: "#fff", textDecoration: "none" }}>
          Uber Pool Dispatch
        </Link>
      </header>
      <Routes>
        <Route path="/" element={<Home />} />
      </Routes>
    </BrowserRouter>
  );
}
