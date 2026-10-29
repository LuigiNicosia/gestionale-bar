CREATE DATABASE IF NOT EXISTS `database_mysql`
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE `database_mysql`;
CREATE TABLE IF NOT EXISTS `settings` (
    `key` VARCHAR(50) NOT NULL PRIMARY KEY,
    `value` VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `ingredients` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(120) NOT NULL UNIQUE,
    `category` VARCHAR(60) NOT NULL DEFAULT 'Altro',
    `unit` VARCHAR(20) NOT NULL DEFAULT 'ml',
    `stock` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `alert_threshold` DECIMAL(10, 2) NOT NULL DEFAULT 200.00,
    `cost_per_unit` DECIMAL(10, 4) NOT NULL DEFAULT 0.0000,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `drinks` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(120) NOT NULL UNIQUE,
    `category` VARCHAR(60) NOT NULL DEFAULT 'Cocktail',
    `price` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `description` TEXT,
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `recipe_items` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `drink_id` INT NOT NULL,
    `ingredient_id` INT NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    UNIQUE KEY `uk_drink_ingredient` (`drink_id`, `ingredient_id`),
    CONSTRAINT `fk_recipe_drink` FOREIGN KEY (`drink_id`) REFERENCES `drinks` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_recipe_ingredient` FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `orders` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `order_code` VARCHAR(50) NOT NULL UNIQUE,
    `table_number` VARCHAR(50) NOT NULL,
    `staff_name` VARCHAR(100) NOT NULL DEFAULT 'Cameriere',
    `status` ENUM('in_attesa', 'in_preparazione', 'servito', 'pagato', 'annullato') NOT NULL DEFAULT 'in_attesa',
    `total_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `notes` TEXT,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `order_items` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `order_id` INT NOT NULL,
    `drink_id` INT NOT NULL,
    `quantity` INT NOT NULL,
    `unit_price` DECIMAL(10, 2) NOT NULL,
    `subtotal` DECIMAL(10, 2) NOT NULL,
    CONSTRAINT `fk_item_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_item_drink` FOREIGN KEY (`drink_id`) REFERENCES `drinks` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `stock_logs` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `ingredient_id` INT NOT NULL,
    `change_amount` DECIMAL(10, 2) NOT NULL,
    `resulting_stock` DECIMAL(10, 2) NOT NULL,
    `reason` VARCHAR(255) NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_log_ingredient` FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `settings` (`key`, `value`) VALUES
('owner_pin', '1234'),
('bar_name', 'BarMaster Cocktail Lounge')
ON DUPLICATE KEY UPDATE `value` = VALUES(`value`);

SET FOREIGN_KEY_CHECKS = 0;
INSERT INTO `ingredients` (`id`, `name`, `category`, `unit`, `stock`, `alert_threshold`, `cost_per_unit`) VALUES
(1, 'Gin London Dry', 'Distillati & Spirits', 'ml', 2000.00, 300.00, 0.0220),
(2, 'Vodka Premium', 'Distillati & Spirits', 'ml', 2000.00, 300.00, 0.0200),
(3, 'Rum Bianco', 'Distillati & Spirits', 'ml', 1500.00, 250.00, 0.0210),
(4, 'Rum Scuro Añejo', 'Distillati & Spirits', 'ml', 1000.00, 200.00, 0.0280),
(5, 'Tequila Blanco', 'Distillati & Spirits', 'ml', 1000.00, 200.00, 0.0260),
(6, 'Bourbon Whiskey', 'Distillati & Spirits', 'ml', 1500.00, 300.00, 0.0250),
(7, 'Scotch Whisky', 'Distillati & Spirits', 'ml', 1000.00, 200.00, 0.0270),
(8, 'Cachaca', 'Distillati & Spirits', 'ml', 1000.00, 200.00, 0.0230),
(9, 'Campari Bitter', 'Liquori & Bitter', 'ml', 1500.00, 250.00, 0.0180),
(10, 'Aperol', 'Liquori & Bitter', 'ml', 2000.00, 400.00, 0.0160),
(11, 'Vermouth Rosso', 'Vini & Vermouth', 'ml', 1500.00, 250.00, 0.0150),
(12, 'Vermouth Dry', 'Vini & Vermouth', 'ml', 1000.00, 200.00, 0.0150),
(13, 'Triple Sec / Cointreau', 'Liquori & Bitter', 'ml', 1000.00, 200.00, 0.0240),
(14, 'Kahlúa / Liquore Caffè', 'Liquori & Bitter', 'ml', 1000.00, 200.00, 0.0220),
(15, 'Amaro del Capo', 'Liquori & Bitter', 'ml', 1400.00, 300.00, 0.0200),
(16, 'Amaro Montenegro', 'Liquori & Bitter', 'ml', 1400.00, 300.00, 0.0210),
(17, 'Sambuca', 'Liquori & Bitter', 'ml', 1000.00, 200.00, 0.0190),
(18, 'Baileys Irish Cream', 'Liquori & Bitter', 'ml', 1000.00, 250.00, 0.0230),
(19, 'Prosecco DOC', 'Vini & Bollicine', 'ml', 3000.00, 750.00, 0.0120),
(20, 'Birra Bionda Spina / Bottiglia', 'Birre & Sidri', 'ml', 10000.00, 2000.00, 0.0050),
(21, 'Birra IPA Artigianale', 'Birre & Sidri', 'ml', 6000.00, 1500.00, 0.0090),
(22, 'Vino Rosso Chianti DOCG', 'Vini & Bollicine', 'ml', 3000.00, 750.00, 0.0140),
(23, 'Acqua Tonica Premium', 'Soft Drink & Mixer', 'ml', 4000.00, 600.00, 0.0060),
(24, 'Ginger Beer', 'Soft Drink & Mixer', 'ml', 3000.00, 500.00, 0.0080),
(25, 'Soda / Acqua Frizzante', 'Soft Drink & Mixer', 'ml', 3500.00, 500.00, 0.0020),
(26, 'Cola', 'Soft Drink & Mixer', 'ml', 4000.00, 500.00, 0.0040),
(27, 'Lemon Soda', 'Soft Drink & Mixer', 'ml', 3000.00, 500.00, 0.0050),
(28, 'Succo di Lime', 'Succhi & Preparati', 'ml', 1200.00, 250.00, 0.0080),
(29, 'Succo di Limone', 'Succhi & Preparati', 'ml', 1200.00, 250.00, 0.0070),
(30, 'Succo di Cranberry (Mirtillo)', 'Succhi & Preparati', 'ml', 1500.00, 300.00, 0.0070),
(31, 'Succo d\'Arancia', 'Succhi & Preparati', 'ml', 2000.00, 400.00, 0.0060),
(32, 'Succo d\'Ananas', 'Succhi & Preparati', 'ml', 1500.00, 300.00, 0.0060),
(33, 'Sciroppo di Zucchero', 'Succhi & Preparati', 'ml', 1500.00, 300.00, 0.0050),
(34, 'Sciroppo di Granatina', 'Succhi & Preparati', 'ml', 1000.00, 200.00, 0.0060),
(35, 'Foglie di Menta Fresca', 'Frutta & Botaniche', 'pz', 80.00, 15.00, 0.0800),
(36, 'Caffè Espresso', 'Altro', 'ml', 1500.00, 300.00, 0.0100)
ON DUPLICATE KEY UPDATE
    `category` = VALUES(`category`),
    `unit` = VALUES(`unit`),
    `stock` = VALUES(`stock`),
    `alert_threshold` = VALUES(`alert_threshold`),
    `cost_per_unit` = VALUES(`cost_per_unit`);
INSERT INTO `drinks` (`id`, `name`, `category`, `price`, `description`, `is_active`) VALUES
(1, 'Negroni Classico', 'Aperitivi', 8.00, 'L\'autentico aperitivo italiano: Gin London Dry, Campari Bitter e Vermouth Rosso in parti uguali con scorza d\'arancia.', 1),
(2, 'Americano Classico', 'Aperitivi', 7.00, 'Campari Bitter, Vermouth Rosso e spruzzo di soda con fetta d\'arancia fresca.', 1),
(3, 'Aperol Spritz', 'Aperitivi', 6.50, 'Il re dell\'aperitivo: Prosecco DOC, Aperol e soda con fetta d\'arancia.', 1),
(4, 'Campari Spritz', 'Aperitivi', 6.50, 'Gusto deciso e amaricante: Prosecco DOC, Campari Bitter e spruzzo di soda.', 1),
(5, 'Hugo Spritz', 'Aperitivi', 7.00, 'Rinfrescante e aromatico: Prosecco DOC, menta fresca, sciroppo e soda.', 1),
(6, 'Gin Tonic Classico', 'Long Drink', 8.00, 'Gin London Dry e acqua tonica premium serviti con ghiaccio e scorza di limone.', 1),
(7, 'Moscow Mule', 'Long Drink', 8.50, 'Vodka premium, ginger beer frizzante e succo di lime fresco servito nella tazza di rame.', 1),
(8, 'London Mule', 'Long Drink', 8.50, 'Variante con Gin London Dry aromatico, succo di lime e ginger beer.', 1),
(9, 'Mojito Cubano', 'Cocktail Pestati', 8.50, 'Rum bianco, lime fresco pestato, menta, zucchero di canna e top di soda.', 1),
(10, 'Caipirinha', 'Cocktail Pestati', 8.50, 'Cachaca brasiliana originale pestata con lime e zucchero.', 1),
(11, 'Margarita', 'Cocktail All Day', 8.50, 'Tequila Blanco, Triple Sec e succo di lime fresco con caratteristica bordatura di sale.', 1),
(12, 'Daiquiri', 'Cocktail All Day', 8.00, 'Rum bianco caraibico, succo di lime fresco e sciroppo di zucchero agitati nello shaker.', 1),
(13, 'Cuba Libre', 'Long Drink', 7.50, 'Rum bianco, cola ghiacciata e succo di lime fresco.', 1),
(14, 'Vodka Lemon', 'Long Drink', 7.50, 'Vodka premium e Lemon Soda ghiacciata con fetta di limone.', 1),
(15, 'Cosmopolitan', 'Cocktail All Day', 8.50, 'Vodka premium, Triple Sec, succo di lime e succo di mirtillo rosso americano.', 1),
(16, 'Espresso Martini', 'After Dinner', 9.00, 'Vodka premium, liquore Kahlúa al caffè e caffè espresso appena estratto con crema soffice.', 1),
(17, 'Old Fashioned', 'Cocktail All Day', 9.00, 'Bourbon Whiskey americano, gocce di bitter, zucchero e spruzzo di soda con scorza d\'arancia.', 1),
(18, 'Whiskey Sour', 'Cocktail All Day', 8.50, 'Bourbon Whiskey vellutato con succo di limone fresco e sciroppo di zucchero.', 1),
(19, 'Tequila Sunrise', 'Long Drink', 8.00, 'Tequila Blanco, succo d\'arancia fresca e sfumatura rossa di sciroppo di granatina.', 1),
(20, 'Black Russian', 'After Dinner', 8.00, 'Vodka premium e liquore al caffè Kahlúa serviti "on the rocks".', 1),
(21, 'White Russian', 'After Dinner', 8.50, 'Vodka premium, liquore al caffè e crema Baileys vellutata.', 1),
(22, 'B-52 Shot', 'Shot & Cicchetti', 4.50, 'Famoso shot a tre strati: liquore al caffè, Baileys e Triple Sec.', 1),
(23, 'Shot Amaro del Capo', 'Shot & Cicchetti', 3.50, 'Servito rigorosamente a -20°C nel bicchierino ghiacciato.', 1),
(24, 'Sambuca con la Mosca', 'Shot & Cicchetti', 3.50, 'Sambuca pura servita con tre chicchi di caffè tostato.', 1),
(25, 'Calice Prosecco Superiore DOC', 'Vini & Bollicine', 5.00, 'Bollicina veneta fresca e floreale, perfetta per brindare.', 1),
(26, 'Calice Chianti Classico DOCG', 'Vini & Bollicine', 6.00, 'Vino rosso toscano corposo ed elegante.', 1),
(27, 'Birra Bionda Media', 'Birre', 5.00, 'Birra bionda alla spina da 40cl, fresca e dissetante.', 1),
(28, 'Birra Artigianale IPA', 'Birre', 6.50, 'Birra artigianale ambrata da 33cl con profumate note agrumate e luppolate.', 1),
(29, 'Virgin Mojito (Analcolico)', 'Analcolici', 6.00, 'Lime pestato, menta fresca, zucchero di canna e ginger beer frizzante.', 1),
(30, 'Florida Fruit (Analcolico)', 'Analcolici', 6.00, 'Mix dissetante di succo d\'arancia, ananas, limone fresco e goccia di granatina.', 1)
ON DUPLICATE KEY UPDATE
    `category` = VALUES(`category`),
    `price` = VALUES(`price`),
    `description` = VALUES(`description`),
    `is_active` = VALUES(`is_active`);
DELETE FROM `recipe_items` WHERE `drink_id` BETWEEN 1 AND 30;

INSERT INTO `recipe_items` (`drink_id`, `ingredient_id`, `amount`) VALUES
(1, 1, 30.00),  -- 30ml Gin London Dry
(1, 9, 30.00),  -- 30ml Campari Bitter
(1, 11, 30.00), -- 30ml Vermouth Rosso
(2, 9, 30.00),  -- 30ml Campari Bitter
(2, 11, 30.00), -- 30ml Vermouth Rosso
(2, 25, 40.00), -- 40ml Soda
(3, 19, 60.00), -- 60ml Prosecco DOC
(3, 10, 40.00), -- 40ml Aperol
(3, 25, 20.00), -- 20ml Soda
(4, 19, 60.00), -- 60ml Prosecco DOC
(4, 9, 40.00),  -- 40ml Campari Bitter
(4, 25, 20.00), -- 20ml Soda
(5, 19, 70.00), -- 70ml Prosecco DOC
(5, 25, 30.00), -- 30ml Soda
(5, 33, 20.00), -- 20ml Sciroppo Zucchero
(5, 35, 2.00),  -- 2 pz Menta Fresca
(6, 1, 50.00),   -- 50ml Gin London Dry
(6, 23, 150.00), -- 150ml Acqua Tonica
(7, 2, 50.00),   -- 50ml Vodka Premium
(7, 24, 120.00), -- 120ml Ginger Beer
(7, 28, 20.00),  -- 20ml Succo Lime
(8, 1, 50.00),   -- 50ml Gin London Dry
(8, 24, 120.00), -- 120ml Ginger Beer
(8, 28, 20.00),  -- 20ml Succo Lime
(9, 3, 50.00),  -- 50ml Rum Bianco
(9, 28, 30.00), -- 30ml Succo Lime
(9, 33, 20.00), -- 20ml Sciroppo Zucchero
(9, 25, 40.00), -- 40ml Soda
(9, 35, 2.00),  -- 2 pz Menta Fresca
(10, 8, 50.00),  -- 50ml Cachaca
(10, 28, 30.00), -- 30ml Succo Lime
(10, 33, 20.00), -- 20ml Sciroppo Zucchero
(11, 5, 50.00),  -- 50ml Tequila Blanco
(11, 13, 25.00), -- 25ml Triple Sec
(11, 28, 25.00), -- 25ml Succo Lime
(12, 3, 50.00),  -- 50ml Rum Bianco
(12, 28, 30.00), -- 30ml Succo Lime
(12, 33, 20.00), -- 20ml Sciroppo Zucchero
(13, 3, 50.00),   -- 50ml Rum Bianco
(13, 26, 150.00), -- 150ml Cola
(13, 28, 15.00),  -- 15ml Succo Lime
(14, 2, 50.00),   -- 50ml Vodka Premium
(14, 27, 150.00), -- 150ml Lemon Soda
(15, 2, 45.00),  -- 45ml Vodka Premium
(15, 13, 20.00), -- 20ml Triple Sec
(15, 28, 20.00), -- 20ml Succo Lime
(15, 30, 30.00), -- 30ml Succo Cranberry
(16, 2, 50.00),  -- 50ml Vodka Premium
(16, 14, 30.00), -- 30ml Liquore Caffè Kahlúa
(16, 36, 30.00), -- 30ml Caffè Espresso
(16, 33, 10.00), -- 10ml Sciroppo Zucchero
(17, 6, 50.00),  -- 50ml Bourbon Whiskey
(17, 33, 10.00), -- 10ml Sciroppo Zucchero
(17, 25, 10.00), -- 10ml Soda
(18, 6, 50.00),  -- 50ml Bourbon Whiskey
(18, 29, 30.00), -- 30ml Succo Limone
(18, 33, 20.00), -- 20ml Sciroppo Zucchero
(19, 5, 50.00),   -- 50ml Tequila Blanco
(19, 31, 120.00), -- 120ml Succo Arancia
(19, 34, 15.00),  -- 15ml Sciroppo Granatina
(20, 2, 50.00),  -- 50ml Vodka Premium
(20, 14, 25.00), -- 25ml Liquore Caffè Kahlúa
(21, 2, 50.00),  -- 50ml Vodka Premium
(21, 14, 25.00), -- 25ml Liquore Caffè Kahlúa
(21, 18, 25.00), -- 25ml Baileys Irish Cream
(22, 14, 20.00), -- 20ml Liquore Caffè Kahlúa
(22, 18, 20.00), -- 20ml Baileys Irish Cream
(22, 13, 20.00), -- 20ml Triple Sec
(23, 15, 40.00), -- 40ml Amaro del Capo
(24, 17, 40.00), -- 40ml Sambuca
(25, 19, 150.00), -- 150ml Prosecco DOC
(26, 22, 150.00), -- 150ml Vino Chianti DOCG
(27, 20, 400.00), -- 400ml Birra Bionda
(28, 21, 330.00), -- 330ml Birra IPA
(29, 28, 30.00),  -- 30ml Succo Lime
(29, 33, 25.00),  -- 25ml Sciroppo Zucchero
(29, 24, 120.00), -- 120ml Ginger Beer
(29, 35, 2.00),   -- 2 pz Menta Fresca
(30, 31, 60.00), -- 60ml Succo Arancia
(30, 32, 60.00), -- 60ml Succo Ananas
(30, 29, 20.00), -- 20ml Succo Limone
(30, 34, 15.00); -- 15ml Sciroppo Granatina
INSERT INTO `stock_logs` (`ingredient_id`, `change_amount`, `resulting_stock`, `reason`)
SELECT `id`, `stock`, `stock`, 'Caricamento Iniziale Pacchetto Esempi'
FROM `ingredients`
WHERE `id` BETWEEN 1 AND 36;

SET FOREIGN_KEY_CHECKS = 1;

COMMIT;
