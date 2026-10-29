CREATE DATABASE IF NOT EXISTS `database_mysql`
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE `database_mysql`;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `stock_logs`;
DROP TABLE IF EXISTS `order_items`;
DROP TABLE IF EXISTS `orders`;
DROP TABLE IF EXISTS `recipe_items`;
DROP TABLE IF EXISTS `drinks`;
DROP TABLE IF EXISTS `ingredients`;
DROP TABLE IF EXISTS `settings`;

SET FOREIGN_KEY_CHECKS = 1;
CREATE TABLE `settings` (
    `key` VARCHAR(50) NOT NULL PRIMARY KEY,
    `value` VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE `ingredients` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(120) NOT NULL UNIQUE,
    `category` VARCHAR(60) NOT NULL DEFAULT 'Altro',
    `unit` VARCHAR(20) NOT NULL DEFAULT 'ml',
    `stock` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `alert_threshold` DECIMAL(10, 2) NOT NULL DEFAULT 200.00,
    `cost_per_unit` DECIMAL(10, 4) NOT NULL DEFAULT 0.0000,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE `drinks` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(120) NOT NULL UNIQUE,
    `category` VARCHAR(60) NOT NULL DEFAULT 'Cocktail',
    `price` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `description` TEXT,
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE `recipe_items` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `drink_id` INT NOT NULL,
    `ingredient_id` INT NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    UNIQUE KEY `uk_drink_ingredient` (`drink_id`, `ingredient_id`),
    CONSTRAINT `fk_recipe_drink` FOREIGN KEY (`drink_id`) REFERENCES `drinks` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_recipe_ingredient` FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE `orders` (
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
CREATE TABLE `order_items` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `order_id` INT NOT NULL,
    `drink_id` INT NOT NULL,
    `quantity` INT NOT NULL,
    `unit_price` DECIMAL(10, 2) NOT NULL,
    `subtotal` DECIMAL(10, 2) NOT NULL,
    CONSTRAINT `fk_item_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_item_drink` FOREIGN KEY (`drink_id`) REFERENCES `drinks` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE `stock_logs` (
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
('bar_name', 'BarMaster Cocktail Lounge');
INSERT INTO `ingredients` (`id`, `name`, `category`, `unit`, `stock`, `alert_threshold`, `cost_per_unit`) VALUES
(1, 'Gin London Dry', 'Distillati', 'ml', 1400.00, 300.00, 0.0200),
(2, 'Campari Bitter', 'Liquori & Bitter', 'ml', 1000.00, 200.00, 0.0180),
(3, 'Vermouth Rosso', 'Vini & Vermouth', 'ml', 1000.00, 200.00, 0.0150),
(4, 'Vodka Premium', 'Distillati', 'ml', 1200.00, 300.00, 0.0190),
(5, 'Rum Bianco Havana', 'Distillati', 'ml', 1000.00, 250.00, 0.0210),
(6, 'Tequila Blanco', 'Distillati', 'ml', 700.00, 200.00, 0.0250),
(7, 'Aperol', 'Liquori & Bitter', 'ml', 1500.00, 300.00, 0.0160),
(8, 'Triple Sec / Cointreau', 'Liquori & Bitter', 'ml', 700.00, 150.00, 0.0240),
(9, 'Prosecco DOC', 'Vini & Bollicine', 'ml', 2250.00, 750.00, 0.0120),
(10, 'Acqua Tonica Fever-Tree', 'Soft Drink & Mixer', 'ml', 3000.00, 500.00, 0.0060),
(11, 'Soda / Acqua Frizzante', 'Soft Drink & Mixer', 'ml', 2500.00, 500.00, 0.0020),
(12, 'Succo di Lime Fresco', 'Succhi & Preparati', 'ml', 800.00, 200.00, 0.0080),
(13, 'Sciroppo di Zucchero', 'Succhi & Preparati', 'ml', 1000.00, 200.00, 0.0050),
(14, 'Cola', 'Soft Drink & Mixer', 'ml', 2000.00, 500.00, 0.0040),
(15, 'Foglie di Menta', 'Frutta & Botaniche', 'pz', 40.00, 10.00, 0.1000);
INSERT INTO `drinks` (`id`, `name`, `category`, `price`, `description`, `is_active`) VALUES
(1, 'Negroni Classico', 'Cocktail Pre-Dinner', 8.00, 'L\'intramontabile aperitivo italiano: Gin, Campari Bitter e Vermouth Rosso in parti uguali con scorza d\'arancia.', 1),
(2, 'Gin Tonic Perfetto', 'Long Drink', 8.00, 'Gin London Dry rinfrescato con Acqua Tonica premium e bacche di ginepro.', 1),
(3, 'Aperol Spritz', 'Aperitivi', 6.50, 'Il re dell\'aperitivo: Prosecco DOC, Aperol, spruzzo di soda e fetta d\'arancia.', 1),
(4, 'Mojito Cubano', 'Cocktail Pestati', 8.50, 'Rum Bianco, succo di lime fresco, sciroppo di zucchero, menta fresca e soda frizzante.', 1),
(5, 'Margarita', 'Cocktail All Day', 8.50, 'Tequila Blanco messicana, Triple Sec e succo di lime fresco con bordo di sale.', 1),
(6, 'Vodka Tonic', 'Long Drink', 7.50, 'Vodka Premium ghiacciata con tonica Fever-Tree e fetta di lime.', 1),
(7, 'Cuba Libre', 'Long Drink', 7.50, 'Rum Bianco Havana, Cola ghiacciata e succo di lime.', 1),
(8, 'Campari Spritz', 'Aperitivi', 6.50, 'Per gli amanti delle note amare: Prosecco DOC, Campari Bitter e soda.', 1);
INSERT INTO `recipe_items` (`drink_id`, `ingredient_id`, `amount`) VALUES
(1, 1, 30.00),
(1, 2, 30.00),
(1, 3, 30.00),
(2, 1, 50.00),
(2, 10, 150.00),
(3, 9, 60.00),
(3, 7, 40.00),
(3, 11, 20.00),
(4, 5, 50.00),
(4, 12, 30.00),
(4, 13, 20.00),
(4, 11, 40.00),
(4, 15, 1.00),
(5, 6, 50.00),
(5, 8, 25.00),
(5, 12, 25.00),
(6, 4, 50.00),
(6, 10, 150.00),
(7, 5, 50.00),
(7, 14, 150.00),
(7, 12, 15.00),
(8, 9, 60.00),
(8, 2, 40.00),
(8, 11, 20.00);
INSERT INTO `stock_logs` (`ingredient_id`, `change_amount`, `resulting_stock`, `reason`)
SELECT `id`, `stock`, `stock`, 'Inventario Iniziale MySQL' FROM `ingredients`;

COMMIT;
