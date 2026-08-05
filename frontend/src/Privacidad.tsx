import { useNavigate } from "react-router-dom";
import { useAuth } from "@dcuerdas/shared";
import { BrandLogo } from "./components/BrandLogo";

/**
 * Política de privacidad — requerida por YouTube API Services (III.A.2e / III.A.2g).
 * URL pública: /privacidad
 */
export function Privacidad() {
  const navigate = useNavigate();
  const { esAdmin, cargando } = useAuth();

  /** Admin → panel; cliente → pantalla anterior (mesa) o landing. */
  const volver = () => {
    if (esAdmin) {
      navigate("/admin");
      return;
    }
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/");
  };

  const etiquetaVolver = esAdmin ? "Volver al panel" : "Volver";

  return (
    <div className="legal-page">
      <header className="legal-page-header">
        <BrandLogo size="header" />
        <button
          type="button"
          className="legal-back"
          onClick={volver}
          disabled={cargando}
        >
          {cargando ? "…" : etiquetaVolver}
        </button>
      </header>

      <article className="legal-article">
        <h1>Política de privacidad</h1>
        <p className="legal-updated">Última actualización: 5 de agosto de 2026</p>

        <p>
          Esta política describe cómo <strong>D&apos;cuerdas Resto-Bar</strong> (“nosotros”)
          recoge, usa, almacena y comparte información cuando usas la aplicación web de karaoke
          y carta disponible en{" "}
          <a href="https://dcuerdas-karaoke.vercel.app/">dcuerdas-karaoke.vercel.app</a>{" "}
          (el “API Client” / aplicación).
        </p>

        <h2>1. Quiénes somos</h2>
        <p>
          Operamos un resto-bar. Esta app permite a los clientes de una mesa pedir canciones
          (karaoke) y pedidos de carta, y al personal administrar la cola, pedidos y reproducción.
        </p>

        <h2>2. Qué información recogemos</h2>
        <ul>
          <li>
            <strong>Clientes (mesa):</strong> nombre o apodo, número de mesa, token de acceso del
            QR, número de personas, teléfono (opcional), notas de cocina, canciones pedidas,
            saludos opcionales y pedidos de comida.
          </li>
          <li>
            <strong>Personal / dueño:</strong> cuenta de Google (email, nombre y foto de perfil)
            para iniciar sesión en el panel de administración.
          </li>
          <li>
            <strong>Uso técnico:</strong> datos de diagnóstico de errores (si Sentry está activo),
            dirección IP y registros básicos del servidor al usar nuestras funciones.
          </li>
          <li>
            <strong>YouTube:</strong> términos de búsqueda y metadatos de videos (título, id,
            canal, miniatura) obtenidos mediante <strong>YouTube API Services</strong> para
            mostrar resultados y reproducir en el local.
          </li>
        </ul>

        <h2>3. Cómo usamos la información</h2>
        <ul>
          <li>Identificar la mesa y gestionar la cola de karaoke y los pedidos de carta.</li>
          <li>Mostrar saludos y canciones en la pantalla del local.</li>
          <li>Autenticar al personal autorizado en el panel admin.</li>
          <li>Mejorar estabilidad (detección de errores) y prevenir abuso (límites por mesa).</li>
          <li>
            Buscar y reproducir contenido de YouTube según la solicitud del cliente o del
            administrador.
          </li>
        </ul>

        <h2>4. Con quién compartimos información</h2>
        <p>No vendemos datos personales. Compartimos información solo con proveedores necesarios:</p>
        <ul>
          <li>
            <strong>Supabase</strong> — base de datos, autenticación y funciones del servidor.
          </li>
          <li>
            <strong>Vercel</strong> — alojamiento de la aplicación web.
          </li>
          <li>
            <strong>Google</strong> — inicio de sesión del personal (OAuth) y, cuando aplica,
            políticas de Google/YouTube.
          </li>
          <li>
            <strong>YouTube / Google</strong> — al buscar o reproducir videos mediante YouTube
            API Services e IFrame Player. El uso de YouTube está sujeto a los{" "}
            <a
              href="https://www.youtube.com/t/terms"
              target="_blank"
              rel="noopener noreferrer"
            >
              Términos de Servicio de YouTube
            </a>{" "}
            y a la{" "}
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
            >
              Política de Privacidad de Google
            </a>
            .
          </li>
          <li>
            <strong>Sentry</strong> (si está configurado) — reportes de error del navegador.
          </li>
        </ul>
        <p>
          Dentro del local, canciones en cola (título, nombre del cliente y mesa) pueden verse
          en la pantalla pública de karaoke y en la vista de cola de otras mesas, para el turno.
        </p>

        <h2>5. Almacenamiento en el dispositivo (cookies y similar)</h2>
        <p>
          La aplicación <strong>almacena, accede o recoge información en el dispositivo o
          navegador</strong> del usuario, incluyendo:
        </p>
        <ul>
          <li>
            <strong>localStorage / sessionStorage:</strong> datos del cliente por mesa (nombre,
            paso del flujo), preferencias locales de anuncios en admin, y sesión de Supabase
            Auth del personal.
          </li>
          <li>
            <strong>Cookies o almacenamiento similar</strong> usados por Google (inicio de
            sesión), Supabase Auth, y eventualmente Sentry / YouTube (reproductor embebido).
          </li>
        </ul>
        <p>
          Puedes borrar estos datos desde la configuración de tu navegador. Si borras el
          almacenamiento local, es posible que debas volver a registrarte en la mesa o iniciar
          sesión de nuevo.
        </p>

        <h2>6. Datos de YouTube API — retención</h2>
        <p>
          Los metadatos obtenidos vía YouTube Data API (resultados de búsqueda: id, título,
          canal, miniatura) se cachean en nuestro servidor para reducir cuota de API.{" "}
          <strong>Se actualizan o eliminan como máximo a los 30 días</strong>. No conservamos
          ese contenido de la API más de 30 días sin volver a obtenerlo de YouTube cuando hace
          falta una búsqueda nueva.
        </p>

        <h2>7. Conservación de otros datos</h2>
        <p>
          Pedidos, visitas y cola de karaoke se conservan el tiempo necesario para operar el
          local (servicio, cocina, estadísticas internas). El personal puede gestionar o
          depurar registros según la operación del negocio.
        </p>

        <h2>8. Seguridad del acceso por mesa</h2>
        <p>
          El acceso de cliente requiere el enlace/QR de la mesa (número + token). Quien tenga el
          QR de una mesa puede usar esa mesa. No publiques tokens de mesa en sitios abiertos.
        </p>

        <h2>9. Tus opciones</h2>
        <ul>
          <li>Clientes: puedes pedir al personal que retire una canción de la cola o un pedido pendiente, cuando sea posible.</li>
          <li>Personal: puedes cerrar sesión en el panel admin en cualquier momento.</li>
          <li>
            Para ejercer derechos sobre tus datos personales (acceso, corrección o eliminación),
            contacta al local (ver abajo).
          </li>
        </ul>

        <h2>10. Contacto</h2>
        <p>
          D&apos;cuerdas Resto-Bar
          <br />
          Aplicación:{" "}
          <a href="https://dcuerdas-karaoke.vercel.app/">dcuerdas-karaoke.vercel.app</a>
          <br />
          Para consultas de privacidad, habla con el personal del local o con el responsable del
          sistema.
        </p>

        <h2>11. YouTube API Services</h2>
        <p>
          Esta aplicación es un cliente de <strong>YouTube API Services</strong>. Al usar las
          funciones de búsqueda y reproducción, también aplican los términos y políticas de
          YouTube y Google citados arriba.
        </p>
      </article>

      <footer className="legal-page-footer">
        <button type="button" className="legal-back" onClick={volver}>
          {esAdmin ? "Panel admin" : "Inicio"}
        </button>
        <span aria-hidden="true">·</span>
        <span>D&apos;cuerdas Resto-Bar</span>
      </footer>
    </div>
  );
}
