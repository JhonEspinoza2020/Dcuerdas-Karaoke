import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { verifyAdminAuth } from "../_shared/auth.ts";
import { createServiceClient } from "../_shared/supabase.ts";

const ESTADOS_VALIDOS = ["pendiente", "en_preparacion", "listo", "entregado", "cancelado"];

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    await verifyAdminAuth(req);
    const supabase = createServiceClient();

    if (req.method === "GET" || req.method === "POST") {
      const { data, error } = await supabase
        .from("pedidos")
        .select("*, mesas(numero_mesa, etiqueta, tipo), pedido_items(*)")
        .in("estado", ["pendiente", "en_preparacion", "listo"])
        .order("creado_en", { ascending: true });

      if (error) throw error;

      const pedidos = (data ?? []).map((p) => {
        const mesa = p.mesas as { numero_mesa: number; etiqueta: string | null; tipo: string } | null;
        const zona = mesa?.etiqueta ?? (mesa?.tipo === "karaoke" ? "Box Karaoke" : `Mesa ${mesa?.numero_mesa}`);
        return {
          id: p.id,
          nombre_cliente: p.nombre_cliente,
          zona,
          num_personas: p.num_personas,
          nota_cocina: p.nota_cocina,
          telefono: p.telefono,
          estado: p.estado,
          creado_en: p.creado_en,
          items: p.pedido_items ?? [],
        };
      });

      return jsonResponse(pedidos);
    }

    if (req.method === "PATCH") {
      const { pedido_id, estado } = await req.json();
      if (!ESTADOS_VALIDOS.includes(estado)) {
        return errorResponse("estado_invalido", "Estado no válido.", 400);
      }

      const { data, error } = await supabase
        .from("pedidos")
        .update({ estado })
        .eq("id", Number(pedido_id))
        .select("id, estado")
        .single();

      if (error) throw error;
      return jsonResponse(data);
    }

    return errorResponse("metodo_no_soportado", "Método no soportado.", 405);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    if (msg === "admin_no_autorizado") return errorResponse(msg, "No autorizado.", 403);
    return errorResponse("error", "Error en pedidos.", 500);
  }
});
