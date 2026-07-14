-- Carta oficial D'cuerdas Resto-Bar (sin imágenes externas)
DELETE FROM platos;
DELETE FROM categorias_carta;

ALTER SEQUENCE categorias_carta_id_seq RESTART WITH 1;
ALTER SEQUENCE platos_id_seq RESTART WITH 1;

INSERT INTO categorias_carta (nombre, descripcion, orden) VALUES
  ('Comida / Antojitos', 'Para compartir y picar', 1),
  ('Calientes de 1 litro / Ron o pisco', 'Jarra de 1 litro con ron o pisco', 2),
  ('Caliente whisky', 'Jarra de 1 litro con whisky', 3),
  ('Taza de caliente', 'Porción en taza', 4),
  ('Cervezas', 'Nacionales y artesanales', 5),
  ('Infusiones y bebidas', 'Sin alcohol', 6),
  ('Licor en botella + gaseosa Ginger 1.5 L', 'Botella + ginger ale', 7),
  ('Shots', 'Trago corto', 8),
  ('Cócteles', 'Preparados en barra', 9),
  ('Tragos en jarra', 'Para compartir', 10),
  ('Vinos', 'Selección de la casa', 11),
  ('Platos a reservación', 'Consulta disponibilidad con el personal', 12);

-- 1. Comida / Antojitos
INSERT INTO platos (categoria_id, nombre, descripcion, precio, orden) VALUES
  (1, 'Alitas acevichadas', NULL, 0, 1),
  (1, 'Alitas con limón', NULL, 0, 2),
  (1, 'Alitas BBQ', NULL, 0, 3),
  (1, 'Alitas con maracuyá', NULL, 0, 4),
  (1, 'Hamburguesa clásica', NULL, 0, 5),
  (1, 'Hamburguesa royal', NULL, 0, 6),
  (1, 'Salchipapa clásica', NULL, 0, 7),
  (1, 'Salchipapa montada', NULL, 0, 8),
  (1, 'Tequeños', NULL, 0, 9);

-- 2. Calientes de 1 litro / Ron o pisco
INSERT INTO platos (categoria_id, nombre, descripcion, precio, orden) VALUES
  (2, 'Tropical', 'Mango, naranja y maracuyá', 0, 1),
  (2, 'Exótico', 'Jamaica, mango y naranja', 0, 2),
  (2, 'Frutisabor', 'Arándano, limón y mango', 0, 3),
  (2, 'Freshman', 'Mango y fresa', 0, 4),
  (2, 'Uña de gato medicinal', 'Menta, eucalipto y uña de gato', 0, 5);

-- 3. Caliente whisky
INSERT INTO platos (categoria_id, nombre, descripcion, precio, orden) VALUES
  (3, 'Tropical caliente whisky', 'Mango, naranja y maracuyá', 0, 1),
  (3, 'Exótico caliente whisky', 'Jamaica, mango y naranja', 0, 2),
  (3, 'Frutisabor caliente whisky', 'Arándano, limón y mango', 0, 3),
  (3, 'Freshman caliente whisky', 'Mango y fresa', 0, 4),
  (3, 'Uña de gato medicinal caliente whisky', 'Menta, eucalipto y uña de gato', 0, 5);

-- 4. Taza de caliente
INSERT INTO platos (categoria_id, nombre, descripcion, precio, orden) VALUES
  (4, 'Taza tropical', 'Mango, naranja y maracuyá', 0, 1),
  (4, 'Taza exótico', 'Jamaica, mango y naranja', 0, 2),
  (4, 'Taza frutisabor', 'Arándano, limón y mango', 0, 3),
  (4, 'Taza freshman', 'Mango y fresa', 0, 4),
  (4, 'Taza uña de gato medicinal', 'Menta, eucalipto y uña de gato', 0, 5);

-- 5. Cervezas
INSERT INTO platos (categoria_id, nombre, descripcion, precio, orden) VALUES
  (5, 'Cerveza artesanal Dorcher', NULL, 0, 1),
  (5, 'Cerveza Cusqueña Trigo', NULL, 0, 2),
  (5, 'Cerveza Cusqueña Negra', NULL, 0, 3),
  (5, 'Cerveza Pilsen', NULL, 0, 4),
  (5, 'Cerveza Cristal', NULL, 0, 5);

-- 6. Infusiones y bebidas
INSERT INTO platos (categoria_id, nombre, descripcion, precio, orden) VALUES
  (6, 'Café', NULL, 0, 1),
  (6, 'Manzanilla', NULL, 0, 2),
  (6, 'Anís', NULL, 0, 3),
  (6, 'Té', NULL, 0, 4),
  (6, 'Inka / Coca personal', NULL, 0, 5),
  (6, 'Inka / Coca 1 litro', NULL, 0, 6),
  (6, 'Agua mineral', NULL, 0, 7);

-- 7. Licor en botella + gaseosa Ginger 1.5 L
INSERT INTO platos (categoria_id, nombre, descripcion, precio, orden) VALUES
  (7, 'Ron Flor de Caña', 'Incluye gaseosa Ginger 1.5 L', 0, 1),
  (7, 'Ron Cartavio', 'Incluye gaseosa Ginger 1.5 L', 0, 2),
  (7, 'Whisky Old Times', 'Incluye gaseosa Ginger 1.5 L', 0, 3),
  (7, 'Whisky Red Label', 'Incluye gaseosa Ginger 1.5 L', 0, 4),
  (7, 'Whisky Black Label', 'Incluye gaseosa Ginger 1.5 L', 0, 5),
  (7, 'Whisky Double Black', 'Incluye gaseosa Ginger 1.5 L', 0, 6),
  (7, 'Whisky Swing Johnnie Walker', 'Incluye gaseosa Ginger 1.5 L', 0, 7),
  (7, 'Whisky Gold Label', 'Incluye gaseosa Ginger 1.5 L', 0, 8),
  (7, 'Whisky Chivas Regal', 'Incluye gaseosa Ginger 1.5 L', 0, 9),
  (7, 'Whisky Jack Daniel''s', 'Incluye gaseosa Ginger 1.5 L', 0, 10),
  (7, 'Tequila José Cuervo', 'Incluye gaseosa Ginger 1.5 L', 0, 11),
  (7, 'Vodka Absolut', 'Incluye gaseosa Ginger 1.5 L', 0, 12);

-- 8. Shots
INSERT INTO platos (categoria_id, nombre, descripcion, precio, orden) VALUES
  (8, 'Shot de tequila José Cuervo', NULL, 0, 1),
  (8, 'Shot de whisky Red Label', NULL, 0, 2),
  (8, 'Shot de whisky Black Label', NULL, 0, 3),
  (8, 'Shot de ron Flor de Caña', NULL, 0, 4);

-- 9. Cócteles
INSERT INTO platos (categoria_id, nombre, descripcion, precio, orden) VALUES
  (9, 'Arándano Sour', NULL, 0, 1),
  (9, 'Pisco Sour', NULL, 0, 2),
  (9, 'Algarrobina', NULL, 0, 3),
  (9, 'Piña Colada', NULL, 0, 4),
  (9, 'Pantera Rosa', NULL, 0, 5),
  (9, 'Margarita', NULL, 0, 6),
  (9, 'Daikiri Clásico', NULL, 0, 7),
  (9, 'Laguna Azul', NULL, 0, 8),
  (9, 'Chilcano', NULL, 0, 9),
  (9, 'Cuba Libre', NULL, 0, 10);

-- 10. Tragos en jarra
INSERT INTO platos (categoria_id, nombre, descripcion, precio, orden) VALUES
  (10, 'Chilcano en jarra', NULL, 0, 1),
  (10, 'Cuba Libre en jarra', NULL, 0, 2);

-- 11. Vinos
INSERT INTO platos (categoria_id, nombre, descripcion, precio, orden) VALUES
  (11, 'Borgoña', NULL, 0, 1),
  (11, 'Queirolo', NULL, 0, 2),
  (11, 'El Enemigo', NULL, 0, 3);

-- 12. Platos a reservación
INSERT INTO platos (categoria_id, nombre, descripcion, precio, orden) VALUES
  (12, 'Pollo a la plancha', 'Sujeto a disponibilidad. Reserva con anticipación.', 0, 1),
  (12, 'Chancho a la caja china', 'Sujeto a disponibilidad. Reserva con anticipación.', 0, 2),
  (12, 'Trucha frita', 'Sujeto a disponibilidad. Reserva con anticipación.', 0, 3),
  (12, 'Pollo al horno', 'Sujeto a disponibilidad. Reserva con anticipación.', 0, 4),
  (12, 'Caldo de gallina', 'Sujeto a disponibilidad. Reserva con anticipación.', 0, 5);
