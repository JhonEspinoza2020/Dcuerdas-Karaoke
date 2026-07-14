import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { verifyAdminAuth } from "../_shared/auth.ts";
import { createServiceClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const url = new URL(req.url);
    const recurso = url.searchParams.get("recurso") ?? "categorias";
    const supabase = createServiceClient();

    if (req.method === "GET" && recurso === "categorias") {
      const { data, error } = await supabase
        .from("categorias_carta")
        .select("*")
        .order("orden");
      if (error) throw error;
      return jsonResponse(data);
    }

    if (req.method === "GET" && recurso === "platos") {
      const { data, error } = await supabase
        .from("platos")
        .select("*")
        .order("categoria_id")
        .order("orden");
      if (error) throw error;
      return jsonResponse(data);
    }

    await verifyAdminAuth(req);
    const body = req.method !== "GET" ? await req.json() : null;

    if (req.method === "POST" && recurso === "categorias") {
      const { data, error } = await supabase
        .from("categorias_carta")
        .insert(body)
        .select()
        .single();
      if (error) throw error;
      return jsonResponse(data, 201);
    }

    if (req.method === "PATCH" && recurso === "categorias") {
      const { id, ...updates } = body;
      const { data, error } = await supabase
        .from("categorias_carta")
        .update({ ...updates, actualizado_en: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return jsonResponse(data);
    }

    if (req.method === "POST" && recurso === "platos") {
      const { data, error } = await supabase
        .from("platos")
        .insert(body)
        .select()
        .single();
      if (error) throw error;
      return jsonResponse(data, 201);
    }

    if (req.method === "PATCH" && recurso === "platos") {
      const { id, ...updates } = body;
      const { data, error } = await supabase
        .from("platos")
        .update({ ...updates, actualizado_en: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return jsonResponse(data);
    }

    return errorResponse("ruta_invalida", "Recurso o método no soportado.", 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    if (msg === "admin_no_autorizado") return errorResponse(msg, "No autorizado.", 403);
    return errorResponse("error", "Error en carta.", 500);
  }
});
