import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { verifyAdminAuth } from "../_shared/auth.ts";
import { createServiceClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "PATCH") {
    return errorResponse("metodo_no_permitido", "Usa PATCH.", 405);
  }

  try {
    await verifyAdminAuth(req);
    const body = await req.json();
    const { cancion_id, estado, mover, orden_ids } = body;

    if (Array.isArray(orden_ids)) {
      const supabase = createServiceClient();
      const ids = [...new Set(
        orden_ids
          .map((valor: unknown) => Number(valor))
          .filter((n: number) => Number.isInteger(n) && n > 0),
      )];
      const { data, error } = await supabase
        .from("cola_reproduccion")
        .select("id")
        .eq("estado", "pendiente");
      if (error) throw error;
      const actuales = new Set((data ?? []).map((row) => row.id as number));
      const mismos = ids.length === actuales.size && ids.every((id) => actuales.has(id));
      if (!mismos) {
        return errorResponse("orden_invalido", "La cola cambió. Vuelve a intentar.", 409);
      }
      const { data: sonando } = await supabase
        .from("cola_reproduccion")
        .select("orden")
        .eq("estado", "reproduciendo")
        .limit(1)
        .maybeSingle();
      const piso = Number(sonando?.orden);
      const inicio = Number.isFinite(piso) ? piso : 0;
      for (let i = 0; i < ids.length; i++) {
        const { error: upErr } = await supabase
          .from("cola_reproduccion")
          .update({ orden: inicio + i + 1 })
          .eq("id", ids[i])
          .eq("estado", "pendiente");
        if (upErr) throw upErr;
      }
      return jsonResponse({ ok: true, cambio: true });
    }

    if (mover === "arriba" || mover === "abajo") {
      const supabase = createServiceClient();
      const { data, error } = await supabase
        .from("cola_reproduccion")
        .select("id, orden, creado_en")
        .eq("estado", "pendiente");
      if (error) throw error;

      const lista = [...(data ?? [])].sort((a, b) => {
        const ao = typeof a.orden === "number" ? a.orden : Number.MAX_SAFE_INTEGER;
        const bo = typeof b.orden === "number" ? b.orden : Number.MAX_SAFE_INTEGER;
        if (ao !== bo) return ao - bo;
        return new Date(a.creado_en).getTime() - new Date(b.creado_en).getTime();
      });
      const i = lista.findIndex((row) => row.id === Number(cancion_id));
      const j = mover === "arriba" ? i - 1 : i + 1;
      if (i < 0 || j < 0 || j >= lista.length) {
        return jsonResponse({ ok: true, cambio: false });
      }

      const numeroOrden = (valor: unknown): number | null => {
        const n = typeof valor === "number" ? valor : Number(valor);
        return Number.isFinite(n) ? n : null;
      };
      const numeros = lista.map((row) => numeroOrden(row.orden));
      const finitos = numeros.filter((n): n is number => n !== null);
      const hayRepetidos = new Set(finitos).size !== finitos.length;
      const faltan = finitos.length !== lista.length;
      let base: number[];
      if (hayRepetidos || faltan) {
        const { data: sonando } = await supabase
          .from("cola_reproduccion")
          .select("orden")
          .eq("estado", "reproduciendo")
          .limit(1)
          .maybeSingle();
        const piso = numeroOrden(sonando?.orden) ?? 0;
        base = lista.map((_, idx) => piso + idx + 1);
      } else {
        base = finitos;
      }
      const ordenI = base[j];
      const ordenJ = base[i];
      base[i] = ordenI;
      base[j] = ordenJ;

      const tocar = (hayRepetidos || faltan) ? lista.map((_, idx) => idx) : [i, j];
      for (const idx of tocar) {
        const { error: upErr } = await supabase
          .from("cola_reproduccion")
          .update({ orden: base[idx] })
          .eq("id", lista[idx].id)
          .eq("estado", "pendiente");
        if (upErr) throw upErr;
      }
      return jsonResponse({ ok: true, cambio: true });
    }

    if (!["reproduciendo", "completada"].includes(estado)) {
      return errorResponse("estado_invalido", "Estado no válido.", 400);
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("cola_reproduccion")
      .update({ estado })
      .eq("id", cancion_id)
      .select("*, mesas(numero_mesa, tipo, etiqueta)")
      .single();

    if (error) throw error;
    if (!data) return errorResponse("no_encontrada", "Canción no encontrada.", 404);

    const tipo = data.mesas?.tipo ?? "mesa";
    const esLocal = tipo === "local";
    return jsonResponse({
      id: data.id,
      mesa_id: data.mesa_id,
      numero_mesa: data.mesas?.numero_mesa,
      tipo,
      etiqueta: esLocal
        ? "Local"
        : (data.mesas?.etiqueta ?? `Mesa ${data.mesas?.numero_mesa}`),
      youtube_video_id: data.youtube_video_id,
      titulo_cancion: data.titulo_cancion,
      nombre_cliente: data.nombre_cliente,
      saludo: data.saludo,
      saludo_momento: data.saludo_momento ?? "inicio",
      estado: data.estado,
      creado_en: data.creado_en,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    if (msg === "admin_no_autorizado") return errorResponse(msg, "No autorizado.", 403);
    return errorResponse("error", "Error al actualizar.", 500);
  }
});
