-- Ambos dueños: Jhon (tú) + Hernán. Texto de reservación: coordinar con el mozo.
INSERT INTO public.admin_emails (email, rol)
VALUES
  ('espinozajhon739@gmail.com', 'dueño'),
  ('hernanmansilla120888@gmail.com', 'dueño')
ON CONFLICT (email) DO UPDATE SET rol = EXCLUDED.rol;

UPDATE public.perfiles
SET rol = 'dueño'
WHERE lower(email) IN (
  'espinozajhon739@gmail.com',
  'hernanmansilla120888@gmail.com'
);

UPDATE public.categorias_carta
SET descripcion = 'Coordinar con el mozo.'
WHERE nombre = 'Platos a reservación';

UPDATE public.platos
SET descripcion = 'Coordinar con el mozo.'
WHERE categoria_id = (
  SELECT id
  FROM public.categorias_carta
  WHERE nombre = 'Platos a reservación'
  LIMIT 1
);
