import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { verifyAdminAuth } from "../_shared/auth.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { filtrarTexto } from "../_shared/content_filter.ts";

const PRECIO_MAX = 999.99;
const NOMBRE_MAX = 80;
const DESCRIPCION_MAX = 180;
const MUTACIONES_POR_MINUTO = 12;

function textoValidado(
  value: unknown,
  campo: string,
  max: number,
  requerido = false,
): string | null {
  const raw = typeof value === "string" || typeof value === "number"
    ? String(value)
    : "";
  const limpio = filtrarTexto(raw, campo).replace(/\s+/g, " ").trim();
  if (requerido && limpio.length < 2) throw new Error(`${campo}_invalido`);
  if (limpio.length > max) throw new Error(`${campo}_muy_largo`);
  return limpio || null;
}

function precioValidado(value: unknown): number {
  const precio = Number(value);
  if (!Number.isFinite(precio) || precio <= 0 || precio > PRECIO_MAX) {
    throw new Error("precio_invalido");
  }
  return Math.round(precio * 100) / 100;
}

async function validarRateLimit(actor: string): Promise<void> {
  const supabase = createServiceClient();
  const desde = new Date(Date.now() - 60_000).toISOString();
  const { count, error } = await supabase
    .from("admin_rate_limits")
    .select("id", { count: "exact", head: true })
    .eq("actor", actor)
    .eq("accion", "carta_mutacion")
    .gte("creado_en", desde);
  if (error) throw error;
  if ((count ?? 0) >= MUTACIONES_POR_MINUTO) throw new Error("rate_limit");
  const { error: insertError } = await supabase
    .from("admin_rate_limits")
    .insert({ actor, accion: "carta_mutacion" });
  if (insertError) throw insertError;
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const url = new URL(req.url);
    const recurso = url.searchParams.get("recurso") ?? "categorias";
    const supabase = createServiceClient();

    const admin = await verifyAdminAuth(req);

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

    const body = req.method !== "GET" ? await req.json() : null;
    if (body) {
      await validarRateLimit(admin.userId || admin.email);
    }

    if (req.method === "POST" && recurso === "categorias") {
      const nombre = textoValidado(body.nombre, "nombre", NOMBRE_MAX, true);
      const descripcion = textoValidado(
        body.descripcion,
        "descripcion",
        DESCRIPCION_MAX,
      );
      const { data, error } = await supabase
        .from("categorias_carta")
        .insert({
          nombre,
          descripcion,
          orden: Number.isInteger(Number(body.orden)) ? Number(body.orden) : 0,
          activa: body.activa !== false,
        })
        .select()
        .single();
      if (error) throw error;
      return jsonResponse(data, 201);
    }

    if (req.method === "PATCH" && recurso === "categorias") {
      const id = Number(body.id);
      if (!Number.isInteger(id) || id <= 0) throw new Error("id_invalido");
      const updates: Record<string, unknown> = {};
      if ("nombre" in body) {
        updates.nombre = textoValidado(body.nombre, "nombre", NOMBRE_MAX, true);
      }
      if ("descripcion" in body) {
        updates.descripcion = textoValidado(
          body.descripcion,
          "descripcion",
          DESCRIPCION_MAX,
        );
      }
      if ("activa" in body) updates.activa = Boolean(body.activa);
      if ("orden" in body && Number.isInteger(Number(body.orden))) {
        updates.orden = Number(body.orden);
      }
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
      const categoriaId = Number(body.categoria_id);
      if (!Number.isInteger(categoriaId) || categoriaId <= 0) {
        throw new Error("categoria_invalida");
      }
      const nombre = textoValidado(body.nombre, "nombre", NOMBRE_MAX, true);
      const descripcion = textoValidado(
        body.descripcion,
        "descripcion",
        DESCRIPCION_MAX,
      );
      const precio = precioValidado(body.precio);
      const { data: categoria } = await supabase
        .from("categorias_carta")
        .select("id")
        .eq("id", categoriaId)
        .eq("activa", true)
        .maybeSingle();
      if (!categoria) throw new Error("categoria_invalida");
      const { data, error } = await supabase
        .from("platos")
        .insert({
          categoria_id: categoriaId,
          nombre,
          descripcion,
          precio,
          disponible: body.disponible !== false,
          orden: Number.isInteger(Number(body.orden)) ? Number(body.orden) : 0,
        })
        .select()
        .single();
      if (error) throw error;
      return jsonResponse(data, 201);
    }

    if (req.method === "PATCH" && recurso === "platos") {
      const id = Number(body.id);
      if (!Number.isInteger(id) || id <= 0) throw new Error("id_invalido");
      const updates: Record<string, unknown> = {};
      if ("nombre" in body) {
        updates.nombre = textoValidado(body.nombre, "nombre", NOMBRE_MAX, true);
      }
      if ("descripcion" in body) {
        updates.descripcion = textoValidado(
          body.descripcion,
          "descripcion",
          DESCRIPCION_MAX,
        );
      }
      if ("precio" in body) updates.precio = precioValidado(body.precio);
      if ("disponible" in body) updates.disponible = Boolean(body.disponible);
      if ("categoria_id" in body) {
        const categoriaId = Number(body.categoria_id);
        if (!Number.isInteger(categoriaId) || categoriaId <= 0) {
          throw new Error("categoria_invalida");
        }
        updates.categoria_id = categoriaId;
      }
      const { data, error } = await supabase
        .from("platos")
        .update({ ...updates, actualizado_en: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return jsonResponse(data);
    }

    if (req.method === "DELETE" && recurso === "platos") {
      const id = Number(body.id);
      if (!Number.isInteger(id) || id <= 0) throw new Error("id_invalido");

      const { count: usados } = await supabase
        .from("pedido_items")
        .select("id", { count: "exact", head: true })
        .eq("plato_id", id);

      if ((usados ?? 0) > 0) {
        const { error } = await supabase
          .from("platos")
          .update({ disponible: false, actualizado_en: new Date().toISOString() })
          .eq("id", id);
        if (error) throw error;
        return jsonResponse({
          ok: true,
          soft: true,
          mensaje: "El plato ya estuvo en pedidos: se ocultó (no se borró del historial).",
        });
      }

      const { error } = await supabase.from("platos").delete().eq("id", id);
      if (error) throw error;
      return jsonResponse({ ok: true, soft: false, mensaje: "Plato eliminado." });
    }

    if (req.method === "DELETE" && recurso === "categorias") {
      const id = Number(body.id);
      if (!Number.isInteger(id) || id <= 0) throw new Error("id_invalido");

      const { data: platosCat, error: platosErr } = await supabase
        .from("platos")
        .select("id")
        .eq("categoria_id", id);
      if (platosErr) throw platosErr;

      const platoIds = (platosCat ?? []).map((p) => p.id as number);
      let soft = false;

      if (platoIds.length > 0) {
        const { data: usadosRows } = await supabase
          .from("pedido_items")
          .select("plato_id")
          .in("plato_id", platoIds);
        const usados = new Set((usadosRows ?? []).map((r) => r.plato_id as number));
        const borrables = platoIds.filter((pid) => !usados.has(pid));
        const ocultar = platoIds.filter((pid) => usados.has(pid));

        if (borrables.length > 0) {
          const { error } = await supabase.from("platos").delete().in("id", borrables);
          if (error) throw error;
        }
        if (ocultar.length > 0) {
          soft = true;
          const { error } = await supabase
            .from("platos")
            .update({ disponible: false, actualizado_en: new Date().toISOString() })
            .in("id", ocultar);
          if (error) throw error;
        }
      }

      const { count: quedan } = await supabase
        .from("platos")
        .select("id", { count: "exact", head: true })
        .eq("categoria_id", id);

      if ((quedan ?? 0) > 0) {
        const { error } = await supabase
          .from("categorias_carta")
          .update({ activa: false, actualizado_en: new Date().toISOString() })
          .eq("id", id);
        if (error) throw error;
        return jsonResponse({
          ok: true,
          soft: true,
          mensaje: "Categoría desactivada: había platos en historial de pedidos.",
        });
      }

      const { error } = await supabase.from("categorias_carta").delete().eq("id", id);
      if (error) throw error;
      return jsonResponse({
        ok: true,
        soft,
        mensaje: soft
          ? "Categoría eliminada. Algunos platos del historial quedaron ocultos."
          : "Categoría eliminada.",
      });
    }

    return errorResponse("ruta_invalida", "Recurso o método no soportado.", 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    if (msg === "admin_no_autorizado") return errorResponse(msg, "No autorizado.", 403);
    if (msg === "rate_limit") {
      return errorResponse(msg, "Demasiados cambios. Espera un minuto.", 429);
    }
    if (msg === "precio_invalido") {
      return errorResponse(msg, "El precio debe estar entre S/ 0.01 y S/ 999.99.", 400);
    }
    if (msg === "categoria_invalida") {
      return errorResponse(msg, "Selecciona una categoría válida.", 400);
    }
    if (msg === "nombre_invalido") {
      return errorResponse(msg, "El nombre debe tener al menos 2 caracteres.", 400);
    }
    if (msg.endsWith("_muy_largo")) {
      return errorResponse(msg, "El texto supera el límite permitido.", 400);
    }
    if (msg.startsWith("contenido_no_permitido")) {
      return errorResponse(msg, "El texto contiene palabras no permitidas.", 422);
    }
    return errorResponse("error", "Error en carta.", 500);
  }
});
