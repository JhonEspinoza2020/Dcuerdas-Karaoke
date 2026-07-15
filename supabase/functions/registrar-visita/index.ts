import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { validarMesaToken } from "../_shared/mesa.ts";
import { getUserFromRequest } from "../_shared/auth.ts";
import { filtrarTexto } from "../_shared/content_filter.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { inicioJornadaActualIso, claveJornadaDesdeIso } from "../_shared/horario.ts";
import { AgrupadorPersonas, normalizarNombre, nombresSimilares } from "../_shared/nombres.ts";

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
    const inicioHoy = inicioJornadaActualIso();

    // Evitar duplicados en la misma jornada (misma mesa + mismo nombre / Google / similar).
    const { data: hoyMesa } = await supabase
      .from("visitas_clientes")
      .select("id, nombre_cliente, nombre_norm, user_id")
      .eq("mesa_id", mesa.id)
      .gte("creado_en", inicioHoy);

    const yaHoy = (hoyMesa ?? []).find((v) => {
      if (user?.id && v.user_id === user.id) return true;
      return nombresSimilares(nombreNorm, v.nombre_norm || v.nombre_cliente);
    });

    if (yaHoy) {
      return jsonResponse({ registrado: false, mensaje: "Visita ya registrada en esta jornada" });
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

    // Contar noches distintas de esta persona (nombre similar + user_id).
    const { data: historial } = await supabase
      .from("visitas_clientes")
      .select("nombre_cliente, nombre_norm, user_id, creado_en")
      .order("creado_en", { ascending: false })
      .limit(2000);

    const agrupador = new AgrupadorPersonas();
    for (const v of historial ?? []) {
      agrupador.registrar(normalizarNombre(v.nombre_cliente) || v.nombre_norm, v.user_id);
    }
    const miClave = agrupador.claveDe(nombreNorm, user?.id ?? null);
    const noches = new Set<string>();
    for (const v of historial ?? []) {
      const k = agrupador.claveDe(normalizarNombre(v.nombre_cliente) || v.nombre_norm, v.user_id);
      if (k === miClave) noches.add(claveJornadaDesdeIso(v.creado_en));
    }

    const totalNoches = Math.max(1, noches.size);

    return jsonResponse({
      registrado: true,
      visita_id: visita.id,
      creado_en: visita.creado_en,
      total_visitas: totalNoches,
      es_frecuente: totalNoches >= 2,
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
