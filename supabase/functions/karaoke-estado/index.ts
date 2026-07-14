import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { estadoHorario } from "../_shared/horario.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const estado = estadoHorario();
  return jsonResponse({
    ...estado,
    mensaje: estado.abierto
      ? "Karaoke abierto. Escanea el QR de tu mesa."
      : `Karaoke disponible de ${estado.horario.inicio} a ${estado.horario.fin}.`,
  });
});
