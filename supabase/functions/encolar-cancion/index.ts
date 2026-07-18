import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { validarMesaToken } from "../_shared/mesa.ts";
import { validarHorario } from "../_shared/horario.ts";
import { filtrarTexto } from "../_shared/content_filter.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { videoEsReproducible } from "../_shared/youtube_embed.ts";
import {
  consultarLimiteCola,
  mensajeLimiteCola,
} from "../_shared/cola_limite.ts";
import { exigirCooldownMesa } from "../_shared/mesa_rate.ts";
import { pickYoutubeApiKey } from "../_shared/youtube_keys.ts";

const MAX_SALUDO_CHARS = 140;
const MAX_TITULO = 200;
const MAX_NOMBRE = 20;
/** Segundos de espera entre un saludo y el siguiente por mesa. */
const SALUDO_COOLDOWN_SEG = 180;

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const body = await req.json();
    const mesa = await validarMesaToken(Number(body.numero_mesa), String(body.token));
    const nombreCliente = filtrarTexto(String(body.nombre_cliente ?? ""), "nombre")
      .replace(/\s+/g, " ")
      .trim();

    if (nombreCliente.length < 2 || nombreCliente.length > MAX_NOMBRE) {
      return errorResponse("nombre_invalido", "Nombre inválido.", 400);
    }

    const supabase = createServiceClient();

    if (body.consultar === true) {
      try {
        await exigirCooldownMesa(mesa.id, "consultar_limite", 4);
      } catch (e) {
        if (e instanceof Error && e.message === "rate_limit") {
          return errorResponse("rate_limit", "Espera unos segundos.", 429);
        }
        throw e;
      }
      const limite = await consultarLimiteCola(supabase, mesa.id);
      return jsonResponse(limite);
    }

    const limite = await consultarLimiteCola(supabase, mesa.id);

    validarHorario();

    if (!limite.puede_encolar) {
      return errorResponse("limite_cola_excedido", mensajeLimiteCola(limite), 429);
    }

    const videoId = String(body.youtube_video_id ?? "").trim();
    if (videoId.length < 6) {
      return errorResponse("video_invalido", "Elige otra canción de la lista.", 400);
    }

    const apiKey = pickYoutubeApiKey();
    const check = await videoEsReproducible(videoId, apiKey);
    if (!check.ok) {
      return errorResponse(
        "video_no_reproducible",
        "Ese video no se puede reproducir en el local (YouTube lo bloquea). Elige otra versión (letra/karaoke).",
        422,
      );
    }

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

    const titulo = String(body.titulo_cancion ?? "").trim().slice(0, MAX_TITULO);
    if (titulo.length < 1) {
      return errorResponse("titulo_invalido", "Título de canción inválido.", 400);
    }

    const { data: cancion, error } = await supabase
      .from("cola_reproduccion")
      .insert({
        mesa_id: mesa.id,
        youtube_video_id: videoId,
        titulo_cancion: titulo,
        nombre_cliente: nombreCliente,
        saludo,
        saludo_momento: saludo ? saludoMomento : "inicio",
        estado: "pendiente",
      })
      .select("*, mesas(numero_mesa)")
      .single();

    if (error) throw error;

    const { count: totalPendientes } = await supabase
      .from("cola_reproduccion")
      .select("id", { count: "exact", head: true })
      .in("estado", ["pendiente", "reproduciendo"])
      .lte("creado_en", cancion.creado_en);

    const limiteActualizado = await consultarLimiteCola(supabase, mesa.id);

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
      limite: limiteActualizado,
    }, 201);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    if (msg.startsWith("contenido_no_permitido")) {
      const campo = msg.split(":")[1];
      return errorResponse(
        "contenido_no_permitido",
        `El ${campo} contiene palabras no permitidas.`,
        422,
      );
    }
    if (msg.startsWith("fuera_de_horario")) {
      const [, inicio, fin] = msg.split(":");
      return errorResponse("fuera_de_horario", `Karaoke de ${inicio} a ${fin}.`, 403);
    }
    if (msg === "token_invalido") return errorResponse(msg, "Token inválido.", 403);
    if (msg === "mesa_no_encontrada") return errorResponse(msg, "Mesa no encontrada.", 404);
    if (msg === "rate_limit") return errorResponse(msg, "Espera unos segundos.", 429);
    return errorResponse("error", "Error al encolar.", 500);
  }
});
