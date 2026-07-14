import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { validarMesaToken } from "../_shared/mesa.ts";
import { getUserFromRequest } from "../_shared/auth.ts";
import { filtrarTexto } from "../_shared/content_filter.ts";
import { createServiceClient } from "../_shared/supabase.ts";

function normalizarNombre(nombre: string): string {
  return nombre.trim().toLowerCase().replace(/\s+/g, " ");
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const body = await req.json();
    const mesa = await validarMesaToken(Number(body.numero_mesa), String(body.token));
    const user = await getUserFromRequest(req);
    const nombreCliente = filtrarTexto(String(body.nombre_cliente), "nombre");
    const nombreNorm = normalizarNombre(nombreCliente);

    if (nombreNorm.length < 2) {
      return errorResponse("nombre_invalido", "Nombre muy corto.", 400);
    }

    const supabase = createServiceClient();

    // Una visita por nombre + mesa por día (evita duplicados al recargar)
    const inicioDia = new Date();
    inicioDia.setHours(0, 0, 0, 0);

    const { data: existente } = await supabase
      .from("visitas_clientes")
      .select("id")
      .eq("nombre_norm", nombreNorm)
      .eq("mesa_id", mesa.id)
      .gte("creado_en", inicioDia.toISOString())
      .maybeSingle();

    if (existente) {
      return jsonResponse({ registrado: false, mensaje: "Visita ya registrada hoy" });
    }

    const { data: visita, error } = await supabase
      .from("visitas_clientes")
      .insert({
        nombre_cliente: nombreCliente,
        nombre_norm: nombreNorm,
        mesa_id: mesa.id,
        user_id: user?.id ?? null,
      })
      .select("id, creado_en")
      .single();

    if (error) throw error;

    const { count } = await supabase
      .from("visitas_clientes")
      .select("id", { count: "exact", head: true })
      .eq("nombre_norm", nombreNorm);

    return jsonResponse({
      registrado: true,
      visita_id: visita.id,
      creado_en: visita.creado_en,
      total_visitas: count ?? 1,
      es_frecuente: (count ?? 1) >= 2,
    }, 201);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    if (msg.startsWith("contenido_no_permitido")) {
      return errorResponse("contenido_no_permitido", "Nombre no permitido.", 422);
    }
    if (msg === "token_invalido") return errorResponse(msg, "Token inválido.", 403);
    if (msg === "mesa_no_encontrada") return errorResponse(msg, "Mesa no encontrada.", 404);
    return errorResponse("error", "Error al registrar visita.", 500);
  }
});
