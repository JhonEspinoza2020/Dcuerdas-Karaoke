import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { MesaPage } from "./cliente/pages/MesaPage";
import { BoxPage } from "./cliente/pages/BoxPage";
import { AdminApp } from "./admin/AdminApp";
import { Landing } from "./Landing";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/mesa/:numero" element={<MesaPage />} />
        <Route path="/box/:numero" element={<BoxPage />} />
        <Route path="/admin" element={<AdminApp />} />
        <Route path="*" element={<Landing />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
