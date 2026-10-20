import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { verifyAdminAuth } from "../_shared/auth.ts";
import { createServiceClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    await verifyAdminAuth(req);
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from("cola_reproduccion")
      .select("*, mesas(numero_mesa, tipo, etiqueta)")
      .in("estado", ["pendiente", "reproduciendo"]);

    if (error) throw error;

    const filas = [...(data ?? [])].sort((a, b) => {
      const ra = a.estado === "reproduciendo" ? 0 : 1;
      const rb = b.estado === "reproduciendo" ? 0 : 1;
      if (ra !== rb) return ra - rb;
      const ao = Number(a.orden);
      const bo = Number(b.orden);
      const aOk = Number.isFinite(ao) ? ao : Number.MAX_SAFE_INTEGER;
      const bOk = Number.isFinite(bo) ? bo : Number.MAX_SAFE_INTEGER;
      if (aOk !== bOk) return aOk - bOk;
      return new Date(a.creado_en).getTime() - new Date(b.creado_en).getTime();
    });

    const canciones = filas.map((c, idx) => {
      const tipo = c.mesas?.tipo ?? "mesa";
      const esLocal = tipo === "local";
      return {
        id: c.id,
        mesa_id: c.mesa_id,
        numero_mesa: c.mesas?.numero_mesa,
        tipo,
        etiqueta: esLocal
          ? "Local"
          : (c.mesas?.etiqueta ?? `Mesa ${c.mesas?.numero_mesa}`),
        youtube_video_id: c.youtube_video_id,
        titulo_cancion: c.titulo_cancion,
        nombre_cliente: c.nombre_cliente,
        saludo: c.saludo,
        saludo_momento: c.saludo_momento ?? "inicio",
        estado: c.estado,
        creado_en: c.creado_en,
        posicion: idx + 1,
      };
    });

    return jsonResponse(canciones);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    if (msg === "admin_no_autorizado") return errorResponse(msg, "No autorizado.", 403);
    return errorResponse("error", "Error al obtener cola.", 500);
  }
});
