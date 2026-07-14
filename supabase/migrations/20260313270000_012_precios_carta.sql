-- Precios oficiales según carta D'cuerdas (flyer 2026)
-- 1. Comida / Antojitos
UPDATE platos SET precio = 15, descripcion = COALESCE(descripcion, NULL) WHERE categoria_id = 1 AND nombre = 'Alitas acevichadas';
UPDATE platos SET precio = 15 WHERE categoria_id = 1 AND nombre = 'Alitas con limón';
UPDATE platos SET precio = 15 WHERE categoria_id = 1 AND nombre = 'Alitas BBQ';
UPDATE platos SET precio = 15 WHERE categoria_id = 1 AND nombre = 'Alitas con maracuyá';
UPDATE platos SET precio = 10, descripcion = 'Carne, lechuga, tomate y papas fritas' WHERE categoria_id = 1 AND nombre = 'Hamburguesa clásica';
UPDATE platos SET precio = 12, descripcion = 'Carne, lechuga, tomate, papas fritas, huevo y plátano' WHERE categoria_id = 1 AND nombre = 'Hamburguesa royal';
UPDATE platos SET precio = 10, descripcion = 'Salchicha, papas fritas' WHERE categoria_id = 1 AND nombre = 'Salchipapa clásica';
UPDATE platos SET precio = 11, descripcion = 'Salchicha, papas fritas, huevo y plátano' WHERE categoria_id = 1 AND nombre = 'Salchipapa montada';
UPDATE platos SET precio = 10 WHERE categoria_id = 1 AND nombre = 'Tequeños';

-- 2. Calientes 1L Ron/Pisco (columna flyer)
UPDATE platos SET precio = 25 WHERE categoria_id = 2;

-- 3. Caliente whisky 1L
UPDATE platos SET precio = 50 WHERE categoria_id = 3;

-- 4. Taza de caliente
UPDATE platos SET precio = 7 WHERE categoria_id = 4;

-- 5. Cervezas
UPDATE platos SET precio = 12 WHERE nombre = 'Cerveza artesanal Dorcher';
UPDATE platos SET precio = 10 WHERE nombre = 'Cerveza Cusqueña Trigo';
UPDATE platos SET precio = 10 WHERE nombre = 'Cerveza Cusqueña Negra';
UPDATE platos SET precio = 9 WHERE nombre = 'Cerveza Pilsen';
UPDATE platos SET precio = 9 WHERE nombre = 'Cerveza Cristal';

-- 6. Infusiones y bebidas
UPDATE platos SET precio = 3 WHERE nombre = 'Café';
UPDATE platos SET precio = 2 WHERE nombre = 'Manzanilla';
UPDATE platos SET precio = 2 WHERE nombre = 'Anís';
UPDATE platos SET precio = 2 WHERE nombre = 'Té';
UPDATE platos SET precio = 3.50 WHERE nombre = 'Inka / Coca personal';
UPDATE platos SET precio = 7 WHERE nombre = 'Inka / Coca 1 litro';
UPDATE platos SET precio = 2 WHERE nombre = 'Agua mineral';

-- 7. Licor en botella + Ginger 1.5 L (del flyer)
UPDATE platos SET precio = 100 WHERE nombre = 'Ron Flor de Caña';
UPDATE platos SET precio = 50 WHERE nombre = 'Ron Cartavio';
UPDATE platos SET precio = 50 WHERE nombre = 'Whisky Old Times';
UPDATE platos SET precio = 100 WHERE nombre = 'Whisky Red Label';
UPDATE platos SET precio = 150 WHERE nombre = 'Whisky Black Label';
UPDATE platos SET precio = 250 WHERE nombre = 'Whisky Double Black';
UPDATE platos SET precio = 280 WHERE nombre = 'Whisky Swing Johnnie Walker';
UPDATE platos SET precio = 320 WHERE nombre = 'Whisky Gold Label';
UPDATE platos SET precio = 150 WHERE nombre = 'Whisky Chivas Regal';
UPDATE platos SET precio = 120 WHERE nombre = 'Whisky Jack Daniel’s';
UPDATE platos SET precio = 120 WHERE nombre = 'Whisky Jack Daniel''s';
UPDATE platos SET precio = 80 WHERE nombre = 'Tequila José Cuervo';
UPDATE platos SET precio = 90 WHERE nombre = 'Vodka Absolut';

-- 8. Shots
UPDATE platos SET precio = 10 WHERE nombre = 'Shot de tequila José Cuervo';
UPDATE platos SET precio = 10 WHERE nombre = 'Shot de whisky Red Label';
UPDATE platos SET precio = 15 WHERE nombre = 'Shot de whisky Black Label';
UPDATE platos SET precio = 10 WHERE nombre = 'Shot de ron Flor de Caña';

-- 9. Cócteles
UPDATE platos SET precio = 15 WHERE nombre = 'Arándano Sour';
UPDATE platos SET precio = 15 WHERE nombre = 'Pisco Sour';
UPDATE platos SET precio = 15 WHERE nombre = 'Algarrobina';
UPDATE platos SET precio = 18 WHERE nombre = 'Piña Colada';
UPDATE platos SET precio = 15 WHERE nombre = 'Pantera Rosa';
UPDATE platos SET precio = 18 WHERE nombre = 'Margarita';
UPDATE platos SET precio = 15 WHERE nombre = 'Daikiri Clásico';
UPDATE platos SET precio = 15 WHERE nombre = 'Laguna Azul';
UPDATE platos SET precio = 12 WHERE nombre = 'Chilcano';
UPDATE platos SET precio = 12 WHERE nombre = 'Cuba Libre';

-- 10. Tragos en jarra
UPDATE platos SET precio = 35 WHERE nombre = 'Chilcano en jarra';
UPDATE platos SET precio = 35 WHERE nombre = 'Cuba Libre en jarra';

-- 11. Vinos
UPDATE platos SET precio = 25 WHERE nombre = 'Borgoña';
UPDATE platos SET precio = 25 WHERE nombre = 'Queirolo';
UPDATE platos SET precio = 110 WHERE nombre = 'El Enemigo';

-- 12. Platos a reservación
UPDATE platos SET precio = 15 WHERE nombre = 'Pollo a la plancha';
UPDATE platos SET precio = 25 WHERE nombre = 'Chancho a la caja china';
UPDATE platos SET precio = 15 WHERE nombre = 'Trucha frita';
UPDATE platos SET precio = 15 WHERE nombre = 'Pollo al horno';
UPDATE platos SET precio = 15 WHERE nombre = 'Caldo de gallina';
