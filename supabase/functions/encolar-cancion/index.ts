import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { validarMesaToken } from "../_shared/mesa.ts";
import { validarHorario } from "../_shared/horario.ts";
import { filtrarTexto } from "../_shared/content_filter.ts";
import { createServiceClient } from "../_shared/supabase.ts";

const MAX_CANCIONES = 5;
const MAX_SALUDO_CHARS = 140;
/** Segundos de espera entre un saludo y el siguiente por mesa. */
const SALUDO_COOLDOWN_SEG = 180;

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    validarHorario();
    const body = await req.json();
    const mesa = await validarMesaToken(Number(body.numero_mesa), String(body.token));

    const nombreCliente = filtrarTexto(String(body.nombre_cliente), "nombre");
    let saludo: string | null = null;
    let saludoMomento: "inicio" | "final" = "inicio";

    if (body.saludo && String(body.saludo).trim()) {
      const bruto = String(body.saludo).trim();
      if (bruto.length > MAX_SALUDO_CHARS) {
        return errorResponse(
          "saludo_muy_largo",
          `El saludo puede tener hasta ${MAX_SALUDO_CHARS} caracteres.`,
          400,
        );
      }
      saludo = filtrarTexto(bruto, "saludo");
      const momentoRaw = String(body.saludo_momento ?? "inicio").toLowerCase();
      saludoMomento = momentoRaw === "final" ? "final" : "inicio";
    }

    const supabase = createServiceClient();

    const { count } = await supabase
      .from("cola_reproduccion")
      .select("id", { count: "exact", head: true })
      .eq("mesa_id", mesa.id)
      .in("estado", ["pendiente", "reproduciendo"]);

    if ((count ?? 0) >= MAX_CANCIONES) {
      return errorResponse(
        "limite_cola_excedido",
        `Tu mesa ya tiene ${MAX_CANCIONES} canciones en cola.`,
        400,
      );
    }

    // Rate limit: no más de 1 saludo por mesa cada SALUDO_COOLDOWN_SEG segundos.
    if (saludo) {
      const desde = new Date(Date.now() - SALUDO_COOLDOWN_SEG * 1000).toISOString();
      const { data: recientes } = await supabase
        .from("cola_reproduccion")
        .select("id, creado_en")
        .eq("mesa_id", mesa.id)
        .not("saludo", "is", null)
        .gte("creado_en", desde)
        .limit(1);

      if (recientes && recientes.length > 0) {
        const mins = Math.ceil(SALUDO_COOLDOWN_SEG / 60);
        return errorResponse(
          "saludo_rate_limit",
          `Ya enviaste un saludo hace poco. Espera ${mins} minutos para enviar otro.`,
          429,
        );
      }
    }

    const { data: cancion, error } = await supabase
      .from("cola_reproduccion")
      .insert({
        mesa_id: mesa.id,
        youtube_video_id: String(body.youtube_video_id),
        titulo_cancion: String(body.titulo_cancion).trim(),
        nombre_cliente: nombreCliente,
        saludo,
        saludo_momento: saludo ? saludoMomento : "inicio",
        estado: "pendiente",
      })
      .select("*, mesas(numero_mesa)")
      .single();

    if (error) throw error;

    // Posición real en la cola global (no solo de la mesa).
    const { count: totalPendientes } = await supabase
      .from("cola_reproduccion")
      .select("id", { count: "exact", head: true })
      .in("estado", ["pendiente", "reproduciendo"])
      .lte("creado_en", cancion.creado_en);

    return jsonResponse({
      id: cancion.id,
      mesa_id: cancion.mesa_id,
      numero_mesa: cancion.mesas?.numero_mesa,
      youtube_video_id: cancion.youtube_video_id,
      titulo_cancion: cancion.titulo_cancion,
      nombre_cliente: cancion.nombre_cliente,
      saludo: cancion.saludo,
      saludo_momento: cancion.saludo_momento,
      estado: cancion.estado,
      creado_en: cancion.creado_en,
      posicion: totalPendientes ?? 1,
    }, 201);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    if (msg.startsWith("contenido_no_permitido")) {
      const campo = msg.split(":")[1];
      return errorResponse("contenido_no_permitido", `El ${campo} contiene palabras no permitidas.`, 422);
    }
    if (msg.startsWith("fuera_de_horario")) {
      const [, inicio, fin] = msg.split(":");
      return errorResponse("fuera_de_horario", `Karaoke de ${inicio} a ${fin}.`, 403);
    }
    if (msg === "token_invalido") return errorResponse(msg, "Token inválido.", 403);
    if (msg === "mesa_no_encontrada") return errorResponse(msg, "Mesa no encontrada.", 404);
    return errorResponse("error", "Error al encolar.", 500);
  }
});
