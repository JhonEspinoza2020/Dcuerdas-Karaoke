-- Zona interna del dueño: canciones añadidas desde el admin no van a Mesa 1.
ALTER TABLE public.mesas DROP CONSTRAINT IF EXISTS mesas_tipo_check;
ALTER TABLE public.mesas ADD CONSTRAINT mesas_tipo_check CHECK (tipo IN ('mesa', 'karaoke', 'local'));

INSERT INTO public.mesas (numero_mesa, token_seguridad, tipo, etiqueta, activa)
VALUES (0, 'dc-local-admin-no-qr', 'local', 'Local', true)
ON CONFLICT (numero_mesa) DO UPDATE
SET tipo = 'local',
    etiqueta = 'Local',
    activa = true,
    token_seguridad = EXCLUDED.token_seguridad;

-- Canciones ya en cola del dueño (nombre Local) dejan de restar cupo a mesas de clientes.
UPDATE public.cola_reproduccion c
SET mesa_id = m_local.id
FROM public.mesas m_local
WHERE m_local.numero_mesa = 0
  AND c.nombre_cliente = 'Local'
  AND c.estado IN ('pendiente', 'reproduciendo')
  AND c.mesa_id IN (SELECT id FROM public.mesas WHERE numero_mesa BETWEEN 1 AND 12);
