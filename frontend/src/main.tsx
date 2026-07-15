import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { MesaPage } from "./cliente/pages/MesaPage";
import { AdminApp } from "./admin/AdminApp";
import { Landing } from "./Landing";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/mesa/:numero" element={<MesaPage />} />
        <Route path="/admin" element={<AdminApp />} />
        <Route path="*" element={<Landing />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
